import { describe, expect, it } from 'vitest';

import {
  appendCanvasGenerationPromptSettings,
  appendDocumentStartPromptSettings,
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
    expect(prompt).toContain('- 方案数量：3 个');
    expect(prompt).toContain('加载本地 explore-options（多方案探索）技能提示');
    expect(prompt).toContain('生成 3 个真实不同的可行原型方案');
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
    expect(prompt).toContain('- 方案数量：2 个');
    expect(prompt).toContain('生成 2 个真实不同的可行原型方案');
    expect(prompt).toContain('- 设计系统：linear');
    expect(prompt).not.toContain('画布协作说明');
    expect(prompt).not.toContain('canvas-workspace');
    expect(prompt).not.toContain('当前文件就是画布文件地址');
  });

  it('appends requirements exploration guidance for prototype start settings only when enabled', () => {
    const prompt = appendPrototypeStartPromptSettings({
      prompt: '做一个会员增长工作台',
      settings: {
        needsRequirementsAnalysis: true,
      },
    });

    expect(prompt).toContain('原型生成设置');
    expect(prompt).toContain('使用 $requirements-exploration 对当前需求做探索和完善');
    expect(prompt).toContain('先补齐目标用户、核心任务、范围、关键流程和验收口径');
    expect(prompt).not.toContain('画布协作说明');

    const defaultPrompt = appendPrototypeStartPromptSettings({
      prompt: '做一个会员增长工作台',
      settings: {},
    });

    expect(defaultPrompt).toBe('做一个会员增长工作台');
    expect(defaultPrompt).not.toContain('$requirements-exploration');
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
    expect(prompt).toContain('- 方案数量：2 个');
    expect(prompt).toContain('生成 2 个真实不同的可行设计方案');
    expect(prompt).toContain('- 格式：png');
    expect(prompt).not.toContain('画布协作说明');
    expect(prompt).not.toContain('canvas-workspace');
  });

  it('appends document start format and selected template path without inlining template content', () => {
    const prompt = appendDocumentStartPromptSettings({
      prompt: '写一份会员增长 PRD',
      settings: {
        format: 'html',
        templateName: 'write-prd.md',
      },
    });

    expect(prompt).toContain('写一份会员增长 PRD');
    expect(prompt).toContain('文档生成设置');
    expect(prompt).toContain('- 文档格式：HTML');
    expect(prompt).toContain('- 文档模板：resources/templates/write-prd.md');
    expect(prompt).not.toContain('请按以下模板组织内容');
    expect(prompt).not.toContain('# PRD 模板');
    expect(prompt).not.toContain('## 验收标准');
    expect(prompt).not.toContain('画布协作说明');
    expect(prompt).not.toContain('canvas-workspace');
  });

  it('appends selected HTML visual spec skill and requirements exploration guidance for document starts', () => {
    const prompt = appendDocumentStartPromptSettings({
      prompt: '写一份会员增长 PRD',
      settings: {
        format: 'html',
        htmlVisualSpec: {
          label: 'Guizang · 瑞士国际主义',
          description: '网格、直角色块、发丝线、高饱和锚点色，适合事实、产品、分析和方法论。',
          themeInstruction: '使用 guizang-ppt-skill 的 Style B 瑞士国际主义：网格、直角色块、发丝线和高饱和锚点色。',
          skillName: 'guizang-ppt-skill',
          githubUrl: 'https://github.com/op7418/guizang-ppt-skill',
        },
        needsRequirementsAnalysis: true,
      },
    });

    expect(prompt).toContain('文档生成设置');
    expect(prompt).toContain('- 文档格式：HTML');
    expect(prompt).toContain('- HTML 视觉主题：Guizang · 瑞士国际主义。网格、直角色块、发丝线、高饱和锚点色，适合事实、产品、分析和方法论。使用技能 guizang-ppt-skill（https://github.com/op7418/guizang-ppt-skill，若已安装可忽略；若未安装，请在线读取该 GitHub 技能说明）。使用 guizang-ppt-skill 的 Style B 瑞士国际主义：网格、直角色块、发丝线和高饱和锚点色。');
    expect(prompt).toContain('使用 $requirements-exploration 对当前需求做探索和完善');
    expect(prompt).toContain('先补齐目标用户、核心任务、范围、关键流程和验收口径');
    expect(prompt).not.toContain('画布协作说明');
  });

  it('omits HTML visual spec guidance for non-HTML document formats', () => {
    const prompt = appendDocumentStartPromptSettings({
      prompt: '整理需求',
      settings: {
        format: 'md',
        htmlVisualSpec: {
          label: 'Kami',
          skillName: 'kami',
          githubUrl: 'https://github.com/tw93/kami',
        },
      },
    });

    expect(prompt).toContain('- 文档格式：Markdown');
    expect(prompt).not.toContain('HTML 视觉规范');
    expect(prompt).not.toContain('https://github.com/tw93/kami');
  });

  it('keeps document template settings visible for md even when the template content is empty', () => {
    const prompt = appendDocumentStartPromptSettings({
      prompt: '整理需求',
      settings: {
        format: 'md',
        templateName: 'write-prd.md',
      },
    });

    expect(prompt).toContain('文档生成设置');
    expect(prompt).toContain('- 文档格式：Markdown');
    expect(prompt).toContain('- 文档模板：resources/templates/write-prd.md');
    expect(prompt).not.toContain('请按以下模板组织内容');
  });

  it('omits document start settings when format and template are empty', () => {
    const prompt = appendDocumentStartPromptSettings({
      prompt: '整理需求',
      settings: {},
    });

    expect(prompt).toBe('整理需求');
    expect(prompt).not.toContain('文档生成设置');
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
    expect(prompt).not.toContain('- 方案数量：1 个');
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
    expect(prompt).toContain('- 方案数量：3 个');
    expect(prompt).toContain('生成 3 个真实不同的可行设计方案');
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
