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

function ensureCanvasExtension(value: string): string {
    const normalized = normalizePath(value);
    if (!normalized) return '';
    return normalized.endsWith(CANVAS_EXTENSION) ? normalized : `${normalized}${CANVAS_EXTENSION}`;
}

function resolveCanvasNamePath(canvasName?: string): string {
    const normalized = ensureCanvasExtension(canvasName || '');
    if (!normalized) return '';
    if (normalized.startsWith('src/resources/')) return normalized;
    if (normalized.startsWith('src/')) return '';
    if (normalized.startsWith('prototypes/')) return '';
    if (normalized.startsWith('canvas/')) return '';
    return `src/resources/${normalized.replace(/^\/+/g, '')}`;
}

function getExplicitCanvasItemPath(item: unknown): string {
    if (!item || typeof item !== 'object') return '';
    const record = item as {
        canvasFilePath?: unknown;
        absoluteCanvasFilePath?: unknown;
        filePath?: unknown;
        absoluteFilePath?: unknown;
        path?: unknown;
    };
    return normalizePath(record.canvasFilePath)
        || normalizePath(record.absoluteCanvasFilePath)
        || normalizePath(record.filePath)
        || normalizePath(record.absoluteFilePath)
        || normalizePath(record.path);
}

export function resolvePrototypeCanvasFilePath(item: ItemData | null | undefined, canvasName?: string): string {
    const explicitPath = getExplicitCanvasItemPath(item);
    if (explicitPath) {
        const relativePath = toProjectRelativePath(explicitPath);
        if (!relativePath.startsWith('src/resources/')) return '';
        if (relativePath.endsWith(CANVAS_EXTENSION)) return relativePath;
        return '';
    }

    return resolveCanvasNamePath(canvasName || '');
}

export function resolveCanvasFilePath(canvas: CanvasItem | null | undefined, canvasName?: string): string {
    const explicitPath = getExplicitCanvasItemPath(canvas);
    if (explicitPath) {
        const relativePath = toProjectRelativePath(explicitPath);
        return relativePath.startsWith('src/resources/') && relativePath.endsWith(CANVAS_EXTENSION)
            ? relativePath
            : '';
    }

    return resolveCanvasNamePath(canvasName || canvas?.name || '');
}
