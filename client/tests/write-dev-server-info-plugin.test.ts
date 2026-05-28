import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeDevServerInfoPlugin } from '../vite-plugins/writeDevServerInfoPlugin';

const originalCwd = process.cwd();
const tempRoots: string[] = [];

function createTempProjectRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'make-project-health-'));
  tempRoots.push(root);
  return root;
}

  afterEach(() => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    vi.useRealTimers();
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

describe('write dev server info plugin', () => {
  it('serves runtime health from the make-project dev server', async () => {
    const projectRoot = createTempProjectRoot();
    const resolvedProjectRoot = fs.realpathSync(projectRoot);
    process.chdir(projectRoot);
    const middlewares: Array<{ path: string; handler: any }> = [];
    const plugin = writeDevServerInfoPlugin();
    const server = {
      config: {
        server: { port: 51720 },
      },
      httpServer: {
        address: () => ({ port: 51720 }),
        once: vi.fn(),
      },
      middlewares: {
        use: vi.fn((route: string, handler: any) => {
          middlewares.push({ path: route, handler });
        }),
      },
    };

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }

    const health = middlewares.find((entry) => entry.path === '/api/health');
    const chunks: string[] = [];
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn((chunk: string) => {
        chunks.push(chunk);
      }),
    };

    expect(health).toBeDefined();
    health?.handler({ method: 'GET' }, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(chunks.join(''))).toMatchObject({
      ok: true,
      role: 'runtime',
      server: {
        pid: process.pid,
        port: 51720,
        host: 'localhost',
        origin: 'http://localhost:51720',
        projectRoot: resolvedProjectRoot,
      },
    });
  });

  it('does not sync transient runtime ports into project metadata', async () => {
    const projectRoot = createTempProjectRoot();
    process.chdir(projectRoot);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    fs.mkdirSync(path.join(projectRoot, 'src/prototypes/home'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'src/prototypes/home/index.tsx'),
      'export default function Home() { return null; }\n',
      'utf8',
    );
    fs.mkdirSync(path.join(projectRoot, '.axhub/make'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.axhub/make/client.json'),
      JSON.stringify({
        schemaVersion: 1,
        kind: 'axhub-make-client',
        project: { id: 'runtime-port-client', name: 'Runtime Port Client' },
      }),
      'utf8',
    );
    const plugin = writeDevServerInfoPlugin();
    let listeningHandler: (() => void) | undefined;
    const server = {
      config: {
        server: { port: 51720 },
      },
      httpServer: {
        address: () => ({ port: 51721 }),
        once: vi.fn((event: string, handler: () => void) => {
          if (event === 'listening') {
            listeningHandler = handler;
          }
        }),
      },
      middlewares: {
        use: vi.fn(),
      },
    };

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    listeningHandler?.();

    const metadata = JSON.parse(fs.readFileSync(path.join(projectRoot, '.axhub/make/project.json'), 'utf8'));

    expect(metadata.resources.prototypes[0]).toMatchObject({
      id: 'home',
      clientUrl: '/prototypes/home',
    });
    expect(JSON.stringify(metadata)).not.toContain('51721');
    expect(logSpy.mock.calls.flat().join('\n')).not.toContain('metadata synced for http://localhost:51721');
  });

  it('keeps the runtime startedAt stable while heartbeat refreshes timestamp', async () => {
    const projectRoot = createTempProjectRoot();
    process.chdir(projectRoot);
    vi.useFakeTimers();
    fs.mkdirSync(path.join(projectRoot, 'src/prototypes/home'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'src/prototypes/home/index.tsx'),
      'export default function Home() { return null; }\n',
      'utf8',
    );
    fs.mkdirSync(path.join(projectRoot, '.axhub/make'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.axhub/make/client.json'),
      JSON.stringify({
        schemaVersion: 1,
        kind: 'axhub-make-client',
        project: { id: 'runtime-heartbeat-client', name: 'Runtime Heartbeat Client' },
      }),
      'utf8',
    );
    const plugin = writeDevServerInfoPlugin();
    let listeningHandler: (() => void) | undefined;
    const server = {
      config: {
        server: { port: 51720 },
      },
      httpServer: {
        address: () => ({ port: 51722 }),
        once: vi.fn((event: string, handler: () => void) => {
          if (event === 'listening') {
            listeningHandler = handler;
          }
        }),
      },
      middlewares: {
        use: vi.fn(),
      },
    };

    const configureServer = plugin.configureServer;
    if (typeof configureServer === 'function') {
      await configureServer(server as any);
    } else {
      await configureServer?.handler(server as any);
    }
    listeningHandler?.();

    const infoPath = path.join(projectRoot, '.axhub/make/.dev-server-info.json');
    const firstInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
    await vi.advanceTimersByTimeAsync(5_000);
    const secondInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));

    expect(firstInfo.startedAt).toBe(secondInfo.startedAt);
    expect(firstInfo.timestamp).not.toBe(secondInfo.timestamp);
  });
});
