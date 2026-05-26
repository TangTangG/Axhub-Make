import type { ItemData, ViewMode } from '../../types';
import type { ResourceSection, SidebarTab, ThemeResourceItem } from '../../types/index-page.types';

export type ResourceDeepLinkType = 'prototype' | 'doc' | 'theme';

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
        return {
            resourceType: 'doc',
            resourceId: docId,
            ...(projectId ? { projectId } : {}),
            collapseSidebar: false,
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
    if ((resourceType !== 'prototype' && resourceType !== 'doc' && resourceType !== 'theme') || !resourceId) {
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

    const item = resources.docs.find((candidate) => (
        candidate.resourceId === target.resourceId || candidate.name === target.resourceId
    ));
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
