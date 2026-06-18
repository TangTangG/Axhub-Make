import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clampPreviewWaitSeconds,
  createPreviewBridgeCurrentContext,
  normalizePreviewCaptureViewports,
  resolvePreviewCaptureTarget,
  resolvePreviewNavigateTarget,
  runPreviewCapture,
  runPreviewNavigate,
} from './previewBridgeHost';

function createResource(overrides: Record<string, unknown> = {}) {
  return {
    name: 'home',
    displayName: 'Home',
    resourceId: 'home',
    clientUrl: '/prototypes/home',
    previewUrl: '/prototypes/home',
    filePath: 'src/prototypes/home/index.tsx',
    ...overrides,
  };
}

function createHostContext(overrides: Record<string, unknown> = {}) {
  return {
    projectId: 'make-project',
    activeTab: 'prototypes',
    viewMode: 'demo',
    contentMode: 'preview',
    selectedItem: createResource(),
    selectedPageId: 'settings',
    selectedDoc: null,
    selectedTheme: null,
    currentUrl: 'http://localhost:5174/prototypes/home#page=settings',
    canvasSelection: null,
    resources: {
      prototypes: [createResource(), createResource({
        name: 'profile',
        resourceId: 'profile',
        clientUrl: '/prototypes/profile',
        previewUrl: '/prototypes/profile',
      })],
      docs: [createResource({
        name: 'guide',
        resourceId: 'guide',
        previewUrl: '/spec-template.html?url=%2Fapi%2Fdocs%2Fguide',
        clientUrl: '',
      })],
      themes: [createResource({
        name: 'brand',
        resourceId: 'brand',
        clientUrl: '/themes/brand',
        previewUrl: '/themes/brand',
      })],
    },
    ...overrides,
  };
}

class FakeElement {
  style: Record<string, string> = {};
  removed = false;
  attributes = new Map<string, string>();
  private listeners = new Map<string, Array<() => void>>();

  constructor(public readonly tagName = 'IFRAME') {}

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) || null;
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

  remove() {
    this.removed = true;
  }
}

