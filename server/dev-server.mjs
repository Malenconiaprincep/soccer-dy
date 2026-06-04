import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultShopConfig, normalizeShopConfig } from './shop-config.mjs';

const env = loadEnv();
const port = Number(env.SERVER_PORT ?? 8787);
const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const douyinAppId = env.DOUYIN_APP_ID;
const douyinAppSecret = env.DOUYIN_APP_SECRET;
const botAfterMs = Number(env.MATCH_BOT_AFTER_MS ?? 12000);
const ticketTtlMs = Number(env.MATCH_TICKET_TTL_MS ?? 45000);
const queue = new Map();
const shopConfigPath = resolve(process.cwd(), 'server/shop-config.local.json');

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('[server] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for database writes.');
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      send(response, 204);
      return;
    }

    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/session') {
      sendJson(response, 200, await syncSession(await readJson(request)));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/matchmaking/join') {
      sendJson(response, 200, await joinMatch(await readJson(request)));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/matchmaking/poll') {
      sendJson(response, 200, await pollMatch(url.searchParams.get('ticketId') ?? ''));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/matchmaking/cancel') {
      const body = await readJson(request);
      queue.delete(String(body.ticketId ?? ''));
      sendJson(response, 200, { ok: true });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/matches') {
      sendJson(response, 200, await recordMatch(await readJson(request)));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/shop/grant') {
      sendJson(response, 200, await grantShopReward(await readJson(request)));
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/shop-config') {
      sendJson(response, 200, readShopConfig());
      return;
    }
    if (request.method === 'PUT' && url.pathname === '/api/shop-config') {
      const config = normalizeShopConfig(await readJson(request));
      writeFileSync(shopConfigPath, JSON.stringify(config, null, 2));
      sendJson(response, 200, config);
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/cleanup-matches') {
      await supabaseRpc('cleanup_old_matches', {});
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 404, { error: 'not_found' });
  } catch (error) {
    console.error('[server] request failed', error);
    sendJson(response, 500, { error: 'server_error', message: error.message });
  }
});

server.listen(port, () => {
  console.info(`[server] soccer service listening on http://localhost:${port}`);
});

setInterval(() => {
  const now = Date.now();
  for (const [ticketId, ticket] of queue.entries()) {
    if (now - ticket.createdAt > ticketTtlMs) queue.delete(ticketId);
  }
}, 10000).unref();

async function syncSession(body) {
  const platform = stringValue(body.platform, 'douyin');
  const platformUserId = stringValue(body.platformUserId, `guest-${randomUUID()}`);
  const nickname = stringValue(body.nickname, platform === 'web' ? '本地经理' : '抖音玩家');
  const avatarUrl = body.avatarUrl ? String(body.avatarUrl) : null;
  const loginCode = body.loginCode ? String(body.loginCode) : '';
  const douyinOpenId = platform === 'douyin'
    ? await resolveDouyinOpenId(loginCode, platformUserId)
    : `${platform}:${platformUserId}`;
  const profile = await upsertProfile({ douyinOpenId, nickname, avatarUrl, isBot: false });
  const state = await ensurePlayerState(profile.id);
  return {
    user: {
      userId: profile.id,
      nickname: profile.nickname,
      avatarUrl: profile.avatar_url
    },
    state
  };
}

async function resolveDouyinOpenId(loginCode, fallbackUserId) {
  if (!loginCode || !douyinAppId || !douyinAppSecret) {
    return fallbackUserId.startsWith('douyin-code:') ? fallbackUserId : `douyin:${fallbackUserId}`;
  }

  try {
    const response = await fetch('https://developer.toutiao.com/api/apps/v2/jscode2session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appid: douyinAppId,
        secret: douyinAppSecret,
        code: loginCode
      })
    });
    const payload = await response.json();
    const openid = payload?.data?.openid ?? payload?.openid;
    if (response.ok && openid) return `douyin:${openid}`;
    console.warn('[douyin] jscode2session failed', payload);
  } catch (error) {
    console.warn('[douyin] jscode2session request failed', error);
  }

  return `douyin-code:${loginCode}`;
}

