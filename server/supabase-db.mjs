import { randomUUID } from 'node:crypto';

let supabaseUrl;
let serviceKey;

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

export function initSupabaseDb(env) {
  supabaseUrl = cleanUrl(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL);
  serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_KEY;
  return !!(supabaseUrl && serviceKey);
}

export function isSupabaseConfigured() {
  return !!(supabaseUrl && serviceKey);
}

function requireDb() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase env is missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
}

export async function ensureSupabaseSchema() {
  requireDb();
  await request('/profiles?select=id&limit=1');
  await request('/player_state?select=user_id&limit=1');
  await request('/matches?select=id&limit=1');
}

export async function upsertProfile({ douyinOpenId, nickname, avatarUrl, isBot }) {
  requireDb();
  const now = new Date().toISOString();
  const rows = await request('/profiles?on_conflict=douyin_open_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: [{
      douyin_open_id: douyinOpenId,
      nickname,
      avatar_url: avatarUrl,
      is_bot: !!isBot,
      last_login_at: now
    }]
  });
  return rows[0];
}

export async function ensurePlayerState(userId) {
  requireDb();
  const existing = await request(`/player_state?user_id=eq.${encodeURIComponent(userId)}&select=*`);
  if (existing[0]) return existing[0];

  const rows = await request('/player_state', {
    method: 'POST',
    prefer: 'return=representation',
    body: [{
      user_id: userId,
      ...DEFAULT_PLAYER_STATE,
      daily_task_date: todayDateString(),
      updated_at: new Date().toISOString()
    }]
  });
  return rows[0];
}

export async function insertMatch(row) {
  requireDb();
  const now = new Date().toISOString();
  await request('/matches', {
    method: 'POST',
    prefer: 'return=minimal',
    body: [{
      id: randomUUID(),
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
    }]
  });
}

export async function applyMatchResult({ userId, win, coins, scoutTickets, energyCost }) {
  requireDb();
  await request('/rpc/apply_match_result', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      p_user_id: userId,
      p_win: !!win,
      p_coins: Math.max(0, Number(coins ?? 0)),
      p_scout_tickets: Math.max(0, Number(scoutTickets ?? 0)),
      p_energy_cost: Math.max(0, Number(energyCost ?? 0))
    }
  });
}

export async function patchPlayerState(userId, patch) {
  requireDb();
  const rows = await request(`/player_state?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: {
      ...patch,
      updated_at: new Date().toISOString()
    }
  });
  if (!rows[0]) throw new Error(`player_state not found for user ${userId}`);
  return rows[0];
}

export async function randomBotProfile() {
  requireDb();
  const rows = await request('/profiles?is_bot=eq.true&select=id,nickname,avatar_url&limit=30');
  if (!rows.length) return null;
  return rows[Math.floor(Math.random() * rows.length)];
}

export async function cleanupOldMatches() {
  requireDb();
  await request('/rpc/cleanup_old_matches', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {}
  });
  return undefined;
}

function cleanUrl(value) {
  return value ? String(value).replace(/\/$/, '') : '';
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function request(path, options = {}) {
  requireDb();
  const response = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    method: options.method ?? 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body == null ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Supabase request failed: ${response.status}${text ? ` ${text}` : ''}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
