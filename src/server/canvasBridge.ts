/**
 * Canvas Bridge — WebSocket channel for CLI/AI ↔ Browser canvas collaboration.
 *
 * Browser clients connect when a canvas is open, registering which canvas they
 * are viewing. The server can then relay commands (screenshot, refresh) to the
 * appropriate browser tab and return results to HTTP callers.
 *
 * Protocol messages are JSON frames over a minimal RFC 6455 WebSocket
 * implementation (same approach as opencodeBridge — no external dependencies).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Duplex } from 'node:stream';
import type { IncomingMessage } from 'node:http';

import { isPathInside } from './projectCore/index.ts';

// ---------------------------------------------------------------------------
// Protocol types
// ---------------------------------------------------------------------------

export type CanvasBridgeMessageType =
  | 'canvas.register'
  | 'canvas.reload'
  | 'canvas.screenshot.request'
  | 'canvas.screenshot.response'
  | 'canvas.status'
  | 'ping'
  | 'pong'
  | 'hello';

export interface CanvasBridgeMessage {
  type: CanvasBridgeMessageType;
  requestId?: string;
  canvas?: string;
  canvasFilePath?: string;
  dirty?: boolean;
  dataUrl?: string;
  error?: string;
  payload?: unknown;
}

// ---------------------------------------------------------------------------
// Minimal WebSocket framing helpers (RFC 6455) — same as opencodeBridge
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
// Bridge client
// ---------------------------------------------------------------------------

interface CanvasBridgeClient {
  id: string;
  socket: Duplex;
  buffer: Buffer;
  alive: boolean;
  /** Which canvas this client is viewing (set by canvas.register) */
  canvasName: string;
  rawCanvasName: string;
  canvasFilePath: string | null;
  dirty: boolean;
}

let clientIdCounter = 0;

// ---------------------------------------------------------------------------
// Pending screenshot request
// ---------------------------------------------------------------------------

