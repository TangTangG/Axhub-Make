import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { copyToClipboard } from '../../utils/clipboard';
import { buildEditorUrl, buildItemUrl, buildLANItemUrl } from '../../utils/url';
import { generateSvgContent, svgToPng } from '../../utils/svg';
import { apiService, type CloudPublishLatestItem, type CloudPublishTarget, type ExportIndexBundle, type ReviewResult } from '../../services/api';
import { downloadExportHtmlArchive } from '../../domains/export/export.api';
import { buildQuickEditGeniePrompt } from '../../utils/quickEditPrompts';
import { buildMarkdownFileMetaUrl, buildMarkdownFileUrl } from '../../utils/markdownPreview';
import { buildReviewPrompt, resolveReviewDocumentPath, type ReviewKind } from '../../utils/uiReviewPrompt';
import { resolveSpecQuickEditSwitchDecision, type SpecQuickEditMode } from '../../utils/specQuickEdit';
import { createExportReviewFailureResult } from '../../utils/exportReviewPrompt';
import {
    buildExportModalPreferencesStorageKey,
    mergeExportModalPreferences,
    readExportModalPreferences,
    type ExportModalTabKey,
} from '../../utils/exportModalPreferences';
import { getAssistantContextCurrentFilePath } from '../../utils/genieContext';
import type {
    GenieEditorHostToolbarAction,
    GenieEditorHostToolbarState,
} from '@/common/web-editor-types';
import { type ExportAvailability } from '../../types/index-page.types';
import {
    isWebEditorGenieRequestMessage,
} from '@/common/genie/bridge';
import {
    AXURE_BRIDGE_API_BASE_URL,
    AXURE_UNAVAILABLE_HINT,
    TITLE_EXPORT_DEFAULT_SIZE,
    buildAxureBridgeMessage,
    buildAxureBridgeUserMessage,
    createDefaultMarkdownQuickEditState,
    formatThrownError,
    getScreenshotExportDefaultSize,
    isMarkdownEditableResource,
    readJsonOrTextResponse,
} from '../index-page.helpers';
import {
    getPreviewExportDeviceId,
} from '../../domains/device/preview-layout';
import { hasExplicitLocalPath } from '../../utils/localPath';
import { resolveIndexContentMode } from './contentMode';
import { usePreviewDeviceActions } from './usePreviewDeviceActions';
import { usePreviewIframeActions } from './usePreviewIframeActions';
import { usePrototypeEditorBridgeActions } from './usePrototypeEditorBridgeActions';
import { usePreviewRuntimeActions } from './usePreviewRuntimeActions';
import {
    buildProjectPrototypeIframeUrl,
    buildRuntimeComponentAxvgPayload,
    createDefaultHostToolbarState,
    createEmbeddedIndexBundle,
    createRuntimeExportMessage,
    createRuntimeExportRequestId,
    DEFAULT_AXURE_COPY_OPTIONS,
    DEFAULT_EXPORT_IMAGE_CONFIG,
    getSelectedResourceTargetPath,
    getSelectedSourceBasePath,
    hasExplicitSourceContext,
    hasFigmaMakeExportContext,
    getClientUrlOrigin,
    isHostToolbarWakePendingState,
    isHostToolbarGenieAwake,
    isQuickEditRuntimeMessage,
    postProjectCommunicationRecord,
    readPreviewFrameEditorApi,
    resolveHostToolbarStateAfterClearEdits,
    resolveHostToolbarStateForDisplay,
    waitForHostToolbarActionState,
    type DocumentEditorApi,
    type HostToolbarEditorsApi,
    type PreviewPane,
    type QuickEditSaveAction,
} from './previewActions.helpers';

function buildPrototypeCanvasIframeUrl(selectedItem: any): string {
    if (!selectedItem?.name) {
        return '';
    }
    return `/canvas/prototypes/${encodeURIComponent(selectedItem.name)}/canvas.excalidraw`;
}

const CLOUD_PUBLISH_TARGET_LABELS: Record<CloudPublishTarget, string> = {
    vercel: 'Vercel',
    'cloudflare-pages': 'Cloudflare Pages',
    s3: 'S3',
    'github-pages': 'GitHub Pages',
};

type LatestCloudPublishItems = Partial<Record<CloudPublishTarget, CloudPublishLatestItem>>;

function hasHostToolbarDecisionData(state: GenieEditorHostToolbarState | null | undefined): boolean {
    return Boolean(
        state
        && (
            Number(state.modifiedCount ?? 0) > 0
            || Number(state.terminalTaskCount ?? 0) > 0
        ),
    );
}

const PROTOTYPE_PAGE_ID_RE = /^[a-z0-9-]+$/u;

function normalizePrototypePageId(value: unknown): string {
    const id = typeof value === 'string' ? value.trim() : '';
    return PROTOTYPE_PAGE_ID_RE.test(id) ? id : '';
}

function normalizePrototypeRoutePages(pages: unknown): { id: string; title: string }[] {
    if (!Array.isArray(pages)) {
        return [];
    }
    return pages
        .map((page) => {
            const id = normalizePrototypePageId(page?.id);
            const title = typeof page?.title === 'string' ? page.title.trim() : '';
            return id && title ? { id, title } : null;
        })
        .filter((page): page is { id: string; title: string } => Boolean(page));
}

function normalizePrototypeRouteInfo(payload: any) {
    const pages = normalizePrototypeRoutePages(payload?.pages);
    if (pages.length === 0) {
        return null;
    }
    const defaultPageId = normalizePrototypePageId(payload?.defaultPageId) || pages[0]?.id || '';
    const activePageId = normalizePrototypePageId(payload?.activePageId) || defaultPageId;
    if (!defaultPageId || !activePageId) {
        return null;
    }
    return {
        pages,
        defaultPageId,
        activePageId,
    };
}

