import { describe, expect, it } from 'vitest';

import {
    EMBED_CONTENT_SCALE_OPTIONS,
    getScaledEmbedViewportSize,
    isEmbedScreenshotUsable,
    normalizeEmbedContentScale,
    shouldRequestEmbedScreenshot,
    updateEmbedContentScaleInElements,
} from './embedContentScale';

describe('embed content scale helpers', () => {
    it('normalizes supported content scales and falls back to 100%', () => {
        expect(EMBED_CONTENT_SCALE_OPTIONS).toEqual([0.25, 0.5, 0.75, 1]);
        expect(normalizeEmbedContentScale(0.25)).toBe(0.25);
        expect(normalizeEmbedContentScale('0.5')).toBe(0.5);
        expect(normalizeEmbedContentScale(undefined)).toBe(1);
        expect(normalizeEmbedContentScale(null)).toBe(1);
        expect(normalizeEmbedContentScale(0)).toBe(1);
        expect(normalizeEmbedContentScale(-1)).toBe(1);
        expect(normalizeEmbedContentScale(0.8)).toBe(1);
        expect(normalizeEmbedContentScale(Number.NaN)).toBe(1);
    });

    it('calculates iframe and screenshot viewport size from the visible node size', () => {
        expect(getScaledEmbedViewportSize({ width: 800, height: 600, contentScale: 1 })).toEqual({
            width: 800,
            height: 600,
        });
        expect(getScaledEmbedViewportSize({ width: 800, height: 600, contentScale: 0.5 })).toEqual({
            width: 1600,
            height: 1200,
        });
        expect(getScaledEmbedViewportSize({ width: 800, height: 600, contentScale: 0.25 })).toEqual({
            width: 3200,
            height: 2400,
        });
    });

    it('updates only the target element content scale while preserving existing custom data', () => {
        const elements = [
            {
                id: 'target',
                type: 'embeddable',
                version: 3,
                customData: {
                    aspectRatioPreset: 'desktop',
                    embedViewMode: 'preview',
                    storedPreviewSize: { width: 1440, height: 900 },
                },
            },
            {
                id: 'other',
                type: 'embeddable',
                version: 7,
                customData: {
                    embedContentScale: 0.25,
                },
            },
        ];

        const updated = updateEmbedContentScaleInElements(elements, 'target', 0.5, {
            now: 1234,
            versionNonce: 5678,
        });

        expect(updated[1]).toBe(elements[1]);
        expect(updated[0]).toMatchObject({
            id: 'target',
            version: 4,
            versionNonce: 5678,
            updated: 1234,
            customData: {
                aspectRatioPreset: 'desktop',
                embedViewMode: 'preview',
                storedPreviewSize: { width: 1440, height: 900 },
                embedContentScale: 0.5,
            },
        });
    });

    it('requests screenshots only when viewport inputs changed or none has been captured', () => {
        const context = {
            viewportWidth: 1600,
            viewportHeight: 1200,
            contentScale: 0.5,
        };

        expect(shouldRequestEmbedScreenshot({
            ...context,
            capturedViewportWidth: undefined,
            capturedViewportHeight: undefined,
            capturedContentScale: undefined,
        })).toBe(true);

        expect(shouldRequestEmbedScreenshot({
            ...context,
            capturedViewportWidth: 1600,
            capturedViewportHeight: 1200,
            capturedContentScale: 0.5,
        })).toBe(false);

        expect(shouldRequestEmbedScreenshot({
            ...context,
            capturedViewportWidth: 800,
            capturedViewportHeight: 1200,
            capturedContentScale: 0.5,
        })).toBe(true);

        expect(shouldRequestEmbedScreenshot({
            ...context,
            capturedViewportWidth: 1600,
            capturedViewportHeight: 1200,
            capturedContentScale: 1,
        })).toBe(true);
    });

    it('treats screenshots with stale viewport metadata as unusable', () => {
        expect(isEmbedScreenshotUsable({
            screenshotUrl: '/canvas-assets/embed.png',
            viewportWidth: 1600,
            viewportHeight: 1200,
            contentScale: 0.5,
            screenshotWidth: 1600,
            screenshotHeight: 1200,
            screenshotContentScale: 0.5,
        })).toBe(true);

        expect(isEmbedScreenshotUsable({
            screenshotUrl: '/canvas-assets/embed.png',
            viewportWidth: 1600,
            viewportHeight: 1200,
            contentScale: 0.5,
            screenshotWidth: 800,
            screenshotHeight: 1200,
            screenshotContentScale: 0.5,
        })).toBe(false);

        expect(isEmbedScreenshotUsable({
            screenshotUrl: '/canvas-assets/embed.png',
            viewportWidth: 1600,
            viewportHeight: 1200,
            contentScale: 0.5,
            screenshotWidth: 1600,
            screenshotHeight: 1200,
            screenshotContentScale: 1,
        })).toBe(false);

        expect(isEmbedScreenshotUsable({
            screenshotUrl: '',
            viewportWidth: 1600,
            viewportHeight: 1200,
            contentScale: 0.5,
            screenshotWidth: 1600,
            screenshotHeight: 1200,
            screenshotContentScale: 0.5,
        })).toBe(false);
    });
});
