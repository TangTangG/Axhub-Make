import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  startTestServer,
  writeJson,
  writeProjectMetadata,
} from './projects-api.helpers';
import {
  buildAcpxSpawnRequest,
  buildAcpxSpawnEnv,
  resolveAcpxSpawnCommand,
} from '../acpxPromptExecutor.ts';
import { resolvePromptExecutionAcpxConfig } from '../managementApi.assistantIde.ts';

const childProcessMock = vi.hoisted(() => ({
  spawn: vi.fn(),
}));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: childProcessMock.spawn,
  };
});

function mockSpawnSuccess(stdout = 'fixed tests\n') {
  childProcessMock.spawn.mockImplementation(() => {
    const handlers = new Map<string, (...args: any[]) => void>();
    const stdoutHandlers = new Map<string, (...args: any[]) => void>();
    const stderrHandlers = new Map<string, (...args: any[]) => void>();
    const child = {
      stdout: {
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          stdoutHandlers.set(event, callback);
          return child.stdout;
        }),
      },
      stderr: {
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          stderrHandlers.set(event, callback);
          return child.stderr;
        }),
      },
      once: vi.fn((event: string, callback: (...args: any[]) => void) => {
        handlers.set(event, callback);
        return child;
      }),
      kill: vi.fn(),
    };
    queueMicrotask(() => {
      stdoutHandlers.get('data')?.(Buffer.from(stdout));
      handlers.get('close')?.(0, null);
    });
    return child;
  });
}

function mockSpawnFailure(stderr = 'agent failed\n', code = 7) {
  childProcessMock.spawn.mockImplementation(() => {
    const handlers = new Map<string, (...args: any[]) => void>();
    const stdoutHandlers = new Map<string, (...args: any[]) => void>();
    const stderrHandlers = new Map<string, (...args: any[]) => void>();
    const child = {
      stdout: {
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          stdoutHandlers.set(event, callback);
          return child.stdout;
        }),
      },
      stderr: {
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
          stderrHandlers.set(event, callback);
          return child.stderr;
        }),
      },
      once: vi.fn((event: string, callback: (...args: any[]) => void) => {
        handlers.set(event, callback);
        return child;
      }),
      kill: vi.fn(),
    };
    queueMicrotask(() => {
      stderrHandlers.get('data')?.(Buffer.from(stderr));
      handlers.get('close')?.(code, null);
    });
    return child;
  });
}

async function postPromptExecute(origin: string, body: Record<string, unknown>) {
  const response = await fetch(`${origin}/api/prompt/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

async function postPrototypeSessionRun(origin: string, body: Record<string, unknown>) {
  const response = await fetch(`${origin}/api/prototype-generation/session-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  childProcessMock.spawn.mockReset();
  cleanupProjectApiTestRoots();
});

