import type {
  ElementLocator,
  GenieEditorHostResource,
  PrototypeEditCommentEntry,
  PrototypeEditCommentImageEntry,
  PrototypeEditCommentTaskEntry,
  PrototypeEditCommentTaskStatus,
  PrototypeEditCommentsDocument,
  PrototypeEditCommentsPersistenceAdapter,
  PrototypeEditCommentsPersistenceScope,
  PrototypeEditCommentsWriteReason,
  WebEditorElementKey,
} from '../../web-editor-types';
import { locateElement, locatorKey } from '../locator';
import { generateFullElementLabel, generateStableElementKey } from '../element-key';
import {
  DEFAULT_COMMENT_SHORTCUT_SETTINGS,
  sanitizeCommentShortcutSettings,
  type CommentShortcutSettings,
} from './comment-shortcut-settings';
import {
  DEFAULT_WEB_EDITOR_UI_SETTINGS,
  type WebEditorUiSettings,
} from './ui-settings';
import {
  preparePersistedWebEditorUiSettings,
  readPersistedWebEditorUiSettings,
} from './persisted-ui-settings';
import type { EditorChangesService, EditorPersistenceService } from './contracts';
import type {
  EditorRuntimeState,
  ExternalEditingTaskRef,
  MarkerAnchor,
  PageGenieConversationState,
  PersistedElementGenieTaskState,
} from './state';
import { filterUnprocessedTransactions as filterTransactionsAfterProcessed } from './state';
import { normalizeMarkerAnchor } from './marker-anchor';
import type { GenieEditorTweakValues } from '../../tweak/protocol';
import { normalizePromptCardSkillIds } from '../../ui/runtime/prompt-card-skills';

type CachedTweakEntry = {
  summaryLines?: string[];
  baselineValues?: GenieEditorTweakValues | null;
  currentValues?: GenieEditorTweakValues | null;
};

type CachedMarkerEntry = MarkerAnchor & {
  dirtySince?: number | null;
};

type CachedChangeEntry = {
  elementKey?: WebEditorElementKey;
  label?: string;
  locator: ElementLocator;
  textChange?: { before: string; after: string };
  styleChanges?: { before: Record<string, string>; after: Record<string, string> };
  tweak?: CachedTweakEntry;
  note?: string;
  skillIds?: string[];
  marker?: CachedMarkerEntry | null;
};

type PrototypeCommentEntryDocumentShape = Omit<CachedChangeEntry, 'note'> & {
  comment?: string;
};

type CachedChangePayload = {
  version: number;
  path: string;
  updatedAt: number;
  showMarkers?: boolean;
  entries: CachedChangeEntry[];
};

const CACHE_VERSION = 5;
const CACHE_KEY_PREFIX = 'web-editor-v2-cache:';
const MARKER_VISIBILITY_KEY_PREFIX = 'web-editor-v2-markers:';
const COMMENT_SHORTCUT_SETTINGS_KEY_PREFIX = 'web-editor-v2-comment-shortcuts:';
const UI_SETTINGS_KEY = 'web-editor-v2-ui-settings';
const GENIE_CONVERSATION_KEY_PREFIX = 'web-editor-v2-genie-conversation:';
const GENIE_TASKS_KEY_PREFIX = 'web-editor-v2-genie-tasks:';

function stripLocatorDebugSource(locator: ElementLocator): ElementLocator {
  if (!locator.debugSource) return locator;
  const { debugSource: _debugSource, ...rest } = locator;
  return rest;
}

function cloneTweakValue(value: GenieEditorTweakValues[string] | undefined) {
  return Array.isArray(value) ? value.slice() : value;
}

function cloneTweakValues(values: GenieEditorTweakValues | null | undefined): GenieEditorTweakValues | null {
  if (!values) return null;
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, cloneTweakValue(value)]),
  );
}

