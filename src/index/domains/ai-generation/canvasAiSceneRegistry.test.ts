import { describe, expect, it, vi } from 'vitest';

import {
  CANVAS_AI_SCENES,
  appendCanvasAiQuickPrompt,
  getCanvasAiPrototypeStartPlaceholders,
  getCanvasAiPrototypeStartQuickPrompts,
  getCanvasAiPrototypeStartSystemPrompt,
  getCanvasAiSceneDefinition,
  getCanvasAiSceneOptions,
  getCanvasAiSceneQuickPrompts,
  pickCanvasAiPrototypeStartPlaceholder,
  pickCanvasAiScenePlaceholder,
} from './canvasAiSceneRegistry';

describe('canvas AI scene registry', () => {
  it('defines placeholder-start scene ids including the design image scene', () => {
    expect(CANVAS_AI_SCENES.map((scene) => scene.id)).toEqual([
      'page',
      'design',
      'document',
    ]);
    expect(getCanvasAiSceneOptions()).toEqual([
      { value: 'page', label: '页面' },
      { value: 'design', label: '设计图' },
      { value: 'document', label: '文档' },
    ]);
  });

  it('maps every scene to artifact kind, settings renderer, and submit mode', () => {
    expect(getCanvasAiSceneDefinition('page')).toMatchObject({
      label: '页面',
      artifactKind: 'prototype',
      renderSettings: 'prototype',
      submitMode: 'assistant-chat',
    });
    expect(getCanvasAiSceneDefinition('design')).toMatchObject({
      id: 'design',
      label: '设计图',
      artifactKind: 'image',
      renderSettings: 'generic',
      submitMode: 'canvas-generation',
    });
    expect(getCanvasAiSceneDefinition('document')).toMatchObject({
      artifactKind: 'document',
      renderSettings: 'generic',
      submitMode: 'canvas-generation',
    });
    expect(getCanvasAiSceneDefinition('chart' as any)).toMatchObject({
      id: 'document',
      label: '文档',
      artifactKind: 'document',
      renderSettings: 'generic',
      submitMode: 'canvas-generation',
    });
    expect(getCanvasAiSceneDefinition('other' as any)).toMatchObject({
      id: 'document',
      label: '文档',
    });
  });

  it('uses document placeholders for PRDs specs flowcharts and relationship diagrams', () => {
    const placeholders = getCanvasAiSceneDefinition('document').placeholders.join('\n');

    expect(placeholders).toContain('PRD');
    expect(placeholders).toContain('规格文档');
    expect(placeholders).toContain('流程图');
    expect(placeholders).toContain('关系图');
  });

  it('keeps multiple random placeholders per scene', () => {
    for (const scene of CANVAS_AI_SCENES) {
      expect(scene.placeholders.length).toBeGreaterThanOrEqual(2);
      expect(scene.placeholders.every((placeholder) => placeholder.trim().length > 0)).toBe(true);
    }

    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99);
    const placeholders = getCanvasAiSceneDefinition('page').placeholders;
    expect(pickCanvasAiScenePlaceholder('page')).toBe(placeholders[placeholders.length - 1]);
  });

  it('keeps design image quick prompts available from the placeholder-start scene option', () => {
    expect(CANVAS_AI_SCENES.map((scene) => scene.id)).toContain('design');
    expect(getCanvasAiSceneOptions().map((option) => option.value)).toContain('design');
    expect(getCanvasAiSceneQuickPrompts('design')).toEqual([
      expect.objectContaining({
        id: 'extract-icons',
        label: '提取图标',
        prompt: '提取该 UI 设计稿中的图标，按矩阵格式使用工具生成一张新图片。',
      }),
      expect.objectContaining({
        id: 'generate-wireframe',
        label: '生成草图',
      }),
    ]);
    expect(getCanvasAiSceneQuickPrompts('image')).toEqual(getCanvasAiSceneQuickPrompts('design'));
  });

  it('keeps prototype start prompts aligned with runtime document prompts and leaves design start without quick prompts', () => {
    expect(getCanvasAiPrototypeStartPlaceholders('page')).toEqual(getCanvasAiSceneDefinition('page').placeholders);

    expect(getCanvasAiPrototypeStartPlaceholders('design')).toEqual(getCanvasAiSceneDefinition('design').placeholders);
    expect(getCanvasAiPrototypeStartQuickPrompts('design')).toEqual([]);
    expect(getCanvasAiSceneQuickPrompts('design')).toHaveLength(2);

    expect(getCanvasAiPrototypeStartPlaceholders('document')).toEqual([
      '可以先通过文档、流程图或关系图等梳理需求，再生成原型',
    ]);
    expect(getCanvasAiPrototypeStartQuickPrompts('document')).toEqual([
      expect.objectContaining({
        id: 'requirements-exploration',
        label: '需求探索',
        prompt: '使用 $requirements-exploration 对当前需求做探索和完善。我想要讨论的需求是：\n',
      }),
      expect.objectContaining({
        id: 'drawio-diagram',
        label: '流程图和关系图',
      }),
    ]);
    expect(getCanvasAiPrototypeStartQuickPrompts('document')[1]?.prompt).toContain('Draw.io');
    expect(getCanvasAiPrototypeStartQuickPrompts('document')[1]?.prompt).toContain('流程图');
    expect(getCanvasAiPrototypeStartQuickPrompts('document')[1]?.prompt).toContain('关系图');
    expect(getCanvasAiPrototypeStartQuickPrompts('document')[1]?.prompt).toContain('Draw.io .drawio.svg 图表');
    expect(getCanvasAiPrototypeStartQuickPrompts('document')[1]?.prompt).toContain('$drawio');
    expect(getCanvasAiPrototypeStartQuickPrompts('document')[1]?.prompt).not.toContain('$canvas-workspace');
    expect(getCanvasAiPrototypeStartQuickPrompts('document')[1]?.prompt).not.toContain('当前原型草稿画布');
    expect(getCanvasAiPrototypeStartQuickPrompts('document')[1]?.prompt).not.toContain('节点');
    expect(getCanvasAiPrototypeStartQuickPrompts('document')[1]?.prompt).not.toBe('使用 Drawio 生成相关流程图和关系图。');
    expect(getCanvasAiSceneQuickPrompts('document')).toEqual(getCanvasAiPrototypeStartQuickPrompts('document'));
    expect(getCanvasAiPrototypeStartQuickPrompts('document')[0]?.prompt).not.toContain('$requirements-alignment');
  });

  it('provides short prototype-start system prompts per scene', () => {
    expect(getCanvasAiPrototypeStartSystemPrompt('page')).toBe('请生成原型页面。');
    expect(getCanvasAiPrototypeStartSystemPrompt('page')).not.toContain('当前原型草稿画布');
    expect(getCanvasAiPrototypeStartSystemPrompt('page')).not.toContain('画布');
    expect(getCanvasAiPrototypeStartSystemPrompt('design')).toContain('生成图片');
    expect(getCanvasAiPrototypeStartSystemPrompt('design')).not.toContain('生成原型');
    expect(getCanvasAiPrototypeStartSystemPrompt('design')).not.toContain('图片节点');
    expect(getCanvasAiPrototypeStartSystemPrompt('design')).not.toContain('画布');
    expect(getCanvasAiPrototypeStartSystemPrompt('document')).toContain('Markdown .md 文档');
    expect(getCanvasAiPrototypeStartSystemPrompt('document')).toContain('Draw.io .drawio.svg 图表');
    expect(getCanvasAiPrototypeStartSystemPrompt('document')).not.toContain('当前原型草稿画布');
    expect(getCanvasAiPrototypeStartSystemPrompt('document')).not.toContain('画布');
  });

  it('picks placeholders from prototype start overrides when they exist', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99);

    expect(pickCanvasAiPrototypeStartPlaceholder('design')).toBe(getCanvasAiSceneDefinition('design').placeholders.at(-1));
    expect(pickCanvasAiPrototypeStartPlaceholder('document')).toBe('可以先通过文档、流程图或关系图等梳理需求，再生成原型');
  });

  it('appends quick prompts into existing composer text', () => {
    expect(appendCanvasAiQuickPrompt('', '生成一张登录页')).toBe('生成一张登录页');
    expect(appendCanvasAiQuickPrompt('已有需求', '补充提示')).toBe('已有需求\n\n补充提示');
    expect(appendCanvasAiQuickPrompt('/', '提取图标')).toBe('提取图标');
    expect(appendCanvasAiQuickPrompt('参考图 /提取', '提取图标')).toBe('参考图\n\n提取图标');
  });
});
