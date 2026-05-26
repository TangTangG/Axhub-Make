import { describe, expect, it } from 'vitest';

import {
    isBrowsingResourceSidebarInPrototypeCanvas,
    resolveIndexContentMode,
} from './contentMode';

describe('index page content mode', () => {
    it('keeps prototype canvas content visible while browsing resource sidebar tabs', () => {
        expect(resolveIndexContentMode({
            sidebarTab: 'prototype',
            resourceSection: 'themes',
            viewMode: 'canvas',
        })).toBe('preview');

        expect(resolveIndexContentMode({
            sidebarTab: 'document',
            resourceSection: 'themes',
            viewMode: 'canvas',
        })).toBe('preview');

        expect(resolveIndexContentMode({
            sidebarTab: 'assets',
            resourceSection: 'themes',
            viewMode: 'canvas',
        })).toBe('preview');
    });

    it('still opens file canvas mode only from the canvas sidebar tab', () => {
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

    it('identifies resource tab browsing while a prototype canvas is active', () => {
        expect(isBrowsingResourceSidebarInPrototypeCanvas({
            sidebarTab: 'document',
            viewMode: 'canvas',
        })).toBe(true);
        expect(isBrowsingResourceSidebarInPrototypeCanvas({
            sidebarTab: 'canvas',
            viewMode: 'canvas',
        })).toBe(false);
        expect(isBrowsingResourceSidebarInPrototypeCanvas({
            sidebarTab: 'document',
            viewMode: 'demo',
        })).toBe(false);
    });
});
