import type { CanvasAiScene } from '../shared/CanvasGenerationComposer';

export const CANVAS_DIRECT_RUN_ANNOTATION_TASK_KIND = 'canvas-ai-direct';
export const CANVAS_DIRECT_RUN_OVERLAY_CARD_WIDTH = 480;
export const CANVAS_DIRECT_RUN_OVERLAY_CARD_HEIGHT = 360;
const CANVAS_DIRECT_RUN_OVERLAY_CARD_GAP = 32;
const CANVAS_DIRECT_RUN_TASK_BACKGROUND_COLOR = '#e5e7eb';
const CANVAS_DIRECT_RUN_TASK_STROKE_COLOR = '#94a3b8';
const CANVAS_DIRECT_RUN_TASK_STROKE_WIDTH = 1;
const CANVAS_DIRECT_RUN_TASK_LEGACY_CUSTOM_DATA_KEYS = [
  'previewUrl',
  'openUrl',
  'previewKind',
  'resourceType',
  'embedViewMode',
];

export type CanvasDirectRunOverlayTaskStatus = 'running' | 'failed' | 'aborted';

export interface CanvasDirectRunOverlayTaskDetails {
  prompt: string;
  context: string[];
  config: string[];
}

export interface CanvasDirectRunAnnotationTaskRef {
  kind: typeof CANVAS_DIRECT_RUN_ANNOTATION_TASK_KIND;
  status: CanvasDirectRunOverlayTaskStatus;
  statusTaskId: string;
  runId?: string | null;
  threadId?: string | null;
  conversationId?: string | null;
  provider?: string | null;
  updatedAt: string;
}

export interface CanvasDirectRunAnnotationTaskUpdate {
  status?: CanvasDirectRunOverlayTaskStatus;
  runId?: string | null;
  threadId?: string | null;
  conversationId?: string | null;
  provider?: string | null;
  error?: string | null;
  updatedAt?: string;
}

export interface CanvasDirectRunOverlayController {
  createStatusTask: (input: {
    prompt: string;
    scene: CanvasAiScene;
    details: CanvasDirectRunOverlayTaskDetails;
  }) => {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  updateStatusTaskRef: (statusTaskId: string, update: CanvasDirectRunAnnotationTaskUpdate) => boolean;
  removeStatusTask: (statusTaskId: string) => boolean;
  markStatusTaskFailed: (statusTaskId: string, error: string) => boolean;
  hasStatusTask: (statusTaskId: string) => boolean;
  registerStatusTaskStopped: (statusTaskId: string, handler: () => void) => () => void;
}

export interface CanvasDirectRunOverlayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasDirectRunOverlayPositionInput {
  elements: readonly any[];
  activeTaskBounds?: readonly CanvasDirectRunOverlayBounds[];
  preferredX: number;
  preferredY: number;
  width?: number;
  height?: number;
  gap?: number;
}

export function createCanvasDirectRunOverlayTaskId(options: {
  now?: () => number;
  random?: () => number;
} = {}): string {
  const now = Math.floor(Number(options.now?.() ?? Date.now()));
  const random = Math.max(0, Math.min(0.999999, Number(options.random?.() ?? Math.random())));
  return `canvas-direct-run-${now}-${Math.floor(random * 0xffffff).toString(36).padStart(4, '0')}`;
}

function getElementBounds(element: any): CanvasDirectRunOverlayBounds | null {
  if (!element || element.isDeleted) return null;
  const x = Number(element.x);
  const y = Number(element.y);
  const width = Math.max(1, Number(element.width || 0));
  const height = Math.max(1, Number(element.height || 0));
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  return { x, y, width, height };
}

function rectsOverlap(
  first: CanvasDirectRunOverlayBounds,
  second: CanvasDirectRunOverlayBounds,
  gap: number,
): boolean {
  return !(
    first.x + first.width + gap <= second.x
    || second.x + second.width + gap <= first.x
    || first.y + first.height + gap <= second.y
    || second.y + second.height + gap <= first.y
  );
}

function buildPlacementOffsets(maxRing: number): Array<{ dx: number; dy: number }> {
  const offsets: Array<{ dx: number; dy: number }> = [{ dx: 0, dy: 0 }];
  for (let ring = 1; ring <= maxRing; ring += 1) {
    offsets.push(
      { dx: 0, dy: ring },
      { dx: ring, dy: 0 },
      { dx: -ring, dy: 0 },
      { dx: 0, dy: -ring },
    );
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        if ((dx === 0 && Math.abs(dy) === ring) || (dy === 0 && Math.abs(dx) === ring)) continue;
        offsets.push({ dx, dy });
      }
    }
  }
  return offsets;
}

