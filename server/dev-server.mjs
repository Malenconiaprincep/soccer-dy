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
const dashscopeApiKey = env.DASHSCOPE_API_KEY;
const bailianModel = env.BAILIAN_MODEL ?? 'qwen-turbo';
const bailianBaseUrl = env.BAILIAN_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1';
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
    if (request.method === 'POST' && url.pathname === '/api/battle/moment') {
      sendJson(response, 200, await generateBattleMoment(await readJson(request)));
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/battle/script') {
      await streamBattleScript(response, await readJson(request));
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

async function generateBattleMoment(body) {
  const events = await fetchBattleScriptEvents(body, 1);
  return events[0] ?? fallbackBattleMoment('shot', 'home');
}

async function streamBattleScript(response, body) {
  response.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  try {
    await fetchBattleScriptEvents(body, Math.max(6, Math.min(14, Number(body.count ?? 10))), (event) => {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    response.write('data: [DONE]\n\n');
  } catch (error) {
    console.error('[battle-ai] script stream failed', error);
    response.write(`data: ${JSON.stringify({ error: error.message ?? 'script_failed' })}\n\n`);
  }
  response.end();
}

async function fetchBattleScriptEvents(body, count = 10, onEvent) {
  if (!dashscopeApiKey) {
    const error = new Error('DASHSCOPE_API_KEY is not configured.');
    error.status = 503;
    throw error;
  }

  const minute = Math.max(1, Math.min(90, Number(body.minute ?? 1)));
  const scoreA = Number(body.scoreA ?? 0);
  const scoreB = Number(body.scoreB ?? 0);
  const homePlayers = normalizeSquadPlayers(body.homePlayers);
  const awayPlayers = normalizeSquadPlayers(body.awayPlayers);
  const recentEvents = Array.isArray(body.recentEvents) ? body.recentEvents.slice(0, 5) : [];
  const allowedTypes = ['goal', 'shot', 'save', 'corner', 'yellow', 'red', 'injury', 'sub'];
  const eventCount = Math.max(1, Math.min(14, Number(count ?? 10)));

  const prompt = [
    '你是一个足球小游戏比赛事件导演。请连续生成比赛事件。',
    '输出要求：',
    `- 共 ${eventCount} 条事件，按时间顺序从近到远或递增分钟均可，minute 范围 ${minute}-90`,
    '- 每行一个 JSON 对象，不要 Markdown，不要外层数组',
    '- actorName 必须是 roster 中吃到牌/进球/射门的球员 displayName',
    '- 黄牌/红牌/受伤/射门/进球的 actorName 禁止用“裁判”“教练组”；裁判仅可在 detail 里描述动作',
    '- 换人事件 actorName 可用“教练组”；扑救可用 roster 中的门将或后卫',
    '- relatedActorNames 最多 3 个；detail 35 字以内中文',
    '- score 仅进球时为 "home" 或 "away"，否则 null',
    '- roster 含 role=starter 首发与 role=bench 替补，换人与受伤可涉及替补',
    `- eventType 只能是：${allowedTypes.join(', ')}`,
    '每行 JSON 字段：{"minute":12,"eventType":"shot","actorName":"小罗","relatedActorNames":["小罗"],"detail":"...","mood":"good","score":null,"team":"home"}',
    `当前：${minute}'，比分 ${scoreA}:${scoreB}`,
    `我方 roster：${JSON.stringify(homePlayers)}`,
    `对方 roster：${JSON.stringify(awayPlayers)}`,
    `最近事件：${JSON.stringify(recentEvents)}`
  ].join('\n');

  const llmResponse = await fetch(`${bailianBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${dashscopeApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: bailianModel,
      messages: [
        { role: 'system', content: '你只输出 NDJSON，每行一个合法 JSON 对象，不要其他文字。' },
        { role: 'user', content: prompt }
      ],
      stream: true,
      temperature: 0.85,
      max_tokens: Math.min(1800, 180 * eventCount)
    })
  });

  if (!llmResponse.ok) {
    const payload = await llmResponse.json().catch(() => ({}));
    const message = payload?.error?.message ?? payload?.message ?? `DashScope request failed: ${llmResponse.status}`;
    throw new Error(message);
  }

  const events = [];
  let content = '';
  let fullContent = '';
  for await (const delta of readDashscopeDeltaStream(llmResponse)) {
    fullContent += delta;
    content += delta;
    const lines = content.split('\n');
    content = lines.pop() ?? '';
    for (const line of lines) {
      const event = normalizeBattleMoment(parseJsonObject(line), allowedTypes, homePlayers, awayPlayers);
      if (!event) continue;
      events.push(event);
      if (onEvent) onEvent(event);
    }
  }
  const tail = content.trim();
  if (tail) {
    const event = normalizeBattleMoment(parseJsonObject(tail), allowedTypes, homePlayers, awayPlayers);
    if (event && !events.some((item) => item.detail === event.detail && item.actorName === event.actorName && item.minute === event.minute)) {
      events.push(event);
      if (onEvent) onEvent(event);
    }
  }

  if (!events.length) {
    const parsed = parseJsonArray(fullContent || content || '');
    for (const item of parsed) {
      const event = normalizeBattleMoment(item, allowedTypes, homePlayers, awayPlayers);
      if (!event) continue;
      if (events.some((existing) => existing.detail === event.detail && existing.actorName === event.actorName && existing.minute === event.minute)) continue;
      events.push(event);
      if (onEvent) onEvent(event);
    }
  }

  if (!events.length) {
    const fallback = fallbackBattleMoment('shot', 'home');
    events.push(fallback);
    if (onEvent) onEvent(fallback);
  }

  return events.slice(0, eventCount);
}

async function* readDashscopeDeltaStream(response) {
  if (!response.body) return;
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

function normalizeSquadPlayers(players) {
  if (!Array.isArray(players)) return [];
  return players.slice(0, 24).map((player) => ({
    id: String(player?.id ?? ''),
    displayName: stringValue(player?.displayName, '球员'),
    position: stringValue(player?.position, 'MF'),
    rating: Number(player?.rating ?? 70),
    role: player?.role === 'bench' ? 'bench' : 'starter'
  }));
}

function isSystemActor(name) {
  const text = String(name ?? '').trim();
  return text === '裁判' || text === '教练组' || text.includes('主裁') || text.includes('裁判');
}

function rosterNames(homePlayers, awayPlayers) {
  return new Set([...homePlayers, ...awayPlayers].map((player) => player.displayName));
}

function pickRosterActor(team, homePlayers, awayPlayers) {
  const pool = team === 'away' ? awayPlayers : homePlayers;
  const candidate = pool.find((player) => player.role === 'starter') ?? pool[0];
  return candidate?.displayName;
}

function normalizeBattleMoment(raw, allowedTypes, homePlayers = [], awayPlayers = []) {
  if (!raw || typeof raw !== 'object') return null;
  const eventType = allowedTypes.includes(raw.eventType) ? raw.eventType : 'shot';
  const mood = ['normal', 'good', 'bad'].includes(raw.mood) ? raw.mood : 'normal';
  const score = raw.score === 'home' || raw.score === 'away' ? raw.score : null;
  const team = raw.team === 'away' ? 'away' : 'home';
  const minute = Math.max(1, Math.min(90, Number(raw.minute ?? 1)));
  const relatedActorNames = Array.isArray(raw.relatedActorNames) ? raw.relatedActorNames.slice(0, 3).map((name) => String(name)) : [];
  const names = rosterNames(homePlayers, awayPlayers);
  let actorName = stringValue(raw.actorName, team === 'home' ? '球员' : '对手');
  const playerOnlyEvents = new Set(['goal', 'shot', 'save', 'corner', 'yellow', 'red', 'injury']);
  if (playerOnlyEvents.has(eventType) && (isSystemActor(actorName) || !names.has(actorName))) {
    const relatedPlayer = relatedActorNames.find((name) => names.has(name) && !isSystemActor(name));
    actorName = relatedPlayer ?? pickRosterActor(team, homePlayers, awayPlayers) ?? actorName;
  }
  if (eventType === 'sub' && isSystemActor(actorName)) {
    actorName = '教练组';
  }
  return {
    minute,
    eventType,
    title: titleForBattleEvent(eventType),
    actorName,
    relatedActorNames,
    detail: stringValue(raw.detail, '双方在中场展开争夺。').slice(0, 60),
    mood,
    score,
    team
  };
}

function fallbackBattleMoment(eventType, team) {
  return normalizeBattleMoment({ eventType, team, actorName: team === 'home' ? '球员' : '对手', detail: '双方在中场展开争夺。', mood: 'normal', score: null, minute: 1 }, ['goal', 'shot', 'save', 'corner', 'yellow', 'red', 'injury', 'sub']);
}

function parseJsonArray(content) {
  const text = String(content ?? '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.events) ? parsed.events : [];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

function titleForBattleEvent(eventType) {
  const titles = {
    goal: '进球',
    shot: '射门',
    save: '扑救',
    corner: '角球',
    yellow: '黄牌',
    red: '红牌',
    injury: '受伤',
    sub: '换人'
  };
  return titles[eventType] ?? '射门';
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

function parseJsonObject(content) {
  const text = String(content ?? '').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
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
