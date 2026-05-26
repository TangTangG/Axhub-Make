export function getExplicitLocalPath(item: unknown): string {
    if (!item || typeof item !== 'object') {
        return '';
    }
    const raw = item as {
        filePath?: unknown;
        absoluteFilePath?: unknown;
        path?: unknown;
    };
    const candidates = [raw.filePath, raw.absoluteFilePath, raw.path];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
        }
    }
    return '';
}

export function hasExplicitLocalPath(item: unknown): boolean {
    return Boolean(getExplicitLocalPath(item));
}

export function stripIndexFilePath(value: string): string {
    return value.trim().replace(/\/index\.(t|j)sx?$/i, '');
}
