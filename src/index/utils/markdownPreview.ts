export function buildMarkdownFileUrl(markdownPath: string): string {
    const normalizedPath = String(markdownPath || '').trim();
    if (!normalizedPath) {
        return '';
    }
    return `/api/markdown-file?path=${encodeURIComponent(normalizedPath)}`;
}

export function buildMarkdownFileMetaUrl(markdownPath: string): string {
    const normalizedPath = String(markdownPath || '').trim();
    if (!normalizedPath) {
        return '';
    }
    return `/api/markdown-file-meta?path=${encodeURIComponent(normalizedPath)}`;
}

export function buildSpecTemplatePreviewUrl(markdownUrl: string): string {
    const normalizedUrl = String(markdownUrl || '').trim();
    if (!normalizedUrl) {
        return '';
    }
    return `/spec-template.html?url=${encodeURIComponent(normalizedUrl)}`;
}
