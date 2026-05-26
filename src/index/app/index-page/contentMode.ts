import type { ViewMode } from '../../types';
import type { ResourceSection, SidebarTab } from '../../types/index-page.types';

export type IndexContentMode = 'preview' | 'doc' | 'template' | 'canvas' | 'theme' | 'data';

interface ResolveIndexContentModeParams {
    sidebarTab: SidebarTab;
    resourceSection: ResourceSection;
    viewMode: ViewMode;
}

export function resolveIndexContentMode({
    sidebarTab,
    resourceSection,
    viewMode,
}: ResolveIndexContentModeParams): IndexContentMode {
    if (viewMode === 'canvas' && sidebarTab !== 'canvas') {
        return 'preview';
    }

    if (sidebarTab === 'document') return 'doc';
    if (sidebarTab === 'canvas') return 'canvas';
    if (sidebarTab === 'assets') {
        if (resourceSection === 'templates') return 'template';
        if (resourceSection === 'data') return 'data';
        return 'theme';
    }
    return 'preview';
}

export function isBrowsingResourceSidebarInPrototypeCanvas({
    sidebarTab,
    viewMode,
}: Pick<ResolveIndexContentModeParams, 'sidebarTab' | 'viewMode'>): boolean {
    return viewMode === 'canvas' && sidebarTab !== 'canvas';
}
