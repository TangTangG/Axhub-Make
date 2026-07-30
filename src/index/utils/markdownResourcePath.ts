export type MarkdownResourceKind = 'doc' | 'template';

const DOCS_ROOT = 'src/resources';
const TEMPLATES_ROOT = 'src/resources/templates';

function normalizePath(value: string): string {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+/g, '/');
}

function stripKnownDocsPrefixes(value: string): string {
    let normalized = normalizePath(value);

    if (!normalized) {
        return '';
    }

    if (normalized === 'api/docs') {
        return '';
    }

    if (normalized.startsWith('api/docs/templates/')) {
        return normalized.slice('api/docs/templates/'.length);
    }

    if (normalized.startsWith('api/docs/')) {
        return normalized.slice('api/docs/'.length);
    }

    if (normalized === 'docs') {
        return '';
    }

    if (normalized.startsWith('docs/templates/')) {
        return normalized.slice('docs/templates/'.length);
    }

    if (normalized.startsWith('docs/')) {
        return normalized.slice('docs/'.length);
    }

    if (normalized === TEMPLATES_ROOT) {
        return '';
    }

    if (normalized.startsWith(`${TEMPLATES_ROOT}/`)) {
        return normalized.slice(`${TEMPLATES_ROOT}/`.length);
    }

    if (normalized === DOCS_ROOT) {
        return '';
    }

    if (normalized.startsWith(`${DOCS_ROOT}/`)) {
        return normalized.slice(`${DOCS_ROOT}/`.length);
    }

    return normalized;
}

export function normalizeMarkdownResourceName(kind: MarkdownResourceKind, value: string): string {
    const normalized = stripKnownDocsPrefixes(value);
    if (!normalized) {
        return '';
    }

    if (kind === 'template' && normalized.startsWith('templates/')) {
        return normalized.slice('templates/'.length);
    }

    return normalized;
}

export function getMarkdownResourceFilePath(kind: MarkdownResourceKind, value: string): string {
    const normalizedInput = normalizePath(value);
    if (!normalizedInput) {
        return kind === 'template' ? TEMPLATES_ROOT : DOCS_ROOT;
    }

    if (
        normalizedInput === DOCS_ROOT
        || normalizedInput === TEMPLATES_ROOT
        || normalizedInput.startsWith(`${DOCS_ROOT}/`)
    ) {
        return normalizedInput;
    }

    if (normalizedInput === 'api/docs' || normalizedInput.startsWith('api/docs/')) {
        return getMarkdownResourceFilePath(kind, stripKnownDocsPrefixes(normalizedInput));
    }

    const normalizedName = normalizeMarkdownResourceName(kind, normalizedInput);
    const basePath = kind === 'template' ? TEMPLATES_ROOT : DOCS_ROOT;
    return normalizedName ? `${basePath}/${normalizedName}` : basePath;
}
