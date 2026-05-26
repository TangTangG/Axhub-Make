declare module 'ws' {
  import type { IncomingMessage } from 'node:http';

  export type RawData = Buffer | ArrayBuffer | Buffer[];

  export class WebSocket {
    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSING: number;
    static readonly CLOSED: number;

    readonly readyState: number;

    constructor(address: string);

    send(data: string): void;
    close(): void;
    on(event: 'message', listener: (data: RawData) => void): this;
    on(event: 'close' | 'error' | 'open', listener: (...args: any[]) => void): this;
    once(event: 'message', listener: (data: RawData) => void): this;
    once(event: 'close' | 'error' | 'open', listener: (...args: any[]) => void): this;
    off(event: 'message', listener: (data: RawData) => void): this;
    off(event: 'close' | 'error' | 'open', listener: (...args: any[]) => void): this;
  }

  export class WebSocketServer {
    constructor(options: { noServer: true });

    on(event: 'connection', listener: (ws: WebSocket, req: IncomingMessage) => void): this;
    emit(event: 'connection', ws: WebSocket, req: IncomingMessage): boolean;
    handleUpgrade(
      req: IncomingMessage,
      socket: unknown,
      head: Buffer,
      callback: (ws: WebSocket) => void,
    ): void;
    close(): void;
  }
}
