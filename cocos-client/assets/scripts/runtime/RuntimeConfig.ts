export interface RuntimeConfig {
  gameServerUrl: string;
  battleSocketUrl: string;
  matchmakingBotAfterMs: number;
}

declare global {
  var SOCCER_GAME_CONFIG: Partial<RuntimeConfig> | undefined;
}

const injected = globalThis.SOCCER_GAME_CONFIG ?? {};

export const runtimeConfig: RuntimeConfig = {
  gameServerUrl: injected.gameServerUrl ?? 'http://localhost:8787',
  battleSocketUrl: injected.battleSocketUrl ?? 'ws://localhost:8788',
  matchmakingBotAfterMs: injected.matchmakingBotAfterMs ?? 5000
};
