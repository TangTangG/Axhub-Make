import { describe, expect, it, vi } from 'vitest';

import {
    CANVAS_ZOOM_MENU_ITEMS,
    executeCanvasZoomMenuAction,
} from './canvasZoomMenu';

function createMockExcalidrawAPI(options: {
    elements?: Array<{ id: string; isDeleted?: boolean }>;
    selectedElementIds?: Record<string, boolean>;
} = {}) {
    const elements = options.elements ?? [
        { id: 'first' },
        { id: 'second' },
    ];
    return {
        zoomCanvas: vi.fn(),
        scrollToContent: vi.fn(),
        getSceneElements: vi.fn(() => elements),
        getAppState: vi.fn(() => ({
            selectedElementIds: options.selectedElementIds ?? {},
        })),
    };
}

describe('canvas zoom menu', () => {
    it('exposes fixed zoom options and Excalidraw view-fit actions with shortcuts', () => {
        expect(CANVAS_ZOOM_MENU_ITEMS.map((item) => [item.id, item.label, item.shortcut ?? ''])).toEqual([
            ['zoom-25', '25%', ''],
            ['zoom-50', '50%', ''],
            ['zoom-75', '75%', ''],
            ['zoom-100', '100%', ''],
            ['reset-zoom', '重置缩放', 'Ctrl/Cmd+0'],
            ['fit-view', '适合视图', 'Shift+1'],
            ['fit-current-viewport', '适合当前视口', 'Shift+2'],
            ['fit-selection', '适合选中内容', 'Shift+3'],
        ]);
    });

    it('applies fixed zoom percentages through the public zoomCanvas API', () => {
        const api = createMockExcalidrawAPI();

        executeCanvasZoomMenuAction(api, 'zoom-25');
        executeCanvasZoomMenuAction(api, 'zoom-50');
        executeCanvasZoomMenuAction(api, 'zoom-75');
        executeCanvasZoomMenuAction(api, 'zoom-100');
        executeCanvasZoomMenuAction(api, 'reset-zoom');

        expect(api.zoomCanvas.mock.calls).toEqual([[0.25], [0.5], [0.75], [1], [1]]);
        expect(api.scrollToContent).not.toHaveBeenCalled();
    });

    it('falls back to updateScene when zoomCanvas is unavailable on the imperative API', () => {
        const api = {
            ...createMockExcalidrawAPI(),
            zoomCanvas: undefined,
            updateScene: vi.fn(),
        };

        executeCanvasZoomMenuAction(api, 'zoom-75');

        expect(api.updateScene).toHaveBeenCalledWith({
            appState: {
                zoom: { value: 0.75 },
                userToFollow: null,
            },
        });
    });

    it('fits all scene elements for the full view action', () => {
        const api = createMockExcalidrawAPI();

        executeCanvasZoomMenuAction(api, 'fit-view');

        expect(api.scrollToContent).toHaveBeenCalledWith([
            { id: 'first' },
            { id: 'second' },
        ], {
            fitToContent: true,
            animate: true,
        });
    });

    it('prefers selected non-deleted elements for selection-based fit actions', () => {
        const api = createMockExcalidrawAPI({
            elements: [
                { id: 'first' },
                { id: 'second' },
                { id: 'deleted', isDeleted: true },
            ],
            selectedElementIds: { second: true, deleted: true },
        });

        executeCanvasZoomMenuAction(api, 'fit-current-viewport');
        executeCanvasZoomMenuAction(api, 'fit-selection');

        expect(api.scrollToContent.mock.calls).toEqual([
            [[{ id: 'second' }], { fitToContent: true, animate: true }],
            [[{ id: 'second' }], { fitToViewport: true, animate: true }],
        ]);
    });
});
