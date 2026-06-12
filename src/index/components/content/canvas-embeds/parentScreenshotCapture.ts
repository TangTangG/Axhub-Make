import type { SnapdomOptions } from '@zumer/snapdom';

export interface CaptureSameOriginIframeScreenshotParams {
    iframe: HTMLIFrameElement;
    width: number;
    height: number;
}

export interface CaptureSameOriginIframeScreenshotResult {
    dataUrl: string;
    width: number;
    height: number;
}

type SnapdomToPng = (element: Element, options?: SnapdomOptions) => Promise<HTMLImageElement>;
type ParentScreenshotTestGlobal = typeof globalThis & {
    __AXHUB_PARENT_SCREENSHOT_TEST_SNAPDOM_TO_PNG__?: SnapdomToPng | null;
};

const PARENT_SCREENSHOT_SETTLE_DELAY_MS = 80;
const BLANK_SCREENSHOT_SAMPLE_SIZE = 24;

function normalizeCaptureSize(value: number): number {
    return Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : 1;
}

function getSameOriginIframeDocument(iframe: HTMLIFrameElement): Document {
    try {
        const doc = iframe.contentDocument;
        if (!doc) {
            throw new Error('missing contentDocument');
        }
        return doc;
    } catch (error) {
        throw new Error(`Cannot capture screenshot: same-origin iframe is required (${String(error)})`);
    }
}

function normalizeComparableIframeUrl(value: string): string {
    if (!value || value === 'about:blank') {
        return value;
    }
    try {
        const baseUrl = typeof window !== 'undefined' && window.location?.href
            ? window.location.href
            : 'http://localhost/';
        const url = new URL(value, baseUrl);
        url.pathname = url.pathname.replace(/\/+$/u, '');
        return url.toString();
    } catch {
        return value;
    }
}

function getIframeCurrentUrl(iframe: HTMLIFrameElement, doc: Document): string {
    try {
        return iframe.contentWindow?.location.href || doc.location?.href || '';
    } catch {
        return doc.location?.href || '';
    }
}

function hasIframeReachedRequestedUrl(iframe: HTMLIFrameElement, doc: Document): boolean {
    const requestedUrl = iframe.getAttribute('src') || iframe.src || '';
    if (!requestedUrl || requestedUrl === 'about:blank') {
        return true;
    }
    return normalizeComparableIframeUrl(getIframeCurrentUrl(iframe, doc)) === normalizeComparableIframeUrl(requestedUrl);
}

function waitForNextIframeLoad(iframe: HTMLIFrameElement): Promise<void> {
    return new Promise((resolve) => {
        const handleLoad = () => {
            iframe.removeEventListener('load', handleLoad);
            resolve();
        };
        iframe.addEventListener('load', handleLoad);
    });
}

async function waitForIframeReady(iframe: HTMLIFrameElement): Promise<Document> {
    let doc = getSameOriginIframeDocument(iframe);
    while (doc.readyState !== 'complete' || !hasIframeReachedRequestedUrl(iframe, doc)) {
        await waitForNextIframeLoad(iframe);
        doc = getSameOriginIframeDocument(iframe);
    }
    return doc;
}

function waitForScreenshotFrame(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => resolve());
            return;
        }
        window.setTimeout(resolve, 16);
    });
}

async function settleIframeLayout(doc: Document): Promise<void> {
    await Promise.resolve(doc.fonts?.ready);
    await waitForScreenshotFrame();
    await waitForScreenshotFrame();
    await new Promise(resolve => window.setTimeout(resolve, PARENT_SCREENSHOT_SETTLE_DELAY_MS));
}

function dispatchIframeResize(iframe: HTMLIFrameElement, doc: Document) {
    try {
        const eventCtor = iframe.contentWindow?.Event || Event;
        iframe.contentWindow?.dispatchEvent(new eventCtor('resize'));
        return;
    } catch { /* ignore */ }

    try {
        const eventCtor = doc.defaultView?.Event || Event;
        doc.defaultView?.dispatchEvent(new eventCtor('resize'));
    } catch { /* ignore */ }
}

function setCaptureSize(iframe: HTMLIFrameElement, doc: Document, width: number, height: number): () => void {
    const rootElement = typeof doc.getElementById === 'function'
        ? doc.getElementById('root') as HTMLElement | null
        : null;
    const original = {
        iframeWidth: iframe.style.width,
        iframeHeight: iframe.style.height,
        iframeTransform: iframe.style.transform,
        iframeTransformOrigin: iframe.style.transformOrigin,
        documentWidth: doc.documentElement.style.width,
        documentHeight: doc.documentElement.style.height,
        documentOverflow: doc.documentElement.style.overflow,
        bodyWidth: doc.body?.style.width,
        bodyHeight: doc.body?.style.height,
        bodyMinHeight: doc.body?.style.minHeight,
        bodyOverflow: doc.body?.style.overflow,
        rootWidth: rootElement?.style.width,
        rootHeight: rootElement?.style.height,
        rootMinHeight: rootElement?.style.minHeight,
        rootOverflow: rootElement?.style.overflow,
    };

    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
    iframe.style.transform = 'none';
    iframe.style.transformOrigin = 'top left';
    doc.documentElement.style.width = `${width}px`;
    doc.documentElement.style.height = `${height}px`;
    doc.documentElement.style.overflow = 'hidden';
    if (doc.body) {
        doc.body.style.width = `${width}px`;
        doc.body.style.height = `${height}px`;
        doc.body.style.minHeight = `${height}px`;
        doc.body.style.overflow = 'hidden';
    }
    if (rootElement) {
        rootElement.style.width = `${width}px`;
        rootElement.style.height = `${height}px`;
        rootElement.style.minHeight = `${height}px`;
        rootElement.style.overflow = 'hidden';
    }
    dispatchIframeResize(iframe, doc);

    return () => {
        iframe.style.width = original.iframeWidth;
        iframe.style.height = original.iframeHeight;
        iframe.style.transform = original.iframeTransform;
        iframe.style.transformOrigin = original.iframeTransformOrigin;
        doc.documentElement.style.width = original.documentWidth;
        doc.documentElement.style.height = original.documentHeight;
        doc.documentElement.style.overflow = original.documentOverflow;
        if (doc.body) {
            doc.body.style.width = original.bodyWidth || '';
            doc.body.style.height = original.bodyHeight || '';
            doc.body.style.minHeight = original.bodyMinHeight || '';
            doc.body.style.overflow = original.bodyOverflow || '';
        }
        if (rootElement) {
            rootElement.style.width = original.rootWidth || '';
            rootElement.style.height = original.rootHeight || '';
            rootElement.style.minHeight = original.rootMinHeight || '';
            rootElement.style.overflow = original.rootOverflow || '';
        }
        dispatchIframeResize(iframe, doc);
    };
}

