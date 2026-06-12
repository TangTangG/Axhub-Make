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

    it('uses app-scoped border color tokens that are not invalidated by Tailwind border variables', () => {
        const css = readGlobalStyles();

        expect(css).toContain('--axhub-border-color: hsl(var(--axhub-border));');
        expect(css).toContain('--color-border: var(--axhub-border-color);');
        expect(css).toContain('border-color: var(--axhub-border-color);');
        expect(css).not.toContain('border-color: hsl(var(--border));');
    });

    it('hides focus rings for invisible document paste focus surfaces', () => {
        const css = readGlobalStyles();
        const focusSurfaceRule = css.slice(
            css.indexOf('.ax-admin-theme [data-document-paste-focus-surface]:focus'),
            css.indexOf('.ax-placeholder-display-composer', css.indexOf('.ax-admin-theme [data-document-paste-focus-surface]:focus')),
        );

        expect(focusSurfaceRule).toContain('[data-document-paste-focus-surface]:focus-visible');
        expect(focusSurfaceRule).toContain('outline: none !important;');
        expect(focusSurfaceRule).toContain('box-shadow: none !important;');
    });
});
