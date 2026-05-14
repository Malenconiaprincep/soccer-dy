import { ALL_PLAYERS } from './players-data';

/** 跨场景持久化的极简会话（单机占位） */
export const sessionState = {
  /** 初始资金 */
  balance: 820,
  /** 已签约球员 id */
  ownedIds: new Set<string>(ALL_PLAYERS.filter((p) => p.id.startsWith('p')).map((p) => p.id)),
  /** 转会市场上可签的 id（自由球员） */
  marketIds: new Set<string>(ALL_PLAYERS.filter((p) => p.id.startsWith('m')).map((p) => p.id)),
  /** 首发 11 人，未凑满时用默认 */
  startingIds: [] as string[],
};

const DEFAULT_XI = ['p01', 'p03', 'p04', 'p06', 'p07', 'p08', 'p09', 'p11', 'p12', 'p13', 'p14'];

export function ensureStartingXi(): string[] {
  sessionState.startingIds = sessionState.startingIds.filter((id) => sessionState.ownedIds.has(id));
  if (sessionState.startingIds.length === 11) return [...sessionState.startingIds];

  const pool = ALL_PLAYERS.filter((p) => sessionState.ownedIds.has(p.id)).map((p) => p.id);
  const xi = new Set(sessionState.startingIds);
  for (const id of pool) {
    if (xi.size >= 11) break;
    if (!xi.has(id)) {
      xi.add(id);
      sessionState.startingIds.push(id);
    }
  }
  if (sessionState.startingIds.length < 11) {
    sessionState.startingIds = [];
    for (const id of DEFAULT_XI) {
      if (sessionState.ownedIds.has(id)) sessionState.startingIds.push(id);
      if (sessionState.startingIds.length >= 11) break;
    }
    for (const id of pool) {
      if (sessionState.startingIds.length >= 11) break;
      if (!sessionState.startingIds.includes(id)) sessionState.startingIds.push(id);
    }
  }
  return [...sessionState.startingIds];
}

export function setStartingXi(ids: string[]): void {
  sessionState.startingIds = [...ids];
}
