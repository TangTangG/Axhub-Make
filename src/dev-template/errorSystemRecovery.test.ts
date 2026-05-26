import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const htmlPath = fileURLToPath(new URL('./index.html', import.meta.url));
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const errorSystemScriptMatch = htmlContent.match(/<script>\s*\/\/ 全局错误捕获系统（增强版）([\s\S]*?)<\/script>/);

if (!errorSystemScriptMatch) {
  throw new Error('Failed to locate the dev-template error system script');
}

const errorSystemScript = errorSystemScriptMatch[1];

class MockHTMLElement {
  tagName: string;
  src?: string;
  href?: string;

  constructor(tagName: string, resourceUrl?: string) {
    this.tagName = tagName.toUpperCase();
    if (resourceUrl) {
      this.src = resourceUrl;
    }
  }
}

function createMockElement(idStore: Map<string, any>, tagName: string) {
  const element: any = {
    id: '',
    tagName: tagName.toUpperCase(),
    style: {},
    children: [] as any[],
    parentNode: null as any,
    classList: {
      add: vi.fn(),
    },
    appendChild(child: any) {
      child.parentNode = element;
      element.children.push(child);
      if (child.id) {
        idStore.set(child.id, child);
      }
    },
    remove() {
      if (element.parentNode?.children) {
        element.parentNode.children = element.parentNode.children.filter((child: any) => child !== element);
      }
      if (element.id) {
        idStore.delete(element.id);
      }
    },
    focus: vi.fn(),
    select: vi.fn(),
    onclick: null as any,
    textContent: '',
    value: '',
    _innerHTML: '',
  };

  Object.defineProperty(element, 'innerHTML', {
    get() {
      return element._innerHTML;
    },
    set(value: string) {
      element._innerHTML = value;
    },
  });

  return element;
}

function createHarness(fetchImpl: ReturnType<typeof vi.fn>) {
  const eventHandlers = new Map<string, Array<(event: any) => void>>();
  const idStore = new Map<string, any>();
  const body = createMockElement(idStore, 'body');

  const document = {
    body,
    createElement(tagName: string) {
      return createMockElement(idStore, tagName);
    },
    getElementById(id: string) {
      if (!idStore.has(id)) {
        const fallback = createMockElement(idStore, 'div');
        fallback.id = id;
        idStore.set(id, fallback);
      }
      return idStore.get(id) || null;
    },
    addEventListener: vi.fn(),
  };

  const location = {
    pathname: '/prototypes/express-home',
    href: 'http://localhost:51720/prototypes/express-home',
    reload: vi.fn(),
  };

  const sessionValues = new Map<string, string>();
  const sessionStorage = {
    getItem: vi.fn((key: string) => sessionValues.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      sessionValues.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      sessionValues.delete(key);
    }),
  };

  const consoleMock = {
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
  };

  const windowObject: any = {
    location,
    document,
    navigator: {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    },
    sessionStorage,
    addEventListener(type: string, handler: (event: any) => void) {
      const handlers = eventHandlers.get(type) || [];
      handlers.push(handler);
      eventHandlers.set(type, handlers);
    },
    setTimeout,
    clearTimeout,
  };

  vm.runInNewContext(errorSystemScript, {
    window: windowObject,
    document,
    console: consoleMock,
    navigator: windowObject.navigator,
    sessionStorage,
    location,
    fetch: fetchImpl,
    HTMLElement: MockHTMLElement,
    setTimeout,
    clearTimeout,
    Date,
    Error,
    JSON,
    Array,
    String,
    Object,
    Promise,
  });

  return {
    windowObject,
    location,
    document,
    fetchImpl,
    getErrorHandler() {
      const handlers = eventHandlers.get('error') || [];
      if (!handlers[0]) {
        throw new Error('Missing error handler');
      }
      return handlers[0];
    },
    hasFallbackOverlay() {
      return Boolean(idStore.get('__fallback_error_overlay__'));
    },
  };
}

describe('dev-template error system recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('auto-recovers from transient Vite bootstrap script failures before showing the fallback overlay', async () => {
    const proxyUrl = 'http://localhost:51720/@id/__x00__/prototypes/express-home/index.html?html-proxy&index=1.js';
    const fetchMock = vi.fn(async (input: string) => {
      if (input === '/@vite/client' || input === proxyUrl) {
        return { ok: true };
      }
      throw new Error(`Unexpected fetch url: ${input}`);
    });
    const harness = createHarness(fetchMock);
    const errorHandler = harness.getErrorHandler();

    errorHandler({
      message: '',
      error: null,
      filename: '',
      lineno: 0,
      colno: 0,
      target: new MockHTMLElement('script', proxyUrl),
      preventDefault: vi.fn(),
    });

    await vi.runAllTimersAsync();

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/@vite/client',
      proxyUrl,
    ]);
    expect(harness.location.reload).toHaveBeenCalledTimes(1);
    expect(harness.windowObject.__ERROR_SYSTEM__.getErrorQueue()).toEqual([]);
    expect(harness.hasFallbackOverlay()).toBe(false);
  });

  it('treats inline Vite bootstrap script failures as transient and probes react-refresh before reloading', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input === '/@vite/client' || input === '/@react-refresh') {
        return { ok: true };
      }
      throw new Error(`Unexpected fetch url: ${input}`);
    });
    const harness = createHarness(fetchMock);
    const errorHandler = harness.getErrorHandler();

    errorHandler({
      message: '',
      error: null,
      filename: '',
      lineno: 0,
      colno: 0,
      target: new MockHTMLElement('script'),
      preventDefault: vi.fn(),
    });

    await vi.runAllTimersAsync();

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/@vite/client',
      '/@react-refresh',
    ]);
    expect(harness.location.reload).toHaveBeenCalledTimes(1);
    expect(harness.windowObject.__ERROR_SYSTEM__.getErrorQueue()).toEqual([]);
    expect(harness.hasFallbackOverlay()).toBe(false);
  });

  it('still shows the fallback overlay for non-transient script load failures', async () => {
    const fetchMock = vi.fn();
    const harness = createHarness(fetchMock);
    const errorHandler = harness.getErrorHandler();

    errorHandler({
      message: '',
      error: null,
      filename: '',
      lineno: 0,
      colno: 0,
      target: new MockHTMLElement('script', 'http://localhost:51720/assets/runtime-broken.js'),
      preventDefault: vi.fn(),
    });

    await vi.runAllTimersAsync();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(harness.location.reload).not.toHaveBeenCalled();
    expect(harness.windowObject.__ERROR_SYSTEM__.getErrorQueue()).toHaveLength(1);
    expect(harness.hasFallbackOverlay()).toBe(true);
  });
});
