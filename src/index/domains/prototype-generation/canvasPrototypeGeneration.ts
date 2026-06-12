import type { ItemData } from '../../types';
import { createCanvasGeneratorPlaceholderDataUrl } from '../shared/canvasGeneratorPlaceholder';

export const PROTOTYPE_GENERATOR_CUSTOM_TYPE = 'axhub-prototype-generator';
export const PROTOTYPE_PLACEHOLDER_FILE_ID = 'axhub-prototype-generator-placeholder-v4';
const CANVAS_AI_GENERATION_CUSTOM_TYPE = 'axhub-ai-generation';

export interface CreatePrototypeGeneratorOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface ReplacePrototypeGeneratorOptions {
  elements: readonly any[];
  generatorId: string;
  prototype: Pick<ItemData, 'name' | 'displayName' | 'previewUrl' | 'clientUrl'>;
  taskId?: string;
}

export interface CreatePrototypeGenerationSlotsOptions {
  elements: readonly any[];
  generatorId: string;
  taskId: string;
  count: number;
}

export interface FinishPrototypeGenerationSlotsOptions {
  elements: readonly any[];
  taskId: string;
  status: 'done' | 'error';
  error?: string | null;
}

export interface ReplacePrototypeGeneratorResult {
  elements: any[];
  selectedElementIds: Record<string, true>;
}

