import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getAdminServerInfoPath,
  writeServerInfo,
} from '../scripts/utils/serverInfo.mjs';

import {
  createAdminUrl,
  getReusableAdminOrigin,
  registerOfficialProject,
  resolveMakeServerStartCommand,
  startOrReuseMakeServer,
} from '../vite-plugins/autoStartMakeServerPlugin';

const originalFetch = globalThis.fetch;
const tempRoots: string[] = [];

function createTempProjectRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'make-project-auto-server-'));
  tempRoots.push(root);
  return root;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

function mockFetch(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(String(input));
    return handler(url, init);
  }) as typeof fetch;
  return globalThis.fetch as ReturnType<typeof vi.fn>;
}

function readBody(init?: RequestInit) {
  return JSON.parse(String(init?.body || '{}'));
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('auto make-server registration', () => {
  it('registers a new official client project without switching the server active project', async () => {
    const projectRoot = createTempProjectRoot();
    const calls: Array<{ pathname: string; method: string; body: any }> = [];
    mockFetch((url, init) => {
      calls.push({
        pathname: url.pathname,
        method: init?.method || 'GET',
        body: init?.body ? readBody(init) : null,
      });
      if (url.pathname === '/api/projects' && !init?.method) {
        return jsonResponse({ activeProjectId: null, projects: [] });
      }
      if (url.pathname === '/api/projects' && init?.method === 'POST') {
        return jsonResponse({ project: { id: 'make-project' } }, { status: 201 });
      }
      return jsonResponse({ error: 'unexpected request' }, { status: 500 });
    });

    await expect(registerOfficialProject(projectRoot, 'http://localhost:5174'))
      .resolves
      .toEqual({ projectId: 'make-project', projectName: '' });

    expect(calls).toEqual([
      expect.objectContaining({ pathname: '/api/projects', method: 'GET' }),
      expect.objectContaining({
        pathname: '/api/projects',
        method: 'POST',
        body: {
          id: 'make-project',
          name: '',
          root: projectRoot,
          metadataPath: path.join(projectRoot, '.axhub/make/project.json'),
        },
      }),
    ]);
  });

  it('updates an existing root registration without switching active project', async () => {
    const projectRoot = createTempProjectRoot();
    const calls: Array<{ pathname: string; method: string; body: any }> = [];
    mockFetch((url, init) => {
      calls.push({
        pathname: url.pathname,
        method: init?.method || 'GET',
        body: init?.body ? readBody(init) : null,
      });
      if (url.pathname === '/api/projects' && !init?.method) {
        return jsonResponse({
          activeProjectId: 'other',
          projects: [
            {
              id: 'official-existing',
              name: 'Old Name',
              root: projectRoot,
              metadataPath: '/old/project.json',
            },
          ],
        });
      }
      if (url.pathname === '/api/projects/official-existing' && init?.method === 'PATCH') {
        return jsonResponse({ project: { id: 'official-existing' } });
      }
      return jsonResponse({ error: 'unexpected request' }, { status: 500 });
    });

    await expect(registerOfficialProject(projectRoot, 'http://localhost:5174'))
      .resolves
      .toEqual({ projectId: 'official-existing', projectName: '' });

    expect(calls).toEqual([
      expect.objectContaining({ pathname: '/api/projects', method: 'GET' }),
      expect.objectContaining({
        pathname: '/api/projects/official-existing',
        method: 'PATCH',
        body: {
          name: '',
          root: projectRoot,
          metadataPath: path.join(projectRoot, '.axhub/make/project.json'),
        },
      }),
    ]);
  });

  it('builds a default admin URL without selecting a project', () => {
    expect(createAdminUrl('http://localhost:5174'))
      .toBe('http://localhost:5174/');
    expect(createAdminUrl('http://localhost:5174/admin/index.html?x=1'))
      .toBe('http://localhost:5174/');
  });

  it('builds an admin URL with an explicit project selection only when requested', () => {
    expect(createAdminUrl('http://localhost:5174', 'make-project'))
      .toBe('http://localhost:5174/?projectId=make-project');
    expect(createAdminUrl('http://localhost:5174/admin/index.html?x=1', 'project with spaces'))
      .toBe('http://localhost:5174/?projectId=project+with+spaces');
  });

  it('returns a URL-selected admin URL when reusing a running make-server', async () => {
    const projectRoot = createTempProjectRoot();
    mockFetch((url, init) => {
      if (url.pathname === '/api/health') {
        return jsonResponse({
          ok: true,
          role: 'admin',
          projectRoot,
          server: {
            pid: 12345,
            port: 5174,
            host: 'localhost',
            origin: 'http://localhost:5174',
            projectRoot,
            startedAt: '2026-05-03T00:01:00.000Z',
          },
        });
      }
      if (url.pathname === '/api/projects' && !init?.method) {
        return jsonResponse({ activeProjectId: 'other', projects: [] });
      }
      if (url.pathname === '/api/projects' && init?.method === 'POST') {
        return jsonResponse({ project: { id: 'make-project' } }, { status: 201 });
      }
      return jsonResponse({ error: 'unexpected request' }, { status: 500 });
    });

    await expect(startOrReuseMakeServer(projectRoot))
      .resolves
      .toMatchObject({
        ready: true,
        adminOrigin: 'http://localhost:5174',
        adminUrl: 'http://localhost:5174/?projectId=make-project',
      });
  });

  it('falls back to npx when no monorepo make-server CLI exists', () => {
    const projectRoot = createTempProjectRoot();

    expect(resolveMakeServerStartCommand(projectRoot)).toEqual({
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['@axhub/make', projectRoot],
      label: 'npx @axhub/make',
    });
  });

  it('passes the live runtime origin to the npx make-server fallback', () => {
    const projectRoot = createTempProjectRoot();

    expect(resolveMakeServerStartCommand(projectRoot, {
      runtimeOrigin: 'http://localhost:51720/',
    })).toEqual({
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['@axhub/make', projectRoot, '--runtime-origin', 'http://localhost:51720'],
      label: 'npx @axhub/make',
    });
  });

  it('starts the local monorepo make-server in dev mode for admin HMR', () => {
    const workspaceRoot = createTempProjectRoot();
    const projectRoot = path.join(workspaceRoot, 'apps', 'make-project');
    const cliPath = path.join(workspaceRoot, 'apps', 'make-server', 'bin', 'cli.mjs');
    fs.mkdirSync(path.dirname(cliPath), { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages: []\n', 'utf8');
    fs.writeFileSync(cliPath, '#!/usr/bin/env node\n', 'utf8');

    expect(resolveMakeServerStartCommand(projectRoot)).toEqual({
      command: process.execPath,
      args: [cliPath, projectRoot, '--dev'],
      label: 'local @axhub/make dev',
    });
  });

  it('passes the live runtime origin to the local monorepo make-server', () => {
    const workspaceRoot = createTempProjectRoot();
    const projectRoot = path.join(workspaceRoot, 'apps', 'make-project');
    const cliPath = path.join(workspaceRoot, 'apps', 'make-server', 'bin', 'cli.mjs');
    fs.mkdirSync(path.dirname(cliPath), { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages: []\n', 'utf8');
    fs.writeFileSync(cliPath, '#!/usr/bin/env node\n', 'utf8');

    expect(resolveMakeServerStartCommand(projectRoot, {
      runtimeOrigin: 'http://localhost:51720',
    })).toEqual({
      command: process.execPath,
      args: [
        cliPath,
        projectRoot,
        '--dev',
        '--runtime-origin',
        'http://localhost:51720',
      ],
      label: 'local @axhub/make dev',
    });
  });

  it('does not reuse a dev admin with a stale runtime origin', async () => {
    const projectRoot = createTempProjectRoot();
    const fetchMock = mockFetch((url) => {
      expect(url.pathname).toBe('/api/health');
      return jsonResponse({
        ok: true,
        role: 'admin',
        projectRoot,
        runtimeOrigin: 'http://localhost:51721',
        devMode: true,
        server: {
          pid: 12345,
          port: 5174,
          host: 'localhost',
          origin: 'http://localhost:5174',
          projectRoot,
          startedAt: '2026-05-03T00:01:00.000Z',
        },
      });
    });

    await expect(getReusableAdminOrigin(projectRoot, {
      requireDevMode: true,
      runtimeOrigin: 'http://localhost:51720',
    })).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not reuse a static local admin when dev admin is required', async () => {
    const projectRoot = createTempProjectRoot();
    const fetchMock = mockFetch((url) => {
      expect(url.pathname).toBe('/api/health');
      return jsonResponse({
        ok: true,
        role: 'admin',
        projectRoot,
        devMode: false,
        server: {
          pid: 12345,
          port: 5174,
          host: 'localhost',
          origin: 'http://localhost:5174',
          projectRoot,
          startedAt: '2026-05-03T00:01:00.000Z',
        },
      });
    });

    await expect(getReusableAdminOrigin(projectRoot, { requireDevMode: true })).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ignores stale admin server info when the saved origin is unavailable', async () => {
    const projectRoot = createTempProjectRoot();
    writeServerInfo(projectRoot, 'admin', {
      pid: 999999,
      port: 59999,
      host: 'localhost',
      origin: 'http://localhost:59999',
      projectRoot,
      startedAt: '2026-05-03T00:00:00.000Z',
    });
    const fetchMock = mockFetch(() => {
      throw new Error('connect ECONNREFUSED');
    });

    await expect(getReusableAdminOrigin(projectRoot)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the default admin origin when saved admin server info is stale', async () => {
    const projectRoot = createTempProjectRoot();
    writeServerInfo(projectRoot, 'admin', {
      pid: 999999,
      port: 5175,
      host: 'localhost',
      origin: 'http://localhost:5175',
      projectRoot,
      startedAt: '2026-05-03T00:00:00.000Z',
    });
    const fetchMock = mockFetch((url) => {
      if (url.origin === 'http://localhost:5175') {
        throw new Error('connect ECONNREFUSED');
      }
      expect(url.origin).toBe('http://localhost:5174');
      expect(url.pathname).toBe('/api/health');
      return jsonResponse({
        ok: true,
        role: 'admin',
        projectRoot,
        origin: 'http://localhost:5174',
        server: {
          pid: 12345,
          port: 5174,
          host: 'localhost',
          origin: 'http://localhost:5174',
          projectRoot,
          startedAt: '2026-05-03T00:01:00.000Z',
        },
      });
    });

    await expect(getReusableAdminOrigin(projectRoot)).resolves.toBe('http://localhost:5174');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reuses a live admin origin even when health server info reports a stale file entry', async () => {
    const projectRoot = createTempProjectRoot();
    writeServerInfo(projectRoot, 'admin', {
      pid: 999999,
      port: 5174,
      host: 'localhost',
      origin: 'http://localhost:5174',
      projectRoot,
      startedAt: '2026-05-03T00:00:00.000Z',
    });
    mockFetch((url) => {
      expect(url.pathname).toBe('/api/health');
      return jsonResponse({
        ok: true,
        origin: 'http://localhost:5174',
        projectRoot,
        server: {
          pid: 888888,
          port: 5175,
          host: 'localhost',
          origin: 'http://localhost:5175',
          projectRoot,
          startedAt: '2026-05-03T00:01:00.000Z',
        },
      });
    });

    await expect(getReusableAdminOrigin(projectRoot)).resolves.toBe('http://localhost:5174');
  });

  it('treats malformed admin server info as unavailable and probes the default admin origin', async () => {
    const projectRoot = createTempProjectRoot();
    fs.mkdirSync(path.dirname(getAdminServerInfoPath(projectRoot)), { recursive: true });
    fs.writeFileSync(getAdminServerInfoPath(projectRoot), '{ stale', 'utf8');
    const fetchMock = mockFetch(() => jsonResponse({ ok: true }));

    await expect(getReusableAdminOrigin(projectRoot)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://localhost:5174/api/health');
  });

  it('surfaces a clear registration error when make-server project APIs are unavailable', async () => {
    const projectRoot = createTempProjectRoot();
    mockFetch((url) => {
      expect(url.pathname).toBe('/api/projects');
      return jsonResponse({ error: 'server unavailable' }, { status: 503 });
    });

    await expect(registerOfficialProject(projectRoot, 'http://localhost:5174'))
      .rejects
      .toThrow('GET /api/projects failed with 503');
  });
});
