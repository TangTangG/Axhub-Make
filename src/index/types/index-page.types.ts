import type { MutableRefObject, RefObject } from 'react';
import type { IDEAvailabilityMap, MainIDEPreference } from '../../common/ide';
import type { RuntimeAgentAvailability } from '../../common/agent';
import type { GenieProvider } from '@/common/genie/types';
import type { CloudPublishTarget, ReviewResult } from '../services/api';
import type {
    PreviewConfig,
    PreviewScaleMode,
    PreviewSinglePreset,
} from '../domains/device/preview-layout';
import type {
    AxureCopyOptions,
    CanvasItem,
    DataType,
    ImageConfig,
    ItemData,
    PromptClientPreference,
    SidebarTreeNode,
    SidebarTreeTab,
    TabType,
    ViewMode,
} from '../types';
import type {
    DataTableResourceItem,
    TemplateAssetOption,
    TemplateResourceItem,
    ThemeResourceItem,
} from '../domains/resources/resource.types';
import type {
    GenieEditorHostToolbarAction,
    GenieEditorHostToolbarState,
} from '../../common/web-editor-types';
import type { LocalExportCapabilities, ProjectListItem, ProjectRuntimeStatus, ResourceWriteCapabilities } from '../services/projectResources';
import type { ExcalidrawPropertyPanelMode, ExcalidrawPropertyPanelPosition } from '../utils/excalidrawUiMode';
import type { SpecQuickEditMode } from '../utils/specQuickEdit';
import type { ReviewKind } from '../utils/uiReviewPrompt';
import type { CanvasElementContextInfo } from '../components/content/canvas-embeds/AnnotationOverlay';

export type {
    DataTableResourceItem,
    TemplateAssetOption,
    TemplateResourceItem,
    ThemeResourceItem,
};

export type SidebarTab = 'prototype' | 'document' | 'canvas' | 'assets';
export type ResourceSection = 'themes' | 'data' | 'templates';
export type QuickEditRuntimeStatus = 'idle' | 'pending' | 'ready' | 'missing' | 'error';
export type QuickEditSaveAction = 'save-text' | 'save-style' | 'clear-style';

export interface SelectedResourceFolder {
    id: string;
    title: string;
    path: string;
    folderPath?: string;
    children?: SidebarTreeNode[];
}

export interface ExportAvailability {
    canOpenGenericFigmaExport: boolean;
    figmaDisabledReason: string;
    figmaDomDisabledReason: string;
    canOpenGenericAxureExport: boolean;
    axureDisabledReason: string;
    axureRuntimeDisabledReason: string;
    axureSourceDisabledReason: string;
    canUseRuntimeFeatures: boolean;
    canUseSourceFeatures: boolean;
    hasClientUrl: boolean;
    hasSourceContext: boolean;
    htmlExportDisabledReason: string;
    makeExportDisabledReason: string;
}

export interface CreateDialogState {
    visible: boolean;
    activeTab: TabType;
    initialTab?: CreateDialogTab;
    selectedThemes: string[];
    availableThemes: Array<{ name: string; displayName: string }>;
    selectedDocs: string[];
    availableDocs: Array<{ name: string; displayName: string }>;
    selectedDataAssets: string[];
    availableDataAssets: Array<{ name: string; displayName: string }>;
    resourceWriteCapabilities: ResourceWriteCapabilities;
    preferredPromptClient: PromptClientPreference;
    preferredIDE: MainIDEPreference;
    ideAvailability?: IDEAvailabilityMap;
}

export interface CreateDialogActions {
    onClose: () => void;
    setSelectedDocs: (values: string[]) => void;
    setSelectedThemes: (values: string[]) => void;
    setSelectedDataAssets: (values: string[]) => void;
    buildCreatePrompt: () => Promise<string>;
    onAfterCreatePromptAction: () => void;
    onUploadSuccess?: () => void | Promise<void>;
}

