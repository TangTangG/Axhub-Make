import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ai-generation/aiRunClient', () => ({
  runAiStream: vi.fn(async (params: any, onEvent?: (event: any) => void | Promise<void>) => {
    await onEvent?.({
      event: 'run.accepted',
      data: {
        runId: params.runId,
        threadId: params.threadId,
        conversationId: params.conversationId,
      },
    });
    return {
      output: 'ok',
      reasoning: '',
      artifacts: [],
      runId: params.runId,
      threadId: params.threadId,
    };
  }),
}));

import {
  ANNOTATION_DIRECT_RUN_MAX_SENDS,
  ANNOTATION_DIRECT_RUN_TTL_MS,
  buildAnnotationDirectRunThreadStorageKey,
  prepareAnnotationDirectRunThread,
  recordAnnotationDirectRunAccepted,
  resolveAnnotationDirectRunTarget,
  submitAnnotationPromptViaApi,
} from './annotationDirectRun';
import {
  getAssistantResourceThreadId,
  getAssistantStoreThreadId,
  setAssistantResourceThreadId,
  setAssistantStoreThreadId,
} from './assistantResourceThread';
import { runAiStream } from '../ai-generation/aiRunClient';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe('annotation direct API run thread reuse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves prototype-scoped ACP conversation storage from assistant context', () => {
    const target = resolveAnnotationDirectRunTarget({
      context: {
        currentFile: {
          path: 'src/prototypes/checkout/pages/cart.tsx',
          displayName: 'cart.tsx',
        },
        selectedElements: [],
        extensions: {},
      },
      projectPath: '/workspace/make-client',
      projectScope: 'project-a',
    } as any);

    expect(target).toMatchObject({
      projectScope: 'project-a',
      currentFilePath: 'src/prototypes/checkout/pages/cart.tsx',
      prototypePath: 'src/prototypes/checkout',
      conversationStorePath: '/workspace/make-client/src/prototypes/checkout/.spec/acp/conversations.json',
    });
  });

  it('creates a new fixed-window thread when no reusable thread exists', () => {
    const storage = createStorage();
    const now = 1_700_000_000_000;
    const target = {
      projectScope: 'project-a',
      currentFilePath: 'src/prototypes/home/index.tsx',
      prototypePath: 'src/prototypes/home',
      conversationStorePath: '/workspace/project/src/prototypes/home/.spec/acp/conversations.json',
    };

    const prepared = prepareAnnotationDirectRunThread({
      target,
      storage,
      now,
      createRunId: () => 'annotation-run-1',
    });

    expect(prepared).toMatchObject({
      firstRun: true,
      runId: 'annotation-run-1',
      threadId: 'annotation-run-1',
      conversationId: 'annotation-run-1',
    });

    recordAnnotationDirectRunAccepted({
      target,
      storage,
      now,
      threadId: 'annotation-run-1',
    });

    const raw = storage.getItem(buildAnnotationDirectRunThreadStorageKey(target));
    expect(raw ? JSON.parse(raw) : null).toMatchObject({
      threadId: 'annotation-run-1',
      createdAt: now,
      expiresAt: now + ANNOTATION_DIRECT_RUN_TTL_MS,
      sentCount: 1,
      invalidated: false,
    });
    expect(getAssistantStoreThreadId({
      projectScope: 'project-a',
      conversationStorePath: target.conversationStorePath,
    }, storage)).toBe('annotation-run-1');
    expect(getAssistantResourceThreadId({
      projectScope: 'project-a',
      resourcePath: target.prototypePath,
    }, storage)).toBe('annotation-run-1');
  });

  it('does not reuse legacy assistant bindings without a direct-run reuse record', () => {
    const storage = createStorage();
    const now = 1_700_000_000_000;
    const target = {
      projectScope: 'project-a',
      currentFilePath: 'src/prototypes/home/index.tsx',
      prototypePath: 'src/prototypes/home',
      conversationStorePath: '/workspace/project/src/prototypes/home/.spec/acp/conversations.json',
    };

    setAssistantStoreThreadId({
      projectScope: target.projectScope,
      conversationStorePath: target.conversationStorePath,
    }, 'legacy-store-thread', storage);
    setAssistantResourceThreadId({
      projectScope: target.projectScope,
      resourcePath: target.prototypePath,
    }, 'legacy-prototype-thread', storage);

    expect(prepareAnnotationDirectRunThread({
      target,
      storage,
      now,
      createRunId: () => 'fresh-direct-thread',
    })).toMatchObject({
      firstRun: true,
      runId: 'fresh-direct-thread',
      threadId: 'fresh-direct-thread',
      conversationId: 'fresh-direct-thread',
    });
  });

  it('submits an ACP context bundle instead of raw assistant context', async () => {
    const storage = createStorage();
    const now = 1_700_000_000_000;
    const context = {
      currentFile: {
        path: 'src/prototypes/home/index.tsx',
        displayName: 'Home',
      },
      selectedElements: [{
        selector: '[data-hero]',
        label: 'Hero title',
        tag: 'h1',
      }],
      extensions: {
        source: 'annotation-host',
      },
    };

    await submitAnnotationPromptViaApi({
      context: context as any,
      prompt: '把标题改得更清楚',
      projectPath: '/workspace/project',
      projectScope: 'project-a',
      provider: 'codex',
      preferredPromptClient: 'acp:codex',
      storage,
      now: () => now,
      createRunId: () => 'run-context',
    });

    const params = vi.mocked(runAiStream).mock.calls[0]?.[0] as any;
    expect(params.conversationStorePath).toBe('/workspace/project/src/prototypes/home/.spec/acp/conversations.json');
    expect(params.contextBundle).toMatchObject({
      version: '2',
      items: [
        expect.objectContaining({
          kind: 'file',
          path: 'src/prototypes/home/index.tsx',
        }),
        expect.objectContaining({
          kind: 'annotation',
          body: 'Hero title',
          target: expect.objectContaining({
            type: 'web-element',
            selector: '[data-hero]',
          }),
        }),
      ],
    });
    expect(params.contextBundle.items).toEqual(expect.any(Array));
    expect(params.contextBundle).not.toHaveProperty('selectedElements');
  });

  it('submits image generation settings for direct runs without preview or canvas MCP servers', async () => {
    const storage = createStorage();

    await submitAnnotationPromptViaApi({
      context: {
        currentFile: {
          path: 'src/prototypes/home/index.tsx',
          displayName: 'Home',
        },
        selectedElements: [],
        extensions: {},
      } as any,
      prompt: '生成一张配图。',
      projectPath: '/workspace/project',
      projectScope: 'project-a',
      provider: 'codex',
      preferredPromptClient: 'acp:codex',
      builtinToolSettings: {
        imageGeneration: {
          baseUrl: 'https://current.example.com/v1',
          apiKey: 'sk-current',
          model: 'current-image-model',
        },
      },
      storage,
      now: () => 1_700_000_000_000,
      createRunId: () => 'run-image-config',
    });

    const params = vi.mocked(runAiStream).mock.calls[0]?.[0] as any;
    expect(params.builtinToolSettings).toEqual({
      imageGeneration: {
        baseUrl: 'https://current.example.com/v1',
        apiKey: 'sk-current',
        model: 'current-image-model',
      },
    });
    expect(params.mcpServers).toBeUndefined();
  });

  it('reuses the prototype thread for 48 hours and fewer than 40 sends without extending expiry', () => {
    const storage = createStorage();
    const now = 1_700_000_000_000;
    const target = {
      projectScope: 'project-a',
      currentFilePath: 'src/prototypes/home/index.tsx',
      prototypePath: 'src/prototypes/home',
      conversationStorePath: '/workspace/project/src/prototypes/home/.spec/acp/conversations.json',
    };

    recordAnnotationDirectRunAccepted({
      target,
      storage,
      now,
      threadId: 'thread-home',
    });

    const prepared = prepareAnnotationDirectRunThread({
      target,
      storage,
      now: now + 60_000,
      createRunId: () => 'annotation-run-2',
    });

    expect(prepared).toMatchObject({
      firstRun: false,
      runId: 'annotation-run-2',
      threadId: 'thread-home',
      conversationId: 'thread-home',
    });

    recordAnnotationDirectRunAccepted({
      target,
      storage,
      now: now + 60_000,
      threadId: 'thread-home',
    });

    const raw = storage.getItem(buildAnnotationDirectRunThreadStorageKey(target));
    expect(raw ? JSON.parse(raw) : null).toMatchObject({
      threadId: 'thread-home',
      createdAt: now,
      expiresAt: now + ANNOTATION_DIRECT_RUN_TTL_MS,
      sentCount: 2,
    });
  });

  it('starts a new thread after expiry, max sends, or explicit invalidation', () => {
    const storage = createStorage();
    const now = 1_700_000_000_000;
    const target = {
      projectScope: 'project-a',
      currentFilePath: 'src/prototypes/home/index.tsx',
      prototypePath: 'src/prototypes/home',
      conversationStorePath: '/workspace/project/src/prototypes/home/.spec/acp/conversations.json',
    };
    const key = buildAnnotationDirectRunThreadStorageKey(target);

    storage.setItem(key, JSON.stringify({
      threadId: 'expired-thread',
      prototypePath: target.prototypePath,
      conversationStorePath: target.conversationStorePath,
      createdAt: now - ANNOTATION_DIRECT_RUN_TTL_MS - 1,
      expiresAt: now - 1,
      sentCount: 1,
      invalidated: false,
    }));

    expect(prepareAnnotationDirectRunThread({
      target,
      storage,
      now,
      createRunId: () => 'fresh-expired',
    })).toMatchObject({
      firstRun: true,
      threadId: 'fresh-expired',
    });

    storage.setItem(key, JSON.stringify({
      threadId: 'maxed-thread',
      prototypePath: target.prototypePath,
      conversationStorePath: target.conversationStorePath,
      createdAt: now,
      expiresAt: now + ANNOTATION_DIRECT_RUN_TTL_MS,
      sentCount: ANNOTATION_DIRECT_RUN_MAX_SENDS,
      invalidated: false,
    }));

    expect(prepareAnnotationDirectRunThread({
      target,
      storage,
      now,
      createRunId: () => 'fresh-maxed',
    })).toMatchObject({
      firstRun: true,
      threadId: 'fresh-maxed',
    });

    storage.setItem(key, JSON.stringify({
      threadId: 'invalid-thread',
      prototypePath: target.prototypePath,
      conversationStorePath: target.conversationStorePath,
      createdAt: now,
      expiresAt: now + ANNOTATION_DIRECT_RUN_TTL_MS,
      sentCount: 1,
      invalidated: true,
    }));

    expect(prepareAnnotationDirectRunThread({
      target,
      storage,
      now,
      createRunId: () => 'fresh-invalid',
    })).toMatchObject({
      firstRun: true,
      threadId: 'fresh-invalid',
    });
  });
});
