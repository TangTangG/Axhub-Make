import { describe, expect, it, vi } from 'vitest';

async function loadRunnerModule() {
  const mod = await import('../acpChatRunner.ts').catch((error) => ({ __missing: error }));
  expect('__missing' in mod ? undefined : mod).toBeTruthy();
  return mod as any;
}

function createSseResponse(events: string[], init?: ResponseInit): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    },
  }), {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      ...(init?.headers || {}),
    },
    ...init,
  });
}

function createJsonEvent(chunk: Record<string, unknown>) {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

describe('ACP chat runner', () => {
  it('creates URL-safe one-shot thread ids', async () => {
    const mod = await loadRunnerModule();

    expect(mod.createAcpOneShotThreadId('exec run')).toMatch(/^exec-run-[A-Za-z0-9_-]+$/u);
    expect(mod.createAcpOneShotThreadId('图片生成')).toMatch(/^exec-[A-Za-z0-9_-]+$/u);
  });

  it('posts command-style chat runs, aggregates stream chunks, and captures runtime headers', async () => {
    const mod = await loadRunnerModule();
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return createSseResponse([
        createJsonEvent({ type: 'start', messageId: 'assistant-1' }),
        'data: {"type":"text-delta","id":"text-1","delta":"Done "}\n\n',
        createJsonEvent({ type: 'reasoning-delta', id: 'reasoning-1', delta: 'checking tools' }),
        createJsonEvent({
          type: 'tool-output-available',
          toolCallId: 'call-1',
          toolName: 'generate_image',
          output: {
            status: 'completed',
            recordId: 'image-record-1',
          },
        }),
        createJsonEvent({ type: 'text-delta', id: 'text-1', delta: 'now' }),
        createJsonEvent({ type: 'finish', finishReason: 'stop' }),
        'data: [DONE]\n\n',
      ], {
        headers: {
          'x-acp-provider': 'codex',
          'x-acp-thread-id': encodeURIComponent(body.threadId),
          'x-acp-session-key': encodeURIComponent('codex:/workspace:' + body.threadId),
          'x-acp-session-id': 'acp-session-1',
          'x-acp-cold-start': 'true',
          'x-acp-run-state': 'running',
          'x-acp-warning-count': '2',
        },
      });
    });

    const result = await mod.runAcpChatCommand({
      acpApiBaseUrl: 'http://acp.local/api/',
      provider: 'genie:codex',
      workspacePath: '/workspace',
      prompt: 'Run the requested task.',
      builtinTools: ['image-generation'],
    }, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(url).toBe('http://acp.local/api/chat');
    expect(init).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    });
    expect(body).toMatchObject({
      id: result.threadId,
      threadId: result.threadId,
      provider: 'codex',
      workspacePath: '/workspace',
      builtinTools: ['image-generation'],
      messages: [
        {
          id: `${result.threadId}-user`,
          role: 'user',
          parts: [{ type: 'text', text: 'Run the requested task.' }],
        },
      ],
    });
    expect(result).toMatchObject({
      success: true,
      provider: 'codex',
      output: 'Done now',
      reasoning: 'checking tools',
      finishReason: 'stop',
      errors: [],
      runtimeHeaders: {
        provider: 'codex',
        threadId: result.threadId,
        sessionId: 'acp-session-1',
        coldStart: true,
        runState: 'running',
        warningCount: 2,
      },
      toolOutputs: [
        {
          type: 'tool-output-available',
          toolCallId: 'call-1',
          toolName: 'generate_image',
          output: {
            status: 'completed',
            recordId: 'image-record-1',
          },
        },
      ],
    });
  });

  it('preserves provided conversation identity for non one-shot runs', async () => {
    const mod = await loadRunnerModule();
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => createSseResponse([
      createJsonEvent({ type: 'text-delta', delta: 'continued' }),
      createJsonEvent({ type: 'finish', finishReason: 'stop' }),
      'data: [DONE]\n\n',
    ]));

    const result = await mod.runAcpChat({
      acpApiBaseUrl: 'http://acp.local/api',
      id: 'chat-run-1',
      threadId: 'existing_thread-1',
      provider: 'gemini',
      workspacePath: '/workspace',
      messages: [
        {
          id: 'user-2',
          role: 'user',
          parts: [{ type: 'text', text: 'Continue.' }],
        },
      ],
      context: { version: 2, items: [] },
      model: 'gemini-model',
      modeId: 'plan',
    }, { fetchImpl });

    const body = JSON.parse(String(fetchImpl.mock.calls[0][1].body));
    expect(body).toMatchObject({
      id: 'chat-run-1',
      threadId: 'existing_thread-1',
      provider: 'gemini',
      workspacePath: '/workspace',
      context: { version: 2, items: [] },
      model: 'gemini-model',
      modeId: 'plan',
    });
    expect(result.output).toBe('continued');
    expect(result.threadId).toBe('existing_thread-1');
  });

  it('fails stream error chunks with the partial result attached', async () => {
    const mod = await loadRunnerModule();
    const fetchImpl = vi.fn(async () => createSseResponse([
      createJsonEvent({ type: 'text-delta', delta: 'partial ' }),
      createJsonEvent({ type: 'error', errorText: 'ACP run failed' }),
      'data: [DONE]\n\n',
    ]));

    await expect(mod.runAcpChatCommand({
      acpApiBaseUrl: 'http://acp.local/api',
      workspacePath: '/workspace',
      prompt: 'Run.',
    }, { fetchImpl })).rejects.toMatchObject({
      name: 'AcpChatRunError',
      code: 'ACP_CHAT_STREAM_ERROR',
      statusCode: 502,
      result: {
        output: 'partial ',
        errors: [
          {
            type: 'error',
            message: 'ACP run failed',
          },
        ],
      },
    });
  });

  it('fails tool-output-error chunks so image runs cannot silently succeed', async () => {
    const mod = await loadRunnerModule();
    const fetchImpl = vi.fn(async () => createSseResponse([
      createJsonEvent({
        type: 'tool-output-error',
        toolCallId: 'call-1',
        toolName: 'generate_image',
        errorText: 'image tool failed',
      }),
      createJsonEvent({ type: 'finish', finishReason: 'error' }),
      'data: [DONE]\n\n',
    ]));

    await expect(mod.runAcpChatCommand({
      acpApiBaseUrl: 'http://acp.local/api',
      workspacePath: '/workspace',
      prompt: 'Generate an image.',
      builtinTools: ['image-generation'],
    }, { fetchImpl })).rejects.toMatchObject({
      name: 'AcpChatRunError',
      code: 'ACP_CHAT_TOOL_OUTPUT_ERROR',
      statusCode: 502,
      result: {
        finishReason: 'error',
        errors: [
          {
            type: 'tool-output-error',
            toolCallId: 'call-1',
            toolName: 'generate_image',
            message: 'image tool failed',
          },
        ],
      },
    });
  });
});
