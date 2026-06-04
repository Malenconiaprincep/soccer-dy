import type { BattleEvent, LineupSlot } from '../types';
import { normalizeShopConfig, type ShopConfig } from '../../shopConfig';

const runtimeEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

interface SessionPayload {
  platform: string;
  platformUserId: string;
  nickname: string;
  avatarUrl?: string;
  loginCode?: string;
}

interface PlayerStateRow {
  coins?: number;
  gems?: number;
  energy?: number;
  scout_tickets?: number;
  matches_played?: number;
  wins?: number;
  daily_task_date?: string;
  claimed_tasks?: string[];
}

export interface MatchOpponent {
  userId?: string | null;
  nickname: string;
  avatarUrl?: string | null;
  isBot: boolean;
  mode: 'ai' | 'douyinRealtime';
}

export class GameServerClient {
  private readonly baseUrl = runtimeEnv.VITE_GAME_SERVER_URL;
  private readonly publicBaseUrl = runtimeEnv.VITE_GAME_SERVER_URL ?? '';

  get enabled() {
    return !!this.baseUrl;
  }

  async syncSession(payload: SessionPayload) {
    if (!this.baseUrl) return undefined;
    const result = await this.post<{ user: { userId: string; nickname: string; avatarUrl?: string }; state: PlayerStateRow }>('/api/session', payload);
    return result;
  }

  async joinMatch(payload: {
    userId: string;
    nickname: string;
    avatarUrl?: string;
    power: number;
    formationId: string;
    lineup: Array<{ slotId: string; playerId?: string; rating?: number }>;
  }) {
    if (!this.baseUrl) return undefined;
    return this.post<{ status: 'waiting' | 'matched'; ticketId: string; opponent?: MatchOpponent; botAfterMs?: number }>('/api/matchmaking/join', payload);
  }

  async pollMatch(ticketId: string) {
    if (!this.baseUrl) return undefined;
    return this.get<{ status: 'waiting' | 'matched' | 'expired'; ticketId?: string; opponent?: MatchOpponent }>(`/api/matchmaking/poll?ticketId=${encodeURIComponent(ticketId)}`);
  }

  async cancelMatch(ticketId: string) {
    if (!this.baseUrl) return;
    await this.post('/api/matchmaking/cancel', { ticketId });
  }

  async recordMatch(payload: {
    playerId: string;
    opponentId?: string | null;
    opponentIsBot: boolean;
    opponentName: string;
    mode: 'ai' | 'douyinRealtime';
    playerScore: number;
    opponentScore: number;
    formationId: string;
    lineup: LineupSlot[];
    opponentFormationId?: string;
    opponentLineup?: LineupSlot[];
    events: BattleEvent[];
  }) {
    if (!this.baseUrl) return undefined;
    return this.post<{ ok: true; rewards: { coins: number; scoutTickets: number; energy: number } }>('/api/matches', {
      ...payload,
      lineup: payload.lineup.map((slot) => ({
        slotId: slot.id,
        position: slot.position,
        playerId: slot.player?.id,
        rating: slot.player?.rating
      })),
      opponentLineup: payload.opponentLineup?.map((slot) => ({
        slotId: slot.id,
        position: slot.position,
        playerId: slot.player?.id,
        rating: slot.player?.rating
      }))
    });
  }

  async grantShopReward(payload: {
    userId: string;
    itemId: string;
    coins?: number;
    scoutTickets?: number;
    gems?: number;
    energy?: number;
  }) {
    if (!this.baseUrl) return undefined;
    return this.post<{ ok: true }>('/api/shop/grant', payload);
  }

  async getShopConfig() {
    const response = await fetch(`${this.publicBaseUrl}/api/shop-config`);
    return normalizeShopConfig(await this.read<ShopConfig>(response));
  }

  private async get<T>(path: string) {
    const response = await fetch(`${this.baseUrl}${path}`);
    return this.read<T>(response);
  }

  private async post<T = unknown>(path: string, body: unknown) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return this.read<T>(response);
  }

  private async read<T>(response: Response) {
    if (!response.ok) throw new Error(`Game server request failed: ${response.status}`);
    return (await response.json()) as T;
  }
}