export type CreateDialogTab = 'ai' | 'create' | 'upload';

export interface ExportState {
    open: boolean;
    preferencesStorageKey: string;
    imageConfig: ImageConfig;
    axureCopyOptions: AxureCopyOptions;
    isExporting: boolean;
    activeTab: TabType;
    itemName?: string;
    sourceTargetPath?: string;
    preferredPromptClient: PromptClientPreference;
    preferredIDE: MainIDEPreference;
    ideAvailability?: IDEAvailabilityMap;
    initialReviewResult?: ReviewResult | null;
    exportAvailability: ExportAvailability;
}

export interface ExportActions {
    onClose: () => void;
    onInitialReviewHandled: () => void;
    setImageConfig: React.Dispatch<React.SetStateAction<ImageConfig>>;
    setAxureCopyOptions: React.Dispatch<React.SetStateAction<AxureCopyOptions>>;
    onDimensionChange: (field: 'width' | 'height', value: number | null) => void;
    onSwapDimensions: () => void;
    onDimensionBlur: () => void;
    onExport: () => void;
    onCopyRuntimeComponent: () => void;
    onCopyToAxure: (options: AxureCopyOptions) => Promise<void>;
    onCopyConfig: (exportType: string) => Promise<string>;
}

export interface NewSidebarState {
    collapsed: boolean;
    loading: boolean;
    sidebarTab: SidebarTab;
    viewMode: ViewMode;
    data: DataType;
    docsItems: ItemData[];
    canvasItems: CanvasItem[];
    themes: ThemeResourceItem[];
    searchText: string;
    selectedItem: ItemData | null;
    selectedPrototypePageId?: string | null;
    selectedDoc: ItemData | null;
    selectedResourceFolder?: SelectedResourceFolder | null;
    selectedCanvas: CanvasItem | null;
    selectedTheme: ThemeResourceItem | null;
    resourceSection: ResourceSection;
    projectTitle: string;
    activeProjectId: string | null;
    projectSetupRequired?: boolean;
    projects: ProjectListItem[];
    resourceWriteCapabilities: ResourceWriteCapabilities;
    localExportCapabilities: LocalExportCapabilities;
    lanAccessAllowed?: boolean;
    isDarkMode: boolean;
    sidebarTrees: Record<SidebarTreeTab, SidebarTreeNode[]>;
    webAgentPanelOpen?: boolean;
    defaultThemeName?: string | null;
}

