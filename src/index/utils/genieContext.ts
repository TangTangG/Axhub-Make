import {
  getGenieCurrentFilePath,
  mergeGenieContextV1,
  normalizeGenieCurrentFileV1,
} from '../../common/genie/bridge';
import {
  appendRequiredGenieOpenParams,
  buildMinimalGenieUrlContext,
} from '../../common/genie/url';
import type { GenieCurrentFileV1 } from '../../common/genie/types';
import type { AssistantContextV1, CanvasItem, ItemData, TabType, ViewMode } from '../types';
import type { CanvasElementContextInfo } from '../components/content/canvas-embeds/AnnotationOverlay';
import type { DataTableResourceItem, ThemeResourceItem } from '../domains/resources/resource.types';

export type AssistantContentMode = 'preview' | 'doc' | 'template' | 'canvas' | 'theme' | 'data';

export interface AssistantMarkdownResourceSelection {
  kind: 'doc' | 'template';
  item: ItemData | null;
}

export interface ResolveAssistantCurrentFileParams {
  selectedItem: ItemData | null;
  activeTab: TabType;
  viewMode: ViewMode;
  contentMode: AssistantContentMode;
  currentMarkdownResource: AssistantMarkdownResourceSelection;
  currentCanvas?: CanvasItem | null;
  currentTheme?: ThemeResourceItem | null;
  currentDataTable?: DataTableResourceItem | null;
}

export interface AssistantCanvasComment {
  id: string;
  body: string;
  origin: 'canvas';
  target: {
    filePath: string;
    elementId: string;
    elementType: string;
    link?: string;
  };
  preview?: string;
  updatedAt: string;
}

function normalizePathValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\\/g, '/') : '';
}

function stripIndexFilePath(value: string): string {
  return value.replace(/\/index\.(t|j)sx?$/i, '');
}

function ensureIndexFilePath(value: string): string {
  const normalized = normalizePathValue(value);
  if (!normalized) return '';
  if (/\/index\.(t|j)sx?$/i.test(normalized)) return normalized;
  if (/\.(t|j)sx?$/i.test(normalized)) return normalized;
  return `${normalized.replace(/\/+$/g, '')}/index.tsx`;
}

function toProjectRelativePath(value: string): string {
  const normalized = normalizePathValue(value);
  const srcIndex = normalized.indexOf('src/');
  return srcIndex >= 0 ? normalized.slice(srcIndex) : normalized;
}

function resolvePrototypeBasePath(item: ItemData | null): string {
  if (!item) return '';
  const explicitPath = normalizePathValue(item.filePath) || normalizePathValue(item.absoluteFilePath);
  if (!explicitPath) return '';
  return stripIndexFilePath(toProjectRelativePath(explicitPath));
}

function resolveMarkdownResourcePath(item: ItemData | null): string {
  if (!item) return '';
  return normalizePathValue(item.filePath) || normalizePathValue(item.absoluteFilePath);
}

function resolveCanvasResourcePath(item: CanvasItem | null | undefined): string {
  if (!item) return '';
  const explicitPath = normalizePathValue((item as any).filePath) || normalizePathValue((item as any).absoluteFilePath);
  if (explicitPath) return explicitPath;
  const name = normalizePathValue(item.name);
  return name ? `canvas/${name}.excalidraw` : '';
}

function resolveThemeResourcePath(item: ThemeResourceItem | null | undefined): string {
  if (!item) return '';
  const explicitPath = normalizePathValue(item.path) || normalizePathValue(item.absoluteFilePath);
  if (!explicitPath) return '';
  return ensureIndexFilePath(toProjectRelativePath(explicitPath));
}

function resolveDataTableResourcePath(item: DataTableResourceItem | null | undefined): string {
  if (!item) return '';
  return normalizePathValue(item.path) || normalizePathValue(item.absoluteFilePath);
}

export function resolveAssistantCurrentFile(params: ResolveAssistantCurrentFileParams): GenieCurrentFileV1 {
  const {
    selectedItem,
    viewMode,
    contentMode,
    currentMarkdownResource,
    currentCanvas,
    currentTheme,
    currentDataTable,
  } = params;

  if (contentMode === 'doc' || contentMode === 'template') {
    const markdownPath = resolveMarkdownResourcePath(currentMarkdownResource.item);
    return normalizeGenieCurrentFileV1(markdownPath, {
      displayName: currentMarkdownResource.item?.displayName || currentMarkdownResource.item?.name || '',
    });
  }

  if (contentMode === 'canvas') {
    const canvasPath = resolveCanvasResourcePath(currentCanvas);
    return normalizeGenieCurrentFileV1(canvasPath, {
      displayName: currentCanvas?.displayName || currentCanvas?.name || '',
    });
  }

  if (contentMode === 'theme') {
    const themePath = resolveThemeResourcePath(currentTheme);
    return normalizeGenieCurrentFileV1(themePath, {
      displayName: currentTheme?.displayName || currentTheme?.name || '',
    });
  }

  if (contentMode === 'data') {
    const dataPath = resolveDataTableResourcePath(currentDataTable);
    return normalizeGenieCurrentFileV1(dataPath, {
      displayName: currentDataTable?.tableName || currentDataTable?.fileName || '',
    });
  }

  const prototypeBasePath = resolvePrototypeBasePath(selectedItem);
  const currentFilePath = viewMode === 'canvas'
    ? prototypeBasePath ? `${prototypeBasePath}/canvas.excalidraw` : ''
    : ensureIndexFilePath(prototypeBasePath);

  return normalizeGenieCurrentFileV1(currentFilePath, {
    displayName: selectedItem?.displayName || selectedItem?.name || '',
  });
}

