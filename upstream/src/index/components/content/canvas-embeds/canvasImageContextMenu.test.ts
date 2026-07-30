import { describe, expect, it } from 'vitest';

import { resolveCanvasImageContextMenuState } from './canvasImageContextMenu';

describe('canvas image context menu state', () => {
  it('hides screenshot and node context actions for a single image and shows original image actions', () => {
    const state = resolveCanvasImageContextMenuState({
      bridgeConnected: true,
      canAddScreenshotToAI: true,
      canAddNodesToAI: true,
      canAddImageToAI: true,
      selectedElements: [
        { id: 'image-1', type: 'image', fileId: 'file-1' },
      ],
      files: {
        'file-1': { dataURL: 'data:image/webp;base64,original' },
      },
    });

    expect(state.isSingleImageSelection).toBe(true);
    expect(state.singleImageHasOriginalData).toBe(true);
    expect(state.showScreenshotToAI).toBe(false);
    expect(state.showNodeContextToAI).toBe(false);
    expect(state.showOriginalImageToAI).toBe(true);
    expect(state.showImageQuickActions).toBe(false);
    expect(state.showCopyOriginalImage).toBe(true);
    expect(state.showBackgroundToTransparent).toBe(true);
  });

  it('keeps screenshot and node context actions for multi-selection', () => {
    const state = resolveCanvasImageContextMenuState({
      bridgeConnected: true,
      canAddScreenshotToAI: true,
      canAddNodesToAI: true,
      canAddImageToAI: true,
      selectedElements: [
        { id: 'image-1', type: 'image' },
        { id: 'rect-1', type: 'rectangle' },
      ],
      files: {},
    });

    expect(state.isSingleImageSelection).toBe(false);
    expect(state.showScreenshotToAI).toBe(true);
    expect(state.showNodeContextToAI).toBe(true);
    expect(state.showOriginalImageToAI).toBe(false);
    expect(state.showImageQuickActions).toBe(false);
    expect(state.showCopyOriginalImage).toBe(false);
    expect(state.showBackgroundToTransparent).toBe(false);
  });

  it('leaves non-image single selections on the existing AI actions', () => {
    const state = resolveCanvasImageContextMenuState({
      bridgeConnected: true,
      canAddScreenshotToAI: true,
      canAddNodesToAI: true,
      canAddImageToAI: true,
      selectedElements: [
        { id: 'rect-1', type: 'rectangle' },
      ],
      files: {},
    });

    expect(state.isSingleImageSelection).toBe(false);
    expect(state.showScreenshotToAI).toBe(true);
    expect(state.showNodeContextToAI).toBe(true);
    expect(state.showOriginalImageToAI).toBe(false);
    expect(state.showImageQuickActions).toBe(false);
    expect(state.showCopyOriginalImage).toBe(false);
    expect(state.showBackgroundToTransparent).toBe(false);
  });

  it('does not fall back to screenshot or node context actions when a single image has no original data', () => {
    const state = resolveCanvasImageContextMenuState({
      bridgeConnected: true,
      canAddScreenshotToAI: true,
      canAddNodesToAI: true,
      canAddImageToAI: true,
      selectedElements: [
        { id: 'image-1', type: 'image', fileId: 'missing-file' },
      ],
      files: {},
    });

    expect(state.isSingleImageSelection).toBe(true);
    expect(state.singleImageHasOriginalData).toBe(false);
    expect(state.showScreenshotToAI).toBe(false);
    expect(state.showNodeContextToAI).toBe(false);
    expect(state.showOriginalImageToAI).toBe(false);
    expect(state.showImageQuickActions).toBe(false);
    expect(state.showCopyOriginalImage).toBe(false);
    expect(state.showBackgroundToTransparent).toBe(false);
  });

  it('shows background-to-transparent for a single image with data even when AI is unavailable', () => {
    const state = resolveCanvasImageContextMenuState({
      bridgeConnected: false,
      canAddScreenshotToAI: false,
      canAddNodesToAI: false,
      canAddImageToAI: false,
      selectedElements: [
        { id: 'image-1', type: 'image', fileId: 'file-1' },
      ],
      files: {
        'file-1': { dataURL: 'data:image/png;base64,original' },
      },
    });

    expect(state.isSingleImageSelection).toBe(true);
    expect(state.singleImageHasOriginalData).toBe(true);
    expect(state.showCopyOriginalImage).toBe(true);
    expect(state.showBackgroundToTransparent).toBe(true);
    expect(state.showOriginalImageToAI).toBe(false);
    expect(state.showImageQuickActions).toBe(false);
  });
});
