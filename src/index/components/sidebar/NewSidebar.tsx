import React from 'react';
import type { SidebarTab } from './IconNavigation';
import ContentPanel from './ContentPanel';
import { ItemData, SidebarTreeTab } from '../../types';
import { cn } from '@/lib/utils';
import type {
    NewSidebarLegacyProps,
    NewSidebarProps,
} from '../../types/index-page.types';
import type { ThemeResourceItem } from '../../domains/resources/resource.types';

function resolveNewSidebarProps(props: NewSidebarProps): NewSidebarLegacyProps {
    if ('state' in props) {
        return {
            ...props.state,
            ...props.actions,
            ...props.preferences,
        };
    }

    return props;
}

export default function NewSidebar(rawProps: NewSidebarProps) {
    const {
        collapsed,
        loading,
        handleTabChange,
        sidebarTab,
        viewMode,
        onSidebarTabChange,
        onPrototypeViewSelect,
        onPrototypePageSelect,
        data,
        docsItems,
        canvasItems,
        themes,
        searchText,
        setSearchText,
        selectedItem,
        selectedPrototypePageId,
        selectedDoc,
        selectedResourceFolder,
        selectedCanvas,
        selectedTheme,
        defaultThemeName,
        onRenameTheme,
        onDeleteTheme,
        onSetDefaultTheme,
        onSelectDoc,
        onSelectResourceFolder,
        onSelectCanvas,
        onSelectTheme,
        handleMenuClick,
        handleRenameItem,
        handleDuplicateItem,
        handleDeleteItem,
        handleCopyItemPath,
        handleRenameDocItem,
        handleDuplicateDocItem,
        handleDeleteDocItem,
        handleCopyDocPath,
        handleDocVersionManagement,
        onCreatePrototypeFromDoc,
        onOpenCreateDialog,
        onImportTheme,
        onUploadedResourceFiles,
        onCreateCanvasFile,

        onCreatePlaceholderPrototype,
        handleRenameCanvasItem,
        handleDuplicateCanvasItem,
        handleDeleteCanvasItem,
        handleCopyCanvasPath,
        onCreateFolder,
        onGenerateThemeFromPrototype,
        handleDownloadItemSource,
        handleDownloadThemeZip,
        preferredIDE,
        ideAvailability,
        agentAvailability,
        onOpenGenieWebAgent,
        onOpenWebAgentInPanel,
        onCloseWebAgentPanel,
        onSettingsClick,
        onToggleTheme,
        projectTitle,
        activeProjectId,
        projectSetupRequired,
        projects,
        resourceWriteCapabilities,
        lanAccessAllowed,
        onTitleChange,
        onProjectSwitch,
        onProjectDelete,
        onProjectStop,
        onAddProject,
        onCreateBlankMakeProject,
        onRefreshProjects,
        handleOpenProjectInIDE,
        onPreferredIDEChange,
        isDarkMode,
        handleVersionManagement,
        sidebarTrees,
        onSidebarTreeChange,
        onSidebarTreePersist,
        webAgentPanelOpen,
        onRefreshAvailability,
    } = resolveNewSidebarProps(rawProps);

    const handleSidebarTabChange = (tab: SidebarTab) => {
        onSidebarTabChange(tab);
        if (tab === 'prototype') {
            handleTabChange('prototypes');
        }
    };

    const currentTreeTab: SidebarTreeTab = sidebarTab === 'prototype'
        ? 'prototypes'
        : sidebarTab === 'document'
            ? 'docs'
            : sidebarTab === 'assets'
                ? 'themes'
                : 'canvas';

    const canvasAsItemData: ItemData[] = canvasItems.map((canvas) => ({
        ...canvas,
        name: canvas.name,
        displayName: canvas.displayName,
        jsUrl: (canvas as ItemData).jsUrl || '',
        specUrl: (canvas as ItemData).specUrl || '',
    }));
    const selectedCanvasItem = selectedCanvas
        ? canvasAsItemData.find((canvas) => canvas.name === selectedCanvas.name)
        || {
            ...selectedCanvas,
            name: selectedCanvas.name,
            displayName: selectedCanvas.displayName,
            jsUrl: (selectedCanvas as ItemData).jsUrl || '',
            specUrl: (selectedCanvas as ItemData).specUrl || '',
        }
        : null;

    const themesAsItemData: ItemData[] = themes.map((theme) => ({
        name: theme.name,
        displayName: theme.displayName || theme.name,
        jsUrl: '',
        specUrl: '',
        filePath: theme.path,
        absoluteFilePath: theme.absoluteFilePath,
        previewUrl: theme.previewUrl || theme.clientUrl,
        clientUrl: theme.clientUrl || theme.previewUrl,
        projectId: theme.projectId,
        resourceId: theme.name,
    }));
    const selectedThemeItem = selectedTheme
        ? themesAsItemData.find((t) => t.name === selectedTheme.name)
        || {
            name: selectedTheme.name,
            displayName: selectedTheme.displayName || selectedTheme.name,
            jsUrl: '',
            specUrl: '',
            filePath: selectedTheme.path,
            absoluteFilePath: selectedTheme.absoluteFilePath,
            previewUrl: selectedTheme.previewUrl || selectedTheme.clientUrl,
            clientUrl: selectedTheme.clientUrl || selectedTheme.previewUrl,
            projectId: selectedTheme.projectId,
            resourceId: selectedTheme.name,
        }
        : null;

    const currentItems = currentTreeTab === 'prototypes'
        ? data.prototypes
        : currentTreeTab === 'docs'
            ? docsItems
            : currentTreeTab === 'themes'
                ? themesAsItemData
                : canvasAsItemData;

    const currentSelectedItem = sidebarTab === 'document'
        ? selectedDoc
        : sidebarTab === 'canvas'
            ? selectedCanvasItem
            : sidebarTab === 'assets'
                ? selectedThemeItem
                : selectedItem;

    const renameHandler = currentTreeTab === 'docs'
        ? handleRenameDocItem
        : currentTreeTab === 'canvas'
            ? handleRenameCanvasItem
            : currentTreeTab === 'themes'
                ? (item: ItemData, nextName: string) => { void onRenameTheme(themes.find((t) => t.name === item.name) || item as any, nextName); }
                : handleRenameItem;
    const duplicateHandler = currentTreeTab === 'docs'
        ? handleDuplicateDocItem
        : currentTreeTab === 'canvas'
            ? handleDuplicateCanvasItem
            : handleDuplicateItem;
    const deleteHandler = currentTreeTab === 'docs'
        ? handleDeleteDocItem
        : currentTreeTab === 'canvas'
            ? handleDeleteCanvasItem
            : currentTreeTab === 'themes'
                ? (item: ItemData) => { void onDeleteTheme(themes.find((t) => t.name === item.name) || item as any); }
                : handleDeleteItem;
    const copyPathHandler = currentTreeTab === 'docs'
        ? handleCopyDocPath
        : currentTreeTab === 'canvas'
            ? handleCopyCanvasPath
            : handleCopyItemPath;
    const versionHandler = currentTreeTab === 'docs' ? handleDocVersionManagement : handleVersionManagement;

    return (
        <div
            className={cn(
                'flex flex-col h-full min-h-0 bg-background border-r transition-all duration-300',
                collapsed ? 'w-0 overflow-hidden border-none' : 'w-[240px]',
            )}
        >
            <ContentPanel
                activeTab={sidebarTab}
                viewMode={viewMode}
                onTabChange={handleSidebarTabChange}
                onPrototypeViewSelect={onPrototypeViewSelect}
                onPrototypePageSelect={onPrototypePageSelect}
                projectTitle={projectTitle}
                activeProjectId={activeProjectId}
                projectSetupRequired={projectSetupRequired}
                projects={projects}
                resourceWriteCapabilities={resourceWriteCapabilities}
                lanAccessAllowed={lanAccessAllowed}
                onTitleChange={onTitleChange}
                onProjectSwitch={onProjectSwitch}
                onProjectDelete={onProjectDelete}
                onProjectStop={onProjectStop}
                onAddProject={onAddProject}
                onCreateBlankMakeProject={onCreateBlankMakeProject}
                onRefreshProjects={onRefreshProjects}
                tree={sidebarTrees[currentTreeTab] || []}
                onTreeChange={(nextTree) => onSidebarTreeChange(currentTreeTab, nextTree)}
                onTreePersist={(nextTree) => onSidebarTreePersist(currentTreeTab, nextTree)}
                items={currentItems}
                selectedItem={currentSelectedItem}
                selectedPrototypePageId={sidebarTab === 'prototype' ? selectedPrototypePageId : null}
                selectedFolder={sidebarTab === 'document' ? selectedResourceFolder : null}
                onItemClick={(item) => {
                    if (sidebarTab === 'document') {
                        onSelectDoc(item);
                        return;
                    }
                    if (sidebarTab === 'canvas') {
                        onSelectCanvas({ name: item.name, displayName: item.displayName });
                        return;
                    }
                    if (sidebarTab === 'assets') {
                        const themeItem = themes.find((t) => t.name === item.name);
                        if (themeItem) {
                            onSelectTheme(themeItem);
                        }
                        return;
                    }
                    void onPrototypeViewSelect(item, 'demo');
                }}
                onFolderClick={sidebarTab === 'document' ? onSelectResourceFolder : undefined}
                onSearch={setSearchText}
                searchText={searchText}
                onCreateFile={onCreatePlaceholderPrototype}
                onImportPrototype={() => onOpenCreateDialog('upload')}
                onImportTheme={onImportTheme}
                onUploadedResourceFiles={onUploadedResourceFiles}
                onCreateCanvasFile={onCreateCanvasFile}
                onCreatePrototypeFromDoc={(doc) => {
                    void onCreatePrototypeFromDoc(doc);
                }}
                onCreateFolder={onCreateFolder}
                onGenerateThemeFromPrototype={onGenerateThemeFromPrototype}
                handleDownloadItemSource={handleDownloadItemSource}
                handleDownloadThemeZip={(theme) => {
                    const themeItem = themes.find((item) => item.name === theme.name) || theme as ThemeResourceItem;
                    void Promise.resolve(handleDownloadThemeZip(themeItem));
                }}
                loading={loading}
                handleOpenProjectInIDE={handleOpenProjectInIDE}
                preferredIDE={preferredIDE}
                ideAvailability={ideAvailability}
                agentAvailability={agentAvailability}
                onOpenGenieWebAgent={onOpenGenieWebAgent}
                onOpenWebAgentInPanel={onOpenWebAgentInPanel}
                webAgentPanelOpen={webAgentPanelOpen}
                onCloseWebAgentPanel={onCloseWebAgentPanel}
                onPreferredIDEChange={onPreferredIDEChange}
                onRefreshAvailability={onRefreshAvailability}
                isDarkMode={isDarkMode}
                handleRenameItem={renameHandler}
                handleDuplicateItem={duplicateHandler}
                handleCopyItemPath={copyPathHandler}
                handleVersionManagement={versionHandler}
                handleDeleteItem={deleteHandler}
                onSettingsClick={onSettingsClick}
                onToggleTheme={onToggleTheme}
                selectedTheme={selectedTheme}
                defaultThemeName={defaultThemeName}
                onSetDefaultTheme={onSetDefaultTheme}
            />
        </div>
    );
}
