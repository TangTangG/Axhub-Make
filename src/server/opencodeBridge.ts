/**
 * OpenCode Bridge — WebSocket relay for Make Admin UI ↔ OpenCode WebUI context injection.
 *
 * Two client roles:
 *   - "admin"   — the Make Admin UI sidebar (sends context add/update/remove)
 *   - "opencode" — axhub-hug.js inside the OpenCode WebUI (receives context and injects into prompt)
 *
 * Messages are JSON frames over WebSocket.
 */
import { createHash } from 'node:crypto';
import type { Duplex } from 'node:stream';
import type { IncomingMessage } from 'node:http';

// ---------------------------------------------------------------------------
// Protocol types
// ---------------------------------------------------------------------------

export interface BridgeContextSelection {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

export interface BridgeContextItem {
  id: string;
  type: 'file';
  path: string;
  selection?: BridgeContextSelection;
  comment?: string;
  commentID?: string;
  commentOrigin?: 'file' | 'review';
  preview?: string;
}

export type BridgeMessageType =
  | 'context:add'
  | 'context:update'
  | 'context:remove'
  | 'context:clear'
  | 'context:sync'
  | 'ping'
  | 'pong'
  | 'status'
  | 'hello';

export interface BridgeMessage {
  type: BridgeMessageType;
  payload?: unknown;
}

export type BridgeClientRole = 'admin' | 'opencode';

// ---------------------------------------------------------------------------
// Minimal WebSocket framing helpers (RFC 6455)
// ---------------------------------------------------------------------------

function computeAcceptKey(key: string): string {
  return createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
}

function encodeFrame(data: string): Buffer {
  const payload = Buffer.from(data, 'utf8');
  const len = payload.length;
  let header: Buffer;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text opcode
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payload]);
}

interface ParsedFrame {
  opcode: number;
  payload: Buffer;
  consumed: number;
}

function parseFrame(buffer: Buffer): ParsedFrame | null {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const opcode = firstByte & 0x0f;
  const masked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    if (buffer.length < 4) return null;
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null;
    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  const maskSize = masked ? 4 : 0;
  const totalLength = offset + maskSize + payloadLength;
  if (buffer.length < totalLength) return null;

  let payload: Buffer;
  if (masked) {
    const mask = buffer.subarray(offset, offset + 4);
    payload = Buffer.alloc(payloadLength);
    for (let i = 0; i < payloadLength; i++) {
      payload[i] = buffer[offset + 4 + i] ^ mask[i % 4];
    }
  } else {
    payload = buffer.subarray(offset, offset + payloadLength);
  }

  return { opcode, payload, consumed: totalLength };
}

// ---------------------------------------------------------------------------
// Bridge client wrapper
// ---------------------------------------------------------------------------

interface BridgeClient {
  id: string;
  role: BridgeClientRole;
  socket: Duplex;
  buffer: Buffer;
  alive: boolean;
}

let clientIdCounter = 0;

// ---------------------------------------------------------------------------
// OpenCodeBridgeHub — singleton relay
// ---------------------------------------------------------------------------

export class OpenCodeBridgeHub {
  private clients = new Map<string, BridgeClient>();
  private contexts = new Map<string, BridgeContextItem>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingBatch: BridgeMessage[] = [];

  constructor() {
    this.startHeartbeat();
  }