export function createPersistenceService(options: {
  state: EditorRuntimeState;
  changes: EditorChangesService;
  getResourceContext?: () => GenieEditorHostResource | null;
  persistenceAdapter?: PrototypeEditCommentsPersistenceAdapter;
  interactionProfile?: 'design' | 'text-comment';
}): EditorPersistenceService {
  const { state, changes } = options;
  const getResourceContext = options.getResourceContext ?? (() => null);
  const persistenceAdapter = options.persistenceAdapter ?? null;
  const interactionProfile = options.interactionProfile ?? 'design';

  let cacheWriteTimer: number | null = null;
  let cacheRestoreInProgress = false;
  let currentAdapterDocument: PrototypeEditCommentsDocument | null = null;
  const commentTaskStateByElementKey = new Map<WebEditorElementKey, PrototypeEditCommentTaskEntry>();

  function readResourceMetaString(key: string): string {
    try {
      const resource = getResourceContext();
      const value = resource?.meta?.[key];
      return typeof value === 'string' ? value.trim() : '';
    } catch {
      return '';
    }
  }

  function inferTargetPathFromCurrentFilePath(currentFilePath: string): string {
    const normalized = String(currentFilePath ?? '').trim().replace(/\\/g, '/');
    const match = normalized.match(/^src\/(components|prototypes|themes)\/([^/]+)/);
    if (!match) return '';
    return `${match[1]}/${match[2]}`;
  }

  function resolveTargetPath(): string | null {
    try {
      const resource = getResourceContext();
      const resourcePath =
        String(resource?.path ?? '').trim() ||
        readResourceMetaString('targetPath') ||
        inferTargetPathFromCurrentFilePath(
          readResourceMetaString('filePath') || readResourceMetaString('currentFilePath'),
        );
      if (resourcePath) {
        return resourcePath;
      }
    } catch {
      // Fall back to location pathname.
    }

    if (typeof window === 'undefined') return null;
    const match = window.location.pathname.match(/\/(components|prototypes)\/([^/]+)/);
    if (!match) return null;
    return `${match[1]}/${match[2]}`;
  }

  function resolveStorageScope(): string | null {
    const explicitScope =
      readResourceMetaString('storageScope') ||
      readResourceMetaString('filePath') ||
      readResourceMetaString('currentFilePath') ||
      readResourceMetaString('docPath') ||
      resolveTargetPath();
    if (explicitScope) {
      return explicitScope;
    }

    if (typeof window === 'undefined') return null;
    const path = String(window.location.pathname ?? '').trim();
    return path || null;
  }

  function resolvePrototypeIdFromTargetPath(targetPath: string | null | undefined): string {
    const normalized = String(targetPath ?? '').trim().replace(/\\/g, '/');
    const match = normalized.match(/^prototypes\/([^/]+)/);
    return match?.[1] ?? '';
  }

  function resolveCurrentFilePath(): string {
    return (
      readResourceMetaString('filePath') ||
      readResourceMetaString('currentFilePath') ||
      readResourceMetaString('docPath')
    );
  }

  function resolvePersistenceScope(): PrototypeEditCommentsPersistenceScope | null {
    const targetPath = resolveTargetPath();
    if (!targetPath || !targetPath.startsWith('prototypes/')) {
      return null;
    }
    const storageScope = resolveStorageScope() ?? targetPath;
    const prototypeId = resolvePrototypeIdFromTargetPath(targetPath);
    if (!prototypeId) return null;
    let resource: GenieEditorHostResource | null = null;
    try {
      resource = getResourceContext();
    } catch {
      resource = null;
    }

    return {
      targetPath,
      storageScope,
      prototypeId,
      filePath: resolveCurrentFilePath(),
      resource,
    };
  }

  function resolveCacheKey(): string | null {
    if (typeof window === 'undefined') return null;
    const path = resolveStorageScope() ?? '';
    const key = String(path ?? '').trim();
    if (!key) return null;
    return `${CACHE_KEY_PREFIX}${key}`;
  }

  function writeLocalCache(entries: CachedChangeEntry[], updatedAt = Date.now()): void {
    if (typeof window === 'undefined') return;
    const key = resolveCacheKey();
    if (!key) return;
    try {
      if (!entries || entries.length === 0) {
        window.localStorage.removeItem(key);
        return;
      }
      const payload: CachedChangePayload = {
        version: CACHE_VERSION,
        path: resolveStorageScope() ?? window.location.pathname ?? '',
        updatedAt,
        showMarkers: state.changeMarkersVisible,
        entries,
      };
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // Best-effort only.
    }
  }

  function readCache(): CachedChangePayload | null {
    if (typeof window === 'undefined') return null;
    const key = resolveCacheKey();
    if (!key) return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedChangePayload;
      if (!parsed || ![1, 2, 3, 4, CACHE_VERSION].includes(Number(parsed.version ?? 0))) return null;
      if (!Array.isArray(parsed.entries)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function resolveMarkerVisibilityKey(): string | null {
    if (typeof window === 'undefined') return null;
    const path = resolveStorageScope() ?? '';
    const key = String(path ?? '').trim();
    if (!key) return null;
    return `${MARKER_VISIBILITY_KEY_PREFIX}${key}`;
  }

  function readMarkerVisibility(): boolean {
    if (typeof window === 'undefined') return true;
    const cacheValue = readCache()?.showMarkers;
    if (typeof cacheValue === 'boolean') return cacheValue;

    const key = resolveMarkerVisibilityKey();
    if (!key) return true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === 'false') return false;
      if (raw === 'true') return true;
    } catch {
      // Best-effort only.
    }
    return true;
  }

  function resolveCommentShortcutSettingsKey(): string | null {
    if (typeof window === 'undefined') return null;
    const path = resolveStorageScope() ?? '';
    const key = String(path ?? '').trim();
    if (!key) return null;
    return `${COMMENT_SHORTCUT_SETTINGS_KEY_PREFIX}${key}`;
  }

  function readStorageJson<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  function writeStorageJson(key: string, value: unknown): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Best-effort only.
    }
  }

  function normalizeDocumentTaskState(status: string | null | undefined): PrototypeEditCommentTaskEntry['state'] {
    if (status === 'pending' || status === 'created') return 'editing';
    if (status === 'completed') return 'completed';
    if (status === 'error') return 'error';
    return 'idle';
  }

  function isPrototypeEditCommentTaskStatus(value: unknown): value is PrototypeEditCommentTaskStatus {
    return value === 'idle' || value === 'editing' || value === 'completed' || value === 'error';
  }

  function normalizeNullableString(value: unknown): string | null {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || null;
  }

  function normalizeAdapterTasks(value: unknown): Record<WebEditorElementKey, PrototypeEditCommentTaskEntry> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    const tasks: Record<WebEditorElementKey, PrototypeEditCommentTaskEntry> = {};
    for (const [rawElementKey, rawTask] of Object.entries(value as Record<string, unknown>)) {
      const elementKey = String(rawElementKey ?? '').trim();
      if (!elementKey || !rawTask || typeof rawTask !== 'object' || Array.isArray(rawTask)) {
        continue;
      }
      const task = rawTask as Partial<PrototypeEditCommentTaskEntry>;
      const updatedAt = Number(task.updatedAt ?? 0);
      tasks[elementKey] = {
        state: isPrototypeEditCommentTaskStatus(task.state) ? task.state : 'idle',
        provider: normalizeNullableString(task.provider),
        requestId: normalizeNullableString(task.requestId),
        sessionId: normalizeNullableString(task.sessionId),
        updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : null,
        message: normalizeNullableString(task.message),
      };
    }
    return tasks;
  }

  function buildDocumentTasks(): Record<WebEditorElementKey, PrototypeEditCommentTaskEntry> {
    const tasks: Record<WebEditorElementKey, PrototypeEditCommentTaskEntry> = Object.fromEntries(
      Array.from(commentTaskStateByElementKey.entries()).map(([elementKey, task]) => [elementKey, { ...task }]),
    );
    const allTasks = [
      ...state.genieTaskByElementKey.values(),
      ...state.externalEditingTaskByElementKey.values(),
    ];
    for (const task of allTasks) {
      if (!task?.elementKey) continue;
      tasks[task.elementKey] = {
        state: normalizeDocumentTaskState(task.status),
        provider: task.provider,
        requestId: task.requestId,
        sessionId: task.sessionId,
        updatedAt: task.updatedAt,
        message: task.message,
      };
    }
    return tasks;
  }

  function buildDocumentImages(): PrototypeEditCommentImageEntry[] {
    return Array.from(state.editMetaByKey.values()).flatMap((meta) =>
      meta.images.map((image) => ({
        id: image.id,
        elementKey: meta.elementKey,
        name: image.name,
        mimeType: image.mimeType,
        size: image.size,
        createdAt: image.createdAt,
        ...(image.data ? { data: image.data } : {}),
        ...('assetPath' in image && typeof image.assetPath === 'string'
          ? { assetPath: image.assetPath }
          : {}),
      })),
    );
  }

  function cacheEntryToCommentEntry(entry: CachedChangeEntry): PrototypeCommentEntryDocumentShape {
    const { note, ...rest } = entry;
    return {
      ...rest,
      ...(note ? { comment: note } : {}),
    };
  }

  function commentEntryToCacheEntry(entry: PrototypeEditCommentEntry): CachedChangeEntry {
    const { comment, ...rest } = entry;
    return {
      ...(rest as CachedChangeEntry),
      ...(comment ? { note: comment } : {}),
    };
  }

  function buildAdapterDocument(
    entries: CachedChangeEntry[],
  ): PrototypeEditCommentsDocument | null {
    const scope = resolvePersistenceScope();
    if (!scope) return null;
    return {
      schemaVersion: 1,
      kind: 'prototype-edit-comments',
      resource: {
        id: scope.prototypeId,
        targetPath: scope.targetPath,
        filePath: `src/${scope.targetPath}/.spec/prototype-comments.json`,
      },
      comments: entries.map(cacheEntryToCommentEntry),
      tasks: buildDocumentTasks(),
      images: buildDocumentImages(),
    };
  }

  function normalizeAdapterDocument(value: unknown): PrototypeEditCommentsDocument | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Partial<PrototypeEditCommentsDocument>;
    if (record.schemaVersion !== 1 || record.kind !== 'prototype-edit-comments') return null;
    if (!Array.isArray(record.comments)) return null;
    return {
      schemaVersion: 1,
      kind: 'prototype-edit-comments',
      resource: {
        id: String(record.resource?.id ?? '').trim(),
        targetPath: String(record.resource?.targetPath ?? '').trim(),
        filePath: String(record.resource?.filePath ?? '').trim(),
      },
      comments: record.comments,
      tasks: normalizeAdapterTasks(record.tasks),
      images: Array.isArray(record.images) ? record.images : [],
    };
  }

  function mergeAdapterTaskStates(document: PrototypeEditCommentsDocument): void {
    for (const [elementKey, task] of Object.entries(document.tasks ?? {})) {
      const normalizedElementKey = String(elementKey ?? '').trim();
      if (!normalizedElementKey) continue;
      commentTaskStateByElementKey.set(normalizedElementKey, { ...task });
    }
  }

  function writeAdapterDocument(
    entries: CachedChangeEntry[],
    reason: PrototypeEditCommentsWriteReason,
  ): void {
    if (!persistenceAdapter?.write) return;
    const scope = resolvePersistenceScope();
    if (!scope) return;
    const document = buildAdapterDocument(entries);
    if (!document) return;
    void Promise.resolve(persistenceAdapter.write(scope, document, reason)).catch((error) => {
      console.warn('[GenieEditor] Failed to persist prototype comments:', error);
    });
  }

  function removeStorageKey(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Best-effort only.
    }
  }

  function resolveGenieConversationKey(scopeKey: string): string {
    return `${GENIE_CONVERSATION_KEY_PREFIX}${scopeKey}`;
  }

  function resolveGenieTasksKey(scopeKey: string): string {
    return `${GENIE_TASKS_KEY_PREFIX}${scopeKey}`;
  }

  function sanitizePageGenieConversationState(
    value: unknown,
  ): PageGenieConversationState | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Partial<PageGenieConversationState>;
    const scopeKey = String(record.scopeKey ?? '').trim();
    const sessionId = String(record.sessionId ?? '').trim();
    if (!scopeKey || !sessionId) return null;

    const createdAt = Number(record.createdAt ?? 0);
    const lastUsedAt = Number(record.lastUsedAt ?? createdAt);
    const sentCount = Math.max(0, Math.floor(Number(record.sentCount ?? 0)));
    const expiresAt = Number(record.expiresAt ?? createdAt);

    return {
      scopeKey,
      sessionId,
      provider: typeof record.provider === 'string' && record.provider.trim()
        ? record.provider.trim()
        : null,
      projectPath: typeof record.projectPath === 'string' && record.projectPath.trim()
        ? record.projectPath.trim()
        : null,
      createdAt: Number.isFinite(createdAt) ? createdAt : 0,
      lastUsedAt: Number.isFinite(lastUsedAt) ? lastUsedAt : Number.isFinite(createdAt) ? createdAt : 0,
      sentCount: Number.isFinite(sentCount) ? sentCount : 0,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
      invalidated: Boolean(record.invalidated),
      sessionPath: typeof record.sessionPath === 'string' && record.sessionPath.trim()
        ? record.sessionPath.trim()
        : null,
      sessionUrl: typeof record.sessionUrl === 'string' && record.sessionUrl.trim()
        ? record.sessionUrl.trim()
        : null,
    };
  }

  function sanitizePersistedElementGenieTaskState(
    value: unknown,
  ): PersistedElementGenieTaskState | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Partial<PersistedElementGenieTaskState>;
    const scopeKey = String(record.scopeKey ?? '').trim();
    const requestId = String(record.requestId ?? '').trim();
    if (!scopeKey || !requestId || !record.locator) return null;

    const status = record.status;
    if (status !== 'pending' && status !== 'created' && status !== 'completed' && status !== 'error') {
      return null;
    }

    const startedAt = Number(record.startedAt ?? 0);
    const updatedAt = Number(record.updatedAt ?? startedAt);
    const lastEventAt = Number(record.lastEventAt ?? updatedAt);

    // Preserve origin if valid
    const origin = record.origin === 'genie-run' || record.origin === 'external-editing'
      ? record.origin
      : undefined;

    return {
      scopeKey,
      elementKey: String(record.elementKey ?? '').trim() || locatorKey(record.locator),
      locator: record.locator,
      label: String(record.label ?? '').trim(),
      requestId,
      sessionId: typeof record.sessionId === 'string' && record.sessionId.trim()
        ? record.sessionId.trim()
        : null,
      sessionPath: typeof record.sessionPath === 'string' && record.sessionPath.trim()
        ? record.sessionPath.trim()
        : null,
      sessionUrl: typeof record.sessionUrl === 'string' && record.sessionUrl.trim()
        ? record.sessionUrl.trim()
        : null,
      provider: typeof record.provider === 'string' && record.provider.trim()
        ? record.provider.trim()
        : null,
      status,
      message: String(record.message ?? '').trim(),
      startedAt: Number.isFinite(startedAt) ? startedAt : 0,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : Number.isFinite(startedAt) ? startedAt : 0,
      dismissed: Boolean(record.dismissed),
      recoveryPending: Boolean(record.recoveryPending),
      lastEventAt: Number.isFinite(lastEventAt) ? lastEventAt : Number.isFinite(updatedAt) ? updatedAt : 0,
      errorCode: typeof record.errorCode === 'string' && record.errorCode.trim()
        ? record.errorCode.trim()
        : null,
      origin,
    };
  }

  function setMarkerVisibility(visible: boolean): void {
    if (typeof window === 'undefined') return;
    const key = resolveMarkerVisibilityKey();
    if (!key) return;
    try {
      window.localStorage.setItem(key, visible ? 'true' : 'false');
    } catch {
      // Best-effort only.
    }
  }

  function readCommentShortcutSettings(): CommentShortcutSettings {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_COMMENT_SHORTCUT_SETTINGS };
    }

    const key = resolveCommentShortcutSettingsKey();
    if (!key) {
      return { ...DEFAULT_COMMENT_SHORTCUT_SETTINGS };
    }

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return { ...DEFAULT_COMMENT_SHORTCUT_SETTINGS };
      }
      return sanitizeCommentShortcutSettings(JSON.parse(raw) as CommentShortcutSettings);
    } catch {
      return { ...DEFAULT_COMMENT_SHORTCUT_SETTINGS };
    }
  }

  function setCommentShortcutSettings(settings: CommentShortcutSettings): void {
    if (typeof window === 'undefined') return;
    const key = resolveCommentShortcutSettingsKey();
    if (!key) return;
    try {
      window.localStorage.setItem(
        key,
        JSON.stringify(sanitizeCommentShortcutSettings(settings)),
      );
    } catch {
      // Best-effort only.
    }
  }

  function readUiSettings(): WebEditorUiSettings {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_WEB_EDITOR_UI_SETTINGS };
    }

    try {
      const raw = window.localStorage.getItem(UI_SETTINGS_KEY);
      if (!raw) {
        return { ...DEFAULT_WEB_EDITOR_UI_SETTINGS };
      }
      return readPersistedWebEditorUiSettings(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_WEB_EDITOR_UI_SETTINGS };
    }
  }

  function setUiSettings(settings: WebEditorUiSettings): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        UI_SETTINGS_KEY,
        JSON.stringify(preparePersistedWebEditorUiSettings(settings)),
      );
    } catch {
      // Best-effort only.
    }
  }

  function readGenieConversationState(scopeKey: string): PageGenieConversationState | null {
    const normalizedScopeKey = String(scopeKey ?? '').trim();
    if (!normalizedScopeKey) return null;
    return sanitizePageGenieConversationState(
      readStorageJson(resolveGenieConversationKey(normalizedScopeKey)),
    );
  }

  function writeGenieConversationState(
    scopeKey: string,
    conversation: PageGenieConversationState,
  ): void {
    const normalizedScopeKey = String(scopeKey ?? '').trim();
    if (!normalizedScopeKey) return;
    const sanitized = sanitizePageGenieConversationState(conversation);
    if (!sanitized) {
      removeStorageKey(resolveGenieConversationKey(normalizedScopeKey));
      return;
    }
    writeStorageJson(resolveGenieConversationKey(normalizedScopeKey), sanitized);
  }

  function clearGenieConversationState(scopeKey: string): void {
    const normalizedScopeKey = String(scopeKey ?? '').trim();
    if (!normalizedScopeKey) return;
    removeStorageKey(resolveGenieConversationKey(normalizedScopeKey));
  }

  function readGenieTaskStates(scopeKey: string): PersistedElementGenieTaskState[] {
    const normalizedScopeKey = String(scopeKey ?? '').trim();
    if (!normalizedScopeKey) return [];
    const raw = readStorageJson<unknown[]>(resolveGenieTasksKey(normalizedScopeKey));
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => sanitizePersistedElementGenieTaskState(entry))
      .filter((entry): entry is PersistedElementGenieTaskState => {
        if (!entry || entry.dismissed) return false;
        // External-editing tasks: accept any status, no sessionId/provider required
        if (entry.origin === 'external-editing') return true;
        // Standard genie tasks: require running status + session + provider
        return (
          (entry.status === 'pending' || entry.status === 'created') &&
          typeof entry.sessionId === 'string' &&
          entry.sessionId.trim().length > 0 &&
          typeof entry.provider === 'string' &&
          entry.provider.trim().length > 0
        );
      });
  }

  function writeGenieTaskStates(
    scopeKey: string,
    tasks: PersistedElementGenieTaskState[],
  ): void {
    const normalizedScopeKey = String(scopeKey ?? '').trim();
    if (!normalizedScopeKey) return;
    const sanitized = Array.isArray(tasks)
      ? tasks
          .map((entry) => sanitizePersistedElementGenieTaskState(entry))
          .filter((entry): entry is PersistedElementGenieTaskState => {
            if (!entry || entry.dismissed) return false;
            // External-editing tasks: accept any status, no sessionId/provider required
            if (entry.origin === 'external-editing') return true;
            // Standard genie tasks: require running status + session + provider
            return (
              (entry.status === 'pending' || entry.status === 'created') &&
              typeof entry.sessionId === 'string' &&
              entry.sessionId.trim().length > 0 &&
              typeof entry.provider === 'string' &&
              entry.provider.trim().length > 0
            );
          })
      : [];
    if (sanitized.length === 0) {
      removeStorageKey(resolveGenieTasksKey(normalizedScopeKey));
      return;
    }
    writeStorageJson(resolveGenieTasksKey(normalizedScopeKey), sanitized);
  }

  function recordCommentTaskState(
    elementKey: WebEditorElementKey,
    stateValue: PrototypeEditCommentTaskStatus,
    taskRef: Partial<ExternalEditingTaskRef> | null = null,
  ): void {
    const normalizedElementKey = String(elementKey ?? '').trim();
    if (!normalizedElementKey) return;
    commentTaskStateByElementKey.set(normalizedElementKey, {
      state: stateValue,
      provider: typeof taskRef?.provider === 'string' && taskRef.provider.trim()
        ? taskRef.provider.trim()
        : null,
      requestId: typeof taskRef?.requestId === 'string' && taskRef.requestId.trim()
        ? taskRef.requestId.trim()
        : null,
      sessionId: typeof taskRef?.sessionId === 'string' && taskRef.sessionId.trim()
        ? taskRef.sessionId.trim()
        : null,
      updatedAt: Date.now(),
      message: stateValue === 'completed'
        ? '修改完成'
        : stateValue === 'error'
          ? 'AI 修改失败'
          : stateValue === 'editing'
            ? 'AI 编辑中'
            : '',
    });
    persistTaskDocument();
  }

  function pruneExpiredGenieTaskStates(scopeKey: string): void {
    const normalizedScopeKey = String(scopeKey ?? '').trim();
    if (!normalizedScopeKey) return;
    writeGenieTaskStates(normalizedScopeKey, readGenieTaskStates(normalizedScopeKey));
  }

  function writeCache(entries: CachedChangeEntry[], reason: PrototypeEditCommentsWriteReason = 'changes'): void {
    writeLocalCache(entries);
    writeAdapterDocument(entries, reason);
  }

  function buildCacheEntriesFromTransactions(): CachedChangeEntry[] {
    const tm = state.transactionManager;
    if (!tm) {
      return Array.from(state.editMetaByKey.values())
        .filter((meta) => meta.note || (meta.skillIds?.length ?? 0) > 0 || meta.anchor)
        .map((meta) => ({
          elementKey: meta.elementKey,
          label: meta.label,
          locator: stripLocatorDebugSource(meta.locator),
          note: meta.note || undefined,
          skillIds: meta.skillIds?.slice(),
          marker: meta.anchor
            ? {
                ...meta.anchor,
                dirtySince: meta.dirtySince,
              }
            : null,
        }));
    }

    const txs = filterTransactionsAfterProcessed(state, tm.getUndoStack()).slice();
    const indexed = txs.map((tx, index) => ({ tx, index }));
    indexed.sort((a, b) => {
      const at = Number(a.tx.timestamp ?? 0);
      const bt = Number(b.tx.timestamp ?? 0);
      if (at !== bt) return at - bt;
      return a.index - b.index;
    });

    type CacheGroup = {
      locator: ElementLocator;
      styleBefore: Record<string, string>;
      styleAfter: Record<string, string>;
      textBefore?: string;
      textAfter?: string;
    };

    const groups = new Map<string, CacheGroup>();

    for (const { tx } of indexed) {
      if (tx.type !== 'style' && tx.type !== 'text') continue;
      const key = tx.elementKey ? String(tx.elementKey) : locatorKey(tx.targetLocator);
      const existing = groups.get(key);
      const locator = (tx.after?.locator ?? tx.targetLocator) as ElementLocator;
      const group: CacheGroup =
        existing ?? {
          locator,
          styleBefore: {},
          styleAfter: {},
          textBefore: undefined,
          textAfter: undefined,
        };

      group.locator = locator;

      if (tx.type === 'style') {
        const beforeRaw = tx.before.styles ?? {};
        const afterRaw = tx.after.styles ?? {};
        const keys = new Set([...Object.keys(beforeRaw), ...Object.keys(afterRaw)]);
        for (const rawProp of keys) {
          const prop = String(rawProp ?? '').trim();
          if (!prop) continue;
          if (!(prop in group.styleBefore)) {
            group.styleBefore[prop] = String(beforeRaw[prop] ?? '').trim();
          }
          group.styleAfter[prop] = String(afterRaw[prop] ?? '').trim();
        }
      }

      if (tx.type === 'text') {
        if (group.textBefore === undefined) {
          group.textBefore = String(tx.before.text ?? '');
        }
        group.textAfter = String(tx.after.text ?? '');
      }

      if (!existing) {
        groups.set(key, group);
      }
    }

    const entries: CachedChangeEntry[] = [];
    const appendedKeys = new Set<WebEditorElementKey>();

    for (const group of groups.values()) {
      const entry: CachedChangeEntry = { locator: stripLocatorDebugSource(group.locator) };
      let elementKey: WebEditorElementKey | null;
      const liveElement = locateElement(group.locator);
      if (liveElement) {
        elementKey = generateStableElementKey(liveElement, group.locator.shadowHostChain);
      } else {
        elementKey = locatorKey(group.locator);
      }

      const before: Record<string, string> = {};
      const after: Record<string, string> = {};
      const allProps = new Set([
        ...Object.keys(group.styleBefore),
        ...Object.keys(group.styleAfter),
      ]);
      for (const prop of allProps) {
        const b = String(group.styleBefore[prop] ?? '').trim();
        const a = String(group.styleAfter[prop] ?? '').trim();
        if (b === a) continue;
        before[prop] = b;
        after[prop] = a;
      }
      if (Object.keys(before).length > 0 || Object.keys(after).length > 0) {
        entry.styleChanges = { before, after };
      }

      if (
        group.textBefore !== undefined &&
        group.textAfter !== undefined &&
        group.textBefore !== group.textAfter
      ) {
        entry.textChange = { before: group.textBefore, after: group.textAfter };
      }

      const meta = elementKey ? state.editMetaByKey.get(elementKey) : null;
      if (meta?.elementKey) entry.elementKey = meta.elementKey;
      if (meta?.label) entry.label = meta.label;
      if ((meta?.tweakSummaryLines?.length ?? 0) > 0) {
        entry.tweak = {
          summaryLines: [...(meta?.tweakSummaryLines ?? [])],
          baselineValues: cloneTweakValues(meta?.tweakBaselineValues),
          currentValues: cloneTweakValues(meta?.tweakCurrentValues),
        };
      }
      if (meta?.note) entry.note = meta.note;
      if ((meta?.skillIds?.length ?? 0) > 0) entry.skillIds = meta?.skillIds?.slice();
      if (meta?.anchor) {
        entry.marker = {
          ...meta.anchor,
          dirtySince: meta.dirtySince,
        };
      }

      if (!entry.textChange && !entry.styleChanges && !entry.tweak && !entry.note && !(entry.skillIds?.length ?? 0)) continue;
      entries.push(entry);
      if (elementKey) {
        appendedKeys.add(elementKey);
      }
    }

    for (const meta of state.editMetaByKey.values()) {
      if (appendedKeys.has(meta.elementKey)) continue;
      const hasRecordedTweak = (meta.tweakSummaryLines?.length ?? 0) > 0;
      const hasImages = meta.images.length > 0;
      if (!meta.note && !hasRecordedTweak && !hasImages && !(meta.skillIds?.length ?? 0)) continue;
      entries.push({
        elementKey: meta.elementKey,
        label: meta.label,
        locator: stripLocatorDebugSource(meta.locator),
        tweak: hasRecordedTweak
          ? {
              summaryLines: [...(meta.tweakSummaryLines ?? [])],
              baselineValues: cloneTweakValues(meta.tweakBaselineValues),
              currentValues: cloneTweakValues(meta.tweakCurrentValues),
            }
          : undefined,
        note: meta.note || undefined,
        skillIds: meta.skillIds?.slice(),
        marker: meta.anchor
          ? {
              ...meta.anchor,
              dirtySince: meta.dirtySince,
            }
          : null,
      });
    }

    return entries;
  }

  function persistFromTransactions(): void {
    if (cacheRestoreInProgress) return;
    writeCache(buildCacheEntriesFromTransactions());
  }

  function persistTaskDocument(): void {
    if (cacheRestoreInProgress) return;
    writeAdapterDocument(buildCacheEntriesFromTransactions(), 'tasks');
  }

  function flushPendingWrite(): void {
    if (cacheWriteTimer !== null) {
      window.clearTimeout(cacheWriteTimer);
      cacheWriteTimer = null;
    }
    persistFromTransactions();
  }

  function scheduleWrite(): void {
    if (cacheRestoreInProgress) return;
    if (cacheWriteTimer !== null) {
      window.clearTimeout(cacheWriteTimer);
    }
    cacheWriteTimer = window.setTimeout(() => {
      cacheWriteTimer = null;
      persistFromTransactions();
    }, 120);
  }

  function applyCachedEntries(entries: CachedChangeEntry[]): void {
    const tm = state.transactionManager;
    if (!tm) return;

    for (const entry of entries) {
      const entryElementKey = String(entry.elementKey ?? '').trim();
      const isLegacyTextCommentCacheEntry = (
        interactionProfile === 'text-comment' &&
        !entryElementKey &&
        Boolean(entry.note) &&
        Boolean(entry.marker) &&
        !entry.textChange &&
        !entry.styleChanges
      );
      if (isLegacyTextCommentCacheEntry) {
        continue;
      }

      const element = locateElement(entry.locator);
      if (!element || !element.isConnected) continue;

      const resolvedElementKey = entryElementKey || generateStableElementKey(element, entry.locator.shadowHostChain);
      const resolvedLabel = String(entry.label ?? '').trim() || generateFullElementLabel(element, entry.locator.shadowHostChain);
      const meta = changes.getOrCreateEditMeta(
        resolvedElementKey,
        entry.locator,
        resolvedLabel,
      );
      meta.locator = entry.locator;
      meta.label = resolvedLabel;
      meta.note = changes.normalizeNote(entry.note ?? meta.note);
      const entrySkillIds = normalizePromptCardSkillIds(entry.skillIds ?? []);
      if (entrySkillIds.length > 0) {
        meta.skillIds = entrySkillIds;
      }
      meta.anchor = entry.marker ? normalizeMarkerAnchor(entry.marker) ?? meta.anchor : meta.anchor;
      if (entry.marker && Number.isFinite(Number(entry.marker.dirtySince))) {
        meta.dirtySince = Number(entry.marker.dirtySince);
      }
      const documentImages = currentAdapterDocument?.images?.filter((image) => image.elementKey === resolvedElementKey) ?? [];
      if (documentImages.length > 0) {
        const hydratedImages = documentImages
          .filter((image) => typeof image.data === 'string' && image.data.trim())
          .map((image) => ({
            id: String(image.id ?? '').trim() || `image-${meta.images.length + 1}`,
            name: String(image.name ?? '').trim() || 'comment-image.png',
            data: String(image.data ?? ''),
            mimeType: String(image.mimeType ?? '').trim() || 'image/png',
            size: Number(image.size ?? 0),
            createdAt: Number(image.createdAt ?? Date.now()),
          }));
        if (hydratedImages.length > 0) {
          meta.images = hydratedImages;
        }
        if (hydratedImages.length > 0 && meta.dirtySince === null) {
          meta.dirtySince = Date.now();
        }
      }
      if ((entry.tweak?.summaryLines?.length ?? 0) > 0) {
        meta.tweakSummaryLines = [...(entry.tweak?.summaryLines ?? [])];
        meta.tweakBaselineValues = cloneTweakValues(entry.tweak?.baselineValues);
        meta.tweakCurrentValues = cloneTweakValues(entry.tweak?.currentValues);
        meta.changeKinds = ['tweak', ...meta.changeKinds.filter((kind) => kind !== 'tweak')];
        if (meta.dirtySince === null) {
          meta.dirtySince = Date.now();
        }
      }

      if (entry.styleChanges) {
        const afterStyles = entry.styleChanges.after ?? {};
        const beforeStyles = entry.styleChanges.before ?? {};
        for (const prop of Object.keys(afterStyles)) {
          const afterValue = String(afterStyles[prop] ?? '');
          const beforeValue = String(beforeStyles[prop] ?? '');
          const style = (element as HTMLElement).style;
          if (style) {
            if (afterValue.trim()) {
              style.setProperty(prop, afterValue.trim());
            } else {
              style.removeProperty(prop);
            }
          }
          tm.recordStyle(entry.locator, prop, beforeValue, afterValue, { merge: false });
        }
      }

      if (entry.textChange) {
        const before = String(entry.textChange.before ?? '');
        const after = String(entry.textChange.after ?? '');
        if (before !== after && element instanceof HTMLElement) {
          element.textContent = after;
          tm.recordText(element, before, after);
        }
      }
    }
  }

  async function readAdapterDocument(): Promise<PrototypeEditCommentsDocument | null> {
    if (!persistenceAdapter?.read) return null;
    const scope = resolvePersistenceScope();
    if (!scope) return null;
    try {
      const document = await Promise.resolve(persistenceAdapter.read(scope));
      return normalizeAdapterDocument(document);
    } catch (error) {
      console.warn('[GenieEditor] Failed to read prototype comments:', error);
      return null;
    }
  }

  async function restoreCachedChanges(): Promise<void> {
    if (typeof window === 'undefined') return;
    const adapterDocument = await readAdapterDocument();
    if (adapterDocument) {
      mergeAdapterTaskStates(adapterDocument);
    }
    const payload: CachedChangePayload | null = adapterDocument
      ? {
          version: CACHE_VERSION,
          path: adapterDocument.resource.targetPath || resolveStorageScope() || '',
          updatedAt: Date.now(),
          showMarkers: state.changeMarkersVisible,
          entries: adapterDocument.comments.map(commentEntryToCacheEntry),
        }
      : readCache();
    if (!payload) return;
    if (payload.entries.length === 0) {
      if (adapterDocument) {
        writeLocalCache([], payload.updatedAt);
      }
      return;
    }
    cacheRestoreInProgress = true;
    currentAdapterDocument = adapterDocument;
    try {
      if (typeof payload.showMarkers === 'boolean') {
        state.changeMarkersVisible = payload.showMarkers;
        setMarkerVisibility(payload.showMarkers);
      } else {
        state.changeMarkersVisible = readMarkerVisibility();
      }
      applyCachedEntries(payload.entries);
    } finally {
      cacheRestoreInProgress = false;
      currentAdapterDocument = null;
    }
    state.propertyPanel?.refresh();
    changes.syncEditMetaWithTransactions();
    if (adapterDocument) {
      writeLocalCache(buildCacheEntriesFromTransactions());
      return;
    }
    persistFromTransactions();
  }

  function clearCachedChanges(kind: 'text' | 'style'): void {
    const entries = buildCacheEntriesFromTransactions();
    if (entries.length === 0) {
      writeCache([], 'clear');
      return;
    }

    const nextEntries: CachedChangeEntry[] = [];
    for (const entry of entries) {
      const next: CachedChangeEntry = { locator: entry.locator };
      if (entry.elementKey) next.elementKey = entry.elementKey;
      if (entry.label) next.label = entry.label;
      if (entry.tweak) next.tweak = entry.tweak;
      if (entry.note) next.note = entry.note;
      if (entry.skillIds) next.skillIds = entry.skillIds;
      if (entry.marker) next.marker = entry.marker;
      if (kind === 'text') {
        if (entry.styleChanges) next.styleChanges = entry.styleChanges;
      } else {
        if (entry.textChange) next.textChange = entry.textChange;
      }
      if (!next.textChange && !next.styleChanges && !next.tweak && !next.note && !(next.skillIds?.length ?? 0)) continue;
      nextEntries.push(next);
    }

    cacheRestoreInProgress = true;
    try {
      state.transactionManager?.clear();
      applyCachedEntries(nextEntries);
    } finally {
      cacheRestoreInProgress = false;
    }
    writeCache(nextEntries);
  }

  function clearStorage(): void {
    writeCache([], 'clear');
  }

  return {
    readMarkerVisibility,
    setMarkerVisibility,
    readCommentShortcutSettings,
    setCommentShortcutSettings,
    readUiSettings,
    setUiSettings,
    readGenieConversationState,
    writeGenieConversationState,
    clearGenieConversationState,
    readGenieTaskStates,
    writeGenieTaskStates(scopeKey, tasks) {
      writeGenieTaskStates(scopeKey, tasks);
      persistTaskDocument();
    },
    pruneExpiredGenieTaskStates,
    recordCommentTaskState,
    scheduleWrite,
    persistFromTransactions,
    flushPendingWrite,
    restoreCachedChanges,
    clearCachedChanges,
    clearStorage,
  };
}
