import { useCallback, useRef, type MutableRefObject, type RefObject } from 'react';
import type { PreviewConfig } from '../../domains/device/preview-layout';
import type { PreviewPane } from './previewActions.helpers';

type UsePreviewIframeActionsParams = {
    previewMode: PreviewConfig['previewMode'];
    messageApi: {
        warning: (content: string) => void;
    };
};

type PreviewIframeActions = {
    containerRef: RefObject<HTMLDivElement>;
    previewIframeRef: MutableRefObject<HTMLIFrameElement | null>;
    secondaryPreviewIframeRef: MutableRefObject<HTMLIFrameElement | null>;
    getPrimaryPreviewIframe: () => HTMLIFrameElement | null;
    getSecondaryPreviewIframe: () => HTMLIFrameElement | null;
    getPreviewIframe: (pane?: PreviewPane) => HTMLIFrameElement | null;
    getPreviewIframes: () => HTMLIFrameElement[];
    getIframeOrigin: (iframe?: HTMLIFrameElement | null) => string;
    postToPreview: (payload: unknown, iframe?: HTMLIFrameElement | null) => boolean;
};

export function usePreviewIframeActions({
    previewMode,
    messageApi,
}: UsePreviewIframeActionsParams): PreviewIframeActions {
    const containerRef = useRef<HTMLDivElement>(null);
    const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
    const secondaryPreviewIframeRef = useRef<HTMLIFrameElement | null>(null);

    const getPrimaryPreviewIframe = useCallback(() => previewIframeRef.current, []);

    const getSecondaryPreviewIframe = useCallback(() => secondaryPreviewIframeRef.current, []);

    const getPreviewIframe = useCallback((pane: PreviewPane = 'primary') => (
        pane === 'secondary' ? getSecondaryPreviewIframe() : getPrimaryPreviewIframe()
    ), [getPrimaryPreviewIframe, getSecondaryPreviewIframe]);

    const getPreviewIframes = useCallback(() => {
        const iframes = [getPrimaryPreviewIframe()];
        if (previewMode === 'split') {
            iframes.push(getSecondaryPreviewIframe());
        }
        return iframes.filter(Boolean) as HTMLIFrameElement[];
    }, [getPrimaryPreviewIframe, getSecondaryPreviewIframe, previewMode]);

    const getIframeOrigin = useCallback((iframe?: HTMLIFrameElement | null) => {
        const targetIframe = iframe ?? getPrimaryPreviewIframe();
        if (!targetIframe) return window.location.origin;
        const src = targetIframe.getAttribute('src') || targetIframe.src;
        if (!src) return window.location.origin;
        try {
            return new URL(src, window.location.origin).origin;
        } catch {
            return window.location.origin;
        }
    }, [getPrimaryPreviewIframe]);

    const postToPreview = useCallback((payload: unknown, iframe?: HTMLIFrameElement | null) => {
        const targetIframe = iframe ?? getPrimaryPreviewIframe();
        if (!targetIframe || !targetIframe.contentWindow) {
            messageApi.warning('未找到可操作的预览窗口');
            return false;
        }
        targetIframe.contentWindow.postMessage(payload, getIframeOrigin(targetIframe));
        return true;
    }, [getIframeOrigin, getPrimaryPreviewIframe, messageApi]);

    return {
        containerRef,
        previewIframeRef,
        secondaryPreviewIframeRef,
        getPrimaryPreviewIframe,
        getSecondaryPreviewIframe,
        getPreviewIframe,
        getPreviewIframes,
        getIframeOrigin,
        postToPreview,
    };
}
