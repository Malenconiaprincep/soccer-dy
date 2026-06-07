import type { PlayerCardData } from './types';

const playerAliasesById: Record<string, string> = {
  fw_mbappe: '姆总',
  fw_haaland: '魔人',
  fw_messi: '老板',
  fw_cr7: '7号',
  fw_vini: '小熊',
  fw_dembele: '登子',
  fw_salah: '法老',
  fw_kane: 'K队',
  fw_yamal: '小亚',
  fw_pele: '球王',
  fw_maradona: '老马',
  fw_ronaldo: '大罗',
  fw_cruyff: '飞圣',
  fw_neymar: '内少',
  fw_son: '孙队',
  fw_griezmann: '格子',
  fw_suarez: '苏牙',
  fw_lewandowski: '莱万',
  fw_benzema: '本泽',
  fw_zlatan: '伊布',
  fw_saka: '小萨',
  fw_lautaro: '劳队',
  fw_osimhen: '奥锋',
  fw_kvaratskhelia: 'K77',
  mf_bellingham: '贝皇',
  mf_rodri: '罗将',
  mf_debruyne: '丁丁',
  mf_pedri: '佩宝',
  mf_wirtz: '小维',
  mf_modric: '魔笛',
  mf_zidane: '齐祖',
  mf_xavi: '哈维',
  mf_iniesta: '小白',
  mf_ronaldinho: '小罗',
  df_vandijk: '范队',
  df_hakimi: '飞翼',
  df_maldini: '马队',
  df_carlos: '卡洛',
  gk_courtois: '裤袜',
  gk_donnarumma: '多纳',
  gk_neuer: '诺伊',
  gk_buffon: '布冯',
  gk_alisson: '阿利',
  gk_yashin: '黑蛛'
};

const playerAliasesByName: Record<string, string> = {
  姆巴佩: '姆总',
  哈兰德: '魔人',
  梅西: '老板',
  C罗: '7号',
  维尼修斯: '小熊',
  登贝莱: '登子',
  萨拉赫: '法老',
  凯恩: 'K队',
  孙兴慜: '孙队',
  德布劳内: '丁丁',
  贝林厄姆: '贝皇',
  罗德里: '罗将',
  维尔茨: '小维',
  奥斯梅恩: '奥锋',
  劳塔罗: '劳队',
  库尔图瓦: '裤袜',
  罗纳尔多: '大罗',
  马拉多纳: '老马',
  罗纳尔迪尼奥: '小罗'
};

export function playerDisplayName(player?: PlayerCardData | string) {
  if (!player) return '球员';
  if (typeof player === 'string') return playerAliasesByName[player] ?? shortenPlayerName(player);
  return playerAliasesById[player.id] ?? playerAliasesByName[player.name] ?? shortenPlayerName(player.name);
}

export function shortenPlayerName(name: string) {
  const compact = name.replace(/\s/g, '');
  const parts = compact.split('·').filter(Boolean);
  if (parts.length > 1) {
    const initials = parts.map((part) => part[0]).join('');
    return initials.length > 3 ? initials.slice(0, 3) : initials;
  }
  if (/^[A-Z0-9]+$/i.test(compact)) return compact;
  return compact.length > 3 ? compact.slice(0, 2) : compact;
}
