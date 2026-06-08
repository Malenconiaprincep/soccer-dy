export type SceneName = 'loading' | 'home' | 'formation' | 'blindBox' | 'matchmaking' | 'matchup' | 'battle' | 'result';

export type Position = 'GK' | 'DF' | 'MF' | 'FW';

export type Rarity = 'bronze' | 'silver' | 'gold' | 'purple' | 'orange' | 'legend';

export interface PlayerCardData {
  id: string;
  name: string;
  position: Position;
  role: string;
  rarity: Rarity;
  rating: number;
  attack: number;
  defense: number;
  speed: number;
  stamina: number;
  skill: string;
  color: number;
  portrait: string;
  era: 'current' | 'legend';
}

export interface FormationData {
  id: string;
  name: string;
  style: string;
  locked?: boolean;
  slots: FormationSlot[];
}

export interface FormationSlot {
  id: string;
  position: Position;
  x: number;
  y: number;
}

export interface LineupSlot extends FormationSlot {
  player?: PlayerCardData;
}

export interface BattleEvent {
  time: number;
  text: string;
  scoreA: number;
  scoreB: number;
  mood: 'normal' | 'good' | 'bad';
  eventType?: string;
  title?: string;
  actor?: string;
  relatedActors?: string[];
  team?: 'home' | 'away';
}

export interface PlayerSaveData {
  userId: string;
  nickname: string;
  coins: number;
  gems: number;
  energy: number;
  scoutTickets: number;
  matchesPlayed: number;
  wins: number;
  collection: string[];
  claimedTasks: string[];
  dailyTaskDate: string;
  selectedFormationId: string;
  lineup: Array<{ slotId: string; playerId?: string }>;
  updatedAt: string;
}

export interface Scene {
  enter(): void;
  update(deltaMs: number): void;
  exit(): void;
  resize(width: number, height: number): void;
}
