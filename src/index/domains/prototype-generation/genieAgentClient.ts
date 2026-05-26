import type { GenieProvider } from '../../../common/genie/types';

export type PrototypeGenerationAgentStage =
  | 'accepted'
  | 'running'
  | 'activity'
  | 'completed'
  | 'error';

export interface PrototypeGenerationAgentEvent {
  stage: PrototypeGenerationAgentStage;
  message?: string;
  sessionId?: string;
}

export interface PrototypeGenerationPageContext {
  id: string;
  title: string;
}

export interface PrototypeGenerationPrototypeContext {
  name: string;
  displayName?: string;
  pages?: PrototypeGenerationPageContext[];
  defaultPageId?: string;
}

export interface PrototypeGenerationThemeContext {
  name: string;
  displayName?: string;
}

export interface PrototypeGenerationSettings {
  count?: number;
  theme?: PrototypeGenerationThemeContext | null;
}

export interface PrototypeGenerationPromptOptions {
  taskId?: string;
  prompt: string;
  canvasFilePath?: string;
  targetPath?: string;
  canvasName?: string;
  generatorElementId: string;
  currentPrototype?: PrototypeGenerationPrototypeContext | null;
  knownPrototypes?: PrototypeGenerationPrototypeContext[];
  referenceImages?: string[];
  settings?: PrototypeGenerationSettings;
}

export interface RunGeniePrototypeAgentOptions extends PrototypeGenerationPromptOptions {
  provider: GenieProvider;
  onEvent?: (event: PrototypeGenerationAgentEvent) => void;
}

export interface RunGeniePrototypeAgentResult {
  status: 'done' | 'error';
  error?: string;
  sessionId?: string;
  runId?: string;
}

function formatPrototypeContext(prototype: PrototypeGenerationPrototypeContext | null | undefined): string {
  if (!prototype?.name) return '- unknown';
  const pages = Array.isArray(prototype.pages) && prototype.pages.length > 0
    ? prototype.pages
      .map((page) => `${page.id}${page.title && page.title !== page.id ? `(${page.title})` : ''}`)
      .join(', ')
    : 'none';
  const title = prototype.displayName && prototype.displayName !== prototype.name
    ? `${prototype.name} (${prototype.displayName})`
    : prototype.name;
  return `- ${title}; pages: ${pages}; default: ${prototype.defaultPageId || 'none'}`;
}

function formatKnownPrototypes(prototypes: PrototypeGenerationPrototypeContext[] | undefined): string {
  if (!Array.isArray(prototypes) || prototypes.length === 0) {
    return '- none';
  }
  return prototypes
    .map((prototype) => {
      const pageIds = Array.isArray(prototype.pages) && prototype.pages.length > 0
        ? prototype.pages.map((page) => page.id).join(', ')
        : 'none';
      const title = prototype.displayName && prototype.displayName !== prototype.name
        ? `${prototype.name} (${prototype.displayName})`
        : prototype.name;
      return `- ${title}: ${pageIds}`;
    })
    .join('\n');
}

