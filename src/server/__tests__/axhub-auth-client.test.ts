import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAxhubAuthClient } from '../axhubAuthClient.ts';

const tempRoots: string[] = [];

function createTempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axhub-auth-client-'));
  tempRoots.push(root);
  return root;
}

function readAuthFile(homeDir: string) {
  return JSON.parse(fs.readFileSync(path.join(homeDir, '.axhub/make/axhub-auth.json'), 'utf8'));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('Axhub auth client', () => {
  it('surfaces the original fetch failure details when completing authorization fails', async () => {
    const homeDir = createTempRoot();
    const client = createAxhubAuthClient({
      serverInfoHomeDir: homeDir,
      onlineBaseUrl: 'https://axhub.test',
    });
    const session = client.beginAuthorization('http://localhost:53817');
    const cause = Object.assign(new Error('unable to get local issuer certificate'), {
      code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    });
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed', { cause });
    }));

    await expect(client.completeAuthorization(new URLSearchParams({
      state: session.state,
      ticket: 'ticket-1',
    }))).rejects.toThrow(
      'Axhub 授权失败：TypeError: fetch failed；cause.code=UNABLE_TO_GET_ISSUER_CERT_LOCALLY；cause.message=unable to get local issuer certificate',
    );
  });

  it('connects to Enterprise with a normalized server URL and stores the token server-side', async () => {
    const homeDir = createTempRoot();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('https://enterprise.example.com/api/runtime/axhub/me');
      expect(init?.method).toBe('GET');
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer axent_secret_123');
      return new Response(JSON.stringify({
        code: 0,
        data: {
          name: 'Make 发布 Token',
          role: 'service',
          isPlus: true,
          scopes: ['html:read', 'html:create', 'html:publish'],
          serverUrl: 'https://enterprise.example.com',
          tokenPrefix: 'axent_secret',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createAxhubAuthClient({ serverInfoHomeDir: homeDir });
    const me = await client.connectEnterprise({
      serverUrl: 'https://enterprise.example.com///',
      token: 'axent_secret_123',
    });

    expect(me).toMatchObject({
      name: 'Make 发布 Token',
      role: 'service',
      isPlus: true,
      tokenPrefix: 'axent_secret',
    });
    expect(client.getStatus()).toMatchObject({
      connected: true,
      provider: 'enterprise',
      serverUrl: 'https://enterprise.example.com',
      tokenPrefix: 'axent_secret',
      name: 'Make 发布 Token',
      role: 'service',
      scopes: ['html:read', 'html:create', 'html:publish'],
    });
    const stored = readAuthFile(homeDir);
    expect(stored.tokens).toBeUndefined();
    expect(stored.enterprise).toMatchObject({
      serverUrl: 'https://enterprise.example.com',
      token: 'axent_secret_123',
      tokenPrefix: 'axent_secret',
      name: 'Make 发布 Token',
    });
  });

  it('routes Enterprise project requests to the saved server with the Enterprise token', async () => {
    const homeDir = createTempRoot();
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith('/me')) {
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
        code: 0,
        data: [
          { pid: 11, name: 'Enterprise Demo', path: 'demo', software: 4 },
        ],
      }), { status: 200 });
    }));

    const client = createAxhubAuthClient({ serverInfoHomeDir: homeDir });
    await client.connectEnterprise({
      serverUrl: 'https://enterprise.example.com',
      token: 'axent_secret_123',
    });
    const projects = await client.listHtmlProjects('Demo');

    expect(projects).toEqual([
      { pid: 11, name: 'Enterprise Demo', path: 'demo', software: 4 },
    ]);
    expect(calls.at(-1)).toMatchObject({
      url: 'https://enterprise.example.com/api/runtime/axhub/html-projects?keyword=Demo',
    });
    expect((calls.at(-1)?.init?.headers as Record<string, string>).Authorization).toBe('Bearer axent_secret_123');
  });

  it('disconnects Enterprise by clearing local auth without calling Online revoke', async () => {
    const homeDir = createTempRoot();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      code: 0,
      data: {
        name: 'Make 发布 Token',
        role: 'service',
        isPlus: true,
        scopes: ['html:read'],
        tokenPrefix: 'axent_secret',
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const client = createAxhubAuthClient({ serverInfoHomeDir: homeDir });
    await client.connectEnterprise({
      serverUrl: 'https://enterprise.example.com',
      token: 'axent_secret_123',
    });
    fetchMock.mockClear();

    await client.disconnect();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.getStatus()).toMatchObject({
      connected: false,
      provider: 'online',
    });
    const stored = readAuthFile(homeDir);
    expect(stored.enterprise).toBeUndefined();
    expect(stored.tokens).toBeUndefined();
  });

  it('clears saved Enterprise auth when Online authorization completes', async () => {
    const homeDir = createTempRoot();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/me')) {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            name: 'Make 发布 Token',
            role: 'service',
            isPlus: true,
            scopes: ['html:read'],
            tokenPrefix: 'axent_secret',
          },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        code: 0,
        data: {
          access_token: 'online-access-token',
          expires_in: 3600,
          refresh_token: 'online-refresh-token',
          refresh_expires_in: 7200,
        },
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = createAxhubAuthClient({
      serverInfoHomeDir: homeDir,
      onlineBaseUrl: 'https://axhub.test',
    });
    await client.connectEnterprise({
      serverUrl: 'https://enterprise.example.com',
      token: 'axent_secret_123',
    });
    const session = client.beginAuthorization('http://localhost:53817');
    await client.completeAuthorization(new URLSearchParams({
      state: session.state,
      ticket: 'ticket-1',
    }));

    const stored = readAuthFile(homeDir);
    expect(stored.enterprise).toBeUndefined();
    expect(stored.tokens).toMatchObject({
      accessToken: 'online-access-token',
      refreshToken: 'online-refresh-token',
    });
    expect(client.getStatus()).toMatchObject({
      connected: true,
      provider: 'online',
    });
  });

  it('rejects invalid Enterprise connection input before contacting the network', async () => {
    const homeDir = createTempRoot();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = createAxhubAuthClient({ serverInfoHomeDir: homeDir });

    await expect(client.connectEnterprise({
      serverUrl: 'ftp://enterprise.example.com',
      token: 'axent_secret_123',
    })).rejects.toThrow('企业版地址必须以 http:// 或 https:// 开头');
    await expect(client.connectEnterprise({
      serverUrl: 'https://enterprise.example.com',
      token: 'not-a-token',
    })).rejects.toThrow('Token 格式不正确');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
