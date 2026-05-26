export interface PersistPrototypeScreenshotParams {
    previewUrl: string;
    dataUrl: string;
    prototypeId?: string | null;
    elementId?: string;
    fileName?: string;
    width?: number;
    height?: number;
}

export interface PersistedPrototypeScreenshot {
    screenshotUrl: string;
    path?: string;
    absoluteFilePath?: string;
    width?: number;
    height?: number;
}

const PROTOTYPE_CANVAS_ASSETS_DIR = 'canvas-assets';

function normalizePrototypeId(value: string): string | null {
    const decoded = decodeURIComponent(value || '').trim();
    if (
        !decoded
        || decoded === '.'
        || decoded === '..'
        || decoded.includes('/')
        || decoded.includes('\\')
    ) {
        return null;
    }
    return decoded;
}

function normalizeScreenshotFileBase(value: string): string | null {
    const normalized = String(value || '')
        .trim()
        .replace(/[^a-z0-9]+/giu, '-')
        .replace(/-+/gu, '-')
        .replace(/^-|-$/gu, '')
        .toLowerCase();
    return normalized || null;
}

export function getPrototypeIdFromCanvasName(canvasName: string): string | null {
    if (!canvasName) return null;
    const normalized = String(canvasName).trim();
    const match = normalized.match(/^prototypes\/([^/]+)\/canvas\.excalidraw$/iu);
    return match?.[1] ? normalizePrototypeId(match[1]) : null;
}

export function createElementScreenshotFileName(elementId: string): string | undefined {
    const safeElementId = normalizeScreenshotFileBase(elementId);
    return safeElementId ? `embed-${safeElementId}.png` : undefined;
}

export function getPrototypeIdFromPreviewUrl(previewUrl: string): string | null {
    if (!previewUrl) return null;
    try {
        const parsed = new URL(previewUrl, window.location.origin);
        const match = parsed.pathname.match(/^\/prototypes\/([^/]+)/iu);
        return match?.[1] ? normalizePrototypeId(match[1]) : null;
    } catch {
        return null;
    }
}

export function derivePrototypeScreenshotUrl(previewUrl: string): string | undefined {
    if (!previewUrl) return undefined;
    try {
        const parsed = new URL(previewUrl, window.location.origin);
        const prototypeId = getPrototypeIdFromPreviewUrl(previewUrl);
        if (!prototypeId) return undefined;
        return `${parsed.origin}/prototypes/${encodeURIComponent(prototypeId)}/${PROTOTYPE_CANVAS_ASSETS_DIR}/screenshot.png`;
    } catch {
        return undefined;
    }
}

export function derivePrototypeScreenshotUrlFromId(
    previewUrl: string,
    prototypeId: string | null | undefined,
    fileName = 'screenshot.png',
): string | undefined {
    if (!previewUrl || !prototypeId) return undefined;
    const normalizedPrototypeId = normalizePrototypeId(prototypeId);
    const normalizedFileName = normalizeScreenshotFileBase(fileName.replace(/\.png$/iu, ''));
    if (!normalizedPrototypeId || !normalizedFileName) return undefined;
    try {
        const parsed = new URL(previewUrl, window.location.origin);
        return `${parsed.origin}/prototypes/${encodeURIComponent(normalizedPrototypeId)}/${PROTOTYPE_CANVAS_ASSETS_DIR}/${encodeURIComponent(`${normalizedFileName}.png`)}`;
    } catch {
        return undefined;
    }
}

export async function persistPrototypeScreenshot(
    params: PersistPrototypeScreenshotParams,
): Promise<PersistedPrototypeScreenshot | null> {
    const prototypeId = normalizePrototypeId(params.prototypeId || '') || getPrototypeIdFromPreviewUrl(params.previewUrl);
    if (!prototypeId) {
        return null;
    }

    const fileName = params.fileName || (params.elementId ? createElementScreenshotFileName(params.elementId) : undefined);

    const response = await fetch(`/api/canvas/prototypes/${encodeURIComponent(prototypeId)}/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            elementId: params.elementId,
            fileName,
            dataUrl: params.dataUrl,
            width: params.width,
            height: params.height,
        }),
    });
    if (!response.ok) {
        throw new Error(`保存截图失败 (${response.status})`);
    }

    const payload = await response.json();
    const screenshotUrl = typeof payload?.screenshotUrl === 'string' ? payload.screenshotUrl : '';
    if (!screenshotUrl) {
        return null;
    }
    let resolvedScreenshotUrl = screenshotUrl;
    if (screenshotUrl.startsWith('/')) {
        try {
            const previewOrigin = new URL(params.previewUrl, window.location.origin).origin;
            resolvedScreenshotUrl = new URL(screenshotUrl, previewOrigin).toString();
        } catch {
            resolvedScreenshotUrl = screenshotUrl;
        }
    }

    return {
        screenshotUrl: resolvedScreenshotUrl,
        path: typeof payload.path === 'string' ? payload.path : undefined,
        absoluteFilePath: typeof payload.absoluteFilePath === 'string' ? payload.absoluteFilePath : undefined,
        width: typeof payload.width === 'number' ? payload.width : undefined,
        height: typeof payload.height === 'number' ? payload.height : undefined,
    };
}
