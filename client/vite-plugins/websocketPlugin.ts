import fs from 'node:fs';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import type { RawData } from 'ws';

type ExtractZip = typeof import('extract-zip');

// Lazy-loaded to avoid pulling in iconv-lite at Vite config time.
let _extractZip: ExtractZip | null = null;
let _runCommand: typeof import('../scripts/utils/command-runtime.mjs').runCommand | null = null;

async function getExtractZip() {
  if (!_extractZip) {
    const module = await import('extract-zip') as unknown as { default?: ExtractZip };
    _extractZip = module.default || (module as ExtractZip);
  }
  return _extractZip;
}

async function getRunCommand() {
  if (!_runCommand) {
    _runCommand = (await import('../scripts/utils/command-runtime.mjs')).runCommand;
  }
  return _runCommand;
}

export interface WebSocketMessage {
  type: string;
  data?: unknown;
  payload?: unknown;
  client?: string;
  version?: string;
  widgetId?: string;
  pageId?: string;
  blurImages?: unknown;
  metadata?: unknown;
}

export interface ClientMeta {
  id: number;
  type: string;
  version?: string;
  address?: string;
  connectedAt: number;
}

interface UploadSession {
  transferId: string;
  pageName: string;
  displayName?: string;
  outputRelativeDir: string;
  fileName: string;
  mode: 'zip' | 'files';
  totalChunks: number;
  totalBytes?: number;
  receivedChunks: number;
  receivedBytes: number;
  chunks: Map<number, Buffer>;
  filesRoot?: string;
  filesReceived: number;
  startedAt: number;
}

interface HandleMessageContext {
  clientMeta: Map<WebSocket, ClientMeta>;
  uploadSessions: Map<string, UploadSession>;
  projectRoot: string;
}

type MiddlewareResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(chunk?: unknown): void;
};

const WS_PATH = '/ws';
const IGNORED_EXTRACT_ENTRIES = new Set(['__MACOSX', '.DS_Store']);
const nodeCommand = process.execPath;

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                    */
/* ------------------------------------------------------------------ */

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function inferExtractedRootFolder(extractDir: string) {
  if (!fs.existsSync(extractDir)) {
    return { entryCount: 0, hasRootFolder: false, rootFolderName: '' };
  }

  const entries = fs
    .readdirSync(extractDir, { withFileTypes: true })
    .filter(entry => !IGNORED_EXTRACT_ENTRIES.has(entry.name));

  if (entries.length === 1 && entries[0].isDirectory()) {
    return { entryCount: entries.length, hasRootFolder: true, rootFolderName: entries[0].name };
  }

  return { entryCount: entries.length, hasRootFolder: false, rootFolderName: '' };
}

function isSafeName(value: string) {
  return Boolean(value && value.trim() && !value.includes('..') && !/[\\/]/.test(value));
}

function isSafeRelativePath(value: string) {
  if (!value || typeof value !== 'string') return false;
  const normalized = value.replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.startsWith('~')) return false;
  if (normalized.split('/').some(part => part === '..')) return false;
  return true;
}

function isValidDisplayName(value?: string) {
  if (value === undefined) return true;
  const text = String(value).trim();
  return text.length > 0 && text.length <= 200;
}

function normalizeRelativeDir(value: string) {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .join('/');
}

function resolveOutputRelativeDir(data: any, fallbackName: string) {
  const candidates = [
    data?.outputRelativeDir,
    data?.outputPath,
    data?.targetPath,
    data?.targetDir,
    data?.folderPath,
    data?.relativePath,
    data?.pagePath,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = normalizeRelativeDir(candidate.trim());
    if (!normalized) continue;
    if (!isSafeRelativePath(normalized)) return null;

    const segments = normalized.split('/');
    if (segments.length === 0 || segments.some(segment => !isSafeName(segment))) {
      return null;
    }

    return normalized;
  }

  return fallbackName;
}

function resolvePrototypeOutputDir(projectRoot: string, outputRelativeDir: string) {
  return path.join(projectRoot, 'src', 'prototypes', ...outputRelativeDir.split('/'));
}

/* ------------------------------------------------------------------ */
/*  WebSocket / HTTP helpers                                           */
/* ------------------------------------------------------------------ */

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res: MiddlewareResponse, payload: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function parseSocketMessage(rawData: RawData): WebSocketMessage {
  const text = typeof rawData === 'string'
    ? rawData
    : Buffer.isBuffer(rawData)
      ? rawData.toString('utf8')
      : Array.isArray(rawData)
        ? Buffer.concat(rawData).toString('utf8')
        : Buffer.from(rawData as ArrayBuffer).toString('utf8');
  return JSON.parse(text) as WebSocketMessage;
}

