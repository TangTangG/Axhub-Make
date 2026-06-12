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