export function mergeAssistantContextForActiveFile(
  baseContext: AssistantContextV1,
  externalContext: AssistantContextV1 | null | undefined,
): AssistantContextV1 {
  if (!externalContext) {
    return baseContext;
  }

  const baseCurrentFilePath = getGenieCurrentFilePath(baseContext.currentFile);
  const externalCurrentFilePath = getGenieCurrentFilePath(externalContext.currentFile);
  if (!baseCurrentFilePath || baseCurrentFilePath !== externalCurrentFilePath) {
    return baseContext;
  }

  return mergeGenieContextV1(baseContext, externalContext) ?? baseContext;
}

export function shouldSyncAssistantCurrentFile(
  previousCurrentFilePath: string | null | undefined,
  nextCurrentFilePath: string | null | undefined,
): boolean {
  const previousPath = String(previousCurrentFilePath || '').trim();
  const nextPath = String(nextCurrentFilePath || '').trim();
  return previousPath !== nextPath;
}

export function buildAssistantCurrentFileSyncContext(context: AssistantContextV1): AssistantContextV1 {
  return {
    ...context,
    currentFile: normalizeGenieCurrentFileV1(context.currentFile),
    selectedElements: [],
  };
}

export function buildAssistantCanvasCommentsExtension(
  annotations: CanvasElementContextInfo[],
  currentFilePath: string,
  now: Date = new Date(),
): AssistantCanvasComment[] {
  if (!Array.isArray(annotations)) {
    return [];
  }

  const filePath = normalizePathValue(currentFilePath);
  const updatedAt = now.toISOString();
  const commentsById = new Map<string, AssistantCanvasComment>();

  for (const annotation of annotations) {
    const elementId = String(annotation?.elementId || '').trim();
    const body = String(annotation?.annotation || '').trim();
    if (!elementId || !body) {
      continue;
    }

    const elementType = String(annotation?.type || 'unknown').trim() || 'unknown';
    const link = normalizePathValue(annotation?.link);
    const preview = String(annotation?.title || annotation?.type || elementId).trim();
    const id = `axhub:canvas-annotation:${elementId}`;
    commentsById.set(id, {
      id,
      body,
      origin: 'canvas',
      target: {
        filePath,
        elementId,
        elementType,
        ...(link ? { link } : {}),
      },
      ...(preview ? { preview } : {}),
      updatedAt,
    });
  }

  return Array.from(commentsById.values());
}

export function buildAssistantContextWithCanvasComments(
  context: AssistantContextV1,
  annotations: CanvasElementContextInfo[],
  currentFilePath: string,
): AssistantContextV1 {
  const comments = buildAssistantCanvasCommentsExtension(annotations, currentFilePath);
  const extensions = {
    ...(context.extensions || {}),
  };

  if (comments.length > 0) {
    extensions.comments = comments;
  } else {
    delete extensions.comments;
  }

  return {
    ...context,
    currentFile: normalizeGenieCurrentFileV1(context.currentFile),
    selectedElements: Array.isArray(context.selectedElements) ? context.selectedElements : [],
    extensions,
  };
}

export function getAssistantCanvasCommentsSignature(context: Pick<AssistantContextV1, 'extensions'>): string {
  const comments = Array.isArray(context.extensions?.comments) ? context.extensions.comments : [];
  return JSON.stringify(comments.map((comment: any) => {
    const stableComment = { ...(comment || {}) };
    delete stableComment.updatedAt;
    return stableComment;
  }));
}

export function getAssistantContextCurrentFilePath(context: Pick<AssistantContextV1, 'currentFile'>): string {
  return getGenieCurrentFilePath(context.currentFile);
}

export function buildAssistantContextUrl(
  baseUrl: string,
  context: AssistantContextV1,
  baseOrigin?: string,
): string {
  try {
    const url = new URL(appendRequiredGenieOpenParams(baseUrl, baseOrigin));
    url.searchParams.set('context', JSON.stringify(buildMinimalGenieUrlContext(context)));
    return url.toString();
  } catch (error) {
    console.warn('Failed to serialize assistant context into URL:', error);
    return appendRequiredGenieOpenParams(baseUrl, baseOrigin);
  }
}