export function useIndexPagePreviewActions(params: any) {
    const {
        activeTab,
        collapsed,
        setCollapsed,
        sidebarTab,
        resourceSection,
        setSidebarTab,
        setResourceSection,
        selectedItem,
        selectedPageId,
        onPrototypePageChange,
        onPrototypeRouteInfo,
        selectedDoc,
        setSelectedDoc,
        selectedTemplate,
        setSelectedTemplate,
        selectedTheme,
        projectCapabilities,
        messageApi,
        appDialog,
        viewMode,
        isDarkMode = false,
        setIsDarkMode,
        assistantContextV1,
        assistantProjectPath,
        assistantApiBaseUrl,
        assistantWebEditorClientId,
        probeAssistantRuntimeSilently,
        startAssistantRuntimeForWebEditor,
        handleWebEditorGenieRequest,
        clearAssistantSelectedElementsOnExit,
    } = params;

    const userSetDimensionsRef = useRef(false);
    const sidebarCollapsedBeforeWebEditorRef = useRef<boolean | null>(null);
    const standalonePanelBeforeQuickEditRef = useRef<boolean>(false);
    const decisionPanelAutoOpenSeqRef = useRef(0);
    const [standalonePanelOpen, setStandalonePanelOpen] = useState(false);
    const exportPreferencesLoadedKeyRef = useRef<string | null>(null);
    const exportPreferencesReadyRef = useRef(false);
    const skipExportContentTypeResetRef = useRef(false);
    const exportModalWasOpenRef = useRef(false);
    const markdownPromptCacheRef = useRef<{ key: string; result: any } | null>(null);
    const pendingDocSwitchRef = useRef<{ kind: 'doc' | 'template'; item: any } | null>(null);
    const lastQuickEditRuntimeDocumentUrlKeyRef = useRef<string>('');
    const quickEditRuntimeActiveRef = useRef(false);
    const documentEditorActiveRef = useRef(false);
    const documentHostToolbarUnsubscribeRef = useRef<(() => void) | null>(null);
    const prototypeHostToolbarUnsubscribeRef = useRef<(() => void) | null>(null);
    const isDarkModeRef = useRef(isDarkMode);
    const exitWebEditorRef = useRef<((options?: { restoreDevice?: boolean }) => Promise<void>) | null>(null);
    const [elementIframeSize, setElementIframeSize] = useState({ width: 600, height: 400 });
    const [elementIframeKey, setElementIframeKey] = useState(0);
    const [qrCodeVisible, setQrCodeVisible] = useState(false);
    const [pendingExportReviewResult, setPendingExportReviewResult] = useState<ReviewResult | null>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isFigmaMakeExportDialogOpen, setIsFigmaMakeExportDialogOpen] = useState(false);
    const [cloudPublishSettingsOpen, setCloudPublishSettingsOpen] = useState(false);
    const [cloudPublishSettingsInitialTarget, setCloudPublishSettingsInitialTarget] = useState<CloudPublishTarget>('s3');
    const [latestCloudPublishItems, setLatestCloudPublishItems] = useState<LatestCloudPublishItems>({});
    const [isExporting, setIsExporting] = useState(false);
    const [axureCopyOptions, setAxureCopyOptions] = useState(DEFAULT_AXURE_COPY_OPTIONS);
    const [imageConfig, setImageConfig] = useState(DEFAULT_EXPORT_IMAGE_CONFIG);
    const [editorStatus, setEditorStatus] = useState<{ mode: 'none' | 'quickEdit' }>({
        mode: 'none',
    });
    const [docEditState, setDocEditState] = useState(createDefaultMarkdownQuickEditState);
    const [markdownPromptCopying, setMarkdownPromptCopying] = useState(false);
    const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
    const [activeReviewKind, setActiveReviewKind] = useState<ReviewKind>('design');
    const [reviewMarkdown, setReviewMarkdown] = useState('');
    const [reviewUpdatedAt, setReviewUpdatedAt] = useState<string | null>(null);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewError, setReviewError] = useState('');
    const [reviewPageZoomEnabled, setReviewPageZoomEnabled] = useState(false);
    const [quickEditPromptCopying, setQuickEditPromptCopying] = useState(false);
    const [hostToolbarState, setHostToolbarState] = useState<GenieEditorHostToolbarState | null>(null);
    const hostToolbarStateRef = useRef(hostToolbarState);

    useEffect(() => {
        isDarkModeRef.current = isDarkMode;
    }, [isDarkMode]);
    useEffect(() => {
        hostToolbarStateRef.current = hostToolbarState;
    }, [hostToolbarState]);

    const previewDeviceActions = usePreviewDeviceActions();
    const previewConfig = previewDeviceActions.previewConfig;
    const selectedDeviceId = previewDeviceActions.selectedDeviceId;
    const setSelectedDeviceId = previewDeviceActions.setSelectedDeviceId;
    const deviceSegmentOptions = previewDeviceActions.deviceSegmentOptions;
    const handleSelectPreviewSinglePreset = previewDeviceActions.handleSelectPreviewSinglePreset;
    const handleSelectCustomPreview = previewDeviceActions.handleSelectCustomPreview;
    const handleActivateSplitPreview = previewDeviceActions.handleActivateSplitPreview;
    const handleChangeCustomPreviewWidth = previewDeviceActions.handleChangeCustomPreviewWidth;
    const handleChangeCustomPreviewHeight = previewDeviceActions.handleChangeCustomPreviewHeight;
    const handleChangeSplitPreviewWidth = previewDeviceActions.handleChangeSplitPreviewWidth;
    const handleChangeSplitPreviewHeight = previewDeviceActions.handleChangeSplitPreviewHeight;
    const handleChangePreviewScaleMode = previewDeviceActions.handleChangePreviewScaleMode;
    const currentDevice = previewDeviceActions.currentDevice;
    const displaySize = previewDeviceActions.displaySize;
    const previewIframeActions = usePreviewIframeActions({
        previewMode: previewConfig.previewMode,
        messageApi,
    });
    const containerRef = previewIframeActions.containerRef;
    const previewIframeRef = previewIframeActions.previewIframeRef;
    const secondaryPreviewIframeRef = previewIframeActions.secondaryPreviewIframeRef;
    const getPrimaryPreviewIframe = previewIframeActions.getPrimaryPreviewIframe;
    const getSecondaryPreviewIframe = previewIframeActions.getSecondaryPreviewIframe;
    const getPreviewIframe = previewIframeActions.getPreviewIframe;
    const getPreviewIframes = previewIframeActions.getPreviewIframes;
    const getIframeOrigin = previewIframeActions.getIframeOrigin;
    const postToPreview = previewIframeActions.postToPreview;
    const previewRuntimeActions = usePreviewRuntimeActions({
        postToPreview,
        selectedItem,
        viewMode,
    });
    const quickEditRuntimeStatus = previewRuntimeActions.quickEditRuntimeStatus;
    const setQuickEditRuntimeStatus = previewRuntimeActions.setQuickEditRuntimeStatus;
    const clearQuickEditRuntimeTimeout = previewRuntimeActions.clearQuickEditRuntimeTimeout;
    const beginQuickEditRuntimeHandshake = previewRuntimeActions.beginQuickEditRuntimeHandshake;
    const forwardQuickEditPatch = previewRuntimeActions.forwardQuickEditPatch;
    const reportQuickEditRuntimeError = previewRuntimeActions.reportQuickEditRuntimeError;
    const exitQuickEditRuntime = previewRuntimeActions.exitQuickEditRuntime;
    const saveQuickEditRuntime = previewRuntimeActions.saveQuickEditRuntime;
    const contentMode = resolveIndexContentMode({
        sidebarTab,
        resourceSection,
        viewMode,
    });
    const isDocumentEditingContent = contentMode === 'doc' || contentMode === 'template';
    const currentMarkdownResource = useMemo(() => {
        if (contentMode === 'doc') {
            return { item: selectedDoc, kind: 'doc' as const };
        }
        if (contentMode === 'template') {
            return { item: selectedTemplate, kind: 'template' as const };
        }
        return { item: null, kind: 'doc' as const };
    }, [contentMode, selectedDoc, selectedTemplate]);
    const currentMarkdownItem = currentMarkdownResource.item;
    const currentMarkdownLabel = currentMarkdownResource.kind === 'template' ? '模板' : '文档';
    const selectedEditablePreviewResource = contentMode === 'theme' ? selectedTheme : selectedItem;
    const resourceType: 'prototype' | 'theme' = contentMode === 'theme' ? 'theme' : 'prototype';
    const reviewDocumentPath = useMemo(
        () => resolveReviewDocumentPath(selectedItem, activeReviewKind),
        [activeReviewKind, selectedItem],
    );
    const reviewPrompt = useMemo(
        () => buildReviewPrompt({
            selectedItem,
            reviewDocumentPath,
            kind: activeReviewKind,
        }),
        [activeReviewKind, reviewDocumentPath, selectedItem],
    );
    const activePromptResource = useMemo(() => {
        if (contentMode === 'doc' && selectedDoc) {
            return { kind: 'doc' as const, label: '文档', cacheKey: `doc:${selectedDoc.name}` };
        }
        if (contentMode === 'template' && selectedTemplate) {
            return { kind: 'template' as const, label: '模板', cacheKey: `template:${selectedTemplate.name}` };
        }
        return null;
    }, [contentMode, selectedDoc, selectedTemplate]);
    const scale = 1;
    const screenshotDefaultSize = useMemo(
        () => getScreenshotExportDefaultSize(activeTab, getPreviewExportDeviceId(previewConfig)),
        [activeTab, previewConfig],
    );
    const exportPreferencesStorageKey = useMemo(
        () => buildExportModalPreferencesStorageKey(assistantProjectPath),
        [assistantProjectPath],
    );
    const prototypeEditorLaunchOptions = useMemo(() => {
        const apiBaseUrl = String(assistantApiBaseUrl || '').trim();
        const projectPath = String(assistantProjectPath || '').trim();
        const integrationChannel = projectPath || 'axhub';
        const editorClientId = String(assistantWebEditorClientId || '').trim();

        return {
            hostToolbar: true,
            genieBridge: {
                apiBaseUrl,
                integrationChannel,
                projectPath,
                targetClientId: '',
            },
            integrationWs: {
                enabled: Boolean(apiBaseUrl && integrationChannel && editorClientId),
                apiBaseUrl,
                channel: integrationChannel,
                clientId: editorClientId,
            },
        };
    }, [
        assistantApiBaseUrl,
        assistantProjectPath,
        assistantWebEditorClientId,
    ]);
    const buildPaneIframeUrl = useCallback((pane: PreviewPane) => {
        if (contentMode === 'doc') {
            return selectedDoc?.previewUrl || selectedDoc?.specUrl || '';
        }
        if (contentMode === 'template') {
            return selectedTemplate?.previewUrl || selectedTemplate?.specUrl || '';
        }
        if (contentMode === 'theme') {
            return selectedTheme?.clientUrl || selectedTheme?.previewUrl || '';
        }
        const baseUrl = viewMode === 'canvas'
            ? buildPrototypeCanvasIframeUrl(selectedItem)
            : viewMode === 'demo'
                ? buildProjectPrototypeIframeUrl(selectedItem, prototypeEditorLaunchOptions, selectedPageId)
                : buildEditorUrl(selectedItem, viewMode, prototypeEditorLaunchOptions);
        if (previewConfig.previewMode !== 'split' || !baseUrl) {
            return baseUrl;
        }
        if (viewMode !== 'demo') {
            return baseUrl;
        }
        try {
            const url = new URL(baseUrl, window.location.origin);
            url.searchParams.set('axhubPane', pane);
            url.searchParams.set('axhubQuickEditContext', '1');
            return url.toString();
        } catch {
            return baseUrl;
        }
    }, [
        previewConfig.previewMode,
        contentMode,
        selectedDoc,
        selectedItem,
        selectedPageId,
        selectedTemplate,
        selectedTheme,
        prototypeEditorLaunchOptions,
        viewMode,
    ]);
    const primaryIframeUrl = useMemo(() => buildPaneIframeUrl('primary'), [buildPaneIframeUrl]);
    const secondaryIframeUrl = useMemo(
        () => (previewConfig.previewMode === 'split' ? buildPaneIframeUrl('secondary') : primaryIframeUrl),
        [buildPaneIframeUrl, previewConfig.previewMode, primaryIframeUrl],
    );
    const iframeUrlMode = previewConfig.previewMode;
    const iframeUrl = primaryIframeUrl;
    const getDocumentEditorApi = useCallback((): DocumentEditorApi | null => {
        const iframe = getPrimaryPreviewIframe();
        const api = readPreviewFrameEditorApi<DocumentEditorApi>(iframe, 'SpecTemplateBootstrap');
        return api;
    }, [getPrimaryPreviewIframe]);
    const prototypeEditorBridgeActions = usePrototypeEditorBridgeActions({
        getPrimaryPreviewIframe,
        getSecondaryPreviewIframe,
        getPreviewIframes,
        getIframeOrigin,
        selectedEditablePreviewResource,
        resourceType,
        assistantApiBaseUrl,
        assistantProjectPath,
        assistantWebEditorClientId,
        isDarkMode,
        isDarkModeRef,
        messageApi,
        prototypeHostToolbarUnsubscribeRef,
        setHostToolbarState,
    });
    const getPrototypeEditorApi = prototypeEditorBridgeActions.getPrototypeEditorApi;
    const enterPrototypeEditor = prototypeEditorBridgeActions.enterPrototypeEditor;
    const enterPrototypeEditorPanelOnly = prototypeEditorBridgeActions.enterPrototypeEditorPanelOnly;
    const exitPrototypeEditorPanelOnly = prototypeEditorBridgeActions.exitPrototypeEditorPanelOnly;
    const postPrototypeEditorDisable = prototypeEditorBridgeActions.postPrototypeEditorDisable;
    const postPrototypeEditorHostToolbarAction = prototypeEditorBridgeActions.postPrototypeEditorHostToolbarAction;
    const postPrototypeEditorSaveAction = prototypeEditorBridgeActions.postPrototypeEditorSaveAction;
    const queryPrototypeEditorState = prototypeEditorBridgeActions.queryPrototypeEditorState;

    const getRuntimeDocumentUrlKey = useCallback((rawUrl: string) => {
        if (!rawUrl) return '';
        try {
            const url = new URL(rawUrl, window.location.origin);
            url.hash = '';
            return url.toString();
        } catch {
            return rawUrl.replace(/#.*$/u, '');
        }
    }, []);

    const maybeAutoOpenStandaloneDecisionPanel = useCallback(async (iframe: HTMLIFrameElement | null, sequence: number) => {
        if (!iframe?.contentWindow) {
            return;
        }
        if (sequence !== decisionPanelAutoOpenSeqRef.current) {
            return;
        }
        if (resourceType !== 'prototype' || viewMode !== 'demo') {
            return;
        }
        if (quickEditRuntimeActiveRef.current || documentEditorActiveRef.current || standalonePanelOpen) {
            return;
        }

        let nextState = getPrototypeEditorApi(iframe)?.getHostToolbarState?.() ?? null;
        let decisionDataCount = getPrototypeEditorApi(iframe)?.getDecisionDataCount?.() ?? 0;
        if (!hasHostToolbarDecisionData(nextState) && decisionDataCount <= 0) {
            const bridgeState = await queryPrototypeEditorState(iframe);
            nextState = bridgeState?.hostToolbarState ?? nextState;
            decisionDataCount = bridgeState?.decisionDataCount ?? decisionDataCount;
        }
        if (sequence !== decisionPanelAutoOpenSeqRef.current || iframe !== getPrimaryPreviewIframe()) {
            return;
        }
        if (!hasHostToolbarDecisionData(nextState) && decisionDataCount <= 0) {
            return;
        }

        const opened = await enterPrototypeEditorPanelOnly(iframe);
        if (sequence !== decisionPanelAutoOpenSeqRef.current || iframe !== getPrimaryPreviewIframe()) {
            return;
        }
        setStandalonePanelOpen(opened);
    }, [
        enterPrototypeEditorPanelOnly,
        getPrimaryPreviewIframe,
        getPrototypeEditorApi,
        queryPrototypeEditorState,
        resourceType,
        standalonePanelOpen,
        viewMode,
    ]);

    const handlePreviewIframeLoad = useCallback(() => {
        const currentDocumentUrlKey = getRuntimeDocumentUrlKey(primaryIframeUrl);
        const primaryIframe = getPrimaryPreviewIframe();
        const decisionPanelAutoOpenSeq = decisionPanelAutoOpenSeqRef.current + 1;
        decisionPanelAutoOpenSeqRef.current = decisionPanelAutoOpenSeq;
        void maybeAutoOpenStandaloneDecisionPanel(primaryIframe, decisionPanelAutoOpenSeq);
        if (quickEditRuntimeStatus === 'ready' && lastQuickEditRuntimeDocumentUrlKeyRef.current === currentDocumentUrlKey) {
            // Hash-routed prototype subpages keep the same iframe document.
            // The runtime script is already connected, so avoid flipping the
            // toolbar back to a pending/missing state while preserving editor
            // re-entry below.
        } else {
            lastQuickEditRuntimeDocumentUrlKeyRef.current = currentDocumentUrlKey;
            beginQuickEditRuntimeHandshake(primaryIframe);
        }
        if (documentEditorActiveRef.current) {
            const editorApi = getDocumentEditorApi();
            if (editorApi?.enableDocumentEditor) {
                void Promise.resolve(editorApi.enableDocumentEditor({ toolbarMode: 'host', initialDarkMode: isDarkMode })).then(() => {
                    const nextState = editorApi.getHostToolbarState?.() ?? null;
                    setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, nextState, isDarkMode));
                    documentHostToolbarUnsubscribeRef.current?.();
                    documentHostToolbarUnsubscribeRef.current = editorApi.subscribeHostToolbarState?.((nextToolbarState) => {
                        setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(
                            previousState,
                            nextToolbarState,
                            isDarkModeRef.current,
                        ));
                    }) ?? null;
                });
            }
        }
        if (quickEditRuntimeActiveRef.current) {
            void enterPrototypeEditor(primaryIframe, { showMissingWarning: false });
            if (previewConfig.previewMode === 'split') {
                const secondaryIframe = getSecondaryPreviewIframe();
                if (secondaryIframe?.contentWindow) {
                    void enterPrototypeEditor(secondaryIframe, { showMissingWarning: false });
                }
            }
        }
    }, [
        beginQuickEditRuntimeHandshake,
        enterPrototypeEditor,
        getDocumentEditorApi,
        getRuntimeDocumentUrlKey,
        getPrimaryPreviewIframe,
        getSecondaryPreviewIframe,
        isDarkMode,
        maybeAutoOpenStandaloneDecisionPanel,
        primaryIframeUrl,
        previewConfig.previewMode,
        quickEditRuntimeStatus,
    ]);

    useEffect(() => {
        const handleQuickEditRuntimeMessage = (event: MessageEvent) => {
            if (!isQuickEditRuntimeMessage(event.data)) {
                return;
            }
            const previewIframe = getPrimaryPreviewIframe();
            if (!previewIframe || event.source !== previewIframe.contentWindow) {
                return;
            }
            if (selectedItem?.clientUrl) {
                try {
                    const expectedOrigin = getClientUrlOrigin(selectedItem.clientUrl);
                    if (!expectedOrigin) {
                        setQuickEditRuntimeStatus('error');
                        void postProjectCommunicationRecord(selectedItem, 'sessions', {
                            status: 'error',
                            errorMessage: 'invalid clientUrl origin',
                        }).catch(() => undefined);
                        return;
                    }
                    if (event.origin !== expectedOrigin) {
                        setQuickEditRuntimeStatus('error');
                        void postProjectCommunicationRecord(selectedItem, 'sessions', {
                            status: 'error',
                            clientUrlOrigin: event.origin,
                            errorMessage: 'runtimeReady origin mismatch',
                        }).catch(() => undefined);
                        return;
                    }
                } catch {
                    setQuickEditRuntimeStatus('error');
                    void postProjectCommunicationRecord(selectedItem, 'sessions', {
                        status: 'error',
                        errorMessage: 'invalid clientUrl origin',
                    }).catch(() => undefined);
                    return;
                }
            }
            if (event.data?.type === 'axhub.quickEdit.runtimeReady') {
                clearQuickEditRuntimeTimeout();
                setQuickEditRuntimeStatus('ready');
                void postProjectCommunicationRecord(selectedItem, 'sessions', {
                    status: 'ready',
                    clientUrlOrigin: event.origin,
                    runtimeVersion: event.data.runtimeVersion,
                }).catch(() => undefined);
                return;
            }
            if (event.data?.type === 'axhub.quickEdit.patch') {
                setHostToolbarState((previous) => ({
                    ...(previous ?? createDefaultHostToolbarState()),
                    clearEditsDisabled: false,
                    modifiedCount: Math.max(1, previous?.modifiedCount ?? 0),
                }));
                forwardQuickEditPatch(event.data.patch, previewIframe);
                void postProjectCommunicationRecord(selectedItem, 'runtime-message', {
                    messageType: event.data.type,
                    status: 'success',
                }).catch(() => undefined);
                return;
            }
            if (event.data?.type === 'axhub.quickEdit.save') {
                setHostToolbarState((previous) => ({
                    ...(previous ?? createDefaultHostToolbarState()),
                    clearEditsDisabled: true,
                    modifiedCount: 0,
                }));
                messageApi.success('Quick Edit 更改已提交');
                void postProjectCommunicationRecord(selectedItem, 'edit-history', {
                    operationType: 'quickEdit.save',
                    status: 'success',
                }).catch(() => undefined);
                return;
            }
            if (event.data?.type === 'axhub.quickEdit.error') {
                setQuickEditRuntimeStatus('error');
                messageApi.error(event.data.message || event.data.error || 'Quick Edit runtime 执行失败');
                reportQuickEditRuntimeError(event.data.message || event.data.error || 'Quick Edit runtime 执行失败', previewIframe);
                void postProjectCommunicationRecord(selectedItem, 'runtime-message', {
                    messageType: event.data.type,
                    status: 'error',
                    errorMessage: event.data.message || event.data.error || 'Quick Edit runtime 执行失败',
                }).catch(() => undefined);
            }
        };

        window.addEventListener('message', handleQuickEditRuntimeMessage);
        return () => window.removeEventListener('message', handleQuickEditRuntimeMessage);
    }, [clearQuickEditRuntimeTimeout, forwardQuickEditPatch, getPrimaryPreviewIframe, messageApi, reportQuickEditRuntimeError, selectedItem]);

    const refreshEditorStatus = useCallback(() => {
        setEditorStatus({
            mode: quickEditRuntimeActiveRef.current || documentEditorActiveRef.current ? 'quickEdit' : 'none',
        });
    }, []);

    const runQuickEditHostToolbarAction = useCallback(async (action: GenieEditorHostToolbarAction) => {
        const editors: HostToolbarEditorsApi = {
            getHostToolbarState: () => hostToolbarStateRef.current ?? createDefaultHostToolbarState(),
            subscribeHostToolbarState: (listener) => {
                listener(hostToolbarStateRef.current ?? createDefaultHostToolbarState());
                return () => undefined;
            },
            runHostToolbarAction: async (nextAction) => {
                if (nextAction.type === 'wake-genie') {
                    const runtime = await startAssistantRuntimeForWebEditor?.();
                    if (runtime.health?.status !== 'ready') {
                        return false;
                    }
                    const nextState = {
                        ...(hostToolbarStateRef.current ?? createDefaultHostToolbarState()),
                        robotState: 'awake' as const,
                        robotLoading: false,
                        sendDisabled: false,
                    };
                    hostToolbarStateRef.current = resolveHostToolbarStateForDisplay(hostToolbarStateRef.current, nextState, isDarkMode);
                    setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, nextState, isDarkMode));
                    return true;
                }
                if (nextAction.type === 'disconnect-genie') {
                    const nextState = {
                        ...(hostToolbarStateRef.current ?? createDefaultHostToolbarState()),
                        robotState: 'sleeping' as const,
                        sendDisabled: true,
                        interruptDisabled: true,
                    };
                    hostToolbarStateRef.current = resolveHostToolbarStateForDisplay(hostToolbarStateRef.current, nextState, isDarkMode);
                    setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, nextState, isDarkMode));
                    return true;
                }
                if (nextAction.type === 'clear-edits') {
                    const handled = await saveQuickEditRuntime();
                    if (handled) {
                        const clearedState = resolveHostToolbarStateAfterClearEdits(
                            hostToolbarStateRef.current,
                            hostToolbarStateRef.current ?? hostToolbarState ?? createDefaultHostToolbarState(),
                            isDarkMode,
                        );
                        hostToolbarStateRef.current = clearedState;
                        setHostToolbarState(clearedState);
                    }
                    return handled;
                }
                if (nextAction.type === 'toggle-property-panel') {
                    const nextState = {
                        ...(hostToolbarStateRef.current ?? createDefaultHostToolbarState()),
                        propertyPanelOpen: nextAction.open ?? !(hostToolbarStateRef.current?.propertyPanelOpen ?? false),
                    };
                    hostToolbarStateRef.current = resolveHostToolbarStateForDisplay(hostToolbarStateRef.current, nextState, isDarkMode);
                    setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, nextState, isDarkMode));
                    return true;
                }
                if (nextAction.type === 'toggle-dark-mode') {
                    const nextDarkMode = typeof nextAction.darkMode === 'boolean'
                        ? nextAction.darkMode
                        : !isDarkMode;
                    setIsDarkMode?.(nextDarkMode);
                    const nextState = {
                        ...(hostToolbarStateRef.current ?? createDefaultHostToolbarState()),
                        darkMode: nextDarkMode,
                    };
                    hostToolbarStateRef.current = resolveHostToolbarStateForDisplay(hostToolbarStateRef.current, nextState, nextDarkMode);
                    setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, nextState, nextDarkMode));
                    return true;
                }
                if (nextAction.type === 'toggle-page-animations') {
                    const nextState = {
                        ...(hostToolbarStateRef.current ?? createDefaultHostToolbarState()),
                        disablePageAnimations: !(hostToolbarStateRef.current?.disablePageAnimations ?? false),
                    };
                    hostToolbarStateRef.current = resolveHostToolbarStateForDisplay(hostToolbarStateRef.current, nextState, isDarkMode);
                    setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, nextState, isDarkMode));
                    return true;
                }
                if (nextAction.type === 'full-exit') {
                    if (!exitWebEditorRef.current) {
                        return false;
                    }
                    await exitWebEditorRef.current();
                    return true;
                }
                if (
                    nextAction.type === 'copy-prompt'
                    || nextAction.type === 'send-to-genie'
                    || nextAction.type === 'interrupt-genie'
                    || nextAction.type === 'set-genie-agent'
                    || nextAction.type === 'copy-skill-install-prompt'
                    || nextAction.type === 'open-keyboard-shortcuts'
                ) {
                    messageApi.info('Quick Edit runtime 已接收宿主工具栏操作');
                    return true;
                }
                return false;
            },
        };
        const previousState = editors.getHostToolbarState?.() ?? hostToolbarState;
        const hideLoading = action.type === 'wake-genie'
            ? messageApi.loading('正在连接本地 AI...', 0)
            : null;
        try {
            if (action.type === 'wake-genie') {
                const wakingState = {
                    ...(hostToolbarStateRef.current ?? createDefaultHostToolbarState()),
                    robotState: 'waking' as const,
                    robotLoading: true,
                };
                hostToolbarStateRef.current = wakingState;
                setHostToolbarState((previous) => ({
                    ...(previous ?? createDefaultHostToolbarState()),
                    robotState: 'waking',
                    robotLoading: true,
                }));
            }
            const handled = await editors.runHostToolbarAction?.(action);
            const nextState = await waitForHostToolbarActionState(editors, action, previousState);
            hostToolbarStateRef.current = resolveHostToolbarStateForDisplay(hostToolbarStateRef.current, nextState, isDarkMode);
            setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, nextState, isDarkMode));
            if (action.type === 'wake-genie') {
                if (nextState.robotState === 'awake' || nextState.robotState === 'working') {
                    messageApi.success('本地 AI 已连接');
                } else {
                    messageApi.warning('本地 AI 暂未连接，请确认本地服务已启动');
                }
            }
            return Boolean(handled);
        } finally {
            hideLoading?.();
        }
    }, [hostToolbarState, isDarkMode, messageApi, saveQuickEditRuntime, setIsDarkMode, startAssistantRuntimeForWebEditor]);

    const runHostToolbarAction = useCallback(async (action: GenieEditorHostToolbarAction) => {
        const requestedAction = action.type === 'toggle-dark-mode'
            ? { ...action, darkMode: typeof action.darkMode === 'boolean' ? action.darkMode : !isDarkMode }
            : action;
        const copyHostToolbarPromptText = async (promptText: string | null | undefined) => {
            if (!promptText) {
                messageApi.info('没有可复制的提示词内容');
                return true;
            }
            try {
                await navigator.clipboard.writeText(promptText);
                messageApi.success('已复制到剪贴板');
            } catch {
                messageApi.warning('自动复制失败，请手动复制');
            }
            return true;
        };
        const runResolvedHostToolbarAction = async (nextAction: GenieEditorHostToolbarAction) => {
            if (documentEditorActiveRef.current) {
                const editorApi = getDocumentEditorApi();
                const previousState = editorApi?.getHostToolbarState?.() ?? hostToolbarStateRef.current;
                const hideLoading = nextAction.type === 'wake-genie'
                    ? messageApi.loading('正在连接本地 AI...', 0)
                    : null;
                try {
                    if (nextAction.type === 'copy-prompt') {
                        const promptText = editorApi?.getCopyPromptText?.();
                        if (typeof promptText === 'string') {
                            return copyHostToolbarPromptText(promptText);
                        }
                    }
                    const handled = await editorApi?.runHostToolbarAction?.(nextAction);
                    const nextState = editorApi?.getHostToolbarState?.() ?? previousState ?? null;
                    if (nextAction.type === 'toggle-dark-mode') {
                        setIsDarkMode?.(nextAction.darkMode);
                    }
                    const resolvedState = resolveHostToolbarStateForDisplay(hostToolbarStateRef.current, nextState, isDarkMode);
                    if (nextAction.type === 'clear-edits') {
                        const clearedState = resolveHostToolbarStateAfterClearEdits(hostToolbarStateRef.current, resolvedState, isDarkMode);
                        hostToolbarStateRef.current = clearedState;
                        setHostToolbarState(clearedState);
                    } else {
                        hostToolbarStateRef.current = resolvedState;
                        setHostToolbarState(resolvedState);
                    }
                    if (nextAction.type === 'wake-genie') {
                        if (isHostToolbarGenieAwake(nextState)) {
                            messageApi.success('本地 AI 已连接');
                        } else if (!handled) {
                            messageApi.warning('本地 AI 暂未连接，请确认本地服务已启动');
                        }
                    }
                    return Boolean(handled);
                } finally {
                    hideLoading?.();
                }
            }
            if (quickEditRuntimeActiveRef.current) {
                const editors = getPrototypeEditorApi();
                const previousState = editors?.getHostToolbarState?.() ?? hostToolbarStateRef.current;
                const hideLoading = nextAction.type === 'wake-genie'
                    ? messageApi.loading('正在连接本地 AI...', 0)
                    : null;
                try {
                    if (nextAction.type === 'copy-prompt') {
                        const promptText = editors?.getCopyPromptText?.();
                        if (typeof promptText === 'string') {
                            return copyHostToolbarPromptText(promptText);
                        }
                        const primaryIframe = getPrimaryPreviewIframe();
                        if (primaryIframe?.contentWindow) {
                            const bridgeResult = await postPrototypeEditorHostToolbarAction(primaryIframe, {
                                ...nextAction,
                                clipboard: 'host',
                            });
                            return copyHostToolbarPromptText(bridgeResult?.promptText);
                        }
                    }

                    let handled = await editors?.runHostToolbarAction?.(nextAction);
                    let nextState = await waitForHostToolbarActionState(editors ?? {}, nextAction, previousState);
                    if (!editors?.runHostToolbarAction) {
                        const primaryIframe = getPrimaryPreviewIframe();
                        if (primaryIframe?.contentWindow) {
                            const bridgeResult = await postPrototypeEditorHostToolbarAction(primaryIframe, nextAction);
                            handled = bridgeResult?.handled ?? bridgeResult?.success ?? false;
                            nextState = bridgeResult?.hostToolbarState ?? nextState;
                        }
                    }
                    if (nextAction.type === 'toggle-dark-mode') {
                        setIsDarkMode?.(nextAction.darkMode);
                    }
                    const resolvedState = resolveHostToolbarStateForDisplay(hostToolbarStateRef.current, nextState, isDarkMode);
                    if (nextAction.type === 'clear-edits') {
                        const clearedState = resolveHostToolbarStateAfterClearEdits(hostToolbarStateRef.current, resolvedState, isDarkMode);
                        hostToolbarStateRef.current = clearedState;
                        setHostToolbarState(clearedState);
                    } else {
                        hostToolbarStateRef.current = resolvedState;
                        setHostToolbarState(resolvedState);
                    }
                    if (nextAction.type === 'wake-genie') {
                        if (isHostToolbarGenieAwake(nextState)) {
                            messageApi.success('本地 AI 已连接');
                        } else if (!handled) {
                            messageApi.warning('本地 AI 暂未连接，请确认本地服务已启动');
                        }
                    }
                    return Boolean(handled);
                } finally {
                    hideLoading?.();
                }
            }
            return runQuickEditHostToolbarAction(nextAction);
        };
        if (requestedAction.type === 'send-to-genie' && !isHostToolbarGenieAwake(hostToolbarStateRef.current)) {
            const wakeHandled = await runResolvedHostToolbarAction({ type: 'wake-genie' });
            if (!wakeHandled || !isHostToolbarGenieAwake(hostToolbarStateRef.current)) {
                return false;
            }
        }
        return runResolvedHostToolbarAction(requestedAction);
    }, [
        getDocumentEditorApi,
        getPrimaryPreviewIframe,
        getPrototypeEditorApi,
        isDarkMode,
        messageApi,
        postPrototypeEditorHostToolbarAction,
        runQuickEditHostToolbarAction,
        setIsDarkMode,
    ]);

    const runQuickEditSaveAction = useCallback(async (action: QuickEditSaveAction) => {
        if (!quickEditRuntimeActiveRef.current) {
            return false;
        }

        const runAgainstIframe = async (iframe: HTMLIFrameElement) => {
            const editors = getPrototypeEditorApi(iframe);
            if (editors) {
                if (action === 'save-text') {
                    if (editors.saveWebEditorTextChanges) {
                        await Promise.resolve(editors.saveWebEditorTextChanges());
                        return true;
                    }
                } else if (action === 'save-style') {
                    if (editors.saveWebEditorStyleChanges) {
                        await Promise.resolve(editors.saveWebEditorStyleChanges());
                        return true;
                    }
                } else if (editors.clearWebEditorForcedStyles) {
                    await Promise.resolve(editors.clearWebEditorForcedStyles());
                    return true;
                }
            }

            if (!iframe.contentWindow) {
                return false;
            }
            const bridgeResult = await postPrototypeEditorSaveAction(iframe, action);
            return Boolean(bridgeResult?.handled ?? bridgeResult?.success);
        };

        try {
            const results = await Promise.all(getPreviewIframes().map(runAgainstIframe));
            const handled = results.some(Boolean);
            if (!handled) {
                messageApi.warning('当前客户端页面尚未接入快速编辑保存能力，请确认预览页已加载 DevTemplateBootstrap');
            }
            return handled;
        } catch (error) {
            console.error('[Axhub] 快速编辑保存操作失败:', error);
            messageApi.error('快速编辑保存操作失败');
            return false;
        }
    }, [
        getPreviewIframes,
        getPrototypeEditorApi,
        messageApi,
        postPrototypeEditorSaveAction,
    ]);

    useEffect(() => {
        if (!documentEditorActiveRef.current && !quickEditRuntimeActiveRef.current) {
            setHostToolbarState((previousState) => (
                previousState
                    ? { ...previousState, darkMode: isDarkMode }
                    : previousState
            ));
            return;
        }

        setHostToolbarState((previousState) => (
            previousState
                ? { ...previousState, darkMode: isDarkMode }
                : previousState
        ));

        if (documentEditorActiveRef.current) {
            const editorApi = getDocumentEditorApi();
            void editorApi?.runHostToolbarAction?.({ type: 'toggle-dark-mode', darkMode: isDarkMode });
            return;
        }

        if (quickEditRuntimeActiveRef.current) {
            const applyPrototypeTheme = async (iframe: HTMLIFrameElement) => {
                const editors = getPrototypeEditorApi(iframe);
                if (editors?.runHostToolbarAction) {
                    await Promise.resolve(editors.runHostToolbarAction({ type: 'toggle-dark-mode', darkMode: isDarkMode }));
                    return;
                }
                await postPrototypeEditorHostToolbarAction(iframe, { type: 'toggle-dark-mode', darkMode: isDarkMode });
            };

            void Promise.all(getPreviewIframes().map(applyPrototypeTheme));
        }
    }, [
        getDocumentEditorApi,
        getPreviewIframes,
        getPrototypeEditorApi,
        isDarkMode,
        postPrototypeEditorHostToolbarAction,
    ]);

    useEffect(() => {
        decisionPanelAutoOpenSeqRef.current += 1;
        documentHostToolbarUnsubscribeRef.current?.();
        documentHostToolbarUnsubscribeRef.current = null;
        prototypeHostToolbarUnsubscribeRef.current?.();
        prototypeHostToolbarUnsubscribeRef.current = null;
        documentEditorActiveRef.current = false;
        quickEditRuntimeActiveRef.current = false;
        pendingDocSwitchRef.current = null;
        markdownPromptCacheRef.current = null;
        setDocEditState(createDefaultMarkdownQuickEditState());
        setStandalonePanelOpen(false);
        exitPrototypeEditorPanelOnly();
        setHostToolbarState(null);
        refreshEditorStatus();
    }, [
        exitPrototypeEditorPanelOnly,
        primaryIframeUrl,
        refreshEditorStatus,
        resourceType,
        selectedEditablePreviewResource,
    ]);

    const quickEditAvailable = Boolean(selectedEditablePreviewResource)
        && (viewMode === 'demo' || resourceType === 'theme')
        && projectCapabilities?.quickEdit !== false
        && (quickEditRuntimeStatus === 'ready' || resourceType === 'theme');
    const exportAvailability = useMemo<ExportAvailability>(() => {
        const hasClientUrl = Boolean(selectedItem?.clientUrl);
        const hasSourceContext = hasExplicitSourceContext(selectedItem);
        const hasMakeExportContext = hasFigmaMakeExportContext(selectedItem);
        const figmaEnabled = projectCapabilities?.figmaExport !== false;
        const axureEnabled = projectCapabilities?.axureExport !== false;
        const canOpenGenericFigmaExport = Boolean(selectedItem) && figmaEnabled;
        const canOpenGenericAxureExport = Boolean(selectedItem) && axureEnabled;
        const canUseRuntimeFeatures = viewMode === 'demo' && Boolean(selectedItem?.clientUrl) && quickEditRuntimeStatus === 'ready';
        const canUseSourceFeatures = viewMode === 'demo' && hasSourceContext && axureEnabled;
        const localHtmlExportEnabled = projectCapabilities?.localExports?.html === true;
        const localMakeExportEnabled = projectCapabilities?.localExports?.make === true;
        const figmaDisabledReason = !selectedItem
            ? '请先选择一个原型页面'
            : !figmaEnabled
                ? '当前项目未启用 Figma 导出能力'
                : '';
        const axureDisabledReason = !selectedItem
            ? '请先选择一个原型页面'
            : !axureEnabled
                ? '当前项目未启用 Axure 导出能力'
                : '';
        const runtimeMissingReason = !hasClientUrl
            ? '当前原型缺少 clientUrl'
            : viewMode !== 'demo'
                ? '当前视图不支持原型 runtime 操作'
                : quickEditRuntimeStatus !== 'ready'
                ? '复制当前页面需要接入 /runtime/quick-edit.js'
                : '';
        const sourceMissingReason = hasSourceContext
            ? ''
            : '源码或 artifact metadata 缺失';
        const makeExportContextMissingReason = hasMakeExportContext
            ? ''
            : '源码或 Figma Make artifact metadata 缺失';
        const localExportSourceMissingReason = hasExplicitLocalPath(selectedItem)
            ? ''
            : '当前资源未声明本地文件路径';
        const htmlExportDisabledReason = !selectedItem
            ? '请先选择一个原型页面'
            : !localHtmlExportEnabled
                ? '当前项目未启用 HTML 本地导出能力'
                : localExportSourceMissingReason;
        const makeExportDisabledReason = !selectedItem
            ? '请先选择一个原型页面'
            : !figmaEnabled
                ? '当前项目未启用 Figma 导出能力'
                : makeExportContextMissingReason;

        return {
            canOpenGenericFigmaExport,
            figmaDisabledReason,
            figmaDomDisabledReason: figmaDisabledReason || runtimeMissingReason,
            canOpenGenericAxureExport,
            axureDisabledReason,
            axureRuntimeDisabledReason: axureDisabledReason || runtimeMissingReason,
            axureSourceDisabledReason: axureDisabledReason || sourceMissingReason,
            canUseRuntimeFeatures,
            canUseSourceFeatures,
            hasClientUrl,
            hasSourceContext,
            htmlExportDisabledReason,
            makeExportDisabledReason,
        };
    }, [
        projectCapabilities?.axureExport,
        projectCapabilities?.figmaExport,
        projectCapabilities?.localExports?.html,
        projectCapabilities?.localExports?.make,
        quickEditRuntimeStatus,
        selectedItem,
        viewMode,
    ]);
    const quickEditPromptAvailable = Boolean(
        selectedItem
        && viewMode === 'demo'
        && getAssistantContextCurrentFilePath(assistantContextV1),
    );

    const localShareUrl = useMemo(() => {
        const url = buildItemUrl(selectedItem, viewMode);
        return url ? url.toString() : '';
    }, [selectedItem, viewMode]);

    const getLANUrl = useCallback(() => {
        return buildLANItemUrl(selectedItem, viewMode);
    }, [selectedItem, viewMode]);

    const handleCopyLocalLink = useCallback(() => {
        if (!localShareUrl) {
            messageApi.error('当前没有可复制的链接');
            return;
        }
        void navigator.clipboard.writeText(localShareUrl).then(() => {
            toast.success('本地链接已复制');
            setQrCodeVisible(false);
        }).catch(() => {
            messageApi.error('复制失败');
        });
    }, [localShareUrl, messageApi]);

    const handleCopyLANLink = useCallback(() => {
        void navigator.clipboard.writeText(getLANUrl()).then(() => {
            toast.success('局域网链接已复制');
            setQrCodeVisible(false);
        }).catch(() => {
            messageApi.error('复制失败');
        });
    }, [getLANUrl, messageApi]);

    const handleRefreshElement = useCallback(() => {
        decisionPanelAutoOpenSeqRef.current += 1;
        exitPrototypeEditorPanelOnly();
        setStandalonePanelOpen(false);
        setElementIframeKey((previous) => previous + 1);
    }, [exitPrototypeEditorPanelOnly]);

    const notifyPreviewMessage = useCallback((level: unknown, content: unknown) => {
        const normalizedContent = typeof content === 'string' ? content.trim() : '';
        if (!normalizedContent) return;
        const messageLevel = typeof level === 'string' ? level : 'info';
        const notify = (messageApi as any)[messageLevel] || messageApi.info;
        notify(normalizedContent);
    }, [messageApi]);

    const resetDocEditState = useCallback(() => {
        pendingDocSwitchRef.current = null;
        setDocEditState(createDefaultMarkdownQuickEditState());
    }, []);

    const switchMarkdownSelection = useCallback((kind: 'doc' | 'template', item: any) => {
        markdownPromptCacheRef.current = null;
        if (kind === 'doc') {
            setSidebarTab('document');
            setSelectedDoc(item);
            return;
        }
        setSidebarTab('assets');
        setResourceSection('templates');
        setSelectedTemplate(item);
    }, [setResourceSection, setSelectedDoc, setSelectedTemplate, setSidebarTab]);

    const handleSelectMarkdownResource = useCallback((kind: 'doc' | 'template', item: any) => {
        if (!docEditState.enabled || !currentMarkdownItem || currentMarkdownItem.name === item.name) {
            switchMarkdownSelection(kind, item);
            return;
        }

        const switchWithoutSave = () => {
            resetDocEditState();
            switchMarkdownSelection(kind, item);
        };

        if (!docEditState.dirty) {
            postToPreview({ type: 'SPEC_EDIT_EXIT' });
            switchWithoutSave();
            return;
        }

        void (async () => {
            const confirmed = await appDialog.confirm({
                title: `切换${kind === 'template' ? '模板' : '文档'}`,
                description: `当前${currentMarkdownLabel}有未保存更改，是否先保存再切换？`,
                confirmText: '保存并切换',
                cancelText: '不保存切换',
                tone: 'brand',
                dismissible: false,
            });
            if (confirmed) {
                pendingDocSwitchRef.current = { item, kind };
                if (postToPreview({ type: 'SPEC_EDIT_SAVE', exitAfterSave: true })) {
                    setDocEditState((previous) => ({ ...previous, saving: true }));
                } else {
                    pendingDocSwitchRef.current = null;
                }
                return;
            }
            postToPreview({ type: 'SPEC_EDIT_EXIT', discardChanges: true });
            switchWithoutSave();
        })();
    }, [
        appDialog,
        currentMarkdownItem,
        currentMarkdownLabel,
        docEditState.dirty,
        docEditState.enabled,
        postToPreview,
        resetDocEditState,
        switchMarkdownSelection,
    ]);

    const handleSelectDoc = useCallback((item: any) => {
        handleSelectMarkdownResource('doc', item);
    }, [handleSelectMarkdownResource]);

    const handleSelectTemplate = useCallback((item: any) => {
        handleSelectMarkdownResource('template', item);
    }, [handleSelectMarkdownResource]);

    const requestMarkdownEditPrompt = useCallback((options?: { saveBeforePrompt?: boolean }) => {
        return new Promise<any>((resolve, reject) => {
            const promptResource = activePromptResource;
            if (!promptResource) {
                reject(new Error(
                    sidebarTab === 'assets' && resourceSection === 'templates'
                        ? '请先选择一个模板'
                        : sidebarTab === 'document'
                            ? '请先选择一个文档'
                            : '请先选择一个文档或模板',
                ));
                return;
            }

            if (!docEditState.enabled) {
                reject(new Error(`请先开启${promptResource.label}编辑`));
                return;
            }

            if (docEditState.quickEditMode !== 'comment') {
                reject(new Error('请先切换到批注模式'));
                return;
            }

            const cacheKey = promptResource.cacheKey;
            const cache = markdownPromptCacheRef.current;
            if (!docEditState.dirty && cache && cache.key === cacheKey) {
                resolve(cache.result);
                return;
            }

            const requestId = `markdown-prompt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            let removePromptResponseListener: (() => void) | null = null;
            const timeoutId = window.setTimeout(() => {
                removePromptResponseListener?.();
                reject(new Error('生成 Prompt 超时，请重试'));
            }, 10000);

            const posted = postToPreview({
                type: 'SPEC_EDIT_PROMPT_REQUEST',
                requestId,
                saveBeforePrompt: Boolean(options?.saveBeforePrompt),
            });

            if (!posted) {
                window.clearTimeout(timeoutId);
                reject(new Error('未找到可操作的预览窗口'));
                return;
            }

            const handlePromptResponse = (event: MessageEvent) => {
                if (event.data?.type !== 'SPEC_EDIT_PROMPT_RESPONSE') return;
                if (event.data.requestId !== requestId) return;
                window.clearTimeout(timeoutId);
                removePromptResponseListener?.();
                if (event.data.success) {
                    const result = {
                        prompt: event.data.prompt,
                        targetPath: event.data.targetPath,
                        context: event.data.context,
                    };
                    markdownPromptCacheRef.current = { key: cacheKey, result };
                    resolve(result);
                    return;
                }
                reject(new Error(event.data.error || '生成 Prompt 失败'));
            };
            removePromptResponseListener = () => {
                window.removeEventListener('message', handlePromptResponse);
                removePromptResponseListener = null;
            };
            window.addEventListener('message', handlePromptResponse);
        });
    }, [
        activePromptResource,
        docEditState.dirty,
        docEditState.enabled,
        docEditState.quickEditMode,
        postToPreview,
        resourceSection,
        sidebarTab,
    ]);

    const requestAxureJson = useCallback((options: any) => {
        return new Promise<any>((resolve, reject) => {
            const targetIframe = getPreviewIframe();
            if (!targetIframe || !targetIframe.contentWindow) {
                reject(new Error('未找到可导出的预览窗口'));
                return;
            }
            if (!selectedItem) {
                reject(new Error('请先选择一个条目'));
                return;
            }
            const requestId = createRuntimeExportRequestId('axure-json');
            const targetOrigin = getIframeOrigin(targetIframe);
            const timeout = window.setTimeout(() => {
                window.removeEventListener('message', handleMessage);
                reject(new Error('导出超时，请重试'));
            }, 15000);
            const handleMessage = (event: MessageEvent) => {
                if (event.source !== targetIframe.contentWindow) return;
                if (event.origin !== targetOrigin) return;
                if (!event.data || event.data.type !== 'axhub.quickEdit.export.axureJsonResult') return;
                if (event.data.requestId !== requestId) return;
                window.removeEventListener('message', handleMessage);
                window.clearTimeout(timeout);
                if (event.data.success) {
                    resolve(event.data.payload ?? event.data.json ?? event.data.data);
                    return;
                }
                reject(new Error(event.data.error || '导出失败'));
            };
            window.addEventListener('message', handleMessage);
            targetIframe.contentWindow.postMessage(createRuntimeExportMessage({
                type: 'axhub.quickEdit.export.axureJson',
                selectedItem,
                requestId,
                payload: {
                    rootName: selectedItem?.displayName || selectedItem?.name,
                    preserveHierarchy: options.preserveHierarchy,
                    preserveSvgIcons: options.preserveSvgIcons,
                },
            }), targetOrigin);
        });
    }, [getIframeOrigin, getPreviewIframe, selectedItem]);

    const requestCopyToFigma = useCallback(() => {
        return new Promise<{ payloadSizeKb?: number }>((resolve, reject) => {
            const targetIframe = getPreviewIframe();
            if (!targetIframe || !targetIframe.contentWindow) {
                reject(new Error('未找到可导出的预览窗口'));
                return;
            }
            if (!selectedItem) {
                reject(new Error('请先选择一个条目'));
                return;
            }
            const requestId = createRuntimeExportRequestId('copy-figma');
            const targetOrigin = getIframeOrigin(targetIframe);
            const timeout = window.setTimeout(() => {
                window.removeEventListener('message', handleMessage);
                reject(new Error('复制到 Figma 超时，请重试'));
            }, 15000);
            const handleMessage = (event: MessageEvent) => {
                if (event.source !== targetIframe.contentWindow) return;
                if (event.origin !== targetOrigin) return;
                if (!event.data || event.data.type !== 'axhub.quickEdit.export.copyToFigmaResult') return;
                if (event.data.requestId !== requestId) return;
                window.removeEventListener('message', handleMessage);
                window.clearTimeout(timeout);
                if (event.data.success) {
                    resolve({
                        payloadSizeKb: typeof event.data.payloadSizeKb === 'number' ? event.data.payloadSizeKb : undefined,
                    });
                    return;
                }
                reject(new Error(event.data.error || '复制到 Figma 失败'));
            };
            window.addEventListener('message', handleMessage);
            targetIframe.focus();
            targetIframe.contentWindow?.focus?.();
            targetIframe.contentWindow.postMessage(createRuntimeExportMessage({
                type: 'axhub.quickEdit.export.copyToFigma',
                selectedItem,
                requestId,
            }), targetOrigin);
        });
    }, [getIframeOrigin, getPreviewIframe, selectedItem]);

    const checkAxureAvailable = useCallback(async (): Promise<boolean> => {
        let response: Response;
        try {
            response = await fetch(`${AXURE_BRIDGE_API_BASE_URL}/available`, {
                method: 'GET',
                cache: 'no-store',
            });
        } catch (error: any) {
            throw new Error(`无法连接到 Axure Bridge（localhost:32767）：${formatThrownError(error)}`);
        }
        const { body, text } = await readJsonOrTextResponse(response);
        if (!response.ok) {
            throw new Error(buildAxureBridgeMessage(`Axure Bridge 不可用（HTTP ${response.status}）`, body, text));
        }
        if (typeof body === 'boolean') return body;
        if (body && typeof body === 'object') {
            if (body.available === false || body.running === false || body.success === false) {
                throw new Error(buildAxureBridgeMessage('Axure Bridge 报告当前不可用', body, text));
            }
            if (typeof body.available === 'boolean') return body.available;
            if (typeof body.running === 'boolean') return body.running;
            if (typeof body.success === 'boolean') return body.success;
        }
        return true;
    }, []);

    const postCopyAxvg = useCallback(async (payload: any) => {
        let response: Response;
        try {
            response = await fetch(`${AXURE_BRIDGE_API_BASE_URL}/copyaxvg`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (error: any) {
            throw new Error(`请求 Axure Bridge 失败：${formatThrownError(error)}`);
        }
        const { body, text } = await readJsonOrTextResponse(response);
        if (!response.ok) {
            throw new Error(`复制到 Axure 失败：${buildAxureBridgeMessage(
                response.statusText || `HTTP ${response.status}`,
                body,
                text,
            )}`);
        }
        if (body && typeof body === 'object' && (body.success === false || body.available === false)) {
            throw new Error(`复制到 Axure 失败：${buildAxureBridgeMessage('服务返回失败', body, text)}`);
        }
    }, []);

    const handleRequestScreenshot = useCallback((width?: number, height?: number) => {
        if (exportAvailability.axureRuntimeDisabledReason) {
            notifyPreviewMessage('warning', exportAvailability.axureRuntimeDisabledReason);
            return;
        }
        if (!selectedItem) {
            return;
        }
        const payload: any = {};
        const explicitWidth = typeof width === 'number' && Number.isFinite(width);
        const explicitHeight = typeof height === 'number' && Number.isFinite(height);
        const shouldForceBothDimensions = userSetDimensionsRef.current || explicitWidth || explicitHeight;
        if (shouldForceBothDimensions) {
            payload.targetWidth = width ?? imageConfig.width;
            payload.targetHeight = height ?? imageConfig.height;
        } else {
            payload.targetWidth = imageConfig.width;
        }
        const targetIframe = getPreviewIframe();
        if (targetIframe && targetIframe.contentWindow) {
            const requestId = createRuntimeExportRequestId('capture-screenshot');
            targetIframe.contentWindow.postMessage(createRuntimeExportMessage({
                type: 'axhub.quickEdit.export.captureScreenshot',
                selectedItem,
                requestId,
                payload,
            }), getIframeOrigin(targetIframe));
        }
    }, [
        exportAvailability.axureRuntimeDisabledReason,
        getIframeOrigin,
        getPreviewIframe,
        imageConfig.height,
        imageConfig.width,
        notifyPreviewMessage,
        selectedItem,
    ]);

    const handleDimensionChange = useCallback((field: 'width' | 'height', value: number | null) => {
        userSetDimensionsRef.current = true;
        setImageConfig((previous) => ({ ...previous, [field]: value || 0 }));
    }, []);

    const handleDimensionBlur = useCallback(() => {
        if (imageConfig.contentType === 'screenshot' && isExportModalOpen) {
            handleRequestScreenshot();
        }
    }, [handleRequestScreenshot, imageConfig.contentType, isExportModalOpen]);

    const handleSwapDimensions = useCallback(() => {
        userSetDimensionsRef.current = true;
        setImageConfig((previous) => ({
            ...previous,
            width: previous.height,
            height: previous.width,
        }));
        setTimeout(() => {
            if (imageConfig.contentType === 'screenshot' && isExportModalOpen) {
                handleRequestScreenshot(imageConfig.height, imageConfig.width);
            }
        }, 0);
    }, [handleRequestScreenshot, imageConfig.contentType, imageConfig.height, imageConfig.width, isExportModalOpen]);

    const enterDocumentEditor = useCallback(async () => {
        const editorApi = getDocumentEditorApi();
        if (!editorApi?.enableDocumentEditor) {
            messageApi.warning('当前文档预览尚未就绪，请稍后再试');
            return;
        }
        try {
            await probeAssistantRuntimeSilently?.();
            await Promise.resolve(editorApi.enableDocumentEditor({ toolbarMode: 'host', initialDarkMode: isDarkMode }));
            documentEditorActiveRef.current = true;
            quickEditRuntimeActiveRef.current = false;
            documentHostToolbarUnsubscribeRef.current?.();
            documentHostToolbarUnsubscribeRef.current = editorApi.subscribeHostToolbarState?.((nextState) => {
                setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(
                    previousState,
                    nextState,
                    isDarkModeRef.current,
                ));
            }) ?? null;
            setHostToolbarState(resolveHostToolbarStateForDisplay(null, editorApi.getHostToolbarState?.() ?? createDefaultHostToolbarState(), isDarkMode));
            setEditorStatus({ mode: 'quickEdit' });
            refreshEditorStatus();
            if (sidebarCollapsedBeforeWebEditorRef.current === null) {
                sidebarCollapsedBeforeWebEditorRef.current = collapsed;
            }
            setCollapsed(true);
        } catch (error) {
            console.error('[Axhub] 启动文档编辑器失败:', error);
            messageApi.error('启动文档编辑器失败');
        }
    }, [
        collapsed,
        getDocumentEditorApi,
        isDarkMode,
        messageApi,
        probeAssistantRuntimeSilently,
        refreshEditorStatus,
        setCollapsed,
    ]);

    const handleEnableDocEdit = useCallback(() => {
        if (!currentMarkdownItem) {
            messageApi.warning(`请先选择${currentMarkdownLabel}`);
            return;
        }
        if (!isMarkdownEditableResource(currentMarkdownItem)) {
            messageApi.warning(`仅支持 Markdown ${currentMarkdownLabel}在线编辑`);
            return;
        }
        if (postToPreview({ type: 'SPEC_EDIT_ENABLE' })) {
            markdownPromptCacheRef.current = null;
            setDocEditState((previous) => ({ ...previous, enabled: true, quickEditMode: 'comment' }));
            void enterDocumentEditor();
        }
    }, [currentMarkdownItem, currentMarkdownLabel, enterDocumentEditor, messageApi, postToPreview]);

    const handleSaveDocEdit = useCallback(() => {
        if (!currentMarkdownItem) {
            messageApi.warning(`请先选择${currentMarkdownLabel}`);
            return;
        }
        if (!docEditState.enabled) {
            messageApi.warning(`请先开启${currentMarkdownLabel}编辑`);
            return;
        }
        if (!docEditState.dirty) {
            messageApi.info(`当前${currentMarkdownLabel}没有需要保存的更改`);
            return;
        }
        if (docEditState.saving) {
            return;
        }
        if (postToPreview({ type: 'SPEC_EDIT_SAVE' })) {
            setDocEditState((previous) => ({ ...previous, saving: true }));
        }
    }, [
        currentMarkdownItem,
        currentMarkdownLabel,
        docEditState.dirty,
        docEditState.enabled,
        docEditState.saving,
        messageApi,
        postToPreview,
    ]);

    const handleSwitchDocQuickEditMode = useCallback((mode: SpecQuickEditMode) => {
        const decision = resolveSpecQuickEditSwitchDecision({
            enabled: docEditState.enabled,
            currentMode: docEditState.quickEditMode,
            nextMode: mode,
            dirty: docEditState.dirty,
        });
        if (decision.type === 'noop') return;
        markdownPromptCacheRef.current = null;
        if (decision.type === 'switch') {
            postToPreview({ type: 'SPEC_EDIT_SET_MODE', mode: decision.mode });
            setDocEditState((previous) => ({ ...previous, quickEditMode: decision.mode }));
            return;
        }
        void (async () => {
            const confirmed = await appDialog.confirm({
                title: '切换到批注模式',
                description: `检测到未保存的${currentMarkdownLabel}更改，是否先保存后再切换到批注模式？`,
                confirmText: '保存并切换',
                cancelText: '不保存切换',
                tone: 'brand',
                dismissible: false,
            });
            if (confirmed) {
                postToPreview({ type: 'SPEC_EDIT_SET_MODE', mode: 'comment', saveBehavior: 'save' });
                setDocEditState((previous) => ({ ...previous, saving: true }));
                return;
            }
            postToPreview({ type: 'SPEC_EDIT_SET_MODE', mode: 'comment', saveBehavior: 'discard' });
            setDocEditState((previous) => ({ ...previous, quickEditMode: 'comment' }));
        })();
    }, [
        appDialog,
        currentMarkdownLabel,
        docEditState.dirty,
        docEditState.enabled,
        docEditState.quickEditMode,
        postToPreview,
    ]);

    const handleExitDocEdit = useCallback(() => {
        if (!docEditState.enabled || docEditState.saving) {
            return;
        }
        if (docEditState.dirty) {
            void (async () => {
                const confirmed = await appDialog.confirm({
                    title: `退出${currentMarkdownLabel}编辑`,
                    description: `检测到未保存的${currentMarkdownLabel}更改，是否先保存后退出？`,
                    confirmText: '保存并退出',
                    cancelText: '不保存退出',
                    tone: 'brand',
                    dismissible: false,
                });
                if (confirmed) {
                    if (postToPreview({ type: 'SPEC_EDIT_SAVE', exitAfterSave: true })) {
                        setDocEditState((previous) => ({ ...previous, saving: true }));
                    }
                    return;
                }
                postToPreview({ type: 'SPEC_EDIT_EXIT', discardChanges: true });
                resetDocEditState();
                setEditorStatus({ mode: quickEditRuntimeActiveRef.current ? 'quickEdit' : 'none' });
            })();
            return;
        }
        postToPreview({ type: 'SPEC_EDIT_EXIT' });
        resetDocEditState();
        setEditorStatus({ mode: quickEditRuntimeActiveRef.current ? 'quickEdit' : 'none' });
    }, [
        appDialog,
        currentMarkdownLabel,
        docEditState.dirty,
        docEditState.enabled,
        docEditState.saving,
        postToPreview,
        resetDocEditState,
    ]);

    const handleCopyMarkdownPrompt = useCallback(async () => {
        if (markdownPromptCopying) return;
        if (docEditState.quickEditMode !== 'comment') {
            messageApi.warning('请先切换到批注模式');
            return;
        }
        setMarkdownPromptCopying(true);
        try {
            const result = await requestMarkdownEditPrompt({ saveBeforePrompt: true });
            await navigator.clipboard.writeText(result.prompt);
            messageApi.success('Prompt 已复制到剪贴板');
        } catch (error: any) {
            messageApi.error(error?.message || '复制 Prompt 失败');
        } finally {
            setMarkdownPromptCopying(false);
        }
    }, [
        docEditState.quickEditMode,
        messageApi,
        requestMarkdownEditPrompt,
        markdownPromptCopying,
    ]);

    const loadReviewMarkdown = useCallback(async () => {
        if (!reviewDocumentPath) {
            setReviewMarkdown('');
            setReviewUpdatedAt(null);
            setReviewError('');
            return;
        }
        setReviewLoading(true);
        setReviewError('');
        try {
            const markdownResponse = await fetch(buildMarkdownFileUrl(reviewDocumentPath), { cache: 'no-store' });
            if (markdownResponse.status === 404) {
                setReviewMarkdown('');
                setReviewUpdatedAt(null);
                return;
            }
            if (!markdownResponse.ok) {
                throw new Error(`读取评审失败：${markdownResponse.status}`);
            }
            const nextMarkdown = await markdownResponse.text();
            setReviewMarkdown(nextMarkdown);

            const metaResponse = await fetch(buildMarkdownFileMetaUrl(reviewDocumentPath), { cache: 'no-store' });
            if (metaResponse.ok) {
                const meta = await metaResponse.json();
                setReviewUpdatedAt(typeof meta?.updatedAt === 'string' ? meta.updatedAt : null);
            } else {
                setReviewUpdatedAt(null);
            }
        } catch (error: any) {
            setReviewMarkdown('');
            setReviewUpdatedAt(null);
            setReviewError(error?.message || '读取评审失败');
        } finally {
            setReviewLoading(false);
        }
    }, [reviewDocumentPath]);

    const handleReviewKindChange = useCallback((kind: ReviewKind) => {
        setActiveReviewKind(kind);
    }, []);

    const handleReviewPanelToggle = useCallback(() => {
        setReviewPanelOpen((open) => {
            const nextOpen = !open;
            if (!nextOpen) {
                setReviewPageZoomEnabled(false);
            }
            return nextOpen;
        });
    }, []);

    useEffect(() => {
        if (reviewPanelOpen) {
            void loadReviewMarkdown();
        }
    }, [activeReviewKind, loadReviewMarkdown, reviewPanelOpen]);

    const handleToggleReviewPageZoom = useCallback(() => {
        setReviewPageZoomEnabled((enabled) => !enabled);
    }, []);

    const handleCopyReviewPrompt = useCallback(async () => {
        try {
            await copyToClipboard(reviewPrompt);
            messageApi.success('评审 Prompt 已复制到剪贴板');
        } catch (error: any) {
            messageApi.error(error?.message || '复制评审 Prompt 失败');
        }
    }, [messageApi, reviewPrompt]);

    const handleOpenWebEditor = useCallback(async () => {
        if (isDocumentEditingContent) {
            await enterDocumentEditor();
            return;
        }

        if (!selectedEditablePreviewResource) {
            messageApi.warning('请先选择一个条目');
            return;
        }
        if (resourceType === 'prototype' && quickEditRuntimeStatus !== 'ready') {
            messageApi.warning('当前客户端页面尚未接入 /runtime/quick-edit.js，请通过 script、Vite 插件或 Webpack 插件加载后再使用快速编辑');
            return;
        }
        if (projectCapabilities?.quickEdit === false) {
            messageApi.warning('当前项目未启用 Quick Edit 能力');
            return;
        }
        try {
            standalonePanelBeforeQuickEditRef.current = standalonePanelOpen;
            const runtime = await probeAssistantRuntimeSilently?.();
            const primaryIframe = getPrimaryPreviewIframe();
            if (!await enterPrototypeEditor(primaryIframe, { runtime })) {
                return;
            }
            if (previewConfig.previewMode === 'split') {
                const secondaryIframe = getSecondaryPreviewIframe();
                if (secondaryIframe?.contentWindow) {
                    await enterPrototypeEditor(secondaryIframe, { showMissingWarning: false, runtime });
                }
            }
            quickEditRuntimeActiveRef.current = true;
            setStandalonePanelOpen(false);
            setEditorStatus({ mode: 'quickEdit' });
            refreshEditorStatus();
            if (sidebarCollapsedBeforeWebEditorRef.current === null) {
                sidebarCollapsedBeforeWebEditorRef.current = collapsed;
            }
            setCollapsed(true);
        } catch (error) {
            console.error('[Axhub] 启动编辑器失败:', error);
            messageApi.error('启动编辑器失败');
        }
    }, [
        collapsed,
        enterDocumentEditor,
        enterPrototypeEditor,
        getSecondaryPreviewIframe,
        getPrimaryPreviewIframe,
        isDocumentEditingContent,
        messageApi,
        previewConfig,
        probeAssistantRuntimeSilently,
        projectCapabilities?.quickEdit,
        quickEditRuntimeStatus,
        refreshEditorStatus,
        resourceType,
        selectedEditablePreviewResource,
        selectedItem,
        setCollapsed,
        standalonePanelOpen,
        viewMode,
    ]);

    const handleExitWebEditor = useCallback(async (_options?: { restoreDevice?: boolean }) => {
        const shouldRestorePanelOnly = standalonePanelBeforeQuickEditRef.current;
        standalonePanelBeforeQuickEditRef.current = false;
        try {
            getPreviewIframes().forEach((iframe) => {
                exitQuickEditRuntime(iframe);
            });
            documentHostToolbarUnsubscribeRef.current?.();
            documentHostToolbarUnsubscribeRef.current = null;
            prototypeHostToolbarUnsubscribeRef.current?.();
            prototypeHostToolbarUnsubscribeRef.current = null;
            const editorApi = getDocumentEditorApi();
            await Promise.resolve(editorApi?.disableDocumentEditor?.());
            await Promise.all(getPreviewIframes().map(async (iframe) => {
                await postPrototypeEditorDisable(iframe);
                const editors = getPrototypeEditorApi(iframe);
                if (editors?.disable) {
                    await Promise.resolve(editors.disable());
                }
            }));
            documentEditorActiveRef.current = false;
            quickEditRuntimeActiveRef.current = false;
            clearAssistantSelectedElementsOnExit();
            setEditorStatus({ mode: 'none' });
            setHostToolbarState(null);
            refreshEditorStatus();
            if (sidebarCollapsedBeforeWebEditorRef.current !== null) {
                setCollapsed(sidebarCollapsedBeforeWebEditorRef.current);
                sidebarCollapsedBeforeWebEditorRef.current = null;
            }
            // Restore standalone panel-only mode if it was active before quick edit.
            if (shouldRestorePanelOnly) {
                const primaryIframe = getPrimaryPreviewIframe();
                const restored = await enterPrototypeEditorPanelOnly(primaryIframe);
                setStandalonePanelOpen(restored);
            } else {
                setStandalonePanelOpen(false);
            }
        } catch (error) {
            console.error('[Axhub] 退出编辑器失败:', error);
            messageApi.error('退出编辑器失败');
        }
    }, [
        clearAssistantSelectedElementsOnExit,
        enterPrototypeEditorPanelOnly,
        exitQuickEditRuntime,
        getDocumentEditorApi,
        getPrimaryPreviewIframe,
        getPrototypeEditorApi,
        getPreviewIframes,
        messageApi,
        postPrototypeEditorDisable,
        refreshEditorStatus,
        setCollapsed,
    ]);
    exitWebEditorRef.current = handleExitWebEditor;

    const handleCopyQuickEditPrompt = useCallback(async () => {
        if (quickEditPromptCopying) return;
        const currentFilePath = getAssistantContextCurrentFilePath(assistantContextV1);
        if (!currentFilePath) {
            messageApi.warning('当前文件路径为空，无法生成快速编辑 Prompt');
            return;
        }
        setQuickEditPromptCopying(true);
        try {
            const prompt = buildQuickEditGeniePrompt({
                currentFilePath,
                currentFileDisplayName: selectedItem?.displayName || '',
                projectPath: assistantProjectPath,
                selectedElements: assistantContextV1.selectedElements,
            });
            await navigator.clipboard.writeText(prompt);
            messageApi.success('Prompt 已复制到剪贴板');
        } catch (error: any) {
            messageApi.error(error?.message || '复制 Prompt 失败');
        } finally {
            setQuickEditPromptCopying(false);
        }
    }, [assistantContextV1, assistantProjectPath, messageApi, quickEditPromptCopying, selectedItem]);

    const handleCopyToAxure = useCallback(async (options: any) => {
        if (!selectedItem) {
            messageApi.warning('请先选择一个条目');
            return;
        }
        if (exportAvailability.axureRuntimeDisabledReason) {
            messageApi.warning(exportAvailability.axureRuntimeDisabledReason);
            return;
        }
        const hide = messageApi.loading('正在复制到 Axure...', 0);
        try {
            const payload = await requestAxureJson(options);
            const available = await checkAxureAvailable();
            if (!available) {
                throw new Error(`Axure Bridge 可用性检查返回 false；${AXURE_UNAVAILABLE_HINT}`);
            }
            await postCopyAxvg(payload);
            void postProjectCommunicationRecord(selectedItem, 'exports', {
                operationType: 'axure.copy',
                status: 'success',
            }).catch(() => undefined);
            messageApi.success('已复制到 Axure');
        } catch (error: any) {
            console.error('复制到 Axure 失败:', error);
            void postProjectCommunicationRecord(selectedItem, 'exports', {
                operationType: 'axure.copy',
                status: 'failed',
                errorMessage: String(error?.message || '复制到 Axure 失败'),
            }).catch(() => undefined);
            messageApi.error(buildAxureBridgeUserMessage(String(error?.message || '')));
        } finally {
            hide();
        }
    }, [checkAxureAvailable, exportAvailability.axureRuntimeDisabledReason, messageApi, postCopyAxvg, requestAxureJson, selectedItem]);

    const handleCopyToFigma = useCallback(async () => {
        if (!selectedItem) {
            messageApi.warning('请先选择一个条目');
            return;
        }
        if (exportAvailability.figmaDomDisabledReason) {
            messageApi.warning(exportAvailability.figmaDomDisabledReason);
            return;
        }
        const hide = messageApi.loading('正在复制到 Figma...', 0);
        try {
            const result = await requestCopyToFigma();
            void postProjectCommunicationRecord(selectedItem, 'exports', {
                operationType: 'figma.copy',
                status: 'success',
                metadata: {
                    payloadSizeKb: result.payloadSizeKb,
                },
            }).catch(() => undefined);
            messageApi.success('复制成功');
        } catch (error: any) {
            void postProjectCommunicationRecord(selectedItem, 'exports', {
                operationType: 'figma.copy',
                status: 'failed',
                errorMessage: String(error?.message || '复制到 Figma 失败'),
            }).catch(() => undefined);
            messageApi.error(error?.message || '复制到 Figma 失败');
        } finally {
            hide();
        }
    }, [exportAvailability.figmaDomDisabledReason, messageApi, requestCopyToFigma, selectedItem]);

    const handleExportMake = useCallback(async () => {
        if (activeTab !== 'prototypes' || !selectedItem) {
            messageApi.warning('请先选择一个原型页面');
            return;
        }
        if (exportAvailability.makeExportDisabledReason) {
            messageApi.warning(exportAvailability.makeExportDisabledReason);
            return;
        }

        const targetPath = getSelectedResourceTargetPath(selectedItem);
        if (!targetPath) {
            messageApi.warning('当前资源未声明可导出资源上下文，无法导出 Make');
            return;
        }
        setIsFigmaMakeExportDialogOpen(true);
    }, [
        activeTab,
        exportAvailability.makeExportDisabledReason,
        messageApi,
        selectedItem,
    ]);

    const handleExportHtml = useCallback(async (options: { includeSource?: boolean } = {}) => {
        if (activeTab !== 'prototypes' || !selectedItem) {
            messageApi.warning('请先选择一个原型页面');
            return;
        }
        if (exportAvailability.htmlExportDisabledReason) {
            messageApi.warning(exportAvailability.htmlExportDisabledReason);
            return;
        }

        const targetPath = getSelectedSourceBasePath(selectedItem);
        if (!targetPath) {
            messageApi.warning('当前资源未声明本地文件路径，无法导出 HTML');
            return;
        }

        const itemLabel = selectedItem.displayName || selectedItem.name;
        const hide = messageApi.loading(`正在导出原型「${itemLabel}」HTML，时间较长时请耐心等待...`, 0);
        try {
            await downloadExportHtmlArchive(targetPath, { includeSource: options.includeSource === true });
            void postProjectCommunicationRecord(selectedItem, 'exports', {
                operationType: 'export-html',
                status: 'success',
                metadata: {
                    targetPath,
                    ...(options.includeSource === true ? { includeSource: true } : {}),
                },
            }).catch(() => undefined);
            messageApi.success(`「${itemLabel}」HTML 导出完成，已开始下载`);
        } catch (error: any) {
            void postProjectCommunicationRecord(selectedItem, 'exports', {
                operationType: 'export-html',
                status: 'failed',
                errorMessage: String(error?.message || 'HTML 导出失败'),
            }).catch(() => undefined);
            messageApi.error(error?.message || 'HTML 导出失败');
        } finally {
            hide();
        }
    }, [
        activeTab,
        exportAvailability.htmlExportDisabledReason,
        messageApi,
        selectedItem,
    ]);

    const handleOpenCloudPublishSettings = useCallback((target: CloudPublishTarget = 's3') => {
        setCloudPublishSettingsInitialTarget(target);
        setCloudPublishSettingsOpen(true);
    }, []);

    const refreshLatestCloudPublishUrls = useCallback(async () => {
        try {
            const latest = await apiService.getCloudPublishingLatest();
            setLatestCloudPublishItems({
                ...(latest.targets.vercel ? { vercel: latest.targets.vercel } : {}),
                ...(latest.targets.cloudflarePages ? { 'cloudflare-pages': latest.targets.cloudflarePages } : {}),
                ...(latest.targets.s3 ? { s3: latest.targets.s3 } : {}),
                ...(latest.targets.githubPages ? { 'github-pages': latest.targets.githubPages } : {}),
            });
        } catch {
            setLatestCloudPublishItems({});
        }
    }, []);

    useEffect(() => {
        void refreshLatestCloudPublishUrls();
    }, [refreshLatestCloudPublishUrls]);

    const latestCloudPublishUrl = useMemo(() => {
        return Object.values(latestCloudPublishItems)
            .filter((item): item is CloudPublishLatestItem => Boolean(item?.url))
            .sort((a, b) => b.deployedAt.localeCompare(a.deployedAt))[0]?.url || '';
    }, [latestCloudPublishItems]);

    const handleCopyLatestCloudPublishUrl = useCallback(async () => {
        const latestUrl = latestCloudPublishUrl;
        if (!latestUrl) {
            messageApi.warning('暂无最近发布地址');
            return;
        }
        try {
            await copyToClipboard(latestUrl);
            toast.success('最近发布地址已复制');
        } catch (error: any) {
            messageApi.error(error?.message || '复制最近发布地址失败');
        }
    }, [latestCloudPublishUrl, messageApi]);

    const handlePublishCloudTarget = useCallback(async (target: CloudPublishTarget) => {
        if (activeTab !== 'prototypes' || !selectedItem) {
            messageApi.warning('请先选择一个原型页面');
            return;
        }

        const targetPath = getSelectedResourceTargetPath(selectedItem);
        if (!targetPath) {
            messageApi.warning('当前资源未声明可发布资源上下文，无法发布');
            return;
        }

        const targetLabel = CLOUD_PUBLISH_TARGET_LABELS[target];
        try {
            const config = await apiService.getCloudPublishingConfig();
            const targetConfig = target === 'cloudflare-pages'
                ? config.targets.cloudflarePages
                : target === 'github-pages'
                    ? config.targets.githubPages
                : config.targets[target];
            if (!targetConfig?.configured) {
                setCloudPublishSettingsInitialTarget(target);
                setCloudPublishSettingsOpen(true);
                return;
            }
        } catch (error: any) {
            messageApi.error(error?.message || '加载云服务发布配置失败');
            return;
        }

        const hide = messageApi.loading(`正在发布到 ${targetLabel}...`, 0);
        try {
            const result = await apiService.publishCloudTarget({
                target,
                path: targetPath,
            });
            setLatestCloudPublishItems((current) => ({
                ...current,
                [target]: {
                    ...result,
                },
            }));
            toast.success(`已发布到 ${targetLabel}`, {
                duration: Infinity,
                description: (
                    <a href={result.url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                        {result.url}
                    </a>
                ),
            });
        } catch (error: any) {
            if (error?.code === 'CONFIG_REQUIRED') {
                setCloudPublishSettingsInitialTarget(target);
                setCloudPublishSettingsOpen(true);
                return;
            }
            messageApi.error(error?.message || '云服务发布失败');
        } finally {
            hide();
        }
    }, [
        activeTab,
        messageApi,
        selectedItem,
    ]);

    const handleFigmaMakeExportDownloadSuccess = useCallback((fileName: string) => {
        void postProjectCommunicationRecord(selectedItem, 'exports', {
            operationType: 'make.export',
            status: 'success',
            metadata: {
                fileName,
            },
        }).catch(() => undefined);
    }, [selectedItem]);

    const handleFigmaMakeExportDownloadFailure = useCallback((error: any) => {
        void postProjectCommunicationRecord(selectedItem, 'exports', {
            operationType: 'make.export',
            status: 'failed',
            errorMessage: String(error?.message || '导出 Make 失败'),
        }).catch(() => undefined);
    }, [selectedItem]);

    const ensureAxureExportReviewPassed = useCallback(async () => {
        if (!selectedItem) {
            messageApi.warning('请先选择一个条目');
            return false;
        }
        const canUseSourceFeatures = exportAvailability.canUseSourceFeatures;
        if (!canUseSourceFeatures) {
            return true;
        }
        try {
            const sourcePath = getSelectedSourceBasePath(selectedItem);
            if (!sourcePath) {
                return true;
            }
            const result = await apiService.reviewCode(sourcePath, {
                enforceComponentExportName: true,
                mode: 'axure-export',
            });
            if (result?.passed) {
                return true;
            }
            const issues = Array.isArray(result?.issues) ? result.issues : [];
            const firstIssue = issues.find((issue: any) => issue?.blocking && issue?.type === 'error')
                || issues.find((issue: any) => issue?.type === 'error')
                || issues[0];
            setPendingExportReviewResult(result);
            console.warn('[Axure Export Review]', firstIssue?.message || '代码检查未通过');
            return false;
        } catch (error: any) {
            setPendingExportReviewResult(createExportReviewFailureResult({
                activeTab,
                itemName: selectedItem.name,
                sourceTargetPath: getSelectedSourceBasePath(selectedItem),
                message: error?.message || '代码检查接口调用失败',
            }));
            console.warn('[Axure Export Review]', error?.message || '代码检查失败');
            return false;
        }
    }, [activeTab, exportAvailability.canUseSourceFeatures, messageApi, selectedItem]);

    const fetchRuntimeExportBundle = useCallback(async (): Promise<ExportIndexBundle> => {
        if (!selectedItem) {
            throw new Error('未选择项目');
        }
        if (exportAvailability.axureSourceDisabledReason) {
            throw new Error(exportAvailability.axureSourceDisabledReason);
        }

        return apiService.fetchExportIndexBundle(getSelectedResourceTargetPath(selectedItem));
    }, [activeTab, exportAvailability.axureSourceDisabledReason, selectedItem]);

    const buildRuntimeCoverSvg = useCallback(async () => {
        if (!selectedItem) {
            throw new Error('未选择项目');
        }
        if (exportAvailability.axureSourceDisabledReason) {
            throw new Error(exportAvailability.axureSourceDisabledReason);
        }
        if (imageConfig.contentType === 'screenshot' && !imageConfig.rawScreenshotUrl) {
            throw new Error('正在生成截图，请稍候...');
        }
        const hackCss = await apiService.fetchHackCss(activeTab, selectedItem.name);
        let indexBundle: ExportIndexBundle | null = null;
        let embeddedIndexBundle: ExportIndexBundle | null = null;
        if (imageConfig.includeConfig !== 'none') {
            indexBundle = await fetchRuntimeExportBundle();
            embeddedIndexBundle = createEmbeddedIndexBundle(indexBundle);
        }
        const label = '原型';
        let svgContent = '';
        if (imageConfig.contentType === 'title') {
            const titleSvg = generateSvgContent('', imageConfig, selectedItem.displayName, label);
            const pngDataUrl = await svgToPng(titleSvg, imageConfig.width, imageConfig.height, 2);
            svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${imageConfig.width}" height="${imageConfig.height}" viewBox="0 0 ${imageConfig.width} ${imageConfig.height}"><rect width="100%" height="100%" fill="transparent" /><image x="0" y="0" width="${imageConfig.width}" height="${imageConfig.height}" preserveAspectRatio="xMidYMin meet" xlink:href="${pngDataUrl}"/></svg>`;
        } else {
            svgContent = generateSvgContent(imageConfig.rawScreenshotUrl, imageConfig, selectedItem.displayName, label);
        }
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (!svgElement) {
            throw new Error('SVG generation failed');
        }
        if (imageConfig.includeConfig !== 'none') {
            const axureRuntimeCode = indexBundle.entry.axureCode || indexBundle.entry.code;
            const configPayload: Record<string, unknown> = {
                codeLink: indexBundle.entry.axureCodePath ? `${window.location.origin}${indexBundle.entry.axureCodePath}` : undefined,
            };
            if (activeTab === 'prototypes' && imageConfig.isFullScreen) {
                configPayload.isFullScreen = true;
            }
            if (hackCss) {
                configPayload.hackCss = hackCss;
            }
            svgElement.setAttribute('AxExtraData', encodeURIComponent(JSON.stringify({
                code: axureRuntimeCode,
                indexBundle: embeddedIndexBundle,
            })));
            svgElement.setAttribute('AxData', encodeURIComponent(JSON.stringify({
                time: Date.now(),
                config: configPayload,
            })));
        }
        const serializer = new XMLSerializer();
        return {
            updatedSvg: serializer.serializeToString(svgDoc),
            fileName: `${selectedItem.name}.svg`,
        };
    }, [activeTab, exportAvailability.axureSourceDisabledReason, fetchRuntimeExportBundle, imageConfig, selectedItem]);

    const handleExport = useCallback(async () => {
        if (!selectedItem) return;
        const hide = messageApi.loading('正在下载 Runtime 封面...', 0);
        setIsExporting(true);
        try {
            const { updatedSvg, fileName } = await buildRuntimeCoverSvg();
            const blob = new Blob([updatedSvg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            messageApi.success('Runtime 封面下载成功');
            setIsExportModalOpen(false);
        } catch (error: any) {
            messageApi.error(error?.message || '下载 Runtime 封面失败');
        } finally {
            hide();
            setIsExporting(false);
        }
    }, [buildRuntimeCoverSvg, messageApi, selectedItem]);

    const handleCopyRuntimeComponent = useCallback(async () => {
        if (!selectedItem) return;
        const hide = messageApi.loading('正在复制 Runtime 组件...', 0);
        setIsExporting(true);
        try {
            const { updatedSvg } = await buildRuntimeCoverSvg();
            const payload = buildRuntimeComponentAxvgPayload({
                svgContent: updatedSvg,
                width: imageConfig.width,
                height: imageConfig.height,
            });
            await copyToClipboard(`// axvg\n${JSON.stringify(payload)}`);
            messageApi.success('Runtime 组件已复制到剪贴板');
        } catch (error: any) {
            messageApi.error(error?.message || '复制 Runtime 组件失败');
        } finally {
            hide();
            setIsExporting(false);
        }
    }, [buildRuntimeCoverSvg, imageConfig.height, imageConfig.width, messageApi, selectedItem]);

    const handleCopyConfig = useCallback(async (exportType: string): Promise<string> => {
        void exportType;
        if (!selectedItem) {
            throw new Error('未选择项目');
        }
        if (exportAvailability.axureSourceDisabledReason) {
            throw new Error(exportAvailability.axureSourceDisabledReason);
        }
        const hackCss = await apiService.fetchHackCss(activeTab, selectedItem.name);
        const indexBundle = await fetchRuntimeExportBundle();
        const embeddedIndexBundle = createEmbeddedIndexBundle(indexBundle);
        const axureRuntimeCode = indexBundle.entry.axureCode || indexBundle.entry.code;
        const configData: any = {
            time: Date.now(),
            config: {
                code: axureRuntimeCode,
                codeLink: indexBundle.entry.axureCodePath ? `${window.location.origin}${indexBundle.entry.axureCodePath}` : undefined,
                indexBundle: embeddedIndexBundle,
                ...(activeTab === 'prototypes' && imageConfig.isFullScreen ? { isFullScreen: true } : {}),
                ...(hackCss ? { hackCss } : {}),
            },
        };
        return JSON.stringify(configData);
    }, [activeTab, exportAvailability.axureSourceDisabledReason, fetchRuntimeExportBundle, imageConfig.isFullScreen, selectedItem]);

    const handleQuickCopyEditablePrototype = useCallback(() => {
        void handleCopyToAxure(axureCopyOptions);
    }, [axureCopyOptions, handleCopyToAxure]);

    const handleQuickCopyRuntimeComponent = useCallback(() => {
        void (async () => {
            if (exportAvailability.axureSourceDisabledReason) {
                messageApi.warning(exportAvailability.axureSourceDisabledReason);
                return;
            }
            const passed = await ensureAxureExportReviewPassed();
            if (!passed) return;
            await handleCopyRuntimeComponent();
        })();
    }, [ensureAxureExportReviewPassed, exportAvailability.axureSourceDisabledReason, handleCopyRuntimeComponent, messageApi]);

    const handleQuickDownloadRuntimeCover = useCallback(() => {
        void (async () => {
            if (exportAvailability.axureSourceDisabledReason) {
                messageApi.warning(exportAvailability.axureSourceDisabledReason);
                return;
            }
            const passed = await ensureAxureExportReviewPassed();
            if (!passed) return;
            await handleExport();
        })();
    }, [ensureAxureExportReviewPassed, exportAvailability.axureSourceDisabledReason, handleExport, messageApi]);

    const handleOpenAxureUsageGuide = useCallback(() => {
        mergeExportModalPreferences(exportPreferencesStorageKey, {
            activeTabKey: 'usageGuide' satisfies ExportModalTabKey,
        });
        setIsExportModalOpen(true);
    }, [exportPreferencesStorageKey]);

    useEffect(() => {
        if (exportPreferencesLoadedKeyRef.current === exportPreferencesStorageKey) {
            return;
        }

        exportPreferencesLoadedKeyRef.current = exportPreferencesStorageKey;
        exportPreferencesReadyRef.current = false;

        const preferences = readExportModalPreferences(exportPreferencesStorageKey);
        const savedContentType = preferences.imageConfig?.contentType ?? DEFAULT_EXPORT_IMAGE_CONFIG.contentType;

        // Resolve dimensions based on contentType rather than blindly restoring saved w/h.
        // For 'title' mode, always use the title card defaults (500×300).
        // For 'screenshot' mode, use the device-appropriate defaults; the actual screenshot
        // dimensions will be auto-synced once a capture returns.
        const resolvedDimensions = savedContentType === 'screenshot'
            ? { width: screenshotDefaultSize.width, height: screenshotDefaultSize.height }
            : { width: TITLE_EXPORT_DEFAULT_SIZE.width, height: TITLE_EXPORT_DEFAULT_SIZE.height };

        const nextImageConfig = preferences.imageConfig
            ? {
                ...DEFAULT_EXPORT_IMAGE_CONFIG,
                ...preferences.imageConfig,
                ...resolvedDimensions,
                rawScreenshotUrl: '',
                screenshotWidth: 0,
                screenshotHeight: 0,
                previewUrl: '',
            }
            : DEFAULT_EXPORT_IMAGE_CONFIG;
        const nextAxureCopyOptions = preferences.axureCopyOptions
            ? { ...DEFAULT_AXURE_COPY_OPTIONS, ...preferences.axureCopyOptions }
            : DEFAULT_AXURE_COPY_OPTIONS;

        skipExportContentTypeResetRef.current = true;
        userSetDimensionsRef.current = false;
        setImageConfig(nextImageConfig);
        setAxureCopyOptions(nextAxureCopyOptions);
        exportPreferencesReadyRef.current = true;
    }, [exportPreferencesStorageKey, screenshotDefaultSize.height, screenshotDefaultSize.width]);

    useEffect(() => {
        if (!exportPreferencesReadyRef.current) return;

        mergeExportModalPreferences(exportPreferencesStorageKey, {
            imageConfig: {
                width: imageConfig.width,
                height: imageConfig.height,
                includeConfig: imageConfig.includeConfig,
                contentType: imageConfig.contentType,
                isFullScreen: imageConfig.isFullScreen,
            },
            axureCopyOptions: {
                preserveHierarchy: axureCopyOptions.preserveHierarchy,
                preserveSvgIcons: axureCopyOptions.preserveSvgIcons,
            },
        });
    }, [
        axureCopyOptions.preserveHierarchy,
        axureCopyOptions.preserveSvgIcons,
        exportPreferencesStorageKey,
        imageConfig.contentType,
        imageConfig.height,
        imageConfig.includeConfig,
        imageConfig.isFullScreen,
        imageConfig.width,
    ]);

    useEffect(() => {
        if (skipExportContentTypeResetRef.current) {
            skipExportContentTypeResetRef.current = false;
            return;
        }
        userSetDimensionsRef.current = false;
        if (imageConfig.contentType === 'screenshot') {
            setImageConfig((previous) => ({
                ...previous,
                width: screenshotDefaultSize.width,
                height: screenshotDefaultSize.height,
                screenshotWidth: 0,
                screenshotHeight: 0,
                rawScreenshotUrl: '',
            }));
        } else {
            setImageConfig((previous) => ({
                ...previous,
                width: 500,
                height: 300,
            }));
        }
    }, [imageConfig.contentType, screenshotDefaultSize.height, screenshotDefaultSize.width]);

    useEffect(() => {
        if (userSetDimensionsRef.current) return;
        if (imageConfig.contentType !== 'screenshot') return;
        if (!imageConfig.screenshotWidth || !imageConfig.screenshotHeight) return;
        setImageConfig((previous) => ({
            ...previous,
            width: imageConfig.screenshotWidth,
            height: imageConfig.screenshotHeight,
        }));
    }, [imageConfig.contentType, imageConfig.screenshotHeight, imageConfig.screenshotWidth]);

    useEffect(() => {
        userSetDimensionsRef.current = false;
        setImageConfig((previous) => ({
            ...previous,
            rawScreenshotUrl: '',
            screenshotWidth: 0,
            screenshotHeight: 0,
            previewUrl: '',
        }));
    }, [selectedItem]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const targetIframe = previewIframeRef.current;
            if (!targetIframe || event.source !== targetIframe.contentWindow) {
                return;
            }
            const previewOrigin = getIframeOrigin(targetIframe);
            if (previewOrigin !== '*' && event.origin !== previewOrigin) {
                return;
            }
            if (event.data?.type === 'SPEC_EDIT_STATUS') {
                const nextMode: SpecQuickEditMode = event.data.quickEditMode === 'edit' ? 'edit' : 'comment';
                const nextState = {
                    enabled: Boolean(event.data.enabled),
                    dirty: Boolean(event.data.dirty),
                    saving: Boolean(event.data.saving),
                };
                setDocEditState({
                    ...nextState,
                    quickEditMode: nextMode,
                });
                const pendingSwitch = pendingDocSwitchRef.current;
                if (pendingSwitch && !nextState.saving && !nextState.enabled) {
                    pendingDocSwitchRef.current = null;
                    switchMarkdownSelection(pendingSwitch.kind, pendingSwitch.item);
                }
                if (!nextState.enabled && !quickEditRuntimeActiveRef.current && !documentEditorActiveRef.current) {
                    setEditorStatus({ mode: 'none' });
                }
                return;
            }
            if (event.data?.type === 'SPEC_EDIT_STATUS_REQUEST') {
                postToPreview({
                    type: 'SPEC_EDIT_STATUS',
                    enabled: docEditState.enabled,
                    dirty: docEditState.dirty,
                    saving: docEditState.saving,
                    activeDocKey: activePromptResource?.cacheKey ?? '',
                    quickEditMode: docEditState.quickEditMode,
                });
                return;
            }
            if (typeof event.data?.type === 'string' && event.data.type.startsWith('axhub.quickEdit.export.')) {
                if (event.data.type !== 'axhub.quickEdit.export.captureScreenshotResult') return;
                if (event.data.success) {
                    setImageConfig((previous) => ({
                        ...previous,
                        rawScreenshotUrl: event.data.dataUrl,
                        screenshotWidth: event.data.width,
                        screenshotHeight: event.data.height,
                    }));
                    return;
                }
                setImageConfig((previous) => ({
                    ...previous,
                    rawScreenshotUrl: '',
                    screenshotWidth: 0,
                    screenshotHeight: 0,
                    previewUrl: '',
                }));
                notifyPreviewMessage('error', event.data.error || '截图生成失败');
                return;
            }
            if (event.data?.type === 'AXHUB_PROTOTYPE_PAGE_CHANGE') {
                const nextPageId = typeof event.data.pageId === 'string' && /^[a-z0-9-]+$/u.test(event.data.pageId.trim())
                    ? event.data.pageId.trim()
                    : '';
                onPrototypePageChange?.(nextPageId || null);
                return;
            }
            if (event.data?.type === 'AXHUB_PROTOTYPE_ROUTE_INFO') {
                const nextRouteInfo = normalizePrototypeRouteInfo(event.data);
                if (!nextRouteInfo) {
                    return;
                }
                onPrototypeRouteInfo?.(nextRouteInfo);
                return;
            }
            if (event.data?.type === 'WEB_EDITOR_NOTICE') {
                notifyPreviewMessage(event.data.level, event.data.message);
                return;
            }
            if (event.data?.type === 'WEB_EDITOR_DIALOG_REQUEST') {
                const requestId = typeof event.data.requestId === 'string' ? event.data.requestId.trim() : '';
                const kind = event.data.kind === 'confirm' ? 'confirm' : 'alert';
                if (!requestId) {
                    return;
                }

                const title = typeof event.data.title === 'string' && event.data.title.trim()
                    ? event.data.title.trim()
                    : kind === 'confirm'
                        ? '确认操作'
                        : '提示';
                const description = typeof event.data.description === 'string' ? event.data.description : '';
                const confirmText = typeof event.data.confirmText === 'string' && event.data.confirmText.trim()
                    ? event.data.confirmText.trim()
                    : kind === 'confirm'
                        ? '确定'
                        : '知道了';
                const cancelText = typeof event.data.cancelText === 'string' && event.data.cancelText.trim()
                    ? event.data.cancelText.trim()
                    : '取消';
                const dismissible = event.data.dismissible !== false;
                const tone = event.data.tone === 'destructive'
                    ? 'destructive'
                    : event.data.tone === 'default'
                        ? 'default'
                        : 'brand';

                void (async () => {
                    if (kind === 'confirm') {
                        const confirmed = await appDialog.confirm({
                            title,
                            description,
                            confirmText,
                            cancelText,
                            tone,
                            dismissible,
                        });
                        postToPreview({
                            type: 'WEB_EDITOR_DIALOG_RESPONSE',
                            requestId,
                            confirmed,
                        }, targetIframe);
                        return;
                    }

                    notifyPreviewMessage(
                        event.data.level ?? (
                            tone === 'destructive'
                                ? 'error'
                                : title === '提示'
                                    ? 'info'
                                    : 'info'
                        ),
                        description,
                    );
                    postToPreview({
                        type: 'WEB_EDITOR_DIALOG_RESPONSE',
                        requestId,
                        confirmed: true,
                    }, targetIframe);
                })();
                return;
            }
            if (isWebEditorGenieRequestMessage(event.data)) {
                void handleWebEditorGenieRequest(event.data.payload);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [
        appDialog,
        activePromptResource?.cacheKey,
        docEditState.dirty,
        docEditState.enabled,
        docEditState.quickEditMode,
        docEditState.saving,
        getIframeOrigin,
        handleWebEditorGenieRequest,
        notifyPreviewMessage,
        onPrototypePageChange,
        onPrototypeRouteInfo,
        postToPreview,
        switchMarkdownSelection,
    ]);

    useEffect(() => {
        if (!isExportModalOpen || !selectedItem) return;
        if (imageConfig.contentType === 'screenshot' && !imageConfig.rawScreenshotUrl) {
            setImageConfig((previous) => ({ ...previous, previewUrl: '' }));
            return;
        }
        let disposed = false;
        let currentUrl = '';
        const label = '原型';
        (async () => {
            try {
                let svgContent = '';
                if (imageConfig.contentType === 'title') {
                    const titleSvg = generateSvgContent('', imageConfig, selectedItem.displayName, label);
                    const pngDataUrl = await svgToPng(titleSvg, imageConfig.width, imageConfig.height, 2);
                    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${imageConfig.width}" height="${imageConfig.height}" viewBox="0 0 ${imageConfig.width} ${imageConfig.height}"><rect width="100%" height="100%" fill="transparent" /><image x="0" y="0" width="${imageConfig.width}" height="${imageConfig.height}" preserveAspectRatio="xMidYMin meet" xlink:href="${pngDataUrl}"/></svg>`;
                } else {
                    svgContent = generateSvgContent(imageConfig.rawScreenshotUrl, imageConfig, selectedItem.displayName, label);
                }
                const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
                currentUrl = URL.createObjectURL(blob);
                if (!disposed) {
                    setImageConfig((previous) => ({ ...previous, previewUrl: currentUrl }));
                }
            } catch {
                if (!disposed) {
                    setImageConfig((previous) => ({ ...previous, previewUrl: '' }));
                }
            }
        })();
        return () => {
            disposed = true;
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
            }
        };
    }, [
        activeTab,
        imageConfig.contentType,
        imageConfig.height,
        imageConfig.rawScreenshotUrl,
        imageConfig.width,
        isExportModalOpen,
        selectedItem,
    ]);

    useEffect(() => {
        if (isExportModalOpen && imageConfig.contentType === 'screenshot' && !imageConfig.rawScreenshotUrl) {
            exportModalWasOpenRef.current = true;
            handleRequestScreenshot();
            return;
        }
        if (isExportModalOpen) {
            exportModalWasOpenRef.current = true;
            return;
        }
        if (!exportModalWasOpenRef.current) {
            return;
        }
        if (!isExportModalOpen) {
            const targetIframe = getPreviewIframe();
            if (targetIframe?.contentWindow) {
                targetIframe.contentWindow.postMessage({ type: 'RESET_SCREENSHOT_STYLES' }, getIframeOrigin(targetIframe));
            }
            exportModalWasOpenRef.current = false;
        }
    }, [
        getIframeOrigin,
        getPreviewIframe,
        handleRequestScreenshot,
        imageConfig.contentType,
        imageConfig.rawScreenshotUrl,
        isExportModalOpen,
    ]);

    const handleStandalonePanelToggle = useCallback(async () => {
        if (standalonePanelOpen) {
            exitPrototypeEditorPanelOnly();
            setStandalonePanelOpen(false);
        } else {
            const primaryIframe = getPrimaryPreviewIframe();
            const success = await enterPrototypeEditorPanelOnly(primaryIframe);
            if (success) {
                setStandalonePanelOpen(true);
            }
        }
    }, [
        enterPrototypeEditorPanelOnly,
        exitPrototypeEditorPanelOnly,
        getPrimaryPreviewIframe,
        standalonePanelOpen,
    ]);

    return {
        selectedDeviceId,
        previewConfig,
        setSelectedDeviceId,
        deviceSegmentOptions,
        handleSelectPreviewSinglePreset,
        handleSelectCustomPreview,
        handleActivateSplitPreview,
        handleChangeCustomPreviewWidth,
        handleChangeCustomPreviewHeight,
        handleChangeSplitPreviewWidth,
        handleChangeSplitPreviewHeight,
        handleChangePreviewScaleMode,
        qrCodeVisible,
        setQrCodeVisible,
        quickEditAvailable,
        quickEditPromptAvailable,
        quickEditPromptCopying,
        exportAvailability,
        editorStatus,
        docEditState,
        markdownPromptCopying,
        reviewPanelOpen,
        activeReviewKind,
        reviewMarkdown,
        reviewUpdatedAt,
        reviewLoading,
        reviewError,
        reviewPageZoomEnabled,
        quickEditRuntimeStatus,
        hostToolbarState,
        containerRef,
        previewIframeRef,
        secondaryPreviewIframeRef,
        handlePreviewIframeLoad,
        currentDevice,
        displaySize,
        scale,
        elementIframeKey,
        iframeUrl,
        primaryIframeUrl,
        secondaryIframeUrl,
        localShareUrl,
        elementIframeSize,
        setElementIframeSize,
        isExportModalOpen,
        setIsExportModalOpen,
        isFigmaMakeExportDialogOpen,
        setIsFigmaMakeExportDialogOpen,
        cloudPublishSettingsOpen,
        cloudPublishSettingsInitialTarget,
        setCloudPublishSettingsOpen,
        pendingExportReviewResult,
        setPendingExportReviewResult,
        exportPreferencesStorageKey,
        isExporting,
        imageConfig,
        setImageConfig,
        axureCopyOptions,
        setAxureCopyOptions,
        handleDimensionChange,
        handleSwapDimensions,
        handleDimensionBlur,
        handleExport,
        handleCopyRuntimeComponent,
        handleCopyToAxure,
        handleCopyConfig,
        handleSelectDoc,
        handleSelectTemplate,
        handleOpenWebEditor,
        handleEnableDocEdit,
        handleSaveDocEdit,
        handleExitDocEdit,
        handleSwitchDocQuickEditMode,
        handleCopyMarkdownPrompt,
        handleReviewKindChange,
        handleReviewPanelToggle,
        handleCopyReviewPrompt,
        handleToggleReviewPageZoom,
        runHostToolbarAction,
        runQuickEditSaveAction,
        handleExitWebEditor,
        handleCopyQuickEditPrompt,
        handleRefreshElement,
        handleCopyLocalLink,
        handleCopyLANLink,
        getLANUrl,
        handleCopyToFigma,
        handleExportMake,
        handleExportHtml,
        handlePublishCloudTarget,
        handleOpenCloudPublishSettings,
        latestCloudPublishUrl,
        handleCopyLatestCloudPublishUrl,
        handleFigmaMakeExportDownloadSuccess,
        handleFigmaMakeExportDownloadFailure,
        handleQuickCopyEditablePrototype,
        handleQuickCopyRuntimeComponent,
        handleQuickDownloadRuntimeCover,
        handleOpenAxureUsageGuide,
        handleWebEditorGenieRequest,
        clearAssistantSelectedElementsOnExit,
        handleOpenAssistantIframe: () => {
            messageApi.info('助手面板由页面控制器管理');
        },
        assistantProjectPath,
        standalonePanelOpen,
        handleStandalonePanelToggle,
    };
}
