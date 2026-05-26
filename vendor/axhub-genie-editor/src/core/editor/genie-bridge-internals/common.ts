export function createRequestId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${randomPart}`;
}

export function getTimeoutMs(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.max(100, Math.round(value));
}

export function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeBaseUrl(value: unknown): string {
  const normalized = normalizeString(value);
  if (!normalized) return '';
  try {
    const url = new URL(normalized);
    const normalizedPath = url.pathname.replace(/\/+$/u, '');
    url.pathname = !normalizedPath || normalizedPath === '/' ? '/api' : normalizedPath;
    return url.toString().replace(/\/+$/u, '');
  } catch {
    return '';
  }
}

export function collectUniqueStrings(...values: unknown[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeString(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function readWindowSearchParam(...names: string[]): string {
  if (typeof window === 'undefined') return '';
  try {
    const url = new URL(window.location.href);
    for (const name of names) {
      const normalized = normalizeString(url.searchParams.get(name));
      if (normalized) {
        return normalized;
      }
    }
  } catch {
    // Ignore malformed locations and keep fallback behavior.
  }
  return '';
}

export function isMessageRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

export function parseTimestamp(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}
