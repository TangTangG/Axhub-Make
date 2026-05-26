export interface ContextMenuViewportFitInput {
    menuTop: number;
    menuHeight: number;
    viewportHeight: number;
    viewportInset?: number;
    minVisibleHeight?: number;
}

export interface ContextMenuViewportFit {
    maxHeight: number;
    overflowY: 'auto' | 'visible';
    popoverTop: number;
}

const DEFAULT_VIEWPORT_INSET = 8;
const DEFAULT_MIN_VISIBLE_HEIGHT = 96;

export function resolveContextMenuViewportFit({
    menuTop,
    menuHeight,
    viewportHeight,
    viewportInset = DEFAULT_VIEWPORT_INSET,
    minVisibleHeight = DEFAULT_MIN_VISIBLE_HEIGHT,
}: ContextMenuViewportFitInput): ContextMenuViewportFit {
    const viewportMaxHeight = Math.max(0, viewportHeight - viewportInset * 2);
    const availableAbove = Math.max(0, menuTop - viewportInset);
    const availableBelow = Math.max(0, viewportHeight - menuTop - viewportInset);

    const preferAbove = availableAbove > availableBelow;
    const preferredAvailable = preferAbove ? availableAbove : availableBelow;

    if (menuHeight <= preferredAvailable) {
        return {
            maxHeight: menuHeight,
            overflowY: 'visible',
            popoverTop: preferAbove ? Math.max(viewportInset, menuTop - menuHeight) : menuTop,
        };
    }

    if (!preferAbove && availableBelow >= minVisibleHeight) {
        return {
            maxHeight: availableBelow,
            overflowY: 'auto',
            popoverTop: menuTop,
        };
    }

    const maxHeight = preferAbove
        ? Math.min(menuHeight, viewportMaxHeight)
        : Math.min(menuHeight, availableBelow || viewportMaxHeight);
    const shiftedTop = preferAbove
        ? Math.max(viewportInset, menuTop - maxHeight)
        : Math.max(viewportInset, viewportHeight - maxHeight - viewportInset);

    return {
        maxHeight,
        overflowY: menuHeight > maxHeight ? 'auto' : 'visible',
        popoverTop: shiftedTop,
    };
}
