import type { CanvasAiScene } from '../shared/CanvasGenerationComposer';

export type CanvasAiArtifactKind = 'prototype' | 'image' | 'document';
export type CanvasAiSettingsRenderer = 'prototype' | 'image' | 'generic';
export type CanvasAiSubmitMode = 'assistant-chat' | 'canvas-generation';

export interface CanvasAiQuickPrompt {
  id: string;
  label: string;
  description?: string;
  prompt: string;
}

export interface CanvasAiSceneDefinition {
  id: CanvasAiScene;
  label: string;
  artifactKind: CanvasAiArtifactKind;
  placeholders: readonly string[];
  quickPrompts: readonly CanvasAiQuickPrompt[];
  prototypeStartPlaceholders?: readonly string[];
  prototypeStartQuickPrompts?: readonly CanvasAiQuickPrompt[];
  renderSettings: CanvasAiSettingsRenderer;
  submitMode: CanvasAiSubmitMode;
}

type LegacyCanvasAiSceneAlias = 'design' | 'image' | 'chart' | 'other';

const DESIGN_QUICK_PROMPTS = [
  {
    id: 'extract-icons',
    label: '提取图标',
    description: '按矩阵整理设计稿里的图标',
    prompt: '提取该 UI 设计稿中的图标，按矩阵格式使用工具生成一张新图片。',
  },
  {
    id: 'generate-wireframe',
    label: '生成草图',
    description: '保留布局，把图标和图片转为灰色占位',
    prompt: '把该 UI 设计稿中的图标和图片替换为同尺寸灰色占位图，保留文字、布局和其它视觉信息，不要整张图片变灰，使用工具生成一张新图片',
  },
  {
    id: 'generate-prototype',
    label: '生成原型',
    description: '按图片还原成可运行原型页面',
    prompt: '还原这张图片为原型页面，保留布局、文字、视觉层级和主要交互。',
  },
  {
    id: 'generate-responsive',
    label: '生成响应式',
    description: '补齐另外两个端的 UI 图片',
    prompt: '识别当前图片所属端，在 PC、平板、手机中补齐另外两个端的 UI 设计图，保持风格一致并生成新图片。',
  },
] as const satisfies readonly CanvasAiQuickPrompt[];

const DOCUMENT_QUICK_PROMPTS = [
  {
    id: 'requirements-exploration',
    label: '需求探索',
    description: '主动进入需求探索，完善目标、范围和验收口径',
    prompt: '使用 $requirements-exploration 对当前需求做探索和完善。我想要讨论的需求是：\n',
  },
  {
    id: 'drawio-diagram',
    label: '流程图和关系图',
    description: '生成 Draw.io .drawio.svg 图表',
    prompt: '使用 $drawio 生成相关流程图和关系图，结果请使用 Draw.io .drawio.svg 图表格式。',
  },
] as const satisfies readonly CanvasAiQuickPrompt[];

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
    quickPrompts: [],
    renderSettings: 'prototype',
    submitMode: 'assistant-chat',
  },
  {
    id: 'design',
    label: '设计图',
    artifactKind: 'image',
    placeholders: [
      '描述你想生成的 UI 设计图',
      '例如：生成一个移动端登录页设计图',
      '输入设计场景，AI 会帮你生成图片',
    ],
    quickPrompts: DESIGN_QUICK_PROMPTS,
    prototypeStartQuickPrompts: [],
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
    quickPrompts: DOCUMENT_QUICK_PROMPTS,
    prototypeStartPlaceholders: [
      '可以先通过文档、流程图或关系图等梳理需求，再生成原型',
    ],
    prototypeStartQuickPrompts: DOCUMENT_QUICK_PROMPTS,
    renderSettings: 'generic',
    submitMode: 'canvas-generation',
  },
] as const satisfies readonly CanvasAiSceneDefinition[];

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

export function getCanvasAiSceneQuickPrompts(scene: CanvasAiScene | LegacyCanvasAiSceneAlias): readonly CanvasAiQuickPrompt[] {
  return getCanvasAiSceneDefinition(scene).quickPrompts;
}

export function getCanvasAiPrototypeStartPlaceholders(scene: CanvasAiScene | LegacyCanvasAiSceneAlias): readonly string[] {
  const definition = getCanvasAiSceneDefinition(scene);
  return definition.prototypeStartPlaceholders ?? definition.placeholders;
}

export function getCanvasAiPrototypeStartQuickPrompts(scene: CanvasAiScene | LegacyCanvasAiSceneAlias): readonly CanvasAiQuickPrompt[] {
  const definition = getCanvasAiSceneDefinition(scene);
  return definition.prototypeStartQuickPrompts ?? definition.quickPrompts;
}

export function getCanvasAiPrototypeStartSystemPrompt(scene: CanvasAiScene | LegacyCanvasAiSceneAlias): string {
  const normalizedScene = getCanvasAiSceneDefinition(scene).id;
  if (normalizedScene === 'design') {
    return '使用内置工具生成图片；若无相关工具，请停止并告知用户。生成后请将结果更新到当前画布。';
  }
  if (normalizedScene === 'document') {
    return '请将结果更新到当前画布。';
  }
  return '请生成原型页面。';
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

export function appendCanvasAiQuickPrompt(currentText: string, quickPrompt: string): string {
  const textWithoutSlashTrigger = currentText.trimEnd().replace(/(?:^|\s)\/[^\s/]*$/u, '').trimEnd();
  return textWithoutSlashTrigger ? `${textWithoutSlashTrigger}\n\n${quickPrompt}` : quickPrompt;
}

export function appendCanvasAiPrototypeStartSystemPrompt(currentText: string, systemPrompt: string): string {
  const prompt = currentText.trim();
  const instruction = systemPrompt.trim();
  if (!instruction) return prompt;
  return prompt ? `${prompt}\n\n${instruction}` : instruction;
}
