import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

export type PreviewBridgeMessageType =
  | 'preview.register'
  | 'preview.command.request'
  | 'preview.command.result'
  | 'ping'
  | 'pong'
  | 'hello';

export interface PreviewBridgeMessage {
  type: PreviewBridgeMessageType;
  requestId?: string;
  command?: string;
  timeoutMs?: number;
  ok?: boolean;
  error?: PreviewBridgeErrorPayload;
  payload?: unknown;
}

export interface PreviewBridgeErrorPayload {
  code: string;
  message: string;
}

export class PreviewBridgeError extends Error {
  readonly code: string;
  readonly payload?: unknown;

  constructor(code: string, message: string, payload?: unknown) {
    super(message);
    this.name = 'PreviewBridgeError';
    this.code = code;
    this.payload = payload;
  }
}

export interface PreviewCommandOptions {
  requestId?: string;
  timeoutMs?: number;
  clientId?: string;
}

interface PendingPreviewCommand {
  requestId: string;
  clientId: string;
  timer: ReturnType<typeof setTimeout>;
  resolve: (payload: unknown) => void;
  reject: (error: PreviewBridgeError) => void;
}

interface ParsedFrame {
  fin: boolean;
  opcode: number;
  payload: Buffer;
  consumed: number;
}

interface PreviewBridgeClient {
  id: string;
  socket: Duplex;
  buffer: Buffer;
  fragmentedMessage: {
    opcode: number;
    chunks: Buffer[];
  } | null;
  alive: boolean;
  registered: boolean;
  registeredAt: number;
  lastRegisteredAt: number;
}

const DEFAULT_PREVIEW_COMMAND_TIMEOUT_MS = 30_000;
let clientIdCounter = 0;

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
    header[0] = 0x81;
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

function parseFrame(buffer: Buffer): ParsedFrame | null {
  if (buffer.length < 2) return null;

  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const fin = (firstByte & 0x80) !== 0;
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
    for (let i = 0; i < payloadLength; i += 1) {
      payload[i] = buffer[offset + 4 + i] ^ mask[i % 4];
    }
  } else {
    payload = buffer.subarray(offset, offset + payloadLength);
  }

  return { fin, opcode, payload, consumed: totalLength };
}

