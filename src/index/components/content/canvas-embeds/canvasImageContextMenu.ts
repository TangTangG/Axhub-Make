import type { CanvasAiQuickPrompt } from '../../../domains/ai-generation/canvasAiSceneRegistry';
import { getCanvasAiSceneQuickPrompts } from '../../../domains/ai-generation/canvasAiSceneRegistry';

type CanvasImageContextMenuElement = {
  id?: string;
  type?: string;
  fileId?: string;
};

type CanvasImageFileData = {
  dataURL?: string;
  dataUrl?: string;
};

export interface CanvasImageContextMenuStateInput {
  bridgeConnected: boolean;
  canAddScreenshotToAI: boolean;
  canAddNodesToAI: boolean;
  canAddImageToAI: boolean;
  selectedElements: CanvasImageContextMenuElement[];
  files: Record<string, CanvasImageFileData | undefined>;
}

export interface CanvasImageContextMenuState {
  isSingleImageSelection: boolean;
  singleImageHasOriginalData: boolean;
  showScreenshotToAI: boolean;
  showNodeContextToAI: boolean;
  showOriginalImageToAI: boolean;
  showImageQuickActions: boolean;
  showCopyOriginalImage: boolean;
  showBackgroundToTransparent: boolean;
  quickPrompts: readonly CanvasAiQuickPrompt[];
}

function resolveImageDataUrl(value: CanvasImageFileData | undefined): string {
  const dataUrl = String(value?.dataURL || value?.dataUrl || '').trim();
  return dataUrl.startsWith('data:image/') ? dataUrl : '';
}

export function resolveCanvasImageContextMenuState({
  bridgeConnected,
  canAddScreenshotToAI,
  canAddNodesToAI,
  canAddImageToAI,
  selectedElements,
  files,
}: CanvasImageContextMenuStateInput): CanvasImageContextMenuState {
  const selected = Array.isArray(selectedElements)
    ? selectedElements.filter((element) => element && element.id)
    : [];
  const singleImage = selected.length === 1 && selected[0]?.type === 'image'
    ? selected[0]
    : null;
  const imageFileId = typeof singleImage?.fileId === 'string' ? singleImage.fileId.trim() : '';
  const singleImageDataUrl = imageFileId ? resolveImageDataUrl(files[imageFileId]) : '';
  const isSingleImageSelection = Boolean(singleImage);
  const singleImageHasOriginalData = Boolean(singleImageDataUrl);
  const showOriginalImageToAI = Boolean(
    bridgeConnected
    && canAddImageToAI
    && isSingleImageSelection
    && singleImageHasOriginalData,
  );

  return {
    isSingleImageSelection,
    singleImageHasOriginalData,
    showScreenshotToAI: Boolean(bridgeConnected && canAddScreenshotToAI && selected.length > 0 && !isSingleImageSelection),
    showNodeContextToAI: Boolean(bridgeConnected && canAddNodesToAI && selected.length > 0 && !isSingleImageSelection),
    showOriginalImageToAI,
    showImageQuickActions: showOriginalImageToAI,
    showCopyOriginalImage: Boolean(isSingleImageSelection && singleImageHasOriginalData),
    showBackgroundToTransparent: Boolean(isSingleImageSelection && singleImageHasOriginalData),
    quickPrompts: showOriginalImageToAI ? getCanvasAiSceneQuickPrompts('design') : [],
  };
}
