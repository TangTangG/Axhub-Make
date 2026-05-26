import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { startMakeServer } from '../index.ts';

const tempRoots: string[] = [];

function createTempRoot(prefix = 'axhub-http-routing-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

async function startRoutingServer(projectRoot: string) {
  return startMakeServer({
    projectRoot,
    host: 'localhost',
    port: 0,
    adminRoot: path.join(projectRoot, 'missing-admin'),
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('make-server HTTP routing', () => {
  it('returns stable method errors for server-owned routes', async () => {
    const projectRoot = createTempRoot();
    const server = await startRoutingServer(projectRoot);

    try {
      const runtime = await fetch(`${server.origin}/runtime/quick-edit.js`, { method: 'POST' });
      expect(runtime.status).toBe(405);
      expect(runtime.headers.get('content-type')).toContain('text/plain');
      expect(await runtime.text()).toBe('Method Not Allowed');
    } finally {
      await server.close();
    }
  });

  it('returns JSON 404 for unknown API routes without falling through to static or runtime handlers', async () => {
    const projectRoot = createTempRoot();
    const server = await startRoutingServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/unknown-route`);
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toEqual({ error: 'Not found' });
    } finally {
      await server.close();
    }
  });
});
