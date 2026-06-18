interface AssistantResourceThreadTarget {
  projectScope?: string | null;
  resourcePath?: string | null;
}

interface AssistantStoreThreadTarget {
  projectScope?: string | null;
  conversationStorePath?: string | null;
}

interface AssistantResourceThreadFallbackTarget extends AssistantResourceThreadTarget {
  fallbackResourcePath?: string | null;
}

interface AssistantResourceThreadStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const STORAGE_KEY_ASSISTANT_RESOURCE_THREAD = 'axhub:assistant-resource-thread';
const STORAGE_KEY_ASSISTANT_STORE_THREAD = 'axhub:assistant-store-thread';

function getLocalStorage(): AssistantResourceThreadStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function encodeStorageKeyPart(value: string): string {
  return encodeURIComponent(value).replace(/%/g, '~');
}

export function buildAssistantResourceThreadStorageKey({
  projectScope,
  resourcePath,
}: AssistantResourceThreadTarget): string {
  const normalizedProjectScope = String(projectScope || '').trim();
  const normalizedResourcePath = String(resourcePath || '').trim();
  if (!normalizedResourcePath) {
    return '';
  }

  const projectPart = normalizedProjectScope || 'active-project';
  return [
    STORAGE_KEY_ASSISTANT_RESOURCE_THREAD,
    encodeStorageKeyPart(projectPart),
    encodeStorageKeyPart(normalizedResourcePath),
  ].join(':');
}

export function buildAssistantStoreThreadStorageKey({
  projectScope,
  conversationStorePath,
}: AssistantStoreThreadTarget): string {
  const normalizedProjectScope = String(projectScope || '').trim();
  const normalizedConversationStorePath = normalizeComparablePath(conversationStorePath);
  if (!normalizedConversationStorePath) {
    return '';
  }

  const projectPart = normalizedProjectScope || 'active-project';
  return [
    STORAGE_KEY_ASSISTANT_STORE_THREAD,
    encodeStorageKeyPart(projectPart),
    encodeStorageKeyPart(normalizedConversationStorePath),
  ].join(':');
}

export function getAssistantStoreThreadId(
  target: AssistantStoreThreadTarget,
  storage: AssistantResourceThreadStorage | null = getLocalStorage(),
): string {
  const key = buildAssistantStoreThreadStorageKey(target);
  if (!key || !storage) {
    return '';
  }

  try {
    return String(storage.getItem(key) || '').trim();
  } catch {
    return '';
  }
}

export function getAssistantResourceThreadId(
  target: AssistantResourceThreadTarget,
  storage: AssistantResourceThreadStorage | null = getLocalStorage(),
): string {
  const key = buildAssistantResourceThreadStorageKey(target);
  if (!key || !storage) {
    return '';
  }

  try {
    return String(storage.getItem(key) || '').trim();
  } catch {
    return '';
  }
}

export function getAssistantResourceThreadIdWithFallback(
  target: AssistantResourceThreadFallbackTarget,
  storage: AssistantResourceThreadStorage | null = getLocalStorage(),
): string {
  const primaryThreadId = getAssistantResourceThreadId(target, storage);
  if (primaryThreadId) {
    return primaryThreadId;
  }

  const fallbackResourcePath = String(target.fallbackResourcePath || '').trim();
  const resourcePath = String(target.resourcePath || '').trim();
  if (!fallbackResourcePath || fallbackResourcePath === resourcePath) {
    return '';
  }

  return getAssistantResourceThreadId({
    projectScope: target.projectScope,
    resourcePath: fallbackResourcePath,
  }, storage);
}

export function setAssistantResourceThreadId(
  target: AssistantResourceThreadTarget,
  threadId: string | null | undefined,
  storage: AssistantResourceThreadStorage | null = getLocalStorage(),
): void {
  const key = buildAssistantResourceThreadStorageKey(target);
  if (!key || !storage) {
    return;
  }

  const normalizedThreadId = String(threadId || '').trim();
  try {
    if (normalizedThreadId) {
      storage.setItem(key, normalizedThreadId);
    } else {
      storage.removeItem(key);
    }
  } catch {
    // Ignore browser storage failures in private or embedded contexts.
  }
}

export function setAssistantStoreThreadId(
  target: AssistantStoreThreadTarget,
  threadId: string | null | undefined,
  storage: AssistantResourceThreadStorage | null = getLocalStorage(),
): void {
  const key = buildAssistantStoreThreadStorageKey(target);
  if (!key || !storage) {
    return;
  }

  const normalizedThreadId = String(threadId || '').trim();
  try {
    if (normalizedThreadId) {
      storage.setItem(key, normalizedThreadId);
    } else {
      storage.removeItem(key);
    }
  } catch {
    // Ignore browser storage failures in private or embedded contexts.
  }
}

function normalizeComparablePath(value?: string | null): string {
  const normalized = String(value || '').trim().replace(/\\/g, '/');
  if (!normalized) {
    return '';
  }
  if (normalized === '/') {
    return '/';
  }
  return normalized.replace(/\/+$/g, '');
}

function joinNormalizedPath(basePath: string, relativePath: string): string {
  const normalizedBase = normalizeComparablePath(basePath);
  const normalizedRelative = normalizeComparablePath(relativePath).replace(/^\/+/g, '');
  if (!normalizedBase) {
    return normalizedRelative;
  }
  return `${normalizedBase}/${normalizedRelative}`;
}

export function resolvePrototypeConversationStorePath({
  projectPath,
  resourcePath,
}: {
  projectPath?: string | null;
  resourcePath?: string | null;
}): string {
  const normalizedProjectPath = normalizeComparablePath(projectPath);
  const normalizedResourcePath = normalizeComparablePath(resourcePath).replace(/^\/+/g, '');
  if (!normalizedProjectPath || !normalizedResourcePath) {
    return '';
  }

  const match = normalizedResourcePath.match(/^src\/prototypes\/([^/]+)(?:\/|$)/);
  const prototypeId = match?.[1]?.trim();
  if (!prototypeId) {
    return '';
  }

  return joinNormalizedPath(
    normalizedProjectPath,
    `src/prototypes/${prototypeId}/.spec/acp/conversations.json`,
  );
}
