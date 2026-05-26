import { exportToBlob, getDataURL } from '@axhub/excalidraw';

export interface CanvasReferenceSnapshotItem {
  element: any;
  relatedElements: any[];
}

export interface CanvasReferenceSnapshot {
  items: CanvasReferenceSnapshotItem[];
  files: Record<string, any>;
  appState: Record<string, any>;
}

export type CanvasLocalContextResourceType = 'prototype' | 'theme';

export interface CanvasLocalContextRef {
  resourceType: CanvasLocalContextResourceType;
  resourceId: string;
  title?: string;
  description?: string;
  paths: string[];
}

export interface CanvasReferenceContext {
  referenceImages: string[];
  localContextRefs: CanvasLocalContextRef[];
}

interface CreateCanvasReferenceSnapshotOptions {
  elements: readonly any[];
  files?: Record<string, any>;
  appState?: Record<string, any>;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function isSelectedElement(element: any, selectedElementIds: Record<string, unknown>): boolean {
  return Boolean(element?.id && selectedElementIds[element.id] && !element.isDeleted);
}

function getBoundTextElements(element: any, elements: readonly any[]): any[] {
  const boundTextIds = new Set<string>();
  for (const boundElement of element?.boundElements || []) {
    if (boundElement?.type === 'text' && boundElement.id) {
      boundTextIds.add(boundElement.id);
    }
  }
  return elements.filter((candidate) => (
    !candidate?.isDeleted
    && candidate?.type === 'text'
    && (
      boundTextIds.has(candidate.id)
      || candidate.containerId === element?.id
    )
  ));
}

function isFrameLikeElement(element: any): boolean {
  return element?.type === 'frame' || element?.type === 'magicframe';
}

function getRelatedReferenceElements(element: any, elements: readonly any[]): any[] {
  const relatedElements: any[] = [];
  const seenIds = new Set<string>();
  const addRelatedElement = (candidate: any) => {
    if (!candidate?.id || candidate.isDeleted || candidate.id === element?.id || seenIds.has(candidate.id)) {
      return;
    }
    seenIds.add(candidate.id);
    relatedElements.push(candidate);
  };
  const addBoundTextForElement = (candidate: any) => {
    for (const boundTextElement of getBoundTextElements(candidate, elements)) {
      addRelatedElement(boundTextElement);
    }
  };
  const addFrameChildren = (frameId: string) => {
    for (const candidate of elements) {
      if (candidate?.frameId !== frameId || candidate.isDeleted) continue;
      addRelatedElement(candidate);
      addBoundTextForElement(candidate);
      if (isFrameLikeElement(candidate)) {
        addFrameChildren(candidate.id);
      }
    }
  };

  addBoundTextForElement(element);
  if (isFrameLikeElement(element) && element?.id) {
    addFrameChildren(element.id);
  }

  return relatedElements;
}

export function createCanvasReferenceSnapshot({
  elements,
  files = {},
  appState = {},
}: CreateCanvasReferenceSnapshotOptions): CanvasReferenceSnapshot | null {
  const selectedElementIds = appState.selectedElementIds && typeof appState.selectedElementIds === 'object'
    ? appState.selectedElementIds as Record<string, unknown>
    : {};
  const selected = elements.filter((element) => isSelectedElement(element, selectedElementIds));
  if (!selected.length) return null;

  return {
    items: selected.map((element) => ({
      element: { ...element },
      relatedElements: getRelatedReferenceElements(element, elements).map((relatedElement) => ({ ...relatedElement })),
    })),
    files: { ...files },
    appState: { ...appState },
  };
}

function isPrototypeElement(element: any): boolean {
  return element?.customData?.resourceType === 'prototype';
}

function isThemeElement(element: any): boolean {
  return element?.customData?.resourceType === 'theme' || element?.customData?.type === 'axhub-theme';
}

function resolveString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeResourceId(value: unknown): string {
  return resolveString(value)
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .at(-1)
    ?.replace(/[^a-z0-9_-]+/giu, '-')
    .replace(/^-+|-+$/gu, '') || '';
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getImageElementDataUrl(element: any, files: Record<string, any>): string | null {
  if (element?.type !== 'image') return null;
  const fileId = resolveString(element.fileId);
  if (!fileId) return null;
  const file = files[fileId];
  return resolveString(file?.dataURL || file?.dataUrl);
}

function createLocalContextRef(element: any): CanvasLocalContextRef | null {
  const customData = element?.customData || {};
  const resourceType: CanvasLocalContextResourceType | null = isPrototypeElement(element)
    ? 'prototype'
    : isThemeElement(element)
      ? 'theme'
      : null;
  if (!resourceType) return null;
  const resourceId = normalizeResourceId(customData.resourceId || customData.name || customData.title);
  if (!resourceId) return null;
  const title = resolveString(customData.title || customData.displayName);
  const description = resolveString(customData.description || customData.summary);
  const baseDir = resourceType === 'prototype'
    ? `src/prototypes/${resourceId}`
    : `src/themes/${resourceId}`;
  const paths = resourceType === 'prototype'
    ? [`${baseDir}/index.tsx`, `${baseDir}/index.ts`]
    : [`${baseDir}/DESIGN.md`, `${baseDir}/index.tsx`, `${baseDir}/index.ts`];

  return {
    resourceType,
    resourceId,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    paths: dedupeStrings(paths),
  };
}

export async function urlToDataUrl(url: string, fetchImpl: FetchLike = fetch): Promise<string> {
  if (url.startsWith('data:')) return url;
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Reference image fetch failed: ${response.status}`);
  }
  return getDataURL(await response.blob());
}

export async function getPrototypeReferenceImageSource(
  element: any,
  fetchImpl: FetchLike = fetch,
): Promise<string | null> {
  if (!isPrototypeElement(element)) return null;
  const customData = element.customData || {};
  const screenshotDataUrl = resolveString(customData.screenshotDataUrl);
  if (screenshotDataUrl) return screenshotDataUrl;

  const screenshotUrl = resolveString(customData.screenshotUrl);
  if (screenshotUrl) {
    return urlToDataUrl(screenshotUrl, fetchImpl);
  }

  const coverUrl = resolveString(customData.coverUrl)
    || resolveString(customData.previewImageUrl)
    || resolveString(customData.thumbnailUrl);
  if (coverUrl) {
    return urlToDataUrl(coverUrl, fetchImpl);
  }

  return null;
}

async function renderElementReferenceImage(
  item: CanvasReferenceSnapshotItem,
  snapshot: CanvasReferenceSnapshot,
): Promise<string> {
  const elements = [item.element, ...item.relatedElements];
  const blob = await exportToBlob({
    elements,
    files: snapshot.files,
    appState: {
      ...snapshot.appState,
      exportBackground: true,
      viewBackgroundColor: snapshot.appState.viewBackgroundColor || '#ffffff',
    },
    mimeType: 'image/png',
    exportPadding: 16,
    maxWidthOrHeight: 1536,
  } as any);
  return getDataURL(blob);
}

export async function renderCanvasReferenceImages(
  snapshot: CanvasReferenceSnapshot,
  options: { fetchImpl?: FetchLike } = {},
): Promise<string[]> {
  return (await renderCanvasReferenceContext(snapshot, options)).referenceImages;
}

export async function renderCanvasReferenceContext(
  snapshot: CanvasReferenceSnapshot,
  options: { fetchImpl?: FetchLike } = {},
): Promise<CanvasReferenceContext> {
  const images: string[] = [];
  const localContextRefs: CanvasLocalContextRef[] = [];
  for (const item of snapshot.items) {
    try {
      const localContextRef = createLocalContextRef(item.element);
      if (localContextRef) {
        localContextRefs.push(localContextRef);
        continue;
      }

      const originalImageDataUrl = getImageElementDataUrl(item.element, snapshot.files);
      images.push(originalImageDataUrl || await renderElementReferenceImage(item, snapshot));
    } catch (error) {
      console.warn('[Axhub AI Image] failed to render canvas reference image', error);
    }
  }
  return { referenceImages: images, localContextRefs };
}
