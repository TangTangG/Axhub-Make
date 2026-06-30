import type { ItemData, ViewMode } from '../../types';
import type { ResourceSection, SidebarTab, ThemeResourceItem } from '../../types/index-page.types';

export type ResourceDeepLinkType = 'prototype' | 'doc' | 'project-doc' | 'template' | 'theme';

export interface ResourceDeepLinkTarget {
    resourceType: ResourceDeepLinkType;
    resourceId: string;
    view?: ViewMode;
    pageId?: string;
    projectId?: string;
    collapseSidebar?: boolean;
}

export type ResolvedResourceDeepLinkSelection =
    | {
        kind: 'prototype';
        item: ItemData;
        sidebarTab: Extract<SidebarTab, 'prototype'>;
        viewMode: ViewMode;
        collapseSidebar: boolean;
    }
    | {
        kind: 'doc';
        item: ItemData;
        sidebarTab: Extract<SidebarTab, 'document'>;
        collapseSidebar: boolean;
    }
    | {
        kind: 'template';
        item: ItemData;
        sidebarTab: Extract<SidebarTab, 'assets'>;
        resourceSection: Extract<ResourceSection, 'templates'>;
        collapseSidebar: boolean;
    }
    | {
        kind: 'theme';
        theme: ThemeResourceItem;
        sidebarTab: Extract<SidebarTab, 'assets'>;
        resourceSection: Extract<ResourceSection, 'themes'>;
        collapseSidebar: boolean;
    };

function getBaseUrl(baseUrl?: string): string {
    if (baseUrl) {
        return baseUrl;
    }
    if (typeof window !== 'undefined') {
        return window.location.href;
    }
    return 'http://localhost/';
}

function normalizeTemplateDeepLinkResourceId(value: string): string {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/^templates\/+/u, '');
}

function normalizeDeepLinkResourceId(value: unknown): string {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '');
}

function withoutMarkdownExtension(value: string): string {
    return value.replace(/\.mdx?$/iu, '');
}

function getBaseName(value: string): string {
    return normalizeDeepLinkResourceId(value).split('/').filter(Boolean).pop() || value;
}

function isMarkdownDocumentPath(value: string): boolean {
    return /\.mdx?$/iu.test(normalizeDeepLinkResourceId(value));
}

function buildProjectDocumentContentEndpoint(projectId: string | undefined, documentPath: string): string {
    const normalizedProjectId = String(projectId || '').trim();
    const normalizedPath = normalizeDeepLinkResourceId(documentPath);
    if (!normalizedProjectId || !normalizedPath) {
        return '';
    }
    return `/api/projects/${encodeURIComponent(normalizedProjectId)}/document-content?path=${encodeURIComponent(normalizedPath)}`;
}

function buildProjectDocumentDeepLinkItem(target: ResourceDeepLinkTarget): ItemData | null {
    const documentPath = normalizeDeepLinkResourceId(target.resourceId);
    if (!target.projectId || !documentPath || !isMarkdownDocumentPath(documentPath)) {
        return null;
    }
    const markdownUrl = buildProjectDocumentContentEndpoint(target.projectId, documentPath);
    if (!markdownUrl) {
        return null;
    }
    return {
        name: documentPath,
        displayName: getBaseName(documentPath),
        jsUrl: '',
        specUrl: markdownUrl,
        previewUrl: `/spec-template.html?url=${encodeURIComponent(markdownUrl)}`,
        filePath: documentPath,
        projectId: target.projectId,
        resourceId: documentPath,
        projectDocumentPath: documentPath,
    };
}

function buildDocDeepLinkCandidates(target: ResourceDeepLinkTarget): Set<string> {
    const rawResourceId = normalizeDeepLinkResourceId(target.resourceId);
    const candidates = new Set<string>();
    const add = (value: string) => {
        const normalized = normalizeDeepLinkResourceId(value);
        if (normalized) {
            candidates.add(normalized);
            candidates.add(withoutMarkdownExtension(normalized));
        }
    };

    if (target.resourceType === 'template') {
        const templateId = normalizeTemplateDeepLinkResourceId(rawResourceId);
        add(`templates/${templateId}`);
    } else {
        add(rawResourceId);
    }
    return candidates;
}

