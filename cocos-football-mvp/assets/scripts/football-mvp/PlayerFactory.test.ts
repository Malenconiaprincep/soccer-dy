import { describe, expect, it } from 'vitest';
import { generateShopOffers, instantiate } from './PlayerFactory';

describe('PlayerFactory', () => {
  it('instantiate returns null for unknown template', () => {
    expect(instantiate('no_such_id')).toBeNull();
  });

  it('instantiate adds instanceId', () => {
    const a = instantiate('t_mf_01')!;
    const b = instantiate('t_mf_01')!;
    expect(a.instanceId).not.toBe(b.instanceId);
    expect(a.name).toBe(b.name);
  });

  it('generateShopOffers returns count offers with unique template ids', () => {
    const rng = (() => {
      let s = 1;
      return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    })();
    const offers = generateShopOffers(6, rng);
    expect(offers).toHaveLength(6);
    const ids = new Set(offers.map((o) => o.templateId));
    expect(ids.size).toBe(6);
    for (const o of offers) {
      expect(o.listPrice).toBeGreaterThanOrEqual(800);
    }
  });
});
