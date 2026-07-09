import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../exportHtmlArchive.ts', () => ({
  buildExportHtmlStaticFiles: vi.fn(),
}));

vi.mock('../http.ts', () => ({
  getRequestUrl: (req: IncomingMessage) => new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`),
  readJsonBody: <T = any>(req: IncomingMessage) => new Promise<T>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      resolve(raw ? JSON.parse(raw) : {});
    });
    req.on('error', reject);
  }),
  sendJson: (res: ServerResponse, data: unknown, options: { status?: number } = {}) => {
    res.statusCode = options.status ?? 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
  },
  sendText: (res: ServerResponse, text: string, contentType = 'text/plain; charset=utf-8', status = 200) => {
    res.statusCode = status;
    res.setHeader('Content-Type', contentType);
    res.end(text);
  },
}));

import { handleAxhubApi } from '../managementApi.axhub.ts';
import type { ManagementApiOptions } from '../managementApi.ts';

const tempRoots: string[] = [];

function createTempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axhub-api-'));
  tempRoots.push(root);
  return root;
}

function createRequest(method: string, url: string, body?: unknown): IncomingMessage {
  const request = new EventEmitter() as IncomingMessage;
  request.method = method;
  request.url = url;
  request.headers = { host: '127.0.0.1:53817' };

  process.nextTick(() => {
    if (body !== undefined) {
      request.emit('data', Buffer.from(JSON.stringify(body)));
    }
    request.emit('end');
  });

  return request;
}

function createResponse() {
  const chunks: Buffer[] = [];
  const headers = new Map<string, string>();
  const response = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      callback();
    },
  }) as ServerResponse & Writable;

  response.statusCode = 200;
  response.setHeader = function setHeader(name: string, value: string | number | readonly string[]) {
    headers.set(name.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value));
    return response;
  };
  response.getHeader = function getHeader(name: string) {
    return headers.get(name.toLowerCase());
  };
  response.end = function endResponse(chunk?: string | Buffer | Uint8Array) {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    Writable.prototype.end.call(response);
    return response;
  } as ServerResponse['end'];

  const waitForFinish = () => response.writableEnded
    ? Promise.resolve()
    : new Promise<void>((resolve, reject) => {
      response.once('finish', resolve);
      response.once('error', reject);
    });

  return {
    response,
    waitForFinish,
    body() {
      return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    },
    get statusCode() {
      return response.statusCode;
    },
  };
}

function createHandlers() {
  return {
    resolveProjectContext: () => null,
    resolveSourceFileFromMetadata: () => null,
    findProjectResourceByPath: () => null,
    readProjectConfig: () => ({}),
    sendDisabledCapability: vi.fn(),
  };
}

async function callAxhubApi(params: {
  homeDir: string;
  pathname: string;
  method?: string;
  body?: unknown;
}) {
  const res = createResponse();
  const handled = handleAxhubApi(
    createRequest(params.method || 'GET', params.pathname, params.body),
    res.response,
    {
      projectRoot: params.homeDir,
      origin: 'http://127.0.0.1:53817',
      serverInfoHomeDir: params.homeDir,
      axhubOnlineBaseUrl: 'https://axhub.test',
    } as ManagementApiOptions,
    params.pathname,
    createHandlers(),
  );
  if (handled) {
    await res.waitForFinish();
  }
  return {
    handled,
    status: res.statusCode,
    body: handled ? res.body() : null,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('Axhub management API', () => {
  it('connects Enterprise through the local API without returning the full token', async () => {
    const homeDir = createTempRoot();
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://enterprise.example.com/api/runtime/axhub/me');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer axent_secret_123');
      return new Response(JSON.stringify({
        code: 0,
        data: {
          name: 'Make 发布 Token',
          role: 'service',
          isPlus: true,
          scopes: ['html:read', 'html:create', 'html:publish'],
          tokenPrefix: 'axent_secret',
          token: 'axent_secret_123',
          accessToken: 'online-access-token',
        },
      }), { status: 200 });
    }));

    const connected = await callAxhubApi({
      homeDir,
      pathname: '/api/axhub/connect-enterprise',
      method: 'POST',
      body: {
        serverUrl: 'https://enterprise.example.com/',
        token: 'axent_secret_123',
      },
    });

    expect(connected).toMatchObject({
      handled: true,
      status: 200,
      body: {
        provider: 'enterprise',
        serverUrl: 'https://enterprise.example.com',
        tokenPrefix: 'axent_secret',
        me: {
          name: 'Make 发布 Token',
          role: 'service',
          isPlus: true,
          tokenPrefix: 'axent_secret',
        },
      },
    });
    expect(JSON.stringify(connected.body)).not.toContain('axent_secret_123');

    const status = await callAxhubApi({
      homeDir,
      pathname: '/api/axhub/status',
      method: 'GET',
    });

    expect(status.body).toMatchObject({
      connected: true,
      provider: 'enterprise',
      serverUrl: 'https://enterprise.example.com',
      tokenPrefix: 'axent_secret',
      me: {
        name: 'Make 发布 Token',
        role: 'service',
        isPlus: true,
      },
    });
    expect(JSON.stringify(status.body)).not.toContain('axent_secret_123');
  });

  it('returns the detailed upstream project creation error instead of a generic server error', async () => {
    const homeDir = createTempRoot();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === 'https://enterprise.example.com/api/runtime/axhub/me') {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            name: 'Make 发布 Token',
            role: 'service',
            isPlus: true,
            scopes: ['html:read', 'html:create', 'html:publish'],
            tokenPrefix: 'axent_secret',
          },
        }), { status: 200 });
      }
      expect(url).toBe('https://enterprise.example.com/api/runtime/axhub/html-projects');
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer axent_secret_123');
      expect(JSON.parse(String(init?.body))).toEqual({ name: 'Demo Project' });
      return new Response(JSON.stringify({
        code: 'AXHUB_PROJECT_CREATE_FAILED',
        error: '服务器错误',
        data: {
          error: {
            message: '项目名称已存在，请换一个名称',
          },
        },
      }), { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await callAxhubApi({
      homeDir,
      pathname: '/api/axhub/connect-enterprise',
      method: 'POST',
      body: {
        serverUrl: 'https://enterprise.example.com/',
        token: 'axent_secret_123',
      },
    });

    const created = await callAxhubApi({
      homeDir,
      pathname: '/api/axhub/html-projects',
      method: 'POST',
      body: {
        name: 'Demo Project',
      },
    });

    expect(created).toMatchObject({
      handled: true,
      status: 500,
      body: {
        error: '项目名称已存在，请换一个名称',
        code: 'AXHUB_PROJECT_CREATE_FAILED',
        details: {
          code: 'AXHUB_PROJECT_CREATE_FAILED',
          error: '服务器错误',
          data: {
            error: {
              message: '项目名称已存在，请换一个名称',
            },
          },
        },
      },
    });
  });

  it('includes the upstream payload when project creation only returns a generic message', async () => {
    const homeDir = createTempRoot();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === 'https://enterprise.example.com/api/runtime/axhub/me') {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            name: 'Make 发布 Token',
            role: 'service',
            isPlus: true,
            scopes: ['html:read', 'html:create', 'html:publish'],
            tokenPrefix: 'axent_secret',
          },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        code: 'AXHUB_PROJECT_CREATE_FAILED',
        error: '服务器错误',
        requestId: 'req-project-create-1',
      }), { status: 500 });
    }));

    await callAxhubApi({
      homeDir,
      pathname: '/api/axhub/connect-enterprise',
      method: 'POST',
      body: {
        serverUrl: 'https://enterprise.example.com/',
        token: 'axent_secret_123',
      },
    });

    const created = await callAxhubApi({
      homeDir,
      pathname: '/api/axhub/html-projects',
      method: 'POST',
      body: {
        name: 'Demo Project',
      },
    });

    expect(created).toMatchObject({
      handled: true,
      status: 500,
      body: {
        error: '服务器错误',
        code: 'AXHUB_PROJECT_CREATE_FAILED',
        details: {
          code: 'AXHUB_PROJECT_CREATE_FAILED',
          error: '服务器错误',
          requestId: 'req-project-create-1',
        },
      },
    });
  });
});
