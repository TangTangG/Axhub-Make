import http from 'node:http';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getRuntimeProxyTargetPath,
  isRuntimeHtmlProxyRequest,
  isRuntimeOnlyRoute,
  proxyToRuntime,
} from '../runtimeProxy.ts';

const servers: http.Server[] = [];

function listen(server: http.Server): Promise<string> {
  servers.push(server);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Expected TCP server address'));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map((server) => closeServer(server)));
});

describe('runtime proxy route ownership', () => {
  it('keeps management API routes owned by make-server', () => {
    expect(isRuntimeOnlyRoute('/api/entries.json')).toBe(false);
    expect(isRuntimeOnlyRoute('/api/docs')).toBe(false);
    expect(isRuntimeOnlyRoute('/api/themes')).toBe(false);
    expect(isRuntimeOnlyRoute('/api/data/tables')).toBe(false);
    expect(isRuntimeOnlyRoute('/api/source?path=components/button')).toBe(false);
    expect(isRuntimeOnlyRoute('/api/config')).toBe(false);
  });

  it('proxies runtime-only routes to the runtime server', () => {
    expect(isRuntimeOnlyRoute('/ws')).toBe(true);
    expect(isRuntimeOnlyRoute('/ws?client=1')).toBe(true);
    expect(isRuntimeOnlyRoute('/api/ws/clients')).toBe(true);
    expect(isRuntimeOnlyRoute('/api/text-replace/count')).toBe(true);
    expect(isRuntimeOnlyRoute('/api/hack-css/save')).toBe(true);
    expect(isRuntimeOnlyRoute('/@vite/client')).toBe(true);
    expect(isRuntimeOnlyRoute('/@react-refresh')).toBe(true);
    expect(isRuntimeOnlyRoute('/@fs/Users/demo/project/src/App.tsx')).toBe(true);
    expect(isRuntimeOnlyRoute('/@id/react')).toBe(true);
    expect(isRuntimeOnlyRoute('/@vite/deps/react.js')).toBe(true);
    expect(isRuntimeOnlyRoute('/src/prototypes/ref-app-home/index.tsx')).toBe(true);
    expect(isRuntimeOnlyRoute('/node_modules/.vite/deps/react.js?v=123')).toBe(true);
    expect(isRuntimeOnlyRoute('/build/components/ref-button.js')).toBe(true);
    expect(isRuntimeOnlyRoute('/docs/project-overview')).toBe(true);
    expect(isRuntimeOnlyRoute('/docs/project-overview/spec.html')).toBe(true);
    expect(isRuntimeOnlyRoute('/canvas/prototypes/ref-app-home/canvas.excalidraw')).toBe(true);
    expect(isRuntimeOnlyRoute('/prototypes/ref-app-home')).toBe(true);
    expect(isRuntimeOnlyRoute('/prototypes/ref-app-home/')).toBe(true);
    expect(isRuntimeOnlyRoute('/prototypes/ref-app-home?editor=1')).toBe(true);
    expect(isRuntimeOnlyRoute('/prototypes/ref-app-home/canvas-assets/screenshot.png?v=123')).toBe(true);
    expect(isRuntimeOnlyRoute('/assets/index.css')).toBe(true);
  });

  it('treats runtime HTML proxy modules as runtime-owned before admin Vite handles them', () => {
    expect(isRuntimeHtmlProxyRequest('/prototypes/%E6%9C%AA%E5%91%BD%E5%90%8D/index.html?html-proxy&index=0.js')).toBe(true);
    expect(isRuntimeHtmlProxyRequest('/@id/__x00__/prototypes/%E6%9C%AA%E5%91%BD%E5%90%8D/index.html?html-proxy&index=0.js')).toBe(true);
    expect(isRuntimeHtmlProxyRequest('/themes/brand/index.html?html-proxy&inline-css&index=1.css')).toBe(true);
    expect(isRuntimeHtmlProxyRequest('/src/index/index.html?html-proxy&index=0.js')).toBe(false);
    expect(isRuntimeHtmlProxyRequest('/@id/__x00__/src/index/index.html?html-proxy&index=0.js')).toBe(false);
    expect(isRuntimeHtmlProxyRequest('/prototypes/home/index.html')).toBe(false);
  });

  it('does not proxy legacy component preview paths as a fallback renderer', () => {
    expect(isRuntimeOnlyRoute('/components/ref-button/index.tsx')).toBe(false);
    expect(isRuntimeOnlyRoute('/components/ref-button/hack.css')).toBe(false);
    expect(isRuntimeOnlyRoute('/build/components/ref-button.css')).toBe(false);
    expect(isRuntimeOnlyRoute('/docs')).toBe(false);
    expect(isRuntimeOnlyRoute('/canvas')).toBe(false);
    expect(isRuntimeOnlyRoute('/favicon.ico')).toBe(false);
  });

  it('preserves query strings when building runtime proxy targets', () => {
    expect(getRuntimeProxyTargetPath('/build/components/ref-button.js?v=1')).toBe('/build/components/ref-button.js?v=1');
    expect(getRuntimeProxyTargetPath('')).toBe('/');
  });

  it('proxies requests to the runtime origin while preserving method, path, query, body, and host', async () => {
    const upstream = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      req.on('end', () => {
        res.statusCode = 207;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('x-runtime-seen', 'yes');
        res.end(JSON.stringify({
          method: req.method,
          url: req.url,
          host: req.headers.host,
          custom: req.headers['x-custom-header'],
          body: Buffer.concat(chunks).toString('utf8'),
        }));
      });
    });
    const runtimeOrigin = await listen(upstream);
    const runtimeHost = new URL(runtimeOrigin).host;
    const proxy = http.createServer((req, res) => proxyToRuntime(req, res, runtimeOrigin));
    const proxyOrigin = await listen(proxy);

    const response = await fetch(`${proxyOrigin}/api/ws/echo?room=canvas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'x-custom-header': 'from-test',
      },
      body: 'hello runtime',
    });
    const body = await response.json();

    expect(response.status).toBe(207);
    expect(response.headers.get('x-runtime-seen')).toBe('yes');
    expect(body).toEqual({
      method: 'POST',
      url: '/api/ws/echo?room=canvas',
      host: runtimeHost,
      custom: 'from-test',
      body: 'hello runtime',
    });
  });

  it('returns a JSON 502 when the runtime transport cannot connect before headers are sent', async () => {
    const proxy = http.createServer((req, res) => proxyToRuntime(req, res, 'http://127.0.0.1:1'));
    const proxyOrigin = await listen(proxy);

    const response = await fetch(`${proxyOrigin}/@vite/client`);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body).toMatchObject({
      error: 'Runtime unavailable',
    });
  });

  it('destroys the response when the runtime transport errors after headers are sent', () => {
    const proxyRequest = new PassThrough();
    vi.spyOn(http, 'request').mockImplementation((() => proxyRequest) as unknown as typeof http.request);
    const req = new PassThrough() as any;
    req.url = '/@vite/client';
    req.method = 'GET';
    req.headers = {};
    const res = {
      headersSent: true,
      destroy: vi.fn(),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as any;

    proxyToRuntime(req, res, 'http://127.0.0.1:1');
    const error = new Error('headers already sent');
    proxyRequest.emit('error', error);

    expect(res.destroy).toHaveBeenCalledWith(error);
    expect(res.end).not.toHaveBeenCalled();
  });
});
