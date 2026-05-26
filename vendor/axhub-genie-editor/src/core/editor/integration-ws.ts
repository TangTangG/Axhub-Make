import { buildGenieWsUrl } from './genie-bridge';
import type { EditorIntegrationWsService } from './contracts';
import type { ExternalEditingTaskRef, ResolvedWebEditorOptions } from './state';

const INTEGRATION_WS_RECONNECT_DELAY_MS = 3_000;
const DEFAULT_NODE_LIST_LIMIT = 100;
const INTEGRATION_WS_LOG_PREFIX = '[WebEditorV2][IntegrationWs]';

const EDITOR_CAPABILITIES = [
  'editor.snapshot',
  'editor.nodes.list',
  'editor.node.screenshot',
  'editor.context-images',
  'editor.editing.set',
] as const;

type IntegrationWsMessage = {
  type?: string;
  requestId?: string;
  payload?: Record<string, unknown>;
};

type EditorNodesStatusAlias =
  | 'dirty'
  | 'handled'
  | 'editing'
  | 'completed'
  | 'error'
  | 'pending-dispatch';

type EditorNodesItem = {
  elementKey: string;
  label: string;
  changeState: 'clean' | 'dirty' | 'handled';
  taskState: 'idle' | 'editing' | 'completed' | 'error';
  hasNote: boolean;
  hasImages: boolean;
  changeKinds: string[];
  dirtySince: number | null;
  lastHandledAt: number | null;
};

type IntegrationErrorCode =
  | 'INVALID_PAYLOAD'
  | 'INVALID_TARGET'
  | 'NOT_FOUND'
  | 'UNSUPPORTED_FRONTEND_CAPABILITY'
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL_ERROR';

class IntegrationProtocolError extends Error {
  readonly code: IntegrationErrorCode;

  constructor(code: IntegrationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function createRequestId(prefix = 'editor_integration'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTaskRef(value: unknown): Partial<ExternalEditingTaskRef> | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  return {
    provider: hasText(record.provider) ? record.provider.trim() : null,
    sessionId: hasText(record.sessionId) ? record.sessionId.trim() : null,
    requestId: hasText(record.requestId) ? record.requestId.trim() : null,
  };
}

function normalizeStatusAliases(value: unknown): EditorNodesStatusAlias[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new IntegrationProtocolError('INVALID_PAYLOAD', 'status must be an array of strings');
  }

  const aliases = value.map((item) => String(item ?? '').trim()).filter(Boolean);
  const allowed = new Set<EditorNodesStatusAlias>([
    'dirty',
    'handled',
    'editing',
    'completed',
    'error',
    'pending-dispatch',
  ]);

  for (const alias of aliases) {
    if (!allowed.has(alias as EditorNodesStatusAlias)) {
      throw new IntegrationProtocolError('INVALID_PAYLOAD', `Unknown status alias: ${alias}`);
    }
  }

  return aliases as EditorNodesStatusAlias[];
}

function normalizeLimit(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_NODE_LIST_LIMIT;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new IntegrationProtocolError('INVALID_PAYLOAD', 'limit must be a positive integer');
  }
  return parsed;
}

function mapError(error: unknown): IntegrationProtocolError {
  if (error instanceof IntegrationProtocolError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('NOT_FOUND:')) {
    return new IntegrationProtocolError('NOT_FOUND', message.replace(/^NOT_FOUND:\s*/, ''));
  }
  if (message.startsWith('NOT_IMPLEMENTED:')) {
    return new IntegrationProtocolError('NOT_IMPLEMENTED', message.replace(/^NOT_IMPLEMENTED:\s*/, ''));
  }
  return new IntegrationProtocolError('INTERNAL_ERROR', message || 'Unknown integration failure');
}

function matchesStatusAlias(item: EditorNodesItem, alias: EditorNodesStatusAlias): boolean {
  if (alias === 'dirty') return item.changeState === 'dirty';
  if (alias === 'handled') return item.changeState === 'handled';
  if (alias === 'editing') return item.taskState === 'editing';
  if (alias === 'completed') return item.taskState === 'completed';
  if (alias === 'error') return item.taskState === 'error';
  return item.changeState === 'dirty' && item.taskState === 'idle';
}