function createRequestId(): string {
  return `preview-command-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function sanitizeTimeoutMs(timeoutMs?: number): number {
  if (!Number.isFinite(timeoutMs) || !timeoutMs || timeoutMs <= 0) {
    return DEFAULT_PREVIEW_COMMAND_TIMEOUT_MS;
  }
  return Math.max(1, Math.min(Math.floor(timeoutMs), 120_000));
}

export class PreviewBridgeHub {
  private clients = new Map<string, PreviewBridgeClient>();
  private pendingCommands = new Map<string, PendingPreviewCommand>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients.values()) {
        if (!client.alive) {
          this.removeClient(client.id);
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
    for (const pending of this.pendingCommands.values()) {
      this.rejectPendingCommand(
        pending,
        new PreviewBridgeError('preview_bridge_destroyed', 'Preview bridge was closed before the command completed.'),
      );
    }
    this.pendingCommands.clear();
    for (const client of this.clients.values()) {
      try { client.socket.end(); } catch { /* noop */ }
    }
    this.clients.clear();
  }

  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const wsKey = req.headers['sec-websocket-key'];
    if (!wsKey) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n'
      + 'Upgrade: websocket\r\n'
      + 'Connection: Upgrade\r\n'
      + `Sec-WebSocket-Accept: ${computeAcceptKey(Array.isArray(wsKey) ? wsKey[0] || '' : wsKey)}\r\n`
      + '\r\n',
    );

    const clientId = `preview-${++clientIdCounter}`;
    const client: PreviewBridgeClient = {
      id: clientId,
      socket,
      buffer: head.length > 0 ? Buffer.from(head) : Buffer.alloc(0),
      fragmentedMessage: null,
      alive: true,
      registered: false,
      registeredAt: 0,
      lastRegisteredAt: 0,
    };

    this.clients.set(clientId, client);
    this.sendToClient(client, {
      type: 'hello',
      payload: { clientId },
    });

    socket.on('data', (chunk: Buffer) => {
      client.buffer = Buffer.concat([client.buffer, chunk]);
      this.processFrames(client);
    });
    socket.on('close', () => this.removeClient(clientId));
    socket.on('error', () => this.removeClient(clientId));
    socket.on('end', () => this.removeClient(clientId));
  }

  sendCommand(
    command: string,
    payload: unknown,
    options: PreviewCommandOptions = {},
  ): Promise<unknown> {
    const requestId = options.requestId || createRequestId();
    if (this.pendingCommands.has(requestId)) {
      return Promise.reject(new PreviewBridgeError(
        'preview_command_duplicate_request',
        `Preview command request "${requestId}" is already pending.`,
      ));
    }

    const targetClient = this.resolveTargetClient(options.clientId);
    if (!targetClient) {
      return Promise.reject(new PreviewBridgeError(
        'preview_not_connected',
        options.clientId
          ? `Requested browser preview host "${options.clientId}" is not connected.`
          : 'No browser preview host is connected.',
      ));
    }

    const timeoutMs = sanitizeTimeoutMs(options.timeoutMs);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const pending = this.pendingCommands.get(requestId);
        if (!pending) return;
        this.rejectPendingCommand(
          pending,
          new PreviewBridgeError(
            'preview_command_timeout',
            `Preview command "${command}" timed out after ${timeoutMs}ms.`,
          ),
        );
      }, timeoutMs);
      timer.unref?.();

      const pending: PendingPreviewCommand = {
        requestId,
        clientId: targetClient.id,
        timer,
        resolve,
        reject,
      };
      this.pendingCommands.set(requestId, pending);
      this.sendToClient(targetClient, {
        type: 'preview.command.request',
        requestId,
        command,
        payload,
        timeoutMs,
      });
    });
  }

  get clientCount(): number {
    return this.clients.size;
  }

  private processFrames(client: PreviewBridgeClient): void {
    while (true) {
      const frame = parseFrame(client.buffer);
      if (!frame) break;
      client.buffer = client.buffer.subarray(frame.consumed);

      switch (frame.opcode) {
        case 0x01:
          if (frame.fin) {
            client.fragmentedMessage = null;
            this.handleTextMessage(client, frame.payload.toString('utf8'));
          } else {
            client.fragmentedMessage = {
              opcode: frame.opcode,
              chunks: [frame.payload],
            };
          }
          break;
        case 0x00:
          if (!client.fragmentedMessage) {
            break;
          }
          client.fragmentedMessage.chunks.push(frame.payload);
          if (frame.fin) {
            const fragmentedMessage = client.fragmentedMessage;
            client.fragmentedMessage = null;
            if (fragmentedMessage.opcode === 0x01) {
              this.handleTextMessage(client, Buffer.concat(fragmentedMessage.chunks).toString('utf8'));
            }
          }
          break;
        case 0x08:
          this.removeClient(client.id);
          return;
        case 0x09:
          client.alive = true;
          this.sendRawFrame(client, 0x0a, frame.payload);
          break;
        case 0x0a:
          client.alive = true;
          break;
      }
    }
  }

  private handleTextMessage(client: PreviewBridgeClient, text: string): void {
    client.alive = true;
    let msg: PreviewBridgeMessage;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'preview.register':
        client.registered = true;
        const now = Date.now();
        client.registeredAt ||= now;
        client.lastRegisteredAt = now;
        break;
      case 'preview.command.result':
        this.resolveCommandResult(client, msg);
        break;
      case 'ping':
        this.sendToClient(client, { type: 'pong' });
        break;
      case 'pong':
        client.alive = true;
        break;
    }
  }

  private resolveCommandResult(client: PreviewBridgeClient, msg: PreviewBridgeMessage): void {
    const requestId = String(msg.requestId || '');
    const pending = requestId ? this.pendingCommands.get(requestId) : null;
    if (!pending || pending.clientId !== client.id) {
      return;
    }
    this.pendingCommands.delete(requestId);
    clearTimeout(pending.timer);
    if (msg.ok === false) {
      pending.reject(new PreviewBridgeError(
        msg.error?.code || 'preview_command_failed',
        msg.error?.message || 'Preview command failed.',
      ));
      return;
    }
    pending.resolve(msg.payload);
  }

  private resolveTargetClient(clientId?: string): PreviewBridgeClient | null {
    const normalizedClientId = String(clientId || '').trim();
    if (normalizedClientId) {
      const client = this.clients.get(normalizedClientId);
      return client?.registered ? client : null;
    }
    const registeredClients = [...this.clients.values()].filter((client) => client.registered);
    if (registeredClients.length === 0) {
      return null;
    }
    registeredClients.sort((left, right) => (
      right.lastRegisteredAt - left.lastRegisteredAt
      || Number(right.id.replace(/\D+/gu, '')) - Number(left.id.replace(/\D+/gu, ''))
    ));
    return registeredClients[0] || null;
  }

  private rejectPendingCommand(pending: PendingPreviewCommand, error: PreviewBridgeError): void {
    this.pendingCommands.delete(pending.requestId);
    clearTimeout(pending.timer);
    pending.reject(error);
  }

  private removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    this.clients.delete(clientId);
    for (const pending of [...this.pendingCommands.values()]) {
      if (pending.clientId === clientId) {
        this.rejectPendingCommand(
          pending,
          new PreviewBridgeError('preview_disconnected', 'Preview host disconnected before the command completed.'),
        );
      }
    }
    try { client.socket.end(); } catch { /* noop */ }
  }

  private sendToClient(client: PreviewBridgeClient, msg: PreviewBridgeMessage): void {
    try {
      client.socket.write(encodeFrame(JSON.stringify(msg)));
    } catch {
      this.removeClient(client.id);
    }
  }

  private sendRawFrame(client: PreviewBridgeClient, opcode: number, payload: Buffer): void {
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
      this.removeClient(client.id);
    }
  }
}

let hubInstance: PreviewBridgeHub | null = null;

export function getPreviewBridgeHub(): PreviewBridgeHub {
  if (!hubInstance) {
    hubInstance = new PreviewBridgeHub();
  }
  return hubInstance;
}

export const PREVIEW_BRIDGE_WS_PATH = '/ws/preview-bridge';

export function isPreviewBridgeUpgrade(req: IncomingMessage): boolean {
  const pathname = (req.url || '/').split('?')[0];
  return pathname === PREVIEW_BRIDGE_WS_PATH;
}
