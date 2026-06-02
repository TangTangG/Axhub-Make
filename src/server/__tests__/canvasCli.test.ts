import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeServerInfo } from '../projectCore/index.ts';

import { runCanvasCli } from '../canvasCli.ts';

const tempRoots: string[] = [];
const servers: http.Server[] = [];
const originalMakeHomeDir = process.env.AXHUB_MAKE_HOME_DIR;

function createTempRoot(prefix = 'axhub-canvas-cli-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function createProjectRoot() {
  const root = createTempRoot();
  fs.mkdirSync(path.join(root, '.axhub/make'), { recursive: true });
  return root;
}

async function captureCanvasCli(args: string[], cwd: string) {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write;
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
    return true;
  });

  try {
    await runCanvasCli(args, cwd);
    return {
      stdout: chunks.join(''),
      exitCode: process.exitCode,
    };
  } finally {
    (process.stdout.write as unknown as { mockRestore: () => void }).mockRestore();
    process.stdout.write = originalWrite;
    process.exitCode = originalExitCode;
  }
}

function parseJsonLine(output: string) {
  return JSON.parse(output.trim());
}

function listen(server: http.Server): Promise<{ origin: string; port: number }> {
  servers.push(server);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Expected TCP server address'));
        return;
      }
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        port: address.port,
      });
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

beforeEach(() => {
  process.exitCode = undefined;
  process.env.AXHUB_MAKE_HOME_DIR = createTempRoot('axhub-canvas-cli-home-');
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalMakeHomeDir === undefined) {
    delete process.env.AXHUB_MAKE_HOME_DIR;
  } else {
    process.env.AXHUB_MAKE_HOME_DIR = originalMakeHomeDir;
  }
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  return Promise.all(servers.splice(0).map((server) => closeServer(server)));
});

