import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildPrototypeGenerationPrompt,
  runGeniePrototypeAgent,
} from './genieAgentClient';

const originalFetch = globalThis.fetch;

describe('Genie prototype agent client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('builds a concise prompt that asks the acpx agent to update pages and canvas in the current prototype', () => {
    const prompt = buildPrototypeGenerationPrompt({
      prompt: '做一个 CRM 工作台',
      canvasFilePath: 'src/prototypes/dashboard/canvas.excalidraw',
      canvasName: 'prototypes/dashboard/canvas',
      generatorElementId: 'generator-1',
      currentPrototype: {
        name: 'dashboard',
        displayName: '管理工作台',
        pages: [
          { id: 'overview', title: '总览' },
        ],
        defaultPageId: 'overview',
      },
      knownPrototypes: [
        {
          name: 'dashboard',
          displayName: '管理工作台',
          pages: [
            { id: 'overview', title: '总览' },
          ],
          defaultPageId: 'overview',
        },
        { name: 'settings', displayName: '设置' },
      ],
      settings: {
        count: 3,
        theme: { name: 'linear', displayName: 'Linear' },
      },
    });

    expect(prompt.split('\n')).toHaveLength(28);
    expect(prompt).toContain('做一个 CRM 工作台');
    expect(prompt).toContain('只在当前 prototype 中新增/更新页面');
    expect(prompt).toContain('src/prototypes/dashboard/');
    expect(prompt).toContain('数量：3（当前 prototype 下页面/方案数）');
    expect(prompt).not.toContain('距离目标文件最近的 README/rules');
    expect(prompt).not.toContain('读取 `.axhub/make/project.json`');
    expect(prompt).not.toContain('读取 `.axhub/make/axhub.config.json`');
    expect(prompt).not.toContain('按项目 metadata 和写入能力修改文件');
    expect(prompt).not.toContain('按 Axhub Make Engine 的项目写入约束修改文件');
    expect(prompt).not.toContain('当前目标 prototype');
    expect(prompt).not.toContain('不要创建新的 prototype 目录');
    expect(prompt).not.toContain('无目标原型：创建一个新的 prototype 资源');
    expect(prompt).not.toContain('在当前项目内生成，不创建独立项目');
    expect(prompt).not.toContain('必须在当前 prototype 目录下创建或更新页面');
    expect(prompt).not.toContain('生成数量表示当前 prototype 下的页面/方案数量');
    expect(prompt).not.toContain('新生成的 prototype embeddable 节点应设置');
    expect(prompt).toContain('这是一次非交互式任务');
    expect(prompt).toContain('不要追问用户');
    expect(prompt).toContain('跳过浏览器验证');
    expect(prompt).toContain('不要运行 `check-app-ready.mjs`');
    expect(prompt).toContain('src/prototypes/dashboard/canvas.excalidraw');
    expect(prompt).not.toContain('canvasName: prototypes/dashboard/canvas');
    expect(prompt).toContain('generator-1');
    expect(prompt).toContain('当前 prototype');
    expect(prompt).toContain('dashboard');
    expect(prompt).toContain('overview');
    expect(prompt).not.toContain('生成数量：3');
    expect(prompt).toContain('设计系统：linear (Linear)');
    expect(prompt).toContain('更新 `canvas.excalidraw`');
    expect(prompt).toContain('找到 `generatorElementId` 对应的原型生成占位节点');
    expect(prompt).toContain('embeddable');
    expect(prompt).toContain('customData.embedViewMode 设置为 `preview`');
    expect(prompt).toContain('不要使用 Make 管理端首页 deep link');
    expect(prompt).toContain('不要把网页内部布局做小');
    expect(prompt).toContain('embedContentScale');
    expect(prompt).toContain('720x450');
    expect(prompt).toContain('1440x900');
    expect(prompt).toContain('captureScreenshotOnMount');
    expect(prompt).toContain('保留画布既有元素、files、appState');
    expect(prompt).not.toContain('完成后的刷新');
    expect(prompt).not.toContain('暂时不要执行 `axhub-make canvas refresh');
    expect(prompt).not.toContain('不执行 `axhub-make canvas refresh');
    expect(prompt).not.toContain('宿主应用会负责后续刷新');
    expect(prompt).not.toContain('最后执行 `axhub-make canvas refresh');
    expect(prompt).toContain('最终消息：已完成');
    expect(prompt).not.toContain('/api/prompt/execute');
  });

  it('runs the prototype prompt through the session-run API instead of a websocket agent', async () => {
    const events: string[] = [];
    const websocketCtor = vi.fn();
    vi.stubGlobal('WebSocket', websocketCtor);
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      scene: 'canvas-prototype-generation',
      provider: 'codex',
      command: 'npx acpx@latest --approve-all codex "..."',
      output: 'created prototype',
      sessionId: 'axhub-project-home',
      runId: 'prototype-task-one',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as any;

    const result = await runGeniePrototypeAgent({
      provider: 'codex',
      prompt: '生成 CRM 原型',
      canvasFilePath: 'src/prototypes/home/canvas.excalidraw',
      generatorElementId: 'generator-1',
      onEvent: (event) => events.push(event.stage),
    });

    expect(result).toEqual({
      status: 'done',
      sessionId: 'axhub-project-home',
      runId: 'prototype-task-one',
    });
    expect(events).toEqual(['accepted', 'running', 'running', 'completed']);
    expect(websocketCtor).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/prototype-generation/session-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.any(String),
    });
    const requestBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      targetPath: 'prototypes/home',
      generatorElementId: 'generator-1',
      preferredPromptClient: 'codex',
    });
    expect(requestBody.prompt).toContain('生成 CRM 原型');
    expect(requestBody.prompt).toContain('只在当前 prototype 中新增/更新页面');
    expect(requestBody.prompt).not.toContain('不要创建新的 prototype 目录');
    expect(requestBody.prompt).not.toContain('canvasName: prototypes/home/canvas');
    expect(requestBody.prompt).toContain('最终消息：已完成');
  });

  it('sends prototype reference images to the session-run API separately from the text prompt', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      scene: 'canvas-prototype-generation',
      provider: 'codex',
      output: 'created prototype',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as any;

    await runGeniePrototypeAgent({
      provider: 'codex',
      prompt: '按参考图生成原型',
      canvasFilePath: 'src/prototypes/home/canvas.excalidraw',
      generatorElementId: 'generator-1',
      referenceImages: ['data:image/png;base64,cmVm'],
    });

    const requestBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(requestBody.referenceImages).toEqual(['data:image/png;base64,cmVm']);
    expect(requestBody.prompt).toContain('按参考图生成原型');
    expect(requestBody.prompt).not.toContain('data:image/png;base64,cmVm');
  });

  it('derives the session-run targetPath from the current prototype when the canvas path is not canonical', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      sessionId: 'axhub-project-untitled-4',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as any;

    await runGeniePrototypeAgent({
      provider: 'codex',
      prompt: '生成官网首页',
      canvasFilePath: 'prototypes/untitled-4/canvas',
      generatorElementId: 'generator-1',
      currentPrototype: {
        name: 'untitled-4',
        displayName: '未命名',
      },
    });

    const requestBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      targetPath: 'prototypes/untitled-4',
      generatorElementId: 'generator-1',
    });
  });

  it('returns an error result when acpx prompt execution fails', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      error: 'acpx failed',
      code: 'PROMPT_EXECUTION_FAILED',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })) as any;

    const result = await runGeniePrototypeAgent({
      provider: 'codex',
      prompt: '生成失败案例',
      generatorElementId: 'generator-1',
    });

    expect(result).toMatchObject({
      status: 'error',
      error: 'acpx failed (PROMPT_EXECUTION_FAILED)',
    });
  });
});
