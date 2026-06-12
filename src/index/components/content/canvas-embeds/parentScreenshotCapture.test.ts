import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { captureSameOriginIframeScreenshot } from './parentScreenshotCapture';

const snapdomToPng = vi.fn();

class FakeHTMLElement {
  style: Record<string, string> = {
    width: '',
    height: '',
  };
  private attributes = new Map<string, string>();

  constructor(public readonly tagName = 'DIV') {}

  getAttribute(name: string) {
    return this.attributes.get(name) || '';
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

class FakeCanvas {
  width = 0;
  height = 0;
  drawImage = vi.fn();
  getImageData = vi.fn(() => ({
    data: new Uint8ClampedArray([
      10, 20, 30, 255,
      250, 250, 250, 255,
    ]),
  }));
  toDataURL = vi.fn(() => 'data:image/png;base64,cmVzYW1wbGVk');

  getContext(type: string) {
    return type === '2d' ? this : null;
  }
}

function createFakeImage(src = 'data:image/png;base64,cm9vdA==') {
  return {
    src,
    naturalWidth: 390,
    naturalHeight: 846,
    width: 390,
    height: 846,
    getAttribute: vi.fn(),
  };
}

class FakeIframe extends FakeHTMLElement {
  contentDocument: any = null;
  contentWindow: any = {};
  complete = true;
  private listeners = new Map<string, Array<() => void>>();

  constructor() {
    super('IFRAME');
  }

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(type, listeners.filter((item) => item !== listener));
  }

  emit(type: string) {
    for (const listener of this.listeners.get(type) || []) {
      listener();
    }
  }
}

function createSameOriginIframe() {
  const iframe = new FakeIframe();
  const rootElement = new FakeHTMLElement('DIV');
  iframe.style.width = '10px';
  iframe.style.height = '20px';
  iframe.style.transform = 'scale(0.5)';
  iframe.style.transformOrigin = 'top left';
  iframe.contentDocument = {
    readyState: 'complete',
    fonts: {
      ready: Promise.resolve(),
    },
    documentElement: new FakeHTMLElement('HTML'),
    body: new FakeHTMLElement('BODY'),
    createElement: vi.fn((tagName: string) => (
      tagName === 'canvas' ? new FakeCanvas() : new FakeHTMLElement(tagName.toUpperCase())
    )),
    getElementById: vi.fn((id: string) => (id === 'root' ? rootElement : null)),
  };
  return iframe;
}

describe('captureSameOriginIframeScreenshot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    snapdomToPng.mockReset();
    (globalThis as any).__AXHUB_PARENT_SCREENSHOT_TEST_SNAPDOM_TO_PNG__ = snapdomToPng;
    vi.stubGlobal('window', {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
      setTimeout,
      clearTimeout,
    });
  });

  afterEach(() => {
    delete (globalThis as any).__AXHUB_PARENT_SCREENSHOT_TEST_SNAPDOM_TO_PNG__;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('captures a same-origin iframe as PNG with snapDOM', async () => {
    const iframe = createSameOriginIframe();
    snapdomToPng.mockResolvedValue(createFakeImage('data:image/png;base64,cGFyZW50'));

    const resultPromise = captureSameOriginIframeScreenshot({
      iframe: iframe as unknown as HTMLIFrameElement,
      width: 390,
      height: 846,
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(snapdomToPng).toHaveBeenCalledWith(iframe.contentDocument.getElementById('root'), expect.objectContaining({
      width: 390,
      height: 846,
      dpr: 1,
      fast: true,
      embedFonts: true,
      cache: 'auto',
      placeholders: false,
      outerTransforms: false,
      outerShadows: false,
      backgroundColor: '#fff',
    }));
    expect(snapdomToPng.mock.calls[0][1]).not.toHaveProperty('scale');
    expect(result).toEqual({
      dataUrl: 'data:image/png;base64,cGFyZW50',
      width: 390,
      height: 846,
    });
    expect(iframe.style.width).toBe('10px');
    expect(iframe.style.height).toBe('20px');
    expect(iframe.style.transform).toBe('scale(0.5)');
    expect(iframe.style.transformOrigin).toBe('top left');
    expect(iframe.contentDocument.getElementById('root').style.width).toBe('');
    expect(iframe.contentDocument.getElementById('root').style.height).toBe('');
  });

  it('sizes the iframe app root to the requested viewport during capture', async () => {
    const iframe = createSameOriginIframe();
    const rootElement = iframe.contentDocument.getElementById('root');
    rootElement.style.width = 'old-root-width';
    rootElement.style.height = 'old-root-height';
    snapdomToPng.mockImplementation(async () => {
      expect(rootElement.style.width).toBe('1440px');
      expect(rootElement.style.height).toBe('900px');
      expect(rootElement.style.minHeight).toBe('900px');
      expect(rootElement.style.overflow).toBe('hidden');
      return createFakeImage();
    });

    const resultPromise = captureSameOriginIframeScreenshot({
      iframe: iframe as unknown as HTMLIFrameElement,
      width: 1440,
      height: 900,
    });
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(rootElement.style.width).toBe('old-root-width');
    expect(rootElement.style.height).toBe('old-root-height');
    expect(rootElement.style.minHeight).toBe('');
    expect(rootElement.style.overflow).toBe('');
  });

  it('captures the iframe app root instead of the iframe shell', async () => {
    const iframe = createSameOriginIframe();
    snapdomToPng.mockResolvedValue(createFakeImage());

    const resultPromise = captureSameOriginIframeScreenshot({
      iframe: iframe as unknown as HTMLIFrameElement,
      width: 390,
      height: 846,
    });
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(snapdomToPng).toHaveBeenCalledWith(
      iframe.contentDocument.getElementById('root'),
      expect.any(Object),
    );
    expect(snapdomToPng).not.toHaveBeenCalledWith(
      iframe,
      expect.any(Object),
    );
  });

  it('fails near-blank screenshots so old persisted screenshots are not overwritten', async () => {
    const iframe = createSameOriginIframe();
    const canvas = new FakeCanvas();
    canvas.getImageData = vi.fn(() => ({
      data: new Uint8ClampedArray(4 * 8).fill(255),
    }));
    iframe.contentDocument.createElement = vi.fn((tagName: string) => (
      tagName === 'canvas' ? canvas : new FakeHTMLElement(tagName.toUpperCase())
    ));
    snapdomToPng.mockResolvedValue(createFakeImage('data:image/png;base64,d2hpdGU='));

    const resultPromise = captureSameOriginIframeScreenshot({
      iframe: iframe as unknown as HTMLIFrameElement,
      width: 390,
      height: 846,
    });
    const expectation = expect(resultPromise).rejects.toThrow('blank screenshot');
    await vi.runAllTimersAsync();

    await expectation;
  });

  it('normalizes oversized snapDOM output back to the requested viewport PNG size', async () => {
    const iframe = createSameOriginIframe();
    const canvas = new FakeCanvas();
    const createElement = vi.fn((tagName: string) => (
      tagName === 'canvas' ? canvas : new FakeHTMLElement(tagName.toUpperCase())
    ));
    iframe.contentDocument.createElement = createElement;
    snapdomToPng.mockResolvedValue({
      src: 'data:image/png;base64,b3ZlcnNpemVk',
      naturalWidth: 2880,
      naturalHeight: 3990,
      width: 2880,
      height: 3990,
      getAttribute: vi.fn(),
    });

    const resultPromise = captureSameOriginIframeScreenshot({
      iframe: iframe as unknown as HTMLIFrameElement,
      width: 1440,
      height: 900,
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(createElement).toHaveBeenCalledWith('canvas');
    expect(canvas.width).toBe(1440);
    expect(canvas.height).toBe(900);
    expect(canvas.drawImage).toHaveBeenCalledWith(
      expect.objectContaining({ src: 'data:image/png;base64,b3ZlcnNpemVk' }),
      0,
      0,
      2880,
      1800,
      0,
      0,
      1440,
      900,
    );
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png');
    expect(result).toEqual({
      dataUrl: 'data:image/png;base64,cmVzYW1wbGVk',
      width: 1440,
      height: 900,
    });
  });

  it('waits for the requested iframe URL instead of capturing initial about:blank', async () => {
    const iframe = createSameOriginIframe();
    iframe.setAttribute('src', 'http://admin.local/prototypes/home#page=settings');
    iframe.contentWindow = {
      location: { href: 'about:blank' },
    };
    iframe.contentDocument.location = { href: 'about:blank' };
    snapdomToPng.mockResolvedValue(createFakeImage('data:image/png;base64,cGFyZW50'));

    const resultPromise = captureSameOriginIframeScreenshot({
      iframe: iframe as unknown as HTMLIFrameElement,
      width: 390,
      height: 846,
    });
    await vi.runAllTimersAsync();
    expect(snapdomToPng).not.toHaveBeenCalled();

    iframe.contentWindow.location.href = 'http://admin.local/prototypes/home#page=settings';
    iframe.contentDocument.location.href = 'http://admin.local/prototypes/home#page=settings';
    iframe.emit('load');
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.dataUrl).toBe('data:image/png;base64,cGFyZW50');
    expect(snapdomToPng).toHaveBeenCalledOnce();
  });

  it('treats equivalent loaded iframe paths as ready even when the browser normalizes the URL', async () => {
    const iframe = createSameOriginIframe();
    iframe.setAttribute('src', 'http://admin.local/prototypes/home#page=settings');
    iframe.contentWindow = {
      location: { href: 'http://admin.local/prototypes/home/#page=settings' },
    };
    iframe.contentDocument.location = { href: 'http://admin.local/prototypes/home/#page=settings' };
    snapdomToPng.mockResolvedValue(createFakeImage('data:image/png;base64,cGFyZW50'));

    const resultPromise = captureSameOriginIframeScreenshot({
      iframe: iframe as unknown as HTMLIFrameElement,
      width: 390,
      height: 846,
    });
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.dataUrl).toBe('data:image/png;base64,cGFyZW50');
    expect(snapdomToPng).toHaveBeenCalledOnce();
  });

  it('fails when iframe contentDocument is inaccessible', async () => {
    const iframe = new FakeIframe();
    iframe.contentDocument = null;

    await expect(captureSameOriginIframeScreenshot({
      iframe: iframe as unknown as HTMLIFrameElement,
      width: 100,
      height: 200,
    })).rejects.toThrow('same-origin iframe');
    expect(snapdomToPng).not.toHaveBeenCalled();
  });

  it('restores iframe and root styles when snapDOM throws', async () => {
    const iframe = createSameOriginIframe();
    iframe.contentDocument.documentElement.style.width = 'html-auto';
    iframe.contentDocument.documentElement.style.overflow = 'html-overflow';
    iframe.contentDocument.body.style.height = 'body-auto';
    iframe.contentDocument.body.style.overflow = 'body-overflow';
    snapdomToPng.mockRejectedValue(new Error('snapdom failed'));

    const resultPromise = captureSameOriginIframeScreenshot({
      iframe: iframe as unknown as HTMLIFrameElement,
      width: 320,
      height: 480,
    });
    const expectation = expect(resultPromise).rejects.toThrow('snapdom failed');
    await vi.runAllTimersAsync();

    await expectation;
    expect(iframe.style.width).toBe('10px');
    expect(iframe.style.height).toBe('20px');
    expect(iframe.style.transform).toBe('scale(0.5)');
    expect(iframe.style.transformOrigin).toBe('top left');
    expect(iframe.contentDocument.documentElement.style.width).toBe('html-auto');
    expect(iframe.contentDocument.documentElement.style.overflow).toBe('html-overflow');
    expect(iframe.contentDocument.body.style.height).toBe('body-auto');
    expect(iframe.contentDocument.body.style.overflow).toBe('body-overflow');
  });

  it('fails when snapDOM returns an empty image', async () => {
    const iframe = createSameOriginIframe();
    snapdomToPng.mockResolvedValue({
      src: '',
      getAttribute: vi.fn(() => ''),
    });

    const resultPromise = captureSameOriginIframeScreenshot({
      iframe: iframe as unknown as HTMLIFrameElement,
      width: 320,
      height: 480,
    });
    const expectation = expect(resultPromise).rejects.toThrow('empty screenshot');
    await vi.runAllTimersAsync();

    await expectation;
  });
});
