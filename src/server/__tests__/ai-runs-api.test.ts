import fs from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  registerProject,
  startTestServer,
  writeJson,
  writeProjectMetadata,
} from './projects-api.helpers';

const acpChatServers: Server[] = [];

interface AcpRunTestServer {
  origin: string;
  requests: Array<{
    method: string;
    url: string;
    body: any;
  }>;
  recordsRequests: Array<{
    method: string;
    url: string;
  }>;
}

function sseJson(chunk: Record<string, unknown>) {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function startAcpRunTestServer(options: {
  streamEvents?: Record<string, unknown>[];
  recordsResponse?: unknown;
} = {}): Promise<AcpRunTestServer> {
  const requests: AcpRunTestServer['requests'] = [];
  const recordsRequests: AcpRunTestServer['recordsRequests'] = [];
  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>Mock ACP UI</title>');
      return;
    }
    if (req.method === 'GET' && req.url === '/api/chat') {
      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    if (req.method === 'OPTIONS' && req.url === '/api/chat') {
      const origin = String(req.headers.origin || '*');
      res.writeHead(204, {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      res.end();
      return;
    }
    if (req.method === 'POST' && req.url === '/api/chat') {
      const rawBody = await readRequestBody(req);
      const body = rawBody ? JSON.parse(rawBody) : {};
      requests.push({ method: req.method, url: req.url, body });
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'x-acp-provider': String(body.provider || 'codex'),
        'x-acp-thread-id': encodeURIComponent(String(body.threadId || 'default')),
        'x-acp-session-id': `session-${body.threadId || 'default'}`,
      });
      for (const event of options.streamEvents || [
        { type: 'text-delta', delta: 'done' },
        { type: 'finish', finishReason: 'stop' },
      ]) {
        res.write(sseJson(event));
      }
      res.end('data: [DONE]\n\n');
      return;
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/tools/image-generation/records')) {
      recordsRequests.push({ method: req.method, url: req.url });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(options.recordsResponse || {
        records: [
          {
            id: 'record-fallback',
            status: 'succeeded',
            revisedPrompt: 'fallback prompt',
            images: [
              { url: 'data:image/png;base64,ZmFsbGJhY2s=', fileName: 'fallback.png', mimeType: 'image/png' },
            ],
          },
        ],
      }));
      return;
    }
    res.writeHead(404).end();
  });
  acpChatServers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start ACP run test server');
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    recordsRequests,
  };
}

async function startRegisteredTestServer(projectRoot: string, acp: AcpRunTestServer, serverConfig: Record<string, any> = {}) {
  const server = await startTestServer(projectRoot, createTempRoot('axhub-ai-runs-home-'), {
    serverConfig: {
      ...serverConfig,
      assistant: {
        webBaseUrl: acp.origin,
        apiBaseUrl: `${acp.origin}/api`,
        ...(serverConfig.assistant || {}),
      },
    },
  });
  try {
    const projectId = String(JSON.parse(fs.readFileSync(path.join(projectRoot, '.axhub', 'make', 'project.json'), 'utf8'))?.project?.id || path.basename(projectRoot));
    await registerProject(server.origin, projectRoot, projectId, projectId);
    return server;
  } catch (error) {
    await server.close();
    throw error;
  }
}

async function collectRunEvents(response: Response): Promise<Array<{ event: string; data: any }>> {
  const text = await response.text();
  return text
    .split(/\r?\n\r?\n/u)
    .map((rawEvent) => rawEvent.trim())
    .filter(Boolean)
    .map((rawEvent) => {
      const event = rawEvent
        .split(/\r?\n/u)
        .find((line) => line.startsWith('event:'))
        ?.slice('event:'.length)
        .trim() || 'message';
      const data = rawEvent
        .split(/\r?\n/u)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length).trim())
        .join('\n');
      return {
        event,
        data: data ? JSON.parse(data) : null,
      };
    });
}