function findDocDeepLinkItem(target: ResourceDeepLinkTarget, docs: ItemData[]): ItemData | null {
    const candidates = buildDocDeepLinkCandidates(target);
    return docs.find((item) => {
        const itemCandidates = [
            item.resourceId,
            item.name,
        ].map(normalizeDeepLinkResourceId);
        return itemCandidates.some((candidate) => (
            candidates.has(candidate) || candidates.has(withoutMarkdownExtension(candidate))
        ));
    }) || null;
}

export function buildResourceDeepLinkUrl(target: ResourceDeepLinkTarget, baseUrl?: string): string {
    return buildIndexDeepLinkUrl(target, baseUrl);
}

export function buildIndexDeepLinkUrl(target: ResourceDeepLinkTarget, baseUrl?: string): string {
    const url = new URL('/', getBaseUrl(baseUrl));
    const projectId = String(target.projectId || '').trim();
    if (projectId) {
        url.searchParams.set('projectId', projectId);
    }

    if (target.resourceType === 'prototype') {
        url.searchParams.set('p', target.resourceId);
        if (target.view === 'canvas') {
            url.searchParams.set('v', 'canvas');
        }
        const pageId = String(target.pageId || '').trim();
        if (target.view !== 'canvas' && pageId) {
            url.searchParams.set('page', pageId);
        }
    } else if (target.resourceType === 'doc') {
        url.searchParams.set('doc', target.resourceId);
    } else if (target.resourceType === 'project-doc') {
        url.searchParams.set('docPath', target.resourceId);
    } else if (target.resourceType === 'template') {
        const templateId = normalizeTemplateDeepLinkResourceId(target.resourceId);
        if (templateId) {
            url.searchParams.set('doc', `templates/${templateId}`);
        }
    } else if (target.resourceType === 'theme') {
        url.searchParams.set('theme', target.resourceId);
    }
    return url.toString();
}

export function shouldSyncIndexDeepLinkUrl({
    currentTarget,
    initialTarget,
    initialTargetHandled,
}: {
    currentTarget: ResourceDeepLinkTarget | null;
    initialTarget: ResourceDeepLinkTarget | null;
    initialTargetHandled: boolean;
}): boolean {
    if (!currentTarget) {
        return false;
    }
    if (initialTarget && !initialTargetHandled) {
        return false;
    }
    return true;
}

export function parseResourceDeepLink(value?: string): ResourceDeepLinkTarget | null {
    return parseIndexDeepLink(value);
}

