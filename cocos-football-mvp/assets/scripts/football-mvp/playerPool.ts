import type { FormationDef, FormationId, PlayerTemplate, Rarity } from './Types';

export const FORMATIONS: Record<FormationId, FormationDef> = {
  '442': {
    id: '442',
    label: '4-4-2',
    slots: ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW'],
    attackBias: 1.0,
    defenseBias: 1.0,
  },
  '433': {
    id: '433',
    label: '4-3-3',
    slots: ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'],
    attackBias: 1.06,
    defenseBias: 0.96,
  },
  '352': {
    id: '352',
    label: '3-5-2',
    slots: ['GK', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW'],
    attackBias: 0.98,
    defenseBias: 1.05,
  },
};

/** 虚构球员池：姓名与身价均为原创占位，量级参考大赛热门位置档位 */
const RAW: readonly (Pick<PlayerTemplate, 'id' | 'name' | 'group' | 'ovr' | 'valueMillionEur' | 'rarity'>)[] = [
  { id: 't_gk_01', name: '门线·岳松', group: 'GK', ovr: 84, valueMillionEur: 45, rarity: 'A' },
  { id: 't_gk_02', name: '远射盾·江潮', group: 'GK', ovr: 78, valueMillionEur: 22, rarity: 'B' },
  { id: 't_gk_03', name: '青训·柏舟', group: 'GK', ovr: 66, valueMillionEur: 6, rarity: 'C' },
  { id: 't_df_01', name: '中卫·陆垣', group: 'DF', ovr: 88, valueMillionEur: 95, rarity: 'S' },
  { id: 't_df_02', name: '边闸·韩砾', group: 'DF', ovr: 86, valueMillionEur: 72, rarity: 'A' },
  { id: 't_df_03', name: '扫荡·程野', group: 'DF', ovr: 82, valueMillionEur: 38, rarity: 'A' },
  { id: 't_df_04', name: '回追·沈岚', group: 'DF', ovr: 79, valueMillionEur: 28, rarity: 'B' },
  { id: 't_df_05', name: '上抢·宋岑', group: 'DF', ovr: 76, valueMillionEur: 18, rarity: 'B' },
  { id: 't_df_06', name: '替补闸·唐粟', group: 'DF', ovr: 70, valueMillionEur: 9, rarity: 'C' },
  { id: 't_mf_01', name: '节拍·林远舟', group: 'MF', ovr: 91, valueMillionEur: 120, rarity: 'S' },
  { id: 't_mf_02', name: '推进·顾临', group: 'MF', ovr: 87, valueMillionEur: 85, rarity: 'A' },
  { id: 't_mf_03', name: '串联·苏简', group: 'MF', ovr: 84, valueMillionEur: 55, rarity: 'A' },
  { id: 't_mf_04', name: '覆盖·赵行', group: 'MF', ovr: 81, valueMillionEur: 35, rarity: 'B' },
  { id: 't_mf_05', name: '直塞·秦川', group: 'MF', ovr: 80, valueMillionEur: 32, rarity: 'B' },
  { id: 't_mf_06', name: '工兵·魏桥', group: 'MF', ovr: 74, valueMillionEur: 14, rarity: 'C' },
  { id: 't_fw_01', name: '终结·叶星', group: 'FW', ovr: 90, valueMillionEur: 110, rarity: 'S' },
  { id: 't_fw_02', name: '突击·白澈', group: 'FW', ovr: 86, valueMillionEur: 75, rarity: 'A' },
  { id: 't_fw_03', name: '支点·罗隐', group: 'FW', ovr: 83, valueMillionEur: 48, rarity: 'A' },
  { id: 't_fw_04', name: '反跑·纪岚', group: 'FW', ovr: 78, valueMillionEur: 26, rarity: 'B' },
  { id: 't_fw_05', name: '快马·方烁', group: 'FW', ovr: 77, valueMillionEur: 24, rarity: 'B' },
  { id: 't_fw_06', name: '轮换锋·余乔', group: 'FW', ovr: 71, valueMillionEur: 11, rarity: 'C' },
  { id: 't_df_07', name: '新人闸·夏木', group: 'DF', ovr: 68, valueMillionEur: 8, rarity: 'C' },
  { id: 't_mf_07', name: '组织·晏清', group: 'MF', ovr: 85, valueMillionEur: 60, rarity: 'A' },
  { id: 't_mf_08', name: '远射·穆阳', group: 'MF', ovr: 82, valueMillionEur: 40, rarity: 'B' },
  { id: 't_fw_07', name: '头球·商羽', group: 'FW', ovr: 81, valueMillionEur: 36, rarity: 'B' },
  { id: 't_gk_04', name: '反应·裴洲', group: 'GK', ovr: 81, valueMillionEur: 30, rarity: 'B' },
  { id: 't_df_08', name: '铲断·路岑', group: 'DF', ovr: 73, valueMillionEur: 12, rarity: 'C' },
  { id: 't_mf_09', name: '拖后·宁川', group: 'MF', ovr: 79, valueMillionEur: 27, rarity: 'B' },
  { id: 't_fw_08', name: '内切·谢凌', group: 'FW', ovr: 84, valueMillionEur: 52, rarity: 'A' },
];

export const PLAYER_TEMPLATES: readonly PlayerTemplate[] = RAW.map((r) => ({ ...r }));

const byId = new Map<string, PlayerTemplate>(PLAYER_TEMPLATES.map((p) => [p.id, p]));

export function getTemplate(id: string): PlayerTemplate | undefined {
  return byId.get(id);
}

export function allTemplates(): readonly PlayerTemplate[] {
  return PLAYER_TEMPLATES;
}

const RARITY_WEIGHT: Record<Rarity, number> = { S: 3, A: 12, B: 25, C: 60 };

export function rollRarity(rng: () => number): Rarity {
  const x = rng() * 100;
  let c = 0;
  const order: Rarity[] = ['S', 'A', 'B', 'C'];
  for (const r of order) {
    c += RARITY_WEIGHT[r];
    if (x < c) return r;
  }
  return 'C';
}

export function randomTemplateByRarity(rarity: Rarity, rng: () => number): PlayerTemplate {
  const pool = PLAYER_TEMPLATES.filter((p) => p.rarity === rarity);
  const pick = pool[Math.floor(rng() * pool.length)] ?? PLAYER_TEMPLATES[0];
  return pick;
}
