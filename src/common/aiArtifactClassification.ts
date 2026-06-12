export type AiArtifactClassificationKind = 'prototype' | 'image' | 'document' | 'drawio' | 'file' | 'link';

export interface AiArtifactClassificationInput {
  path?: unknown;
  uri?: unknown;
  url?: unknown;
  href?: unknown;
  title?: unknown;
  name?: unknown;
  fileName?: unknown;
  mimeType?: unknown;
  mediaType?: unknown;
  fallbackKind?: unknown;
  svgText?: unknown;
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePath(value: string): string {
  return value.trim().replace(/^file:\/\//u, '').replace(/^axhub:\/\//u, '').replace(/^\/+/u, '').replace(/\\/g, '/');
}

function pathExtension(value: string): string {
  const clean = value.split(/[?#]/u)[0] || '';
  const index = clean.lastIndexOf('.');
  return index >= 0 ? clean.slice(index).toLowerCase() : '';
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = stringField(value);
    if (text) return text;
  }
  return '';
}

function hasExplicitDrawioSignal(value: string): boolean {
  return /(^|[./_-])drawio([./_-]|$)/iu.test(value);
}

function hasDrawioSvgContent(value: string): boolean {
  return value.includes('<mxfile') || value.includes('diagrams.net') || value.includes('mxGraphModel');
}

function normalizeFallbackKind(value: unknown): AiArtifactClassificationKind | '' {
  const kind = stringField(value).toLowerCase();
  if (
    kind === 'prototype'
    || kind === 'image'
    || kind === 'document'
    || kind === 'drawio'
    || kind === 'file'
    || kind === 'link'
  ) {
    return kind;
  }
  return '';
}

function isDocumentExtension(value: string): boolean {
  return ['.md', '.mdx', '.doc', '.docx', '.pdf', '.txt'].includes(value);
}

export function normalizeArtifactResourcePath(value: unknown): string {
  return normalizePath(stringField(value));
}

export function classifyAiArtifact(input: AiArtifactClassificationInput): AiArtifactClassificationKind {
  const pathValue = normalizePath(firstText(input.path));
  const uri = stringField(input.uri);
  const url = stringField(input.url);
  const href = stringField(input.href);
  const targetText = [
    pathValue,
    uri,
    url,
    href,
    stringField(input.title),
    stringField(input.name),
    stringField(input.fileName),
  ].join(' ').toLowerCase();
  const mimeType = firstText(input.mimeType, input.mediaType).toLowerCase();
  const extension = pathExtension(pathValue || uri || url || href || stringField(input.fileName));
  if (isDocumentExtension(extension)) return 'document';
  if (
    /^https?:\/\//iu.test(pathValue)
    || /^https?:\/\//iu.test(uri)
    || /^https?:\/\//iu.test(url)
    || /^https?:\/\//iu.test(href)
  ) return 'link';
  if (targetText.includes('.drawio') || mimeType === 'application/drawio+xml') return 'drawio';
  if (
    (extension === '.svg' || mimeType === 'image/svg+xml')
    && (
      hasExplicitDrawioSignal(targetText)
      || hasDrawioSvgContent(stringField(input.svgText))
    )
  ) {
    return 'drawio';
  }
  if (/^src\/prototypes\/[^/]+(?:\/|$)/iu.test(pathValue) || /^prototypes\/[^/]+(?:\/|$)/iu.test(pathValue)) return 'prototype';
  if (mimeType.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) return 'image';
  const fallbackKind = normalizeFallbackKind(input.fallbackKind);
  return fallbackKind || 'file';
}

export function resolveAiArtifactResourceId(input: {
  kind: AiArtifactClassificationKind;
  path?: unknown;
  uri?: unknown;
  url?: unknown;
  resourceId?: unknown;
  artifactId?: unknown;
  targetArtifactId?: unknown;
  name?: unknown;
}): string {
  const explicitResourceId = firstText(input.resourceId);
  if (explicitResourceId) return stripArtifactResourcePrefix(input.kind, explicitResourceId);
  const pathValue = normalizePath(firstText(input.path));
  if (input.kind === 'prototype') {
    const match = pathValue.match(/^(?:src\/)?prototypes\/([^/]+)/iu);
    if (match?.[1]) return match[1];
  }
  if (pathValue) return stripArtifactResourcePrefix(input.kind, pathValue);
  const url = firstText(input.uri, input.url);
  try {
    const parsed = new URL(url, 'http://localhost');
    const doc = parsed.searchParams.get('doc')?.trim();
    if (doc) return doc;
    const prototype = parsed.searchParams.get('p')?.trim();
    if (prototype) return prototype;
    const resourceId = parsed.searchParams.get('resourceId')?.trim();
    if (resourceId) return resourceId;
  } catch {
    // Fall back below.
  }
  const explicitFallback = firstText(input.artifactId, input.targetArtifactId, input.name);
  if (explicitFallback) return stripArtifactResourcePrefix(input.kind, explicitFallback);
  return stripArtifactResourcePrefix(input.kind, url);
}

export function stripArtifactResourcePrefix(kind: AiArtifactClassificationKind, value: string): string {
  const normalized = normalizePath(value);
  if (kind === 'prototype') {
    const match = normalized.match(/^(?:src\/)?prototypes\/([^/]+)/iu);
    if (match?.[1]) return match[1];
  }
  return normalized
    .replace(/^src\/resources\//iu, '')
    .replace(/^resources\//iu, '')
    .replace(/^docs\//iu, '');
}

export function resolveAiArtifactResourceKey(input: {
  kind: AiArtifactClassificationKind;
  path?: unknown;
  uri?: unknown;
  url?: unknown;
  resourceId?: unknown;
  artifactId?: unknown;
  targetArtifactId?: unknown;
  name?: unknown;
}): string {
  const resourceId = resolveAiArtifactResourceId(input);
  if (!resourceId) return '';
  if (input.kind === 'prototype') return `prototype:${resourceId}`;
  if (input.kind === 'drawio') return `drawio:${resourceId}`;
  if (input.kind === 'document') return `document:${resourceId}`;
  if (input.kind === 'image') return `image:${resourceId}`;
  if (input.kind === 'link') return `link:${resourceId}`;
  return `file:${resourceId}`;
}