function derivePrototypeIdFromCanvasPath(canvasFilePath: string | undefined): string | null {
  const normalized = String(canvasFilePath || '').trim().replace(/\\/g, '/').replace(/^src\//, '');
  const match = normalized.match(/(?:^|\/)prototypes\/([^/]+)\/canvas(?:\.excalidraw)?$/u);
  return match?.[1] || null;
}

function deriveTargetPathFromCanvasPath(canvasFilePath: string | undefined): string | undefined {
  const prototypeId = derivePrototypeIdFromCanvasPath(canvasFilePath);
  return prototypeId ? `prototypes/${prototypeId}` : undefined;
}

export function buildPrototypeGenerationPrompt({
  prompt,
  canvasFilePath,
  generatorElementId,
  currentPrototype,
  knownPrototypes,
  settings,
}: PrototypeGenerationPromptOptions): string {
  const requestedCount = Math.max(1, Math.min(4, Math.round(Number(settings?.count) || 1)));
  const theme = settings?.theme?.name
    ? `${settings.theme.name}${settings.theme.displayName && settings.theme.displayName !== settings.theme.name ? ` (${settings.theme.displayName})` : ''}`
    : '未指定';
  const targetPrototypeName = currentPrototype?.name || derivePrototypeIdFromCanvasPath(canvasFilePath);
  const targetPrototypeDirectory = targetPrototypeName ? `src/prototypes/${targetPrototypeName}/` : 'unknown';

  return [
    '你正在为 Axhub Make 当前项目生成/更新 prototype 原型资源；这是一次非交互式任务：用户无法补充信息，不要追问用户，直接完成。',
    '跳过浏览器验证；不要运行 `check-app-ready.mjs`。',
    '',
    `用户需求：${prompt}`,
    '',
    '原型生成范围：',
    `- 只在当前 prototype 中新增/更新页面；目标目录：${targetPrototypeDirectory}`,
    `- 数量：${requestedCount}（当前 prototype 下页面/方案数）；设计系统：${theme}。`,
    '- 无页面时创建默认页面并补齐 metadata；不覆盖无关页面。',
    '- 原型 id 使用小写字母、数字和连字符；直接改文件生成可预览原型。',
    '',
    `画布上下文：canvasFilePath: ${canvasFilePath || 'unknown'}；generatorElementId: ${generatorElementId}`,
    '',
    '当前 prototype：',
    formatPrototypeContext(currentPrototype),
    '',
    '当前已知 prototypes：',
    formatKnownPrototypes(knownPrototypes),
    '',
    '画布更新要求：',
    '- 更新 `canvas.excalidraw`：保留画布既有元素、files、appState，确保 JSON 可解析。',
    '- 找到 `generatorElementId` 对应的原型生成占位节点，替换/删除它；用 prototype embeddable 节点承载生成页面，多页面/多方案时平铺并保持间距。',
    '- prototype embeddable 使用 runtime URL（如 `/prototypes/<prototypeId>` 或页面 URL），不要使用 Make 管理端首页 deep link。',
    '- 默认预览态：customData.embedViewMode 设置为 `preview`，previewKind=`web`，previewUrl/openUrl/link 可用；设置 captureScreenshotOnMount=true，不手写 screenshotUrl。',
    '- 节点约 720x450；customData.embedSizePreset=`desktop`、embedContentScale=0.5、storedPreviewSize={width:720,height:450}；不要把网页内部布局做小，网页仍按 1440x900 设计。',
    '',
    '最终消息：已完成',
  ].join('\n');
}

async function executePrototypeSessionRun(payload: {
  taskId?: string;
  targetPath?: string;
  generatorElementId: string;
  prompt: string;
  preferredPromptClient: GenieProvider;
  referenceImages?: string[];
  settings?: PrototypeGenerationSettings;
}) {
  const response = await fetch('/api/prototype-generation/session-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = typeof result?.code === 'string' && result.code ? ` (${result.code})` : '';
    throw Object.assign(new Error(`${result?.error || '自动执行失败'}${code}`), {
      result,
    });
  }
  return result;
}

export async function runGeniePrototypeAgent(options: RunGeniePrototypeAgentOptions): Promise<RunGeniePrototypeAgentResult> {
  try {
    options.onEvent?.({ stage: 'accepted' });
    options.onEvent?.({ stage: 'running' });
    const result = await executePrototypeSessionRun({
      taskId: options.taskId,
      targetPath: options.targetPath || deriveTargetPathFromCanvasPath(options.canvasFilePath),
      generatorElementId: options.generatorElementId,
      prompt: buildPrototypeGenerationPrompt(options),
      preferredPromptClient: options.provider,
      referenceImages: options.referenceImages,
      settings: options.settings,
    });
    if (result.sessionId) {
      options.onEvent?.({ stage: 'running', sessionId: result.sessionId });
    }
    options.onEvent?.({ stage: 'completed', sessionId: result.sessionId });
    return {
      status: 'done',
      ...(result.sessionId ? { sessionId: result.sessionId } : {}),
      ...(typeof result.runId === 'string' ? { runId: result.runId } : {}),
    };
  } catch (error: any) {
    const message = String(error?.message || '').trim() || 'AI 生成执行失败';
    options.onEvent?.({ stage: 'error', message });
    return {
      status: 'error',
      error: message,
    };
  }
}
