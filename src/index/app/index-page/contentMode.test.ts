import { describe, expect, it } from 'vitest';

import {
    resolveIndexContentMode,
} from './contentMode';

describe('index page content mode', () => {
    it('uses normal resource content modes while the current view mode is canvas', () => {
        expect(resolveIndexContentMode({
            sidebarTab: 'prototype',
            resourceSection: 'themes',
            viewMode: 'canvas',
        })).toBe('preview');

        expect(resolveIndexContentMode({
            sidebarTab: 'document',
            resourceSection: 'themes',
            viewMode: 'canvas',
        })).toBe('doc');

        expect(resolveIndexContentMode({
            sidebarTab: 'assets',
            resourceSection: 'themes',
            viewMode: 'canvas',
        })).toBe('theme');

        expect(resolveIndexContentMode({
            sidebarTab: 'assets',
            resourceSection: 'templates',
            viewMode: 'canvas',
        })).toBe('template');

        expect(resolveIndexContentMode({
            sidebarTab: 'assets',
            resourceSection: 'data',
            viewMode: 'canvas',
        })).toBe('data');
    });

    it('opens Excalidraw resource files as canvas content from the resource tree', () => {
        expect(resolveIndexContentMode({
            sidebarTab: 'document',
            resourceSection: 'themes',
            viewMode: 'demo',
            selectedDocOpenMode: 'canvas',
        })).toBe('canvas');
    });

    it('still opens file canvas mode from the legacy canvas sidebar tab while it exists', () => {
        expect(resolveIndexContentMode({
            sidebarTab: 'canvas',
            resourceSection: 'themes',
            viewMode: 'canvas',
        })).toBe('canvas');
    });

    it('uses normal resource content modes outside prototype canvas browsing', () => {
        expect(resolveIndexContentMode({
            sidebarTab: 'document',
            resourceSection: 'themes',
            viewMode: 'demo',
        })).toBe('doc');
        expect(resolveIndexContentMode({
            sidebarTab: 'assets',
            resourceSection: 'themes',
            viewMode: 'demo',
        })).toBe('theme');
        expect(resolveIndexContentMode({
            sidebarTab: 'assets',
            resourceSection: 'templates',
            viewMode: 'demo',
        })).toBe('template');
        expect(resolveIndexContentMode({
            sidebarTab: 'assets',
            resourceSection: 'data',
            viewMode: 'demo',
        })).toBe('data');
    });

    it('does not export prototype-canvas resource browsing special cases', () => {
        expect('isBrowsingResourceSidebarInPrototypeCanvas' in { resolveIndexContentMode }).toBe(false);
    });
});
