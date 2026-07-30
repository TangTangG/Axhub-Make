function isAbsoluteFilePath(value: string): boolean {
    return /^(?:[A-Za-z]:[\\/]|\/)/.test(value);
}

export function buildObsidianOpenUrl(filePath: string): string {
    const normalizedFilePath = String(filePath || '').trim();
    if (!normalizedFilePath || !isAbsoluteFilePath(normalizedFilePath)) {
        return '';
    }

    return `obsidian://open?path=${encodeURIComponent(normalizedFilePath.replace(/\\/g, '/'))}`;
}
