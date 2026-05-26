import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
    return readFileSync(resolve(__dirname, './AppRoot.tsx'), 'utf8');
}

describe('AppRoot source', () => {
    it('keeps Excalidraw preference setters stable so bootstrap loading does not overwrite menu clicks', () => {
        const source = readSource();

        expect(source).toMatch(/import React, \{[^}]*useCallback[^}]*\} from 'react'/);
        expect(source).toContain('const setExcalidrawPropertyPanelMode = useCallback((mode: ExcalidrawPropertyPanelMode) => {');
        expect(source).toContain('const setExcalidrawPropertyPanelPosition = useCallback((position: ExcalidrawPropertyPanelPosition) => {');
    });
});