const DEFAULT_GENERATOR_WIDTH = 360;
const DEFAULT_GENERATOR_HEIGHT = 260;
const GENERATED_PROTOTYPE_VISIBLE_WIDTH = 720;
const GENERATED_PROTOTYPE_VISIBLE_HEIGHT = 450;
const GENERATED_PROTOTYPE_CONTENT_SCALE = 0.5;
const GENERATED_PROTOTYPE_GAP = 24;

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createPrototypeGeneratorPlaceholderDataUrl(
  width = DEFAULT_GENERATOR_WIDTH,
  height = DEFAULT_GENERATOR_HEIGHT,
): string {
  return createCanvasGeneratorPlaceholderDataUrl({
    width,
    height,
    ariaLabel: '原型生成器',
  });
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
    strokeColor: 'transparent',
    backgroundColor: 'transparent',
    fillStyle: 'solid' as any,
    strokeWidth: 0,
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

function createEmbeddableElement(options: {
  generator: any;
  prototype: Pick<ItemData, 'name' | 'displayName' | 'previewUrl' | 'clientUrl'>;
  taskId?: string;
}) {
  const previewUrl = options.prototype.clientUrl || options.prototype.previewUrl || '';
  const link = previewUrl;
  return {
    id: randomId('prototype-embed'),
    type: 'embeddable' as const,
    x: options.generator.x,
    y: options.generator.y,
    width: GENERATED_PROTOTYPE_VISIBLE_WIDTH,
    height: GENERATED_PROTOTYPE_VISIBLE_HEIGHT,
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
    link,
    locked: false,
    customData: {
      title: options.prototype.displayName || options.prototype.name,
      previewUrl,
      openUrl: link,
      previewKind: 'web',
      resourceType: 'prototype',
      resourceId: options.prototype.name,
      screenshotUrl: '',
      embedSizePreset: 'desktop',
      embedContentScale: GENERATED_PROTOTYPE_CONTENT_SCALE,
      embedViewMode: 'preview',
      storedPreviewSize: {
        width: GENERATED_PROTOTYPE_VISIBLE_WIDTH,
        height: GENERATED_PROTOTYPE_VISIBLE_HEIGHT,
      },
      previewStrokeColor: '#008F5D',
      generatedBy: 'axhub-prototype-generator',
      sourceTaskId: options.taskId || '',
      captureScreenshotOnMount: true,
    },
  };
}

export function createPrototypeGeneratorElement(options: CreatePrototypeGeneratorOptions) {
  const width = options.width || DEFAULT_GENERATOR_WIDTH;
  const height = options.height || DEFAULT_GENERATOR_HEIGHT;
  return createImageElement({
    id: randomId('prototype-generator'),
    x: options.x,
    y: options.y,
    width,
    height,
    fileId: PROTOTYPE_PLACEHOLDER_FILE_ID,
    customData: {
      type: PROTOTYPE_GENERATOR_CUSTOM_TYPE,
      title: 'AI 生成原型',
      previewKind: 'prototype-generator',
    },
  });
}

export function createPrototypeGeneratorPlaceholderFile() {
  return {
    id: PROTOTYPE_PLACEHOLDER_FILE_ID as any,
    mimeType: 'image/svg+xml' as any,
    dataURL: createPrototypeGeneratorPlaceholderDataUrl(),
    created: Date.now(),
    lastRetrieved: Date.now(),
  };
}

export function isPrototypeGeneratorElement(element: any): boolean {
  return element?.type === 'image' && element?.customData?.type === PROTOTYPE_GENERATOR_CUSTOM_TYPE;
}

function isPrototypeGenerationPlaceholderElement(element: any): boolean {
  return element?.type === 'image' && (
    element?.customData?.type === PROTOTYPE_GENERATOR_CUSTOM_TYPE
    || element?.customData?.type === CANVAS_AI_GENERATION_CUSTOM_TYPE
  );
}

function touchElement(element: any): any {
  return {
    ...element,
    version: (element.version || 0) + 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    updated: Date.now(),
  };
}

function isPrototypeGenerationSlot(element: any, taskId: string): boolean {
  return (
    isPrototypeGenerationPlaceholderElement(element)
    && !element?.isDeleted
    && element.customData?.generationTaskId === taskId
    && element.customData?.generationSlotStatus !== 'error'
  );
}

function createPrototypeGenerationSlot(base: any, options: {
  id: string;
  taskId: string;
  index: number;
  count: number;
  x: number;
  y: number;
}) {
  return {
    ...base,
    id: options.id,
    x: options.x,
    y: options.y,
    width: GENERATED_PROTOTYPE_VISIBLE_WIDTH,
    height: GENERATED_PROTOTYPE_VISIBLE_HEIGHT,
    isDeleted: false,
    version: base.id === options.id ? (base.version || 0) + 1 : 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    updated: Date.now(),
    customData: {
      ...base.customData,
      generationTaskId: options.taskId,
      generationSlotIndex: options.index,
      generationSlotCount: options.count,
      generationSlotStatus: 'running',
      generationError: undefined,
    },
  };
}

export function createPrototypeGenerationSlots(
  options: CreatePrototypeGenerationSlotsOptions,
): ReplacePrototypeGeneratorResult {
  const generator = options.elements.find((element) => element?.id === options.generatorId && !element.isDeleted);
  if (!generator) {
    return {
      elements: [...options.elements],
      selectedElementIds: {},
    };
  }
  const count = Math.max(1, Math.min(4, Math.round(Number(options.count) || 1)));
  const selectedElementIds: Record<string, true> = {};
  const slots = Array.from({ length: count }, (_, index) => {
    const id = index === 0 ? generator.id : randomId('prototype-slot');
    selectedElementIds[id] = true;
    return createPrototypeGenerationSlot(generator, {
      id,
      taskId: options.taskId,
      index,
      count,
      x: generator.x + index * (GENERATED_PROTOTYPE_VISIBLE_WIDTH + GENERATED_PROTOTYPE_GAP),
      y: generator.y,
    });
  });
  return {
    elements: [
      ...options.elements.filter((element) => element?.id !== options.generatorId),
      ...slots,
    ],
    selectedElementIds,
  };
}

export function replacePrototypeGeneratorWithEmbeddable(
  options: ReplacePrototypeGeneratorOptions,
): ReplacePrototypeGeneratorResult {
  const generator = options.elements.find((element) => element?.id === options.generatorId);
  if (!generator) {
    return {
      elements: [...options.elements],
      selectedElementIds: {},
    };
  }

  const inserted = createEmbeddableElement({
    generator,
    prototype: options.prototype,
    taskId: options.taskId,
  });
  const elements = options.elements.map((element) => {
    if (element?.id !== options.generatorId) return element;
    return {
      ...element,
      isDeleted: true,
      version: (element.version || 0) + 1,
      versionNonce: Math.floor(Math.random() * 2147483647),
      updated: Date.now(),
    };
  });

  return {
    elements: [...elements, inserted],
    selectedElementIds: { [inserted.id]: true },
  };
}

export function finishPrototypeGenerationSlots(
  options: FinishPrototypeGenerationSlotsOptions,
): { elements: any[] } {
  return {
    elements: options.elements.map((element) => {
      if (!isPrototypeGenerationSlot(element, options.taskId)) return element;
      if (options.status === 'done') {
        return {
          ...touchElement(element),
          isDeleted: true,
        };
      }
      return {
        ...touchElement(element),
        customData: {
          ...element.customData,
          generationSlotStatus: 'error',
          generationError: options.error || '原型生成失败',
        },
      };
    }),
  };
}
