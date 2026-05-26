type CanvasZoomMenuActionId =
    | 'zoom-25'
    | 'zoom-50'
    | 'zoom-75'
    | 'zoom-100'
    | 'reset-zoom'
    | 'fit-view'
    | 'fit-current-viewport'
    | 'fit-selection';

type CanvasZoomMenuItemKind = 'action' | 'separator';

interface CanvasZoomMenuItem {
    id: CanvasZoomMenuActionId;
    label: string;
    shortcut?: string;
    kind?: CanvasZoomMenuItemKind;
}

interface CanvasZoomExcalidrawAPI {
    zoomCanvas?: (value: number) => void;
    updateScene?: (sceneData: { appState?: Record<string, unknown> }) => void;
    scrollToContent: (target?: unknown, opts?: Record<string, unknown>) => void;
    getSceneElements: () => readonly any[];
    getAppState: () => {
        selectedElementIds?: Record<string, boolean>;
    };
}

export const CANVAS_ZOOM_MENU_ITEMS: CanvasZoomMenuItem[] = [
    { id: 'zoom-25', label: '25%' },
    { id: 'zoom-50', label: '50%' },
    { id: 'zoom-75', label: '75%' },
    { id: 'zoom-100', label: '100%' },
    { id: 'reset-zoom', label: '重置缩放', shortcut: 'Ctrl/Cmd+0' },
    { id: 'fit-view', label: '适合视图', shortcut: 'Shift+1' },
    { id: 'fit-current-viewport', label: '适合当前视口', shortcut: 'Shift+2' },
    { id: 'fit-selection', label: '适合选中内容', shortcut: 'Shift+3' },
];

const FIXED_ZOOM_BY_ACTION: Partial<Record<CanvasZoomMenuActionId, number>> = {
    'zoom-25': 0.25,
    'zoom-50': 0.5,
    'zoom-75': 0.75,
    'zoom-100': 1,
    'reset-zoom': 1,
};

function getUsableSceneElements(api: CanvasZoomExcalidrawAPI): readonly any[] {
    return api.getSceneElements().filter((element) => element && !element.isDeleted);
}

function getSelectedSceneElements(api: CanvasZoomExcalidrawAPI): readonly any[] {
    const selectedIds = api.getAppState().selectedElementIds || {};
    const elements = getUsableSceneElements(api);
    return elements.filter((element) => selectedIds[element.id]);
}

function getSelectionOrSceneElements(api: CanvasZoomExcalidrawAPI): readonly any[] {
    const selectedElements = getSelectedSceneElements(api);
    return selectedElements.length > 0 ? selectedElements : getUsableSceneElements(api);
}

export function executeCanvasZoomMenuAction(
    api: CanvasZoomExcalidrawAPI,
    actionId: CanvasZoomMenuActionId,
): void {
    const fixedZoom = FIXED_ZOOM_BY_ACTION[actionId];
    if (typeof fixedZoom === 'number') {
        if (api.zoomCanvas) {
            api.zoomCanvas(fixedZoom);
        } else {
            api.updateScene?.({
                appState: {
                    zoom: { value: fixedZoom },
                    userToFollow: null,
                },
            });
        }
        return;
    }

    if (actionId === 'fit-view') {
        api.scrollToContent(getUsableSceneElements(api), {
            fitToContent: true,
            animate: true,
        });
        return;
    }

    if (actionId === 'fit-current-viewport') {
        api.scrollToContent(getSelectionOrSceneElements(api), {
            fitToContent: true,
            animate: true,
        });
        return;
    }

    if (actionId === 'fit-selection') {
        api.scrollToContent(getSelectionOrSceneElements(api), {
            fitToViewport: true,
            animate: true,
        });
    }
}

interface CanvasZoomMenuEnhancerOptions {
    container: HTMLElement;
    excalidrawAPI: CanvasZoomExcalidrawAPI;
}

