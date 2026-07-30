/**
 * Canvas View State Persistence
 *
 * Persists viewport state (zoom, scroll position, background color) to
 * localStorage so users return to the same view when reopening a canvas.
 *
 * This is intentionally kept out of the server-side save payload to avoid
 * conflicts when multiple users or tabs access the same canvas file.
 */

const STORAGE_PREFIX = 'axhub-canvas-view:';
const VIEW_STATE_DEBOUNCE_MS = 300;
const VIEW_STATE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CanvasViewState {
    scrollX: number;
    scrollY: number;
    zoom: number;
    viewBackgroundColor?: string;
    updatedAt: number;
}

function storageKey(canvasName: string): string {
    return `${STORAGE_PREFIX}${canvasName}`;
}

/**
 * Load the persisted view state for a canvas.
 * Returns `null` if nothing is stored or the data is expired/corrupt.
 */
export function loadViewState(canvasName: string): CanvasViewState | null {
    try {
        const raw = localStorage.getItem(storageKey(canvasName));
        if (!raw) return null;
        const state: CanvasViewState = JSON.parse(raw);
        if (
            typeof state.scrollX !== 'number'
            || typeof state.scrollY !== 'number'
            || typeof state.zoom !== 'number'
        ) {
            return null;
        }
        // Expire stale entries
        if (Date.now() - (state.updatedAt || 0) > VIEW_STATE_MAX_AGE_MS) {
            localStorage.removeItem(storageKey(canvasName));
            return null;
        }
        return state;
    } catch {
        return null;
    }
}

/**
 * Write view state to localStorage (called directly — debounce is managed
 * by the caller via `createViewStateSaver`).
 */
function writeViewState(canvasName: string, appState: any): void {
    try {
        const state: CanvasViewState = {
            scrollX: appState.scrollX ?? 0,
            scrollY: appState.scrollY ?? 0,
            zoom: appState.zoom?.value ?? 1,
            viewBackgroundColor: appState.viewBackgroundColor,
            updatedAt: Date.now(),
        };
        localStorage.setItem(storageKey(canvasName), JSON.stringify(state));
    } catch {
        // localStorage can be full or unavailable — silently ignore
    }
}

/**
 * Remove the persisted view state for a canvas.
 */
export function clearViewState(canvasName: string): void {
    try {
        localStorage.removeItem(storageKey(canvasName));
    } catch {
        // ignore
    }
}

/**
 * Purge all expired view-state entries from localStorage.
 * Called lazily on load to keep storage tidy.
 */
export function purgeExpiredViewStates(): void {
    try {
        const now = Date.now();
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith(STORAGE_PREFIX)) continue;
            try {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const state = JSON.parse(raw);
                if (now - (state.updatedAt || 0) > VIEW_STATE_MAX_AGE_MS) {
                    keysToRemove.push(key);
                }
            } catch {
                keysToRemove.push(key!);
            }
        }
        for (const key of keysToRemove) {
            localStorage.removeItem(key);
        }
    } catch {
        // ignore
    }
}

/**
 * Merge a persisted view state into Excalidraw initialData.
 * Returns a new object — does NOT mutate the input.
 */
export function mergeViewStateIntoInitialData(
    initialData: any,
    viewState: CanvasViewState | null,
): any {
    if (!viewState) return initialData;

    return {
        ...initialData,
        appState: {
            ...(initialData?.appState || {}),
            scrollX: viewState.scrollX,
            scrollY: viewState.scrollY,
            zoom: { value: viewState.zoom },
        },
    };
}

/**
 * Create a debounced view-state saver bound to a specific canvas name ref.
 * Returns `{ save, flush, dispose }`.
 */
export function createViewStateSaver(
    getCanvasName: () => string,
): {
    save: (appState: any) => void;
    flush: () => void;
    dispose: () => void;
} {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingAppState: any = null;

    const flush = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        if (pendingAppState) {
            writeViewState(getCanvasName(), pendingAppState);
            pendingAppState = null;
        }
    };

    const save = (appState: any) => {
        pendingAppState = appState;
        if (timer) clearTimeout(timer);
        timer = setTimeout(flush, VIEW_STATE_DEBOUNCE_MS);
    };

    const dispose = () => {
        flush();
        timer = null;
        pendingAppState = null;
    };

    return { save, flush, dispose };
}
