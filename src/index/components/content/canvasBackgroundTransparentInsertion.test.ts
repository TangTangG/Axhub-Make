import { describe, expect, it, vi } from 'vitest';

import { createCanvasBackgroundTransparentImageUpdate } from './canvasBackgroundTransparentInsertion';

describe('canvas background transparent image insertion', () => {
  it('adds a PNG image file and a selected image element to the right of the source image', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const random = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.123456789)
      .mockReturnValueOnce(0.23456789)
      .mockReturnValue(0.3456789);
    const sourceImage = {
      id: 'image-source',
      type: 'image',
      x: 40,
      y: 60,
      width: 120,
      height: 80,
      angle: 0,
      groupIds: [],
      frameId: null,
      link: null,
      locked: false,
      customData: {
        fileName: 'source.png',
      },
    };

    const update = createCanvasBackgroundTransparentImageUpdate({
      elements: [sourceImage],
      sourceImage,
      dataURL: 'data:image/png;base64,transparent',
    });

    expect(update.files).toEqual([
      expect.objectContaining({
        id: 'transparent-image-1700000000000-4fzzzxj',
        mimeType: 'image/png',
        dataURL: 'data:image/png;base64,transparent',
        created: 1700000000000,
        lastRetrieved: 1700000000000,
      }),
    ]);
    expect(update.elements).toHaveLength(2);
    expect(update.elements[1]).toEqual(expect.objectContaining({
      id: '1700000000000-8fzzzbj',
      type: 'image',
      x: 184,
      y: 60,
      width: 120,
      height: 80,
      fileId: 'transparent-image-1700000000000-4fzzzxj',
      status: 'saved',
      scale: [1, 1],
      crop: null,
      customData: expect.objectContaining({
        sourceElementId: 'image-source',
        localTool: 'background-to-transparent',
        title: 'source.png 背景转透明',
      }),
    }));
    expect(update.appState).toEqual({
      selectedElementIds: {
        '1700000000000-8fzzzbj': true,
      },
      selectedGroupIds: {},
    });

    now.mockRestore();
    random.mockRestore();
  });
});
