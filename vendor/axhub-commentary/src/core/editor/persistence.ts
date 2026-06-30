import type {
  ElementLocator,
  CommentaryHostResource,
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
import type { CommentaryTweakValues } from '../../tweak/protocol';
import { normalizePromptCardSkillIds } from '../../ui/runtime/prompt-card-skills';

type CachedTweakEntry = {
  summaryLines?: string[];
  baselineValues?: CommentaryTweakValues | null;
  currentValues?: CommentaryTweakValues | null;
};

type CachedMarkerEntry = MarkerAnchor & {
  dirtySince?: number | null;
};

type CachedChangeEntry = {
  pageScope?: string;
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
const SCOPED_COMMENT_TASK_KEY_PREFIX = 'page-scope:';
const ANNOTATION_PANEL_NODE_ID_ATTR = 'data-axhub-annotation-panel-node-id';

function stripLocatorDebugSource(locator: ElementLocator): ElementLocator {
  if (!locator.debugSource) return locator;
  const { debugSource: _debugSource, ...rest } = locator;
  return rest;
}

function extractAnnotationPanelNodeId(locator: ElementLocator | null | undefined): string {
  for (const selector of locator?.selectors ?? []) {
    const normalized = String(selector ?? '').trim();
    if (!normalized) continue;
    const match = normalized.match(/\[data-axhub-annotation-panel-node-id=(?:"([^"]+)"|'([^']+)'|([^\]]+))\]/);
    const rawValue = match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
    const nodeId = String(rawValue).trim();
    if (nodeId) return nodeId;
  }
  return '';
}

function normalizeAnnotationPanelCacheIdentity(
  locator: ElementLocator,
): { elementKey: WebEditorElementKey; locator: ElementLocator } | null {
  const nodeId = extractAnnotationPanelNodeId(locator);
  if (!nodeId) return null;
  const nextElementKey = `annotation-panel:${nodeId}` as WebEditorElementKey;
  return {
    elementKey: nextElementKey,
    locator: {
      ...locator,
      fingerprint: nextElementKey,
    },
  };
}

function collectAnnotationSourceNodeIdsFromWindow(): Set<string> | null {
  if (typeof window === 'undefined') return null;
  const runtimeWindow = window as Window & {
    __AXHUB_ANNOTATION_SOURCE_DOCUMENT__?: {
      data?: { nodes?: Array<{ id?: unknown }> };
    };
    __AXHUB_ANNOTATION_SOURCE__?: {
      nodes?: Array<{ id?: unknown }>;
    };
  };
  const documentNodes = runtimeWindow.__AXHUB_ANNOTATION_SOURCE_DOCUMENT__?.data?.nodes;
  const snapshotNodes = runtimeWindow.__AXHUB_ANNOTATION_SOURCE__?.nodes;
  const nodes = Array.isArray(documentNodes)
    ? documentNodes
    : Array.isArray(snapshotNodes)
      ? snapshotNodes
      : null;
  if (!nodes) return null;
  return new Set(
    nodes
      .map((node) => String(node?.id ?? '').trim())
      .filter(Boolean),
  );
}

function cloneTweakValue(value: CommentaryTweakValues[string] | undefined) {
  return Array.isArray(value) ? value.slice() : value;
}

function cloneTweakValues(values: CommentaryTweakValues | null | undefined): CommentaryTweakValues | null {
  if (!values) return null;
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, cloneTweakValue(value)]),
  );
}