function sendWsMessage(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(clients: Set<WebSocket>, message: WebSocketMessage): number {
  const data = JSON.stringify(message);
  let count = 0;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
      count += 1;
    }
  }

  return count;
}

/* ------------------------------------------------------------------ */
/*  Chrome-export message handlers                                     */
/* ------------------------------------------------------------------ */

function handleChromeExportInit(
  ws: WebSocket,
  message: WebSocketMessage,
  context: HandleMessageContext,
): void {
  const data = (message.data ?? message.payload ?? {}) as any;
  const transferId = String(data.transferId || '').trim();
  const pageName = String(data.pageName || '').trim();
  const displayName = data.displayName !== undefined ? String(data.displayName).trim() : undefined;
  const mode = data.mode === 'files' ? 'files' as const : 'zip' as const;
  const totalChunks = Number(data.totalChunks);
  const totalBytes = typeof data.totalBytes === 'number' ? data.totalBytes : undefined;
  const fileNameRaw = String(data.fileName || 'chrome-export.zip');
  const fileName = path.basename(fileNameRaw || 'chrome-export.zip');
  const outputRelativeDir = resolveOutputRelativeDir(data, pageName);

  if (!transferId || !isSafeName(transferId)) {
    return sendWsMessage(ws, { type: 'chrome-export:error', message: 'transferId is invalid' });
  }
  if (!pageName || !isSafeName(pageName)) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'pageName is invalid' });
  }
  if (!isValidDisplayName(displayName)) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'displayName is invalid' });
  }
  if (!outputRelativeDir) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'output path is invalid' });
  }
  if (mode === 'zip' && (!Number.isFinite(totalChunks) || totalChunks <= 0)) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'totalChunks is invalid' });
  }
  if (context.uploadSessions.has(transferId)) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'transferId already exists' });
  }

  const transferDir = path.join(context.projectRoot, 'temp', 'chrome-export', transferId);
  const filesRoot = mode === 'files' ? path.join(transferDir, 'files') : undefined;
  if (filesRoot) {
    ensureDir(filesRoot);
  }

  const session: UploadSession = {
    transferId,
    pageName,
    displayName,
    outputRelativeDir,
    fileName,
    mode,
    totalChunks,
    totalBytes,
    receivedChunks: 0,
    receivedBytes: 0,
    chunks: new Map(),
    filesRoot,
    filesReceived: 0,
    startedAt: Date.now(),
  };

  context.uploadSessions.set(transferId, session);
  sendWsMessage(ws, { type: 'chrome-export:ack', transferId });
}

function handleChromeExportChunk(
  ws: WebSocket,
  message: WebSocketMessage,
  context: HandleMessageContext,
): void {
  const data = (message.data ?? message.payload ?? {}) as any;
  const transferId = String(data.transferId || '').trim();
  const chunkIndex = Number(data.index);
  const chunkData = data.data;

  if (!transferId || !context.uploadSessions.has(transferId)) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'unknown transferId' });
  }
  const session = context.uploadSessions.get(transferId)!;
  if (session.mode !== 'zip') {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'chunk not allowed for files mode' });
  }
  if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'invalid chunk index' });
  }
  if (typeof chunkData !== 'string' || !chunkData) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'invalid chunk data' });
  }
  if (chunkIndex >= session.totalChunks) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'chunk index out of range' });
  }

  if (!session.chunks.has(chunkIndex)) {
    const buffer = Buffer.from(chunkData, 'base64');
    session.chunks.set(chunkIndex, buffer);
    session.receivedChunks = session.chunks.size;
    session.receivedBytes += buffer.byteLength;
  }

  sendWsMessage(ws, {
    type: 'chrome-export:progress',
    transferId,
    receivedChunks: session.receivedChunks,
    totalChunks: session.totalChunks,
    receivedBytes: session.receivedBytes,
    totalBytes: session.totalBytes,
  });
}