export function createEditorIntegrationWsService(options: {
  integrationWsOptions: ResolvedWebEditorOptions['integrationWs'];
  getPageUrl: () => string | null;
  getSessionId: () => string | null;
  getEditedSnapshotPayload: () => {
    resource: unknown;
    selectedElement: unknown;
    modifiedElements: unknown[];
    textChanges: unknown[];
    styleChanges: unknown;
    statusSummary: {
      active: boolean;
      modifiedCount: number;
      nodeStateCounts: Record<'clean' | 'dirty' | 'handled' | 'editing' | 'completed' | 'error', number>;
    };
  };
  listEditorNodes: () => EditorNodesItem[];
  getContextImagesPayload: () => {
    items: Array<{
      id: string;
      name: string;
      data: string;
      mimeType: string;
      createdAt: number;
      source: 'prompt-context';
    }>;
  };
  getNodeScreenshotPayload: (elementKey: string) => Promise<{
    elementKey: string;
    image: {
      name: string;
      data: string;
      width: number;
      height: number;
    };
    mimeType: 'image/png';
    width: number;
    height: number;
  }>;
  setNodeEditingState: (
    elementKey: string,
    state: 'editing' | 'idle' | 'completed' | 'error',
    taskRef: Partial<ExternalEditingTaskRef> | null,
    requestId: string,
  ) => Promise<{
    elementKey: string;
    state: 'editing' | 'idle' | 'completed' | 'error';
    applied: boolean;
    taskRef?: Partial<ExternalEditingTaskRef> | null;
  }>;
  onConnectionStatusChange?: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
}): EditorIntegrationWsService {
  const {
    apiBaseUrl,
    apiKey,
    channel,
    clientId,
    enabled,
  } = options.integrationWsOptions;

  const RECONNECT_BASE_DELAY_MS = 3_000;
  const RECONNECT_MAX_DELAY_MS = 48_000;
  const RECONNECT_MAX_ATTEMPTS = 10;

  type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

  let active = false;
  let socket: WebSocket | null = null;
  let reconnectTimerId: number | null = null;
  let reconnectAttemptCount = 0;
  let connectionStatus: ConnectionStatus = 'disconnected';
  let visibilityCleanup: (() => void) | null = null;
  let lastSocketUrl: string | null = null;
  let lastErrorMessage: string | null = null;

  function hasRequiredConfig(): boolean {
    return enabled
      && hasText(apiBaseUrl)
      && hasText(channel)
      && hasText(clientId);
  }

  function setConnectionStatus(nextStatus: ConnectionStatus): void {
    if (connectionStatus === nextStatus) return;
    connectionStatus = nextStatus;
    try {
      options.onConnectionStatusChange?.(nextStatus);
    } catch {
      // Ignore listener errors.
    }
  }

  function clearReconnectTimer(): void {
    if (reconnectTimerId === null) return;
    window.clearTimeout(reconnectTimerId);
    reconnectTimerId = null;
  }

  function scheduleReconnect(): void {
    if (!active || reconnectTimerId !== null || !hasRequiredConfig()) return;
    if (reconnectAttemptCount >= RECONNECT_MAX_ATTEMPTS) {
      setConnectionStatus('disconnected');
      return;
    }
    setConnectionStatus('reconnecting');
    reconnectAttemptCount += 1;
    const delayMs = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttemptCount - 1),
      RECONNECT_MAX_DELAY_MS,
    );
    reconnectTimerId = window.setTimeout(() => {
      reconnectTimerId = null;
      console.info(`${INTEGRATION_WS_LOG_PREFIX} reconnecting`, {
        attempt: reconnectAttemptCount,
        url: lastSocketUrl,
      });
      connectSocket();
    }, delayMs);
  }

  function sendMessage(message: Record<string, unknown>): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new IntegrationProtocolError('INTERNAL_ERROR', 'Integration WebSocket is not connected');
    }
    socket.send(JSON.stringify(message));
  }

  function sendError(requestId: string, code: IntegrationErrorCode, message: string): void {
    sendMessage({
      type: 'integration.error',
      requestId,
      payload: {
        code,
        message,
      },
    });
  }

  function validateTarget(payload: Record<string, unknown>, requestId: string): void {
    const payloadChannel = hasText(payload.channel) ? payload.channel.trim() : '';
    const payloadTargetClientId = hasText(payload.targetClientId) ? payload.targetClientId.trim() : '';
    if (!payloadChannel || !payloadTargetClientId) {
      throw new IntegrationProtocolError(
        'INVALID_PAYLOAD',
        'payload.channel and payload.targetClientId are required',
      );
    }
    if (payloadChannel !== channel || payloadTargetClientId !== clientId) {
      throw new IntegrationProtocolError('INVALID_TARGET', 'Message target does not match this frontend page');
    }
    if (!requestId) {
      throw new IntegrationProtocolError('INVALID_PAYLOAD', 'requestId is required');
    }
  }

  async function handleEditorSnapshotRequest(message: IntegrationWsMessage): Promise<void> {
    const requestId = String(message.requestId ?? '').trim();
    const payload = message.payload ?? {};
    validateTarget(payload, requestId);
    sendMessage({
      type: 'integration.editor.snapshot.result',
      requestId,
      payload: options.getEditedSnapshotPayload(),
    });
  }

  async function handleEditorNodesListRequest(message: IntegrationWsMessage): Promise<void> {
    const requestId = String(message.requestId ?? '').trim();
    const payload = message.payload ?? {};
    validateTarget(payload, requestId);
    const status = normalizeStatusAliases(payload.status);
    const elementKey = hasText(payload.elementKey) ? payload.elementKey.trim() : null;
    const limit = normalizeLimit(payload.limit);

    const allItems = options.listEditorNodes();
    const filteredItems = allItems.filter((item) => {
      if (elementKey && item.elementKey !== elementKey) return false;
      if (status.length === 0) return true;
      return status.some((alias) => matchesStatusAlias(item, alias));
    });

    sendMessage({
      type: 'integration.editor.nodes.result',
      requestId,
      payload: {
        items: filteredItems.slice(0, limit),
        total: filteredItems.length,
        filters: {
          status,
          elementKey,
          limit,
        },
      },
    });
  }

  async function handleEditorNodeScreenshotRequest(message: IntegrationWsMessage): Promise<void> {
    const requestId = String(message.requestId ?? '').trim();
    const payload = message.payload ?? {};
    validateTarget(payload, requestId);
    const elementKey = hasText(payload.elementKey) ? payload.elementKey.trim() : '';
    if (!elementKey) {
      throw new IntegrationProtocolError('INVALID_PAYLOAD', 'payload.elementKey is required');
    }

    sendMessage({
      type: 'integration.editor.node.screenshot.result',
      requestId,
      payload: await options.getNodeScreenshotPayload(elementKey),
    });
  }

  async function handleEditorContextImagesRequest(message: IntegrationWsMessage): Promise<void> {
    const requestId = String(message.requestId ?? '').trim();
    const payload = message.payload ?? {};
    validateTarget(payload, requestId);
    sendMessage({
      type: 'integration.editor.context-images.result',
      requestId,
      payload: options.getContextImagesPayload(),
    });
  }

  async function handleEditorEditingSetRequest(message: IntegrationWsMessage): Promise<void> {
    const requestId = String(message.requestId ?? '').trim();
    const payload = message.payload ?? {};
    validateTarget(payload, requestId);
    const elementKey = hasText(payload.elementKey) ? payload.elementKey.trim() : '';
    if (!elementKey) {
      throw new IntegrationProtocolError('INVALID_PAYLOAD', 'payload.elementKey is required');
    }
    const nextState = payload.state;
    const validEditingStates = ['editing', 'idle', 'completed', 'error'] as const;
    type ValidEditingState = typeof validEditingStates[number];
    if (!validEditingStates.includes(nextState as ValidEditingState)) {
      throw new IntegrationProtocolError(
        'INVALID_PAYLOAD',
        `payload.state must be one of: ${validEditingStates.join(', ')}`,
      );
    }

    sendMessage({
      type: 'integration.editor.editing.result',
      requestId,
      payload: await options.setNodeEditingState(
        elementKey,
        nextState as ValidEditingState,
        normalizeTaskRef(payload.taskRef),
        requestId,
      ),
    });
  }

  async function dispatchMessage(message: IntegrationWsMessage): Promise<void> {
    try {
      if (message.type === 'integration.editor.snapshot.get') {
        await handleEditorSnapshotRequest(message);
        return;
      }
      if (message.type === 'integration.editor.nodes.list') {
        await handleEditorNodesListRequest(message);
        return;
      }
      if (message.type === 'integration.editor.node.screenshot.get') {
        await handleEditorNodeScreenshotRequest(message);
        return;
      }
      if (message.type === 'integration.editor.context-images.get') {
        await handleEditorContextImagesRequest(message);
        return;
      }
      if (message.type === 'integration.editor.editing.set') {
        await handleEditorEditingSetRequest(message);
      }
    } catch (error) {
      const requestId = String(message.requestId ?? '').trim();
      if (!requestId) return;
      const mappedError = mapError(error);
      sendError(requestId, mappedError.code, mappedError.message);
    }
  }

  function handleSocketMessage(event: MessageEvent<string>): void {
    let parsed: IntegrationWsMessage | null = null;
    try {
      parsed = JSON.parse(event.data) as IntegrationWsMessage;
    } catch {
      return;
    }

    if (!parsed?.type) return;
    if (parsed.type === 'integration.connected') {
      reconnectAttemptCount = 0;
      lastErrorMessage = null;
      console.info(`${INTEGRATION_WS_LOG_PREFIX} integration connected`, {
        url: lastSocketUrl,
        channel,
        clientId,
        payload: parsed.payload ?? null,
      });
      setConnectionStatus('connected');
      return;
    }

    void dispatchMessage(parsed);
  }

  function connectSocket(): void {
    if (!active || socket || !hasRequiredConfig()) return;

    let nextSocket: WebSocket;
    const nextUrl = buildGenieWsUrl(apiBaseUrl, apiKey);
    lastSocketUrl = nextUrl;
    try {
      nextSocket = new WebSocket(nextUrl);
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : String(error);
      console.error(`${INTEGRATION_WS_LOG_PREFIX} failed to construct socket`, {
        url: nextUrl,
        error: lastErrorMessage,
      });
      scheduleReconnect();
      return;
    }

    socket = nextSocket;
    nextSocket.onopen = () => {
      lastErrorMessage = null;
      console.info(`${INTEGRATION_WS_LOG_PREFIX} socket opened`, {
        url: nextUrl,
        channel,
        clientId,
      });
      try {
        sendMessage({
          type: 'integration.connect',
          requestId: createRequestId('integration_connect'),
          payload: {
            role: 'frontend-page',
            channel: channel.trim(),
            clientId: clientId.trim(),
            pageUrl: options.getPageUrl(),
            sessionId: options.getSessionId(),
            capabilities: [...EDITOR_CAPABILITIES],
            source: 'chrome-extension',
          },
        });
      } catch (error) {
        lastErrorMessage = error instanceof Error ? error.message : String(error);
        console.error(`${INTEGRATION_WS_LOG_PREFIX} failed to send integration.connect`, {
          url: nextUrl,
          error: lastErrorMessage,
        });
        nextSocket.close();
      }
    };
    nextSocket.onmessage = handleSocketMessage;
    nextSocket.onerror = () => {
      lastErrorMessage = `WebSocket error while connecting to ${nextUrl}`;
      console.warn(`${INTEGRATION_WS_LOG_PREFIX} socket error`, {
        url: nextUrl,
        status: connectionStatus,
      });
    };
    nextSocket.onclose = (event) => {
      if (socket === nextSocket) {
        socket = null;
      }
      if (event.reason) {
        lastErrorMessage = event.reason;
      } else if (event.code && event.code !== 1000) {
        lastErrorMessage = `WebSocket closed (${event.code})`;
      }
      console.warn(`${INTEGRATION_WS_LOG_PREFIX} socket closed`, {
        url: nextUrl,
        code: event.code,
        reason: event.reason || null,
        willReconnect: active && reconnectAttemptCount < RECONNECT_MAX_ATTEMPTS,
      });
      if (active) {
        setConnectionStatus(reconnectAttemptCount < RECONNECT_MAX_ATTEMPTS ? 'reconnecting' : 'disconnected');
      }
      scheduleReconnect();
    };
  }

  function handleVisibilityChange(): void {
    if (typeof document === 'undefined') return;
    if (document.visibilityState !== 'visible' || !active || !hasRequiredConfig()) return;
    if (socket && socket.readyState === WebSocket.OPEN) return;
    // Tab became visible and we're not connected — reconnect immediately
    clearReconnectTimer();
    reconnectAttemptCount = 0;
    connectSocket();
  }

  function installVisibilityListener(): void {
    if (typeof document === 'undefined' || visibilityCleanup) return;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityCleanup = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      visibilityCleanup = null;
    };
  }

  function removeVisibilityListener(): void {
    visibilityCleanup?.();
  }

  function stop(): void {
    active = false;
    clearReconnectTimer();
    removeVisibilityListener();
    reconnectAttemptCount = 0;
    const currentSocket = socket;
    socket = null;
    if (currentSocket) {
      currentSocket.onopen = null;
      currentSocket.onmessage = null;
      currentSocket.onerror = null;
      currentSocket.onclose = null;
      currentSocket.close();
    }
    setConnectionStatus('disconnected');
  }

  function start(): void {
    if (active) return;
    active = true;
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined' || !hasRequiredConfig()) {
      return;
    }
    installVisibilityListener();
    connectSocket();
  }

  function getConnectionStatus(): ConnectionStatus {
    return connectionStatus;
  }

  function getDebugState(): {
    status: ConnectionStatus;
    url: string | null;
    lastError: string | null;
  } {
    return {
      status: connectionStatus,
      url: lastSocketUrl,
      lastError: lastErrorMessage,
    };
  }

  return {
    start,
    stop,
    getConnectionStatus,
    getDebugState,
  };
}
