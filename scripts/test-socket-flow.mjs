import WebSocket from 'ws';

const url = process.env.VITE_BATTLE_SOCKET_URL ?? process.env.BATTLE_SOCKET_URL ?? 'ws://localhost:8788/battle';
const timeoutMs = Number(process.env.SOCKET_TEST_TIMEOUT_MS ?? 45000);

const players = [
  { userId: 'socket-test-a', nickname: '测试玩家A', power: 820 },
  { userId: 'socket-test-b', nickname: '测试玩家B', power: 830 }
];

const roster = (prefix) => ({
  formationId: '433',
  lineup: [
    { slotId: 'gk', playerId: `${prefix}-gk`, displayName: `${prefix}门将`, position: 'GK', rating: 82, role: 'starter', skill: '门线反应' },
    { slotId: 'df1', playerId: `${prefix}-df1`, displayName: `${prefix}后卫`, position: 'DF', rating: 80, role: 'starter', skill: '精准抢断' },
    { slotId: 'mf1', playerId: `${prefix}-mf1`, displayName: `${prefix}中场`, position: 'MF', rating: 84, role: 'starter', skill: '直塞调度' },
    { slotId: 'fw1', playerId: `${prefix}-fw1`, displayName: `${prefix}前锋`, position: 'FW', rating: 88, role: 'starter', skill: '冷静单刀' }
  ],
  substitutes: [
    { slotId: 'bench-1', playerId: `${prefix}-sub1`, displayName: `${prefix}替补`, position: 'MF', rating: 78, role: 'bench', skill: '后插上' }
  ]
});

function connectPlayer(player, prefix) {
  const socket = new WebSocket(url);
  const state = {
    nickname: player.nickname,
    matched: false,
    events: 0,
    done: false,
    error: ''
  };

  socket.on('open', () => {
    console.log(`[${player.nickname}] connected`);
    socket.send(JSON.stringify({
      type: 'join_match',
      payload: {
        ...player,
        avatarUrl: '',
        ...roster(prefix)
      }
    }));
  });

  socket.on('message', (raw) => {
    const message = JSON.parse(String(raw));
    if (message.type === 'match_waiting') {
      console.log(`[${player.nickname}] waiting ticket=${message.payload.ticketId}`);
    }
    if (message.type === 'match_found') {
      state.matched = true;
      console.log(`[${player.nickname}] matched room=${message.payload.roomId} side=${message.payload.side} opponent=${message.payload.opponent.nickname}`);
      socket.send(JSON.stringify({ type: 'battle_ready', payload: { roomId: message.payload.roomId } }));
    }
    if (message.type === 'battle_start') {
      console.log(`[${player.nickname}] battle_start`);
    }
    if (message.type === 'battle_event') {
      state.events += 1;
      const event = message.payload;
      console.log(`[${player.nickname}] event#${state.events} ${event.minute}' ${event.scoreA}:${event.scoreB} ${event.title} ${event.detail}`);
    }
    if (message.type === 'battle_done') {
      state.done = true;
      console.log(`[${player.nickname}] battle_done events=${state.events}`);
      socket.close();
    }
    if (message.type === 'battle_error' || message.type === 'error') {
      state.error = message.payload?.message ?? message.type;
      console.error(`[${player.nickname}] ${message.type}`, message.payload);
      socket.close();
    }
  });

  socket.on('close', () => {
    console.log(`[${player.nickname}] closed matched=${state.matched} events=${state.events}`);
    validateIfFinished();
  });

  socket.on('error', (error) => {
    state.error = error.message || 'socket_error';
    console.error(`[${player.nickname}] socket error`, state.error);
  });

  return { socket, state };
}

const clients = [
  connectPlayer(players[0], 'A'),
  connectPlayer(players[1], 'B')
];

const timeout = setTimeout(() => {
  console.error(`[socket-test] timeout after ${timeoutMs}ms`);
  clients.forEach(({ socket }) => socket.close());
  process.exitCode = 1;
}, timeoutMs).unref();

function validateIfFinished() {
  if (!clients.every(({ socket }) => socket.readyState === WebSocket.CLOSED)) return;
  clearTimeout(timeout);
  const failures = clients
    .map(({ state }) => {
      if (state.error) return `${state.nickname}: ${state.error}`;
      if (!state.matched) return `${state.nickname}: not matched`;
      if (!state.done) return `${state.nickname}: battle did not finish`;
      if (state.events <= 0) return `${state.nickname}: no battle events`;
      return '';
    })
    .filter(Boolean);
  if (failures.length) {
    console.error(`[socket-test] failed: ${failures.join('; ')}`);
    process.exitCode = 1;
    return;
  }
  console.log('[socket-test] passed');
}
