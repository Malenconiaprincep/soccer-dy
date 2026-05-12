const SAVE_KEY = 'football_mvp_save_v1';

export interface RawStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function createMemoryStorage(): RawStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
  };
}

type TtApi = { getStorageSync?: (k: string) => unknown; setStorageSync?: (k: string, v: unknown) => void };

/** 抖音小游戏优先，其次 localStorage，单元测试用内存 */
export function detectStorage(): RawStorage {
  const g = globalThis as unknown as { tt?: TtApi };
  if (g.tt?.getStorageSync && g.tt?.setStorageSync) {
    return {
      getItem: (key) => {
        try {
          const v = g.tt!.getStorageSync!(key);
          if (v == null) return null;
          return typeof v === 'string' ? v : JSON.stringify(v);
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        g.tt!.setStorageSync!(key, value);
      },
    };
  }
  if (typeof localStorage !== 'undefined') {
    return {
      getItem: (k) => localStorage.getItem(k),
      setItem: (k, v) => localStorage.setItem(k, v),
    };
  }
  return createMemoryStorage();
}

export interface PersistedV1 {
  readonly version: 1;
  managerName: string;
  coins: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  formationId: import('./Types').FormationId;
  lineup: (string | null)[];
  squad: import('./Types').PlayerInstance[];
  shopOffers: import('./Types').ShopOffer[];
  lastGachaLog: string[];
}

export function defaultSave(): PersistedV1 {
  return {
    version: 1,
    managerName: '新晋经理',
    coins: 10_000,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    formationId: '442',
    lineup: Array(11).fill(null) as (string | null)[],
    squad: [],
    shopOffers: [],
    lastGachaLog: [],
  };
}

export class SaveRepository {
  constructor(private readonly raw: RawStorage = detectStorage()) {}

  load(): PersistedV1 {
    try {
      const s = this.raw.getItem(SAVE_KEY);
      if (!s) return defaultSave();
      const o = JSON.parse(s) as Partial<PersistedV1>;
      if (o.version !== 1) return defaultSave();
      const base = defaultSave();
      return {
        ...base,
        ...o,
        lineup: (o.lineup?.length === 11 ? o.lineup : base.lineup) as (string | null)[],
        squad: Array.isArray(o.squad) ? o.squad : [],
        shopOffers: Array.isArray(o.shopOffers) ? o.shopOffers : [],
        lastGachaLog: Array.isArray(o.lastGachaLog) ? o.lastGachaLog.slice(0, 8) : [],
      };
    } catch {
      return defaultSave();
    }
  }

  save(data: PersistedV1): void {
    this.raw.setItem(SAVE_KEY, JSON.stringify(data));
  }
}
