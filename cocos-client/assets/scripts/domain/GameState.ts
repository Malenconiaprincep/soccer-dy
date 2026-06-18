import { sys } from 'cc';
import { defaultCollectionIds, drawScoutCandidates, formations, players, starterCollectionIds } from './data';
import type { BattleEvent, FormationData, LineupSlot, PlayerSaveData, PlayerCardData, Position } from './types';

const SAVE_KEY = 'soccer.cocos.save.v1';

export interface OpponentState {
  userId?: string | null;
  nickname: string;
  avatarUrl?: string | null;
  isBot: boolean;
  mode: 'ai' | 'douyinRealtime';
}

export interface BattleResult {
  scoreA: number;
  scoreB: number;
  events: BattleEvent[];
}

export class GameState {
  userId = 'cocos-local-001';
  nickname = '本地经理';
  coins = 1286000;
  gems = 0;
  energy = 120;
  scoutTickets = 2;
  matchesPlayed = 0;
  wins = 0;
  claimedTasks = new Set<string>();
  permanentClaims = new Set<string>();
  dailyTaskDate = this.todayKey();
  collectionIds = new Set(defaultCollectionIds);
  selectedFormation: FormationData = formations[1];
  lineup: LineupSlot[] = [];
  substitutes: Array<PlayerCardData | undefined> = Array.from({ length: 5 });
  pendingScoutChoices: PlayerCardData[] = [];
  opponent: OpponentState = { nickname: 'AI 联队', isBot: true, mode: 'ai' };
  opponentFormation: FormationData = formations[0];
  opponentLineup: LineupSlot[] = [];
  battleResult: BattleResult = { scoreA: 0, scoreB: 0, events: [] };

  constructor() {
    this.resetLineup();
  }

