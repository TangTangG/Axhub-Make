import type { GenieProvider as AcpPromptProvider } from '../../../common/genie/types';
import type { ContextBundleV2 } from '@axhub/acp/runtime';
import { getGenerationArtifactHistoryStore } from '../ai-generation/generationArtifactHistoryStore';

export type PrototypeGenerationAgentStage =
  | 'accepted'
  | 'running'
  | 'activity'
  | 'completed'
  | 'error';

export interface PrototypeGenerationArtifact {
  id?: string;
  kind?: 'prototype' | 'image' | 'document' | 'file' | 'link' | string;
  operation?: 'created' | 'updated' | string;
  target?: Record<string, unknown>;
  source?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface PrototypeGenerationAgentEvent {
  stage: PrototypeGenerationAgentStage;
  message?: string;
  sessionId?: string;
  artifact?: PrototypeGenerationArtifact;
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
  model?: string | null;
  mode?: string | null;
  thought?: string | null;
  contextBundle?: ContextBundleV2 | null;
}

export interface RunAcpPrototypeAgentOptions extends PrototypeGenerationPromptOptions {
  provider: AcpPromptProvider;
  onEvent?: (event: PrototypeGenerationAgentEvent) => void;
}

export interface RunAcpPrototypeAgentResult {
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
  const hasRequestedCount = typeof settings?.count === 'number' && Number.isFinite(settings.count);
  const requestedCount = hasRequestedCount
    ? Math.max(1, Math.min(4, Math.round(Number(settings.count))))
    : null;
  const theme = settings?.theme?.name
    ? `${settings.theme.name}${settings.theme.displayName && settings.theme.displayName !== settings.theme.name ? ` (${settings.theme.displayName})` : ''}`
    : '';
  const targetPrototypeName = currentPrototype?.name || derivePrototypeIdFromCanvasPath(canvasFilePath);
  const targetPrototypeDirectory = targetPrototypeName ? `src/prototypes/${targetPrototypeName}/` : 'unknown';
  const explicitScopeLines = [
    requestedCount == null ? '' : `- 数量：${requestedCount}（当前 prototype 下页面/方案数）`,
    theme ? `- 设计系统：${theme}` : '',
  ].filter(Boolean);

  return [
    '你正在为 Axhub Make 当前项目生成/更新 prototype 原型资源；这是一次非交互式任务：用户无法补充信息，不要追问用户，直接完成。',
    '跳过浏览器验证；不要运行 `check-app-ready.mjs`。',
    '',
    `用户需求：${prompt}`,
    '',
    '原型生成范围：',
    `- 只在当前 prototype 中新增/更新页面；目标目录：${targetPrototypeDirectory}`,
    ...explicitScopeLines,
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
  preferredPromptClient: AcpPromptProvider;
  referenceImages?: string[];
  settings?: PrototypeGenerationSettings;
  model?: string | null;
  modeId?: string | null;
  thoughtLevel?: string | null;
  contextBundle?: ContextBundleV2 | null;
  onEvent?: (event: PrototypeGenerationAgentEvent) => void;
}) {
  const { onEvent, ...requestPayload } = payload;
  const response = await fetch('/api/ai/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scene: 'prototype',
      ...requestPayload,
    }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const code = typeof result?.code === 'string' && result.code ? ` (${result.code})` : '';
    throw Object.assign(new Error(`${result?.error || '自动执行失败'}${code}`), {
      result,
    });
  }
  return readPrototypeAiRunResponse(response, onEvent);
}

function parseAiRunSseEvent(rawEvent: string): Array<{ event: string; data: Record<string, unknown> }> {
  const lines = rawEvent
    .split(/\r?\n/u)
    .map((line) => line.trimEnd());
  const event = lines
    .find((line) => line.startsWith('event:'))
    ?.slice('event:'.length)
    .trim() || 'message';
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim());
  if (!dataLines.length) return [];
  const dataText = dataLines.join('\n').trim();
  if (!dataText || dataText === '[DONE]') return [];
  const data = JSON.parse(dataText);
  return data && typeof data === 'object' && !Array.isArray(data)
    ? [{ event, data: data as Record<string, unknown> }]
    : [];
}

async function readPrototypeAiRunResponse(
  response: Response,
  onEvent?: (event: PrototypeGenerationAgentEvent) => void,
): Promise<Record<string, unknown>> {
  if (!response.body) {
    throw new Error('AI run response body 不可读取');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accepted: Record<string, unknown> = {};
  let completed: Record<string, unknown> = {};

  const handleRawEvent = (rawEvent: string) => {
    for (const event of parseAiRunSseEvent(rawEvent)) {
      if (event.event === 'run.accepted') {
        accepted = event.data;
      } else if (event.event === 'run.completed') {
        completed = event.data;
        if (Array.isArray(event.data.artifacts)) {
          event.data.artifacts.forEach((artifact) => {
            getGenerationArtifactHistoryStore().upsertArtifact(artifact, { status: 'done' });
          });
        }
      } else if (event.event === 'artifact.created' || event.event === 'artifact.updated') {
        const artifact = event.data.artifact && typeof event.data.artifact === 'object' && !Array.isArray(event.data.artifact)
          ? event.data.artifact as PrototypeGenerationArtifact
          : undefined;
        if (artifact) {
          getGenerationArtifactHistoryStore().upsertArtifact(artifact, { status: 'running' });
        }
        onEvent?.({
          stage: 'activity',
          message: event.event,
          ...(artifact ? { artifact } : {}),
        });
      } else if (event.event === 'run.error') {
        throw Object.assign(new Error(String(event.data.error || '自动执行失败')), {
          result: event.data,
        });
      }
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (;;) {
      const match = /\r?\n\r?\n/u.exec(buffer);
      if (!match || match.index === undefined) break;
      const rawEvent = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      handleRawEvent(rawEvent);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    handleRawEvent(buffer);
  }
  return {
    ...accepted,
    ...completed,
    sessionId: String(completed.threadId || accepted.threadId || ''),
    runId: String(completed.runId || accepted.runId || ''),
  };
}

export async function runAcpPrototypeAgent(options: RunAcpPrototypeAgentOptions): Promise<RunAcpPrototypeAgentResult> {
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
      model: options.model,
      modeId: options.mode,
      thoughtLevel: options.thought,
      contextBundle: options.contextBundle,
      onEvent: options.onEvent,
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
