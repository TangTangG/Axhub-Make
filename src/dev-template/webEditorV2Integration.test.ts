import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  createGenieEditor: vi.fn(),
  getGlobalGenieEditorTweakProtocol: vi.fn(),
}));

vi.mock('axhub-genie-editor', () => ({
  createGenieEditor: mocked.createGenieEditor,
  getGlobalGenieEditorTweakProtocol: mocked.getGlobalGenieEditorTweakProtocol,
}));

vi.mock('../index/components/dialogs/AppDialogProvider', () => ({
  getImperativeAppDialog: () => null,
}));

import {
  buildInternalPrototypeCommentPageScope,
  createWebEditorV2Controller,
  createPrototypeCommentsPersistenceAdapter,
  readHostToolbarModeFromSearch,
  resolveHostResourceContextFromLocation,
} from './webEditorV2Integration';

beforeEach(() => {
  mocked.createGenieEditor.mockReset();
  mocked.getGlobalGenieEditorTweakProtocol.mockReset();
  vi.unstubAllGlobals();
});

describe('createWebEditorV2Controller launch options', () => {
  it('ignores enable-time Genie bridge and editor integration options before creating the editor', async () => {
    const start = vi.fn();
    const stop = vi.fn();

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop,
      getState: vi.fn(() => ({ active: false, version: 2 })),
      getStatus: vi.fn(() => ({ active: false, undoCount: 0, redoCount: 0 })),
      acknowledgeSavedTextChanges: vi.fn(),
      acknowledgeSavedStyleChanges: vi.fn(),
      getHostToolbarState: vi.fn(),
      subscribeHostToolbarState: vi.fn(() => () => undefined),
      runHostToolbarAction: vi.fn(async () => true),
      destroy: vi.fn(),
    });

    vi.stubGlobal('window', {
      location: {
        search: '',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home',
        protocol: 'http:',
        hostname: 'localhost',
      },
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });

    const controller = createWebEditorV2Controller();
    await controller.enable({
      toolbarMode: 'host',
      initialDarkMode: true,
      mobileMode: true,
      genieBridge: {
        apiBaseUrl: 'http://localhost:32124/api',
        integrationChannel: '/workspace/demo/project',
        projectPath: '/workspace/demo/project',
      },
      integrationWs: {
        enabled: true,
        apiBaseUrl: 'http://localhost:32124/api',
        channel: '/workspace/demo/project',
        clientId: 'make-editor-1234',
      },
    } as any);

    expect(mocked.createGenieEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        mobileMode: true,
      }),
    );
    expect(mocked.createGenieEditor.mock.calls[0]?.[0]).not.toHaveProperty('genieBridge');
    expect(mocked.createGenieEditor.mock.calls[0]?.[0]).not.toHaveProperty('integrationWs');
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('does not fetch runtime fallback for ignored AI bridge options', async () => {
    const start = vi.fn();
    const stop = vi.fn();
    const fetchRuntime = vi.fn(async () => {
      throw new Error('runtime fallback should not be fetched');
    });

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop,
      getState: vi.fn(() => ({ active: false, version: 2 })),
      getStatus: vi.fn(() => ({ active: false, undoCount: 0, redoCount: 0 })),
      acknowledgeSavedTextChanges: vi.fn(),
      acknowledgeSavedStyleChanges: vi.fn(),
      getHostToolbarState: vi.fn(),
      subscribeHostToolbarState: vi.fn(() => () => undefined),
      runHostToolbarAction: vi.fn(async () => true),
      destroy: vi.fn(),
    });

    vi.stubGlobal('window', {
      location: {
        search: '',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home',
        protocol: 'http:',
        hostname: 'localhost',
      },
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });
    vi.stubGlobal('fetch', fetchRuntime as unknown as typeof fetch);

    const controller = createWebEditorV2Controller();
    await controller.enable({
      toolbarMode: 'host',
      genieBridge: {
        apiBaseUrl: 'http://localhost:32123/api',
        integrationChannel: 'axhub',
        targetClientId: '',
      },
      integrationWs: {
        enabled: false,
        apiBaseUrl: 'http://localhost:32123/api',
        channel: 'axhub',
        clientId: '',
      },
    } as any);

    expect(fetchRuntime).not.toHaveBeenCalled();
    expect(mocked.createGenieEditor.mock.calls[0]?.[0]).not.toHaveProperty('genieBridge');
    expect(mocked.createGenieEditor.mock.calls[0]?.[0]).not.toHaveProperty('integrationWs');
    expect(start).toHaveBeenCalledTimes(1);
  });
});

describe('readHostToolbarModeFromSearch', () => {
  it('enables host toolbar mode only for explicit host requests', () => {
    expect(readHostToolbarModeFromSearch('?genieToolbar=host')).toBe('host');
    expect(readHostToolbarModeFromSearch('?genieToolbar=inline')).toBeUndefined();
    expect(readHostToolbarModeFromSearch('')).toBeUndefined();
  });
});

