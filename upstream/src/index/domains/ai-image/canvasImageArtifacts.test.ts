import { describe, expect, it, vi } from 'vitest';

vi.mock('@axhub/excalidraw', () => ({
  getCommonBounds: (elements: any[]) => {
    const xs = elements.map((element) => Number(element.x) || 0);
    const ys = elements.map((element) => Number(element.y) || 0);
    const rights = elements.map((element) => (Number(element.x) || 0) + (Number(element.width) || 0));
    const bottoms = elements.map((element) => (Number(element.y) || 0) + (Number(element.height) || 0));
    return [Math.min(...xs), Math.min(...ys), Math.max(...rights), Math.max(...bottoms)];
  },
  getVisibleSceneBounds: (appState: any) => {
    const zoom = typeof appState.zoom === 'number' ? appState.zoom : appState.zoom?.value || 1;
    const left = (appState.scrollX || 0) * -1;
    const top = (appState.scrollY || 0) * -1;
    return [left, top, left + appState.width / zoom, top + appState.height / zoom];
  },
}));

import { createAiImageGenerationSlots, createAiImageGeneratorElement } from './canvasAiImage';
import {
  createCanvasImageArtifactEventFromAiImageTask,
  resolveCanvasImageArtifactUpdate,
  type CanvasImageArtifactEvent,
} from './canvasImageArtifacts';
import type { AiImageTaskRecord } from './aiImageStore';

function createDoneTask(overrides: Partial<AiImageTaskRecord> = {}): AiImageTaskRecord {
  return {
    id: 'task-one',
    prompt: '生成图片',
    params: {
      size: '1024x1024',
      quality: 'high',
      output_format: 'png',
      output_compression: null,
      moderation: 'auto',
      n: 1,
    },
    status: 'done',
    stage: 'done',
    error: null,
    createdAt: 1000,
    finishedAt: 1500,
    elapsed: 500,
    outputImages: ['image-one'],
    ...overrides,
  };
}

