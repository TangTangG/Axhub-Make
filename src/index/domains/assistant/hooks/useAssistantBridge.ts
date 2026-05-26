import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistantUpdateContextMessage, AssistantUpdatePromptMessage, GenieContextV1 } from '@/common/genie/types';

export function useAssistantBridge(iframeSrc: string) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const iframeLoadedRef = useRef(false);

    useEffect(() => {
        setIframeLoaded(false);
    }, [iframeSrc]);

    useEffect(() => {
        iframeLoadedRef.current = iframeLoaded;
    }, [iframeLoaded]);

    const resolveTargetOrigin = useCallback(() => {
        try {
            return new URL(iframeSrc).origin;
        } catch {
            return '*';
        }
    }, [iframeSrc]);

    const syncContext = useCallback((context: GenieContextV1, mode: 'replace' | 'append' = 'replace') => {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow) {
            return false;
        }

        const message: AssistantUpdateContextMessage = {
            type: 'update_context',
            mode,
            context: {
                version: context.version,
                systemContext: context.systemContext,
                currentFile: context.currentFile,
                selectedElements: context.selectedElements,
                extensions: context.extensions,
            },
        };

        try {
            iframe.contentWindow.postMessage(message, resolveTargetOrigin());
            return true;
        } catch {
            return false;
        }
    }, [resolveTargetOrigin]);

    const syncPrompt = useCallback((prompt: string, autoSend: boolean) => {
        const iframe = iframeRef.current;
        if (!iframe || !iframe.contentWindow) {
            return false;
        }

        const message: AssistantUpdatePromptMessage = {
            type: 'update_prompt',
            prompt,
            autoSend,
        };

        try {
            iframe.contentWindow.postMessage(message, resolveTargetOrigin());
            return true;
        } catch {
            return false;
        }
    }, [resolveTargetOrigin]);

    const syncContextWithRetry = useCallback((context: GenieContextV1, mode: 'replace' | 'append' = 'replace') => {
        syncContext(context, mode);
        if (mode === 'replace') {
            window.setTimeout(() => syncContext(context, mode), 160);
            window.setTimeout(() => syncContext(context, mode), 520);
        }
    }, [syncContext]);

    const waitForReady = useCallback(async (maxWaitMs = 8000) => {
        const startedAt = Date.now();
        while (Date.now() - startedAt < maxWaitMs) {
            if (iframeRef.current?.contentWindow && iframeLoadedRef.current) {
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, 120));
        }
        return false;
    }, []);

    return {
        iframeRef,
        iframeLoaded,
        setIframeLoaded,
        syncContext,
        syncContextWithRetry,
        syncPrompt,
        waitForReady,
    };
}
