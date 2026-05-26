import React from 'react';
import AppHeaderView from './AppHeaderView';
import type { HeaderActions, HeaderPreferences, HeaderState } from '../../types/index-page.types';

interface AppHeaderContainerProps {
    state: HeaderState;
    actions: HeaderActions;
    preferences: HeaderPreferences;
}

export default function AppHeaderContainer({ state, actions, preferences }: AppHeaderContainerProps) {
    return (
        <AppHeaderView
            collapsed={state.collapsed}
            setCollapsed={actions.setCollapsed}
            selectedItem={state.selectedItem}
            viewMode={state.viewMode}
            setViewMode={actions.setViewMode}
            activeTab={state.activeTab}
            selectedDeviceId={state.selectedDeviceId}
            setSelectedDeviceId={actions.setSelectedDeviceId}
            deviceSegmentOptions={state.deviceSegmentOptions}
            handleOpenWebEditor={actions.handleOpenWebEditor}
            handleExitWebEditor={actions.handleExitWebEditor}
            handleRefreshElement={actions.handleRefreshElement}
            handleCopyLocalLink={actions.handleCopyLocalLink}
            handleCopyLANLink={actions.handleCopyLANLink}
            getLANUrl={actions.getLANUrl}
            qrCodeVisible={state.qrCodeVisible}
            setQrCodeVisible={actions.setQrCodeVisible}
            handleCopyToFigma={actions.handleCopyToFigma}
            handleExportMake={actions.handleExportMake}
            setIsExportModalOpen={actions.setIsExportModalOpen}
            handleQuickCopyEditablePrototype={actions.handleQuickCopyEditablePrototype}
            handleQuickCopyRuntimeComponent={actions.handleQuickCopyRuntimeComponent}
            handleOpenIdeFile={actions.handleOpenIdeFile}
            handleOpenProjectInIDE={actions.handleOpenProjectInIDE}
            onStartCurrentProjectServer={actions.onStartCurrentProjectServer}
            startServerLoading={state.startServerLoading}
            preferredIDE={preferences.preferredIDE}
            ideAvailability={preferences.ideAvailability}
            onPreferredIDEChange={preferences.onPreferredIDEChange}
            isDarkMode={preferences.isDarkMode}
            setIsDarkMode={preferences.setIsDarkMode}
            quickEditAvailable={state.quickEditAvailable}
            quickEditActive={state.quickEditActive}
            exportAvailability={state.exportAvailability}
            editorMode={state.editorMode}
            lanAccessAllowed={state.lanAccessAllowed}
            onSettingsSaved={actions.onSettingsSaved}
        />
    );
}
