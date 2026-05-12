import { describe, expect, it } from 'vitest';
import { FootballMvpGame } from '../assets/scripts/football-mvp/FootballMvpGame';
import { SaveRepository, createMemoryStorage } from '../assets/scripts/football-mvp/SaveRepository';

describe('FootballMvpGame', () => {
  it('refillLineupGreedy fills 11 slots after formation change clears lineup', () => {
    const g = new FootballMvpGame(new SaveRepository(createMemoryStorage()));
    g.setFormation('433');
    expect(g.snapshot().lineup.filter(Boolean).length).toBe(0);
    const r = g.refillLineupGreedy();
    expect(r.ok).toBe(true);
    expect(g.snapshot().lineup.filter(Boolean).length).toBe(11);
  });
});
