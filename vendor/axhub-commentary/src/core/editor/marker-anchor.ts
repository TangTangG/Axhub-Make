import type { ViewportRect } from '../../overlay/canvas-overlay';
import type { MarkerAnchor } from './state';

interface CreateMarkerAnchorOptions {
  clientX: number;
  clientY: number;
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  isFixed: boolean;
  offsetX?: number;
  offsetY?: number;
}

interface ViewportPointOptions {
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
}

function normalizeFiniteNumber(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

export function toAnchorXPercent(clientX: number, viewportWidth: number): number {
  const safeWidth = normalizeFiniteNumber(viewportWidth, 0);
  if (safeWidth <= 0) return 0;
  return clampNumber((normalizeFiniteNumber(clientX, 0) / safeWidth) * 100, 0, 100);
}

export function createMarkerAnchor(options: CreateMarkerAnchorOptions): MarkerAnchor {
  const clientX = normalizeFiniteNumber(options.clientX, 0);
  const clientY = normalizeFiniteNumber(options.clientY, 0);
  const scrollX = normalizeFiniteNumber(options.scrollX, 0);
  const scrollY = normalizeFiniteNumber(options.scrollY, 0);
  const isFixed = Boolean(options.isFixed);

  return {
    clientX,
    clientY,
    documentX: clientX + scrollX,
    documentY: clientY + scrollY,
    xPercent: toAnchorXPercent(clientX, options.viewportWidth),
    y: isFixed ? clientY : clientY + scrollY,
    isFixed,
    offsetX: Number.isFinite(Number(options.offsetX)) ? Number(options.offsetX) : undefined,
    offsetY: Number.isFinite(Number(options.offsetY)) ? Number(options.offsetY) : undefined,
  };
}

export function normalizeMarkerAnchor(anchor: Partial<MarkerAnchor> | null | undefined): MarkerAnchor | null {
  if (!anchor) return null;

  const clientX = normalizeFiniteNumber(anchor.clientX, 0);
  const clientY = normalizeFiniteNumber(anchor.clientY, 0);
  const documentX = normalizeFiniteNumber(anchor.documentX, clientX);
  const documentY = normalizeFiniteNumber(anchor.documentY, clientY);
  const isFixed = Boolean(anchor.isFixed);
  const xPercent = Number.isFinite(Number(anchor.xPercent))
    ? normalizeFiniteNumber(anchor.xPercent, 0)
    : toAnchorXPercent(clientX, typeof window !== 'undefined' ? window.innerWidth : 0);
  const y = Number.isFinite(Number(anchor.y))
    ? normalizeFiniteNumber(anchor.y, 0)
    : isFixed
      ? clientY
      : documentY;

  return {
    clientX,
    clientY,
    documentX,
    documentY,
    xPercent,
    y,
    isFixed,
    offsetX: Number.isFinite(Number(anchor.offsetX)) ? Number(anchor.offsetX) : undefined,
    offsetY: Number.isFinite(Number(anchor.offsetY)) ? Number(anchor.offsetY) : undefined,
  };
}

export function getViewportPointFromMarkerAnchor(
  anchor: MarkerAnchor,
  options: ViewportPointOptions,
): { left: number; top: number } {
  const safeAnchor = normalizeMarkerAnchor(anchor) ?? anchor;
  const viewportWidth = normalizeFiniteNumber(options.viewportWidth, 0);
  const scrollX = normalizeFiniteNumber(options.scrollX, 0);
  const scrollY = normalizeFiniteNumber(options.scrollY, 0);

  const left = Number.isFinite(Number(safeAnchor.xPercent))
    ? (normalizeFiniteNumber(safeAnchor.xPercent, 0) / 100) * viewportWidth
    : safeAnchor.isFixed
      ? safeAnchor.clientX
      : safeAnchor.documentX - scrollX;
  const top = Number.isFinite(Number(safeAnchor.y))
    ? safeAnchor.isFixed
      ? normalizeFiniteNumber(safeAnchor.y, 0)
      : normalizeFiniteNumber(safeAnchor.y, 0) - scrollY
    : safeAnchor.isFixed
      ? safeAnchor.clientY
      : safeAnchor.documentY - scrollY;

  return { left, top };
}

export function resolveMarkerAnchorRect(
  anchor: MarkerAnchor | null,
  options: ViewportPointOptions & { liveRect?: ViewportRect | null },
): ViewportRect | null {
  const safeAnchor = normalizeMarkerAnchor(anchor);
  if (!safeAnchor) return null;

  const { liveRect } = options;
  const offsetX = Number(safeAnchor.offsetX);
  const offsetY = Number(safeAnchor.offsetY);
  if (
    liveRect &&
    Number.isFinite(liveRect.left) &&
    Number.isFinite(liveRect.top) &&
    Number.isFinite(offsetX) &&
    Number.isFinite(offsetY)
  ) {
    return {
      left: liveRect.left + clampNumber(offsetX, 0, Math.max(0, liveRect.width)),
      top: liveRect.top + clampNumber(offsetY, 0, Math.max(0, liveRect.height)),
      width: 1,
      height: 1,
    };
  }

  const point = getViewportPointFromMarkerAnchor(safeAnchor, options);
  if (!Number.isFinite(point.left) || !Number.isFinite(point.top)) return null;
  return {
    left: point.left,
    top: point.top,
    width: 1,
    height: 1,
  };
}