describe('resolveHostResourceContextFromLocation', () => {
  it('builds stable internal prototype page scopes from Make route page ids', () => {
    expect(
      buildInternalPrototypeCommentPageScope('touch-and-talk-annotation-demo', 'common-tips'),
    ).toBe('prototypes/touch-and-talk-annotation-demo::page::common-tips');

    expect(
      buildInternalPrototypeCommentPageScope('prototypes/touch-and-talk-annotation-demo', 'voice-annotation'),
    ).toBe('prototypes/touch-and-talk-annotation-demo::page::voice-annotation');

    expect(buildInternalPrototypeCommentPageScope('demo', '../bad')).toBe('');
  });

  it('extracts reusable host resource context from prototype urls', () => {
    expect(
      resolveHostResourceContextFromLocation(
        '/prototypes/ref-dashboard',
        'http://localhost:51720/prototypes/ref-dashboard?editor=webEditorV2',
      ),
    ).toEqual({
      kind: 'prototype-entry',
      id: 'prototypes/ref-dashboard',
      path: 'prototypes/ref-dashboard',
      url: 'http://localhost:51720/prototypes/ref-dashboard?editor=webEditorV2',
      meta: {
        group: 'prototypes',
        name: 'ref-dashboard',
        commentPageScope: '/prototypes/ref-dashboard',
      },
    });
  });

  it('adds pane-specific storage scope for quick edit urls', () => {
    expect(
      resolveHostResourceContextFromLocation(
        '/prototypes/ref-dashboard',
        'http://localhost:51720/prototypes/ref-dashboard?editor=webEditorV2&axhubPane=secondary',
      ),
    ).toEqual({
      kind: 'prototype-entry',
      id: 'prototypes/ref-dashboard',
      path: 'prototypes/ref-dashboard',
      url: 'http://localhost:51720/prototypes/ref-dashboard?editor=webEditorV2&axhubPane=secondary',
      meta: {
        group: 'prototypes',
        name: 'ref-dashboard',
        storageScope: 'prototypes/ref-dashboard::quick-edit::secondary',
        commentPageScope: '/prototypes/ref-dashboard',
      },
    });
  });

  it('keeps pane-specific storage scope for embedded quick edit context urls', () => {
    expect(
      resolveHostResourceContextFromLocation(
        '/prototypes/ref-dashboard',
        'http://localhost:51720/prototypes/ref-dashboard?axhubPane=secondary&axhubQuickEditContext=1',
      ),
    ).toEqual({
      kind: 'prototype-entry',
      id: 'prototypes/ref-dashboard',
      path: 'prototypes/ref-dashboard',
      url: 'http://localhost:51720/prototypes/ref-dashboard?axhubPane=secondary&axhubQuickEditContext=1',
      meta: {
        group: 'prototypes',
        name: 'ref-dashboard',
        storageScope: 'prototypes/ref-dashboard::quick-edit::secondary',
        commentPageScope: '/prototypes/ref-dashboard',
      },
    });
  });

  it('derives stable comment page scope from business query and hash while filtering editor controls', () => {
    expect(
      resolveHostResourceContextFromLocation(
        '/prototypes/ref-dashboard',
        'http://localhost:51720/prototypes/ref-dashboard?editor=webEditorV2&tab=sales&axhubPane=secondary&filter=active&axhubQuickEditContext=1#details',
      ),
    ).toEqual({
      kind: 'prototype-entry',
      id: 'prototypes/ref-dashboard',
      path: 'prototypes/ref-dashboard',
      url: 'http://localhost:51720/prototypes/ref-dashboard?editor=webEditorV2&tab=sales&axhubPane=secondary&filter=active&axhubQuickEditContext=1#details',
      meta: {
        group: 'prototypes',
        name: 'ref-dashboard',
        storageScope: 'prototypes/ref-dashboard::quick-edit::secondary',
        commentPageScope: '/prototypes/ref-dashboard?filter=active&tab=sales#details',
      },
    });
  });

  it('resolves prototype context from index deep links with p and page query params', () => {
    expect(
      resolveHostResourceContextFromLocation(
        '/',
        'http://localhost:53817/?projectId=make-project&p=touch-and-talk-annotation-demo&page=common-tips',
      ),
    ).toEqual({
      kind: 'prototype-entry',
      id: 'prototypes/touch-and-talk-annotation-demo',
      path: 'prototypes/touch-and-talk-annotation-demo',
      url: 'http://localhost:53817/?projectId=make-project&p=touch-and-talk-annotation-demo&page=common-tips',
      meta: {
        group: 'prototypes',
        name: 'touch-and-talk-annotation-demo',
        commentPageScope: 'prototypes/touch-and-talk-annotation-demo::page::common-tips',
      },
    });
  });

  it('uses the internal prototype page scope for hash-routed prototype pages', () => {
    expect(
      resolveHostResourceContextFromLocation(
        '/prototypes/touch-and-talk-annotation-demo',
        'http://localhost:53817/prototypes/touch-and-talk-annotation-demo?genieToolbar=host#page=common-tips',
      )?.meta,
    ).toEqual({
      group: 'prototypes',
      name: 'touch-and-talk-annotation-demo',
      commentPageScope: 'prototypes/touch-and-talk-annotation-demo::page::common-tips',
    });
  });

  it('keeps numeric prototype ids valid when resolving index deep link scopes', () => {
    expect(
      resolveHostResourceContextFromLocation(
        '/',
        'http://localhost:53817/?p=demo-2026&page=step-01&projectId=make-project',
      )?.meta,
    ).toEqual({
      group: 'prototypes',
      name: 'demo-2026',
      commentPageScope: 'prototypes/demo-2026::page::step-01',
    });
  });

  it('prefers explicit comment page scope over the URL-derived scope', () => {
    expect(
      resolveHostResourceContextFromLocation(
        '/prototypes/ref-dashboard',
        'http://localhost:51720/prototypes/ref-dashboard?tab=sales#details',
        { commentPageScope: 'page:dashboard-sales' },
      )?.meta,
    ).toEqual({
      group: 'prototypes',
      name: 'ref-dashboard',
      commentPageScope: 'page:dashboard-sales',
    });
  });

  it('extracts host resource context from spec-template markdown urls', () => {
    expect(
      resolveHostResourceContextFromLocation(
        '/spec-template.html',
        'http://localhost:51720/spec-template.html?url=%2Fapi%2Fmarkdown-file%3Fpath%3D%252Fworkspace%252Fdemo%252Fproject%252Fsrc%252Fresources%252Fintro.md',
      ),
    ).toEqual({
      kind: 'document',
      id: '/workspace/demo/project/src/resources/intro.md',
      path: '/workspace/demo/project/src/resources/intro.md',
      url: 'http://localhost:51720/spec-template.html?url=%2Fapi%2Fmarkdown-file%3Fpath%3D%252Fworkspace%252Fdemo%252Fproject%252Fsrc%252Fresources%252Fintro.md',
      meta: {
        filePath: '/workspace/demo/project/src/resources/intro.md',
        route: '/spec-template.html',
      },
    });
  });

  it('returns null for unrelated locations', () => {
    expect(
      resolveHostResourceContextFromLocation('/preview/custom-page', 'http://localhost:51720/preview/custom-page'),
    ).toBeNull();
  });
});

