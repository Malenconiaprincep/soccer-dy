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
const botAfterMs = Number(env.MATCH_BOT_AFTER_MS ?? 15000);
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
  return { status: 'waiting', ticketId: ticket.ticketId, botAfterMs: ticket.botAfterMs };
}

async function pollMatch(ticketId) {
  const ticket = queue.get(ticketId);
  if (!ticket) return { status: 'expired' };
  if (ticket.matched) {
    queue.delete(ticketId);
    return { status: 'matched', ticketId, opponent: ticket.matched };
  }
  if (Date.now() - ticket.createdAt >= ticket.botAfterMs) {
    const opponent = await createBotOpponent(ticket);
    queue.delete(ticketId);
    return { status: 'matched', ticketId, opponent };
  }
  return { status: 'waiting', ticketId, botAfterMs: ticket.botAfterMs };
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
    const events = await fetchBattleScriptEvents(body, Math.max(6, Math.min(20, Number(body.count ?? 14))));
    for (const event of events) {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    }
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
  const allowedTypes = ['goal', 'shot', 'save', 'corner', 'yellow', 'red', 'injury', 'sub', 'freekick', 'wondergoal'];
  const eventCount = Math.max(1, Math.min(20, Number(count ?? 14)));

  const prompt = [
    '你是一个足球小游戏比赛事件导演。请连续生成比赛事件。',
    '输出要求：',
    `- 共 ${eventCount} 条事件，minute 严格递增即可，间隔不必均匀（我们会重分配到全场）`,
    `- 最后一条会映射到 85-90 分钟；模型 minute 仅表示先后顺序`,
    '- 每行一个 JSON 对象，不要 Markdown，不要外层数组',
    '- roster 每位球员含 skill 字段（个人特长，如"弧线劲射""冷静单刀"），写作时必须结合该球员 skill 设计动作',
    '- 至少 1 条 wondergoal（神仙球）：倒挂金钩/凌空抽射/超远重炮/彩虹过人后破门等，detail 要体现该球员 skill，score 必填 home 或 away',
    '- 可含 1-2 条 freekick（任意球）：禁区前沿或边路定位球；直接破门则 score 填 home/away，被扑出改 eventType=save，打飞则 score=null',
    '- actorName 必须是 roster 中主罚/进球/射门球员的 displayName',
    '- 黄牌/红牌/受伤/射门/进球/任意球/神仙球的 actorName 禁止用“裁判”“教练组”；裁判仅可在 detail 里描述动作',
    '- 换人 sub：relatedActorNames 必须为 [被换下的球员, 被换上的球员] 共 2 人，前者 role=starter 后者 role=bench',
    '- 换人 detail 必须写“XX 下，YY 上”，XX/YY 为 relatedActorNames 中的 displayName',
    '- 换人 actorName 可用“教练组”；扑救可用 roster 中的门将或后卫',
    '- relatedActorNames 最多 3 个；非换人 detail 35 字以内中文',
    '- score 仅进球/神仙球/任意球破门时为 "home" 或 "away"，否则 null',
    '- roster 含 role=starter 首发与 role=bench 替补，换人与受伤可涉及替补',
    `- eventType 只能是：${allowedTypes.join(', ')}`,
    '每行 JSON 字段：{"minute":12,"eventType":"wondergoal","actorName":"迪巴拉","relatedActorNames":["迪巴拉"],"detail":"迪巴拉禁区外左脚弧线神仙球直挂死角","mood":"good","score":"home","team":"home"}',
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
      max_tokens: Math.min(4096, 220 * eventCount)
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
    }
  }
  const tail = content.trim();
  if (tail) {
    const event = normalizeBattleMoment(parseJsonObject(tail), allowedTypes, homePlayers, awayPlayers);
    if (event && !events.some((item) => item.detail === event.detail && item.actorName === event.actorName && item.minute === event.minute)) {
      events.push(event);
    }
  }

  if (!events.length) {
    const parsed = parseJsonArray(fullContent || content || '');
    for (const item of parsed) {
      const event = normalizeBattleMoment(item, allowedTypes, homePlayers, awayPlayers);
      if (!event) continue;
      if (events.some((existing) => existing.detail === event.detail && existing.actorName === event.actorName && existing.minute === event.minute)) continue;
      events.push(event);
    }
  }

  if (!events.length) {
    events.push(fallbackBattleMoment('shot', 'home'));
  }

  const finalEvents = spreadEventMinutes(events.slice(0, eventCount), minute, 90);
  if (onEvent) {
    for (const event of finalEvents) onEvent(event);
  }
  return finalEvents;
}

