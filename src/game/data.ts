import type { FormationData, PlayerCardData, Position, Rarity } from './types';

export const rarityMeta: Record<Rarity, { name: string; color: number; glow: number; minRating: number }> = {
  bronze: { name: '铜卡', color: 0xa86632, glow: 0xffb071, minRating: 62 },
  silver: { name: '银卡', color: 0xb9c2cf, glow: 0xf2f7ff, minRating: 72 },
  gold: { name: '金卡', color: 0xffc43b, glow: 0xfff0a8, minRating: 82 },
  purple: { name: '紫卡', color: 0x9b45ff, glow: 0xe0b2ff, minRating: 88 },
  orange: { name: '橙卡', color: 0xff7a1a, glow: 0xffc18a, minRating: 93 },
  legend: { name: '传奇', color: 0xffe06b, glow: 0xffffff, minRating: 94 }
};

const portraits = {
  mbappe: '/assets/players/generated/mbappe.png',
  haaland: '/assets/players/generated/haaland.png',
  messi: '/assets/players/generated/messi.png',
  cr7: '/assets/players/generated/cr7.png',
  vini: '/assets/players/generated/vini.png',
  dembele: '/assets/players/generated/dembele.png',
  salah: '/assets/players/generated/salah.png',
  kane: '/assets/players/generated/kane.png',
  yamal: '/assets/players/generated/yamal.png',
  pele: '/assets/players/generated/pele.png',
  maradona: '/assets/players/generated/maradona.png',
  ronaldo: '/assets/players/generated/ronaldo.png',
  cruyff: '/assets/players/generated/cruyff.png',
  neymar: '/assets/players/generated/neymar.png',
  son: '/assets/players/generated/son.png',
  griezmann: '/assets/players/generated/griezmann.png',
  bellingham: '/assets/players/generated/bellingham.png',
  rodri: '/assets/players/generated/rodri.png',
  debruyne: '/assets/players/generated/debruyne.png',
  pedri: '/assets/players/generated/pedri.png',
  wirtz: '/assets/players/generated/wirtz.png',
  modric: '/assets/players/generated/modric.png',
  zidane: '/assets/players/generated/zidane.png',
  xavi: '/assets/players/generated/xavi.png',
  iniesta: '/assets/players/generated/iniesta.png',
  ronaldinho: '/assets/players/generated/ronaldinho.png',
  vandijk: '/assets/players/generated/vandijk.png',
  saliba: '/assets/players/generated/saliba.png',
  hakimi: '/assets/players/generated/hakimi.png',
  dias: '/assets/players/generated/dias.png',
  maldini: '/assets/players/generated/maldini.png',
  carlos: '/assets/players/generated/carlos.png',
  courtois: '/assets/players/generated/courtois.png',
  donnarumma: '/assets/players/generated/donnarumma.png',
  neuer: '/assets/players/generated/neuer.png',
  buffon: '/assets/players/generated/buffon.png',
  alisson: '/assets/players/generated/alisson.png',
  ederson: '/assets/players/generated/ederson.png',
  casillas: '/assets/players/generated/casillas.png',
  yashin: '/assets/players/generated/yashin.png',
  ramos: '/assets/players/generated/ramos.png',
  trent: '/assets/players/generated/trent.png',
  davies: '/assets/players/generated/davies.png',
  kimmich: '/assets/players/generated/kimmich.png',
  suarez: '/assets/players/generated/suarez.png',
  lewandowski: '/assets/players/generated/lewandowski.png',
  benzema: '/assets/players/generated/benzema.png',
  zlatan: '/assets/players/generated/zlatan.png',
  saka: '/assets/players/generated/saka.png',
  foden: '/assets/players/generated/foden.png',
  lautaro: '/assets/players/generated/lautaro.png',
  osimhen: '/assets/players/generated/osimhen.png',
  kvaratskhelia: '/assets/players/generated/kvaratskhelia.png',
  nunez: '/assets/players/generated/nunez.png',
  leao: '/assets/players/generated/leao.png',
  pulisic: '/assets/players/generated/pulisic.png',
  raphinha: '/assets/players/generated/raphinha.png',
  luisDiaz: '/assets/players/generated/luis-diaz.png',
  isak: '/assets/players/generated/isak.png',
  vlahovic: '/assets/players/generated/vlahovic.png',
  gakpo: '/assets/players/generated/gakpo.png',
  olise: '/assets/players/generated/olise.png',
  nicoWilliams: '/assets/players/generated/nico-williams.png',
  kubo: '/assets/players/generated/kubo.png',
  mitoma: '/assets/players/generated/mitoma.png',
  musiala: '/assets/players/generated/musiala.png',
  odegaard: '/assets/players/generated/odegaard.png',
  valverde: '/assets/players/generated/valverde.png',
  rice: '/assets/players/generated/rice.png',
  gavi: '/assets/players/generated/gavi.png',
  enzo: '/assets/players/generated/enzo.png',
  macAllister: '/assets/players/generated/mac-allister.png',
  brunoFernandes: '/assets/players/generated/bruno-fernandes.png',
  bernardoSilva: '/assets/players/generated/bernardo-silva.png',
  chiesa: '/assets/players/generated/chiesa.png',
  barella: '/assets/players/generated/barella.png',
  camavinga: '/assets/players/generated/camavinga.png',
  tchouameni: '/assets/players/generated/tchouameni.png',
  rudiger: '/assets/players/generated/rudiger.png',
  militao: '/assets/players/generated/militao.png',
  theo: '/assets/players/generated/theo.png',
  cancelo: '/assets/players/generated/cancelo.png',
  kounde: '/assets/players/generated/kounde.png',
  upamecano: '/assets/players/generated/upamecano.png',
  gvardiol: '/assets/players/generated/gvardiol.png',
  kimMinjae: '/assets/players/generated/kim-minjae.png',
  maignan: '/assets/players/generated/maignan.png',
  emiliano: '/assets/players/generated/emiliano.png'
};

