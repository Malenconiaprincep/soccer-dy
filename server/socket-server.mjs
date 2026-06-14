import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocketServer } from 'ws';

const env = loadEnv();
const port = Number(env.SOCKET_PORT ?? env.PORT ?? 8788);
const dashscopeApiKey = env.DASHSCOPE_API_KEY;
const dashscopeBaseUrl = env.DASHSCOPE_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const dashscopeModel = env.DASHSCOPE_MODEL ?? 'qwen-flash';
const queue = [];
const rooms = new Map();
const clients = new Map();

const server = http.createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size, waiting: queue.length }));
    return;
  }
  response.writeHead(404);
  response.end('not found');
});

const wss = new WebSocketServer({ server, path: '/battle' });

wss.on('connection', (socket) => {
  const client = {
    id: randomUUID(),
    socket,
    user: undefined,
    roomId: undefined,
    side: undefined,
    match: undefined
  };
  clients.set(client.id, client);
  send(client, 'connected', { clientId: client.id });

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      send(client, 'error', { message: 'invalid_json' });
      return;
    }
    void handleMessage(client, message).catch((error) => {
      console.error('[socket] message failed', error);
      send(client, 'error', { message: error.message ?? 'server_error' });
    });
  });

  socket.on('close', () => {
    removeFromQueue(client);
    leaveRoom(client);
    clients.delete(client.id);
  });
});

server.listen(port, () => {
  console.info(`[socket] battle service listening on ws://localhost:${port}/battle`);
  if (!dashscopeApiKey) console.warn('[socket] DASHSCOPE_API_KEY missing; realtime rooms will use fallback scripted events.');
});

async function handleMessage(client, message) {
  if (message.type === 'join_match') {
    client.user = normalizeUser(message.payload);
    client.match = normalizeMatchPayload(message.payload);
    enqueueOrMatch(client);
    return;
  }

  if (message.type === 'leave_match') {
    removeFromQueue(client);
    leaveRoom(client);
    send(client, 'left_match', {});
    return;
  }

  if (message.type === 'battle_ready') {
    const room = rooms.get(client.roomId);
    if (!room) return;
    room.ready.add(client.id);
    if (room.ready.size >= 2 && !room.started) startRoomBattle(room);
  }
}

function enqueueOrMatch(client) {
  removeFromQueue(client);
  const index = queue.findIndex((other) => other.id !== client.id && Math.abs(powerOf(other) - powerOf(client)) <= 260);
  if (index < 0) {
    queue.push(client);
    send(client, 'match_waiting', { ticketId: client.id });
    return;
  }

  const opponent = queue.splice(index, 1)[0];
  const room = createRoom(client, opponent);
  sendMatchFound(room.home, room, 'home', room.away);
  sendMatchFound(room.away, room, 'away', room.home);
}

function createRoom(home, away) {
  const room = {
    id: randomUUID(),
    home,
    away,
    ready: new Set(),
    started: false,
    scoreHome: 0,
    scoreAway: 0,
    events: []
  };
  home.roomId = room.id;
  home.side = 'home';
  away.roomId = room.id;
  away.side = 'away';
  rooms.set(room.id, room);
  return room;
}

function sendMatchFound(client, room, side, opponent) {
  send(client, 'match_found', {
    roomId: room.id,
    side,
    opponent: {
      userId: opponent.user?.userId,
      nickname: opponent.user?.nickname ?? '在线玩家',
      avatarUrl: opponent.user?.avatarUrl ?? null,
      isBot: false,
      mode: 'douyinRealtime',
      formationId: opponent.match?.formationId,
      lineup: opponent.match?.lineup ?? [],
      substitutes: opponent.match?.substitutes ?? []
    }
  });
}

function startRoomBattle(room) {
  room.started = true;
  broadcast(room, 'battle_start', { roomId: room.id });
  void streamRoomEvents(room).catch((error) => {
    console.error('[socket] battle stream failed', error);
    broadcast(room, 'battle_error', { message: error.message ?? 'battle_failed' });
  });
}

async function streamRoomEvents(room) {
  const events = await generateBattleEvents(room, (event) => pushRoomEvent(room, event));
  if (!events.streaming) {
    for (const event of events.items) {
      pushRoomEvent(room, event);
      await wait(1400);
    }
  }
  broadcast(room, 'battle_done', {
    roomId: room.id,
    scoreHome: room.scoreHome,
    scoreAway: room.scoreAway,
    events: room.events
  });
}