function handleChromeExportFile(
  ws: WebSocket,
  message: WebSocketMessage,
  context: HandleMessageContext,
): void {
  const data = (message.data ?? message.payload ?? {}) as any;
  const transferId = String(data.transferId || '').trim();
  const relativePath = String(data.path || data.relativePath || '').trim();
  const fileData = data.data;

  if (!transferId || !context.uploadSessions.has(transferId)) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'unknown transferId' });
  }
  const session = context.uploadSessions.get(transferId)!;
  if (session.mode !== 'files') {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'file not allowed for zip mode' });
  }
  if (!isSafeRelativePath(relativePath)) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'invalid file path' });
  }
  if (typeof fileData !== 'string' || !fileData) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'invalid file data' });
  }
  if (!session.filesRoot) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'files root not ready' });
  }

  const targetPath = path.join(session.filesRoot, relativePath);
  ensureDir(path.dirname(targetPath));

  const buffer = Buffer.from(fileData, 'base64');
  fs.writeFileSync(targetPath, buffer);
  session.filesReceived += 1;

  sendWsMessage(ws, {
    type: 'chrome-export:progress',
    transferId,
    filesReceived: session.filesReceived,
  });
}

async function runConverterAndRespond(
  ws: WebSocket,
  session: UploadSession,
  sourceDir: string,
  context: HandleMessageContext,
): Promise<void> {
  const outputName = session.pageName;
  if (!isSafeName(outputName)) {
    sendWsMessage(ws, { type: 'chrome-export:error', transferId: session.transferId, message: 'invalid pageName' });
    return;
  }

  const scriptPath = path.join(context.projectRoot, 'scripts', 'chrome-export-converter.mjs');
  const commandArgs = [scriptPath, sourceDir, outputName];
  if (session.displayName) {
    commandArgs.push('--display-name', session.displayName);
  }
  commandArgs.push('--target-dir', session.outputRelativeDir);

  sendWsMessage(ws, { type: 'chrome-export:status', transferId: session.transferId, stage: 'importing' });

  const transferDir = path.join(context.projectRoot, 'temp', 'chrome-export', session.transferId);
  const runCmd = await getRunCommand();

  void runCmd({
    command: nodeCommand,
    args: commandArgs,
    cwd: context.projectRoot,
    capture: true,
  }).then((result: any) => {
    if (result.code !== 0) {
      sendWsMessage(ws, {
        type: 'chrome-export:error',
        transferId: session.transferId,
        message: result.stderr || result.stdout || 'import failed',
      });
    } else {
      const outputDir = resolvePrototypeOutputDir(context.projectRoot, session.outputRelativeDir);
      sendWsMessage(ws, {
        type: 'chrome-export:done',
        transferId: session.transferId,
        pageName: outputName,
        displayName: session.displayName,
        outputRelativeDir: session.outputRelativeDir,
        sourceDir,
        outputDir,
        stdout: result.stdout ? String(result.stdout).trim() : undefined,
        stderr: result.stderr ? String(result.stderr).trim() : undefined,
      });
      if (fs.existsSync(transferDir)) {
        fs.rmSync(transferDir, { recursive: true, force: true });
      }
      context.uploadSessions.delete(session.transferId);
    }
  }).catch((error: any) => {
    sendWsMessage(ws, {
      type: 'chrome-export:error',
      transferId: session.transferId,
      message: error?.message || 'import failed',
    });
  });
}

function handleChromeExportComplete(
  ws: WebSocket,
  message: WebSocketMessage,
  context: HandleMessageContext,
): void {
  const data = (message.data ?? message.payload ?? {}) as any;
  const transferId = String(data.transferId || '').trim();

  if (!transferId || !context.uploadSessions.has(transferId)) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'unknown transferId' });
  }

  const session = context.uploadSessions.get(transferId)!;
  const inboxRoot = path.join(context.projectRoot, 'temp', 'chrome-export');
  const transferDir = path.join(inboxRoot, transferId);
  const extractDir = path.join(transferDir, 'extract');

  if (session.mode === 'zip') {
    const missing: number[] = [];
    for (let i = 0; i < session.totalChunks; i += 1) {
      if (!session.chunks.has(i)) {
        missing.push(i);
      }
    }

    if (missing.length > 0) {
      return sendWsMessage(ws, {
        type: 'chrome-export:error',
        transferId,
        message: 'missing chunks',
        missing,
      });
    }

    const orderedBuffers: Buffer[] = new Array(session.totalChunks);
    for (let i = 0; i < session.totalChunks; i += 1) {
      orderedBuffers[i] = session.chunks.get(i)!;
    }

    const zipBuffer = Buffer.concat(orderedBuffers);
    const zipPath = path.join(transferDir, session.fileName);

    ensureDir(transferDir);
    fs.writeFileSync(zipPath, zipBuffer);

    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    ensureDir(extractDir);

    sendWsMessage(ws, { type: 'chrome-export:status', transferId, stage: 'extracting' });

    getExtractZip().then((extract) => extract(zipPath, { dir: extractDir }))
      .then(() => {
        const inferred = inferExtractedRootFolder(extractDir);
        if (inferred.entryCount === 0) {
          throw new Error('empty zip');
        }
        const sourceDir = inferred.hasRootFolder
          ? path.join(extractDir, inferred.rootFolderName)
          : extractDir;

        runConverterAndRespond(ws, session, sourceDir, context);
      })
      .catch((error: any) => {
        sendWsMessage(ws, {
          type: 'chrome-export:error',
          transferId,
          message: error?.message || 'extract failed',
        });
      });
  } else {
    if (!session.filesRoot) {
      return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'files root not ready' });
    }

    runConverterAndRespond(ws, session, session.filesRoot, context);
  }
}