export const formations: FormationData[] = [
  {
    id: '4231',
    name: '4-2-3-1',
    style: '平衡',
    slots: [
      { id: 'gk', position: 'GK', x: 0.5, y: 0.9 },
      { id: 'df1', position: 'DF', x: 0.18, y: 0.72 },
      { id: 'df2', position: 'DF', x: 0.38, y: 0.7 },
      { id: 'df3', position: 'DF', x: 0.62, y: 0.7 },
      { id: 'df4', position: 'DF', x: 0.82, y: 0.72 },
      { id: 'mf1', position: 'MF', x: 0.36, y: 0.54 },
      { id: 'mf2', position: 'MF', x: 0.64, y: 0.54 },
      { id: 'mf3', position: 'MF', x: 0.2, y: 0.36 },
      { id: 'mf4', position: 'MF', x: 0.5, y: 0.32 },
      { id: 'mf5', position: 'MF', x: 0.8, y: 0.36 },
      { id: 'fw', position: 'FW', x: 0.5, y: 0.16 }
    ]
  },
  {
    id: '433',
    name: '4-3-3',
    style: '进攻',
    slots: [
      { id: 'gk', position: 'GK', x: 0.5, y: 0.9 },
      { id: 'df1', position: 'DF', x: 0.18, y: 0.72 },
      { id: 'df2', position: 'DF', x: 0.38, y: 0.7 },
      { id: 'df3', position: 'DF', x: 0.62, y: 0.7 },
      { id: 'df4', position: 'DF', x: 0.82, y: 0.72 },
      { id: 'mf1', position: 'MF', x: 0.28, y: 0.48 },
      { id: 'mf2', position: 'MF', x: 0.5, y: 0.45 },
      { id: 'mf3', position: 'MF', x: 0.72, y: 0.48 },
      { id: 'fw1', position: 'FW', x: 0.22, y: 0.18 },
      { id: 'fw2', position: 'FW', x: 0.5, y: 0.13 },
      { id: 'fw3', position: 'FW', x: 0.78, y: 0.18 }
    ]
  },
  {
    id: '532',
    name: '5-3-2',
    style: '防守',
    slots: [
      { id: 'gk', position: 'GK', x: 0.5, y: 0.9 },
      { id: 'df1', position: 'DF', x: 0.12, y: 0.72 },
      { id: 'df2', position: 'DF', x: 0.3, y: 0.68 },
      { id: 'df3', position: 'DF', x: 0.5, y: 0.66 },
      { id: 'df4', position: 'DF', x: 0.7, y: 0.68 },
      { id: 'df5', position: 'DF', x: 0.88, y: 0.72 },
      { id: 'mf1', position: 'MF', x: 0.28, y: 0.45 },
      { id: 'mf2', position: 'MF', x: 0.5, y: 0.42 },
      { id: 'mf3', position: 'MF', x: 0.72, y: 0.45 },
      { id: 'fw1', position: 'FW', x: 0.38, y: 0.17 },
      { id: 'fw2', position: 'FW', x: 0.62, y: 0.17 }
    ]
  },
  {
    id: '442',
    name: '4-4-2',
    style: '经典',
    slots: [
      { id: 'gk', position: 'GK', x: 0.5, y: 0.9 },
      { id: 'df1', position: 'DF', x: 0.18, y: 0.72 },
      { id: 'df2', position: 'DF', x: 0.38, y: 0.7 },
      { id: 'df3', position: 'DF', x: 0.62, y: 0.7 },
      { id: 'df4', position: 'DF', x: 0.82, y: 0.72 },
      { id: 'mf1', position: 'MF', x: 0.18, y: 0.46 },
      { id: 'mf2', position: 'MF', x: 0.38, y: 0.5 },
      { id: 'mf3', position: 'MF', x: 0.62, y: 0.5 },
      { id: 'mf4', position: 'MF', x: 0.82, y: 0.46 },
      { id: 'fw1', position: 'FW', x: 0.38, y: 0.18 },
      { id: 'fw2', position: 'FW', x: 0.62, y: 0.18 }
    ]
  },
  {
    id: '352',
    name: '3-5-2',
    style: '控场',
    slots: [
      { id: 'gk', position: 'GK', x: 0.5, y: 0.9 },
      { id: 'df1', position: 'DF', x: 0.28, y: 0.7 },
      { id: 'df2', position: 'DF', x: 0.5, y: 0.68 },
      { id: 'df3', position: 'DF', x: 0.72, y: 0.7 },
      { id: 'mf1', position: 'MF', x: 0.14, y: 0.5 },
      { id: 'mf2', position: 'MF', x: 0.34, y: 0.48 },
      { id: 'mf3', position: 'MF', x: 0.5, y: 0.42 },
      { id: 'mf4', position: 'MF', x: 0.66, y: 0.48 },
      { id: 'mf5', position: 'MF', x: 0.86, y: 0.5 },
      { id: 'fw1', position: 'FW', x: 0.38, y: 0.18 },
      { id: 'fw2', position: 'FW', x: 0.62, y: 0.18 }
    ]
  },
  {
    id: '343',
    name: '3-4-3',
    style: '压迫',
    slots: [
      { id: 'gk', position: 'GK', x: 0.5, y: 0.9 },
      { id: 'df1', position: 'DF', x: 0.28, y: 0.7 },
      { id: 'df2', position: 'DF', x: 0.5, y: 0.68 },
      { id: 'df3', position: 'DF', x: 0.72, y: 0.7 },
      { id: 'mf1', position: 'MF', x: 0.2, y: 0.48 },
      { id: 'mf2', position: 'MF', x: 0.4, y: 0.5 },
      { id: 'mf3', position: 'MF', x: 0.6, y: 0.5 },
      { id: 'mf4', position: 'MF', x: 0.8, y: 0.48 },
      { id: 'fw1', position: 'FW', x: 0.22, y: 0.18 },
      { id: 'fw2', position: 'FW', x: 0.5, y: 0.13 },
      { id: 'fw3', position: 'FW', x: 0.78, y: 0.18 }
    ]
  }
];