describe('canvas image artifact listener helpers', () => {
  it('creates a canvas image artifact event from a completed image task', () => {
    const task = createDoneTask({ generatorElementId: 'generator-one' });
    const event = createCanvasImageArtifactEventFromAiImageTask(task, {
      sourceScene: 'design',
      getImage: (imageId) => ({
        id: imageId,
        dataUrl: 'data:image/png;base64,one',
        width: 1024,
        height: 1024,
        createdAt: 1000,
        source: 'generated',
      }),
    });

    expect(event).toEqual({
      taskId: 'task-one',
      sourceScene: 'design',
      generatorElementId: 'generator-one',
      images: [{
        imageId: 'image-one',
        dataUrl: 'data:image/png;base64,one',
        displaySize: '1024x1024',
        width: 1024,
        height: 1024,
      }],
    });
  });

  it('creates incremental canvas artifact events for newly available images while a task is still running', () => {
    const task = createDoneTask({
      status: 'running',
      stage: 'downloading',
      finishedAt: null,
      elapsed: null,
      outputImages: ['image-one', 'image-two'],
      generatorElementId: 'generator-one',
    });
    const event = createCanvasImageArtifactEventFromAiImageTask(task, {
      sourceScene: 'design',
      consumedImageIds: new Set(['image-one']),
      getImage: (imageId) => ({
        id: imageId,
        dataUrl: `data:image/png;base64,${imageId}`,
        width: 512,
        height: 512,
        createdAt: 1000,
        source: 'generated',
      }),
    });

    expect(event).toEqual({
      taskId: 'task-one',
      sourceScene: 'design',
      generatorElementId: 'generator-one',
      images: [{
        imageId: 'image-two',
        dataUrl: 'data:image/png;base64,image-two',
        displaySize: '1024x1024',
        width: 512,
        height: 512,
      }],
    });
  });

  it('replaces the bound generator when a canvas image artifact has a generator element id', () => {
    const generator = createAiImageGeneratorElement({
      x: 100,
      y: 120,
      width: 320,
      height: 240,
    });
    const event: CanvasImageArtifactEvent = {
      taskId: 'task-one',
      sourceScene: 'design',
      generatorElementId: generator.id,
      images: [{
        imageId: 'image-one',
        dataUrl: 'data:image/png;base64,one',
        width: 1024,
        height: 1024,
      }],
    };

    const update = resolveCanvasImageArtifactUpdate({
      elements: [generator],
      appState: { width: 1200, height: 800, scrollX: 0, scrollY: 0, zoom: { value: 1 } },
      event,
    });

    expect(update.usedFallbackPlacement).toBe(false);
    expect(update.elements[0]).toMatchObject({
      id: generator.id,
      isDeleted: true,
    });
    expect(update.elements[1]).toMatchObject({
      x: 100,
      y: 120,
      fileId: 'image-one',
      customData: {},
    });
    expect(update.selectedElementIds).toEqual({
      [update.elements[1].id]: true,
    });
  });

  it('replaces the next queued image loading slot when multiple slots already exist', () => {
    const generator = createAiImageGeneratorElement({
      x: 100,
      y: 120,
      width: 320,
      height: 240,
    });
    const queued = createAiImageGenerationSlots({
      elements: [generator],
      generatorId: generator.id,
      taskId: 'task-one',
      count: 2,
      width: 512,
      height: 512,
    });
    const firstEvent: CanvasImageArtifactEvent = {
      taskId: 'task-one',
      sourceScene: 'design',
      generatorElementId: generator.id,
      images: [{
        imageId: 'image-one',
        dataUrl: 'data:image/png;base64,one',
        width: 1024,
        height: 1024,
      }],
    };

    const firstUpdate = resolveCanvasImageArtifactUpdate({
      elements: queued.elements,
      appState: { width: 1200, height: 800, scrollX: 0, scrollY: 0, zoom: { value: 1 } },
      event: firstEvent,
    });
    const secondUpdate = resolveCanvasImageArtifactUpdate({
      elements: firstUpdate.elements,
      appState: { width: 1200, height: 800, scrollX: 0, scrollY: 0, zoom: { value: 1 } },
      event: {
        taskId: 'task-one',
        sourceScene: 'design',
        generatorElementId: generator.id,
        images: [{
          imageId: 'image-two',
          dataUrl: 'data:image/png;base64,two',
          width: 1024,
          height: 1024,
        }],
      },
    });

    const inserted = secondUpdate.elements.filter((element) => (
      element.type === 'image'
      && (element.fileId === 'image-one' || element.fileId === 'image-two')
      && !element.isDeleted
    ));
    expect(inserted.map((element) => element.fileId)).toEqual(['image-one', 'image-two']);
    expect(inserted[0].x).toBe(100);
    expect(inserted[1].x).toBe(100 + 512 + 24);
    expect(inserted.map((element) => element.customData)).toEqual([{}, {}]);
    expect(secondUpdate.elements.filter((element) => element.customData?.generationTaskId === 'task-one' && !element.isDeleted)).toHaveLength(0);
  });

  it('inserts unbound image artifacts at the default canvas placement and selects them', () => {
    const existingElement = {
      id: 'existing',
      type: 'rectangle',
      x: 40,
      y: 50,
      width: 200,
      height: 100,
      isDeleted: false,
    };
    const event: CanvasImageArtifactEvent = {
      taskId: 'task-unbound',
      sourceScene: 'design',
      images: [{
        imageId: 'image-one',
        dataUrl: 'data:image/png;base64,one',
        width: 512,
        height: 512,
      }],
    };

    const update = resolveCanvasImageArtifactUpdate({
      elements: [existingElement],
      appState: { width: 1200, height: 800, scrollX: 0, scrollY: 0, zoom: { value: 1 } },
      event,
    });

    expect(update.usedFallbackPlacement).toBe(true);
    expect(update.elements).toHaveLength(2);
    expect(update.elements[0]).toBe(existingElement);
    expect(update.elements[1]).toMatchObject({
      x: 40,
      y: 270,
      fileId: 'image-one',
    });
    expect(update.elements[1].customData?.type).toBeUndefined();
    expect(update.elements[1].customData?.sourceTaskId).toBeUndefined();
    expect(Object.keys(update.selectedElementIds)).toEqual([update.elements[1].id]);
    expect(update.scrollTargetId).toBe(update.elements[1].id);
  });
});
