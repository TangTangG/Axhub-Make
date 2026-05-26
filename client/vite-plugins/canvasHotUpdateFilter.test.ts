import { describe, expect, it, vi } from 'vitest';

import {
  canvasHotUpdateFilterPlugin,
  isCanvasHotUpdateFile,
  shouldDropCanvasFullReloadPayload,
} from './canvasHotUpdateFilter';

async function runConfigureServer(plugin: any, server: any) {
  const hook = plugin.configureServer;
  if (typeof hook === 'function') {
    await hook(server);
  } else {
    await hook?.handler(server);
  }
}

describe('canvasHotUpdateFilterPlugin', () => {
  it('matches canvas data files outside the normal Vite refresh path', () => {
    expect(isCanvasHotUpdateFile('/project/src/prototypes/home/canvas.excalidraw')).toBe(true);
    expect(isCanvasHotUpdateFile('/project/src/prototypes/home/canvas-assets/screenshot.png')).toBe(true);
    expect(isCanvasHotUpdateFile('src/prototypes/home/canvas-assets/embed.png')).toBe(true);
    expect(isCanvasHotUpdateFile('/project/src/prototypes/home/.spec/ai-image-history.json')).toBe(true);
    expect(isCanvasHotUpdateFile('/project/src/prototypes/home/.spec/review.md')).toBe(true);
    expect(isCanvasHotUpdateFile('/project/src/prototypes/home/index.tsx')).toBe(false);
  });

  it('returns an empty hot-update module list for canvas data changes', async () => {
    const plugin = canvasHotUpdateFilterPlugin();
    const handleHotUpdate = plugin.handleHotUpdate as any;

    expect(await handleHotUpdate({
      file: '/project/src/prototypes/home/canvas.excalidraw',
      modules: [{ id: 'canvas' }],
    })).toEqual([]);
    expect(await handleHotUpdate({
      file: '/project/src/prototypes/home/canvas-assets/screenshot.png',
      modules: [{ id: 'screenshot' }],
    })).toEqual([]);
    expect(await handleHotUpdate({
      file: '/project/src/prototypes/home/.spec/ai-image-history.json',
      modules: [{ id: 'history' }],
    })).toEqual([]);
    expect(await handleHotUpdate({
      file: '/project/src/prototypes/home/index.tsx',
      modules: [{ id: 'index' }],
    })).toBeUndefined();
  });

  it('drops Vite full reload payloads caused by canvas data files', async () => {
    const hotSend = vi.fn();
    const wsSend = vi.fn();
    const server = {
      hot: { send: hotSend },
      ws: { send: wsSend },
    };
    const plugin = canvasHotUpdateFilterPlugin();

    await runConfigureServer(plugin, server);

    server.hot.send({
      type: 'full-reload',
      triggeredBy: '/project/src/prototypes/home/canvas.excalidraw',
    });
    server.ws.send({
      type: 'full-reload',
      triggeredBy: '/project/src/prototypes/home/canvas-assets/screenshot.png',
    });
    server.hot.send({
      type: 'full-reload',
      triggeredBy: '/project/src/prototypes/home/.spec/review.md',
    });

    expect(hotSend).not.toHaveBeenCalled();
    expect(wsSend).not.toHaveBeenCalled();

    server.hot.send({
      type: 'full-reload',
      triggeredBy: '/project/src/prototypes/home/index.tsx',
    });
    server.ws.send('custom:event', { ok: true });

    expect(hotSend).toHaveBeenCalledTimes(1);
    expect(wsSend).toHaveBeenCalledTimes(1);
  });

  it('identifies only canvas-triggered full reload payloads as droppable', () => {
    expect(shouldDropCanvasFullReloadPayload({
      type: 'full-reload',
      triggeredBy: '/project/src/prototypes/home/canvas.excalidraw',
    })).toBe(true);
    expect(shouldDropCanvasFullReloadPayload({
      type: 'full-reload',
      path: '/project/src/prototypes/home/canvas-assets/screenshot.png',
    })).toBe(true);
    expect(shouldDropCanvasFullReloadPayload({
      type: 'full-reload',
      triggeredBy: '/project/src/prototypes/home/.spec/ai-image-history.json',
    })).toBe(true);
    expect(shouldDropCanvasFullReloadPayload({
      type: 'full-reload',
      triggeredBy: '/project/src/prototypes/home/index.tsx',
    })).toBe(false);
    expect(shouldDropCanvasFullReloadPayload({
      type: 'update',
      triggeredBy: '/project/src/prototypes/home/canvas.excalidraw',
    } as any)).toBe(false);
  });
});
