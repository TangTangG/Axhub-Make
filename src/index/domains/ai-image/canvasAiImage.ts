import { createCanvasGeneratorPlaceholderDataUrl } from '../shared/canvasGeneratorPlaceholder';
export {
  shouldDeleteCanvasGeneratorFromComposerKeydown as shouldDeleteAiImageGeneratorFromComposerKeydown,
  type CanvasGeneratorComposerKeydownDeleteOptions as AiImageComposerKeydownDeleteOptions,
} from '../shared/canvasGeneratorComposerKeydown';

export const AI_IMAGE_GENERATOR_CUSTOM_TYPE = 'axhub-ai-image-generator';
export const AI_IMAGE_RESULT_CUSTOM_TYPE = 'axhub-ai-image';
export const AI_IMAGE_PLACEHOLDER_FILE_ID = 'axhub-ai-image-placeholder-v6';

export interface CreateAiImageGeneratorOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface ReplaceGeneratorImage {
  dataUrl: string;
  displaySize?: string;
  width?: number;
  height?: number;
  imageId: string;
}

export interface ReplaceGeneratorOptions {
  elements: readonly any[];
  generatorId: string;
  images: ReplaceGeneratorImage[];
  taskId?: string;
}

export interface ReplaceImageOptions {
  elements: readonly any[];
  imageElementId: string;
  images: ReplaceGeneratorImage[];
  taskId?: string;
}

export interface CreateAiImageResultElementsOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  images: ReplaceGeneratorImage[];
  taskId?: string;
}

export interface ReplaceGeneratorResult {
  elements: any[];
  files: any[];
  selectedElementIds: Record<string, true>;
}

const DEFAULT_GENERATOR_WIDTH = 360;
const DEFAULT_GENERATOR_HEIGHT = 260;
const GENERATED_IMAGE_MAX_WIDTH = 512;
const GENERATED_IMAGE_MAX_HEIGHT = 512;
const GENERATED_IMAGE_GAP = 24;

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createAiImagePlaceholderDataUrl(width = DEFAULT_GENERATOR_WIDTH, height = DEFAULT_GENERATOR_HEIGHT): string {
  return createCanvasGeneratorPlaceholderDataUrl({
    width,
    height,
    ariaLabel: '图片生成器',
  });
}

function createBaseElement(options: {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  fileId: string;
  groupIds?: string[];
  customData?: Record<string, unknown>;
  isDeleted?: boolean;
}) {
  return {
    id: options.id,
    type: options.type,
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
    groupIds: options.groupIds || [],
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

export function createAiImageGeneratorElement(options: CreateAiImageGeneratorOptions) {
  const width = options.width || DEFAULT_GENERATOR_WIDTH;
  const height = options.height || DEFAULT_GENERATOR_HEIGHT;
  return createBaseElement({
    id: randomId('ai-image-generator'),
    type: 'image',
    x: options.x,
    y: options.y,
    width,
    height,
    fileId: AI_IMAGE_PLACEHOLDER_FILE_ID,
    customData: {
      type: AI_IMAGE_GENERATOR_CUSTOM_TYPE,
      title: 'AI 生成图片',
      previewKind: 'ai-image-generator',
    },
  });
}

export function createAiImagePlaceholderFile() {
  return {
    id: AI_IMAGE_PLACEHOLDER_FILE_ID as any,
    mimeType: 'image/svg+xml' as any,
    dataURL: createAiImagePlaceholderDataUrl(),
    created: Date.now(),
    lastRetrieved: Date.now(),
  };
}

export function isAiImageGeneratorElement(element: any): boolean {
  return element?.type === 'image' && element?.customData?.type === AI_IMAGE_GENERATOR_CUSTOM_TYPE;
}

export function isAiImageElement(element: any): boolean {
  return element?.type === 'image' && element?.customData?.type === AI_IMAGE_RESULT_CUSTOM_TYPE;
}

function getMimeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/u);
  return match?.[1] || 'image/png';
}

