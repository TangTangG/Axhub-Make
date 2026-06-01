import {
  buildOfficialClipboardPayloadFromCapturedDocument as buildOfficialClipboardPayloadFromCapturedDocumentImpl,
  captureDocumentForFigmaNew as captureDocumentForFigmaNewImpl,
  copyDocumentForFigmaNewOfficialClipboard as copyDocumentForFigmaNewOfficialClipboardImpl,
  htmlToAxure as htmlToAxureImpl,
  type CapturedDocument,
} from 'axhub-export-core';
import * as htmlToImage from 'html-to-image';

const SCREENSHOT_IMAGE_PROXY_PATH = '/api/export/image-proxy';
const SCREENSHOT_IMAGE_PLACEHOLDER_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"></svg>',
)}`;

export interface CaptureDocumentScreenshotOptions {
  targetWidth?: number;
  targetHeight?: number;
}

export interface CaptureDocumentScreenshotResult {
  dataUrl: string;
  width: number;
  height: number;
}

function getExportCoreOrigin(): string {
  try {
    return new URL(import.meta.url, window.location.href).origin;
  } catch {
    return window.location.origin;
  }
}

function buildScreenshotProxyUrl(rawUrl: string): string | null {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return null;
  }

  try {
    const absoluteUrl = new URL(rawUrl, document.baseURI).href;
    const parsedUrl = new URL(absoluteUrl);
    if (!/^https?:$/i.test(parsedUrl.protocol)) {
      return null;
    }
    if (parsedUrl.origin === window.location.origin) {
      return null;
    }
    return `${getExportCoreOrigin()}${SCREENSHOT_IMAGE_PROXY_PATH}?url=${encodeURIComponent(absoluteUrl)}`;
  } catch {
    return null;
  }
}

function extractBackgroundUrls(backgroundImage: string): string[] {
  const result: string[] = [];
  if (!backgroundImage || backgroundImage === 'none') {
    return result;
  }

  const regex = /url\((['"]?)(.*?)\1\)/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(backgroundImage)) !== null) {
    const url = String(match[2] || '').trim();
    if (url) {
      result.push(url);
    }
  }
  return result;
}

function rewriteElementImageUrlsForScreenshot(rootElement: HTMLElement): () => void {
  const restorers: Array<() => void> = [];
  const elements = [rootElement, ...Array.from(rootElement.querySelectorAll('*'))];

  elements.forEach((node) => {
    if (node instanceof HTMLImageElement) {
      const originalSrc = node.getAttribute('src');
      const displayedSrc = node.currentSrc || originalSrc;
      const proxySrc = displayedSrc ? buildScreenshotProxyUrl(displayedSrc) : null;
      if (!displayedSrc || !proxySrc) {
        return;
      }

      const originalSrcset = node.getAttribute('srcset');
      const originalSizes = node.getAttribute('sizes');
      node.setAttribute('src', proxySrc);
      node.removeAttribute('srcset');
      node.removeAttribute('sizes');

      restorers.push(() => {
        if (originalSrc !== null) {
          node.setAttribute('src', originalSrc);
        } else {
          node.removeAttribute('src');
        }
        if (originalSrcset !== null) {
          node.setAttribute('srcset', originalSrcset);
        } else {
          node.removeAttribute('srcset');
        }
        if (originalSizes !== null) {
          node.setAttribute('sizes', originalSizes);
        } else {
          node.removeAttribute('sizes');
        }
      });
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    const inlineBackgroundImage = node.style.backgroundImage;
    const computedBackgroundImage = window.getComputedStyle(node).backgroundImage;
    const sourceBackgroundImage = inlineBackgroundImage || computedBackgroundImage;
    const backgroundUrls = extractBackgroundUrls(sourceBackgroundImage);
    if (backgroundUrls.length === 0) {
      return;
    }

    let nextBackgroundImage = sourceBackgroundImage;
    let changed = false;
    backgroundUrls.forEach((backgroundUrl) => {
      const proxyUrl = buildScreenshotProxyUrl(backgroundUrl);
      if (!proxyUrl) {
        return;
      }

      const replacement = `url("${proxyUrl}")`;
      nextBackgroundImage = nextBackgroundImage
        .replace(`url(${backgroundUrl})`, replacement)
        .replace(`url('${backgroundUrl}')`, replacement)
        .replace(`url("${backgroundUrl}")`, replacement);
      changed = true;
    });

    if (!changed || nextBackgroundImage === sourceBackgroundImage) {
      return;
    }

    const previousInlineValue = node.style.backgroundImage;
    node.style.setProperty('background-image', nextBackgroundImage, 'important');
    restorers.push(() => {
      if (previousInlineValue) {
        node.style.backgroundImage = previousInlineValue;
      } else {
        node.style.removeProperty('background-image');
      }
    });
  });

  return () => {
    for (let index = restorers.length - 1; index >= 0; index -= 1) {
      restorers[index]();
    }
  };
}

function resolveScreenshotElement(selector: string | Element): HTMLElement {
  const element = typeof selector === 'string'
    ? document.querySelector(selector)
    : selector;
  if (!(element instanceof HTMLElement)) {
    throw new Error('captureDocumentScreenshot: target element not found');
  }
  return element;
}

function positiveNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.round(numberValue)
    : undefined;
}

function collectScreenshotSize(element: HTMLElement): { width: number; height: number } {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(Math.max(rect.width, element.scrollWidth, element.clientWidth, element.offsetWidth))),
    height: Math.max(1, Math.round(Math.max(rect.height, element.scrollHeight, element.clientHeight, element.offsetHeight))),
  };
}

export function copyDocumentForFigmaNewOfficialClipboard(selector: string | Element = 'body') {
  return copyDocumentForFigmaNewOfficialClipboardImpl(selector);
}

export function captureDocumentForFigmaNew(selector: string | Element = 'body') {
  return captureDocumentForFigmaNewImpl(selector);
}

export function buildOfficialClipboardPayloadFromCapturedDocument(capturedDoc: CapturedDocument) {
  return buildOfficialClipboardPayloadFromCapturedDocumentImpl(capturedDoc);
}

export function htmlToAxure(selector: string | Element = 'body', options?: any) {
  return htmlToAxureImpl(selector, options);
}

export async function captureDocumentScreenshot(
  selector: string | Element = 'body',
  options: CaptureDocumentScreenshotOptions = {},
): Promise<CaptureDocumentScreenshotResult> {
  const element = resolveScreenshotElement(selector);
  const targetWidth = positiveNumber(options.targetWidth);
  const targetHeight = positiveNumber(options.targetHeight);
  const originalStyle = {
    marginLeft: element.style.marginLeft,
    marginRight: element.style.marginRight,
    width: element.style.width,
    height: element.style.height,
  };

  element.style.marginLeft = '0';
  element.style.marginRight = '0';
  if (targetWidth) {
    element.style.width = `${targetWidth}px`;
  }
  if (targetHeight) {
    element.style.height = `${targetHeight}px`;
  }
  if (targetWidth || targetHeight) {
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  const restoreImageUrls = rewriteElementImageUrlsForScreenshot(element);
  try {
    await new Promise((resolve) => window.setTimeout(resolve, 80));
    const { width, height } = collectScreenshotSize(element);
    const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 2));
    const dataUrl = await htmlToImage.toPng(element, {
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
      pixelRatio,
      skipAutoScale: true,
      backgroundColor: '#fff',
      skipFonts: false,
      cacheBust: false,
      includeQueryParams: true,
      imagePlaceholder: SCREENSHOT_IMAGE_PLACEHOLDER_DATA_URL,
      onImageErrorHandler: (...args: unknown[]) => {
        console.warn('[Axhub Runtime Export] Screenshot ignored image loading failure', args);
      },
    });

    return { dataUrl, width, height };
  } finally {
    restoreImageUrls();
    element.style.marginLeft = originalStyle.marginLeft;
    element.style.marginRight = originalStyle.marginRight;
    element.style.width = originalStyle.width;
    element.style.height = originalStyle.height;
  }
}
