export const DRAWIO_CUSTOM_TYPE = 'axhub-drawio';
export const DRAWIO_PREVIEW_KIND = 'drawio';
export const DRAWIO_INSERT_EVENT_NAME = 'axhub:insertDrawioNode';

export interface CreateDrawioElementOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  fileId?: string;
}

export interface CreateDrawioFileOptions {
  fileId: string;
  xml?: string;
}

export interface CreateDrawioSavedFileOptions {
  dataURL: string;
  fileId?: string;
}

export interface DrawioSvgDimensions {
  width: number;
  height: number;
}

export interface UpdateDrawioElementFileOptions {
  dataURL?: string;
}

const DEFAULT_DRAWIO_WIDTH = 360;
const DEFAULT_DRAWIO_HEIGHT = 260;
const DRAWIO_PREVIEW_FILL = '#e5e7eb';
const DRAWIO_DEFAULT_XML = '<mxfile host="embed.diagrams.net"><diagram id="axhub-drawio-default" name="Page-1"><mxGraphModel dx="960" dy="540" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function encodeBase64(value: string): string {
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(value)));
  }
  return (globalThis as any).Buffer.from(value, 'utf8').toString('base64');
}

function decodeBase64(value: string): string {
  if (typeof atob === 'function') {
    return decodeURIComponent(escape(atob(value)));
  }
  return (globalThis as any).Buffer.from(value, 'base64').toString('utf8');
}

function decodeBase64Binary(value: string): string {
  if (typeof atob === 'function') return atob(value);
  return (globalThis as any).Buffer.from(value, 'base64').toString('binary');
}

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

function unescapeXmlAttribute(value: string): string {
  return value
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&gt;/gu, '>')
    .replace(/&lt;/gu, '<')
    .replace(/&amp;/gu, '&');
}

function extractMxfileXml(value: string): string | null {
  const directMatch = value.match(/<mxfile[\s\S]*?<\/mxfile>/u);
  return directMatch?.[0] || null;
}

function extractMxGraphModelXml(value: string): string | null {
  const graphModelMatch = value.match(/<mxGraphModel\b[\s\S]*?<\/mxGraphModel>/u);
  return graphModelMatch?.[0] || null;
}

function wrapMxGraphModelXml(graphModelXml: string): string {
  return `<mxfile host="embed.diagrams.net"><diagram id="axhub-drawio-generated" name="Page-1">${graphModelXml}</diagram></mxfile>`;
}

function normalizeDrawioXml(value: string): string | null {
  const mxfileXml = extractMxfileXml(value);
  if (mxfileXml) return mxfileXml;
  const graphModelXml = extractMxGraphModelXml(value);
  return graphModelXml ? wrapMxGraphModelXml(graphModelXml) : null;
}

