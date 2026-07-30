interface CanvasViewportElement {
    x?: unknown;
    y?: unknown;
    width?: unknown;
    height?: unknown;
}

interface CanvasViewportAppState {
    scrollX?: unknown;
    scrollY?: unknown;
    width?: unknown;
    height?: unknown;
    zoom?: { value?: unknown } | null;
}

interface ResolvedCanvasViewportBounds {
    elementLeft: number;
    elementTop: number;
    elementRight: number;
    elementBottom: number;
    visibleLeft: number;
    visibleTop: number;
    visibleRight: number;
    visibleBottom: number;
}

function toFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function resolveCanvasViewportBounds(options: {
    element: CanvasViewportElement;
    appState: CanvasViewportAppState;
}): ResolvedCanvasViewportBounds | null {
    const x = toFiniteNumber(options.element.x);
    const y = toFiniteNumber(options.element.y);
    const width = toFiniteNumber(options.element.width);
    const height = toFiniteNumber(options.element.height);
    const scrollX = toFiniteNumber(options.appState.scrollX);
    const scrollY = toFiniteNumber(options.appState.scrollY);
    const viewportWidth = toFiniteNumber(options.appState.width);
    const viewportHeight = toFiniteNumber(options.appState.height);
    const zoom = toFiniteNumber(options.appState.zoom?.value);

    if (
        x === null || y === null || width === null || height === null
        || scrollX === null || scrollY === null
        || viewportWidth === null || viewportHeight === null || zoom === null
        || width <= 0 || height <= 0 || viewportWidth <= 0 || viewportHeight <= 0 || zoom <= 0
    ) {
        return null;
    }

    const visibleLeft = -scrollX;
    const visibleTop = -scrollY;
    const visibleRight = visibleLeft + viewportWidth / zoom;
    const visibleBottom = visibleTop + viewportHeight / zoom;
    const elementRight = x + width;
    const elementBottom = y + height;

    return {
        elementLeft: x,
        elementTop: y,
        elementRight,
        elementBottom,
        visibleLeft,
        visibleTop,
        visibleRight,
        visibleBottom,
    };
}

export function isElementFullyVisibleInCanvasViewport(options: {
    element: CanvasViewportElement;
    appState: CanvasViewportAppState;
}): boolean {
    const bounds = resolveCanvasViewportBounds(options);
    if (!bounds) return false;

    return bounds.elementLeft >= bounds.visibleLeft
        && bounds.elementTop >= bounds.visibleTop
        && bounds.elementRight <= bounds.visibleRight
        && bounds.elementBottom <= bounds.visibleBottom;
}

export function shouldFitElementIntoCanvasViewport(options: {
    element: CanvasViewportElement;
    appState: CanvasViewportAppState;
}): boolean {
    const bounds = resolveCanvasViewportBounds(options);
    if (!bounds) return false;

    return bounds.elementLeft < bounds.visibleLeft
        || bounds.elementTop < bounds.visibleTop
        || bounds.elementRight > bounds.visibleRight
        || bounds.elementBottom > bounds.visibleBottom;
}
