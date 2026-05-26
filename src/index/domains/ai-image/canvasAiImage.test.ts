import { describe, expect, it } from 'vitest';

import {
  AI_IMAGE_PLACEHOLDER_FILE_ID,
  createAiImageGeneratorElement,
  createAiImageResultElements,
  createAiImagePlaceholderDataUrl,
  getAiImageDisplaySize,
  isAiImageElement,
  isAiImageGeneratorElement,
  replaceImageElementWithImageElements,
  replaceGeneratorWithImageElements,
  shouldDeleteAiImageGeneratorFromComposerKeydown,
} from './canvasAiImage';

describe('canvas AI image helpers', () => {
  it('creates a generator element with SVG placeholder metadata', () => {
    const element = createAiImageGeneratorElement({
      x: 120,
      y: 80,
      width: 320,
      height: 240,
    });

    expect(element.type).toBe('image');
    expect(element.width).toBe(320);
    expect(element.height).toBe(240);
    expect(element.status).toBe('saved');
    expect(element.customData).toMatchObject({
      type: 'axhub-ai-image-generator',
      title: 'AI 生成图片',
      previewKind: 'ai-image-generator',
    });
    expect(element.fileId).toBe(AI_IMAGE_PLACEHOLDER_FILE_ID);
    expect(AI_IMAGE_PLACEHOLDER_FILE_ID).toBe('axhub-ai-image-placeholder-v6');
    const decodedPlaceholder = decodeURIComponent(escape(atob(createAiImagePlaceholderDataUrl().replace(/^data:image\/svg\+xml;base64,/u, ''))));
    expect(decodedPlaceholder).toContain('role="img"');
    expect(decodedPlaceholder).toContain('aria-label="图片生成器"');
    expect(decodedPlaceholder).toContain('fill="#e5e7eb"');
    expect(decodedPlaceholder.match(/<rect/g)).toHaveLength(1);
    expect(decodedPlaceholder).not.toContain('<g');
    expect(decodedPlaceholder).not.toContain('width="36" height="36"');
    expect(decodedPlaceholder).not.toContain('stroke="#a8b4c3"');
    expect(decodedPlaceholder).not.toContain('stroke-linecap="round"');
    expect(decodedPlaceholder).not.toContain('stroke-linejoin="round"');
    expect(decodedPlaceholder).not.toContain('<circle');
    expect(decodedPlaceholder).not.toContain('<path');
    expect(decodedPlaceholder).not.toContain('fill="#cbd5e1"');
    expect(decodedPlaceholder).not.toContain('#008F5D');
    expect(decodedPlaceholder).not.toContain('<text');
    expect(decodedPlaceholder).not.toContain('AI 生成图片');
    expect(decodedPlaceholder).not.toContain('选择图片后，在下方输入提示词');
    expect(decodedPlaceholder).not.toContain('<linearGradient');
    expect(decodedPlaceholder).not.toContain('stroke-dasharray');
  });

  it('creates ordinary image result elements at a canvas placement without a generator placeholder', () => {
    const result = createAiImageResultElements({
      x: 10,
      y: 20,
      width: 320,
      height: 240,
      taskId: 'task-history',
      images: [
        {
          dataUrl: 'data:image/png;base64,one',
          width: 1024,
          height: 1024,
          imageId: 'img-one',
        },
        {
          dataUrl: 'data:image/png;base64,two',
          width: 1024,
          height: 1024,
          imageId: 'img-two',
        },
      ],
    });

    expect(result.elements).toHaveLength(2);
    expect(result.elements.every((element) => element.type === 'image')).toBe(true);
    expect(result.elements.every((element) => element.isDeleted === false)).toBe(true);
    expect(result.elements.every((element) => element.customData?.type === 'axhub-ai-image')).toBe(true);
    expect(result.elements.map((element) => element.fileId)).toEqual(['img-one', 'img-two']);
    expect(result.elements[0]).toMatchObject({
      x: 10,
      y: 20,
      customData: {
        type: 'axhub-ai-image',
        generatedBy: 'axhub-ai-image',
        sourceTaskId: 'task-history',
        previewKind: 'image',
      },
    });
    expect(result.elements[0].customData).not.toHaveProperty('prompt');
    expect(result.elements[1].x - (result.elements[0].x + result.elements[0].width)).toBe(24);
    expect(Object.keys(result.selectedElementIds)).toEqual(result.elements.map((element) => element.id));
    expect(result.files).toEqual([
      expect.objectContaining({ id: 'img-one', dataURL: 'data:image/png;base64,one', mimeType: 'image/png' }),
      expect.objectContaining({ id: 'img-two', dataURL: 'data:image/png;base64,two', mimeType: 'image/png' }),
    ]);
  });

  it('replaces a generator element with grouped ordinary image elements', () => {
    const generator = createAiImageGeneratorElement({
      x: 100,
      y: 200,
      width: 320,
      height: 240,
    });
    const result = replaceGeneratorWithImageElements({
      elements: [generator],
      generatorId: generator.id,
      images: [
        {
          dataUrl: 'data:image/png;base64,one',
          width: 1024,
          height: 1024,
          imageId: 'img-one',
        },
        {
          dataUrl: 'data:image/png;base64,two',
          width: 1536,
          height: 1024,
          imageId: 'img-two',
        },
      ],
    });

    expect(result.elements).toHaveLength(3);
    expect(result.elements[0]).toMatchObject({
      id: generator.id,
      isDeleted: true,
    });
    const inserted = result.elements.slice(1);
    expect(inserted.every((element) => element.type === 'image')).toBe(true);
    expect(inserted.every((element) => element.customData?.type !== 'axhub-ai-image-generator')).toBe(true);
    expect(inserted.map((element) => element.fileId)).toEqual(['img-one', 'img-two']);
    expect(inserted[0].groupIds).toEqual(inserted[1].groupIds);
    expect(inserted[0].x).toBe(100);
    expect(inserted[0].y).toBe(200);
    expect(inserted[1].x).toBeGreaterThan(inserted[0].x + inserted[0].width);
    expect(inserted[1].x - (inserted[0].x + inserted[0].width)).toBe(24);
    expect(result.files).toEqual([
      expect.objectContaining({ id: 'img-one', dataURL: 'data:image/png;base64,one', mimeType: 'image/png' }),
      expect.objectContaining({ id: 'img-two', dataURL: 'data:image/png;base64,two', mimeType: 'image/png' }),
    ]);
    expect(result.selectedElementIds).toEqual({
      [inserted[0].id]: true,
      [inserted[1].id]: true,
    });
  });

  it('keeps multi-image results laid out horizontally with the configured gap', () => {
    const generator = createAiImageGeneratorElement({
      x: 50,
      y: 75,
      width: 320,
      height: 240,
    });
    const result = replaceGeneratorWithImageElements({
      elements: [generator],
      generatorId: generator.id,
      images: [
        {
          dataUrl: 'data:image/png;base64,alpha',
          width: 512,
          height: 512,
          imageId: 'alpha',
        },
        {
          dataUrl: 'data:image/png;base64,beta',
          width: 512,
          height: 512,
          imageId: 'beta',
        },
        {
          dataUrl: 'data:image/png;base64,gamma',
          width: 512,
          height: 512,
          imageId: 'gamma',
        },
      ],
    });

    const inserted = result.elements.slice(1);
    expect(inserted.map((element) => element.x)).toEqual([
      50,
      50 + 512 + 24,
      50 + (512 + 24) * 2,
    ]);
  });

  it('uses the requested generation ratio while fitting generated images into a bounded canvas size', () => {
    const generator = createAiImageGeneratorElement({
      x: 40,
      y: 60,
      width: 320,
      height: 240,
    });
    const result = replaceGeneratorWithImageElements({
      elements: [generator],
      generatorId: generator.id,
      images: [
        {
          dataUrl: 'data:image/png;base64,wide',
          width: 4000,
          height: 4000,
          imageId: 'wide-image',
          displaySize: '2048x1152',
        } as any,
        {
          dataUrl: 'data:image/png;base64,portrait',
          width: 4000,
          height: 4000,
          imageId: 'portrait-image',
          displaySize: '1152x2048',
        } as any,
      ],
    });

    const inserted = result.elements.slice(1);
    expect(inserted[0]).toMatchObject({
      width: 512,
      height: 288,
    });
    expect(inserted[1]).toMatchObject({
      width: 288,
      height: 512,
    });
  });

  it('calculates bounded display sizes from selected image size presets', () => {
    expect(getAiImageDisplaySize('2048x1152')).toEqual({ width: 512, height: 288 });
    expect(getAiImageDisplaySize('1152x2048')).toEqual({ width: 288, height: 512 });
    expect(getAiImageDisplaySize('1024x1024')).toEqual({ width: 512, height: 512 });
    expect(getAiImageDisplaySize('auto')).toBeNull();
  });

  it('only treats generated result images as history-capable images', () => {
    const generator = createAiImageGeneratorElement({ x: 0, y: 0 });
    const ordinaryImage = {
      type: 'image',
      customData: {
        title: '普通图片',
      },
    };
    const generatedImage = {
      type: 'image',
      customData: {
        type: 'axhub-ai-image',
      },
    };

    expect(isAiImageGeneratorElement(generator)).toBe(true);
    expect(isAiImageElement(generator)).toBe(false);
    expect(isAiImageElement(ordinaryImage)).toBe(false);
    expect(isAiImageElement(generatedImage)).toBe(true);
  });

  it('allows deleting a selected generator from an empty image-to-image composer', () => {
    const emptyInput = {
      value: '',
      tagName: 'TEXTAREA',
    };
    const composerRoot = {
      contains: (target: unknown) => target === emptyInput || target === 'attachment-chip',
    };

    expect(shouldDeleteAiImageGeneratorFromComposerKeydown({
      key: 'Backspace',
      target: emptyInput,
      composerRoot,
    })).toBe(true);
    expect(shouldDeleteAiImageGeneratorFromComposerKeydown({
      key: 'Delete',
      target: 'attachment-chip',
      composerRoot,
    })).toBe(true);
  });

  it('does not delete a generator while editing non-empty composer text', () => {
    const nonEmptyInput = {
      value: 'keep editing',
      tagName: 'TEXTAREA',
    };
    const whitespaceInput = {
      value: '   ',
      tagName: 'TEXTAREA',
    };
    const composerRoot = {
      contains: (target: unknown) => target === nonEmptyInput || target === whitespaceInput,
    };

    expect(shouldDeleteAiImageGeneratorFromComposerKeydown({
      key: 'Backspace',
      target: nonEmptyInput,
      composerRoot,
    })).toBe(false);
    expect(shouldDeleteAiImageGeneratorFromComposerKeydown({
      key: 'Backspace',
      target: whitespaceInput,
      composerRoot,
    })).toBe(false);
    expect(shouldDeleteAiImageGeneratorFromComposerKeydown({
      key: 'Delete',
      target: nonEmptyInput,
      composerRoot,
    })).toBe(true);
    expect(shouldDeleteAiImageGeneratorFromComposerKeydown({
      key: 'Enter',
      target: {
        value: '',
        tagName: 'TEXTAREA',
      },
      composerRoot,
    })).toBe(false);
  });

  it('replaces a selected ordinary image with historical generated images', () => {
    const ordinaryImage = {
      id: 'plain-image',
      type: 'image',
      x: 80,
      y: 120,
      width: 280,
      height: 180,
      isDeleted: false,
      version: 1,
      customData: {
        title: '普通图片',
      },
    };

    const result = replaceImageElementWithImageElements({
      elements: [ordinaryImage],
      imageElementId: ordinaryImage.id,
      images: [{
        dataUrl: 'data:image/png;base64,history',
        width: 512,
        height: 512,
        imageId: 'history-image',
      }],
      taskId: 'task-history',
    });

    expect(result.elements[0]).toMatchObject({
      id: ordinaryImage.id,
      isDeleted: true,
    });
    expect(result.elements[1]).toMatchObject({
      type: 'image',
      x: 80,
      y: 120,
      fileId: 'history-image',
      customData: {
        type: 'axhub-ai-image',
        generatedBy: 'axhub-ai-image',
        sourceTaskId: 'task-history',
        previewKind: 'image',
      },
    });
    expect(result.elements[1].customData).not.toHaveProperty('prompt');
    expect(result.selectedElementIds).toEqual({
      [result.elements[1].id]: true,
    });
  });
});