afterEach(async () => {
  for (const server of acpChatServers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  cleanupProjectApiTestRoots();
});

describe('AI runs API', () => {
  it('returns a structured open-settings run error when ACP runtime is unavailable', async () => {
    const projectRoot = createTempRoot('axhub-ai-runs-runtime-unavailable-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-runs-runtime-unavailable', name: 'AI Runs Runtime Unavailable' },
    });
    const acp = {
      origin: 'http://127.0.0.1:1',
      requests: [],
      recordsRequests: [],
    } satisfies AcpRunTestServer;
    const server = await startRegisteredTestServer(projectRoot, acp, {
      assistant: {
        webBaseUrl: 'http://127.0.0.1:1',
        apiBaseUrl: 'http://127.0.0.1:1/api',
      },
    });

    try {
      const response = await fetch(`${server.origin}/api/ai/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: 'prototype',
          prompt: '生成一个 dashboard 页面',
        }),
      });
      const events = await collectRunEvents(response);

      expect(response.status).toBe(200);
      expect(events.map((event) => event.event)).toEqual([
        'run.accepted',
        'run.stage',
        'run.error',
      ]);
      expect(events.at(-1)).toMatchObject({
        event: 'run.error',
        data: {
          status: 'error',
          code: 'ACP_RUNTIME_UNAVAILABLE',
          action: 'open-ai-settings',
          runtime: expect.objectContaining({
            webBaseUrl: expect.any(String),
            apiBaseUrl: expect.any(String),
            projectPath: projectRoot,
            health: expect.objectContaining({
              status: expect.not.stringMatching(/^ready$/u),
              hints: expect.objectContaining({
                start: expect.any(String),
                status: expect.any(String),
              }),
            }),
          }),
        },
      });
      expect(acp.requests).toHaveLength(0);
    } finally {
      await server.close();
    }
  });

  it('streams image generation artifacts through one unified AI run endpoint', async () => {
    const projectRoot = createTempRoot('axhub-ai-runs-image-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-runs-image', name: 'AI Runs Image' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
    });
    const acp = await startAcpRunTestServer({
      streamEvents: [
        { type: 'text-delta', delta: 'starting' },
        {
          type: 'tool-output-available',
          toolCallId: 'tool-call-image-1',
          toolName: 'generate_image',
          output: {
            status: 'succeeded',
            recordId: 'record-one',
            revisedPrompt: '第一个',
            images: [
              { base64: 'b25l', mimeType: 'image/png', fileName: 'one.png' },
              { url: 'data:image/png;base64,dHdv', revisedPrompt: '第二个', fileName: 'two.png' },
            ],
          },
        },
        { type: 'finish', finishReason: 'stop' },
      ],
    });
    const server = await startRegisteredTestServer(projectRoot, acp);

    try {
      const response = await fetch(`${server.origin}/api/ai/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: 'image',
          prompt: '生成两张图',
          params: {
            size: '1024x1024',
            quality: 'high',
            output_format: 'png',
            n: 2,
          },
        }),
      });
      const events = await collectRunEvents(response);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      expect(events.map((event) => event.event)).toEqual([
        'run.accepted',
        'run.stage',
        'run.text.delta',
        'artifact.created',
        'artifact.created',
        'run.completed',
      ]);
      expect(events.filter((event) => event.event === 'artifact.created').map((event) => event.data.artifact)).toEqual([
        expect.objectContaining({
          kind: 'image',
          operation: 'created',
          dataUrl: 'data:image/png;base64,b25l',
          revisedPrompt: '第一个',
          metadata: expect.objectContaining({ fileName: 'one.png' }),
        }),
        expect.objectContaining({
          kind: 'image',
          operation: 'created',
          dataUrl: 'data:image/png;base64,dHdv',
          revisedPrompt: '第二个',
          metadata: expect.objectContaining({ fileName: 'two.png' }),
        }),
      ]);
      expect(events.at(-1)?.data).toMatchObject({
        status: 'done',
        output: 'starting',
        artifacts: [
          expect.objectContaining({ kind: 'image' }),
          expect.objectContaining({ kind: 'image' }),
        ],
      });
      expect(acp.requests[0].body).toMatchObject({
        provider: 'codex',
        workspacePath: projectRoot,
        builtinTools: ['image-generation'],
      });
      expect(acp.requests[0].body.params).toBeUndefined();
      expect(acp.requests[0].body.settings).toBeUndefined();
      expect(acp.requests[0].body.messages).toEqual([
        expect.objectContaining({
          role: 'user',
          parts: [
            expect.objectContaining({
              type: 'text',
              text: expect.stringContaining('Requested image parameters:'),
            }),
          ],
        }),
      ]);
      expect(acp.requests[0].body.messages[0].parts[0].text).toContain('- size: 1024x1024');
      expect(acp.requests[0].body.messages[0].parts[0].text).toContain('- quality: high');
      expect(acp.requests[0].body.messages[0].parts[0].text).toContain('- count: 2');
      expect(acp.requests[0].body.builtinToolSettings).toEqual({
        imageGeneration: {
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-image-2',
        },
      });
    } finally {
      await server.close();
    }
  });

  it('does not forward prototype settings as structured ACP chat fields', async () => {
    const projectRoot = createTempRoot('axhub-ai-runs-prototype-settings-prompt-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-runs-prototype-settings-prompt', name: 'AI Runs Prototype Settings Prompt' },
    });
    const acp = await startAcpRunTestServer();
    const server = await startRegisteredTestServer(projectRoot, acp);

    try {
      const response = await fetch(`${server.origin}/api/ai/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: 'prototype',
          prompt: [
            '生成 CRM 首页',
            '',
            '原型生成设置：',
            '- 生成数量：3 个',
            '- 设计系统：linear',
          ].join('\n'),
          settings: {
            count: 3,
            themeName: 'linear',
          },
        }),
      });
      await collectRunEvents(response);

      expect(response.status).toBe(200);
      expect(acp.requests[0].body.params).toBeUndefined();
      expect(acp.requests[0].body.settings).toBeUndefined();
      expect(acp.requests[0].body.messages[0].parts[0].text).toContain('原型生成设置：');
      expect(acp.requests[0].body.messages[0].parts[0].text).toContain('- 生成数量：3 个');
      expect(acp.requests[0].body.messages[0].parts[0].text).toContain('- 设计系统：linear');
    } finally {
      await server.close();
    }
  });

  it('passes per-run image generation settings from settings tests to ACP', async () => {
    const projectRoot = createTempRoot('axhub-ai-runs-image-settings-test-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-runs-image-settings-test', name: 'AI Runs Image Settings Test' },
    });
    const acp = await startAcpRunTestServer();
    const server = await startRegisteredTestServer(projectRoot, acp, {
      ai: {
        imageGeneration: {
          baseUrl: 'https://saved.example.com/v1',
          apiKey: 'sk-saved',
          model: 'saved-image-model',
        },
      },
    });

    try {
      const response = await fetch(`${server.origin}/api/ai/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: 'image',
          prompt: '测试图片配置',
          builtinToolSettings: {
            imageGeneration: {
              baseUrl: 'https://current.example.com/v1',
              apiKey: 'sk-current',
              model: 'current-image-model',
            },
          },
        }),
      });
      await collectRunEvents(response);

      expect(acp.requests[0].body.builtinToolSettings).toEqual({
        imageGeneration: {
          baseUrl: 'https://current.example.com/v1',
          apiKey: 'sk-current',
          model: 'current-image-model',
        },
      });
    } finally {
      await server.close();
    }
  });

  it('uses the shared ACP timeout for image runs instead of image-generation timeout settings', async () => {
    const projectRoot = createTempRoot('axhub-ai-runs-image-timeout-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-runs-image-timeout', name: 'AI Runs Image Timeout' },
    });
    const acp = await startAcpRunTestServer();
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const server = await startRegisteredTestServer(projectRoot, acp, {
      automation: {
        acp: {
          timeout: 222,
        },
      },
      ai: {
        imageGeneration: {
          timeout: 45,
        },
      },
    });

    try {
      const response = await fetch(`${server.origin}/api/ai/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: 'image',
          prompt: '生成一张图',
        }),
      });
      await collectRunEvents(response);

      expect(timeoutSpy.mock.calls.map(([timeoutMs]) => timeoutMs)).toContain(222_000);
      expect(timeoutSpy.mock.calls.map(([timeoutMs]) => timeoutMs)).not.toContain(45_000);
    } finally {
      timeoutSpy.mockRestore();
      await server.close();
    }
  });

  it('removes obsolete execution endpoints instead of keeping compatibility shims', async () => {
    const projectRoot = createTempRoot('axhub-ai-runs-old-routes-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-runs-old-routes', name: 'AI Runs Old Routes' },
    });
    const acp = await startAcpRunTestServer();
    const server = await startRegisteredTestServer(projectRoot, acp);

    try {
      const [promptExecute, sessionRun, imageGenerate] = await Promise.all([
        fetch(`${server.origin}/api/prompt/execute`, { method: 'POST', body: '{}' }),
        fetch(`${server.origin}/api/prototype-generation/session-run`, { method: 'POST', body: '{}' }),
        fetch(`${server.origin}/api/ai-image/generate`, { method: 'POST', body: '{}' }),
      ]);

      expect(promptExecute.status).toBe(404);
      expect(sessionRun.status).toBe(404);
      expect(imageGenerate.status).toBe(404);
      expect(acp.requests).toHaveLength(0);
    } finally {
      await server.close();
    }
  });

  it('falls back to ACP image records when image tool output is not in the chat stream', async () => {
    const projectRoot = createTempRoot('axhub-ai-runs-image-fallback-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-runs-image-fallback', name: 'AI Runs Image Fallback' },
    });
    const acp = await startAcpRunTestServer({
      streamEvents: [
        { type: 'text-delta', delta: 'image record created' },
        { type: 'finish', finishReason: 'stop' },
      ],
    });
    const server = await startRegisteredTestServer(projectRoot, acp);

    try {
      const response = await fetch(`${server.origin}/api/ai/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: 'image',
          prompt: '生成 fallback 图',
          params: { n: 1 },
        }),
      });
      const events = await collectRunEvents(response);
      const artifacts = events.filter((event) => event.event === 'artifact.created').map((event) => event.data.artifact);

      expect(response.status).toBe(200);
      expect(artifacts).toEqual([
        expect.objectContaining({
          kind: 'image',
          dataUrl: 'data:image/png;base64,ZmFsbGJhY2s=',
          revisedPrompt: 'fallback prompt',
        }),
      ]);
      expect(acp.recordsRequests).toHaveLength(1);
      const recordsUrl = new URL(acp.recordsRequests[0].url, acp.origin);
      expect(recordsUrl.pathname).toBe('/api/tools/image-generation/records');
      expect(recordsUrl.searchParams.get('workspacePath')).toBe(projectRoot);
      expect(recordsUrl.searchParams.get('threadId')).toBe(acp.requests[0].body.threadId);
    } finally {
      await server.close();
    }
  });

  it('normalizes canvas artifacts from ACP resource links and file diffs', async () => {
    const projectRoot = createTempRoot('axhub-ai-runs-artifacts-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-runs-artifacts', name: 'AI Runs Artifacts' },
    });
    const acp = await startAcpRunTestServer({
      streamEvents: [
        {
          type: 'resource_link',
          toolCallId: 'tool-call-resource-link',
          uri: 'file://src/prototypes/home/pages/dashboard.tsx',
          name: 'Dashboard page',
          mimeType: 'text/tsx',
        },
        {
          type: 'resource',
          toolCallId: 'tool-call-resource',
          uri: 'file://src/resources/brief.md',
          name: 'Brief',
          mimeType: 'text/markdown',
          text: '# Brief',
        },
        {
          type: 'diff',
          toolCallId: 'tool-call-diff',
          path: 'src/prototypes/home/index.tsx',
          oldText: 'old',
          newText: 'new',
          patch: '@@ -1 +1 @@',
        },
        { type: 'finish', finishReason: 'stop' },
      ],
    });
    const server = await startRegisteredTestServer(projectRoot, acp);

    try {
      const response = await fetch(`${server.origin}/api/ai/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: 'prototype',
          prompt: '生成一个 dashboard 页面',
          canvasId: 'canvas-home',
          generatorElementId: 'generator-1',
          targetArtifactId: 'prototype-home',
        }),
      });
      const events = await collectRunEvents(response);
      const artifactEvents = events
        .filter((event) => event.event === 'artifact.created' || event.event === 'artifact.updated');

      expect(response.status).toBe(200);
      expect(artifactEvents.map((event) => event.event)).toEqual([
        'artifact.updated',
      ]);
      expect(artifactEvents.map((event) => event.data.artifact)).toEqual([
        expect.objectContaining({
          kind: 'prototype',
          operation: 'updated',
          target: expect.objectContaining({
            path: 'src/prototypes/home/index.tsx',
          }),
          source: expect.objectContaining({
            type: 'acp-diff',
            toolCallId: 'tool-call-diff',
          }),
        }),
      ]);
      expect(events.at(-1)?.data.artifacts).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  it('persists streamed canvas artifacts into the project generation artifact history', async () => {
    const projectRoot = createTempRoot('axhub-ai-runs-artifact-history-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-runs-artifact-history', name: 'AI Runs Artifact History' },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      },
    });
    const acp = await startAcpRunTestServer({
      streamEvents: [
        {
          type: 'resource_link',
          toolCallId: 'tool-call-drawio',
          uri: 'file://src/resources/flows/onboarding.drawio.svg',
          name: 'Onboarding flow',
          mimeType: 'image/svg+xml',
        },
        {
          type: 'resource',
          toolCallId: 'tool-call-plain-svg',
          uri: 'file://src/resources/icons/plain.svg',
          name: 'Plain SVG',
          mimeType: 'image/svg+xml',
        },
        {
          type: 'diff',
          toolCallId: 'tool-call-doc',
          path: 'src/resources/brief.md',
          oldText: 'old',
          newText: 'new',
          patch: '@@ -1 +1 @@',
        },
        { type: 'finish', finishReason: 'stop' },
      ],
    });
    const server = await startRegisteredTestServer(projectRoot, acp);

    try {
      const response = await fetch(`${server.origin}/api/ai/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: 'document',
          prompt: '生成流程图和说明文档',
          targetPath: 'prototypes/home',
          taskId: 'task-document-history',
          conversationId: 'conversation-document-history',
          canvasId: 'canvas-home',
          generatorElementId: 'generator-history',
        }),
      });
      const events = await collectRunEvents(response);

      expect(response.status).toBe(200);
      expect(events.filter((event) => event.event === 'artifact.created' || event.event === 'artifact.updated')).toHaveLength(1);

      const historyPath = path.join(projectRoot, 'src/prototypes/home/.spec/generation-artifacts.json');
      expect(fs.existsSync(historyPath)).toBe(true);
      const stored = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      expect(stored).toMatchObject({
        schemaVersion: 1,
        kind: 'generation-artifacts',
        targetPath: 'prototypes/home',
      });
      expect(stored.artifacts).toHaveLength(1);
      expect(stored.artifacts).toEqual([
        expect.objectContaining({
          taskId: 'task-document-history',
          conversationId: 'conversation-document-history',
          kind: 'document',
          operation: 'updated',
          runId: expect.any(String),
          threadId: expect.any(String),
          target: expect.objectContaining({ path: 'src/resources/brief.md' }),
          status: 'done',
        }),
      ]);
      expect(fs.existsSync(path.join(projectRoot, 'src/prototypes/home/.spec/ai-image-history.json'))).toBe(false);

      const historyResponse = await fetch(`${server.origin}/api/ai/artifact-history?targetPath=prototypes/home`);
      const historyBody = await historyResponse.json();
      expect(historyResponse.status).toBe(200);
      expect(historyBody.artifacts).toHaveLength(1);
      expect(historyBody.artifacts.map((artifact: any) => artifact.kind)).toEqual(['document']);

      const taskPath = path.join(projectRoot, 'src/prototypes/home/.spec/generation-tasks.json');
      expect(fs.existsSync(taskPath)).toBe(true);
      const taskHistory = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
      expect(taskHistory.tasks).toEqual([
        expect.objectContaining({
          id: 'task-document-history',
          taskId: 'task-document-history',
          conversationId: 'conversation-document-history',
          prompt: '生成流程图和说明文档',
          status: 'done',
          runId: expect.any(String),
          threadId: expect.any(String),
        }),
      ]);
    } finally {
      await server.close();
    }
  });

  it('upserts task and artifact history incrementally and revives artifacts reported again after soft delete', async () => {
    const projectRoot = createTempRoot('axhub-ai-history-incremental-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-history-incremental', name: 'AI History Incremental' },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      },
    });
    const acp = await startAcpRunTestServer();
    const server = await startRegisteredTestServer(projectRoot, acp);

    try {
      const target = 'targetPath=prototypes/home';
      const [firstArtifact, secondArtifact] = await Promise.all([
        fetch(`${server.origin}/api/ai/artifact-history?${target}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artifact: {
              id: 'artifact-a',
              taskId: 'task-a',
              conversationId: 'conversation-a',
              kind: 'document',
              operation: 'created',
              title: 'A',
              source: {},
              target: { path: 'src/resources/a.md' },
              createdAt: 1,
              updatedAt: 1,
              status: 'done',
              metadata: {},
            },
          }),
        }),
        fetch(`${server.origin}/api/ai/artifact-history?${target}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artifacts: [{
              id: 'artifact-b',
              taskId: 'task-b',
              conversationId: 'conversation-b',
              kind: 'document',
              operation: 'created',
              title: 'B',
              source: {},
              target: { path: 'src/resources/b.md' },
              createdAt: 2,
              updatedAt: 2,
              status: 'done',
              metadata: {},
            }],
          }),
        }),
      ]);
      expect(firstArtifact.status).toBe(200);
      expect(secondArtifact.status).toBe(200);

      const deleteResponse = await fetch(`${server.origin}/api/ai/artifact-history?${target}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['artifact-a'] }),
      });
      expect(deleteResponse.status).toBe(200);

      const stalePut = await fetch(`${server.origin}/api/ai/artifact-history?${target}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifacts: [{ id: 'artifact-a' }, { id: 'artifact-b' }] }),
      });
      expect(stalePut.status).toBe(405);

      const staleUpsert = await fetch(`${server.origin}/api/ai/artifact-history?${target}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifacts: [{
            id: 'artifact-a',
            kind: 'document',
            operation: 'updated',
            title: 'A stale',
            source: {},
            target: { path: 'src/resources/a-stale.md' },
            createdAt: 1,
            updatedAt: 10,
            status: 'done',
            metadata: {},
          }],
        }),
      });
      expect(staleUpsert.status).toBe(200);

      const historyResponse = await fetch(`${server.origin}/api/ai/artifact-history?${target}`);
      const historyBody = await historyResponse.json();
      expect(historyBody.artifacts.map((artifact: any) => artifact.id)).toEqual(['artifact-a', 'artifact-b']);
      expect(historyBody.artifacts.find((artifact: any) => artifact.id === 'artifact-a')).toEqual(expect.objectContaining({
        title: 'A stale',
        target: expect.objectContaining({ path: 'src/resources/a-stale.md' }),
      }));

      const stored = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/prototypes/home/.spec/generation-artifacts.json'), 'utf8'));
      expect(stored.artifacts.find((artifact: any) => artifact.id === 'artifact-a')).toEqual(expect.objectContaining({
        id: 'artifact-a',
        title: 'A stale',
      }));
      expect(stored.artifacts.find((artifact: any) => artifact.id === 'artifact-a')?.deletedAt).toBeUndefined();
      expect(stored.artifacts.find((artifact: any) => artifact.id === 'artifact-b')).toEqual(expect.objectContaining({
        id: 'artifact-b',
        taskId: 'task-b',
      }));
    } finally {
      await server.close();
    }
  });

  it('stores streamed image artifacts as project asset references in the generic artifact history', async () => {
    const projectRoot = createTempRoot('axhub-ai-runs-image-artifact-history-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-runs-image-artifact-history', name: 'AI Runs Image Artifact History' },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      },
    });
    const acp = await startAcpRunTestServer({
      streamEvents: [
        {
          type: 'tool-output-available',
          toolCallId: 'tool-call-image-history',
          toolName: 'generate_image',
          output: {
            status: 'succeeded',
            recordId: 'record-image-history',
            images: [
              { base64: 'aW1hZ2UtaGlzdG9yeQ==', mimeType: 'image/png', fileName: 'history.png' },
            ],
          },
        },
        { type: 'finish', finishReason: 'stop' },
      ],
    });
    const server = await startRegisteredTestServer(projectRoot, acp, {
      ai: {
        imageGeneration: {
          baseUrl: 'https://images.example.com/v1',
          apiKey: 'sk-image',
          model: 'gpt-image-2',
        },
      },
    });

    try {
      const response = await fetch(`${server.origin}/api/ai/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: 'image',
          prompt: '生成项目内图片资产',
          targetPath: 'prototypes/home',
          taskId: 'task-image-history',
          conversationId: 'conversation-image-history',
          params: { n: 1, output_format: 'png' },
        }),
      });
      await collectRunEvents(response);

      const historyPath = path.join(projectRoot, 'src/prototypes/home/.spec/generation-artifacts.json');
      const stored = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      expect(JSON.stringify(stored)).not.toContain('aW1hZ2UtaGlzdG9yeQ==');
      expect(stored.artifacts).toEqual([
        expect.objectContaining({
          kind: 'image',
          taskId: 'task-image-history',
          conversationId: 'conversation-image-history',
          assetRef: expect.objectContaining({
            assetPath: expect.stringMatching(/^generation-assets\/images\/history-[a-f0-9]{12}\.png$/u),
            mimeType: 'image/png',
            url: expect.stringContaining('/api/ai/artifact-history/assets?'),
          }),
        }),
      ]);
      const assetPath = stored.artifacts[0].assetRef.assetPath;
      expect(fs.readFileSync(path.join(projectRoot, 'src/prototypes/home/.spec', assetPath), 'utf8')).toBe('image-history');
      expect(fs.existsSync(path.join(projectRoot, 'src/prototypes/home/.spec/ai-image-history.json'))).toBe(false);
      expect(acp.requests[0].body.builtinToolSettings).toEqual({
        imageGeneration: {
          baseUrl: 'https://images.example.com/v1',
          apiKey: 'sk-image',
          model: 'gpt-image-2',
          savePathPattern: 'src/prototypes/home/.spec/generation-assets/images/image-<index>.<ext>',
        },
      });
    } finally {
      await server.close();
    }
  });

  it('streams ACP image tool failures as run error events', async () => {
    const projectRoot = createTempRoot('axhub-ai-runs-image-error-');
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-runs-image-error', name: 'AI Runs Image Error' },
    });
    const acp = await startAcpRunTestServer({
      streamEvents: [
        {
          type: 'tool-output-error',
          toolCallId: 'tool-call-image-1',
          toolName: 'generate_image',
          errorText: 'image tool failed',
        },
        { type: 'finish', finishReason: 'error' },
      ],
    });
    const server = await startRegisteredTestServer(projectRoot, acp);

    try {
      const response = await fetch(`${server.origin}/api/ai/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene: 'image',
          prompt: '生成失败图',
          params: { n: 1 },
        }),
      });
      const events = await collectRunEvents(response);

      expect(response.status).toBe(200);
      expect(events.at(-1)).toMatchObject({
        event: 'run.error',
        data: {
          status: 'error',
          error: 'image tool failed',
          code: 'ACP_CHAT_TOOL_OUTPUT_ERROR',
        },
      });
    } finally {
      await server.close();
    }
  });
});