export function parseIndexDeepLink(value?: string): ResourceDeepLinkTarget | null {
    const rawValue = value || (typeof window !== 'undefined' ? window.location.href : '');
    if (!rawValue) {
        return null;
    }

    let url: URL;
    try {
        url = new URL(rawValue, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    } catch {
        return null;
    }

    const projectId = url.searchParams.get('projectId')?.trim() || undefined;
    const prototypeId = url.searchParams.get('p')?.trim();
    if (prototypeId) {
        return {
            resourceType: 'prototype',
            resourceId: prototypeId,
            view: url.searchParams.get('v')?.trim() === 'canvas' ? 'canvas' : 'demo',
            ...(url.searchParams.get('page')?.trim() ? { pageId: url.searchParams.get('page')?.trim() } : {}),
            ...(projectId ? { projectId } : {}),
            collapseSidebar: false,
        };
    }

    const docId = url.searchParams.get('doc')?.trim();
    if (docId) {
        const templateId = normalizeTemplateDeepLinkResourceId(docId);
        if (docId.replace(/\\/g, '/').replace(/^\/+/, '').startsWith('templates/') && templateId) {
            return {
                resourceType: 'template',
                resourceId: templateId,
                ...(projectId ? { projectId } : {}),
                collapseSidebar: false,
            };
        }
        return {
            resourceType: 'doc',
            resourceId: docId,
            ...(projectId ? { projectId } : {}),
            collapseSidebar: false,
        };
    }

    const docPath = normalizeDeepLinkResourceId(url.searchParams.get('docPath')?.trim());
    if (docPath) {
        return {
            resourceType: 'project-doc',
            resourceId: docPath,
            ...(projectId ? { projectId } : {}),
            collapseSidebar: true,
        };
    }

    const themeId = url.searchParams.get('theme')?.trim();
    if (themeId) {
        return {
            resourceType: 'theme',
            resourceId: themeId,
            ...(projectId ? { projectId } : {}),
            collapseSidebar: false,
        };
    }

    const resourceType = url.searchParams.get('resourceType')?.trim();
    const resourceId = url.searchParams.get('resourceId')?.trim();
    if (
        (
            resourceType !== 'prototype'
            && resourceType !== 'doc'
            && resourceType !== 'project-doc'
            && resourceType !== 'template'
            && resourceType !== 'theme'
        )
        || !resourceId
    ) {
        return null;
    }

    const viewParam = url.searchParams.get('view')?.trim();
    const view = viewParam === 'canvas' ? 'canvas' : 'demo';
    const pageId = url.searchParams.get('page')?.trim();
    return {
        resourceType,
        resourceId,
        ...(resourceType === 'prototype' ? { view } : {}),
        ...(resourceType === 'prototype' && pageId ? { pageId } : {}),
        ...(projectId ? { projectId } : {}),
        collapseSidebar: url.searchParams.get('sidebar') === 'collapsed',
    };
}

export function resolveIndexDeepLinkSelection(
    target: ResourceDeepLinkTarget | null,
    resources: {
        prototypes: ItemData[];
        docs: ItemData[];
        templates?: ItemData[];
        themes?: ThemeResourceItem[];
    },
): ResolvedResourceDeepLinkSelection | null {
    if (!target) {
        return null;
    }

    if (target.resourceType === 'prototype') {
        const item = resources.prototypes.find((candidate) => (
            candidate.resourceId === target.resourceId || candidate.name === target.resourceId
        ));
        if (!item) {
            return null;
        }
        return {
            kind: 'prototype',
            item,
            sidebarTab: 'prototype',
            viewMode: target.view || 'demo',
            collapseSidebar: Boolean(target.collapseSidebar),
        };
    }

    if (target.resourceType === 'template') {
        const templateId = normalizeTemplateDeepLinkResourceId(target.resourceId);
        const item = (resources.templates || []).find((candidate) => (
            candidate.resourceId === templateId || candidate.name === templateId
        ));
        if (item) {
            return {
                kind: 'template',
                item,
                sidebarTab: 'assets',
                resourceSection: 'templates',
                collapseSidebar: Boolean(target.collapseSidebar),
            };
        }
        const docItem = findDocDeepLinkItem(target, resources.docs);
        if (docItem) {
            return {
                kind: 'doc',
                item: docItem,
                sidebarTab: 'document',
                collapseSidebar: Boolean(target.collapseSidebar),
            };
        }
        return null;
    }

    if (target.resourceType === 'theme') {
        const theme = (resources.themes || []).find((candidate) => (
            candidate.name === target.resourceId
        ));
        if (!theme) {
            return null;
        }
        return {
            kind: 'theme',
            theme,
            sidebarTab: 'assets',
            resourceSection: 'themes',
            collapseSidebar: Boolean(target.collapseSidebar),
        };
    }

    if (target.resourceType === 'project-doc') {
        const item = buildProjectDocumentDeepLinkItem(target);
        if (!item) {
            return null;
        }
        return {
            kind: 'doc',
            item,
            sidebarTab: 'document',
            collapseSidebar: Boolean(target.collapseSidebar),
        };
    }

    const item = findDocDeepLinkItem(target, resources.docs);
    if (!item) {
        return null;
    }
    return {
        kind: 'doc',
        item,
        sidebarTab: 'document',
        collapseSidebar: Boolean(target.collapseSidebar),
    };
}

export function resolveResourceDeepLinkSelection(
    target: ResourceDeepLinkTarget | null,
    resources: {
        prototypes: ItemData[];
        docs: ItemData[];
        templates?: ItemData[];
        themes?: ThemeResourceItem[];
    },
): ResolvedResourceDeepLinkSelection | null {
    return resolveIndexDeepLinkSelection(target, resources);
}

export function resolveThemeDeepLinkSelection(
    target: ResourceDeepLinkTarget | null,
    themesOrNames: Array<ThemeResourceItem | string>,
): ResolvedResourceDeepLinkSelection | null {
    if (!target || target.resourceType !== 'theme') {
        return null;
    }
    const theme = themesOrNames.find((candidate) => (
        typeof candidate === 'string'
            ? candidate === target.resourceId
            : candidate.name === target.resourceId
    ));
    if (!theme) {
        return null;
    }
    const themeItem = typeof theme === 'string'
        ? { name: theme, displayName: theme }
        : theme;
    return {
        kind: 'theme',
        theme: themeItem,
        sidebarTab: 'assets',
        resourceSection: 'themes',
        collapseSidebar: Boolean(target.collapseSidebar),
    };
}
