import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PresentationAreaGroupedProps } from '../../types/index-page.types';
import type { ViewMode } from '../../types';
import type { ExcalidrawPropertyPanelMode, ExcalidrawPropertyPanelPosition } from '../../utils/excalidrawUiMode';
import type { CanvasElementContextInfo } from '../../components/content/canvas-embeds/AnnotationOverlay';
import type { GenieProvider } from '@/common/genie/types';

interface UseIndexPagePresentationPropsBuilderParams {
        state: {
            collapsed: boolean;
            selectedItem: any;
            viewMode: ViewMode;
        activeTab: 'prototypes';
        assistantVisible: boolean;
        isDarkMode: boolean;
        contentMode: 'preview' | 'doc' | 'template' | 'canvas' | 'theme' | 'data';
        docsItems?: any[];
        selectedDoc: any;
        selectedResourceFolder?: any;
        selectedCanvas: any;
        selectedTemplate: any;
        selectedTheme: any;
        selectedDataTable: any;
        preferredPromptClient: any;
        preferredIDE: any;
        ideAvailability?: any;
        agentAvailability?: any;
        projectRuntimeStatus: any;
        projectRuntimeStatusLoading: boolean;
        projectAccessDeniedReason?: string;
        lanAccessAllowed?: boolean;
        hasPrototypeItems: boolean;
        hasDocItems: boolean;
        excalidrawPropertyPanelMode: ExcalidrawPropertyPanelMode;
        excalidrawPropertyPanelPosition: ExcalidrawPropertyPanelPosition;
        bridgeConnected?: boolean;
        activeProjectId?: string | null;
        webAgentPanelOpen?: boolean;
        assistantApiBaseUrl?: string;
        assistantProjectPath?: string;
        prototypes?: any[];
        themes?: any[];
        defaultThemeName?: string | null;
    };
    preview: any;
    ui?: {
        startServerLoading?: boolean;
        startServerError?: string;
    };
    actions: {
        setCollapsed: Dispatch<SetStateAction<boolean>>;
        setViewMode: Dispatch<SetStateAction<ViewMode>>;
        handleEnterSelectedPrototypePreview?: () => void;
        handleToggleAssistant: () => void;
        handleStartCurrentProjectServer?: () => void | Promise<void>;
        handleOpenIdeFile: () => void | Promise<void>;
        handleOpenSelectedDocInIDE: (itemOverride?: any, kindOverride?: 'doc' | 'template') => Promise<void>;
        handleOpenSelectedThemeInIDE: (item?: any) => Promise<void>;
        handleOpenSelectedThemeDocInIDE: (item?: any) => Promise<void>;
        handleOpenSelectedDataTableInIDE: (item?: any) => Promise<void>;
        handleCopyCurrentAddress: () => void | Promise<void>;
        onSelectResourceFolder?: (folder: any) => void;
        onSelectResourceFolderItem?: (item: any) => void;
        onOpenResourceFolderInSystem?: (folderPath: string) => void | Promise<void>;
        setExcalidrawPropertyPanelMode?: (mode: ExcalidrawPropertyPanelMode) => void;
        setExcalidrawPropertyPanelPosition?: (position: ExcalidrawPropertyPanelPosition) => void;
        onAddCanvasElementToContext?: (items: CanvasElementContextInfo[]) => void;
        onCanvasAnnotationsChange?: (annotations: CanvasElementContextInfo[]) => void;
        onOpenCanvasInIDE?: (canvasFilePath: string) => void | Promise<void>;
        onOpenCanvasGenie?: () => void | Promise<void>;
        handleOpenProjectInIDE?: (ideOverride?: any, targetPath?: string) => boolean | Promise<boolean>;
        onOpenGenieWebAgent?: (targetPath?: string, provider?: GenieProvider) => void | Promise<void>;
        onOpenWebAgentInPanel?: (url: string) => boolean | void | Promise<boolean | void>;
        onCloseWebAgentPanel?: () => void;
        onPreferredIDEChange?: (ide: any) => void;
        onRefreshAvailability?: () => void;
        onRefreshPrototypes?: () => Promise<any[]>;
    };
}