  // ---- Lifecycle -----------------------------------------------------------

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients.values()) {
        if (!client.alive) {
          this.removeClient(client.id, 'heartbeat timeout');
          continue;
        }
        client.alive = false;
        this.sendToClient(client, { type: 'ping' });
      }
    }, 30_000);
    this.heartbeatTimer.unref?.();
  }

  destroy(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.batchTimer) clearTimeout(this.batchTimer);
    for (const client of this.clients.values()) {
      try { client.socket.end(); } catch { /* noop */ }
    }
    this.clients.clear();
  }

  // ---- Client management ---------------------------------------------------

  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const role = (url.searchParams.get('role') || 'admin') as BridgeClientRole;
    if (role !== 'admin' && role !== 'opencode') {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }

    const wsKey = req.headers['sec-websocket-key'];
    if (!wsKey) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }

    const acceptKey = computeAcceptKey(wsKey);
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
      '\r\n',
    );

    const clientId = `bridge-${++clientIdCounter}`;
    const client: BridgeClient = {
      id: clientId,
      role,
      socket,
      buffer: head.length > 0 ? Buffer.from(head) : Buffer.alloc(0),
      alive: true,
    };

    this.clients.set(clientId, client);

    // Send hello + full context sync
    this.sendToClient(client, {
      type: 'hello',
      payload: { clientId, role },
    });
    this.sendToClient(client, {
      type: 'context:sync',
      payload: Array.from(this.contexts.values()),
    });
    this.broadcastStatus();

    // Wire up socket events
    socket.on('data', (chunk: Buffer) => {
      client.buffer = Buffer.concat([client.buffer, chunk]);
      this.processFrames(client);
    });

    socket.on('close', () => this.removeClient(clientId, 'close'));
    socket.on('error', () => this.removeClient(clientId, 'error'));
    socket.on('end', () => this.removeClient(clientId, 'end'));
  }

  private removeClient(clientId: string, _reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    this.clients.delete(clientId);
    try { client.socket.end(); } catch { /* noop */ }
    this.broadcastStatus();
  }

  // ---- Frame processing ----------------------------------------------------

  private processFrames(client: BridgeClient): void {
    while (true) {
      const frame = parseFrame(client.buffer);
      if (!frame) break;
      client.buffer = client.buffer.subarray(frame.consumed);

      switch (frame.opcode) {
        case 0x01: // text
          this.handleTextMessage(client, frame.payload.toString('utf8'));
          break;
        case 0x08: // close
          this.removeClient(client.id, 'ws-close');
          return;
        case 0x09: // ping
          client.alive = true;
          this.sendRawFrame(client, 0x0a, frame.payload); // pong
          break;
        case 0x0a: // pong
          client.alive = true;
          break;
      }
    }
  }

  private handleTextMessage(client: BridgeClient, text: string): void {
    client.alive = true;
    let msg: BridgeMessage;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'pong':
        client.alive = true;
        break;

      case 'ping':
        this.sendToClient(client, { type: 'pong' });
        break;

      case 'context:add':
      case 'context:update':
        if (msg.payload && typeof msg.payload === 'object' && 'id' in (msg.payload as any)) {
          const item = msg.payload as BridgeContextItem;
          this.contexts.set(item.id, item);
          this.enqueueBroadcast({ type: msg.type, payload: item });
        }
        break;

      case 'context:remove':
        if (msg.payload && typeof msg.payload === 'object' && 'id' in (msg.payload as any)) {
          const removeId = (msg.payload as { id: string }).id;
          this.contexts.delete(removeId);
          this.enqueueBroadcast({ type: 'context:remove', payload: { id: removeId } });
        }
        break;

      case 'context:clear':
        this.contexts.clear();
        this.broadcastImmediate({ type: 'context:clear' });
        break;

      case 'context:sync':
        // Client requesting full sync
        this.sendToClient(client, {
          type: 'context:sync',
          payload: Array.from(this.contexts.values()),
        });
        break;

      case 'status':
        this.sendToClient(client, this.buildStatusMessage());
        break;
    }
  }

  // ---- Broadcasting --------------------------------------------------------

  private enqueueBroadcast(msg: BridgeMessage): void {
    this.pendingBatch.push(msg);

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, 100); // 100ms batching window — fast enough to feel realtime
    }
  }

  private flushBatch(): void {
    this.batchTimer = null;
    const batch = this.pendingBatch;
    this.pendingBatch = [];

    for (const msg of batch) {
      this.broadcastImmediate(msg);
    }
  }

  private broadcastImmediate(msg: BridgeMessage): void {
    const frame = encodeFrame(JSON.stringify(msg));
    for (const client of this.clients.values()) {
      try {
        client.socket.write(frame);
      } catch {
        this.removeClient(client.id, 'write-error');
      }
    }
  }

  private broadcastStatus(): void {
    this.broadcastImmediate(this.buildStatusMessage());
  }

  private buildStatusMessage(): BridgeMessage {
    let adminCount = 0;
    let opencodeCount = 0;
    for (const client of this.clients.values()) {
      if (client.role === 'admin') adminCount++;
      else if (client.role === 'opencode') opencodeCount++;
    }
    return {
      type: 'status',
      payload: { clients: { admin: adminCount, opencode: opencodeCount } },
    };
  }

  // ---- Low-level send helpers ----------------------------------------------

  private sendToClient(client: BridgeClient, msg: BridgeMessage): void {
    try {
      client.socket.write(encodeFrame(JSON.stringify(msg)));
    } catch {
      this.removeClient(client.id, 'send-error');
    }
  }

  private sendRawFrame(client: BridgeClient, opcode: number, payload: Buffer): void {
    const len = payload.length;
    let header: Buffer;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x80 | opcode;
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    try {
      client.socket.write(Buffer.concat([header, payload]));
    } catch {
      this.removeClient(client.id, 'raw-send-error');
    }
  }

  // ---- Public state queries ------------------------------------------------

  get clientCount(): number {
    return this.clients.size;
  }

  getStatus(): { admin: number; opencode: number } {
    let admin = 0;
    let opencode = 0;
    for (const client of this.clients.values()) {
      if (client.role === 'admin') admin++;
      else opencode++;
    }
    return { admin, opencode };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let hubInstance: OpenCodeBridgeHub | null = null;

export function getOpenCodeBridgeHub(): OpenCodeBridgeHub {
  if (!hubInstance) {
    hubInstance = new OpenCodeBridgeHub();
  }
  return hubInstance;
}

// ---------------------------------------------------------------------------
// Route matching
// ---------------------------------------------------------------------------

export const OPENCODE_BRIDGE_WS_PATH = '/api/opencode-bridge/ws';

export function isOpenCodeBridgeUpgrade(req: IncomingMessage): boolean {
  const pathname = (req.url || '/').split('?')[0];
  return pathname === OPENCODE_BRIDGE_WS_PATH;
}
