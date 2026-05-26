import http from 'node:http';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizePath } from 'vite';

type ViteConfig = {
  cacheDir?: string;
  plugins?: Array<{ name: string; handleHotUpdate?: unknown }>;
  server?: {
    headers?: Record<string, string>;
    watch?: {
      ignored?: string[];
    };
  };
};

function createRequest(url: string) {
  return {
    method: 'GET',
    url,
    headers: {},
    pipe: vi.fn(),
  } as any;
}

function createResponse() {
  const chunks: Buffer[] = [];
  const headers = new Map<string, string>();
  const response: any = {
    statusCode: 200,
    statusMessage: '',
    headersSent: false,
    writableEnded: false,
    setHeader: vi.fn((name: string, value: string | number | readonly string[]) => {
      headers.set(name.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value));
      return response;
    }),
    getHeader: vi.fn((name: string) => headers.get(name.toLowerCase())),
    hasHeader: vi.fn((name: string) => headers.has(name.toLowerCase())),
    removeHeader: vi.fn((name: string) => {
      headers.delete(name.toLowerCase());
    }),
    writeHead: vi.fn((statusCode: number, statusMessageOrHeaders?: string | Record<string, string>) => {
      response.statusCode = statusCode;
      response.headersSent = true;
      if (typeof statusMessageOrHeaders === 'string') {
        response.statusMessage = statusMessageOrHeaders;
      }
      return response;
    }),
    write: vi.fn((chunk?: string | Buffer | Uint8Array) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return true;
    }),
    end: vi.fn((chunk?: string | Buffer | Uint8Array) => {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      response.writableEnded = true;
      return response;
    }),
  };

  return {
    response,
    body: () => Buffer.concat(chunks).toString('utf8'),
    header: (name: string) => headers.get(name.toLowerCase()) || '',
  };
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.doUnmock('vite');
});

describe('make-server Vite dev middleware', () => {
  it('disables persistent browser caching without changing the optimizer config per start', async () => {
    const createServer = vi.fn(async (_config: ViteConfig) => ({
      middlewares: vi.fn(),
      transformIndexHtml: vi.fn(async (_url: string, html: string) => html),
      close: vi.fn(),
    }));
    vi.doMock('vite', () => ({ createServer, normalizePath }));

    const { createViteDevMiddleware } = await import('../viteDevServer.ts');
    const makeServerRoot = path.resolve(__dirname, '../..');

    const firstMiddleware = await createViteDevMiddleware(http.createServer(), makeServerRoot);
    const secondMiddleware = await createViteDevMiddleware(http.createServer(), makeServerRoot);

    try {
      const firstConfig = createServer.mock.calls[0]?.[0] as ViteConfig;
      const secondConfig = createServer.mock.calls[1]?.[0] as ViteConfig;
      const expectedCachePrefix = path.join(makeServerRoot, 'node_modules', '.vite', `axhub-make-dev-${process.pid}-`);

      expect(firstConfig.server?.headers?.['Cache-Control']).toBe('no-store');
      expect(secondConfig.server?.headers?.['Cache-Control']).toBe('no-store');
      expect(firstConfig.server?.watch?.ignored).toEqual(expect.arrayContaining([
        '**/client/**',
        '**/*.excalidraw',
        '**/canvas-assets/**',
      ]));
      expect(firstConfig.plugins?.some((plugin) => (
        plugin.name === 'axhub-canvas-hot-update-filter'
        && typeof plugin.handleHotUpdate === 'function'
      ))).toBe(true);
      expect(firstConfig.cacheDir?.startsWith(expectedCachePrefix)).toBe(true);
      expect(secondConfig.cacheDir?.startsWith(expectedCachePrefix)).toBe(true);
      expect(secondConfig.cacheDir).not.toBe(firstConfig.cacheDir);
      expect(firstConfig.plugins?.some((plugin) => plugin.name.startsWith('axhub-make-dev-session-'))).not.toBe(true);
      expect(secondConfig.plugins?.some((plugin) => plugin.name.startsWith('axhub-make-dev-session-'))).not.toBe(true);
    } finally {
      await firstMiddleware.close();
      await secondMiddleware.close();
    }
  });

  it('recreates Vite middleware once when an optimized dep request is stale', async () => {
    let createdServers = 0;
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    const createServer = vi.fn(async (_config: ViteConfig) => {
      createdServers += 1;
      const serverNumber = createdServers;
      return {
        middlewares: vi.fn((req: any, res: any) => {
          if (serverNumber === 1) {
            res.statusCode = 504;
            res.statusMessage = 'Outdated Optimize Dep';
            res.end();
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/javascript');
          res.end(`export const recovered = ${JSON.stringify(req.url)};`);
        }),
        transformIndexHtml: vi.fn(async (_url: string, html: string) => html),
        close: serverNumber === 1 ? firstClose : secondClose,
      };
    });
    vi.doMock('vite', () => ({ createServer, normalizePath }));

    const { createViteDevMiddleware } = await import('../viteDevServer.ts');
    const makeServerRoot = path.resolve(__dirname, '../..');
    const middleware = await createViteDevMiddleware(http.createServer(), makeServerRoot);
    const firstConfig = createServer.mock.calls[0]?.[0] as ViteConfig;
    const cacheDirName = path.basename(firstConfig.cacheDir || '');
    const { response, body } = createResponse();

    await middleware.handle(
      createRequest(`/node_modules/.vite/${cacheDirName}/deps/react.js?v=abc`),
      response,
    );

    expect(createServer).toHaveBeenCalledTimes(2);
    expect(firstClose).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(body()).toContain('recovered');

    await middleware.close();
    expect(secondClose).toHaveBeenCalledTimes(1);
  });
});
