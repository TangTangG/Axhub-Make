import { useCallback } from 'react';

export function usePreviewBridge(
    getIframeOrigin: (iframe?: HTMLIFrameElement | null) => string,
    getPreviewIframe: () => HTMLIFrameElement | null,
) {
    const postToPreview = useCallback((payload: any, iframe?: HTMLIFrameElement | null) => {
        const targetIframe = iframe ?? getPreviewIframe();
        if (!targetIframe || !targetIframe.contentWindow) {
            return false;
        }
        targetIframe.contentWindow.postMessage(payload, getIframeOrigin(targetIframe));
        return true;
    }, [getIframeOrigin, getPreviewIframe]);

    return {
        postToPreview,
    };
}
