import type { CanvasAiScene } from '../shared/CanvasGenerationComposer';
import { createCanvasGeneratorPlaceholderDataUrl } from '../shared/canvasGeneratorPlaceholder';
import { getCanvasAiSceneDefinition, type CanvasAiArtifactKind } from './canvasAiSceneRegistry';
import {
  resolveAiArtifactResourceId,
  resolveAiArtifactResourceKey,
  type AiArtifactClassificationKind,
} from '../../../common/aiArtifactClassification';

export const CANVAS_AI_GENERATION_CUSTOM_TYPE = 'axhub-ai-generation';
export const CANVAS_AI_GENERATION_PLACEHOLDER_FILE_ID = 'axhub-ai-generation-placeholder-v1';
export const CANVAS_AI_GENERATION_TITLE = 'AI 生成';
export const CANVAS_AI_GENERATION_STROKE_COLOR = '#008F5D';

export type CanvasAiRunArtifactKind = 'prototype' | 'image' | 'document' | 'drawio' | 'file' | 'link';
export type CanvasAiRunArtifactOperation = 'created' | 'updated';

export interface CanvasAiRunArtifact {
  id: string;
  kind: CanvasAiRunArtifactKind;
  operation: CanvasAiRunArtifactOperation;
  source?: Record<string, unknown>;
  target?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  dataUrl?: string;
  rawUrl?: string;
}

export interface ApplyCanvasAiArtifactOptions {
  elements: readonly any[];
  generatorId: string;
  taskId: string;
  artifact: CanvasAiRunArtifact;
}

export interface ApplyCanvasAiArtifactResult {
  elements: any[];
  files?: any[];
  selectedElementIds: Record<string, true>;
  applied: boolean;
}

export interface FinishCanvasAiGenerationSlotsOptions {
  elements: readonly any[];
  taskId: string;
  status: 'done' | 'error';
  error?: string | null;
}

export interface FinishCanvasAiGenerationSlotsResult {
  elements: any[];
}

export interface CreateCanvasAiGenerationOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  scene?: CanvasAiScene;
  artifactKind?: CanvasAiArtifactKind;
  generationTaskId?: string;
  initialPrompt?: string;
}

const DEFAULT_GENERATOR_WIDTH = 360;
const DEFAULT_GENERATOR_HEIGHT = 260;
const GENERATED_ARTIFACT_WIDTH = 720;
const GENERATED_ARTIFACT_HEIGHT = 480;
const GENERATED_ARTIFACT_GAP = 24;

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function resolveCanvasAiGenerationArtifactKind(scene: CanvasAiScene): CanvasAiArtifactKind {
  return getCanvasAiSceneDefinition(scene).artifactKind;
}

export function normalizeCanvasAiScene(value: unknown): CanvasAiScene {
  if (
    value === 'page'
    || value === 'design'
    || value === 'document'
  ) {
    return value;
  }
  if (value === 'image') return 'design';
  if (value === 'prototype') return 'page';
  if (value === 'chart' || value === 'other') return 'document';
  return 'page';
}

export function createCanvasAiGenerationPlaceholderDataUrl(
  width = DEFAULT_GENERATOR_WIDTH,
  height = DEFAULT_GENERATOR_HEIGHT,
): string {
  return createCanvasGeneratorPlaceholderDataUrl({
    width,
    height,
    ariaLabel: CANVAS_AI_GENERATION_TITLE,
    strokeColor: CANVAS_AI_GENERATION_STROKE_COLOR,
    strokeWidth: 2,
  });
}

export function createCanvasAiGenerationPlaceholderFile() {
  return {
    id: CANVAS_AI_GENERATION_PLACEHOLDER_FILE_ID as any,
    mimeType: 'image/svg+xml' as any,
    dataURL: createCanvasAiGenerationPlaceholderDataUrl(),
    created: Date.now(),
    lastRetrieved: Date.now(),
  };
}

function createImageElement(options: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fileId: string;
  customData?: Record<string, unknown>;
  isDeleted?: boolean;
}) {
  return {
    id: options.id,
    type: 'image' as const,
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    angle: 0 as any,
    strokeColor: CANVAS_AI_GENERATION_STROKE_COLOR,
    backgroundColor: 'transparent',
    fillStyle: 'solid' as any,
    strokeWidth: 2,
    strokeStyle: 'solid' as any,
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: null,
    roundness: null,
    seed: Math.floor(Math.random() * 2147483647),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    isDeleted: Boolean(options.isDeleted),
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    fileId: options.fileId,
    status: 'saved',
    scale: [1, 1] as [number, number],
    crop: null,
    customData: options.customData || {},
  };
}

