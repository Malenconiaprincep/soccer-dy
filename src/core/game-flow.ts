export type SceneId = 'menu' | 'lineup' | 'trading' | 'prep' | 'match';

export interface MatchSettings {
  durationSec: number;
  homeName: string;
  awayName: string;
}

export interface GameFlow {
  goMenu: () => void;
  goLineup: () => void;
  goTrading: () => void;
  goPrep: () => void;
  goMatch: (settings: MatchSettings) => void;
}

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  durationSec: 90,
  homeName: '绿狮联',
  awayName: '紫星联',
};