interface PendingScreenshotRequest {
  requestId: string;
  resolve: (dataUrl: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// CanvasBridgeHub — singleton
// ---------------------------------------------------------------------------

const SCREENSHOT_TIMEOUT_MS = 15_000;
const DEFAULT_REFRESH_QUIET_MS = 2_000;
const DEFAULT_REFRESH_MAX_WAIT_MS = 8_000;
const DEFAULT_SUPPRESS_TTL_MS = 12_000;

interface ResolvedPrototypeCanvas {
  canvasName: string;
  filePath: string;
}

interface PendingFileRefresh {
  firstEventAt: number;
  lastEventAt: number;
  lastSeenHash: string | null;
  timer: ReturnType<typeof setTimeout> | null;
}

interface CanvasFileWatcher {
  canvasName: string;
  filePath: string;
  watcher: fs.FSWatcher;
  clients: Set<string>;
  dirtyClients: Set<string>;
  lastProcessedHash: string | null;
  deferredRefreshHash: string | null;
  pending: PendingFileRefresh | null;
}

export interface CanvasBridgeHubOptions {
  projectRoot?: string;
  refreshQuietMs?: number;
  refreshMaxWaitMs?: number;
  suppressTtlMs?: number;
  onExternalCanvasRefresh?: (canvasName: string, filePath: string) => void;
}

export interface CanvasSaveRecordOptions {
  sourceClientId?: string | null;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function readCanvasFileSnapshot(filePath: string): { content: string; hash: string } | null {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return { content, hash: hashContent(content) };
  } catch {
    return null;
  }
}

function isJsonParseable(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

function normalizePrototypeCanvasName(canvasName: string): string | null {
  const normalized = String(canvasName || '')
    .trim()
    .replace(/\\/gu, '/')
    .replace(/^\/+/u, '')
    .replace(/^src\//u, '');
  const match = normalized.match(/^prototypes\/([^/]+)\/canvas(?:\.excalidraw)?$/iu);
  if (!match?.[1]) {
    return null;
  }
  const prototypeId = match[1];
  if (
    prototypeId === '.'
    || prototypeId === '..'
    || prototypeId.includes('/')
    || prototypeId.includes('\\')
  ) {
    return null;
  }
  return `prototypes/${prototypeId}/canvas`;
}

function normalizeClientCanvasName(canvasName: string): string {
  return normalizePrototypeCanvasName(canvasName) || String(canvasName || '').trim();
}

export class CanvasBridgeHub {
  private clients = new Map<string, CanvasBridgeClient>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pendingScreenshots = new Map<string, PendingScreenshotRequest>();
  private projectRoot = '';
  private fileWatchers = new Map<string, CanvasFileWatcher>();
  private clientWatcherFiles = new Map<string, string>();
  private suppressHashes = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();
  private refreshQuietMs: number;
  private refreshMaxWaitMs: number;
  private suppressTtlMs: number;
  private onExternalCanvasRefresh?: (canvasName: string, filePath: string) => void;

  constructor(options: CanvasBridgeHubOptions = {}) {
    this.refreshQuietMs = options.refreshQuietMs ?? DEFAULT_REFRESH_QUIET_MS;
    this.refreshMaxWaitMs = options.refreshMaxWaitMs ?? DEFAULT_REFRESH_MAX_WAIT_MS;
    this.suppressTtlMs = options.suppressTtlMs ?? DEFAULT_SUPPRESS_TTL_MS;
    this.onExternalCanvasRefresh = options.onExternalCanvasRefresh;
    if (options.projectRoot) {
      this.configureProjectRoot(options.projectRoot);
    }
    this.startHeartbeat();
  }

  // ---- Lifecycle -----------------------------------------------------------

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
    for (const client of this.clients.values()) {
      try { client.socket.end(); } catch { /* noop */ }
    }
    this.clients.clear();
    this.clientWatcherFiles.clear();
    for (const watcher of this.fileWatchers.values()) {
      this.closeFileWatcher(watcher);
    }
    this.fileWatchers.clear();
    for (const hashes of this.suppressHashes.values()) {
      for (const timer of hashes.values()) {
        clearTimeout(timer);
      }
    }
    this.suppressHashes.clear();
    for (const pending of this.pendingScreenshots.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Bridge destroyed'));
    }
    this.pendingScreenshots.clear();
  }

  // ---- Client management ---------------------------------------------------

  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
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

    const clientId = `canvas-${++clientIdCounter}`;
    const client: CanvasBridgeClient = {
      id: clientId,
      socket,
      buffer: head.length > 0 ? Buffer.from(head) : Buffer.alloc(0),
      alive: true,
      canvasName: '',
      rawCanvasName: '',
      canvasFilePath: null,
      dirty: false,
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

  private removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    this.clients.delete(clientId);
    this.detachClientFromFileWatcher(client);
    try { client.socket.end(); } catch { /* noop */ }
  }

  // ---- Frame processing ----------------------------------------------------

  private processFrames(client: CanvasBridgeClient): void {
    while (true) {
      const frame = parseFrame(client.buffer);
      if (!frame) break;
      client.buffer = client.buffer.subarray(frame.consumed);

      switch (frame.opcode) {
        case 0x01: // text
          this.handleTextMessage(client, frame.payload.toString('utf8'));
          break;
        case 0x08: // close
          this.removeClient(client.id);
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

  private handleTextMessage(client: CanvasBridgeClient, text: string): void {
    client.alive = true;
    let msg: CanvasBridgeMessage;
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

      case 'canvas.register':
        if (msg.canvas && typeof msg.canvas === 'string') {
          this.registerClientCanvas(client, msg);
        }
        break;

      case 'canvas.status':
        this.updateClientCanvasStatus(client, msg);
        break;

      case 'canvas.screenshot.response':
        if (msg.requestId) {
          const pending = this.pendingScreenshots.get(msg.requestId);
          if (pending) {
            this.pendingScreenshots.delete(msg.requestId);
            clearTimeout(pending.timer);
            if (msg.error) {
              pending.reject(new Error(msg.error));
            } else if (msg.dataUrl) {
              pending.resolve(msg.dataUrl);
            } else {
              pending.reject(new Error('Empty screenshot response'));
            }
          }
        }
        break;
    }
  }

  // ---- Public API for HTTP endpoints ---------------------------------------

  configureProjectRoot(projectRoot: string): void {
    const nextProjectRoot = path.resolve(projectRoot);
    if (this.projectRoot === nextProjectRoot) {
      return;
    }
    for (const watcher of this.fileWatchers.values()) {
      this.closeFileWatcher(watcher);
    }
    this.fileWatchers.clear();
    this.clientWatcherFiles.clear();
    this.projectRoot = nextProjectRoot;
  }

  /** Get list of currently connected canvas names. */
  getConnectedCanvases(): { clientId: string; canvas: string; canvasFilePath: string | null; dirty: boolean }[] {
    const result: { clientId: string; canvas: string; canvasFilePath: string | null; dirty: boolean }[] = [];
    for (const client of this.clients.values()) {
      if (client.canvasName) {
        result.push({
          clientId: client.id,
          canvas: client.canvasName,
          canvasFilePath: client.canvasFilePath,
          dirty: client.dirty,
        });
      }
    }
    return result;
  }

  getActiveCanvasWatchers(): Array<{
    canvas: string;
    filePath: string;
    refCount: number;
    dirtyClientCount: number;
  }> {
    return [...this.fileWatchers.values()]
      .map((watcher) => ({
        canvas: watcher.canvasName,
        filePath: watcher.filePath,
        refCount: watcher.clients.size,
        dirtyClientCount: watcher.dirtyClients.size,
      }))
      .sort((a, b) => a.filePath.localeCompare(b.filePath));
  }

  recordCanvasSave(filePath: string, content: string, options: CanvasSaveRecordOptions = {}): void {
    const resolvedPath = path.resolve(filePath);
    const hash = hashContent(content);
    let hashes = this.suppressHashes.get(resolvedPath);
    if (!hashes) {
      hashes = new Map();
      this.suppressHashes.set(resolvedPath, hashes);
    }
    const existingTimer = hashes.get(hash);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    const timer = setTimeout(() => {
      const currentHashes = this.suppressHashes.get(resolvedPath);
      currentHashes?.delete(hash);
      if (currentHashes?.size === 0) {
        this.suppressHashes.delete(resolvedPath);
      }
    }, this.suppressTtlMs);
    timer.unref?.();
    hashes.set(hash, timer);

    const watcher = this.fileWatchers.get(resolvedPath);
    if (watcher) {
      watcher.lastProcessedHash = hash;
      watcher.deferredRefreshHash = null;
      if (watcher.pending?.timer) {
        clearTimeout(watcher.pending.timer);
        watcher.pending.timer = null;
      }
      watcher.pending = null;
      this.requestRefresh(watcher.canvasName, { excludeClientId: options.sourceClientId || undefined });
    }
  }

  /** Find connected clients for a given canvas name (or any canvas if null). */
  private findClients(canvasName?: string): CanvasBridgeClient[] {
    const normalizedCanvasName = canvasName ? normalizeClientCanvasName(canvasName) : '';
    const result: CanvasBridgeClient[] = [];
    for (const client of this.clients.values()) {
      if (!client.canvasName) continue;
      if (!normalizedCanvasName || client.canvasName === normalizedCanvasName) {
        result.push(client);
      }
    }
    return result;
  }

  /** Find the first connected client for a given canvas name (or any canvas if null). */
  private findClient(canvasName?: string): CanvasBridgeClient | null {
    return this.findClients(canvasName)[0] || null;
  }

  /** Request the browser to reload the canvas from disk. */
  requestRefresh(canvasName?: string, options: { excludeClientId?: string } = {}): boolean {
    const clients = this.findClients(canvasName);
    const targetClients = options.excludeClientId
      ? clients.filter((client) => client.id !== options.excludeClientId)
      : clients;
    if (targetClients.length === 0) return false;
    for (const client of targetClients) {
      this.sendToClient(client, { type: 'canvas.reload' });
    }
    return true;
  }

  /** Request a screenshot from the browser. Returns PNG data URL. */
  requestScreenshot(canvasName?: string): Promise<string> {
    const client = this.findClient(canvasName);
    if (!client) {
      return Promise.reject(new Error('No canvas browser connected'));
    }

    const requestId = `ss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingScreenshots.delete(requestId);
        reject(new Error('Screenshot request timed out'));
      }, SCREENSHOT_TIMEOUT_MS);

      this.pendingScreenshots.set(requestId, { requestId, resolve, reject, timer });
      this.sendToClient(client, {
        type: 'canvas.screenshot.request',
        requestId,
      });
    });
  }

  get clientCount(): number {
    return this.clients.size;
  }

  // ---- Canvas watcher helpers ---------------------------------------------

  private resolvePrototypeCanvasFile(canvasName: string): ResolvedPrototypeCanvas | null {
    if (!this.projectRoot) {
      return null;
    }
    const normalizedCanvasName = normalizePrototypeCanvasName(canvasName);
    if (!normalizedCanvasName) {
      return null;
    }
    const match = normalizedCanvasName.match(/^prototypes\/([^/]+)\/canvas$/u);
    const prototypeId = match?.[1];
    if (!prototypeId) {
      return null;
    }
    const prototypesDir = path.resolve(this.projectRoot, 'src', 'prototypes');
    const prototypeDir = path.resolve(prototypesDir, prototypeId);
    const filePath = path.resolve(prototypeDir, 'canvas.excalidraw');
    if (
      !isPathInside(this.projectRoot, filePath)
      || !isPathInside(prototypesDir, prototypeDir)
      || !isPathInside(prototypeDir, filePath)
      || !fs.existsSync(filePath)
    ) {
      return null;
    }
    return { canvasName: normalizedCanvasName, filePath };
  }

  private registerClientCanvas(client: CanvasBridgeClient, msg: CanvasBridgeMessage): void {
    const rawCanvasName = String(msg.canvas || '').trim();
    const resolved = this.resolvePrototypeCanvasFile(rawCanvasName);

    this.detachClientFromFileWatcher(client);

    client.rawCanvasName = rawCanvasName;
    client.canvasName = resolved?.canvasName || normalizeClientCanvasName(rawCanvasName);
    client.canvasFilePath = resolved?.filePath || null;
    client.dirty = msg.dirty === true;

    if (resolved) {
      this.attachClientToFileWatcher(client, resolved);
    }
  }

  private updateClientCanvasStatus(client: CanvasBridgeClient, msg: CanvasBridgeMessage): void {
    if (typeof msg.dirty !== 'boolean') {
      return;
    }
    const nextDirty = msg.dirty === true;
    client.dirty = nextDirty;
    const filePath = this.clientWatcherFiles.get(client.id);
    if (!filePath) {
      return;
    }
    const watcher = this.fileWatchers.get(filePath);
    if (!watcher) {
      return;
    }
    if (nextDirty) {
      watcher.dirtyClients.add(client.id);
    } else {
      watcher.dirtyClients.delete(client.id);
      if (watcher.dirtyClients.size === 0 && watcher.deferredRefreshHash) {
        watcher.deferredRefreshHash = null;
        if (this.onExternalCanvasRefresh) {
          this.onExternalCanvasRefresh(watcher.canvasName, watcher.filePath);
        } else {
          this.requestRefresh(watcher.canvasName);
        }
      }
    }
  }

  private attachClientToFileWatcher(client: CanvasBridgeClient, resolved: ResolvedPrototypeCanvas): void {
    let watcher = this.fileWatchers.get(resolved.filePath);
    if (!watcher) {
      watcher = this.createFileWatcher(resolved);
      if (!watcher) {
        return;
      }
      this.fileWatchers.set(resolved.filePath, watcher);
    }
    watcher.clients.add(client.id);
    if (client.dirty) {
      watcher.dirtyClients.add(client.id);
    } else {
      watcher.dirtyClients.delete(client.id);
    }
    this.clientWatcherFiles.set(client.id, resolved.filePath);
  }

  private detachClientFromFileWatcher(client: CanvasBridgeClient): void {
    const filePath = this.clientWatcherFiles.get(client.id);
    if (!filePath) {
      return;
    }
    this.clientWatcherFiles.delete(client.id);
    const watcher = this.fileWatchers.get(filePath);
    if (!watcher) {
      return;
    }
    watcher.clients.delete(client.id);
    watcher.dirtyClients.delete(client.id);
    if (watcher.clients.size === 0) {
      this.closeFileWatcher(watcher);
      this.fileWatchers.delete(filePath);
    }
  }

  private createFileWatcher(resolved: ResolvedPrototypeCanvas): CanvasFileWatcher | null {
    let fsWatcher: fs.FSWatcher;
    try {
      fsWatcher = fs.watch(resolved.filePath, { persistent: false });
    } catch {
      return null;
    }

    const snapshot = readCanvasFileSnapshot(resolved.filePath);
    const watcher: CanvasFileWatcher = {
      canvasName: resolved.canvasName,
      filePath: resolved.filePath,
      watcher: fsWatcher,
      clients: new Set(),
      dirtyClients: new Set(),
      lastProcessedHash: snapshot?.hash || null,
      deferredRefreshHash: null,
      pending: null,
    };

    fsWatcher.on('change', () => this.handleFileWatchEvent(watcher.filePath));
    fsWatcher.on('rename', () => this.handleFileWatchEvent(watcher.filePath));
    fsWatcher.on('error', () => {
      this.closeFileWatcher(watcher);
      this.fileWatchers.delete(watcher.filePath);
      for (const clientId of watcher.clients) {
        this.clientWatcherFiles.delete(clientId);
      }
    });

    return watcher;
  }

  private closeFileWatcher(watcher: CanvasFileWatcher): void {
    if (watcher.pending?.timer) {
      clearTimeout(watcher.pending.timer);
      watcher.pending.timer = null;
    }
    try {
      watcher.watcher.close();
    } catch {
      // noop
    }
  }

  private isSuppressedHash(filePath: string, hash: string): boolean {
    return this.suppressHashes.get(filePath)?.has(hash) === true;
  }

  private handleFileWatchEvent(filePath: string): void {
    const watcher = this.fileWatchers.get(filePath);
    if (!watcher) {
      return;
    }
    const now = Date.now();
    const snapshot = readCanvasFileSnapshot(filePath);
    if (snapshot && this.isSuppressedHash(filePath, snapshot.hash)) {
      watcher.lastProcessedHash = snapshot.hash;
      return;
    }

    if (!watcher.pending) {
      watcher.pending = {
        firstEventAt: now,
        lastEventAt: now,
        lastSeenHash: snapshot?.hash || null,
        timer: null,
      };
    } else {
      watcher.pending.lastEventAt = now;
      watcher.pending.lastSeenHash = snapshot?.hash || watcher.pending.lastSeenHash;
    }

    this.scheduleStableRefreshCheck(watcher);
  }

  private scheduleStableRefreshCheck(watcher: CanvasFileWatcher): void {
    const pending = watcher.pending;
    if (!pending) {
      return;
    }
    if (pending.timer) {
      clearTimeout(pending.timer);
      pending.timer = null;
    }
    const now = Date.now();
    const quietDueAt = pending.lastEventAt + this.refreshQuietMs;
    const maxDueAt = pending.firstEventAt + this.refreshMaxWaitMs;
    const delay = Math.max(0, Math.min(quietDueAt, maxDueAt) - now);
    pending.timer = setTimeout(() => this.checkStableRefresh(watcher.filePath), delay);
    pending.timer.unref?.();
  }

  private checkStableRefresh(filePath: string): void {
    const watcher = this.fileWatchers.get(filePath);
    const pending = watcher?.pending;
    if (!watcher || !pending) {
      return;
    }
    pending.timer = null;

    const now = Date.now();
    const snapshot = readCanvasFileSnapshot(filePath);
    if (!snapshot) {
      watcher.pending = null;
      return;
    }

    if (this.isSuppressedHash(filePath, snapshot.hash)) {
      watcher.lastProcessedHash = snapshot.hash;
      watcher.pending = null;
      return;
    }

    if (pending.lastSeenHash && snapshot.hash !== pending.lastSeenHash && now < pending.firstEventAt + this.refreshMaxWaitMs) {
      pending.lastSeenHash = snapshot.hash;
      pending.lastEventAt = now;
      this.scheduleStableRefreshCheck(watcher);
      return;
    }

    const quietElapsed = now - pending.lastEventAt >= this.refreshQuietMs;
    const maxWaitElapsed = now - pending.firstEventAt >= this.refreshMaxWaitMs;
    if (!quietElapsed && !maxWaitElapsed) {
      this.scheduleStableRefreshCheck(watcher);
      return;
    }

    if (!isJsonParseable(snapshot.content)) {
      if (!maxWaitElapsed) {
        pending.lastSeenHash = snapshot.hash;
        pending.lastEventAt = now;
        this.scheduleStableRefreshCheck(watcher);
        return;
      }
      watcher.pending = null;
      return;
    }

    if (snapshot.hash === watcher.lastProcessedHash) {
      watcher.pending = null;
      return;
    }

    watcher.lastProcessedHash = snapshot.hash;
    watcher.pending = null;

    if (watcher.dirtyClients.size > 0) {
      watcher.deferredRefreshHash = snapshot.hash;
      return;
    }

    if (this.onExternalCanvasRefresh) {
      this.onExternalCanvasRefresh(watcher.canvasName, watcher.filePath);
      return;
    }
    this.requestRefresh(watcher.canvasName);
  }

  // ---- Low-level send helpers ----------------------------------------------

  private sendToClient(client: CanvasBridgeClient, msg: CanvasBridgeMessage): void {
    try {
      client.socket.write(encodeFrame(JSON.stringify(msg)));
    } catch {
      this.removeClient(client.id);
    }
  }

  private sendRawFrame(client: CanvasBridgeClient, opcode: number, payload: Buffer): void {
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

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let hubInstance: CanvasBridgeHub | null = null;

export function getCanvasBridgeHub(): CanvasBridgeHub {
  if (!hubInstance) {
    hubInstance = new CanvasBridgeHub();
  }
  return hubInstance;
}

// ---------------------------------------------------------------------------
// Route matching
// ---------------------------------------------------------------------------

export const CANVAS_BRIDGE_WS_PATH = '/ws/canvas-bridge';

export function isCanvasBridgeUpgrade(req: IncomingMessage): boolean {
  const pathname = (req.url || '/').split('?')[0];
  return pathname === CANVAS_BRIDGE_WS_PATH;
}
