import { describe, expect, it, vi } from 'vitest';

import {
  CANVAS_AI_SCENES,
  getCanvasAiStartPlaceholders,
  getCanvasAiStartSystemPrompt,
  getCanvasAiPrototypeStartPlaceholders,
  getCanvasAiPrototypeStartSystemPrompt,
  getCanvasAiSceneDefinition,
  getCanvasAiSceneOptions,
  pickCanvasAiPrototypeStartPlaceholder,
  pickCanvasAiScenePlaceholder,
  stripCanvasUpdateInstruction,
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

  it('provides kind-specific start copy for prototype resource and design entry pages', () => {
    expect(getCanvasAiStartPlaceholders('prototype', 'page').join('\n')).toContain('创建的原型页面');
    expect(getCanvasAiStartSystemPrompt('prototype', 'page')).toBe('请生成原型页面，并更新到当前画布。');

    expect(getCanvasAiStartPlaceholders('resource', 'design').join('\n')).toContain('设计图资源');
    expect(getCanvasAiStartPlaceholders('resource', 'document').join('\n')).toContain('文档资源');
    expect(getCanvasAiStartSystemPrompt('resource', 'design')).toBe('请生成设计图资源，并更新到当前画布。');
    expect(getCanvasAiStartSystemPrompt('resource', 'document')).toBe('请生成文档资源，并更新到当前画布。');

    expect(getCanvasAiStartPlaceholders('design', 'design').join('\n')).toContain('设计规范或设计系统');
    expect(getCanvasAiStartPlaceholders('design', 'design').join('\n')).toContain('设计系统');
    expect(getCanvasAiStartSystemPrompt('design', 'design')).toBe('请生成设计规范或设计系统，并更新到当前画布。');
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

  it('does not expose canvas quick prompt presets', () => {
    const designPlaceholders = getCanvasAiSceneDefinition('design').placeholders.join('\n');

    expect(CANVAS_AI_SCENES.map((scene) => scene.id)).toContain('design');
    expect(getCanvasAiSceneOptions().map((option) => option.value)).toContain('design');
    expect(designPlaceholders).toContain('移动端或 PC 端设计图');
    expect(designPlaceholders).toContain('海报、封面、边框、背景、头像');
    expect(getCanvasAiSceneDefinition('design')).not.toHaveProperty('quickPrompts');
    expect(getCanvasAiSceneDefinition('document')).not.toHaveProperty('quickPrompts');
    expect(getCanvasAiSceneDefinition('image')).not.toHaveProperty('quickPrompts');
  });

  it('keeps prototype start placeholders aligned with runtime document placeholders', () => {
    expect(getCanvasAiPrototypeStartPlaceholders('page')).toEqual(getCanvasAiSceneDefinition('page').placeholders);

    expect(getCanvasAiPrototypeStartPlaceholders('design')).toEqual(getCanvasAiSceneDefinition('design').placeholders);
    expect(getCanvasAiSceneDefinition('design')).not.toHaveProperty('prototypeStartQuickPrompts');

    expect(getCanvasAiPrototypeStartPlaceholders('document')).toEqual([
      '可以先通过文档、流程图或关系图等梳理需求，再生成原型',
    ]);
    expect(getCanvasAiSceneDefinition('document')).not.toHaveProperty('prototypeStartQuickPrompts');
  });

  it('provides short prototype-start system prompts per scene', () => {
    expect(getCanvasAiPrototypeStartSystemPrompt('page')).toBe('请生成原型页面，并更新到当前画布。');
    expect(getCanvasAiPrototypeStartSystemPrompt('page')).not.toContain('当前原型草稿画布');
    expect(getCanvasAiPrototypeStartSystemPrompt('design')).toBe(
      '请使用内置工具生成图片；若无相关工具，请停止并告知用户。生成后请更新到当前画布。',
    );
    expect(getCanvasAiPrototypeStartSystemPrompt('design')).toContain('内置工具');
    expect(getCanvasAiPrototypeStartSystemPrompt('design')).toContain('停止并告知用户');
    expect(getCanvasAiPrototypeStartSystemPrompt('design')).not.toContain('生成原型');
    expect(getCanvasAiPrototypeStartSystemPrompt('design')).not.toContain('图片节点');
    expect(getCanvasAiPrototypeStartSystemPrompt('document')).toBe('请生成文档、流程图或关系图，并更新到当前画布。');
    expect(getCanvasAiPrototypeStartSystemPrompt('document')).not.toContain('Markdown .md 文档');
    expect(getCanvasAiPrototypeStartSystemPrompt('document')).not.toContain('Draw.io .drawio.svg 图表');
    expect(getCanvasAiPrototypeStartSystemPrompt('document')).not.toContain('当前原型草稿画布');
  });

  it('can strip canvas update instructions when copying prompts for local AI', () => {
    expect(stripCanvasUpdateInstruction(getCanvasAiPrototypeStartSystemPrompt('design'))).toBe(
      '请使用内置工具生成图片；若无相关工具，请停止并告知用户。',
    );
    expect(stripCanvasUpdateInstruction(getCanvasAiPrototypeStartSystemPrompt('document'))).toBe('请生成文档、流程图或关系图。');
    expect(stripCanvasUpdateInstruction(getCanvasAiPrototypeStartSystemPrompt('page'))).toBe('请生成原型页面。');
  });

  it('picks placeholders from prototype start overrides when they exist', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.99);

    expect(pickCanvasAiPrototypeStartPlaceholder('design')).toBe(getCanvasAiSceneDefinition('design').placeholders.at(-1));
    expect(pickCanvasAiPrototypeStartPlaceholder('document')).toBe('可以先通过文档、流程图或关系图等梳理需求，再生成原型');
  });

});
