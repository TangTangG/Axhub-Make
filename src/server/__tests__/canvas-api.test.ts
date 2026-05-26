import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getCanvasBridgeHub } from '../canvasBridge.ts';
import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  startTestServer,
  writeProjectMetadata,
} from './projects-api.helpers';

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const GIF_DATA_URL = `data:image/gif;base64,${Buffer.from('GIF89a').toString('base64')}`;
const JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`;
const WEBP_DATA_URL = `data:image/webp;base64,${Buffer.from('RIFFxxxxWEBP').toString('base64')}`;
const SVG_DATA_URL = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>').toString('base64')}`;

class FakeCanvasSocket extends EventEmitter {
  readonly sentMessages: any[] = [];
  ended = false;

  write(chunk: Buffer | string): boolean {
    if (Buffer.isBuffer(chunk)) {
      for (const message of parseServerTextFrames(chunk)) {
        this.sentMessages.push(JSON.parse(message));
      }
    }
    return true;
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.emit('close');
  }
}

function encodeClientTextFrame(message: any): Buffer {
  const payload = Buffer.from(JSON.stringify(message), 'utf8');
  const mask = Buffer.from([1, 2, 3, 4]);
  const header = payload.length < 126
    ? Buffer.from([0x81, 0x80 | payload.length])
    : Buffer.from([0x81, 0x80 | 126, payload.length >> 8, payload.length & 0xff]);
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

function parseServerTextFrames(buffer: Buffer): string[] {
  const messages: string[] = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const opcode = buffer[offset] & 0x0f;
    let payloadLength = buffer[offset + 1] & 0x7f;
    let headerLength = 2;
    if (payloadLength === 126) {
      payloadLength = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (payloadLength === 127) {
      payloadLength = Number(buffer.readBigUInt64BE(offset + 2));
      headerLength = 10;
    }
    const frameEnd = offset + headerLength + payloadLength;
    if (frameEnd > buffer.length) break;
    if (opcode === 0x01) {
      messages.push(buffer.subarray(offset + headerLength, frameEnd).toString('utf8'));
    }
    offset = frameEnd;
  }
  return messages;
}

async function waitForSentMessage(socket: FakeCanvasSocket, type: string): Promise<any> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const matchingMessages = socket.sentMessages.filter((item) => item.type === type);
    const message = matchingMessages[matchingMessages.length - 1];
    if (message) {
      return message;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Expected bridge message ${type}`);
}

async function waitForSentMessageAfter(socket: FakeCanvasSocket, type: string, previousCount: number): Promise<any> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const messages = socket.sentMessages.filter((item) => item.type === type);
    if (messages.length > previousCount) {
      return messages[messages.length - 1];
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Expected bridge message ${type} after ${previousCount}`);
}

function writePrototypeDir(projectRoot: string, prototypeId: string) {
  const prototypeDir = path.join(projectRoot, 'src', 'prototypes', prototypeId);
  fs.mkdirSync(prototypeDir, { recursive: true });
  fs.writeFileSync(path.join(prototypeDir, 'index.tsx'), 'export default function Home() {}', 'utf8');
  return prototypeDir;
}

function writeCanvasFile(filePath: string, data: any = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({
    type: 'excalidraw',
    version: 2,
    elements: [],
    appState: {},
    files: {},
    ...data,
  }, null, 2), 'utf8');
}

function writeScreenshotProjectMetadata(projectRoot: string) {
  writeProjectMetadata(projectRoot, {
    resourceWriteTargets: {
      prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
    },
  });
}

