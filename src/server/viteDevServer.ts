/**
 * Vite dev server integration for middleware mode.
 *
 * In development, Vite runs as middleware inside the existing Node HTTP server,
 * providing HMR for frontend code while sharing the same port as the API server.
 * In production this module is never imported.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type http from 'node:http';

import fs from 'node:fs';
import path from 'node:path';

import { canvasHotUpdateFilterPlugin } from './canvasHotUpdateFilter.ts';

function importRuntimePackage<T = any>(packageName: string): Promise<T> {
  return import(packageName) as Promise<T>;
}

export interface ViteDevMiddleware {
  /** Pass a request to Vite's connect middleware stack (modules, assets, HMR). */
  handle: (req: IncomingMessage, res: ServerResponse, next?: () => void) => void | Promise<void>;
  /**
   * Read an HTML file, apply Vite's transformIndexHtml (HMR client injection,
   * React refresh preamble, plugin transforms), then append a custom script.
   */
  transformHtml: (url: string, htmlPath: string, extraHeadHtml?: string) => Promise<string>;
  /** Gracefully shut down the Vite dev server. */
  close: () => Promise<void>;
}

type ViteServer = {
  middlewares: (req: IncomingMessage, res: ServerResponse, next?: () => void) => void;
  transformIndexHtml: (url: string, html: string) => Promise<string>;
  close: () => Promise<void>;
};

type CapturedHeaderValue = string | number | string[];

type CapturedViteResult =
  | { kind: 'next' }
  | {
    kind: 'response';
    statusCode: number;
    statusMessage: string;
    headers: Array<[string, CapturedHeaderValue]>;
    chunks: Buffer[];
  };

function normalizeHeaderName(name: string | number | symbol): string {
  return String(name).toLowerCase();
}

function isOutdatedOptimizedDepResponse(result: CapturedViteResult): boolean {
  return result.kind === 'response'
    && result.statusCode === 504
    && result.statusMessage === 'Outdated Optimize Dep';
}

function isEmbeddedOptimizedDepRequest(requestUrl: string, cacheDir: string): boolean {
  const pathname = requestUrl.split('?')[0] || '';
  let decodedPathname = pathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    // Keep raw pathname when decoding fails.
  }

  const normalizedPathname = decodedPathname.replace(/\\/gu, '/');
  const cacheDirName = path.basename(cacheDir);
  if (normalizedPathname.includes(`/node_modules/.vite/${cacheDirName}/deps/`)) {
    return true;
  }

  const normalizedCacheDir = path.resolve(cacheDir).replace(/\\/gu, '/');
  return normalizedPathname.startsWith(`/@fs/${normalizedCacheDir}/deps/`);
}

function flushCapturedResponse(res: ServerResponse, result: Extract<CapturedViteResult, { kind: 'response' }>): void {
  res.statusCode = result.statusCode;
  if (result.statusMessage) {
    res.statusMessage = result.statusMessage;
  }
  for (const [name, value] of result.headers) {
    res.setHeader(name, value);
  }
  res.end(result.chunks.length > 0 ? Buffer.concat(result.chunks) : undefined);
}

