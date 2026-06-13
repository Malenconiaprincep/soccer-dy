const DEFAULT_MATCH_DURATION_MS = 15000;
const DEV_MATCH_DURATION_KEY = 'soccer.dev.matchDurationSec';

const runtimeEnv = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env ?? {};
const isDebugRuntime = runtimeEnv.DEV || runtimeEnv.MODE === 'douyin-debug';

export function resolveMatchDurationMs() {
  if (isDebugRuntime) {
    const stored = globalThis.localStorage?.getItem(DEV_MATCH_DURATION_KEY);
    if (stored) {
      const seconds = Number(stored);
      if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
    }
  }

  const fromEnv = Number(runtimeEnv.VITE_MATCH_DURATION_MS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv);
  return DEFAULT_MATCH_DURATION_MS;
}

export { DEV_MATCH_DURATION_KEY, DEFAULT_MATCH_DURATION_MS };
