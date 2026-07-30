import { describe, expect, it } from 'vitest';
import {
    loadStoredCustomPreviewSize,
    saveStoredCustomPreviewSize,
    STORAGE_KEY_CUSTOM_PREVIEW_SIZE,
    type PreviewCustomSizeStorage,
} from './previewCustomSizeStorage';

function createMemoryStorage(initial?: Record<string, string>): PreviewCustomSizeStorage & { data: Map<string, string> } {
    const data = new Map(Object.entries(initial || {}));
    return {
        data,
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => {
            data.set(key, value);
        },
    };
}

describe('preview custom size storage', () => {
    it('loads the persisted custom preview size from browser storage', () => {
        const storage = createMemoryStorage({
            [STORAGE_KEY_CUSTOM_PREVIEW_SIZE]: JSON.stringify({ customWidth: 1280, customHeight: 720 }),
        });

        expect(loadStoredCustomPreviewSize(storage)).toEqual({
            customWidth: 1280,
            customHeight: 720,
        });
    });

    it('saves the custom preview size into browser storage', () => {
        const storage = createMemoryStorage();

        saveStoredCustomPreviewSize(storage, { customWidth: 1024, customHeight: 768 });

        expect(JSON.parse(storage.data.get(STORAGE_KEY_CUSTOM_PREVIEW_SIZE) || '{}')).toEqual({
            customWidth: 1024,
            customHeight: 768,
        });
    });

    it('falls back to null when storage data is missing, malformed, or unavailable', () => {
        const unavailableStorage: PreviewCustomSizeStorage = {
            getItem: () => {
                throw new Error('storage unavailable');
            },
            setItem: () => undefined,
        };

        expect(loadStoredCustomPreviewSize(createMemoryStorage())).toBeNull();
        expect(loadStoredCustomPreviewSize(createMemoryStorage({
            [STORAGE_KEY_CUSTOM_PREVIEW_SIZE]: '{bad-json',
        }))).toBeNull();
        expect(loadStoredCustomPreviewSize(createMemoryStorage({
            [STORAGE_KEY_CUSTOM_PREVIEW_SIZE]: JSON.stringify({ customWidth: -1, customHeight: 0 }),
        }))).toBeNull();
        expect(loadStoredCustomPreviewSize(unavailableStorage)).toBeNull();
    });
});
