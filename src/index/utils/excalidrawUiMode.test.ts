import { describe, expect, it } from 'vitest';

import {
    resolveExcalidrawCanvasClassName,
    toExcalidrawDesktopUiMode,
} from './excalidrawUiMode';

describe('excalidraw UI mode helpers', () => {
    it('maps collapsed to compact and expanded to the native full panel', () => {
        expect(toExcalidrawDesktopUiMode('collapsed')).toBe('compact');
        expect(toExcalidrawDesktopUiMode('expanded')).toBe('full');
    });

    it('uses separate canvas classes for compact and full property panel modes', () => {
        expect(resolveExcalidrawCanvasClassName('collapsed', 'right')).toBe(
            'axhub-excalidraw-compact axhub-excalidraw-property-panel-right',
        );
        expect(resolveExcalidrawCanvasClassName('collapsed', 'left')).toBe(
            'axhub-excalidraw-compact axhub-excalidraw-property-panel-left',
        );
        expect(resolveExcalidrawCanvasClassName('expanded', 'right')).toBe(
            'axhub-excalidraw-full axhub-excalidraw-property-panel-right',
        );
    });
});
