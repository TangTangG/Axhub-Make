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
});
