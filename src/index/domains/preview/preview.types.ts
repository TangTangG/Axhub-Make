export interface PreviewBridgeController {
    postToPreview: (payload: any, iframe?: HTMLIFrameElement | null) => boolean;
    waitForPreviewIframeReady: (options?: {
        previousIframe?: HTMLIFrameElement | null;
        expectedEditor?: string;
        timeoutMs?: number;
    }) => Promise<HTMLIFrameElement | null>;
}
