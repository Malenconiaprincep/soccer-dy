import type { FormationData, LineupSlot } from '../types';

export type BattleMode = 'ai' | 'douyinRealtime';

export interface BattleSource {
  mode: BattleMode;
  opponentName: string;
  opponentFormation?: FormationData;
  opponentLineup?: LineupSlot[];
}

export const defaultBattleSource: BattleSource = {
  mode: 'ai',
  opponentName: 'AI 联队'
};
