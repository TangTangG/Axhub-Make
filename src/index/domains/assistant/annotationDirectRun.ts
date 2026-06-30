import { getAcpProviderOption } from '../../../common/acpModelConfig';
import type { AssistantContextV1 } from '../../types';
import { getAssistantContextCurrentFilePath } from '../../utils/genieContext';
import { runAiStream, type AiRunSseEvent, type AiRunStreamResult } from '../ai-generation/aiRunClient';
import { mapAssistantContextToAcpContextBundle } from './assistantAcpContext';
import {
  resolvePrototypeConversationStorePath,
  setAssistantResourceThreadId,
  setAssistantStoreThreadId,
} from './assistantResourceThread';

export const ANNOTATION_DIRECT_RUN_TTL_MS = 48 * 60 * 60 * 1_000;
export const ANNOTATION_DIRECT_RUN_MAX_SENDS = 40;

const STORAGE_KEY_ANNOTATION_DIRECT_THREAD = 'axhub:annotation-direct-run-thread';

export interface AnnotationDirectRunStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface AnnotationDirectRunTarget {
  projectScope: string;
  currentFilePath: string;
  prototypePath: string;
  conversationStorePath: string;
}

export interface AnnotationDirectRunThreadRecord {
  threadId: string;
  prototypePath: string;
  conversationStorePath: string;
  createdAt: number;
  expiresAt: number;
  sentCount: number;
  invalidated: boolean;
}

export interface PreparedAnnotationDirectRunThread {
  firstRun: boolean;
  runId: string;
  threadId: string;
  conversationId: string;
  target: AnnotationDirectRunTarget;
}

export interface SubmitAnnotationPromptViaApiOptions {
  context: AssistantContextV1;
  prompt: string;
  projectPath?: string | null;
  projectScope?: string | null;
  projectId?: string | null;
  preferredPromptClient?: string | null;
  provider?: string | null;
  model?: string | null;
  builtinToolSettings?: Record<string, unknown>;
  storage?: AnnotationDirectRunStorage | null;
  createRunId?: () => string;
  now?: () => number;
  onFirstRun?: (message: string) => void;
  onPrepared?: (prepared: PreparedAnnotationDirectRunThread & { provider: string | null }) => void | Promise<void>;
  onAccepted?: (payload: {
    runId: string;
    threadId: string;
    conversationId: string;
    provider: string | null;
  }) => void | Promise<void>;
  onEvent?: (event: AiRunSseEvent) => void | Promise<void>;
  signal?: AbortSignal;
}

function getLocalStorage(): AnnotationDirectRunStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function normalizePath(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\\/g, '/') : '';
}

function toPrototypeRelativePath(value: unknown): string {
  const normalized = normalizePath(value).replace(/^\/+/u, '');
  const prototypeIndex = normalized.indexOf('src/prototypes/');
  return prototypeIndex >= 0 ? normalized.slice(prototypeIndex) : normalized;
}

function encodeStorageKeyPart(value: string): string {
  return encodeURIComponent(value).replace(/%/g, '~');
}

function createAnnotationDirectRunId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `annotation-${Date.now().toString(36)}-${random}`;
}

function sanitizeThreadRecord(
  value: unknown,
  target: AnnotationDirectRunTarget,
): AnnotationDirectRunThreadRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Partial<AnnotationDirectRunThreadRecord>;
  const threadId = String(record.threadId || '').trim();
  if (!threadId) {
    return null;
  }
  const prototypePath = normalizePath(record.prototypePath);
  const conversationStorePath = normalizePath(record.conversationStorePath);
  if (prototypePath !== target.prototypePath || conversationStorePath !== target.conversationStorePath) {
    return null;
  }
  const createdAt = Number(record.createdAt);
  const expiresAt = Number(record.expiresAt);
  const sentCount = Math.max(0, Math.floor(Number(record.sentCount || 0)));
  return {
    threadId,
    prototypePath,
    conversationStorePath,
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : 0,
    expiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : 0,
    sentCount: Number.isFinite(sentCount) ? sentCount : 0,
    invalidated: Boolean(record.invalidated),
  };
}

function readThreadRecord(
  target: AnnotationDirectRunTarget,
  storage: AnnotationDirectRunStorage | null,
): AnnotationDirectRunThreadRecord | null {
  const key = buildAnnotationDirectRunThreadStorageKey(target);
  if (!key || !storage) {
    return null;
  }
  try {
    const raw = storage.getItem(key);
    return raw ? sanitizeThreadRecord(JSON.parse(raw), target) : null;
  } catch {
    return null;
  }
}

function writeThreadRecord(
  target: AnnotationDirectRunTarget,
  record: AnnotationDirectRunThreadRecord,
  storage: AnnotationDirectRunStorage | null,
): void {
  const key = buildAnnotationDirectRunThreadStorageKey(target);
  if (!key || !storage) {
    return;
  }
  try {
    storage.setItem(key, JSON.stringify(record));
  } catch {
    // Browser storage can fail in private or embedded contexts.
  }
}

function isThreadRecordReusable(record: AnnotationDirectRunThreadRecord | null, now: number): record is AnnotationDirectRunThreadRecord {
  return Boolean(
    record
    && !record.invalidated
    && record.sentCount < ANNOTATION_DIRECT_RUN_MAX_SENDS
    && record.expiresAt > now,
  );
}