export function createCanvasAiGenerationElement(options: CreateCanvasAiGenerationOptions) {
  const width = options.width || DEFAULT_GENERATOR_WIDTH;
  const height = options.height || DEFAULT_GENERATOR_HEIGHT;
  const scene = normalizeCanvasAiScene(options.scene);
  const artifactKind = options.artifactKind || resolveCanvasAiGenerationArtifactKind(scene);
  return createImageElement({
    id: randomId('ai-generation'),
    x: options.x,
    y: options.y,
    width,
    height,
    fileId: CANVAS_AI_GENERATION_PLACEHOLDER_FILE_ID,
    customData: {
      type: CANVAS_AI_GENERATION_CUSTOM_TYPE,
      title: CANVAS_AI_GENERATION_TITLE,
      previewKind: 'ai-generation',
      scene: options.scene ? scene : 'page',
      artifactKind: options.artifactKind || artifactKind,
      ...(options.generationTaskId ? { generationTaskId: options.generationTaskId } : {}),
      ...(options.initialPrompt ? { initialPrompt: options.initialPrompt } : {}),
    },
  });
}

export function isCanvasAiGenerationElement(element: any): boolean {
  const type = element?.customData?.type;
  return element?.type === 'image' && type === CANVAS_AI_GENERATION_CUSTOM_TYPE;
}

export function resolveCanvasAiGenerationScene(element: any): CanvasAiScene {
  return normalizeCanvasAiScene(element?.customData?.scene);
}

