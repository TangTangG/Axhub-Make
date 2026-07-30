import type { FloatingPosition } from './floating-drag';

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ClampPositionOptions {
  position: FloatingPosition;
  size: { width: number; height: number };
  viewport: ViewportSize;
  margin: number;
}

export interface CompactPanelPositionOptions {
  actionRect?: RectLike | null;
  floatingPosition?: FloatingPosition | null;
  viewport: ViewportSize;
  panelWidth: number;
  panelTop: number;
  panelRight: number;
  panelBottom?: number;
  compactSize: number;
  compactWidth?: number;
  compactHeight?: number;
  margin: number;
  headerPaddingX: number;
  headerPaddingY: number;
  controlSize: number;
}

export interface DockFloatingPanelRightOptions {
  currentPosition?: FloatingPosition | null;
  size: { width: number; height: number };
  viewport: ViewportSize;
  panelTop: number;
  panelRight: number;
  margin: number;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.min(hi, Math.max(lo, value));
}

export function clampFloatingPosition(options: ClampPositionOptions): FloatingPosition {
  const { position, size, viewport } = options;
  const margin = Number.isFinite(options.margin) ? Math.max(0, options.margin) : 0;
  const maxLeft = Math.max(margin, viewport.width - margin - size.width);
  const maxTop = Math.max(margin, viewport.height - margin - size.height);

  return {
    left: Math.round(clampNumber(position.left, margin, maxLeft)),
    top: Math.round(clampNumber(position.top, margin, maxTop)),
  };
}

export function computeCompactPanelPosition(
  options: CompactPanelPositionOptions,
): FloatingPosition {
  const {
    actionRect,
    floatingPosition,
    viewport,
    panelWidth,
    panelTop,
    panelRight,
    panelBottom,
    compactSize,
    compactWidth,
    compactHeight,
    margin,
    headerPaddingX,
    headerPaddingY,
    controlSize,
  } = options;
  const width = Math.max(0, compactWidth ?? compactSize);
  const height = Math.max(0, compactHeight ?? compactSize);

  const fallbackShellLeft = floatingPosition?.left ?? viewport.width - panelRight - panelWidth;
  const fallbackShellTop = floatingPosition?.top ?? (
    panelBottom !== undefined
      ? viewport.height - panelBottom - height
      : panelTop
  );

  const nextPosition = actionRect
    ? {
        left: actionRect.left + (actionRect.width - width) / 2,
        top: actionRect.top + (actionRect.height - height) / 2,
      }
    : {
        left: fallbackShellLeft + panelWidth - headerPaddingX - width,
        top: fallbackShellTop + headerPaddingY + (controlSize - height) / 2,
      };

  return clampFloatingPosition({
    position: nextPosition,
    size: { width, height },
    viewport,
    margin,
  });
}

export function dockFloatingPanelRight(options: DockFloatingPanelRightOptions): FloatingPosition {
  const { currentPosition, size, viewport, panelTop, panelRight, margin } = options;

  return clampFloatingPosition({
    position: {
      left: viewport.width - panelRight - size.width,
      top: currentPosition?.top ?? panelTop,
    },
    size,
    viewport,
    margin,
  });
}