export class CanvasZoomMenuEnhancer {
    private container: HTMLElement;
    private excalidrawAPI: CanvasZoomExcalidrawAPI;
    private observer: MutationObserver | null = null;
    private rafId = 0;
    private zoomButton: HTMLButtonElement | null = null;
    private menu: HTMLDivElement | null = null;
    private onZoomButtonClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        this.toggleMenu();
    };
    private onDocumentPointerDown = (event: PointerEvent) => {
        const target = event.target as Node | null;
        if (!target) return;
        if (this.menu?.contains(target) || this.zoomButton?.contains(target)) return;
        this.closeMenu();
    };
    private onDocumentKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            this.closeMenu();
        }
    };

    constructor(options: CanvasZoomMenuEnhancerOptions) {
        this.container = options.container;
        this.excalidrawAPI = options.excalidrawAPI;
    }

    connect(): void {
        injectCanvasZoomMenuStyles();
        this.observer = new MutationObserver(() => this.scheduleEnhance());
        this.observer.observe(this.container, { childList: true, subtree: true });
        this.scheduleEnhance();
    }

    disconnect(): void {
        this.observer?.disconnect();
        this.observer = null;
        cancelAnimationFrame(this.rafId);
        this.unbindZoomButton();
        this.closeMenu();
    }

    private scheduleEnhance(): void {
        cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(() => this.enhance());
    }

    private enhance(): void {
        const nextZoomButton = this.container.querySelector('.reset-zoom-button.zoom-button') as HTMLButtonElement | null;
        if (nextZoomButton === this.zoomButton) return;
        this.unbindZoomButton();
        this.zoomButton = nextZoomButton;
        if (!this.zoomButton) return;
        this.zoomButton.setAttribute('aria-haspopup', 'menu');
        this.zoomButton.addEventListener('click', this.onZoomButtonClick, true);
    }

    private unbindZoomButton(): void {
        if (!this.zoomButton) return;
        this.zoomButton.removeEventListener('click', this.onZoomButtonClick, true);
        this.zoomButton.removeAttribute('aria-haspopup');
        this.zoomButton.removeAttribute('aria-expanded');
        this.zoomButton = null;
    }

    private toggleMenu(): void {
        if (this.menu) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    private openMenu(): void {
        if (!this.zoomButton) return;
        this.closeMenu();

        const menu = document.createElement('div');
        menu.className = 'axhub-canvas-zoom-menu';
        menu.setAttribute('role', 'menu');

        for (const item of CANVAS_ZOOM_MENU_ITEMS) {
            if (item.id === 'reset-zoom' || item.id === 'fit-view') {
                menu.appendChild(this.createSeparator());
            }
            menu.appendChild(this.createMenuItem(item));
        }

        document.body.appendChild(menu);
        this.menu = menu;
        this.zoomButton.setAttribute('aria-expanded', 'true');
        this.positionMenu();
        document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
        document.addEventListener('keydown', this.onDocumentKeyDown, true);
    }

    private closeMenu(): void {
        if (this.menu) {
            this.menu.remove();
            this.menu = null;
        }
        this.zoomButton?.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
        document.removeEventListener('keydown', this.onDocumentKeyDown, true);
    }

    private createSeparator(): HTMLDivElement {
        const separator = document.createElement('div');
        separator.className = 'axhub-canvas-zoom-menu-separator';
        separator.setAttribute('role', 'separator');
        return separator;
    }

    private createMenuItem(item: CanvasZoomMenuItem): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'axhub-canvas-zoom-menu-item';
        button.setAttribute('role', 'menuitem');
        button.dataset.actionId = item.id;

        const label = document.createElement('span');
        label.textContent = item.label;
        button.appendChild(label);

        if (item.shortcut) {
            const shortcut = document.createElement('span');
            shortcut.className = 'axhub-canvas-zoom-menu-shortcut';
            shortcut.textContent = item.shortcut;
            button.appendChild(shortcut);
        }

        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            executeCanvasZoomMenuAction(this.excalidrawAPI, item.id);
            this.closeMenu();
        });

        return button;
    }

    private positionMenu(): void {
        if (!this.menu || !this.zoomButton) return;
        const rect = this.zoomButton.getBoundingClientRect();
        const menuRect = this.menu.getBoundingClientRect();
        const gap = 8;
        const viewportPadding = 8;
        const left = Math.min(
            Math.max(viewportPadding, rect.left + rect.width / 2 - menuRect.width / 2),
            window.innerWidth - menuRect.width - viewportPadding,
        );
        const top = Math.max(viewportPadding, rect.top - menuRect.height - gap);
        this.menu.style.left = `${left}px`;
        this.menu.style.top = `${top}px`;
    }
}

let canvasZoomMenuStylesInjected = false;

export function injectCanvasZoomMenuStyles(): void {
    if (canvasZoomMenuStylesInjected || typeof document === 'undefined') return;
    canvasZoomMenuStylesInjected = true;
    const style = document.createElement('style');
    style.setAttribute('data-axhub-canvas-zoom-menu-styles', 'true');
    style.textContent = `
.axhub-canvas-zoom-menu {
    position: fixed;
    z-index: 10000;
    min-width: 184px;
    padding: 6px;
    border: 1px solid var(--default-border-color, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
    background: var(--island-bg-color, #ffffff);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
    color: var(--text-primary-color, #1f2937);
    font: 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.axhub-canvas-zoom-menu-item {
    display: flex;
    width: 100%;
    min-height: 30px;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 0 8px;
    text-align: left;
    white-space: nowrap;
}

.axhub-canvas-zoom-menu-item:hover,
.axhub-canvas-zoom-menu-item:focus-visible {
    background: var(--button-hover-bg, rgba(0, 0, 0, 0.06));
    outline: none;
}

.axhub-canvas-zoom-menu-shortcut {
    color: var(--text-muted-color, #6b7280);
    font-size: 12px;
}

.axhub-canvas-zoom-menu-separator {
    height: 1px;
    margin: 5px 4px;
    background: var(--default-border-color, rgba(0, 0, 0, 0.1));
}
`;
    document.head.appendChild(style);
}
