import React from 'react';
import SidebarView from './SidebarView';
import type { SidebarActions, SidebarState } from '../../types/index-page.types';

interface SidebarContainerProps {
    state: SidebarState;
    actions: SidebarActions;
}

export default function SidebarContainer({ state, actions }: SidebarContainerProps) {
    return (
        <SidebarView
            collapsed={state.collapsed}
            loading={state.loading}
            activeTab={state.activeTab}
            handleTabChange={actions.handleTabChange}
            data={state.data}
            searchText={state.searchText}
            setSearchText={actions.setSearchText}
            filteredItems={state.filteredItems}
            selectedItem={state.selectedItem}
            handleMenuClick={actions.handleMenuClick}
            handleDownloadItemSource={actions.handleDownloadItemSource}
            handleRenameItem={actions.handleRenameItem}
            handleDuplicateItem={actions.handleDuplicateItem}
            handleDeleteItem={actions.handleDeleteItem}
            handleCopyItemPath={actions.handleCopyItemPath}
            setCreateDialogVisible={actions.setCreateDialogVisible}
            preferredPromptClient={state.preferredPromptClient}
            preferredIDE={state.preferredIDE}
        />
    );
}