const player = (
  id: string,
  name: string,
  position: Position,
  role: string,
  rating: number,
  rarity: PlayerCardData['rarity'],
  skill: string,
  portrait: string,
  era: PlayerCardData['era'],
  stats: [number, number, number, number],
  color?: number
): PlayerCardData => ({
  id,
  name,
  position,
  role,
  rarity,
  rating,
  attack: stats[0],
  defense: stats[1],
  speed: stats[2],
  stamina: stats[3],
  skill,
  portrait,
  era,
  color: color && rarity === 'legend' ? color : rarityMeta[rarity].color
});

const starterPortraits = [
  portraits.saka,
  portraits.foden,
  portraits.gavi,
  portraits.rice,
  portraits.trent,
  portraits.militao,
  portraits.maignan,
  portraits.son,
  portraits.pedri,
  portraits.davies,
  portraits.osimhen
];

const starterPlayers: PlayerCardData[] = [
  player('st_fw_lin', '林浩', 'FW', '青训前锋', 72, 'silver', '抢点射门', starterPortraits[0], 'current', [75, 38, 76, 72]),
  player('st_fw_chen', '陈锐', 'FW', '速度边锋', 69, 'bronze', '快速前插', starterPortraits[7], 'current', [70, 34, 78, 68]),
  player('st_fw_wu', '吴峻', 'FW', '支点中锋', 74, 'silver', '背身做球', starterPortraits[10], 'current', [76, 46, 66, 76]),
  player('st_mf_luo', '罗一鸣', 'MF', '组织中场', 73, 'silver', '短传节奏', starterPortraits[1], 'current', [70, 64, 70, 76]),
  player('st_mf_zhao', '赵启航', 'MF', '覆盖中场', 70, 'bronze', '积极跑动', starterPortraits[2], 'current', [66, 68, 72, 78]),
  player('st_mf_qin', '秦川', 'MF', '防守后腰', 75, 'silver', '中路拦截', starterPortraits[3], 'current', [62, 76, 66, 80]),
  player('st_df_han', '韩越', 'DF', '边路后卫', 71, 'bronze', '边路回追', starterPortraits[4], 'current', [58, 72, 76, 74]),
  player('st_df_gao', '高远', 'DF', '中卫', 74, 'silver', '头球解围', starterPortraits[5], 'current', [50, 78, 66, 76]),
  player('st_df_xu', '徐磊', 'DF', '盯人中卫', 72, 'silver', '贴身盯防', starterPortraits[9], 'current', [52, 76, 72, 74]),
  player('st_df_shen', '沈杰', 'DF', '防守边卫', 69, 'bronze', '稳健卡位', starterPortraits[4], 'current', [54, 72, 70, 74]),
  player('st_gk_tang', '唐森', 'GK', '年轻门将', 73, 'silver', '反应扑救', starterPortraits[6], 'current', [16, 76, 62, 74]),
  player('st_gk_yu', '余航', 'GK', '替补门将', 67, 'bronze', '单拳击球', starterPortraits[6], 'current', [14, 70, 58, 70]),
  player('st_df_fang', '方奕', 'DF', '中卫', 68, 'bronze', '正面封堵', starterPortraits[5], 'current', [48, 72, 64, 72]),
  player('st_mf_ma', '马骁', 'MF', '前插中场', 68, 'bronze', '后插上', starterPortraits[8], 'current', [68, 60, 70, 70]),
  player('st_fw_jiang', '蒋翼', 'FW', '替补射手', 66, 'bronze', '禁区嗅觉', starterPortraits[0], 'current', [70, 32, 68, 68])
];

