import { normalizePath, type HMRPayload, type HmrContext, type Plugin, type ViteDevServer } from 'vite';

type SendFunction = (...args: any[]) => void;

const CANVAS_ASSETS_SEGMENT = '/canvas-assets/';
const SPEC_SEGMENT = '/.spec/';
const ANNOTATION_SOURCE_FILE_NAME = '/annotation-source.json';

function cleanHotUpdatePath(filePath: string): string {
  return normalizePath(filePath).split(/[?#]/u)[0] || '';
}

export function isCanvasHotUpdateFile(filePath: string): boolean {
  const normalized = cleanHotUpdatePath(filePath);
  return (
    normalized.endsWith('.excalidraw')
    || normalized.endsWith(ANNOTATION_SOURCE_FILE_NAME)
    || normalized.includes(CANVAS_ASSETS_SEGMENT)
    || normalized.includes(SPEC_SEGMENT)
  );
}

function isAnnotationSourceHotUpdateFile(filePath: string): boolean {
  return cleanHotUpdatePath(filePath).endsWith(ANNOTATION_SOURCE_FILE_NAME);
}

function invalidateHotUpdateModules(ctx: HmrContext): void {
  const moduleGraph = ctx.server?.moduleGraph;
  if (!moduleGraph) return;
  for (const module of ctx.modules) {
    moduleGraph.invalidateModule(module, undefined, ctx.timestamp, true);
  }
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

function isCanvasUpdateRecord(update: unknown): boolean {
  if (!update || typeof update !== 'object') {
    return false;
  }
  const record = update as { path?: unknown; acceptedPath?: unknown };
  return [record.path, record.acceptedPath].some((value) => (
    typeof value === 'string' && isCanvasHotUpdateFile(value)
  ));
}

function filterCanvasUpdatePayload(payload: HMRPayload): HMRPayload | null {
  if (!payload || typeof payload !== 'object' || payload.type !== 'update' || !Array.isArray((payload as any).updates)) {
    return payload;
  }
  const updates = (payload as any).updates.filter((update: unknown) => !isCanvasUpdateRecord(update));
  if (updates.length === 0) {
    return null;
  }
  if (updates.length === (payload as any).updates.length) {
    return payload;
  }
  return {
    ...(payload as any),
    updates,
  } as HMRPayload;
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
    const filteredPayload = filterCanvasUpdatePayload(payload);
    if (!filteredPayload) {
      return;
    }
    if (filteredPayload !== payload) {
      return originalSend(filteredPayload, ...args.slice(1));
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
        if (isAnnotationSourceHotUpdateFile(ctx.file)) {
          invalidateHotUpdateModules(ctx);
        }
        return [];
      }
      return undefined;
    },
  };
}
