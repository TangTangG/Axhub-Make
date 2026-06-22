import type { AcpContextItem } from './assistantAcpContext';

export type AssistantResourceContextType =
    | 'prototype'
    | 'prototype-page'
    | 'doc'
    | 'resource'
    | 'template'
    | 'theme'
    | 'canvas'
    | 'drawio'
    | 'image'
    | 'data';

export interface AssistantResourceContextInput {
    resourceType: AssistantResourceContextType;
    resourceId?: string;
    pageId?: string;
    name?: string;
    displayName?: string;
    filePath?: string;
    absoluteFilePath?: string;
    path?: string;
    mimeType?: string;
    metadata?: Record<string, unknown>;
}

export interface AssistantCanvasElementContextInput {
    elementId: string;
    type: string;
    annotation?: string;
    title?: string;
    link?: string;
    width: number;
    height: number;
    resourceType?: AssistantResourceContextType | 'preview';
    resourceId?: string;
    filePath?: string;
    absoluteFilePath?: string;
    path?: string;
    displayName?: string;
    mimeType?: string;
}

export interface AssistantImageAttachmentPayload {
    name: string;
    mimeType: `image/${string}`;
    dataUrl: string;
}

function normalizePathValue(value: unknown): string {
    return typeof value === 'string' ? value.trim().replace(/\\/g, '/') : '';
}

function toProjectRelativePath(value: string): string {
    const normalized = normalizePathValue(value);
    const srcIndex = normalized.indexOf('src/');
    return srcIndex >= 0 ? normalized.slice(srcIndex) : normalized;
}

function ensureIndexFilePath(value: string): string {
    const normalized = normalizePathValue(value);
    if (!normalized) return '';
    if (/\/index\.(t|j)sx?$/i.test(normalized)) return normalized;
    if (/\.[a-z0-9]+$/i.test(normalized)) return normalized;
    return `${normalized.replace(/\/+$/g, '')}/index.tsx`;
}

function ensureCanvasFilePath(value: string): string {
    const normalized = normalizePathValue(value);
    if (!normalized) return '';
    if (/\.excalidraw$/i.test(normalized)) return normalized;
    return `canvas/${normalized.replace(/\/+$/g, '')}.excalidraw`;
}

function normalizeResourcePath(input: AssistantResourceContextInput): string {
    const explicitPath = toProjectRelativePath(
        normalizePathValue(input.filePath)
        || normalizePathValue(input.path)
        || normalizePathValue(input.absoluteFilePath),
    );
    if (explicitPath) {
        if (input.resourceType === 'theme') return ensureIndexFilePath(explicitPath);
        return explicitPath;
    }

    const resourceId = normalizePathValue(input.resourceId || input.name);
    if (!resourceId) return '';
    if (input.resourceType === 'prototype' || input.resourceType === 'prototype-page') {
        return ensureIndexFilePath(`src/prototypes/${resourceId}`);
    }
    if (input.resourceType === 'theme') {
        return ensureIndexFilePath(`src/themes/${resourceId}`);
    }
    if (input.resourceType === 'canvas') {
        return ensureCanvasFilePath(resourceId);
    }
    if (input.resourceType === 'drawio') {
        return resourceId.endsWith('.drawio') || resourceId.endsWith('.drawio.svg')
            ? resourceId
            : `src/resources/${resourceId}.drawio`;
    }
    if (resourceId.startsWith('src/') || resourceId.startsWith('content/')) {
        return resourceId;
    }
    return `src/resources/${resourceId}`;
}

function resolveDisplayName(path: string, input: Pick<AssistantResourceContextInput, 'displayName' | 'name'>): string {
    const explicitName = String(input.displayName || '').trim();
    if (explicitName) return explicitName;
    const rawName = String(input.name || '').trim();
    if (rawName && rawName !== path) return rawName.split('/').filter(Boolean).pop() || rawName;
    const segments = path.split('/').filter(Boolean);
    const fileName = segments[segments.length - 1] || path;
    if (/^index\.[cm]?[tj]sx?$/i.test(fileName) && segments.length > 1) {
        return segments[segments.length - 2] || fileName;
    }
    return fileName.replace(/\.(?:[cm]?[tj]sx?|mdx?|json|excalidraw)$/i, '');
}

