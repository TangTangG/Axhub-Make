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
  background?: string;
  themeName?: string;
  disable_prompt_optimization?: boolean;
}

export type CanvasGenerationPromptSettings =
  | CanvasPrototypePromptSettings
  | undefined;

export interface CanvasGenerationPromptCanvasContext {
  canvasFilePath?: string;
  canvasName?: string;
  generatorElementId?: string;
  source?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatOptionalValue(value: unknown, fallback = '未指定'): string {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function isSpecifiedValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function isSpecifiedNonAutoValue(value: unknown): boolean {
  return isSpecifiedValue(value) && value !== 'auto';
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

function normalizeCanvasContextValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\\/g, '/') : '';
}

function deriveCanvasNameFromFilePath(filePath: string): string {
  const normalized = normalizeCanvasContextValue(filePath).replace(/^src\//u, '');
  return normalized.match(/^prototypes\/[^/]+\/canvas\.excalidraw$/u)
    ? normalized
    : '';
}

function formatCanvasWorkspaceInstructionLines(canvasContext?: CanvasGenerationPromptCanvasContext): string[] {
  const canvasFilePath = normalizeCanvasContextValue(canvasContext?.canvasFilePath);
  const canvasName = normalizeCanvasContextValue(canvasContext?.canvasName) || deriveCanvasNameFromFilePath(canvasFilePath);
  const generatorElementId = normalizeCanvasContextValue(canvasContext?.generatorElementId);
  const source = normalizeCanvasContextValue(canvasContext?.source);

  return [
    '请在完成生成任务后，再阅读 canvas-workspace 技能说明并更新当前画布。',
    ...(canvasFilePath ? [`- 当前画布文件：${canvasFilePath}`] : []),
    ...(canvasName ? [`- 当前画布名称：${canvasName}`] : []),
    ...(generatorElementId ? [`- 当前 AI 生成节点 ID：${generatorElementId}`] : []),
    ...(source ? [`- 触发来源：${source}`] : []),
    ...(canvasFilePath || canvasName || generatorElementId ? [
      '- 直接编辑并保存当前画布 JSON 文件，保留已有 elements、files、appState，不要只创建资源文件或只回复说明。',
      '- 将本次生成的 prototype、image、drawio、document 等产物落到当前画布；每个产物节点的 customData.generatedBy 必须为 `axhub-ai-generation`，customData.aiArtifact.kind 必须写明产物类型。',
      '- 如果画布里存在当前 AI 生成节点，优先在它附近替换或追加结果节点，并保留 sourceTaskId/sourceArtifactId 等可追踪字段。',
      '- 完成前必须重新读取画布文件，确认需要的产物节点已经写入并且 JSON 可解析。',
    ] : []),
  ];
}

export function appendCanvasWorkspaceInstruction(
  prompt: string,
  canvasContext?: CanvasGenerationPromptCanvasContext,
): string {
  return appendSettingsBlock(prompt, '画布协作说明：', [
    ...formatCanvasWorkspaceInstructionLines(canvasContext),
  ]);
}

export function appendPrototypeStartPromptSettings({
  prompt,
  settings,
}: {
  prompt: string;
  settings: CanvasPrototypePromptSettings;
}): string {
  const hasCount = typeof settings.count === 'number' && Number.isFinite(settings.count);
  const count = hasCount ? Math.max(1, Math.min(4, Math.round(Number(settings.count)))) : null;
  return appendSettingsBlock(prompt, '原型生成设置：', [
    count == null ? '' : `- 页面数量：${count} 个`,
    isSpecifiedValue(settings.themeName) ? `- 设计系统：${formatOptionalValue(settings.themeName)}` : '',
  ]);
}

export function appendImageStartPromptSettings({
  prompt,
  settings,
}: {
  prompt: string;
  settings: CanvasImagePromptSettings;
}): string {
  const hasCount = typeof settings.n === 'number' && Number.isFinite(settings.n);
  const count = hasCount ? Math.max(1, Math.min(10, Math.round(Number(settings.n)))) : null;
  return appendSettingsBlock(prompt, '图片生成设置：', [
    isSpecifiedNonAutoValue(settings.size) ? `- 尺寸：${formatOptionalValue(settings.size)}` : '',
    isSpecifiedNonAutoValue(settings.quality) ? `- 质量：${formatOptionalValue(settings.quality)}` : '',
    count == null ? '' : `- 图片数量：${count} 张`,
    isSpecifiedValue(settings.output_format) ? `- 格式：${formatOptionalValue(settings.output_format)}` : '',
    isSpecifiedValue(settings.themeName) ? `- 设计系统：${formatOptionalValue(settings.themeName)}` : '',
    ...(settings.disable_prompt_optimization ? ['- 禁止优化提示词：请不要改写用户输入的提示词，直接按原始提示词生成图片。'] : []),
    ...(settings.output_format === 'png' && settings.background === 'transparent' ? ['- 背景：transparent'] : []),
  ]);
}

export function appendCanvasGenerationPromptSettings({
  scene,
  prompt,
  settings,
  canvasContext,
}: {
  scene: CanvasAiScene;
  prompt: string;
  settings: CanvasGenerationPromptSettings;
  canvasContext?: CanvasGenerationPromptCanvasContext;
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

  return appendCanvasWorkspaceInstruction(promptWithSettings, canvasContext);
}
