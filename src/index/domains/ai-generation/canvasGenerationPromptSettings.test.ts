import { describe, expect, it } from 'vitest';

import {
  appendCanvasGenerationPromptSettings,
  appendImageStartPromptSettings,
  appendPrototypeStartPromptSettings,
} from './canvasGenerationPromptSettings';

describe('appendCanvasGenerationPromptSettings', () => {
  it('appends prototype settings to the submitted prompt', () => {
    const prompt = appendCanvasGenerationPromptSettings({
      scene: 'page',
      prompt: '做一个 CRM 工作台',
      settings: {
        count: 3,
        themeName: 'linear',
      },
    });

    expect(prompt).toContain('做一个 CRM 工作台');
    expect(prompt).toContain('原型生成设置');
    expect(prompt).toContain('- 页面数量：3 个');
    expect(prompt).toContain('- 设计系统：linear');
    expect(prompt).toContain('画布协作说明');
    expect(prompt).toContain('请在完成生成任务后，再阅读 canvas-workspace 技能说明并更新当前画布。');
    expect(prompt).not.toContain('当前文件就是画布文件地址');
    expect(prompt).not.toContain('任务开始时不需要先读取画布落入产物');
  });

  it('appends concrete canvas write requirements when runtime canvas context is provided', () => {
    const prompt = appendCanvasGenerationPromptSettings({
      scene: 'document',
      prompt: '请生成原型页面、图片、流程图、文档四类产物',
      settings: undefined,
      canvasContext: {
        canvasFilePath: 'src/prototypes/untitled-75/canvas.excalidraw',
        canvasName: 'prototypes/untitled-75/canvas.excalidraw',
        generatorElementId: 'ai-generation-1',
        source: 'canvas-node',
      },
    });

    expect(prompt).toContain('画布协作说明');
    expect(prompt).toContain('src/prototypes/untitled-75/canvas.excalidraw');
    expect(prompt).toContain('prototypes/untitled-75/canvas.excalidraw');
    expect(prompt).toContain('ai-generation-1');
    expect(prompt).toContain('直接编辑并保存当前画布 JSON 文件');
    expect(prompt).toContain('customData.generatedBy');
    expect(prompt).toContain('axhub-ai-generation');
    expect(prompt).toContain('原型页面、图片、流程图、文档等产物');
    expect(prompt).not.toContain('prototype、image、drawio、document');
    expect(prompt).toContain('完成前必须重新读取画布文件');
    expect(prompt).not.toContain('当前文件就是画布文件地址');
    expect(prompt).not.toContain('任务开始时不需要先读取画布落入产物');
  });

  it('appends prototype start settings without canvas workspace instructions', () => {
    const prompt = appendPrototypeStartPromptSettings({
      prompt: '做一个 CRM 工作台',
      settings: {
        count: 2,
        themeName: 'linear',
      },
    });

    expect(prompt).toContain('做一个 CRM 工作台');
    expect(prompt).toContain('原型生成设置');
    expect(prompt).toContain('- 页面数量：2 个');
    expect(prompt).toContain('- 设计系统：linear');
    expect(prompt).not.toContain('画布协作说明');
    expect(prompt).not.toContain('canvas-workspace');
    expect(prompt).not.toContain('当前文件就是画布文件地址');
  });

  it('appends image start settings without canvas workspace instructions', () => {
    const prompt = appendImageStartPromptSettings({
      prompt: '生成一张深色数据看板',
      settings: {
        size: '1536x1024',
        quality: 'high',
        n: 2,
        output_format: 'png',
      },
    });

    expect(prompt).toContain('生成一张深色数据看板');
    expect(prompt).toContain('图片生成设置');
    expect(prompt).toContain('- 尺寸：1536x1024');
    expect(prompt).toContain('- 质量：high');
    expect(prompt).toContain('- 图片数量：2 张');
    expect(prompt).toContain('- 格式：png');
    expect(prompt).not.toContain('画布协作说明');
    expect(prompt).not.toContain('canvas-workspace');
  });

  it('omits unspecified image settings and hides the image block when no explicit setting remains', () => {
    const prompt = appendImageStartPromptSettings({
      prompt: '生成一张默认站位图',
      settings: {
        size: 'auto',
        quality: 'auto',
      },
    });

    expect(prompt).toBe('生成一张默认站位图');
    expect(prompt).not.toContain('图片生成设置');
    expect(prompt).not.toContain('- 尺寸：auto');
    expect(prompt).not.toContain('- 质量：auto');
    expect(prompt).not.toContain('- 图片数量：1 张');
    expect(prompt).not.toContain('- 格式：png');
    expect(prompt).not.toContain('- 设计系统：未指定');
  });

  it('appends only explicitly specified image count and format settings', () => {
    const prompt = appendImageStartPromptSettings({
      prompt: '生成产品首屏图',
      settings: {
        size: 'auto',
        quality: 'auto',
        n: 3,
        output_format: 'webp',
      },
    });

    expect(prompt).toContain('图片生成设置');
    expect(prompt).toContain('- 图片数量：3 张');
    expect(prompt).toContain('- 格式：webp');
    expect(prompt).not.toContain('- 尺寸：auto');
    expect(prompt).not.toContain('- 质量：auto');
    expect(prompt).not.toContain('- 设计系统：未指定');
  });

  it('appends image start design system and prompt optimization guard settings', () => {
    const prompt = appendImageStartPromptSettings({
      prompt: '生成一张登录页设计图',
      settings: {
        themeName: 'linear',
        disable_prompt_optimization: true,
      },
    });

    expect(prompt).toContain('- 设计系统：linear');
    expect(prompt).toContain('- 禁止优化提示词：请不要改写用户输入的提示词，直接按原始提示词生成图片。');
  });

  it('appends transparent background only for PNG image start settings', () => {
    const transparentPrompt = appendImageStartPromptSettings({
      prompt: '生成透明图标',
      settings: {
        output_format: 'png',
        background: 'transparent',
      },
    });
    const jpegPrompt = appendImageStartPromptSettings({
      prompt: '生成普通图片',
      settings: {
        output_format: 'jpeg',
        background: 'transparent',
      },
    });

    expect(transparentPrompt).toContain('- 背景：transparent');
    expect(jpegPrompt).not.toContain('- 背景：transparent');
  });

  it('omits unspecified prototype settings and hides the prototype block when no explicit setting remains', () => {
    const prompt = appendPrototypeStartPromptSettings({
      prompt: '做一个 CRM 工作台',
      settings: {
        themeName: '',
      },
    });

    expect(prompt).toBe('做一个 CRM 工作台');
    expect(prompt).not.toContain('原型生成设置');
    expect(prompt).not.toContain('- 页面数量：1 个');
    expect(prompt).not.toContain('- 设计系统：未指定');
  });

  it('appends the shared canvas workspace instruction when the scene has no generation settings', () => {
    const prompt = appendCanvasGenerationPromptSettings({
      scene: 'document',
      prompt: '整理一份需求说明',
      settings: undefined,
    });

    expect(prompt).toContain('整理一份需求说明');
    expect(prompt).toContain('画布协作说明');
    expect(prompt).toContain('请在完成生成任务后，再阅读 canvas-workspace 技能说明并更新当前画布。');
    expect(prompt).not.toContain('图片、原型页面、Markdown/Draw.io 文档等相关产物完成后要落入或更新到当前画布');
    expect(prompt).not.toBe('整理一份需求说明');
  });
});
