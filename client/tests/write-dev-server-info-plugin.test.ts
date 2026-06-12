import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ViteDevServer } from 'vite';

import { writeDevServerInfoPlugin } from '../vite-plugins/writeDevServerInfoPlugin';

const originalCwd = process.cwd();
const tempRoots: string[] = [];
const httpServers: http.Server[] = [];
const viteServers: ViteDevServer[] = [];

function createTempProjectRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'make-project-health-'));
  tempRoots.push(root);
  return root;
}

function listen(server: http.Server, port = 0): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Expected TCP server address'));
        return;
      }
      resolve(address.port);
    });
  });
}

async function closeHttpServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function getViteServerPort(server: ViteDevServer): number {
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected Vite dev server to listen on a TCP port');
  }
  return address.port;
}

afterEach(async () => {
  await Promise.all(viteServers.splice(0).map((server) => server.close()));
  await Promise.all(httpServers.splice(0).map((server) => closeHttpServer(server)));
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

  it('injects the actual listening port into Vite client HMR fallback when the preferred port is occupied', async () => {
    const projectRoot = createTempProjectRoot();
    process.chdir(projectRoot);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { createServer } = await import('vite');
    const configuredPortProbe = http.createServer((_req, res) => {
      res.end('probe');
    });
    const configuredPort = await listen(configuredPortProbe);
    await closeHttpServer(configuredPortProbe);
    const blocker = http.createServer((_req, res) => {
      res.end('occupied');
    });
    await listen(blocker, configuredPort);
    httpServers.push(blocker);

    const server = await createServer({
      root: projectRoot,
      publicDir: false,
      configFile: false,
      logLevel: 'silent',
      plugins: [writeDevServerInfoPlugin()],
      server: {
        port: configuredPort,
        strictPort: false,
        host: '127.0.0.1',
        hmr: { overlay: false },
      },
    });
    viteServers.push(server);
    await server.listen();
    const actualPort = getViteServerPort(server);

    const response = await fetch(`http://127.0.0.1:${actualPort}/@vite/client`);
    const code = await response.text();

    expect(actualPort).not.toBe(configuredPort);
    expect(response.status).toBe(200);
    expect(code).toContain(`const serverHost = "127.0.0.1:${actualPort}/";`);
    expect(code).toContain(`const directSocketHost = "127.0.0.1:${actualPort}/";`);
    expect(code).not.toContain(`const directSocketHost = "127.0.0.1:${configuredPort}/";`);
    expect(logSpy).toHaveBeenCalled();
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