export function useIndexPagePresentationPropsBuilder({
    state,
    preview,
    ui,
    actions,
}: UseIndexPagePresentationPropsBuilderParams): PresentationAreaGroupedProps {
    return useMemo(() => ({
        state: {
            collapsed: state.collapsed,
            selectedItem: state.selectedItem,
            viewMode: state.viewMode,
            activeTab: state.activeTab,
            selectedDeviceId: preview.selectedDeviceId,
            previewConfig: preview.previewConfig,
            deviceSegmentOptions: preview.deviceSegmentOptions,
            qrCodeVisible: preview.qrCodeVisible,
            quickEditAvailable: preview.quickEditAvailable,
            quickEditActive: preview.editorStatus.mode === 'quickEdit',
            docEditState: preview.docEditState,
            markdownPromptCopying: preview.markdownPromptCopying,
            reviewPanelOpen: preview.reviewPanelOpen,
            activeReviewKind: preview.activeReviewKind,
            reviewMarkdown: preview.reviewMarkdown,
            reviewUpdatedAt: preview.reviewUpdatedAt,
            reviewLoading: preview.reviewLoading,
            reviewError: preview.reviewError,
            reviewPageZoomEnabled: preview.reviewPageZoomEnabled,
            quickEditRuntimeStatus: preview.quickEditRuntimeStatus,
            exportAvailability: preview.exportAvailability,
            editorMode: preview.editorStatus.mode,
            hostToolbarState: preview.hostToolbarState,
            allowLAN: state.lanAccessAllowed !== false,
            assistantVisible: state.assistantVisible,
            containerRef: preview.containerRef,
            previewIframeRef: preview.previewIframeRef,
            secondaryPreviewIframeRef: preview.secondaryPreviewIframeRef,
            handlePreviewIframeLoad: preview.handlePreviewIframeLoad,
            currentDevice: preview.currentDevice,
            displaySize: preview.displaySize,
            scale: preview.scale,
            elementIframeKey: preview.elementIframeKey,
            iframeUrl: preview.iframeUrl,
            primaryIframeUrl: preview.primaryIframeUrl,
            secondaryIframeUrl: preview.secondaryIframeUrl,
            localShareUrl: preview.localShareUrl,
            elementIframeSize: preview.elementIframeSize,
            contentMode: state.contentMode,
            docsItems: state.docsItems || [],
            selectedDoc: state.selectedDoc,
            selectedResourceFolder: state.selectedResourceFolder,
            selectedCanvas: state.selectedCanvas,
            selectedTemplate: state.selectedTemplate,
            isDarkMode: state.isDarkMode,
            selectedTheme: state.selectedTheme,
            selectedDataTable: state.selectedDataTable,
            preferredPromptClient: state.preferredPromptClient,
            preferredIDE: state.preferredIDE,
            ideAvailability: state.ideAvailability,
            agentAvailability: state.agentAvailability,
            projectRuntimeStatus: state.projectRuntimeStatus,
            projectRuntimeStatusLoading: state.projectRuntimeStatusLoading,
            projectAccessDeniedReason: state.projectAccessDeniedReason,
            hasPrototypeItems: state.hasPrototypeItems,
            hasDocItems: state.hasDocItems,
            excalidrawPropertyPanelMode: state.excalidrawPropertyPanelMode,
            excalidrawPropertyPanelPosition: state.excalidrawPropertyPanelPosition,
            startServerLoading: Boolean(ui?.startServerLoading),
            startServerError: ui?.startServerError || '',
            standalonePanelOpen: preview.standalonePanelOpen,
            bridgeConnected: state.bridgeConnected,
            activeProjectId: state.activeProjectId,
            webAgentPanelOpen: state.webAgentPanelOpen,
            assistantApiBaseUrl: state.assistantApiBaseUrl,
            assistantProjectPath: state.assistantProjectPath,
            prototypes: state.prototypes || [],
            themes: state.themes || [],
            defaultThemeName: state.defaultThemeName ?? null,
        },
        actions: {
            setCollapsed: actions.setCollapsed,
            setViewMode: actions.setViewMode,
            handleEnterSelectedPrototypePreview: actions.handleEnterSelectedPrototypePreview,
            setSelectedDeviceId: preview.setSelectedDeviceId,
            handleSelectPreviewSinglePreset: preview.handleSelectPreviewSinglePreset,
            handleSelectCustomPreview: preview.handleSelectCustomPreview,
            handleActivateSplitPreview: preview.handleActivateSplitPreview,
            handleChangeCustomPreviewWidth: preview.handleChangeCustomPreviewWidth,
            handleChangeCustomPreviewHeight: preview.handleChangeCustomPreviewHeight,
            handleChangeSplitPreviewWidth: preview.handleChangeSplitPreviewWidth,
            handleChangeSplitPreviewHeight: preview.handleChangeSplitPreviewHeight,
            handleChangePreviewScaleMode: preview.handleChangePreviewScaleMode,
            handleOpenWebEditor: preview.handleOpenWebEditor,
            handleEnableDocEdit: preview.handleEnableDocEdit,
            handleSaveDocEdit: preview.handleSaveDocEdit,
            handleExitDocEdit: preview.handleExitDocEdit,
            handleSwitchDocQuickEditMode: preview.handleSwitchDocQuickEditMode,
            handleCopyMarkdownPrompt: preview.handleCopyMarkdownPrompt,
            handleReviewPanelToggle: preview.handleReviewPanelToggle,
            handleReviewKindChange: preview.handleReviewKindChange,
            handleCopyReviewPrompt: preview.handleCopyReviewPrompt,
            handleToggleReviewPageZoom: preview.handleToggleReviewPageZoom,
            handleRunHostToolbarAction: preview.runHostToolbarAction,
            handleRunQuickEditSaveAction: preview.runQuickEditSaveAction,
            handleExitWebEditor: preview.handleExitWebEditor,
            handleRefreshElement: preview.handleRefreshElement,
            handleCopyLocalLink: preview.handleCopyLocalLink,
            handleCopyLANLink: preview.handleCopyLANLink,
            getLANUrl: preview.getLANUrl,
            setQrCodeVisible: preview.setQrCodeVisible,
            handleCopyToFigma: preview.handleCopyToFigma,
            handleExportMake: preview.handleExportMake,
            handleExportHtml: preview.handleExportHtml,
            handlePublishCloudTarget: preview.handlePublishCloudTarget,
            handleOpenCloudPublishSettings: preview.handleOpenCloudPublishSettings,
            latestCloudPublishUrl: preview.latestCloudPublishUrl,
            handleCopyLatestCloudPublishUrl: preview.handleCopyLatestCloudPublishUrl,
            setIsExportModalOpen: preview.setIsExportModalOpen,
            handleQuickCopyEditablePrototype: preview.handleQuickCopyEditablePrototype,
            handleQuickCopyRuntimeComponent: preview.handleQuickCopyRuntimeComponent,
            handleQuickDownloadRuntimeCover: preview.handleQuickDownloadRuntimeCover,
            handleOpenAxureUsageGuide: preview.handleOpenAxureUsageGuide,
            handleOpenIdeFile: actions.handleOpenIdeFile,
            handleOpenDocInIDE: actions.handleOpenSelectedDocInIDE,
            handleOpenThemeInIDE: actions.handleOpenSelectedThemeInIDE,
            handleOpenThemeDocInIDE: actions.handleOpenSelectedThemeDocInIDE,
            handleOpenDataTableInIDE: actions.handleOpenSelectedDataTableInIDE,
            handleCopyCurrentAddress: actions.handleCopyCurrentAddress,
            onSelectResourceFolder: actions.onSelectResourceFolder,
            onSelectResourceFolderItem: actions.onSelectResourceFolderItem,
            onOpenResourceFolderInSystem: actions.onOpenResourceFolderInSystem,
            onToggleAssistant: actions.handleToggleAssistant,
            onStartCurrentProjectServer: actions.handleStartCurrentProjectServer,
            setElementIframeSize: preview.setElementIframeSize,
            onStandalonePanelToggle: preview.handleStandalonePanelToggle,
            setExcalidrawPropertyPanelMode: actions.setExcalidrawPropertyPanelMode,
            setExcalidrawPropertyPanelPosition: actions.setExcalidrawPropertyPanelPosition,
            onAddCanvasElementToContext: actions.onAddCanvasElementToContext,
            onCanvasAnnotationsChange: actions.onCanvasAnnotationsChange,
            onOpenCanvasInIDE: actions.onOpenCanvasInIDE,
            onOpenCanvasGenie: actions.onOpenCanvasGenie,
            handleOpenProjectInIDE: actions.handleOpenProjectInIDE,
            onOpenGenieWebAgent: actions.onOpenGenieWebAgent,
            onOpenWebAgentInPanel: actions.onOpenWebAgentInPanel,
            onCloseWebAgentPanel: actions.onCloseWebAgentPanel,
            onPreferredIDEChange: actions.onPreferredIDEChange,
            onRefreshAvailability: actions.onRefreshAvailability,
            onRefreshPrototypes: actions.onRefreshPrototypes,
        },
    }), [actions, preview, state, ui]) satisfies PresentationAreaGroupedProps;
}
