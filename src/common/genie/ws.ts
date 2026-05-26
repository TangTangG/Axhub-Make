import type { GenieContextV1 } from './types';

const GENIE_RECONNECT_DELAY_MS = 3_000;
const GENIE_CONTEXT_REQUEST_TIMEOUT_MS = 5_000;
const GENIE_MAX_RECONNECT_ATTEMPTS = 5;
const GENIE_PROBE_RETRY_DELAY_MS = 1_500;
const GENIE_MAX_PROBE_ATTEMPTS = 3;
const GENIE_PAGE_OFFLINE_MESSAGE = 'Genie 页面未在线，请先打开对应 Genie 页面。';
const GENIE_BRIDGE_CONFIG_ERROR = 'AI 连接配置不完整。';
const GENIE_BRIDGE_NOT_CONNECTED_ERROR = 'AI 连接未建立，请稍后重试。';

type PendingRequest = {
  resolve: () => void;
  reject: (reason?: unknown) => void;
  timeoutId: number;
};

type GenieWsMessage = {
  type?: string;
  requestId?: string;
  payload?: Record<string, any>;
};

type GenieFrontendClient = {
  clientId: string;
  pageUrl: string;
  sessionId: string;
  lastSeenAt: string;
  connectedAt: string;
};

export interface GenieIntegrationBridgeOptions {
  apiBaseUrl: string;
  integrationChannel: string;
  targetClientId?: string;
  externalClientId: string;
  apiKey?: string;
  probeOnStart?: boolean;
  probeTimeoutMs?: number;
  targetPageUrl?: string | (() => string | null | undefined);
  onAvailabilityChange?: (available: boolean) => void;
}

export interface GenieIntegrationBridge {
  start(): void;
  stop(): void;
  isAvailable(): boolean;
  updateContext(context: GenieContextV1, mode?: 'replace' | 'append'): Promise<void>;
}

function createRequestId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}

function getTimeoutMs(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.max(100, Math.round(value));
}

function isMessageRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object';
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePath(value: unknown): string {
  const normalized = normalizeText(value).replace(/\\/g, '/');
  return normalized.replace(/^\.\//u, '');
}

function pathsReferToSameFile(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  return (
    normalizedLeft.endsWith(`/${normalizedRight}`)
    || normalizedRight.endsWith(`/${normalizedLeft}`)
  );
}

function normalizeUrl(value: unknown): string {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  try {
    return new URL(normalized, 'http://localhost').toString();
  } catch {
    return normalized;
  }
}

function parseTimestamp(value: unknown): number {
  const normalized = normalizeText(value);
  if (!normalized) return 0;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getClientTimestamp(client: GenieFrontendClient): number {
  return Math.max(
    parseTimestamp(client.lastSeenAt),
    parseTimestamp(client.connectedAt),
  );
}

function pickMostRecentClient(clients: readonly GenieFrontendClient[]): GenieFrontendClient | null {
  return clients.slice().sort((left, right) => getClientTimestamp(right) - getClientTimestamp(left))[0] ?? null;
}

function readContextCurrentFilePath(context: GenieContextV1 | null | undefined): string {
  const currentFile = context?.currentFile;
  if (typeof currentFile === 'string') {
    return normalizePath(currentFile);
  }
  if (isMessageRecord(currentFile)) {
    return normalizePath(currentFile.path);
  }
  return '';
}

function readContextCurrentFilePathFromPageUrl(pageUrl: string): string {
  const normalizedPageUrl = normalizeText(pageUrl);
  if (!normalizedPageUrl) return '';

  try {
    const url = new URL(normalizedPageUrl, 'http://localhost');
    const targetPath = normalizePath(url.searchParams.get('targetPath'));
    if (targetPath) {
      return targetPath;
    }

    const rawContext = normalizeText(url.searchParams.get('context'));
    if (!rawContext) {
      return '';
    }

    const parsedContext = JSON.parse(rawContext) as Partial<GenieContextV1>;
    return readContextCurrentFilePath(parsedContext as GenieContextV1);
  } catch {
    return '';
  }
}

function readFrontendClients(message: GenieWsMessage): GenieFrontendClient[] {
  const payload = message.payload;
  if (!payload || typeof payload !== 'object') return [];

  const frontend = payload.frontend;
  if (!isMessageRecord(frontend) || !Array.isArray(frontend.clients)) return [];

  return frontend.clients
    .map((item): GenieFrontendClient | null => {
      if (!isMessageRecord(item)) return null;
      const clientId = normalizeText(item.clientId);
      if (!clientId) return null;
      return {
        clientId,
        pageUrl: normalizeText(item.pageUrl),
        sessionId: normalizeText(item.sessionId),
        lastSeenAt: normalizeText(item.lastSeenAt),
        connectedAt: normalizeText(item.connectedAt),
      };
    })
    .filter((item): item is GenieFrontendClient => item !== null);
}

function clientMatchesContext(client: GenieFrontendClient, context: GenieContextV1 | null | undefined): boolean {
  const currentFilePath = readContextCurrentFilePath(context);
  if (!currentFilePath) return false;
  return pathsReferToSameFile(readContextCurrentFilePathFromPageUrl(client.pageUrl), currentFilePath);
}

function clientMatchesTargetPageUrl(client: GenieFrontendClient, targetPageUrl: string): boolean {
  const normalizedTargetPageUrl = normalizeUrl(targetPageUrl);
  if (!normalizedTargetPageUrl) return false;

  if (normalizeUrl(client.pageUrl) === normalizedTargetPageUrl) {
    return true;
  }

  return pathsReferToSameFile(
    readContextCurrentFilePathFromPageUrl(client.pageUrl),
    readContextCurrentFilePathFromPageUrl(normalizedTargetPageUrl),
  );
}

function readFrontendConnected(message: GenieWsMessage, targetClientId?: string): boolean {
  const payload = message.payload;
  if (!payload || typeof payload !== 'object') return false;

  const frontend = payload.frontend;
  if (!isMessageRecord(frontend)) return false;

  const normalizedTargetClientId = String(targetClientId ?? '').trim();

  if (typeof frontend.connected === 'boolean') {
    if (!normalizedTargetClientId) {
      return frontend.connected;
    }
    if (frontend.connected === false) {
      return false;
    }
  }

  if (!Array.isArray(frontend.clients)) return false;

  if (!normalizedTargetClientId) {
    return frontend.clients.length > 0;
  }

  return frontend.clients.some((item) => isMessageRecord(item) && item.clientId === normalizedTargetClientId);
}

function mapIntegrationErrorMessage(code: unknown, message: unknown): string {
  if (code === 'FRONTEND_NOT_ONLINE') {
    return GENIE_PAGE_OFFLINE_MESSAGE;
  }

  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  if (normalizedMessage) {
    return normalizedMessage;
  }

  if (typeof code === 'string' && code.trim()) {
    return `Genie 集成失败：${code.trim()}`;
  }

  return 'Genie 集成失败，请稍后重试。';
}

export function buildGenieAgentWsUrl(apiBaseUrl: string, apiKey?: string): string {
  const trimmed = String(apiBaseUrl ?? '').trim();
  if (!trimmed) {
    throw new Error(GENIE_BRIDGE_CONFIG_ERROR);
  }

  const url = new URL(trimmed);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/agent/ws`;

  const normalizedApiKey = String(apiKey ?? '').trim();
  if (normalizedApiKey) {
    url.searchParams.set('apiKey', normalizedApiKey);
  } else {
    url.searchParams.delete('apiKey');
  }

  return url.toString();
}

export function createGenieIntegrationBridge(
  options: GenieIntegrationBridgeOptions,
): GenieIntegrationBridge {
  let active = false;
  let available = false;
  let socket: WebSocket | null = null;
  let connectRequestId: string | null = null;
  let probeRequestId: string | null = null;
  let probeTimeoutId: number | null = null;
  let probeRetryTimerId: number | null = null;
  let reconnectTimerId: number | null = null;
  let reconnectAttemptCount = 0;
  let probeAttemptCount = 0;
  let resolvedTargetClientId = '';
  let latestContext: GenieContextV1 | null = null;
  let latestFrontendClients: GenieFrontendClient[] = [];
  const pendingRequests = new Map<string, PendingRequest>();

  function notifyAvailability(nextValue: boolean): void {
    if (available === nextValue) return;
    available = nextValue;
    options.onAvailabilityChange?.(nextValue);
  }

  function hasRequiredConfig(): boolean {
    return (
      String(options.apiBaseUrl).trim().length > 0
      && String(options.integrationChannel).trim().length > 0
      && String(options.externalClientId).trim().length > 0
    );
  }

  function getExplicitTargetClientId(): string {
    return normalizeText(options.targetClientId);
  }

  function getTargetPageUrl(): string {
    const value = typeof options.targetPageUrl === 'function'
      ? options.targetPageUrl()
      : options.targetPageUrl;
    return normalizeUrl(value);
  }

  function rememberFrontendClients(clients: GenieFrontendClient[]): void {
    latestFrontendClients = clients;
    if (
      resolvedTargetClientId
      && !latestFrontendClients.some((client) => client.clientId === resolvedTargetClientId)
    ) {
      resolvedTargetClientId = '';
    }
  }

  function resolveTargetClientId(context: GenieContextV1 | null | undefined): string {
    const explicitTargetClientId = getExplicitTargetClientId();
    if (explicitTargetClientId) {
      return explicitTargetClientId;
    }

    if (
      resolvedTargetClientId
      && latestFrontendClients.some((client) => client.clientId === resolvedTargetClientId)
    ) {
      return resolvedTargetClientId;
    }

    const targetPageUrl = getTargetPageUrl();
    if (targetPageUrl) {
      const pageMatches = latestFrontendClients.filter((client) => clientMatchesTargetPageUrl(client, targetPageUrl));
      const matchedClient = pickMostRecentClient(pageMatches);
      if (matchedClient) {
        resolvedTargetClientId = matchedClient.clientId;
        return matchedClient.clientId;
      }
    }

    const contextMatches = latestFrontendClients.filter((client) => clientMatchesContext(client, context));
    const matchedClient = pickMostRecentClient(contextMatches);
    if (matchedClient) {
      resolvedTargetClientId = matchedClient.clientId;
      return matchedClient.clientId;
    }

    if (latestFrontendClients.length === 1) {
      const onlyClient = latestFrontendClients[0];
      resolvedTargetClientId = onlyClient.clientId;
      return onlyClient.clientId;
    }

    return '';
  }

  function rememberPresenceClient(payload: Record<string, any>): void {
    const clientId = normalizeText(payload.clientId);
    if (!clientId) return;

    const client: GenieFrontendClient = {
      clientId,
      pageUrl: normalizeText(payload.pageUrl),
      sessionId: normalizeText(payload.sessionId),
      lastSeenAt: normalizeText(payload.timestamp),
      connectedAt: normalizeText(payload.timestamp),
    };
    const nextClients = latestFrontendClients.filter((item) => item.clientId !== clientId);
    rememberFrontendClients([...nextClients, client]);

    const explicitTargetClientId = getExplicitTargetClientId();
    if (explicitTargetClientId) return;

    const targetPageUrl = getTargetPageUrl();
    const pageMatches = Boolean(targetPageUrl && clientMatchesTargetPageUrl(client, targetPageUrl));
    const contextMatches = clientMatchesContext(client, latestContext);
    if (pageMatches || contextMatches || (!resolvedTargetClientId && latestFrontendClients.length === 1)) {
      resolvedTargetClientId = clientId;
    }
  }

  function clearProbeTimeout(): void {
    if (probeTimeoutId === null) return;
    window.clearTimeout(probeTimeoutId);
    probeTimeoutId = null;
  }

  function clearProbeRetryTimer(): void {
    if (probeRetryTimerId === null) return;
    window.clearTimeout(probeRetryTimerId);
    probeRetryTimerId = null;
  }

  function clearReconnectTimer(): void {
    if (reconnectTimerId === null) return;
    window.clearTimeout(reconnectTimerId);
    reconnectTimerId = null;
  }

  function clearPendingRequest(requestId: string): void {
    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    window.clearTimeout(pending.timeoutId);
    pendingRequests.delete(requestId);
  }

  function rejectPendingRequest(requestId: string, message: string, code?: unknown): void {
    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    window.clearTimeout(pending.timeoutId);
    pendingRequests.delete(requestId);
    if (code === 'FRONTEND_NOT_ONLINE') {
      notifyAvailability(false);
    }
    pending.reject(new Error(message));
  }

  function resolvePendingRequest(requestId: string): void {
    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    window.clearTimeout(pending.timeoutId);
    pendingRequests.delete(requestId);
    pending.resolve();
  }

  function rejectAllPendingRequests(message: string): void {
    for (const [requestId, pending] of pendingRequests.entries()) {
      window.clearTimeout(pending.timeoutId);
      pending.reject(new Error(message));
      pendingRequests.delete(requestId);
    }
  }

  function createPendingRequest(requestId: string, timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error('等待 Genie 响应超时，请稍后重试。'));
      }, timeoutMs);
      pendingRequests.set(requestId, { resolve, reject, timeoutId });
    });
  }

  function sendSocketMessage(message: Record<string, unknown>): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error(GENIE_BRIDGE_NOT_CONNECTED_ERROR);
    }
    socket.send(JSON.stringify(message));
  }

  function scheduleReconnect(): void {
    if (!active || !hasRequiredConfig() || reconnectTimerId !== null) return;
    if (reconnectAttemptCount >= GENIE_MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    reconnectAttemptCount += 1;
    reconnectTimerId = window.setTimeout(() => {
      reconnectTimerId = null;
      connectSocket();
    }, GENIE_RECONNECT_DELAY_MS);
  }

  function resetProbeRetries(): void {
    probeAttemptCount = 0;
    clearProbeRetryTimer();
  }

  function scheduleProbeRetry(): void {
    if (!active || !hasRequiredConfig() || probeRetryTimerId !== null) return;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (probeAttemptCount >= GENIE_MAX_PROBE_ATTEMPTS) {
      return;
    }

    probeAttemptCount += 1;
    probeRetryTimerId = window.setTimeout(() => {
      probeRetryTimerId = null;
      void probeFrontendPresence();
    }, GENIE_PROBE_RETRY_DELAY_MS);
  }

  function handleSocketClose(currentSocket: WebSocket): void {
    if (socket !== currentSocket) return;
    socket = null;
    connectRequestId = null;
    probeRequestId = null;
    clearProbeTimeout();
    clearProbeRetryTimer();
    notifyAvailability(false);
    rejectAllPendingRequests('AI 连接已断开，请稍后重试。');
    scheduleReconnect();
  }

  function handleSocketMessage(event: MessageEvent<string>): void {
    let parsed: GenieWsMessage | null = null;
    try {
      parsed = JSON.parse(event.data) as GenieWsMessage;
    } catch {
      return;
    }

    if (!parsed?.type) return;

    if (parsed.type === 'integration.connected') {
      reconnectAttemptCount = 0;
      resetProbeRetries();
      if (parsed.requestId === connectRequestId && options.probeOnStart !== false) {
        void probeFrontendPresence();
      }
      return;
    }

    if (parsed.type === 'integration.pong') {
      if (parsed.requestId !== probeRequestId) return;
      probeRequestId = null;
      clearProbeTimeout();
      rememberFrontendClients(readFrontendClients(parsed));
      const frontendConnected = readFrontendConnected(parsed, options.targetClientId);
      notifyAvailability(frontendConnected);
      if (frontendConnected) {
        resetProbeRetries();
      } else {
        scheduleProbeRetry();
      }
      return;
    }

    if (parsed.type === 'integration.presence') {
      const payload = parsed.payload;
      const normalizedTargetClientId = String(options.targetClientId ?? '').trim();
      if (
        !payload
        || payload.channel !== options.integrationChannel
        || (normalizedTargetClientId && payload.clientId !== normalizedTargetClientId)
      ) {
        return;
      }
      if (payload.event === 'frontend-online') {
        rememberPresenceClient(payload);
        resetProbeRetries();
        notifyAvailability(true);
      } else if (payload.event === 'frontend-offline') {
        const offlineClientId = normalizeText(payload.clientId);
        if (offlineClientId === resolvedTargetClientId) {
          resolvedTargetClientId = '';
        }
        rememberFrontendClients(
          latestFrontendClients.filter((client) => client.clientId !== offlineClientId),
        );
        notifyAvailability(Boolean(normalizedTargetClientId) ? false : latestFrontendClients.length > 0);
      }
      return;
    }

    if (parsed.type === 'integration.ack' && parsed.requestId) {
      resolvePendingRequest(parsed.requestId);
      return;
    }

    if (parsed.type === 'integration.error') {
      const payload = parsed.payload;
      const message = mapIntegrationErrorMessage(payload?.code, payload?.message);

      if (parsed.requestId === probeRequestId) {
        probeRequestId = null;
        clearProbeTimeout();
        notifyAvailability(false);
        scheduleProbeRetry();
      }

      if (parsed.requestId) {
        rejectPendingRequest(parsed.requestId, message, payload?.code);
      }
    }
  }

  function connectSocket(): void {
    if (!active || !hasRequiredConfig() || socket) return;

    let nextSocket: WebSocket;
    try {
      nextSocket = new WebSocket(buildGenieAgentWsUrl(options.apiBaseUrl, options.apiKey));
    } catch {
      notifyAvailability(false);
      scheduleReconnect();
      return;
    }

    socket = nextSocket;
    nextSocket.onopen = () => {
      if (socket !== nextSocket) return;
      clearReconnectTimer();
      reconnectAttemptCount = 0;
      connectRequestId = createRequestId('genie_connect');
      try {
        const targetPageUrl = getTargetPageUrl();
        sendSocketMessage({
          type: 'integration.connect',
          requestId: connectRequestId,
          payload: {
            role: 'external-client',
            channel: options.integrationChannel,
            clientId: options.externalClientId,
            ...(targetPageUrl ? { pageUrl: targetPageUrl } : {}),
            capabilities: ['presence.query', 'context.push'],
          },
        });
      } catch {
        nextSocket.close();
      }
    };
    nextSocket.onmessage = handleSocketMessage;
    nextSocket.onerror = () => {
      notifyAvailability(false);
    };
    nextSocket.onclose = () => {
      handleSocketClose(nextSocket);
    };
  }

  async function probeFrontendPresence(): Promise<void> {
    if (!active || !hasRequiredConfig()) return;

    const requestId = createRequestId('genie_probe');
    const timeoutMs = getTimeoutMs(options.probeTimeoutMs, GENIE_CONTEXT_REQUEST_TIMEOUT_MS);

    probeRequestId = requestId;
    clearProbeTimeout();

    try {
      const pingTargetClientId = getExplicitTargetClientId() || resolvedTargetClientId;
      sendSocketMessage({
        type: 'integration.ping',
        requestId,
        payload: {
          channel: options.integrationChannel,
          ...(pingTargetClientId
            ? { targetClientId: pingTargetClientId }
            : {}),
        },
      });
    } catch {
      probeRequestId = null;
      notifyAvailability(false);
      scheduleProbeRetry();
      return;
    }

    probeTimeoutId = window.setTimeout(() => {
      if (probeRequestId !== requestId) return;
      probeRequestId = null;
      notifyAvailability(false);
      scheduleProbeRetry();
    }, timeoutMs);
  }

  async function updateContext(
    context: GenieContextV1,
    mode: 'replace' | 'append' = 'replace',
  ): Promise<void> {
    if (!hasRequiredConfig()) {
      throw new Error(GENIE_BRIDGE_CONFIG_ERROR);
    }

    if (!available) {
      throw new Error(GENIE_PAGE_OFFLINE_MESSAGE);
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error(GENIE_BRIDGE_NOT_CONNECTED_ERROR);
    }

    const requestId = createRequestId('genie_context');
    latestContext = context;
    const resolvedTargetClientIdForContext = resolveTargetClientId(context);
    const request = createPendingRequest(
      requestId,
      getTimeoutMs(options.probeTimeoutMs, GENIE_CONTEXT_REQUEST_TIMEOUT_MS),
    );

    try {
      sendSocketMessage({
        type: 'integration.context.update',
        requestId,
        payload: {
          channel: options.integrationChannel,
          ...(resolvedTargetClientIdForContext
            ? { targetClientId: resolvedTargetClientIdForContext }
            : {}),
          mode,
          context,
        },
      });
    } catch (error) {
      clearPendingRequest(requestId);
      throw error;
    }

    await request;
  }

  function stop(): void {
    active = false;
    clearReconnectTimer();
    clearProbeTimeout();
    clearProbeRetryTimer();
    probeRequestId = null;
    connectRequestId = null;
    reconnectAttemptCount = 0;
    probeAttemptCount = 0;
    rejectAllPendingRequests('Genie bridge 已停止。');

    const currentSocket = socket;
    socket = null;
    if (currentSocket) {
      currentSocket.onopen = null;
      currentSocket.onmessage = null;
      currentSocket.onerror = null;
      currentSocket.onclose = null;
      currentSocket.close();
    }

    notifyAvailability(false);
  }

  function start(): void {
    if (active) {
      if ((options.probeOnStart ?? true) && socket?.readyState === WebSocket.OPEN) {
        void probeFrontendPresence();
      }
      return;
    }

    active = true;
    notifyAvailability(false);
    reconnectAttemptCount = 0;
    probeAttemptCount = 0;
    clearProbeRetryTimer();

    if (!hasRequiredConfig() || typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return;
    }

    connectSocket();
  }

  return {
    start,
    stop,
    isAvailable() {
      return available;
    },
    updateContext,
  };
}
