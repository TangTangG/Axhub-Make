import { beforeEach, describe, expect, it, vi } from 'vitest';

const runnerMock = vi.hoisted(() => ({
  runGeniePrototypeAgent: vi.fn(),
}));

vi.mock('./genieAgentClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./genieAgentClient')>();
  return {
    ...actual,
    runGeniePrototypeAgent: runnerMock.runGeniePrototypeAgent,
  };
});

const { createPrototypeGenerationTaskStore } = await import('./prototypeTaskStore');

describe('prototype generation task store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    runnerMock.runGeniePrototypeAgent.mockReset();
  });

  it('loads and persists prototype generation history through the shared prototype backend history', async () => {
    runnerMock.runGeniePrototypeAgent.mockResolvedValue({ status: 'done' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).startsWith('/api/ai-image/history') && !init) {
        return new Response(JSON.stringify({
          tasks: [{
            id: 'image-task',
            prompt: '图片历史',
            params: { size: '1024x1024', quality: 'high', output_format: 'png', output_compression: null, moderation: 'auto', n: 1 },
            status: 'done',
            stage: 'done',
            error: null,
            createdAt: 900,
            finishedAt: 1000,
            elapsed: 100,
            outputImages: ['img-one'],
          }],
          prototypeTasks: [{
            id: 'prototype-task-from-spec',
            prompt: '已有原型历史',
            status: 'done',
            stage: 'done',
            error: null,
            createdAt: 1000,
            finishedAt: 1400,
            elapsed: 400,
            provider: 'codex',
            outputPrototypeName: 'crm-dashboard',
            acpxSessionName: 'axhub-prompt-acpx-client-home',
            runId: 'prototype-task-from-spec',
            recoverable: true,
          }],
          prototypeSessions: [{
            prototypeId: 'home',
            generatorElementId: 'generator-1',
            acpxSessionName: 'axhub-prompt-acpx-client-home',
            lastRun: {
              runId: 'prototype-task-from-spec',
              status: 'done',
              stage: 'done',
              prompt: '已有原型历史',
              createdAt: 1000,
            },
          }],
          images: {
            'img-one': {
              id: 'img-one',
              assetPath: 'ai-image-assets/img-one.png',
              dataUrl: 'data:image/png;base64,one',
              createdAt: 900,
              source: 'generated',
            },
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (String(input).startsWith('/api/ai-image/history') && init?.method === 'PUT') {
        return new Response(String(init.body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch ${String(input)}`);
    });
    const store = createPrototypeGenerationTaskStore({ now: vi.fn()
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(2600) });

    await store.configure({ targetPath: 'prototypes/home' });
    expect(store.getTasks()[0]?.id).toBe('prototype-task-from-spec');
    expect(store.getTasks()[0]).toMatchObject({
      acpxSessionName: 'axhub-prompt-acpx-client-home',
      runId: 'prototype-task-from-spec',
      recoverable: true,
    });

    const result = await store.submit({
      prompt: '生成新的原型',
      preferredPromptClient: 'genie:codex',
      canvasFilePath: 'src/prototypes/home/canvas.excalidraw',
      canvasName: 'prototypes/home/canvas',
      generatorElementId: 'generator-1',
    }, {
      onAgentDone: async () => ({
        name: 'new-prototype',
        displayName: 'New Prototype',
        previewUrl: '/prototypes/new-prototype',
        clientUrl: '/prototypes/new-prototype',
      } as any),
    });
    const putCall = fetchMock.mock.calls.filter((call) => (
      String(call[0]).startsWith('/api/ai-image/history') && (call[1] as RequestInit | undefined)?.method === 'PUT'
    )).at(-1)!;
    const persisted = JSON.parse(String(putCall[1]?.body || '{}'));

    expect(result.status).toBe('done');
    expect(fetchMock).toHaveBeenCalledWith('/api/ai-image/history?targetPath=prototypes%2Fhome');
    expect(persisted.tasks.map((task: any) => task.id)).toEqual(['image-task']);
    expect(persisted.images['img-one']).toBeDefined();
    expect(persisted.prototypeTasks.map((task: any) => task.id)).toEqual([
      result.id,
      'prototype-task-from-spec',
    ]);
    expect(persisted.prototypeTasks[0]).toMatchObject({
      runId: result.id,
      recoverable: true,
    });
    expect(persisted.prototypeSessions[0]).toMatchObject({
      prototypeId: 'home',
      generatorElementId: 'generator-1',
      lastRun: { runId: result.id, status: 'done' },
    });
  });

  it('runs acpx prototype generation and refreshes resources after completion', async () => {
    runnerMock.runGeniePrototypeAgent.mockImplementation(async ({ onEvent }) => {
      onEvent?.({ stage: 'accepted' });
      onEvent?.({ stage: 'running', sessionId: 'axhub-prompt-acpx-client-home' });
      onEvent?.({ stage: 'completed' });
      return { status: 'done', sessionId: 'axhub-prompt-acpx-client-home' };
    });
    const store = createPrototypeGenerationTaskStore({ now: vi.fn()
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2500) });
    const seenStages: string[] = [];
    store.subscribe(() => {
      const task = store.getTasks()[0];
      if (task) seenStages.push(task.stage);
    });

    const result = await store.submit({
      prompt: '生成 CRM 原型',
      preferredPromptClient: 'genie:codex',
      canvasFilePath: 'src/prototypes/home/canvas.excalidraw',
      canvasName: 'prototypes/home/canvas',
      generatorElementId: 'generator-1',
    }, {
      onAgentDone: async () => ({
        name: 'crm-dashboard',
        displayName: 'CRM Dashboard',
        previewUrl: '/prototypes/crm-dashboard',
        clientUrl: '/prototypes/crm-dashboard',
      } as any),
    });

    expect(result).toMatchObject({
      status: 'done',
      stage: 'done',
      elapsed: 1500,
      outputPrototypeName: 'crm-dashboard',
      provider: 'codex',
      acpxSessionName: 'axhub-prompt-acpx-client-home',
      runId: expect.stringMatching(/^prototype-task-/u),
      recoverable: true,
    });
    expect(seenStages).toEqual(expect.arrayContaining(['submitting', 'running', 'refreshing', 'done']));
    expect(runnerMock.runGeniePrototypeAgent).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'codex',
      prompt: '生成 CRM 原型',
      canvasFilePath: 'src/prototypes/home/canvas.excalidraw',
      canvasName: 'prototypes/home/canvas',
      generatorElementId: 'generator-1',
    }));
    expect(runnerMock.runGeniePrototypeAgent.mock.calls[0][0]).not.toHaveProperty('apiBaseUrl');
    expect(runnerMock.runGeniePrototypeAgent.mock.calls[0][0]).not.toHaveProperty('projectPath');
  });

  it('passes prototype reference images into the agent run request', async () => {
    runnerMock.runGeniePrototypeAgent.mockResolvedValue({ status: 'done' });
    const store = createPrototypeGenerationTaskStore();

    await store.submit({
      prompt: '按参考图生成 CRM 原型',
      preferredPromptClient: 'genie:codex',
      canvasFilePath: 'src/prototypes/home/canvas.excalidraw',
      canvasName: 'prototypes/home/canvas',
      generatorElementId: 'generator-1',
      referenceImages: ['data:image/png;base64,cmVm'],
    });

    expect(runnerMock.runGeniePrototypeAgent).toHaveBeenCalledWith(expect.objectContaining({
      referenceImages: ['data:image/png;base64,cmVm'],
    }));
  });

  it('stores acpx execution errors on the task', async () => {
    runnerMock.runGeniePrototypeAgent.mockResolvedValue({
      status: 'error',
      error: 'acpx failed',
    });
    const store = createPrototypeGenerationTaskStore({ now: vi.fn()
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1200) });

    const result = await store.submit({
      prompt: '失败案例',
      preferredPromptClient: 'manual',
      generatorElementId: 'generator-1',
    });

    expect(result).toMatchObject({
      status: 'error',
      stage: 'error',
      error: 'acpx failed',
      provider: 'codex',
    });
  });

  it('deletes prototype generation history and persists the shared history document', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).startsWith('/api/ai-image/history') && !init) {
        return new Response(JSON.stringify({
          tasks: [{
            id: 'image-task',
            prompt: '图片历史',
            params: { size: '1024x1024', quality: 'high', output_format: 'png', output_compression: null, moderation: 'auto', n: 1 },
            status: 'done',
            stage: 'done',
            error: null,
            createdAt: 900,
            finishedAt: 1000,
            elapsed: 100,
            outputImages: ['img-one'],
          }],
          prototypeTasks: [{
            id: 'prototype-task-one',
            prompt: '保留的原型历史',
            status: 'done',
            stage: 'done',
            error: null,
            createdAt: 1200,
            finishedAt: 1400,
            elapsed: 200,
            provider: 'codex',
            outputPrototypeName: 'crm-dashboard',
          }, {
            id: 'prototype-task-two',
            prompt: '要删除的原型历史',
            status: 'error',
            stage: 'error',
            error: '生成失败',
            createdAt: 1100,
            finishedAt: 1300,
            elapsed: 200,
            provider: 'codex',
          }],
          images: {
            'img-one': {
              id: 'img-one',
              assetPath: 'ai-image-assets/img-one.png',
              dataUrl: 'data:image/png;base64,one',
              createdAt: 900,
              source: 'generated',
            },
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (String(input).startsWith('/api/ai-image/history') && init?.method === 'PUT') {
        return new Response(String(init.body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch ${String(input)}`);
    });
    const store = createPrototypeGenerationTaskStore();

    await store.configure({ targetPath: 'prototypes/home' });
    store.deleteTask('prototype-task-two');

    await vi.waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => (
        String(call[0]).startsWith('/api/ai-image/history') && (call[1] as RequestInit | undefined)?.method === 'PUT'
      ))).toBe(true);
    });
    const putCall = fetchMock.mock.calls.find((call) => (
      String(call[0]).startsWith('/api/ai-image/history') && (call[1] as RequestInit | undefined)?.method === 'PUT'
    ))!;
    const persisted = JSON.parse(String(putCall[1]?.body || '{}'));

    expect(store.getTasks().map((task) => task.id)).toEqual(['prototype-task-one']);
    expect(persisted.tasks.map((task: any) => task.id)).toEqual(['image-task']);
    expect(persisted.images['img-one']).toBeDefined();
    expect(persisted.prototypeTasks.map((task: any) => task.id)).toEqual(['prototype-task-one']);
  });

  it('updates the submitted prototype history entry instead of leaving a running server entry', async () => {
    const serverRunId = 'prototype-task-server-run';
    runnerMock.runGeniePrototypeAgent.mockResolvedValue({
      status: 'done',
      sessionId: 'axhub-session-run-client-home',
      runId: serverRunId,
    });
    const persistedBodies: any[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).startsWith('/api/ai-image/history') && !init) {
        return new Response(JSON.stringify({
          tasks: [],
          prototypeTasks: [],
          images: {},
          prototypeSessions: [],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (String(input).startsWith('/api/ai-image/history') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body || '{}'));
        persistedBodies.push(body);
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch ${String(input)}`);
    });
    const store = createPrototypeGenerationTaskStore({ now: vi.fn()
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1800) });

    await store.configure({ targetPath: 'prototypes/home' });
    const result = await store.submit({
      prompt: '生成当前原型',
      preferredPromptClient: 'genie:codex',
      canvasFilePath: 'src/prototypes/home/canvas.excalidraw',
      canvasName: 'prototypes/home/canvas',
      generatorElementId: 'generator-1',
    }, {
      onAgentDone: async () => null,
    });

    expect(runnerMock.runGeniePrototypeAgent.mock.calls[0][0]).toMatchObject({
      taskId: result.id,
    });
    expect(result).toMatchObject({
      id: expect.stringMatching(/^prototype-task-/u),
      runId: result.id,
      status: 'done',
      stage: 'done',
    });
    expect(result.runId).not.toBe(serverRunId);
    expect(persistedBodies.length).toBeGreaterThanOrEqual(2);
    expect(persistedBodies[0].prototypeTasks).toHaveLength(1);
    expect(persistedBodies[0].prototypeTasks[0]).toMatchObject({
      id: result.id,
      runId: result.id,
      status: 'running',
      stage: 'submitting',
    });
    const finalBody = persistedBodies.at(-1);
    expect(finalBody.prototypeTasks).toHaveLength(1);
    expect(finalBody.prototypeTasks[0]).toMatchObject({
      id: result.id,
      runId: result.id,
      status: 'done',
      stage: 'done',
    });
    expect(finalBody.prototypeTasks.some((task: any) => task.id === serverRunId)).toBe(false);
  });

  it('passes a target path derived from the submitted canvas path when the store was not configured', async () => {
    runnerMock.runGeniePrototypeAgent.mockResolvedValue({
      status: 'done',
      sessionId: 'axhub-session-run-client-home',
    });
    const store = createPrototypeGenerationTaskStore({ now: vi.fn()
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1800) });

    await store.submit({
      prompt: '生成当前原型',
      preferredPromptClient: 'genie:codex',
      canvasFilePath: 'src/prototypes/home/canvas.excalidraw',
      canvasName: 'prototypes/home/canvas',
      generatorElementId: 'generator-1',
    }, {
      onAgentDone: async () => null,
    });

    expect(runnerMock.runGeniePrototypeAgent).toHaveBeenCalledWith(expect.objectContaining({
      targetPath: 'prototypes/home',
    }));
  });

  it('does not let the initial running history response overwrite the completed task', async () => {
    runnerMock.runGeniePrototypeAgent.mockResolvedValue({
      status: 'done',
      sessionId: 'axhub-session-run-client-home',
    });
    let releaseInitialPersist: (() => void) | null = null;
    const persistedBodies: any[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).startsWith('/api/ai-image/history') && !init) {
        return new Response(JSON.stringify({
          tasks: [],
          prototypeTasks: [],
          images: {},
          prototypeSessions: [],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (String(input).startsWith('/api/ai-image/history') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body || '{}'));
        persistedBodies.push(body);
        if (persistedBodies.length === 1) {
          await new Promise<void>((resolve) => {
            releaseInitialPersist = resolve;
          });
        }
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch ${String(input)}`);
    });
    const store = createPrototypeGenerationTaskStore({ now: vi.fn()
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1800) });

    await store.configure({ targetPath: 'prototypes/home' });
    const submitPromise = store.submit({
      prompt: '生成当前原型',
      preferredPromptClient: 'genie:codex',
      canvasFilePath: 'src/prototypes/home/canvas.excalidraw',
      canvasName: 'prototypes/home/canvas',
      generatorElementId: 'generator-1',
    }, {
      onAgentDone: async () => null,
    });
    await vi.waitFor(() => {
      expect(persistedBodies).toHaveLength(1);
      expect(store.getTasks()[0]).toMatchObject({
        status: 'done',
        stage: 'done',
      });
    });

    releaseInitialPersist?.();
    const result = await submitPromise;

    expect(result).toMatchObject({
      status: 'done',
      stage: 'done',
    });
    expect(store.getTasks()[0]).toMatchObject({
      status: 'done',
      stage: 'done',
    });
    expect(persistedBodies.map((body) => body.prototypeTasks[0]?.status)).toEqual(['running', 'done']);
  });
});