function parseDisplaySize(size: string | undefined): { width: number; height: number } | null {
  const match = size?.match(/^(\d+)x(\d+)$/u);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

export function getAiImageDisplaySize(displaySize: string | undefined) {
  const displayDimensions = parseDisplaySize(displaySize);
  if (!displayDimensions) return null;
  const scale = Math.min(
    1,
    GENERATED_IMAGE_MAX_WIDTH / displayDimensions.width,
    GENERATED_IMAGE_MAX_HEIGHT / displayDimensions.height,
  );
  return {
    width: Math.max(1, Math.round(displayDimensions.width * scale)),
    height: Math.max(1, Math.round(displayDimensions.height * scale)),
  };
}

function fitImageSize(
  width: number | undefined,
  height: number | undefined,
  fallbackWidth: number,
  fallbackHeight: number,
  displaySize?: string,
) {
  const boundedDisplaySize = getAiImageDisplaySize(displaySize);
  if (boundedDisplaySize) return boundedDisplaySize;
  const sourceWidth = width && width > 0 ? width : fallbackWidth;
  const sourceHeight = height && height > 0 ? height : fallbackHeight;
  const scale = Math.min(1, GENERATED_IMAGE_MAX_WIDTH / sourceWidth, GENERATED_IMAGE_MAX_HEIGHT / sourceHeight);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export function replaceGeneratorWithImageElements(options: ReplaceGeneratorOptions): ReplaceGeneratorResult {
  const generator = options.elements.find((element) => element?.id === options.generatorId);
  if (!generator || !options.images.length) {
    return {
      elements: [...options.elements],
      files: [],
      selectedElementIds: {},
    };
  }

  const groupId = options.images.length > 1 ? randomId('ai-image-group') : '';
  const selectedElementIds: Record<string, true> = {};
  const files = options.images.map((image) => ({
    id: image.imageId as any,
    mimeType: getMimeFromDataUrl(image.dataUrl) as any,
    dataURL: image.dataUrl,
    created: Date.now(),
    lastRetrieved: Date.now(),
  }));

  let cursorX = generator.x;
  const inserted = options.images.map((image) => {
    const size = fitImageSize(image.width, image.height, generator.width, generator.height, image.displaySize);
    const id = randomId('ai-image');
    selectedElementIds[id] = true;
    const element = createBaseElement({
      id,
      type: 'image',
      x: cursorX,
      y: generator.y,
      width: size.width,
      height: size.height,
      fileId: image.imageId,
      groupIds: groupId ? [groupId] : [],
      customData: {
        type: AI_IMAGE_RESULT_CUSTOM_TYPE,
        generatedBy: 'axhub-ai-image',
        sourceTaskId: options.taskId || '',
        previewKind: 'image',
      },
    });
    cursorX += size.width + GENERATED_IMAGE_GAP;
    return element;
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
    elements: [...elements, ...inserted],
    files,
    selectedElementIds,
  };
}

export function createAiImageResultElements(options: CreateAiImageResultElementsOptions): ReplaceGeneratorResult {
  if (!options.images.length) {
    return {
      elements: [],
      files: [],
      selectedElementIds: {},
    };
  }

  const groupId = options.images.length > 1 ? randomId('ai-image-group') : '';
  const selectedElementIds: Record<string, true> = {};
  const files = options.images.map((image) => ({
    id: image.imageId as any,
    mimeType: getMimeFromDataUrl(image.dataUrl) as any,
    dataURL: image.dataUrl,
    created: Date.now(),
    lastRetrieved: Date.now(),
  }));

  let cursorX = options.x;
  const elements = options.images.map((image) => {
    const size = fitImageSize(image.width, image.height, options.width, options.height, image.displaySize);
    const id = randomId('ai-image');
    selectedElementIds[id] = true;
    const element = createBaseElement({
      id,
      type: 'image',
      x: cursorX,
      y: options.y,
      width: size.width,
      height: size.height,
      fileId: image.imageId,
      groupIds: groupId ? [groupId] : [],
      customData: {
        type: AI_IMAGE_RESULT_CUSTOM_TYPE,
        generatedBy: 'axhub-ai-image',
        sourceTaskId: options.taskId || '',
        previewKind: 'image',
      },
    });
    cursorX += size.width + GENERATED_IMAGE_GAP;
    return element;
  });

  return {
    elements,
    files,
    selectedElementIds,
  };
}

export function replaceImageElementWithImageElements(options: ReplaceImageOptions): ReplaceGeneratorResult {
  const imageElement = options.elements.find((element) => element?.id === options.imageElementId);
  if (!imageElement || !options.images.length) {
    return {
      elements: [...options.elements],
      files: [],
      selectedElementIds: {},
    };
  }

  return replaceGeneratorWithImageElements({
    elements: options.elements.map((element) => (
      element?.id === options.imageElementId
        ? {
          ...element,
          customData: {
            ...element.customData,
            type: AI_IMAGE_GENERATOR_CUSTOM_TYPE,
          },
        }
        : element
    )),
    generatorId: options.imageElementId,
    images: options.images,
    taskId: options.taskId,
  });
}
