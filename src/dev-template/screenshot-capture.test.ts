import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dev-template screenshot capture source', () => {
  it('keeps screenshot capture resilient when page images fail to load', () => {
    const source = readFileSync(resolve(__dirname, './index.tsx'), 'utf8');

    expect(source).toContain('imagePlaceholder: SCREENSHOT_IMAGE_PLACEHOLDER_DATA_URL');
    expect(source).toContain('onImageErrorHandler:');
    expect(source).toContain('canvasWidth: width');
    expect(source).toContain('canvasHeight: height');
  });

  it('echoes screenshot request ids and prefers snapdom capture with html-to-image fallback', () => {
    const source = readFileSync(resolve(__dirname, './index.tsx'), 'utf8');

    expect(source).toContain("const screenshotRequestId = typeof event.data.requestId === 'string'");
    expect(source).toContain("await import('@zumer/snapdom')");
    expect(source).toContain('await captureRootWithSnapdom(rootElement');
    expect(source).toContain('return captureRootWithHtmlToImage(rootElement');
    expect(source).toContain('requestId: screenshotRequestId');
    expect(source).toContain("type: 'SCREENSHOT_FAILED'");
    expect(source).toContain('requestId: screenshotRequestId');
  });

  it('captures the requested iframe viewport instead of the full page scroll height', () => {
    const source = readFileSync(resolve(__dirname, './index.tsx'), 'utf8');

    expect(source).toContain('const captureWidth = targetWidth ?? rootElement.scrollWidth;');
    expect(source).toContain('const captureHeight = targetHeight ?? rootElement.scrollHeight;');
    expect(source).toContain('dataUrl = await captureRootScreenshot(rootElement, captureWidth, captureHeight);');
    expect(source).toContain('width: captureWidth');
    expect(source).toContain('height: captureHeight');
  });

  it('settles responsive layout after resizing the iframe viewport before capture', () => {
    const source = readFileSync(resolve(__dirname, './index.tsx'), 'utf8');

    expect(source).toContain('function setScreenshotViewportSize(');
    expect(source).toContain('function restoreScreenshotViewportSize(');
    expect(source).toContain('async function settleScreenshotLayout()');
    expect(source).toContain("window.dispatchEvent(new Event('resize'));");
    expect(source).toContain('await settleScreenshotLayout();');
    expect(source).toContain('document.documentElement.style.width = `${roundedWidth}px`;');
    expect(source).toContain('document.documentElement.style.height = `${roundedHeight}px`;');
    expect(source).toContain('document.body.style.minHeight = `${roundedHeight}px`;');
    expect(source).toContain('applyRootSize(nextWidth, nextHeight);');
    expect(source).toContain('restoreScreenshotViewportSize(rootElement, originalViewportSize);');
    expect(source).toContain("window.dispatchEvent(new Event('resize'));");
  });

  it('can hide native scrollbars for canvas embeds before live display and screenshot capture', () => {
    const source = readFileSync(resolve(__dirname, './index.tsx'), 'utf8');

    expect(source).toContain('const EMBED_SCROLLBAR_HIDING_STYLE_ID');
    expect(source).toContain('const EMBED_SCROLLBAR_HIDING_CSS');
    expect(source).toContain('function ensureEmbedScrollbarHidingStyle()');
    expect(source).toContain("event.data.type === 'AXHUB_HIDE_NATIVE_SCROLLBARS'");
    expect(source).toContain('ensureEmbedScrollbarHidingStyle();');
    expect(source).toContain('*::-webkit-scrollbar');
    expect(source).toContain('scrollbar-width: none !important;');
    expect(source).toContain('-ms-overflow-style: none !important;');
    expect(source).not.toContain('overflow: hidden !important');
  });
});
