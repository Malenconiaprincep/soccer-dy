import { allTemplates, getTemplate, randomTemplateByRarity, rollRarity } from './playerPool';
import type { PlayerInstance, ShopOffer } from './Types';

let idCounter = 0;

export function nextInstanceId(): string {
  idCounter += 1;
  return `pi_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export function instantiate(templateId: string): PlayerInstance | null {
  const t = getTemplate(templateId);
  if (!t) return null;
  return { ...t, instanceId: nextInstanceId() };
}

export function rollGachaPlayer(rng: () => number): PlayerInstance {
  const r = rollRarity(rng);
  const tpl = randomTemplateByRarity(r, rng);
  return { ...tpl, instanceId: nextInstanceId() };
}

const SHOP_MARKUP_MIN = 0.85;
const SHOP_MARKUP_MAX = 1.35;

export function generateShopOffers(count: number, rng: () => number): ShopOffer[] {
  const templates = allTemplates();
  const offers: ShopOffer[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    let tpl = templates[Math.floor(rng() * templates.length)]!;
    let guard = 0;
    while (used.has(tpl.id) && guard++ < 50) {
      tpl = templates[Math.floor(rng() * templates.length)]!;
    }
    used.add(tpl.id);
    const mk = SHOP_MARKUP_MIN + rng() * (SHOP_MARKUP_MAX - SHOP_MARKUP_MIN);
    const listPrice = Math.round(tpl.valueMillionEur * 180 * mk);
    offers.push({
      offerId: `of_${i}_${Math.floor(rng() * 1e9)}`,
      templateId: tpl.id,
      listPrice: Math.max(800, listPrice),
    });
  }
  return offers;
}
