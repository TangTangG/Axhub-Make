export interface EmbedSize {
    width: number;
    height: number;
}

export interface EmbedViewportRect {
    width: number;
    height: number;
}

const VIEWPORT_PADDING = 48;
const MIN_VIEWPORT_LIMIT = 120;

function resolveViewportLimit(viewportRect?: EmbedViewportRect | null, zoom = 1): EmbedViewportRect | null {
    if (!viewportRect) return null;
    const viewportWidth = Number(viewportRect.width);
    const viewportHeight = Number(viewportRect.height);
    const zoomValue = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    if (!Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight) || viewportWidth <= 0 || viewportHeight <= 0) {
        return null;
    }
    return {
        width: Math.max(MIN_VIEWPORT_LIMIT, (viewportWidth - VIEWPORT_PADDING * 2) / zoomValue),
        height: Math.max(MIN_VIEWPORT_LIMIT, (viewportHeight - VIEWPORT_PADDING * 2) / zoomValue),
    };
}

export function fitEmbedSizeToViewport<T extends EmbedSize>(
    size: T,
    viewportRect?: EmbedViewportRect | null,
    zoom = 1,
): T {
    const width = Number(size.width);
    const height = Number(size.height);
    const viewport = resolveViewportLimit(viewportRect, zoom);
    if (!viewport || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return size;
    }

    const scale = Math.min(1, viewport.width / width, viewport.height / height);
    if (scale >= 1) return size;

    return {
        ...size,
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}