describe('make-server prompt execute acpx API', () => {
  it('keeps the runtime JS executor in sync with the TypeScript acpx spawn wrapper', () => {
    const jsSource = fs.readFileSync(path.resolve(__dirname, '../acpxPromptExecutor.js'), 'utf8');

    expect(jsSource).toContain('buildAcpxSpawnRequest');
    expect(jsSource).toContain('npx.cmd');
    expect(jsSource).not.toContain('spawn(ACPX_COMMAND, args');
  });

  it('uses Windows npx.cmd resolution and preserves Windows Path semantics', () => {
    const env = buildAcpxSpawnEnv({
      platform: 'win32',
      execPath: 'C:\\Program Files\\nodejs\\node.exe',
      env: {
        Path: 'C:\\Windows\\System32',
        APPDATA: 'C:\\Users\\make\\AppData\\Roaming',
        PATHEXT: '.EXE;.BAT',
      },
    });

    expect(resolveAcpxSpawnCommand('win32')).toBe('npx.cmd');
    expect(env.Path?.split(path.win32.delimiter)).toEqual(expect.arrayContaining([
      'C:\\Windows\\System32',
      'C:\\Program Files\\nodejs',
      'C:\\Users\\make\\AppData\\Roaming\\npm',
    ]));
    expect(env.PATHEXT?.toUpperCase().split(';')).toEqual(expect.arrayContaining([
      '.EXE',
      '.BAT',
      '.CMD',
    ]));
    expect(env.PATH).toBeUndefined();
  });

  it('wraps Windows npx.cmd through cmd.exe for spawn compatibility', () => {
    const spawnRequest = buildAcpxSpawnRequest(
      ['acpx@latest', '--approve-all', 'codex', 'fix "quoted" tests'],
      'win32',
    );

    expect(spawnRequest.command).toBe(process.env.ComSpec || 'cmd.exe');
    expect(spawnRequest.args).toEqual([
      '/d',
      '/s',
      '/c',
      '"npx.cmd" "acpx@latest" "--approve-all" "codex" "fix \\"quoted\\" tests"',
    ]);
    expect(spawnRequest.options).toMatchObject({
      shell: false,
      windowsHide: true,
    });
  });

  it('caps canvas prototype generation execution timeout and sets a short owner ttl', () => {
    expect(resolvePromptExecutionAcpxConfig('canvas-prototype-generation', {
      mode: 'prompt',
      permission: 'approve-all',
      timeout: 1800,
    })).toEqual({
      permission: 'approve-all',
      timeout: 600,
      ttl: 30,
    });

    expect(resolvePromptExecutionAcpxConfig('fix-tests', {
      mode: 'prompt',
      timeout: 1800,
    })).toEqual({
      mode: 'prompt',
      timeout: 1800,
    });
  });

  it('builds acpx prompt args with a named persistent session', () => {
    const spawnRequest = buildAcpxSpawnRequest(
      ['acpx@latest', '--approve-all', '--ttl', '30', 'codex', '-s', 'axhub-project-home', 'generate prototype'],
      'darwin',
    );

    expect(spawnRequest.command).toBe('npx');
    expect(spawnRequest.args).toEqual([
      'acpx@latest',
      '--approve-all',
      '--ttl',
      '30',
      'codex',
      '-s',
      'axhub-project-home',
      'generate prototype',
    ]);
    expect(spawnRequest.args).not.toContain('exec');
  });

  it('runs Codex through acpx prompt mode in the selected project root', async () => {
    const projectRoot = createTempRoot('axhub-make-prompt-acpx-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'prompt-acpx-client', name: 'Prompt Acpx Client' },
    });
    mockSpawnSuccess('tests fixed\n');
    const server = await startTestServer(projectRoot);

    try {
      const result = await postPromptExecute(server.origin, {
        scene: 'fix-tests',
        client: 'codex',
        prompt: 'fix the tests',
      });

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        success: true,
        scene: 'fix-tests',
        provider: 'codex',
        output: 'tests fixed',
        command: 'npx acpx@latest --approve-all codex "fix the tests"',
        projectId: 'prompt-acpx-client',
        projectRoot,
      });
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        'npx',
        ['acpx@latest', '--approve-all', 'codex', 'fix the tests'],
        expect.objectContaining({
          cwd: projectRoot,
          shell: false,
          windowsHide: process.platform === 'win32',
        }),
      );
    } finally {
      await server.close();
    }
  });

  it('runs canvas prototype generation through a named persistent acpx session', async () => {
    const projectRoot = createTempRoot('axhub-make-prompt-acpx-canvas-exec-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'prompt-acpx-canvas-client', name: 'Prompt Acpx Canvas Client' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      automation: {
        acpx: {
          mode: 'prompt',
          timeout: 1800,
        },
      },
    });
    mockSpawnSuccess('prototype generated\n');
    const server = await startTestServer(projectRoot);

    try {
      const result = await postPromptExecute(server.origin, {
        scene: 'canvas-prototype-generation',
        client: 'codex',
        prompt: 'generate the current prototype page',
        targetPath: 'prototypes/home',
      });

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        success: true,
        scene: 'canvas-prototype-generation',
        provider: 'codex',
        output: 'prototype generated',
        command: 'npx acpx@latest --approve-all --ttl 30 codex -s axhub-prompt-acpx-canvas-client-home "generate the current prototype page"',
        projectId: 'prompt-acpx-canvas-client',
        projectRoot,
      });
      expect(childProcessMock.spawn).toHaveBeenNthCalledWith(
        1,
        'npx',
        ['acpx@latest', 'codex', 'sessions', 'ensure', '--name', 'axhub-prompt-acpx-canvas-client-home'],
        expect.objectContaining({
          cwd: projectRoot,
          shell: false,
          windowsHide: process.platform === 'win32',
        }),
      );
      expect(childProcessMock.spawn).toHaveBeenNthCalledWith(
        2,
        'npx',
        ['acpx@latest', '--approve-all', '--ttl', '30', 'codex', '-s', 'axhub-prompt-acpx-canvas-client-home', 'generate the current prototype page'],
        expect.objectContaining({
          cwd: projectRoot,
          shell: false,
          windowsHide: process.platform === 'win32',
        }),
      );
    } finally {
      await server.close();
    }
  });

  it('runs prototype generation through the session-run API and persists the local generation session', async () => {
    const projectRoot = createTempRoot('axhub-make-prototype-session-run-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'session-run-client', name: 'Session Run Client' },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      automation: {
        acpx: {
          mode: 'exec',
          timeout: 1800,
        },
      },
    });
    mockSpawnSuccess('prototype generated\n');
    const server = await startTestServer(projectRoot);

    try {
      const result = await postPrototypeSessionRun(server.origin, {
        targetPath: 'prototypes/home',
        generatorElementId: 'generator-1',
        taskId: 'prototype-task-client-1',
        prompt: 'generate the current prototype page',
        preferredPromptClient: 'genie:codex',
        settings: { count: 1 },
      });

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        success: true,
        scene: 'canvas-prototype-generation',
        provider: 'codex',
        output: 'prototype generated',
        command: 'npx acpx@latest --approve-all --ttl 30 codex -s axhub-session-run-client-home "generate the current prototype page"',
        sessionId: 'axhub-session-run-client-home',
        acpxSessionName: 'axhub-session-run-client-home',
        targetPath: 'prototypes/home',
        generatorElementId: 'generator-1',
        task: {
          status: 'done',
          stage: 'done',
          acpxSessionName: 'axhub-session-run-client-home',
          recoverable: true,
        },
      });
      expect(childProcessMock.spawn).toHaveBeenNthCalledWith(
        1,
        'npx',
        ['acpx@latest', 'codex', 'sessions', 'ensure', '--name', 'axhub-session-run-client-home'],
        expect.objectContaining({
          cwd: projectRoot,
          shell: false,
          windowsHide: process.platform === 'win32',
        }),
      );
      expect(childProcessMock.spawn).toHaveBeenNthCalledWith(
        2,
        'npx',
        ['acpx@latest', '--approve-all', '--ttl', '30', 'codex', '-s', 'axhub-session-run-client-home', 'generate the current prototype page'],
        expect.objectContaining({
          cwd: projectRoot,
          shell: false,
          windowsHide: process.platform === 'win32',
        }),
      );

      const historyPath = path.join(projectRoot, 'src/prototypes/home/.spec/ai-image-history.json');
      const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      expect(history.prototypeTasks[0]).toMatchObject({
        id: 'prototype-task-client-1',
        runId: 'prototype-task-client-1',
        status: 'done',
        acpxSessionName: 'axhub-session-run-client-home',
        recoverable: true,
      });
      expect(result.body.runId).toBe('prototype-task-client-1');
      expect(history.prototypeTasks).toHaveLength(1);
      expect(history.prototypeSessions[0]).toMatchObject({
        prototypeId: 'home',
        generatorElementId: 'generator-1',
        acpxSessionName: 'axhub-session-run-client-home',
        lastRun: {
          runId: 'prototype-task-client-1',
          status: 'done',
        },
      });
    } finally {
      await server.close();
    }
  });

  it('persists prototype generation reference images and appends their paths to the acpx prompt', async () => {
    const projectRoot = createTempRoot('axhub-make-prototype-session-run-refs-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'session-run-refs-client', name: 'Session Run Refs Client' },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      },
    });
    mockSpawnSuccess('prototype generated\n');
    const server = await startTestServer(projectRoot);

    try {
      const result = await postPrototypeSessionRun(server.origin, {
        targetPath: 'prototypes/home',
        generatorElementId: 'generator-1',
        taskId: 'prototype-task-client-refs',
        prompt: 'generate from reference',
        preferredPromptClient: 'genie:codex',
        referenceImages: ['data:image/png;base64,cmVmZXJlbmNlLW9uZQ=='],
      });

      expect(result.status).toBe(200);
      const promptArg = childProcessMock.spawn.mock.calls[1][1].at(-1);
      expect(promptArg).toContain('参考图上下文');
      expect(promptArg).toContain('src/prototypes/home/.spec/generation-assets/refs/');
      expect(promptArg).not.toContain('data:image/png;base64,cmVmZXJlbmNlLW9uZQ==');

      const historyPath = path.join(projectRoot, 'src/prototypes/home/.spec/ai-image-history.json');
      const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      expect(history.prototypeTasks[0].referenceAssetRefs).toHaveLength(1);
      expect(history.prototypeTasks[0].referenceAssetRefs[0].assetPath).toMatch(/^generation-assets\/refs\/.+\.png$/u);
      expect(fs.existsSync(path.join(projectRoot, 'src/prototypes/home/.spec', history.prototypeTasks[0].referenceAssetRefs[0].assetPath))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('runs prototype generation when the prototype id contains non-ascii characters', async () => {
    const projectRoot = createTempRoot('axhub-make-prototype-session-run-unicode-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'make-project', name: 'Make Project' },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      },
    });
    mockSpawnSuccess('prototype generated\n');
    const server = await startTestServer(projectRoot);

    try {
      const result = await postPrototypeSessionRun(server.origin, {
        targetPath: 'prototypes/未命名',
        generatorElementId: 'generator-1',
        taskId: 'prototype-task-client-1',
        prompt: 'generate the current prototype page',
        preferredPromptClient: 'genie:codex',
      });

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        success: true,
        targetPath: 'prototypes/未命名',
        sessionId: expect.stringMatching(/^axhub-make-project-prototype-[a-f0-9]{10}$/u),
        acpxSessionName: expect.stringMatching(/^axhub-make-project-prototype-[a-f0-9]{10}$/u),
      });
      expect(childProcessMock.spawn.mock.calls[0][1]).toEqual([
        'acpx@latest',
        'codex',
        'sessions',
        'ensure',
        '--name',
        result.body.acpxSessionName,
      ]);
      expect(childProcessMock.spawn.mock.calls[1][1]).toEqual([
        'acpx@latest',
        '--approve-all',
        '--ttl',
        '30',
        'codex',
        '-s',
        result.body.acpxSessionName,
        'generate the current prototype page',
      ]);
    } finally {
      await server.close();
    }
  });

  it('rejects prototype session-run requests outside prototypes/<id>', async () => {
    const projectRoot = createTempRoot('axhub-make-prototype-session-run-invalid-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'session-run-invalid-client', name: 'Session Run Invalid Client' },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const result = await postPrototypeSessionRun(server.origin, {
        targetPath: 'components/home',
        generatorElementId: 'generator-1',
        prompt: 'generate the current prototype page',
        preferredPromptClient: 'genie:codex',
      });

      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({
        code: 'PROTOTYPE_GENERATION_TARGET_INVALID',
      });
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('expands PATH for GUI-launched servers so npx can be resolved', async () => {
    const projectRoot = createTempRoot('axhub-make-prompt-acpx-path-');
    writeProjectMetadata(projectRoot);
    mockSpawnSuccess('ok\n');
    const server = await startTestServer(projectRoot);

    try {
      const result = await postPromptExecute(server.origin, {
        scene: 'fix-tests',
        client: 'codex',
        prompt: 'fix the tests',
      });

      expect(result.status).toBe(200);
      const spawnOptions = childProcessMock.spawn.mock.calls[0][2] as { env?: NodeJS.ProcessEnv };
      const pathValue = spawnOptions.env?.PATH || spawnOptions.env?.Path || '';
      const pathSegments = pathValue.split(path.delimiter);
      expect(pathSegments).toContain(path.dirname(process.execPath));
      expect(pathSegments).toContain('/usr/local/bin');
      expect(pathSegments).toContain('/opt/homebrew/bin');
    } finally {
      await server.close();
    }
  });

  it('uses configurable exec mode and maps Gemini through acpx', async () => {
    const projectRoot = createTempRoot('axhub-make-prompt-acpx-exec-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'prompt-acpx-exec-client', name: 'Prompt Acpx Exec Client' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      automation: {
        acpx: {
          mode: 'exec',
        },
      },
    });
    mockSpawnSuccess('done\n');
    const server = await startTestServer(projectRoot);

    try {
      const result = await postPromptExecute(server.origin, {
        scene: 'generate-ui',
        client: 'genie:gemini',
        prompt: 'build the page',
      });

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        success: true,
        scene: 'generate-ui',
        provider: 'gemini',
        command: 'npx acpx@latest --approve-all gemini exec "build the page"',
      });
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        'npx',
        ['acpx@latest', '--approve-all', 'gemini', 'exec', 'build the page'],
        expect.objectContaining({ cwd: projectRoot }),
      );
    } finally {
      await server.close();
    }
  });

  it('returns a clear 400 for unsupported prompt clients', async () => {
    const projectRoot = createTempRoot('axhub-make-prompt-acpx-invalid-');
    writeProjectMetadata(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const result = await postPromptExecute(server.origin, {
        scene: 'bad-client',
        client: 'manual',
        prompt: 'fix the tests',
      });

      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({
        code: 'PROMPT_EXECUTION_CLIENT_UNSUPPORTED',
      });
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('returns stderr when acpx exits nonzero', async () => {
    const projectRoot = createTempRoot('axhub-make-prompt-acpx-fail-');
    writeProjectMetadata(projectRoot);
    mockSpawnFailure('agent failed hard\n', 9);
    const server = await startTestServer(projectRoot);

    try {
      const result = await postPromptExecute(server.origin, {
        scene: 'fail',
        client: 'codex',
        prompt: 'fix the tests',
      });

      expect(result.status).toBe(500);
      expect(result.body).toMatchObject({
        code: 'PROMPT_EXECUTION_FAILED',
        error: 'agent failed hard',
        exitCode: 9,
        provider: 'codex',
      });
    } finally {
      await server.close();
    }
  });
});