export const players: PlayerCardData[] = [
  ...starterPlayers,
  player('fw_mbappe', '姆巴佩', 'FW', '前锋', 96, 'legend', '极速冲刺', portraits.mbappe, 'current', [96, 42, 98, 86], 0xffc43b),
  player('fw_haaland', '哈兰德', 'FW', '中锋', 95, 'legend', '禁区终结', portraits.haaland, 'current', [98, 48, 88, 90], 0xffc43b),
  player('fw_messi', '梅西', 'FW', '右锋', 95, 'legend', '灵感盘带', portraits.messi, 'current', [97, 44, 86, 78], 0xffc43b),
  player('fw_cr7', 'C罗', 'FW', '前锋', 94, 'legend', '空中霸主', portraits.cr7, 'current', [96, 50, 88, 88], 0xffc43b),
  player('fw_vini', '维尼修斯', 'FW', '左锋', 93, 'purple', '边路爆破', portraits.vini, 'current', [91, 42, 97, 84], 0x9b45ff),
  player('fw_dembele', '登贝莱', 'FW', '边锋', 94, 'legend', '双足爆点', portraits.dembele, 'current', [94, 42, 96, 82], 0xffc43b),
  player('fw_salah', '萨拉赫', 'FW', '右锋', 92, 'purple', '内切射门', portraits.salah, 'current', [92, 45, 90, 86], 0x9b45ff),
  player('fw_kane', '凯恩', 'FW', '中锋', 91, 'purple', '支点射手', portraits.kane, 'current', [93, 52, 76, 88], 0x9b45ff),
  player('fw_yamal', '亚马尔', 'FW', '右锋', 90, 'purple', '灵巧突破', portraits.yamal, 'current', [88, 40, 92, 76], 0x9b45ff),
  player('fw_pele', '贝利', 'FW', '传奇前锋', 97, 'legend', '球王降临', portraits.pele, 'legend', [99, 48, 94, 88], 0xffc43b),
  player('fw_maradona', '马拉多纳', 'FW', '传奇前腰', 97, 'legend', '世纪盘带', portraits.maradona, 'legend', [98, 44, 91, 84], 0xffc43b),
  player('fw_ronaldo', '罗纳尔多', 'FW', '传奇中锋', 96, 'legend', '外星爆发', portraits.ronaldo, 'legend', [98, 46, 95, 82], 0xffc43b),
  player('fw_cruyff', '克鲁伊夫', 'FW', '传奇前锋', 94, 'legend', '全能指挥', portraits.cruyff, 'legend', [94, 58, 88, 86], 0xffc43b),
  player('fw_neymar', '内马尔', 'FW', '左锋', 92, 'purple', '桑巴魔术', portraits.neymar, 'current', [92, 44, 90, 76], 0x9b45ff),
  player('fw_son', '孙兴慜', 'FW', '边锋', 91, 'purple', '弧线爆射', portraits.son, 'current', [91, 50, 89, 86], 0x9b45ff),
  player('fw_griezmann', '格列兹曼', 'FW', '影锋', 90, 'purple', '灵动跑位', portraits.griezmann, 'current', [89, 58, 82, 86], 0x9b45ff),
  player('fw_suarez', '苏亚雷斯', 'FW', '中锋', 91, 'purple', '禁区嗅觉', portraits.suarez, 'current', [93, 56, 75, 82], 0x9b45ff),
  player('fw_lewandowski', '莱万多夫斯基', 'FW', '中锋', 92, 'purple', '冷静终结', portraits.lewandowski, 'current', [94, 54, 76, 84], 0x9b45ff),
  player('fw_benzema', '本泽马', 'FW', '中锋', 92, 'purple', '回撤串联', portraits.benzema, 'current', [92, 58, 78, 82], 0x9b45ff),
  player('fw_zlatan', '伊布', 'FW', '中锋', 91, 'purple', '霸王凌空', portraits.zlatan, 'legend', [93, 54, 72, 82], 0x9b45ff),
  player('fw_saka', '萨卡', 'FW', '右锋', 90, 'purple', '逆足内切', portraits.saka, 'current', [88, 54, 86, 88], 0x9b45ff),
  player('fw_lautaro', '劳塔罗', 'FW', '中锋', 91, 'purple', '禁区抢点', portraits.lautaro, 'current', [92, 58, 80, 88], 0x9b45ff),
  player('fw_osimhen', '奥斯梅恩', 'FW', '中锋', 91, 'purple', '冲刺头槌', portraits.osimhen, 'current', [92, 50, 92, 86], 0x9b45ff),
  player('fw_kvaratskhelia', '克瓦拉茨赫利亚', 'FW', '左锋', 90, 'purple', '变向突破', portraits.kvaratskhelia, 'current', [89, 42, 88, 82], 0x9b45ff),
  player('fw_nunez', '努涅斯', 'FW', '中锋', 88, 'gold', '冲刺压迫', portraits.nunez, 'current', [89, 48, 90, 86], 0x2f8cff),
  player('fw_leao', '莱奥', 'FW', '左锋', 90, 'purple', '大步突破', portraits.leao, 'current', [89, 40, 94, 82], 0x9b45ff),
  player('fw_pulisic', '普利西奇', 'FW', '边锋', 87, 'gold', '灵巧内切', portraits.pulisic, 'current', [86, 46, 88, 80], 0x2f8cff),
  player('fw_raphinha', '拉菲尼亚', 'FW', '右锋', 89, 'gold', '逆足兜射', portraits.raphinha, 'current', [88, 52, 87, 86], 0x2f8cff),
  player('fw_luis_diaz', '路易斯·迪亚斯', 'FW', '左锋', 89, 'gold', '边路撕扯', portraits.luisDiaz, 'current', [88, 54, 91, 88], 0x2f8cff),
  player('fw_isak', '伊萨克', 'FW', '中锋', 90, 'purple', '冷静推射', portraits.isak, 'current', [91, 44, 86, 82], 0x9b45ff),
  player('fw_vlahovic', '弗拉霍维奇', 'FW', '中锋', 88, 'gold', '强力终结', portraits.vlahovic, 'current', [90, 50, 78, 84], 0x2f8cff),
  player('fw_gakpo', '加克波', 'FW', '前锋', 88, 'gold', '斜插射门', portraits.gakpo, 'current', [87, 56, 84, 86], 0x2f8cff),
  player('fw_olise', '奥利塞', 'FW', '右锋', 88, 'gold', '左脚弧线', portraits.olise, 'current', [87, 42, 86, 80], 0x2f8cff),
  player('fw_nico_williams', '尼科·威廉姆斯', 'FW', '边锋', 88, 'gold', '高速变向', portraits.nicoWilliams, 'current', [86, 44, 94, 82], 0x2f8cff),
  player('fw_kubo', '久保建英', 'FW', '右锋', 87, 'gold', '小步盘带', portraits.kubo, 'current', [85, 46, 86, 82], 0x2f8cff),
  player('fw_mitoma', '三笘薫', 'FW', '左锋', 87, 'gold', '边线突破', portraits.mitoma, 'current', [86, 48, 88, 84], 0x2f8cff),

  player('mf_bellingham', '贝林厄姆', 'MF', '中场', 94, 'legend', '攻防全能', portraits.bellingham, 'current', [90, 84, 86, 92], 0xffc43b),
  player('mf_rodri', '罗德里', 'MF', '后腰', 93, 'purple', '中场屏障', portraits.rodri, 'current', [82, 94, 72, 90], 0x9b45ff),
  player('mf_debruyne', '德布劳内', 'MF', '中场', 92, 'purple', '精准直塞', portraits.debruyne, 'current', [90, 70, 76, 82], 0x9b45ff),
  player('mf_pedri', '佩德里', 'MF', '中场', 90, 'purple', '节奏大师', portraits.pedri, 'current', [84, 72, 82, 84], 0x9b45ff),
  player('mf_wirtz', '维尔茨', 'MF', '前腰', 91, 'purple', '灵动组织', portraits.wirtz, 'current', [88, 64, 84, 82], 0x9b45ff),
  player('mf_modric', '莫德里奇', 'MF', '中场', 90, 'purple', '外脚背传球', portraits.modric, 'current', [86, 72, 78, 78], 0x9b45ff),
  player('mf_zidane', '齐达内', 'MF', '传奇中场', 96, 'legend', '优雅掌控', portraits.zidane, 'legend', [94, 76, 80, 86], 0xffc43b),
  player('mf_xavi', '哈维', 'MF', '传奇中场', 94, 'legend', '控球核心', portraits.xavi, 'legend', [88, 78, 76, 88], 0xffc43b),
  player('mf_iniesta', '伊涅斯塔', 'MF', '传奇中场', 94, 'legend', '穿针引线', portraits.iniesta, 'legend', [90, 70, 82, 82], 0xffc43b),
  player('mf_ronaldinho', '小罗', 'MF', '传奇前腰', 95, 'legend', '魔幻盘带', portraits.ronaldinho, 'legend', [96, 50, 88, 80], 0xffc43b),
  player('mf_kimmich', '基米希', 'MF', '后腰', 90, 'purple', '精准调度', portraits.kimmich, 'current', [80, 86, 76, 92], 0x9b45ff),
  player('mf_foden', '福登', 'MF', '前腰', 90, 'purple', '小步摆脱', portraits.foden, 'current', [88, 62, 84, 84], 0x9b45ff),
  player('mf_musiala', '穆西亚拉', 'MF', '前腰', 91, 'purple', '灵蛇盘带', portraits.musiala, 'current', [90, 58, 87, 82], 0x9b45ff),
  player('mf_odegaard', '厄德高', 'MF', '前腰', 90, 'purple', '左脚指挥', portraits.odegaard, 'current', [87, 66, 78, 86], 0x9b45ff),
  player('mf_valverde', '巴尔韦德', 'MF', '中场', 90, 'purple', '高速推进', portraits.valverde, 'current', [84, 82, 88, 92], 0x9b45ff),
  player('mf_rice', '赖斯', 'MF', '后腰', 90, 'purple', '覆盖拦截', portraits.rice, 'current', [76, 88, 78, 92], 0x9b45ff),
  player('mf_gavi', '加维', 'MF', '中场', 88, 'gold', '贴身逼抢', portraits.gavi, 'current', [80, 78, 82, 90], 0x2f8cff),
  player('mf_enzo', '恩佐·费尔南德斯', 'MF', '中场', 88, 'gold', '长传调度', portraits.enzo, 'current', [82, 78, 76, 86], 0x2f8cff),
  player('mf_mac_allister', '麦卡利斯特', 'MF', '中场', 88, 'gold', '节奏串联', portraits.macAllister, 'current', [84, 76, 76, 88], 0x2f8cff),
  player('mf_bruno_fernandes', '布鲁诺·费尔南德斯', 'MF', '前腰', 90, 'purple', '冒险直塞', portraits.brunoFernandes, 'current', [89, 70, 76, 90], 0x9b45ff),
  player('mf_bernardo_silva', '贝尔纳多·席尔瓦', 'MF', '中场', 90, 'purple', '贴身控球', portraits.bernardoSilva, 'current', [86, 72, 82, 90], 0x9b45ff),
  player('mf_chiesa', '基耶萨', 'MF', '边前卫', 88, 'gold', '爆发前插', portraits.chiesa, 'current', [87, 56, 88, 82], 0x2f8cff),
  player('mf_barella', '巴雷拉', 'MF', '中场', 89, 'gold', '全场覆盖', portraits.barella, 'current', [82, 82, 80, 92], 0x2f8cff),
  player('mf_camavinga', '卡马文加', 'MF', '中场', 88, 'gold', '灵活扫荡', portraits.camavinga, 'current', [78, 84, 82, 88], 0x2f8cff),
  player('mf_tchouameni', '楚阿梅尼', 'MF', '后腰', 89, 'gold', '中路拦截', portraits.tchouameni, 'current', [76, 88, 76, 88], 0x2f8cff),

  player('df_vandijk', '范戴克', 'DF', '中卫', 92, 'purple', '防线统帅', portraits.vandijk, 'current', [58, 95, 78, 88], 0x9b45ff),
  player('df_saliba', '萨利巴', 'DF', '中卫', 90, 'purple', '冷静拦截', portraits.saliba, 'current', [52, 91, 82, 86], 0x9b45ff),
  player('df_hakimi', '阿什拉夫', 'DF', '边卫', 89, 'gold', '高速套边', portraits.hakimi, 'current', [72, 84, 94, 86], 0x2f8cff),
  player('df_dias', '鲁本·迪亚斯', 'DF', '中卫', 90, 'purple', '强硬对抗', portraits.dias, 'current', [50, 93, 70, 88], 0x9b45ff),
  player('df_maldini', '马尔蒂尼', 'DF', '传奇后卫', 96, 'legend', '完美站位', portraits.maldini, 'legend', [62, 98, 84, 90], 0xffc43b),
  player('df_carlos', '卡洛斯', 'DF', '传奇边卫', 93, 'legend', '重炮远射', portraits.carlos, 'legend', [84, 88, 94, 90], 0xffc43b),
  player('df_ramos', '拉莫斯', 'DF', '中卫', 91, 'purple', '铁血领袖', portraits.ramos, 'current', [66, 92, 76, 86], 0x9b45ff),
  player('df_trent', '阿诺德', 'DF', '右卫', 88, 'gold', '长传制导', portraits.trent, 'current', [78, 80, 82, 86], 0x2f8cff),
  player('df_davies', '阿方索·戴维斯', 'DF', '左卫', 88, 'gold', '极速回追', portraits.davies, 'current', [76, 80, 96, 84], 0x2f8cff),
  player('df_rudiger', '吕迪格', 'DF', '中卫', 90, 'purple', '强硬贴防', portraits.rudiger, 'current', [54, 92, 82, 88], 0x9b45ff),
  player('df_militao', '米利唐', 'DF', '中卫', 89, 'gold', '弹跳封堵', portraits.militao, 'current', [56, 90, 84, 86], 0x2f8cff),
  player('df_theo', '特奥', 'DF', '左卫', 90, 'purple', '边路冲刺', portraits.theo, 'current', [80, 82, 94, 88], 0x9b45ff),
  player('df_cancelo', '坎塞洛', 'DF', '边卫', 89, 'gold', '内收组织', portraits.cancelo, 'current', [82, 78, 84, 84], 0x2f8cff),
  player('df_kounde', '孔德', 'DF', '后卫', 89, 'gold', '边中皆宜', portraits.kounde, 'current', [58, 88, 84, 86], 0x2f8cff),
  player('df_upamecano', '于帕梅卡诺', 'DF', '中卫', 88, 'gold', '正面压迫', portraits.upamecano, 'current', [52, 89, 82, 86], 0x2f8cff),
  player('df_gvardiol', '格瓦迪奥尔', 'DF', '后卫', 89, 'gold', '左路推进', portraits.gvardiol, 'current', [70, 88, 84, 88], 0x2f8cff),
  player('df_kim_minjae', '金玟哉', 'DF', '中卫', 89, 'gold', '强力上抢', portraits.kimMinjae, 'current', [50, 90, 80, 88], 0x2f8cff),

  player('gk_courtois', '库尔图瓦', 'GK', '门将', 91, 'purple', '长臂神扑', portraits.courtois, 'current', [20, 94, 62, 82], 0x9b45ff),
  player('gk_donnarumma', '多纳鲁马', 'GK', '门将', 90, 'purple', '反应封堵', portraits.donnarumma, 'current', [18, 92, 66, 82], 0x9b45ff),
  player('gk_neuer', '诺伊尔', 'GK', '门将', 90, 'purple', '清道夫门将', portraits.neuer, 'current', [24, 91, 70, 78], 0x9b45ff),
  player('gk_buffon', '布冯', 'GK', '传奇门将', 95, 'legend', '传奇扑救', portraits.buffon, 'legend', [20, 97, 64, 86], 0xffc43b),
  player('gk_alisson', '阿利松', 'GK', '门将', 91, 'purple', '稳健出击', portraits.alisson, 'current', [22, 93, 68, 84], 0x9b45ff),
  player('gk_ederson', '埃德森', 'GK', '门将', 90, 'purple', '长传发动', portraits.ederson, 'current', [28, 90, 72, 84], 0x9b45ff),
  player('gk_casillas', '卡西利亚斯', 'GK', '传奇门将', 94, 'legend', '圣手反应', portraits.casillas, 'legend', [18, 96, 70, 84], 0xffc43b),
  player('gk_yashin', '雅辛', 'GK', '传奇门将', 96, 'legend', '黑衣传奇', portraits.yashin, 'legend', [18, 98, 68, 88], 0xffc43b),
  player('gk_maignan', '迈尼昂', 'GK', '门将', 89, 'gold', '快速下地', portraits.maignan, 'current', [20, 90, 70, 84], 0x2f8cff),
  player('gk_emiliano', '马丁内斯', 'GK', '门将', 89, 'gold', '点球心理', portraits.emiliano, 'current', [18, 91, 66, 84], 0x2f8cff)
];

