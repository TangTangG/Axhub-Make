import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

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
  spawn: vi.fn((_command?: string, _args?: string[]) => {
    const child = {
      once: vi.fn((event: string, callback: () => void) => {
        if (event === 'spawn') {
          setTimeout(callback, 0);
        }
        return child;
      }),
      unref: vi.fn(),
    };
    return child;
  }),
  spawnSync: vi.fn(() => ({ status: 1, stdout: '', stderr: '' })),
}));

vi.mock('node:child_process', () => childProcessMock);

const { startMakeServer } = await import('../index');
const { normalizeMainIDE, openIDEPath } = await import('../ideOpen.ts');

const tempRoots: string[] = [];
const originalProcessPlatform = process.platform;

function createTempRoot(prefix = 'axhub-make-ide-open-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeProjectMetadata(projectRoot: string) {
  writeJson(getMakeClientMarkerPath(projectRoot), {
    schemaVersion: 1,
    kind: 'axhub-make-client',
    repository: 'https://github.com/lintendo/Axhub-Make/tree/main/client',
    project: { id: 'ide-client', name: 'IDE Client' },
  });
  writeJson(path.join(projectRoot, 'package.json'), {
    scripts: {
      dev: 'vite',
      'metadata:sync': 'node scripts/sync-project-metadata.mjs',
    },
  });
  writeJson(getProjectMetadataPath(projectRoot), {
    schemaVersion: 1,
    project: { id: 'ide-client', name: 'IDE Client' },
    resources: {
      prototypes: [
        {
          id: 'home',
          name: 'home',
          title: 'Home',
          clientUrl: 'http://localhost:3000/home',
        },
      ],
      docs: [],
      themes: [],
      data: [],
      templates: [],
    },
    navigation: { prototypes: ['home'], docs: [] },
    orders: { themes: [], data: [], templates: [] },
    capabilities: { quickEdit: true, figmaExport: false, axureExport: false, multiDevicePreview: true },
  });
}

function createMockChild(closeCode = 0) {
  const child = {
    stderr: {
      on: vi.fn(),
    },
    once: vi.fn((event: string, callback: (value?: unknown) => void) => {
      if (event === 'spawn') {
        setTimeout(() => callback(), 0);
      }
      if (event === 'close') {
        setTimeout(() => callback(closeCode), 0);
      }
      return child;
    }),
    unref: vi.fn(),
  };
  return child;
}

function createSpawnOnlyMockChild() {
  const child = {
    once: vi.fn((event: string, callback: () => void) => {
      if (event === 'spawn') {
        setTimeout(callback, 0);
      }
      return child;
    }),
    unref: vi.fn(),
  };
  return child;
}

async function startTestServer(projectRoot: string) {
  const registryHome = createTempRoot('axhub-make-ide-open-registry-');
  return startMakeServer({
    projectRoot,
    host: 'localhost',
    port: 0,
    adminRoot: path.join(projectRoot, 'missing-admin'),
    registryPath: getProjectRegistryPath(registryHome),
  });
}

afterEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(process, 'platform', { value: originalProcessPlatform, configurable: true });
  childProcessMock.spawn.mockImplementation((_command?: string, _args?: string[]) => createSpawnOnlyMockChild());
  childProcessMock.spawnSync.mockImplementation(() => ({ status: 1, stdout: '', stderr: '' }));
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('make-server IDE open API', () => {
  it('normalizes supported IDE ids and rejects unknown values', () => {
    expect(normalizeMainIDE(' Cursor ')).toBe('cursor');
    expect(normalizeMainIDE('TRAE_CN')).toBe('trae_cn');
    expect(normalizeMainIDE('definitely-not-supported')).toBeNull();
    expect(normalizeMainIDE(null)).toBeNull();
  });

  it('opens Unix IDEs with the platform open command and reports stderr on failure', async () => {
    await expect(openIDEPath({
      ide: 'vscode',
      targetPath: '/Users/demo/Axhub Runtime',
    })).resolves.toMatchObject({
      success: true,
      ide: 'vscode',
      targetPath: '/Users/demo/Axhub Runtime',
      command: 'open -a "Visual Studio Code" "/Users/demo/Axhub Runtime"',
    });
    expect(childProcessMock.spawn).toHaveBeenCalledWith(
      'open',
      ['-a', 'Visual Studio Code', '/Users/demo/Axhub Runtime'],
      expect.objectContaining({
        detached: true,
        shell: false,
      }),
    );

    childProcessMock.spawn.mockImplementationOnce(() => {
      const child = {
        once: vi.fn((event: string, callback: (error?: Error) => void) => {
          if (event === 'error') {
            callback(new Error('application not found'));
          }
          return child;
        }),
        unref: vi.fn(),
      };
      return child;
    });

    await expect(openIDEPath({
      ide: 'cursor',
      targetPath: '/Users/demo/Missing',
    })).rejects.toThrow('打开 Cursor 失败: application not found');
  });

  it('opens Windows IDEs through executable discovery and app-path fallback', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    const realExistsSync = fs.existsSync;
    const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockImplementation((target) => {
      if (String(target) === 'C:\\Tools\\cursor.exe') {
        return true;
      }
      return realExistsSync(target);
    });

    try {
      childProcessMock.spawnSync.mockImplementation((...input: unknown[]) => {
        const command = String(input[0] || '');
        const args = Array.isArray(input[1]) ? input[1] : [];
        if (command === 'where' && args[0] === 'cursor') {
          return { status: 0, stdout: 'C:\\Tools\\cursor.cmd\r\n', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: '' };
      });

      await expect(openIDEPath({
        ide: 'cursor',
        targetPath: 'C:\\Projects\\Axhub Runtime',
      })).resolves.toMatchObject({
        success: true,
        ide: 'cursor',
        targetPath: 'C:\\Projects\\Axhub Runtime',
        command: '"C:\\\\Tools\\\\cursor.exe" "C:\\\\Projects\\\\Axhub Runtime"',
      });
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        'C:\\Tools\\cursor.exe',
        ['C:\\Projects\\Axhub Runtime'],
        expect.objectContaining({
          detached: true,
          windowsHide: true,
          shell: false,
        }),
      );

      childProcessMock.spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: '' });
      childProcessMock.spawn
        .mockImplementationOnce(() => createMockChild(1))
        .mockImplementationOnce(() => createMockChild(0));

      await expect(openIDEPath({
        ide: 'trae',
        targetPath: 'C:\\Projects\\Fallback',
      })).resolves.toMatchObject({
        success: true,
        ide: 'trae',
        targetPath: 'C:\\Projects\\Fallback',
      });
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        'powershell',
        expect.arrayContaining([
          '-NoProfile',
          '-NonInteractive',
          '-WindowStyle',
          'Hidden',
          '-Command',
          'Start-Process -FilePath $args[0] -ArgumentList $args[1] -ErrorAction Stop',
          'TRAE',
          'C:\\Projects\\Fallback',
        ]),
        expect.objectContaining({
          detached: false,
          shell: false,
          windowsHide: true,
        }),
      );
      expect(childProcessMock.spawn).not.toHaveBeenCalledWith(
        'powershell',
        expect.arrayContaining(['trae://file/C:/Projects/Fallback']),
        expect.anything(),
      );
    } finally {
      existsSyncSpy.mockRestore();
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    }
  });

  it.each([
    ['cursor', 'cursor://file/C:/Projects/Axhub%20Runtime/src/App%20%231.tsx'],
    ['vscode', 'vscode://file/C:/Projects/Axhub%20Runtime/src/App%20%231.tsx'],
    ['trae', 'trae://file/C:/Projects/Axhub%20Runtime/src/App%20%231.tsx'],
    ['trae_cn', 'trae-cn://file/C:/Projects/Axhub%20Runtime/src/App%20%231.tsx'],
    ['windsurf', 'windsurf://file/C:/Projects/Axhub%20Runtime/src/App%20%231.tsx'],
    ['kiro', 'kiro://file/C:/Projects/Axhub%20Runtime/src/App%20%231.tsx'],
    ['qoder', 'qoder://file/C:/Projects/Axhub%20Runtime/src/App%20%231.tsx'],
    ['antigravity', 'antigravity://file/C:/Projects/Axhub%20Runtime/src/App%20%231.tsx'],
  ] as const)('falls back to the %s Windows file protocol when executable launches fail', async (ide, expectedUrl) => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    childProcessMock.spawnSync.mockReturnValue({ status: 1, stdout: '', stderr: '' });
    childProcessMock.spawn.mockImplementation((_command: string, args?: string[]) => {
      const filePathArg = args?.at(-1) || '';
      return createMockChild(filePathArg === expectedUrl ? 0 : 1);
    });

    try {
      await expect(openIDEPath({
        ide,
        targetPath: 'C:\\Projects\\Axhub Runtime\\src\\App #1.tsx',
      })).resolves.toMatchObject({
        success: true,
        ide,
        targetPath: 'C:\\Projects\\Axhub Runtime\\src\\App #1.tsx',
        command: `powershell -NoProfile -Command Start-Process -FilePath '${expectedUrl}' -ErrorAction Stop`,
      });

      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        'powershell',
        expect.arrayContaining([
          'Start-Process -FilePath $args[0] -ErrorAction Stop',
          expectedUrl,
        ]),
        expect.objectContaining({
          shell: false,
          windowsHide: true,
        }),
      );
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    }
  });

  it('opens a project-relative target in the configured IDE', async () => {
    const projectRoot = createTempRoot();
    const sourcePath = path.join(projectRoot, 'src/prototypes/home/index.tsx');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, 'export default function Home() { return null; }\n', 'utf8');
    writeProjectMetadata(projectRoot);
    writeJson(getConfigPath(projectRoot), {
      automation: {
        defaultIDE: 'cursor',
      },
    });
    childProcessMock.spawnSync.mockImplementation((...input: unknown[]) => {
      const command = String(input[0] || '');
      const args = Array.isArray(input[1]) ? input[1] : [];
      if (command === 'mdfind' && String(args?.[0] || '').includes('Cursor')) {
        return { status: 0, stdout: '/Applications/Cursor.app\n', stderr: '' };
      }
      return { status: 1, stdout: '', stderr: '' };
    });

    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/ide/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath: 'src/prototypes/home/index.tsx' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        success: true,
        ide: 'cursor',
        targetPath: sourcePath,
      });
      expect(childProcessMock.spawn).toHaveBeenCalledWith(
        'open',
        ['-a', 'Cursor', sourcePath],
        expect.objectContaining({
          detached: true,
          shell: false,
        }),
      );
    } finally {
      await server.close();
    }
  });

  it('returns IDE availability in config so unavailable editors can be hidden', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot);

    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/config`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ideAvailability).toHaveProperty('cursor');
      expect(body.ideAvailability.cursor).toHaveProperty('status');
      expect(body.ideAvailability.cursor).toHaveProperty('checkedAt');
    } finally {
      await server.close();
    }
  });

  it('rejects a confirmed missing IDE before attempting to open it', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot);
    writeJson(getConfigPath(projectRoot), {
      automation: {
        defaultIDE: 'cursor',
      },
    });
    const realExistsSync = fs.existsSync;
    const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockImplementation((target) => {
      const value = String(target);
      if (value.endsWith('/Cursor.app')) {
        return false;
      }
      return realExistsSync(target);
    });
    childProcessMock.spawnSync.mockImplementation((...input: unknown[]) => {
      const command = String(input[0] || '');
      const args = Array.isArray(input[1]) ? input[1] : [];
      if (command === 'mdfind' && String(args?.[0] || '').includes('Cursor')) {
        return { status: 0, stdout: '', stderr: '' };
      }
      return { status: 1, stdout: '', stderr: '' };
    });

    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/ide/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ide: 'cursor' }),
      });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toMatchObject({
        code: 'MAIN_IDE_MISSING',
        ide: 'cursor',
        projectId: 'ide-client',
      });
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      existsSyncSpy.mockRestore();
      await server.close();
    }
  });

  it('rejects an unsupported explicit IDE instead of falling back to project config', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot);
    writeJson(getConfigPath(projectRoot), {
      automation: {
        defaultIDE: 'cursor',
      },
    });

    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/ide/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ide: 'definitely-not-an-ide' }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toMatchObject({
        code: 'MAIN_IDE_UNSUPPORTED',
        projectId: 'ide-client',
      });
      expect(childProcessMock.spawn).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });
});
