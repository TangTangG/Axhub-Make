import React from 'react';
import PresentationToolbar from './PresentationToolbar';
import ContentAreaView from './ContentAreaView';
import UiReviewPanel from './UiReviewPanel';
import type {
    PresentationAreaLegacyProps,
    PresentationAreaProps,
} from '../../types/index-page.types';

function resolvePresentationAreaProps(props: PresentationAreaProps): PresentationAreaLegacyProps {
    if ('state' in props) {
        return {
            ...props.state,
            ...props.actions,
        };
    }

    return props;
}

export default function PresentationArea(rawProps: PresentationAreaProps) {
    const props = resolvePresentationAreaProps(rawProps);

    const isCanvasMode = props.contentMode === 'canvas' || props.viewMode === 'canvas';
    const isResourceFolderPreview = props.contentMode === 'doc' && Boolean(props.selectedResourceFolder);

    return (
        <div className="flex flex-col flex-1 h-full min-h-0 min-w-0 bg-background">
            {!isCanvasMode && !isResourceFolderPreview ? (
                <PresentationToolbar
                    collapsed={props.collapsed}
                    setCollapsed={props.setCollapsed}
                    selectedItem={props.selectedItem}
                    viewMode={props.viewMode}
                    activeTab={props.activeTab}
                    setViewMode={props.setViewMode}
                    selectedDeviceId={props.selectedDeviceId}
                    previewConfig={props.previewConfig}
                    deviceSegmentOptions={props.deviceSegmentOptions}
                    handleSelectPreviewSinglePreset={props.handleSelectPreviewSinglePreset}
                    handleSelectCustomPreview={props.handleSelectCustomPreview}
                    handleActivateSplitPreview={props.handleActivateSplitPreview}
                    handleChangeCustomPreviewWidth={props.handleChangeCustomPreviewWidth}
                    handleChangeCustomPreviewHeight={props.handleChangeCustomPreviewHeight}
                    handleChangeSplitPreviewWidth={props.handleChangeSplitPreviewWidth}
                    handleChangeSplitPreviewHeight={props.handleChangeSplitPreviewHeight}
                    handleChangePreviewScaleMode={props.handleChangePreviewScaleMode}
                    handleOpenWebEditor={props.handleOpenWebEditor}
                    handleExitWebEditor={props.handleExitWebEditor}
                    handleEnableDocEdit={props.handleEnableDocEdit}
                    handleSaveDocEdit={props.handleSaveDocEdit}
                    handleExitDocEdit={props.handleExitDocEdit}
                    handleSwitchDocQuickEditMode={props.handleSwitchDocQuickEditMode}
                    handleCopyMarkdownPrompt={props.handleCopyMarkdownPrompt}
                    handleRefreshElement={props.handleRefreshElement}
                    handleCopyToFigma={props.handleCopyToFigma}
                    handleExportMake={props.handleExportMake}
                    handleExportHtml={props.handleExportHtml}
                    handlePublishCloudTarget={props.handlePublishCloudTarget}
                    handleOpenCloudPublishSettings={props.handleOpenCloudPublishSettings}
                    latestCloudPublishUrl={props.latestCloudPublishUrl}
                    handleCopyLatestCloudPublishUrl={props.handleCopyLatestCloudPublishUrl}
                    setIsExportModalOpen={props.setIsExportModalOpen}
                    handleQuickCopyEditablePrototype={props.handleQuickCopyEditablePrototype}
                    handleQuickCopyRuntimeComponent={props.handleQuickCopyRuntimeComponent}
                    handleOpenAxureUsageGuide={props.handleOpenAxureUsageGuide}
                    handleOpenIdeFile={props.handleOpenIdeFile}
                    handleOpenDocInIDE={props.handleOpenDocInIDE}
                    handleOpenThemeInIDE={props.handleOpenThemeInIDE}
                    handleOpenDataTableInIDE={props.handleOpenDataTableInIDE}
                    quickEditAvailable={props.quickEditAvailable}
                    quickEditActive={props.quickEditActive}
                    docEditState={props.docEditState}
                    markdownPromptCopying={props.markdownPromptCopying}
                    quickEditRuntimeStatus={props.quickEditRuntimeStatus}
                    exportAvailability={props.exportAvailability}
                    hostToolbarState={props.hostToolbarState}
                    handleRunHostToolbarAction={props.handleRunHostToolbarAction}
                    handleRunQuickEditSaveAction={props.handleRunQuickEditSaveAction}
                    contentMode={props.contentMode}
                    selectedDoc={props.selectedDoc}
                    selectedTemplate={props.selectedTemplate}
                    selectedTheme={props.selectedTheme}
                    selectedDataTable={props.selectedDataTable}
                    startServerError={props.startServerError}
                    standalonePanelOpen={props.standalonePanelOpen}
                    onStandalonePanelToggle={props.onStandalonePanelToggle}
                    reviewPanelOpen={props.reviewPanelOpen}
                    onReviewPanelToggle={props.handleReviewPanelToggle}
                />
            ) : null}
            <div className="flex flex-1 min-h-0">
                <div className="flex-1 min-h-0 relative">
                    <ContentAreaView
                        containerRef={props.containerRef}
                        previewIframeRef={props.previewIframeRef}
                        secondaryPreviewIframeRef={props.secondaryPreviewIframeRef}
                        selectedItem={props.selectedItem}
                        activeTab={props.activeTab}
                        previewConfig={props.previewConfig}
                        reviewPageZoomEnabled={props.reviewPageZoomEnabled}
                        handleChangeSplitPreviewWidth={props.handleChangeSplitPreviewWidth}
                        handleChangeSplitPreviewHeight={props.handleChangeSplitPreviewHeight}
                        currentDevice={props.currentDevice}
                        displaySize={props.displaySize}
                        scale={props.scale}
                        elementIframeKey={props.elementIframeKey}
                        primaryIframeUrl={props.primaryIframeUrl}
                        secondaryIframeUrl={props.secondaryIframeUrl}
                        onPreviewIframeLoad={props.handlePreviewIframeLoad}
                        elementIframeSize={props.elementIframeSize}
                        setElementIframeSize={props.setElementIframeSize}
                        viewMode={props.viewMode}
                        setViewMode={props.setViewMode}
                        onEnterSelectedPrototypePreview={props.handleEnterSelectedPrototypePreview}
                        contentMode={props.contentMode}
                        docsItems={props.docsItems}
                        selectedDoc={props.selectedDoc}
                        selectedResourceFolder={props.selectedResourceFolder}
                        selectedTemplate={props.selectedTemplate}
                        isDarkMode={props.isDarkMode}
                        selectedTheme={props.selectedTheme}
                        selectedDataTable={props.selectedDataTable}
                        projectRuntimeStatus={props.projectRuntimeStatus}
                        projectRuntimeStatusLoading={props.projectRuntimeStatusLoading}
                        projectAccessDeniedReason={props.projectAccessDeniedReason}
                        hasPrototypeItems={props.hasPrototypeItems}
                        hasDocItems={props.hasDocItems}
                        onStartMakeProject={props.onStartCurrentProjectServer}
                        startServerLoading={props.startServerLoading}
                        startServerError={props.startServerError}
                        collapsed={props.collapsed}
                        setCollapsed={props.setCollapsed}
                        selectedCanvas={props.selectedCanvas}
                        excalidrawPropertyPanelMode={props.excalidrawPropertyPanelMode}
                        setExcalidrawPropertyPanelMode={props.setExcalidrawPropertyPanelMode}
                        excalidrawPropertyPanelPosition={props.excalidrawPropertyPanelPosition}
                        setExcalidrawPropertyPanelPosition={props.setExcalidrawPropertyPanelPosition}
                        bridgeConnected={props.bridgeConnected}
                        assistantVisible={props.assistantVisible}
                        onToggleAssistant={props.onToggleAssistant}
                        onAddToContext={props.onAddCanvasElementToContext}
                        onAnnotationsChange={props.onCanvasAnnotationsChange}
                        onOpenCanvasInIDE={props.onOpenCanvasInIDE}
                        onOpenCanvasGenie={props.onOpenCanvasGenie}
                        onSelectResourceFolder={props.onSelectResourceFolder}
                        onSelectResourceFolderItem={props.onSelectResourceFolderItem}
                        onOpenResourceFolderInSystem={props.onOpenResourceFolderInSystem}
                        preferredIDE={props.preferredIDE}
                        activeProjectId={props.activeProjectId}
                        ideAvailability={props.ideAvailability}
                        agentAvailability={props.agentAvailability}
                        webAgentPanelOpen={props.webAgentPanelOpen}
                        onOpenProjectInIDE={props.handleOpenProjectInIDE}
                        onOpenGenieWebAgent={props.onOpenGenieWebAgent}
                        onOpenWebAgentInPanel={props.onOpenWebAgentInPanel}
                        onCloseWebAgentPanel={props.onCloseWebAgentPanel}
                        onPreferredIDEChange={props.onPreferredIDEChange}
                        onRefreshAvailability={props.onRefreshAvailability}
                        assistantApiBaseUrl={props.assistantApiBaseUrl}
                        assistantProjectPath={props.assistantProjectPath}
                        preferredPromptClient={props.preferredPromptClient}
                        prototypes={props.prototypes}
                        themes={props.themes}
                        defaultThemeName={props.defaultThemeName}
                        onRefreshPrototypes={props.onRefreshPrototypes}
                    />
                </div>
                {props.reviewPanelOpen && props.viewMode !== 'canvas' ? (
                    <UiReviewPanel
                        activeKind={props.activeReviewKind || 'design'}
                        markdown={props.reviewMarkdown || ''}
                        updatedAt={props.reviewUpdatedAt}
                        loading={props.reviewLoading}
                        error={props.reviewError}
                        pageZoomEnabled={Boolean(props.reviewPageZoomEnabled)}
                        onKindChange={(kind) => props.handleReviewKindChange?.(kind)}
                        onCopyPrompt={() => { void props.handleCopyReviewPrompt?.(); }}
                        onTogglePageZoom={() => props.handleToggleReviewPageZoom?.()}
                    />
                ) : null}
            </div>
        </div>
    );
}
