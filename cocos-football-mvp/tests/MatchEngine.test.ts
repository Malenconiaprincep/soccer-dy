import { describe, expect, it } from 'vitest';
import { computeLineupStrength, simulateMatch } from '../assets/scripts/football-mvp/MatchEngine';
import { instantiate } from '../assets/scripts/football-mvp/PlayerFactory';
import type { PlayerInstance } from '../assets/scripts/football-mvp/Types';

function makeFull442Lineup(squad: PlayerInstance[]): (string | null)[] {
  const need: ('GK' | 'DF' | 'MF' | 'FW')[] = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW'];
  const lineup: (string | null)[] = Array(11).fill(null);
  const used = new Set<string>();
  for (let i = 0; i < 11; i++) {
    const g = need[i]!;
    const pl =
      squad.find((p) => p.group === g && !used.has(p.instanceId)) ??
      squad.find((p) => !used.has(p.instanceId));
    if (pl) {
      lineup[i] = pl.instanceId;
      used.add(pl.instanceId);
    }
  }
  return lineup;
}

describe('MatchEngine', () => {
  it('computeLineupStrength respects empty slots lower than full', () => {
    const squad: PlayerInstance[] = [];
    for (const id of ['t_mf_01', 't_fw_01', 't_df_01', 't_gk_01']) {
      const p = instantiate(id)!;
      squad.push(p);
    }
    const partial = Array(11).fill(null) as (string | null)[];
    partial[0] = squad.find((x) => x.group === 'GK')!.instanceId;
    const sPartial = computeLineupStrength('442', partial, squad);
    const fullSquad: PlayerInstance[] = [];
    const ids = [
      't_gk_01',
      't_df_01',
      't_df_02',
      't_df_03',
      't_df_04',
      't_mf_01',
      't_mf_02',
      't_mf_03',
      't_mf_04',
      't_fw_01',
      't_fw_02',
    ];
    for (const id of ids) fullSquad.push(instantiate(id)!);
    const fullLine = makeFull442Lineup(fullSquad);
    const sFull = computeLineupStrength('442', fullLine, fullSquad);
    expect(sFull).toBeGreaterThan(sPartial);
  });

  it('simulateMatch is deterministic with seed', () => {
    const squad: PlayerInstance[] = [];
    for (const id of [
      't_gk_01',
      't_df_01',
      't_df_02',
      't_df_03',
      't_df_04',
      't_mf_01',
      't_mf_02',
      't_mf_03',
      't_mf_04',
      't_fw_01',
      't_fw_02',
    ]) {
      squad.push(instantiate(id)!);
    }
    const lineup = makeFull442Lineup(squad);
    const a = simulateMatch({
      formationId: '442',
      lineup,
      squad,
      difficulty: 'normal',
      seed: 42,
    });
    const b = simulateMatch({
      formationId: '442',
      lineup,
      squad,
      difficulty: 'normal',
      seed: 42,
    });
    expect(a.homeGoals).toBe(b.homeGoals);
    expect(a.awayGoals).toBe(b.awayGoals);
    expect(a.outcome).toBe(b.outcome);
  });
});
