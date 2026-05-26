import { describe, expect, it } from 'vitest';

import {
    isElementFullyVisibleInCanvasViewport,
    shouldFitElementIntoCanvasViewport,
} from './activePreviewViewport';

describe('active preview viewport helpers', () => {
    const appState = {
        scrollX: -100,
        scrollY: -200,
        width: 1000,
        height: 800,
        zoom: { value: 2 },
    };

    it('treats an element inside the current canvas viewport as fully visible', () => {
        expect(isElementFullyVisibleInCanvasViewport({
            element: { x: 120, y: 230, width: 200, height: 120 },
            appState,
        })).toBe(true);
    });

    it('detects clipped elements', () => {
        expect(isElementFullyVisibleInCanvasViewport({
            element: { x: 90, y: 230, width: 200, height: 120 },
            appState,
        })).toBe(false);

        expect(isElementFullyVisibleInCanvasViewport({
            element: { x: 120, y: 230, width: 600, height: 120 },
            appState,
        })).toBe(false);
    });

    it('detects oversized elements as not fully visible', () => {
        expect(isElementFullyVisibleInCanvasViewport({
            element: { x: 100, y: 200, width: 520, height: 120 },
            appState,
        })).toBe(false);
    });

    it('returns false for invalid dimensions or invalid zoom', () => {
        expect(isElementFullyVisibleInCanvasViewport({
            element: { x: 100, y: 200, width: 0, height: 120 },
            appState,
        })).toBe(false);

        expect(isElementFullyVisibleInCanvasViewport({
            element: { x: 100, y: 200, width: 120, height: 120 },
            appState: { ...appState, zoom: { value: 0 } },
        })).toBe(false);
    });

    it('requests fitting only for valid clipped elements', () => {
        expect(shouldFitElementIntoCanvasViewport({
            element: { x: 90, y: 230, width: 200, height: 120 },
            appState,
        })).toBe(true);

        expect(shouldFitElementIntoCanvasViewport({
            element: { x: 120, y: 230, width: 200, height: 120 },
            appState,
        })).toBe(false);

        expect(shouldFitElementIntoCanvasViewport({
            element: { x: 100, y: 200, width: 0, height: 120 },
            appState,
        })).toBe(false);

        expect(shouldFitElementIntoCanvasViewport({
            element: { x: 100, y: 200, width: 120, height: 120 },
            appState: { ...appState, zoom: { value: 0 } },
        })).toBe(false);
    });
});
