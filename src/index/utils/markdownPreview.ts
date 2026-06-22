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

function hasMarkdownExtension(value: unknown): boolean {
    return /\.mdx?(?:[?#/]|$)/iu.test(String(value || '').trim());
}

function hasHtmlExtension(value: unknown): boolean {
    return /\.html?(?:[?#/]|$)/iu.test(String(value || '').trim());
}

function hasFileExtension(value: unknown): boolean {
    return /(?:^|\/)[^/?#]+\.[a-z0-9]{1,12}(?:[?#/]|$)/iu.test(String(value || '').trim());
}

function normalizeResourceName(value: unknown): string {
    return String(value || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function addProjectIdQuery(url: string, projectId?: string): string {
    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId || !url) return url;
    const [path, query = ''] = url.split('?');
    const params = new URLSearchParams(query);
    params.set('projectId', normalizedProjectId);
    const nextQuery = params.toString();
    return nextQuery ? `${path}?${nextQuery}` : path;
}

function isSpecTemplatePreviewUrl(url: string): boolean {
    const normalizedUrl = String(url || '').trim();
    if (!normalizedUrl) return false;
    try {
        const parsed = new URL(normalizedUrl, 'http://axhub.local');
        return parsed.pathname.endsWith('/spec-template.html') || parsed.pathname === '/spec-template.html';
    } catch {
        return /(?:^|\/)spec-template\.html(?:[?#]|$)/iu.test(normalizedUrl);
    }
}

function getApiMarkdownResourceName(url: string, prefix: string): string {
    try {
        const parsed = new URL(url, 'http://axhub.local');
        const pathname = decodeURIComponent(parsed.pathname);
        return pathname.startsWith(prefix)
            ? normalizeResourceName(pathname.slice(prefix.length))
            : '';
    } catch {
        return '';
    }
}

function isMarkdownRawUrl(
    url: string,
    kind: 'doc' | 'template',
): boolean {
    const normalizedUrl = String(url || '').trim();
    if (!normalizedUrl || isSpecTemplatePreviewUrl(normalizedUrl)) return false;
    if (hasMarkdownExtension(normalizedUrl)) return true;

    try {
        const parsed = new URL(normalizedUrl, 'http://axhub.local');
        const markdownPath = parsed.searchParams.get('path') || parsed.searchParams.get('url') || '';
        if (hasMarkdownExtension(markdownPath)) return true;
        const pathname = decodeURIComponent(parsed.pathname);
        if (/^\/api\/projects\/[^/]+\/docs\/.+\/content$/iu.test(pathname)) return true;
        if (kind === 'template' && pathname.startsWith('/api/docs/templates/')) {
            const templateName = normalizeResourceName(pathname.slice('/api/docs/templates/'.length));
            return hasMarkdownExtension(templateName) || !hasFileExtension(templateName);
        }
        if (kind === 'doc' && pathname.startsWith('/api/docs/')) {
            const docName = normalizeResourceName(pathname.slice('/api/docs/'.length));
            return hasMarkdownExtension(docName) || !hasFileExtension(docName);
        }
    } catch {
        return false;
    }

    return false;
}

function isHtmlRawUrl(url: string): boolean {
    const normalizedUrl = String(url || '').trim();
    if (!normalizedUrl) return false;
    if (hasHtmlExtension(normalizedUrl)) return true;

    try {
        const parsed = new URL(normalizedUrl, 'http://axhub.local');
        const htmlPath = parsed.searchParams.get('path') || parsed.searchParams.get('url') || '';
        if (hasHtmlExtension(htmlPath)) return true;
        return hasHtmlExtension(decodeURIComponent(parsed.pathname));
    } catch {
        return false;
    }
}

function buildApiMarkdownUrl(
    item: {
        name?: string;
        resourceId?: string;
        projectId?: string;
    },
    kind: 'doc' | 'template',
): string {
    const rawName = normalizeResourceName(item.name);
    const rawResourceId = normalizeResourceName(item.resourceId);
    const projectId = String(item.projectId || '').trim();
    if (kind === 'doc' && projectId && (rawResourceId || rawName)) {
        return `/api/projects/${encodeURIComponent(projectId)}/docs/${encodeURIComponent(rawResourceId || rawName)}/content`;
    }
    if (!rawName) return '';
    const name = kind === 'template' && !hasFileExtension(rawName)
        ? `${rawName}.md`
        : rawName;
    if (kind === 'template') {
        return addProjectIdQuery(`/api/docs/templates/${encodeURIComponent(name)}`, projectId);
    }
    return addProjectIdQuery(`/api/docs/${encodeURIComponent(name)}`, projectId);
}

function buildApiHtmlUrl(
    item: {
        name?: string;
        projectId?: string;
    },
    kind: 'doc' | 'template',
): string {
    const rawName = normalizeResourceName(item.name);
    const projectId = String(item.projectId || '').trim();
    if (!rawName) return '';
    if (kind === 'template') {
        return addProjectIdQuery(`/api/docs/templates/${encodeURIComponent(rawName)}`, projectId);
    }
    return addProjectIdQuery(`/api/docs/${encodeURIComponent(rawName)}`, projectId);
}

export function resolveMarkdownPreviewIframeUrl(
    item: {
        name?: string;
        resourceId?: string;
        projectId?: string;
        specUrl?: string;
        previewUrl?: string;
        filePath?: string;
        absoluteFilePath?: string;
    } | null | undefined,
    kind: 'doc' | 'template',
): string {
    if (!item) return '';

    const previewUrl = String(item.previewUrl || '').trim();
    const specUrl = String(item.specUrl || '').trim();
    if (isSpecTemplatePreviewUrl(previewUrl)) return previewUrl;
    if (isSpecTemplatePreviewUrl(specUrl)) return specUrl;

    for (const url of [previewUrl, specUrl]) {
        if (isHtmlRawUrl(url)) {
            return url;
        }
    }

    const directFilePath = String(item.absoluteFilePath || item.filePath || '').trim();
    if (hasHtmlExtension(directFilePath)) {
        return buildMarkdownFileUrl(directFilePath);
    }

    const name = normalizeResourceName(item.name);
    if (hasHtmlExtension(name)) {
        return buildApiHtmlUrl(item, kind);
    }

    for (const url of [previewUrl, specUrl]) {
        if (isMarkdownRawUrl(url, kind)) {
            return buildSpecTemplatePreviewUrl(url);
        }
    }

    if (hasMarkdownExtension(directFilePath)) {
        return buildSpecTemplatePreviewUrl(buildMarkdownFileUrl(directFilePath));
    }

    if (hasMarkdownExtension(name) || (kind === 'template' && name && !hasFileExtension(name))) {
        const markdownUrl = buildApiMarkdownUrl(item, kind);
        return markdownUrl ? buildSpecTemplatePreviewUrl(markdownUrl) : '';
    }

    return previewUrl || specUrl;
}
