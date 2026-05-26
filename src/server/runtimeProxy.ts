import type { IncomingMessage, ServerResponse } from 'node:http';
import http from 'node:http';
import https from 'node:https';

const RUNTIME_API_PREFIXES = [
  '/api/ws/',
  '/api/text-replace/',
  '/api/hack-css/',
];

const RUNTIME_EXACT_PATHS = new Set([
  '/ws',
  '/@react-refresh',
  '/@vite/client',
]);

const RUNTIME_FILE_PATTERNS = [
  /^\/@fs\//u,
  /^\/@id\//u,
  /^\/@vite\//u,
  /^\/node_modules\/\.vite\//u,
  /^\/src\//u,
  /^\/build\/.+\.js$/u,
  /^\/prototypes\/.+/u,
  /^\/docs\/.+(?:\/spec\.html)?$/u,
  /^\/canvas\/.+\/?$/u,
  /^\/assets\//u,
];

export function isRuntimeHtmlProxyRequest(requestUrl: string): boolean {
  const rawUrl = requestUrl || '/';
  if (!/[?&]html-proxy\b/u.test(rawUrl)) {
    return false;
  }

  const pathname = rawUrl.split('?')[0] || '/';
  let decodedPathname = pathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    // Keep the raw pathname when decoding fails.
  }

  return /(?:^|\/)(?:prototypes|themes)\//u.test(decodedPathname);
}

export function isRuntimeOnlyRoute(pathname: string): boolean {
  const pathOnly = pathname.split('?')[0] || '/';
  if (RUNTIME_EXACT_PATHS.has(pathOnly)) {
    return true;
  }
  if (RUNTIME_API_PREFIXES.some((prefix) => pathOnly.startsWith(prefix))) {
    return true;
  }
  return RUNTIME_FILE_PATTERNS.some((pattern) => pattern.test(pathOnly));
}

export function getRuntimeProxyTargetPath(requestUrl: string): string {
  return requestUrl || '/';
}

export function proxyToRuntime(req: IncomingMessage, res: ServerResponse, runtimeOrigin: string): void {
  const target = new URL(getRuntimeProxyTargetPath(req.url || '/'), runtimeOrigin);
  const transport = target.protocol === 'https:' ? https : http;
  const proxyReq = transport.request(target, {
    method: req.method,
    headers: {
      ...req.headers,
      host: target.host,
    },
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (error) => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        error: 'Runtime unavailable',
        message: error.message,
      }));
      return;
    }
    res.destroy(error);
  });

  req.pipe(proxyReq);
}
