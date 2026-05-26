import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGenieAgentWsUrl,
  createGenieIntegrationBridge,
} from './ws';

type SentMessage = {
  type: string;
  requestId?: string;
  payload?: Record<string, unknown>;
};

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(message: string): void {
    this.sent.push(message);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  emitOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({});
  }

  emitMessage(message: Record<string, unknown>): void {
    this.onmessage?.({
      data: JSON.stringify(message),
    });
  }

  emitClose(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({});
  }
}

function readSentMessage(socket: FakeWebSocket, index: number): SentMessage {
  return JSON.parse(socket.sent[index] ?? '{}') as SentMessage;
}

function stubBridgeWindow(): void {
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  });
}

afterEach(() => {
  FakeWebSocket.instances.length = 0;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('buildGenieAgentWsUrl', () => {
  it('maps http and https api base urls to websocket urls', () => {
    expect(buildGenieAgentWsUrl('http://localhost:32123/api')).toBe('ws://localhost:32123/api/agent/ws');
    expect(buildGenieAgentWsUrl('https://genie.example.com/api/')).toBe('wss://genie.example.com/api/agent/ws');
  });
});

describe('createGenieIntegrationBridge', () => {
  function createBridgeContext(overrides: Partial<Parameters<typeof createGenieIntegrationBridge>[0]> = {}) {
    stubBridgeWindow();

    const onAvailabilityChange = vi.fn();
    const bridge = createGenieIntegrationBridge({
      apiBaseUrl: 'http://localhost:32123/api',
      integrationChannel: 'project-a',
      targetClientId: 'frontend-123',
      externalClientId: 'host-001',
      probeOnStart: true,
      probeTimeoutMs: 5_000,
      onAvailabilityChange,
      ...overrides,
    });

    return {
      bridge,
      onAvailabilityChange,
    };
  }

  it('connects, probes the target frontend, and marks the bridge available when pong says online', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const { bridge, onAvailabilityChange } = createBridgeContext();
    bridge.start();

    const socket = FakeWebSocket.instances[0];
    expect(socket?.url).toBe('ws://localhost:32123/api/agent/ws');

    socket.emitOpen();
    const connectMessage = readSentMessage(socket, 0);
    expect(connectMessage.type).toBe('integration.connect');
    expect(connectMessage.payload).toEqual({
      role: 'external-client',
      channel: 'project-a',
      clientId: 'host-001',
      capabilities: ['presence.query', 'context.push'],
    });

    socket.emitMessage({
      type: 'integration.connected',
      requestId: connectMessage.requestId,
      payload: {
        connectionId: 'conn_ws_001',
      },
    });

    const pingMessage = readSentMessage(socket, 1);
    expect(pingMessage.type).toBe('integration.ping');
    expect(pingMessage.payload).toEqual({
      channel: 'project-a',
      targetClientId: 'frontend-123',
    });

    socket.emitMessage({
      type: 'integration.pong',
      requestId: pingMessage.requestId,
      payload: {
        frontend: {
          connected: true,
          count: 1,
          clients: [{ clientId: 'frontend-123' }],
        },
      },
    });

    expect(bridge.isAvailable()).toBe(true);
    expect(onAvailabilityChange).toHaveBeenLastCalledWith(true);

    bridge.stop();
  });

  it('sends integration.context.update with the contextV1 shape', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const { bridge } = createBridgeContext();
    bridge.start();

    const socket = FakeWebSocket.instances[0];
    socket.emitOpen();
    const connectMessage = readSentMessage(socket, 0);
    socket.emitMessage({
      type: 'integration.connected',
      requestId: connectMessage.requestId,
      payload: {},
    });

    const pingMessage = readSentMessage(socket, 1);
    socket.emitMessage({
      type: 'integration.pong',
      requestId: pingMessage.requestId,
      payload: {
        frontend: {
          connected: true,
          count: 1,
          clients: [{ clientId: 'frontend-123' }],
        },
      },
    });

    const sendPromise = bridge.updateContext({
      version: '1',
      systemContext: '',
      currentFile: {
        path: '/tmp/index.tsx',
        displayName: 'Demo Prototype',
      },
      selectedElements: [],
      extensions: {
        source: 'prototype-admin',
      },
    });

    const contextMessage = readSentMessage(socket, 2);
    expect(contextMessage.type).toBe('integration.context.update');
    expect(contextMessage.payload).toEqual({
      channel: 'project-a',
      targetClientId: 'frontend-123',
      mode: 'replace',
      context: {
        version: '1',
        systemContext: '',
        currentFile: {
          path: '/tmp/index.tsx',
          displayName: 'Demo Prototype',
        },
        selectedElements: [],
        extensions: {
          source: 'prototype-admin',
        },
      },
    });

    socket.emitMessage({
      type: 'integration.ack',
      requestId: contextMessage.requestId,
      payload: {
        accepted: true,
        applied: true,
      },
    });

    await sendPromise;
    bridge.stop();
  });

  it('auto-targets the only frontend in the channel when targetClientId is omitted', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const { bridge, onAvailabilityChange } = createBridgeContext({
      targetClientId: '',
    });
    bridge.start();

    const socket = FakeWebSocket.instances[0];
    socket.emitOpen();
    const connectMessage = readSentMessage(socket, 0);
    socket.emitMessage({
      type: 'integration.connected',
      requestId: connectMessage.requestId,
      payload: {},
    });

    const pingMessage = readSentMessage(socket, 1);
    expect(pingMessage.payload).toEqual({
      channel: 'project-a',
    });

    socket.emitMessage({
      type: 'integration.pong',
      requestId: pingMessage.requestId,
      payload: {
        frontend: {
          connected: true,
          count: 1,
          clients: [{ clientId: 'generated-frontend' }],
        },
      },
    });

    expect(bridge.isAvailable()).toBe(true);
    expect(onAvailabilityChange).toHaveBeenLastCalledWith(true);

    const sendPromise = bridge.updateContext({
      version: '1',
      systemContext: '',
      currentFile: {
        path: '/tmp/spec.md',
        displayName: 'Spec',
      },
      selectedElements: [],
    });

    const contextMessage = readSentMessage(socket, 2);
    expect(contextMessage.type).toBe('integration.context.update');
    expect(contextMessage.payload).toEqual({
      channel: 'project-a',
      targetClientId: 'generated-frontend',
      mode: 'replace',
      context: {
        version: '1',
        systemContext: '',
        currentFile: {
          path: '/tmp/spec.md',
          displayName: 'Spec',
        },
        selectedElements: [],
      },
    });

    socket.emitMessage({
      type: 'integration.ack',
      requestId: contextMessage.requestId,
      payload: {
        accepted: true,
        applied: true,
      },
    });

    await sendPromise;
    bridge.stop();
  });

  it('resolves a matching frontend client when multiple Genie pages share the channel', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const { bridge } = createBridgeContext({
      targetClientId: '',
    });
    bridge.start();

    const socket = FakeWebSocket.instances[0];
    socket.emitOpen();
    const connectMessage = readSentMessage(socket, 0);
    socket.emitMessage({
      type: 'integration.connected',
      requestId: connectMessage.requestId,
      payload: {},
    });

    const pingMessage = readSentMessage(socket, 1);
    socket.emitMessage({
      type: 'integration.pong',
      requestId: pingMessage.requestId,
      payload: {
        frontend: {
          connected: true,
          count: 2,
          clients: [
            {
              clientId: 'frontend-old',
              pageUrl:
                'http://localhost:32123/?cwd=%2Ftmp%2Fproject&integrationWs=1&targetPath=src%2Fprototypes%2Fold%2Findex.tsx',
              lastSeenAt: '2026-05-17T09:30:00.000Z',
            },
            {
              clientId: 'frontend-current',
              pageUrl:
                'http://localhost:32123/?cwd=%2Ftmp%2Fproject&integrationWs=1&targetPath=src%2Fprototypes%2Fcurrent%2Findex.tsx',
              lastSeenAt: '2026-05-17T09:31:00.000Z',
            },
          ],
        },
      },
    });

    const sendPromise = bridge.updateContext({
      version: '1',
      systemContext: '',
      currentFile: {
        path: 'src/prototypes/current/index.tsx',
        displayName: 'Current',
      },
      selectedElements: [],
    });

    const contextMessage = readSentMessage(socket, 2);
    expect(contextMessage.type).toBe('integration.context.update');
    expect(contextMessage.payload).toMatchObject({
      channel: 'project-a',
      targetClientId: 'frontend-current',
      mode: 'replace',
    });

    socket.emitMessage({
      type: 'integration.ack',
      requestId: contextMessage.requestId,
      payload: {
        accepted: true,
        applied: true,
      },
    });

    await sendPromise;
    bridge.stop();
  });

  it('keeps using the resolved frontend client after the Admin current file changes', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const { bridge } = createBridgeContext({
      targetClientId: '',
    });
    bridge.start();

    const socket = FakeWebSocket.instances[0];
    socket.emitOpen();
    const connectMessage = readSentMessage(socket, 0);
    socket.emitMessage({
      type: 'integration.connected',
      requestId: connectMessage.requestId,
      payload: {},
    });

    const pingMessage = readSentMessage(socket, 1);
    socket.emitMessage({
      type: 'integration.pong',
      requestId: pingMessage.requestId,
      payload: {
        frontend: {
          connected: true,
          count: 2,
          clients: [
            {
              clientId: 'frontend-current',
              pageUrl:
                'http://localhost:32123/?cwd=%2Ftmp%2Fproject&integrationWs=1&targetPath=src%2Fprototypes%2Finitial%2Findex.tsx',
              lastSeenAt: '2026-05-17T09:31:00.000Z',
            },
            {
              clientId: 'frontend-other',
              pageUrl:
                'http://localhost:32123/?cwd=%2Ftmp%2Fproject&integrationWs=1&targetPath=src%2Fprototypes%2Fother%2Findex.tsx',
              lastSeenAt: '2026-05-17T09:32:00.000Z',
            },
          ],
        },
      },
    });

    const firstSendPromise = bridge.updateContext({
      version: '1',
      systemContext: '',
      currentFile: {
        path: 'src/prototypes/initial/index.tsx',
        displayName: 'Initial',
      },
      selectedElements: [],
    });
    const firstContextMessage = readSentMessage(socket, 2);
    expect(firstContextMessage.payload?.targetClientId).toBe('frontend-current');
    socket.emitMessage({
      type: 'integration.ack',
      requestId: firstContextMessage.requestId,
      payload: {
        accepted: true,
        applied: true,
      },
    });
    await firstSendPromise;

    const secondSendPromise = bridge.updateContext({
      version: '1',
      systemContext: '',
      currentFile: {
        path: 'src/prototypes/next/index.tsx',
        displayName: 'Next',
      },
      selectedElements: [],
    });
    const secondContextMessage = readSentMessage(socket, 3);
    expect(secondContextMessage.payload?.targetClientId).toBe('frontend-current');

    socket.emitMessage({
      type: 'integration.ack',
      requestId: secondContextMessage.requestId,
      payload: {
        accepted: true,
        applied: true,
      },
    });

    await secondSendPromise;
    bridge.stop();
  });

  it('uses the opened Genie page URL to resolve the frontend after Admin switches current files', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const openedPageUrl =
      'http://localhost:32123/?cwd=%2Ftmp%2Fproject&targetPath=src%2Fprototypes%2Finitial%2Findex.tsx&integrationWs=1&context=%7B%22version%22%3A%221%22%7D';
    const { bridge } = createBridgeContext({
      targetClientId: '',
      targetPageUrl: () => openedPageUrl,
    });
    bridge.start();

    const socket = FakeWebSocket.instances[0];
    socket.emitOpen();
    const connectMessage = readSentMessage(socket, 0);
    expect(connectMessage.payload).toMatchObject({
      pageUrl: openedPageUrl,
    });
    socket.emitMessage({
      type: 'integration.connected',
      requestId: connectMessage.requestId,
      payload: {},
    });

    const pingMessage = readSentMessage(socket, 1);
    socket.emitMessage({
      type: 'integration.pong',
      requestId: pingMessage.requestId,
      payload: {
        frontend: {
          connected: true,
          count: 2,
          clients: [
            {
              clientId: 'frontend-frame',
              pageUrl:
                'http://localhost:32123/?targetPath=src%2Fprototypes%2Finitial%2Findex.tsx&cwd=%2Ftmp%2Fproject&integrationWs=1',
              lastSeenAt: '2026-05-17T09:31:00.000Z',
            },
            {
              clientId: 'frontend-other',
              pageUrl:
                'http://localhost:32123/?targetPath=src%2Fprototypes%2Fother%2Findex.tsx&cwd=%2Ftmp%2Fproject&integrationWs=1',
              lastSeenAt: '2026-05-17T09:32:00.000Z',
            },
          ],
        },
      },
    });

    const sendPromise = bridge.updateContext({
      version: '1',
      systemContext: '',
      currentFile: {
        path: 'src/prototypes/next/index.tsx',
        displayName: 'Next',
      },
      selectedElements: [],
    });

    const contextMessage = readSentMessage(socket, 2);
    expect(contextMessage.payload?.targetClientId).toBe('frontend-frame');

    socket.emitMessage({
      type: 'integration.ack',
      requestId: contextMessage.requestId,
      payload: {
        accepted: true,
        applied: true,
      },
    });

    await sendPromise;
    bridge.stop();
  });

  it('keeps the bridge available when an unrelated frontend page goes offline', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const { bridge, onAvailabilityChange } = createBridgeContext({
      targetClientId: '',
    });
    bridge.start();

    const socket = FakeWebSocket.instances[0];
    socket.emitOpen();
    const connectMessage = readSentMessage(socket, 0);
    socket.emitMessage({
      type: 'integration.connected',
      requestId: connectMessage.requestId,
      payload: {},
    });

    const pingMessage = readSentMessage(socket, 1);
    socket.emitMessage({
      type: 'integration.pong',
      requestId: pingMessage.requestId,
      payload: {
        frontend: {
          connected: true,
          count: 2,
          clients: [
            {
              clientId: 'frontend-current',
              pageUrl:
                'http://localhost:32123/?targetPath=src%2Fprototypes%2Finitial%2Findex.tsx',
              lastSeenAt: '2026-05-17T09:31:00.000Z',
            },
            {
              clientId: 'frontend-other',
              pageUrl:
                'http://localhost:32123/?targetPath=src%2Fprototypes%2Fother%2Findex.tsx',
              lastSeenAt: '2026-05-17T09:32:00.000Z',
            },
          ],
        },
      },
    });

    const firstSendPromise = bridge.updateContext({
      version: '1',
      systemContext: '',
      currentFile: {
        path: 'src/prototypes/initial/index.tsx',
        displayName: 'Initial',
      },
      selectedElements: [],
    });
    const firstContextMessage = readSentMessage(socket, 2);
    expect(firstContextMessage.payload?.targetClientId).toBe('frontend-current');
    socket.emitMessage({
      type: 'integration.ack',
      requestId: firstContextMessage.requestId,
      payload: {
        accepted: true,
        applied: true,
      },
    });
    await firstSendPromise;

    socket.emitMessage({
      type: 'integration.presence',
      payload: {
        channel: 'project-a',
        event: 'frontend-offline',
        clientId: 'frontend-other',
      },
    });

    expect(bridge.isAvailable()).toBe(true);
    expect(onAvailabilityChange).toHaveBeenLastCalledWith(true);

    const secondSendPromise = bridge.updateContext({
      version: '1',
      systemContext: '',
      currentFile: {
        path: 'src/prototypes/next/index.tsx',
        displayName: 'Next',
      },
      selectedElements: [],
    });
    const secondContextMessage = readSentMessage(socket, 3);
    expect(secondContextMessage.payload?.targetClientId).toBe('frontend-current');
    socket.emitMessage({
      type: 'integration.ack',
      requestId: secondContextMessage.requestId,
      payload: {
        accepted: true,
        applied: true,
      },
    });

    await secondSendPromise;
    bridge.stop();
  });

  it('rejects updateContext when the target frontend is offline', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const { bridge } = createBridgeContext();
    bridge.start();

    const socket = FakeWebSocket.instances[0];
    socket.emitOpen();
    const connectMessage = readSentMessage(socket, 0);
    socket.emitMessage({
      type: 'integration.connected',
      requestId: connectMessage.requestId,
      payload: {},
    });

    const pingMessage = readSentMessage(socket, 1);
    socket.emitMessage({
      type: 'integration.pong',
      requestId: pingMessage.requestId,
      payload: {
        frontend: {
          connected: false,
          count: 0,
          clients: [],
        },
      },
    });

    await expect(bridge.updateContext({
      version: '1',
      systemContext: '',
      currentFile: {
        path: '/tmp/spec.md',
        displayName: 'Spec',
      },
      selectedElements: [],
    })).rejects.toThrow('Genie 页面未在线，请先打开对应 Genie 页面。');

    bridge.stop();
  });
});
