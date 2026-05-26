import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAdminServerInfoPath,
  getMakeClientMarkerPath,
  getProjectMetadataPath,
  getRuntimeServerInfoPath,
  writeServerInfo,
} from '../projectCore/index.ts';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  getTestProjectRegistryPath,
  startTestServer,
  writeJson,
  writeProjectMetadata,
} from './projects-api.helpers';
import { handleMakeClientProjectApi } from '../managementApi.makeClient.ts';

const TEMPLATE_SOURCE_URL = 'https://github.com/lintendo/Axhub-Make/tree/main/client';

const childProcessMock = vi.hoisted(() => ({
  execFile: vi.fn((_file: string, _args: string[], optionsOrCallback?: unknown, maybeCallback?: unknown) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    if (typeof callback === 'function') {
      callback(null, '', '');
    }
  }),
  spawn: vi.fn((_file?: string, _args?: string[], _options?: { cwd?: string }) => {
    const child = {
      once: vi.fn((event: string, callback: (...args: any[]) => void) => {
        if (event === 'spawn') {
          setTimeout(callback, 0);
        }
        return child;
      }),
      unref: vi.fn(),
    };
    return child;
  }),
}));

vi.mock('node:child_process', () => childProcessMock);

vi.mock('../localCommand.ts', async (importActual) => {
  const actual = await importActual<typeof import('../localCommand.ts')>();
  return {
    ...actual,
    runLocalCommand: vi.fn(async (command: string, args: string[]) => ({
      stdout: '',
      stderr: '',
      command,
      escapedCommand: [command, ...args].join(' '),
    })),
  };
});

import { runLocalCommand } from '../localCommand.ts';

const runLocalCommandMock = vi.mocked(runLocalCommand);

beforeEach(() => {
  runLocalCommandMock.mockReset();
  runLocalCommandMock.mockImplementation(async (command: string, args: string[]) => ({
    stdout: '',
    stderr: '',
    command,
    escapedCommand: [command, ...args].join(' '),
  }));
  childProcessMock.execFile.mockReset();
  childProcessMock.execFile.mockImplementation((_file: string, _args: string[], optionsOrCallback?: unknown, maybeCallback?: unknown) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    if (typeof callback === 'function') {
      callback(null, '', '');
    }
  });
  childProcessMock.spawn.mockReset();
  childProcessMock.spawn.mockImplementation((_file?: string, _args?: string[], _options?: { cwd?: string }) => {
    const child = {
      once: vi.fn((event: string, callback: (...args: any[]) => void) => {
        if (event === 'spawn') {
          setTimeout(callback, 0);
        }
        return child;
      }),
      unref: vi.fn(),
    };
    return child;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjectApiTestRoots();
});

function writeMakeClientMarker(projectRoot: string, id = 'make-client-a', name = 'Make Client A') {
  writeJson(getMakeClientMarkerPath(projectRoot), {
    schemaVersion: 1,
    kind: 'axhub-make-client',
    repository: TEMPLATE_SOURCE_URL,
    project: { id, name },
  });
}

function writeMakeClientPackage(projectRoot: string) {
  writeJson(path.join(projectRoot, 'package.json'), {
    scripts: {
      dev: 'vite',
      'metadata:sync': 'node scripts/sync-project-metadata.mjs',
    },
  });
}

function writeMakeClientMetadata(projectRoot: string, id = 'make-client-a', name = 'Make Client A') {
  writeProjectMetadata(projectRoot, {
    project: { id, name },
    resources: {
      prototypes: [],
      docs: [],
      themes: [],
      data: [],
      templates: [],
    },
    navigation: { prototypes: [], docs: [] },
    orders: { themes: [], data: [], templates: [] },
  });
}

function writeMakeClientTemplate(templateRoot: string) {
  writeJson(path.join(templateRoot, 'package.json'), {
    name: '@axhub/make-client',
    scripts: {
      dev: 'vite',
      'metadata:sync': 'node scripts/sync-project-metadata.mjs',
    },
  });
  fs.mkdirSync(path.join(templateRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, 'scripts', 'sync-project-metadata.mjs'), 'export {};\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, 'src', 'prototypes', 'template-home'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, 'src', 'prototypes', 'template-home', 'index.tsx'), 'export default function TemplateHome() { return null; }\n', 'utf8');
  writeJson(getMakeClientMarkerPath(templateRoot), {
    schemaVersion: 1,
    kind: 'axhub-make-client',
    repository: 'https://github.com/lintendo/Axhub-Make-Client.git',
    project: { id: 'template-client', name: 'Template Client' },
  });
  fs.mkdirSync(path.join(templateRoot, '.git'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, '.git', 'config'), '[core]\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, 'node_modules', 'left-pad'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, 'node_modules', 'left-pad', 'index.js'), 'module.exports = null;\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, 'dist', 'template-home.js'), 'console.log("built");\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, '.trae'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, '.trae', 'local.json'), '{}\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, 'temp'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, 'temp', 'scratch.txt'), 'scratch\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, '.axhub', 'make'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', '.dev-server-info.json'), JSON.stringify({
    origin: 'http://template-stale-runtime.invalid',
  }), 'utf8');
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', 'axhub.config.json'), '{}\n', 'utf8');
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', 'sidebar-tree.json'), '{}\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, '.axhub', 'make', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', 'sessions', 'stale.json'), '{}\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, '.axhub', 'make', 'exports'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', 'exports', 'stale.html'), '<!doctype html>\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, '.axhub', 'make', 'edit-history'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', 'edit-history', 'stale.json'), '{}\n', 'utf8');
}

