import { FORMATIONS } from './playerPool';
import type { FormationId, MatchDifficulty, MatchResult, PlayerInstance, PositionGroup } from './Types';

const DIFF_OVR: Record<MatchDifficulty, number> = {
  easy: 62,
  normal: 72,
  hard: 82,
};

const REWARD: Record<MatchDifficulty, { win: number; draw: number; loss: number }> = {
  easy: { win: 350, draw: 120, loss: -80 },
  normal: { win: 500, draw: 180, loss: -100 },
  hard: { win: 800, draw: 260, loss: -120 },
};

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = 1 - rng();
  const v = 1 - rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function slotFitMultiplier(playerGroup: PositionGroup, slotNeed: PositionGroup): number {
  if (playerGroup === slotNeed) return 1;
  if (slotNeed === 'MF' && (playerGroup === 'FW' || playerGroup === 'DF')) return 0.92;
  if (slotNeed === 'FW' && playerGroup === 'MF') return 0.9;
  if (slotNeed === 'DF' && playerGroup === 'MF') return 0.9;
  if (slotNeed === 'GK' && playerGroup !== 'GK') return 0.55;
  if (playerGroup === 'GK' && slotNeed !== 'GK') return 0.55;
  return 0.85;
}

export function computeLineupStrength(
  formationId: FormationId,
  lineup: readonly (string | null)[],
  squad: readonly PlayerInstance[],
): number {
  const form = FORMATIONS[formationId];
  const byInst = new Map(squad.map((p) => [p.instanceId, p]));
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const id = lineup[i];
    const need = form.slots[i]!;
    if (!id) {
      sum += 45 * 0.75;
      continue;
    }
    const pl = byInst.get(id);
    if (!pl) {
      sum += 45 * 0.75;
      continue;
    }
    const m = slotFitMultiplier(pl.group, need);
    sum += pl.ovr * m;
  }
  const avg = sum / 11;
  return avg * form.attackBias * 0.55 + avg * form.defenseBias * 0.45;
}

function aiStrength(diff: MatchDifficulty, rng: () => number): number {
  const base = DIFF_OVR[diff];
  const noise = gaussian(rng) * 1.4;
  return Math.max(52, Math.min(92, base + noise));
}

export interface SimMatchInput {
  readonly formationId: FormationId;
  readonly lineup: readonly (string | null)[];
  readonly squad: readonly PlayerInstance[];
  readonly difficulty: MatchDifficulty;
  readonly seed?: number;
}

export function simulateMatch(input: SimMatchInput): MatchResult {
  const seed = input.seed ?? Date.now() % 1_000_000_000;
  const rng = mulberry32(seed);
  const homeStrength = computeLineupStrength(input.formationId, input.lineup, input.squad);
  const away = aiStrength(input.difficulty, rng);
  const homeAdj = homeStrength + gaussian(rng) * 2.2;
  const awayAdj = away + gaussian(rng) * 2.0;
  const form = FORMATIONS[input.formationId];
  const homeXG = Math.max(0.1, (homeAdj / 82) * 1.55 * form.attackBias + rng() * 0.35);
  const awayXG = Math.max(0.1, (awayAdj / 82) * 1.45 * (2 - form.defenseBias * 0.92) + rng() * 0.35);
  const homeGoals = poisson(homeXG, rng);
  const awayGoals = poisson(awayXG, rng);
  let outcome: MatchResult['outcome'];
  if (homeGoals > awayGoals) outcome = 'win';
  else if (homeGoals < awayGoals) outcome = 'loss';
  else outcome = 'draw';
  const rw = REWARD[input.difficulty];
  let coinsDelta = outcome === 'win' ? rw.win : outcome === 'draw' ? rw.draw : rw.loss;
  let pointsDelta = outcome === 'win' ? 3 : outcome === 'draw' ? 1 : 0;
  if (outcome === 'win' && input.difficulty === 'hard') pointsDelta += 1;
  const narrative =
    outcome === 'win'
      ? '球队在关键阶段把握住了机会，拿下胜利。'
      : outcome === 'draw'
        ? '双方互有攻守，比分最终持平。'
        : '对手效率更高，本场惜败。';
  return {
    homeGoals,
    awayGoals,
    homeXG: Math.round(homeXG * 10) / 10,
    awayXG: Math.round(awayXG * 10) / 10,
    outcome,
    coinsDelta,
    pointsDelta,
    narrative,
  };
}

function poisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > L && k < 12);
  return k - 1;
}
