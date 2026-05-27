import { defaultCollectionIds, formations, players, starterCollectionIds } from '../data';
import type { LineupSlot, PlayerCardData, PlayerSaveData, Position } from '../types';

const SAVE_KEY = 'soccer-dy3-player-save';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const localStore: StorageLike = {
  getItem(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Local persistence is best-effort in mini-game sandboxes.
    }
  }
};

const runtimeEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

export class PlayerStorage {
  private readonly supabaseUrl = runtimeEnv.VITE_SUPABASE_URL;
  private readonly supabaseAnonKey = runtimeEnv.VITE_SUPABASE_ANON_KEY;

  async load() {
    const local = this.loadLocal();
    if (!this.supabaseUrl || !this.supabaseAnonKey) return local;

    try {
      const remote = await this.loadRemote(local.userId);
      if (remote) {
        const normalized = this.normalizeSave(remote);
        localStore.setItem(SAVE_KEY, JSON.stringify(normalized));
        return normalized;
      }
      await this.save(local);
      return local;
    } catch (error) {
      console.warn('[storage] Supabase load failed, using local save', error);
      return local;
    }
  }

  async save(data: PlayerSaveData) {
    const next = { ...data, updatedAt: new Date().toISOString() };
    localStore.setItem(SAVE_KEY, JSON.stringify(next));
    if (!this.supabaseUrl || !this.supabaseAnonKey) return;

    try {
      await fetch(`${this.supabaseUrl}/rest/v1/player_saves`, {
        method: 'POST',
        headers: {
          apikey: this.supabaseAnonKey,
          Authorization: `Bearer ${this.supabaseAnonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify(this.toRow(next))
      });
    } catch (error) {
      console.warn('[storage] Supabase save failed, local save kept', error);
    }
  }

  toSaveData(
    userId: string,
    nickname: string,
    selectedFormationId: string,
    lineup: LineupSlot[]
  ): PlayerSaveData {
    return {
      userId,
      nickname,
      coins: 1286000,
      gems: 5688,
      energy: 120,
      scoutTickets: 2,
      matchesPlayed: 0,
      wins: 0,
      collection: defaultCollectionIds,
      claimedTasks: [],
      dailyTaskDate: this.todayKey(),
      selectedFormationId,
      lineup: lineup.map((slot) => ({ slotId: slot.id, playerId: slot.player?.id })),
      updatedAt: new Date().toISOString()
    };
  }

  applyLineup(save: PlayerSaveData) {
    const formation = formations.find((item) => item.id === save.selectedFormationId) ?? formations[1];
    const playerById = new Map(players.map((player) => [player.id, player]));
    const collectionIds = save.collection?.length ? save.collection : defaultCollectionIds;
    const ownedIds = new Set(collectionIds);
    const savedSlotById = new Map(save.lineup.map((slot) => [slot.slotId, slot.playerId]));
    const usedIds = new Set<string>();
    return {
      formation,
      lineup: formation.slots.map((slot) => {
        const playerId = savedSlotById.get(slot.id);
        const savedPlayer = playerId && ownedIds.has(playerId) ? playerById.get(playerId) : undefined;
        const validSavedPlayer = savedPlayer && this.canPlacePlayerInSlot(savedPlayer, slot.position) ? savedPlayer : undefined;
        const player = validSavedPlayer ?? this.bestAvailable(slot.position, ownedIds, usedIds);
        if (player) usedIds.add(player.id);
        return { ...slot, player };
      })
    };
  }

  normalizeSave(save: PlayerSaveData): PlayerSaveData {
    const today = this.todayKey();
    const dailyReset = save.dailyTaskDate !== today;
    return {
      ...save,
      scoutTickets: Number(save.scoutTickets ?? 2),
      matchesPlayed: Number(save.matchesPlayed ?? 0),
      wins: Number(save.wins ?? 0),
      collection: this.withDefaultCollection(save.collection),
      claimedTasks: dailyReset ? [] : save.claimedTasks ?? [],
      dailyTaskDate: today
    };
  }

  private loadLocal(): PlayerSaveData {
    const raw = localStore.getItem(SAVE_KEY);
    if (raw) {
      try {
        return this.normalizeSave(JSON.parse(raw) as PlayerSaveData);
      } catch {
        // Fall through to a fresh save.
      }
    }

    return {
      userId: this.createGuestId(),
      nickname: '本地经理',
      coins: 1286000,
      gems: 5688,
      energy: 120,
      scoutTickets: 2,
      matchesPlayed: 0,
      wins: 0,
      collection: defaultCollectionIds,
      claimedTasks: [],
      dailyTaskDate: this.todayKey(),
      selectedFormationId: formations[1].id,
      lineup: this.createStarterLineup(formations[1]),
      updatedAt: new Date().toISOString()
    };
  }

  private async loadRemote(userId: string) {
    const url = new URL(`${this.supabaseUrl}/rest/v1/player_saves`);
    url.searchParams.set('user_id', `eq.${userId}`);
    url.searchParams.set('select', '*');
    url.searchParams.set('limit', '1');
    const response = await fetch(url, {
      headers: {
        apikey: this.supabaseAnonKey ?? '',
        Authorization: `Bearer ${this.supabaseAnonKey ?? ''}`
      }
    });
    if (!response.ok) return undefined;
    const rows = (await response.json()) as Array<Record<string, unknown>>;
    return rows[0] ? this.fromRow(rows[0]) : undefined;
  }

  private toRow(save: PlayerSaveData) {
    return {
      user_id: save.userId,
      nickname: save.nickname,
      coins: save.coins,
      gems: save.gems,
      energy: save.energy,
      scout_tickets: save.scoutTickets,
      matches_played: save.matchesPlayed,
      wins: save.wins,
      collection: save.collection,
      claimed_tasks: save.claimedTasks,
      daily_task_date: save.dailyTaskDate,
      selected_formation_id: save.selectedFormationId,
      lineup: save.lineup,
      updated_at: save.updatedAt
    };
  }

  private fromRow(row: Record<string, unknown>): PlayerSaveData {
    return {
      userId: String(row.user_id),
      nickname: String(row.nickname ?? '本地经理'),
      coins: Number(row.coins ?? 1286000),
      gems: Number(row.gems ?? 5688),
      energy: Number(row.energy ?? 120),
      scoutTickets: Number(row.scout_tickets ?? 2),
      matchesPlayed: Number(row.matches_played ?? 0),
      wins: Number(row.wins ?? 0),
      collection: Array.isArray(row.collection) ? (row.collection as string[]) : defaultCollectionIds,
      claimedTasks: Array.isArray(row.claimed_tasks) ? (row.claimed_tasks as string[]) : [],
      dailyTaskDate: String(row.daily_task_date ?? this.todayKey()),
      selectedFormationId: String(row.selected_formation_id ?? formations[1].id),
      lineup: Array.isArray(row.lineup) ? (row.lineup as PlayerSaveData['lineup']) : [],
      updatedAt: String(row.updated_at ?? new Date().toISOString())
    };
  }

  private createGuestId() {
    const id = globalThis.crypto?.randomUUID?.() ?? `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return id;
  }

  private createStarterLineup(formation: (typeof formations)[number]) {
    const ownedIds = new Set(starterCollectionIds);
    const usedIds = new Set<string>();
    return formation.slots.map((slot) => {
      const player = this.bestAvailable(slot.position, ownedIds, usedIds);
      if (player) usedIds.add(player.id);
      return { slotId: slot.id, playerId: player?.id };
    });
  }

  private bestAvailable(position: Position, ownedIds: Set<string>, usedIds: Set<string>) {
    return players
      .filter((player) => player.position === position && ownedIds.has(player.id) && !usedIds.has(player.id))
      .sort((a, b) => b.rating - a.rating)[0];
  }

  private canPlacePlayerInSlot(player: PlayerCardData, slotPosition: Position) {
    return slotPosition === 'GK' ? player.position === 'GK' : player.position !== 'GK';
  }

  private withDefaultCollection(collection?: string[]) {
    return [...new Set([...(collection?.length ? collection : defaultCollectionIds), ...defaultCollectionIds])];
  }

  private todayKey() {
    return new Date().toISOString().slice(0, 10);
  }
}
