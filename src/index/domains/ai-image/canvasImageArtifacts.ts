import type { CanvasAiScene } from '../shared/CanvasGenerationComposer';
import { resolveCanvasGeneratorPlacement } from '../shared/canvasGeneratorPlacement';
import {
  createAiImageResultElements,
  isAiImageGeneratorElement,
  replaceGeneratorWithImageElements,
  type ReplaceGeneratorImage,
} from './canvasAiImage';
import { isCanvasAiGenerationElement } from '../ai-generation/canvasAiGeneration';
import { getAiImageTaskStore, type AiImageStoredImage, type AiImageTaskRecord } from './aiImageStore';

export interface CanvasImageArtifactEvent {
  taskId: string;
  images: ReplaceGeneratorImage[];
  sourceScene: CanvasAiScene;
  generatorElementId?: string;
}

interface CreateCanvasImageArtifactEventOptions {
  sourceScene: CanvasAiScene;
  getImage?: (imageId: string) => AiImageStoredImage | undefined;
  consumedImageIds?: ReadonlySet<string>;
}

interface ResolveCanvasImageArtifactUpdateOptions {
  elements: readonly any[];
  appState: {
    width: number;
    height: number;
    scrollX?: number;
    scrollY?: number;
    zoom?: { value?: number } | number;
  };
  event: CanvasImageArtifactEvent;
}

export interface CanvasImageArtifactUpdate {
  elements: any[];
  files: any[];
  selectedElementIds: Record<string, true>;
  usedFallbackPlacement: boolean;
  scrollTargetId?: string;
  needsScroll: boolean;
}

export function createCanvasImageArtifactEventFromAiImageTask(
  task: AiImageTaskRecord,
  options: CreateCanvasImageArtifactEventOptions,
): CanvasImageArtifactEvent | null {
  if (!task.outputImages.length) return null;
  const getImage = options.getImage || ((imageId: string) => getAiImageTaskStore().getImage(imageId));
  const images = task.outputImages
    .filter((imageId) => !options.consumedImageIds?.has(imageId))
    .map((imageId): ReplaceGeneratorImage | null => {
      const image = getImage(imageId);
      if (!image) return null;
      const displaySize = task.actualParamsByImage?.[imageId]?.size || task.actualParams?.size || task.params.size;
      return {
        imageId,
        dataUrl: image.dataUrl,
        displaySize,
        width: image.width,
        height: image.height,
      };
    })
    .filter((image): image is ReplaceGeneratorImage => Boolean(image));
  if (!images.length) return null;
  return {
    taskId: task.id,
    sourceScene: options.sourceScene,
    images,
    ...(task.generatorElementId ? { generatorElementId: task.generatorElementId } : {}),
  };
}

function findBoundGenerator(elements: readonly any[], event: CanvasImageArtifactEvent) {
  if (event.generatorElementId) {
    const generator = elements.find((element) => (
      element?.id === event.generatorElementId && isAiImageGeneratorElement(element) && !element.isDeleted
    ));
    if (generator) return generator;
    const unifiedGenerator = elements.find((element) => (
      element?.id === event.generatorElementId && isCanvasAiGenerationElement(element) && !element.isDeleted
    ));
    if (unifiedGenerator) return unifiedGenerator;
  }
  return elements.find((element) => (
    (isAiImageGeneratorElement(element) || isCanvasAiGenerationElement(element))
    && !element.isDeleted
    && element.customData?.generationTaskId === event.taskId
  ));
}

export function resolveCanvasImageArtifactUpdate({
  elements,
  appState,
  event,
}: ResolveCanvasImageArtifactUpdateOptions): CanvasImageArtifactUpdate {
  const generator = findBoundGenerator(elements, event);
  if (generator) {
    const result = replaceGeneratorWithImageElements({
      elements,
      generatorId: generator.id,
      images: event.images,
      taskId: event.taskId,
    });
    return {
      elements: result.elements,
      files: result.files,
      selectedElementIds: result.selectedElementIds,
      usedFallbackPlacement: false,
      needsScroll: false,
    };
  }

  const placement = resolveCanvasGeneratorPlacement({
    elements,
    appState,
  });
  const result = createAiImageResultElements({
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    images: event.images,
    taskId: event.taskId,
  });

  return {
    elements: [...elements, ...result.elements],
    files: result.files,
    selectedElementIds: result.selectedElementIds,
    usedFallbackPlacement: true,
    scrollTargetId: result.elements[0]?.id,
    needsScroll: placement.needsScroll,
  };
}
