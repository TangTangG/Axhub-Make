import { describe, expect, it } from 'vitest';

import {
  buildAssistantResourceThreadStorageKey,
  getAssistantResourceThreadId,
  getAssistantResourceThreadIdWithFallback,
  setAssistantResourceThreadId,
} from './assistantResourceThread';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe('assistant resource thread storage', () => {
  it('stores a thread id per project and resource path in browser storage', () => {
    const storage = createStorage();
    const target = {
      projectScope: 'make-project',
      resourcePath: 'src/prototypes/home/index.tsx',
    };
    const otherResource = {
      projectScope: 'make-project',
      resourcePath: 'src/themes/brand/theme.json',
    };

    expect(buildAssistantResourceThreadStorageKey(target)).toBe(
      'axhub:assistant-resource-thread:make-project:src~2Fprototypes~2Fhome~2Findex.tsx',
    );
    expect(getAssistantResourceThreadId(target, storage)).toBe('');

    setAssistantResourceThreadId(target, 'codex-thread-1', storage);

    expect(getAssistantResourceThreadId(target, storage)).toBe('codex-thread-1');
    expect(getAssistantResourceThreadId(otherResource, storage)).toBe('');
  });

  it('ignores home pages or incomplete resource targets', () => {
    const storage = createStorage();

    setAssistantResourceThreadId({
      projectScope: 'make-project',
      resourcePath: '',
    }, 'codex-thread-1', storage);

    expect(buildAssistantResourceThreadStorageKey({
      projectScope: 'make-project',
      resourcePath: '',
    })).toBe('');
    expect(getAssistantResourceThreadId({
      projectScope: 'make-project',
      resourcePath: '',
    }, storage)).toBe('');
  });

  it('uses the current resource thread before falling back to a redirected placeholder source path', () => {
    const storage = createStorage();
    const projectScope = 'make-project';
    const latestTarget = {
      projectScope,
      resourcePath: 'src/prototypes/latest/canvas.excalidraw',
    };
    const oldTarget = {
      projectScope,
      resourcePath: 'src/prototypes/untitled-5/canvas.excalidraw',
    };

    setAssistantResourceThreadId(oldTarget, 'thread-old', storage);

    expect(getAssistantResourceThreadIdWithFallback({
      ...latestTarget,
      fallbackResourcePath: oldTarget.resourcePath,
    }, storage)).toBe('thread-old');

    setAssistantResourceThreadId(latestTarget, 'thread-latest', storage);

    expect(getAssistantResourceThreadIdWithFallback({
      ...latestTarget,
      fallbackResourcePath: oldTarget.resourcePath,
    }, storage)).toBe('thread-latest');
  });
});
