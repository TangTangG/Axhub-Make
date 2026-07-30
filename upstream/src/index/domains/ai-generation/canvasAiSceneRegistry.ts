import type { CanvasAiScene } from '../shared/CanvasGenerationComposer';

export type CanvasAiStartKind = 'prototype' | 'resource' | 'design';
export type CanvasAiArtifactKind = 'prototype' | 'image' | 'document';
export type CanvasAiSettingsRenderer = 'prototype' | 'image' | 'generic';
export type CanvasAiSubmitMode = 'assistant-chat' | 'canvas-generation';

export interface CanvasAiSceneDefinition {
  id: CanvasAiScene;
  label: string;
  artifactKind: CanvasAiArtifactKind;
  placeholders: readonly string[];
  prototypeStartPlaceholders?: readonly string[];
  renderSettings: CanvasAiSettingsRenderer;
  submitMode: CanvasAiSubmitMode;
}

type LegacyCanvasAiSceneAlias = 'design' | 'image' | 'chart' | 'other';

export const CANVAS_AI_SCENES = [
  {
    id: 'page',
    label: '页面',
    artifactKind: 'prototype',
    placeholders: [
      '描述你想创建的页面或原型流程',
      '例如：做一个 CRM 工作台，包含数据概览和任务列表',
      '输入产品场景，AI 会帮你生成页面原型',
    ],
    renderSettings: 'prototype',
    submitMode: 'assistant-chat',
  },
  {
    id: 'design',
    label: '设计图',
    artifactKind: 'image',
    placeholders: [
      '描述你想生成的移动端或 PC 端设计图',
      '例如：生成一个移动端登录页设计图，或一个 PC 端数据看板设计图',
      '也可以生成海报、封面、边框、背景、头像等设计素材',
    ],
    renderSettings: 'generic',
    submitMode: 'canvas-generation',
  },
  {
    id: 'document',
    label: '文档',
    artifactKind: 'document',
    placeholders: [
      '生成 PRD、规格文档、流程图、关系图等相关文档',
      '例如：整理一份产品需求文档，包含目标、流程和验收标准',
      '输入文档、流程图或关系图需求，AI 会生成并同步到画布',
    ],
    prototypeStartPlaceholders: [
      '可以先通过文档、流程图或关系图等梳理需求，再生成原型',
    ],
    renderSettings: 'generic',
    submitMode: 'canvas-generation',
  },
] as const satisfies readonly CanvasAiSceneDefinition[];

const CANVAS_AI_START_PLACEHOLDERS = {
  prototype: {
    page: [
      '描述你要创建的原型页面',
      '例如：做一个 CRM 工作台原型，包含数据概览和任务列表',
      '输入产品场景，AI 会帮你创建可运行的原型页面',
    ],
  },
  resource: {
    design: [
      '描述你想生成的设计图资源',
      '例如：生成一个移动端登录页设计图资源',
      '也可以生成海报、封面、背景、头像等设计素材资源',
    ],
    document: [
      '描述你想生成的文档资源',
      '例如：整理一份 PRD 文档资源，包含目标、流程和验收标准',
      '也可以生成流程图、关系图、规格说明等资源文件',
    ],
  },
  design: {
    design: [
      '描述你想生成的设计规范或设计系统',
      '例如：生成一套后台管理系统设计规范，包含色彩、字体、组件和页面约束',
      '输入产品场景、品牌风格和组件要求，AI 会帮你生成设计系统',
    ],
  },
} as const satisfies Record<CanvasAiStartKind, Partial<Record<CanvasAiScene, readonly string[]>>>;

const CANVAS_AI_START_SYSTEM_PROMPTS = {
  prototype: {
    page: '请生成原型页面，并更新到当前画布。',
  },
  resource: {
    design: '请生成设计图资源，并更新到当前画布。',
    document: '请生成文档资源，并更新到当前画布。',
  },
  design: {
    design: '请生成设计规范或设计系统，并更新到当前画布。',
  },
} as const satisfies Record<CanvasAiStartKind, Partial<Record<CanvasAiScene, string>>>;

const SCENE_DEFINITION_BY_ID = new Map<CanvasAiScene, CanvasAiSceneDefinition>(
  CANVAS_AI_SCENES.map((scene) => [scene.id, scene]),
);

export const CANVAS_AI_SCENE_OPTIONS = CANVAS_AI_SCENES.map((scene) => ({
  value: scene.id,
  label: scene.label,
}));

