import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createElementScreenshotFileName,
  derivePrototypePageScreenshotUrl,
  derivePrototypeScreenshotUrl,
  getPrototypePageScreenshotFileName,
  persistPrototypeScreenshot,
} from './screenshotPersistence';

describe('screenshot persistence helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates page screenshot filenames from safe page ids', () => {
    expect(getPrototypePageScreenshotFileName('checkout-step-1')).toBe('page-checkout-step-1.png');
    expect(getPrototypePageScreenshotFileName(' checkout-step-1 ')).toBe('page-checkout-step-1.png');
    expect(getPrototypePageScreenshotFileName('Checkout Step')).toBeUndefined();
    expect(getPrototypePageScreenshotFileName('../outside')).toBeUndefined();
  });

  it('derives page screenshot URLs beside prototype screenshot URLs', () => {
    vi.stubGlobal('window', { location: { origin: 'http://admin.local' } });

    expect(derivePrototypeScreenshotUrl('/prototypes/home')).toBe(
      'http://admin.local/prototypes/home/canvas-assets/screenshot.png',
    );
    expect(derivePrototypePageScreenshotUrl('/prototypes/home', 'settings')).toBe(
      'http://admin.local/prototypes/home/canvas-assets/page-settings.png',
    );
    expect(derivePrototypePageScreenshotUrl('/prototypes/home', '../settings')).toBeUndefined();
  });

  it('persists page screenshots using pageId instead of element screenshots', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://admin.local' } });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      screenshotUrl: '/prototypes/home/canvas-assets/page-settings.png?v=123',
      path: 'src/prototypes/home/canvas-assets/page-settings.png',
      width: 393,
      height: 852,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await persistPrototypeScreenshot({
      previewUrl: '/prototypes/home#page=settings',
      pageId: 'settings',
      elementId: 'embed-1',
      dataUrl: 'data:image/png;base64,abc',
      width: 393,
      height: 852,
    });

    expect(createElementScreenshotFileName('embed-1')).toBe('embed-embed-1.png');
    expect(fetchMock).toHaveBeenCalledWith('/api/canvas/prototypes/home/screenshot', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elementId: undefined,
        pageId: 'settings',
        fileName: 'page-settings.png',
        dataUrl: 'data:image/png;base64,abc',
        width: 393,
        height: 852,
      }),
    }));
    expect(result).toMatchObject({
      screenshotUrl: 'http://admin.local/prototypes/home/canvas-assets/page-settings.png?v=123',
      path: 'src/prototypes/home/canvas-assets/page-settings.png',
      width: 393,
      height: 852,
    });
  });
});
