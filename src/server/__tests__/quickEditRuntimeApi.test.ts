import vm from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

import { QUICK_EDIT_RUNTIME_SCRIPT } from '../quickEditRuntimeApi';

describe('quick edit runtime script', () => {
  function createRuntimeHarness(extraWindow: Record<string, any> = {}) {
    const listeners = new Map<string, (...args: any[]) => void>();
    const messages: Array<{ message: any; targetOrigin: string }> = [];
    const windowStub: any = {
      axhub: undefined,
      location: {
        href: 'http://localhost:51720/prototypes/ref-app-home',
        origin: 'http://localhost:51720',
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
      focus: vi.fn(),
      ...extraWindow,
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
      Date,
      URL,
    });

    return { documentStub, listeners, messages, windowStub };
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
          runtimeVersion: '0.2.0',
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

    listeners.get('window:message')?.({
      data: { type: 'axhub.quickEdit.requestRuntimeReady' },
    });

    expect(messages).toHaveLength(2);
    expect(messages[1]).toEqual({
      targetOrigin: '*',
      message: expect.objectContaining({
        type: 'axhub.quickEdit.runtimeReady',
        protocolVersion: 1,
        runtimeVersion: '0.2.0',
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
    listeners.get('document:click')?.({
      target: element,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });

    expect(element.setAttribute).not.toHaveBeenCalledWith('contenteditable', 'true');
    expect(element.removeAttribute).not.toHaveBeenCalledWith('contenteditable');
    expect(windowStub.axhub.quickEdit.capabilities).not.toContain('inline-text');
    expect(documentStub.addEventListener).not.toHaveBeenCalledWith('input', expect.any(Function), true);
  });

  it('handles copy-to-figma export requests in the make-server runtime and returns the matching request id', async () => {
    const copyDocumentForFigmaNewOfficialClipboard = vi.fn(async () => ({
      success: true,
      payloadSizeKb: 42,
    }));
    const { listeners, messages, windowStub } = createRuntimeHarness({
      axhubExportCore: {
        copyDocumentForFigmaNewOfficialClipboard,
      },
    });

    listeners.get('window:message')?.({
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

    expect(windowStub.focus).toHaveBeenCalled();
    expect(copyDocumentForFigmaNewOfficialClipboard).toHaveBeenCalledWith('#root');
    expect(messages.at(-1)).toEqual({
      targetOrigin: '*',
      message: expect.objectContaining({
        type: 'axhub.quickEdit.export.copyToFigmaResult',
        requestId: 'copy-1',
        success: true,
        payloadSizeKb: 42,
        projectId: 'project-1',
        resourceId: 'home',
        resourceType: 'prototypes',
      }),
    });
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

    listeners.get('window:message')?.({
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

    listeners.get('window:message')?.({
      data: {
        type: 'axhub.quickEdit.export.captureScreenshot',
        requestId: 'screenshot-1',
        projectId: 'project-1',
        resourceId: 'home',
        resourceType: 'prototypes',
        targetWidth: 390,
        targetHeight: 846,
      },
    });
    await vi.waitFor(() => {
      expect(messages.at(-1)?.message?.type).toBe('axhub.quickEdit.export.captureScreenshotResult');
    });

    expect(captureDocumentScreenshot).toHaveBeenCalledWith('#root', {
      targetWidth: 390,
      targetHeight: 846,
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

    listeners.get('window:message')?.({
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
        error: 'Error: clipboard denied',
      }),
    });
  });
});
