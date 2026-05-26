export const EMBED_CONTENT_SCALE_OPTIONS = [0.25, 0.5, 0.75, 1] as const;

export type EmbedContentScale = (typeof EMBED_CONTENT_SCALE_OPTIONS)[number];

const DEFAULT_EMBED_CONTENT_SCALE: EmbedContentScale = 1;

export function normalizeEmbedContentScale(value: unknown): EmbedContentScale {
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (typeof numeric !== 'number' || !Number.isFinite(numeric) || numeric <= 0) {
        return DEFAULT_EMBED_CONTENT_SCALE;
    }

    return EMBED_CONTENT_SCALE_OPTIONS.find((option) => option === numeric)
        ?? DEFAULT_EMBED_CONTENT_SCALE;
}

export function getScaledEmbedViewportSize(options: {
    width: number;
    height: number;
    contentScale: unknown;
}): { width: number; height: number } {
    const scale = normalizeEmbedContentScale(options.contentScale);
    return {
        width: Math.max(1, Math.round(options.width / scale)),
        height: Math.max(1, Math.round(options.height / scale)),
    };
}

export function shouldRequestEmbedScreenshot(options: {
    viewportWidth: number;
    viewportHeight: number;
    contentScale: unknown;
    capturedViewportWidth: unknown;
    capturedViewportHeight: unknown;
    capturedContentScale: unknown;
}): boolean {
    const capturedWidth = typeof options.capturedViewportWidth === 'number'
        ? options.capturedViewportWidth
        : undefined;
    const capturedHeight = typeof options.capturedViewportHeight === 'number'
        ? options.capturedViewportHeight
        : undefined;
    const nextScale = normalizeEmbedContentScale(options.contentScale);
    const capturedScale = typeof options.capturedContentScale === 'number' || typeof options.capturedContentScale === 'string'
        ? normalizeEmbedContentScale(options.capturedContentScale)
        : undefined;

    return capturedWidth !== options.viewportWidth
        || capturedHeight !== options.viewportHeight
        || capturedScale !== nextScale;
}

export function isEmbedScreenshotUsable(options: {
    screenshotUrl: unknown;
    viewportWidth: number;
    viewportHeight: number;
    contentScale: unknown;
    screenshotWidth: unknown;
    screenshotHeight: unknown;
    screenshotContentScale: unknown;
}): boolean {
    if (typeof options.screenshotUrl !== 'string' || !options.screenshotUrl.trim()) {
        return false;
    }

    return !shouldRequestEmbedScreenshot({
        viewportWidth: options.viewportWidth,
        viewportHeight: options.viewportHeight,
        contentScale: options.contentScale,
        capturedViewportWidth: options.screenshotWidth,
        capturedViewportHeight: options.screenshotHeight,
        capturedContentScale: options.screenshotContentScale,
    });
}

export function updateEmbedContentScaleInElements<T extends {
    id?: string;
    version?: number;
    customData?: Record<string, unknown>;
}>(elements: readonly T[], elementId: string, scale: unknown, options: {
    now?: number;
    versionNonce?: number;
} = {}): T[] {
    const nextScale = normalizeEmbedContentScale(scale);
    return elements.map((element) => {
        if (element.id !== elementId) return element;
        if (normalizeEmbedContentScale(element.customData?.embedContentScale) === nextScale) {
            return element;
        }

        return {
            ...element,
            version: (element.version || 0) + 1,
            versionNonce: options.versionNonce ?? Math.floor(Math.random() * 2147483647),
            updated: options.now ?? Date.now(),
            customData: {
                ...element.customData,
                embedContentScale: nextScale,
            },
        };
    });
}
