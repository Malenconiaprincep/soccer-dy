import { runtimeConfig } from '../runtime/RuntimeConfig';

type Handler<T> = (payload: T) => void;

export class BattleSocketClient {
  private socket?: WebSocket;
  private readonly listeners = new Map<string, Set<Handler<unknown>>>();

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(): Promise<void> {
    if (this.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(runtimeConfig.battleSocketUrl);
      this.socket = socket;
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error('socket_connect_failed'));
      socket.onmessage = (event) => this.handleMessage(String(event.data));
      socket.onclose = () => { this.socket = undefined; };
    });
  }

  send(type: string, payload: unknown): void {
    if (this.connected) this.socket?.send(JSON.stringify({ type, payload }));
  }

  on<T>(type: string, handler: Handler<T>): () => void {
    const bucket = this.listeners.get(type) ?? new Set<Handler<unknown>>();
    bucket.add(handler as Handler<unknown>);
    this.listeners.set(type, bucket);
    return () => bucket.delete(handler as Handler<unknown>);
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
    this.listeners.clear();
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
