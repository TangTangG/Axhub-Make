import { describe, expect, it, vi } from 'vitest';

import { createAiImageGeneratorElement } from '../ai-image/canvasAiImage';
import {
  CANVAS_GENERATOR_DEFAULT_HEIGHT,
  CANVAS_GENERATOR_DEFAULT_WIDTH,
  CANVAS_GENERATOR_VERTICAL_GAP,
  resolveCanvasGeneratorPlacementFromReferenceElement,
  resolveCanvasGeneratorPlacement,
} from './canvasGeneratorPlacement';

vi.mock('@axhub/excalidraw', () => ({
  getCommonBounds: (elements: readonly any[]) => {
    if (!elements.length) return [0, 0, 0, 0] as const;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const element of elements) {
      const left = element.x || 0;
      const top = element.y || 0;
      const right = left + (element.width || 0);
      const bottom = top + (element.height || 0);
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    }
    return [minX, minY, maxX, maxY] as const;
  },
  getVisibleSceneBounds: ({ scrollX, scrollY, width, height, zoom }: any) => {
    const zoomValue = typeof zoom === 'number' ? zoom : zoom?.value || 1;
    const left = -(scrollX || 0);
    const top = -(scrollY || 0);
    return [
      left,
      top,
      left + width / zoomValue,
      top + height / zoomValue,
    ] as const;
  },
}));

function createAppState(overrides: Partial<{
  scrollX: number;
  scrollY: number;
  width: number;
  height: number;
  zoom: { value: number };
}> = {}) {
  return {
    scrollX: 0,
    scrollY: 0,
    width: 1600,
    height: 1200,
    zoom: { value: 1 },
    ...overrides,
  };
}

describe('canvas generator placement', () => {
  it('falls back to the viewport center when there are no usable scene elements', () => {
    const placement = resolveCanvasGeneratorPlacement({
      elements: [],
      appState: createAppState({ width: 800, height: 600 }),
    });

    expect(placement).toEqual({
      x: (800 / 2) - (CANVAS_GENERATOR_DEFAULT_WIDTH / 2),
      y: (600 / 2) - (CANVAS_GENERATOR_DEFAULT_HEIGHT / 2),
      width: CANVAS_GENERATOR_DEFAULT_WIDTH,
      height: CANVAS_GENERATOR_DEFAULT_HEIGHT,
      needsScroll: false,
    });
  });

  it('adds the next generator below the content bounds using the left edge as the anchor', () => {
    const first = createAiImageGeneratorElement({
      x: 120,
      y: 80,
      width: 240,
      height: 180,
    });
    const second = createAiImageGeneratorElement({
      x: 460,
      y: 200,
      width: 240,
      height: 180,
    });

    const placement = resolveCanvasGeneratorPlacement({
      elements: [first, second],
      appState: createAppState(),
    });

    expect(placement.x).toBe(120);
    expect(placement.y).toBe(200 + 180 + CANVAS_GENERATOR_VERTICAL_GAP);
    expect(placement.width).toBe(CANVAS_GENERATOR_DEFAULT_WIDTH);
    expect(placement.height).toBe(CANVAS_GENERATOR_DEFAULT_HEIGHT);
  });

  it('ignores deleted elements when calculating the placement anchor', () => {
    const alive = createAiImageGeneratorElement({
      x: 300,
      y: 240,
      width: 220,
      height: 140,
    });
    const deleted = createAiImageGeneratorElement({
      x: 40,
      y: 40,
      width: 120,
      height: 120,
    });
    deleted.isDeleted = true;

    const placement = resolveCanvasGeneratorPlacement({
      elements: [deleted, alive],
      appState: createAppState(),
    });

    expect(placement.x).toBe(300);
    expect(placement.y).toBe(240 + 140 + CANVAS_GENERATOR_VERTICAL_GAP);
  });

  it('marks placements outside the visible scene as needing a scroll', () => {
    const source = createAiImageGeneratorElement({
      x: 20,
      y: 30,
      width: 160,
      height: 120,
    });

    const placement = resolveCanvasGeneratorPlacement({
      elements: [source],
      appState: createAppState({ width: 220, height: 220 }),
    });

    expect(placement.needsScroll).toBe(true);
  });

  it('keeps placements that are fully visible from needing a scroll', () => {
    const source = createAiImageGeneratorElement({
      x: 40,
      y: 60,
      width: 160,
      height: 120,
    });

    const placement = resolveCanvasGeneratorPlacement({
      elements: [source],
      appState: createAppState({ width: 1000, height: 800 }),
    });

    expect(placement.needsScroll).toBe(false);
  });

  it('places generators to the right of portrait reference images while preserving the aspect ratio', () => {
    const source = createAiImageGeneratorElement({
      x: 120,
      y: 80,
      width: 240,
      height: 480,
    });

    const placement = resolveCanvasGeneratorPlacementFromReferenceElement({
      referenceElement: source,
      appState: createAppState({ width: 1200, height: 900 }),
    });

    expect(placement.x).toBe(120 + 240 + CANVAS_GENERATOR_VERTICAL_GAP);
    expect(placement.y).toBe(80);
    expect(placement.width).toBe(240);
    expect(placement.height).toBe(480);
    expect(placement.needsScroll).toBe(false);
  });

  it('places generators below landscape reference images while preserving the aspect ratio', () => {
    const source = createAiImageGeneratorElement({
      x: 100,
      y: 160,
      width: 520,
      height: 260,
    });

    const placement = resolveCanvasGeneratorPlacementFromReferenceElement({
      referenceElement: source,
      appState: createAppState({ width: 1200, height: 900 }),
    });

    expect(placement.x).toBe(100);
    expect(placement.y).toBe(160 + 260 + CANVAS_GENERATOR_VERTICAL_GAP);
    expect(placement.width).toBe(520);
    expect(placement.height).toBe(260);
    expect(placement.needsScroll).toBe(false);
  });
});