export function drawCandidates(position: Position, excludeIds: string[] = []): PlayerCardData[] {
  const excluded = new Set(excludeIds);
  const pool = players.filter((player) => player.position === position && !excluded.has(player.id));
  return [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
}

export const starterCollectionIds = starterPlayers.slice(0, 11).map((player) => player.id);

export const defaultCollectionIds = [
  ...starterCollectionIds,
  'st_gk_yu',
  'st_df_fang',
  'st_mf_ma',
  'st_fw_jiang',
  'fw_vini',
  'fw_salah',
  'fw_kane',
  'fw_yamal',
  'fw_son',
  'fw_griezmann',
  'fw_saka',
  'fw_lautaro',
  'fw_osimhen',
  'fw_nunez',
  'fw_leao',
  'fw_pulisic',
  'fw_raphinha',
  'fw_luis_diaz',
  'fw_isak',
  'fw_vlahovic',
  'fw_gakpo',
  'fw_olise',
  'fw_nico_williams',
  'fw_kubo',
  'fw_mitoma',
  'mf_rodri',
  'mf_pedri',
  'mf_wirtz',
  'mf_modric',
  'mf_kimmich',
  'mf_foden',
  'mf_musiala',
  'mf_odegaard',
  'mf_valverde',
  'mf_rice',
  'mf_gavi',
  'mf_enzo',
  'mf_mac_allister',
  'mf_bruno_fernandes',
  'mf_bernardo_silva',
  'mf_chiesa',
  'mf_barella',
  'mf_camavinga',
  'mf_tchouameni',
  'df_vandijk',
  'df_saliba',
  'df_hakimi',
  'df_dias',
  'df_ramos',
  'df_trent',
  'df_davies',
  'df_rudiger',
  'df_militao',
  'df_theo',
  'df_cancelo',
  'df_kounde',
  'df_upamecano',
  'df_gvardiol',
  'df_kim_minjae',
  'gk_courtois',
  'gk_donnarumma',
  'gk_neuer',
  'gk_alisson',
  'gk_ederson',
  'gk_maignan',
  'gk_emiliano'
];

export function rarityName(rarity: Rarity) {
  return rarityMeta[rarity].name;
}

export function playerPower(player?: PlayerCardData) {
  if (!player) return 0;
  return Math.round(player.rating * 0.72 + player.attack * 0.12 + player.defense * 0.1 + player.speed * 0.04 + player.stamina * 0.02);
}

export function drawScoutCandidates(collectionIds: string[], count = 3) {
  const owned = new Set(collectionIds);
  const pool = players.filter((player) => !owned.has(player.id) && !player.id.startsWith('st_'));
  const weights: Record<Rarity, number> = {
    bronze: 0,
    silver: 10,
    gold: 34,
    purple: 38,
    orange: 12,
    legend: 6
  };
  const result: PlayerCardData[] = [];

  while (result.length < count && result.length < pool.length) {
    const totalWeight = pool.reduce((sum, player) => {
      if (result.some((item) => item.id === player.id)) return sum;
      return sum + weights[player.rarity];
    }, 0);
    let roll = Math.random() * totalWeight;
    const picked = pool.find((player) => {
      if (result.some((item) => item.id === player.id)) return false;
      roll -= weights[player.rarity];
      return roll <= 0;
    });
    if (picked) result.push(picked);
  }

  if (result.length < count) {
    result.push(
      ...players
        .filter((player) => !result.some((item) => item.id === player.id))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, count - result.length)
    );
  }

  return result;
}