export function buildAnnotationDirectRunThreadStorageKey(target: {
  projectScope?: string | null;
  prototypePath?: string | null;
  conversationStorePath?: string | null;
}): string {
  const projectScope = String(target.projectScope || '').trim() || 'active-project';
  const prototypePath = normalizePath(target.prototypePath);
  const conversationStorePath = normalizePath(target.conversationStorePath);
  if (!prototypePath || !conversationStorePath) {
    return '';
  }
  return [
    STORAGE_KEY_ANNOTATION_DIRECT_THREAD,
    encodeStorageKeyPart(projectScope),
    encodeStorageKeyPart(prototypePath),
    encodeStorageKeyPart(conversationStorePath),
  ].join(':');
}

export function resolveAnnotationDirectRunTarget(options: {
  context: AssistantContextV1;
  projectPath?: string | null;
  projectScope?: string | null;
}): AnnotationDirectRunTarget {
  const currentFilePath = toPrototypeRelativePath(getAssistantContextCurrentFilePath(options.context));
  const match = currentFilePath.match(/^src\/prototypes\/([^/]+)(?:\/|$)/u);
  const prototypeId = match?.[1]?.trim() || '';
  const prototypePath = prototypeId ? `src/prototypes/${prototypeId}` : '';
  const conversationStorePath = resolvePrototypeConversationStorePath({
    projectPath: options.projectPath,
    resourcePath: currentFilePath,
  });
  return {
    projectScope: String(options.projectScope || options.projectPath || '').trim(),
    currentFilePath,
    prototypePath,
    conversationStorePath,
  };
}

export function prepareAnnotationDirectRunThread(options: {
  target: AnnotationDirectRunTarget;
  storage?: AnnotationDirectRunStorage | null;
  now?: number;
  createRunId?: () => string;
}): PreparedAnnotationDirectRunThread {
  const storage = options.storage ?? getLocalStorage();
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  const runId = (options.createRunId || createAnnotationDirectRunId)();
  const record = readThreadRecord(options.target, storage);
  const reusableThreadId = isThreadRecordReusable(record, now) ? record.threadId : '';
  const threadId = reusableThreadId || runId;
  return {
    firstRun: !reusableThreadId,
    runId,
    threadId,
    conversationId: threadId,
    target: options.target,
  };
}

export function recordAnnotationDirectRunAccepted(options: {
  target: AnnotationDirectRunTarget;
  storage?: AnnotationDirectRunStorage | null;
  now?: number;
  threadId: string;
}): void {
  const storage = options.storage ?? getLocalStorage();
  const threadId = String(options.threadId || '').trim();
  if (!threadId) {
    return;
  }
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  const previous = readThreadRecord(options.target, storage);
  const keepsWindow = previous?.threadId === threadId;
  const createdAt = keepsWindow && previous.createdAt > 0 ? previous.createdAt : now;
  const expiresAt = keepsWindow && previous.expiresAt > 0
    ? previous.expiresAt
    : createdAt + ANNOTATION_DIRECT_RUN_TTL_MS;
  const sentCount = keepsWindow ? previous.sentCount + 1 : 1;
  const record: AnnotationDirectRunThreadRecord = {
    threadId,
    prototypePath: options.target.prototypePath,
    conversationStorePath: options.target.conversationStorePath,
    createdAt,
    expiresAt,
    sentCount,
    invalidated: false,
  };
  writeThreadRecord(options.target, record, storage);
  setAssistantStoreThreadId({
    projectScope: options.target.projectScope,
    conversationStorePath: options.target.conversationStorePath,
  }, threadId, storage);
  setAssistantResourceThreadId({
    projectScope: options.target.projectScope,
    resourcePath: options.target.prototypePath,
  }, threadId, storage);
}

export function resolveAnnotationProviderLabel(provider: string | null | undefined): string {
  const normalized = String(provider || '').trim();
  return getAcpProviderOption(normalized)?.label || normalized || 'AI';
}

export async function submitAnnotationPromptViaApi(
  options: SubmitAnnotationPromptViaApiOptions,
): Promise<AiRunStreamResult> {
  const storage = options.storage ?? getLocalStorage();
  const now = options.now || Date.now;
  const target = resolveAnnotationDirectRunTarget({
    context: options.context,
    projectPath: options.projectPath,
    projectScope: options.projectScope,
  });
  const prepared = prepareAnnotationDirectRunThread({
    target,
    storage,
    now: now(),
    createRunId: options.createRunId,
  });
  const provider = String(options.provider || '').trim() || null;
  if (prepared.firstRun) {
    options.onFirstRun?.(`首次执行需要先链接到 ${resolveAnnotationProviderLabel(provider)}，请稍等。`);
  }
  await options.onPrepared?.({ ...prepared, provider });

  return runAiStream({
    scene: 'direct',
    prompt: options.prompt,
    runId: prepared.runId,
    threadId: prepared.threadId,
    conversationId: prepared.conversationId,
    preferredPromptClient: options.preferredPromptClient,
    provider,
    conversationStorePath: target.conversationStorePath || undefined,
    model: options.model,
    projectId: options.projectId || undefined,
    context: options.context,
    contextBundle: mapAssistantContextToAcpContextBundle(options.context),
    targetPath: target.currentFilePath,
    builtinToolSettings: options.builtinToolSettings,
    signal: options.signal,
  }, async (event) => {
    if (event.event === 'run.accepted') {
      const acceptedThreadId = String(event.data.threadId || prepared.threadId || '').trim();
      const acceptedRunId = String(event.data.runId || prepared.runId || '').trim();
      const acceptedConversationId = String(event.data.conversationId || acceptedThreadId || prepared.conversationId || '').trim();
      recordAnnotationDirectRunAccepted({
        target,
        storage,
        now: now(),
        threadId: acceptedThreadId,
      });
      await options.onAccepted?.({
        runId: acceptedRunId,
        threadId: acceptedThreadId,
        conversationId: acceptedConversationId,
        provider,
      });
    }
    await options.onEvent?.(event);
  });
}
