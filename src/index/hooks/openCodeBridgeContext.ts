import type { BridgeContextItem } from '../types/opencode-bridge.types';
import type { CanvasItem, ItemData, ViewMode } from '../types';
import type { ResourceSection, SidebarTab, ThemeResourceItem } from '../types/index-page.types';
import type { CanvasElementContextInfo } from '../components/content/canvas-embeds/AnnotationOverlay';

export const CONTEXT_ID_CURRENT_FILE = 'axhub:current-file';
export const CONTEXT_COMMENT_CURRENT_FILE = '当前文件';

export interface OpenCodeCurrentFileContextParams {
    selectedItem: ItemData | null;
    selectedDoc: ItemData | null;
    selectedCanvas: CanvasItem | null;
    selectedTheme?: ThemeResourceItem | null;
    resourceSection?: ResourceSection;
    sidebarTab: SidebarTab;
    viewMode: ViewMode;
}

export function resolveOpenCodeCurrentFilePath(params: OpenCodeCurrentFileContextParams): string {
    const {
        selectedItem,
        selectedDoc,
        selectedCanvas,
        selectedTheme,
        resourceSection = 'themes',
        sidebarTab,
        viewMode,
    } = params;

    if (sidebarTab === 'document') {
        if (!selectedDoc) return '';
        return normalizePath(selectedDoc.filePath) || normalizePath(selectedDoc.absoluteFilePath) || '';
    }

    if (sidebarTab === 'canvas') {
        if (!selectedCanvas) return '';
        const canvasPath = normalizePath((selectedCanvas as any).filePath)
            || normalizePath((selectedCanvas as any).absoluteFilePath);
        if (canvasPath) return canvasPath;
        return selectedCanvas.name ? `canvas/${selectedCanvas.name}.excalidraw` : '';
    }

    if (sidebarTab === 'assets') {
        if (resourceSection === 'themes') {
            return resolveThemePath(selectedTheme);
        }
        return '';
    }

    if (sidebarTab === 'prototype') {
        if (!selectedItem) return '';
        const basePath = resolvePrototypeBasePath(selectedItem);
        if (!basePath) return '';

        if (viewMode === 'canvas') {
            return `${basePath}/canvas.excalidraw`;
        }

        return ensureIndexFile(basePath);
    }

    return '';
}

export function resolveOpenCodeCurrentFileContext(params: OpenCodeCurrentFileContextParams): BridgeContextItem | null {
    const path = resolveOpenCodeCurrentFilePath(params);
    if (!path) return null;

    return {
        id: CONTEXT_ID_CURRENT_FILE,
        type: 'file',
        path,
        comment: CONTEXT_COMMENT_CURRENT_FILE,
        preview: resolveDisplayName(params) || path.split('/').pop() || '',
    };
}

export function resolveOpenCodeCanvasAnnotationContext(
    annotation: CanvasElementContextInfo,
    currentFilePath: string,
): BridgeContextItem | null {
    const elementId = String(annotation?.elementId || '').trim();
    const body = String(annotation?.annotation || '').trim();
    const path = normalizePath(currentFilePath);
    if (!elementId || !body || !path) return null;

    const id = `axhub:canvas-annotation:${elementId}`;
    const preview = String(annotation?.title || annotation?.type || elementId).trim();

    return {
        id,
        type: 'file',
        path,
        comment: `标注: ${body}`,
        commentID: id,
        commentOrigin: 'file',
        ...(preview ? { preview } : {}),
    };
}

function normalizePath(value: unknown): string {
    return typeof value === 'string' ? value.trim().replace(/\\/g, '/') : '';
}

function toProjectRelative(value: string): string {
    const normalized = normalizePath(value);
    const srcIndex = normalized.indexOf('src/');
    return srcIndex >= 0 ? normalized.slice(srcIndex) : normalized;
}

function stripIndexFile(value: string): string {
    return value.replace(/\/index\.(t|j)sx?$/i, '');
}

function ensureIndexFile(value: string): string {
    const normalized = normalizePath(value);
    if (!normalized) return '';
    if (/\/index\.(t|j)sx?$/i.test(normalized)) return normalized;
    if (/\.(t|j)sx?$/i.test(normalized)) return normalized;
    return `${normalized.replace(/\/+$/g, '')}/index.tsx`;
}

function resolvePrototypeBasePath(item: ItemData): string {
    const explicitPath = normalizePath(item.filePath) || normalizePath(item.absoluteFilePath);
    if (!explicitPath) return '';
    return stripIndexFile(toProjectRelative(explicitPath));
}

function resolveThemePath(theme: ThemeResourceItem | null | undefined): string {
    if (!theme) return '';
    const explicitPath = normalizePath(theme.path) || normalizePath(theme.absoluteFilePath);
    if (explicitPath) {
        return ensureIndexFile(toProjectRelative(explicitPath));
    }
    return '';
}

function resolveDisplayName(params: OpenCodeCurrentFileContextParams): string {
    const { selectedItem, selectedDoc, selectedCanvas, selectedTheme, resourceSection = 'themes', sidebarTab } = params;
    if (sidebarTab === 'document') {
        return selectedDoc?.displayName || selectedDoc?.name || '';
    }
    if (sidebarTab === 'canvas') {
        return selectedCanvas?.displayName || selectedCanvas?.name || '';
    }
    if (sidebarTab === 'assets' && resourceSection === 'themes') {
        return selectedTheme?.displayName || selectedTheme?.name || '';
    }
    return selectedItem?.displayName || selectedItem?.name || '';
}