function pushRoomEvent(room, event) {
  const normalized = normalizeBattleMoment(event);
  if (!normalized) return;
  const scoringTeam = scoringTeamOf(normalized);
  if (scoringTeam === 'home') room.scoreHome += 1;
  if (scoringTeam === 'away') room.scoreAway += 1;
  const stamped = {
    ...normalized,
    minute: normalized.minute ?? Math.min(90, 3 + room.events.length * 7),
    scoreHome: room.scoreHome,
    scoreAway: room.scoreAway
  };
  room.events.push(stamped);
  send(room.home, 'battle_event', eventForSide(stamped, 'home'));
  send(room.away, 'battle_event', eventForSide(stamped, 'away'));
}

function eventForSide(event, side) {
  if (side === 'home') {
    return {
      ...event,
      scoreA: event.scoreHome,
      scoreB: event.scoreAway
    };
  }
  return {
    ...event,
    team: event.team === 'home' ? 'away' : event.team === 'away' ? 'home' : event.team,
    score: event.score === 'home' ? 'away' : event.score === 'away' ? 'home' : event.score,
    scoreA: event.scoreAway,
    scoreB: event.scoreHome
  };
}

async function generateBattleEvents(room, onEvent) {
  if (!dashscopeApiKey) return { streaming: false, items: fallbackEvents() };
  const prompt = [
    '你是足球小游戏实时对战导演。请为两个在线玩家生成实时比赛事件。',
    '输出 NDJSON，每行一个 JSON 对象，不要 Markdown。',
    '字段：{"minute":12,"eventType":"shot","title":"射门","actorName":"球员名","relatedActorNames":["球员名"],"detail":"35字内中文","mood":"normal|good|bad","score":"home|away|null","team":"home|away"}',
    'score 仅进球时为 home/away，否则 null。eventType 只能是 goal,shot,save,corner,yellow,red,injury,sub,freekick,wondergoal。',
    'home roster=' + JSON.stringify(room.home.match?.players ?? []),
    'away roster=' + JSON.stringify(room.away.match?.players ?? []),
    '请生成 10 条，minute 递增，双方都要有事件。'
  ].join('\n');

  const response = await fetch(`${dashscopeBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${dashscopeApiKey}`,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: dashscopeModel,
      messages: [
        { role: 'system', content: '你只输出 NDJSON，每行一个合法 JSON 对象。' },
        { role: 'user', content: prompt }
      ],
      stream: true,
      enable_thinking: false,
      temperature: 0.85,
      max_tokens: 1800
    })
  });
  if (!response.ok) throw new Error(`DashScope request failed: ${response.status}`);

  const reader = response.body?.getReader();
  if (!reader) throw new Error('DashScope stream body missing');
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let content = '';
  let parsedLineCount = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    const parts = sseBuffer.split('\n');
    sseBuffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      const payloadText = line.slice(5).trim();
      if (!payloadText || payloadText === '[DONE]') continue;
      const chunk = JSON.parse(payloadText);
      const delta = chunk?.choices?.[0]?.delta?.content ?? '';
      if (!delta) continue;
      content += delta;
      const lines = stripLlmOutput(content).split('\n');
      const lastIndex = Math.max(0, lines.length - 1);
      for (let index = parsedLineCount; index < lastIndex; index += 1) {
        onEvent(parseJsonLine(lines[index]));
      }
      parsedLineCount = Math.max(parsedLineCount, lastIndex);
    }
  }
  for (const line of stripLlmOutput(content).split('\n').slice(parsedLineCount)) {
    onEvent(parseJsonLine(line));
  }
  return { streaming: true, items: [] };
}

