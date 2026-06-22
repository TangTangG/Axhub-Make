import type { CanvasAiScene } from '../shared/CanvasGenerationComposer';

export interface CanvasPrototypePromptSettings {
  count?: number;
  themeName?: string;
  needsRequirementsAnalysis?: boolean;
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

export type CanvasDocumentFormat = 'html' | 'md' | 'mermaid' | 'drawio';

export interface CanvasHtmlVisualSpecPromptSetting {
  label?: string;
  description?: string;
  themeInstruction?: string;
  skillName: string;
  githubUrl: string;
}

export interface CanvasDocumentPromptSettings {
  format?: CanvasDocumentFormat;
  htmlVisualSpec?: CanvasHtmlVisualSpecPromptSetting;
  templateName?: string;
  needsRequirementsAnalysis?: boolean;
}

export type CanvasGenerationPromptSettings =
  | CanvasPrototypePromptSettings
  | CanvasDocumentPromptSettings
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

function trimSentenceEnd(value: string): string {
  return value.replace(/[。.!！?？]+$/u, '');
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

function formatDocumentFormat(format: CanvasDocumentFormat | undefined): string {
  if (format === 'html') return 'HTML';
  if (format === 'md') return 'Markdown';
  if (format === 'mermaid') return 'Mermaid 图表';
  if (format === 'drawio') return 'Drawio 图表';
  return '';
}

function formatRequirementsAnalysisInstruction(enabled?: boolean): string {
  return enabled
    ? '- 需求分析：使用 $requirements-exploration 对当前需求做探索和完善，先补齐目标用户、核心任务、范围、关键流程和验收口径。'
    : '';
}

function formatMultiOptionInstruction(count: number | null, kind: 'prototype' | 'design'): string {
  if (count == null) return '';
  const target = kind === 'prototype'
    ? `生成 ${count} 个真实不同的可行原型方案`
    : `生成 ${count} 个真实不同的可行设计方案`;
  return `- 多方案提示：用户选择了方案数量，请加载本地 explore-options（多方案探索）技能提示，${target}。`;
}

function formatHtmlVisualSpecInstruction(
  format: CanvasDocumentFormat | undefined,
  htmlVisualSpec: CanvasHtmlVisualSpecPromptSetting | undefined,
): string {
  if (format !== 'html' || !htmlVisualSpec) return '';
  const label = typeof htmlVisualSpec.label === 'string' ? htmlVisualSpec.label.trim() : '';
  const description = typeof htmlVisualSpec.description === 'string' ? htmlVisualSpec.description.trim() : '';
  const themeInstruction = typeof htmlVisualSpec.themeInstruction === 'string' ? htmlVisualSpec.themeInstruction.trim() : '';
  const skillName = typeof htmlVisualSpec.skillName === 'string' ? htmlVisualSpec.skillName.trim() : '';
  const githubUrl = typeof htmlVisualSpec.githubUrl === 'string' ? htmlVisualSpec.githubUrl.trim() : '';
  if (!skillName || !githubUrl) return '';
  const topic = label
    ? `${label}${description ? `。${trimSentenceEnd(description)}` : ''}`
    : '未命名主题';
  const skillInstruction = `使用技能 ${skillName}（${githubUrl}，若已安装可忽略；若未安装，请在线读取该 GitHub 技能说明）`;
  const themeSentence = themeInstruction ? `。${trimSentenceEnd(themeInstruction)}。` : '。';
  return `- HTML 视觉主题：${topic}。${skillInstruction}${themeSentence}`;
}

function formatDocumentTemplatePath(templateName: string): string {
  const normalizedName = templateName.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return normalizedName ? `resources/templates/${normalizedName}` : '';
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
      '- 将本次生成的原型页面、图片、流程图、文档等产物落到当前画布；每个产物节点的 customData.generatedBy 必须为 `axhub-ai-generation`，customData.aiArtifact.kind 必须写明产物类型。',
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
    count == null ? '' : `- 方案数量：${count} 个`,
    formatMultiOptionInstruction(count, 'prototype'),
    isSpecifiedValue(settings.themeName) ? `- 设计系统：${formatOptionalValue(settings.themeName)}` : '',
    formatRequirementsAnalysisInstruction(settings.needsRequirementsAnalysis),
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
    count == null ? '' : `- 方案数量：${count} 个`,
    formatMultiOptionInstruction(count, 'design'),
    isSpecifiedValue(settings.output_format) ? `- 格式：${formatOptionalValue(settings.output_format)}` : '',
    isSpecifiedValue(settings.themeName) ? `- 设计系统：${formatOptionalValue(settings.themeName)}` : '',
    ...(settings.disable_prompt_optimization ? ['- 禁止优化提示词：请不要改写用户输入的提示词，直接按原始提示词生成图片。'] : []),
    ...(settings.output_format === 'png' && settings.background === 'transparent' ? ['- 背景：transparent'] : []),
  ]);
}

export function appendDocumentStartPromptSettings({
  prompt,
  settings,
}: {
  prompt: string;
  settings: CanvasDocumentPromptSettings;
}): string {
  const formatLabel = formatDocumentFormat(settings.format);
  const templateName = typeof settings.templateName === 'string' ? settings.templateName.trim() : '';
  const templatePath = formatDocumentTemplatePath(templateName);
  return appendSettingsBlock(prompt, '文档生成设置：', [
    formatLabel ? `- 文档格式：${formatLabel}` : '',
    formatHtmlVisualSpecInstruction(settings.format, settings.htmlVisualSpec),
    templatePath ? `- 文档模板：${templatePath}` : '',
    formatRequirementsAnalysisInstruction(settings.needsRequirementsAnalysis),
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

    if (scene === 'document') {
      return appendDocumentStartPromptSettings({
        prompt,
        settings,
      });
    }

    return prompt;
  })();

  return appendCanvasWorkspaceInstruction(promptWithSettings, canvasContext);
}
