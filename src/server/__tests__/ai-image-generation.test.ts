import { describe, expect, it, vi } from 'vitest';

import { generateAiImages } from '../aiImageGeneration.ts';

function sseJson(chunk: Record<string, unknown>) {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

function createSseResponse(events: string[]): Response {
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
      'x-acp-thread-id': encodeURIComponent('image-thread-1'),
    },
  });
}

describe('AI image generation ACP bridge', () => {
  it('passes image API connection settings to ACP builtin tool settings', async () => {
    const fetchImpl = vi.fn(async () => createSseResponse([
      sseJson({
        type: 'tool-output-available',
        toolCallId: 'tool-call-image',
        toolName: 'generate_image',
        output: {
          status: 'completed',
          images: [
            { url: 'data:image/png;base64,aW1hZ2U=', fileName: 'image.png' },
          ],
        },
      }),
      sseJson({ type: 'finish', finishReason: 'stop' }),
      'data: [DONE]\n\n',
    ])) as unknown as typeof fetch;

    await generateAiImages({
      acpApiBaseUrl: 'http://acp.local/api',
      workspacePath: '/workspace',
      prompt: '生成图片',
      params: { n: 1 },
      config: {
        baseUrl: 'https://images.example.com/v1',
        apiKey: 'sk-image',
        model: 'gpt-image-2',
      },
      fetchImpl,
    });

    const requestBody = JSON.parse(String((fetchImpl as any).mock.calls[0][1].body));
    expect(requestBody.builtinToolSettings).toEqual({
      imageGeneration: {
        baseUrl: 'https://images.example.com/v1',
        apiKey: 'sk-image',
        model: 'gpt-image-2',
      },
    });
  });
});
