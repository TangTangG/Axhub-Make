export const LINK_EMBED_HEIGHT = 32;
export const LINK_EMBED_MIN_WIDTH = 120;
export const LINK_EMBED_MAX_WIDTH = 420;
const LINK_EMBED_HORIZONTAL_PADDING = 24;
const LINK_EMBED_ICON_AND_GAP_WIDTH = 30;

function estimateTextWidth(value: string): number {
    return Array.from(value || '').reduce((width, char) => {
        return width + (/[\u4e00-\u9fff]/u.test(char) ? 18 : 9);
    }, 0);
}

export function getLinkEmbedSize(title: string): { width: number; height: number } {
    const estimatedWidth = estimateTextWidth(title)
        + LINK_EMBED_HORIZONTAL_PADDING
        + LINK_EMBED_ICON_AND_GAP_WIDTH;
    return {
        width: Math.max(LINK_EMBED_MIN_WIDTH, Math.min(LINK_EMBED_MAX_WIDTH, Math.round(estimatedWidth))),
        height: LINK_EMBED_HEIGHT,
    };
}