function inferMimeType(input: AssistantResourceContextInput, path: string): string | undefined {
    const mimeType = String(input.mimeType || '').trim();
    if (mimeType) return mimeType;
    if (/\.(png)$/i.test(path)) return 'image/png';
    if (/\.(jpe?g)$/i.test(path)) return 'image/jpeg';
    if (/\.(gif)$/i.test(path)) return 'image/gif';
    if (/\.(webp)$/i.test(path)) return 'image/webp';
    if (/\.(svg)$/i.test(path)) return 'image/svg+xml';
    if (/\.mdx?$/i.test(path)) return 'text/markdown';
    return undefined;
}

function buildFileContextItem(
    input: AssistantResourceContextInput,
    metadata: Record<string, unknown> = {},
): AcpContextItem[] {
    const path = normalizeResourcePath(input);
    if (!path) return [];
    const pageId = String(input.pageId || '').trim();
    const mimeType = inferMimeType(input, path);
    return [
        {
            kind: 'file',
            id: `axhub:file:${path}${pageId ? `#page=${pageId}` : ''}`,
            path,
            name: resolveDisplayName(path, input),
            ...(mimeType ? { mimeType } : {}),
            metadata: {
                source: 'axhub-runtime',
                resourceType: input.resourceType,
                ...(input.resourceId ? { resourceId: input.resourceId } : {}),
                ...(pageId ? { pageId } : {}),
                ...(input.metadata || {}),
                ...metadata,
            },
        },
    ];
}

export function buildAssistantContextItemsFromResource(input: AssistantResourceContextInput): AcpContextItem[] {
    return buildFileContextItem(input);
}

export function buildAssistantContextItemsFromCanvasElements(
    elements: AssistantCanvasElementContextInput[],
    currentFilePath: string,
): AcpContextItem[] {
    const items: AcpContextItem[] = [];
    const filePath = normalizePathValue(currentFilePath);

    for (const element of Array.isArray(elements) ? elements : []) {
        const elementId = String(element?.elementId || '').trim();
        if (!elementId) continue;

        const resourceType = element.resourceType;
        const resourceId = String(element.resourceId || '').trim();
        const explicitPath = normalizePathValue(element.filePath)
            || normalizePathValue(element.path)
            || normalizePathValue(element.absoluteFilePath);
        if (resourceType && (explicitPath || resourceId)) {
            items.push(...buildFileContextItem({
                resourceType,
                resourceId,
                name: resourceId || element.title || elementId,
                displayName: element.displayName || element.title,
                filePath: explicitPath,
                mimeType: element.mimeType,
            }, {
                canvasElementId: elementId,
            }));
            continue;
        }

        const elementType = String(element.type || 'unknown').trim() || 'unknown';
        const title = String(element.title || elementType || elementId).trim();
        const annotation = String(element.annotation || '').trim();
        const body = annotation || title || elementType || elementId;
        if (!body) continue;
        items.push({
            kind: 'annotation',
            id: `axhub:canvas-annotation:${elementId}`,
            body,
            target: {
                type: 'canvas-element',
                ...(filePath ? { filePath } : {}),
                elementId,
                elementType,
                ...(title ? { label: title } : {}),
                ...(element.link ? { link: element.link } : {}),
            },
            ...(title ? { title } : {}),
            source: 'axhub-runtime',
            metadata: {
                ...(filePath ? { filePath } : {}),
                elementId,
                elementType,
            },
        });
    }

    return items;
}

export function buildAssistantImageAttachmentPayload(params: {
    name?: string;
    dataUrl: string;
}): AssistantImageAttachmentPayload {
    const baseName = String(params.name || 'canvas-selection').trim() || 'canvas-selection';
    const dataUrl = String(params.dataUrl || '');
    const mimeTypeMatch = dataUrl.match(/^data:(image\/[^;,]+)[;,]/i);
    const mimeType = (mimeTypeMatch?.[1]?.toLowerCase() || 'image/png') as `image/${string}`;
    const extension = mimeType === 'image/jpeg'
        ? 'jpg'
        : mimeType.split('/')[1]?.replace(/\+xml$/i, '') || 'png';
    const name = /\.(?:png|jpe?g|gif|webp|svg)$/i.test(baseName) ? baseName : `${baseName}.${extension}`;
    return {
        name,
        mimeType,
        dataUrl,
    };
}