export interface NewSidebarActions {
    handleTabChange: (tab: TabType) => void;
    onSidebarTabChange: (tab: SidebarTab) => void;
    onPrototypeViewSelect: (item: ItemData, mode: ViewMode) => void | Promise<void>;
    onPrototypePageSelect: (item: ItemData, pageId: string) => void | Promise<void>;
    setSearchText: (text: string) => void;
    onRenameTheme: (item: ThemeResourceItem, nextName?: string) => void | Promise<void>;
    onDeleteTheme: (item: ThemeResourceItem) => void | Promise<void>;
    onSetDefaultTheme?: (themeName: string) => void | Promise<void>;
    onResourceSectionChange: (section: ResourceSection) => void;
    onSelectDoc: (item: ItemData) => void;
    onSelectResourceFolder?: (folder: SidebarTreeNode) => void;
    onSelectCanvas: (item: CanvasItem) => void;
    onSelectTheme: (item: ThemeResourceItem) => void;
    handleMenuClick: (params: { key: string; pageId?: string | null }) => void;
    handleDownloadItemSource: (item: ItemData) => void;
    handleDownloadThemeZip: (item: ThemeResourceItem) => void;
    handleRenameItem: (item: ItemData, nextName: string) => void | Promise<void>;
    handleDuplicateItem: (item: ItemData) => void;
    handleDeleteItem: (item: ItemData) => void;
    handleCopyItemPath: (item: ItemData) => void;
    handleRenameDocItem: (item: ItemData, nextName: string) => void | Promise<void>;
    handleDuplicateDocItem: (item: ItemData) => void | Promise<void>;
    handleDeleteDocItem: (item: ItemData) => void | Promise<void>;
    handleCopyDocPath: (item: ItemData) => void | Promise<void>;
    handleDocVersionManagement: (item: ItemData) => void | Promise<void>;
    onCreatePrototypeFromDoc: (doc: ItemData) => void | Promise<void>;
    onOpenCreateDialog: (initialTab?: CreateDialogTab) => void;
    onImportTheme: () => void;
    onUploadedResourceFiles?: () => void;
    onCreateCanvasFile: () => void;
    onCreatePlaceholderPrototype: () => void;
    handleRenameCanvasItem: (item: ItemData, nextName: string) => void | Promise<void>;
    handleDuplicateCanvasItem: (item: ItemData) => void | Promise<void>;
    handleDeleteCanvasItem: (item: ItemData) => void | Promise<void>;
    handleCopyCanvasPath: (item: ItemData) => void | Promise<void>;
    onCreateFolder: (tab: SidebarTreeTab) => Promise<{ createdFolderId: string } | null>;
    onGenerateThemeFromPrototype?: (item: ItemData) => void;
    onSettingsClick: () => void;
    onToggleTheme: () => void;
    onTitleChange: (title: string) => void | Promise<void>;
    onProjectSwitch: (projectId: string) => void | Promise<void>;
    onProjectDelete: (projectId: string) => void | Promise<void>;
    onProjectStop: (projectId: string) => void | Promise<void>;
    onAddProject: (root: string) => boolean | void | Promise<boolean | void>;
    onCreateBlankMakeProject: (params: {
        parentRoot: string;
        folderName: string;
        projectName?: string;
    }) => Promise<unknown>;
    onRefreshProjects: () => void | Promise<void>;
    handleOpenProjectInIDE: (ideOverride?: MainIDEPreference, targetPath?: string) => boolean | Promise<boolean>;
    onOpenGenieWebAgent?: (targetPath?: string, provider?: GenieProvider) => void | Promise<void>;
    onOpenWebAgentInPanel?: (url: string) => boolean | void | Promise<boolean | void>;
    onCloseWebAgentPanel?: () => void;
    onSidebarTreeChange: (tab: SidebarTreeTab, tree: SidebarTreeNode[]) => void;
    onSidebarTreePersist: (tab: SidebarTreeTab, tree: SidebarTreeNode[]) => void | Promise<void>;
    handleVersionManagement: (item: ItemData) => void;
}

export interface NewSidebarPreferences {
    preferredIDE: MainIDEPreference;
    ideAvailability?: IDEAvailabilityMap;
    agentAvailability?: RuntimeAgentAvailability;
    onPreferredIDEChange?: (ide: MainIDEPreference) => void;
    onRefreshAvailability?: () => void;
}

export interface NewSidebarGroupedProps {
    state: NewSidebarState;
    actions: NewSidebarActions;
    preferences: NewSidebarPreferences;
}

export type NewSidebarLegacyProps = NewSidebarState & NewSidebarActions & NewSidebarPreferences;
export type NewSidebarProps = NewSidebarGroupedProps | NewSidebarLegacyProps;

