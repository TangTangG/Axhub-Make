import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

describe('make-server canvas hot-update filter', () => {
  it('identifies canvas data files', () => {
    expect(isCanvasHotUpdateFile('/project/src/prototypes/home/canvas.excalidraw')).toBe(true);
    expect(isCanvasHotUpdateFile('/project/src/prototypes/home/canvas-assets/screenshot.png')).toBe(true);
    expect(isCanvasHotUpdateFile('/project/src/prototypes/home/.spec/ai-image-history.json')).toBe(true);
    expect(isCanvasHotUpdateFile('/project/src/prototypes/home/.spec/ai-image-assets/image-1.png')).toBe(true);
    expect(isCanvasHotUpdateFile('/project/client/src/prototypes/home/index.tsx')).toBe(false);
    expect(isCanvasHotUpdateFile('/project/client/src/themes/brand/index.tsx')).toBe(false);
    expect(isCanvasHotUpdateFile('/project/src/index/index.tsx')).toBe(false);
  });

  it('filters canvas data changes from Vite hot-update handling', async () => {
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
      file: '/project/client/src/prototypes/home/index.tsx',
      modules: [{ id: 'generated-prototype' }],
    })).toBeUndefined();
    expect(await handleHotUpdate({
      file: '/project/src/index/index.tsx',
      modules: [{ id: 'admin' }],
    })).toBeUndefined();
  });

  it('drops full reload payloads triggered by canvas data files', async () => {
    const hotSend = vi.fn();
    const server = {
      hot: { send: hotSend },
      ws: { send: vi.fn() },
    };
    const plugin = canvasHotUpdateFilterPlugin();

    await runConfigureServer(plugin, server);

    server.hot.send({
      type: 'full-reload',
      triggeredBy: '/project/src/prototypes/home/canvas.excalidraw',
    });
    expect(hotSend).not.toHaveBeenCalled();

    server.hot.send({
      type: 'full-reload',
      triggeredBy: '/project/src/prototypes/home/.spec/ai-image-history.json',
    });
    expect(hotSend).not.toHaveBeenCalled();

    server.hot.send({
      type: 'full-reload',
      triggeredBy: '/project/client/src/prototypes/home/index.tsx',
    });
    expect(hotSend).toHaveBeenCalledTimes(1);

    server.hot.send({
      type: 'full-reload',
      triggeredBy: '/project/src/index/index.tsx',
    });
    expect(hotSend).toHaveBeenCalledTimes(2);
  });

  it('does not drop non-reload payloads even when they mention canvas files', () => {
    expect(shouldDropCanvasFullReloadPayload({
      type: 'update',
      triggeredBy: '/project/src/prototypes/home/canvas.excalidraw',
    } as any)).toBe(false);
  });

  it('installs the filter in the standalone admin Vite config', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');

    expect(viteConfigSource).toContain("import { canvasHotUpdateFilterPlugin } from './src/server/canvasHotUpdateFilter'");
    expect(viteConfigSource).toContain('canvasHotUpdateFilterPlugin()');
    expect(viteConfigSource).toContain("'**/client/**'");
  });

  it('keeps the standalone admin dev server on its configured port', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');

    expect(viteConfigSource).toContain('strictPort: true');
    expect(viteConfigSource).not.toContain('strictPort: false');
  });

  it('releases the standalone admin dev port before Vite starts listening', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');

    expect(viteConfigSource).toContain("import { releaseListeningProcessesOnPort } from './src/server/portOccupancy'");
    expect(viteConfigSource).toContain('portReleaseBeforeListenPlugin()');
    expect(viteConfigSource).toContain('!config.server.middlewareMode');
    expect(viteConfigSource).toContain('releaseListeningProcessesOnPort(config.server.port ?? DEFAULT_MAKE_SERVER_PORT)');
  });
});
