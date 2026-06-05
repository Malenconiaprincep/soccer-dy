export const SHOP_CONFIG_KEY = 'shop-config';

export const defaultShopConfig = {
  dailyOffers: [
    {
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
    {
      id: 'energy30',
      title: '体力补给',
      countText: '×1',
      sub: '恢复 30 点体力',
      cost: 20,
      oldPriceText: '原价 30',
      badgeText: '7',
      countdownText: '23:59:59',
      icon: 'ticket',
      reward: { energy: 30 }
    }
  ],
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

export function normalizeShopConfig(value) {
  const input = isRecord(value) ? value : {};
  const rawDailyOffers = Array.isArray(input.dailyOffers)
    ? input.dailyOffers
    : isRecord(input.dailyOffer)
      ? [input.dailyOffer]
      : [];
  const items = Array.isArray(input.commonItems) ? input.commonItems : [];
  return {
    dailyOffers: (rawDailyOffers.length ? rawDailyOffers : defaultShopConfig.dailyOffers).map((item, index) =>
      normalizeDailyOffer(item, defaultShopConfig.dailyOffers[index] ?? defaultShopConfig.dailyOffers[0])
    ),
    commonItems: (items.length ? items : defaultShopConfig.commonItems).map((item, index) =>
      normalizeCommonItem(item, defaultShopConfig.commonItems[index] ?? defaultShopConfig.commonItems[0])
    )
  };
}

function normalizeDailyOffer(value, fallback) {
  const daily = isRecord(value) ? value : {};
  return {
    ...fallback,
    id: stringValue(daily.id, fallback.id),
    title: stringValue(daily.title, fallback.title),
    countText: stringValue(daily.countText, fallback.countText),
    sub: stringValue(daily.sub, fallback.sub),
    cost: positiveNumber(daily.cost, fallback.cost),
    oldPriceText: stringValue(daily.oldPriceText, fallback.oldPriceText),
    badgeText: stringValue(daily.badgeText, fallback.badgeText),
    countdownText: stringValue(daily.countdownText, fallback.countdownText),
    icon: 'ticket',
    reward: normalizeReward(daily.reward, fallback.reward)
  };
}

function normalizeCommonItem(value, fallback) {
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

function normalizeReward(value, fallback) {
  const reward = isRecord(value) ? value : {};
  return {
    coins: optionalPositiveNumber(reward.coins, fallback.coins),
    scoutTickets: optionalPositiveNumber(reward.scoutTickets, fallback.scoutTickets),
    gems: optionalPositiveNumber(reward.gems, fallback.gems),
    energy: optionalPositiveNumber(reward.energy, fallback.energy)
  };
}

function optionalPositiveNumber(value, fallback) {
  if (value === '' || value == null) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function positiveNumber(value, fallback) {
  return optionalPositiveNumber(value, fallback) ?? fallback;
}

function stringValue(value, fallback) {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
