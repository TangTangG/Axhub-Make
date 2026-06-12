import type { ItemData } from '../../types';
import {
    MULTI_PAGE_ACTIVE_LIMIT,
    resolveMultiPageVisiblePages,
} from '../../domains/device/preview-layout';

export interface MultiPagePreviewPage {
    id: string;
    title: string;
}

export interface MultiPageCardPagesResult {
    allPages: MultiPagePreviewPage[];
    visiblePages: MultiPagePreviewPage[];
    defaultPageId: string;
}

const SAFE_PAGE_ID_RE = /^[a-z0-9-]+$/u;

function normalizePageId(value: unknown): string {
    const pageId = typeof value === 'string' ? value.trim() : '';
    return SAFE_PAGE_ID_RE.test(pageId) ? pageId : '';
}

function normalizePageTitle(value: unknown, fallback: string): string {
    const title = typeof value === 'string' ? value.trim() : '';
    return title || fallback;
}

export function activateMultiPageLiveSlot(
    activeSlots: readonly string[],
    nextSlotId: string,
    activeLimit = MULTI_PAGE_ACTIVE_LIMIT,
): { activeSlots: string[]; evictedSlot: string | null } {
    const normalizedNextSlotId = String(nextSlotId || '').trim();
    if (!normalizedNextSlotId) {
        return { activeSlots: [...activeSlots], evictedSlot: null };
    }

    const dedupedSlots = activeSlots.filter((slotId) => slotId !== normalizedNextSlotId);
    const nextSlots = [...dedupedSlots, normalizedNextSlotId];
    const overflow = Math.max(0, nextSlots.length - Math.max(1, activeLimit));
    const evictedSlots = overflow > 0 ? nextSlots.slice(0, overflow) : [];

    return {
        activeSlots: overflow > 0 ? nextSlots.slice(overflow) : nextSlots,
        evictedSlot: evictedSlots[0] ?? null,
    };
}

export function resolveMultiPageCardPages({
    item,
}: {
    item: ItemData;
}): MultiPageCardPagesResult {
    const normalizedPages = Array.isArray(item.pages)
        ? item.pages
            .map((page, index) => {
                const id = normalizePageId(page?.id);
                if (!id) return null;
                return {
                    id,
                    title: normalizePageTitle(page?.title, `页面 ${index + 1}`),
                };
            })
            .filter((page): page is MultiPagePreviewPage => Boolean(page))
        : [];
    const fallbackPageId = normalizePageId(item.defaultPageId) || normalizePageId(item.name) || 'page';
    const fallbackTitle = normalizePageTitle(item.displayName, fallbackPageId);
    const allPages = normalizedPages.length > 0
        ? normalizedPages
        : [{ id: fallbackPageId, title: fallbackTitle }];
    const requestedDefaultPageId = normalizePageId(item.defaultPageId);
    const defaultPageId = allPages.some((page) => page.id === requestedDefaultPageId)
        ? requestedDefaultPageId
        : allPages[0]?.id || fallbackPageId;

    return {
        allPages,
        visiblePages: resolveMultiPageVisiblePages(allPages),
        defaultPageId,
    };
}
