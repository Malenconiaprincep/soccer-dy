import type { FormationData, LineupSlot } from '../types';

export type BattleMode = 'ai' | 'douyinRealtime';

export interface BattleSource {
  mode: BattleMode;
  opponentId?: string | null;
  opponentIsBot?: boolean;
  opponentName: string;
  opponentFormation?: FormationData;
  opponentLineup?: LineupSlot[];
}

export const defaultBattleSource: BattleSource = {
  mode: 'ai',
  opponentIsBot: true,
  opponentName: 'AI 联队'
};
