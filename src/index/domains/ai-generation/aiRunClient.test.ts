import { afterEach, describe, expect, it, vi } from 'vitest';

import { runAiStream } from './aiRunClient';

const originalFetch = globalThis.fetch;

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

describe('AI run client', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('streams artifact events to the caller before the completed snapshot', async () => {
    const seenEvents: string[] = [];
    const seenArtifacts: unknown[] = [];
    globalThis.fetch = vi.fn(async () => new Response([
      sseEvent('run.accepted', {
        runId: 'run-one',
        threadId: 'thread-one',
        scene: 'document',
      }),
      sseEvent('artifact.created', {
        runId: 'run-one',
        artifact: {
          id: 'artifact-one',
          kind: 'document',
          operation: 'created',
          target: { uri: '/?doc=one.md' },
        },
      }),
      sseEvent('run.text.delta', {
        runId: 'run-one',
        delta: 'done',
      }),
      sseEvent('run.completed', {
        status: 'done',
        runId: 'run-one',
        threadId: 'thread-one',
        output: 'done',
        artifacts: [{
          id: 'artifact-one',
          kind: 'document',
          operation: 'created',
        }],
      }),
    ].join(''), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })) as any;

    const result = await runAiStream({
      scene: 'document',
      prompt: '写文档',
      taskId: 'task-one',
      conversationId: 'conversation-one',
      generatorElementId: 'generator-1',
      canvasName: 'prototypes/home/canvas',
    }, ({ event, data }) => {
      seenEvents.push(event);
      if (event === 'artifact.created') {
        seenArtifacts.push(data.artifact);
      }
    });

    expect(seenEvents).toEqual([
      'run.accepted',
      'artifact.created',
      'run.text.delta',
      'run.completed',
    ]);
    expect(seenArtifacts).toEqual([
      expect.objectContaining({
        id: 'artifact-one',
        kind: 'document',
      }),
    ]);
    expect(result).toMatchObject({
      output: 'done',
      runId: 'run-one',
      threadId: 'thread-one',
      artifacts: [
        expect.objectContaining({ id: 'artifact-one' }),
      ],
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/ai/runs', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.any(String),
    }));
    const requestBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      scene: 'document',
      prompt: '写文档',
      taskId: 'task-one',
      conversationId: 'conversation-one',
      generatorElementId: 'generator-1',
      canvasName: 'prototypes/home/canvas',
    });
  });

  it('can pass per-run image generation settings to the AI runs API', async () => {
    globalThis.fetch = vi.fn(async () => new Response(
      sseEvent('run.completed', {
        status: 'done',
        output: 'ok',
        artifacts: [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      },
    )) as any;

    await runAiStream({
      scene: 'image',
      prompt: '测试图片配置',
      builtinToolSettings: {
        imageGeneration: {
          baseUrl: 'https://images.example.com/v1',
          apiKey: 'sk-current',
          model: 'gpt-image-2',
        },
      },
    });

    const requestBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      scene: 'image',
      prompt: '测试图片配置',
      builtinToolSettings: {
        imageGeneration: {
          baseUrl: 'https://images.example.com/v1',
          apiKey: 'sk-current',
          model: 'gpt-image-2',
        },
      },
    });
  });

  it('preserves structured run error fields for ACP runtime recovery actions', async () => {
    globalThis.fetch = vi.fn(async () => new Response([
      sseEvent('run.accepted', {
        runId: 'run-runtime',
        threadId: 'thread-runtime',
      }),
      sseEvent('run.error', {
        status: 'error',
        error: '本地 ACP 服务未链接',
        code: 'ACP_RUNTIME_UNAVAILABLE',
        action: 'open-ai-settings',
        runtime: {
          webBaseUrl: 'http://localhost:32123',
          apiBaseUrl: 'http://localhost:32123/api',
          projectPath: '/tmp/project',
          health: {
            status: 'runtime_unreachable',
            message: 'connect ECONNREFUSED',
            checkedAt: '2026-06-07T00:00:00.000Z',
            commandSource: 'default',
            hints: {
              installGlobal: 'npx -y @axhub/acp --help',
              start: 'npx -y @axhub/acp --port 32123',
              status: 'curl http://localhost:32123/api/chat',
            },
          },
        },
      }),
    ].join(''), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })) as any;

    await expect(runAiStream({
      scene: 'prototype',
      prompt: '生成页面',
    })).rejects.toMatchObject({
      message: '本地 ACP 服务未链接',
      code: 'ACP_RUNTIME_UNAVAILABLE',
      action: 'open-ai-settings',
      runtime: expect.objectContaining({
        health: expect.objectContaining({
          status: 'runtime_unreachable',
          hints: expect.objectContaining({
            start: 'npx -y @axhub/acp --port 32123',
          }),
        }),
      }),
    });
  });
});
