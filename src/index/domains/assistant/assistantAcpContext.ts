import {
  getGenieCurrentFilePath,
  normalizeGenieCurrentFileV1,
} from '../../../common/genie/bridge';
import type { GenieContextElementV1, GenieContextV1 } from '../../../common/genie/types';

type AcpContextItemKind = 'file' | 'annotation';
export type AcpPostMessageFilter = 'snapshot' | 'artifacts';

export interface AcpContextFileItem {
  kind: 'file';
  id?: string;
  hidden?: boolean;
  pinned?: boolean;
  path: string;
  name?: string;
  mimeType?: string;
  range?: {
    startLine?: number;
    endLine?: number;
    startColumn?: number;
    endColumn?: number;
  };
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface AcpContextAnnotationItem {
  kind: 'annotation';
  id?: string;
  hidden?: boolean;
  pinned?: boolean;
  body: string;
  target:
    | {
      type: 'web-element';
      url?: string;
      selector?: string;
      elementId?: string;
      label?: string;
      rect?: Record<string, unknown>;
    }
    | {
      type: 'canvas-element';
      filePath?: string;
      canvasId?: string;
      elementId?: string;
      elementType?: string;
      label?: string;
      rect?: Record<string, unknown>;
      link?: string;
    }
    | {
      type: 'text';
      filePath?: string;
      quote?: string;
      range?: Record<string, unknown>;
      label?: string;
    };
  title?: string;
  status?: 'open' | 'resolved';
  source?: string;
  metadata?: Record<string, unknown>;
}

export type AcpContextItem = AcpContextFileItem | AcpContextAnnotationItem;

export interface AcpContextBundleV2 {
  version: '2';
  items: AcpContextItem[];
  updatedAt: string;
}

export interface AcpContextPostMessage {
  type: 'acp.context.add' | 'acp.context.replace';
  requestId?: string;
  payload: {
    items: AcpContextItem[];
    messageFilter?: AcpPostMessageFilter;
  };
}

export interface AssistantImageGenerationConfig {
  enabled?: boolean;
  baseUrl?: string | null;
  apiKey?: string | null;
  model?: string | null;
  savePathPattern?: string | null;
  preservePrompt?: boolean | null;
  lastTest?: unknown;
}

export type AcpRuntimeConfigField = 'builtinTools' | 'builtinToolSettings' | 'mcpServers' | 'commands';

export interface AcpRuntimeConfigurePostMessage {
  type: 'acp.runtime.configure';
  requestId?: string;
  payload: {
    merge?: boolean;
    builtinTools?: string[];
    builtinToolSettings?: Record<string, unknown>;
    mcpServers?: unknown[];
    commands?: unknown[];
  };
}

export interface AcpRuntimeClearPostMessage {
  type: 'acp.runtime.clear';
  requestId?: string;
  payload?: {
    fields?: AcpRuntimeConfigField[];
  };
}

export type AcpImageGenerationPostMessage =
  | AcpRuntimeConfigurePostMessage
  | AcpRuntimeClearPostMessage;

export type AcpCanvasMcpPostMessage =
  | AcpRuntimeConfigurePostMessage
  | AcpRuntimeClearPostMessage;

const ACP_IMAGE_GENERATION_TOOL_ID = 'image-generation';
const ACP_IMAGE_GENERATION_RUNTIME_CLEAR_FIELDS: AcpRuntimeConfigField[] = ['builtinTools', 'builtinToolSettings'];
const ACP_CANVAS_MCP_NAME = 'axhub-canvas';
const ACP_CANVAS_MCP_PATH = '/api/mcp/axhub-canvas';
const ACP_CANVAS_MCP_TOKEN_HEADER = 'x-axhub-canvas-mcp-token';
const ACP_CANVAS_MCP_RUNTIME_CLEAR_FIELDS: AcpRuntimeConfigField[] = ['mcpServers'];

function normalizeContextPath(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\\/g, '/') : '';
}

function normalizeOptionalPostMessageString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeImageGenerationBaseUrl(value: unknown): string {
  return normalizeOptionalPostMessageString(value).replace(/\/+$/u, '');
}

function normalizeMakeOrigin(value: unknown): string {
  const normalized = normalizeOptionalPostMessageString(value).replace(/\/+$/u, '');
  if (!normalized) return '';
  try {
    return new URL(normalized).origin;
  } catch {
    return '';
  }
}

function getImageGenerationSecretFingerprint(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return `${value.length}:${hash >>> 0}`;
}

function encodeContextIdPart(value: string): string {
  return encodeURIComponent(value).replace(/%2F/gi, '/');
}

function resolveFileDisplayName(filePath: string, displayName?: string): string {
  const normalizedDisplayName = String(displayName || '').trim();
  const segments = filePath.split('/').filter(Boolean);
  const fileName = segments[segments.length - 1] || filePath;
  if (normalizedDisplayName && normalizedDisplayName !== fileName) return normalizedDisplayName;
  if (/^index\.[cm]?[tj]sx?$/i.test(fileName) && segments.length > 1) {
    return segments[segments.length - 2] || fileName;
  }
  if (normalizedDisplayName) return normalizedDisplayName;
  return fileName.replace(/\.(?:[cm]?[tj]sx?|mdx?|json|excalidraw)$/i, '');
}

