interface AssistantResourceThreadTarget {
  projectScope?: string | null;
  resourcePath?: string | null;
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