function fallbackEvents() {
  return [
    { minute: 8, eventType: 'corner', title: '角球', actorName: '边路快马', relatedActorNames: ['边路快马'], detail: '边路突破造出角球机会', mood: 'normal', score: null, team: 'home' },
    { minute: 18, eventType: 'shot', title: '射门', actorName: '锋线尖刀', relatedActorNames: ['锋线尖刀'], detail: '禁区前沿起脚被门将抱住', mood: 'good', score: null, team: 'away' },
    { minute: 31, eventType: 'goal', title: '进球', actorName: '核心前锋', relatedActorNames: ['核心前锋'], detail: '反越位单刀推射破门', mood: 'good', score: 'home', team: 'home' },
    { minute: 44, eventType: 'save', title: '扑救', actorName: '门将', relatedActorNames: ['门将'], detail: '飞身化解近距离抽射', mood: 'bad', score: null, team: 'away' },
    { minute: 58, eventType: 'freekick', title: '任意球', actorName: '定位球专家', relatedActorNames: ['定位球专家'], detail: '弧线球擦着立柱偏出', mood: 'normal', score: null, team: 'away' },
    { minute: 76, eventType: 'wondergoal', title: '神仙球', actorName: '中场大师', relatedActorNames: ['中场大师'], detail: '凌空抽射直挂球门死角', mood: 'good', score: 'away', team: 'away' }
  ];
}

function normalizeBattleMoment(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const eventType = String(raw.eventType ?? 'shot');
  const team = raw.team === 'away' ? 'away' : 'home';
  return {
    minute: Number.isFinite(Number(raw.minute)) ? Number(raw.minute) : undefined,
    eventType,
    title: String(raw.title ?? titleForType(eventType)),
    actorName: String(raw.actorName ?? '球员'),
    relatedActorNames: Array.isArray(raw.relatedActorNames) ? raw.relatedActorNames.map(String).slice(0, 3) : [String(raw.actorName ?? '球员')],
    detail: String(raw.detail ?? '双方持续拉扯，寻找机会。').slice(0, 48),
    mood: raw.mood === 'good' || raw.mood === 'bad' ? raw.mood : 'normal',
    score: raw.score === 'home' || raw.score === 'away' ? raw.score : null,
    team
  };
}

function scoringTeamOf(event) {
  if (event.eventType === 'goal' || event.eventType === 'wondergoal') return event.score ?? event.team;
  if (event.eventType === 'freekick' && event.score) return event.score;
  return undefined;
}

function titleForType(type) {
  return ({ goal: '进球', shot: '射门', save: '扑救', corner: '角球', yellow: '黄牌', red: '红牌', injury: '受伤', sub: '换人', freekick: '任意球', wondergoal: '神仙球' })[type] ?? '攻防';
}

function parseJsonLine(line) {
  const text = String(line ?? '').trim().replace(/,$/, '');
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function stripLlmOutput(text) {
  return String(text ?? '')
    .replace(/^```(?:json|ndjson)?\s*/i, '')
    .replace(/\s*```$/g, '')
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/g, '')
    .replace(/<think>[\s\S]*$/g, '')
    .replace(/<\/?redacted_thinking>/g, '');
}

function normalizeUser(payload) {
  return {
    userId: String(payload?.userId ?? randomUUID()),
    nickname: String(payload?.nickname ?? '在线玩家'),
    avatarUrl: payload?.avatarUrl ? String(payload.avatarUrl) : null
  };
}

function normalizeMatchPayload(payload) {
  const lineup = Array.isArray(payload?.lineup) ? payload.lineup : [];
  const substitutes = Array.isArray(payload?.substitutes) ? payload.substitutes : [];
  return {
    power: Number(payload?.power ?? 0),
    formationId: String(payload?.formationId ?? '433'),
    lineup,
    substitutes,
    players: [...lineup, ...substitutes].map((item) => ({
      id: String(item?.playerId ?? item?.id ?? ''),
      displayName: String(item?.displayName ?? item?.name ?? '球员'),
      position: String(item?.position ?? 'MF'),
      rating: Number(item?.rating ?? 70),
      role: item?.role === 'bench' ? 'bench' : 'starter',
      skill: String(item?.skill ?? '全面型')
    }))
  };
}

function powerOf(client) {
  return Number(client.match?.power ?? 0);
}

function removeFromQueue(client) {
  const index = queue.findIndex((item) => item.id === client.id);
  if (index >= 0) queue.splice(index, 1);
}

function leaveRoom(client) {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (room) {
    const other = room.home.id === client.id ? room.away : room.home;
    send(other, 'opponent_left', { roomId: room.id });
    rooms.delete(room.id);
  }
  client.roomId = undefined;
  client.side = undefined;
}

function broadcast(room, type, payload) {
  send(room.home, type, payload);
  send(room.away, type, payload);
}

function send(client, type, payload) {
  if (client.socket.readyState !== client.socket.OPEN) return;
  client.socket.send(JSON.stringify({ type, payload }));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
