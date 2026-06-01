import fs from 'node:fs';
import { createServer, type Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getConfigPath,
  getMakeClientMarkerPath,
  getProjectMetadataPath,
  getProjectRegistryPath,
} from '../projectCore/index.ts';

const childProcessMock = vi.hoisted(() => ({
  execFile: vi.fn((_file: string, _args: string[], optionsOrCallback?: unknown, maybeCallback?: unknown) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    if (typeof callback === 'function') {
      callback(null, '', '');
    }
  }),
  spawn: vi.fn(() => {
    const child = {
      stderr: {
        on: vi.fn(),
        unref: vi.fn(),
      },
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
  spawnSync: vi.fn(),
}));

vi.mock('node:child_process', () => childProcessMock);

vi.mock('../localCommand.ts', async (importActual) => {
  const actual = await importActual<typeof import('../localCommand.ts')>();
  return {
    ...actual,
    commandExists: vi.fn(async () => true),
    runLocalCommand: vi.fn(async (command: string, args: string[]) => ({
      stdout: '',
      stderr: '',
      command,
      escapedCommand: [command, ...args].join(' '),
    })),
  };
});

const { commandExists, runLocalCommand } = await import('../localCommand.ts');
const { startMakeServer } = await import('../index');
const { handleAssistantPromptIde } = await import('../managementApi.assistantIde.ts');

const commandExistsMock = vi.mocked(commandExists);
const runLocalCommandMock = vi.mocked(runLocalCommand);

const tempRoots: string[] = [];
const healthServers: Server[] = [];

function createTempRoot(prefix = 'axhub-make-assistant-runtime-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeProjectConfig(projectRoot: string, value: unknown): void {
  writeJson(getConfigPath(projectRoot), value);
}

async function startAssistantHealthServer() {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, {
        'content-type': 'application/json',
        'x-app-identifier': '@axhub/genie',
      });
      res.end(JSON.stringify({
        status: 'ok',
        service: { id: '@axhub/genie', name: 'Axhub Genie' },
      }));
      return;
    }
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>Axhub Genie</title>');
      return;
    }
    res.writeHead(404).end();
  });
  healthServers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start assistant health test server');
  }
  return { origin: `http://127.0.0.1:${address.port}` };
}

async function startRejectedHealthServer() {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: { id: 'not-axhub-genie', name: 'Other Service' },
      }));
      return;
    }
    res.writeHead(404).end();
  });
  healthServers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start rejected assistant health test server');
  }
  return { origin: `http://127.0.0.1:${address.port}` };
}

async function startRedirectingAssistantServer(redirectLocation: string) {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, {
        'content-type': 'application/json',
        'x-app-identifier': '@axhub/genie',
      });
      res.end(JSON.stringify({
        status: 'ok',
        service: { id: '@axhub/genie', name: 'Axhub Genie' },
      }));
      return;
    }
    if (req.url === '/') {
      res.writeHead(302, { location: redirectLocation });
      res.end();
      return;
    }
    res.writeHead(404).end();
  });
  healthServers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start redirecting assistant test server');
  }
  return { origin: `http://127.0.0.1:${address.port}` };
}

function writeProjectMetadata(projectRoot: string, id = 'assistant-client') {
  writeMakeClientMarker(projectRoot, id);
  writeMakeClientPackage(projectRoot);
  writeJson(getProjectMetadataPath(projectRoot), {
    schemaVersion: 1,
    project: { id, name: 'Assistant Client' },
    resources: {
      prototypes: [],
      docs: [],
      themes: [],
      data: [],
      templates: [],
    },
    navigation: { prototypes: [], docs: [] },
    orders: { themes: [], data: [], templates: [] },
    capabilities: { quickEdit: true, figmaExport: false, axureExport: false, multiDevicePreview: true },
  });
}

