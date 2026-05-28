import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

const startMakeServerMock = vi.hoisted(() => vi.fn());
const spawnMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    spawn: spawnMock,
  };
});

vi.mock('../index.ts', () => ({
  startMakeServer: startMakeServerMock,
}));

import { isCliEntrypoint, parseCliArgs, runCli, shouldAutoRunCli } from '../cli.ts';

const DEFAULT_MAKE_SERVER_PORT = 53817;

const tempRoots: string[] = [];

function createProjectRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axhub-make-server-cli-'));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  startMakeServerMock.mockReset();
  spawnMock.mockReset();
  vi.restoreAllMocks();
});

describe('make-server CLI args', () => {
  it('uses cwd as projectRoot when no explicit path is provided', () => {
    const cwd = createProjectRoot();

    expect(parseCliArgs([], cwd)).toMatchObject({
      projectRoot: cwd,
      port: DEFAULT_MAKE_SERVER_PORT,
    });
    expect(parseCliArgs([], cwd)).not.toHaveProperty('host');
  });

  it('uses explicit project path and accepts --port, --host, and --runtime-origin', () => {
    const cwd = createProjectRoot();
    const projectRoot = createProjectRoot();

    expect(parseCliArgs([
      projectRoot,
      '--port',
      '5200',
      '--host',
      '0.0.0.0',
      '--runtime-origin',
      'http://localhost:51720',
    ], cwd)).toEqual({
      projectRoot,
      host: '0.0.0.0',
      port: 5200,
      runtimeOrigin: 'http://localhost:51720',
    });
  });

  it('returns help without requiring a project root', () => {
    const cwd = createProjectRoot();

    expect(parseCliArgs(['--help'], cwd)).toEqual({
      help: true,
      projectRoot: cwd,
      port: DEFAULT_MAKE_SERVER_PORT,
    });
    expect(parseCliArgs(['-h'], cwd)).toMatchObject({ help: true });
  });

  it('accepts an explicit admin root for packaged release assets', () => {
    const cwd = createProjectRoot();
    const adminRoot = path.join(cwd, 'admin');

    expect(parseCliArgs(['--admin-root', adminRoot], cwd)).toMatchObject({
      adminRoot,
      projectRoot: cwd,
    });
  });

  it('ignores a pnpm script argument separator before the explicit project path', () => {
    const cwd = createProjectRoot();
    const projectRoot = createProjectRoot();

    expect(parseCliArgs(['--', projectRoot], cwd)).toMatchObject({
      projectRoot,
      port: DEFAULT_MAKE_SERVER_PORT,
    });
    expect(parseCliArgs(['--', projectRoot], cwd)).not.toHaveProperty('host');
  });

  it('rejects missing option values and invalid ports', () => {
    const cwd = createProjectRoot();

    expect(() => parseCliArgs(['--port'], cwd)).toThrow(/Missing value for --port/);
    expect(() => parseCliArgs(['--port', 'abc'], cwd)).toThrow(/Invalid --port/);
  });

  it('detects when cli.ts is executed as the process entrypoint', () => {
    const cliPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'cli.ts');
    const cliUrl = pathToFileURL(cliPath).href;

    expect(isCliEntrypoint(cliPath, cliUrl)).toBe(true);
    expect(isCliEntrypoint(path.join(path.dirname(cliPath), 'index.ts'), cliUrl)).toBe(false);
  });

  it('allows bundled entrypoints to disable cli.ts auto-run', () => {
    const cliPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'cli.ts');
    const cliUrl = pathToFileURL(cliPath).href;

    expect(shouldAutoRunCli(cliPath, cliUrl, { AXHUB_MAKE_DISABLE_AUTO_RUN: '1' })).toBe(false);
    expect(shouldAutoRunCli(cliPath, cliUrl, {})).toBe(true);
  });

  it('opens the admin page in the default browser after starting the server', async () => {
    const projectRoot = createProjectRoot();
    const unref = vi.fn();
    startMakeServerMock.mockResolvedValue({
      close: vi.fn(),
      host: 'localhost',
      origin: 'http://localhost:53817',
      port: DEFAULT_MAKE_SERVER_PORT,
    });
    spawnMock.mockReturnValue({ on: vi.fn(), unref });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await runCli([projectRoot]);

    expect(startMakeServerMock).toHaveBeenCalledWith(expect.objectContaining({ projectRoot }));
    expect(spawnMock).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['http://localhost:53817']), {
      detached: true,
      stdio: 'ignore',
    });
    expect(unref).toHaveBeenCalled();
  });

  it('prints a friendly hint with the visit URL when the server port is occupied', async () => {
    const projectRoot = createProjectRoot();
    const originalExitCode = process.exitCode;
    const portInUseError = Object.assign(new Error('listen EADDRINUSE: address already in use 0.0.0.0:53817'), {
      address: '0.0.0.0',
      code: 'EADDRINUSE',
      port: DEFAULT_MAKE_SERVER_PORT,
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    startMakeServerMock.mockRejectedValue(portInUseError);
    process.exitCode = undefined;

    try {
      await runCli([projectRoot]);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const message = String(errorSpy.mock.calls[0]?.[0] || '');
      expect(message).toContain(`端口 ${DEFAULT_MAKE_SERVER_PORT} 已经被占用了`);
      expect(message).toContain(`http://localhost:${DEFAULT_MAKE_SERVER_PORT}`);
      expect(message).toContain('如果看到的是 Axhub Make 首页');
      expect(message).toContain(`关闭占用 ${DEFAULT_MAKE_SERVER_PORT} 端口的应用`);
      expect(spawnMock).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = originalExitCode;
    }
  });
});
