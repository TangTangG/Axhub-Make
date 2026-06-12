import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { QUICK_EDIT_RUNTIME_SCRIPT } from '../quickEditRuntimeApi';

afterEach(() => {
  vi.useRealTimers();
});

describe('quick edit runtime script', () => {
  function createRuntimeHarness(extraWindow: Record<string, any> = {}) {
    const listeners = new Map<string, Array<(...args: any[]) => void>>();
    const messages: Array<{ message: any; targetOrigin: string }> = [];
    const appendedElements: any[] = [];
    const sessionValues = new Map<string, string>();
    const addListener = (key: string, listener: (...args: any[]) => void) => {
      const nextListeners = listeners.get(key) || [];
      nextListeners.push(listener);
      listeners.set(key, nextListeners);
    };
    const createElementStub = (tagName: string) => {
      let ownTextContent = '';
      const element: any = {
        tagName: tagName.toUpperCase(),
        innerHTML: '',
        style: {},
        children: [],
        dataset: {},
        attributes: new Map<string, string>(),
        setAttribute: vi.fn((name: string, value: string) => {
          element.attributes.set(name, String(value));
          if (name === 'data-axhub-quick-edit-ignore') {
            element.dataset.axhubQuickEditIgnore = String(value);
          }
        }),
        getAttribute: vi.fn((name: string) => element.attributes.get(name) || null),
        appendChild: vi.fn((child: any) => {
          element.children.push(child);
          return child;
        }),
        addEventListener: vi.fn((type: string, listener: (...args: any[]) => void) => {
          addListener(`element:${tagName}:${type}:${element.children.length}`, listener);
        }),
        remove: vi.fn(() => {
          const index = appendedElements.indexOf(element);
          if (index >= 0) {
            appendedElements.splice(index, 1);
          }
        }),
        focus: vi.fn(),
      };
      Object.defineProperty(element, 'textContent', {
        get() {
          return ownTextContent + element.children.map((child: any) => child.textContent || '').join('');
        },
        set(value) {
          ownTextContent = String(value ?? '');
        },
      });
      return element;
    };
    const windowStub: any = {
      axhub: undefined,
      location: {
        href: 'http://localhost:51720/prototypes/ref-app-home',
        pathname: '/prototypes/ref-app-home',
        origin: 'http://localhost:51720',
        reload: vi.fn(),
      },
      navigator: {
        userAgent: 'Vitest Browser',
        clipboard: {
          writeText: vi.fn(async () => undefined),
        },
      },
      sessionStorage: {
        getItem: vi.fn((key: string) => sessionValues.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          sessionValues.set(key, String(value));
        }),
        removeItem: vi.fn((key: string) => {
          sessionValues.delete(key);
        }),
      },
      fetch: vi.fn(),
      parent: {
        postMessage(message: any, targetOrigin: string) {
          messages.push({ message, targetOrigin });
        },
      },
      addEventListener: vi.fn((type: string, listener: (...args: any[]) => void) => {
        addListener(`window:${type}`, listener);
      }),
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
      focus: vi.fn(),
      ...extraWindow,
    };
    const documentStub: any = {
      readyState: 'complete',
      documentElement: {
        dataset: {},
        appendChild: vi.fn((element: any) => {
          appendedElements.push(element);
          return element;
        }),
      },
      body: {},
      addEventListener: vi.fn((type: string, listener: (...args: any[]) => void) => {
        addListener(`document:${type}`, listener);
      }),
      removeEventListener: vi.fn(),
      createElement: vi.fn(createElementStub),
      elementFromPoint: vi.fn(),
    };

    vm.runInNewContext(QUICK_EDIT_RUNTIME_SCRIPT, {
      window: windowStub,
      document: documentStub,
      navigator: windowStub.navigator,
      CSS: { escape: (value: string) => value },
      console,
      fetch: windowStub.fetch,
      Set,
      WeakMap,
      Map,
      Array,
      Object,
      String,
      Date,
      URL,
    });

    const emit = (key: string, event: any) => {
      for (const listener of listeners.get(key) || []) {
        listener(event);
      }
    };

    return { appendedElements, documentStub, emit, listeners, messages, windowStub };
  }

  it('posts runtimeReady from a client page so make-server can detect the runtime handshake', () => {
    const messages: Array<{ message: any; targetOrigin: string }> = [];
    const windowStub: any = {
      axhub: undefined,
      location: {
        href: 'http://localhost:51720/prototypes/ref-app-home',
      },
      parent: {
        postMessage(message: any, targetOrigin: string) {
          messages.push({ message, targetOrigin });
        },
      },
      addEventListener: vi.fn(),
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    };
    const documentStub: any = {
      readyState: 'complete',
      documentElement: {
        dataset: {},
        appendChild: vi.fn(),
      },
      body: {},
      addEventListener: vi.fn(),
      createElement: vi.fn(() => ({
        setAttribute: vi.fn(),
        style: {},
      })),
      elementFromPoint: vi.fn(),
    };

    vm.runInNewContext(QUICK_EDIT_RUNTIME_SCRIPT, {
      window: windowStub,
      document: documentStub,
      CSS: { escape: (value: string) => value },
      console,
      Set,
      WeakMap,
      Map,
      Array,
      Object,
      String,
    });

    expect(messages).toEqual([
      {
        targetOrigin: '*',
        message: expect.objectContaining({
          type: 'axhub.quickEdit.runtimeReady',
          protocolVersion: 1,
          runtimeVersion: '0.3.0',
          href: 'http://localhost:51720/prototypes/ref-app-home',
          capabilities: expect.arrayContaining(['handshake', 'patch', 'save', 'exit']),
        }),
      },
    ]);
    expect(messages[0].message.capabilities).not.toContain('inline-text');
    expect(windowStub.axhub.quickEdit.postReady).toEqual(expect.any(Function));
  });

  it('responds to host runtimeReady requests after the initial page load message', () => {
    const { listeners, messages, windowStub } = createRuntimeHarness();

    expect(messages).toHaveLength(1);

    listeners.get('window:message')?.[0]?.({
      data: { type: 'axhub.quickEdit.requestRuntimeReady' },
    });

    expect(messages).toHaveLength(2);
    expect(messages[1]).toEqual({
      targetOrigin: '*',
      message: expect.objectContaining({
        type: 'axhub.quickEdit.runtimeReady',
        protocolVersion: 1,
        runtimeVersion: '0.3.0',
        href: 'http://localhost:51720/prototypes/ref-app-home',
        capabilities: expect.arrayContaining(['handshake', 'patch', 'save', 'exit']),
      }),
    });
    expect(windowStub.axhub.quickEdit.postReady).toEqual(expect.any(Function));
  });

  it('selects page elements without enabling legacy inline text editing', () => {
    const listeners = new Map<string, (...args: any[]) => void>();
    const messages: Array<{ message: any; targetOrigin: string }> = [];
    const rect = {
      left: 12,
      top: 24,
      width: 120,
      height: 32,
      toJSON: () => ({ left: 12, top: 24, width: 120, height: 32 }),
    };
    const element: any = {
      nodeType: 1,
      id: 'headline',
      tagName: 'H1',
      textContent: 'Hello',
      children: [],
      closest: vi.fn(() => null),
      matches: vi.fn(() => false),
      getBoundingClientRect: vi.fn(() => rect),
      getAttribute: vi.fn(() => null),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      focus: vi.fn(),
    };
    const overlay: any = {
      setAttribute: vi.fn(),
      style: {},
    };
    const windowStub: any = {
      axhub: undefined,
      location: {
        href: 'http://localhost:51720/prototypes/ref-app-home',
      },
      parent: {
        postMessage(message: any, targetOrigin: string) {
          messages.push({ message, targetOrigin });
        },
      },
      addEventListener: vi.fn((type: string, listener: (...args: any[]) => void) => {
        listeners.set(`window:${type}`, listener);
      }),
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    };
    const documentStub: any = {
      readyState: 'complete',
      documentElement: {
        dataset: {},
        appendChild: vi.fn(),
      },
      body: {},
      addEventListener: vi.fn((type: string, listener: (...args: any[]) => void) => {
        listeners.set(`document:${type}`, listener);
      }),
      removeEventListener: vi.fn(),
      createElement: vi.fn(() => overlay),
      elementFromPoint: vi.fn(() => element),
    };

    vm.runInNewContext(QUICK_EDIT_RUNTIME_SCRIPT, {
      window: windowStub,
      document: documentStub,
      CSS: { escape: (value: string) => value },
      console,
      Set,
      WeakMap,
      Map,
      Array,
      Object,
      String,
      Date,
    });

    windowStub.axhub.quickEdit.enter({ projectId: 'project-1', resourceId: 'home' });
    listeners.get('document:click')?.[0]?.({
      target: element,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });

    expect(element.setAttribute).not.toHaveBeenCalledWith('contenteditable', 'true');
    expect(element.removeAttribute).not.toHaveBeenCalledWith('contenteditable');
    expect(windowStub.axhub.quickEdit.capabilities).not.toContain('inline-text');
    expect(documentStub.addEventListener).not.toHaveBeenCalledWith('input', expect.any(Function), true);
  });

  it('returns a Figma clipboard payload for copy-to-figma export requests without writing from the iframe', async () => {
    const capturedDocument = { root: { id: 'root' } };
    const captureDocumentForFigmaNew = vi.fn(async () => capturedDocument);
    const buildOfficialClipboardPayloadFromCapturedDocument = vi.fn(async () => '{"figma":true}');
    const copyDocumentForFigmaNewOfficialClipboard = vi.fn();
    const { listeners, messages, windowStub } = createRuntimeHarness({
      axhubExportCore: {
        copyDocumentForFigmaNewOfficialClipboard,
        captureDocumentForFigmaNew,
        buildOfficialClipboardPayloadFromCapturedDocument,
      },
    });

    listeners.get('window:message')?.[0]?.({
      data: {
        type: 'axhub.quickEdit.export.copyToFigma',
        requestId: 'copy-1',
        projectId: 'project-1',
        resourceId: 'home',
        resourceType: 'prototypes',
      },
    });
    await vi.waitFor(() => {
      expect(messages.at(-1)?.message?.type).toBe('axhub.quickEdit.export.copyToFigmaResult');
    });

    expect(windowStub.focus).not.toHaveBeenCalled();
    expect(captureDocumentForFigmaNew).toHaveBeenCalledWith('#root');
    expect(buildOfficialClipboardPayloadFromCapturedDocument).toHaveBeenCalledWith(capturedDocument);
    expect(copyDocumentForFigmaNewOfficialClipboard).not.toHaveBeenCalled();
    expect(messages.at(-1)).toEqual({
      targetOrigin: '*',
      message: expect.objectContaining({
        type: 'axhub.quickEdit.export.copyToFigmaResult',
        requestId: 'copy-1',
        success: true,
        payloadText: '{"figma":true}',
        payloadSizeKb: 0,
        projectId: 'project-1',
        resourceId: 'home',
        resourceType: 'prototypes',
      }),
    });
  });

  it('returns a Figma clipboard payload for host-side clipboard writes without writing from the iframe', async () => {
    const capturedDocument = { root: { id: 'root' } };
    const captureDocumentForFigmaNew = vi.fn(async () => capturedDocument);
    const buildOfficialClipboardPayloadFromCapturedDocument = vi.fn(async () => '{"figma":true}');
    const copyDocumentForFigmaNewOfficialClipboard = vi.fn();
    const { listeners, messages, windowStub } = createRuntimeHarness({
      axhubExportCore: {
        copyDocumentForFigmaNewOfficialClipboard,
        captureDocumentForFigmaNew,
        buildOfficialClipboardPayloadFromCapturedDocument,
      },
    });

    listeners.get('window:message')?.[0]?.({
      data: {
        type: 'axhub.quickEdit.export.copyToFigma',
        requestId: 'copy-host-1',
        clipboardWriteTarget: 'host',
        projectId: 'project-1',
        resourceId: 'home',
        resourceType: 'prototypes',
      },
    });
    await vi.waitFor(() => {
      expect(messages.at(-1)?.message?.type).toBe('axhub.quickEdit.export.copyToFigmaResult');
    });

    expect(windowStub.focus).not.toHaveBeenCalled();
    expect(captureDocumentForFigmaNew).toHaveBeenCalledWith('#root');
    expect(buildOfficialClipboardPayloadFromCapturedDocument).toHaveBeenCalledWith(capturedDocument);
    expect(copyDocumentForFigmaNewOfficialClipboard).not.toHaveBeenCalled();
    expect(messages.at(-1)).toEqual({
      targetOrigin: '*',
      message: expect.objectContaining({
        type: 'axhub.quickEdit.export.copyToFigmaResult',
        requestId: 'copy-host-1',
        success: true,
        payloadText: '{"figma":true}',
        payloadSizeKb: 0,
        projectId: 'project-1',
        resourceId: 'home',
        resourceType: 'prototypes',
      }),
    });
  });

  it('exposes Figma payload builders from the browser runtime export bundle', () => {
    const source = readFileSync(resolve(__dirname, '../../runtime-export-core.ts'), 'utf8');

    expect(source).toContain('captureDocumentForFigmaNew as captureDocumentForFigmaNewImpl');
    expect(source).toContain('buildOfficialClipboardPayloadFromCapturedDocument as buildOfficialClipboardPayloadFromCapturedDocumentImpl');
    expect(source).toContain('export function captureDocumentForFigmaNew');
    expect(source).toContain('export function buildOfficialClipboardPayloadFromCapturedDocument');
  });

  it('handles editable Axure export requests in the make-server runtime and returns the matching request id', async () => {
    const axurePayload = { scene: { items: [] }, imageMap: {} };
    const htmlToAxure = vi.fn(async () => axurePayload);
    const { listeners, messages, windowStub } = createRuntimeHarness({
      axhubExportCore: {
        copyDocumentForFigmaNewOfficialClipboard: vi.fn(),
        htmlToAxure,
      },
    });

    listeners.get('window:message')?.[0]?.({
      data: {
        type: 'axhub.quickEdit.export.axureJson',
        requestId: 'axure-1',
        projectId: 'project-1',
        resourceId: 'home',
        resourceType: 'prototypes',
        rootName: 'Home Page',
        preserveHierarchy: true,
        preserveSvgIcons: false,
      },
    });
    await vi.waitFor(() => {
      expect(messages.at(-1)?.message?.type).toBe('axhub.quickEdit.export.axureJsonResult');
    });

    expect(windowStub.focus).toHaveBeenCalled();
    expect(htmlToAxure).toHaveBeenCalledWith('#root', {
      rootName: 'Home Page',
      preserveHierarchy: true,
      preserveSvgIcons: false,
    });
    expect(messages.at(-1)).toEqual({
      targetOrigin: '*',
      message: expect.objectContaining({
        type: 'axhub.quickEdit.export.axureJsonResult',
        requestId: 'axure-1',
        success: true,
        payload: axurePayload,
        projectId: 'project-1',
        resourceId: 'home',
        resourceType: 'prototypes',
      }),
    });
  });

  it('handles screenshot capture requests in the make-server runtime and returns the matching request id', async () => {
    const captureDocumentScreenshot = vi.fn(async () => ({
      dataUrl: 'data:image/png;base64,c2NyZWVuc2hvdA==',
      width: 390,
      height: 846,
    }));
    const { listeners, messages } = createRuntimeHarness({
      axhubExportCore: {
        captureDocumentScreenshot,
      },
    });

    listeners.get('window:message')?.[0]?.({
      data: {
        type: 'axhub.quickEdit.export.captureScreenshot',
        requestId: 'screenshot-1',
        projectId: 'project-1',
        resourceId: 'home',
        resourceType: 'prototypes',
        targetWidth: 390,
        targetHeight: 846,
        targetPixelRatio: 1,
      },
    });
    await vi.waitFor(() => {
      expect(messages.at(-1)?.message?.type).toBe('axhub.quickEdit.export.captureScreenshotResult');
    });

    expect(captureDocumentScreenshot).toHaveBeenCalledWith('#root', {
      targetWidth: 390,
      targetHeight: 846,
      targetPixelRatio: 1,
    });
    expect(messages.at(-1)).toEqual({
      targetOrigin: '*',
      message: expect.objectContaining({
        type: 'axhub.quickEdit.export.captureScreenshotResult',
        requestId: 'screenshot-1',
        success: true,
        dataUrl: 'data:image/png;base64,c2NyZWVuc2hvdA==',
        width: 390,
        height: 846,
        projectId: 'project-1',
        resourceId: 'home',
        resourceType: 'prototypes',
      }),
    });
  });

  it('returns copy-to-figma export failures instead of leaving make-server waiting for timeout', async () => {
    const { listeners, messages } = createRuntimeHarness({
      axhubExportCore: {
        copyDocumentForFigmaNewOfficialClipboard: vi.fn(async () => {
          throw new Error('clipboard denied');
        }),
      },
    });

    listeners.get('window:message')?.[0]?.({
      data: {
        type: 'axhub.quickEdit.export.copyToFigma',
        requestId: 'copy-2',
      },
    });
    await vi.waitFor(() => {
      expect(messages.at(-1)?.message?.type).toBe('axhub.quickEdit.export.copyToFigmaResult');
    });

    expect(messages.at(-1)).toEqual({
      targetOrigin: '*',
      message: expect.objectContaining({
        type: 'axhub.quickEdit.export.copyToFigmaResult',
        requestId: 'copy-2',
        success: false,
        error: 'Error: make-server export core missing Figma payload builders',
      }),
    });
  });

  it('exposes prototype runtime error reporting with the dialog capability', () => {
    const { appendedElements, windowStub } = createRuntimeHarness();

    expect(windowStub.axhub.quickEdit.capabilities).toContain('prototype-error-dialog');
    expect(windowStub.axhub.quickEdit.runtimeVersion).toBe('0.3.0');
    expect(windowStub.axhub.prototypeRuntime.reportError).toEqual(expect.any(Function));

    windowStub.axhub.prototypeRuntime.reportError(new Error('Render exploded'), {
      type: 'react-render',
      sourceFile: '/src/prototypes/home/index.tsx',
      line: 12,
      column: 8,
      componentStack: '\n    at Home',
      resourceType: 'prototype',
      resourceId: 'home',
    });

    expect(appendedElements).toHaveLength(1);
    expect(appendedElements[0].getAttribute('data-axhub-quick-edit-ignore')).toBe('1');
    expect(appendedElements[0].textContent).toContain('Render exploded');
    expect(appendedElements[0].textContent).toContain('/src/prototypes/home/index.tsx:12:8');
  });

  it('opens one prototype error dialog for window errors, unhandled rejections, and resource load failures', () => {
    const { appendedElements, emit } = createRuntimeHarness();

    emit('window:error', {
      message: 'Top-level crash',
      error: new Error('Top-level crash'),
      filename: '/src/prototypes/home/index.tsx',
      lineno: 4,
      colno: 2,
    });
    emit('window:unhandledrejection', {
      reason: new Error('Async crash'),
    });
    emit('window:error', {
      target: {
        tagName: 'SCRIPT',
        src: '/src/prototypes/home/missing-module.tsx',
      },
    });

    expect(appendedElements).toHaveLength(1);
    expect(appendedElements[0].textContent).toContain('资源加载失败: /src/prototypes/home/missing-module.tsx');
  });

  it('reloads once instead of reporting transient Vite html-proxy script failures', async () => {
    const proxyUrl = 'http://localhost:51720/@id/__x00__/prototypes/ref-app-home/index.html?html-proxy&index=0.js';
    const fetchMock = vi.fn(async (input: string) => {
      if (input === '/@vite/client' || input === proxyUrl) {
        return { ok: true };
      }
      throw new Error(`Unexpected fetch url: ${input}`);
    });
    const { appendedElements, emit, windowStub } = createRuntimeHarness({ fetch: fetchMock });

    emit('window:error', {
      target: {
        tagName: 'SCRIPT',
        src: proxyUrl,
      },
    });
    await vi.waitFor(() => {
      expect(windowStub.location.reload).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/@vite/client',
    ]);
    expect(windowStub.sessionStorage.setItem).toHaveBeenCalledWith(
      '__axhub_quick_edit_transient_vite_retry__',
      '/prototypes/ref-app-home',
    );
    expect(appendedElements).toHaveLength(0);
  });

  it('reloads stale Vite html-proxy script failures even when the old proxy URL is gone', async () => {
    const proxyUrl = 'http://localhost:51720/@id/__x00__/prototypes/ref-app-home/index.html?html-proxy&index=0.js';
    const fetchMock = vi.fn(async (input: string) => {
      if (input === '/@vite/client') {
        return { ok: true };
      }
      if (input === proxyUrl) {
        return { ok: false };
      }
      throw new Error(`Unexpected fetch url: ${input}`);
    });
    const { appendedElements, emit, windowStub } = createRuntimeHarness({ fetch: fetchMock });

    emit('window:error', {
      target: {
        tagName: 'SCRIPT',
        src: proxyUrl,
      },
    });
    await vi.waitFor(() => {
      expect(windowStub.location.reload).toHaveBeenCalledTimes(1);
    });

    expect(windowStub.sessionStorage.setItem).toHaveBeenCalledWith(
      '__axhub_quick_edit_transient_vite_retry__',
      '/prototypes/ref-app-home',
    );
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/@vite/client',
    ]);
    expect(appendedElements).toHaveLength(0);
  });

  it('updates the existing prototype error dialog when a later error is reported', () => {
    const { appendedElements, windowStub } = createRuntimeHarness();

    windowStub.axhub.prototypeRuntime.reportError(new Error('First crash'), {
      sourceFile: '/src/prototypes/home/first.tsx',
      line: 1,
      column: 2,
    });
    windowStub.axhub.prototypeRuntime.reportError(new Error('Second crash'), {
      sourceFile: '/src/prototypes/home/second.tsx',
      line: 3,
      column: 4,
    });

    expect(appendedElements).toHaveLength(1);
    expect(appendedElements[0].textContent).toContain('Second crash');
    expect(appendedElements[0].textContent).toContain('/src/prototypes/home/second.tsx:3:4');
    expect(appendedElements[0].textContent).not.toContain('First crash');
  });

  it('copies prototype error diagnostics with stack, component stack, URL, user agent, timestamp, and resource path', async () => {
    const fixedNow = new Date('2026-05-29T10:11:12.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    const { appendedElements, windowStub } = createRuntimeHarness();
    const error = new Error('Render exploded');
    error.stack = 'Error: Render exploded\n    at Home (/src/prototypes/home/index.tsx:12:8)';

    windowStub.axhub.prototypeRuntime.reportError(error, {
      type: 'react-render',
      sourceFile: '/src/prototypes/home/index.tsx',
      line: 12,
      column: 8,
      componentStack: '\n    at Home',
      resourceType: 'prototype',
      resourceId: 'home',
    });

    const findByText = (element: any, text: string): any => {
      if (element.textContent === text) {
        return element;
      }
      for (const child of element.children || []) {
        const found = findByText(child, text);
        if (found) {
          return found;
        }
      }
      return null;
    };
    const copyButton = findByText(appendedElements[0], '复制错误给 AI');
    expect(copyButton).toBeTruthy();
    await copyButton.addEventListener.mock.calls.find(([type]: [string]) => type === 'click')?.[1]();

    expect(windowStub.navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('type: react-render'));
    const diagnostic = windowStub.navigator.clipboard.writeText.mock.calls[0][0];
    expect(diagnostic).toContain('message: Render exploded');
    expect(diagnostic).toContain('stack:\nError: Render exploded');
    expect(diagnostic).toContain('componentStack:\n    at Home');
    expect(diagnostic).toContain('sourceFile: /src/prototypes/home/index.tsx');
    expect(diagnostic).toContain('line: 12');
    expect(diagnostic).toContain('column: 8');
    expect(diagnostic).toContain('url: http://localhost:51720/prototypes/ref-app-home');
    expect(diagnostic).toContain('userAgent: Vitest Browser');
    expect(diagnostic).toContain('timestamp: 2026-05-29T10:11:12.000Z');
    expect(diagnostic).toContain('resourcePath: /prototypes/ref-app-home');
    vi.useRealTimers();
  });

  it('does not automatically open the prototype error dialog outside prototype pages', () => {
    const { appendedElements, emit, windowStub } = createRuntimeHarness({
      location: {
        href: 'http://localhost:51720/themes/brand',
        pathname: '/themes/brand',
        origin: 'http://localhost:51720',
        reload: vi.fn(),
      },
    });

    emit('window:error', {
      message: 'Theme preview crash',
      error: new Error('Theme preview crash'),
    });

    expect(appendedElements).toHaveLength(0);
    expect(windowStub.axhub.prototypeRuntime.reportError(new Error('Manual theme report'))).toBeTruthy();
    expect(appendedElements).toHaveLength(1);
  });
});
