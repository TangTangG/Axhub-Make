import { describe, expect, it } from 'vitest';

import {
  buildAssistantResourceThreadStorageKey,
  buildAssistantStoreThreadStorageKey,
  getAssistantResourceThreadId,
  getAssistantResourceThreadIdWithFallback,
  getAssistantStoreThreadId,
  resolvePrototypeConversationStorePath,
  setAssistantResourceThreadId,
  setAssistantStoreThreadId,
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

  it('uses the current resource thread before falling back to another resource path', () => {
    const storage = createStorage();
    const projectScope = 'make-project';
    const latestTarget = {
      projectScope,
      resourcePath: 'src/resources/flows/latest.excalidraw',
    };
    const oldTarget = {
      projectScope,
      resourcePath: 'src/resources/flows/untitled-5.excalidraw',
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

  it('resolves prototype scoped ACP conversation stores under .spec/acp', () => {
    expect(resolvePrototypeConversationStorePath({
      projectPath: '/Users/me/project',
      resourcePath: 'src/resources/flows/login.excalidraw',
    })).toBe('');

    expect(resolvePrototypeConversationStorePath({
      projectPath: 'C:\\work\\project',
      resourcePath: 'src\\prototypes\\checkout\\index.tsx',
    })).toBe('C:/work/project/src/prototypes/checkout/.spec/acp/conversations.json');

    expect(resolvePrototypeConversationStorePath({
      projectPath: '/Users/me/project',
      resourcePath: 'src/themes/brand/theme.json',
    })).toBe('');
  });

  it('stores the last active thread per project and conversation store path', () => {
    const storage = createStorage();
    const first = {
      projectScope: 'make-project',
      conversationStorePath: '/project/src/prototypes/a/.spec/acp/conversations.json',
    };
    const second = {
      projectScope: 'make-project',
      conversationStorePath: '/project/src/prototypes/b/.spec/acp/conversations.json',
    };

    expect(buildAssistantStoreThreadStorageKey(first)).toBe(
      'axhub:assistant-store-thread:make-project:~2Fproject~2Fsrc~2Fprototypes~2Fa~2F.spec~2Facp~2Fconversations.json',
    );

    setAssistantStoreThreadId(first, 'thread-a', storage);
    setAssistantStoreThreadId(second, 'thread-b', storage);

    expect(getAssistantStoreThreadId(first, storage)).toBe('thread-a');
    expect(getAssistantStoreThreadId(second, storage)).toBe('thread-b');
  });
});
