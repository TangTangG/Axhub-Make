import {
  AXHUB_WEB_EDITOR_GENIE_REQUEST,
  type GenieContextElementV1,
  type GenieContextV1,
  type GenieCurrentFileV1,
  type GenieCurrentFileValueV1,
  type GenieProvider,
  type WebEditorGenieRequestMessage,
  type WebEditorGenieRequestPayload,
} from './types';

type GeniePromptContextArrayParams = {
  workspacePaths?: unknown;
  relatedFiles?: unknown;
  extraContext?: unknown;
};

const GENIE_PROMPT_CONTEXT_ARRAY_KEYS = [
  'workspacePaths',
  'relatedFiles',
  'extraContext',
] as const;

type GeniePromptContextArrayKey = (typeof GENIE_PROMPT_CONTEXT_ARRAY_KEYS)[number];

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function dedupeStrings(values: readonly unknown[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeString(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? dedupeStrings(value) : [];
}

function getFileName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  return segments[segments.length - 1] || path;
}

function normalizeGenieProvider(value: unknown): GenieProvider | undefined {
  const normalized = normalizeString(value);
  if (
    normalized === 'claude'
    || normalized === 'cursor'
    || normalized === 'codex'
    || normalized === 'gemini'
    || normalized === 'opencode'
  ) {
    return normalized;
  }
  return undefined;
}

function normalizeGenieContextElementV1(value: unknown): GenieContextElementV1 | null {
  if (!isRecord(value)) return null;
  const tag = normalizeString(value.tag);
  const selector = normalizeString(value.selector);
  const label = normalizeString(value.label);
  if (!tag || !selector || !label) return null;
  return { tag, selector, label };
}

function normalizeSelectedElements(value: unknown): GenieContextElementV1[] {
  if (!Array.isArray(value)) return [];
  const result: GenieContextElementV1[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = normalizeGenieContextElementV1(item);
    if (!normalized) continue;
    const key = `${normalized.tag}::${normalized.selector}::${normalized.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function normalizePromptContextArrayParams(
  value: unknown,
): Partial<Record<GeniePromptContextArrayKey, string[]>> {
  if (!isRecord(value)) return {};

  const result: Partial<Record<GeniePromptContextArrayKey, string[]>> = {};
  for (const key of GENIE_PROMPT_CONTEXT_ARRAY_KEYS) {
    const normalized = normalizeStringArray(value[key]);
    if (normalized.length > 0) {
      result[key] = normalized;
    }
  }
  return result;
}

function mergePromptContextArrayParams(
  left: GeniePromptContextArrayParams | undefined,
  right: GeniePromptContextArrayParams | undefined,
): Partial<Record<GeniePromptContextArrayKey, string[]>> {
  const normalizedLeft = normalizePromptContextArrayParams(left);
  const normalizedRight = normalizePromptContextArrayParams(right);
  const result: Partial<Record<GeniePromptContextArrayKey, string[]>> = {};

  for (const key of GENIE_PROMPT_CONTEXT_ARRAY_KEYS) {
    const merged = dedupeStrings([
      ...(normalizedLeft[key] ?? []),
      ...(normalizedRight[key] ?? []),
    ]);
    if (merged.length > 0) {
      result[key] = merged;
    }
  }

  return result;
}

function normalizeExtensions(
  value: unknown,
  promptContext?: GeniePromptContextArrayParams,
): Record<string, unknown> | undefined {
  if (!isRecord(value) && !promptContext) return undefined;

  const base = isRecord(value) ? { ...value } : {};
  const mergedPromptContext = mergePromptContextArrayParams(
    isRecord(base.promptContext) ? base.promptContext : base,
    promptContext,
  );

  if (Object.keys(mergedPromptContext).length > 0) {
    base.promptContext = {
      ...(isRecord(base.promptContext) ? base.promptContext : {}),
      ...mergedPromptContext,
    };
  }

  return Object.keys(base).length > 0 ? base : undefined;
}

function mergeExtensions(
  base: unknown,
  patch: unknown,
): Record<string, unknown> | undefined {
  const normalizedBase = normalizeExtensions(base);
  const normalizedPatch = normalizeExtensions(patch);
  const mergedPromptContext = mergePromptContextArrayParams(
    isRecord(normalizedBase)
      ? (isRecord(normalizedBase.promptContext) ? normalizedBase.promptContext : normalizedBase)
      : undefined,
    isRecord(normalizedPatch)
      ? (isRecord(normalizedPatch.promptContext) ? normalizedPatch.promptContext : normalizedPatch)
      : undefined,
  );

  const merged = {
    ...(normalizedBase ?? {}),
    ...(normalizedPatch ?? {}),
  };

  if (Object.keys(mergedPromptContext).length > 0) {
    merged.promptContext = {
      ...(isRecord(normalizedBase?.promptContext) ? normalizedBase.promptContext : {}),
      ...(isRecord(normalizedPatch?.promptContext) ? normalizedPatch.promptContext : {}),
      ...mergedPromptContext,
    };
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function createWebEditorGenieRequestMessage(
  payload: WebEditorGenieRequestPayload,
): WebEditorGenieRequestMessage {
  return {
    type: AXHUB_WEB_EDITOR_GENIE_REQUEST,
    payload,
  };
}

export function isWebEditorGenieRequestMessage(value: unknown): value is WebEditorGenieRequestMessage {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<WebEditorGenieRequestMessage>;
  if (data.type !== AXHUB_WEB_EDITOR_GENIE_REQUEST) return false;
  if (!data.payload || typeof data.payload !== 'object') return false;
  const payload = data.payload as Partial<WebEditorGenieRequestPayload>;
  return typeof payload.preferCurrentSession === 'boolean' && typeof payload.mode === 'string';
}

export function normalizeGenieCurrentFileV1(
  value: unknown,
  fallback: Partial<GenieCurrentFileV1> = {},
): GenieCurrentFileV1 {
  const fallbackPath = normalizeString(fallback.path);
  const fallbackDisplayName = normalizeString(fallback.displayName);

  if (typeof value === 'string') {
    const path = normalizeString(value) || fallbackPath;
    return {
      path,
      displayName: fallbackDisplayName || getFileName(path),
    };
  }

  if (!isRecord(value)) {
    return {
      path: fallbackPath,
      displayName: fallbackDisplayName || getFileName(fallbackPath),
    };
  }

  const path = normalizeString(value.path) || fallbackPath;
  const displayName = normalizeString(value.displayName) || fallbackDisplayName || getFileName(path);
  return { path, displayName };
}

export function getGenieCurrentFilePath(value: unknown): string {
  return normalizeGenieCurrentFileV1(value).path;
}

export function getGenieCurrentFileDisplayName(value: unknown): string {
  return normalizeGenieCurrentFileV1(value).displayName;
}

export function normalizeGenieContextV1(
  value: unknown,
  options: {
    fallbackCurrentFile?: GenieCurrentFileValueV1;
    promptContext?: GeniePromptContextArrayParams;
  } = {},
): GenieContextV1 | null {
  if (!isRecord(value)) return null;

  const currentFile = normalizeGenieCurrentFileV1(value.currentFile, {
    ...normalizeGenieCurrentFileV1(options.fallbackCurrentFile),
  });

  return {
    version: '1',
    systemContext: typeof value.systemContext === 'string' ? value.systemContext : '',
    currentFile,
    selectedElements: normalizeSelectedElements(value.selectedElements),
    extensions: normalizeExtensions(value.extensions, options.promptContext),
  };
}

export function mergeGenieContextV1(
  base: GenieContextV1 | null | undefined,
  patch: GenieContextV1 | null | undefined,
): GenieContextV1 | null {
  if (!base && !patch) return null;
  if (!base) return patch ?? null;
  if (!patch) return base;

  return {
    version: '1',
    systemContext: patch.systemContext || base.systemContext,
    currentFile: normalizeGenieCurrentFileV1(patch.currentFile, normalizeGenieCurrentFileV1(base.currentFile)),
    selectedElements: patch.selectedElements.length > 0 ? patch.selectedElements : base.selectedElements,
    extensions: mergeExtensions(base.extensions, patch.extensions),
  };
}

export function normalizeWebEditorGenieRequestPayload(
  value: unknown,
  options: {
    fallbackCurrentFile?: GenieCurrentFileValueV1;
    promptContext?: GeniePromptContextArrayParams;
  } = {},
): WebEditorGenieRequestPayload | null {
  if (!isRecord(value)) return null;

  const mode = normalizeString(value.mode);
  if (mode !== 'selection_context' && mode !== 'save') {
    return null;
  }

  if (typeof value.preferCurrentSession !== 'boolean') {
    return null;
  }

  return {
    mode,
    provider: normalizeGenieProvider(value.provider),
    prompt: typeof value.prompt === 'string' ? value.prompt : undefined,
    targetPath: normalizeString(value.targetPath) || undefined,
    preferCurrentSession: value.preferCurrentSession,
    context: value.context
      ? normalizeGenieContextV1(value.context, {
          fallbackCurrentFile: options.fallbackCurrentFile,
          promptContext: options.promptContext,
        }) ?? undefined
      : undefined,
  };
}
