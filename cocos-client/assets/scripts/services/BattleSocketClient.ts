import { runtimeConfig } from '../runtime/RuntimeConfig';

export interface RealtimeRosterItem {
  slotId?: string;
  playerId?: string;
  displayName: string;
  position: string;
  rating: number;
  role: 'starter' | 'bench';
  skill?: string;
}

export interface RealtimeMatchJoinPayload {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  power: number;
  formationId: string;
  lineup: RealtimeRosterItem[];
  substitutes: RealtimeRosterItem[];
}

export interface RealtimeMatchOpponent {
  userId?: string | null;
  nickname: string;
  avatarUrl?: string | null;
  isBot?: boolean;
  mode?: 'ai' | 'douyinRealtime';
  formationId?: string;
  lineup?: RealtimeRosterItem[];
  substitutes?: RealtimeRosterItem[];
}

export interface MatchFoundPayload {
  roomId: string;
  side: 'home' | 'away';
  opponent: RealtimeMatchOpponent;
}

export interface RealtimeBattleEvent {
  minute?: number;
  eventType?: string;
  title?: string;
  actorName?: string;
  relatedActorNames?: string[];
  detail?: string;
  mood?: 'normal' | 'good' | 'bad';
  team?: 'home' | 'away';
  scoreA: number;
  scoreB: number;
}

type Handler<T> = (payload: T) => void;

export class BattleSocketClient {
  private socket?: WebSocket;
  private connectPromise?: Promise<void>;
  private readonly listeners = new Map<string, Set<Handler<unknown>>>();
  roomId?: string;
  side?: 'home' | 'away';

  get enabled(): boolean {
    return !!runtimeConfig.battleSocketUrl;
  }

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  async joinMatch(payload: RealtimeMatchJoinPayload, timeoutMs = 12000): Promise<MatchFoundPayload | undefined> {
    if (!this.enabled) return undefined;
    await this.connect();
    const matchPromise = new Promise<MatchFoundPayload>((resolve, reject) => {
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
    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        this.leave();
        reject(new Error('match_timeout'));
      }, timeoutMs);
    });
    return Promise.race([matchPromise, timeoutPromise]);
  }

  readyForBattle(): void {
    if (!this.roomId) return;
    this.send('battle_ready', { roomId: this.roomId });
  }

  leave(): void {
    this.send('leave_match', {});
    this.roomId = undefined;
    this.side = undefined;
  }

  on<T>(type: string, handler: Handler<T>): () => void {
    const bucket = this.listeners.get(type) ?? new Set<Handler<unknown>>();
    bucket.add(handler as Handler<unknown>);
    this.listeners.set(type, bucket);
    return () => bucket.delete(handler as Handler<unknown>);
  }

  off<T>(type: string, handler: Handler<T>): void {
    this.listeners.get(type)?.delete(handler as Handler<unknown>);
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
    this.connectPromise = undefined;
    this.roomId = undefined;
    this.side = undefined;
    this.listeners.clear();
  }

  private async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connectPromise) return this.connectPromise;
    const url = runtimeConfig.battleSocketUrl;
    if (!url) throw new Error('battle_socket_url_missing');

    this.connectPromise = new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
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
      socket.onmessage = (event) => this.handleMessage(String(event.data));
    });
    return this.connectPromise;
  }

  private send(type: string, payload: unknown): void {
    if (!this.connected) return;
    this.socket?.send(JSON.stringify({ type, payload }));
  }

  private handleMessage(raw: string): void {
    try {
      const message = JSON.parse(raw) as { type?: string; payload?: unknown };
      if (message.type) this.listeners.get(message.type)?.forEach((handler) => handler(message.payload));
    } catch (error) {
      console.warn('[socket] ignored malformed message', error);
    }
  }
}