describe('canvas API', () => {
  afterEach(() => {
    getCanvasBridgeHub().destroy();
    cleanupProjectApiTestRoots();
  });

  it('ensures, reads, and saves the fixed canvas file for a prototype', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'home');
    const server = await startTestServer(projectRoot);

    try {
      const canvasPath = path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas.excalidraw');
      expect(fs.existsSync(canvasPath)).toBe(false);

      const ensureResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/ensure`, {
        method: 'POST',
      });
      const ensureBody = await ensureResponse.json();

      expect(ensureResponse.status).toBe(201);
      expect(ensureBody).toMatchObject({
        success: true,
        name: 'prototypes/home/canvas.excalidraw',
        displayName: 'home Canvas',
        path: 'src/prototypes/home/canvas.excalidraw',
      });
      expect(fs.existsSync(canvasPath)).toBe(true);

      const getResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas.excalidraw`);
      expect(getResponse.status).toBe(200);
      expect(getResponse.headers.get('content-type')).toContain('application/json');
      expect(await getResponse.json()).toMatchObject({
        type: 'excalidraw',
        version: 2,
        elements: [],
      });

      const nextCanvas = {
        type: 'excalidraw',
        version: 2,
        source: '@axhub/make-test',
        elements: [{ id: 'rect-1', type: 'rectangle' }],
        appState: { viewBackgroundColor: '#f8fafc' },
        files: {},
      };
      const putResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas.excalidraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify(nextCanvas, null, 2) }),
      });

      expect(putResponse.status).toBe(200);
      expect(await putResponse.json()).toMatchObject({
        success: true,
        name: 'prototypes/home/canvas.excalidraw',
      });
      expect(JSON.parse(fs.readFileSync(canvasPath, 'utf8'))).toMatchObject(nextCanvas);
    } finally {
      await server.close();
    }
  });

  it('creates standalone canvases without starter content', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const createResponse = await fetch(`${server.origin}/api/canvas/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Main Canvas' }),
      });
      const createBody = await createResponse.json();

      expect(createResponse.status).toBe(201);
      expect(createBody).toMatchObject({
        success: true,
        name: 'main-canvas.excalidraw',
        displayName: 'Main Canvas',
      });

      const canvas = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/canvas/main-canvas.excalidraw'), 'utf8'));
      expect(canvas).toMatchObject({
        type: 'excalidraw',
        version: 2,
        source: '@axhub/make',
        elements: [],
        appState: {
          viewBackgroundColor: '#ffffff',
        },
        files: {},
      });
      expect(JSON.stringify(canvas)).not.toContain('对话技巧');
      expect(JSON.stringify(canvas)).not.toContain('选择正确模型');
    } finally {
      await server.close();
    }
  });

  it('accepts beacon-compatible POST writes for canvas content', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'home');
    const canvasDir = path.join(projectRoot, 'src/canvas');
    const standaloneCanvasPath = path.join(canvasDir, 'main.excalidraw');
    writeCanvasFile(standaloneCanvasPath);
    const server = await startTestServer(projectRoot);

    try {
      const prototypeCanvasPath = path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas.excalidraw');
      const prototypeCanvas = {
        type: 'excalidraw',
        version: 2,
        source: '@axhub/make-test',
        elements: [{ id: 'beacon-rect', type: 'rectangle' }],
        appState: { viewBackgroundColor: '#f8fafc' },
        files: {},
      };

      const prototypeResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas.excalidraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify(prototypeCanvas, null, 2) }),
      });

      expect(prototypeResponse.status).toBe(200);
      expect(await prototypeResponse.json()).toMatchObject({
        success: true,
        changed: true,
        name: 'prototypes/home/canvas.excalidraw',
      });
      expect(JSON.parse(fs.readFileSync(prototypeCanvasPath, 'utf8'))).toMatchObject(prototypeCanvas);

      const malformedPrototypePost = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas.excalidraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(malformedPrototypePost.status).toBe(400);
      expect(JSON.parse(fs.readFileSync(prototypeCanvasPath, 'utf8'))).toMatchObject(prototypeCanvas);

      const standaloneCanvas = {
        type: 'excalidraw',
        version: 2,
        source: '@axhub/make-test',
        elements: [{ id: 'standalone-note', type: 'text' }],
        appState: { viewBackgroundColor: '#fff7ed' },
        files: {},
      };
      const standaloneResponse = await fetch(`${server.origin}/api/canvas/main.excalidraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: standaloneCanvas }),
      });

      expect(standaloneResponse.status).toBe(200);
      expect(await standaloneResponse.json()).toMatchObject({
        success: true,
        changed: true,
        name: 'main.excalidraw',
      });
      expect(JSON.parse(fs.readFileSync(standaloneCanvasPath, 'utf8'))).toMatchObject(standaloneCanvas);
    } finally {
      await server.close();
    }
  });

  it('keeps standalone canvas creation names unique and reports malformed writes', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const first = await fetch(`${server.origin}/api/canvas/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Main Canvas' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      const second = await fetch(`${server.origin}/api/canvas/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Main Canvas' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      const badCreate = await fetch(`${server.origin}/api/canvas/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      });
      const missingRead = await fetch(`${server.origin}/api/canvas/missing.excalidraw`);
      const missingCopy = await fetch(`${server.origin}/api/canvas/missing.excalidraw/copy`, { method: 'POST' });
      const badUpdate = await fetch(`${server.origin}/api/canvas/main-canvas.excalidraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      });

      expect(first).toMatchObject({
        status: 201,
        body: { success: true, name: 'main-canvas.excalidraw' },
      });
      expect(second).toMatchObject({
        status: 201,
        body: { success: true, name: 'main-canvas-2.excalidraw' },
      });
      expect(badCreate.status).toBe(400);
      expect(missingRead.status).toBe(404);
      expect(missingCopy.status).toBe(404);
      expect(badUpdate.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it('copies, renames, updates, reads, and deletes standalone canvases safely', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    const canvasDir = path.join(projectRoot, 'src/canvas');
    fs.mkdirSync(canvasDir, { recursive: true });
    fs.writeFileSync(path.join(canvasDir, 'main.excalidraw'), JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [],
      appState: {},
      files: {},
    }, null, 2), 'utf8');
    const server = await startTestServer(projectRoot);

    try {
      const list = await fetch(`${server.origin}/api/canvas`).then((response) => response.json());
      expect(list).toEqual([
        expect.objectContaining({
          name: 'main.excalidraw',
          displayName: 'main',
        }),
      ]);

      const copy = await fetch(`${server.origin}/api/canvas/main.excalidraw/copy`, { method: 'POST' })
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(copy).toMatchObject({
        status: 201,
        body: { success: true, name: 'main-copy.excalidraw' },
      });

      const rename = await fetch(`${server.origin}/api/canvas/main-copy.excalidraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newBaseName: 'Review Board' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(rename).toMatchObject({
        status: 200,
        body: { success: true, name: 'review-board.excalidraw' },
      });
      expect(fs.existsSync(path.join(canvasDir, 'main-copy.excalidraw'))).toBe(false);

      const update = await fetch(`${server.origin}/api/canvas/review-board.excalidraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: {
            type: 'excalidraw',
            version: 2,
            elements: [{ id: 'rect-1', type: 'rectangle' }],
            appState: {},
            files: {},
          },
        }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(update).toMatchObject({
        status: 200,
        body: { success: true, changed: true, name: 'review-board.excalidraw' },
      });

      const read = await fetch(`${server.origin}/api/canvas/review-board.excalidraw`);
      expect(read.status).toBe(200);
      await expect(read.json()).resolves.toMatchObject({
        elements: [{ id: 'rect-1' }],
      });

      const invalid = await fetch(`${server.origin}/api/canvas/${encodeURIComponent('../escape.excalidraw')}`);
      expect(invalid.status).toBe(403);

      const deleted = await fetch(`${server.origin}/api/canvas/review-board.excalidraw`, { method: 'DELETE' })
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(deleted).toEqual({ status: 200, body: { success: true } });
      expect(fs.existsSync(path.join(canvasDir, 'review-board.excalidraw'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('returns stable bridge status and missing-client errors for bridge commands', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    const server = await startTestServer(projectRoot);

    try {
      const status = await fetch(`${server.origin}/api/canvas/bridge/status`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(status).toEqual({ status: 200, body: { canvases: [] } });

      const refresh = await fetch(`${server.origin}/api/canvas/bridge/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvas: 'missing' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(refresh).toEqual({
        status: 503,
        body: { error: 'No canvas browser connected' },
      });

      const screenshot = await fetch(`${server.origin}/api/canvas/bridge/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvas: 'missing' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(screenshot).toEqual({
        status: 503,
        body: { error: 'No canvas browser connected' },
      });
    } finally {
      await server.close();
    }
  });

  it('reports connected canvas status and relays refresh and screenshot bridge commands', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'home');
    writeCanvasFile(path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas.excalidraw'), {
      elements: [
        { id: 'annotated', type: 'rectangle', customData: { annotation: 'Check spacing' } },
        { id: 'plain', type: 'rectangle' },
        { id: 'deleted', type: 'rectangle', isDeleted: true, customData: { annotation: 'ignore' } },
      ],
    });
    writeCanvasFile(path.join(projectRoot, 'src', 'canvas', 'legacy.excalidraw'), {
      elements: [
        { id: 'legacy-note', type: 'text', customData: { annotation: 'Legacy note' } },
      ],
    });
    const hub = getCanvasBridgeHub();
    hub.configureProjectRoot(projectRoot);
    const prototypeSocket = new FakeCanvasSocket();
    hub.handleUpgrade({
      headers: { 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==' },
    } as any, prototypeSocket as any, Buffer.alloc(0));
    prototypeSocket.emit('data', encodeClientTextFrame({
      type: 'canvas.register',
      canvas: 'prototypes/home/canvas.excalidraw',
    }));
    const legacySocket = new FakeCanvasSocket();
    hub.handleUpgrade({
      headers: { 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==' },
    } as any, legacySocket as any, Buffer.alloc(0));
    legacySocket.emit('data', encodeClientTextFrame({
      type: 'canvas.register',
      canvas: 'legacy.excalidraw',
    }));
    const server = await startTestServer(projectRoot);

    try {
      const status = await fetch(`${server.origin}/api/canvas/bridge/status`);
      expect(status.status).toBe(200);
      expect(await status.json()).toMatchObject({
        canvases: [
          {
            canvas: 'prototypes/home/canvas',
            filePath: 'src/prototypes/home/canvas.excalidraw',
            elementCount: 2,
            annotatedCount: 1,
          },
          {
            canvas: 'legacy.excalidraw',
            filePath: 'src/canvas/legacy.excalidraw',
            elementCount: 1,
            annotatedCount: 1,
          },
        ],
      });

      const refresh = await fetch(`${server.origin}/api/canvas/bridge/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvas: 'prototypes/home/canvas.excalidraw' }),
      });
      expect(refresh.status).toBe(200);
      expect(await refresh.json()).toEqual({ ok: true });
      expect(prototypeSocket.sentMessages).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'canvas.reload' }),
      ]));
      expect(legacySocket.sentMessages).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'canvas.reload' }),
      ]));

      const screenshotPromise = fetch(`${server.origin}/api/canvas/bridge/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvas: 'prototypes/home/canvas.excalidraw' }),
      });
      const screenshotRequest = await waitForSentMessage(prototypeSocket, 'canvas.screenshot.request');
      expect(screenshotRequest.requestId).toMatch(/^ss-/u);
      prototypeSocket.emit('data', encodeClientTextFrame({
        type: 'canvas.screenshot.response',
        requestId: screenshotRequest.requestId,
        dataUrl: PNG_DATA_URL,
      }));
      const screenshot = await screenshotPromise;
      expect(screenshot.status).toBe(200);
      expect(screenshot.headers.get('content-type')).toBe('image/png');
      expect(Buffer.from(await screenshot.arrayBuffer()).subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );

      const previousScreenshotCount = prototypeSocket.sentMessages.filter(
        (message) => message.type === 'canvas.screenshot.request',
      ).length;
      const rawDataUrlPromise = fetch(`${server.origin}/api/canvas/bridge/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvas: 'prototypes/home/canvas.excalidraw' }),
      });
      const rawDataUrlRequest = await waitForSentMessageAfter(
        prototypeSocket,
        'canvas.screenshot.request',
        previousScreenshotCount,
      );
      prototypeSocket.emit('data', encodeClientTextFrame({
        type: 'canvas.screenshot.response',
        requestId: rawDataUrlRequest.requestId,
        dataUrl: 'data:text/plain;base64,aGVsbG8=',
      }));
      const rawDataUrl = await rawDataUrlPromise;
      expect(rawDataUrl.status).toBe(200);
      await expect(rawDataUrl.json()).resolves.toEqual({
        dataUrl: 'data:text/plain;base64,aGVsbG8=',
      });

      const badRefresh = await fetch(`${server.origin}/api/canvas/bridge/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      });
      expect(badRefresh.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it('does not rewrite an unchanged prototype canvas file', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'home');
    const server = await startTestServer(projectRoot);

    try {
      const canvasPath = path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas.excalidraw');
      const canvas = {
        type: 'excalidraw',
        version: 2,
        source: '@axhub/make',
        elements: [{ id: 'embed-1', type: 'embeddable', link: 'http://localhost:51720/prototypes/home' }],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {},
      };
      fs.writeFileSync(canvasPath, JSON.stringify(canvas, null, 2), 'utf8');
      const beforeMtime = fs.statSync(canvasPath).mtimeMs;

      const putResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas.excalidraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify(canvas, null, 2) }),
      });

      expect(putResponse.status).toBe(200);
      expect(fs.statSync(canvasPath).mtimeMs).toBe(beforeMtime);
      expect(await putResponse.json()).toMatchObject({
        success: true,
        changed: false,
        name: 'prototypes/home/canvas.excalidraw',
      });
    } finally {
      await server.close();
    }
  });

  it('strips embedded screenshot data URLs when a persisted screenshot URL is available', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'home');
    const server = await startTestServer(projectRoot);

    try {
      const canvasPath = path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas.excalidraw');
      const canvas = {
        type: 'excalidraw',
        version: 2,
        source: '@axhub/make',
        elements: [
          {
            id: 'embed-1',
            type: 'embeddable',
            customData: {
              screenshotUrl: '/prototypes/home/embed-embed-1.png?v=123',
              screenshotDataUrl: PNG_DATA_URL,
              screenshotWidth: 320,
              screenshotHeight: 180,
            },
          },
        ],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {},
      };

      const putResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas.excalidraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify(canvas, null, 2) }),
      });

      expect(putResponse.status).toBe(200);
      const saved = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
      expect(saved.elements[0].customData).toMatchObject({
        screenshotUrl: '/prototypes/home/embed-embed-1.png?v=123',
        screenshotWidth: 320,
        screenshotHeight: 180,
      });
      expect(saved.elements[0].customData).not.toHaveProperty('screenshotDataUrl');
    } finally {
      await server.close();
    }
  });

  it('stores Excalidraw image file data as local canvas asset paths instead of inline data URLs', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'home');
    const server = await startTestServer(projectRoot);

    try {
      const canvasPath = path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas.excalidraw');
      const canvas = {
        type: 'excalidraw',
        version: 2,
        source: '@axhub/make',
        elements: [
          {
            id: 'image-1',
            type: 'image',
            fileId: 'image-file-1',
          },
        ],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {
          'image-file-1': {
            mimeType: 'image/png',
            id: 'image-file-1',
            dataURL: PNG_DATA_URL,
            created: 1778751138363,
            lastRetrieved: 1778751138363,
          },
        },
      };

      const putResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas.excalidraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify(canvas, null, 2) }),
      });

      expect(putResponse.status).toBe(200);
      const rawSaved = fs.readFileSync(canvasPath, 'utf8');
      expect(rawSaved).not.toContain('data:image');
      expect(rawSaved).not.toContain('base64');

      const saved = JSON.parse(rawSaved);
      expect(saved.files['image-file-1']).toMatchObject({
        mimeType: 'image/png',
        id: 'image-file-1',
        path: 'canvas-assets/images/image-file-1.png',
        created: 1778751138363,
        lastRetrieved: 1778751138363,
      });
      expect(saved.files['image-file-1']).not.toHaveProperty('dataURL');

      const assetPath = path.join(
        projectRoot,
        'src',
        'prototypes',
        'home',
        'canvas-assets',
        'images',
        'image-file-1.png',
      );
      expect(fs.existsSync(assetPath)).toBe(true);
      expect(fs.readFileSync(assetPath).subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );

      const getResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas.excalidraw`);
      expect(getResponse.status).toBe(200);
      const hydrated = await getResponse.json();
      expect(hydrated.files['image-file-1']).toMatchObject({
        mimeType: 'image/png',
        id: 'image-file-1',
        path: 'canvas-assets/images/image-file-1.png',
        dataURL: PNG_DATA_URL,
      });
    } finally {
      await server.close();
    }
  });

  it('stores supported non-PNG Excalidraw image files as local canvas asset paths', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'home');
    const server = await startTestServer(projectRoot);

    try {
      const canvasPath = path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas.excalidraw');
      const canvas = {
        type: 'excalidraw',
        version: 2,
        source: '@axhub/make',
        elements: [],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {
          jpeg: { mimeType: 'image/jpeg', id: 'Hero Photo', dataURL: JPEG_DATA_URL },
          gif: { mimeType: 'image/gif', id: 'Loop Clip', dataURL: GIF_DATA_URL },
          webp: { mimeType: 'image/webp', id: 'Web Preview', dataURL: WEBP_DATA_URL },
        },
      };

      const putResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas.excalidraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify(canvas, null, 2) }),
      });

      expect(putResponse.status).toBe(200);
      const saved = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
      expect(saved.files.jpeg).toMatchObject({
        mimeType: 'image/jpeg',
        id: 'Hero Photo',
        path: 'canvas-assets/images/hero-photo.jpg',
      });
      expect(saved.files.gif).toMatchObject({
        mimeType: 'image/gif',
        id: 'Loop Clip',
        path: 'canvas-assets/images/loop-clip.gif',
      });
      expect(saved.files.webp).toMatchObject({
        mimeType: 'image/webp',
        id: 'Web Preview',
        path: 'canvas-assets/images/web-preview.webp',
      });
      expect(fs.existsSync(path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas-assets', 'images', 'hero-photo.jpg'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas-assets', 'images', 'loop-clip.gif'))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas-assets', 'images', 'web-preview.webp'))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('saves generated image results while preserving SVG generator placeholders inline', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'home');
    const server = await startTestServer(projectRoot);

    try {
      const canvasPath = path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas.excalidraw');
      const canvas = {
        type: 'excalidraw',
        version: 2,
        source: '@axhub/make',
        elements: [
          {
            id: 'generated-image',
            type: 'image',
            fileId: 'generated-image-file',
            customData: { type: 'axhub-ai-image' },
          },
          {
            id: 'ai-placeholder',
            type: 'image',
            fileId: 'axhub-ai-image-placeholder-v2',
            isDeleted: true,
            customData: { type: 'axhub-ai-image-generator' },
          },
        ],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {
          'generated-image-file': {
            mimeType: 'image/png',
            id: 'generated-image-file',
            dataURL: PNG_DATA_URL,
            created: 1778751138363,
            lastRetrieved: 1778751138363,
          },
          'axhub-ai-image-placeholder-v2': {
            mimeType: 'image/svg+xml',
            id: 'axhub-ai-image-placeholder-v2',
            dataURL: SVG_DATA_URL,
            created: 1778751138363,
            lastRetrieved: 1778751138363,
          },
        },
      };

      const putResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas.excalidraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify(canvas, null, 2) }),
      });

      expect(putResponse.status).toBe(200);
      const saved = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
      expect(saved.files['generated-image-file']).toMatchObject({
        mimeType: 'image/png',
        id: 'generated-image-file',
        path: 'canvas-assets/images/generated-image-file.png',
      });
      expect(saved.files['generated-image-file']).not.toHaveProperty('dataURL');
      expect(saved.files['axhub-ai-image-placeholder-v2']).toMatchObject({
        mimeType: 'image/svg+xml',
        id: 'axhub-ai-image-placeholder-v2',
        dataURL: SVG_DATA_URL,
      });
      expect(fs.existsSync(path.join(
        projectRoot,
        'src',
        'prototypes',
        'home',
        'canvas-assets',
        'images',
        'generated-image-file.png',
      ))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('stores standalone Excalidraw image file data as local canvas asset paths instead of inline data URLs', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    const legacyCanvasDir = path.join(projectRoot, 'src', 'canvas');
    fs.mkdirSync(legacyCanvasDir, { recursive: true });
    const canvasPath = path.join(legacyCanvasDir, 'legacy.excalidraw');
    fs.writeFileSync(canvasPath, JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [],
      appState: {},
      files: {},
    }), 'utf8');
    const server = await startTestServer(projectRoot);

    try {
      const canvas = {
        type: 'excalidraw',
        version: 2,
        source: '@axhub/make',
        elements: [
          {
            id: 'image-1',
            type: 'image',
            fileId: 'legacy-image-file',
          },
        ],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {
          'legacy-image-file': {
            mimeType: 'image/png',
            id: 'legacy-image-file',
            dataURL: PNG_DATA_URL,
            created: 1778751138363,
            lastRetrieved: 1778751138363,
          },
        },
      };

      const putResponse = await fetch(`${server.origin}/api/canvas/legacy.excalidraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify(canvas, null, 2) }),
      });

      expect(putResponse.status).toBe(200);
      const rawSaved = fs.readFileSync(canvasPath, 'utf8');
      expect(rawSaved).not.toContain('data:image');
      expect(rawSaved).not.toContain('base64');

      const saved = JSON.parse(rawSaved);
      expect(saved.files['legacy-image-file']).toMatchObject({
        mimeType: 'image/png',
        id: 'legacy-image-file',
        path: 'canvas-assets/legacy/images/legacy-image-file.png',
        created: 1778751138363,
        lastRetrieved: 1778751138363,
      });
      expect(saved.files['legacy-image-file']).not.toHaveProperty('dataURL');

      const assetPath = path.join(
        projectRoot,
        'src',
        'canvas',
        'canvas-assets',
        'legacy',
        'images',
        'legacy-image-file.png',
      );
      expect(fs.existsSync(assetPath)).toBe(true);
      expect(fs.readFileSync(assetPath).subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );

      const getResponse = await fetch(`${server.origin}/api/canvas/legacy.excalidraw`);
      expect(getResponse.status).toBe(200);
      const hydrated = await getResponse.json();
      expect(hydrated.files['legacy-image-file']).toMatchObject({
        mimeType: 'image/png',
        id: 'legacy-image-file',
        path: 'canvas-assets/legacy/images/legacy-image-file.png',
        dataURL: PNG_DATA_URL,
      });
    } finally {
      await server.close();
    }
  });

  it('rejects invalid Excalidraw image file data without writing inline data URLs', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'home');
    const server = await startTestServer(projectRoot);

    try {
      const canvasPath = path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas.excalidraw');
      const canvas = {
        type: 'excalidraw',
        version: 2,
        source: '@axhub/make',
        elements: [
          {
            id: 'image-1',
            type: 'image',
            fileId: 'image-file-1',
          },
        ],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {
          'image-file-1': {
            mimeType: 'image/png',
            id: 'image-file-1',
            dataURL: 'data:image/png;base64,abcd',
            created: 1778751138363,
            lastRetrieved: 1778751138363,
          },
        },
      };

      const putResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas.excalidraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify(canvas, null, 2) }),
      });

      expect(putResponse.status).toBe(400);
      expect(await putResponse.json()).toMatchObject({
        error: expect.stringContaining('Unsupported or invalid canvas image data URL'),
      });
      expect(fs.existsSync(canvasPath)).toBe(false);
      expect(fs.existsSync(path.join(
        projectRoot,
        'src',
        'prototypes',
        'home',
        'canvas-assets',
        'images',
        'image-file-1.png',
      ))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('persists prototype embed screenshots under canvas-assets and serves them back', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeScreenshotProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'home');
    const server = await startTestServer(projectRoot);

    try {
      const screenshotPath = path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas-assets', 'screenshot.png');
      const legacyScreenshotPath = path.join(projectRoot, 'src', 'prototypes', 'home', 'screenshot.png');
      expect(fs.existsSync(screenshotPath)).toBe(false);

      const putResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: PNG_DATA_URL,
          width: 320,
          height: 180,
        }),
      });
      const putBody = await putResponse.json();

      expect(putResponse.status).toBe(201);
      expect(putBody).toMatchObject({
        success: true,
        changed: true,
        prototypeId: 'home',
        path: 'src/prototypes/home/canvas-assets/screenshot.png',
        screenshotUrl: expect.stringMatching(/^\/prototypes\/home\/canvas-assets\/screenshot\.png\?v=\d+$/u),
        apiScreenshotUrl: expect.stringMatching(/^\/api\/canvas\/prototypes\/home\/canvas-assets\/screenshot\.png\?v=\d+$/u),
        width: 320,
        height: 180,
      });
      expect(fs.existsSync(screenshotPath)).toBe(true);
      expect(fs.existsSync(legacyScreenshotPath)).toBe(false);
      const written = fs.readFileSync(screenshotPath);
      expect(written.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

      const getResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas-assets/screenshot.png`);
      expect(getResponse.status).toBe(200);
      expect(getResponse.headers.get('content-type')).toBe('image/png');
      expect(Buffer.from(await getResponse.arrayBuffer())).toEqual(written);

      const unchangedResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: PNG_DATA_URL }),
      });
      expect(unchangedResponse.status).toBe(200);
      await expect(unchangedResponse.json()).resolves.toMatchObject({
        success: true,
        changed: false,
        path: 'src/prototypes/home/canvas-assets/screenshot.png',
      });

      const missingResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas-assets/missing.png`);
      expect(missingResponse.status).toBe(404);

      const wrongMethodResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas-assets/screenshot.png`, {
        method: 'POST',
      });
      expect(wrongMethodResponse.status).toBe(405);
    } finally {
      await server.close();
    }
  });

  it('persists canvas-owned embed screenshots with element-specific image files', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeScreenshotProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'ref-tutorial');
    const server = await startTestServer(projectRoot);

    try {
      const elementScreenshotPath = path.join(
        projectRoot,
        'src',
        'prototypes',
        'ref-tutorial',
        'canvas-assets',
        'embed-embed-1.png',
      );
      const latestScreenshotPath = path.join(
        projectRoot,
        'src',
        'prototypes',
        'ref-tutorial',
        'canvas-assets',
        'screenshot.png',
      );
      const legacyLatestScreenshotPath = path.join(projectRoot, 'src', 'prototypes', 'ref-tutorial', 'screenshot.png');
      expect(fs.existsSync(elementScreenshotPath)).toBe(false);
      expect(fs.existsSync(latestScreenshotPath)).toBe(false);

      const putResponse = await fetch(`${server.origin}/api/canvas/prototypes/ref-tutorial/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elementId: 'embed-1',
          dataUrl: PNG_DATA_URL,
          width: 320,
          height: 180,
        }),
      });
      const putBody = await putResponse.json();

      expect(putResponse.status).toBe(201);
      expect(putBody).toMatchObject({
        success: true,
        changed: true,
        prototypeId: 'ref-tutorial',
        fileName: 'embed-embed-1.png',
        path: 'src/prototypes/ref-tutorial/canvas-assets/embed-embed-1.png',
        latestPath: 'src/prototypes/ref-tutorial/canvas-assets/screenshot.png',
        screenshotUrl: expect.stringMatching(/^\/prototypes\/ref-tutorial\/canvas-assets\/embed-embed-1\.png\?v=\d+$/u),
        apiScreenshotUrl: expect.stringMatching(/^\/api\/canvas\/prototypes\/ref-tutorial\/canvas-assets\/embed-embed-1\.png\?v=\d+$/u),
        width: 320,
        height: 180,
      });
      expect(fs.existsSync(elementScreenshotPath)).toBe(true);
      expect(fs.existsSync(latestScreenshotPath)).toBe(true);
      expect(fs.existsSync(legacyLatestScreenshotPath)).toBe(false);

      const written = fs.readFileSync(elementScreenshotPath);
      expect(fs.readFileSync(latestScreenshotPath)).toEqual(written);

      const getResponse = await fetch(`${server.origin}/api/canvas/prototypes/ref-tutorial/canvas-assets/embed-embed-1.png`);
      expect(getResponse.status).toBe(200);
      expect(getResponse.headers.get('content-type')).toBe('image/png');
      expect(Buffer.from(await getResponse.arrayBuffer())).toEqual(written);
    } finally {
      await server.close();
    }
  });

  it('rejects unsafe or non-png prototype screenshots', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeScreenshotProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'home');
    const server = await startTestServer(projectRoot);

    try {
      const escapedResponse = await fetch(`${server.origin}/api/canvas/prototypes/${encodeURIComponent('../outside')}/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: PNG_DATA_URL }),
      });
      expect(escapedResponse.status).toBe(403);

      const jpegResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: 'data:image/jpeg;base64,abcd' }),
      });
      expect(jpegResponse.status).toBe(400);

      const wrongMethodResponse = await fetch(`${server.origin}/api/canvas/prototypes/home/screenshot`);
      expect(wrongMethodResponse.status).toBe(405);

      const missingPrototypeResponse = await fetch(`${server.origin}/api/canvas/prototypes/missing/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: PNG_DATA_URL }),
      });
      expect(missingPrototypeResponse.status).toBe(404);
      expect(fs.existsSync(path.join(projectRoot, 'src', 'outside', 'screenshot.png'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, 'src', 'prototypes', 'home', 'screenshot.png'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('rejects prototype canvas path escapes and missing prototype directories', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'home');
    const server = await startTestServer(projectRoot);

    try {
      const escapedResponse = await fetch(`${server.origin}/api/canvas/prototypes/${encodeURIComponent('../outside')}/ensure`, {
        method: 'POST',
      });
      expect(escapedResponse.status).toBe(403);
      expect(fs.existsSync(path.join(projectRoot, 'src', 'outside', 'canvas.excalidraw'))).toBe(false);

      const missingResponse = await fetch(`${server.origin}/api/canvas/prototypes/missing/ensure`, {
        method: 'POST',
      });
      expect(missingResponse.status).toBe(404);
      expect(fs.existsSync(path.join(projectRoot, 'src', 'prototypes', 'missing', 'canvas.excalidraw'))).toBe(false);

      const invalidEncodedResponse = await fetch(`${server.origin}/api/canvas/prototypes/%E0%A4%A/ensure`, {
        method: 'POST',
      });
      expect(invalidEncodedResponse.status).toBe(400);

      const wrongEnsureMethod = await fetch(`${server.origin}/api/canvas/prototypes/home/ensure`);
      expect(wrongEnsureMethod.status).toBe(405);

      const wrongCanvasMethod = await fetch(`${server.origin}/api/canvas/prototypes/home/canvas.excalidraw`, {
        method: 'DELETE',
      });
      expect(wrongCanvasMethod.status).toBe(405);
    } finally {
      await server.close();
    }
  });

  it('requires declared prototype write targets before persisting screenshots', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    writePrototypeDir(projectRoot, 'home');
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/canvas/prototypes/home/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: PNG_DATA_URL }),
      });

      expect(response.status).toBe(424);
      expect(await response.json()).toEqual({
        error: 'Prototype screenshot persistence requires declared prototype write target',
      });
      expect(fs.existsSync(path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas-assets'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('keeps legacy canvas listing and reading limited to src/canvas excalidraw files', async () => {
    const projectRoot = createTempRoot('axhub-make-canvas-api-');
    writeProjectMetadata(projectRoot);
    const legacyCanvasDir = path.join(projectRoot, 'src', 'canvas');
    fs.mkdirSync(legacyCanvasDir, { recursive: true });
    fs.writeFileSync(path.join(legacyCanvasDir, 'legacy.excalidraw'), JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [{ id: 'legacy' }],
      appState: {},
      files: {},
    }), 'utf8');
    fs.writeFileSync(path.join(legacyCanvasDir, 'old.json'), '{"type":"excalidraw"}', 'utf8');
    const server = await startTestServer(projectRoot);

    try {
      const listResponse = await fetch(`${server.origin}/api/canvas`);
      expect(listResponse.status).toBe(200);
      expect(await listResponse.json()).toEqual([
        expect.objectContaining({
          name: 'legacy.excalidraw',
          displayName: 'legacy',
        }),
      ]);

      const getResponse = await fetch(`${server.origin}/api/canvas/legacy.excalidraw`);
      expect(getResponse.status).toBe(200);
      expect(await getResponse.json()).toMatchObject({
        type: 'excalidraw',
        elements: [{ id: 'legacy' }],
      });

      const jsonResponse = await fetch(`${server.origin}/api/canvas/old.json`);
      expect(jsonResponse.status).toBe(404);
    } finally {
      await server.close();
    }
  });
});