function spreadEventMinutes(events, startMinute = 1, endMinute = 90) {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => a.minute - b.minute);
  if (sorted.length === 1) {
    return [{ ...sorted[0], minute: Math.min(90, Math.max(85, endMinute - 1)) }];
  }

  const count = sorted.length;
  const minGap = 2;
  const maxGap = 13;
  const targetEnd = endMinute - Math.floor(Math.random() * 4);
  const available = Math.max(minGap * (count - 1), targetEnd - startMinute);
  const weights = Array.from({ length: count - 1 }, () => minGap + Math.random() * (maxGap - minGap));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const scale = available / Math.max(1, weightSum);
  const minutes = [startMinute];

  for (let index = 0; index < count - 1; index += 1) {
    const slotsLeft = count - 1 - index;
    const minRequired = minutes[minutes.length - 1] + minGap;
    const maxAllowed = targetEnd - slotsLeft * minGap;
    const gap = Math.max(minGap, Math.round(weights[index] * scale));
    minutes.push(Math.max(minRequired, Math.min(maxAllowed, minutes[minutes.length - 1] + gap)));
  }

  minutes[minutes.length - 1] = Math.min(90, Math.max(85, targetEnd));
  for (let index = 1; index < minutes.length; index += 1) {
    minutes[index] = Math.max(minutes[index], minutes[index - 1] + minGap);
  }
  minutes[minutes.length - 1] = Math.min(90, Math.max(minutes[minutes.length - 1], 85));

  return sorted.map((event, index) => ({
    ...event,
    minute: minutes[index]
  }));
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
    skill: stringValue(player?.skill, '全面型'),
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

function pickSubstitutionPair(team, homePlayers, awayPlayers) {
  const pool = team === 'away' ? awayPlayers : homePlayers;
  const starters = pool.filter((player) => player.role === 'starter');
  const bench = pool.filter((player) => player.role === 'bench');
  const offPlayer = starters[Math.floor(Math.random() * Math.max(1, starters.length))] ?? pool[0];
  const onPlayer = bench.find((player) => player.displayName !== offPlayer?.displayName) ?? bench[0] ?? pool[1];
  return {
    off: offPlayer?.displayName ?? pickRosterActor(team, homePlayers, awayPlayers) ?? '球员',
    on: onPlayer?.displayName ?? pickRosterActor(team, homePlayers, awayPlayers) ?? '替补'
  };
}

function normalizeSubstitution(raw, team, homePlayers, awayPlayers, names) {
  const pair = pickSubstitutionPair(team, homePlayers, awayPlayers);
  const related = (Array.isArray(raw.relatedActorNames) ? raw.relatedActorNames : [])
    .map((name) => String(name))
    .filter((name) => names.has(name) && !isSystemActor(name));
  let off = related[0];
  let on = related[1];
  if (!off || !on || off === on) {
    off = pair.off;
    on = pair.on === off ? pickSubstitutionPair(team, homePlayers, awayPlayers).on : pair.on;
  }
  const detail = stringValue(raw.detail, `${off} 下，${on} 上`);
  const finalDetail = detail.includes(off) && detail.includes(on) ? detail : `${off} 下，${on} 上`;
  return {
    actorName: isSystemActor(raw.actorName) ? '教练组' : stringValue(raw.actorName, '教练组'),
    relatedActorNames: [off, on],
    detail: finalDetail.slice(0, 60)
  };
}

function normalizeBattleMoment(raw, allowedTypes, homePlayers = [], awayPlayers = []) {
  if (!raw || typeof raw !== 'object') return null;
  const eventType = allowedTypes.includes(raw.eventType) ? raw.eventType : 'shot';
  const mood = ['normal', 'good', 'bad'].includes(raw.mood) ? raw.mood : 'normal';
  const team = raw.team === 'away' ? 'away' : 'home';
  let score = null;
  if (eventType === 'goal' || eventType === 'wondergoal') {
    score = raw.score === 'home' || raw.score === 'away' ? raw.score : team;
  } else if (eventType === 'freekick' && (raw.score === 'home' || raw.score === 'away')) {
    score = raw.score;
  }
  const minute = Math.max(1, Math.min(90, Number(raw.minute ?? 1)));
  const relatedActorNames = Array.isArray(raw.relatedActorNames) ? raw.relatedActorNames.slice(0, 3).map((name) => String(name)) : [];
  const names = rosterNames(homePlayers, awayPlayers);
  if (eventType === 'sub') {
    const sub = normalizeSubstitution(raw, team, homePlayers, awayPlayers, names);
    return {
      minute,
      eventType,
      title: titleForBattleEvent(eventType),
      actorName: sub.actorName,
      relatedActorNames: sub.relatedActorNames,
      detail: sub.detail,
      mood,
      score,
      team
    };
  }
  let actorName = stringValue(raw.actorName, team === 'home' ? '球员' : '对手');
  const playerOnlyEvents = new Set(['goal', 'shot', 'save', 'corner', 'yellow', 'red', 'injury', 'freekick', 'wondergoal']);
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
    wondergoal: '神仙球',
    freekick: '任意球',
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

function resolveBotAfterMs(body) {
  const custom = Number(body.botAfterMs);
  if (Number.isFinite(custom) && custom > 0) return Math.round(custom);
  return botAfterMs;
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
    botAfterMs: resolveBotAfterMs(body),
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
