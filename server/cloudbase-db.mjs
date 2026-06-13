import cloudbase from '@cloudbase/node-sdk';
import { randomUUID } from 'node:crypto';

let app;
let db;
let command;

const DEFAULT_PLAYER_STATE = {
  coins: 1286000,
  gems: 0,
  energy: 120,
  scout_tickets: 2,
  matches_played: 0,
  wins: 0,
  daily_task_date: todayDateString(),
  claimed_tasks: []
};

export function initCloudbaseDb(env) {
  const envId = env.CLOUDBASE_ENV_ID ?? env.TCB_ENV;
  const apiKey = env.CLOUDBASE_API_KEY ?? env.CLOUDBASE_APIKEY;
  const secretId = env.TENCENTCLOUD_SECRETID ?? env.CLOUDBASE_SECRET_ID;
  const secretKey = env.TENCENTCLOUD_SECRETKEY ?? env.CLOUDBASE_SECRET_KEY;

  if (!envId || (!apiKey && (!secretId || !secretKey))) {
    return false;
  }

  app = cloudbase.init(apiKey
    ? { env: envId, accessKey: apiKey }
    : { env: envId, secretId, secretKey });
  db = app.database();
  command = db.command;
  return true;
}

export function isCloudbaseConfigured() {
  return !!db;
}

function requireDb() {
  if (!db) {
    throw new Error('CloudBase database env is missing.');
  }
}

function profiles() {
  return db.collection('profiles');
}

function playerState() {
  return db.collection('player_state');
}

function matches() {
  return db.collection('matches');
}

function normalizeProfile(doc) {
  return {
    id: doc.id ?? doc._id,
    douyin_open_id: doc.douyin_open_id,
    nickname: doc.nickname,
    avatar_url: doc.avatar_url ?? null,
    is_bot: !!doc.is_bot,
    created_at: doc.created_at,
    last_login_at: doc.last_login_at
  };
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export async function upsertProfile({ douyinOpenId, nickname, avatarUrl, isBot }) {
  requireDb();
  const now = new Date().toISOString();
  const existing = await profiles()
    .where({ douyin_open_id: douyinOpenId })
    .limit(1)
    .get();

  if (existing.data?.length) {
    const doc = existing.data[0];
    await profiles().doc(doc._id).update({
      nickname,
      avatar_url: avatarUrl,
      is_bot: isBot,
      last_login_at: now
    });
    return normalizeProfile({ ...doc, nickname, avatar_url: avatarUrl, is_bot: isBot, last_login_at: now });
  }

  const id = randomUUID();
  const profile = {
    id,
    douyin_open_id: douyinOpenId,
    nickname,
    avatar_url: avatarUrl,
    is_bot: isBot,
    created_at: now,
    last_login_at: now
  };
  await profiles().doc(id).set(profile);
  return normalizeProfile(profile);
}

export async function ensurePlayerState(userId) {
  requireDb();
  const existing = await playerState()
    .where({ user_id: userId })
    .limit(1)
    .get();

  if (existing.data?.[0]) {
    return existing.data[0];
  }

  const now = new Date().toISOString();
  const row = {
    user_id: userId,
    ...DEFAULT_PLAYER_STATE,
    updated_at: now
  };
  const id = randomUUID();
  await playerState().doc(id).set(row);
  return row;
}

export async function insertMatch(row) {
  requireDb();
  const now = new Date().toISOString();
  const id = randomUUID();
  await matches().doc(id).set({
    id,
    player_id: row.player_id,
    opponent_id: row.opponent_id ?? null,
    opponent_is_bot: row.opponent_is_bot !== false,
    opponent_name: row.opponent_name,
    mode: row.mode,
    player_score: row.player_score,
    opponent_score: row.opponent_score,
    result: row.result,
    formation_id: row.formation_id,
    lineup: row.lineup ?? [],
    opponent_formation_id: row.opponent_formation_id ?? null,
    opponent_lineup: row.opponent_lineup ?? [],
    events: row.events ?? [],
    rewards: row.rewards ?? {},
    started_at: now,
    ended_at: now,
    created_at: now
  });
}

export async function applyMatchResult({ userId, win, coins, scoutTickets, energyCost }) {
  requireDb();
  const existing = await playerState()
    .where({ user_id: userId })
    .limit(1)
    .get();
  const doc = existing.data?.[0];
  if (!doc) {
    throw new Error(`player_state not found for user ${userId}`);
  }

  await playerState().doc(doc._id).update({
    coins: command.inc(Math.max(0, coins)),
    scout_tickets: command.inc(Math.max(0, scoutTickets)),
    energy: Math.max(0, Number(doc.energy ?? 0) - Math.max(0, energyCost)),
    matches_played: command.inc(1),
    wins: command.inc(win ? 1 : 0),
    updated_at: new Date().toISOString()
  });
}

export async function patchPlayerState(userId, patch) {
  requireDb();
  const existing = await playerState()
    .where({ user_id: userId })
    .limit(1)
    .get();
  const doc = existing.data?.[0];
  if (!doc) {
    throw new Error(`player_state not found for user ${userId}`);
  }

  await playerState().doc(doc._id).update({
    ...patch,
    updated_at: new Date().toISOString()
  });
}

export async function randomBotProfile() {
  requireDb();
  const result = await profiles()
    .where({ is_bot: true })
    .field({ id: true, nickname: true, avatar_url: true })
    .limit(30)
    .get();

  const bots = result.data ?? [];
  if (!bots.length) return null;
  const bot = bots[Math.floor(Math.random() * bots.length)];
  return {
    id: bot.id ?? bot._id,
    nickname: bot.nickname,
    avatar_url: bot.avatar_url ?? null
  };
}

export async function cleanupOldMatches() {
  requireDb();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = await matches()
    .where({
      ended_at: command.lt(cutoff)
    })
    .remove();

  return result?.deleted ?? 0;
}