function writeMakeClientMarker(projectRoot: string, id: string, name = 'Assistant Client') {
  writeJson(getMakeClientMarkerPath(projectRoot), {
    schemaVersion: 1,
    kind: 'axhub-make-client',
    repository: 'https://github.com/lintendo/Axhub-Make/tree/main/client',
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

async function startTestServer(projectRoot: string) {
  const registryHome = createTempRoot('axhub-make-assistant-runtime-registry-');
  return startMakeServer({
    projectRoot,
    host: 'localhost',
    port: 0,
    adminRoot: path.join(projectRoot, 'missing-admin'),
    registryPath: getProjectRegistryPath(registryHome),
  });
}

function createLocalCommandResult(command: string, args: string[], stdout = '', stderr = '') {
  return {
    stdout,
    stderr,
    command,
    escapedCommand: [command, ...args].join(' '),
  };
}

function mockAssistantStatus(payload: unknown) {
  return createLocalCommandResult(
    'npx',
    ['@axhub/genie@latest', 'status', '--json'],
    typeof payload === 'string' ? payload : JSON.stringify(payload),
  );
}

beforeEach(() => {
  commandExistsMock.mockReset();
  commandExistsMock.mockResolvedValue(true);
  runLocalCommandMock.mockReset();
  runLocalCommandMock.mockImplementation(async (command: string, args: string[]) => (
    createLocalCommandResult(command, args)
  ));
});

afterEach(() => {
  vi.clearAllMocks();
  for (const server of healthServers.splice(0)) {
    server.close();
  }
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('make-server assistant runtime API', () => {
  it('exposes Assistant and IDE routes from their domain module', () => {
    expect(handleAssistantPromptIde).toBeTypeOf('function');
  });

  it('probes Axhub Genie health without auto-start when requested', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot);
    const assistant = await startAssistantHealthServer();
    writeProjectConfig(projectRoot, {
      assistant: {
        webBaseUrl: assistant.origin,
        apiBaseUrl: `${assistant.origin}/api`,
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/assistant/runtime?autoStart=false`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        webBaseUrl: assistant.origin,
        apiBaseUrl: `${assistant.origin}/api`,
        projectPath: projectRoot,
        source: 'config',
        health: {
          status: 'ready',
          commandSource: 'config',
        },
        runtime: {
          available: true,
        },
      });
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
      expect(childProcessMock.spawnSync).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('does not report ready when Genie health passes but the web UI redirects to an unreachable URL', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot);
    const assistant = await startRedirectingAssistantServer('http://127.0.0.1:1/');
    writeProjectConfig(projectRoot, {
      assistant: {
        webBaseUrl: assistant.origin,
        apiBaseUrl: `${assistant.origin}/api`,
      },
    });
    runLocalCommandMock.mockResolvedValueOnce(mockAssistantStatus({
      running: true,
      endpoint: {
        frontendUrl: assistant.origin,
        apiBaseUrl: `${assistant.origin}/api`,
      },
    }));
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/assistant/runtime?autoStart=false`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        webBaseUrl: assistant.origin,
        source: 'axhub-genie',
        health: {
          status: 'runtime_unreachable',
          commandSource: 'axhub-genie',
        },
        runtime: {
          available: false,
          code: 'assistant-runtime-unavailable',
        },
      });
      expect(body.health.message).toContain('Web UI 探测失败');
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
      expect(childProcessMock.spawnSync).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('resolves assistant runtime from the explicitly selected project id', async () => {
    const activeProjectRoot = createTempRoot('axhub-make-assistant-runtime-active-');
    const selectedProjectRoot = createTempRoot('axhub-make-assistant-runtime-selected-');
    writeProjectMetadata(activeProjectRoot, 'active-assistant-client');
    writeProjectMetadata(selectedProjectRoot, 'selected-assistant-client');
    writeMakeClientMarker(selectedProjectRoot, 'selected-assistant-client', 'Selected Assistant Client');
    writeMakeClientPackage(selectedProjectRoot);
    const assistant = await startAssistantHealthServer();
    writeProjectConfig(activeProjectRoot, {
      assistant: {
        webBaseUrl: 'http://127.0.0.1:1',
        apiBaseUrl: 'http://127.0.0.1:1/api',
      },
    });
    writeProjectConfig(selectedProjectRoot, {
      assistant: {
        webBaseUrl: assistant.origin,
        apiBaseUrl: `${assistant.origin}/api`,
      },
    });
    const registryHome = createTempRoot('axhub-make-assistant-runtime-registry-');
    const server = await startMakeServer({
      projectRoot: activeProjectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(activeProjectRoot, 'missing-admin'),
      registryPath: getProjectRegistryPath(registryHome),
    });

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          root: selectedProjectRoot,
        }),
      });
      expect(registerResponse.status).toBe(201);

      const response = await fetch(`${server.origin}/api/assistant/runtime?autoStart=false&projectId=selected-assistant-client`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        projectId: 'selected-assistant-client',
        projectPath: selectedProjectRoot,
        projectRoot: selectedProjectRoot,
        webBaseUrl: assistant.origin,
        apiBaseUrl: `${assistant.origin}/api`,
        source: 'config',
        runtime: {
          available: true,
        },
      });
      expect(body.projectPath).not.toBe(activeProjectRoot);
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('auto-starts Axhub Genie through the shared local command runner and resolves status endpoints', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot);
    const fallbackHealth = await startRejectedHealthServer();
    const assistant = await startAssistantHealthServer();
    writeProjectConfig(projectRoot, {
      assistant: {
        webBaseUrl: fallbackHealth.origin,
        apiBaseUrl: `${fallbackHealth.origin}/api`,
      },
    });
    runLocalCommandMock
      .mockResolvedValueOnce(mockAssistantStatus({
        running: false,
        endpoint: {
          frontendUrl: assistant.origin,
          apiBaseUrl: `${assistant.origin}/api`,
        },
      }))
      .mockResolvedValueOnce(mockAssistantStatus({
        running: true,
        endpoint: {
          frontendUrl: assistant.origin,
          apiBaseUrl: `${assistant.origin}/api`,
        },
      }));
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/assistant/runtime`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        webBaseUrl: assistant.origin,
        apiBaseUrl: `${assistant.origin}/api`,
        projectPath: projectRoot,
        source: 'axhub-genie',
        health: {
          status: 'ready',
          commandSource: 'axhub-genie',
        },
        runtime: {
          available: true,
        },
      });
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        'npx',
        ['@axhub/genie@latest'],
        expect.objectContaining({
          cwd: projectRoot,
          detached: true,
          env: expect.objectContaining({ PATH: expect.any(String) }),
        }),
      );
      expect(commandExistsMock).toHaveBeenCalledWith(
        'npx',
        expect.objectContaining({ timeoutMs: expect.any(Number) }),
      );
      expect(runLocalCommandMock).toHaveBeenCalledWith(
        'npx',
        ['@axhub/genie@latest', 'status', '--json'],
        expect.objectContaining({ timeoutMs: expect.any(Number) }),
      );
      expect(childProcessMock.spawnSync).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('rewrites localhost assistant endpoints for LAN forwarded hosts', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot);
    const fallbackHealth = await startRejectedHealthServer();
    const assistant = await startAssistantHealthServer();
    writeProjectConfig(projectRoot, {
      assistant: {
        webBaseUrl: fallbackHealth.origin,
        apiBaseUrl: `${fallbackHealth.origin}/api`,
      },
    });
    runLocalCommandMock.mockResolvedValueOnce(mockAssistantStatus({
      running: true,
      endpoint: {
        frontendUrl: assistant.origin.replace('127.0.0.1', 'localhost'),
        apiBaseUrl: `${assistant.origin}/api`,
      },
    }));
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/assistant/runtime?autoStart=false`, {
        headers: { 'x-forwarded-host': '192.168.31.9:5174' },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      const assistantPort = new URL(assistant.origin).port;
      expect(body).toMatchObject({
        webBaseUrl: `http://192.168.31.9:${assistantPort}`,
        apiBaseUrl: `http://192.168.31.9:${assistantPort}/api`,
        projectId: 'assistant-client',
        projectPath: projectRoot,
        source: 'axhub-genie',
        runtime: {
          available: true,
        },
      });
      expect(childProcessMock.spawnSync).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('starts assistant bootstrap explicitly and returns runtime identity', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot);
    const fallbackHealth = await startRejectedHealthServer();
    const assistant = await startAssistantHealthServer();
    writeProjectConfig(projectRoot, {
      assistant: {
        webBaseUrl: fallbackHealth.origin,
        apiBaseUrl: `${fallbackHealth.origin}/api`,
      },
    });
    runLocalCommandMock.mockResolvedValueOnce(mockAssistantStatus({
      running: true,
      endpoint: {
        frontendUrl: assistant.origin,
        apiBaseUrl: `${assistant.origin}/api`,
      },
    }));
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/assistant/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'start_existing' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        mode: 'start_existing',
        message: 'Axhub Genie 启动命令已触发',
        runtime: {
          webBaseUrl: assistant.origin,
          apiBaseUrl: `${assistant.origin}/api`,
          projectPath: projectRoot,
          health: {
            status: 'ready',
          },
        },
      });
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        'npx',
        ['@axhub/genie@latest'],
        expect.objectContaining({
          cwd: projectRoot,
          detached: true,
          env: expect.objectContaining({ PATH: expect.any(String) }),
        }),
      );
      expect(childProcessMock.spawnSync).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('rejects unsupported assistant bootstrap modes before spawning', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/assistant/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'bad-mode' }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        code: 'ASSISTANT_BOOTSTRAP_MODE_INVALID',
        projectId: 'assistant-client',
      });
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('validates prompt execute requests before running acpx', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/prompt/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        code: 'PROMPT_EXECUTION_CLIENT_UNSUPPORTED',
        projectId: 'assistant-client',
      });
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });
});
