import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BridgeConnectionState,
  BridgeContextItem,
  BridgeMessage,
  BridgeStatusPayload,
} from '../types/opencode-bridge.types';

export interface UseAxhubBridgeReturn {
  /** Current WebSocket connection state. */
  connectionState: BridgeConnectionState;
  /** Whether the OpenCode side has at least one client connected. */
  opencodeConnected: boolean;
  /** Connect to the bridge relay. */
  connect: () => void;
  /** Disconnect from the bridge relay. */
  disconnect: () => void;
  /** Toggle connection state. */
  toggle: () => void;
  /** Add a context item. */
  addContext: (item: BridgeContextItem) => void;
  /** Update an existing context item (same id). */
  updateContext: (item: BridgeContextItem) => void;
  /** Remove a context item by id. */
  removeContext: (id: string) => void;
  /** Clear all contexts. */
  clearContext: () => void;
  /** Currently tracked context items. */
  contexts: BridgeContextItem[];
}

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_MAX_RETRIES = 5;
const HEARTBEAT_MS = 25000;

interface BridgeReconnectState {
  retries: number;
  delayMs: number;
}

interface BridgeReconnectDecision {
  shouldReconnect: boolean;
  delayMs: number;
  nextState: BridgeReconnectState;
}

export function createInitialBridgeReconnectState(): BridgeReconnectState {
  return {
    retries: 0,
    delayMs: RECONNECT_BASE_MS,
  };
}

export function getNextBridgeReconnectDecision(state: BridgeReconnectState): BridgeReconnectDecision {
  if (state.retries >= RECONNECT_MAX_RETRIES) {
    return {
      shouldReconnect: false,
      delayMs: state.delayMs,
      nextState: state,
    };
  }

  const delayMs = state.delayMs;
  return {
    shouldReconnect: true,
    delayMs,
    nextState: {
      retries: state.retries + 1,
      delayMs: Math.min(delayMs * 2, RECONNECT_MAX_MS),
    },
  };
}

function getBridgeWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/opencode-bridge/ws?role=admin`;
}

export function useAxhubBridge(): UseAxhubBridgeReturn {
  const [connectionState, setConnectionState] = useState<BridgeConnectionState>('disconnected');
  const [opencodeConnected, setOpencodeConnected] = useState(false);
  const [contexts, setContexts] = useState<BridgeContextItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectStateRef = useRef(createInitialBridgeReconnectState());
  const enabledRef = useRef(false);

  const cleanupWs = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    wsRef.current = null;
    setConnectionState('disconnected');
  }, []);

  const sendMessage = useCallback((msg: BridgeMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;
    if (!enabledRef.current) return;
    const decision = getNextBridgeReconnectDecision(reconnectStateRef.current);
    if (!decision.shouldReconnect) {
      console.debug('[Axhub Bridge] Max reconnect attempts reached, giving up');
      return;
    }
    reconnectStateRef.current = decision.nextState;
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (enabledRef.current) connectWs({ resetReconnectState: false });
    }, decision.delayMs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectWs = useCallback((options: { resetReconnectState?: boolean } = {}) => {
    if (wsRef.current) return;
    enabledRef.current = true;
    if (options.resetReconnectState !== false) {
      reconnectStateRef.current = createInitialBridgeReconnectState();
    }
    setConnectionState('connecting');

    try {
      const ws = new WebSocket(getBridgeWsUrl());
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        setConnectionState('connected');
        reconnectStateRef.current = createInitialBridgeReconnectState();

        heartbeatTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_MS);
      });

      ws.addEventListener('message', (event) => {
        try {
          const msg: BridgeMessage = JSON.parse(event.data);

          switch (msg.type) {
            case 'status': {
              const status = msg.payload as BridgeStatusPayload;
              setOpencodeConnected(status.clients.opencode > 0);
              break;
            }
            case 'context:sync': {
              const items = msg.payload as BridgeContextItem[];
              setContexts(items);
              break;
            }
            case 'context:add':
            case 'context:update': {
              const item = msg.payload as BridgeContextItem;
              setContexts((prev) => {
                const filtered = prev.filter((c) => c.id !== item.id);
                return [...filtered, item];
              });
              break;
            }
            case 'context:remove': {
              const { id } = msg.payload as { id: string };
              setContexts((prev) => prev.filter((c) => c.id !== id));
              break;
            }
            case 'context:clear':
              setContexts([]);
              break;
            case 'pong':
            case 'ping':
              if (msg.type === 'ping') {
                sendMessage({ type: 'pong' });
              }
              break;
          }
        } catch {
          // ignore parse errors
        }
      });

      ws.addEventListener('close', () => {
        cleanupWs();
        if (enabledRef.current) scheduleReconnect();
      });

      ws.addEventListener('error', () => {
        cleanupWs();
        if (enabledRef.current) scheduleReconnect();
      });
    } catch {
      cleanupWs();
      if (enabledRef.current) scheduleReconnect();
    }
  }, [cleanupWs, sendMessage, scheduleReconnect]);

  const disconnect = useCallback(() => {
    enabledRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectStateRef.current = createInitialBridgeReconnectState();
    const ws = wsRef.current;
    if (ws) {
      try { ws.close(); } catch { /* noop */ }
    }
    cleanupWs();
    setOpencodeConnected(false);
  }, [cleanupWs]);

  const toggle = useCallback(() => {
    if (enabledRef.current) {
      disconnect();
    } else {
      connectWs();
    }
  }, [connectWs, disconnect]);

  const addContext = useCallback((item: BridgeContextItem) => {
    sendMessage({ type: 'context:add', payload: item });
    setContexts((prev) => {
      const filtered = prev.filter((c) => c.id !== item.id);
      return [...filtered, item];
    });
  }, [sendMessage]);

  const updateContext = useCallback((item: BridgeContextItem) => {
    sendMessage({ type: 'context:update', payload: item });
    setContexts((prev) => prev.map((c) => (c.id === item.id ? item : c)));
  }, [sendMessage]);

  const removeContext = useCallback((id: string) => {
    sendMessage({ type: 'context:remove', payload: { id } });
    setContexts((prev) => prev.filter((c) => c.id !== id));
  }, [sendMessage]);

  const clearContext = useCallback(() => {
    sendMessage({ type: 'context:clear' });
    setContexts([]);
  }, [sendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      enabledRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      const ws = wsRef.current;
      if (ws) {
        try { ws.close(); } catch { /* noop */ }
      }
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, []);

  return {
    connectionState,
    opencodeConnected,
    connect: connectWs,
    disconnect,
    toggle,
    addContext,
    updateContext,
    removeContext,
    clearContext,
    contexts,
  };
}
