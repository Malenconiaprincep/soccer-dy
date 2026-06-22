import { sys } from 'cc';

export const DEV_SCENE_KEY = 'soccer.dev.defaultScene';
export const DEV_MATCH_DURATION_KEY = 'soccer.dev.matchDurationSec';
export const DEV_MATCH_WITH_AI_KEY = 'soccer.dev.matchWithAi';
export const DEV_PANEL_COLLAPSED_KEY = 'soccer.dev.panelCollapsed';
export const DEV_PANEL_POSITION_KEY = 'soccer.dev.panelPosition';
export const DEV_TEST_USER_KEY = 'soccer.cocos.platform-user-id';

const SCENES = ['loading', 'home', 'shop', 'formation', 'blindBox', 'matchmaking', 'matchup', 'battle', 'result'] as const;
export type DevSceneName = typeof SCENES[number];

export const DEV_SCENES: DevSceneName[] = [...SCENES];
export const DEV_TEST_USERS = ['makuta', 'player1', 'player2', 'cocos-local-001'];

function store(): Storage | undefined {
  try {
    return sys.localStorage as unknown as Storage;
  } catch {
    return undefined;
  }
}

function readFlag(key: string, defaultValue = false): boolean {
  const value = store()?.getItem(key);
  if (value == null) return defaultValue;
  return value === '1';
}

function writeFlag(key: string, enabled: boolean): void {
  store()?.setItem(key, enabled ? '1' : '0');
}

export function devPanelEnabled(): boolean {
  return true;
}

export function devPanelCollapsed(): boolean {
  return readFlag(DEV_PANEL_COLLAPSED_KEY, false);
}

export function setDevPanelCollapsed(collapsed: boolean): void {
  writeFlag(DEV_PANEL_COLLAPSED_KEY, collapsed);
}

export function devDefaultScene(): DevSceneName {
  const saved = store()?.getItem(DEV_SCENE_KEY) as DevSceneName | null;
  return saved && DEV_SCENES.includes(saved) ? saved : 'home';
}

export function setDevDefaultScene(scene: DevSceneName): void {
  store()?.setItem(DEV_SCENE_KEY, scene);
}

export function matchWithAiEnabled(): boolean {
  return readFlag(DEV_MATCH_WITH_AI_KEY, false);
}

export function setMatchWithAiEnabled(enabled: boolean): void {
  writeFlag(DEV_MATCH_WITH_AI_KEY, enabled);
}

export function matchWaitMs(): number {
  const stored = store()?.getItem(DEV_MATCH_DURATION_KEY);
  if (stored) {
    const seconds = Number(stored);
    if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
  }
  return 15000;
}

export function setMatchWaitSeconds(seconds: number): void {
  const safe = Math.max(3, Math.min(120, Math.round(seconds)));
  store()?.setItem(DEV_MATCH_DURATION_KEY, String(safe));
}

export function readDevTestUser(): string | undefined {
  return store()?.getItem(DEV_TEST_USER_KEY) ?? undefined;
}

export function writeDevTestUser(value: string): void {
  store()?.setItem(DEV_TEST_USER_KEY, value);
}

export function cycleDevTestUser(current?: string): string {
  const list = DEV_TEST_USERS;
  const index = Math.max(0, list.indexOf(current ?? list[0]));
  const next = list[(index + 1) % list.length];
  writeDevTestUser(next);
  return next;
}

export function nextDevScene(current: DevSceneName): DevSceneName {
  const index = DEV_SCENES.indexOf(current);
  return DEV_SCENES[(index + 1) % DEV_SCENES.length];
}

export function prevDevScene(current: DevSceneName): DevSceneName {
  const index = DEV_SCENES.indexOf(current);
  return DEV_SCENES[(index - 1 + DEV_SCENES.length) % DEV_SCENES.length];
}

export function readDevPanelPosition(): { x: number; y: number } | undefined {
  try {
    const raw = store()?.getItem(DEV_PANEL_POSITION_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { x?: number; y?: number };
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return undefined;
    return { x: parsed.x!, y: parsed.y! };
  } catch {
    return undefined;
  }
}

export function writeDevPanelPosition(x: number, y: number): void {
  store()?.setItem(DEV_PANEL_POSITION_KEY, JSON.stringify({ x, y }));
}
