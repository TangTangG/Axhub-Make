import { describe, expect, it } from 'vitest';

import {
  resolveStableCanvasGeneratorOverlayBounds,
  shouldFreezeCanvasGeneratorOverlayBounds,
} from './canvasGeneratorOverlayPosition';

describe('canvas generator overlay positioning', () => {
  it('freezes overlay bounds while selected canvas elements are being dragged', () => {
    const stableBounds = new Map();
    const stableElement = {
      id: 'generator-1',
      x: 120,
      y: 80,
      width: 360,
      height: 260,
    };

    expect(resolveStableCanvasGeneratorOverlayBounds(stableElement, {}, stableBounds)).toEqual({
      elementId: 'generator-1',
      x: 120,
      y: 80,
      width: 360,
      height: 260,
    });

    const draggedElement = {
      ...stableElement,
      x: 560,
      y: 420,
    };

    expect(shouldFreezeCanvasGeneratorOverlayBounds({
      selectedElementsAreBeingDragged: true,
    })).toBe(true);
    expect(resolveStableCanvasGeneratorOverlayBounds(draggedElement, {
      selectedElementsAreBeingDragged: true,
    }, stableBounds)).toEqual({
      elementId: 'generator-1',
      x: 120,
      y: 80,
      width: 360,
      height: 260,
    });

    expect(resolveStableCanvasGeneratorOverlayBounds(draggedElement, {}, stableBounds)).toEqual({
      elementId: 'generator-1',
      x: 560,
      y: 420,
      width: 360,
      height: 260,
    });
  });

  it('freezes overlay bounds while a selected canvas element is being resized or rotated', () => {
    expect(shouldFreezeCanvasGeneratorOverlayBounds({ isResizing: true })).toBe(true);
    expect(shouldFreezeCanvasGeneratorOverlayBounds({ resizingElement: { id: 'generator-1' } })).toBe(true);
    expect(shouldFreezeCanvasGeneratorOverlayBounds({ isRotating: true })).toBe(true);
    expect(shouldFreezeCanvasGeneratorOverlayBounds({ selectedLinearElement: { isDragging: true } })).toBe(true);
    expect(shouldFreezeCanvasGeneratorOverlayBounds({ cursorButton: 'down' })).toBe(false);
  });
});
