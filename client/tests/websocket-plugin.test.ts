import { EventEmitter } from 'node:events';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { websocketPlugin } from '../vite-plugins/websocketPlugin';

type Middleware = (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void;

const servers: http.Server[] = [];

function waitForMessage(ws: WebSocket, type?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(type ? `Timed out waiting for ${type}` : 'Timed out waiting for message'));
    }, 1000);

    const onMessage = (raw: any) => {
      const payload = JSON.parse(String(raw));
      if (!type || payload.type === type) {
        cleanup();
        resolve(payload);
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      ws.off('message', onMessage);
      ws.off('error', onError);
    };

    ws.on('message', onMessage);
    ws.on('error', onError);
  });
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
}

async function openSocket(url: string): Promise<{ ws: WebSocket; connected: Promise<any> }> {
    const ws = new WebSocket(url);
    const connected = waitForMessage(ws, 'connected');
    await waitForOpen(ws);
    return { ws, connected };
}

function requestJson(origin: string, pathname: string, init?: RequestInit) {
  return fetch(`${origin}${pathname}`, init).then(async (response) => ({
    status: response.status,
    body: await response.json(),
  }));
}

async function startPluginServer() {
  const middlewareHandlers: Middleware[] = [];
  const httpServer = http.createServer((req, res) => {
    let index = 0;
    const next = () => {
      const handler = middlewareHandlers[index++];
      if (handler) {
        handler(req, res, next);
        return;
      }
      res.statusCode = 404;
      res.end('Not found');
    };
    next();
  });

  const server = {
    httpServer,
    middlewares: {
      use(pathOrHandler: string | Middleware, maybeHandler?: Middleware) {
        if (typeof pathOrHandler === 'string') {
          const mountPath = pathOrHandler;
          const handler = maybeHandler!;
          middlewareHandlers.push((req, res, next) => {
            const pathname = new URL(req.url || '/', 'http://localhost').pathname;
            if (pathname === mountPath) {
              handler(req, res, next);
              return;
            }
            next();
          });
          return;
        }
        middlewareHandlers.push(pathOrHandler);
      },
    },
  };

  const plugin = websocketPlugin();
  const configureServer = plugin.configureServer;
  if (typeof configureServer === 'function') {
    await configureServer(server as any);
  } else {
    await configureServer?.handler(server as any);
  }

  await new Promise<void>((resolve) => httpServer.listen(0, 'localhost', resolve));
  servers.push(httpServer);
  const address = httpServer.address() as AddressInfo;
  return {
    origin: `http://localhost:${address.port}`,
    wsOrigin: `ws://localhost:${address.port}`,
    httpServer,
  };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve());
  })));
});

describe('make-project websocket plugin', () => {
  it('tracks connected clients and relays targeted messages over the legacy runtime websocket API', async () => {
    const server = await startPluginServer();
    const vscodeSocket = await openSocket(`${server.wsOrigin}/ws?client=vscode&version=1.2.3`);
    const figmaSocket = await openSocket(`${server.wsOrigin}/ws?client=figma`);
    const { ws: vscode, connected: vscodeConnected } = vscodeSocket;
    const { ws: figma, connected: figmaConnected } = figmaSocket;

    try {
      await expect(vscodeConnected).resolves.toMatchObject({ type: 'connected' });
      await expect(figmaConnected).resolves.toMatchObject({ type: 'connected' });

      const clients = await requestJson(server.origin, '/api/ws/clients');
      expect(clients.status).toBe(200);
      expect(clients.body).toMatchObject({
        total: 2,
        stats: {
          vscode: 1,
          figma: 1,
        },
      });
      expect(clients.body.clients).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'vscode', version: '1.2.3' }),
        expect.objectContaining({ type: 'figma' }),
      ]));

      const sendResult = await requestJson(server.origin, '/api/ws/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'open-file',
          payload: '/tmp/project/src/prototypes/home/index.tsx',
          targetClientTypes: ['vscode'],
        }),
      });

      expect(sendResult).toEqual({
        status: 200,
        body: {
          ok: true,
          sent: 1,
        },
      });
      await expect(waitForMessage(vscode, 'open-file')).resolves.toMatchObject({
        type: 'open-file',
        data: '/tmp/project/src/prototypes/home/index.tsx',
        payload: '/tmp/project/src/prototypes/home/index.tsx',
      });
    } finally {
      vscode.close();
      figma.close();
    }
  });

  it('does not intercept non-/ws upgrade requests so Vite HMR can keep ownership', async () => {
    const server = await startPluginServer();
    const upgradeHandled = await new Promise<boolean>((resolve) => {
      const socket = new EventEmitter() as EventEmitter & {
        write: () => void;
        destroy: () => void;
      };
      socket.write = () => resolve(true);
      socket.destroy = () => resolve(true);

      server.httpServer.emit('upgrade', {
        url: '/@vite/client',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      }, socket, Buffer.alloc(0));

      setTimeout(() => resolve(false), 20);
    });

    expect(upgradeHandled).toBe(false);
  });
});
