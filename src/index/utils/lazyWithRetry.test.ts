import { describe, expect, it, vi } from 'vitest';

import { isDynamicImportFetchError, lazyWithRetry } from './lazyWithRetry';

describe('lazyWithRetry', () => {
  it('retries transient dynamic import fetch failures before resolving', async () => {
    const loader = vi
      .fn<() => Promise<{ default: string }>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module: /src/chunk.js'))
      .mockResolvedValueOnce({ default: 'loaded' });

    await expect(lazyWithRetry(loader, { retries: 1, retryDelayMs: 0 })).resolves.toEqual({ default: 'loaded' });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-fetch module evaluation errors', async () => {
    const error = new Error('module evaluation failed');
    const loader = vi.fn<() => Promise<{ default: string }>>().mockRejectedValue(error);

    await expect(lazyWithRetry(loader, { retries: 2, retryDelayMs: 0 })).rejects.toBe(error);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('recognizes browser messages for failed dynamic import fetches', () => {
    expect(isDynamicImportFetchError(new TypeError('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isDynamicImportFetchError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isDynamicImportFetchError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isDynamicImportFetchError(new Error('Cannot access default export before initialization'))).toBe(false);
  });
});