describe('make-server make client project APIs', () => {
  it('exposes Make client project routes from their domain module', () => {
    expect(handleMakeClientProjectApi).toBeTypeOf('function');
  });

  it('reports make client dev status without starting the project', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-status-');
    writeMakeClientMarker(projectRoot, 'status-client', 'Status Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'status-client', 'Status Client');
    const server = await startTestServer(defaultRoot);

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const statusResponse = await fetch(`${server.origin}/api/projects/status-client/dev/status`);
      const statusBody = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(statusBody).toMatchObject({
        projectId: 'status-client',
        makeClient: true,
        running: false,
        reason: 'not-running',
      });
      expect(childProcessMock.execFile).not.toHaveBeenCalled();
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('reports a running make client when runtime health matches the project', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-running-');
    writeMakeClientMarker(projectRoot, 'running-client', 'Running Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'running-client', 'Running Client');
    const server = await startTestServer(defaultRoot);
    const runtimeServer = await startTestServer(projectRoot);

    try {
      writeServerInfo(projectRoot, 'runtime', {
        pid: process.pid,
        port: runtimeServer.port,
        host: 'localhost',
        origin: runtimeServer.origin,
        projectRoot,
        startedAt: new Date().toISOString(),
      });

      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const statusResponse = await fetch(`${server.origin}/api/projects/running-client/dev/status`);
      const statusBody = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(statusBody).toMatchObject({
        projectId: 'running-client',
        makeClient: true,
        running: true,
        runtime: {
          origin: runtimeServer.origin,
        },
      });
      expect(statusBody.reason).toBeUndefined();
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await runtimeServer.close();
      await server.close();
    }
  });

  it('serves make client resource URLs from the live runtime origin instead of stale metadata', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-live-links-');
    writeMakeClientMarker(projectRoot, 'live-links-client', 'Live Links Client');
    writeMakeClientPackage(projectRoot);
    writeProjectMetadata(projectRoot, {
      project: { id: 'live-links-client', name: 'Live Links Client' },
      resources: {
        prototypes: [
          {
            id: 'home',
            name: 'home',
            title: 'Home',
            clientUrl: 'http://localhost:51721/prototypes/home',
          },
        ],
        docs: [],
        themes: [
          {
            id: 'brand',
            name: 'brand',
            title: 'Brand',
            clientUrl: 'http://localhost:51721/themes/brand',
            previewUrl: 'http://localhost:51721/themes/brand',
          },
        ],
        data: [],
        templates: [],
      },
      navigation: { prototypes: ['home'], docs: [] },
      orders: { themes: ['brand'], data: [], templates: [] },
    });
    const server = await startTestServer(defaultRoot, undefined, {
      runtimeOrigin: 'http://localhost:51720',
    });

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const activeResponse = await fetch(`${server.origin}/api/projects/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'live-links-client' }),
      });
      expect(activeResponse.status).toBe(200);

      const resourcesResponse = await fetch(`${server.origin}/api/projects/live-links-client/resources`);
      const resourcesBody = await resourcesResponse.json();
      const entriesResponse = await fetch(`${server.origin}/api/entries.json`);
      const entriesBody = await entriesResponse.json();

      expect(resourcesResponse.status).toBe(200);
      expect(resourcesBody.resources.prototypes[0]).toMatchObject({
        clientUrl: 'http://localhost:51720/prototypes/home',
      });
      expect(resourcesBody.resources.themes[0]).toMatchObject({
        clientUrl: 'http://localhost:51720/themes/brand',
        previewUrl: 'http://localhost:51720/themes/brand',
      });
      expect(entriesResponse.status).toBe(200);
      expect(entriesBody.prototypes[0]).toMatchObject({
        clientUrl: 'http://localhost:51720/prototypes/home',
      });
      expect(JSON.parse(fs.readFileSync(getProjectMetadataPath(projectRoot), 'utf8')).resources.prototypes[0].clientUrl)
        .toBe('http://localhost:51721/prototypes/home');
    } finally {
      await server.close();
    }
  });

  it('marks stale make client runtime info as not running', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-stale-');
    writeMakeClientMarker(projectRoot, 'stale-client', 'Stale Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'stale-client', 'Stale Client');
    writeServerInfo(projectRoot, 'runtime', {
      pid: process.pid,
      port: 9,
      host: 'localhost',
      origin: 'http://127.0.0.1:9',
      projectRoot,
      startedAt: new Date().toISOString(),
    });
    const server = await startTestServer(defaultRoot);

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const statusResponse = await fetch(`${server.origin}/api/projects/stale-client/dev/status`);
      const statusBody = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(statusBody).toMatchObject({
        projectId: 'stale-client',
        makeClient: true,
        running: false,
        reason: 'stale-runtime',
      });
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('does not reuse stale make client runtime info when ensuring dev', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-stale-ensure-');
    writeMakeClientMarker(projectRoot, 'stale-ensure-client', 'Stale Ensure Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'stale-ensure-client', 'Stale Ensure Client');
    writeServerInfo(projectRoot, 'runtime', {
      pid: process.pid,
      port: 9,
      host: 'localhost',
      origin: 'http://127.0.0.1:9',
      projectRoot,
      startedAt: new Date().toISOString(),
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51726,
        host: 'localhost',
        origin: 'http://localhost:51726',
        projectRoot: targetRoot,
        startedAt: new Date().toISOString(),
      });
      const child = {
        once: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(callback, 0);
          }
          return child;
        }),
        unref: vi.fn(),
      };
      return child;
    });
    const server = await startTestServer(defaultRoot);

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const ensureResponse = await fetch(`${server.origin}/api/projects/stale-ensure-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(200);
      expect(ensureBody).toMatchObject({
        success: true,
        projectId: 'stale-ensure-client',
        reused: false,
        runtime: {
          origin: 'http://localhost:51726',
        },
      });
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.objectContaining({ cwd: projectRoot }),
      );
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        'pnpm',
        ['dev'],
        expect.objectContaining({
          cwd: projectRoot,
          env: expect.objectContaining({ PATH: expect.any(String) }),
        }),
      );
    } finally {
      await server.close();
    }
  });

  it('runs install and metadata sync through the shared local command runner', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-local-command-');
    writeMakeClientMarker(projectRoot, 'local-command-client', 'Local Command Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'local-command-client', 'Local Command Client');
    runLocalCommandMock.mockImplementation(async (command: string, args: string[], options: any) => {
      if (command === 'pnpm' && args[0] === 'metadata:sync') {
        writeMakeClientMetadata(String(options?.cwd || ''), 'local-command-client', 'Local Command Client');
      }
      return {
        stdout: '',
        stderr: '',
        command,
        escapedCommand: [command, ...args].join(' '),
      };
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51728,
        host: 'localhost',
        origin: 'http://localhost:51728',
        projectRoot: targetRoot,
        startedAt: new Date().toISOString(),
      });
      const child = {
        once: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(callback, 0);
          }
          return child;
        }),
        unref: vi.fn(),
      };
      return child;
    });
    const server = await startTestServer(defaultRoot);

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const ensureResponse = await fetch(`${server.origin}/api/projects/local-command-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(200);
      expect(ensureBody).toMatchObject({
        success: true,
        projectId: 'local-command-client',
        runtime: {
          origin: 'http://localhost:51728',
        },
      });
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.objectContaining({ cwd: projectRoot, maxBuffer: 1024 * 1024 * 20 }),
      );
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        'pnpm',
        ['metadata:sync'],
        expect.objectContaining({ cwd: projectRoot, maxBuffer: 1024 * 1024 * 20 }),
      );
      expect(childProcessMock.execFile).not.toHaveBeenCalled();
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        'pnpm',
        ['dev'],
        expect.objectContaining({
          cwd: projectRoot,
          env: expect.objectContaining({ PATH: expect.any(String) }),
        }),
      );
    } finally {
      await server.close();
    }
  });

  it('waits for fresh runtime info instead of returning an old stale file after spawning dev', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-fresh-ensure-');
    writeMakeClientMarker(projectRoot, 'fresh-ensure-client', 'Fresh Ensure Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'fresh-ensure-client', 'Fresh Ensure Client');
    writeServerInfo(projectRoot, 'runtime', {
      pid: process.pid,
      port: 9,
      host: 'localhost',
      origin: 'http://127.0.0.1:9',
      projectRoot,
      startedAt: '2026-05-01T00:00:00.000Z',
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      setTimeout(() => {
        writeServerInfo(targetRoot, 'runtime', {
          pid: process.pid,
          port: 51727,
          host: 'localhost',
          origin: 'http://localhost:51727',
          projectRoot: targetRoot,
          startedAt: new Date().toISOString(),
        });
      }, 20);
      const child = {
        once: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(callback, 0);
          }
          return child;
        }),
        unref: vi.fn(),
      };
      return child;
    });
    const server = await startTestServer(defaultRoot);

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const ensureResponse = await fetch(`${server.origin}/api/projects/fresh-ensure-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 250, pollIntervalMs: 5 }),
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(200);
      expect(ensureBody).toMatchObject({
        success: true,
        projectId: 'fresh-ensure-client',
        reused: false,
        runtime: {
          origin: 'http://localhost:51727',
        },
      });
    } finally {
      await server.close();
    }
  });

  it('rejects non-make projects before they enter the project registry', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-non-make-client-');
    writeMakeClientMetadata(projectRoot, 'plain-client', 'Plain Client');
    const server = await startTestServer(defaultRoot);

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      const registerBody = await registerResponse.json();
      expect(registerResponse.status).toBe(400);
      expect(registerBody).toMatchObject({ code: 'NOT_MAKE_CLIENT_PROJECT' });

      const statusResponse = await fetch(`${server.origin}/api/projects/plain-client/dev/status`);
      const statusBody = await statusResponse.json();

      expect(statusResponse.status).toBe(404);
      expect(statusBody).toMatchObject({
        code: 'project-not-found',
        projectId: 'plain-client',
      });
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('rejects metadata-only folders when registering an existing make client project', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const metadataOnlyRoot = createTempRoot('axhub-make-metadata-only-');
    writeMakeClientMetadata(metadataOnlyRoot, 'metadata-only', 'Metadata Only');
    const server = await startTestServer(defaultRoot);

    try {
      const response = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: metadataOnlyRoot }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        code: 'NOT_MAKE_CLIENT_PROJECT',
        root: metadataOnlyRoot,
      });
    } finally {
      await server.close();
    }
  });

  it('registers a marker-backed make client project and ensures dev before activating it', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot, {
      project: { id: 'default-client', name: 'Default Client' },
    });
    const projectRoot = createTempRoot('axhub-make-client-existing-');
    writeMakeClientMarker(projectRoot, 'existing-client', 'Existing Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'existing-client', 'Existing Client');
    const server = await startTestServer(defaultRoot);
    const runtimeServer = await startTestServer(projectRoot);

    try {
      writeServerInfo(projectRoot, 'runtime', {
        pid: process.pid,
        port: runtimeServer.port,
        host: 'localhost',
        origin: runtimeServer.origin,
        projectRoot,
        startedAt: new Date().toISOString(),
      });

      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      const registerBody = await registerResponse.json();

      expect(registerResponse.status).toBe(201);
      expect(registerBody.project).toMatchObject({
        id: 'existing-client',
        name: 'Existing Client',
        root: projectRoot,
      });

      const ensureResponse = await fetch(`${server.origin}/api/projects/existing-client/dev/ensure`, {
        method: 'POST',
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(200);
      expect(ensureBody).toMatchObject({
        success: true,
        projectId: 'existing-client',
        reused: true,
        runtime: {
          origin: runtimeServer.origin,
        },
      });
      expect(fs.existsSync(getAdminServerInfoPath(projectRoot))).toBe(true);

      const activeResponse = await fetch(`${server.origin}/api/projects/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'existing-client' }),
      });
      expect(activeResponse.status).toBe(200);
    } finally {
      await runtimeServer.close();
      await server.close();
    }
  });

  it('does not reuse metadata-only runtime files for project switching', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot, {
      project: { id: 'default-client', name: 'Default Client' },
    });
    const projectRoot = createTempRoot('axhub-metadata-only-client-');
    writeMakeClientMetadata(projectRoot, 'metadata-only-client', 'Metadata Only Client');
    writeServerInfo(projectRoot, 'runtime', {
      pid: process.pid,
      port: 51725,
      host: 'localhost',
      origin: 'http://localhost:51725',
      projectRoot,
      startedAt: new Date().toISOString(),
    });
    const server = await startTestServer(defaultRoot);

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(400);

      const ensureResponse = await fetch(`${server.origin}/api/projects/metadata-only-client/dev/ensure`, {
        method: 'POST',
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(404);
      expect(ensureBody).toMatchObject({
        code: 'project-not-found',
        projectId: 'metadata-only-client',
      });
      expect(childProcessMock.execFile).not.toHaveBeenCalled();
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('starts dev while registering an existing make client project when requested', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-register-dev-');
    writeMakeClientMarker(projectRoot, 'register-dev-client', 'Register Dev Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'register-dev-client', 'Register Dev Client');
    childProcessMock.spawn.mockImplementation((_file?: string, _args?: string[], options?: { cwd?: string }) => {
      const targetRoot = String(options?.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51722,
        host: 'localhost',
        origin: 'http://localhost:51722',
        projectRoot: targetRoot,
        startedAt: new Date().toISOString(),
      });
      const child = {
        once: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(callback, 0);
          }
          return child;
        }),
        unref: vi.fn(),
      };
      return child;
    });
    const server = await startTestServer(defaultRoot);

    try {
      const response = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot, ensureDev: true, timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        success: true,
        project: {
          id: 'register-dev-client',
        },
        runtime: {
          origin: 'http://localhost:51722',
        },
      });
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.objectContaining({ cwd: projectRoot }),
      );
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        'pnpm',
        ['dev'],
        expect.objectContaining({
          cwd: projectRoot,
          env: expect.objectContaining({ PATH: expect.any(String) }),
        }),
      );
    } finally {
      await server.close();
    }
  });

  it('does not register an existing make client project when dev startup fails during registration', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-register-fails-');
    writeMakeClientMarker(projectRoot, 'register-fails-client', 'Register Fails Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'register-fails-client', 'Register Fails Client');
    const server = await startTestServer(defaultRoot);

    try {
      const response = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot, ensureDev: true, timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const body = await response.json();
      const projectsBody = await fetch(`${server.origin}/api/projects`).then((projectsResponse) => projectsResponse.json());

      expect(response.status).toBe(504);
      expect(body).toMatchObject({ code: 'MAKE_CLIENT_DEV_TIMEOUT' });
      expect(projectsBody.projects.some((project: any) => project.id === 'register-fails-client')).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('creates a blank make client project from the embedded template and starts dev', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const templateRoot = createTempRoot('axhub-make-template-');
    writeMakeClientTemplate(templateRoot);
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startTestServer(defaultRoot, registryHome, { makeClientTemplateRoot: templateRoot });

    runLocalCommandMock.mockImplementation(async (command: string, args: string[], options: any) => {
      if (command === 'pnpm' && args[0] === 'metadata:sync') {
        writeMakeClientMetadata(String(options?.cwd || ''), 'sales-demo', 'Sales Demo');
      }
      return {
        stdout: '',
        stderr: '',
        command,
        escapedCommand: [command, ...args].join(' '),
      };
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51721,
        host: 'localhost',
        origin: 'http://localhost:51721',
        projectRoot: targetRoot,
        startedAt: new Date().toISOString(),
      });
      const child = {
        once: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(callback, 0);
          }
          return child;
        }),
        unref: vi.fn(),
      };
      return child;
    });

    try {
      const response = await fetch(`${server.origin}/api/projects/make/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentRoot,
          folderName: 'Sales Demo',
          projectName: 'Sales Demo',
        }),
      });
      const body = await response.json();
      const targetRoot = path.join(parentRoot, 'sales-demo');

      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        success: true,
        phase: 'ready',
        project: {
          id: 'sales-demo',
          name: 'Sales Demo',
          root: targetRoot,
        },
        runtime: {
          origin: 'http://localhost:51721',
        },
      });
      expect(fs.existsSync(path.join(targetRoot, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(targetRoot, 'scripts', 'sync-project-metadata.mjs'))).toBe(true);
      expect(fs.existsSync(path.join(targetRoot, 'src', 'prototypes', 'template-home', 'index.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(targetRoot, '.git'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, 'node_modules'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, 'dist'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, '.trae'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, 'temp'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, '.axhub', 'make', 'axhub.config.json'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, '.axhub', 'make', 'sidebar-tree.json'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, '.axhub', 'make', 'sessions'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, '.axhub', 'make', 'exports'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, '.axhub', 'make', 'edit-history'))).toBe(false);
      expect(JSON.parse(fs.readFileSync(getRuntimeServerInfoPath(targetRoot), 'utf8'))).toMatchObject({
        origin: 'http://localhost:51721',
      });
      expect(JSON.parse(fs.readFileSync(getMakeClientMarkerPath(targetRoot), 'utf8'))).toMatchObject({
        repository: TEMPLATE_SOURCE_URL,
        project: {
          id: 'sales-demo',
          name: 'Sales Demo',
        },
      });
      expect(childProcessMock.execFile).not.toHaveBeenCalledWith(
        'git',
        expect.any(Array),
        expect.any(Object),
        expect.any(Function),
      );
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.objectContaining({ cwd: targetRoot }),
      );
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        'pnpm',
        ['metadata:sync'],
        expect.objectContaining({ cwd: targetRoot }),
      );
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        'pnpm',
        ['dev'],
        expect.objectContaining({
          cwd: targetRoot,
          detached: true,
          env: expect.objectContaining({ PATH: expect.any(String) }),
        }),
      );
      expect(fs.existsSync(getRuntimeServerInfoPath(targetRoot))).toBe(true);
      expect(fs.existsSync(getProjectMetadataPath(targetRoot))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('ignores request-supplied templateRoot because the template is server-owned', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const templateRoot = createTempRoot('axhub-make-template-');
    writeMakeClientTemplate(templateRoot);
    const missingTemplateRoot = path.join(createTempRoot('axhub-make-missing-template-parent-'), 'missing-template');
    const server = await startTestServer(defaultRoot, undefined, { makeClientTemplateRoot: templateRoot });

    runLocalCommandMock.mockImplementation(async (command: string, args: string[], options: any) => {
      if (command === 'pnpm' && args[0] === 'metadata:sync') {
        writeMakeClientMetadata(String(options?.cwd || ''), 'owned-template', 'Owned Template');
      }
      return {
        stdout: '',
        stderr: '',
        command,
        escapedCommand: [command, ...args].join(' '),
      };
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51723,
        host: 'localhost',
        origin: 'http://localhost:51723',
        projectRoot: targetRoot,
        startedAt: new Date().toISOString(),
      });
      const child = {
        once: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(callback, 0);
          }
          return child;
        }),
        unref: vi.fn(),
      };
      return child;
    });

    try {
      const response = await fetch(`${server.origin}/api/projects/make/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentRoot,
          folderName: 'Owned Template',
          projectName: 'Owned Template',
          templateRoot: missingTemplateRoot,
        }),
      });
      const body = await response.json();
      const targetRoot = path.join(parentRoot, 'owned-template');

      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        success: true,
        phase: 'ready',
        project: {
          id: 'owned-template',
          root: targetRoot,
        },
      });
      expect(fs.existsSync(path.join(targetRoot, 'package.json'))).toBe(true);
      expect(JSON.parse(fs.readFileSync(getMakeClientMarkerPath(targetRoot), 'utf8'))).toMatchObject({
        repository: TEMPLATE_SOURCE_URL,
        project: {
          id: 'owned-template',
          name: 'Owned Template',
        },
      });
    } finally {
      await server.close();
    }
  });

  it('reports a clear error when the embedded make client template is unavailable', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const missingTemplateRoot = path.join(createTempRoot('axhub-make-missing-template-parent-'), 'missing-template');
    const server = await startTestServer(defaultRoot, undefined, { makeClientTemplateRoot: missingTemplateRoot });

    try {
      const response = await fetch(`${server.origin}/api/projects/make/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentRoot,
          folderName: 'Missing Template',
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toMatchObject({
        code: 'MAKE_CLIENT_TEMPLATE_UNAVAILABLE',
      });
      expect(childProcessMock.execFile).not.toHaveBeenCalled();
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('rejects unsafe or non-empty blank project target folders', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const server = await startTestServer(defaultRoot);

    try {
      const unsafe = await fetch(`${server.origin}/api/projects/make/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentRoot, folderName: '../escape' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(unsafe.status).toBe(400);
      expect(unsafe.body).toMatchObject({ code: 'INVALID_MAKE_PROJECT_FOLDER_NAME' });

      const existingRoot = path.join(parentRoot, 'existing-client');
      fs.mkdirSync(existingRoot, { recursive: true });
      fs.writeFileSync(path.join(existingRoot, 'README.md'), '# Existing\n', 'utf8');

      const existing = await fetch(`${server.origin}/api/projects/make/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentRoot, folderName: 'existing-client' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(existing.status).toBe(409);
      expect(existing.body).toMatchObject({ code: 'MAKE_PROJECT_TARGET_NOT_EMPTY' });
      expect(childProcessMock.execFile).not.toHaveBeenCalledWith(
        'git',
        expect.any(Array),
        expect.any(Object),
        expect.any(Function),
      );
    } finally {
      await server.close();
    }
  });

  it('keeps the previous active project when dev ensure fails', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot, {
      project: { id: 'default-client', name: 'Default Client' },
    });
    const projectRoot = createTempRoot('axhub-make-client-timeout-');
    writeMakeClientMarker(projectRoot, 'timeout-client', 'Timeout Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'timeout-client', 'Timeout Client');
    const server = await startTestServer(defaultRoot);

    childProcessMock.spawn.mockImplementation(() => {
      const child = {
        once: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'spawn') {
            setTimeout(callback, 0);
          }
          return child;
        }),
        unref: vi.fn(),
      };
      return child;
    });

    try {
      await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });

      const ensureResponse = await fetch(`${server.origin}/api/projects/timeout-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(504);
      expect(ensureBody).toMatchObject({ code: 'MAKE_CLIENT_DEV_TIMEOUT' });

      const active = await fetch(`${server.origin}/api/projects/active`).then((response) => response.json());
      expect(active.id).toBe('default-client');
    } finally {
      await server.close();
    }
  });

  it('switches the active project without implicitly starting make client dev', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot, {
      project: { id: 'default-client', name: 'Default Client' },
    });
    const projectRoot = createTempRoot('axhub-make-client-switch-');
    writeMakeClientMarker(projectRoot, 'switch-client', 'Switch Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'switch-client', 'Switch Client');
    const server = await startTestServer(defaultRoot);

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const activeResponse = await fetch(`${server.origin}/api/projects/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'switch-client' }),
      });
      const activeBody = await activeResponse.json();

      expect(activeResponse.status).toBe(200);
      expect(activeBody.activeProject).toMatchObject({ id: 'switch-client' });
      expect(childProcessMock.execFile).not.toHaveBeenCalled();
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });
});