function captureViteResponse(
  vite: ViteServer,
  req: IncomingMessage,
  res: ServerResponse,
  next?: () => void,
): Promise<CapturedViteResult> {
  const originalStatusCode = res.statusCode;
  const originalStatusMessage = res.statusMessage;
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  const originalWriteHead = res.writeHead.bind(res);
  const originalSetHeader = res.setHeader.bind(res);
  const originalGetHeader = res.getHeader.bind(res);
  const originalHasHeader = res.hasHeader.bind(res);
  const originalRemoveHeader = res.removeHeader.bind(res);
  const headers = new Map<string, { name: string; value: CapturedHeaderValue }>();
  const chunks: Buffer[] = [];

  let resolved = false;
  let capturedStatusCode = originalStatusCode;
  let capturedStatusMessage = originalStatusMessage || '';

  function restoreResponse() {
    res.write = originalWrite as ServerResponse['write'];
    res.end = originalEnd as ServerResponse['end'];
    res.writeHead = originalWriteHead as ServerResponse['writeHead'];
    res.setHeader = originalSetHeader;
    res.getHeader = originalGetHeader;
    res.hasHeader = originalHasHeader;
    res.removeHeader = originalRemoveHeader;
    res.statusCode = originalStatusCode;
    res.statusMessage = originalStatusMessage;
  }

  return new Promise<CapturedViteResult>((resolve, reject) => {
    function setCapturedHeaderValue(name: string, value: string | number | readonly string[]): void {
      let capturedValue: CapturedHeaderValue;
      if (typeof value === 'number' || typeof value === 'string') {
        capturedValue = value;
      } else {
        capturedValue = value.map((item) => String(item));
      }
      headers.set(normalizeHeaderName(name), {
        name,
        value: capturedValue,
      });
    }

    function finish(result: CapturedViteResult) {
      if (resolved) {
        return;
      }
      resolved = true;
      restoreResponse();
      resolve(result);
    }

    res.setHeader = function setCapturedHeader(name, value) {
      setCapturedHeaderValue(String(name), value);
      return res;
    };
    res.getHeader = function getCapturedHeader(name) {
      return headers.get(normalizeHeaderName(name))?.value;
    };
    res.hasHeader = function hasCapturedHeader(name) {
      return headers.has(normalizeHeaderName(name));
    };
    res.removeHeader = function removeCapturedHeader(name) {
      headers.delete(normalizeHeaderName(name));
    };
    res.writeHead = function writeCapturedHead(statusCode, statusMessageOrHeaders?, headersArg?) {
      capturedStatusCode = statusCode;
      res.statusCode = statusCode;
      if (typeof statusMessageOrHeaders === 'string') {
        capturedStatusMessage = statusMessageOrHeaders;
        res.statusMessage = statusMessageOrHeaders;
      }
      const headerSource = typeof statusMessageOrHeaders === 'object'
        ? statusMessageOrHeaders
        : headersArg;
      if (headerSource) {
        for (const [name, value] of Object.entries(headerSource as Record<string, string | number | readonly string[] | undefined>)) {
          if (value !== undefined) {
            setCapturedHeaderValue(name, value);
          }
        }
      }
      return res;
    } as ServerResponse['writeHead'];
    res.write = function writeCapturedChunk(
      chunk: any,
      encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
      callback?: (error?: Error | null) => void,
    ) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
      done?.();
      return true;
    } as ServerResponse['write'];
    res.end = function endCapturedResponse(
      chunk?: any,
      encodingOrCallback?: BufferEncoding | (() => void),
      callback?: () => void,
    ) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
      capturedStatusCode = res.statusCode;
      capturedStatusMessage = res.statusMessage || capturedStatusMessage;
      done?.();
      finish({
        kind: 'response',
        statusCode: capturedStatusCode,
        statusMessage: capturedStatusMessage,
        headers: Array.from(headers.values()).map(({ name, value }) => [name, value]),
        chunks,
      });
      return res;
    } as ServerResponse['end'];

    try {
      vite.middlewares(req, res, () => {
        finish({ kind: 'next' });
        next?.();
      });
    } catch (error) {
      restoreResponse();
      reject(error);
    }
  });
}

/**
 * Create a Vite dev server in middleware mode and attach its HMR WebSocket
 * to the provided HTTP server so everything runs on a single port.
 */
