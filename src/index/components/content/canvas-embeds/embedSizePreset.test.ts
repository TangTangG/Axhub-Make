import { describe, expect, it } from 'vitest';

import {
    EMBED_SIZE_PRESETS,
    EMBED_SIZE_PRESET_OPTIONS,
    applyEmbedSizePresetToElements,
    inferEmbedSizePreset,
    normalizeEmbedSizePreset,
} from './embedSizePreset';

describe('embed size preset helpers', () => {
    it('normalizes supported size presets and falls back to free', () => {
        expect(Object.keys(EMBED_SIZE_PRESETS)).toEqual(['mobile', 'tablet', 'desktop']);
        expect(EMBED_SIZE_PRESET_OPTIONS).toEqual(['mobile', 'tablet', 'desktop']);
        expect(normalizeEmbedSizePreset('mobile')).toBe('mobile');
        expect(normalizeEmbedSizePreset('tablet')).toBe('tablet');
        expect(normalizeEmbedSizePreset('desktop')).toBe('desktop');
        expect(normalizeEmbedSizePreset('free')).toBe('free');
        expect(normalizeEmbedSizePreset('ratio')).toBe('free');
        expect(normalizeEmbedSizePreset(undefined)).toBe('free');
    });

    it('infers a size preset only when dimensions are close to the preset size', () => {
        expect(inferEmbedSizePreset(393, 852)).toBe('mobile');
        expect(inferEmbedSizePreset(820, 1180)).toBe('tablet');
        expect(inferEmbedSizePreset(1440, 900)).toBe('desktop');
        expect(inferEmbedSizePreset(1280, 800)).toBe('free');
        expect(inferEmbedSizePreset(720, 480)).toBe('free');
        expect(inferEmbedSizePreset(852, 393)).toBe('free');
    });

    it('applies a size preset as a one-time dimension change without touching content scale', () => {
        const elements = [
            {
                id: 'target',
                type: 'embeddable',
                width: 393,
                height: 852,
                version: 4,
                customData: {
                    embedContentScale: 0.5,
                    embedViewMode: 'preview',
                    storedPreviewSize: { width: 393, height: 852 },
                },
            },
            {
                id: 'other',
                type: 'embeddable',
                width: 393,
                height: 852,
                version: 1,
            },
        ];

        const updated = applyEmbedSizePresetToElements(elements, 'target', 'desktop', {
            now: 1234,
            versionNonce: 5678,
        });

        expect(updated[1]).toBe(elements[1]);
        expect(updated[0]).toMatchObject({
            id: 'target',
            width: 1440,
            height: 900,
            version: 5,
            versionNonce: 5678,
            updated: 1234,
            customData: {
                embedContentScale: 0.5,
                embedViewMode: 'preview',
                storedPreviewSize: { width: 1440, height: 900 },
                embedSizePreset: 'desktop',
            },
        });
    });

    it('marks a manually resized preset element as free without changing dimensions', () => {
        const elements = [{
            id: 'target',
            type: 'embeddable',
            width: 500,
            height: 600,
            version: 2,
            customData: {
                embedSizePreset: 'mobile',
                embedContentScale: 1,
            },
        }];

        const updated = applyEmbedSizePresetToElements(elements, 'target', 'free', {
            now: 1234,
            versionNonce: 5678,
        });

        expect(updated[0]).toMatchObject({
            width: 500,
            height: 600,
            version: 3,
            versionNonce: 5678,
            updated: 1234,
            customData: {
                embedSizePreset: 'free',
                embedContentScale: 1,
            },
        });
    });
});
