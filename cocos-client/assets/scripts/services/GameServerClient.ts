import type { BattleEvent, LineupSlot } from '../domain/types';
import type { OpponentState } from '../domain/GameState';
import { runtimeConfig } from '../runtime/RuntimeConfig';

interface JoinResult {
  status: 'waiting' | 'matched';
  ticketId: string;
  opponent?: OpponentState;
}

export class GameServerClient {
  constructor(private readonly baseUrl = runtimeConfig.gameServerUrl.replace(/\/$/, '')) {}

  async joinMatch(payload: {
    userId: string;
    nickname: string;
    power: number;
    formationId: string;
    lineup: LineupSlot[];
  }): Promise<JoinResult | undefined> {
    if (!this.baseUrl) return undefined;
    return this.post('/api/matchmaking/join', {
      ...payload,
      botAfterMs: runtimeConfig.matchmakingBotAfterMs,
      lineup: payload.lineup.map((slot) => ({
        slotId: slot.id,
        playerId: slot.player?.id,
        rating: slot.player?.rating
      }))
    });
  }

  async pollMatch(ticketId: string): Promise<(JoinResult & { status: 'waiting' | 'matched' | 'expired' }) | undefined> {
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
