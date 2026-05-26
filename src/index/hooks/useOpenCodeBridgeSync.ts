import { useEffect, useRef } from 'react';
import type { UseAxhubBridgeReturn } from './useAxhubBridge';
import type { ItemData, ViewMode, CanvasItem } from '../types';
import type { ResourceSection, SidebarTab, ThemeResourceItem } from '../types/index-page.types';
import {
    CONTEXT_ID_CURRENT_FILE,
    resolveOpenCodeCurrentFileContext,
    resolveOpenCodeCurrentFilePath,
} from './openCodeBridgeContext';

/**
 * Parameters for the current file resolution — mirrors the pattern used by
 * `resolveAssistantCurrentFile` in the Genie integration.
 */
interface UseOpenCodeBridgeSyncParams {
    bridge: UseAxhubBridgeReturn;
    /** Selected prototype page. */
    selectedItem: ItemData | null;
    /** Selected document item. */
    selectedDoc: ItemData | null;
    /** Selected canvas item. */
    selectedCanvas: CanvasItem | null;
    /** Selected theme/design resource. */
    selectedTheme?: ThemeResourceItem | null;
    /** Current resource subsection within the design sidebar. */
    resourceSection?: ResourceSection;
    /** Current sidebar tab (prototype / document / canvas / assets). */
    sidebarTab: SidebarTab;
    /** Current view mode within prototype tab (demo / canvas). */
    viewMode: ViewMode;
}

/**
 * Automatically synchronise the "current file" context item on the OpenCode
 * bridge whenever the user's active selection changes in the Make Admin UI.
 *
 * This mirrors how Genie receives `currentFile` updates — except here we push
 * a single `context:update` (or `context:add`) message through the bridge
 * relay so that OpenCode's injected hug.js can include the file reference in
 * the next prompt submission.
 */
export function useOpenCodeBridgeSync(params: UseOpenCodeBridgeSyncParams): void {
    const { bridge } = params;
    const prevSignatureRef = useRef('');

    // Derive the current file path
    const currentFilePath = resolveOpenCodeCurrentFilePath(params);
    const contextItem = resolveOpenCodeCurrentFileContext(params);

    useEffect(() => {
        // Only sync when the bridge is actually connected
        if (bridge.connectionState !== 'connected') {
            return;
        }

        const hasCurrentFileContext = bridge.contexts.some((item) => item.id === CONTEXT_ID_CURRENT_FILE);

        const contextSignature = contextItem ? JSON.stringify(contextItem) : '';

        if (!currentFilePath) {
            // Remove the current-file context item when nothing is selected
            if (hasCurrentFileContext || prevSignatureRef.current) {
                bridge.removeContext(CONTEXT_ID_CURRENT_FILE);
            }
            prevSignatureRef.current = '';
            return;
        }

        if (contextItem) {
            if (!hasCurrentFileContext) {
                bridge.addContext(contextItem);
                prevSignatureRef.current = contextSignature;
                return;
            }

            if (contextSignature !== prevSignatureRef.current) {
                bridge.updateContext(contextItem);
                prevSignatureRef.current = contextSignature;
            }
        }
    }, [bridge, contextItem, currentFilePath]);
}
