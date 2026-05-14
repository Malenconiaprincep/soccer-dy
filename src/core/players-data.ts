export type Pos = 'GK' | 'DF' | 'MF' | 'FW';

export interface PlayerDef {
  id: string;
  name: string;
  pos: Pos;
  ovr: number;
  /** 挂牌参考价（虚构） */
  price: number;
}

/** 虚构球员池（无真实人名） */
export const ALL_PLAYERS: PlayerDef[] = [
  { id: 'p01', name: '门将·小柯', pos: 'GK', ovr: 72, price: 120 },
  { id: 'p02', name: '门将·阿木', pos: 'GK', ovr: 68, price: 85 },
  { id: 'p03', name: '后卫·大壮', pos: 'DF', ovr: 70, price: 95 },
  { id: 'p04', name: '后卫·阿豆', pos: 'DF', ovr: 71, price: 102 },
  { id: 'p05', name: '后卫·卡卡', pos: 'DF', ovr: 69, price: 88 },
  { id: 'p06', name: '后卫·石头', pos: 'DF', ovr: 73, price: 118 },
  { id: 'p07', name: '中场·流星', pos: 'MF', ovr: 74, price: 135 },
  { id: 'p08', name: '中场·小满', pos: 'MF', ovr: 72, price: 110 },
  { id: 'p09', name: '中场·阿九', pos: 'MF', ovr: 75, price: 148 },
  { id: 'p10', name: '中场·团子', pos: 'MF', ovr: 70, price: 98 },
  { id: 'p11', name: '中场·闪电', pos: 'MF', ovr: 76, price: 165 },
  { id: 'p12', name: '前锋·虎牙', pos: 'FW', ovr: 77, price: 185 },
  { id: 'p13', name: '前锋·糖糖', pos: 'FW', ovr: 74, price: 142 },
  { id: 'p14', name: '前锋·阿飞', pos: 'FW', ovr: 78, price: 195 },
  { id: 'p15', name: '前锋·布丁', pos: 'FW', ovr: 73, price: 128 },
  { id: 'p16', name: '后卫·小翼', pos: 'DF', ovr: 72, price: 108 },
  { id: 'p17', name: '中场·阿月', pos: 'MF', ovr: 71, price: 105 },
  { id: 'p18', name: '前锋·小雷', pos: 'FW', ovr: 75, price: 155 },
  { id: 'm01', name: '自由·蓝波', pos: 'MF', ovr: 69, price: 92 },
  { id: 'm02', name: '自由·赤丸', pos: 'FW', ovr: 71, price: 108 },
  { id: 'm03', name: '自由·青峰', pos: 'DF', ovr: 70, price: 96 },
  { id: 'm04', name: '自由·白雪', pos: 'GK', ovr: 67, price: 72 },
  { id: 'm05', name: '自由·疾风', pos: 'MF', ovr: 72, price: 115 },
  { id: 'm06', name: '自由·夜枭', pos: 'FW', ovr: 73, price: 125 },
];

export function playerById(id: string): PlayerDef | undefined {
  return ALL_PLAYERS.find((p) => p.id === id);
}
