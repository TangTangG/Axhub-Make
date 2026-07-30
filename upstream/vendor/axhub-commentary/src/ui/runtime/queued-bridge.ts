import type { RuntimeFlushBridge } from './types';

export function createQueuedBridge<T extends object>(
  getApi: () => T | null,
): RuntimeFlushBridge<T> {
  const queue: Array<(api: T) => void> = [];

  return {
    runOrQueue(action: (api: T) => void) {
      const api = getApi();
      if (api) {
        action(api);
        return;
      }
      queue.push(action);
    },
    flush() {
      const api = getApi();
      if (!api) return;
      while (queue.length > 0) {
        const action = queue.shift();
        action?.(api);
      }
    },
  };
}