export interface PresentationAreaState {
    collapsed: boolean;
    selectedItem: ItemData | null;
    viewMode: ViewMode;
    activeTab: TabType;
    selectedDeviceId: string;
    previewConfig: PreviewConfig;
    deviceSegmentOptions: Array<{ value: string; icon: React.ReactNode }>;
    qrCodeVisible: boolean;
    localShareUrl: string;
    quickEditAvailable: boolean;
    quickEditActive?: boolean;
    docEditState?: {
        enabled: boolean;
        dirty: boolean;
        saving: boolean;
        quickEditMode: SpecQuickEditMode;
    };
    markdownPromptCopying?: boolean;
    reviewPanelOpen?: boolean;
    activeReviewKind?: ReviewKind;
    reviewMarkdown?: string;
    reviewUpdatedAt?: string | null;
    reviewLoading?: boolean;
    reviewError?: string;
    reviewPageZoomEnabled?: boolean;
    quickEditRuntimeStatus?: QuickEditRuntimeStatus;
    exportAvailability?: ExportAvailability;
    editorMode?: 'none' | 'quickEdit';
    hostToolbarState?: GenieEditorHostToolbarState | null;
    allowLAN: boolean;
    projectAccessDeniedReason?: string;
    assistantVisible?: boolean;
    startServerLoading?: boolean;
    containerRef: RefObject<HTMLDivElement>;
    previewIframeRef: MutableRefObject<HTMLIFrameElement | null>;
    secondaryPreviewIframeRef: MutableRefObject<HTMLIFrameElement | null>;
    handlePreviewIframeLoad?: () => void;
    currentDevice: { id: string; [key: string]: any };
    displaySize: { width: number; height: number };
    scale: number;
    elementIframeKey: number;
    iframeUrl: string;
    primaryIframeUrl: string;
    secondaryIframeUrl: string;
    elementIframeSize: { width: number; height: number };
    contentMode?: 'preview' | 'doc' | 'template' | 'canvas' | 'theme' | 'data';
    docsItems?: ItemData[];
    selectedDoc?: ItemData | null;
    selectedResourceFolder?: SelectedResourceFolder | null;
    selectedCanvas?: CanvasItem | null;
    selectedTemplate?: ItemData | null;
    isDarkMode?: boolean;
    selectedTheme?: ThemeResourceItem | null;
    selectedDataTable?: DataTableResourceItem | null;
    projectRuntimeStatus?: ProjectRuntimeStatus | null;
    projectRuntimeStatusLoading?: boolean;
    hasPrototypeItems?: boolean;
    hasDocItems?: boolean;
    excalidrawPropertyPanelMode?: ExcalidrawPropertyPanelMode;
    excalidrawPropertyPanelPosition?: ExcalidrawPropertyPanelPosition;
    startServerError?: string;
    preferredPromptClient: PromptClientPreference;
    preferredIDE: MainIDEPreference;
    standalonePanelOpen?: boolean;
    bridgeConnected?: boolean;
    activeProjectId?: string | null;
    ideAvailability?: IDEAvailabilityMap;
    agentAvailability?: RuntimeAgentAvailability;
    webAgentPanelOpen?: boolean;
    assistantApiBaseUrl?: string;
    assistantProjectPath?: string;
    prototypes?: ItemData[];
    themes?: ThemeResourceItem[];
    defaultThemeName?: string | null;
    onRefreshPrototypes?: () => Promise<ItemData[]>;
}

