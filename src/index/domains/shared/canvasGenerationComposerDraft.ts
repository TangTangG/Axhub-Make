export interface CanvasGenerationComposerDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const CANVAS_GENERATION_COMPOSER_DRAFT_STORAGE_PREFIX = 'axhub:canvas-generation-composer-draft:v1';

function normalizeDraftStoragePart(part: string | null | undefined): string {
  return String(part || '').trim().replace(/\\/g, '/');
}

export function createCanvasGenerationComposerDraftStorageKey(
  parts: Array<string | null | undefined>,
): string {
  const normalizedParts = parts
    .map(normalizeDraftStoragePart)
    .filter(Boolean)
    .map((part) => encodeURIComponent(part));
  return [CANVAS_GENERATION_COMPOSER_DRAFT_STORAGE_PREFIX, ...normalizedParts].join(':');
}

export function resolveCanvasGenerationComposerDraftRestoreText({
  currentText,
  draftStorageKeyChanged,
  savedDraft,
}: {
  currentText: string;
  draftStorageKeyChanged: boolean;
  savedDraft: string;
}): string | null {
  if (draftStorageKeyChanged) {
    return savedDraft;
  }
  if (currentText || !savedDraft) {
    return null;
  }
  return savedDraft;
}

export function getCanvasGenerationComposerDraftStorage(): CanvasGenerationComposerDraftStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readCanvasGenerationComposerDraft(
  storage: CanvasGenerationComposerDraftStorage | null | undefined,
  key: string | null | undefined,
): string {
  if (!storage || !key) return '';
  try {
    return storage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function writeCanvasGenerationComposerDraft(
  storage: CanvasGenerationComposerDraftStorage | null | undefined,
  key: string | null | undefined,
  text: string,
): void {
  if (!storage || !key) return;
  try {
    if (text) {
      storage.setItem(key, text);
    } else {
      storage.removeItem(key);
    }
  } catch {
    // localStorage may be unavailable in private or embedded browsing contexts.
  }
}

export function clearCanvasGenerationComposerDraft(
  storage: CanvasGenerationComposerDraftStorage | null | undefined,
  key: string | null | undefined,
): void {
  if (!storage || !key) return;
  try {
    storage.removeItem(key);
  } catch {
    // localStorage may be unavailable in private or embedded browsing contexts.
  }
}
