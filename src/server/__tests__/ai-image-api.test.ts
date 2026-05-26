import path from 'node:path';
import fs from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  startTestServer,
  writeJson,
  writeProjectMetadata,
} from './projects-api.helpers';

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjectApiTestRoots();
});

describe('AI image generation API', () => {
  it('persists image generation history under the prototype .spec directory without base64 in JSON', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-image-history', name: 'AI Image History' },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
    });
    const server = await startTestServer(projectRoot);

    try {
      const put = await fetch(`${server.origin}/api/ai-image/history?targetPath=prototypes/home`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: [{
            id: 'task-one',
            prompt: '一张产品主视觉',
            params: { size: '1024x1024', quality: 'high', output_format: 'png', output_compression: null, moderation: 'auto', n: 1 },
            status: 'done',
            stage: 'done',
            error: null,
            createdAt: 1000,
            finishedAt: 2000,
            elapsed: 1000,
            outputImages: ['img-one'],
            rawResponsePayload: '{"data":[{"b64_json":"should-not-persist"}]}',
          }],
          images: {
            'img-one': {
              id: 'img-one',
              dataUrl: 'data:image/png;base64,aGVsbG8=',
              width: 1024,
              height: 1024,
              createdAt: 1000,
              source: 'generated',
            },
          },
        }),
      });
      const putBody = await put.json();

      expect(put.status).toBe(200);
      expect(putBody.tasks).toHaveLength(1);
      expect(putBody.tasks[0].rawResponsePayload).toBeUndefined();
      expect(putBody.images['img-one']).toMatchObject({
        id: 'img-one',
        assetPath: 'ai-image-assets/img-one.png',
        dataUrl: 'data:image/png;base64,aGVsbG8=',
      });

      const historyPath = path.join(projectRoot, 'src/prototypes/home/.spec/ai-image-history.json');
      const stored = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      expect(JSON.stringify(stored)).not.toContain('base64');
      expect(JSON.stringify(stored)).not.toContain('aGVsbG8=');
      expect(stored.tasks[0]).not.toHaveProperty('rawResponsePayload');
      expect(stored.images['img-one']).toMatchObject({
        assetPath: 'ai-image-assets/img-one.png',
        mimeType: 'image/png',
      });
      expect(fs.readFileSync(path.join(projectRoot, 'src/prototypes/home/.spec/ai-image-assets/img-one.png'), 'utf8')).toBe('hello');

      const get = await fetch(`${server.origin}/api/ai-image/history?targetPath=prototypes/home`);
      const getBody = await get.json();
      expect(get.status).toBe(200);
      expect(getBody.images['img-one'].dataUrl).toBe('data:image/png;base64,aGVsbG8=');
    } finally {
      await server.close();
    }
  });

  it('persists unified generation state and stores reference assets outside JSON', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-generation-state', name: 'AI Generation State' },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
    });
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/ai-image/history?targetPath=prototypes/home`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: [{
            id: 'task-with-ref',
            prompt: '参考这张图重新生成',
            params: { size: '1024x1024', quality: 'high', output_format: 'png', output_compression: null, moderation: 'auto', n: 1 },
            status: 'running',
            stage: 'generating',
            error: null,
            createdAt: 1000,
            finishedAt: null,
            elapsed: null,
            outputImages: [],
            conversationId: 'conversation-one',
            roundId: 'round-one',
            sourcePrompt: '按本地上下文生成主视觉',
            localContextRefs: [{
              resourceType: 'prototype',
              resourceId: 'home',
              title: 'Home',
              paths: [
                'src/prototypes/home/index.tsx',
                '../outside.ts',
              ],
            }, {
              resourceType: 'theme',
              resourceId: 'quiet-saas',
              paths: [
                'src/themes/quiet-saas/DESIGN.md',
                '/absolute/path.ts',
                'src/themes/quiet-saas/index.ts',
              ],
            }],
            referenceImages: ['data:image/png;base64,cmVmLW9uZQ=='],
          }],
          imageConversations: [{
            id: 'conversation-one',
            title: '产品图对话',
            rounds: [{
              id: 'round-one',
              prompt: '参考这张图重新生成',
              outputTaskIds: ['task-with-ref'],
              status: 'running',
              createdAt: 1000,
            }],
            messages: [{
              id: 'message-one',
              role: 'user',
              content: '参考这张图重新生成',
              roundId: 'round-one',
              sourcePrompt: '按本地上下文生成主视觉',
              localContextRefs: [{
                resourceType: 'prototype',
                resourceId: 'home',
                paths: ['src/prototypes/home/index.ts'],
              }],
              referenceAssetRefs: [{
                id: 'ref-message-one',
                dataUrl: 'data:image/png;base64,cmVmLXR3bw==',
              }],
              createdAt: 1000,
            }],
          }],
          prototypeSessions: [{
            prototypeId: 'home',
            generatorElementId: 'prototype-generator-1',
            acpxSessionName: 'axhub-ai-generation-state-home',
            lastRun: {
              runId: 'prototype-task-1',
              status: 'running',
              stage: 'running',
              prompt: '生成当前原型',
              createdAt: 1200,
            },
          }],
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.tasks[0]).toMatchObject({
        id: 'task-with-ref',
        conversationId: 'conversation-one',
        roundId: 'round-one',
      });
      expect(body.tasks[0].sourcePrompt).toBe('按本地上下文生成主视觉');
      expect(body.tasks[0].localContextRefs).toEqual([
        {
          resourceType: 'prototype',
          resourceId: 'home',
          title: 'Home',
          paths: ['src/prototypes/home/index.tsx'],
        },
        {
          resourceType: 'theme',
          resourceId: 'quiet-saas',
          paths: [
            'src/themes/quiet-saas/DESIGN.md',
            'src/themes/quiet-saas/index.ts',
          ],
        },
      ]);
      expect(body.imageConversations[0].messages[0].localContextRefs).toEqual([{
        resourceType: 'prototype',
        resourceId: 'home',
        paths: ['src/prototypes/home/index.ts'],
      }]);
      expect(body.tasks[0].referenceImages).toBeUndefined();
      expect(body.tasks[0].referenceAssetRefs).toHaveLength(1);
      expect(body.tasks[0].referenceAssetRefs[0].assetPath).toMatch(/^generation-assets\/refs\/.+\.png$/u);
      expect(body.imageConversations[0].messages[0].referenceAssetRefs[0].assetPath).toMatch(/^generation-assets\/refs\/.+\.png$/u);
      expect(body.prototypeSessions[0]).toMatchObject({
        prototypeId: 'home',
        generatorElementId: 'prototype-generator-1',
        acpxSessionName: 'axhub-ai-generation-state-home',
      });

      const historyPath = path.join(projectRoot, 'src/prototypes/home/.spec/ai-image-history.json');
      const stored = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      const storedJson = JSON.stringify(stored);
      expect(stored.schemaVersion).toBe(2);
      expect(storedJson).not.toContain('cmVmLW9uZQ==');
      expect(storedJson).not.toContain('cmVmLXR3bw==');
      expect(storedJson).not.toContain('../outside.ts');
      expect(storedJson).not.toContain('/absolute/path.ts');
      expect(stored.tasks[0].sourcePrompt).toBe('按本地上下文生成主视觉');
      expect(stored.tasks[0].localContextRefs).toEqual(body.tasks[0].localContextRefs);
      expect(fs.existsSync(path.join(projectRoot, 'src/prototypes/home/.spec', body.tasks[0].referenceAssetRefs[0].assetPath))).toBe(true);
      expect(fs.existsSync(path.join(projectRoot, 'src/prototypes/home/.spec', body.imageConversations[0].messages[0].referenceAssetRefs[0].assetPath))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('preserves omitted generation state sections when updating only image history fields', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-generation-state-merge', name: 'AI Generation State Merge' },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
    });
    const server = await startTestServer(projectRoot);

    try {
      await fetch(`${server.origin}/api/ai-image/history?targetPath=prototypes/home`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prototypeTasks: [{
            id: 'prototype-task-one',
            prompt: '生成原型',
            status: 'done',
            stage: 'done',
            error: null,
            createdAt: 1000,
            finishedAt: 1200,
            elapsed: 200,
            provider: 'codex',
            acpxSessionName: 'axhub-ai-generation-state-merge-home',
            runId: 'prototype-task-one',
            recoverable: true,
          }],
          prototypeSessions: [{
            prototypeId: 'home',
            generatorElementId: 'generator-1',
            acpxSessionName: 'axhub-ai-generation-state-merge-home',
            lastRun: {
              runId: 'prototype-task-one',
              status: 'done',
            },
          }],
          imageConversations: [{
            id: 'conversation-one',
            title: '对话上下文',
            rounds: [],
            messages: [],
          }],
        }),
      });

      const update = await fetch(`${server.origin}/api/ai-image/history?targetPath=prototypes/home`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: [{
            id: 'image-task-one',
            prompt: '生成图片',
            params: { size: '1024x1024', quality: 'high', output_format: 'png', output_compression: null, moderation: 'auto', n: 1 },
            status: 'done',
            stage: 'done',
            error: null,
            createdAt: 1300,
            finishedAt: 1600,
            elapsed: 300,
            outputImages: [],
          }],
          images: {},
        }),
      });
      const body = await update.json();

      expect(update.status).toBe(200);
      expect(body.tasks[0]?.id).toBe('image-task-one');
      expect(body.prototypeTasks[0]?.id).toBe('prototype-task-one');
      expect(body.prototypeSessions[0]).toMatchObject({
        prototypeId: 'home',
        generatorElementId: 'generator-1',
        acpxSessionName: 'axhub-ai-generation-state-merge-home',
      });
      expect(body.imageConversations[0]?.id).toBe('conversation-one');
    } finally {
      await server.close();
    }
  });

  it('keeps only the latest 30 generation history records across image and prototype tasks and removes orphaned assets', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-image-history-limit', name: 'AI Image History Limit' },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
    });
    const server = await startTestServer(projectRoot);

    try {
      const tasks = Array.from({ length: 18 }, (_, index) => ({
        id: `task-${index}`,
        prompt: `提示词 ${index}`,
        params: { size: '1024x1024', quality: 'high', output_format: 'png', output_compression: null, moderation: 'auto', n: 1 },
        status: 'done',
        stage: 'done',
        error: null,
        createdAt: index,
        finishedAt: index + 1,
        elapsed: 1,
        outputImages: [`img-${index}`],
      }));
      const prototypeTasks = Array.from({ length: 18 }, (_, index) => ({
        id: `proto-task-${index}`,
        prompt: `原型提示词 ${index}`,
        status: 'done',
        stage: 'done',
        error: null,
        createdAt: index + 18,
        finishedAt: index + 19,
        elapsed: 1,
        provider: 'codex',
        outputPrototypeName: `prototype-${index}`,
      }));
      const images = Object.fromEntries(tasks.map((task, index) => [task.outputImages[0], {
        id: task.outputImages[0],
        dataUrl: `data:image/png;base64,${Buffer.from(`image-${index}`).toString('base64')}`,
        width: 100,
        height: 100,
        createdAt: index,
        source: 'generated',
      }]));

      const response = await fetch(`${server.origin}/api/ai-image/history?targetPath=prototypes/home`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, prototypeTasks, images }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.limit).toBe(30);
      expect(body.tasks).toHaveLength(12);
      expect(body.prototypeTasks).toHaveLength(18);
      expect(body.records).toHaveLength(30);
      expect(body.records.map((record: any) => record.id)).toEqual([
        ...Array.from({ length: 18 }, (_, offset) => `proto-task-${17 - offset}`),
        ...Array.from({ length: 12 }, (_, offset) => `task-${17 - offset}`),
      ]);
      expect(body.images['img-0']).toBeUndefined();
      expect(body.images['img-5']).toBeUndefined();
      expect(fs.existsSync(path.join(projectRoot, 'src/prototypes/home/.spec/ai-image-assets/img-0.png'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, 'src/prototypes/home/.spec/ai-image-assets/img-5.png'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, 'src/prototypes/home/.spec/ai-image-assets/img-17.png'))).toBe(true);

      const stored = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/prototypes/home/.spec/ai-image-history.json'), 'utf8'));
      expect(stored.tasks).toHaveLength(12);
      expect(stored.prototypeTasks).toHaveLength(18);
      expect(stored.records).toHaveLength(30);
    } finally {
      await server.close();
    }
  });

  it('rejects unsafe or non-prototype image generation history target paths', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-image-history-invalid', name: 'AI Image History Invalid' },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'src/prototypes' },
      },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
    });
    const server = await startTestServer(projectRoot);

    try {
      const escaped = await fetch(`${server.origin}/api/ai-image/history?targetPath=${encodeURIComponent('prototypes/../home')}`);
      const hidden = await fetch(`${server.origin}/api/ai-image/history?targetPath=prototypes/.hidden`);
      const nonPrototype = await fetch(`${server.origin}/api/ai-image/history?targetPath=components/home`);

      expect(escaped.status).toBe(403);
      expect(hidden.status).toBe(400);
      expect(nonPrototype.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it('requires an API key before submitting image generation requests', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-image-no-key', name: 'AI Image No Key' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
    });
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/ai-image/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: '一张产品主视觉',
          params: { n: 1 },
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('API Key');
    } finally {
      await server.close();
    }
  });

  it('submits OpenAI-compatible image requests and normalizes returned b64 images', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-image-success', name: 'AI Image Success' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
    });
    const registryHome = createTempRoot('axhub-ai-image-home-');
    const server = await startTestServer(projectRoot, registryHome);
    const originalFetch = globalThis.fetch.bind(globalThis);
    let upstreamFetch: ReturnType<typeof vi.spyOn> | null = null;

    try {
      await fetch(`${server.origin}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai: {
            imageGeneration: {
              baseUrl: 'https://images.example.com/v1',
              apiKey: 'sk-test',
              model: 'gpt-image-2',
              apiMode: 'images',
              responseFormatB64Json: true,
              size: '1024x1024',
              quality: 'high',
              outputFormat: 'png',
              n: 2,
            },
          },
        }),
      });

      upstreamFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        if (String(input).startsWith(server.origin)) {
          return originalFetch(input, init);
        }
        expect(String(input)).toBe('https://images.example.com/v1/images/generations');
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
        const requestBody = JSON.parse(String(init?.body));
        expect(requestBody).toMatchObject({
          model: 'gpt-image-2',
          prompt: '一张产品主视觉',
          size: '1024x1024',
          quality: 'high',
          output_format: 'png',
          response_format: 'b64_json',
          n: 2,
        });
        return new Response(JSON.stringify({
          data: [
            { b64_json: 'aGVsbG8=', revised_prompt: '产品主视觉 1' },
            { b64_json: 'd29ybGQ=', revised_prompt: '产品主视觉 2' },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const response = await fetch(`${server.origin}/api/ai-image/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: '一张产品主视觉',
          params: {
            size: '1024x1024',
            quality: 'high',
            output_format: 'png',
            n: 2,
          },
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.images).toEqual([
        'data:image/png;base64,aGVsbG8=',
        'data:image/png;base64,d29ybGQ=',
      ]);
      expect(body.revisedPrompts).toEqual(['产品主视觉 1', '产品主视觉 2']);
      expect(body.rawResponsePayload).toContain('"b64_json": "<base64_data>"');
      expect(body.rawResponsePayload).not.toContain('aGVsbG8=');
      const upstreamCalls = upstreamFetch.mock.calls.filter(([input]) => !String(input).startsWith(server.origin));
      expect(upstreamCalls).toHaveLength(1);
    } finally {
      upstreamFetch?.mockRestore();
      await server.close();
    }
  });

  it('forwards reference images to the OpenAI-compatible request body', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-image-reference', name: 'AI Image Reference' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
    });
    const registryHome = createTempRoot('axhub-ai-image-reference-home-');
    const server = await startTestServer(projectRoot, registryHome);
    const originalFetch = globalThis.fetch.bind(globalThis);
    let upstreamFetch: ReturnType<typeof vi.spyOn> | null = null;

    try {
      await fetch(`${server.origin}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai: {
            imageGeneration: {
              baseUrl: 'https://images.example.com/v1',
              apiKey: 'sk-test',
              model: 'gpt-image-2',
              apiMode: 'images',
              responseFormatB64Json: true,
            },
          },
        }),
      });

      upstreamFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        if (String(input).startsWith(server.origin)) {
          return originalFetch(input, init);
        }
        const requestBody = JSON.parse(String(init?.body));
        expect(requestBody.reference_images).toEqual([
          'data:image/png;base64,ref-one',
          'data:image/png;base64,ref-two',
        ]);
        return new Response(JSON.stringify({
          data: [{ b64_json: 'ZG9uZQ==' }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const response = await fetch(`${server.origin}/api/ai-image/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: '按参考图生成',
          referenceImages: [
            'data:image/png;base64,ref-one',
            'data:image/png;base64,ref-two',
          ],
          params: { n: 1 },
        }),
      });

      expect(response.status).toBe(200);
    } finally {
      upstreamFetch?.mockRestore();
      await server.close();
    }
  });

  it('splits Codex CLI compatible image generation into concurrent single-image requests without rewriting the prompt', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-image-codex-cli', name: 'AI Image Codex CLI' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
    });
    const registryHome = createTempRoot('axhub-ai-image-codex-home-');
    const server = await startTestServer(projectRoot, registryHome);
    const originalFetch = globalThis.fetch.bind(globalThis);
    let upstreamFetch: ReturnType<typeof vi.spyOn> | null = null;

    try {
      await fetch(`${server.origin}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai: {
            imageGeneration: {
              baseUrl: 'https://images.example.com/v1',
              apiKey: 'sk-test',
              model: 'gpt-image-2',
              apiMode: 'images',
              codexCli: true,
              responseFormatB64Json: true,
            },
          },
        }),
      });

      upstreamFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        if (String(input).startsWith(server.origin)) {
          return originalFetch(input, init);
        }
        const requestBody = JSON.parse(String(init?.body));
        expect(requestBody).toMatchObject({
          model: 'gpt-image-2',
          prompt: '一张产品主视觉',
          size: '1024x1024',
          output_format: 'png',
          response_format: 'b64_json',
        });
        expect(requestBody).not.toHaveProperty('quality');
        expect(requestBody).not.toHaveProperty('n');
        return new Response(JSON.stringify({
          size: '1024x1024',
          output_format: 'png',
          data: [{ b64_json: 'aW1hZ2U=' }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const response = await fetch(`${server.origin}/api/ai-image/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: '一张产品主视觉',
          params: {
            size: '1024x1024',
            quality: 'high',
            output_format: 'png',
            n: 3,
          },
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.images).toHaveLength(3);
      expect(body.actualParams).toMatchObject({ size: '1024x1024', output_format: 'png', n: 3 });
      expect(body.actualParamsList).toHaveLength(3);
      expect(body.actualParamsList[0]).toMatchObject({ size: '1024x1024', output_format: 'png' });
      const upstreamCalls = upstreamFetch.mock.calls.filter(([input]) => !String(input).startsWith(server.origin));
      expect(upstreamCalls).toHaveLength(3);
    } finally {
      upstreamFetch?.mockRestore();
      await server.close();
    }
  });

  it('adds the prompt rewrite guard only when prompt optimization is disabled for an image request', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'ai-image-disable-prompt-optimization', name: 'AI Image Disable Prompt Optimization' },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
    });
    const registryHome = createTempRoot('axhub-ai-image-disable-prompt-optimization-home-');
    const server = await startTestServer(projectRoot, registryHome);
    const originalFetch = globalThis.fetch.bind(globalThis);
    let upstreamFetch: ReturnType<typeof vi.spyOn> | null = null;

    try {
      await fetch(`${server.origin}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai: {
            imageGeneration: {
              baseUrl: 'https://images.example.com/v1',
              apiKey: 'sk-test',
              model: 'gpt-image-2',
              apiMode: 'images',
              codexCli: false,
              responseFormatB64Json: true,
            },
          },
        }),
      });

      upstreamFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        if (String(input).startsWith(server.origin)) {
          return originalFetch(input, init);
        }
        const requestBody = JSON.parse(String(init?.body));
        expect(requestBody.prompt).toBe('Use the following text as the complete prompt. Do not rewrite it:\n一张产品主视觉');
        expect(requestBody.quality).toBe('high');
        return new Response(JSON.stringify({
          data: [{ b64_json: 'aW1hZ2U=' }],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const response = await fetch(`${server.origin}/api/ai-image/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: '一张产品主视觉',
          params: {
            size: '1024x1024',
            quality: 'high',
            output_format: 'png',
            n: 1,
            disable_prompt_optimization: true,
          },
        }),
      });

      expect(response.status).toBe(200);
      const upstreamCalls = upstreamFetch.mock.calls.filter(([input]) => !String(input).startsWith(server.origin));
      expect(upstreamCalls).toHaveLength(1);
    } finally {
      upstreamFetch?.mockRestore();
      await server.close();
    }
  });
});
