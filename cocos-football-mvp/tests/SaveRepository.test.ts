import { describe, expect, it } from 'vitest';
import { generateShopOffers, instantiate } from '../assets/scripts/football-mvp/PlayerFactory';
import { SaveRepository, createMemoryStorage, defaultSave } from '../assets/scripts/football-mvp/SaveRepository';

describe('SaveRepository', () => {
  it('roundtrips persisted state through memory storage', () => {
    const raw = createMemoryStorage();
    const repo = new SaveRepository(raw);
    const data = defaultSave();
    data.managerName = '测试经理';
    data.coins = 777;
    data.squad = [instantiate('t_gk_01')!];
    data.shopOffers = generateShopOffers(6, () => 0.3);
    repo.save(data);
    const repo2 = new SaveRepository(raw);
    const loaded = repo2.load();
    expect(loaded.managerName).toBe('测试经理');
    expect(loaded.coins).toBe(777);
    expect(loaded.squad).toHaveLength(1);
    expect(loaded.shopOffers).toHaveLength(6);
  });
});
