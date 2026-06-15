const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 250;

interface LazyWithRetryOptions {
  retries?: number;
  retryDelayMs?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

export function isDynamicImportFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/iu.test(message);
}

export async function lazyWithRetry<T>(
  loader: () => Promise<T>,
  options: LazyWithRetryOptions = {},
): Promise<T> {
  const retries = Math.max(0, options.retries ?? DEFAULT_RETRIES);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      if (attempt >= retries || !isDynamicImportFetchError(error)) {
        throw error;
      }
      await delay(retryDelayMs * (attempt + 1));
    }
  }

  return loader();
}
