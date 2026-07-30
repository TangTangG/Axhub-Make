import { describe, expect, it } from 'vitest';

import { collectCanvasScreenshotElementsForSelection } from './canvasSelectionCapture';

describe('canvas selection capture helpers', () => {
  it('includes frame children when rendering a selected frame screenshot', () => {
    const elements = [
      { id: 'frame-1', type: 'frame', isDeleted: false },
      { id: 'card', type: 'rectangle', isDeleted: false, frameId: 'frame-1' },
      { id: 'label', type: 'text', isDeleted: false, frameId: 'frame-1', containerId: 'card' },
      { id: 'outside', type: 'ellipse', isDeleted: false },
    ];

    const result = collectCanvasScreenshotElementsForSelection(elements, new Set(['frame-1']));

    expect(result.map((element) => element.id)).toEqual(['frame-1', 'card', 'label']);
  });

  it('includes nested frame descendants without duplicating selected children', () => {
    const elements = [
      { id: 'outer-frame', type: 'frame', isDeleted: false },
      { id: 'inner-frame', type: 'magicframe', isDeleted: false, frameId: 'outer-frame' },
      { id: 'inner-card', type: 'rectangle', isDeleted: false, frameId: 'inner-frame' },
      { id: 'selected-card', type: 'rectangle', isDeleted: false, frameId: 'outer-frame' },
    ];

    const result = collectCanvasScreenshotElementsForSelection(
      elements,
      new Set(['outer-frame', 'selected-card']),
    );

    expect(result.map((element) => element.id)).toEqual([
      'outer-frame',
      'inner-frame',
      'inner-card',
      'selected-card',
    ]);
  });
});