export async function createViteDevMiddleware(
  httpServer: http.Server,
  projectRoot: string,
): Promise<ViteDevMiddleware> {
  // Dynamic import – vite is a devDependency, only loaded in dev mode.
  const { createServer } = await importRuntimePackage('vite');

  const makeServerRoot = path.resolve(projectRoot);
  const configFile = path.resolve(makeServerRoot, 'vite.config.ts');
  const viteCacheRoot = path.join(makeServerRoot, 'node_modules', '.vite');
  fs.mkdirSync(viteCacheRoot, { recursive: true });
  // Keep optimizer output private to this embedded server. A second Vite
  // instance re-optimizing the shared cache can otherwise delete deps still
  // referenced by this server's in-memory metadata.
  const cacheDir = fs.mkdtempSync(path.join(viteCacheRoot, `axhub-make-dev-${process.pid}-`));

  async function createEmbeddedViteServer(): Promise<ViteServer> {
    return createServer({
      configFile: fs.existsSync(configFile) ? configFile : undefined,
      root: makeServerRoot,
      cacheDir,
      plugins: [
        canvasHotUpdateFilterPlugin(),
      ],
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
        headers: {
          'Cache-Control': 'no-store',
        },
        watch: {
          // Don't watch build outputs, server code, node_modules, client runtime, or canvas data.
          // Canvas files have their own bridge; letting Vite see them causes
          // full-page HMR reloads instead of scene-only updates.
          // Client runtime files have their own dev server; watching them here
          // makes the admin shell reload while the client is already applying
          // its local HMR update.
          ignored: [
            '**/dist/**',
            '**/node_modules/**',
            '**/src/server/**',
            '**/client/**',
            '**/*.excalidraw',
            '**/canvas-assets/**',
          ],
        },
      },
      appType: 'custom',
      // Disable the normal file-system watcher opening a browser tab.
      clearScreen: false,
    }) as Promise<ViteServer>;
  }

  let vite = await createEmbeddedViteServer();
  let recreatePromise: Promise<void> | null = null;

  async function recreateViteServer(): Promise<void> {
    if (recreatePromise) {
      return recreatePromise;
    }
    recreatePromise = (async () => {
      const previousVite = vite;
      await previousVite.close();
      fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.mkdirSync(cacheDir, { recursive: true });
      vite = await createEmbeddedViteServer();
    })().finally(() => {
      recreatePromise = null;
    });
    return recreatePromise;
  }

  return {
    async handle(req, res, next) {
      if (isEmbeddedOptimizedDepRequest(req.url || '/', cacheDir)) {
        const result = await captureViteResponse(vite, req, res, next);
        if (isOutdatedOptimizedDepResponse(result)) {
          await recreateViteServer();
          const retryResult = await captureViteResponse(vite, req, res, next);
          if (retryResult.kind === 'response') {
            flushCapturedResponse(res, retryResult);
          }
          return;
        }
        if (result.kind === 'response') {
          flushCapturedResponse(res, result);
        }
        return;
      }

      vite.middlewares(req, res, next ?? (() => {
        // Default next: send 404 if Vite didn't handle the request.
        res.statusCode = 404;
        res.end();
      }));
    },

    async transformHtml(url, htmlPath, extraHeadHtml) {
      let html = fs.readFileSync(htmlPath, 'utf-8');

      // Let Vite inject /@vite/client, React refresh preamble, etc.
      html = await vite.transformIndexHtml(url, html);

      // Rewrite relative paths to absolute paths based on the HTML file's
      // directory within the Vite root. When serving src/index/index.html
      // at URL /, the browser would resolve ./index.tsx to /index.tsx
      // instead of the correct /src/index/index.tsx.
      const htmlDir = path.posix.dirname(url);
      if (htmlDir !== '/' && htmlDir !== '.') {
        // Rewrite src="./..." in script tags
        html = html.replace(
          /(<script\b[^>]*\bsrc=")\.\/([^"]*")/gu,
          `$1${htmlDir}/$2`,
        );
        // Rewrite href="../../..." and other relative paths in link tags
        html = html.replace(
          /(<link\b[^>]*\bhref=")(\.\.?\/[^"]*")/gu,
          (_match, prefix, relPath) => {
            const resolved = path.posix.resolve(htmlDir, relPath.slice(0, -1));
            return `${prefix}${resolved}"`;
          },
        );
      }

      // Inject extra content (server-side runtime variables) before </head>.
      if (extraHeadHtml) {
        html = html.replace('</head>', `${extraHeadHtml}\n</head>`);
      }

      return html;
    },

    async close() {
      try {
        await vite.close();
      } finally {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      }
    },
  };
}
