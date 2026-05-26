import { normalizePath, type HMRPayload, type Plugin, type ViteDevServer } from 'vite';

type SendFunction = (...args: any[]) => void;

const CANVAS_ASSETS_SEGMENT = '/canvas-assets/';
const SPEC_SEGMENT = '/.spec/';

export function isCanvasHotUpdateFile(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return (
    normalized.endsWith('.excalidraw')
    || normalized.includes(CANVAS_ASSETS_SEGMENT)
    || normalized.includes(SPEC_SEGMENT)
  );
}

function extractPayloadPath(payload: HMRPayload): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  if ('triggeredBy' in payload && typeof payload.triggeredBy === 'string') {
    return payload.triggeredBy;
  }
  if ('path' in payload && typeof payload.path === 'string') {
    return payload.path;
  }
  return null;
}

export function shouldDropCanvasFullReloadPayload(payload: HMRPayload): boolean {
  if (!payload || typeof payload !== 'object' || payload.type !== 'full-reload') {
    return false;
  }
  const payloadPath = extractPayloadPath(payload);
  return payloadPath ? isCanvasHotUpdateFile(payloadPath) : false;
}

function patchSend(target: { send?: SendFunction } | null | undefined): void {
  if (!target || typeof target.send !== 'function') {
    return;
  }
  const originalSend = target.send.bind(target);
  target.send = ((...args: any[]) => {
    const payload = args[0];
    if (shouldDropCanvasFullReloadPayload(payload)) {
      return;
    }
    return originalSend(...args);
  }) as SendFunction;
}

export function installCanvasFullReloadFilter(server: Pick<ViteDevServer, 'hot' | 'ws'>): void {
  patchSend(server.hot as unknown as { send?: SendFunction });
  patchSend(server.ws as unknown as { send?: SendFunction });
}

export function canvasHotUpdateFilterPlugin(): Plugin {
  return {
    name: 'axhub-canvas-hot-update-filter',
    apply: 'serve',
    enforce: 'pre',

    configureServer(server) {
      installCanvasFullReloadFilter(server);
    },

    handleHotUpdate(ctx) {
      if (isCanvasHotUpdateFile(ctx.file)) {
        return [];
      }
      return undefined;
    },
  };
}
