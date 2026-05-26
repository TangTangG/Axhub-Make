import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAiImageTaskStore,
  type AiImageGenerateRequest,
} from './aiImageStore';

describe('AI image task store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads image history from the prototype backend when a target path is configured', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      tasks: [{
        id: 'task-from-spec',
        prompt: '来自 .spec 的历史',
        params: {
          size: '1024x1024',
          quality: 'high',
          output_format: 'png',
          output_compression: null,
          moderation: 'auto',
          n: 1,
        },
        status: 'done',
        stage: 'done',
        error: null,
        createdAt: 1000,
        finishedAt: 1600,
        elapsed: 600,
        outputImages: ['img-from-spec'],
      }],
      images: {
        'img-from-spec': {
          id: 'img-from-spec',
          assetPath: 'ai-image-assets/img-from-spec.png',
          dataUrl: 'data:image/png;base64,spec',
          width: 1024,
          height: 1024,
          createdAt: 1000,
          source: 'generated',
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const store = createAiImageTaskStore({ storage: null });

    await store.configure({ targetPath: 'prototypes/home' });

    expect(store.getTasks()[0]?.id).toBe('task-from-spec');
    expect(store.getImage('img-from-spec')?.assetPath).toBe('ai-image-assets/img-from-spec.png');
    expect(fetchMock).toHaveBeenCalledWith('/api/ai-image/history?targetPath=prototypes%2Fhome');
  });

  it('marks loaded running image tasks as interrupted so they can be regenerated after refresh', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      tasks: [{
        id: 'task-running-before-refresh',
        prompt: '刷新前还在生成',
        params: {
          size: '1024x1024',
          quality: 'high',
          output_format: 'png',
          output_compression: null,
          moderation: 'auto',
          n: 1,
        },
        status: 'running',
        stage: 'generating',
        error: null,
        createdAt: 1000,
        finishedAt: null,
        elapsed: null,
        outputImages: [],
        conversationId: 'conversation-one',
        roundId: 'round-one',
      }],
      imageConversations: [{
        id: 'conversation-one',
        title: '刷新恢复',
        rounds: [{ id: 'round-one', prompt: '刷新前还在生成', status: 'running', outputTaskIds: ['task-running-before-refresh'], createdAt: 1000 }],
        messages: [{ id: 'message-one', role: 'user', content: '刷新前还在生成', roundId: 'round-one', createdAt: 1000 }],
      }],
      images: {},
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const store = createAiImageTaskStore({ storage: null });

    await store.configure({ targetPath: 'prototypes/home' });

    expect(store.getTasks()[0]).toMatchObject({
      id: 'task-running-before-refresh',
      status: 'error',
      stage: 'error',
      interrupted: true,
      conversationId: 'conversation-one',
      roundId: 'round-one',
      error: '请求中断，可重新生成',
    });
    expect(store.getState().imageConversations?.[0]?.id).toBe('conversation-one');
  });

  it('tracks running, done, and elapsed task state while persisting generated images', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).startsWith('/api/ai-image/history')) {
        return new Response(JSON.stringify({
          tasks: JSON.parse(String(init?.body || '{}')).tasks,
          images: Object.fromEntries(Object.entries(JSON.parse(String(init?.body || '{}')).images || {}).map(([id, image]: [string, any]) => [
            id,
            {
              ...image,
              assetPath: `ai-image-assets/${id}.png`,
              dataUrl: image.dataUrl,
            },
          ])),
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        images: ['data:image/png;base64,one', 'data:image/png;base64,two'],
        revisedPrompts: ['第一个', '第二个'],
        actualParamsList: [{ size: '1024x1024' }, { size: '1024x1024' }],
        rawImageUrls: ['https://images.example.com/one.png'],
        rawResponsePayload: '{"data":[{"b64_json":"<base64_data>"}]}',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const now = vi.fn()
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1600);
    const store = createAiImageTaskStore({ now, storage: null });
    await store.configure({ targetPath: 'prototypes/home' });
    const seen: string[] = [];
    store.subscribe((state) => {
      seen.push(state.tasks[0]?.status || 'empty');
    });

    const request: AiImageGenerateRequest = {
      prompt: '一张产品图',
      params: {
        size: '1024x1024',
        quality: 'high',
        output_format: 'png',
        output_compression: null,
        moderation: 'auto',
        n: 2,
      },
    };
    const task = await store.submit(request);
    const historySaveCall = fetchMock.mock.calls.filter((call) => (
      String(call[0]).startsWith('/api/ai-image/history') && (call[1] as RequestInit | undefined)?.method === 'PUT'
    )).at(-1)!;
    const savedHistory = JSON.parse(String(historySaveCall[1]?.body || '{}'));

    expect(task.status).toBe('done');
    expect(task.elapsed).toBe(600);
    expect(task.outputImages).toHaveLength(2);
    expect(task.revisedPromptByImage).toEqual({
      [task.outputImages[0]]: '第一个',
      [task.outputImages[1]]: '第二个',
    });
    expect(task.rawImageUrls).toEqual(['https://images.example.com/one.png']);
    expect(task.rawResponsePayload).toBeUndefined();
    expect(store.getImage(task.outputImages[0])?.dataUrl).toBe('data:image/png;base64,one');
    expect(store.getImage(task.outputImages[0])?.assetPath).toBe(`ai-image-assets/${task.outputImages[0]}.png`);
    expect(JSON.stringify(savedHistory)).not.toContain('rawResponsePayload');
    expect(savedHistory.tasks).toHaveLength(1);
    expect(savedHistory.tasks[0].outputImages).toEqual(task.outputImages);
    expect(seen).toContain('running');
    expect(seen.at(-1)).toBe('done');
    expect(fetchMock).toHaveBeenCalledWith('/api/ai-image/generate', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(request),
    }));
  });

  it('preserves prototype generation state when image history is persisted to the shared file', async () => {
    const prototypeTask = {
      id: 'prototype-task-from-spec',
      prompt: '已有原型生成',
      status: 'done',
      stage: 'done',
      error: null,
      createdAt: 900,
      finishedAt: 1200,
      elapsed: 300,
      provider: 'codex',
      acpxSessionName: 'axhub-project-home',
      runId: 'prototype-task-from-spec',
      recoverable: true,
    };
    const prototypeSession = {
      prototypeId: 'home',
      generatorElementId: 'generator-1',
      acpxSessionName: 'axhub-project-home',
      lastRun: {
        runId: 'prototype-task-from-spec',
        status: 'done',
      },
    };
    const persistedBodies: any[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).startsWith('/api/ai-image/history') && !init) {
        return new Response(JSON.stringify({
          tasks: [],
          prototypeTasks: [prototypeTask],
          prototypeSessions: [prototypeSession],
          images: {},
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
      return new Response(JSON.stringify({
        images: ['data:image/png;base64,done'],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const store = createAiImageTaskStore({ storage: null });

    await store.configure({ targetPath: 'prototypes/home' });
    await store.submit({
      prompt: '生成一张配图',
      params: {
        size: 'auto',
        quality: 'auto',
        output_format: 'png',
        output_compression: null,
        moderation: 'auto',
        n: 1,
      },
    });

    expect(persistedBodies.length).toBeGreaterThan(0);
    expect(persistedBodies.at(-1).prototypeTasks).toEqual([prototypeTask]);
    expect(persistedBodies.at(-1).prototypeSessions).toEqual([prototypeSession]);
  });

  it('creates and appends local image conversation rounds while persisting image tasks', async () => {
    const persistedBodies: any[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).startsWith('/api/ai-image/history') && !init) {
        return new Response(JSON.stringify({
          tasks: [],
          images: {},
          imageConversations: [{
            id: 'conversation-one',
            title: '第一轮',
            rounds: [{
              id: 'round-existing',
              prompt: '第一轮',
              taskId: 'task-existing',
              outputTaskIds: ['task-existing'],
              status: 'done',
              createdAt: 100,
            }],
            messages: [{
              id: 'message-existing',
              role: 'user',
              content: '第一轮',
              roundId: 'round-existing',
              taskId: 'task-existing',
              createdAt: 100,
            }],
            createdAt: 100,
            updatedAt: 200,
          }],
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
      return new Response(JSON.stringify({
        images: ['data:image/png;base64,conversation-round'],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const now = vi.fn()
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1600);
    const store = createAiImageTaskStore({ now, storage: null });

    await store.configure({ targetPath: 'prototypes/home' });
    const task = await store.submit({
      prompt: '继续生成第二轮',
      conversationId: 'conversation-one',
      referenceImages: ['data:image/png;base64,ref-one'],
      params: {
        size: 'auto',
        quality: 'auto',
        output_format: 'png',
        output_compression: null,
        moderation: 'auto',
        n: 1,
      },
    });
    const conversation = persistedBodies.at(-1).imageConversations[0];

    expect(task.conversationId).toBe('conversation-one');
    expect(task.roundId).toMatch(/^ai-round-/u);
    expect(conversation.id).toBe('conversation-one');
    expect(conversation.rounds.map((round: any) => round.id)).toEqual([
      'round-existing',
      task.roundId,
    ]);
    expect(conversation.rounds[1]).toMatchObject({
      id: task.roundId,
      prompt: '继续生成第二轮',
      taskId: task.id,
      outputTaskIds: [task.id],
      outputImageIds: task.outputImages,
      status: 'done',
    });
    expect(conversation.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'user',
        content: '继续生成第二轮',
        roundId: task.roundId,
        taskId: task.id,
        referenceImages: ['data:image/png;base64,ref-one'],
      }),
      expect.objectContaining({
        role: 'assistant',
        content: '生成完成，共 1 张',
        roundId: task.roundId,
        taskId: task.id,
        outputTaskIds: [task.id],
        outputImageIds: task.outputImages,
      }),
    ]));
  });

  it('saves the recoverable running image task before starting the generation request', async () => {
    const calls: string[] = [];
    let shouldHoldNextHistoryPut = true;
    let resolveHistoryPut: (() => void) | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).startsWith('/api/ai-image/history') && !init) {
        calls.push('history:get');
        return new Response(JSON.stringify({ tasks: [], images: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (String(input).startsWith('/api/ai-image/history') && init?.method === 'PUT') {
        calls.push('history:put');
        if (shouldHoldNextHistoryPut) {
          shouldHoldNextHistoryPut = false;
          return new Promise<Response>((resolve) => {
            resolveHistoryPut = () => resolve(new Response(String(init.body), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }));
          });
        }
        return new Response(String(init.body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      calls.push('generate');
      return new Response(JSON.stringify({
        images: ['data:image/png;base64,done'],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const store = createAiImageTaskStore({ storage: null });

    await store.configure({ targetPath: 'prototypes/home' });
    const submitPromise = store.submit({
      prompt: '刷新后也能重发',
      params: {
        size: 'auto',
        quality: 'auto',
        output_format: 'png',
        output_compression: null,
        moderation: 'auto',
        n: 1,
      },
      conversationId: 'conversation-one',
      roundId: 'round-one',
    });

    await Promise.resolve();
    expect(calls).toEqual(['history:get', 'history:put']);

    resolveHistoryPut?.();
    await submitPromise;

    expect(calls.indexOf('history:put')).toBeLessThan(calls.indexOf('generate'));
  });

  it('continues image generation if the initial recoverability save fails', async () => {
    const calls: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).startsWith('/api/ai-image/history') && !init) {
        return new Response(JSON.stringify({ tasks: [], images: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (String(input).startsWith('/api/ai-image/history') && init?.method === 'PUT') {
        calls.push('history:put');
        return new Response(JSON.stringify({ error: 'disk unavailable' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      calls.push('generate');
      return new Response(JSON.stringify({
        images: ['data:image/png;base64,done'],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const store = createAiImageTaskStore({ storage: null });

    await store.configure({ targetPath: 'prototypes/home' });
    const task = await store.submit({
      prompt: '保存失败也继续生成',
      params: {
        size: 'auto',
        quality: 'auto',
        output_format: 'png',
        output_compression: null,
        moderation: 'auto',
        n: 1,
      },
    });

    expect(task.status).toBe('done');
    expect(calls).toContain('generate');
  });

  it('keeps no more than 30 tasks when persisting to the backend history file', async () => {
    const persistedTaskCounts: number[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (String(input).startsWith('/api/ai-image/history')) {
        const body = JSON.parse(String(init?.body || '{}'));
        persistedTaskCounts.push(Array.isArray(body.tasks) ? body.tasks.length : 0);
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        images: [`data:image/png;base64,${Math.random().toString(36).slice(2)}`],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const store = createAiImageTaskStore({ storage: null });
    await store.configure({ targetPath: 'prototypes/home' });
    const request: AiImageGenerateRequest = {
      prompt: '批量历史',
      params: {
        size: '1024x1024',
        quality: 'high',
        output_format: 'png',
        output_compression: null,
        moderation: 'auto',
        n: 1,
      },
    };

    for (let index = 0; index < 32; index += 1) {
      await store.submit({ ...request, prompt: `批量历史 ${index}` });
    }

    expect(Math.max(...persistedTaskCounts)).toBe(30);
    expect(store.getTasks()).toHaveLength(30);
  });

  it('uses session-only history when no prototype target path is configured', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      images: ['data:image/png;base64,session'],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const store = createAiImageTaskStore({ storage: null });

    const task = await store.submit({
      prompt: '独立画布',
      params: {
        size: 'auto',
        quality: 'auto',
        output_format: 'png',
        output_compression: null,
        moderation: 'auto',
        n: 1,
      },
    });

    expect(task.status).toBe('done');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/ai-image/generate', expect.any(Object));
  });

  it('keeps reference images in the generate request payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      images: ['data:image/png;base64,done'],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const store = createAiImageTaskStore({ storage: null });
    const request: AiImageGenerateRequest = {
      prompt: '参考这两个节点',
      referenceImages: [
        'data:image/png;base64,ref-one',
        'data:image/png;base64,ref-two',
      ],
      params: {
        size: 'auto',
        quality: 'auto',
        output_format: 'png',
        output_compression: null,
        moderation: 'auto',
        n: 1,
      },
    };

    await store.submit(request);

    expect(fetchMock).toHaveBeenCalledWith('/api/ai-image/generate', expect.objectContaining({
      body: JSON.stringify(request),
    }));
  });

  it('generates a final image prompt with acpx before image generation when local context refs exist', async () => {
    const calls: Array<{ url: string; body: any }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const body = JSON.parse(String(init?.body || '{}'));
      calls.push({ url: String(input), body });
      if (String(input) === '/api/prompt/execute') {
        return new Response(JSON.stringify({
          success: true,
          output: '  最终生图提示词：使用 checkout-flow 的布局和 quiet-saas 的视觉规范生成主视觉  ',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        images: ['data:image/png;base64,done'],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const store = createAiImageTaskStore({ storage: null });

    const task = await store.submit({
      prompt: '根据这些上下文生成一张海报',
      localContextRefs: [{
        resourceType: 'prototype',
        resourceId: 'checkout-flow',
        title: 'Checkout Flow',
        paths: [
          'src/prototypes/checkout-flow/index.tsx',
          'src/prototypes/checkout-flow/index.ts',
        ],
      }, {
        resourceType: 'theme',
        resourceId: 'quiet-saas',
        title: 'Quiet SaaS',
        paths: [
          'src/themes/quiet-saas/DESIGN.md',
          'src/themes/quiet-saas/index.tsx',
          'src/themes/quiet-saas/index.ts',
        ],
      }],
      preferredPromptClient: 'genie:gemini',
      referenceImages: ['data:image/png;base64,ref-one'],
      params: {
        size: 'auto',
        quality: 'auto',
        output_format: 'png',
        output_compression: null,
        moderation: 'auto',
        n: 1,
      },
    } as any);

    expect(calls.map((call) => call.url)).toEqual([
      '/api/prompt/execute',
      '/api/ai-image/generate',
    ]);
    expect(calls[0].body).toMatchObject({
      scene: 'canvas-ai-image-prompt-generation',
      client: 'gemini',
    });
    expect(calls[0].body.prompt).toContain('根据这些上下文生成一张海报');
    expect(calls[0].body.prompt).toContain('src/prototypes/checkout-flow/index.tsx');
    expect(calls[0].body.prompt).toContain('src/themes/quiet-saas/DESIGN.md');
    expect(calls[0].body.prompt).toContain('已有参考图数量：1');
    expect(calls[1].body).toMatchObject({
      prompt: '最终生图提示词：使用 checkout-flow 的布局和 quiet-saas 的视觉规范生成主视觉',
      sourcePrompt: '根据这些上下文生成一张海报',
      preferredPromptClient: 'genie:gemini',
      referenceImages: ['data:image/png;base64,ref-one'],
    });
    expect(task).toMatchObject({
      status: 'done',
      prompt: '最终生图提示词：使用 checkout-flow 的布局和 quiet-saas 的视觉规范生成主视觉',
      sourcePrompt: '根据这些上下文生成一张海报',
    });
    expect(task.localContextRefs).toHaveLength(2);
  });

  it('blocks image generation when acpx prompt generation fails for local context refs', async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ error: 'acpx unavailable' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const store = createAiImageTaskStore({
      now: vi.fn().mockReturnValueOnce(2000).mockReturnValueOnce(2600),
      storage: null,
    });

    const task = await store.submit({
      prompt: '用本地原型上下文生成图片',
      localContextRefs: [{
        resourceType: 'prototype',
        resourceId: 'checkout-flow',
        paths: ['src/prototypes/checkout-flow/index.tsx'],
      }],
      params: {
        size: 'auto',
        quality: 'auto',
        output_format: 'png',
        output_compression: null,
        moderation: 'auto',
        n: 1,
      },
    } as any);

    expect(calls).toEqual(['/api/prompt/execute']);
    expect(task.status).toBe('error');
    expect(task.stage).toBe('error');
    expect(task.error).toBe('提示词生成失败：acpx unavailable');
  });

  it('emits local context preparation stages before generation, downloading, and done', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input) === '/api/prompt/execute') {
        return new Response(JSON.stringify({
          success: true,
          output: '最终图片提示词',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        images: ['data:image/png;base64,stage-done'],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const store = createAiImageTaskStore({ storage: null });
    const seenStages: string[] = [];
    store.subscribe((state) => {
      const stage = state.tasks[0]?.stage;
      if (stage) seenStages.push(stage);
    });

    await store.submit({
      prompt: '阶段顺序',
      localContextRefs: [{
        resourceType: 'theme',
        resourceId: 'quiet-saas',
        paths: ['src/themes/quiet-saas/DESIGN.md'],
      }],
      params: {
        size: 'auto',
        quality: 'auto',
        output_format: 'png',
        output_compression: null,
        moderation: 'auto',
        n: 1,
      },
    } as any);

    expect(seenStages).toEqual(expect.arrayContaining([
      'preparing-context',
      'generating-prompt',
      'generating',
      'downloading',
      'done',
    ]));
    expect(seenStages.indexOf('preparing-context')).toBeLessThan(seenStages.indexOf('generating-prompt'));
    expect(seenStages.indexOf('generating-prompt')).toBeLessThan(seenStages.indexOf('generating'));
    expect(seenStages.indexOf('generating')).toBeLessThan(seenStages.indexOf('downloading'));
    expect(seenStages.indexOf('downloading')).toBeLessThan(seenStages.indexOf('done'));
  });

  it('records API failures as error tasks', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      error: '上游失败',
      rawResponsePayload: '{"error":true}',
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    }));
    const store = createAiImageTaskStore({
      now: vi.fn().mockReturnValueOnce(2000).mockReturnValueOnce(2600),
      storage: null,
    });

    const task = await store.submit({
      prompt: '失败案例',
      params: {
        size: 'auto',
        quality: 'auto',
        output_format: 'png',
        output_compression: null,
        moderation: 'auto',
        n: 1,
      },
    });

    expect(task.status).toBe('error');
    expect(task.error).toBe('上游失败');
    expect(task.rawResponsePayload).toBeUndefined();
    expect(task.elapsed).toBe(600);
  });

  it('exposes the running task id before the generation request resolves', async () => {
    let resolveFetch: ((response: Response) => void) | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).startsWith('/api/ai-image/generate')) {
        return new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        });
      }
      return new Response(JSON.stringify({ tasks: [], images: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const store = createAiImageTaskStore({
      now: vi.fn().mockReturnValueOnce(3000).mockReturnValueOnce(3600),
      storage: null,
    });
    const createdTaskIds: string[] = [];

    const submitPromise = store.submit({
      prompt: '需要立刻绑定到画布组件',
      params: {
        size: 'auto',
        quality: 'auto',
        output_format: 'png',
        output_compression: null,
        moderation: 'auto',
        n: 1,
      },
    }, {
      onCreated: (task) => createdTaskIds.push(task.id),
    });

    expect(createdTaskIds).toHaveLength(1);
    expect(store.getTasks()[0]).toMatchObject({
      id: createdTaskIds[0],
      status: 'running',
    });

    await Promise.resolve();
    resolveFetch?.(new Response(JSON.stringify({
      images: ['data:image/png;base64,done'],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(submitPromise).resolves.toMatchObject({
      id: createdTaskIds[0],
      status: 'done',
    });
  });
});
