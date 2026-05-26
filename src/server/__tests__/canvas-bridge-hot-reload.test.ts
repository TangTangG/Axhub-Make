import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FSWatcher } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasBridgeHub, isCanvasBridgeUpgrade } from '../canvasBridge.ts';

class FakeSocket extends EventEmitter {
  readonly sentMessages: any[] = [];
  readonly rawFrames: Array<{ opcode: number; payload: Buffer }> = [];
  ended = false;

  write(chunk: Buffer | string): boolean {
    if (Buffer.isBuffer(chunk)) {
      for (const frame of parseServerFrames(chunk)) {
        if (frame.opcode === 0x01) {
          this.sentMessages.push(JSON.parse(frame.payload.toString('utf8')));
        } else {
          this.rawFrames.push(frame);
        }
      }
    }
    return true;
  }

  end(): void {
    this.ended = true;
    this.emit('close');
  }
}

class FakeFsWatcher extends EventEmitter {
  closed = false;

  close(): void {
    this.closed = true;
  }
}

function encodeClientTextFrame(message: any): Buffer {
  const payload = Buffer.from(JSON.stringify(message), 'utf8');
  return encodeClientFrame(0x01, payload);
}

function encodeClientFrame(opcode: number, payload = Buffer.alloc(0)): Buffer {
  const mask = Buffer.from([1, 2, 3, 4]);
  let header: Buffer;
  if (payload.length < 126) {
    header = Buffer.from([0x80 | opcode, 0x80 | payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

function parseServerFrames(buffer: Buffer): Array<{ opcode: number; payload: Buffer }> {
  const frames: Array<{ opcode: number; payload: Buffer }> = [];
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
    frames.push({ opcode, payload: buffer.subarray(offset + headerLength, frameEnd) });
    offset = frameEnd;
  }
  return frames;
}

function registerClient(hub: CanvasBridgeHub, canvas: string, dirty = false): FakeSocket {
  const socket = new FakeSocket();
  hub.handleUpgrade({
    headers: {
      'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
    },
  } as any, socket as any, Buffer.alloc(0));
  socket.emit('data', encodeClientTextFrame({ type: 'canvas.register', canvas, dirty }));
  return socket;
}

function getSocketClientId(socket: FakeSocket): string {
  return String(socket.sentMessages.find((message) => message.type === 'hello')?.payload?.clientId || '');
}

function countReloadMessages(socket: FakeSocket): number {
  return socket.sentMessages.filter((message) => message.type === 'canvas.reload').length;
}

function findLastSentMessage(socket: FakeSocket, type: string): any {
  return [...socket.sentMessages].reverse().find((message) => message.type === type);
}

function writeCanvasFile(filePath: string, marker: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({
    type: 'excalidraw',
    version: 2,
    elements: [{ id: marker, type: 'rectangle' }],
    appState: {},
    files: {},
  }, null, 2), 'utf8');
}

function createProjectRoot(): { projectRoot: string; canvasPath: string; alternateCanvasPath: string } {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axhub-canvas-bridge-'));
  const canvasPath = path.join(projectRoot, 'src', 'prototypes', 'home', 'canvas.excalidraw');
  const alternateCanvasPath = path.join(projectRoot, 'src', 'prototypes', 'about', 'canvas.excalidraw');
  writeCanvasFile(canvasPath, 'initial');
  writeCanvasFile(alternateCanvasPath, 'alternate');
  return { projectRoot, canvasPath, alternateCanvasPath };
}

describe('CanvasBridgeHub hot reload watcher lifecycle', () => {
  let projectRoots: string[] = [];
  let watchers: FakeFsWatcher[] = [];
  let watchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    projectRoots = [];
    watchers = [];
    watchSpy = vi.spyOn(fs, 'watch').mockImplementation((() => {
      const watcher = new FakeFsWatcher();
      watchers.push(watcher);
      return watcher as unknown as FSWatcher;
    }) as typeof fs.watch);
  });

  afterEach(() => {
    vi.useRealTimers();
    watchSpy.mockRestore();
    for (const root of projectRoots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function createHub() {
    const { projectRoot, canvasPath, alternateCanvasPath } = createProjectRoot();
    projectRoots.push(projectRoot);
    const refreshes: string[] = [];
    const hub = new CanvasBridgeHub({
      projectRoot,
      refreshQuietMs: 2000,
      refreshMaxWaitMs: 8000,
      onExternalCanvasRefresh: (canvasName) => {
        refreshes.push(canvasName);
      },
    });
    return { hub, canvasPath, alternateCanvasPath, refreshes };
  }

  it('starts watching a prototype canvas only after registration and closes after the last client leaves', () => {
    const { hub, canvasPath } = createHub();

    expect(watchSpy).not.toHaveBeenCalled();

    const first = registerClient(hub, 'prototypes/home/canvas.excalidraw');
    expect(watchSpy).toHaveBeenCalledTimes(1);
    expect(watchSpy.mock.calls[0][0]).toBe(canvasPath);
    expect(hub.getActiveCanvasWatchers()).toEqual([{
      canvas: 'prototypes/home/canvas',
      filePath: canvasPath,
      refCount: 1,
      dirtyClientCount: 0,
    }]);

    const second = registerClient(hub, 'prototypes/home/canvas');
    expect(watchSpy).toHaveBeenCalledTimes(1);
    expect(hub.getActiveCanvasWatchers()[0].refCount).toBe(2);

    first.end();
    expect(watchers[0].closed).toBe(false);
    expect(hub.getActiveCanvasWatchers()[0].refCount).toBe(1);

    second.end();
    expect(watchers[0].closed).toBe(true);
    expect(hub.getActiveCanvasWatchers()).toEqual([]);

    hub.destroy();
  });

  it('moves a client watcher when the client registers a different prototype canvas', () => {
    const { hub, canvasPath, alternateCanvasPath } = createHub();
    const socket = registerClient(hub, 'prototypes/home/canvas');

    expect(hub.getActiveCanvasWatchers()).toEqual([{
      canvas: 'prototypes/home/canvas',
      filePath: canvasPath,
      refCount: 1,
      dirtyClientCount: 0,
    }]);

    socket.emit('data', encodeClientTextFrame({
      type: 'canvas.register',
      canvas: 'prototypes/about/canvas',
      dirty: false,
    }));

    expect(watchSpy).toHaveBeenCalledTimes(2);
    expect(watchers[0].closed).toBe(true);
    expect(watchers[1].closed).toBe(false);
    expect(hub.getActiveCanvasWatchers()).toEqual([{
      canvas: 'prototypes/about/canvas',
      filePath: alternateCanvasPath,
      refCount: 1,
      dirtyClientCount: 0,
    }]);

    hub.destroy();
  });

  it('closes active watchers when the active project root changes', () => {
    const { hub } = createHub();
    registerClient(hub, 'prototypes/home/canvas');
    expect(hub.getActiveCanvasWatchers()).toHaveLength(1);

    const { projectRoot: nextProjectRoot } = createProjectRoot();
    projectRoots.push(nextProjectRoot);
    hub.configureProjectRoot(nextProjectRoot);

    expect(watchers[0].closed).toBe(true);
    expect(hub.getActiveCanvasWatchers()).toEqual([]);

    hub.destroy();
  });

  it('ignores standalone src/canvas registrations for hot reload watching', () => {
    const { hub } = createHub();

    registerClient(hub, 'legacy.excalidraw');
    registerClient(hub, 'canvas/legacy.excalidraw');

    expect(watchSpy).not.toHaveBeenCalled();
    expect(hub.getActiveCanvasWatchers()).toEqual([]);

    hub.destroy();
  });

  it('suppresses make-server saves by hash and refreshes stable external writes once', async () => {
    const { hub, canvasPath, refreshes } = createHub();
    registerClient(hub, 'prototypes/home/canvas.excalidraw');

    writeCanvasFile(canvasPath, 'server-save');
    hub.recordCanvasSave(canvasPath, fs.readFileSync(canvasPath, 'utf8'));
    watchers[0].emit('change', 'change');

    await vi.advanceTimersByTimeAsync(9000);
    expect(refreshes).toEqual([]);

    writeCanvasFile(canvasPath, 'external-1');
    watchers[0].emit('change', 'change');
    await vi.advanceTimersByTimeAsync(1000);
    writeCanvasFile(canvasPath, 'external-2');
    watchers[0].emit('change', 'change');
    await vi.advanceTimersByTimeAsync(1999);
    expect(refreshes).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(refreshes).toEqual(['prototypes/home/canvas']);

    await vi.advanceTimersByTimeAsync(9000);
    expect(refreshes).toEqual(['prototypes/home/canvas']);

    hub.destroy();
  });

  it('broadcasts make-server canvas saves to other clean clients without echoing the watcher event', async () => {
    const { hub, canvasPath } = createHub();
    const source = registerClient(hub, 'prototypes/home/canvas.excalidraw', true);
    const other = registerClient(hub, 'prototypes/home/canvas.excalidraw');
    const otherCanvas = registerClient(hub, 'prototypes/about/canvas.excalidraw');

    writeCanvasFile(canvasPath, 'server-save');
    hub.recordCanvasSave(canvasPath, fs.readFileSync(canvasPath, 'utf8'), {
      sourceClientId: getSocketClientId(source),
    });

    expect(countReloadMessages(source)).toBe(0);
    expect(countReloadMessages(other)).toBe(1);
    expect(countReloadMessages(otherCanvas)).toBe(0);

    watchers[0].emit('change', 'change');
    await vi.advanceTimersByTimeAsync(9000);
    expect(countReloadMessages(other)).toBe(1);

    hub.destroy();
  });

  it('does not refresh while any same-canvas client is dirty', async () => {
    const { hub, canvasPath, refreshes } = createHub();
    registerClient(hub, 'prototypes/home/canvas.excalidraw', true);

    writeCanvasFile(canvasPath, 'dirty-skip');
    watchers[0].emit('change', 'change');
    await vi.advanceTimersByTimeAsync(2500);
    expect(refreshes).toEqual([]);

    hub.destroy();
  });

  it('defers a stable external write while dirty and refreshes when the canvas becomes clean', async () => {
    const { hub, canvasPath, refreshes } = createHub();
    const socket = registerClient(hub, 'prototypes/home/canvas.excalidraw', true);

    writeCanvasFile(canvasPath, 'deferred-external');
    watchers[0].emit('change', 'change');
    await vi.advanceTimersByTimeAsync(2500);
    expect(refreshes).toEqual([]);

    socket.emit('data', encodeClientTextFrame({
      type: 'canvas.status',
      canvas: 'prototypes/home/canvas.excalidraw',
      dirty: false,
    }));

    expect(refreshes).toEqual(['prototypes/home/canvas']);
    hub.destroy();
  });

  it('sends refresh requests to every matching registered canvas client', () => {
    const { hub } = createHub();
    const first = registerClient(hub, 'prototypes/home/canvas.excalidraw');
    const second = registerClient(hub, 'src/prototypes/home/canvas.excalidraw');
    const other = registerClient(hub, 'prototypes/about/canvas.excalidraw');

    expect(hub.requestRefresh('prototypes/home/canvas')).toBe(true);
    expect(first.sentMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'canvas.reload' }),
    ]));
    expect(second.sentMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'canvas.reload' }),
    ]));
    expect(other.sentMessages).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'canvas.reload' }),
    ]));

    expect(hub.requestRefresh('missing')).toBe(false);
    hub.destroy();
  });

  it('resolves and rejects screenshot requests from canvas response frames', async () => {
    const { hub } = createHub();
    const socket = registerClient(hub, 'prototypes/home/canvas');

    const screenshot = hub.requestScreenshot('prototypes/home/canvas');
    const request = socket.sentMessages.find((message) => message.type === 'canvas.screenshot.request');
    expect(request?.requestId).toMatch(/^ss-/u);
    socket.emit('data', encodeClientTextFrame({
      type: 'canvas.screenshot.response',
      requestId: request.requestId,
      dataUrl: 'data:image/png;base64,abc',
    }));
    await expect(screenshot).resolves.toBe('data:image/png;base64,abc');

    const failed = hub.requestScreenshot('prototypes/home/canvas');
    const failedRequest = findLastSentMessage(socket, 'canvas.screenshot.request');
    socket.emit('data', encodeClientTextFrame({
      type: 'canvas.screenshot.response',
      requestId: failedRequest.requestId,
      error: 'canvas hidden',
    }));
    await expect(failed).rejects.toThrow('canvas hidden');

    const empty = hub.requestScreenshot('prototypes/home/canvas');
    const emptyRequest = findLastSentMessage(socket, 'canvas.screenshot.request');
    socket.emit('data', encodeClientTextFrame({
      type: 'canvas.screenshot.response',
      requestId: emptyRequest.requestId,
    }));
    await expect(empty).rejects.toThrow('Empty screenshot response');

    await expect(hub.requestScreenshot('missing')).rejects.toThrow('No canvas browser connected');
    hub.destroy();
  });

  it('responds to ping frames and ignores malformed text frames without dropping the client', () => {
    const { hub } = createHub();
    const socket = registerClient(hub, 'prototypes/home/canvas');
    const beforeCount = hub.clientCount;

    socket.emit('data', encodeClientTextFrame({ type: 'ping' }));
    socket.emit('data', encodeClientTextFrame('not-json'));

    expect(beforeCount).toBe(1);
    expect(hub.clientCount).toBe(1);
    expect(socket.sentMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'pong' }),
    ]));
    hub.destroy();
  });

  it('handles websocket control frames, extended client frames, and screenshot timeouts', async () => {
    const { hub } = createHub();
    const socket = registerClient(hub, 'prototypes/home/canvas');

    socket.emit('data', encodeClientFrame(0x09, Buffer.from('still-here')));
    expect(socket.rawFrames).toEqual(expect.arrayContaining([
      expect.objectContaining({
        opcode: 0x0a,
        payload: Buffer.from('still-here'),
      }),
    ]));

    socket.emit('data', encodeClientTextFrame({
      type: 'canvas.register',
      canvas: `manual-${'x'.repeat(140)}`,
    }));
    expect(hub.getConnectedCanvases()[0].canvas).toContain('manual-');

    socket.emit('data', encodeClientTextFrame({
      type: 'canvas.status',
      dirty: true,
      payload: 'x'.repeat(66_000),
    }));
    expect(hub.getConnectedCanvases()[0].dirty).toBe(true);

    const screenshot = hub.requestScreenshot();
    expect(socket.sentMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'canvas.screenshot.request' }),
    ]));
    const screenshotExpectation = expect(screenshot).rejects.toThrow('Screenshot request timed out');
    await vi.advanceTimersByTimeAsync(15_000);
    await screenshotExpectation;

    socket.emit('data', encodeClientFrame(0x0a, Buffer.from('heartbeat')));
    socket.emit('data', encodeClientFrame(0x08));
    expect(hub.clientCount).toBe(0);
    hub.destroy();
  });

  it('rejects upgrades without a WebSocket key and matches only the canvas bridge path', () => {
    const hub = new CanvasBridgeHub();
    const socket = new FakeSocket();

    hub.handleUpgrade({ headers: {} } as any, socket as any, Buffer.alloc(0));

    expect(socket.ended).toBe(true);
    expect(isCanvasBridgeUpgrade({ url: '/ws/canvas-bridge?client=1' } as any)).toBe(true);
    expect(isCanvasBridgeUpgrade({ url: '/ws' } as any)).toBe(false);
    expect(isCanvasBridgeUpgrade({ url: '' } as any)).toBe(false);
    hub.destroy();
  });
});
