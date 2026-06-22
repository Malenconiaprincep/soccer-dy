# Deployment

## Supabase data store

1. Create a Supabase project.
2. Open Supabase SQL Editor and run `supabase-schema.sql`.
3. Set these server-side environment variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` must only be configured on the Node server. Do not expose it in Vite, Cocos, Douyin, or any client bundle.

The HTTP game server uses Supabase first when both variables are present. If Supabase is not configured, it falls back to the existing CloudBase adapter.

## HTTP game server

Start command:

```bash
npm run start:server
```

Required production variables:

```bash
PORT=8787
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DOUYIN_APP_ID=...
DOUYIN_APP_SECRET=...
DASHSCOPE_API_KEY=...
```

Client builds should point to the deployed HTTP server:

```bash
VITE_GAME_SERVER_URL=https://your-game-server.example.com
```

## Battle socket on Render

Start command:

```bash
npm run start:socket
```

Or deploy with `Dockerfile.socket`.

Render injects `PORT`; the socket server now prioritizes that value. Configure:

```bash
DASHSCOPE_API_KEY=...
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-flash
```

Client builds should use a secure WebSocket URL:

```bash
VITE_BATTLE_SOCKET_URL=wss://your-render-socket.onrender.com/battle
```
