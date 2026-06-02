import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAdminServerInfoPath,
  getMakeClientMarkerPath,
  getProjectMetadataPath,
  getRuntimeServerInfoPath,
  readServerInfo,
  writeServerInfo,
} from '../projectCore/index.ts';

import {
  cleanupProjectApiTestRoots,
  createZipFromDirectory,
  createTempRoot,
  getTestProjectRegistryPath,
  registerProject,
  startTestServer,
  writeJson,
  writeProjectMetadata,
} from './projects-api.helpers';
import { handleMakeClientProjectApi } from '../managementApi.makeClient.ts';
import {
  slugifyMakeClientFolderName,
  suggestMakeClientFolderName,
} from '../makeClientProject.ts';

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

vi.mock('node:child_process', async (importActual) => {
  const actual = await importActual<typeof import('node:child_process')>();
  return {
    ...actual,
    ...childProcessMock,
  };
});

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

const DEFAULT_TEMPLATE_VERSION = '0.1.3';
const TEMPLATE_ZIP_URL = `https://github.com/lintendo/Axhub-Make/releases/download/make-client-template-v${DEFAULT_TEMPLATE_VERSION}/axhub-make-client-template.zip`;
const TEMPLATE_MIRROR_ZIP_URL = `https://gitee.com/axhub/Axhub-Make/releases/download/make-client-template-v${DEFAULT_TEMPLATE_VERSION}/axhub-make-client-template.zip`;
const TEMPLATE_MIRROR_SOURCE_URL = 'https://gitee.com/axhub/Axhub-Make/tree/main/client';
const TEMPLATE_CACHE_ROOT = path.join(os.tmpdir(), 'axhub-make', 'make-client-template-cache');

function templateCachePath(url: string) {
  const key = crypto.createHash('sha256').update(url).digest('hex');
  return path.join(TEMPLATE_CACHE_ROOT, `${key}.zip`);
}

function templateCacheManifestPath(url: string) {
  return `${templateCachePath(url)}.json`;
}

function localCommandResult(command: string, args: string[]) {
  return {
    stdout: '',
    stderr: '',
    command,
    escapedCommand: [command, ...args].join(' '),
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(TEMPLATE_CACHE_ROOT, { recursive: true, force: true });
  runLocalCommandMock.mockReset();
  runLocalCommandMock.mockImplementation(async (command: string, args: string[], commandOptions: any) => {
    if ((command === 'pnpm' || command === 'npm' || command === 'npm.cmd') && args[0] === 'install') {
      writeInstalledMakeClientDependencies(String(commandOptions?.cwd || ''));
    }
    return localCommandResult(command, args);
  });
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
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fs.rmSync(TEMPLATE_CACHE_ROOT, { recursive: true, force: true });
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

function writeInstalledMakeClientDependencies(projectRoot: string) {
  const binDir = path.join(projectRoot, 'node_modules', '.bin');
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, process.platform === 'win32' ? 'vite.cmd' : 'vite'), '', 'utf8');
  const viteRoot = path.join(projectRoot, 'node_modules', 'vite');
  fs.mkdirSync(path.join(viteRoot, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(viteRoot, 'package.json'), JSON.stringify({ bin: { vite: 'bin/vite.js' } }), 'utf8');
  fs.writeFileSync(path.join(viteRoot, 'bin', 'vite.js'), '#!/usr/bin/env node\n', 'utf8');
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
  }, { makeClientMarker: false });
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
  fs.mkdirSync(path.join(templateRoot, '.agents', 'skills', 'local'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, '.agents', 'skills', 'local', 'SKILL.md'), 'npm run typecheck\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, '.claude', 'skills', 'local'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, '.claude', 'skills', 'local', 'SKILL.md'), 'npm run typecheck\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, 'node_modules', 'left-pad'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, 'node_modules', 'left-pad', 'index.js'), 'module.exports = null;\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, 'dist', 'template-home.js'), 'console.log("built");\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, 'tests', 'template.test.mjs'), 'export {};\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, '.trae'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, '.trae', 'local.json'), '{}\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, 'temp'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, 'temp', 'scratch.txt'), 'scratch\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, '.axhub', 'make'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', 'client.json'), '{}\n', 'utf8');
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', 'README.md'), '# Make client metadata\n', 'utf8');
  writeJson(path.join(templateRoot, '.axhub', 'make', 'sidebar-tree.json'), {
    version: 1,
    updatedAt: '2026-05-29T00:00:00.000Z',
    prototypes: [],
    docs: [],
    themesTree: [
      {
        id: 'folder-themes-test',
        kind: 'folder',
        title: '行业',
        children: [
          { id: 'item-themes-test', kind: 'item', title: 'Test Theme', itemKey: 'themes/test-theme' },
        ],
      },
    ],
    themes: [],
    data: [],
    templates: [],
  });
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', 'project.json'), '{}\n', 'utf8');
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', '.dev-server-info.json'), JSON.stringify({
    origin: 'http://template-stale-runtime.invalid',
  }), 'utf8');
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', 'axhub.config.json'), '{}\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, '.axhub', 'make', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', 'sessions', 'stale.json'), '{}\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, '.axhub', 'make', 'exports'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', 'exports', 'stale.html'), '<!doctype html>\n', 'utf8');
  fs.mkdirSync(path.join(templateRoot, '.axhub', 'make', 'edit-history'), { recursive: true });
  fs.writeFileSync(path.join(templateRoot, '.axhub', 'make', 'edit-history', 'stale.json'), '{}\n', 'utf8');
}

function createMakeClientTemplateZip(options: { unsafeEntry?: string } = {}) {
  const sourceRoot = createTempRoot('axhub-make-template-zip-source-');
  const zipRoot = createTempRoot('axhub-make-template-zip-file-');
  if (options.unsafeEntry) {
    fs.mkdirSync(path.join(sourceRoot, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, 'evil.txt'), 'unsafe\n', 'utf8');
    const zipPath = path.join(zipRoot, 'unsafe.zip');
    execFileSync('zip', ['-q', zipPath, options.unsafeEntry], { cwd: path.join(sourceRoot, 'nested') });
    return fs.readFileSync(zipPath);
  }
  writeMakeClientTemplate(path.join(sourceRoot, 'axhub-make-client-template'));
  const zipPath = path.join(zipRoot, 'axhub-make-client-template.zip');
  createZipFromDirectory(sourceRoot, zipPath);
  return fs.readFileSync(zipPath);
}