export function resolveCanvasDirectRunOverlayPosition(
  input: CanvasDirectRunOverlayPositionInput,
): { x: number; y: number } {
  const width = Math.max(1, Number(input.width || CANVAS_DIRECT_RUN_OVERLAY_CARD_WIDTH));
  const height = Math.max(1, Number(input.height || CANVAS_DIRECT_RUN_OVERLAY_CARD_HEIGHT));
  const gap = Math.max(0, Number(input.gap ?? CANVAS_DIRECT_RUN_OVERLAY_CARD_GAP));
  const occupiedBounds = [
    ...input.elements
      .map(getElementBounds)
      .filter((bounds): bounds is CanvasDirectRunOverlayBounds => Boolean(bounds)),
    ...(input.activeTaskBounds || []),
  ];
  const stepX = width + gap;
  const stepY = height + gap;
  for (const offset of buildPlacementOffsets(8)) {
    const candidate = {
      x: Math.round(input.preferredX + offset.dx * stepX),
      y: Math.round(input.preferredY + offset.dy * stepY),
      width,
      height,
    };
    if (!occupiedBounds.some((bounds) => rectsOverlap(candidate, bounds, gap))) {
      return { x: candidate.x, y: candidate.y };
    }
  }
  return {
    x: Math.round(input.preferredX),
    y: Math.round(input.preferredY + stepY),
  };
}

export function getCanvasDirectRunOverlaySceneLabel(scene: CanvasAiScene): string {
  if (scene === 'design') return '设计图';
  if (scene === 'document') return '文档';
  return '页面';
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toIsoString(value: Date | string | undefined): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return (value || new Date()).toISOString();
}

function randomInteger(random: () => number): number {
  return Math.floor(Math.max(0, Math.min(0.999999, random())) * 2147483647);
}

function hasOwn(value: unknown, key: string): boolean {
  return Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key));
}

function formatDetailSection(label: string, values: readonly string[]): string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return normalized.length ? [`${label}：`, ...normalized] : [];
}

function getStatusText(status: CanvasDirectRunOverlayTaskStatus, scene?: CanvasAiScene): string {
  if (status === 'failed') return '生成失败';
  if (status === 'aborted') return '已终止';
  return `AI 正在生成${scene ? getCanvasDirectRunOverlaySceneLabel(scene) : ''}`;
}

