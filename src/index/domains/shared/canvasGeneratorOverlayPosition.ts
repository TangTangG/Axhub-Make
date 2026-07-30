export interface CanvasGeneratorOverlayBounds {
  elementId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function shouldFreezeCanvasGeneratorOverlayBounds(appState: any): boolean {
  return Boolean(
    appState?.selectedElementsAreBeingDragged
    || appState?.isResizing
    || appState?.resizingElement
    || appState?.isRotating
    || appState?.selectedLinearElement?.isDragging,
  );
}

export function resolveStableCanvasGeneratorOverlayBounds(
  element: any,
  appState: any,
  stableBoundsByElementId: Map<string, CanvasGeneratorOverlayBounds>,
): CanvasGeneratorOverlayBounds {
  const elementId = String(element?.id || '');
  const currentBounds = {
    elementId,
    x: Number(element?.x) || 0,
    y: Number(element?.y) || 0,
    width: Number(element?.width) || 0,
    height: Number(element?.height) || 0,
  };

  if (shouldFreezeCanvasGeneratorOverlayBounds(appState)) {
    return stableBoundsByElementId.get(elementId) || currentBounds;
  }

  stableBoundsByElementId.set(elementId, currentBounds);
  return currentBounds;
}

export function pruneStableCanvasGeneratorOverlayBounds(
  stableBoundsByElementId: Map<string, CanvasGeneratorOverlayBounds>,
  liveElementIds: Set<string>,
): void {
  for (const elementId of stableBoundsByElementId.keys()) {
    if (!liveElementIds.has(elementId)) {
      stableBoundsByElementId.delete(elementId);
    }
  }
}
