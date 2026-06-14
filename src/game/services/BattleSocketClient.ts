import type { GeneratedBattleMoment, MatchOpponent } from './GameServerClient';

const runtimeEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

type SocketMessage =
  | { type: 'connected'; payload: { clientId: string } }
  | { type: 'match_waiting'; payload: { ticketId: string } }
  | { type: 'match_found'; payload: MatchFoundPayload }
  | { type: 'battle_start'; payload: { roomId: string } }
  | { type: 'battle_event'; payload: RealtimeBattleEvent }
  | { type: 'battle_done'; payload: unknown }
  | { type: 'battle_error'; payload: { message?: string } }
  | { type: 'opponent_left'; payload: unknown }
  | { type: 'error'; payload: { message?: string } };

export interface RealtimeMatchJoinPayload {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  power: number;
  formationId: string;
  lineup: RealtimeRosterItem[];
  substitutes: RealtimeRosterItem[];
}

export interface RealtimeRosterItem {
  slotId?: string;
  playerId?: string;
  displayName: string;
  position: string;
  rating: number;
  role: 'starter' | 'bench';
  skill?: string;
}

export interface MatchFoundPayload {
  roomId: string;
  side: 'home' | 'away';
  opponent: MatchOpponent & {
    formationId?: string;
    lineup?: RealtimeRosterItem[];
    substitutes?: RealtimeRosterItem[];
  };
}

export interface RealtimeBattleEvent extends GeneratedBattleMoment {
  scoreA: number;
  scoreB: number;
}

type Handler<T> = (payload: T) => void;

export class BattleSocketClient {
  private socket?: WebSocket;
  private connectPromise?: Promise<void>;
  private listeners = new Map<string, Set<Handler<any>>>();
  roomId?: string;
  side?: 'home' | 'away';

  private readonly url = runtimeEnv.VITE_BATTLE_SOCKET_URL;

  get enabled() {
    return !!this.url;
  }

  async joinMatch(payload: RealtimeMatchJoinPayload) {
    if (!this.url) return undefined;
    await this.connect();
    return new Promise<MatchFoundPayload>((resolve, reject) => {
      const cleanup = () => {
        this.off('match_found', onFound);
        this.off('error', onError);
        this.off('opponent_left', onLeft);
      };
      const onFound = (match: MatchFoundPayload) => {
        cleanup();
        this.roomId = match.roomId;
        this.side = match.side;
        resolve(match);
      };
      const onError = (error: { message?: string }) => {
        cleanup();
        reject(new Error(error.message ?? 'socket_error'));
      };
      const onLeft = () => {
        cleanup();
        reject(new Error('opponent_left'));
      };
      this.on('match_found', onFound);
      this.on('error', onError);
      this.on('opponent_left', onLeft);
      this.send('join_match', payload);
    });
  }

  readyForBattle() {
    if (!this.roomId) return;
    this.send('battle_ready', { roomId: this.roomId });
  }

  leave() {
    this.send('leave_match', {});
    this.roomId = undefined;
    this.side = undefined;
  }

  on<T>(type: string, handler: Handler<T>) {
    const bucket = this.listeners.get(type) ?? new Set<Handler<any>>();
    bucket.add(handler);
    this.listeners.set(type, bucket);
  }

  off<T>(type: string, handler: Handler<T>) {
    this.listeners.get(type)?.delete(handler as Handler<any>);
  }

  private async connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    if (this.connectPromise) return this.connectPromise;
    if (!this.url) throw new Error('VITE_BATTLE_SOCKET_URL is missing.');

    this.connectPromise = new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url!);
      this.socket = socket;
      socket.onopen = () => {
        this.connectPromise = undefined;
        resolve();
      };
      socket.onerror = () => {
        this.connectPromise = undefined;
        reject(new Error('socket_connect_failed'));
      };
      socket.onclose = () => {
        this.connectPromise = undefined;
        this.socket = undefined;
        this.roomId = undefined;
        this.side = undefined;
      };
      socket.onmessage = (event) => this.handleMessage(event.data);
    });
    return this.connectPromise;
  }

  private send(type: string, payload: unknown) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type, payload }));
  }

  private handleMessage(raw: unknown) {
    let message: SocketMessage;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    this.listeners.get(message.type)?.forEach((handler) => handler(message.payload));
  }
}