function handleChromeExportAbort(
  ws: WebSocket,
  message: WebSocketMessage,
  context: HandleMessageContext,
): void {
  const data = (message.data ?? message.payload ?? {}) as any;
  const transferId = String(data.transferId || '').trim();
  if (!transferId || !context.uploadSessions.has(transferId)) {
    return sendWsMessage(ws, { type: 'chrome-export:error', transferId, message: 'unknown transferId' });
  }
  context.uploadSessions.delete(transferId);
  sendWsMessage(ws, { type: 'chrome-export:aborted', transferId });
}

/* ------------------------------------------------------------------ */
/*  Main socket message dispatcher                                     */
/* ------------------------------------------------------------------ */

function handleSocketMessage(
  ws: WebSocket,
  message: WebSocketMessage,
  clients: Set<WebSocket>,
  context: HandleMessageContext,
): void {
  switch (message.type) {
    case 'identify': {
      const meta = context.clientMeta.get(ws);
      if (meta) {
        meta.type = message.client || meta.type;
        meta.version = message.version || meta.version;
      }
      sendWsMessage(ws, {
        type: 'identified',
        message: '身份识别成功',
      });
      return;
    }

    case 'ping':
      sendWsMessage(ws, { type: 'pong' });
      return;

    case 'broadcast':
      broadcast(clients, {
        type: 'broadcast',
        data: message.data,
      });
      return;

    case 'echo':
      sendWsMessage(ws, {
        type: 'echo',
        data: message.data,
      });
      return;

    case 'chrome-export:init':
      handleChromeExportInit(ws, message, context);
      return;

    case 'chrome-export:chunk':
      handleChromeExportChunk(ws, message, context);
      return;

    case 'chrome-export:file':
      handleChromeExportFile(ws, message, context);
      return;

    case 'chrome-export:complete':
      handleChromeExportComplete(ws, message, context);
      return;

    case 'chrome-export:abort':
      handleChromeExportAbort(ws, message, context);
      return;

    default:
      sendWsMessage(ws, {
        type: 'unknown',
        message: `未知的消息类型: ${message.type}`,
      });
  }
}

/* ------------------------------------------------------------------ */
/*  Client list / send helpers                                         */
/* ------------------------------------------------------------------ */

function serializeClients(clientMeta: Map<WebSocket, ClientMeta>) {
  const clients = Array.from(clientMeta.values()).map((item) => ({
    id: item.id,
    type: item.type,
    version: item.version,
    address: item.address,
    connectedAt: item.connectedAt,
  }));
  const stats = clients.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  return {
    clients,
    stats,
    total: clients.length,
  };
}

function selectTargetClients(
  clients: Set<WebSocket>,
  clientMeta: Map<WebSocket, ClientMeta>,
  targetClientTypes: string[],
): Set<WebSocket> {
  if (targetClientTypes.length === 0) {
    return clients;
  }

  return new Set(Array.from(clients).filter((ws) => {
    const meta = clientMeta.get(ws);
    return Boolean(meta?.type && targetClientTypes.includes(meta.type));
  }));
}

function normalizeTargetClientTypes(body: Record<string, unknown>): string[] {
  if (Array.isArray(body.targetClientTypes)) {
    return body.targetClientTypes.filter((value): value is string => typeof value === 'string' && value.length > 0);
  }
  return typeof body.targetClientType === 'string' && body.targetClientType
    ? [body.targetClientType]
    : [];
}

