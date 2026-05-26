export interface CanvasGeneratorPlaceholderOptions {
  width: number;
  height: number;
  ariaLabel: string;
}

export const CANVAS_GENERATOR_PLACEHOLDER_FILL = '#e5e7eb';
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
}: CanvasGeneratorPlaceholderOptions): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeSvgAttribute(ariaLabel)}">
  <rect width="${width}" height="${height}" rx="${CANVAS_GENERATOR_PLACEHOLDER_RADIUS}" fill="${CANVAS_GENERATOR_PLACEHOLDER_FILL}"/>
</svg>`;
  return `data:image/svg+xml;base64,${encodeBase64(svg)}`;
}
