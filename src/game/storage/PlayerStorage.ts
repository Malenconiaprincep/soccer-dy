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

export class PlayerStorage {
  async load() {
    return this.loadLocal();
  }

  async save(data: PlayerSaveData) {
    const next = { ...data, updatedAt: new Date().toISOString() };
    localStore.setItem(SAVE_KEY, JSON.stringify(next));
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
      gems: 0,
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
      gems: 0,
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