describe('previewBridgeHost helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:5174',
        href: 'http://localhost:5174/',
      },
      __RUNTIME_ORIGIN__: 'http://localhost:51720',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout,
      clearTimeout,
      requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes capture viewports from presets and clamps waitSeconds to the exposed 0-30 range', () => {
    expect(normalizePreviewCaptureViewports(undefined)).toEqual([
      { id: 'desktop', width: 1440, height: 900 },
    ]);
    expect(normalizePreviewCaptureViewports(['mobile', { width: 1024.4, height: 768.6 }])).toEqual([
      { id: 'mobile', width: 393, height: 852 },
      { id: 'custom-1024x769', width: 1024, height: 769 },
    ]);

    expect(clampPreviewWaitSeconds(undefined)).toBe(0.5);
    expect(clampPreviewWaitSeconds(-4)).toBe(0);
    expect(clampPreviewWaitSeconds(45)).toBe(30);
  });

  it('builds current context without creating an iframe', () => {
    const current = createPreviewBridgeCurrentContext(createHostContext());

    expect(current).toMatchObject({
      projectId: 'make-project',
      resourceType: 'prototype',
      resourceId: 'home',
      viewMode: 'demo',
      pageId: 'settings',
      url: 'http://localhost:5174/prototypes/home#page=settings',
      filePath: 'src/prototypes/home/index.tsx',
    });
  });

  it('resolves capture targets from current context, resource ids, url, and canvas selected preview node', () => {
    const context = createHostContext({
      canvasSelection: {
        elementId: 'embed-1',
        customData: {
          previewUrl: '/themes/brand',
          openUrl: '/ignored-open-url',
          resourceType: 'theme',
          resourceId: 'brand',
          previewKind: 'theme',
        },
      },
    });

    expect(resolvePreviewCaptureTarget(undefined, context)).toMatchObject({
      kind: 'current',
      url: 'http://localhost:5174/prototypes/home#page=settings',
      resourceType: 'prototype',
      resourceId: 'home',
    });
    expect(resolvePreviewCaptureTarget({ resourceType: 'theme', resourceId: 'brand' }, context)).toMatchObject({
      kind: 'resource',
      url: 'http://localhost:5174/themes/brand',
      resourceType: 'theme',
      resourceId: 'brand',
    });
    expect(resolvePreviewCaptureTarget({ url: '/docs/readme.html' }, context)).toMatchObject({
      kind: 'url',
      url: 'http://localhost:5174/docs/readme.html',
    });
    expect(resolvePreviewCaptureTarget({ canvasElementId: 'embed-1' }, context)).toMatchObject({
      kind: 'canvasElement',
      url: 'http://localhost:5174/themes/brand',
      resourceType: 'theme',
      resourceId: 'brand',
      canvasElementId: 'embed-1',
      previewKind: 'theme',
    });
  });

  it('uses the selected canvas embeddable preview target by default in canvas context', () => {
    const context = createHostContext({
      contentMode: 'canvas',
      viewMode: 'canvas',
      selectedCanvas: {
        name: 'home-canvas',
        displayName: 'Home Canvas',
      },
      canvasSelection: {
        elementId: 'embed-2',
        customData: {
          previewUrl: '/prototypes/profile',
          resourceType: 'prototype',
          resourceId: 'profile',
          previewKind: 'prototype',
        },
      },
    });

    expect(resolvePreviewCaptureTarget(undefined, context)).toMatchObject({
      kind: 'canvasElement',
      canvasElementId: 'embed-2',
      url: 'http://localhost:5174/prototypes/profile',
      resourceType: 'prototype',
      resourceId: 'profile',
      previewKind: 'prototype',
    });
  });

  it('resolves current-project navigation targets for prototype canvas doc and theme resources', () => {
    const context = createHostContext();

    expect(resolvePreviewNavigateTarget({
      target: {
        resourceType: 'prototype',
        resourceId: 'profile',
        pageId: 'details',
        collapseSidebar: true,
      },
    }, context)).toMatchObject({
      resourceType: 'prototype',
      resourceId: 'profile',
      pageId: 'details',
      collapseSidebar: true,
      deepLinkTarget: {
        resourceType: 'prototype',
        resourceId: 'profile',
        view: 'demo',
        pageId: 'details',
        collapseSidebar: true,
      },
    });
    expect(resolvePreviewNavigateTarget({
      target: {
        resourceType: 'canvas',
        resourceId: 'home',
        pageId: 'ignored-page',
      },
    }, context)).toMatchObject({
      resourceType: 'canvas',
      resourceId: 'home',
      deepLinkTarget: {
        resourceType: 'prototype',
        resourceId: 'home',
        view: 'canvas',
      },
    });
    expect(resolvePreviewNavigateTarget({
      target: {
        resourceType: 'doc',
        resourceId: 'guide',
      },
    }, context)).toMatchObject({
      resourceType: 'doc',
      resourceId: 'guide',
      deepLinkTarget: {
        resourceType: 'doc',
        resourceId: 'guide',
      },
    });
    expect(resolvePreviewNavigateTarget({
      target: {
        resourceType: 'theme',
        resourceId: 'brand',
      },
    }, context)).toMatchObject({
      resourceType: 'theme',
      resourceId: 'brand',
      deepLinkTarget: {
        resourceType: 'theme',
        resourceId: 'brand',
      },
    });
  });

  it('rejects preview navigation targets that try to leave the current project or use arbitrary URLs', () => {
    const context = createHostContext();

    expect(() => resolvePreviewNavigateTarget({
      projectId: 'other-project',
      target: {
        resourceType: 'prototype',
        resourceId: 'home',
      },
    }, context)).toThrow(/projectId is not supported/u);
    expect(() => resolvePreviewNavigateTarget({
      target: {
        resourceType: 'prototype',
        resourceId: 'home',
        projectId: 'other-project',
      },
    }, context)).toThrow(/projectId is not supported/u);
    expect(() => resolvePreviewNavigateTarget({
      url: 'https://example.com',
      target: {
        resourceType: 'prototype',
        resourceId: 'home',
      },
    }, context)).toThrow(/url is not supported/u);
    expect(() => resolvePreviewNavigateTarget({
      target: {
        resourceType: 'prototype',
        resourceId: 'home',
        url: '/elsewhere',
      },
    }, context)).toThrow(/url is not supported/u);
    expect(() => resolvePreviewNavigateTarget({
      target: {
        resourceType: 'prototype',
        resourceId: 'missing',
      },
    }, context)).toThrow(/resource was not found/u);
    expect(() => resolvePreviewNavigateTarget({
      target: {
        resourceType: 'prototype',
        resourceId: 'home',
        meta: {
          projectId: 'other-project',
        },
      },
    } as any, context)).toThrow(/projectId is not supported/u);
    expect(() => resolvePreviewNavigateTarget({
      target: {
        resourceType: 'prototype',
        resourceId: 'home',
        meta: {
          url: '/elsewhere',
        },
      },
    } as any, context)).toThrow(/url is not supported/u);
  });

  it('runs preview navigation through the host callback and returns refreshed current context', async () => {
    const onNavigate = vi.fn(async () => createHostContext({
      viewMode: 'canvas',
      contentMode: 'canvas',
      selectedItem: createResource({ name: 'profile', resourceId: 'profile' }),
      selectedCanvas: createResource({ name: 'profile', resourceId: 'profile' }),
      currentUrl: 'http://localhost:5174/?p=profile&v=canvas',
    }));

    const result = await runPreviewNavigate({
      context: createHostContext(),
      args: {
        target: {
          resourceType: 'canvas',
          resourceId: 'profile',
        },
      },
      onNavigate,
    });

    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({
      resourceType: 'canvas',
      resourceId: 'profile',
      collapseSidebar: false,
      deepLinkTarget: {
        resourceType: 'prototype',
        resourceId: 'profile',
        view: 'canvas',
        collapseSidebar: false,
      },
    }));
    expect(result).toMatchObject({
      navigated: true,
      current: {
        resourceType: 'canvas',
        resourceId: 'profile',
        contentMode: 'canvas',
        viewMode: 'canvas',
        url: 'http://localhost:5174/?p=profile&v=canvas',
      },
    });
  });

  it('keeps preview navigation command handling wired to the latest onNavigate callback', () => {
    const source = readFileSync(resolve(__dirname, './previewBridgeHost.ts'), 'utf8');
    const hookStart = source.indexOf('export function usePreviewBridgeHost');
    const hookSource = source.slice(hookStart);

    expect(hookStart).toBeGreaterThan(-1);
    expect(hookSource).toContain('const onNavigateRef = useRef(options.onNavigate);');
    expect(hookSource).toContain('onNavigateRef.current = options.onNavigate;');
    expect(hookSource).toContain('onNavigateRef.current');
    expect(hookSource).toContain("__AXHUB_PREVIEW_BRIDGE_CLIENT_ID__");
    expect(hookSource).toContain("msg.type === 'hello'");
  });

  it('reuses a short-lived hidden iframe for multi-viewport capture and removes it in finally', async () => {
    vi.useFakeTimers();
    const iframe = new FakeElement();
    const appendChild = vi.fn();
    const documentStub = {
      createElement: vi.fn(() => iframe),
      body: { appendChild },
    };
    vi.stubGlobal('document', documentStub);

    const capture = runPreviewCapture({
      context: createHostContext(),
      args: {
        viewports: ['mobile', 'desktop'],
        waitSeconds: 0,
      },
      captureIframe: vi.fn(async ({ iframe: capturedIframe, viewport }) => ({
        dataUrl: `data:image/png;base64,${viewport.id}`,
        width: viewport.width,
        height: viewport.height,
        mimeType: 'image/png',
        reused: capturedIframe === iframe,
      })),
      waitForReady: vi.fn(async () => undefined),
      settleFrame: vi.fn(async () => undefined),
      sleep: vi.fn(async () => undefined),
    });

    await vi.runAllTimersAsync();
    const result = await capture;

    expect(documentStub.createElement).toHaveBeenCalledWith('iframe');
    expect(appendChild).toHaveBeenCalledWith(iframe);
    expect(result.screenshots).toHaveLength(2);
    expect(result.screenshots.every((item: any) => item.reused)).toBe(true);
    expect(iframe.style.width).toBe('1440px');
    expect(iframe.style.height).toBe('900px');
    expect(iframe.removed).toBe(true);
    vi.useRealTimers();
  });

  it('attaches collected diagnostics to capture errors before removing the iframe', async () => {
    const iframe = new FakeElement();
    const documentStub = {
      createElement: vi.fn(() => iframe),
      body: { appendChild: vi.fn() },
    };
    vi.stubGlobal('document', documentStub);

    let thrown: any = null;
    try {
      await runPreviewCapture({
        context: createHostContext(),
        args: { waitSeconds: 0 },
        waitForReady: vi.fn(async (_iframe, _target, diagnostics) => {
          diagnostics.push({
            level: 'warning',
            type: 'runtime-warning',
            message: 'runtime warned before capture',
            timestamp: '2026-06-16T00:00:00.000Z',
          });
        }),
        settleFrame: vi.fn(async () => undefined),
        captureIframe: vi.fn(async () => {
          throw new Error('capture exploded');
        }),
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.diagnostics).toEqual([
      {
        level: 'warning',
        type: 'runtime-warning',
        message: 'runtime warned before capture',
        timestamp: '2026-06-16T00:00:00.000Z',
      },
      expect.objectContaining({
        level: 'error',
        type: 'capture-error',
        message: 'capture exploded',
      }),
    ]);
    expect(iframe.removed).toBe(true);
  });
});
