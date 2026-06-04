export type ShopIconType = 'energy' | 'ticket' | 'gems';

export interface ShopReward {
  coins?: number;
  scoutTickets?: number;
  gems?: number;
  energy?: number;
}

export interface ShopDailyOfferConfig {
  id: string;
  title: string;
  countText: string;
  sub: string;
  cost: number;
  oldPriceText: string;
  badgeText: string;
  countdownText: string;
  icon: Extract<ShopIconType, 'ticket'>;
  reward: ShopReward;
}

export interface ShopCommonItemConfig {
  id: string;
  title: string;
  sub: string;
  cost?: number;
  priceText?: string;
  limit: string;
  icon: ShopIconType;
  reward: ShopReward;
}

export interface ShopConfig {
  dailyOffer: ShopDailyOfferConfig;
  commonItems: ShopCommonItemConfig[];
}

export const defaultShopConfig: ShopConfig = {
  dailyOffer: {
    id: 'ticket5',
    title: '球探券',
    countText: '×5',
    sub: '用于招募随机球员',
    cost: 120,
    oldPriceText: '原价 150',
    badgeText: '8',
    countdownText: '23:59:59',
    icon: 'ticket',
    reward: { scoutTickets: 5 }
  },
  commonItems: [
    {
      id: 'energy',
      title: '体力补给',
      sub: '恢复 30 点体力',
      cost: 20,
      limit: '今日限购 5/5',
      icon: 'energy',
      reward: { energy: 30 }
    },
    {
      id: 'ticket1',
      title: '球探券 ×1',
      sub: '用于招募随机球员',
      cost: 30,
      limit: '今日限购 10/10',
      icon: 'ticket',
      reward: { scoutTickets: 1 }
    },
    {
      id: 'gems100',
      title: '钻石 ×100',
      sub: '游戏通用货币',
      priceText: '¥6',
      limit: '今日限购 1/1',
      icon: 'gems',
      reward: { gems: 100 }
    }
  ]
};

export function normalizeShopConfig(value: unknown): ShopConfig {
  const input = isRecord(value) ? value : {};
  const daily = isRecord(input.dailyOffer) ? input.dailyOffer : {};
  const items = Array.isArray(input.commonItems) ? input.commonItems : [];

  return {
    dailyOffer: {
      ...defaultShopConfig.dailyOffer,
      id: stringValue(daily.id, defaultShopConfig.dailyOffer.id),
      title: stringValue(daily.title, defaultShopConfig.dailyOffer.title),
      countText: stringValue(daily.countText, defaultShopConfig.dailyOffer.countText),
      sub: stringValue(daily.sub, defaultShopConfig.dailyOffer.sub),
      cost: positiveNumber(daily.cost, defaultShopConfig.dailyOffer.cost),
      oldPriceText: stringValue(daily.oldPriceText, defaultShopConfig.dailyOffer.oldPriceText),
      badgeText: stringValue(daily.badgeText, defaultShopConfig.dailyOffer.badgeText),
      countdownText: stringValue(daily.countdownText, defaultShopConfig.dailyOffer.countdownText),
      icon: 'ticket',
      reward: normalizeReward(daily.reward, defaultShopConfig.dailyOffer.reward)
    },
    commonItems: (items.length ? items : defaultShopConfig.commonItems).map((item, index) =>
      normalizeCommonItem(item, defaultShopConfig.commonItems[index] ?? defaultShopConfig.commonItems[0])
    )
  };
}

function normalizeCommonItem(value: unknown, fallback: ShopCommonItemConfig): ShopCommonItemConfig {
  const item = isRecord(value) ? value : {};
  const icon = item.icon === 'energy' || item.icon === 'ticket' || item.icon === 'gems' ? item.icon : fallback.icon;
  const priceText = stringValue(item.priceText, fallback.priceText ?? '');
  const cost = priceText ? undefined : positiveNumber(item.cost, fallback.cost ?? 0);
  return {
    id: stringValue(item.id, fallback.id),
    title: stringValue(item.title, fallback.title),
    sub: stringValue(item.sub, fallback.sub),
    ...(priceText ? { priceText } : { cost }),
    limit: stringValue(item.limit, fallback.limit),
    icon,
    reward: normalizeReward(item.reward, fallback.reward)
  };
}

function normalizeReward(value: unknown, fallback: ShopReward): ShopReward {
  const reward = isRecord(value) ? value : {};
  return {
    coins: optionalPositiveNumber(reward.coins, fallback.coins),
    scoutTickets: optionalPositiveNumber(reward.scoutTickets, fallback.scoutTickets),
    gems: optionalPositiveNumber(reward.gems, fallback.gems),
    energy: optionalPositiveNumber(reward.energy, fallback.energy)
  };
}

function optionalPositiveNumber(value: unknown, fallback?: number) {
  if (value === '' || value == null) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function positiveNumber(value: unknown, fallback: number) {
  return optionalPositiveNumber(value, fallback) ?? fallback;
}

function stringValue(value: unknown, fallback: string) {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
