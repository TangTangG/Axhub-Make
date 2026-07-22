import type { ProjectScope } from './projectScope';
import { withProjectScope } from './projectScope';

export interface DocumentTemplateOption {
    name: string;
    displayName: string;
    description: string;
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

export type DocumentTemplateOutputFormat = '' | 'md' | 'html' | 'mermaid' | 'drawio';

function isVisibleDocumentTemplateName(name: string): boolean {
    const normalized = name.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const lowerName = normalized.toLowerCase();
    if (!normalized || lowerName === 'readme.md' || lowerName === 'readme.html') return false;
    if (!lowerName.endsWith('.md') && !lowerName.endsWith('.html')) return false;
    return normalized.split('/').every((segment) => segment && !segment.startsWith('.'));
}

export function isDocumentTemplateCompatibleWithFormat(
    templateName: string,
    format: DocumentTemplateOutputFormat,
): boolean {
    const lowerName = templateName.trim().toLowerCase();
    const isMarkdown = lowerName.endsWith('.md');
    const isHtml = lowerName.endsWith('.html');
    if (!format || format === 'html') return isMarkdown || isHtml;
    if (format === 'md') return isMarkdown;
    return false;
}

export function filterCompatibleDocumentTemplates<T extends { name: string }>(
    templates: T[],
    format: DocumentTemplateOutputFormat,
): T[] {
    return templates.filter((template) => isDocumentTemplateCompatibleWithFormat(template.name, format));
}

export function normalizeDocumentTemplateList(value: unknown): DocumentTemplateOption[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const record = item as Record<string, unknown>;
        const name = typeof record.name === 'string' ? record.name.trim().replace(/\\/g, '/') : '';
        if (!isVisibleDocumentTemplateName(name)) return [];
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
    async list(scope: ProjectScope): Promise<DocumentTemplateOption[]> {
        const response = await fetch(withProjectScope('/api/docs/templates', scope));
        const data = await parseJsonResponse<unknown>(response, '读取文档模板失败');
        return normalizeDocumentTemplateList(data);
    },

    async read(templateName: string, scope: ProjectScope): Promise<string> {
        const normalizedName = String(templateName || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        if (!isVisibleDocumentTemplateName(normalizedName)) {
            throw new Error('模板名称无效');
        }
        const response = await fetch(withProjectScope(`/api/docs/templates/${encodeURIComponent(normalizedName)}`, scope));
        return parseTextResponse(response, '读取文档模板内容失败');
    },
};
