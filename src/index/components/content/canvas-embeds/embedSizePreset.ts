export type EmbedSizePreset = 'mobile' | 'tablet' | 'desktop' | 'free';

export interface EmbedSizePresetConfig {
    label: string;
    width: number;
    height: number;
}

export const EMBED_SIZE_PRESETS: Record<Exclude<EmbedSizePreset, 'free'>, EmbedSizePresetConfig> = {
    mobile: { label: '手机', width: 393, height: 852 },
    tablet: { label: '平板', width: 820, height: 1180 },
    desktop: { label: '桌面', width: 1440, height: 900 },
};

export const EMBED_SIZE_PRESET_OPTIONS: Exclude<EmbedSizePreset, 'free'>[] = ['mobile', 'tablet', 'desktop'];

const SIZE_MATCH_TOLERANCE = 2;

export function normalizeEmbedSizePreset(value: unknown): EmbedSizePreset {
    return value === 'mobile' || value === 'tablet' || value === 'desktop' || value === 'free'
        ? value
        : 'free';
}

export function inferEmbedSizePreset(width: number, height: number): EmbedSizePreset {
    if (width <= 0 || height <= 0) return 'free';

    for (const [preset, config] of Object.entries(EMBED_SIZE_PRESETS)) {
        if (
            Math.abs(width - config.width) <= SIZE_MATCH_TOLERANCE
            && Math.abs(height - config.height) <= SIZE_MATCH_TOLERANCE
        ) {
            return preset as EmbedSizePreset;
        }
    }

    return 'free';
}

export function applyEmbedSizePresetToElements<T extends {
    id?: string;
    width?: number;
    height?: number;
    version?: number;
    customData?: Record<string, unknown>;
}>(elements: readonly T[], elementId: string, preset: unknown, options: {
    now?: number;
    versionNonce?: number;
    size?: { width: number; height: number };
} = {}): T[] {
    const nextPreset = normalizeEmbedSizePreset(preset);
    return elements.map((element) => {
        if (element.id !== elementId) return element;

        const presetSize = nextPreset === 'free' ? null : EMBED_SIZE_PRESETS[nextPreset];
        const nextWidth = options.size?.width ?? presetSize?.width ?? element.width;
        const nextHeight = options.size?.height ?? presetSize?.height ?? element.height;
        if (
            element.width === nextWidth
            && element.height === nextHeight
            && normalizeEmbedSizePreset(element.customData?.embedSizePreset) === nextPreset
            && element.customData?.aspectRatioPreset === undefined
        ) {
            return element;
        }

        const { aspectRatioPreset: _aspectRatioPreset, ...customDataWithoutLegacyPreset } = element.customData || {};

        return {
            ...element,
            width: nextWidth,
            height: nextHeight,
            version: (element.version || 0) + 1,
            versionNonce: options.versionNonce ?? Math.floor(Math.random() * 2147483647),
            updated: options.now ?? Date.now(),
            customData: {
                ...customDataWithoutLegacyPreset,
                embedSizePreset: nextPreset,
                ...(presetSize ? { storedPreviewSize: { width: nextWidth, height: nextHeight } } : null),
            },
        };
    });
}
