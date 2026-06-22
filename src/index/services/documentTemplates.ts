export interface DocumentTemplateOption {
    name: string;
    displayName: string;
    description: string;
}

function getCurrentProjectIdFromUrl(): string {
    if (typeof window === 'undefined') {
        return '';
    }
    return new URLSearchParams(window.location.search).get('projectId')?.trim() || '';
}

function withCurrentProject(url: string): string {
    const projectId = getCurrentProjectIdFromUrl();
    if (!projectId) return url;
    const [path, query = ''] = url.split('?');
    const params = new URLSearchParams(query);
    params.set('projectId', projectId);
    const nextQuery = params.toString();
    return nextQuery ? `${path}?${nextQuery}` : path;
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as any)?.error || fallbackMessage);
    }
    return response.json() as Promise<T>;
}

async function parseTextResponse(response: Response, fallbackMessage: string): Promise<string> {
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as any)?.error || fallbackMessage);
    }
    return response.text();
}

function isVisibleMarkdownTemplateName(name: string): boolean {
    const normalized = name.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!normalized || normalized.toLowerCase() === 'readme.md') return false;
    if (!normalized.toLowerCase().endsWith('.md')) return false;
    return normalized.split('/').every((segment) => segment && !segment.startsWith('.'));
}

export function normalizeDocumentTemplateList(value: unknown): DocumentTemplateOption[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        const name = typeof record.name === 'string' ? record.name.trim().replace(/\\/g, '/') : '';
        if (!isVisibleMarkdownTemplateName(name)) return [];
        const fallbackDisplayName = name.replace(/\.[^.]+$/u, '');
        return [{
            name,
            displayName: typeof record.displayName === 'string' && record.displayName.trim()
                ? record.displayName.trim()
                : fallbackDisplayName,
            description: typeof record.description === 'string' ? record.description.trim() : '',
        }];
    });
}

export const documentTemplatesApi = {
    async list(): Promise<DocumentTemplateOption[]> {
        const response = await fetch(withCurrentProject('/api/docs/templates'));
        const data = await parseJsonResponse<unknown>(response, '读取文档模板失败');
        return normalizeDocumentTemplateList(data);
    },

    async read(templateName: string): Promise<string> {
        const normalizedName = String(templateName || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        if (!isVisibleMarkdownTemplateName(normalizedName)) {
            throw new Error('模板名称无效');
        }
        const response = await fetch(withCurrentProject(`/api/docs/templates/${encodeURIComponent(normalizedName)}`));
        return parseTextResponse(response, '读取文档模板内容失败');
    },
};