export function createPersistenceService(options: {
  state: EditorRuntimeState;
  changes: EditorChangesService;
  getResourceContext?: () => CommentaryHostResource | null;
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
  let lastAdapterDocument: PrototypeEditCommentsDocument | null = null;
  let preserveMissingCurrentScopeRecordsOnNextWrite = false;
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
    let resource: CommentaryHostResource | null = null;
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
        entries: entries.map((entry) => withCurrentPageScope(entry)),
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

  function normalizePageScope(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  function readDomPageScope(): string {
    if (typeof document === 'undefined') return '';
    try {
      const explicit =
        document.documentElement?.getAttribute?.('data-page-id') ||
        document.body?.getAttribute?.('data-page-id') ||
        '';
      return normalizePageScope(explicit);
    } catch {
      return '';
    }
  }

  function resolvePageScopeFromLocation(): string {
    if (typeof window === 'undefined') return '';
    try {
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.search);
      for (const key of ['editor', 'axhubPane', 'axhubQuickEditContext', 'genieToolbar']) {
        params.delete(key);
      }
      const sortedParams = new URLSearchParams();
      Array.from(params.entries())
        .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
          leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
        )
        .forEach(([key, value]) => sortedParams.append(key, value));
      const search = sortedParams.toString();
      return `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
    } catch {
      return String(window.location.pathname ?? '').trim();
    }
  }

  function hasPageRouteSignal(pageScope: string): boolean {
    const scope = normalizePageScope(pageScope);
    if (!scope) return false;
    if (/^page[:=]/iu.test(scope)) return true;
    if (scope.includes('::page::')) return true;
    try {
      const url = new URL(scope, 'http://axhub.local');
      if (url.searchParams.has('page')) return true;
      return new URLSearchParams(url.hash.replace(/^#/, '')).has('page');
    } catch {
      return false;
    }
  }

  function isExplicitDomPageScope(pageScope: string): boolean {
    const scope = normalizePageScope(pageScope);
    return Boolean(scope && !scope.includes('/') && !scope.includes('\\') && !scope.includes('?') && !scope.includes('#'));
  }

  function shouldShowLegacyUnscopedRecords(): boolean {
    const currentPageScope = resolveCurrentPageScope();
    return !hasPageRouteSignal(currentPageScope) && !isExplicitDomPageScope(currentPageScope);
  }

  function hasPersistedStyleChanges(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const styleChanges = value as { before?: unknown; after?: unknown };
    const before = styleChanges.before && typeof styleChanges.before === 'object' && !Array.isArray(styleChanges.before)
      ? styleChanges.before as Record<string, unknown>
      : {};
    const after = styleChanges.after && typeof styleChanges.after === 'object' && !Array.isArray(styleChanges.after)
      ? styleChanges.after as Record<string, unknown>
      : {};
    const props = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const prop of props) {
      if (String(before[prop] ?? '').trim() !== String(after[prop] ?? '').trim()) {
        return true;
      }
    }
    return false;
  }

  function hasPersistedEditPayload(record: {
    textChange?: unknown;
    styleChanges?: unknown;
    tweak?: unknown;
  } | null | undefined): boolean {
    const textChange = record?.textChange as { before?: unknown; after?: unknown } | null | undefined;
    if (
      textChange &&
      typeof textChange === 'object' &&
      String(textChange.before ?? '') !== String(textChange.after ?? '')
    ) {
      return true;
    }
    if (hasPersistedStyleChanges(record?.styleChanges)) {
      return true;
    }
    const tweak = record?.tweak as { summaryLines?: unknown; baselineValues?: unknown; currentValues?: unknown } | null | undefined;
    return Boolean(
      tweak &&
      typeof tweak === 'object' &&
      (
        (Array.isArray(tweak.summaryLines) && tweak.summaryLines.length > 0) ||
        tweak.baselineValues ||
        tweak.currentValues
      ),
    );
  }

  function resolveCurrentPageScope(): string {
    return (
      readResourceMetaString('commentPageScope') ||
      readResourceMetaString('pageScope') ||
      readDomPageScope() ||
      resolvePageScopeFromLocation() ||
      resolveStorageScope() ||
      resolveTargetPath() ||
      ''
    );
  }

  function isCurrentPageScopedRecord(record: ({ pageScope?: unknown } & {
    locator?: ElementLocator;
    textChange?: unknown;
    styleChanges?: unknown;
    tweak?: unknown;
  }) | null | undefined): boolean {
    const pageScope = normalizePageScope(record?.pageScope);
    if (pageScope) return pageScope === resolveCurrentPageScope();
    if (shouldShowLegacyUnscopedRecords()) return true;
    return hasPersistedEditPayload(record) && hasConnectedLocator((record as { locator?: ElementLocator })?.locator);
  }

  function hasConnectedLocator(locator: ElementLocator | null | undefined): boolean {
    if (!locator) return false;
    try {
      return Boolean(locateElement(locator)?.isConnected);
    } catch {
      return false;
    }
  }

  function withCurrentPageScope<T extends Record<string, unknown>>(value: T): T {
    const pageScope = resolveCurrentPageScope();
    return pageScope ? ({ ...value, pageScope } as T) : value;
  }

  function resolveCommentRecordKey(record: {
    elementKey?: unknown;
    locator?: ElementLocator;
  }): string {
    const elementKey = String(record.elementKey ?? '').trim();
    if (elementKey) return elementKey;
    if (!record.locator) return '';
    try {
      return locatorKey(record.locator);
    } catch {
      return '';
    }
  }

  function stableJson(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => stableJson(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(value ?? null);
  }

  function resolveCommentContentSignature(record: {
    locator?: ElementLocator;
    textChange?: unknown;
    styleChanges?: unknown;
    tweak?: unknown;
    comment?: unknown;
    note?: unknown;
    skillIds?: unknown;
  }): string {
    if (!record.locator) return '';
    let locatorSignature = '';
    try {
      locatorSignature = locatorKey(record.locator);
    } catch {
      locatorSignature = stableJson(stripLocatorDebugSource(record.locator));
    }
    return stableJson({
      locator: locatorSignature,
      textChange: record.textChange ?? null,
      styleChanges: record.styleChanges ?? null,
      tweak: record.tweak ?? null,
      comment: record.comment ?? record.note ?? null,
      skillIds: Array.isArray(record.skillIds) ? record.skillIds : null,
    });
  }

  function buildCommentTaskDocumentKey(elementKey: WebEditorElementKey, pageScope: string): string {
    return pageScope
      ? `${SCOPED_COMMENT_TASK_KEY_PREFIX}${encodeURIComponent(pageScope)}:${encodeURIComponent(elementKey)}`
      : elementKey;
  }

  function resolveCommentTaskElementKey(
    documentKey: string,
    task: PrototypeEditCommentTaskEntry,
  ): WebEditorElementKey {
    if (!normalizePageScope(task.pageScope) || !documentKey.startsWith(SCOPED_COMMENT_TASK_KEY_PREFIX)) {
      return documentKey;
    }
    const encoded = documentKey.slice(SCOPED_COMMENT_TASK_KEY_PREFIX.length);
    const separatorIndex = encoded.lastIndexOf(':');
    if (separatorIndex < 0) return documentKey;
    try {
      return decodeURIComponent(encoded.slice(separatorIndex + 1)).trim() || documentKey;
    } catch {
      return documentKey;
    }
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
        ...(normalizePageScope(task.pageScope) ? { pageScope: normalizePageScope(task.pageScope) } : {}),
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
    const tasks: Record<WebEditorElementKey, PrototypeEditCommentTaskEntry> = {};
    for (const [elementKey, task] of commentTaskStateByElementKey.entries()) {
      const scopedTask = withCurrentPageScope({ ...task });
      tasks[buildCommentTaskDocumentKey(elementKey, normalizePageScope(scopedTask.pageScope))] = scopedTask;
    }
    const allTasks = [
      ...state.genieTaskByElementKey.values(),
      ...state.externalEditingTaskByElementKey.values(),
    ];
    for (const task of allTasks) {
      if (!task?.elementKey) continue;
      const scopedTask: PrototypeEditCommentTaskEntry = withCurrentPageScope({
        state: normalizeDocumentTaskState(task.status),
        provider: task.provider,
        requestId: task.requestId,
        sessionId: task.sessionId,
        updatedAt: task.updatedAt,
        message: task.message,
      });
      tasks[buildCommentTaskDocumentKey(task.elementKey, normalizePageScope(scopedTask.pageScope))] = scopedTask;
    }
    return tasks;
  }

  function buildDocumentImages(): PrototypeEditCommentImageEntry[] {
    return Array.from(state.editMetaByKey.values()).flatMap((meta) =>
      meta.images.map((image) => withCurrentPageScope({
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
    reason: PrototypeEditCommentsWriteReason = 'changes',
  ): PrototypeEditCommentsDocument | null {
    const scope = resolvePersistenceScope();
    if (!scope) return null;
    const currentPageScope = resolveCurrentPageScope();
    const currentComments = entries.map((entry) =>
      withCurrentPageScope(cacheEntryToCommentEntry(entry)),
    );
    const currentImages = buildDocumentImages();
    const currentTasks = buildDocumentTasks();
    const currentTaskElementKeys = new Set([
      ...commentTaskStateByElementKey.keys(),
      ...Array.from(state.genieTaskByElementKey.values()).map((task) => task.elementKey),
      ...Array.from(state.externalEditingTaskByElementKey.values()).map((task) => task.elementKey),
    ].map((elementKey) => String(elementKey ?? '').trim()).filter(Boolean));
    const currentImageKeys = new Set(
      currentImages
        .map((image) => String(image.elementKey ?? '').trim())
        .filter(Boolean),
    );
    const currentCommentRecordKeys = new Set(
      currentComments
        .map((entry) => resolveCommentRecordKey(entry))
        .filter(Boolean),
    );
    const currentCommentContentSignatures = new Set(
      currentComments
        .map((entry) => resolveCommentContentSignature(entry))
        .filter(Boolean),
    );
    const shouldDropMissingCurrentScopeRecords = reason === 'clear';
    const shouldPreserveMissingCurrentScopeRecords =
      preserveMissingCurrentScopeRecordsOnNextWrite && reason !== 'clear';
    const preservedComments = (lastAdapterDocument?.comments ?? []).filter((entry) => {
      const entryScope = normalizePageScope(entry.pageScope);
      const entryKey = resolveCommentRecordKey(entry);
      const hasCurrentRecord = Boolean(entryKey && currentCommentRecordKeys.has(entryKey));
      const entryContentSignature = resolveCommentContentSignature(entry);
      const hasCurrentContent = Boolean(
        entryContentSignature && currentCommentContentSignatures.has(entryContentSignature),
      );
      if (hasCurrentContent) return false;
      if (entryScope) {
        if (entryScope !== currentPageScope) return true;
        if (shouldDropMissingCurrentScopeRecords) return false;
        if (shouldPreserveMissingCurrentScopeRecords && hasPersistedEditPayload(entry)) return true;
        if (hasCurrentRecord) return false;
        return !hasConnectedLocator(entry.locator);
      }
      if (!hasPersistedEditPayload(entry)) return true;
      if (shouldDropMissingCurrentScopeRecords) return false;
      if (shouldPreserveMissingCurrentScopeRecords) return true;
      if (hasCurrentRecord) return false;
      return !hasConnectedLocator(entry.locator);
    });
    const preservedImages = (lastAdapterDocument?.images ?? []).filter((image) => {
      const imageScope = normalizePageScope(image.pageScope);
      if (imageScope) return imageScope !== currentPageScope;
      const imageElementKey = String(image.elementKey ?? '').trim();
      return !imageElementKey || !currentImageKeys.has(imageElementKey);
    });
    const preservedTasks = Object.fromEntries(
      Object.entries(lastAdapterDocument?.tasks ?? {}).filter(([elementKey, task]) => {
        const taskScope = normalizePageScope(task.pageScope);
        if (taskScope) return taskScope !== currentPageScope;
        return !currentTaskElementKeys.has(elementKey);
      }),
    ) as Record<WebEditorElementKey, PrototypeEditCommentTaskEntry>;
    return {
      schemaVersion: 1,
      kind: 'prototype-edit-comments',
      resource: {
        id: scope.prototypeId,
        targetPath: scope.targetPath,
        filePath: `src/${scope.targetPath}/.spec/prototype-comments.json`,
      },
      comments: [...preservedComments, ...currentComments],
      tasks: {
        ...preservedTasks,
        ...currentTasks,
      },
      images: [...preservedImages, ...currentImages],
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
    for (const [documentKey, task] of Object.entries(document.tasks ?? {})) {
      const normalizedElementKey = String(resolveCommentTaskElementKey(documentKey, task) ?? '').trim();
      if (!normalizedElementKey) continue;
      if (!isCurrentPageScopedRecord(task)) continue;
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
    const document = buildAdapterDocument(entries, reason);
    if (!document) return;
    lastAdapterDocument = document;
    preserveMissingCurrentScopeRecordsOnNextWrite = false;
    void Promise.resolve(persistenceAdapter.write(scope, document, reason)).catch((error) => {
      console.warn('[Commentary] Failed to persist prototype comments:', error);
    });
  }

  function clearCurrentPageRuntimeState(): void {
    state.transactionManager?.clear?.();
    state.editMetaByKey.clear();
    state.pendingMarkerAnchors.clear();
    state.processedEditTimestampsByKey.clear();
    state.selectionAnchor = null;
    state.selectedElement = null;
    commentTaskStateByElementKey.clear();
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
      ...(resolveCurrentPageScope() ? { pageScope: resolveCurrentPageScope() } : {}),
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

  function getPersistedPrototypeCommentsDocument(): PrototypeEditCommentsDocument | null {
    return buildAdapterDocument(buildCacheEntriesFromTransactions(), 'changes') ?? lastAdapterDocument;
  }

  function flushPendingWrite(reason: PrototypeEditCommentsWriteReason = 'changes'): void {
    if (cacheWriteTimer !== null) {
      window.clearTimeout(cacheWriteTimer);
      cacheWriteTimer = null;
    }
    if (cacheRestoreInProgress) return;
    writeCache(buildCacheEntriesFromTransactions(), reason);
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
    const annotationSourceNodeIds = collectAnnotationSourceNodeIdsFromWindow();

    for (const entry of entries) {
      if (!isCurrentPageScopedRecord(entry)) {
        continue;
      }
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

      const annotationPanelIdentity = normalizeAnnotationPanelCacheIdentity(entry.locator);
      if (annotationPanelIdentity && annotationSourceNodeIds && !annotationSourceNodeIds.has(
        annotationPanelIdentity.elementKey.replace(/^annotation-panel:/, ''),
      )) {
        continue;
      }
      const entryLocator = annotationPanelIdentity?.locator ?? entry.locator;
      const element = locateElement(entryLocator);
      const canRestoreWithoutLiveElement = Boolean(annotationPanelIdentity) && Boolean(entry.marker);
      if ((!element || !element.isConnected) && !canRestoreWithoutLiveElement) continue;

      const resolvedElementKey = annotationPanelIdentity?.elementKey
        ?? (entryElementKey || (
          element
            ? generateStableElementKey(element, entryLocator.shadowHostChain)
            : locatorKey(entryLocator)
        ));
      const resolvedLabel = String(entry.label ?? '').trim() || (
        element
          ? generateFullElementLabel(element, entryLocator.shadowHostChain)
          : 'Annotation Panel'
      );
      const meta = changes.getOrCreateEditMeta(
        resolvedElementKey,
        entryLocator,
        resolvedLabel,
      );
      meta.locator = entryLocator;
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
      const documentImages = currentAdapterDocument?.images?.filter((image) =>
        image.elementKey === resolvedElementKey && isCurrentPageScopedRecord(image),
      ) ?? [];
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
            ...(typeof image.assetPath === 'string' && image.assetPath.trim()
              ? { assetPath: image.assetPath.trim() }
              : {}),
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
          if (!element) continue;
          const style = (element as HTMLElement).style;
          if (style) {
            if (afterValue.trim()) {
              style.setProperty(prop, afterValue.trim());
            } else {
              style.removeProperty(prop);
            }
          }
          tm.recordStyle(entryLocator, prop, beforeValue, afterValue, { merge: false });
        }
      }

      if (entry.textChange && element) {
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
      console.warn('[Commentary] Failed to read prototype comments:', error);
      return null;
    }
  }

  async function restoreCachedChanges(): Promise<void> {
    if (typeof window === 'undefined') return;
    const adapterDocument = await readAdapterDocument();
    if (adapterDocument) {
      lastAdapterDocument = adapterDocument;
    }
    const payload: CachedChangePayload | null = adapterDocument
      ? {
          version: CACHE_VERSION,
          path: adapterDocument.resource.targetPath || resolveStorageScope() || '',
          updatedAt: Date.now(),
          showMarkers: state.changeMarkersVisible,
          entries: adapterDocument.comments
            .filter((entry) => isCurrentPageScopedRecord(entry))
            .map(commentEntryToCacheEntry),
        }
      : readCache();
    if (!payload) {
      clearCurrentPageRuntimeState();
      return;
    }
    const scopedEntries = payload.entries.filter((entry) => isCurrentPageScopedRecord(entry));
    const annotationSourceNodeIds = collectAnnotationSourceNodeIdsFromWindow();
    const restorableEntries = annotationSourceNodeIds
      ? scopedEntries.filter((entry) => {
          const annotationPanelIdentity = normalizeAnnotationPanelCacheIdentity(entry.locator);
          if (!annotationPanelIdentity) return true;
          return annotationSourceNodeIds.has(annotationPanelIdentity.elementKey.replace(/^annotation-panel:/, ''));
        })
      : scopedEntries;
    if (restorableEntries.length !== scopedEntries.length) {
      writeLocalCache(restorableEntries, payload.updatedAt);
    }
    if (scopedEntries.length === 0) {
      clearCurrentPageRuntimeState();
      if (adapterDocument) {
        writeLocalCache([], payload.updatedAt);
      }
      return;
    }
    if (restorableEntries.length === 0) {
      clearCurrentPageRuntimeState();
      return;
    }
    cacheRestoreInProgress = true;
    currentAdapterDocument = adapterDocument;
    try {
      clearCurrentPageRuntimeState();
      if (typeof payload.showMarkers === 'boolean') {
        state.changeMarkersVisible = payload.showMarkers;
        setMarkerVisibility(payload.showMarkers);
      } else {
        state.changeMarkersVisible = readMarkerVisibility();
      }
      if (adapterDocument) {
        mergeAdapterTaskStates(adapterDocument);
      }
      applyCachedEntries(restorableEntries);
    } finally {
      cacheRestoreInProgress = false;
      currentAdapterDocument = null;
    }
    state.propertyPanel?.refresh();
    changes.syncEditMetaWithTransactions();
    if (adapterDocument) {
      preserveMissingCurrentScopeRecordsOnNextWrite = true;
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
    getPersistedPrototypeCommentsDocument,
    clearCachedChanges,
    clearStorage,
  };
}