async function joinMatch(body) {
  const ticket = createTicket(body);
  for (const [otherId, other] of queue.entries()) {
    if (otherId === ticket.ticketId || other.userId === ticket.userId || other.matched) continue;
    if (Math.abs(other.power - ticket.power) > 260) continue;

    queue.delete(otherId);
    ticket.matched = toOpponent(other, false);
    other.matched = toOpponent(ticket, false);
    queue.set(ticket.ticketId, ticket);
    queue.set(other.ticketId, other);
    return { status: 'matched', ticketId: ticket.ticketId, opponent: ticket.matched };
  }

  queue.set(ticket.ticketId, ticket);
  return { status: 'waiting', ticketId: ticket.ticketId, botAfterMs };
}

async function pollMatch(ticketId) {
  const ticket = queue.get(ticketId);
  if (!ticket) return { status: 'expired' };
  if (ticket.matched) {
    queue.delete(ticketId);
    return { status: 'matched', ticketId, opponent: ticket.matched };
  }
  if (Date.now() - ticket.createdAt >= botAfterMs) {
    const opponent = await createBotOpponent(ticket);
    queue.delete(ticketId);
    return { status: 'matched', ticketId, opponent };
  }
  return { status: 'waiting', ticketId, botAfterMs };
}

async function recordMatch(body) {
  const playerId = requiredString(body.playerId, 'playerId');
  const playerScore = Number(body.playerScore ?? 0);
  const opponentScore = Number(body.opponentScore ?? 0);
  const win = playerScore > opponentScore;
  const draw = playerScore === opponentScore;
  const rewardCoins = win ? 1200 : 520;
  const rewardScoutTickets = win ? 1 : 0;
  const rewards = {
    coins: rewardCoins,
    scoutTickets: rewardScoutTickets,
    energy: -6
  };

  await supabaseInsert('matches', {
    player_id: playerId,
    opponent_id: body.opponentId || null,
    opponent_is_bot: body.opponentIsBot !== false,
    opponent_name: stringValue(body.opponentName, 'AI 联队'),
    mode: stringValue(body.mode, 'ai'),
    player_score: playerScore,
    opponent_score: opponentScore,
    result: win ? 'win' : draw ? 'draw' : 'lose',
    formation_id: stringValue(body.formationId, '433'),
    lineup: body.lineup ?? [],
    opponent_formation_id: body.opponentFormationId || null,
    opponent_lineup: body.opponentLineup ?? [],
    events: body.events ?? [],
    rewards
  });

  await supabaseRpc('apply_match_result', {
    p_user_id: playerId,
    p_win: win,
    p_coins: rewardCoins,
    p_scout_tickets: rewardScoutTickets,
    p_energy_cost: 6
  }).catch(async () => {
    const state = await ensurePlayerState(playerId);
    await supabasePatch(`player_state?user_id=eq.${encodeURIComponent(playerId)}`, {
      coins: Number(state.coins ?? 0) + rewardCoins,
      energy: Math.max(0, Number(state.energy ?? 0) - 6),
      scout_tickets: Number(state.scout_tickets ?? 0) + rewardScoutTickets,
      matches_played: Number(state.matches_played ?? 0) + 1,
      wins: Number(state.wins ?? 0) + (win ? 1 : 0),
      updated_at: new Date().toISOString()
    });
  });

  return { ok: true, rewards };
}

async function grantShopReward(body) {
  const userId = requiredString(body.userId, 'userId');
  const state = await ensurePlayerState(userId);
  const coins = Number(body.coins ?? 0);
  const scoutTickets = Number(body.scoutTickets ?? 0);
  const gems = Number(body.gems ?? 0);
  const energy = Number(body.energy ?? 0);
  await supabasePatch(`player_state?user_id=eq.${encodeURIComponent(userId)}`, {
    coins: Number(state.coins ?? 0) + Math.max(0, coins),
    scout_tickets: Number(state.scout_tickets ?? 0) + Math.max(0, scoutTickets),
    gems: Number(state.gems ?? 0) + Math.max(0, gems),
    energy: Math.min(120, Number(state.energy ?? 0) + Math.max(0, energy)),
    updated_at: new Date().toISOString()
  });
  return { ok: true, itemId: stringValue(body.itemId, 'unknown') };
}