function hasEditableDiagramSource(xml: string): boolean {
  if (/<mxGraphModel\b[\s\S]*?<\/mxGraphModel>/u.test(xml)) return true;
  const diagramMatches = xml.matchAll(/<diagram\b[^>]*>([\s\S]*?)<\/diagram>/gu);
  for (const match of diagramMatches) {
    const payload = (match[1] || '').trim();
    if (!payload) continue;
    if (/<mxGraphModel\b[\s\S]*?<\/mxGraphModel>/u.test(payload)) return true;
    try {
      decodeBase64Binary(payload);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function decodeEmbeddedDrawioXml(value: string): string | null {
  const unescapedValue = unescapeXmlAttribute(value.trim());
  const directXml = normalizeDrawioXml(unescapedValue);
  if (directXml) return directXml;
  try {
    return normalizeDrawioXml(decodeBase64(unescapedValue));
  } catch {
    return null;
  }
}

function createBaseImageElement(options: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fileId: string;
  customData?: Record<string, unknown>;
}) {
  return {
    id: options.id,
    type: 'image' as const,
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    angle: 0 as any,
    strokeColor: 'transparent',
    backgroundColor: 'transparent',
    fillStyle: 'solid' as any,
    strokeWidth: 0,
    strokeStyle: 'solid' as any,
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: null,
    roundness: null,
    seed: Math.floor(Math.random() * 2147483647),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    fileId: options.fileId,
    status: 'saved',
    scale: [1, 1] as [number, number],
    crop: null,
    customData: options.customData || {},
  };
}

function readDataUrlText(dataURL: string): string {
  const match = dataURL.match(/^data:image\/svg\+xml((?:;[^,]+)*),(.*)$/u);
  if (!match) return '';
  const payload = match[2] || '';
  if ((match[1] || '').split(';').includes('base64')) {
    return decodeBase64(payload);
  }
  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

function parseSvgDimensionAttribute(svg: string, attribute: 'width' | 'height'): number | null {
  const match = svg.match(new RegExp(`\\s${attribute}=(["'])([^"']+)\\1`, 'u'));
  const rawValue = match?.[2]?.trim();
  if (!rawValue || rawValue.endsWith('%')) return null;
  const valueMatch = rawValue.match(/^([0-9]+(?:\.[0-9]+)?)(?:px|pt|in|cm|mm)?$/u);
  if (!valueMatch) return null;
  const value = Number(valueMatch[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseSvgViewBoxDimensions(svg: string): DrawioSvgDimensions | null {
  const match = svg.match(/\sviewBox=(["'])([^"']+)\1/u);
  const values = match?.[2]?.trim().split(/[\s,]+/u).map(Number).filter((value) => Number.isFinite(value));
  if (!values || values.length !== 4) return null;
  const [, , width, height] = values;
  return width > 0 && height > 0 ? { width, height } : null;
}

function createDrawioSvg(xml: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${DEFAULT_DRAWIO_WIDTH}" height="${DEFAULT_DRAWIO_HEIGHT}" viewBox="0 0 ${DEFAULT_DRAWIO_WIDTH} ${DEFAULT_DRAWIO_HEIGHT}" role="img" aria-label="Drawio 图表" content="${escapeXmlAttribute(xml)}">
  <rect width="${DEFAULT_DRAWIO_WIDTH}" height="${DEFAULT_DRAWIO_HEIGHT}" rx="12" fill="${DRAWIO_PREVIEW_FILL}"/>
</svg>`;
}

export function createDrawioSvgDataUrl(xml: string = DRAWIO_DEFAULT_XML): string {
  return `data:image/svg+xml;base64,${encodeBase64(createDrawioSvg(xml))}`;
}

export function createDrawioElement(options: CreateDrawioElementOptions) {
  const width = options.width || DEFAULT_DRAWIO_WIDTH;
  const height = options.height || DEFAULT_DRAWIO_HEIGHT;
  const fileId = options.fileId || randomId('drawio-file');
  return createBaseImageElement({
    id: randomId('drawio'),
    x: options.x,
    y: options.y,
    width,
    height,
    fileId,
    customData: {
      type: DRAWIO_CUSTOM_TYPE,
      title: 'Drawio 图表',
      previewKind: DRAWIO_PREVIEW_KIND,
    },
  });
}

export function createDrawioFile({ fileId, xml = DRAWIO_DEFAULT_XML }: CreateDrawioFileOptions) {
  return {
    id: fileId as any,
    mimeType: 'image/svg+xml' as any,
    dataURL: createDrawioSvgDataUrl(xml),
    created: Date.now(),
    lastRetrieved: Date.now(),
  };
}

export function createDrawioSavedFile({ dataURL, fileId = randomId('drawio-file') }: CreateDrawioSavedFileOptions) {
  return {
    id: fileId as any,
    mimeType: 'image/svg+xml' as any,
    dataURL,
    created: Date.now(),
    lastRetrieved: Date.now(),
  };
}

export function extractDrawioSvgDimensionsFromDataUrl(dataURL: string): DrawioSvgDimensions | null {
  const svg = readDataUrlText(dataURL);
  if (!svg) return null;
  const width = parseSvgDimensionAttribute(svg, 'width');
  const height = parseSvgDimensionAttribute(svg, 'height');
  if (width && height) {
    return { width, height };
  }
  return parseSvgViewBoxDimensions(svg);
}

export function isDrawioElement(element: any): boolean {
  if (element?.type !== 'image') return false;
  const customData = element?.customData || {};
  return (
    customData.type === DRAWIO_CUSTOM_TYPE
    || customData.previewKind === DRAWIO_PREVIEW_KIND
    || customData.aiArtifact?.kind === 'drawio'
  );
}

export function extractDrawioXmlFromImageFile(file: any): string {
  const svg = readDataUrlText(String(file?.dataURL || file?.dataUrl || ''));
  if (!svg) return DRAWIO_DEFAULT_XML;
  const contentMatch = svg.match(/\scontent=(["'])([\s\S]*?)\1/u);
  if (contentMatch?.[2]) {
    const content = decodeEmbeddedDrawioXml(contentMatch[2]);
    if (content) return content;
  }
  const dataDrawioMatch = svg.match(/\sdata-drawio=(["'])([\s\S]*?)\1/u);
  if (dataDrawioMatch?.[2]) {
    const dataDrawioXml = decodeEmbeddedDrawioXml(dataDrawioMatch[2]);
    if (dataDrawioXml) return dataDrawioXml;
  }
  const metadataMatch = svg.match(/<metadata\b[^>]*\bid=(["'])drawio-source\1[^>]*>([\s\S]*?)<\/metadata>/u);
  if (metadataMatch?.[2]) {
    const metadataXml = decodeEmbeddedDrawioXml(metadataMatch[2]);
    if (metadataXml) return metadataXml;
  }
  const directXml = normalizeDrawioXml(svg);
  if (directXml) return directXml;
  return DRAWIO_DEFAULT_XML;
}

export function extractEditableDrawioXmlFromImageFile(file: any): string | null {
  const svg = readDataUrlText(String(file?.dataURL || file?.dataUrl || ''));
  if (!svg) return null;
  const contentMatch = svg.match(/\scontent=(["'])([\s\S]*?)\1/u);
  if (contentMatch?.[2]) {
    const content = decodeEmbeddedDrawioXml(contentMatch[2]);
    if (content && hasEditableDiagramSource(content)) return content;
  }
  const dataDrawioMatch = svg.match(/\sdata-drawio=(["'])([\s\S]*?)\1/u);
  if (dataDrawioMatch?.[2]) {
    const dataDrawioXml = decodeEmbeddedDrawioXml(dataDrawioMatch[2]);
    if (dataDrawioXml && hasEditableDiagramSource(dataDrawioXml)) return dataDrawioXml;
  }
  const metadataMatch = svg.match(/<metadata\b[^>]*\bid=(["'])drawio-source\1[^>]*>([\s\S]*?)<\/metadata>/u);
  if (metadataMatch?.[2]) {
    const metadataXml = decodeEmbeddedDrawioXml(metadataMatch[2]);
    if (metadataXml && hasEditableDiagramSource(metadataXml)) return metadataXml;
  }
  const directXml = normalizeDrawioXml(svg);
  if (directXml && hasEditableDiagramSource(directXml)) return directXml;
  return null;
}

export function updateDrawioElementFile(element: any, fileId: string, options: UpdateDrawioElementFileOptions = {}) {
  const dimensions = options.dataURL ? extractDrawioSvgDimensionsFromDataUrl(options.dataURL) : null;
  const currentWidth = Math.max(1, Number(element.width) || dimensions?.width || DEFAULT_DRAWIO_WIDTH);
  const ratioHeight = dimensions
    ? Math.max(1, Math.round(currentWidth * (dimensions.height / dimensions.width)))
    : element.height;
  return {
    ...element,
    fileId,
    width: currentWidth,
    height: ratioHeight,
    version: (element.version || 0) + 1,
    versionNonce: Math.floor(Math.random() * 2147483647),
    updated: Date.now(),
  };
}
