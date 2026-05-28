import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getMakeClientMarkerPath,
  readServerInfo,
} from '../projectCore/index.ts';
import { ensureMakeClientDevServer, getMakeClientDevStatus } from '../makeClientProject.ts';

const tempRoots: string[] = [];

function createTempRoot(prefix = 'axhub-make-client-runtime-discovery-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeMakeClientMarker(projectRoot: string, id = 'runtime-discovery-client') {
  writeJson(getMakeClientMarkerPath(projectRoot), {
    schemaVersion: 1,
    kind: 'axhub-make-client',
    repository: 'https://github.com/lintendo/Axhub-Make/tree/main/client',
    project: { id, name: 'Runtime Discovery Client' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('make client runtime discovery', () => {
  it('finds a running client from runtime health when the server info file is missing', async () => {
    const projectRoot = createTempRoot();
    writeMakeClientMarker(projectRoot);
    const runtimeOrigin = 'http://localhost:51724';
    const runtimePayload = {
      pid: 12345,
      port: 51724,
      host: 'localhost',
      origin: runtimeOrigin,
      projectRoot,
      startedAt: '2026-05-28T03:54:46.722Z',
      timestamp: '2026-05-28T03:54:46.722Z',
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === `${runtimeOrigin}/api/health`) {
        return new Response(JSON.stringify({
          ok: true,
          role: 'runtime',
          projectRoot,
          server: runtimePayload,
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    const status = await getMakeClientDevStatus('runtime-discovery-client', projectRoot);

    expect(status).toMatchObject({
      projectId: 'runtime-discovery-client',
      makeClient: true,
      running: true,
      runtime: {
        origin: runtimeOrigin,
        projectRoot,
      },
    });
    expect(status.reason).toBeUndefined();
    expect(readServerInfo(projectRoot, 'runtime')).toMatchObject({
      origin: runtimeOrigin,
      projectRoot,
    });
    expect(fetchSpy).toHaveBeenCalledWith(new URL('/api/health', runtimeOrigin), expect.any(Object));
  });

  it('reuses a discovered running client when ensuring dev and the server info file is missing', async () => {
    const projectRoot = createTempRoot();
    writeMakeClientMarker(projectRoot);
    writeJson(path.join(projectRoot, 'package.json'), {
      scripts: {
        dev: 'vite',
        'metadata:sync': 'node scripts/sync-project-metadata.mjs',
      },
    });
    const runtimeOrigin = 'http://localhost:51724';
    const runtimePayload = {
      pid: 12345,
      port: 51724,
      host: 'localhost',
      origin: runtimeOrigin,
      projectRoot,
      startedAt: '2026-05-28T03:54:46.722Z',
      timestamp: '2026-05-28T03:54:46.722Z',
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === `${runtimeOrigin}/api/health`) {
        return new Response(JSON.stringify({
          ok: true,
          role: 'runtime',
          projectRoot,
          server: runtimePayload,
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });
    const spawn = vi.fn();
    const runCommand = vi.fn();

    const result = await ensureMakeClientDevServer(projectRoot, {
      commandRunner: {
        runCommand,
        spawn: spawn as any,
      },
    });

    expect(result).toMatchObject({
      success: true,
      reused: true,
      phase: 'ready',
      runtime: {
        origin: runtimeOrigin,
        projectRoot,
      },
    });
    expect(readServerInfo(projectRoot, 'runtime')).toMatchObject({
      origin: runtimeOrigin,
      projectRoot,
    });
    expect(runCommand).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });
});
