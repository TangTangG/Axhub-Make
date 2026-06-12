import { describe, expect, it } from 'vitest';

import {
  PROTOTYPE_PLACEHOLDER_FILE_ID,
  createPrototypeGenerationSlots,
  createPrototypeGeneratorElement,
  createPrototypeGeneratorPlaceholderDataUrl,
  finishPrototypeGenerationSlots,
  isPrototypeGeneratorElement,
  replacePrototypeGeneratorWithEmbeddable,
} from './canvasPrototypeGeneration';
import { createCanvasAiGenerationElement } from '../ai-generation/canvasAiGeneration';

describe('canvas prototype generation helpers', () => {
  it('creates a prototype generator placeholder with SVG metadata', () => {
    const element = createPrototypeGeneratorElement({
      x: 80,
      y: 120,
      width: 360,
      height: 260,
    });

    expect(element.type).toBe('image');
    expect(element.width).toBe(360);
    expect(element.height).toBe(260);
    expect(element.status).toBe('saved');
    expect(element.customData).toMatchObject({
      type: 'axhub-prototype-generator',
      title: 'AI 生成原型',
      previewKind: 'prototype-generator',
    });
    expect(isPrototypeGeneratorElement(element)).toBe(true);
    expect(element.fileId).toBe(PROTOTYPE_PLACEHOLDER_FILE_ID);
    expect(PROTOTYPE_PLACEHOLDER_FILE_ID).toBe('axhub-prototype-generator-placeholder-v4');

    const decodedPlaceholder = decodeURIComponent(escape(atob(createPrototypeGeneratorPlaceholderDataUrl().replace(/^data:image\/svg\+xml;base64,/u, ''))));
    expect(decodedPlaceholder).toContain('role="img"');
    expect(decodedPlaceholder).toContain('aria-label="原型生成器"');
    expect(decodedPlaceholder).toContain('fill="#e5e7eb"');
    expect(decodedPlaceholder.match(/<rect/g)).toHaveLength(1);
    expect(decodedPlaceholder).not.toContain('<g');
    expect(decodedPlaceholder).not.toContain('width="36" height="36"');
    expect(decodedPlaceholder).not.toContain('stroke="#a8b4c3"');
    expect(decodedPlaceholder).not.toContain('stroke-linecap="round"');
    expect(decodedPlaceholder).not.toContain('stroke-linejoin="round"');
    expect(decodedPlaceholder).not.toContain('<path');
    expect(decodedPlaceholder).not.toContain('fill="#cbd5e1"');
    expect(decodedPlaceholder).not.toContain('#008F5D');
    expect(decodedPlaceholder).not.toContain('<text');
    expect(decodedPlaceholder).not.toContain('AI 生成原型');
    expect(decodedPlaceholder).not.toContain('选择后输入原型需求');
    expect(decodedPlaceholder).not.toContain('<linearGradient');
  });

  it('replaces only the matching prototype generator with a preview embeddable', () => {
    const generator = createPrototypeGeneratorElement({
      x: 100,
      y: 200,
      width: 360,
      height: 260,
    });
    const otherGenerator = createPrototypeGeneratorElement({
      x: 480,
      y: 200,
      width: 360,
      height: 260,
    });

    const result = replacePrototypeGeneratorWithEmbeddable({
      elements: [generator, otherGenerator],
      generatorId: generator.id,
      prototype: {
        name: 'checkout-flow',
        displayName: '结账流程',
        previewUrl: '/prototypes/checkout-flow',
        clientUrl: '/prototypes/checkout-flow',
      },
      taskId: 'proto-task-1',
    });

    expect(result.elements).toHaveLength(3);
    expect(result.elements[0]).toMatchObject({
      id: generator.id,
      isDeleted: true,
    });
    expect(result.elements[1]).toMatchObject({
      id: otherGenerator.id,
      isDeleted: false,
    });
    const inserted = result.elements[2];
    expect(inserted).toMatchObject({
      type: 'embeddable',
      x: 100,
      y: 200,
      customData: {
        title: '结账流程',
        resourceType: 'prototype',
        resourceId: 'checkout-flow',
        previewUrl: '/prototypes/checkout-flow',
        embedViewMode: 'preview',
        previewKind: 'web',
        openUrl: '/prototypes/checkout-flow',
        storedPreviewSize: { width: 720, height: 450 },
        embedSizePreset: 'desktop',
        embedContentScale: 0.5,
        captureScreenshotOnMount: true,
        generatedBy: 'axhub-prototype-generator',
        sourceTaskId: 'proto-task-1',
      },
    });
    expect(inserted.width).toBe(720);
    expect(inserted.height).toBe(450);
    expect(inserted.link).toBe('/prototypes/checkout-flow');
    expect(inserted.customData).not.toHaveProperty('prompt');
    expect(result.selectedElementIds).toEqual({ [inserted.id]: true });
  });

  it('creates prototype loading slots at final embeddable size and replaces them one at a time', () => {
    const generator = createPrototypeGeneratorElement({
      x: 100,
      y: 200,
      width: 360,
      height: 260,
    });
    const queued = createPrototypeGenerationSlots({
      elements: [generator],
      generatorId: generator.id,
      taskId: 'proto-task-queue',
      count: 3,
    });

    expect(queued.elements).toHaveLength(3);
    expect(queued.elements.map((element) => element.customData?.generationSlotIndex)).toEqual([0, 1, 2]);
    expect(queued.elements.every((element) => element.width === 720 && element.height === 450)).toBe(true);
    expect(queued.elements.map((element) => element.x)).toEqual([100, 100 + 720 + 24, 100 + (720 + 24) * 2]);

    const first = replacePrototypeGeneratorWithEmbeddable({
      elements: queued.elements,
      generatorId: queued.elements[0].id,
      prototype: {
        name: 'checkout-flow',
        displayName: '结账流程',
        previewUrl: '/prototypes/checkout-flow',
        clientUrl: '/prototypes/checkout-flow',
      },
      taskId: 'proto-task-queue',
    });
    const second = replacePrototypeGeneratorWithEmbeddable({
      elements: first.elements,
      generatorId: queued.elements[1].id,
      prototype: {
        name: 'checkout-alt',
        displayName: '结账备选',
        previewUrl: '/prototypes/checkout-alt',
        clientUrl: '/prototypes/checkout-alt',
      },
      taskId: 'proto-task-queue',
    });

    const inserted = second.elements.filter((element) => element.type === 'embeddable');
    expect(inserted.map((element) => element.customData?.resourceId)).toEqual(['checkout-flow', 'checkout-alt']);
    expect(inserted.map((element) => element.x)).toEqual([100, 100 + 720 + 24]);
    expect(second.elements.filter((element) => element.customData?.generationTaskId === 'proto-task-queue' && !element.isDeleted)).toHaveLength(1);
  });

  it('cleans prototype loading slots on success and keeps failed slots on error', () => {
    const generator = createPrototypeGeneratorElement({ x: 100, y: 200 });
    const queued = createPrototypeGenerationSlots({
      elements: [generator],
      generatorId: generator.id,
      taskId: 'proto-task-cleanup',
      count: 2,
    });
    const replaced = replacePrototypeGeneratorWithEmbeddable({
      elements: queued.elements,
      generatorId: queued.elements[0].id,
      prototype: {
        name: 'checkout-flow',
        displayName: '结账流程',
        previewUrl: '/prototypes/checkout-flow',
        clientUrl: '/prototypes/checkout-flow',
      },
      taskId: 'proto-task-cleanup',
    });

    const success = finishPrototypeGenerationSlots({
      elements: replaced.elements,
      taskId: 'proto-task-cleanup',
      status: 'done',
    });
    expect(success.elements.filter((element) => element.customData?.generationTaskId === 'proto-task-cleanup' && !element.isDeleted)).toHaveLength(0);

    const failure = finishPrototypeGenerationSlots({
      elements: replaced.elements,
      taskId: 'proto-task-cleanup',
      status: 'error',
      error: '原型生成失败',
    });
    const failedSlot = failure.elements.find((element) => element.customData?.generationTaskId === 'proto-task-cleanup' && !element.isDeleted);
    expect(failedSlot).toMatchObject({
      customData: {
        generationSlotStatus: 'error',
        generationError: '原型生成失败',
      },
    });
  });

  it('cleans unified AI generation prototype slots created by the mounted tool', () => {
    const generator = createCanvasAiGenerationElement({
      x: 100,
      y: 200,
      scene: 'page',
      artifactKind: 'prototype',
    });
    const queued = createPrototypeGenerationSlots({
      elements: [generator],
      generatorId: generator.id,
      taskId: 'unified-proto-task',
      count: 2,
    });

    const success = finishPrototypeGenerationSlots({
      elements: queued.elements,
      taskId: 'unified-proto-task',
      status: 'done',
    });
    expect(success.elements.filter((element) => (
      element.customData?.generationTaskId === 'unified-proto-task'
      && !element.isDeleted
    ))).toHaveLength(0);
  });
});
