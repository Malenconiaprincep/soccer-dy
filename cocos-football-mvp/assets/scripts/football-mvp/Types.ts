/** 位置大类，用于阵容匹配惩罚 */
export type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW';

export type Rarity = 'S' | 'A' | 'B' | 'C';

/** 卡池模板（无实例 id） */
export interface PlayerTemplate {
  readonly id: string;
  readonly name: string;
  readonly group: PositionGroup;
  /** 总评 55–92 */
  readonly ovr: number;
  /** 虚构参考身价（百万欧元量级，不与真实球员绑定） */
  readonly valueMillionEur: number;
  readonly rarity: Rarity;
}

/** 玩家拥有的球员实例 */
export interface PlayerInstance extends PlayerTemplate {
  readonly instanceId: string;
}

export type FormationId = '442' | '433' | '352';

export interface FormationDef {
  readonly id: FormationId;
  readonly label: string;
  /** 11 个槽位所需位置大类 */
  readonly slots: readonly PositionGroup[];
  /** 进攻倾向 0.9–1.1，影响模拟进球期望 */
  readonly attackBias: number;
  readonly defenseBias: number;
}

export type MatchDifficulty = 'easy' | 'normal' | 'hard';

export interface MatchResult {
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly homeXG: number;
  readonly awayXG: number;
  readonly outcome: 'win' | 'draw' | 'loss';
  readonly coinsDelta: number;
  readonly pointsDelta: number;
  readonly narrative: string;
}

export interface ShopOffer {
  readonly offerId: string;
  readonly templateId: string;
  readonly listPrice: number;
}

export interface LeaderboardRow {
  readonly rank: number;
  readonly name: string;
  readonly points: number;
  readonly wins: number;
  readonly isSelf: boolean;
}

export interface GameSnapshot {
  readonly managerName: string;
  readonly coins: number;
  readonly points: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly formationId: FormationId;
  /** 槽位索引 -> 球员 instanceId 或 null */
  readonly lineup: readonly (string | null)[];
  readonly squad: readonly PlayerInstance[];
  readonly shopOffers: readonly ShopOffer[];
  readonly lastGachaLog: readonly string[];
}
