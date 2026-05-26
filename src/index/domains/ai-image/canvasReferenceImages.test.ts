import { describe, expect, it, vi } from 'vitest';

import {
  createCanvasReferenceSnapshot,
  getPrototypeReferenceImageSource,
  renderCanvasReferenceContext,
  renderCanvasReferenceImages,
} from './canvasReferenceImages';

vi.mock('@axhub/excalidraw', () => ({
  exportToBlob: vi.fn(async ({ elements }) => new Blob([
    `rendered:${elements.map((element: any) => element.id).join(',')}`,
  ], { type: 'image/png' })),
  getDataURL: vi.fn(async (blob: Blob) => `data:${blob.type};base64,${await blob.text()}`),
}));

describe('canvas reference image helpers', () => {
  it('captures selected non-deleted elements as individual reference items', () => {
    const snapshot = createCanvasReferenceSnapshot({
      elements: [
        { id: 'one', type: 'rectangle', isDeleted: false },
        { id: 'deleted', type: 'rectangle', isDeleted: true },
        { id: 'two', type: 'ellipse', isDeleted: false },
      ],
      files: { image: { id: 'image', dataURL: 'data:image/png;base64,img' } },
      appState: {
        selectedElementIds: { one: true, deleted: true, two: true },
        viewBackgroundColor: '#ffffff',
      },
    });

    expect(snapshot?.items.map((item) => item.element.id)).toEqual(['one', 'two']);
    expect(snapshot?.files).toEqual({ image: { id: 'image', dataURL: 'data:image/png;base64,img' } });
    expect(snapshot?.appState.viewBackgroundColor).toBe('#ffffff');
  });

  it('prefers a prototype node cover image before rendering the element', async () => {
    const fetchImpl = vi.fn(async () => new Response(new Blob(['cover'], { type: 'image/png' }), { status: 200 }));
    const source = await getPrototypeReferenceImageSource({
      type: 'embeddable',
      customData: {
        resourceType: 'prototype',
        screenshotDataUrl: '',
        screenshotUrl: '/prototypes/home/canvas-assets/screenshot.png',
      },
    }, fetchImpl as any);

    expect(source).toBe('data:image/png;base64,cover');
    expect(fetchImpl).toHaveBeenCalledWith('/prototypes/home/canvas-assets/screenshot.png', { cache: 'no-store' });
  });

  it('renders each selected canvas element separately and includes bound text with its host element', async () => {
    const snapshot = createCanvasReferenceSnapshot({
      elements: [
        {
          id: 'rect',
          type: 'rectangle',
          isDeleted: false,
          boundElements: [{ id: 'label', type: 'text' }],
        },
        { id: 'label', type: 'text', isDeleted: false, containerId: 'rect' },
        { id: 'circle', type: 'ellipse', isDeleted: false },
      ],
      files: {},
      appState: {
        selectedElementIds: { rect: true, circle: true },
        viewBackgroundColor: '#ffffff',
      },
    });

    const images = await renderCanvasReferenceImages(snapshot!);

    expect(images).toEqual([
      'data:image/png;base64,rendered:rect,label',
      'data:image/png;base64,rendered:circle',
    ]);
  });

  it('renders selected frames with the elements inside the frame', async () => {
    const snapshot = createCanvasReferenceSnapshot({
      elements: [
        { id: 'frame-1', type: 'frame', isDeleted: false },
        {
          id: 'card',
          type: 'rectangle',
          isDeleted: false,
          frameId: 'frame-1',
          boundElements: [{ id: 'card-label', type: 'text' }],
        },
        {
          id: 'card-label',
          type: 'text',
          isDeleted: false,
          frameId: 'frame-1',
          containerId: 'card',
        },
        { id: 'outside', type: 'ellipse', isDeleted: false },
      ],
      files: {},
      appState: {
        selectedElementIds: { 'frame-1': true },
        viewBackgroundColor: '#ffffff',
      },
    });

    expect(snapshot?.items[0]?.relatedElements.map((element) => element.id)).toEqual([
      'card',
      'card-label',
    ]);

    const images = await renderCanvasReferenceImages(snapshot!);

    expect(images).toEqual([
      'data:image/png;base64,rendered:frame-1,card,card-label',
    ]);
  });

  it('uses the original Excalidraw image file data URL for pasted image elements', async () => {
    const snapshot = createCanvasReferenceSnapshot({
      elements: [
        {
          id: 'image-element',
          type: 'image',
          isDeleted: false,
          fileId: 'original-file',
        },
      ],
      files: {
        'original-file': {
          id: 'original-file',
          dataURL: 'data:image/png;base64,original',
        },
      },
      appState: {
        selectedElementIds: { 'image-element': true },
      },
    });

    const context = await renderCanvasReferenceContext(snapshot!);

    expect(context.referenceImages).toEqual(['data:image/png;base64,original']);
    expect(context.localContextRefs).toEqual([]);
  });

  it('turns prototype and theme nodes into local context refs instead of screenshot reference images', async () => {
    const snapshot = createCanvasReferenceSnapshot({
      elements: [
        {
          id: 'prototype-node',
          type: 'embeddable',
          isDeleted: false,
          customData: {
            resourceType: 'prototype',
            resourceId: 'checkout-flow',
            title: 'Checkout Flow',
            screenshotUrl: '/prototypes/checkout-flow/canvas-assets/screenshot.png',
          },
        },
        {
          id: 'theme-node',
          type: 'embeddable',
          isDeleted: false,
          customData: {
            type: 'axhub-theme',
            resourceType: 'theme',
            resourceId: 'quiet-saas',
            title: 'Quiet SaaS',
          },
        },
        {
          id: 'shape',
          type: 'rectangle',
          isDeleted: false,
        },
      ],
      files: {},
      appState: {
        selectedElementIds: {
          'prototype-node': true,
          'theme-node': true,
          shape: true,
        },
      },
    });

    const context = await renderCanvasReferenceContext(snapshot!);

    expect(context.localContextRefs).toEqual([
      {
        resourceType: 'prototype',
        resourceId: 'checkout-flow',
        title: 'Checkout Flow',
        paths: [
          'src/prototypes/checkout-flow/index.tsx',
          'src/prototypes/checkout-flow/index.ts',
        ],
      },
      {
        resourceType: 'theme',
        resourceId: 'quiet-saas',
        title: 'Quiet SaaS',
        paths: [
          'src/themes/quiet-saas/DESIGN.md',
          'src/themes/quiet-saas/index.tsx',
          'src/themes/quiet-saas/index.ts',
        ],
      },
    ]);
    expect(context.referenceImages).toEqual(['data:image/png;base64,rendered:shape']);
  });
});
