import { afterEach, describe, expect, it, vi } from 'vitest';

import * as helpers from './previewActions.helpers';
import {
  buildCombinedPrototypePrompt,
  buildProjectPrototypeIframeUrl,
  buildProjectPrototypeScreenshotIframeUrl,
  createDefaultHostToolbarState,
  getClientUrlOrigin,
  resolveCurrentPublishResourcePath,
  resolveCurrentPreviewScreenshotSize,
  resolveHostToolbarStateForDisplay,
  waitForHostToolbarActionState,
} from './previewActions.helpers';

describe('previewActions.helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves relative client URLs against the runtime origin instead of the admin origin', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:53817',
      },
      __RUNTIME_ORIGIN__: 'http://localhost:51723',
    });

    expect(getClientUrlOrigin('/prototypes/%E6%A0%87%E6%B3%A8%E6%BC%94%E7%A4%BA')).toBe('http://localhost:51723');
  });

  it('builds relative prototype iframe URLs from the runtime origin instead of the admin origin', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:53817',
      },
      __RUNTIME_ORIGIN__: 'http://localhost:51723',
    });

    expect(buildProjectPrototypeIframeUrl({
      name: 'beginner-guide',
      displayName: '新手指导',
      clientUrl: '/prototypes/beginner-guide',
      previewUrl: '/prototypes/beginner-guide',
    })).toBe('http://localhost:51723/prototypes/beginner-guide');
  });

  it('builds relative theme iframe URLs from the runtime origin instead of the admin origin', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:53817',
      },
      __RUNTIME_ORIGIN__: 'http://localhost:51723',
    });

    expect(buildProjectPrototypeIframeUrl({
      name: 'brand',
      clientUrl: '/themes/brand',
      previewUrl: '/themes/brand',
    })).toBe('http://localhost:51723/themes/brand');
  });

  it('keeps relative prototype iframe URLs usable from the current origin when runtime origin is unavailable', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:53817',
      },
      __RUNTIME_ORIGIN__: '',
    });

    expect(buildProjectPrototypeIframeUrl({
      name: 'annotation-demo',
      displayName: '标注演示',
      clientUrl: '/prototypes/annotation-demo',
      previewUrl: '/prototypes/annotation-demo',
    })).toBe('http://localhost:53817/prototypes/annotation-demo');
  });

  it('keeps runtime-origin prototype iframe URLs on the runtime origin', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:53817',
      },
      __RUNTIME_ORIGIN__: 'http://localhost:51723',
    });

    expect(buildProjectPrototypeIframeUrl({
      name: 'annotation-demo',
      displayName: '标注演示',
      clientUrl: 'http://localhost:51723/prototypes/annotation-demo?variant=dark',
      previewUrl: 'http://localhost:51723/prototypes/annotation-demo',
    })).toBe('http://localhost:51723/prototypes/annotation-demo?variant=dark');

    expect(getClientUrlOrigin('http://localhost:51723/prototypes/annotation-demo')).toBe('http://localhost:51723');
  });

  it('keeps runtime-origin prototype iframe URLs direct while preserving query and hash params', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:53817',
      },
      __RUNTIME_ORIGIN__: 'http://localhost:51720',
    });

    const url = new URL(buildProjectPrototypeIframeUrl({
      name: 'touch-and-talk-annotation-demo',
      displayName: '批注演示',
      projectId: 'make-project',
      clientUrl: 'http://localhost:51720/prototypes/touch-and-talk-annotation-demo?variant=dark',
      previewUrl: 'http://localhost:51720/prototypes/touch-and-talk-annotation-demo',
      pages: [
        { id: 'more-scenarios', title: '更多场景' },
      ],
    }, { hostToolbar: true }, 'more-scenarios'));

    expect(url.origin).toBe('http://localhost:51720');
    expect(url.pathname).toBe('/prototypes/touch-and-talk-annotation-demo');
    expect(url.searchParams.get('variant')).toBe('dark');
    expect(url.searchParams.get('genieToolbar')).toBe('host');
    expect(url.hash).toBe('#page=more-scenarios');
  });

  it('builds same-origin prototype screenshot iframe URLs from runtime-origin previews', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:53817',
      },
      __RUNTIME_ORIGIN__: 'http://localhost:51723',
    });

    const url = new URL(buildProjectPrototypeScreenshotIframeUrl({
      name: 'touch-and-talk-annotation-demo',
      displayName: '批注演示',
      clientUrl: 'http://localhost:51723/prototypes/touch-and-talk-annotation-demo?genieToolbar=host',
      previewUrl: 'http://localhost:51723/prototypes/touch-and-talk-annotation-demo',
    }, 'cover'));

    expect(url.origin).toBe('http://localhost:53817');
    expect(url.pathname).toBe('/prototypes/touch-and-talk-annotation-demo');
    expect(url.searchParams.get('genieToolbar')).toBeNull();
    expect(url.hash).toBe('#page=cover');
  });

  it('keeps unrelated absolute prototype origins unchanged even when the injected runtime origin is different', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:53817',
      },
      __RUNTIME_ORIGIN__: 'http://localhost:51722',
    });

    expect(buildProjectPrototypeIframeUrl({
      name: 'beginner-guide',
      displayName: '新手指导',
      clientUrl: 'http://localhost:51721/prototypes/beginner-guide',
      previewUrl: 'http://localhost:51721/prototypes/beginner-guide',
    })).toBe('http://localhost:51721/prototypes/beginner-guide');

    expect(getClientUrlOrigin('http://localhost:51721/prototypes/beginner-guide')).toBe('http://localhost:51721');
  });

  it('keeps explicit client URL origins unchanged', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:53817',
      },
      __RUNTIME_ORIGIN__: 'http://localhost:51723',
    });

    expect(getClientUrlOrigin('http://client.local:4173/prototypes/home')).toBe('http://client.local:4173');
  });

  it('includes the make admin origin in quick-edit export messages', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:53817',
      },
      __RUNTIME_ORIGIN__: 'http://localhost:51723/',
    });

    expect(helpers.createRuntimeExportMessage({
      type: 'axhub.quickEdit.export.captureScreenshot',
      selectedItem: {
        projectId: 'project-1',
        resourceId: 'home',
        clientUrl: 'http://localhost:51721/prototypes/home',
      },
      requestId: 'copy-screenshot-1',
    })).toMatchObject({
      type: 'axhub.quickEdit.export.captureScreenshot',
      requestId: 'copy-screenshot-1',
      runtimeOrigin: 'http://localhost:53817',
    });
  });

  it('keeps unrelated relative preview URLs on the current origin', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:53817',
      },
      __RUNTIME_ORIGIN__: 'http://localhost:51723',
    });

    expect(getClientUrlOrigin('/api/markdown-file?path=README.md')).toBe('http://localhost:53817');
    expect(buildProjectPrototypeIframeUrl({
      name: 'markdown-preview',
      clientUrl: '/api/markdown-file?path=README.md',
    })).toBe('http://localhost:53817/api/markdown-file?path=README.md');
  });

  it('opens the prototype default hash page when no explicit page is selected', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:53817',
      },
    });

    const url = new URL(buildProjectPrototypeIframeUrl({
      name: 'beginner-guide',
      clientUrl: 'http://client.local:4173/prototypes/beginner-guide',
      pages: [
        { id: 'install-agent', title: '安装 Agent' },
        { id: 'choose-model', title: '选对模型' },
      ],
      defaultPageId: 'install-agent',
    }, undefined, null));

    expect(url.hash).toBe('#page=install-agent');
  });

  it('resolves the current publish path from the active prototype or theme resource', () => {
    expect(resolveCurrentPublishResourcePath({
      contentMode: 'preview',
      selectedItem: {
        name: 'home',
        displayName: 'Home',
        jsUrl: '',
        specUrl: '',
        filePath: 'src/prototypes/home/index.tsx',
      },
      selectedTheme: null,
    })).toBe('src/prototypes/home');

    expect(resolveCurrentPublishResourcePath({
      contentMode: 'theme',
      selectedItem: null,
      selectedTheme: {
        name: 'brand',
        displayName: 'Brand',
        absoluteFilePath: '/workspace/src/themes/brand/index.tsx',
      },
    })).toBe('src/themes/brand');

    expect(resolveCurrentPublishResourcePath({
      contentMode: 'theme',
      selectedItem: null,
      selectedTheme: {
        name: 'brand',
        displayName: 'Brand',
        path: 'themes/brand',
        absoluteFilePath: '/workspace/src/themes/other/index.tsx',
      },
    })).toBe('src/themes/brand');
  });

  it('resolves screenshot copy dimensions from the current preview mode and primary split pane', () => {
    expect(resolveCurrentPreviewScreenshotSize({
      previewMode: 'single',
      singlePreset: 'custom',
      customWidth: 1024,
      customHeight: 1365,
      multiPageColumns: 3,
      splitWidths: { primary: 1440, secondary: 393 },
      splitHeights: { primary: 900, secondary: 852 },
      scaleMode: 'fit-screen',
    }, { width: 1920, height: 1080 })).toEqual({ width: 1024, height: 1365 });

    expect(resolveCurrentPreviewScreenshotSize({
      previewMode: 'split',
      singlePreset: 'desktop',
      customWidth: null,
      customHeight: null,
      multiPageColumns: 3,
      splitWidths: { primary: 1280, secondary: 390 },
      splitHeights: { primary: 720, secondary: 846 },
      scaleMode: 'fit-screen',
    }, { width: 1920, height: 1080 })).toEqual({ width: 1280, height: 720 });
  });

  it('keeps a settled local AI connection visible after a wake action succeeds', () => {
    const sleepingState = createDefaultHostToolbarState();
    const awakeState = {
      ...sleepingState,
      robotState: 'awake' as const,
      robotLoading: false,
      sendDisabled: false,
    };

    const resolvedState = resolveHostToolbarStateForDisplay(sleepingState, awakeState, false);

    expect(resolvedState?.robotState).toBe('awake');
    expect(resolvedState?.robotLoading).toBe(false);
    expect(resolvedState?.sendDisabled).toBe(false);
  });

  it('preserves the selection mode flag when showing a hidden host toolbar state', () => {
    const hiddenHostState = {
      ...createDefaultHostToolbarState(),
      visible: false,
      selectionModeActive: false,
    };

    const resolvedState = resolveHostToolbarStateForDisplay(null, hiddenHostState, false);

    expect(resolvedState?.visible).toBe(true);
    expect(resolvedState?.selectionModeActive).toBe(false);
  });

  it('waits for the next host toolbar state when wake starts from a stale sleeping snapshot', async () => {
    vi.useFakeTimers();
    const sleepingState = createDefaultHostToolbarState();
    const awakeState = {
      ...sleepingState,
      robotState: 'awake' as const,
      robotLoading: false,
      sendDisabled: false,
    };
    let listener: ((state: typeof sleepingState) => void) | null = null;
    const waitPromise = waitForHostToolbarActionState({
      getHostToolbarState: () => sleepingState,
      subscribeHostToolbarState: (nextListener) => {
        listener = nextListener;
        return () => undefined;
      },
    }, { type: 'wake-genie' }, sleepingState);

    listener?.(awakeState);

    await expect(waitPromise).resolves.toEqual(awakeState);
    vi.useRealTimers();
  });

  it('combines split prototype prompts with pane labels and skips empty panes', () => {
    expect(buildCombinedPrototypePrompt([
      { pane: 'primary', promptText: 'PC prompt' },
      { pane: 'secondary', promptText: '  手机 prompt  ' },
    ])).toBe([
      '请同时处理以下两个端的批注修改。',
      '',
      '## PC 端',
      'PC prompt',
      '',
      '## 手机端',
      '手机 prompt',
    ].join('\n'));

    expect(buildCombinedPrototypePrompt([
      { pane: 'primary', promptText: '' },
      { pane: 'secondary', promptText: '手机 only' },
    ])).toBe([
      '请处理以下手机端的批注修改。',
      '',
      '## 手机端',
      '手机 only',
    ].join('\n'));
  });

  it('does not expose host Space temporary interaction forwarding helpers', () => {
    expect('getQuickEditTemporaryInteractionTargets' in helpers).toBe(false);
    expect('shouldHandleQuickEditSpaceTemporaryInteractionEvent' in helpers).toBe(false);
    expect('QUICK_EDIT_TEMPORARY_INTERACTION_MESSAGE_TYPE' in helpers).toBe(false);
    expect('QUICK_EDIT_SPACE_PASS_THROUGH_MESSAGE_TYPE' in helpers).toBe(false);
  });

});