function installRemoteTemplateFetchMock(options: {
  failPrimary?: boolean;
  failMirror?: boolean;
  unsafePrimaryZipEntry?: string;
  customTemplateUrl?: string;
} = {}) {
  const primaryZip = createMakeClientTemplateZip(
    options.unsafePrimaryZipEntry ? { unsafeEntry: options.unsafePrimaryZipEntry } : {},
  );
  const mirrorZip = createMakeClientTemplateZip();
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (options.customTemplateUrl && url === options.customTemplateUrl) {
      return new Response(primaryZip, { headers: { 'Content-Type': 'application/zip' } });
    }
    if (url === TEMPLATE_ZIP_URL) {
      if (options.failPrimary) {
        return new Response('Primary template zip unavailable', { status: 503 });
      }
      return new Response(primaryZip, { headers: { 'Content-Type': 'application/zip' } });
    }
    if (url === TEMPLATE_MIRROR_ZIP_URL) {
      if (options.failMirror) {
        return new Response('Mirror template zip unavailable', { status: 503 });
      }
      return new Response(mirrorZip, { headers: { 'Content-Type': 'application/zip' } });
    }
    return originalFetch(input, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function installRemoteTemplateCommandMock(options: {
  failPrimary?: boolean;
  failMirror?: boolean;
  unsafePrimaryZipEntry?: string;
  customTemplateUrl?: string;
  metadataId?: string;
  metadataName?: string;
} = {}) {
  runLocalCommandMock.mockImplementation(async (command: string, args: string[], commandOptions: any) => {
    if ((command === 'pnpm' || command === 'npm' || command === 'npm.cmd') && args[0] === 'install') {
      writeInstalledMakeClientDependencies(String(commandOptions?.cwd || ''));
    }
    if (command === 'pnpm' && args[0] === 'metadata:sync') {
      writeMakeClientMetadata(
        String(commandOptions?.cwd || ''),
        options.metadataId || path.basename(String(commandOptions?.cwd || '')),
        options.metadataName || options.metadataId || path.basename(String(commandOptions?.cwd || '')),
      );
    }
    return localCommandResult(command, args);
  });
  installRemoteTemplateFetchMock(options);
}

describe('make-server make client project APIs', () => {
  it('suggests ASCII-only make client folder names with date and sequence fallbacks', () => {
    const parentRoot = createTempRoot('axhub-make-parent-');
    fs.mkdirSync(path.join(parentRoot, 'make-project-20260529'), { recursive: true });

    expect(slugifyMakeClientFolderName('CRM Demo 2026')).toBe('crm-demo-2026');
    expect(slugifyMakeClientFolderName('客户旅程分析平台')).toBe('');
    expect(suggestMakeClientFolderName({
      parentRoot,
      projectName: '客户旅程分析平台',
      now: new Date('2026-05-29T08:00:00Z'),
    })).toBe('make-project-20260529-2');
  });

  it('returns an available ASCII folder name suggestion for Chinese project names', async () => {
    const defaultRoot = createTempRoot('axhub-make-default-');
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    fs.mkdirSync(path.join(parentRoot, 'make-project-20260529'), { recursive: true });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T08:00:00Z'));
    const server = await startTestServer(defaultRoot);

    try {
      const response = await fetch(`${server.origin}/api/projects/make/folder-name-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentRoot,
          projectName: '客户旅程分析平台',
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ folderName: 'make-project-20260529-2' });
    } finally {
      await server.close();
      vi.useRealTimers();
    }
  });

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
        timestamp: new Date().toISOString(),
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

  it('treats local runtime info as running even when the recorded origin serves another project', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-local-runtime-');
    const otherRoot = createTempRoot('axhub-make-client-port-owner-');
    writeMakeClientMarker(projectRoot, 'local-runtime-client', 'Local Runtime Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'local-runtime-client', 'Local Runtime Client');
    const server = await startTestServer(defaultRoot);
    const portOwnerServer = await startTestServer(otherRoot);

    try {
      writeServerInfo(projectRoot, 'runtime', {
        pid: process.pid,
        port: portOwnerServer.port,
        host: 'localhost',
        origin: portOwnerServer.origin,
        projectRoot,
        startedAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      });

      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const statusResponse = await fetch(`${server.origin}/api/projects/local-runtime-client/dev/status`);
      const statusBody = await statusResponse.json();
      const ensureResponse = await fetch(`${server.origin}/api/projects/local-runtime-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const ensureBody = await ensureResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(statusBody).toMatchObject({
        projectId: 'local-runtime-client',
        makeClient: true,
        running: true,
        runtime: {
          origin: portOwnerServer.origin,
          projectRoot,
        },
      });
      expect(statusBody.reason).toBeUndefined();
      expect(ensureResponse.status).toBe(200);
      expect(ensureBody).toMatchObject({
        success: true,
        projectId: 'local-runtime-client',
        reused: true,
        runtime: {
          origin: portOwnerServer.origin,
          projectRoot,
        },
      });
      expect(runLocalCommandMock).not.toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.anything(),
      );
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await portOwnerServer.close();
      await server.close();
    }
  });

  it('reuses a discovered make client runtime when ensuring dev and the runtime file is missing', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-discovered-ensure-');
    writeMakeClientMarker(projectRoot, 'discovered-ensure-client', 'Discovered Ensure Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'discovered-ensure-client', 'Discovered Ensure Client');
    const server = await startTestServer(defaultRoot);
    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'http://localhost:51724/api/health') {
        return new Response(JSON.stringify({
          ok: true,
          role: 'runtime',
          projectRoot,
          server: {
            pid: process.pid,
            port: 51724,
            host: 'localhost',
            origin: 'http://localhost:51724',
            projectRoot,
            startedAt: new Date().toISOString(),
            timestamp: new Date().toISOString(),
          },
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    });

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const ensureResponse = await fetch(`${server.origin}/api/projects/discovered-ensure-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(200);
      expect(ensureBody).toMatchObject({
        success: true,
        projectId: 'discovered-ensure-client',
        reused: true,
        runtime: {
          origin: 'http://localhost:51724',
          projectRoot,
        },
      });
      expect(readServerInfo(projectRoot, 'runtime')).toMatchObject({
        origin: 'http://localhost:51724',
        projectRoot,
      });
      expect(runLocalCommandMock).not.toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.anything(),
      );
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('returns the discovered runtime when ensuring dev from stale runtime info', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-discovered-stale-ensure-');
    writeMakeClientMarker(projectRoot, 'discovered-stale-client', 'Discovered Stale Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'discovered-stale-client', 'Discovered Stale Client');
    writeServerInfo(projectRoot, 'runtime', {
      pid: process.pid,
      port: 9,
      host: 'localhost',
      origin: 'http://127.0.0.1:9',
      projectRoot,
      startedAt: new Date().toISOString(),
      timestamp: new Date(Date.now() - 60_000).toISOString(),
    });
    const server = await startTestServer(defaultRoot);
    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'http://localhost:51724/api/health') {
        return new Response(JSON.stringify({
          ok: true,
          role: 'runtime',
          projectRoot,
          server: {
            pid: process.pid,
            port: 51724,
            host: 'localhost',
            origin: 'http://localhost:51724',
            projectRoot,
            startedAt: new Date().toISOString(),
            timestamp: new Date().toISOString(),
          },
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    });

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const ensureResponse = await fetch(`${server.origin}/api/projects/discovered-stale-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(200);
      expect(ensureBody).toMatchObject({
        success: true,
        projectId: 'discovered-stale-client',
        reused: true,
        runtime: {
          origin: 'http://localhost:51724',
          projectRoot,
        },
      });
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('includes local make client runtime status in the project list', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-list-running-');
    const portOwnerRoot = createTempRoot('axhub-make-client-list-port-owner-');
    writeMakeClientMarker(projectRoot, 'list-running-client', 'List Running Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'list-running-client', 'List Running Client');
    const server = await startTestServer(defaultRoot);
    const portOwnerServer = await startTestServer(portOwnerRoot);

    try {
      writeServerInfo(projectRoot, 'runtime', {
        pid: process.pid,
        port: portOwnerServer.port,
        host: 'localhost',
        origin: portOwnerServer.origin,
        projectRoot,
        startedAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      });

      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const listResponse = await fetch(`${server.origin}/api/projects`);
      const listBody = await listResponse.json();
      const project = listBody.projects.find((item: any) => item.id === 'list-running-client');

      expect(listResponse.status).toBe(200);
      expect(project).toMatchObject({
        id: 'list-running-client',
        runtimeStatus: {
          projectId: 'list-running-client',
          makeClient: true,
          running: true,
          runtime: {
            origin: portOwnerServer.origin,
            projectRoot,
          },
        },
      });
      expect(project.runtimeStatus.reason).toBeUndefined();
    } finally {
      await portOwnerServer.close();
      await server.close();
    }
  });

  it('stops a running make client by the local runtime pid and clears the runtime file', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-stop-running-');
    writeMakeClientMarker(projectRoot, 'stop-running-client', 'Stop Running Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'stop-running-client', 'Stop Running Client');
    const server = await startTestServer(defaultRoot);
    const runtimePid = 987654;
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: NodeJS.Signals | 0) => {
      if (pid === runtimePid && (signal === 0 || signal === 'SIGTERM')) {
        return true;
      }
      const error: NodeJS.ErrnoException = new Error('process not found');
      error.code = 'ESRCH';
      throw error;
    }) as typeof process.kill);

    try {
      writeServerInfo(projectRoot, 'runtime', {
        pid: runtimePid,
        port: 51721,
        host: 'localhost',
        origin: 'http://localhost:51721',
        projectRoot,
        startedAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      });

      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const stopResponse = await fetch(`${server.origin}/api/projects/stop-running-client/dev/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const stopBody = await stopResponse.json();

      expect(stopResponse.status).toBe(200);
      expect(stopBody).toMatchObject({
        success: true,
        projectId: 'stop-running-client',
        stopped: true,
        status: {
          makeClient: true,
          running: false,
          reason: 'not-running',
        },
      });
      expect(killSpy).toHaveBeenCalledWith(runtimePid, 'SIGTERM');
      expect(fs.existsSync(getRuntimeServerInfoPath(projectRoot))).toBe(false);
    } finally {
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
    writeServerInfo(projectRoot, 'runtime', {
      pid: process.pid,
      port: 51721,
      host: 'localhost',
      origin: 'http://localhost:51721',
      projectRoot,
      startedAt: new Date().toISOString(),
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
        clientUrl: 'http://localhost:51721/prototypes/home',
      });
      expect(resourcesBody.resources.themes[0]).toMatchObject({
        clientUrl: 'http://localhost:51721/themes/brand',
        previewUrl: 'http://localhost:51721/themes/brand',
      });
      expect(entriesResponse.status).toBe(200);
      expect(entriesBody.prototypes[0]).toMatchObject({
        clientUrl: 'http://localhost:51721/prototypes/home',
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
      timestamp: new Date(Date.now() - 60_000).toISOString(),
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
      timestamp: new Date(Date.now() - 60_000).toISOString(),
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
        timestamp: new Date().toISOString(),
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
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['install', '--include=dev'],
        expect.objectContaining({ cwd: projectRoot }),
      );
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        process.execPath,
        [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')],
        expect.objectContaining({
          cwd: projectRoot,
          env: expect.objectContaining({
            AXHUB_MAKE_SKIP_AUTO_START_SERVER: '1',
            PATH: expect.any(String),
          }),
        }),
      );
    } finally {
      await server.close();
    }
  });

  it('starts dev directly from the project root when client dependencies are already installed', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-local-command-');
    writeMakeClientMarker(projectRoot, 'local-command-client', 'Local Command Client');
    writeMakeClientPackage(projectRoot);
    writeInstalledMakeClientDependencies(projectRoot);
    writeMakeClientMetadata(projectRoot, 'local-command-client', 'Local Command Client');
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
      expect(runLocalCommandMock).not.toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.anything(),
      );
      expect(runLocalCommandMock).not.toHaveBeenCalledWith(
        'pnpm',
        ['metadata:sync'],
        expect.anything(),
      );
      expect(childProcessMock.execFile).not.toHaveBeenCalled();
      expect(childProcessMock.spawn).not.toHaveBeenCalledWith(
        'pnpm',
        ['dev'],
        expect.anything(),
      );
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        process.execPath,
        [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')],
        expect.objectContaining({
          cwd: projectRoot,
          env: expect.objectContaining({
            AXHUB_MAKE_SKIP_AUTO_START_SERVER: '1',
            PATH: expect.any(String),
          }),
        }),
      );
    } finally {
      await server.close();
    }
  });

  it('falls back to pnpm install when npm install fails', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-pnpm-fallback-');
    writeMakeClientMarker(projectRoot, 'pnpm-fallback-client', 'PNPM Fallback Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'pnpm-fallback-client', 'PNPM Fallback Client');
    runLocalCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if ((command === 'npm' || command === 'npm.cmd') && args[0] === 'install') {
        throw Object.assign(new Error('npm registry unavailable'), {
          stderr: 'npm registry unavailable',
        });
      }
      if (command === 'pnpm' && args[0] === 'install') {
        writeInstalledMakeClientDependencies(projectRoot);
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
        port: 51729,
        host: 'localhost',
        origin: 'http://localhost:51729',
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

      const ensureResponse = await fetch(`${server.origin}/api/projects/pnpm-fallback-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(200);
      expect(ensureBody).toMatchObject({
        success: true,
        projectId: 'pnpm-fallback-client',
        runtime: {
          origin: 'http://localhost:51729',
        },
      });
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['install', '--include=dev'],
        expect.objectContaining({ cwd: projectRoot }),
      );
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        'pnpm',
        ['install', '--prod=false'],
        expect.objectContaining({ cwd: projectRoot }),
      );
      expect(childProcessMock.spawn).not.toHaveBeenCalledWith(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['run', 'dev'],
        expect.anything(),
      );
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        process.execPath,
        [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')],
        expect.objectContaining({
          cwd: projectRoot,
          env: expect.objectContaining({
            AXHUB_MAKE_SKIP_AUTO_START_SERVER: '1',
            PATH: expect.any(String),
          }),
        }),
      );
    } finally {
      await server.close();
    }
  });

  it('does not require pnpm when npm install succeeds', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-no-pnpm-npm-fallback-');
    writeMakeClientMarker(projectRoot, 'no-pnpm-npm-fallback-client', 'No PNPM NPM Fallback Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'no-pnpm-npm-fallback-client', 'No PNPM NPM Fallback Client');
    runLocalCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'pnpm' && args[0] === 'install') {
        throw Object.assign(new Error('spawn pnpm ENOENT'), {
          code: 'ENOENT',
        });
      }
      if ((command === 'npm' || command === 'npm.cmd') && args[0] === 'install') {
        writeInstalledMakeClientDependencies(projectRoot);
      }
      return localCommandResult(command, args);
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51733,
        host: 'localhost',
        origin: 'http://localhost:51733',
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

      const ensureResponse = await fetch(`${server.origin}/api/projects/no-pnpm-npm-fallback-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(200);
      expect(ensureBody).toMatchObject({
        success: true,
        projectId: 'no-pnpm-npm-fallback-client',
        runtime: {
          origin: 'http://localhost:51733',
        },
      });
      expect(runLocalCommandMock).not.toHaveBeenCalledWith('pnpm', expect.any(Array), expect.any(Object));
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['install', '--include=dev'],
        expect.objectContaining({ cwd: projectRoot }),
      );
      expect(childProcessMock.spawn).not.toHaveBeenCalledWith(
        'pnpm',
        ['dev'],
        expect.anything(),
      );
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        process.execPath,
        [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')],
        expect.objectContaining({ cwd: projectRoot }),
      );
    } finally {
      await server.close();
    }
  });

  it('uses a long timeout for make client dependency installation', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-install-timeout-');
    writeMakeClientMarker(projectRoot, 'install-timeout-client', 'Install Timeout Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'install-timeout-client', 'Install Timeout Client');
    runLocalCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if ((command === 'npm' || command === 'npm.cmd') && args[0] === 'install') {
        throw Object.assign(new Error('npm registry unavailable'), {
          stderr: 'npm registry unavailable',
        });
      }
      if (command === 'pnpm' && args[0] === 'install') {
        writeInstalledMakeClientDependencies(projectRoot);
      }
      return localCommandResult(command, args);
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51731,
        host: 'localhost',
        origin: 'http://localhost:51731',
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

      const ensureResponse = await fetch(`${server.origin}/api/projects/install-timeout-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 50, pollIntervalMs: 5 }),
      });
      expect(ensureResponse.status).toBe(200);

      const installTimeouts = runLocalCommandMock.mock.calls
        .filter(([, args]) => args[0] === 'install')
        .map(([, , options]) => Number((options as any)?.timeoutMs));
      expect(installTimeouts).toHaveLength(2);
      expect(installTimeouts).toEqual([600_000, 600_000]);
    } finally {
      await server.close();
    }
  });

  it('starts with local vite when dependencies are installed but pnpm is unavailable', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-installed-no-pnpm-');
    writeMakeClientMarker(projectRoot, 'installed-no-pnpm-client', 'Installed No PNPM Client');
    writeMakeClientPackage(projectRoot);
    writeInstalledMakeClientDependencies(projectRoot);
    writeMakeClientMetadata(projectRoot, 'installed-no-pnpm-client', 'Installed No PNPM Client');
    runLocalCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'pnpm' && args[0] === '--version') {
        throw Object.assign(new Error('pnpm command not found'), {
          code: 'ENOENT',
        });
      }
      return localCommandResult(command, args);
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51730,
        host: 'localhost',
        origin: 'http://localhost:51730',
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

      const ensureResponse = await fetch(`${server.origin}/api/projects/installed-no-pnpm-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(200);
      expect(ensureBody).toMatchObject({
        success: true,
        projectId: 'installed-no-pnpm-client',
        runtime: {
          origin: 'http://localhost:51730',
        },
      });
      expect(runLocalCommandMock).not.toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.anything(),
      );
      expect(runLocalCommandMock).not.toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.anything(),
      );
      expect(childProcessMock.spawn).not.toHaveBeenCalledWith(
        'pnpm',
        ['dev'],
        expect.anything(),
      );
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        process.execPath,
        [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')],
        expect.objectContaining({
          cwd: projectRoot,
          env: expect.objectContaining({
            AXHUB_MAKE_SKIP_AUTO_START_SERVER: '1',
            PATH: expect.any(String),
          }),
        }),
      );
    } finally {
      await server.close();
    }
  });

  it('starts with local vite after pnpm fallback install so pnpm dev is not required at runtime', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-spawn-enoent-');
    writeMakeClientMarker(projectRoot, 'pnpm-install-local-vite-client', 'PNPM Install Local Vite Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'pnpm-install-local-vite-client', 'PNPM Install Local Vite Client');
    runLocalCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if ((command === 'npm' || command === 'npm.cmd') && args[0] === 'install') {
        throw Object.assign(new Error('npm registry unavailable'), {
          stderr: 'npm registry unavailable',
        });
      }
      if (command === 'pnpm' && args[0] === 'install') {
        writeInstalledMakeClientDependencies(projectRoot);
      }
      return localCommandResult(command, args);
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51732,
        host: 'localhost',
        origin: 'http://localhost:51732',
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

      const ensureResponse = await fetch(`${server.origin}/api/projects/pnpm-install-local-vite-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(200);
      expect(ensureBody).toMatchObject({
        success: true,
        projectId: 'pnpm-install-local-vite-client',
        runtime: {
          origin: 'http://localhost:51732',
        },
      });
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['install', '--include=dev'],
        expect.objectContaining({ cwd: projectRoot }),
      );
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        'pnpm',
        ['install', '--prod=false'],
        expect.objectContaining({ cwd: projectRoot }),
      );
      expect(childProcessMock.spawn).not.toHaveBeenCalledWith(
        'pnpm',
        ['dev'],
        expect.anything(),
      );
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        process.execPath,
        [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')],
        expect.objectContaining({ cwd: projectRoot }),
      );
    } finally {
      await server.close();
    }
  });

  it('returns an install error instead of falling back to pnpm dev when Vite is missing after install', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-missing-vite-');
    writeMakeClientMarker(projectRoot, 'missing-vite-client', 'Missing Vite Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, 'missing-vite-client', 'Missing Vite Client');
    runLocalCommandMock.mockImplementation(async (command: string, args: string[]) => localCommandResult(command, args));
    const server = await startTestServer(defaultRoot);

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(registerResponse.status).toBe(201);

      const ensureResponse = await fetch(`${server.origin}/api/projects/missing-vite-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(500);
      expect(ensureBody).toMatchObject({
        code: 'MAKE_CLIENT_INSTALL_FAILED',
        phase: 'install',
      });
      expect(String(ensureBody.error)).toContain('Make client vite dependency is missing after install');
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['install', '--include=dev'],
        expect.objectContaining({ cwd: projectRoot }),
      );
      expect(runLocalCommandMock).not.toHaveBeenCalledWith('pnpm', expect.any(Array), expect.any(Object));
      expect(childProcessMock.spawn).not.toHaveBeenCalledWith(
        'pnpm',
        ['dev'],
        expect.anything(),
      );
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('returns a dev startup error instead of crashing when the dev spawn command is missing', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-spawn-enoent-');
    writeMakeClientMarker(projectRoot, 'spawn-enoent-client', 'Spawn ENOENT Client');
    writeMakeClientPackage(projectRoot);
    writeInstalledMakeClientDependencies(projectRoot);
    writeMakeClientMetadata(projectRoot, 'spawn-enoent-client', 'Spawn ENOENT Client');
    childProcessMock.spawn.mockImplementation(() => {
      const child = {
        once: vi.fn((event: string, callback: (...args: any[]) => void) => {
          if (event === 'error') {
            setTimeout(() => callback(Object.assign(new Error('spawn node ENOENT'), {
              code: 'ENOENT',
              syscall: 'spawn node',
            })), 0);
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

      const ensureResponse = await fetch(`${server.origin}/api/projects/spawn-enoent-client/dev/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeoutMs: 50, pollIntervalMs: 5 }),
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(500);
      expect(ensureBody).toMatchObject({
        code: 'MAKE_CLIENT_DEV_FAILED',
        phase: 'dev',
      });
      expect(String(ensureBody.error)).toContain('spawn node ENOENT');
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        process.execPath,
        [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')],
        expect.objectContaining({ cwd: projectRoot }),
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
    writeInstalledMakeClientDependencies(projectRoot);
    writeMakeClientMetadata(projectRoot, 'fresh-ensure-client', 'Fresh Ensure Client');
    writeServerInfo(projectRoot, 'runtime', {
      pid: process.pid,
      port: 9,
      host: 'localhost',
      origin: 'http://127.0.0.1:9',
      projectRoot,
      startedAt: '2026-05-01T00:00:00.000Z',
      timestamp: '2026-05-01T00:00:00.000Z',
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
          timestamp: new Date().toISOString(),
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

  it('rejects dot-segment make client project ids', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const projectRoot = createTempRoot('axhub-make-client-dot-id-');
    writeMakeClientMarker(projectRoot, '.', 'Dot Client');
    writeMakeClientPackage(projectRoot);
    writeMakeClientMetadata(projectRoot, '.', 'Dot Client');
    const server = await startTestServer(defaultRoot);

    try {
      const response = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toMatchObject({ code: 'NOT_MAKE_CLIENT_PROJECT' });
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
    writeInstalledMakeClientDependencies(projectRoot);
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
      expect(runLocalCommandMock).not.toHaveBeenCalledWith(
        'pnpm',
        ['install'],
        expect.anything(),
      );
      expect(childProcessMock.spawn).not.toHaveBeenCalledWith(
        'pnpm',
        ['dev'],
        expect.anything(),
      );
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        process.execPath,
        [path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')],
        expect.objectContaining({
          cwd: projectRoot,
          env: expect.objectContaining({
            AXHUB_MAKE_SKIP_AUTO_START_SERVER: '1',
            PATH: expect.any(String),
          }),
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
    writeInstalledMakeClientDependencies(projectRoot);
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

  it('creates a blank make client project from the primary remote template and starts dev', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startTestServer(defaultRoot, registryHome);

    installRemoteTemplateCommandMock({
      metadataId: 'sales-demo',
      metadataName: 'Sales Demo',
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeMakeClientMetadata(targetRoot, 'sales-demo', 'Sales Demo');
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
      const targetRoot = path.join(parentRoot, 'Sales Demo');

      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        success: true,
        phase: 'ready',
        project: {
          id: 'Sales Demo',
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
      expect(fs.existsSync(path.join(targetRoot, '.agents', 'skills', 'local', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(targetRoot, '.claude', 'skills', 'local', 'SKILL.md'))).toBe(true);
      expect(fs.existsSync(path.join(targetRoot, 'node_modules', 'left-pad'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, 'node_modules', 'vite'))).toBe(true);
      expect(fs.existsSync(path.join(targetRoot, 'dist'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, 'tests'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, '.trae'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, 'temp'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, '.axhub', 'make', 'axhub.config.json'))).toBe(false);
      expect(JSON.parse(fs.readFileSync(path.join(targetRoot, '.axhub', 'make', 'sidebar-tree.json'), 'utf8'))).toMatchObject({
        themesTree: [
          expect.objectContaining({
            id: 'folder-themes-test',
            title: '行业',
          }),
        ],
      });
      expect(fs.existsSync(path.join(targetRoot, '.axhub', 'make', 'client.json'))).toBe(true);
      expect(fs.existsSync(path.join(targetRoot, '.axhub', 'make', 'README.md'))).toBe(true);
      expect(fs.existsSync(path.join(targetRoot, '.axhub', 'make', 'sessions'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, '.axhub', 'make', 'exports'))).toBe(false);
      expect(fs.existsSync(path.join(targetRoot, '.axhub', 'make', 'edit-history'))).toBe(false);
      expect(JSON.parse(fs.readFileSync(getRuntimeServerInfoPath(targetRoot), 'utf8'))).toMatchObject({
        origin: 'http://localhost:51721',
      });
      expect(JSON.parse(fs.readFileSync(getMakeClientMarkerPath(targetRoot), 'utf8'))).toMatchObject({
        repository: TEMPLATE_SOURCE_URL,
        templateUrl: TEMPLATE_ZIP_URL,
        templateVersion: DEFAULT_TEMPLATE_VERSION,
        project: {
          id: 'Sales Demo',
          name: 'Sales Demo',
        },
      });
      expect(childProcessMock.execFile).not.toHaveBeenCalledWith(
        'git',
        expect.any(Array),
        expect.any(Object),
        expect.any(Function),
      );
      expect(runLocalCommandMock).not.toHaveBeenCalledWith(
        'git',
        expect.any(Array),
        expect.any(Object),
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        TEMPLATE_ZIP_URL,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(globalThis.fetch).not.toHaveBeenCalledWith(
        TEMPLATE_MIRROR_ZIP_URL,
        expect.any(Object),
      );
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['install', '--include=dev'],
        expect.objectContaining({ cwd: targetRoot }),
      );
      expect(runLocalCommandMock).not.toHaveBeenCalledWith(
        'pnpm',
        ['metadata:sync'],
        expect.anything(),
      );
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        process.execPath,
        [path.join(targetRoot, 'node_modules', 'vite', 'bin', 'vite.js')],
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

  it('writes project metadata before returning a successful blank make client creation', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startTestServer(defaultRoot, registryHome);

    installRemoteTemplateCommandMock();
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51729,
        host: 'localhost',
        origin: 'http://localhost:51729',
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
          folderName: 'make07',
          projectName: 'make07',
        }),
      });
      const targetRoot = path.join(parentRoot, 'make07');
      const metadataPath = getProjectMetadataPath(targetRoot);

      expect(response.status).toBe(201);
      expect(fs.existsSync(metadataPath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(metadataPath, 'utf8'))).toMatchObject({
        project: {
          id: 'make07',
          name: 'make07',
        },
      });

      const resourcesResponse = await fetch(`${server.origin}/api/projects/make07/resources`);
      const resourcesBody = await resourcesResponse.json();

      expect(resourcesResponse.status).toBe(200);
      expect(resourcesBody.project).toMatchObject({
        id: 'make07',
        name: 'make07',
      });
    } finally {
      await server.close();
    }
  });

  it('falls back to the Gitee mirror when the primary remote template download fails', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const server = await startTestServer(defaultRoot);

    installRemoteTemplateCommandMock({
      failPrimary: true,
      metadataId: 'mirror-demo',
      metadataName: 'Mirror Demo',
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51724,
        host: 'localhost',
        origin: 'http://localhost:51724',
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
          folderName: 'Mirror Demo',
          projectName: 'Mirror Demo',
        }),
      });
      const body = await response.json();
      const targetRoot = path.join(parentRoot, 'Mirror Demo');

      expect(response.status).toBe(201);
      expect(body.project).toMatchObject({
        id: 'Mirror Demo',
        name: 'Mirror Demo',
        root: targetRoot,
      });
      expect(fs.existsSync(path.join(targetRoot, 'package.json'))).toBe(true);
      expect(JSON.parse(fs.readFileSync(getMakeClientMarkerPath(targetRoot), 'utf8'))).toMatchObject({
        repository: TEMPLATE_MIRROR_SOURCE_URL,
        templateUrl: TEMPLATE_MIRROR_ZIP_URL,
        templateVersion: DEFAULT_TEMPLATE_VERSION,
        project: {
          id: 'Mirror Demo',
          name: 'Mirror Demo',
        },
      });
      expect(runLocalCommandMock).not.toHaveBeenCalledWith('git', expect.any(Array), expect.any(Object));
      expect(globalThis.fetch).toHaveBeenCalledWith(TEMPLATE_ZIP_URL, expect.any(Object));
      expect(globalThis.fetch).toHaveBeenCalledWith(TEMPLATE_MIRROR_ZIP_URL, expect.any(Object));
    } finally {
      await server.close();
    }
  });

  it('uses AXHUB_MAKE_CLIENT_TEMPLATE_URL as the only template source', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const customTemplateUrl = 'https://download.example.test/custom-template.zip';
    vi.stubEnv('AXHUB_MAKE_CLIENT_TEMPLATE_URL', customTemplateUrl);
    const server = await startTestServer(defaultRoot);

    installRemoteTemplateCommandMock({
      customTemplateUrl,
      metadataId: 'custom-template-demo',
      metadataName: 'Custom Template Demo',
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51725,
        host: 'localhost',
        origin: 'http://localhost:51725',
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
          folderName: 'Custom Template Demo',
          projectName: 'Custom Template Demo',
        }),
      });
      const targetRoot = path.join(parentRoot, 'Custom Template Demo');

      expect(response.status).toBe(201);
      expect(JSON.parse(fs.readFileSync(getMakeClientMarkerPath(targetRoot), 'utf8'))).toMatchObject({
        repository: customTemplateUrl,
        templateUrl: customTemplateUrl,
      });
      expect(JSON.parse(fs.readFileSync(getMakeClientMarkerPath(targetRoot), 'utf8')).templateVersion).toBeUndefined();
      expect((globalThis.fetch as any).mock.calls.filter(([url]: [string]) => String(url).includes('template.zip'))).toHaveLength(1);
      expect(globalThis.fetch).toHaveBeenCalledWith(customTemplateUrl, expect.any(Object));
      expect(globalThis.fetch).not.toHaveBeenCalledWith(TEMPLATE_ZIP_URL, expect.any(Object));
      expect(globalThis.fetch).not.toHaveBeenCalledWith(TEMPLATE_MIRROR_ZIP_URL, expect.any(Object));
    } finally {
      await server.close();
    }
  });

  it('reuses a cached template zip for the same URL when no template version is configured', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const customTemplateUrl = 'https://download.example.test/cached-template.zip';
    vi.stubEnv('AXHUB_MAKE_CLIENT_TEMPLATE_URL', customTemplateUrl);
    const server = await startTestServer(defaultRoot);

    installRemoteTemplateCommandMock({
      customTemplateUrl,
      metadataId: 'cached-template-demo',
      metadataName: 'Cached Template Demo',
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
      return {
        once: vi.fn(),
        unref: vi.fn(),
      } as any;
    });

    try {
      const first = await fetch(`${server.origin}/api/projects/make/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentRoot,
          folderName: 'Cached Template One',
          projectName: 'Cached Template One',
        }),
      });
      const second = await fetch(`${server.origin}/api/projects/make/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentRoot,
          folderName: 'Cached Template Two',
          projectName: 'Cached Template Two',
        }),
      });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect((globalThis.fetch as any).mock.calls.filter(([url]: [string]) => url === customTemplateUrl)).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  it('reuses a cached template zip when the template version is unchanged even if the file is older than 24 hours', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const server = await startTestServer(defaultRoot);

    installRemoteTemplateCommandMock({
      metadataId: 'expired-template-demo',
      metadataName: 'Expired Template Demo',
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51727,
        host: 'localhost',
        origin: 'http://localhost:51727',
        projectRoot: targetRoot,
        startedAt: new Date().toISOString(),
      });
      return {
        once: vi.fn(),
        unref: vi.fn(),
      } as any;
    });

    try {
      const first = await fetch(`${server.origin}/api/projects/make/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentRoot,
          folderName: 'Expired Template One',
          projectName: 'Expired Template One',
        }),
      });
      const originalStatSync = fs.statSync;
      const expiredMtime = new Date(Date.now() - (25 * 60 * 60 * 1000));
      vi.spyOn(fs, 'statSync').mockImplementation(((filePath: fs.PathLike, options?: any) => {
        const stats = originalStatSync(filePath, options);
        if (String(filePath).includes('make-client-template-cache')) {
          Object.defineProperty(stats, 'mtimeMs', { value: expiredMtime.getTime() });
        }
        return stats;
      }) as typeof fs.statSync);
      const second = await fetch(`${server.origin}/api/projects/make/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentRoot,
          folderName: 'Expired Template Two',
          projectName: 'Expired Template Two',
        }),
      });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect((globalThis.fetch as any).mock.calls.filter(([url]: [string]) => url === TEMPLATE_ZIP_URL)).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  it('downloads the template zip again when the cached version does not match the configured version', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const server = await startTestServer(defaultRoot);
    const cachePath = templateCachePath(TEMPLATE_ZIP_URL);

    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, createMakeClientTemplateZip());
    writeJson(templateCacheManifestPath(TEMPLATE_ZIP_URL), {
      schemaVersion: 1,
      templateVersion: '0.1.1',
      url: TEMPLATE_ZIP_URL,
      cachedAt: new Date().toISOString(),
    });

    installRemoteTemplateCommandMock({
      metadataId: 'version-mismatch-template-demo',
      metadataName: 'Version Mismatch Template Demo',
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
      return {
        once: vi.fn(),
        unref: vi.fn(),
      } as any;
    });

    try {
      const response = await fetch(`${server.origin}/api/projects/make/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentRoot,
          folderName: 'Version Mismatch Template',
          projectName: 'Version Mismatch Template',
        }),
      });

      expect(response.status).toBe(201);
      expect((globalThis.fetch as any).mock.calls.filter(([url]: [string]) => url === TEMPLATE_ZIP_URL)).toHaveLength(1);
      expect(JSON.parse(fs.readFileSync(templateCacheManifestPath(TEMPLATE_ZIP_URL), 'utf8'))).toMatchObject({
        templateVersion: DEFAULT_TEMPLATE_VERSION,
        url: TEMPLATE_ZIP_URL,
      });
    } finally {
      await server.close();
    }
  });

  it('uses a long timeout for remote template zip downloads', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const server = await startTestServer(defaultRoot);

    installRemoteTemplateCommandMock({
      failPrimary: true,
      metadataId: 'template-timeout-demo',
      metadataName: 'Template Timeout Demo',
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51732,
        host: 'localhost',
        origin: 'http://localhost:51732',
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
          folderName: 'Template Timeout Demo',
          projectName: 'Template Timeout Demo',
        }),
      });

      expect(response.status).toBe(201);
      const signals = (globalThis.fetch as any).mock.calls
        .filter(([url]: [string]) => [TEMPLATE_ZIP_URL, TEMPLATE_MIRROR_ZIP_URL].includes(String(url)))
        .map(([, options]: [string, RequestInit]) => options?.signal);
      expect(signals).toEqual([expect.any(AbortSignal), expect.any(AbortSignal)]);
    } finally {
      await server.close();
    }
  });

  it('ignores request-supplied templateRoot because the template is server-owned', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const missingTemplateRoot = path.join(createTempRoot('axhub-make-missing-template-parent-'), 'missing-template');
    const server = await startTestServer(defaultRoot);

    installRemoteTemplateCommandMock({
      metadataId: 'owned-template',
      metadataName: 'Owned Template',
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
      const targetRoot = path.join(parentRoot, 'Owned Template');

      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        success: true,
        phase: 'ready',
        project: {
          id: 'Owned Template',
          root: targetRoot,
        },
      });
      expect(fs.existsSync(path.join(targetRoot, 'package.json'))).toBe(true);
      expect(JSON.parse(fs.readFileSync(getMakeClientMarkerPath(targetRoot), 'utf8'))).toMatchObject({
        repository: TEMPLATE_SOURCE_URL,
        project: {
          id: 'Owned Template',
          name: 'Owned Template',
        },
      });
    } finally {
      await server.close();
    }
  });

  it('preserves an explicitly blank project name when creating a blank make client project', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startTestServer(defaultRoot, registryHome);

    installRemoteTemplateCommandMock({
      metadataId: 'untitled-client',
      metadataName: '',
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeMakeClientMetadata(targetRoot, 'untitled-client', '');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51724,
        host: 'localhost',
        origin: 'http://localhost:51724',
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
          folderName: 'Untitled Client',
          projectName: '',
        }),
      });
      const body = await response.json();
      const targetRoot = path.join(parentRoot, 'Untitled Client');

      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        success: true,
        project: {
          id: 'Untitled Client',
          name: '',
          root: targetRoot,
        },
        marker: {
          project: {
            id: 'Untitled Client',
            name: '',
          },
        },
      });
    } finally {
      await server.close();
    }
  });

  it('creates a blank make client project in a real Chinese folder without ASCII slugging', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-中文-');
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startTestServer(defaultRoot, registryHome);

    installRemoteTemplateCommandMock({
      metadataId: '中文项目',
      metadataName: '中文项目',
    });
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeMakeClientMetadata(targetRoot, '中文项目', '中文项目');
      writeServerInfo(targetRoot, 'runtime', {
        pid: process.pid,
        port: 51725,
        host: 'localhost',
        origin: 'http://localhost:51725',
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
          folderName: '中文项目',
          projectName: '中文项目',
        }),
      });
      const body = await response.json();
      const targetRoot = path.join(parentRoot, '中文项目');

      expect(response.status).toBe(201);
      expect(body).toMatchObject({
        success: true,
        project: {
          id: '中文项目',
          name: '中文项目',
          root: targetRoot,
        },
        marker: {
          project: {
            id: '中文项目',
            name: '中文项目',
          },
        },
      });
      expect(fs.existsSync(path.join(parentRoot, '中文项目'))).toBe(true);
      expect(fs.existsSync(path.join(parentRoot, 'make-project'))).toBe(false);
      expect(JSON.parse(fs.readFileSync(getMakeClientMarkerPath(targetRoot), 'utf8'))).toMatchObject({
        project: {
          id: '中文项目',
          name: '中文项目',
        },
      });
    } finally {
      await server.close();
    }
  });

  it('reports a clear error when all remote make client template sources fail', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const server = await startTestServer(defaultRoot);
    installRemoteTemplateCommandMock({
      failPrimary: true,
      failMirror: true,
    });

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
        phase: 'template',
      });
      expect(body.details.sources).toEqual([
        expect.objectContaining({ url: TEMPLATE_ZIP_URL }),
        expect.objectContaining({ url: TEMPLATE_MIRROR_ZIP_URL }),
      ]);
      expect(childProcessMock.execFile).not.toHaveBeenCalled();
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('rejects unsafe remote make client template zip entries before writing the target project', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const server = await startTestServer(defaultRoot);
    installRemoteTemplateCommandMock({
      unsafePrimaryZipEntry: '../evil.txt',
      failMirror: true,
    });

    try {
      const response = await fetch(`${server.origin}/api/projects/make/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentRoot,
          folderName: 'Unsafe Template',
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toMatchObject({
        code: 'MAKE_CLIENT_TEMPLATE_UNAVAILABLE',
        phase: 'template',
      });
      expect(body.details.sources[0]).toMatchObject({
        url: TEMPLATE_ZIP_URL,
      });
      expect(String(body.details.sources[0].error)).toContain('unsafe');
      expect(fs.existsSync(path.join(parentRoot, 'Unsafe Template'))).toBe(false);
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('rejects unsafe or existing blank project target folders', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const parentRoot = createTempRoot('axhub-make-parent-');
    const server = await startTestServer(defaultRoot);
    installRemoteTemplateCommandMock();
    childProcessMock.spawn.mockImplementation((_file: string, _args: string[], options: { cwd?: string }) => {
      const targetRoot = String(options.cwd || '');
      writeMakeClientMetadata(targetRoot, path.basename(targetRoot), path.basename(targetRoot));
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
      const unsafe = await fetch(`${server.origin}/api/projects/make/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentRoot, folderName: '../escape' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(unsafe.status).toBe(400);
      expect(unsafe.body).toMatchObject({ code: 'INVALID_MAKE_PROJECT_FOLDER_NAME' });

      const emptyRoot = path.join(parentRoot, 'empty-client');
      fs.mkdirSync(emptyRoot, { recursive: true });

      const empty = await fetch(`${server.origin}/api/projects/make/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentRoot, folderName: 'empty-client' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(empty.status).toBe(409);
      expect(empty.body).toMatchObject({ code: 'MAKE_PROJECT_TARGET_NOT_EMPTY' });
      expect(fs.existsSync(getMakeClientMarkerPath(emptyRoot))).toBe(false);

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

  it('keeps the previous active project when dev ensure fails after background registration', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot, {
      project: { id: 'default-client', name: 'Default Client' },
    });
    const projectRoot = createTempRoot('axhub-make-client-timeout-');
    writeMakeClientMarker(projectRoot, 'timeout-client', 'Timeout Client');
    writeMakeClientPackage(projectRoot);
    writeInstalledMakeClientDependencies(projectRoot);
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
      await registerProject(server.origin, defaultRoot, 'default-client', 'Default Client');
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

  it('registers an extracted make client project without installed dependencies', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot, {
      project: { id: 'default-client', name: 'Default Client' },
    });
    const projectRoot = createTempRoot('axhub-make-client-extracted-');
    writeMakeClientMarker(projectRoot, 'extracted-client', 'Extracted Client');
    writeMakeClientPackage(projectRoot);
    fs.mkdirSync(path.join(projectRoot, 'src', 'prototypes', 'from-zip'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'src', 'prototypes', 'from-zip', 'index.tsx'),
      '/** @name From Zip */\nexport default function FromZip() { return null; }\n',
      'utf8',
    );
    fs.rmSync(path.join(projectRoot, 'node_modules'), { recursive: true, force: true });
    fs.rmSync(getProjectMetadataPath(projectRoot), { force: true });
    const server = await startTestServer(defaultRoot);

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      const registerBody = await registerResponse.json();

      expect(registerResponse.status).toBe(201);
      expect(registerBody.project).toMatchObject({
        id: 'extracted-client',
        name: 'Extracted Client',
        root: projectRoot,
      });
      expect(fs.existsSync(path.join(projectRoot, 'node_modules'))).toBe(false);

      const activeResponse = await fetch(`${server.origin}/api/projects/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'extracted-client' }),
      });
      expect(activeResponse.status).toBe(200);

      const resourcesResponse = await fetch(`${server.origin}/api/projects/extracted-client/resources`);
      const resourcesBody = await resourcesResponse.json();

      expect(resourcesResponse.status).toBe(200);
      expect(resourcesBody.project).toEqual({ id: 'extracted-client', name: 'Extracted Client' });
      expect(resourcesBody.resources.prototypes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'from-zip',
          title: 'From Zip',
          clientUrl: '/prototypes/from-zip',
        }),
      ]));
      expect(fs.existsSync(getProjectMetadataPath(projectRoot))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'node_modules'))).toBe(false);
      expect(runLocalCommandMock).not.toHaveBeenCalledWith(
        expect.stringMatching(/^(?:npm|npm\.cmd|pnpm)$/u),
        expect.arrayContaining([expect.stringMatching(/^install$/u)]),
        expect.any(Object),
      );
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });
});
