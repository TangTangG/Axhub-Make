export interface CanvasGeneratorPlaceholderOptions {
  width: number;
  height: number;
  ariaLabel: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export const CANVAS_GENERATOR_PLACEHOLDER_FILL = '#e5e7eb';
export const CANVAS_GENERATOR_PLACEHOLDER_STROKE = '#cbd5e1';
export const CANVAS_GENERATOR_PLACEHOLDER_RADIUS = 12;

function encodeBase64(value: string): string {
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(value)));
  }
  return Buffer.from(value, 'utf8').toString('base64');
}

function escapeSvgAttribute(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

export function createCanvasGeneratorPlaceholderDataUrl({
  width,
  height,
  ariaLabel,
  strokeColor,
  strokeWidth,
}: CanvasGeneratorPlaceholderOptions): string {
  const rectWidth = Math.max(0, width - 1);
  const rectHeight = Math.max(0, height - 1);
  const resolvedStrokeColor = strokeColor || CANVAS_GENERATOR_PLACEHOLDER_STROKE;
  const resolvedStrokeWidth = Number.isFinite(strokeWidth) ? Math.max(0, Number(strokeWidth)) : 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeSvgAttribute(ariaLabel)}">
  <rect x="0.5" y="0.5" width="${rectWidth}" height="${rectHeight}" rx="${CANVAS_GENERATOR_PLACEHOLDER_RADIUS}" fill="${CANVAS_GENERATOR_PLACEHOLDER_FILL}" stroke="${resolvedStrokeColor}" stroke-width="${resolvedStrokeWidth}"/>
</svg>`;
  return `data:image/svg+xml;base64,${encodeBase64(svg)}`;
}