function createTicket(body) {
  return {
    ticketId: randomUUID(),
    userId: requiredString(body.userId, 'userId'),
    nickname: stringValue(body.nickname, '抖音玩家'),
    avatarUrl: body.avatarUrl ? String(body.avatarUrl) : null,
    power: Number(body.power ?? 0),
    formationId: stringValue(body.formationId, '433'),
    lineup: Array.isArray(body.lineup) ? body.lineup : [],
    createdAt: Date.now(),
    matched: null
  };
}

async function createBotOpponent(ticket) {
  const bot = await randomBotProfile();
  return {
    userId: bot?.id ?? null,
    nickname: bot?.nickname ?? botName(ticket.power),
    avatarUrl: bot?.avatar_url ?? null,
    isBot: true,
    mode: 'ai'
  };
}

function toOpponent(ticket, isBot) {
  return {
    userId: ticket.userId,
    nickname: ticket.nickname,
    avatarUrl: ticket.avatarUrl,
    isBot,
    mode: isBot ? 'ai' : 'douyinRealtime',
    formationId: ticket.formationId,
    lineup: ticket.lineup
  };
}

async function randomBotProfile() {
  const bots = await supabaseSelect('profiles?is_bot=eq.true&select=id,nickname,avatar_url&limit=30');
  if (!Array.isArray(bots) || bots.length === 0) return null;
  return bots[Math.floor(Math.random() * bots.length)];
}

async function upsertProfile({ douyinOpenId, nickname, avatarUrl, isBot }) {
  const rows = await supabasePost('profiles?on_conflict=douyin_open_id', {
    douyin_open_id: douyinOpenId,
    nickname,
    avatar_url: avatarUrl,
    is_bot: isBot,
    last_login_at: new Date().toISOString()
  }, 'resolution=merge-duplicates,return=representation');
  return rows[0];
}

async function ensurePlayerState(userId) {
  const rows = await supabaseSelect(`player_state?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`);
  if (rows[0]) return rows[0];
  const inserted = await supabasePost('player_state', { user_id: userId }, 'return=representation');
  return inserted[0];
}

async function supabaseSelect(path) {
  return supabaseFetch(path, { method: 'GET' });
}

async function supabaseInsert(table, row) {
  return supabasePost(table, row, 'return=minimal');
}

async function supabasePost(path, body, prefer = 'return=representation') {
  return supabaseFetch(path, { method: 'POST', body: JSON.stringify(body), prefer });
}

async function supabasePatch(path, body) {
  return supabaseFetch(path, { method: 'PATCH', body: JSON.stringify(body), prefer: 'return=minimal' });
}

async function supabaseRpc(name, body) {
  return supabaseFetch(`rpc/${name}`, { method: 'POST', body: JSON.stringify(body), prefer: 'return=minimal' });
}

async function supabaseFetch(path, options) {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase service env is missing.');
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: options.method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer ?? 'return=representation'
    },
    body: options.body
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${options.method} ${path} failed: ${response.status} ${text}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function readJson(request) {
  return new Promise((resolveJson, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('request_too_large'));
    });
    request.on('end', () => {
      try {
        resolveJson(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(response, status, payload) {
  send(response, status, JSON.stringify(payload), 'application/json');
}

function send(response, status, body = '', contentType = 'text/plain') {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': contentType
  });
  response.end(body);
}

function readShopConfig() {
  if (!existsSync(shopConfigPath)) return defaultShopConfig;
  try {
    return normalizeShopConfig(JSON.parse(readFileSync(shopConfigPath, 'utf8')));
  } catch (error) {
    console.warn('[shop] failed to read local config, using defaults', error);
    return defaultShopConfig;
  }
}

function stringValue(value, fallback) {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
}

function requiredString(value, name) {
  const text = value == null ? '' : String(value).trim();
  if (!text) throw new Error(`${name} is required`);
  return text;
}

function botName(power) {
  const titles = ['星河前锋', '青柠队长', '风暴经理人', '南看台小王', '凌空抽射'];
  return titles[Math.abs(Number(power) || 0) % titles.length];
}

function loadEnv() {
  const values = { ...process.env };
  for (const file of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index < 0) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
      if (values[key] == null) values[key] = value;
    }
  }
  return values;
}
