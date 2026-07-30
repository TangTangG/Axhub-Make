/**
 * Canvas Local Cache — IndexedDB persistence layer
 *
 * Provides a fast local cache for canvas content so that:
 * 1. Short-interval saves go to IndexedDB (2s debounce) instead of the server.
 * 2. Long-interval saves (30s or idle) flush to the server via PUT.
 * 3. On page load, if IndexedDB has a newer version than the server, the user
 *    can recover unsaved work.
 */

const DB_NAME = 'axhub-canvas-cache';
const DB_VERSION = 1;
const STORE_NAME = 'canvases';

export interface CachedCanvas {
    canvasName: string;
    /** Full JSON string of the canvas data (same format as PUT body). */
    content: string;
    /** Timestamp when this entry was written to IndexedDB. */
    savedAt: number;
    /** Whether this version has been successfully synced to the server. */
    syncedToServer: boolean;
}

// ── IndexedDB helpers ──

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'canvasName' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function withStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    return openDB().then(
        (db) =>
            new Promise<T>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, mode);
                const store = tx.objectStore(STORE_NAME);
                const req = fn(store);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
                tx.oncomplete = () => db.close();
                tx.onerror = () => {
                    db.close();
                    reject(tx.error);
                };
            }),
    );
}

// ── Public API ──

/**
 * Save canvas content to IndexedDB.
 */
export async function saveToLocal(canvasName: string, content: string): Promise<void> {
    const entry: CachedCanvas = {
        canvasName,
        content,
        savedAt: Date.now(),
        syncedToServer: false,
    };
    await withStore('readwrite', (store) => store.put(entry));
}

/**
 * Load the cached canvas from IndexedDB.
 * Returns `null` if nothing is cached.
 */
export async function loadFromLocal(canvasName: string): Promise<CachedCanvas | null> {
    try {
        const result = await withStore<CachedCanvas | undefined>('readonly', (store) =>
            store.get(canvasName),
        );
        return result ?? null;
    } catch {
        return null;
    }
}

/**
 * Mark a canvas entry as synced to the server.
 */
export async function markSynced(canvasName: string): Promise<void> {
    try {
        const existing = await loadFromLocal(canvasName);
        if (!existing) return;
        await withStore('readwrite', (store) =>
            store.put({ ...existing, syncedToServer: true }),
        );
    } catch {
        // best-effort
    }
}

/**
 * Remove the local cache entry for a canvas.
 */
export async function removeLocal(canvasName: string): Promise<void> {
    try {
        await withStore('readwrite', (store) => store.delete(canvasName));
    } catch {
        // ignore
    }
}

/**
 * Get all canvas entries that haven't been synced to the server.
 */
export async function getUnsyncedCanvases(): Promise<CachedCanvas[]> {
    try {
        const all = await withStore<CachedCanvas[]>('readonly', (store) => store.getAll());
        return (all || []).filter((entry) => !entry.syncedToServer);
    } catch {
        return [];
    }
}

/**
 * Check if the local cache has a newer version than the server.
 * `serverContent` is the normalized JSON string from the server response.
 */
export function isLocalNewer(
    cached: CachedCanvas | null,
    serverContent: string,
): boolean {
    if (!cached) return false;
    if (cached.syncedToServer) return false;
    // Content differs AND local is newer
    return cached.content !== serverContent;
}
