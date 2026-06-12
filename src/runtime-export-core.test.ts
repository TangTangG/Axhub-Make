import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { captureDocumentScreenshot } from './runtime-export-core';

const snapdomToPng = vi.fn();

class FakeHTMLElement {
  style: Record<string, string> & {
    setProperty: (name: string, value: string, priority?: string) => void;
    removeProperty: (name: string) => void;
  };
  scrollWidth = 0;
  scrollHeight = 0;
  clientWidth = 0;
  clientHeight = 0;
  offsetWidth = 0;
  offsetHeight = 0;

  constructor() {
    this.style = {
      marginLeft: '',
      marginRight: '',
      width: '',
      height: '',
      backgroundImage: '',
      setProperty: (name: string, value: string) => {
        this.style[name] = value;
        if (name === 'background-image') {
          this.style.backgroundImage = value;
        }
      },
      removeProperty: (name: string) => {
        delete this.style[name];
        if (name === 'background-image') {
          this.style.backgroundImage = '';
        }
      },
    };
  }

  getBoundingClientRect() {
    return { width: 0, height: 0 };
  }

  querySelectorAll() {
    return [];
  }
}

class FakeHTMLImageElement extends FakeHTMLElement {
  currentSrc = '';
  private attributes = new Map<string, string>();

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === 'src') {
      this.currentSrc = value;
    }
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
}

const originalGlobals = {
  HTMLElement: globalThis.HTMLElement,
  HTMLImageElement: globalThis.HTMLImageElement,
  document: globalThis.document,
  window: globalThis.window,
};

describe('runtime-export-core captureDocumentScreenshot', () => {
  beforeEach(() => {
    snapdomToPng.mockReset();
    (globalThis as any).__AXHUB_RUNTIME_EXPORT_CORE_TEST_SNAPDOM_TO_PNG__ = snapdomToPng;
    globalThis.HTMLElement = FakeHTMLElement as any;
    globalThis.HTMLImageElement = FakeHTMLImageElement as any;
    globalThis.window = {
      devicePixelRatio: 3,
      location: { href: 'http://localhost:51720/prototypes/home', origin: 'http://localhost:51720' },
      setTimeout: (callback: () => void) => {
        callback();
        return 1;
      },
      getComputedStyle: () => ({ backgroundImage: 'none' }),
    } as any;
    globalThis.document = {
      baseURI: 'http://localhost:51720/prototypes/home',
      querySelector: vi.fn(),
    } as any;
  });

  afterEach(() => {
    delete (globalThis as any).__AXHUB_RUNTIME_EXPORT_CORE_TEST_SNAPDOM_TO_PNG__;
    globalThis.HTMLElement = originalGlobals.HTMLElement;
    globalThis.HTMLImageElement = originalGlobals.HTMLImageElement;
    globalThis.document = originalGlobals.document;
    globalThis.window = originalGlobals.window;
  });

  it('captures a PNG with snapDOM using normalized dimensions and restores root styles', async () => {
    const element = new FakeHTMLElement();
    element.style.marginLeft = 'auto';
    element.style.marginRight = 'auto';
    element.style.width = '48%';
    element.style.height = 'auto';
    element.scrollWidth = 390.4;
    element.scrollHeight = 845.8;
    snapdomToPng.mockResolvedValue({
      src: 'data:image/png;base64,c25hcGRvbQ==',
      getAttribute: vi.fn(),
    });

    const result = await captureDocumentScreenshot(element as any, {
      targetWidth: 390.2,
      targetHeight: 845.6,
    });

    const [calledElement, calledOptions] = snapdomToPng.mock.calls[0];
    expect(calledElement).toBe(element);
    expect(calledOptions).toEqual(expect.objectContaining({
      width: 390,
      height: 846,
      dpr: 2,
      backgroundColor: '#fff',
      embedFonts: true,
      fallbackURL: expect.stringContaining('data:image/svg+xml'),
      cache: 'soft',
    }));
    expect(result).toEqual({
      dataUrl: 'data:image/png;base64,c25hcGRvbQ==',
      width: 390,
      height: 846,
    });
    expect(element.style.marginLeft).toBe('auto');
    expect(element.style.marginRight).toBe('auto');
    expect(element.style.width).toBe('48%');
    expect(element.style.height).toBe('auto');
  });

  it('uses an explicit screenshot pixel ratio when provided', async () => {
    const element = new FakeHTMLElement();
    element.scrollWidth = 390;
    element.scrollHeight = 846;
    snapdomToPng.mockResolvedValue({
      src: 'data:image/png;base64,c25hcGRvbQ==',
      getAttribute: vi.fn(),
    });

    await captureDocumentScreenshot(element as any, {
      targetWidth: 390,
      targetHeight: 846,
      targetPixelRatio: 1,
    });

    const [calledElement, calledOptions] = snapdomToPng.mock.calls[0];
    expect(calledElement).toBe(element);
    expect(calledOptions).toEqual(expect.objectContaining({
      dpr: 1,
    }));
  });

  it('throws when snapDOM returns an empty image and still restores styles', async () => {
    const element = new FakeHTMLElement();
    element.style.marginLeft = 'auto';
    element.style.marginRight = 'auto';
    element.scrollWidth = 100;
    element.scrollHeight = 200;
    snapdomToPng.mockResolvedValue({
      src: '',
      getAttribute: vi.fn(() => ''),
    });

    await expect(captureDocumentScreenshot(element as any)).rejects.toThrow('snapdom returned an empty screenshot');
    expect(element.style.marginLeft).toBe('auto');
    expect(element.style.marginRight).toBe('auto');
  });

  it('propagates snapDOM failures without calling html-to-image fallback', async () => {
    const element = new FakeHTMLElement();
    element.scrollWidth = 100;
    element.scrollHeight = 200;
    snapdomToPng.mockRejectedValue(new Error('snapdom failed'));

    await expect(captureDocumentScreenshot(element as any)).rejects.toThrow('snapdom failed');
    expect(snapdomToPng).toHaveBeenCalledTimes(1);
  });
});