function getContextSource(context: GenieContextV1): string {
  const source = context.extensions?.source;
  return typeof source === 'string' && source.trim() ? source.trim() : 'axhub-runtime';
}

function buildFileItem(context: GenieContextV1): AcpContextFileItem | null {
  const currentFile = normalizeGenieCurrentFileV1(context.currentFile);
  const filePath = normalizeContextPath(currentFile.path);
  if (!filePath) return null;

  return {
    kind: 'file',
    id: `axhub:file:${filePath}`,
    hidden: true,
    pinned: true,
    path: filePath,
    name: resolveFileDisplayName(filePath, currentFile.displayName),
    metadata: {
      source: getContextSource(context),
    },
  };
}

function buildSelectedElementAnnotation(
  item: GenieContextElementV1,
  context: GenieContextV1,
  filePath: string,
): AcpContextAnnotationItem | null {
  const selector = String(item?.selector || '').trim();
  const label = String(item?.label || '').trim();
  const tag = String(item?.tag || '').trim();
  const elementId = String((item as unknown as Record<string, unknown>)?.elementId || '').trim();
  if (!selector || !label) return null;

  return {
    kind: 'annotation',
    id: `axhub:selected-element:${filePath}:${encodeContextIdPart(selector)}`,
    body: label,
    target: {
      type: 'web-element',
      selector,
      ...(elementId ? { elementId } : {}),
      label,
    },
    ...(tag ? { title: tag } : {}),
    source: getContextSource(context),
    metadata: {
      filePath,
      selector,
      ...(elementId ? { elementId } : {}),
      ...(tag ? { tag } : {}),
    },
  };
}

function buildCanvasCommentAnnotation(comment: any, context: GenieContextV1): AcpContextAnnotationItem | null {
  const target = comment?.target || {};
  const elementId = String(target.elementId || '').trim();
  const filePath = normalizeContextPath(target.filePath);
  const elementType = String(target.elementType || 'unknown').trim() || 'unknown';
  const preview = String(comment?.preview || '').trim();
  const body = String(comment?.body || '').trim() || preview || elementType || elementId;
  if (!body || !elementId) return null;

  return {
    kind: 'annotation',
    id: String(comment?.id || `axhub:canvas-annotation:${elementId}`),
    body,
    target: {
      type: 'canvas-element',
      ...(filePath ? { filePath } : {}),
      elementId,
      elementType,
      ...(preview ? { label: preview } : {}),
      ...(String(target.link || '').trim() ? { link: String(target.link).trim() } : {}),
    },
    ...(preview ? { title: preview } : {}),
    source: getContextSource(context),
    metadata: {
      ...(filePath ? { filePath } : {}),
      elementId,
      elementType,
    },
  };
}

export function mapAssistantContextToAcpContextBundle(
  context: GenieContextV1,
  now: Date = new Date(),
): AcpContextBundleV2 {
  const items: AcpContextItem[] = [];
  const fileItem = buildFileItem(context);
  const filePath = fileItem?.path || getGenieCurrentFilePath(context.currentFile);
  if (fileItem) {
    items.push(fileItem);
  }

  for (const selectedElement of Array.isArray(context.selectedElements) ? context.selectedElements : []) {
    const annotation = buildSelectedElementAnnotation(selectedElement, context, filePath);
    if (annotation) {
      items.push(annotation);
    }
  }

  const comments = Array.isArray(context.extensions?.comments) ? context.extensions.comments : [];
  for (const comment of comments) {
    const annotation = buildCanvasCommentAnnotation(comment, context);
    if (annotation) {
      items.push(annotation);
    }
  }

  return {
    version: '2',
    items,
    updatedAt: now.toISOString(),
  };
}

export function buildAcpContextPostMessage(
  context: GenieContextV1,
  mode: 'replace' | 'append' = 'replace',
  requestId?: string,
  now: Date = new Date(),
  messageFilter: AcpPostMessageFilter = 'snapshot',
): AcpContextPostMessage {
  const bundle = mapAssistantContextToAcpContextBundle(context, now);
  return {
    type: mode === 'append' ? 'acp.context.add' : 'acp.context.replace',
    ...(requestId ? { requestId } : {}),
    payload: {
      items: bundle.items,
      messageFilter,
    },
  };
}

export function buildAcpContextItemsPostMessage(
  items: AcpContextItem[],
  mode: 'replace' | 'append' = 'append',
  requestId?: string,
  messageFilter: AcpPostMessageFilter = 'snapshot',
): AcpContextPostMessage {
  return {
    type: mode === 'append' ? 'acp.context.add' : 'acp.context.replace',
    ...(requestId ? { requestId } : {}),
    payload: {
      items: Array.isArray(items) ? items : [],
      messageFilter,
    },
  };
}

