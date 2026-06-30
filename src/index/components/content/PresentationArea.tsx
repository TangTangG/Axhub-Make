import React from 'react';
import { PencilRuler } from 'lucide-react';
import PresentationToolbar from './PresentationToolbar';
import ContentAreaView from './ContentAreaView';
import UiReviewPanel from './UiReviewPanel';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
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
    const isPreviewContentMode = props.contentMode === 'preview';
    const isPrototypeStartDraft = isPreviewContentMode && props.prototypeStartDraftActive === true && !props.selectedItem;
    const isPrototypeStartPlaceholder = isPreviewContentMode && props.selectedItem?.placeholder === true && props.viewMode === 'demo';
    const shouldShowPresentationToolbar = !isCanvasMode
        && !isResourceFolderPreview
        && !isPrototypeStartDraft
        && !isPrototypeStartPlaceholder;
    const shouldShowAssistantPanel = props.reviewPanelOpen
        && props.viewMode !== 'canvas'
        && !isPrototypeStartDraft
        && !isPrototypeStartPlaceholder;
    const shouldShowPrototypeStartActions = isPrototypeStartDraft || isPrototypeStartPlaceholder;
    const handleOpenPrototypeStartCanvas = async () => {
        const draftCreatedItem = isPrototypeStartDraft
            ? await props.onCreatePrototypeForDraftStart?.()
            : null;
        const startItem = draftCreatedItem || props.selectedItem;
        if (!startItem) {
            toast.error('创建原型失败');
            return;
        }
        props.setViewMode?.('canvas');
    };

    return (
        <div className="relative flex flex-col flex-1 h-full min-h-0 min-w-0 bg-background">
            {shouldShowPrototypeStartActions ? (
                <div className="pointer-events-none absolute right-8 top-5 z-10 flex items-center justify-end">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="pointer-events-auto h-8 cursor-pointer gap-1.5 px-2 text-xs text-slate-600 hover:bg-white hover:text-slate-950"
                        aria-label="打开画布"
                        onClick={() => { void handleOpenPrototypeStartCanvas(); }}
                    >
                        <PencilRuler className="h-4 w-4" />
                        <span>画布</span>
                    </Button>
                </div>
            ) : null}
            {shouldShowPresentationToolbar ? (
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
                    handleActivateMultiPagePreview={props.handleActivateMultiPagePreview}
                    handleChangeMultiPageColumns={props.handleChangeMultiPageColumns}
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
                    drawioResourceEditAvailable={props.drawioResourceEditAvailable}
                    handleOpenDrawioResourceEditor={props.handleOpenDrawioResourceEditor}
                    handleCopyMarkdownPrompt={props.handleCopyMarkdownPrompt}
                    handleRefreshElement={props.handleRefreshElement}
                    handleCopyToFigma={props.handleCopyToFigma}
                    handleCopyCurrentScreenshot={props.handleCopyCurrentScreenshot}
                    handleExportMake={props.handleExportMake}
                    handleExportHtml={props.handleExportHtml}
                    handlePublishCloudTarget={props.handlePublishCloudTarget}
                    handleOpenCloudPublishSettings={props.handleOpenCloudPublishSettings}
                    handleOpenAxhubPublishDialog={props.handleOpenAxhubPublishDialog}
                    currentPublishResourcePath={props.currentPublishResourcePath}
                    visibleCloudPublishTargets={props.visibleCloudPublishTargets}
                    latestCloudPublishUrl={props.latestCloudPublishUrl}
                    handleCopyLatestCloudPublishUrl={props.handleCopyLatestCloudPublishUrl}
                    setIsExportModalOpen={props.setIsExportModalOpen}
                    handleQuickCopyEditablePrototype={props.handleQuickCopyEditablePrototype}
                    handleOpenAxureUsageGuide={props.handleOpenAxureUsageGuide}
                    handleOpenIdeFile={props.handleOpenIdeFile}
                    handleOpenDocInIDE={props.handleOpenDocInIDE}
                    handleOpenThemeInIDE={props.handleOpenThemeInIDE}
                    handleOpenDataTableInIDE={props.handleOpenDataTableInIDE}
                    preferredIDE={props.preferredIDE}
                    ideAvailability={props.ideAvailability}
                    quickEditAvailable={props.quickEditAvailable}
                    quickEditActive={props.quickEditActive}
                    docEditState={props.docEditState}
                    markdownPromptCopying={props.markdownPromptCopying}
                    quickEditRuntimeStatus={props.quickEditRuntimeStatus}
                    exportAvailability={props.exportAvailability}
                    hostToolbarState={props.hostToolbarState}
                    prototypeDecisionDataAvailable={props.prototypeDecisionDataAvailable}
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
                        prototypeStartDraftActive={props.prototypeStartDraftActive}
                        activeTab={props.activeTab}
                        previewConfig={props.previewConfig}
                        reviewPageZoomEnabled={props.reviewPageZoomEnabled}
                        handleChangeMultiPageColumns={props.handleChangeMultiPageColumns}
                        handleSelectPreviewSinglePreset={props.handleSelectPreviewSinglePreset}
                        handleSelectCustomPreview={props.handleSelectCustomPreview}
                        handleActivateMultiPagePreview={props.handleActivateMultiPagePreview}
                        handleChangeCustomPreviewWidth={props.handleChangeCustomPreviewWidth}
                        handleChangeCustomPreviewHeight={props.handleChangeCustomPreviewHeight}
                        handleChangePreviewScaleMode={props.handleChangePreviewScaleMode}
                        handleChangeSplitPreviewWidth={props.handleChangeSplitPreviewWidth}
                        handleChangeSplitPreviewHeight={props.handleChangeSplitPreviewHeight}
                        quickEditActive={props.quickEditActive}
                        onRunPrototypePanePromptAction={props.handleRunPrototypePanePromptAction}
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
                        sidebarTrees={props.sidebarTrees}
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
                        onCopyStartServerErrorPrompt={props.onCopyStartServerErrorPrompt}
                        startServerLoading={props.startServerLoading}
                        startServerError={props.startServerError}
                        collapsed={props.collapsed}
                        setCollapsed={props.setCollapsed}
                        selectedCanvas={props.selectedCanvas}
                        canvasItems={props.canvasItems}
                        excalidrawPropertyPanelMode={props.excalidrawPropertyPanelMode}
                        setExcalidrawPropertyPanelMode={props.setExcalidrawPropertyPanelMode}
                        excalidrawPropertyPanelPosition={props.excalidrawPropertyPanelPosition}
                        setExcalidrawPropertyPanelPosition={props.setExcalidrawPropertyPanelPosition}
                        bridgeConnected={props.bridgeConnected}
                        assistantVisible={props.assistantVisible}
                        onToggleAssistant={props.onToggleAssistant}
                        onAddToContext={props.onAddCanvasElementToContext}
                        onAddCanvasScreenshotToAI={props.onAddCanvasScreenshotToAI}
                        onAddCanvasImageToAI={props.onAddCanvasImageToAI}
                        onAnnotationsChange={props.onCanvasAnnotationsChange}
                        onOpenCanvasInIDE={props.onOpenCanvasInIDE}
                        onOpenCanvasAgent={props.onOpenCanvasAgent}
                        onSelectResourceFolder={props.onSelectResourceFolder}
                        onSelectResourceFolderItem={props.onSelectResourceFolderItem}
                        onOpenResourceFolderInSystem={props.onOpenResourceFolderInSystem}
                        preferredIDE={props.preferredIDE}
                        activeProjectId={props.activeProjectId}
                        ideAvailability={props.ideAvailability}
                        agentAvailability={props.agentAvailability}
                        webAgentPanelOpen={props.webAgentPanelOpen}
                        aiPanelMode={props.aiPanelMode}
                        onOpenProjectInIDE={props.handleOpenProjectInIDE}
                        onOpenAcpWebAgent={props.onOpenAcpWebAgent}
                        onOpenImageAiPanel={props.onOpenImageAiPanel}
                        onOpenWebAgentInPanel={props.onOpenWebAgentInPanel}
                        onExecutePrompt={props.onExecutePrompt}
                        onCloseAiPanel={props.onCloseAiPanel}
                        onCloseWebAgentPanel={props.onCloseWebAgentPanel}
                        onPreferredIDEChange={props.onPreferredIDEChange}
                        assistantApiBaseUrl={props.assistantApiBaseUrl}
                        assistantProjectPath={props.assistantProjectPath}
                        preferredPromptClient={props.preferredPromptClient}
                        prototypes={props.prototypes}
                        themes={props.themes}
                        defaultThemeName={props.defaultThemeName}
                        onOpenPrototypeCreateDialog={props.onOpenPrototypeCreateDialog}
                        onOpenAISettings={props.onOpenAISettings}
                        onCreatePrototypeForDraftStart={props.onCreatePrototypeForDraftStart}
                        onRefreshPrototypes={props.onRefreshPrototypes}
                        onSubmitCanvasAssistantPrompt={props.onSubmitCanvasAssistantPrompt}
                    />
                </div>
                {shouldShowAssistantPanel ? (
                    <UiReviewPanel
                        activeKind={props.activeReviewKind || 'design'}
                        markdown={props.reviewMarkdown || ''}
                        reviewPrompt={props.reviewPrompt || ''}
                        reviewDocumentPath={props.reviewDocumentPath}
                        updatedAt={props.reviewUpdatedAt}
                        loading={props.reviewLoading}
                        error={props.reviewError}
                        pageZoomEnabled={Boolean(props.reviewPageZoomEnabled)}
                        preferredPromptClient={props.preferredPromptClient}
                        preferredIDE={props.preferredIDE}
                        ideAvailability={props.ideAvailability}
                        assistantOpen={props.assistantVisible === true && props.aiPanelMode === 'general-ai'}
                        onExecutePrompt={props.onExecutePrompt}
                        onKindChange={(kind) => props.handleReviewKindChange?.(kind)}
                        onCopyPrompt={() => { void props.handleCopyReviewPrompt?.(); }}
                        onTogglePageZoom={() => props.handleToggleReviewPageZoom?.()}
                    />
                ) : null}
            </div>
        </div>
    );
}