  load(): void {
    try {
      const raw = sys.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw) as PlayerSaveData;
      this.userId = save.userId || this.userId;
      this.nickname = save.nickname || this.nickname;
      this.coins = Number(save.coins ?? this.coins);
      this.gems = Number(save.gems ?? this.gems);
      this.energy = Number(save.energy ?? this.energy);
      this.scoutTickets = Number(save.scoutTickets ?? this.scoutTickets);
      this.matchesPlayed = Number(save.matchesPlayed ?? 0);
      this.wins = Number(save.wins ?? 0);
      const today = this.todayKey();
      this.dailyTaskDate = today;
      this.claimedTasks = new Set(save.dailyTaskDate === today ? (save.claimedTasks ?? []) : []);
      this.permanentClaims = new Set(save.permanentClaims ?? []);
      this.collectionIds = new Set(save.collection?.length ? save.collection : defaultCollectionIds);
      this.selectedFormation = formations.find((item) => item.id === save.selectedFormationId) ?? formations[1];
      this.lineup = this.selectedFormation.slots.map((slot) => ({
        ...slot,
        player: players.find((player) => save.lineup?.find((item) => item.slotId === slot.id)?.playerId === player.id)
      }));
      this.fillEmptyLineup();
      this.substitutes = Array.from({ length: 5 }, (_, index) => players.find((player) => player.id === save.substitutes?.[index]));
      this.fillEmptySubstitutes();
    } catch (error) {
      console.warn('[save] ignoring invalid local save', error);
      this.resetLineup();
    }
  }

  save(): void {
    const value: PlayerSaveData = {
      userId: this.userId,
      nickname: this.nickname,
      coins: this.coins,
      gems: this.gems,
      energy: this.energy,
      scoutTickets: this.scoutTickets,
      matchesPlayed: this.matchesPlayed,
      wins: this.wins,
      collection: [...this.collectionIds],
      claimedTasks: [...this.claimedTasks],
      permanentClaims: [...this.permanentClaims],
      dailyTaskDate: this.dailyTaskDate,
      selectedFormationId: this.selectedFormation.id,
      lineup: this.lineup.map((slot) => ({ slotId: slot.id, playerId: slot.player?.id })),
      substitutes: this.substitutes.map((player) => player?.id),
      updatedAt: new Date().toISOString()
    };
    sys.localStorage.setItem(SAVE_KEY, JSON.stringify(value));
  }

  get power(): number {
    return this.lineup.reduce((sum, slot) => sum + (slot.player?.rating ?? 60), 0);
  }

  applyBattleResult(result: BattleResult): void {
    this.battleResult = result;
    this.matchesPlayed += 1;
    if (result.scoreA > result.scoreB) this.wins += 1;
    this.coins += result.scoreA > result.scoreB ? 1200 : 520;
    this.energy = Math.max(0, this.energy - 6);
    if (result.scoreA > result.scoreB) this.scoutTickets += 1;
    this.save();
  }

  claimReward(id: string, reward: { coins?: number; scoutTickets?: number; gems?: number; energy?: number }, permanent = false): boolean {
    const claims = permanent ? this.permanentClaims : this.claimedTasks;
    if (claims.has(id)) return false;
    claims.add(id);
    this.applyReward(reward);
    this.save();
    return true;
  }

  spendGems(cost: number, reward: { coins?: number; scoutTickets?: number; energy?: number }): boolean {
    if (this.gems < cost) return false;
    this.gems -= cost;
    this.applyReward(reward);
    this.save();
    return true;
  }

  setFormation(formation: FormationData): void {
    const available = [...this.lineup.map((slot) => slot.player), ...this.substitutes].filter((player): player is PlayerCardData => !!player);
    const used = new Set<string>();
    const take = (position: Position) => {
      const exact = available.find((player) => !used.has(player.id) && player.position === position);
      const fallback = position === 'GK' ? undefined : available.find((player) => !used.has(player.id) && player.position !== 'GK');
      const player = exact ?? fallback;
      if (player) used.add(player.id);
      return player;
    };
    this.selectedFormation = formation;
    this.lineup = formation.slots.map((slot) => ({ ...slot, player: take(slot.position) }));
    const remaining = available.filter((player) => !used.has(player.id));
    this.substitutes = Array.from({ length: 5 }, (_, index) => remaining[index]);
    this.fillEmptyLineup();
    this.fillEmptySubstitutes();
    this.save();
  }

  swapLineupSlots(fromId: string, toId: string): boolean {
    const from = this.lineup.find((slot) => slot.id === fromId);
    const to = this.lineup.find((slot) => slot.id === toId);
    if (!from || !to || !from.player || !this.canPlace(from.player, to.position) || (to.player && !this.canPlace(to.player, from.position))) return false;
    [from.player, to.player] = [to.player, from.player];
    this.save();
    return true;
  }

  swapLineupWithSubstitute(slotId: string, benchIndex: number): boolean {
    const slot = this.lineup.find((item) => item.id === slotId);
    const substitute = this.substitutes[benchIndex];
    if (!slot || (!slot.player && !substitute) || (substitute && !this.canPlace(substitute, slot.position))) return false;
    [slot.player, this.substitutes[benchIndex]] = [substitute, slot.player];
    this.save();
    return true;
  }

  fillSlot(slotId: string, player: PlayerCardData): boolean {
    const slot = this.lineup.find((item) => item.id === slotId);
    if (!slot || !this.collectionIds.has(player.id) || !this.canPlace(player, slot.position)) return false;
    this.lineup.forEach((item) => { if (item.player?.id === player.id) item.player = undefined; });
    this.substitutes = this.substitutes.map((item) => item?.id === player.id ? undefined : item);
    slot.player = player;
    this.fillEmptySubstitutes();
    this.save();
    return true;
  }

  fillSubstitute(index: number, player: PlayerCardData): boolean {
    if (index < 0 || index >= this.substitutes.length || !this.collectionIds.has(player.id)) return false;
    this.lineup.forEach((item) => { if (item.player?.id === player.id) item.player = undefined; });
    this.substitutes = this.substitutes.map((item) => item?.id === player.id ? undefined : item);
    this.substitutes[index] = player;
    this.save();
    return true;
  }

  ownedPlayers(position?: Position): PlayerCardData[] {
    return players.filter((player) => this.collectionIds.has(player.id) && (!position || player.position === position)).sort((a, b) => b.rating - a.rating);
  }

  startScoutDraw(): boolean {
    if (this.scoutTickets <= 0) return false;
    this.scoutTickets -= 1;
    this.pendingScoutChoices = drawScoutCandidates([...this.collectionIds], 3);
    this.save();
    return this.pendingScoutChoices.length > 0;
  }

  claimScoutPlayer(player: PlayerCardData): void {
    if (!this.pendingScoutChoices.some((item) => item.id === player.id)) return;
    this.collectionIds.add(player.id);
    this.pendingScoutChoices = [];
    this.fillEmptySubstitutes();
    this.save();
  }

  prepareOpponent(): void {
    this.opponentFormation = formations[Math.floor(Math.random() * formations.length)];
    const target = this.power / Math.max(1, this.lineup.length);
    const used = new Set<string>();
    this.opponentLineup = this.opponentFormation.slots.map((slot) => {
      const pool = players
        .filter((player) => player.position === slot.position && !used.has(player.id))
        .sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target));
      const window = pool.slice(0, Math.min(8, pool.length));
      const player = window[Math.floor(Math.random() * window.length)] ?? pool[0];
      if (player) used.add(player.id);
      return { ...slot, player };
    });
  }

  private resetLineup(): void {
    const owned = players.filter((player) => starterCollectionIds.includes(player.id));
    const used = new Set<string>();
    this.lineup = this.selectedFormation.slots.map((slot) => {
      const player = owned.find((candidate) => candidate.position === slot.position && !used.has(candidate.id))
        ?? owned.find((candidate) => !used.has(candidate.id));
      if (player) used.add(player.id);
      return { ...slot, player };
    });
    this.fillEmptySubstitutes();
  }

  private fillEmptyLineup(): void {
    const owned = players.filter((player) => this.collectionIds.has(player.id));
    const used = new Set(this.lineup.flatMap((slot) => slot.player ? [slot.player.id] : []));
    for (const slot of this.lineup) {
      if (slot.player) continue;
      const player = owned.find((candidate) => candidate.position === slot.position && !used.has(candidate.id))
        ?? owned.find((candidate) => !used.has(candidate.id));
      if (player) {
        slot.player = player;
        used.add(player.id);
      }
    }
  }

  private fillEmptySubstitutes(): void {
    const used = new Set([
      ...this.lineup.flatMap((slot) => slot.player ? [slot.player.id] : []),
      ...this.substitutes.flatMap((player) => player ? [player.id] : [])
    ]);
    const pool = this.ownedPlayers().filter((player) => !used.has(player.id));
    this.substitutes = Array.from({ length: 5 }, (_, index) => this.substitutes[index] ?? pool.shift());
  }

  private canPlace(player: PlayerCardData, position: Position): boolean {
    return position === 'GK' ? player.position === 'GK' : player.position !== 'GK';
  }

  private applyReward(reward: { coins?: number; scoutTickets?: number; gems?: number; energy?: number }): void {
    this.coins += reward.coins ?? 0;
    this.scoutTickets += reward.scoutTickets ?? 0;
    this.gems += reward.gems ?? 0;
    this.energy = Math.min(120, this.energy + (reward.energy ?? 0));
  }

  private todayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}
