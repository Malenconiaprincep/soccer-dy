import type { BattleEvent, LineupSlot } from '../domain/types';
import type { OpponentState } from '../domain/GameState';
import { runtimeConfig } from '../runtime/RuntimeConfig';

interface JoinResult {
  status: 'waiting' | 'matched';
  ticketId: string;
  opponent?: OpponentState;
}

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

export class GameServerClient {
  constructor(private readonly baseUrl = runtimeConfig.gameServerUrl.replace(/\/$/, '')) {}

  get enabled(): boolean {
    return !!this.baseUrl;
  }

  async syncSession(payload: SessionPayload) {
    if (!this.baseUrl) return undefined;
    return this.post<{
      user: { userId: string; nickname: string; avatarUrl?: string };
      state: PlayerStateRow;
    }>('/api/session', payload);
  }

  async joinMatch(payload: {
    userId: string;
    nickname: string;
    power: number;
    formationId: string;
    lineup: LineupSlot[];
    botAfterMs?: number;
  }): Promise<JoinResult | undefined> {
    if (!this.baseUrl) return undefined;
    return this.post('/api/matchmaking/join', {
      userId: payload.userId,
      nickname: payload.nickname,
      power: payload.power,
      formationId: payload.formationId,
      ...(payload.botAfterMs != null ? { botAfterMs: payload.botAfterMs } : {}),
      lineup: payload.lineup.map((slot) => ({
        slotId: slot.id,
        playerId: slot.player?.id,
        rating: slot.player?.rating
      }))
    });
  }

  async pollMatch(ticketId: string): Promise<{ status: 'waiting' | 'matched' | 'expired'; ticketId?: string; opponent?: OpponentState } | undefined> {
    if (!this.baseUrl) return undefined;
    return this.get(`/api/matchmaking/poll?ticketId=${encodeURIComponent(ticketId)}`);
  }

  async cancelMatch(ticketId: string): Promise<void> {
    if (this.baseUrl) await this.post('/api/matchmaking/cancel', { ticketId });
  }

  async recordMatch(payload: {
    playerId: string;
    opponent: OpponentState;
    playerScore: number;
    opponentScore: number;
    formationId: string;
    lineup: LineupSlot[];
    events: BattleEvent[];
  }): Promise<void> {
    if (!this.baseUrl) return;
    await this.post('/api/matches', {
      playerId: payload.playerId,
      opponentId: payload.opponent.userId,
      opponentIsBot: payload.opponent.isBot,
      opponentName: payload.opponent.nickname,
      mode: payload.opponent.mode,
      playerScore: payload.playerScore,
      opponentScore: payload.opponentScore,
      formationId: payload.formationId,
      lineup: payload.lineup,
      events: payload.events
    });
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`);
    return this.read(response);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return this.read(response);
  }

  private async read<T>(response: Response): Promise<T> {
    if (!response.ok) throw new Error(`Game server request failed: ${response.status}`);
    return response.json() as Promise<T>;
  }
}