export function migrateCanvasAiGenerationElement(element: any): any {
  if (!isCanvasAiGenerationElement(element) || element.isDeleted) return element;
  const scene = resolveCanvasAiGenerationScene(element);
  const artifactKind = resolveCanvasAiGenerationArtifactKind(scene);
  if (
    element.customData?.type === CANVAS_AI_GENERATION_CUSTOM_TYPE
    && element.fileId === CANVAS_AI_GENERATION_PLACEHOLDER_FILE_ID
    && element.customData?.title === CANVAS_AI_GENERATION_TITLE
    && element.customData?.scene === scene
    && element.customData?.artifactKind === artifactKind
  ) {
    return element;
  }
  return {
    ...element,
    fileId: CANVAS_AI_GENERATION_PLACEHOLDER_FILE_ID,
    version: (element.version || 0) + 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    updated: Date.now(),
    customData: {
      ...element.customData,
      type: CANVAS_AI_GENERATION_CUSTOM_TYPE,
      title: CANVAS_AI_GENERATION_TITLE,
      previewKind: 'ai-generation',
      scene,
      artifactKind,
    },
  };
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function basename(value: string): string {
  const normalized = value.replace(/\\/g, '/').split(/[?#]/u)[0] || '';
  return normalized.split('/').filter(Boolean).pop() || normalized;
}

function resolveArtifactUrl(artifact: CanvasAiRunArtifact): string {
  const target = artifact.target || {};
  return stringField(target.uri)
    || stringField(target.url)
    || stringField(target.href)
    || stringField(artifact.rawUrl)
    || stringField(target.path)
    || stringField(target.targetPath);
}

function resolveArtifactResourceId(artifact: CanvasAiRunArtifact, url: string): string {
  const target = artifact.target || {};
  const metadata = artifact.metadata || {};
  return resolveAiArtifactResourceId({
    kind: artifact.kind as AiArtifactClassificationKind,
    path: target.path || target.targetPath,
    uri: target.uri,
    url,
    resourceId: target.resourceId || metadata.resourceId,
    artifactId: target.artifactId,
    targetArtifactId: target.targetArtifactId,
    name: metadata.name,
  }) || basename(url);
}

function resolveArtifactTitle(artifact: CanvasAiRunArtifact, resourceId: string): string {
  const metadata = artifact.metadata || {};
  return stringField(metadata.title)
    || stringField(metadata.name)
    || stringField(metadata.fileName)
    || basename(resourceId)
    || 'AI 生成产物';
}

function resolveArtifactResourceType(artifact: CanvasAiRunArtifact): 'doc' | 'prototype' {
  return artifact.kind === 'prototype' ? 'prototype' : 'doc';
}

function resolveArtifactResourceKey(artifact: CanvasAiRunArtifact, url: string): string {
  const target = artifact.target || {};
  const metadata = artifact.metadata || {};
  return stringField(metadata.artifactResourceKey)
    || resolveAiArtifactResourceKey({
      kind: artifact.kind as AiArtifactClassificationKind,
      path: target.path || target.targetPath,
      uri: target.uri,
      url,
      resourceId: target.resourceId || metadata.resourceId,
      artifactId: target.artifactId,
      targetArtifactId: target.targetArtifactId,
      name: metadata.name,
    });
}

function createDrawioArtifactFile(fileId: string, title: string, url: string) {
  const escapedTitle = title
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
  const escapedUrl = url
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${GENERATED_ARTIFACT_WIDTH}" height="${GENERATED_ARTIFACT_HEIGHT}" viewBox="0 0 ${GENERATED_ARTIFACT_WIDTH} ${GENERATED_ARTIFACT_HEIGHT}" role="img" aria-label="${escapedTitle}" data-axhub-drawio-source="${escapedUrl}">
  <rect width="${GENERATED_ARTIFACT_WIDTH}" height="${GENERATED_ARTIFACT_HEIGHT}" rx="12" fill="#e5e7eb"/>
</svg>`;
  return {
    id: fileId as any,
    mimeType: 'image/svg+xml' as any,
    dataURL: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
    created: Date.now(),
    lastRetrieved: Date.now(),
  };
}

function createGeneratedArtifactEmbeddable(options: {
  anchor: any;
  taskId: string;
  artifact: CanvasAiRunArtifact;
  offsetIndex?: number;
}): { element: any; files?: any[] } {
  const url = resolveArtifactUrl(options.artifact);
  const resourceType = resolveArtifactResourceType(options.artifact);
  const resourceId = resolveArtifactResourceId(options.artifact, url);
  const title = resolveArtifactTitle(options.artifact, resourceId);
  const artifactResourceKey = resolveArtifactResourceKey(options.artifact, url);
  if (options.artifact.kind === 'drawio') {
    const fileId = `drawio-file-${options.artifact.id.replace(/[^a-z0-9_-]+/giu, '-').toLowerCase() || Date.now()}`;
    return {
      element: {
        id: randomId('ai-drawio'),
        type: 'image' as const,
        x: options.anchor.x + (options.offsetIndex || 0) * (GENERATED_ARTIFACT_WIDTH + 24),
        y: options.anchor.y,
        width: GENERATED_ARTIFACT_WIDTH,
        height: GENERATED_ARTIFACT_HEIGHT,
        angle: 0 as any,
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        fillStyle: 'solid' as any,
        strokeWidth: 0,
        strokeStyle: 'solid' as any,
        roughness: 0,
        opacity: 100,
        groupIds: [] as readonly string[],
        frameId: null,
        index: null,
        roundness: null,
        seed: Math.floor(Math.random() * 2147483647),
        version: 1,
        versionNonce: Math.floor(Math.random() * 2147483647),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: url || null,
        locked: false,
        fileId,
        status: 'saved',
        scale: [1, 1] as [number, number],
        crop: null,
        customData: {
          type: 'axhub-drawio',
          title,
          previewUrl: url,
          openUrl: url,
          previewKind: 'drawio',
          resourceType: 'preview',
          sourceResourceType: resourceType,
          resourceId,
          artifactResourceKey,
          generatedBy: CANVAS_AI_GENERATION_CUSTOM_TYPE,
          sourceTaskId: options.taskId,
          sourceArtifactId: options.artifact.id,
          aiArtifact: options.artifact,
        },
      },
      files: [createDrawioArtifactFile(fileId, title, url)],
    };
  }
  const previewKind = resourceType === 'doc' ? 'doc' : 'web';
  const previewUrl = url || (resourceType === 'doc' ? `/?doc=${encodeURIComponent(resourceId)}` : `/prototypes/${encodeURIComponent(resourceId)}`);
  const openUrl = previewUrl;
  return {
    element: {
      id: randomId('ai-artifact-embed'),
      type: 'embeddable' as const,
      x: options.anchor.x + (options.offsetIndex || 0) * (GENERATED_ARTIFACT_WIDTH + 24),
      y: options.anchor.y,
      width: GENERATED_ARTIFACT_WIDTH,
      height: GENERATED_ARTIFACT_HEIGHT,
      angle: 0 as any,
      strokeColor: '#008F5D',
      backgroundColor: 'transparent',
      fillStyle: 'solid' as any,
      strokeWidth: 2,
      strokeStyle: 'solid' as any,
      roughness: 1,
      opacity: 100,
      groupIds: [] as readonly string[],
      frameId: null,
      index: null,
      roundness: { type: 3 as any },
      seed: Math.floor(Math.random() * 2147483647),
      version: 1,
      versionNonce: Math.floor(Math.random() * 2147483647),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: openUrl,
      locked: false,
      customData: {
        ...(resourceType === 'doc' ? { type: 'axhub-doc' } : {}),
        title,
        previewUrl,
        openUrl,
        previewKind,
        resourceType: 'preview',
        sourceResourceType: resourceType,
        resourceId,
        artifactResourceKey,
        screenshotUrl: '',
        embedSizePreset: 'free',
        embedViewMode: 'preview',
        storedPreviewSize: {
          width: GENERATED_ARTIFACT_WIDTH,
          height: GENERATED_ARTIFACT_HEIGHT,
        },
        previewStrokeColor: '#008F5D',
        generatedBy: CANVAS_AI_GENERATION_CUSTOM_TYPE,
        sourceTaskId: options.taskId,
        sourceArtifactId: options.artifact.id,
        aiArtifact: options.artifact,
      },
    },
  };
}

function updateGeneratedArtifactEmbeddable(element: any, artifact: CanvasAiRunArtifact): any {
  const url = resolveArtifactUrl(artifact);
  const resourceType = resolveArtifactResourceType(artifact);
  const resourceId = resolveArtifactResourceId(artifact, url);
  const title = resolveArtifactTitle(artifact, resourceId);
  const previewUrl = url || element.customData?.previewUrl || '';
  const openUrl = previewUrl || element.customData?.openUrl || element.link || '';
  const artifactResourceKey = resolveArtifactResourceKey(artifact, url);
  if (artifact.kind === 'drawio') {
    return {
      ...element,
      version: (element.version || 0) + 1,
      versionNonce: Math.floor(Math.random() * 2147483647),
      updated: Date.now(),
      link: openUrl || null,
      customData: {
        ...element.customData,
        type: 'axhub-drawio',
        title,
        previewUrl,
        openUrl,
        previewKind: 'drawio',
        resourceType: 'preview',
        sourceResourceType: resourceType,
        resourceId,
        artifactResourceKey,
        sourceArtifactId: artifact.id,
        aiArtifact: artifact,
      },
    };
  }
  return {
    ...element,
    version: (element.version || 0) + 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    updated: Date.now(),
    link: openUrl,
    customData: {
      ...element.customData,
      ...(resourceType === 'doc' ? { type: 'axhub-doc' } : {}),
      title,
      previewUrl,
      openUrl,
      resourceType: 'preview',
      sourceResourceType: resourceType,
      resourceId,
      artifactResourceKey,
      sourceArtifactId: artifact.id,
      aiArtifact: artifact,
    },
  };
}

function getElementArtifactResourceKey(element: any): string {
  return stringField(element?.customData?.artifactResourceKey);
}

function annotateGeneratorWithArtifact(element: any, taskId: string, artifact: CanvasAiRunArtifact): any {
  return {
    ...element,
    version: (element.version || 0) + 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    updated: Date.now(),
    customData: {
      ...element.customData,
      generationTaskId: taskId,
      lastAiArtifact: artifact,
    },
  };
}

function annotateRunningSlot(element: any, taskId: string): any {
  return {
    ...element,
    version: (element.version || 0) + 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    updated: Date.now(),
    customData: {
      ...element.customData,
      generationTaskId: taskId,
      generationSlotIndex: Number(element.customData?.generationSlotIndex ?? 0),
      generationSlotCount: Number(element.customData?.generationSlotCount ?? 1),
      generationSlotStatus: 'running',
      generationError: undefined,
    },
  };
}

function moveRunningSlotAfterArtifact(element: any, taskId: string, artifactElement: any): any {
  return {
    ...annotateRunningSlot(element, taskId),
    x: artifactElement.x + artifactElement.width + GENERATED_ARTIFACT_GAP,
    y: artifactElement.y,
  };
}

function isLiveGenerationSlot(element: any, taskId: string): boolean {
  return (
    isCanvasAiGenerationElement(element)
    && !element?.isDeleted
    && element.customData?.generationTaskId === taskId
    && element.customData?.generationSlotStatus !== 'error'
  );
}

export function applyCanvasAiArtifactToElements(
  options: ApplyCanvasAiArtifactOptions,
): ApplyCanvasAiArtifactResult {
  const generatedTaskElements = options.elements.filter((element: any) => (
    !element?.isDeleted
    && element?.customData?.generatedBy === CANVAS_AI_GENERATION_CUSTOM_TYPE
    && element.customData?.sourceTaskId === options.taskId
  ));
  const artifactResourceKey = resolveArtifactResourceKey(options.artifact, resolveArtifactUrl(options.artifact));
  const existingArtifactElement = options.elements.find((element: any) => (
    !element?.isDeleted
    && element?.customData?.generatedBy === CANVAS_AI_GENERATION_CUSTOM_TYPE
    && (
      element.customData?.sourceArtifactId === options.artifact.id
      || (artifactResourceKey && getElementArtifactResourceKey(element) === artifactResourceKey)
      || (
        element.customData?.sourceTaskId === options.taskId
        && options.artifact.operation === 'updated'
        && generatedTaskElements.length === 1
      )
    )
  ));
  if (existingArtifactElement) {
    return {
      elements: options.elements.map((element: any) => (
        element?.id === existingArtifactElement.id
          ? updateGeneratedArtifactEmbeddable(element, options.artifact)
          : element
      )),
      selectedElementIds: { [existingArtifactElement.id]: true },
      applied: true,
    };
  }

  const generator = options.elements.find((element: any) => element?.id === options.generatorId && !element.isDeleted);
  if (!generator) {
    const anchor = generatedTaskElements[0];
    if (
      anchor
      && (options.artifact.kind === 'document' || options.artifact.kind === 'file' || options.artifact.kind === 'link')
      && options.artifact.operation === 'created'
    ) {
      const inserted = createGeneratedArtifactEmbeddable({
        anchor,
        taskId: options.taskId,
        artifact: options.artifact,
        offsetIndex: generatedTaskElements.length,
      });
      return {
        elements: [...options.elements, inserted.element],
        files: inserted.files,
        selectedElementIds: { [inserted.element.id]: true },
        applied: true,
      };
    }
    return {
      elements: [...options.elements],
      selectedElementIds: {},
      applied: false,
    };
  }

  if (options.artifact.kind !== 'document' && options.artifact.kind !== 'file' && options.artifact.kind !== 'link' && options.artifact.kind !== 'drawio') {
    return {
      elements: options.elements.map((element: any) => (
        element?.id === options.generatorId
          ? annotateGeneratorWithArtifact(element, options.taskId, options.artifact)
          : element
      )),
      selectedElementIds: { [options.generatorId]: true },
      applied: true,
    };
  }

  const inserted = createGeneratedArtifactEmbeddable({
    anchor: generator,
    taskId: options.taskId,
    artifact: options.artifact,
  });
  const elements = options.elements.map((element: any) => (
    element?.id === options.generatorId
      ? moveRunningSlotAfterArtifact(
        annotateGeneratorWithArtifact(element, options.taskId, options.artifact),
        options.taskId,
        inserted.element,
      )
      : element
  ));
  return {
    elements: [...elements, inserted.element],
    files: inserted.files,
    selectedElementIds: { [inserted.element.id]: true },
    applied: true,
  };
}

export function finishCanvasAiGenerationSlots(
  options: FinishCanvasAiGenerationSlotsOptions,
): FinishCanvasAiGenerationSlotsResult {
  return {
    elements: options.elements.map((element: any) => {
      if (!isLiveGenerationSlot(element, options.taskId)) return element;
      if (options.status === 'done') {
        return {
          ...element,
          isDeleted: true,
          version: (element.version || 0) + 1,
          versionNonce: Math.floor(Math.random() * 2147483647),
          updated: Date.now(),
        };
      }
      return {
        ...element,
        version: (element.version || 0) + 1,
        versionNonce: Math.floor(Math.random() * 2147483647),
        updated: Date.now(),
        customData: {
          ...element.customData,
          generationSlotStatus: 'error',
          generationError: options.error || '生成失败',
        },
      };
    }),
  };
}