export const CANVAS_AI_GENERATOR_NODE_SCENE_OPTIONS = CANVAS_AI_SCENE_OPTIONS
  .filter((option) => option.value !== 'design');

function normalizeSceneId(scene: unknown): CanvasAiScene {
  if (scene === 'page' || scene === 'design' || scene === 'document') {
    return scene;
  }
  if (scene === 'image') return 'design';
  if (scene === 'chart' || scene === 'other') return 'document';
  return 'page';
}

export function getCanvasAiSceneDefinition(scene: CanvasAiScene | LegacyCanvasAiSceneAlias): CanvasAiSceneDefinition {
  return SCENE_DEFINITION_BY_ID.get(normalizeSceneId(scene)) ?? CANVAS_AI_SCENES[0];
}

export function getCanvasAiSceneOptions(): Array<{ value: CanvasAiScene; label: string }> {
  return CANVAS_AI_SCENE_OPTIONS.map((option) => ({ ...option }));
}

export function getCanvasAiGeneratorNodeSceneOptions(): Array<{ value: CanvasAiScene; label: string }> {
  return CANVAS_AI_GENERATOR_NODE_SCENE_OPTIONS.map((option) => ({ ...option }));
}

export function getCanvasAiPrototypeStartPlaceholders(scene: CanvasAiScene | LegacyCanvasAiSceneAlias): readonly string[] {
  const definition = getCanvasAiSceneDefinition(scene);
  return definition.prototypeStartPlaceholders ?? definition.placeholders;
}

export function getCanvasAiStartPlaceholders(kind: CanvasAiStartKind, scene: CanvasAiScene | LegacyCanvasAiSceneAlias): readonly string[] {
  const normalizedScene = getCanvasAiSceneDefinition(scene).id;
  return CANVAS_AI_START_PLACEHOLDERS[kind]?.[normalizedScene] ?? getCanvasAiPrototypeStartPlaceholders(normalizedScene);
}

export function getCanvasAiPrototypeStartSystemPrompt(scene: CanvasAiScene | LegacyCanvasAiSceneAlias): string {
  const normalizedScene = getCanvasAiSceneDefinition(scene).id;
  if (normalizedScene === 'design') {
    return '请使用内置工具生成图片；若无相关工具，请停止并告知用户。生成后请更新到当前画布。';
  }
  if (normalizedScene === 'document') {
    return '请生成文档、流程图或关系图，并更新到当前画布。';
  }
  return '请生成原型页面，并更新到当前画布。';
}

export function getCanvasAiStartSystemPrompt(kind: CanvasAiStartKind, scene: CanvasAiScene | LegacyCanvasAiSceneAlias): string {
  const normalizedScene = getCanvasAiSceneDefinition(scene).id;
  return CANVAS_AI_START_SYSTEM_PROMPTS[kind]?.[normalizedScene] ?? getCanvasAiPrototypeStartSystemPrompt(normalizedScene);
}

export function stripCanvasUpdateInstruction(prompt: string): string {
  return prompt
    .replace(/生成后请(?:将结果)?更新到当前画布。?/gu, '')
    .replace(/，并更新到当前画布。?/gu, '。')
    .replace(/并更新到当前画布。?/gu, '')
    .replace(/请将结果更新到当前画布。?/gu, '')
    .trim();
}

function pickPlaceholder(placeholders: readonly string[]): string {
  const index = Math.min(placeholders.length - 1, Math.floor(Math.random() * placeholders.length));
  return placeholders[index] || '';
}

export function pickCanvasAiScenePlaceholder(scene: CanvasAiScene | LegacyCanvasAiSceneAlias): string {
  return pickPlaceholder(getCanvasAiSceneDefinition(scene).placeholders);
}

export function pickCanvasAiPrototypeStartPlaceholder(scene: CanvasAiScene | LegacyCanvasAiSceneAlias): string {
  return pickPlaceholder(getCanvasAiPrototypeStartPlaceholders(scene));
}

export function pickCanvasAiStartPlaceholder(kind: CanvasAiStartKind, scene: CanvasAiScene | LegacyCanvasAiSceneAlias): string {
  return pickPlaceholder(getCanvasAiStartPlaceholders(kind, scene));
}

export function appendCanvasAiPrototypeStartSystemPrompt(currentText: string, systemPrompt: string): string {
  const prompt = currentText.trim();
  const instruction = systemPrompt.trim();
  if (!instruction) return prompt;
  return prompt ? `${prompt}\n\n${instruction}` : instruction;
}
