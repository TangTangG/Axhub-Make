import type { CanvasAiScene } from '../shared/CanvasGenerationComposer';

export interface CanvasPrototypePromptSettings {
  count?: number;
  themeName?: string;
}

export interface CanvasImagePromptSettings {
  size?: string;
  quality?: string;
  n?: number;
  output_format?: string;
}

export type CanvasGenerationPromptSettings =
  | CanvasPrototypePromptSettings
  | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatOptionalValue(value: unknown, fallback = '未指定'): string {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function appendSettingsBlock(prompt: string, title: string, lines: string[]): string {
  const visibleLines = lines.filter((line) => line.trim().length > 0);
  if (!visibleLines.length) return prompt;
  if (prompt.includes(title)) return prompt;
  return [
    prompt.trim(),
    '',
    title,
    ...visibleLines,
  ].join('\n');
}

export function appendCanvasWorkspaceInstruction(prompt: string): string {
  return appendSettingsBlock(prompt, '画布协作说明：', [
    '请在完成生成任务后，再阅读 canvas-workspace 技能说明并更新当前画布。',
  ]);
}

export function appendPrototypeStartPromptSettings({
  prompt,
  settings,
}: {
  prompt: string;
  settings: CanvasPrototypePromptSettings;
}): string {
  const count = Math.max(1, Math.min(4, Math.round(Number(settings.count) || 1)));
  return appendSettingsBlock(prompt, '原型生成设置：', [
    `- 页面数量：${count} 个`,
    `- 设计系统：${formatOptionalValue(settings.themeName)}`,
  ]);
}

export function appendImageStartPromptSettings({
  prompt,
  settings,
}: {
  prompt: string;
  settings: CanvasImagePromptSettings;
}): string {
  const count = Math.max(1, Math.min(10, Math.round(Number(settings.n) || 1)));
  return appendSettingsBlock(prompt, '图片生成设置：', [
    `- 尺寸：${formatOptionalValue(settings.size, 'auto')}`,
    `- 质量：${formatOptionalValue(settings.quality, 'auto')}`,
    `- 图片数量：${count} 张`,
    `- 格式：${formatOptionalValue(settings.output_format, 'png')}`,
  ]);
}

export function appendCanvasGenerationPromptSettings({
  scene,
  prompt,
  settings,
}: {
  scene: CanvasAiScene;
  prompt: string;
  settings: CanvasGenerationPromptSettings;
}): string {
  const promptWithSettings = (() => {
    if (!isRecord(settings)) return prompt;

    if (scene === 'page') {
      return appendPrototypeStartPromptSettings({
        prompt,
        settings,
      });
    }

    return prompt;
  })();

  return appendCanvasWorkspaceInstruction(promptWithSettings);
}
