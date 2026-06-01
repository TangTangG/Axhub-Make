import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildProjectPrototypeIframeUrl,
  createDefaultHostToolbarState,
  getClientUrlOrigin,
  resolveHostToolbarStateForDisplay,
  startDeferredAssistantRuntimeProbe,
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

  it('keeps explicit client URL origins unchanged', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://localhost:53817',
      },
      __RUNTIME_ORIGIN__: 'http://localhost:51723',
    });

    expect(getClientUrlOrigin('http://client.local:4173/prototypes/home')).toBe('http://client.local:4173');
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

  it('runs assistant runtime probing in the background and reports readiness later', async () => {
    let resolveProbe: ((value: unknown) => void) | null = null;
    const events: string[] = [];

    startDeferredAssistantRuntimeProbe({
      probeRuntime: () => new Promise((resolve) => {
        resolveProbe = resolve;
      }),
      isEditorActive: () => true,
      onRuntimeReady: () => {
        events.push('ready');
      },
    });
    events.push('after-start');

    expect(events).toEqual(['after-start']);

    resolveProbe?.({ health: { status: 'ready' } });
    await Promise.resolve();
    await Promise.resolve();

    expect(events).toEqual(['after-start', 'ready']);
  });
});