function getImageIntrinsicSize(image: HTMLImageElement): { width: number; height: number } {
    const width = Number(image.naturalWidth || image.width || 0);
    const height = Number(image.naturalHeight || image.height || 0);
    return {
        width: Number.isFinite(width) ? Math.round(width) : 0,
        height: Number.isFinite(height) ? Math.round(height) : 0,
    };
}

function normalizeSnapdomPngToViewport(
    doc: Document,
    image: HTMLImageElement,
    dataUrl: string,
    width: number,
    height: number,
): string {
    const imageSize = getImageIntrinsicSize(image);
    if (imageSize.width === width && imageSize.height === height) {
        return dataUrl;
    }
    if (imageSize.width <= 0 || imageSize.height <= 0 || typeof doc.createElement !== 'function') {
        return dataUrl;
    }

    const canvas = doc.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
        return dataUrl;
    }

    const sourceScale = Math.max(1, imageSize.width / width);
    const sourceWidth = Math.min(imageSize.width, Math.round(width * sourceScale));
    const sourceHeight = Math.min(imageSize.height, Math.round(height * sourceScale));
    context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
    const normalizedDataUrl = canvas.toDataURL('image/png');
    return normalizedDataUrl || dataUrl;
}

function isNearBlankScreenshot(doc: Document, image: HTMLImageElement): boolean {
    if (typeof doc.createElement !== 'function') {
        return false;
    }
    const imageSize = getImageIntrinsicSize(image);
    if (imageSize.width <= 0 || imageSize.height <= 0) {
        return true;
    }

    const canvas = doc.createElement('canvas');
    canvas.width = BLANK_SCREENSHOT_SAMPLE_SIZE;
    canvas.height = BLANK_SCREENSHOT_SAMPLE_SIZE;
    const context = canvas.getContext('2d');
    if (!context || typeof context.getImageData !== 'function') {
        return false;
    }

    try {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let sampled = 0;
        let nearWhiteOrTransparent = 0;
        for (let index = 0; index < pixels.length; index += 4) {
            sampled += 1;
            const red = pixels[index] ?? 255;
            const green = pixels[index + 1] ?? 255;
            const blue = pixels[index + 2] ?? 255;
            const alpha = pixels[index + 3] ?? 255;
            if (alpha <= 8 || (red >= 248 && green >= 248 && blue >= 248)) {
                nearWhiteOrTransparent += 1;
            }
        }
        return sampled > 0 && nearWhiteOrTransparent === sampled;
    } catch {
        return false;
    }
}

async function captureIframeWithSnapdom(doc: Document, iframe: HTMLIFrameElement, width: number, height: number): Promise<string> {
    const testSnapdomToPng = (globalThis as ParentScreenshotTestGlobal).__AXHUB_PARENT_SCREENSHOT_TEST_SNAPDOM_TO_PNG__;
    const snapdomToPng = testSnapdomToPng ?? (await import('@zumer/snapdom')).snapdom.toPng;
    const captureElement = doc.getElementById('root') || doc.body || doc.documentElement;
    const image = await snapdomToPng(captureElement, {
        width,
        height,
        dpr: 1,
        fast: true,
        embedFonts: true,
        cache: 'auto',
        placeholders: false,
        outerTransforms: false,
        outerShadows: false,
        backgroundColor: '#fff',
    });
    const dataUrl = image.src || image.getAttribute('src') || '';
    if (!dataUrl) {
        throw new Error('snapDOM returned an empty screenshot');
    }
    if (!dataUrl.startsWith('data:image/png')) {
        throw new Error('snapDOM returned a non-PNG screenshot');
    }
    if (isNearBlankScreenshot(doc, image)) {
        throw new Error('snapDOM returned a blank screenshot');
    }
    return normalizeSnapdomPngToViewport(doc, image, dataUrl, width, height);
}

export async function captureSameOriginIframeScreenshot({
    iframe,
    width,
    height,
}: CaptureSameOriginIframeScreenshotParams): Promise<CaptureSameOriginIframeScreenshotResult> {
    const captureWidth = normalizeCaptureSize(width);
    const captureHeight = normalizeCaptureSize(height);
    const doc = await waitForIframeReady(iframe);
    const restoreSize = setCaptureSize(iframe, doc, captureWidth, captureHeight);
    try {
        await settleIframeLayout(doc);
        const dataUrl = await captureIframeWithSnapdom(doc, iframe, captureWidth, captureHeight);
        return {
            dataUrl,
            width: captureWidth,
            height: captureHeight,
        };
    } finally {
        restoreSize();
    }
}
