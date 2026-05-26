import type { CanvasItem, ItemData } from '../../types';

const CANVAS_EXTENSION = '.excalidraw';

function normalizePath(value: unknown): string {
    return typeof value === 'string' ? value.trim().replace(/\\/g, '/') : '';
}

function toProjectRelativePath(value: string): string {
    const normalized = normalizePath(value);
    const srcIndex = normalized.indexOf('src/');
    return srcIndex >= 0 ? normalized.slice(srcIndex) : normalized;
}

function stripFileName(value: string): string {
    return normalizePath(value).replace(/\/[^/]+\.(t|j)sx?$/i, '');
}

function stripIndexFile(value: string): string {
    return normalizePath(value).replace(/\/index\.(t|j)sx?$/i, '');
}

function ensureCanvasExtension(value: string): string {
    const normalized = normalizePath(value);
    if (!normalized) return '';
    return normalized.endsWith(CANVAS_EXTENSION) ? normalized : `${normalized}${CANVAS_EXTENSION}`;
}

function resolveCanvasNamePath(canvasName?: string): string {
    const normalized = ensureCanvasExtension(canvasName || '');
    if (!normalized) return '';
    if (normalized.startsWith('src/')) return normalized;
    if (normalized.startsWith('prototypes/')) return `src/${normalized}`;
    if (normalized.startsWith('canvas/')) return `src/${normalized}`;
    return `src/canvas/${normalized.replace(/^\/+/g, '')}`;
}

function getExplicitCanvasItemPath(item: unknown): string {
    if (!item || typeof item !== 'object') return '';
    const record = item as {
        filePath?: unknown;
        absoluteFilePath?: unknown;
        path?: unknown;
    };
    return normalizePath(record.filePath)
        || normalizePath(record.absoluteFilePath)
        || normalizePath(record.path);
}

export function resolvePrototypeCanvasFilePath(item: ItemData | null | undefined, canvasName?: string): string {
    const explicitPath = getExplicitCanvasItemPath(item);
    if (explicitPath) {
        const relativePath = toProjectRelativePath(explicitPath);
        const basePath = /\/index\.(t|j)sx?$/i.test(relativePath)
            ? stripIndexFile(relativePath)
            : stripFileName(relativePath) || relativePath.replace(/\/+$/g, '');
        if (basePath.endsWith(CANVAS_EXTENSION)) return basePath;
        return `${basePath}/canvas${CANVAS_EXTENSION}`;
    }

    return resolveCanvasNamePath(canvasName || (item?.name ? `prototypes/${item.name}/canvas${CANVAS_EXTENSION}` : ''));
}

export function resolveCanvasFilePath(canvas: CanvasItem | null | undefined, canvasName?: string): string {
    const explicitPath = getExplicitCanvasItemPath(canvas);
    if (explicitPath) {
        return toProjectRelativePath(explicitPath);
    }

    return resolveCanvasNamePath(canvasName || canvas?.name || '');
}
