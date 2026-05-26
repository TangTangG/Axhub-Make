import { getCommonBounds, getVisibleSceneBounds } from '@axhub/excalidraw';

export const CANVAS_GENERATOR_DEFAULT_WIDTH = 360;
export const CANVAS_GENERATOR_DEFAULT_HEIGHT = 260;
export const CANVAS_GENERATOR_VERTICAL_GAP = 120;
export const CANVAS_GENERATOR_REFERENCE_GAP = CANVAS_GENERATOR_VERTICAL_GAP;

export interface CanvasGeneratorPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  needsScroll: boolean;
}

interface CanvasGeneratorPlacementAppState {
  scrollX?: number;
  scrollY?: number;
  width: number;
  height: number;
  zoom?: { value?: number } | number;
}

interface CanvasGeneratorPlacementOptions {
  elements: readonly any[];
  appState: CanvasGeneratorPlacementAppState;
  width?: number;
  height?: number;
  verticalGap?: number;
}

interface ReferenceCanvasGeneratorPlacementOptions {
  appState: CanvasGeneratorPlacementAppState;
  gap?: number;
  referenceElement: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
}

function getZoomValue(appState: CanvasGeneratorPlacementAppState): number {
  if (typeof appState.zoom === 'number') {
    return appState.zoom || 1;
  }
  return appState.zoom?.value || 1;
}

function isRectFullyVisible(
  rect: { x: number; y: number; width: number; height: number },
  visibleBounds: readonly [number, number, number, number],
): boolean {
  const [left, top, right, bottom] = visibleBounds;
  return rect.x >= left && rect.y >= top && rect.x + rect.width <= right && rect.y + rect.height <= bottom;
}

function getViewportCenteredPlacement(
  appState: CanvasGeneratorPlacementAppState,
  width: number,
  height: number,
) {
  const zoom = getZoomValue(appState);
  return {
    x: (appState.scrollX || 0) * -1 + appState.width / zoom / 2 - width / 2,
    y: (appState.scrollY || 0) * -1 + appState.height / zoom / 2 - height / 2,
  };
}

export function resolveCanvasGeneratorPlacement({
  elements,
  appState,
  width = CANVAS_GENERATOR_DEFAULT_WIDTH,
  height = CANVAS_GENERATOR_DEFAULT_HEIGHT,
  verticalGap = CANVAS_GENERATOR_VERTICAL_GAP,
}: CanvasGeneratorPlacementOptions): CanvasGeneratorPlacement {
  const usableElements = elements.filter((element) => element && !element.isDeleted);
  const hasUsableElements = usableElements.length > 0;
  const visibleBounds = getVisibleSceneBounds(appState as any);
  const position = hasUsableElements
    ? (() => {
        const [minX, , , maxY] = getCommonBounds(usableElements as any);
        return {
          x: minX,
          y: maxY + verticalGap,
        };
      })()
    : getViewportCenteredPlacement(appState, width, height);

  return {
    x: position.x,
    y: position.y,
    width,
    height,
    needsScroll: !isRectFullyVisible({
      x: position.x,
      y: position.y,
      width,
      height,
    }, visibleBounds),
  };
}

export function resolveCanvasGeneratorPlacementFromReferenceElement({
  appState,
  gap = CANVAS_GENERATOR_REFERENCE_GAP,
  referenceElement,
}: ReferenceCanvasGeneratorPlacementOptions): CanvasGeneratorPlacement {
  const width = Math.max(1, Math.round(Number(referenceElement.width) || CANVAS_GENERATOR_DEFAULT_WIDTH));
  const height = Math.max(1, Math.round(Number(referenceElement.height) || CANVAS_GENERATOR_DEFAULT_HEIGHT));
  const referenceX = Number(referenceElement.x) || 0;
  const referenceY = Number(referenceElement.y) || 0;
  const isPortrait = height > width;
  const position = isPortrait
    ? {
        x: referenceX + width + gap,
        y: referenceY,
      }
    : {
        x: referenceX,
        y: referenceY + height + gap,
      };
  const visibleBounds = getVisibleSceneBounds(appState as any);

  return {
    x: position.x,
    y: position.y,
    width,
    height,
    needsScroll: !isRectFullyVisible({
      x: position.x,
      y: position.y,
      width,
      height,
    }, visibleBounds),
  };
}
