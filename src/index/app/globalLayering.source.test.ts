import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readGlobalStyles() {
    return readFileSync(resolve(__dirname, '../../index.css'), 'utf8');
}

describe('global overlay layering styles', () => {
    it('keeps Radix tooltip poppers above composer popovers and dropdown menus', () => {
        const css = readGlobalStyles();

        expect(css).toContain('--axhub-overlay-z-tooltip: 3200;');
        expect(css).toContain('[data-radix-popper-content-wrapper]:has([role=\'tooltip\'])');
        expect(css).toContain('z-index: var(--axhub-overlay-z-tooltip) !important;');
        expect(css).toContain('[role=\'tooltip\']');
        expect(css).toContain('z-index: var(--axhub-overlay-z-tooltip) !important;');
    });
});