export function buildAcpImageGenerationPostMessage(
  config: AssistantImageGenerationConfig | null | undefined,
  requestId?: string,
): AcpImageGenerationPostMessage {
  const baseUrl = normalizeImageGenerationBaseUrl(config?.baseUrl);
  const apiKey = normalizeOptionalPostMessageString(config?.apiKey);
  const model = normalizeOptionalPostMessageString(config?.model);
  if (!baseUrl || !apiKey || !model) {
    return {
      type: 'acp.runtime.clear',
      ...(requestId ? { requestId } : {}),
      payload: {
        fields: ACP_IMAGE_GENERATION_RUNTIME_CLEAR_FIELDS,
      },
    };
  }

  const savePathPattern = normalizeOptionalPostMessageString(config?.savePathPattern);
  const imageGenerationSettings = {
    ...(typeof config?.enabled === 'boolean' ? { enabled: config.enabled } : {}),
    baseUrl,
    apiKey,
    model,
    ...(savePathPattern ? { savePathPattern } : {}),
    ...(typeof config?.preservePrompt === 'boolean' ? { preservePrompt: config.preservePrompt } : {}),
  };

  return {
    type: 'acp.runtime.configure',
    ...(requestId ? { requestId } : {}),
    payload: {
      merge: true,
      builtinTools: [ACP_IMAGE_GENERATION_TOOL_ID],
      builtinToolSettings: {
        [ACP_IMAGE_GENERATION_TOOL_ID]: imageGenerationSettings,
      },
    },
  };
}

export function getAcpImageGenerationConfigSignature(
  config: AssistantImageGenerationConfig | null | undefined,
): string {
  const baseUrl = normalizeImageGenerationBaseUrl(config?.baseUrl);
  const apiKey = normalizeOptionalPostMessageString(config?.apiKey);
  const model = normalizeOptionalPostMessageString(config?.model);
  if (!baseUrl || !apiKey || !model) {
    return JSON.stringify({
      type: 'acp.runtime.clear',
      payload: {
        fields: ACP_IMAGE_GENERATION_RUNTIME_CLEAR_FIELDS,
      },
    });
  }

  const savePathPattern = normalizeOptionalPostMessageString(config?.savePathPattern);
  const imageGenerationSettings = {
    ...(typeof config?.enabled === 'boolean' ? { enabled: config.enabled } : {}),
    baseUrl,
    apiKeyFingerprint: getImageGenerationSecretFingerprint(apiKey),
    model,
    ...(savePathPattern ? { savePathPattern } : {}),
    ...(typeof config?.preservePrompt === 'boolean' ? { preservePrompt: config.preservePrompt } : {}),
  };

  return JSON.stringify({
    type: 'acp.runtime.configure',
    payload: {
      merge: true,
      builtinTools: [ACP_IMAGE_GENERATION_TOOL_ID],
      builtinToolSettings: {
        [ACP_IMAGE_GENERATION_TOOL_ID]: imageGenerationSettings,
      },
    },
  });
}

export function buildAcpCanvasMcpPostMessage(
  config: { makeOrigin?: string | null; token?: string | null } | null | undefined,
  requestId?: string,
): AcpCanvasMcpPostMessage {
  const makeOrigin = normalizeMakeOrigin(config?.makeOrigin);
  const token = normalizeOptionalPostMessageString(config?.token);
  if (!makeOrigin || !token) {
    return {
      type: 'acp.runtime.clear',
      ...(requestId ? { requestId } : {}),
      payload: {
        fields: ACP_CANVAS_MCP_RUNTIME_CLEAR_FIELDS,
      },
    };
  }

  return {
    type: 'acp.runtime.configure',
    ...(requestId ? { requestId } : {}),
    payload: {
      merge: true,
      mcpServers: [{
        name: ACP_CANVAS_MCP_NAME,
        type: 'http',
        url: `${makeOrigin}${ACP_CANVAS_MCP_PATH}`,
        headers: [{
          name: ACP_CANVAS_MCP_TOKEN_HEADER,
          value: token,
        }],
      }],
    },
  };
}

export function getAcpCanvasMcpConfigSignature(
  config: { makeOrigin?: string | null; token?: string | null } | null | undefined,
): string {
  const makeOrigin = normalizeMakeOrigin(config?.makeOrigin);
  const token = normalizeOptionalPostMessageString(config?.token);
  if (!makeOrigin || !token) {
    return JSON.stringify({
      type: 'acp.runtime.clear',
      payload: {
        fields: ACP_CANVAS_MCP_RUNTIME_CLEAR_FIELDS,
      },
    });
  }

  return JSON.stringify({
    type: 'acp.runtime.configure',
    payload: {
      merge: true,
      mcpServers: [{
        name: ACP_CANVAS_MCP_NAME,
        type: 'http',
        url: `${makeOrigin}${ACP_CANVAS_MCP_PATH}`,
        headers: [{
          name: ACP_CANVAS_MCP_TOKEN_HEADER,
          hasValue: true,
        }],
      }],
    },
  });
}

export function getAcpContextPostMessageKinds(): AcpContextItemKind[] {
  return ['file', 'annotation'];
}