export interface PresentationAreaActions {
    setCollapsed: (collapsed: boolean) => void;
    setViewMode: (mode: ViewMode) => void;
    handleEnterSelectedPrototypePreview?: () => void;
    setSelectedDeviceId: (id: string) => void;
    handleSelectPreviewSinglePreset: (preset: PreviewSinglePreset) => void;
    handleSelectCustomPreview: () => void;
    handleActivateSplitPreview: () => void;
    handleChangeCustomPreviewWidth: (width: number) => void;
    handleChangeCustomPreviewHeight: (height: number) => void;
    handleChangeSplitPreviewWidth: (pane: 'primary' | 'secondary', width: number) => void;
    handleChangeSplitPreviewHeight: (pane: 'primary' | 'secondary', height: number) => void;
    handleChangePreviewScaleMode: (mode: PreviewScaleMode) => void;
    handleOpenWebEditor: () => void;
    handleEnableDocEdit: () => void;
    handleSaveDocEdit: () => void;
    handleExitDocEdit: () => void;
    handleSwitchDocQuickEditMode: (mode: SpecQuickEditMode) => void;
    handleCopyMarkdownPrompt: () => void | Promise<void>;
    handleReviewPanelToggle?: () => void | Promise<void>;
    handleReviewKindChange?: (kind: ReviewKind) => void;
    handleCopyReviewPrompt?: () => void | Promise<void>;
    handleToggleReviewPageZoom?: () => void;
    handleRunHostToolbarAction?: (action: GenieEditorHostToolbarAction) => void | Promise<boolean>;
    handleRunQuickEditSaveAction?: (action: QuickEditSaveAction) => void | Promise<boolean>;
    handleExitWebEditor: () => void;
    handleRefreshElement: () => void;
    handleCopyLocalLink: () => void;
    handleCopyLANLink: () => void;
    getLANUrl: () => string;
    setQrCodeVisible: (visible: boolean) => void;
    handleCopyToFigma: () => void;
    handleExportMake: () => void;
    handleExportHtml: (options?: { includeSource?: boolean }) => void;
    handlePublishCloudTarget: (target: CloudPublishTarget) => void | Promise<void>;
    handleOpenCloudPublishSettings: (target?: CloudPublishTarget) => void;
    latestCloudPublishUrl: string;
    handleCopyLatestCloudPublishUrl: () => void | Promise<void>;
    setIsExportModalOpen: (open: boolean) => void;
    handleQuickCopyEditablePrototype: () => void;
    handleQuickCopyRuntimeComponent: () => void;
    handleQuickDownloadRuntimeCover: () => void;
    handleOpenAxureUsageGuide: () => void;
    handleOpenIdeFile: () => void | Promise<void>;
    handleOpenDocInIDE: () => void | Promise<void>;
    handleOpenThemeInIDE: () => void | Promise<void>;
    handleOpenThemeDocInIDE: () => void | Promise<void>;
    handleOpenDataTableInIDE: () => void | Promise<void>;
    handleCopyCurrentAddress: () => void | Promise<void>;
    onSelectResourceFolder?: (folder: SidebarTreeNode) => void;
    onSelectResourceFolderItem?: (item: ItemData) => void;
    onOpenResourceFolderInSystem?: (folderPath: string) => void | Promise<void>;
    onToggleAssistant?: () => void;
    onStartCurrentProjectServer?: () => void | Promise<void>;
    setElementIframeSize: (size: { width: number; height: number }) => void;
    onStandalonePanelToggle?: () => void;
    setExcalidrawPropertyPanelMode?: (mode: ExcalidrawPropertyPanelMode) => void;
    setExcalidrawPropertyPanelPosition?: (position: ExcalidrawPropertyPanelPosition) => void;
    onAddCanvasElementToContext?: (items: CanvasElementContextInfo[]) => void;
    onCanvasAnnotationsChange?: (annotations: CanvasElementContextInfo[]) => void;
    onOpenCanvasInIDE?: (canvasFilePath: string) => void | Promise<void>;
    onOpenCanvasGenie?: () => void | Promise<void>;
    handleOpenProjectInIDE?: (ideOverride?: MainIDEPreference, targetPath?: string) => boolean | Promise<boolean>;
    onOpenGenieWebAgent?: (targetPath?: string, provider?: GenieProvider) => void | Promise<void>;
    onOpenWebAgentInPanel?: (url: string) => boolean | void | Promise<boolean | void>;
    onCloseWebAgentPanel?: () => void;
    onPreferredIDEChange?: (ide: MainIDEPreference) => void;
    onRefreshAvailability?: () => void;
    onRefreshPrototypes?: () => Promise<ItemData[]>;
}

export interface PresentationAreaGroupedProps {
    state: PresentationAreaState;
    actions: PresentationAreaActions;
}

export type PresentationAreaLegacyProps = PresentationAreaState & PresentationAreaActions;
export type PresentationAreaProps = PresentationAreaGroupedProps | PresentationAreaLegacyProps;
