import type { ViewMode } from '../../types';
import type { ResourceSection, SidebarTab } from '../../types/index-page.types';

export type IndexContentMode = 'preview' | 'prototype-spec' | 'doc' | 'template' | 'canvas' | 'theme' | 'data';

interface ResolveIndexContentModeParams {
    sidebarTab: SidebarTab;
    resourceSection: ResourceSection;
    viewMode: ViewMode;
    selectedDocOpenMode?: string;
}

export function resolveIndexContentMode({
    sidebarTab,
    resourceSection,
    viewMode,
    selectedDocOpenMode,
}: ResolveIndexContentModeParams): IndexContentMode {
    if (sidebarTab === 'document') return selectedDocOpenMode === 'canvas' ? 'canvas' : 'doc';
    if (sidebarTab === 'canvas') return 'canvas';
    if (sidebarTab === 'assets') {
        if (resourceSection === 'templates') return 'template';
        if (resourceSection === 'data') return 'data';
        return 'theme';
    }
    return 'preview';
}