function createRelayMessage(body: Record<string, unknown>, data: unknown): WebSocketMessage {
  const message: WebSocketMessage = {
    type: body.type as string,
    data,
  };

  if (typeof body.widgetId === 'string') message.widgetId = body.widgetId;
  if (typeof body.pageId === 'string') message.pageId = body.pageId;
  if (body.payload !== undefined) message.payload = body.payload;
  if (body.blurImages !== undefined) message.blurImages = body.blurImages;
  if (body.metadata !== undefined) message.metadata = body.metadata;

  return message;
}

async function handleSendRequest(
  req: IncomingMessage,
  res: MiddlewareResponse,
  clients: Set<WebSocket>,
  clientMeta: Map<WebSocket, ClientMeta>,
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, { error: 'Method not allowed' }, 405);
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await readRequestBody(req) || '{}') as Record<string, unknown>;
  } catch {
    sendJson(res, { error: 'invalid json body' }, 400);
    return;
  }

  const type = body.type;
  if (!type || typeof type !== 'string') {
    sendJson(res, { error: 'type is required' }, 400);
    return;
  }

  if (type === 'sync-widget-content' || type === 'sync-page-content') {
    sendJson(res, { error: 'Figma 同步已下线，请使用导出 Make' }, 410);
    return;
  }

  const data = body.payload !== undefined ? body.payload : body.data;
  if (data === undefined || data === null) {
    sendJson(res, { error: 'data is required' }, 400);
    return;
  }

  const targetClientTypes = normalizeTargetClientTypes(body);
  const targetClients = selectTargetClients(clients, clientMeta, targetClientTypes);
  const allClientCount = clients.size;

  if (allClientCount === 0) {
    sendJson(res, { ok: true, sent: 0, warning: 'no clients connected' });
    return;
  }

  sendJson(res, {
    ok: true,
    sent: targetClients.size,
    ...(targetClientTypes.length > 0 && targetClients.size === 0
      ? { warning: 'no target clients connected' }
      : {}),
  });

  setImmediate(() => {
    broadcast(targetClients, createRelayMessage(body, data));
  });
}

/* ------------------------------------------------------------------ */
/*  Plugin entry                                                       */
/* ------------------------------------------------------------------ */

export function websocketPlugin(): Plugin {
  let wss: WebSocketServer | null = null;
  const clients = new Set<WebSocket>();
  const clientMeta = new Map<WebSocket, ClientMeta>();
  const uploadSessions = new Map<string, UploadSession>();
  let nextClientId = 1;
  const projectRoot = process.cwd();

  return {
    name: 'make-project-websocket',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      wss = new WebSocketServer({ noServer: true });

      const handleUpgrade = (req: IncomingMessage, socket: any, head: Buffer) => {
        const pathname = req.url ? new URL(req.url, 'http://localhost').pathname : '';
        if (pathname !== WS_PATH) {
          return;
        }

        wss?.handleUpgrade(req, socket, head, (ws) => {
          wss?.emit('connection', ws, req);
        });
      };

      server.httpServer?.on('upgrade', handleUpgrade);

      const messageContext: HandleMessageContext = {
        clientMeta,
        uploadSessions,
        projectRoot,
      };

      wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const meta: ClientMeta = {
          id: nextClientId,
          type: url.searchParams.get('client') || 'unknown',
          version: url.searchParams.get('version') || undefined,
          address: req.socket.remoteAddress,
          connectedAt: Date.now(),
        };
        nextClientId += 1;

        clients.add(ws);
        clientMeta.set(ws, meta);
        sendWsMessage(ws, {
          type: 'connected',
          message: 'WebSocket 连接成功',
        });

        ws.on('message', (rawData) => {
          try {
            handleSocketMessage(ws, parseSocketMessage(rawData), clients, messageContext);
          } catch {
            sendWsMessage(ws, {
              type: 'error',
              message: '消息格式错误',
            });
          }
        });

        const cleanup = () => {
          clients.delete(ws);
          clientMeta.delete(ws);
        };
        ws.on('close', cleanup);
        ws.on('error', cleanup);
      });

      server.middlewares.use('/api/ws/clients', (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, { error: 'Method not allowed' }, 405);
          return;
        }
        sendJson(res, serializeClients(clientMeta));
      });

      server.middlewares.use('/api/ws/send', (req, res) => {
        void handleSendRequest(req, res, clients, clientMeta);
      });

      server.httpServer?.on('close', () => {
        wss?.close();
        clients.clear();
        clientMeta.clear();
        server.httpServer?.off?.('upgrade', handleUpgrade);
      });
    },
  };
}
