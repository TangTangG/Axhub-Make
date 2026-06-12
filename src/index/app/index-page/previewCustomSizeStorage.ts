import { normalizePreviewHeight, normalizePreviewWidth } from './previewActions.helpers';

export const STORAGE_KEY_CUSTOM_PREVIEW_SIZE = 'axhub-make:preview-custom-size';

export type StoredCustomPreviewSize = {
    customWidth: number;
    customHeight: number;
};

export type PreviewCustomSizeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function getPreviewCustomSizeStorage(): PreviewCustomSizeStorage | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export function loadStoredCustomPreviewSize(storage = getPreviewCustomSizeStorage()): StoredCustomPreviewSize | null {
    if (!storage) {
        return null;
    }

    try {
        const raw = storage.getItem(STORAGE_KEY_CUSTOM_PREVIEW_SIZE);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as Partial<StoredCustomPreviewSize>;
        const customWidth = normalizePreviewWidth(Number(parsed.customWidth), NaN);
        const customHeight = normalizePreviewHeight(Number(parsed.customHeight), NaN);
        if (!Number.isFinite(customWidth) || !Number.isFinite(customHeight)) {
            return null;
        }

        return {
            customWidth,
            customHeight,
        };
    } catch {
        return null;
    }
}

export function saveStoredCustomPreviewSize(
    storage: PreviewCustomSizeStorage | null,
    size: StoredCustomPreviewSize,
): void {
    if (!storage) {
        return;
    }

    try {
        storage.setItem(STORAGE_KEY_CUSTOM_PREVIEW_SIZE, JSON.stringify({
            customWidth: size.customWidth,
            customHeight: size.customHeight,
        }));
    } catch {
        // localStorage may be unavailable or full in embedded/private contexts.
    }
}
