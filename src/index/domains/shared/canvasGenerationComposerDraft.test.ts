import { describe, expect, it, vi } from 'vitest';

import {
  clearCanvasGenerationComposerDraft,
  createCanvasGenerationComposerDraftStorageKey,
  readCanvasGenerationComposerDraft,
  resolveCanvasGenerationComposerDraftRestoreText,
  writeCanvasGenerationComposerDraft,
  type CanvasGenerationComposerDraftStorage,
} from './canvasGenerationComposerDraft';

function createMemoryStorage(): CanvasGenerationComposerDraftStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
}

describe('canvasGenerationComposerDraft', () => {
  it('creates an isolated storage key from project, canvas, and generator scope parts', () => {
    const key = createCanvasGenerationComposerDraftStorageKey([
      '/workspace/demo/project',
      'src/prototypes/current/canvas.excalidraw',
      'generator-1',
    ]);

    expect(key).toContain('axhub:canvas-generation-composer-draft:v1:');
    expect(key).toContain('%2Fworkspace%2Fdemo%2Fproject');
    expect(key).toContain('src%2Fprototypes%2Fcurrent%2Fcanvas.excalidraw');
    expect(key).toContain('generator-1');
  });

  it('stores, restores, and clears non-sent composer text', () => {
    const storage = createMemoryStorage();
    const key = createCanvasGenerationComposerDraftStorageKey(['project', 'canvas', 'generator']);

    writeCanvasGenerationComposerDraft(storage, key, '生成一个登录页');
    expect(readCanvasGenerationComposerDraft(storage, key)).toBe('生成一个登录页');

    writeCanvasGenerationComposerDraft(storage, key, '');
    expect(readCanvasGenerationComposerDraft(storage, key)).toBe('');

    writeCanvasGenerationComposerDraft(storage, key, '第二版提示词');
    clearCanvasGenerationComposerDraft(storage, key);
    expect(readCanvasGenerationComposerDraft(storage, key)).toBe('');
  });

  it('ignores unavailable or throwing browser storage', () => {
    const storage: CanvasGenerationComposerDraftStorage = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      removeItem: vi.fn(() => {
        throw new Error('blocked');
      }),
    };
    const key = createCanvasGenerationComposerDraftStorageKey(['project']);

    expect(readCanvasGenerationComposerDraft(storage, key)).toBe('');
    expect(() => writeCanvasGenerationComposerDraft(storage, key, 'draft')).not.toThrow();
    expect(() => clearCanvasGenerationComposerDraft(storage, key)).not.toThrow();
    expect(() => writeCanvasGenerationComposerDraft(null, key, 'draft')).not.toThrow();
  });

  it('restores draft text without carrying text across placeholder scope changes', () => {
    expect(resolveCanvasGenerationComposerDraftRestoreText({
      currentText: '',
      draftStorageKeyChanged: false,
      savedDraft: '刷新后恢复',
    })).toBe('刷新后恢复');

    expect(resolveCanvasGenerationComposerDraftRestoreText({
      currentText: '正在编辑的当前输入',
      draftStorageKeyChanged: false,
      savedDraft: '缓存中的旧输入',
    })).toBeNull();

    expect(resolveCanvasGenerationComposerDraftRestoreText({
      currentText: '占位 A 的输入',
      draftStorageKeyChanged: true,
      savedDraft: '占位 B 的缓存',
    })).toBe('占位 B 的缓存');

    expect(resolveCanvasGenerationComposerDraftRestoreText({
      currentText: '占位 A 的输入',
      draftStorageKeyChanged: true,
      savedDraft: '',
    })).toBe('');
  });
});
