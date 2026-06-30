import { describe, expect, it, vi } from 'vitest';

import { executePromptCardCurrentElementAction } from '../../../vendor/axhub-commentary/src/ui/runtime/prompt-card-actions';

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('prompt card current element action', () => {
  it('dismisses the editable bubble immediately after dispatching a long-running AI send', async () => {
    const target = {} as Element;
    const sendDeferred = createDeferred<void>();
    const onConfirmText = vi.fn().mockResolvedValue(undefined);
    const onConfirmNote = vi.fn().mockResolvedValue(undefined);
    const onDismissSelection = vi.fn();
    const onSendCurrentElementPromptToAgent = vi.fn(() => sendDeferred.promise);

    const resultPromise = executePromptCardCurrentElementAction({
      currentTarget: target,
      onConfirmText,
      onConfirmNote,
      onDismissSelection,
      onSendCurrentElementPromptToAgent,
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(onConfirmText).toHaveBeenCalledTimes(1);
    expect(onConfirmNote).toHaveBeenCalledTimes(1);
    expect(onSendCurrentElementPromptToAgent).toHaveBeenCalledWith(target);
    expect(onDismissSelection).toHaveBeenCalledTimes(1);

    sendDeferred.resolve();
    await expect(resultPromise).resolves.toBe(true);
  });
});
