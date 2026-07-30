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

export interface ContextSubmenuFlyoutRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

export interface ContextSubmenuFlyoutLayoutInput {
    triggerRect: ContextSubmenuFlyoutRect;
    flyoutWidth: number;
    flyoutHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    viewportInset?: number;
}

export interface ContextSubmenuFlyoutLayout {
    left: number;
    top: number;
    maxHeight: number;
    overflowY: 'auto' | 'visible';
    placement: 'left' | 'right';
}

export interface ApplyContextSubmenuFlyoutLayoutInput {
    triggerEl: HTMLElement;
    flyoutEl: HTMLElement;
    viewportWidth?: number;
    viewportHeight?: number;
    viewportInset?: number;
}

const DEFAULT_VIEWPORT_INSET = 8;
const DEFAULT_MIN_VISIBLE_HEIGHT = 96;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

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

export function resolveContextSubmenuFlyoutLayout({
    triggerRect,
    flyoutWidth,
    flyoutHeight,
    viewportWidth,
    viewportHeight,
    viewportInset = DEFAULT_VIEWPORT_INSET,
}: ContextSubmenuFlyoutLayoutInput): ContextSubmenuFlyoutLayout {
    const viewportMaxHeight = Math.max(0, viewportHeight - viewportInset * 2);
    const availableRight = Math.max(0, viewportWidth - triggerRect.right - viewportInset);
    const availableLeft = Math.max(0, triggerRect.left - viewportInset);
    const placement: 'left' | 'right' = flyoutWidth <= availableRight || availableRight >= availableLeft
        ? 'right'
        : 'left';

    const rawLeft = placement === 'right'
        ? triggerRect.right
        : triggerRect.left - flyoutWidth;
    const minLeft = viewportInset;
    const maxLeft = Math.max(minLeft, viewportWidth - viewportInset - flyoutWidth);
    const maxHeight = Math.min(flyoutHeight, viewportMaxHeight);
    const minTop = viewportInset;
    const maxTop = Math.max(minTop, viewportHeight - viewportInset - maxHeight);

    return {
        left: clamp(rawLeft, minLeft, maxLeft),
        top: clamp(triggerRect.top, minTop, maxTop),
        maxHeight,
        overflowY: flyoutHeight > maxHeight ? 'auto' : 'visible',
        placement,
    };
}

export function applyContextSubmenuFlyoutLayout({
    triggerEl,
    flyoutEl,
    viewportWidth = window.innerWidth,
    viewportHeight = window.innerHeight,
    viewportInset = DEFAULT_VIEWPORT_INSET,
}: ApplyContextSubmenuFlyoutLayoutInput): ContextSubmenuFlyoutLayout {
    const triggerRect = triggerEl.getBoundingClientRect();
    const flyoutRect = flyoutEl.getBoundingClientRect();
    const layout = resolveContextSubmenuFlyoutLayout({
        triggerRect,
        flyoutWidth: flyoutRect.width || flyoutEl.offsetWidth,
        flyoutHeight: flyoutRect.height || flyoutEl.offsetHeight,
        viewportWidth,
        viewportHeight,
        viewportInset,
    });

    flyoutEl.style.left = `${layout.left}px`;
    flyoutEl.style.top = `${layout.top}px`;
    flyoutEl.style.right = 'auto';
    flyoutEl.style.maxHeight = `${layout.maxHeight}px`;
    flyoutEl.style.overflowY = layout.overflowY;
    flyoutEl.style.boxSizing = 'border-box';
    flyoutEl.style.overscrollBehaviorY = 'contain';
    flyoutEl.setAttribute('data-axhub-ctx-submenu-placement', layout.placement);

    return layout;
}