describe('canvas CLI', () => {
  it('prints usage without requiring a project root', async () => {
    const result = await captureCanvasCli(['--help'], os.tmpdir());

    expect(result.stdout).toContain('Usage: axhub-make canvas <command> [options]');
    expect(result.stdout).toContain('annotations [-c <canvas>]');
    expect(result.exitCode).toBeUndefined();
  });

  it('lists annotations from all canvas locations in updated order', async () => {
    const projectRoot = createProjectRoot();
    writeJson(path.join(projectRoot, 'src/canvas/overview.excalidraw'), {
      elements: [
        {
          id: 'older',
          type: 'rectangle',
          customData: { annotation: 'Older note', title: 'Old' },
          x: 1,
          y: 2,
          width: 3,
          height: 4,
          updated: 10,
        },
        {
          id: 'deleted',
          type: 'rectangle',
          isDeleted: true,
          customData: { annotation: 'Deleted' },
          updated: 999,
        },
      ],
    });
    writeJson(path.join(projectRoot, 'src/prototypes/home/canvas.excalidraw'), {
      elements: [
        {
          id: 'newer',
          type: 'ellipse',
          customData: { annotation: 'Newer note', annotationUpdatedAt: '2026-05-18T00:00:00.000Z' },
          link: 'https://example.com',
          x: 5,
          y: 6,
          width: 7,
          height: 8,
          updated: 20,
        },
      ],
    });

    const result = await captureCanvasCli(['annotations'], projectRoot);
    const body = parseJsonLine(result.stdout);

    expect(body.annotations).toHaveLength(2);
    expect(body.annotations.map((item: any) => item.id)).toEqual(['newer', 'older']);
    expect(body.annotations[0]).toMatchObject({
      canvas: 'src/prototypes/home/canvas.excalidraw',
      annotation: 'Newer note',
      annotatedAt: '2026-05-18T00:00:00.000Z',
      link: 'https://example.com',
      w: 7,
      h: 8,
    });
    expect(body.annotations[1]).toMatchObject({
      canvas: 'src/canvas/overview.excalidraw',
      title: 'Old',
    });
  });

  it('returns an empty summary when no canvas files exist', async () => {
    const projectRoot = createProjectRoot();
    const result = await captureCanvasCli(['annotations'], projectRoot);

    expect(parseJsonLine(result.stdout)).toEqual({
      annotations: [],
      summary: 'No canvas files found',
    });
    expect(result.exitCode).toBeUndefined();
  });

  it('reads a named prototype canvas and filters annotations by recency', async () => {
    const projectRoot = createProjectRoot();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-05-18T00:00:00.000Z'));
    writeJson(path.join(projectRoot, 'src/prototypes/home/canvas.excalidraw'), {
      elements: [
        {
          id: 'recent',
          type: 'rectangle',
          customData: {
            annotation: 'Recent',
            annotationUpdatedAt: '2026-05-17T23:59:30.000Z',
          },
          updated: 1,
        },
        {
          id: 'old',
          type: 'rectangle',
          customData: {
            annotation: 'Old',
            annotationUpdatedAt: '2026-05-17T23:00:00.000Z',
          },
          updated: 2,
        },
      ],
    });

    const result = await captureCanvasCli([
      'annotations',
      '--canvas',
      'prototypes/home/canvas',
      '--since',
      '60',
    ], projectRoot);

    expect(parseJsonLine(result.stdout)).toMatchObject({
      canvas: 'prototypes/home/canvas',
      annotations: [
        expect.objectContaining({ id: 'recent', annotation: 'Recent' }),
      ],
    });
    expect(parseJsonLine(result.stdout).annotations).toHaveLength(1);
    nowSpy.mockRestore();
  });

  it('returns an empty annotation list for invalid canvas JSON', async () => {
    const projectRoot = createProjectRoot();
    const canvasPath = path.join(projectRoot, 'src/canvas/broken.excalidraw');
    fs.mkdirSync(path.dirname(canvasPath), { recursive: true });
    fs.writeFileSync(canvasPath, '{not-json', 'utf8');

    const result = await captureCanvasCli(['annotations', '-c', 'broken'], projectRoot);

    expect(parseJsonLine(result.stdout)).toEqual({
      canvas: 'broken',
      annotations: [],
    });
  });

  it('reports missing canvas names and unknown subcommands as JSON errors', async () => {
    const projectRoot = createProjectRoot();

    const missing = await captureCanvasCli(['annotations', '--canvas', 'missing'], projectRoot);
    expect(parseJsonLine(missing.stdout)).toEqual({ error: 'Canvas not found: missing' });
    expect(missing.exitCode).toBe(1);

    const unknown = await captureCanvasCli(['wat'], projectRoot);
    expect(parseJsonLine(unknown.stdout)).toEqual({ error: 'Unknown canvas command: wat' });
    expect(unknown.exitCode).toBe(1);
  });

  it('reports server-dependent commands when the make server is not running', async () => {
    const projectRoot = createProjectRoot();
    const result = await captureCanvasCli(['info'], projectRoot);

    expect(parseJsonLine(result.stdout)).toEqual({
      error: 'Make server not running. Start with: npx @axhub/axhub',
    });
    expect(result.exitCode).toBe(1);
  });

  it('runs info, refresh, and screenshot subcommands against the running make server', async () => {
    const projectRoot = createProjectRoot();
    const pngBytes = Buffer.from('png-bytes');
    const seenRequests: Array<{ method?: string; url?: string; body: any }> = [];
    const backend = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        const parsedBody = rawBody ? JSON.parse(rawBody) : null;
        seenRequests.push({ method: req.method, url: req.url, body: parsedBody });

        if (req.url === '/api/canvas/bridge/status') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ canvases: [{ canvas: 'main' }] }));
          return;
        }
        if (req.url === '/api/canvas/bridge/refresh') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, canvas: parsedBody?.canvas || null }));
          return;
        }
        if (req.url === '/api/canvas/bridge/screenshot') {
          res.setHeader('Content-Type', 'image/png');
          res.end(pngBytes);
          return;
        }
        res.statusCode = 404;
        res.end('not found');
      });
    });
    const { origin, port } = await listen(backend);
    writeServerInfo(projectRoot, 'admin', {
      pid: 12345,
      host: '127.0.0.1',
      port,
      origin,
      projectRoot,
      startedAt: '2026-05-18T00:00:00.000Z',
    });

    const info = await captureCanvasCli(['info'], projectRoot);
    expect(parseJsonLine(info.stdout)).toEqual({ canvases: [{ canvas: 'main' }] });

    const refresh = await captureCanvasCli(['refresh', '--canvas', 'main'], projectRoot);
    expect(parseJsonLine(refresh.stdout)).toEqual({ ok: true, canvas: 'main' });

    const screenshot = await captureCanvasCli(['screenshot', '--canvas', 'main'], projectRoot);
    expect(parseJsonLine(screenshot.stdout)).toEqual({
      ok: true,
      base64: pngBytes.toString('base64'),
      bytes: pngBytes.length,
    });

    const outputPath = path.join(projectRoot, '.local/screens/main.png');
    const screenshotFile = await captureCanvasCli(['screenshot', '--canvas', 'main', '--output', outputPath], projectRoot);
    expect(parseJsonLine(screenshotFile.stdout)).toEqual({
      ok: true,
      path: outputPath,
      bytes: pngBytes.length,
    });
    expect(fs.readFileSync(outputPath)).toEqual(pngBytes);
    expect(seenRequests).toEqual([
      { method: 'GET', url: '/api/canvas/bridge/status', body: null },
      { method: 'POST', url: '/api/canvas/bridge/refresh', body: { canvas: 'main' } },
      { method: 'POST', url: '/api/canvas/bridge/screenshot', body: { canvas: 'main' } },
      { method: 'POST', url: '/api/canvas/bridge/screenshot', body: { canvas: 'main' } },
    ]);
  });

  it('reports server errors and JSON screenshot fallbacks from bridge subcommands', async () => {
    const projectRoot = createProjectRoot();
    const backend = http.createServer((req, res) => {
      if (req.url === '/api/canvas/bridge/status') {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'bridge down' }));
        return;
      }
      if (req.url === '/api/canvas/bridge/refresh') {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'refresh failed' }));
        return;
      }
      if (req.url === '/api/canvas/bridge/screenshot') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, dataUrl: 'data:image/png;base64,abc' }));
        return;
      }
      res.statusCode = 404;
      res.end('not found');
    });
    const { origin, port } = await listen(backend);
    writeServerInfo(projectRoot, 'admin', {
      pid: 12345,
      host: '127.0.0.1',
      port,
      origin,
      projectRoot,
      startedAt: '2026-05-18T00:00:00.000Z',
    });

    const info = await captureCanvasCli(['info'], projectRoot);
    expect(parseJsonLine(info.stdout)).toEqual({ error: 'Server returned 503' });
    expect(info.exitCode).toBe(1);

    const refresh = await captureCanvasCli(['refresh'], projectRoot);
    expect(parseJsonLine(refresh.stdout)).toEqual({ error: 'refresh failed' });
    expect(refresh.exitCode).toBe(1);

    const screenshot = await captureCanvasCli(['screenshot'], projectRoot);
    expect(parseJsonLine(screenshot.stdout)).toEqual({ ok: false, dataUrl: 'data:image/png;base64,abc' });
  });
});