function buildRunInfo(ref: Partial<CanvasDirectRunAnnotationTaskRef>): string {
  const parts = [
    ref.provider ? `provider=${ref.provider}` : '',
    ref.runId ? `runId=${ref.runId}` : '',
    ref.threadId ? `threadId=${ref.threadId}` : '',
    ref.conversationId ? `conversationId=${ref.conversationId}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join('，') : '等待 AI 接受任务';
}

function upsertAnnotationLine(annotation: string, label: string, value: string): string {
  const nextLine = `${label}：${value}`;
  const lines = String(annotation || '').split(/\r?\n/u);
  const existingIndex = lines.findIndex((line) => line.startsWith(`${label}：`));
  if (existingIndex >= 0) {
    lines[existingIndex] = nextLine;
    return lines.join('\n');
  }
  const statusIndex = lines.findIndex((line) => line.startsWith('状态：'));
  lines.splice(statusIndex >= 0 ? statusIndex + 1 : 0, 0, nextLine);
  return lines.join('\n');
}

function readAnnotationLine(annotation: string, label: string): string {
  const prefix = `${label}：`;
  const line = String(annotation || '').split(/\r?\n/u).find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : '';
}

export function buildCanvasDirectRunAnnotationText(input: {
  id: string;
  prompt: string;
  scene: CanvasAiScene;
  details: CanvasDirectRunOverlayTaskDetails;
  taskRef?: Partial<CanvasDirectRunAnnotationTaskRef>;
  status?: CanvasDirectRunOverlayTaskStatus;
  error?: string | null;
}): string {
  const status = input.status || input.taskRef?.status || 'running';
  const prompt = normalizeText(input.details.prompt) || normalizeText(input.prompt);
  const lines = [
    `状态：${getStatusText(status, input.scene)}`,
    `任务 ID：${input.id}`,
    `类型：${getCanvasDirectRunOverlaySceneLabel(input.scene)}`,
    `运行信息：${buildRunInfo(input.taskRef || {})}`,
    ...(prompt ? [`提示词：${prompt}`] : []),
    ...formatDetailSection('上下文', input.details.context),
    ...formatDetailSection('配置', input.details.config),
    ...(status === 'failed' && input.error ? [`失败原因：${input.error}`] : []),
  ];
  return lines.join('\n');
}

export function createCanvasDirectRunAnnotationTaskElement(input: {
  id: string;
  prompt: string;
  scene: CanvasAiScene;
  details: CanvasDirectRunOverlayTaskDetails;
  x: number;
  y: number;
  width: number;
  height: number;
  now?: () => Date;
  random?: () => number;
}) {
  const now = toIsoString(input.now?.());
  const random = input.random || Math.random;
  const annotationTaskRef: CanvasDirectRunAnnotationTaskRef = {
    kind: CANVAS_DIRECT_RUN_ANNOTATION_TASK_KIND,
    status: 'running',
    statusTaskId: input.id,
    updatedAt: now,
  };
  return {
    id: input.id,
    type: 'rectangle' as const,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    angle: 0,
    strokeColor: CANVAS_DIRECT_RUN_TASK_STROKE_COLOR,
    backgroundColor: CANVAS_DIRECT_RUN_TASK_BACKGROUND_COLOR,
    fillStyle: 'solid',
    strokeWidth: CANVAS_DIRECT_RUN_TASK_STROKE_WIDTH,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: null,
    roundness: { type: 3 },
    seed: randomInteger(random),
    version: 1,
    versionNonce: randomInteger(random),
    isDeleted: false,
    boundElements: null,
    updated: Date.parse(now) || Date.now(),
    locked: false,
    customData: {
      title: getStatusText('running', input.scene),
      annotation: buildCanvasDirectRunAnnotationText({
        id: input.id,
        prompt: input.prompt,
        scene: input.scene,
        details: input.details,
        taskRef: annotationTaskRef,
      }),
      annotationUpdatedAt: now,
      annotationTaskRef,
    },
  };
}

export function getCanvasDirectRunAnnotationTaskRef(element: any): CanvasDirectRunAnnotationTaskRef | null {
  const ref = element?.customData?.annotationTaskRef;
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return null;
  if (ref.kind !== CANVAS_DIRECT_RUN_ANNOTATION_TASK_KIND) return null;
  const statusTaskId = normalizeText(ref.statusTaskId || element?.id);
  if (!statusTaskId) return null;
  const status = ref.status === 'failed' || ref.status === 'aborted' ? ref.status : 'running';
  return {
    kind: CANVAS_DIRECT_RUN_ANNOTATION_TASK_KIND,
    status,
    statusTaskId,
    runId: normalizeText(ref.runId) || null,
    threadId: normalizeText(ref.threadId) || null,
    conversationId: normalizeText(ref.conversationId) || null,
    provider: normalizeText(ref.provider) || null,
    updatedAt: normalizeText(ref.updatedAt) || new Date().toISOString(),
  };
}

export function isCanvasDirectRunAnnotationTaskElement(element: any): boolean {
  return Boolean(!element?.isDeleted && getCanvasDirectRunAnnotationTaskRef(element));
}

export function normalizeCanvasDirectRunAnnotationTaskElement(element: any) {
  const taskRef = getCanvasDirectRunAnnotationTaskRef(element);
  if (!taskRef || element?.isDeleted) return element;

  const legacyCustomDataKeys = CANVAS_DIRECT_RUN_TASK_LEGACY_CUSTOM_DATA_KEYS
    .filter((key) => hasOwn(element?.customData, key));
  const needsNormalization = element.type !== 'rectangle'
    || element.backgroundColor !== CANVAS_DIRECT_RUN_TASK_BACKGROUND_COLOR
    || element.strokeColor !== CANVAS_DIRECT_RUN_TASK_STROKE_COLOR
    || element.strokeWidth !== CANVAS_DIRECT_RUN_TASK_STROKE_WIDTH
    || hasOwn(element, 'link')
    || legacyCustomDataKeys.length > 0;

  if (!needsNormalization) return element;

  const nextCustomData = {
    ...(element.customData || {}),
    annotationTaskRef: taskRef,
  };
  for (const key of CANVAS_DIRECT_RUN_TASK_LEGACY_CUSTOM_DATA_KEYS) {
    delete nextCustomData[key];
  }

  const nextElement = {
    ...element,
    type: 'rectangle' as const,
    backgroundColor: CANVAS_DIRECT_RUN_TASK_BACKGROUND_COLOR,
    strokeColor: CANVAS_DIRECT_RUN_TASK_STROKE_COLOR,
    strokeWidth: CANVAS_DIRECT_RUN_TASK_STROKE_WIDTH,
    fillStyle: 'solid',
    strokeStyle: element.strokeStyle || 'solid',
    roughness: Number.isFinite(Number(element.roughness)) ? element.roughness : 1,
    customData: nextCustomData,
    version: (element.version || 0) + 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    updated: Date.now(),
  };
  delete nextElement.link;
  return nextElement;
}

export function normalizeCanvasDirectRunAnnotationTaskElements<T extends readonly any[]>(elements: T): T | any[] {
  let changed = false;
  const normalized = elements.map((element) => {
    const nextElement = normalizeCanvasDirectRunAnnotationTaskElement(element);
    if (nextElement !== element) changed = true;
    return nextElement;
  });
  return changed ? normalized : elements;
}

export function updateCanvasDirectRunAnnotationTaskElement(
  element: any,
  update: CanvasDirectRunAnnotationTaskUpdate,
) {
  const currentRef = getCanvasDirectRunAnnotationTaskRef(element);
  if (!currentRef) return element;
  const normalizedElement = normalizeCanvasDirectRunAnnotationTaskElement(element);
  const updatedAt = toIsoString(update.updatedAt);
  const nextRef: CanvasDirectRunAnnotationTaskRef = {
    ...currentRef,
    ...(update.status ? { status: update.status } : {}),
    ...(Object.prototype.hasOwnProperty.call(update, 'runId') ? { runId: normalizeText(update.runId) || null } : {}),
    ...(Object.prototype.hasOwnProperty.call(update, 'threadId') ? { threadId: normalizeText(update.threadId) || null } : {}),
    ...(Object.prototype.hasOwnProperty.call(update, 'conversationId') ? { conversationId: normalizeText(update.conversationId) || null } : {}),
    ...(Object.prototype.hasOwnProperty.call(update, 'provider') ? { provider: normalizeText(update.provider) || null } : {}),
    updatedAt,
  };
  let annotation = normalizeText(element?.customData?.annotation);
  const statusText = nextRef.status === 'running'
    ? readAnnotationLine(annotation, '状态') || normalizeText(element?.customData?.title) || getStatusText(nextRef.status)
    : getStatusText(nextRef.status);
  annotation = upsertAnnotationLine(annotation, '状态', statusText);
  annotation = upsertAnnotationLine(annotation, '运行信息', buildRunInfo(nextRef));
  if (nextRef.status === 'failed' && normalizeText(update.error)) {
    annotation = upsertAnnotationLine(annotation, '失败原因', normalizeText(update.error));
  }
  return {
    ...normalizedElement,
    version: (normalizedElement.version || 0) + 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    updated: Date.parse(updatedAt) || Date.now(),
    customData: {
      ...normalizedElement.customData,
      title: statusText,
      annotation,
      annotationUpdatedAt: updatedAt,
      annotationTaskRef: nextRef,
    },
  };
}
