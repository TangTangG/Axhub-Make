import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { IDEAvailabilityMap, MainIDEPreference } from '../../../common/ide';
import type { RuntimeAgentAvailability } from '../../../common/agent';
import type { GenieProvider } from '@/common/genie/types';
import type { ItemData, TabType, ViewMode } from '../../types';
import type {
    NewSidebarGroupedProps,
    ResourceSection,
    SidebarTab,
} from '../../types/index-page.types';
import type { LocalExportCapabilities, ResourceWriteCapabilities } from '../../services/projectResources';

interface UseIndexPageSidebarPropsBuilderParams {
    state: {
        collapsed: boolean;
        loading: boolean;
        sidebarTab: SidebarTab;
        viewMode: ViewMode;
        data: any;
        docsItems: any[];
        canvasItems: any[];
        themes: any[];
        searchText: string;
        selectedItem: ItemData | null;
        selectedPrototypePageId?: string | null;
        resourceSection: ResourceSection;
        projectTitle: string;
        activeProjectId: string | null;
        projectSetupRequired?: boolean;
        projects: any[];
        resourceWriteCapabilities: ResourceWriteCapabilities;
        localExportCapabilities: LocalExportCapabilities;
        lanAccessAllowed?: boolean;
        isDarkMode: boolean;
        sidebarTrees: any;
        selectedDoc: ItemData | null;
        selectedResourceFolder?: any;
        selectedCanvas: any;
        selectedTheme: any;
        webAgentPanelOpen?: boolean;
        defaultThemeName?: string | null;
    };
    deps: {
        preferredPromptClient: any;
        preferredIDE: MainIDEPreference;
        ideAvailability?: IDEAvailabilityMap;
        agentAvailability?: RuntimeAgentAvailability;
        setPreferredIDE: (ide: MainIDEPreference) => void;
        setIsDarkMode: (dark: boolean) => void;
        setSettingsDialogOpen: (open: boolean) => void;
        setActiveTab: Dispatch<SetStateAction<TabType>>;
        setSidebarTab: Dispatch<SetStateAction<SidebarTab>>;
        setViewMode: Dispatch<SetStateAction<ViewMode>>;
        setResourceSection: Dispatch<SetStateAction<ResourceSection>>;
        setSearchText: (text: string) => void;
        switchProject: (projectId: string) => void | Promise<void>;
        deleteProject: (projectId: string) => void | Promise<void>;
        stopProjectDevServer: (projectId: string) => void | Promise<void>;
        addProjectFromLocalPath: (root: string) => boolean | void | Promise<boolean | void>;
        createBlankMakeProject: (params: {
            parentRoot: string;
            folderName: string;
            projectName?: string;
        }) => Promise<unknown>;
        loadProjects: () => void | Promise<void>;
        setCreateDialogVisible: Dispatch<SetStateAction<boolean>>;
        setInitialCreateDialogTab: Dispatch<SetStateAction<'ai' | 'create' | 'upload'>>;
        handleTabChange: (tab: TabType) => void;
        handleMenuClick: (params: { key: string; pageId?: string | null }) => void | Promise<void>;
        setSelectedPrototypePageId?: Dispatch<SetStateAction<string | null>>;
        handleOpenProjectInIDE: (ideOverride?: MainIDEPreference, targetPath?: string) => boolean | Promise<boolean>;
        handleOpenGenieWebAgent?: (targetPath?: string, provider?: GenieProvider) => void | Promise<void>;
        handleOpenWebAgentInPanel?: (url: string) => boolean | void | Promise<boolean | void>;
        onCloseWebAgentPanel?: () => void;
        refreshAvailability?: () => void;
        handleOpenSelectedDocInIDE: (itemOverride?: ItemData | null, kindOverride?: 'doc' | 'template') => Promise<void>;
        handleCopyItemPath: (item: ItemData) => Promise<void>;
        previewHandleSelectDoc: (item: ItemData) => void;
        resources: any;
    };
}