describe('createWebEditorV2Controller', () => {
  it('uses neutral editor debug title wording instead of the old Genie runtime label', async () => {
    const start = vi.fn();
    const stop = vi.fn();
    const setIntervalMock = vi.fn(() => 1);
    const clearIntervalMock = vi.fn();
    const documentMock = { title: 'Prototype Preview', body: {} };

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop,
      getState: vi.fn(() => ({ active: false, version: 2 })),
      getStatus: vi.fn(() => ({ active: false, undoCount: 0, redoCount: 0 })),
      getDebugState: vi.fn(() => ({
        connected: false,
        available: true,
        hasReusableConversation: false,
        currentConversation: null,
        currentElementTask: null,
        visibleTasks: [],
        selectedElementKey: null,
        bridgeConfig: null,
      })),
      acknowledgeSavedTextChanges: vi.fn(),
      acknowledgeSavedStyleChanges: vi.fn(),
      destroy: vi.fn(),
    });

    vi.stubGlobal('window', {
      location: {
        search: '?genieDebugTitle=1',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home',
      },
      setInterval: setIntervalMock,
      clearInterval: clearIntervalMock,
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });
    vi.stubGlobal('document', documentMock);

    const controller = createWebEditorV2Controller();
    await controller.enable();

    expect(documentMock.title).toContain('[EditorDebug]');
    expect(documentMock.title).not.toContain('[GenieDebug]');
    expect(setIntervalMock).toHaveBeenCalledWith(expect.any(Function), 250);
  });

  it('creates the editor from the shared package without forwarding runtime bridge options', async () => {
    const start = vi.fn();
    const stop = vi.fn();
    const getState = vi.fn(() => ({ active: false, version: 2 }));
    const acknowledgeSavedTextChanges = vi.fn();
    const acknowledgeSavedStyleChanges = vi.fn();

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop,
      getState,
      getStatus: vi.fn(() => ({ active: false, undoCount: 0, redoCount: 0 })),
      subscribeStatus: vi.fn(() => () => undefined),
      getSelectedElement: vi.fn(() => null),
      getModifiedElements: vi.fn(() => []),
      getTextChanges: vi.fn(() => []),
      getStyleChanges: vi.fn(() => ({ cssText: '' })),
      getEditedSnapshot: vi.fn(() => ({
        resource: null,
        selectedElement: null,
        modifiedElements: [],
        textChanges: [],
        styleChanges: { cssText: '' },
      })),
      getDebugState: vi.fn(() => null),
      acknowledgeSavedTextChanges,
      acknowledgeSavedStyleChanges,
      clearSelection: vi.fn(),
      revertElement: vi.fn(),
      clearElementEdits: vi.fn(),
      clearAllEdits: vi.fn(),
      destroy: vi.fn(),
      toggle: vi.fn(() => false),
    });

    vi.stubGlobal('window', {
      location: {
        search:
          '?genieApiBaseUrl=http://localhost:32123/api&genieIntegrationChannel=make&genieTargetClientId=frontend-1&cwd=%2Fworkspace%2Fdemo%2Fproject&provider=codex&editorIntegrationWs=1&editorApiBaseUrl=http://localhost:32123/api&editorIntegrationChannel=make&editorClientId=make-editor-abcd&editorSessionId=session-001&editorMobileMode=true',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home?editor=webEditorV2',
      },
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ health: { status: 'ready' } }),
    })) as typeof fetch);

    const controller = createWebEditorV2Controller();
    await controller.enable();

    expect(mocked.createGenieEditor).toHaveBeenCalledTimes(1);
    expect(mocked.createGenieEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        mobileMode: true,
        ui: {
          breadcrumbs: true,
          getAssistantPanelOpen: expect.any(Function),
          propertyPanel: true,
          showCopyPromptAction: true,
        },
        host: expect.objectContaining({
          buildCopyPrompt: expect.any(Function),
          getResourceContext: expect.any(Function),
          persistenceAdapter: expect.any(Object),
        }),
      }),
    );
    expect(mocked.createGenieEditor.mock.calls[0]?.[0]).not.toHaveProperty('genieBridge');
    expect(mocked.createGenieEditor.mock.calls[0]?.[0]).not.toHaveProperty('integrationWs');

    const host = mocked.createGenieEditor.mock.calls[0]?.[0]?.host;
    expect(host?.getResourceContext?.()).toEqual({
      kind: 'prototype-entry',
      id: 'prototypes/home',
      path: 'prototypes/home',
      url: 'http://localhost:51720/prototypes/home?editor=webEditorV2',
      meta: {
        group: 'prototypes',
        name: 'home',
        commentPageScope: '/prototypes/home',
      },
    });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('uses prototype comment file adapter for host persistence', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith('/api/prototype-comments?') && init?.method !== 'PUT') {
        return {
          ok: true,
          json: async () => ({
            exists: true,
            document: {
              schemaVersion: 1,
              kind: 'prototype-edit-comments',
              resource: {
                id: 'home',
                targetPath: 'prototypes/home',
                filePath: 'src/prototypes/home/.spec/prototype-comments.json',
              },
              comments: [],
              tasks: {},
              images: [],
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({}),
      };
    }) as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    const adapter = createPrototypeCommentsPersistenceAdapter();
    const scope = {
      targetPath: 'prototypes/home',
      storageScope: 'prototypes/home',
      prototypeId: 'home',
      filePath: 'src/prototypes/home/index.tsx',
      resource: null,
    };

    await expect(adapter.read(scope)).resolves.toMatchObject({
      kind: 'prototype-edit-comments',
      resource: {
        targetPath: 'prototypes/home',
      },
    });
    await expect(adapter.write(scope, {
      schemaVersion: 1,
      kind: 'prototype-edit-comments',
      resource: {
        id: 'home',
        targetPath: 'prototypes/home',
        filePath: 'src/prototypes/home/.spec/prototype-comments.json',
      },
      comments: [],
      tasks: {},
      images: [],
    }, 'changes')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/prototype-comments?targetPath=prototypes%2Fhome&hydrateImages=1',
      { method: 'GET' },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/prototype-comments?targetPath=prototypes%2Fhome',
      expect.objectContaining({
        method: 'PUT',
      }),
    );
  });

  it('does not fetch assistant runtime defaults for editor bridge setup', async () => {
    const start = vi.fn();
    const stop = vi.fn();
    const acknowledgeSavedTextChanges = vi.fn();
    const acknowledgeSavedStyleChanges = vi.fn();

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop,
      getState: vi.fn(() => ({ active: false, version: 2 })),
      getStatus: vi.fn(() => ({ active: false, undoCount: 0, redoCount: 0 })),
      acknowledgeSavedTextChanges,
      acknowledgeSavedStyleChanges,
    });

    vi.stubGlobal('window', {
      location: {
        search: '?editorIntegrationWs=1&editorIntegrationChannel=make&editorClientId=make-editor-abcd',
        pathname: '/prototypes/home',
        href: 'http://127.0.0.1:51720/prototypes/home?editor=webEditorV2',
        protocol: 'http:',
        hostname: '127.0.0.1',
      },
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });
    const fetchMock = vi.fn(async (input: string) => {
      if (input === '/api/assistant/runtime?autoStart=false') {
        return {
          ok: true,
          json: async () => ({
            apiBaseUrl: 'http://127.0.0.1:32123/api',
            projectPath: '/workspace/demo/project',
            health: { status: 'ready' },
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${input}`);
    });
    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const controller = createWebEditorV2Controller();
    await controller.enable();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocked.createGenieEditor.mock.calls[0]?.[0]).not.toHaveProperty('genieBridge');
    expect(mocked.createGenieEditor.mock.calls[0]?.[0]).not.toHaveProperty('integrationWs');
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('normalizes project-local skillInstallSource before forwarding it to createGenieEditor', async () => {
    const start = vi.fn();
    const stop = vi.fn();

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop,
      getState: vi.fn(() => ({ active: false, version: 2 })),
      getStatus: vi.fn(() => ({ active: false, undoCount: 0, redoCount: 0 })),
      acknowledgeSavedTextChanges: vi.fn(),
      acknowledgeSavedStyleChanges: vi.fn(),
    });

    vi.stubGlobal('window', {
      location: {
        search:
          '?genieApiBaseUrl=http://localhost:32123/api&genieIntegrationChannel=make&genieTargetClientId=frontend-1',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home?editor=webEditorV2',
        protocol: 'http:',
        hostname: 'localhost',
      },
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ health: { status: 'ready' } }),
    })) as typeof fetch);

    const controller = createWebEditorV2Controller({
      ui: {
        skillInstallSource: '.agents/skills/prototype-comments/SKILL.md',
      },
    });
    await controller.enable();

    expect(mocked.createGenieEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        ui: {
          breadcrumbs: true,
          getAssistantPanelOpen: expect.any(Function),
          propertyPanel: true,
          showCopyPromptAction: true,
          skillInstallSource: '.agents/skills/prototype-comments/SKILL.md',
        },
      }),
    );
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('forwards explicit host toolbar mode from the embedded preview url', async () => {
    const start = vi.fn();

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop: vi.fn(),
      getState: vi.fn(() => ({ active: false, version: 2 })),
      getStatus: vi.fn(() => ({ active: false, undoCount: 0, redoCount: 0 })),
      getHostToolbarState: vi.fn(() => ({ toolbarMode: 'host', visible: true })),
      subscribeHostToolbarState: vi.fn(() => () => undefined),
      runHostToolbarAction: vi.fn(async () => true),
      acknowledgeSavedTextChanges: vi.fn(),
      acknowledgeSavedStyleChanges: vi.fn(),
    });

    vi.stubGlobal('window', {
      location: {
        search: '?genieToolbar=host',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home?genieToolbar=host',
        protocol: 'http:',
        hostname: 'localhost',
      },
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ health: { status: 'ready' } }),
    })) as typeof fetch);

    const controller = createWebEditorV2Controller();
    await controller.enable();

    expect(mocked.createGenieEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        ui: expect.objectContaining({
          toolbarMode: 'host',
        }),
      }),
    );
    expect(controller.getHostToolbarState()).toEqual({
      toolbarMode: 'host',
      visible: true,
    });
    await expect(controller.runHostToolbarAction({ type: 'wake-genie' })).resolves.toBe(true);
  });

  it('forwards host toolbar mode from direct dev-template enable options', async () => {
    const start = vi.fn();

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop: vi.fn(),
      getState: vi.fn(() => ({ active: false, version: 2 })),
      getStatus: vi.fn(() => ({ active: false, undoCount: 0, redoCount: 0 })),
      getHostToolbarState: vi.fn(() => ({ toolbarMode: 'host', visible: true })),
      subscribeHostToolbarState: vi.fn(() => () => undefined),
      runHostToolbarAction: vi.fn(async () => true),
      acknowledgeSavedTextChanges: vi.fn(),
      acknowledgeSavedStyleChanges: vi.fn(),
    });

    vi.stubGlobal('window', {
      location: {
        search: '',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home',
        protocol: 'http:',
        hostname: 'localhost',
      },
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ health: { status: 'ready' } }),
    })) as typeof fetch);

    const controller = createWebEditorV2Controller();
    await controller.enable({ toolbarMode: 'host' });

    expect(mocked.createGenieEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        ui: expect.objectContaining({
          toolbarMode: 'host',
        }),
      }),
    );
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('exposes a parent host toolbar action bridge for prompt card AI execution', async () => {
    const start = vi.fn();
    const listeners = new Map<string, Set<EventListener>>();
    const parentWindow = { postMessage: vi.fn() };
    const addEventListener = vi.fn((type: string, listener: EventListener) => {
      const current = listeners.get(type) ?? new Set<EventListener>();
      current.add(listener);
      listeners.set(type, current);
    });
    const removeEventListener = vi.fn((type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener);
    });

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop: vi.fn(),
      getState: vi.fn(() => ({ active: false, version: 2 })),
      getStatus: vi.fn(() => ({ active: false, undoCount: 0, redoCount: 0 })),
      getHostToolbarState: vi.fn(() => ({ toolbarMode: 'host', visible: true })),
      subscribeHostToolbarState: vi.fn(() => () => undefined),
      runHostToolbarAction: vi.fn(async () => true),
      acknowledgeSavedTextChanges: vi.fn(),
      acknowledgeSavedStyleChanges: vi.fn(),
    });

    vi.stubGlobal('window', {
      location: {
        search: '',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home',
        protocol: 'http:',
        hostname: 'localhost',
      },
      parent: parentWindow,
      addEventListener,
      removeEventListener,
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });

    const controller = createWebEditorV2Controller();
    await controller.enable({ toolbarMode: 'host' });

    const editorOptions = mocked.createGenieEditor.mock.calls[0]?.[0];
    const actionPromise = editorOptions.ui.onHostToolbarAction({ type: 'wake-genie' });
    const request = parentWindow.postMessage.mock.calls[0]?.[0] as {
      requestId: string;
      type: string;
      action: unknown;
    };

    expect(request).toEqual(expect.objectContaining({
      type: 'AXHUB_PROTOTYPE_EDITOR_HOST_TOOLBAR_ACTION_REQUEST',
      action: { type: 'wake-genie' },
    }));

    const [messageListener] = Array.from(listeners.get('message') ?? []);
    messageListener?.({
      data: {
        type: 'AXHUB_PROTOTYPE_EDITOR_HOST_TOOLBAR_ACTION_RESULT',
        requestId: request.requestId,
        handled: true,
      },
      source: parentWindow,
    } as MessageEvent);

    await expect(actionPromise).resolves.toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('forwards host dark mode from direct dev-template enable options', async () => {
    const start = vi.fn();

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop: vi.fn(),
      getState: vi.fn(() => ({ active: false, version: 2 })),
      getStatus: vi.fn(() => ({ active: false, undoCount: 0, redoCount: 0 })),
      getHostToolbarState: vi.fn(() => ({ toolbarMode: 'host', visible: true, darkMode: true })),
      subscribeHostToolbarState: vi.fn(() => () => undefined),
      runHostToolbarAction: vi.fn(async () => true),
      acknowledgeSavedTextChanges: vi.fn(),
      acknowledgeSavedStyleChanges: vi.fn(),
    });

    vi.stubGlobal('window', {
      location: {
        search: '',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home',
        protocol: 'http:',
        hostname: 'localhost',
      },
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ health: { status: 'ready' } }),
    })) as typeof fetch);

    const controller = createWebEditorV2Controller();
    await controller.enable({ toolbarMode: 'host', initialDarkMode: true });

    expect(mocked.createGenieEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        ui: expect.objectContaining({
          toolbarMode: 'host',
          initialDarkMode: true,
        }),
      }),
    );
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('updates assistant panel visibility for an existing editor and refreshes runtime UI', async () => {
    const start = vi.fn();
    const refresh = vi.fn();

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop: vi.fn(),
      refresh,
      getState: vi.fn(() => ({ active: true, version: 2 })),
      getStatus: vi.fn(() => ({ active: true, undoCount: 0, redoCount: 0 })),
      getHostToolbarState: vi.fn(() => ({ toolbarMode: 'host', visible: true })),
      subscribeHostToolbarState: vi.fn(() => () => undefined),
      runHostToolbarAction: vi.fn(async () => true),
      acknowledgeSavedTextChanges: vi.fn(),
      acknowledgeSavedStyleChanges: vi.fn(),
    });

    vi.stubGlobal('window', {
      location: {
        search: '',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home',
        protocol: 'http:',
        hostname: 'localhost',
      },
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });

    const controller = createWebEditorV2Controller();
    await controller.enable({ toolbarMode: 'host' });
    const ui = mocked.createGenieEditor.mock.calls[0]?.[0]?.ui;

    expect(ui?.getAssistantPanelOpen?.()).toBe(false);

    await controller.enable({ assistantPanelOpen: true });

    expect(mocked.createGenieEditor).toHaveBeenCalledTimes(1);
    expect(ui?.getAssistantPanelOpen?.()).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('uses enable-time internal comment page scope for resource context and refreshes route state when it changes', async () => {
    const start = vi.fn();
    const refresh = vi.fn();
    const dispatchEvent = vi.fn();

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop: vi.fn(),
      refresh,
      getState: vi.fn(() => ({ active: true, version: 2 })),
      getStatus: vi.fn(() => ({ active: true, undoCount: 0, redoCount: 0 })),
      getHostToolbarState: vi.fn(() => ({ toolbarMode: 'host', visible: true })),
      subscribeHostToolbarState: vi.fn(() => () => undefined),
      runHostToolbarAction: vi.fn(async () => true),
      acknowledgeSavedTextChanges: vi.fn(),
      acknowledgeSavedStyleChanges: vi.fn(),
    });

    vi.stubGlobal('window', {
      location: {
        search: '?genieToolbar=host#page=voice-annotation',
        pathname: '/prototypes/touch-and-talk-annotation-demo',
        href: 'http://localhost:51720/prototypes/touch-and-talk-annotation-demo?genieToolbar=host#page=voice-annotation',
        protocol: 'http:',
        hostname: 'localhost',
      },
      dispatchEvent,
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });

    const controller = createWebEditorV2Controller();
    await controller.enable({
      toolbarMode: 'host',
      commentPageScope: 'prototypes/touch-and-talk-annotation-demo::page::common-tips',
    });

    const host = mocked.createGenieEditor.mock.calls[0]?.[0]?.host;
    expect(host?.getResourceContext?.()?.meta?.commentPageScope)
      .toBe('prototypes/touch-and-talk-annotation-demo::page::common-tips');

    await controller.enable({
      toolbarMode: 'host',
      commentPageScope: 'prototypes/touch-and-talk-annotation-demo::page::voice-annotation',
    });

    expect(host?.getResourceContext?.()?.meta?.commentPageScope)
      .toBe('prototypes/touch-and-talk-annotation-demo::page::voice-annotation');
    expect(refresh).toHaveBeenCalled();
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'axhub-web-editor-route-change',
    }));
  });

  it('refreshes scoped comments when an active editor is enabled again for the same page scope', async () => {
    const start = vi.fn();
    const refresh = vi.fn();
    const dispatchEvent = vi.fn();

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop: vi.fn(),
      refresh,
      getState: vi.fn(() => ({ active: true, version: 2 })),
      getStatus: vi.fn(() => ({ active: true, undoCount: 0, redoCount: 0 })),
      getHostToolbarState: vi.fn(() => ({ toolbarMode: 'host', visible: true })),
      subscribeHostToolbarState: vi.fn(() => () => undefined),
      runHostToolbarAction: vi.fn(async () => true),
      acknowledgeSavedTextChanges: vi.fn(),
      acknowledgeSavedStyleChanges: vi.fn(),
    });

    vi.stubGlobal('window', {
      location: {
        search: '?genieToolbar=host#page=common-tips',
        pathname: '/prototypes/touch-and-talk-annotation-demo',
        href: 'http://localhost:51720/prototypes/touch-and-talk-annotation-demo?genieToolbar=host#page=common-tips',
        protocol: 'http:',
        hostname: 'localhost',
      },
      dispatchEvent,
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });

    const controller = createWebEditorV2Controller();
    const enableOptions = {
      toolbarMode: 'host' as const,
      commentPageScope: 'prototypes/touch-and-talk-annotation-demo::page::common-tips',
    };

    await controller.enable(enableOptions);
    dispatchEvent.mockClear();
    refresh.mockClear();

    await controller.enable(enableOptions);

    expect(refresh).toHaveBeenCalled();
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'axhub-web-editor-route-change',
    }));
  });

  it('reports page tweak entries as decision data for parent preview auto-open checks', () => {
    const listEntries = vi.fn(() => [
      { element: {}, schema: { fields: [] }, values: null },
      { element: {}, schema: { fields: [] }, values: null },
    ]);
    mocked.getGlobalGenieEditorTweakProtocol.mockReturnValue({ listEntries });
    vi.stubGlobal('document', { body: {} });

    const controller = createWebEditorV2Controller();

    expect(controller.getDecisionDataCount()).toBe(2);
    expect(listEntries).toHaveBeenCalledWith(document);
  });

  it('uses explicit save and clear methods instead of action strings', async () => {
    const start = vi.fn();
    const stop = vi.fn();
    const acknowledgeSavedTextChanges = vi.fn();
    const acknowledgeSavedStyleChanges = vi.fn();
    const subscribeStatus = vi.fn((listener: (status: unknown) => void) => {
      listener({ active: true, undoCount: 2, redoCount: 1 });
      return () => undefined;
    });
    const getState = vi.fn(() => ({ active: true, version: 2 }));
    const getStatus = vi.fn(() => ({ active: true, undoCount: 2, redoCount: 1 }));
    const getEditedSnapshot = vi.fn(() => ({
      resource: { kind: 'prototype-entry', path: 'prototypes/home' },
      selectedElement: null,
      modifiedElements: [],
      textChanges: [{ before: '旧标题', after: '新标题' }],
      styleChanges: { cssText: '.card { color: red; }' },
    }));
    const getTextChanges = vi.fn(() => [{ before: '旧标题', after: '新标题' }]);
    const getStyleChanges = vi.fn(() => ({ cssText: '.card { color: red; }' }));

    mocked.createGenieEditor.mockReturnValue({
      start,
      stop,
      subscribeStatus,
      getState,
      getStatus,
      getEditedSnapshot,
      getTextChanges,
      getStyleChanges,
      acknowledgeSavedTextChanges,
      acknowledgeSavedStyleChanges,
    });

    vi.stubGlobal('window', {
      location: {
        search: '',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home',
      },
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input === '/api/assistant/runtime?autoStart=false') {
        return {
          ok: true,
          json: async () => ({ health: { status: 'ready' } }),
        };
      }
      if (input === '/api/text-replace/count') {
        return {
          ok: true,
          json: async () => ({ count: 1 }),
        };
      }
      if (input === '/api/text-replace/replace') {
        return {
          ok: true,
          json: async () => ({ success: true, changedFiles: 1 }),
        };
      }
      if (input === '/api/hack-css/save') {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      if (input === '/api/hack-css/clear') {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      throw new Error(`Unexpected fetch: ${input}`);
    }) as typeof fetch);

    const controller = createWebEditorV2Controller();

    await controller.enable();
    await controller.saveTextChanges();
    await controller.saveStyleChanges();
    await controller.clearForcedStyles();
    controller.disable();

    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(getEditedSnapshot).toHaveBeenCalledTimes(3);
    expect(getTextChanges).toHaveBeenCalledTimes(1);
    expect(getStyleChanges).toHaveBeenCalledTimes(1);
    expect(acknowledgeSavedTextChanges).toHaveBeenCalledTimes(1);
    expect(acknowledgeSavedStyleChanges).toHaveBeenCalledTimes(2);
    expect(controller.getStatus()).toEqual({
      active: true,
      undoCount: 2,
      redoCount: 1,
    });
  });

  it('does not acknowledge local text changes when save is cancelled', async () => {
    const acknowledgeSavedTextChanges = vi.fn();
    const acknowledgeSavedStyleChanges = vi.fn();

    mocked.createGenieEditor.mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      getState: vi.fn(() => ({ active: true, version: 2 })),
      getStatus: vi.fn(() => ({ active: true, undoCount: 0, redoCount: 0 })),
      getEditedSnapshot: vi.fn(() => ({
        resource: { kind: 'prototype-entry', path: 'prototypes/home' },
        selectedElement: null,
        modifiedElements: [],
        textChanges: [{ before: '旧标题', after: '新标题' }],
        styleChanges: { cssText: '' },
      })),
      getTextChanges: vi.fn(() => [{ before: '旧标题', after: '新标题' }]),
      getStyleChanges: vi.fn(() => ({ cssText: '' })),
      acknowledgeSavedTextChanges,
      acknowledgeSavedStyleChanges,
    });

    vi.stubGlobal('window', {
      location: {
        search: '',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home',
      },
      confirm: vi.fn(() => false),
      alert: vi.fn(),
    });
    const fetchMock = vi.fn(async (input: string) => {
      if (input === '/api/assistant/runtime?autoStart=false') {
        return {
          ok: true,
          json: async () => ({ health: { status: 'ready' } }),
        };
      }
      if (input === '/api/text-replace/count') {
        return {
          ok: true,
          json: async () => ({ count: 1 }),
        };
      }
      throw new Error(`Unexpected fetch: ${input}`);
    });
    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const controller = createWebEditorV2Controller();
    await controller.saveTextChanges();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(acknowledgeSavedTextChanges).not.toHaveBeenCalled();
  });

  it('does not acknowledge local text changes when replace fails', async () => {
    const acknowledgeSavedTextChanges = vi.fn();
    const acknowledgeSavedStyleChanges = vi.fn();

    mocked.createGenieEditor.mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      getState: vi.fn(() => ({ active: true, version: 2 })),
      getStatus: vi.fn(() => ({ active: true, undoCount: 0, redoCount: 0 })),
      getEditedSnapshot: vi.fn(() => ({
        resource: { kind: 'prototype-entry', path: 'prototypes/home' },
        selectedElement: null,
        modifiedElements: [],
        textChanges: [{ before: '旧标题', after: '新标题' }],
        styleChanges: { cssText: '' },
      })),
      getTextChanges: vi.fn(() => [{ before: '旧标题', after: '新标题' }]),
      getStyleChanges: vi.fn(() => ({ cssText: '' })),
      acknowledgeSavedTextChanges,
      acknowledgeSavedStyleChanges,
    });

    vi.stubGlobal('window', {
      location: {
        search: '',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home',
      },
      confirm: vi.fn(() => true),
      alert: vi.fn(),
    });
    const fetchMock = vi.fn(async (input: string) => {
      if (input === '/api/assistant/runtime?autoStart=false') {
        return {
          ok: true,
          json: async () => ({ health: { status: 'ready' } }),
        };
      }
      if (input === '/api/text-replace/count') {
        return {
          ok: true,
          json: async () => ({ count: 1 }),
        };
      }
      if (input === '/api/text-replace/replace') {
        return {
          ok: true,
          json: async () => ({ success: false, changedFiles: 0 }),
        };
      }
      throw new Error(`Unexpected fetch: ${input}`);
    });
    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const controller = createWebEditorV2Controller();
    await expect(controller.saveTextChanges()).rejects.toThrow('保存文本失败');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(acknowledgeSavedTextChanges).not.toHaveBeenCalled();
  });

  it('blocks saving when the same source text maps to multiple target texts', async () => {
    const acknowledgeSavedTextChanges = vi.fn();

    mocked.createGenieEditor.mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      getState: vi.fn(() => ({ active: true, version: 2 })),
      getStatus: vi.fn(() => ({ active: true, undoCount: 0, redoCount: 0 })),
      getEditedSnapshot: vi.fn(() => ({
        resource: { kind: 'prototype-entry', path: 'prototypes/home' },
        selectedElement: null,
        modifiedElements: [],
        textChanges: [
          { before: '旧标题', after: '新标题A' },
          { before: '旧标题', after: '新标题B' },
        ],
        styleChanges: { cssText: '' },
      })),
      getTextChanges: vi.fn(() => [
        { before: '旧标题', after: '新标题A' },
        { before: '旧标题', after: '新标题B' },
      ]),
      getStyleChanges: vi.fn(() => ({ cssText: '' })),
      acknowledgeSavedTextChanges,
      acknowledgeSavedStyleChanges: vi.fn(),
    });

    const alertMock = vi.fn();
    const postMessageMock = vi.fn();
    const fetchMock = vi.fn(async (input: string) => {
      if (input === '/api/assistant/runtime?autoStart=false') {
        return {
          ok: true,
          json: async () => ({ health: { status: 'ready' } }),
        };
      }
      throw new Error(`Unexpected fetch: ${input}`);
    });

    vi.stubGlobal('window', {
      location: {
        search: '',
        pathname: '/prototypes/home',
        href: 'http://localhost:51720/prototypes/home',
      },
      parent: {
        postMessage: postMessageMock,
      },
      confirm: vi.fn(() => true),
      alert: alertMock,
    });
    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const controller = createWebEditorV2Controller();
    await controller.saveTextChanges();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(alertMock).not.toHaveBeenCalled();
    expect(postMessageMock).not.toHaveBeenCalledWith(expect.objectContaining({
      type: 'WEB_EDITOR_NOTICE',
    }), '*');
    expect(acknowledgeSavedTextChanges).not.toHaveBeenCalled();
  });
});