export function useIndexPageSidebarPropsBuilder({
    state,
    deps,
}: UseIndexPageSidebarPropsBuilderParams): NewSidebarGroupedProps {
    return useMemo(() => ({
        state: {
            collapsed: state.collapsed,
            loading: state.loading,
            sidebarTab: state.sidebarTab,
            viewMode: state.viewMode,
            data: state.data,
            docsItems: state.docsItems,
            canvasItems: state.canvasItems,
            themes: state.themes,
            searchText: state.searchText,
            selectedItem: state.selectedItem,
            selectedPrototypePageId: state.selectedPrototypePageId,
            selectedDoc: state.selectedDoc,
            selectedResourceFolder: state.selectedResourceFolder,
            selectedCanvas: state.selectedCanvas,
            selectedTheme: state.selectedTheme,
            resourceSection: state.resourceSection,
            projectTitle: state.projectTitle,
            activeProjectId: state.activeProjectId,
            projectSetupRequired: state.projectSetupRequired,
            projects: state.projects,
            resourceWriteCapabilities: state.resourceWriteCapabilities,
            localExportCapabilities: state.localExportCapabilities,
            lanAccessAllowed: state.lanAccessAllowed,
            isDarkMode: state.isDarkMode,
            sidebarTrees: state.sidebarTrees,
            webAgentPanelOpen: state.webAgentPanelOpen,
            defaultThemeName: state.defaultThemeName,
        },
        actions: {
            handleTabChange: deps.handleTabChange,
            onSidebarTabChange: deps.setSidebarTab,
            onPrototypeViewSelect: async (item, mode) => {
                await Promise.resolve(deps.handleMenuClick({ key: item.name }));
                deps.setSelectedPrototypePageId?.(null);
                deps.setSidebarTab('prototype');
                deps.setViewMode(mode);
            },
            onPrototypePageSelect: async (item, pageId) => {
                await Promise.resolve(deps.handleMenuClick({ key: item.name, pageId }));
                deps.setSelectedPrototypePageId?.(pageId);
                deps.setSidebarTab('prototype');
                deps.setViewMode('demo');
            },
            setSearchText: deps.setSearchText,
            onRenameTheme: (item) => { void deps.resources.handleRenameThemeResource(item); },
            onDeleteTheme: (item) => { void deps.resources.handleDeleteThemeResource(item); },
            onSetDefaultTheme: (themeName) => { void deps.resources.handleSetDefaultTheme(themeName); },
            onResourceSectionChange: deps.setResourceSection,
            onSelectDoc: (item) => {
                deps.previewHandleSelectDoc(item);
                deps.setViewMode('demo');
            },
            onSelectResourceFolder: deps.resources.handleSelectResourceFolder,
            onSelectCanvas: deps.resources.handleSelectCanvas,
            onSelectTheme: (item) => {
                deps.setSidebarTab('assets');
                deps.setResourceSection('themes');
                deps.resources.setSelectedTheme(item);
                deps.setViewMode('demo');
            },
            handleMenuClick: deps.handleMenuClick,
            handleDownloadItemSource: deps.resources.handleDownloadItemSource,
            handleDownloadThemeZip: deps.resources.handleDownloadThemeZip,
            handleRenameItem: deps.resources.handleRenameItem,
            handleDuplicateItem: (item) => { void deps.resources.handleDuplicateItem(item); },
            handleDeleteItem: (item) => { void deps.resources.handleDeleteItem(item, deps.preferredPromptClient, deps.preferredIDE, deps.ideAvailability); },
            handleCopyItemPath: (item) => { void deps.handleCopyItemPath(item); },
            handleRenameDocItem: deps.resources.handleRenameDocItem,
            handleDuplicateDocItem: (item) => { void deps.resources.handleDuplicateDocItem(item); },
            handleDeleteDocItem: (item) => { void deps.resources.handleDeleteDocItem(item); },
            handleCopyDocPath: (item) => { void deps.resources.handleCopyDocPath(item); },
            handleDocVersionManagement: deps.resources.handleDocVersionManagement,
            onCreatePrototypeFromDoc: (doc) => { void deps.resources.handleCreatePrototypeFromDoc(doc); },
            onOpenCreateDialog: (initialTab = 'ai') => {
                if (state.sidebarTab === 'prototype') {
                    deps.setActiveTab('prototypes');
                }
                deps.setInitialCreateDialogTab(initialTab);
                deps.setCreateDialogVisible(true);
            },
            onImportTheme: deps.resources.handleImportThemeResource,
            onCreatePlaceholderPrototype: () => { void deps.resources.handleCreatePlaceholderPrototype(); },
            onUploadedResourceFiles: () => { void deps.resources.handleUploadedResourceFiles(); },
            onCreateCanvasFile: () => { void deps.resources.handleCreateCanvasFile(); },
            handleRenameCanvasItem: deps.resources.handleRenameCanvasItem,
            handleDuplicateCanvasItem: deps.resources.handleDuplicateCanvasItem,
            handleDeleteCanvasItem: deps.resources.handleDeleteCanvasItem,
            handleCopyCanvasPath: deps.resources.handleCopyCanvasPath,
            onCreateFolder: deps.resources.handleCreateFolder,
            onGenerateThemeFromPrototype: deps.resources.handleGenerateThemeFromPrototype,
            onSettingsClick: () => deps.setSettingsDialogOpen(true),
            onToggleTheme: () => deps.setIsDarkMode(!state.isDarkMode),
            onTitleChange: deps.resources.handleProjectTitleChange,
            onProjectSwitch: deps.switchProject,
            onProjectDelete: deps.deleteProject,
            onProjectStop: deps.stopProjectDevServer,
            onAddProject: deps.addProjectFromLocalPath,
            onCreateBlankMakeProject: deps.createBlankMakeProject,
            onRefreshProjects: deps.loadProjects,
            handleOpenProjectInIDE: deps.handleOpenProjectInIDE,
            onOpenGenieWebAgent: deps.handleOpenGenieWebAgent,
            onOpenWebAgentInPanel: deps.handleOpenWebAgentInPanel,
            onCloseWebAgentPanel: deps.onCloseWebAgentPanel,
            onSidebarTreeChange: deps.resources.handleSidebarTreeChange,
            onSidebarTreePersist: deps.resources.handleSidebarTreePersist,
            handleVersionManagement: deps.resources.handleVersionManagement,
        },
        preferences: {
            preferredIDE: deps.preferredIDE,
            ideAvailability: deps.ideAvailability,
            agentAvailability: deps.agentAvailability,
            onPreferredIDEChange: deps.setPreferredIDE,
            onRefreshAvailability: deps.refreshAvailability,
        },
    }), [deps, state]) satisfies NewSidebarGroupedProps;
}
