import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ItemData, TabType, ViewMode } from '../types';
import type { GenieProvider } from '@/common/genie/types';
import { useCreateDialog } from '../hooks';
import { useAssistantPanelController } from '../domains/assistant/hooks/useAssistantPanelController';
import { useWorkspaceNavigationController } from '../domains/workspace/hooks/useWorkspaceNavigationController';
import { useIdeActions } from '../hooks/useIdeActions';
import { useAxhubBridge } from '../hooks/useAxhubBridge';
import { useOpenCodeBridgeSync } from '../hooks/useOpenCodeBridgeSync';
import { resolveOpenCodeCanvasAnnotationContext, resolveOpenCodeCurrentFilePath } from '../hooks/openCodeBridgeContext';
import type { CanvasElementContextInfo } from '../components/content/canvas-embeds/AnnotationOverlay';
import IndexPageLayout from '../components/app/IndexPageLayout';
import type {
    ResourceSection,
    SidebarTab,
} from '../types/index-page.types';
import { useIndexPageResourceActions } from './index-page/useIndexPageResourceActions';
import { useIndexPagePreviewActions } from './index-page/useIndexPagePreviewActions';
import { useIndexPagePreferences } from './hooks/useIndexPagePreferences';
import { useIndexPagePresentationPropsBuilder } from './hooks/useIndexPagePresentationPropsBuilder';
import { useIndexPageSelectionSync } from './hooks/useIndexPageSelectionSync';
import { useIndexPageSidebarPropsBuilder } from './hooks/useIndexPageSidebarPropsBuilder';
import { useIndexPageUiBridge } from './hooks/useIndexPageUiBridge';
import { resolveIndexContentMode, type IndexContentMode } from './index-page/contentMode';
import { buildIndexDeepLinkUrl, parseResourceDeepLink, shouldSyncIndexDeepLinkUrl, type ResourceDeepLinkTarget } from './index-page/resourceDeepLink';
import {
    buildAssistantAutoOpenDismissedStorageKey,
    getAssistantAutoOpenDismissed,
    resolveMobileItemOpenUrl,
    setAssistantAutoOpenDismissed,
} from './index-page.helpers';
import { getSelectedResourceTargetPath } from './index-page/previewActions.helpers';
import { apiService } from '../services/index.api';
import { parseOpenMethod, type OpenMethod } from '../../common/ide';
import { DEFAULT_LOCAL_EXPORT_CAPABILITIES, DEFAULT_RESOURCE_WRITE_CAPABILITIES, normalizeProjectResourcesPayload } from '../services/projectResources';
import type { PendingReturnTarget } from './hooks/useIndexPageSelectionSync';
import { getExplicitLocalPath, stripIndexFilePath } from '../utils/localPath';
import { copyToClipboard } from '../utils/clipboard';
import { getAssistantContextCurrentFilePath } from '../utils/genieContext';
import type { ExcalidrawPropertyPanelMode, ExcalidrawPropertyPanelPosition } from '../utils/excalidrawUiMode';
import './styles/index-page.css';

interface AppInnerProps {
    isDarkMode: boolean;
    setIsDarkMode: (dark: boolean) => void;
    excalidrawPropertyPanelMode: ExcalidrawPropertyPanelMode;
    setExcalidrawPropertyPanelMode: (mode: ExcalidrawPropertyPanelMode) => void;
    excalidrawPropertyPanelPosition: ExcalidrawPropertyPanelPosition;
    setExcalidrawPropertyPanelPosition: (position: ExcalidrawPropertyPanelPosition) => void;
}

const resolveCachedOnlineOpenProvider = (method: OpenMethod): GenieProvider | undefined | null => {
    if (method.type !== 'web') {
        return null;
    }
    if (method.value === 'genie') {
        return undefined;
    }
    if (method.value === 'claude' || method.value === 'codex' || method.value === 'gemini' || method.value === 'opencode') {
        return method.value;
    }
    return null;
};

type PrototypeRouteInfo = {
    pages: { id: string; title: string }[];
    defaultPageId: string;
    activePageId: string;
};

const PROTOTYPE_ROUTE_PAGE_ID_RE = /^[a-z0-9-]+$/u;

function normalizePrototypeRoutePageId(value: unknown): string {
    const id = typeof value === 'string' ? value.trim() : '';
    return PROTOTYPE_ROUTE_PAGE_ID_RE.test(id) ? id : '';
}

function normalizePrototypeRoutePage(value: { id?: unknown; title?: unknown } | null | undefined) {
    const id = normalizePrototypeRoutePageId(value?.id);
    const title = typeof value?.title === 'string' ? value.title.trim() : '';
    return id && title ? { id, title } : null;
}

function resolveSelectedPrototypePageAfterRouteInfo(
    previousPageId: string | null,
    routeInfo: PrototypeRouteInfo,
    pages: { id: string; title: string }[],
): string | null {
    const previous = normalizePrototypeRoutePageId(previousPageId);
    if (previous && pages.some((page) => page.id === previous)) {
        return previous;
    }
    const active = normalizePrototypeRoutePageId(routeInfo.activePageId);
    if (active && pages.some((page) => page.id === active)) {
        return active;
    }
    const fallback = normalizePrototypeRoutePageId(routeInfo.defaultPageId) || pages[0]?.id || '';
    return fallback || null;
}

export default function IndexPage({
    isDarkMode,
    setIsDarkMode,
    excalidrawPropertyPanelMode,
    setExcalidrawPropertyPanelMode,
    excalidrawPropertyPanelPosition,
    setExcalidrawPropertyPanelPosition,
}: AppInnerProps) {
    const { appDialog, messageApi, modal } = useIndexPageUiBridge();
    const workspace = useWorkspaceNavigationController({ messageApi });
    const bridge = useAxhubBridge();

    const [collapsed, setCollapsed] = useState(false);
    const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('demo');
    const [activeTab, setActiveTab] = useState<TabType>('prototypes');
    const [selectedItem, setSelectedItem] = useState<ItemData | null>(null);
    const [selectedPrototypePageId, setSelectedPrototypePageId] = useState<string | null>(null);
    const [sidebarTab, setSidebarTab] = useState<SidebarTab>('prototype');
    const [resourceSection, setResourceSection] = useState<ResourceSection>('themes');
    const [startServerLoading, setStartServerLoading] = useState(false);
    const [startServerError, setStartServerError] = useState('');
    const [pendingReturnTarget, setPendingReturnTarget] = useState<PendingReturnTarget | null>(null);
    const onlineOpenAutoTriggeredRef = useRef(false);
    const initialResourceDeepLink = useMemo(() => parseResourceDeepLink(), []);
    const [initialResourceDeepLinkHandled, setInitialResourceDeepLinkHandled] = useState(() => !initialResourceDeepLink);
    const handleInitialResourceDeepLinkHandled = useCallback(() => {
        setInitialResourceDeepLinkHandled(true);
    }, []);

    const handleExcalidrawPropertyPanelModeChange = useCallback((mode: ExcalidrawPropertyPanelMode) => {
        setExcalidrawPropertyPanelMode(mode);
        void apiService.saveServerPreferences({
            uiPreferences: {
                excalidrawPropertyPanelMode: mode,
            },
        }).catch((error) => {
            console.warn('Failed to save Excalidraw property panel preference:', error);
        });
    }, [setExcalidrawPropertyPanelMode]);

    const handleExcalidrawPropertyPanelPositionChange = useCallback((position: ExcalidrawPropertyPanelPosition) => {
        setExcalidrawPropertyPanelPosition(position);
        void apiService.saveServerPreferences({
            uiPreferences: {
                excalidrawPropertyPanelPosition: position,
            },
        }).catch((error) => {
            console.warn('Failed to save Excalidraw property panel position preference:', error);
        });
    }, [setExcalidrawPropertyPanelPosition]);

    const availableDocOptions = useMemo(
        () => workspace.docsItems.map((doc) => ({ name: doc.name, displayName: doc.displayName || doc.name })),
        [workspace.docsItems],
    );
    const availablePrototypeOptions = useMemo(
        () => (workspace.data?.prototypes || []).map((item) => ({ name: item.name, displayName: item.displayName || item.name })),
        [workspace.data?.prototypes],
    );
    const {
        createDialogVisible,
        selectedThemes,
        availableThemes,
        selectedDocs,
        availableDocs,
        selectedDataAssets,
        availableDataAssets,
        initialCreateDialogTab,
        setCreateDialogVisible,
        setInitialCreateDialogTab,
        setSelectedThemes,
        setSelectedDocs,
        setSelectedDataAssets,
        buildPrompt,
        clearCreateDialogState,
        handleCreateCancel,
    } = useCreateDialog(activeTab, workspace.data);

    const resources = useIndexPageResourceActions({
        activeTab,
        data: workspace.data,
        docsItems: workspace.docsItems,
        canvasItems: workspace.canvasItems,
        themes: workspace.themes,
        setThemes: workspace.setThemes,
        dataTables: workspace.dataTables,
        setDataTables: workspace.setDataTables,
        templateAssets: workspace.templateAssets,
        setTemplateAssets: workspace.setTemplateAssets,
        resourceOrders: workspace.resourceOrders,
        setResourceOrders: workspace.setResourceOrders,
        sidebarTrees: workspace.sidebarTrees,
        setSidebarTrees: workspace.setSidebarTrees,
        projectTitle: workspace.projectTitle,
        setProjectTitle: workspace.setProjectTitle,
        availableDocOptions,
        availablePrototypeOptions,
        messageApi,
        modal,
        appDialog,
        preferredPromptClient: null,
        preferredIDE: null,
        setActiveTab,
        setSelectedItem,
        setSidebarTab,
        setViewMode,
        setResourceSection,
        setCreateDialogVisible,
        setCreateDialogSelectedDocs: setSelectedDocs,
        loadData: workspace.loadData,
        loadProjects: workspace.loadProjects,
        reloadSidebarAssets: workspace.reloadSidebarAssets,
        reloadDocsItems: workspace.reloadDocsItems,
        reloadCanvasItems: workspace.reloadCanvasItems,
        getSidebarTabItems: workspace.getSidebarTabItems,
        loadSidebarTree: workspace.loadSidebarTree,
    });

    const contentMode = useMemo<IndexContentMode>(() => resolveIndexContentMode({
        sidebarTab,
        resourceSection,
        viewMode,
    }), [resourceSection, sidebarTab, viewMode]);

    const currentMarkdownResource = useMemo(() => {
        if (contentMode === 'doc') {
            return { item: resources.selectedDoc, kind: 'doc' as const };
        }
        if (contentMode === 'template') {
            return { item: resources.selectedTemplate, kind: 'template' as const };
        }
        return { item: null, kind: 'doc' as const };
    }, [contentMode, resources.selectedDoc, resources.selectedTemplate]);
    const currentMarkdownItem = currentMarkdownResource.item;
    const currentMarkdownLabel = currentMarkdownResource.kind === 'template' ? '模板' : '文档';

    const assistantController = useAssistantPanelController({
        messageApi,
        modal,
        preferredPromptClient: null,
        activeProjectId: workspace.activeProjectId,
        activeTab,
        viewMode,
        selectedItem,
        contentMode,
        currentMarkdownResource,
        currentCanvas: resources.selectedCanvas,
        currentTheme: resources.selectedTheme,
        currentDataTable: resources.selectedDataTable,
    });
    const syncAssistantCanvasComments = assistantController.syncAssistantCanvasComments;
    const assistantCurrentFilePath = getAssistantContextCurrentFilePath(assistantController.assistantContextV1);
    const assistantAutoOpenTargetPath = assistantCurrentFilePath
        || (selectedItem ? getSelectedResourceTargetPath(selectedItem) : undefined);
    const assistantAutoOpenProjectScope = workspace.activeProjectId
        || assistantController.assistantProjectPath
        || workspace.projectTitle;
    const buildAssistantAutoOpenKeyForTarget = useCallback((_targetPath?: string) => (
        buildAssistantAutoOpenDismissedStorageKey(
            assistantAutoOpenProjectScope,
        )
    ), [
        assistantAutoOpenProjectScope,
    ]);
    const assistantAutoOpenDismissedStorageKey = useMemo(() => (
        buildAssistantAutoOpenDismissedStorageKey(assistantAutoOpenProjectScope)
    ), [assistantAutoOpenProjectScope]);

    const preview = useIndexPagePreviewActions({
        activeTab,
        collapsed,
        setCollapsed,
        sidebarTab,
        setSidebarTab,
        resourceSection,
        setResourceSection,
        selectedItem,
        selectedPageId: selectedPrototypePageId,
        onPrototypePageChange: setSelectedPrototypePageId,
        selectedDoc: resources.selectedDoc,
        setSelectedDoc: resources.setSelectedDoc,
        selectedTemplate: resources.selectedTemplate,
        setSelectedTemplate: resources.setSelectedTemplate,
        selectedTheme: resources.selectedTheme,
        projectCapabilities: workspace.projectCapabilities,
        messageApi,
        modal,
        appDialog,
        viewMode,
        isDarkMode,
        setIsDarkMode,
        assistantContextV1: assistantController.assistantContextV1,
        assistantProjectPath: assistantController.assistantProjectPath,
        assistantApiBaseUrl: assistantController.assistantApiBaseUrl,
        assistantWebEditorClientId: assistantController.assistantWebEditorClientId,
        probeAssistantRuntimeSilently: assistantController.probeAssistantRuntimeSilently,
        startAssistantRuntimeForWebEditor: assistantController.startAssistantRuntimeForWebEditor,
        handleWebEditorGenieRequest: assistantController.handleWebEditorGenieRequest,
        syncAssistantCanvasComments: assistantController.syncAssistantCanvasComments,
        clearAssistantSelectedElementsOnExit: assistantController.clearAssistantSelectedElementsOnExit,
        tryOpenByAssistantIframe: assistantController.tryOpenByAssistantIframe,
        onPrototypeRouteInfo: (routeInfo: PrototypeRouteInfo) => {
            if (!selectedItem) {
                return;
            }
            const nextPages = Array.isArray(routeInfo.pages)
                ? routeInfo.pages.map((page) => normalizePrototypeRoutePage(page)).filter((page): page is { id: string; title: string } => Boolean(page))
                : [];
            if (nextPages.length === 0) {
                return;
            }
            workspace.setData((previous) => ({
                ...previous,
                prototypes: previous.prototypes.map((item) => {
                    if (!selectedItem || item.name !== selectedItem.name) {
                        return item;
                    }
                    return {
                        ...item,
                        pages: nextPages,
                        defaultPageId: normalizePrototypeRoutePageId(routeInfo.defaultPageId) || nextPages[0]?.id || '',
                    };
                }),
            }));
            setSelectedItem((previous) => {
                if (!previous || previous.name !== selectedItem?.name) {
                    return previous;
                }
                return {
                    ...previous,
                    pages: nextPages,
                    defaultPageId: normalizePrototypeRoutePageId(routeInfo.defaultPageId) || nextPages[0]?.id || '',
                };
            });
            setSelectedPrototypePageId((previousPageId) => (
                resolveSelectedPrototypePageAfterRouteInfo(previousPageId, routeInfo, nextPages)
            ));
        },
    });

    const selection = useIndexPageSelectionSync({
        loading: workspace.loading,
        data: workspace.data,
        docsItems: workspace.docsItems,
        themes: workspace.themes,
        sidebarAssetsLoaded: workspace.sidebarAssetsLoaded,
        searchText: workspace.searchText,
        setSearchText: workspace.setSearchText,
        activeTab,
        setActiveTab,
        selectedItem,
        setSelectedItem,
        setSelectedPrototypePageId,
        setSelectedDoc: resources.setSelectedDoc,
        setSelectedResourceFolder: resources.setSelectedResourceFolder,
        setSelectedTheme: resources.setSelectedTheme,
        sidebarTrees: workspace.sidebarTrees,
        sidebarTab,
        setSidebarTab,
        resourceSection,
        setResourceSection,
        viewMode,
        setViewMode,
        pendingReturnTarget,
        setPendingReturnTarget,
        initialResourceDeepLink,
        onInitialResourceDeepLinkHandled: handleInitialResourceDeepLinkHandled,
        setCollapsed,
        editorMode: preview.editorStatus.mode,
        onExitWebEditor: preview.handleExitWebEditor,
    });

    const currentDeepLinkTarget = useMemo<ResourceDeepLinkTarget | null>(() => {
        const activeProjectId = workspace.activeProjectId;
        if (contentMode === 'preview' && selectedItem) {
            return {
                resourceType: 'prototype',
                resourceId: selectedItem.resourceId || selectedItem.name,
                view: viewMode,
                pageId: selectedPrototypePageId || undefined,
                projectId: activeProjectId || undefined,
            };
        }
        if (contentMode === 'doc' && resources.selectedDoc) {
            return {
                resourceType: 'doc',
                resourceId: resources.selectedDoc.resourceId || resources.selectedDoc.name,
                projectId: activeProjectId || undefined,
            };
        }
        if (contentMode === 'theme' && resources.selectedTheme) {
            return {
                resourceType: 'theme',
                resourceId: resources.selectedTheme.name,
                projectId: activeProjectId || undefined,
            };
        }
        return null;
    }, [contentMode, resources.selectedDoc, resources.selectedTheme, selectedItem, selectedPrototypePageId, viewMode, workspace.activeProjectId]);

    const currentDeepLinkUrl = useMemo(() => (
        currentDeepLinkTarget ? buildIndexDeepLinkUrl(currentDeepLinkTarget) : ''
    ), [currentDeepLinkTarget]);

    const canSyncCurrentDeepLinkUrl = shouldSyncIndexDeepLinkUrl({
        currentTarget: currentDeepLinkTarget,
        initialTarget: initialResourceDeepLink,
        initialTargetHandled: initialResourceDeepLinkHandled,
    });

    useEffect(() => {
        if (!canSyncCurrentDeepLinkUrl || !currentDeepLinkUrl || typeof window === 'undefined') {
            return;
        }
        if (window.location.href === currentDeepLinkUrl) {
            return;
        }
        window.history.replaceState(window.history.state, '', currentDeepLinkUrl);
    }, [canSyncCurrentDeepLinkUrl, currentDeepLinkUrl]);

    const handleCopyCurrentAddress = useCallback(async () => {
        const targetUrl = currentDeepLinkUrl || (typeof window !== 'undefined' ? window.location.href : '');
        if (!targetUrl) {
            messageApi.error('当前没有可复制的地址');
            return;
        }
        try {
            await copyToClipboard(targetUrl);
            messageApi.success('当前地址已复制');
        } catch (error: any) {
            messageApi.error(error?.message || '复制地址失败');
        }
    }, [currentDeepLinkUrl, messageApi]);

    const preferences = useIndexPagePreferences({
        setDefaultThemeName: resources.setDefaultThemeName,
        onProjectConfigSaved: workspace.loadProjectResources,
        onExcalidrawPropertyPanelModeLoaded: setExcalidrawPropertyPanelMode,
        onExcalidrawPropertyPanelPositionLoaded: setExcalidrawPropertyPanelPosition,
    });

    useEffect(() => {
        if (!preferences.initialPreferencesLoaded || onlineOpenAutoTriggeredRef.current) {
            return;
        }
        if (initialResourceDeepLink) {
            return;
        }
        const cachedOpenMethod = parseOpenMethod(preferences.preferredIDE);
        const cachedOnlineProvider = cachedOpenMethod ? resolveCachedOnlineOpenProvider(cachedOpenMethod) : null;
        if (cachedOnlineProvider === null) {
            return;
        }
        if (!assistantAutoOpenTargetPath) {
            return;
        }
        if (getAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey)) {
            return;
        }
        onlineOpenAutoTriggeredRef.current = true;
        assistantController.handleOpenGenieWebAgent(assistantAutoOpenTargetPath, cachedOnlineProvider);
    }, [
        assistantAutoOpenTargetPath,
        assistantAutoOpenDismissedStorageKey,
        assistantController,
        initialResourceDeepLink,
        preferences.initialPreferencesLoaded,
        preferences.preferredIDE,
    ]);

    const handleOpenGenieWebAgent = useCallback((targetPath?: string, provider?: GenieProvider) => {
        setAssistantAutoOpenDismissed(buildAssistantAutoOpenKeyForTarget(targetPath), false);
        assistantController.handleOpenGenieWebAgent(targetPath, provider);
    }, [
        assistantController,
        buildAssistantAutoOpenKeyForTarget,
    ]);

    const handleCloseWebAgentPanel = useCallback(() => {
        if (assistantController.assistantVisible) {
            setAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey, true);
        }
        assistantController.handleToggleAssistant();
    }, [
        assistantAutoOpenDismissedStorageKey,
        assistantController,
    ]);

    const handleToggleAssistantPanel = useCallback(() => {
        setAssistantAutoOpenDismissed(
            assistantAutoOpenDismissedStorageKey,
            assistantController.assistantVisible,
        );
        assistantController.handleToggleAssistant();
    }, [
        assistantAutoOpenDismissedStorageKey,
        assistantController,
    ]);

    useEffect(() => {
        workspace.ensureSidebarTreeLoaded(sidebarTab);
    }, [sidebarTab, workspace.ensureSidebarTreeLoaded, workspace.loading]);

    const resourceWriteCapabilities = workspace.projectCapabilities.resourceWrites || DEFAULT_RESOURCE_WRITE_CAPABILITIES;
    const localExportCapabilities = workspace.projectCapabilities.localExports || DEFAULT_LOCAL_EXPORT_CAPABILITIES;
    const lanAccessAllowed = workspace.projectCapabilities.lanAccessAllowed !== false;

    const ideActions = useIdeActions({
        messageApi,
        preferredIDE: preferences.preferredIDE,
        ideAvailability: preferences.ideAvailability,
        activeProjectId: workspace.activeProjectId,
        selectedItem,
        currentMarkdownResource: {
            kind: currentMarkdownResource.kind,
            item: currentMarkdownItem,
            label: currentMarkdownLabel,
        },
        selectedTheme: resources.selectedTheme,
        selectedDataTable: resources.selectedDataTable,
    });
    const openFileInIDE = ideActions.openFileInIDE;
    const prototypes = workspace.data?.prototypes;
    const docsItems = workspace.docsItems;

    const getCurrentReturnTarget = (): PendingReturnTarget => ({
        sidebarTab,
        resourceId: sidebarTab === 'prototype'
            ? selectedItem?.name ?? null
            : sidebarTab === 'document'
                ? resources.selectedDoc?.name ?? null
                : null,
        pageId: sidebarTab === 'prototype' ? selectedPrototypePageId : null,
        viewMode,
    });

    const handleStartCurrentProjectServer = async () => {
        if (startServerLoading) {
            return;
        }
        setPendingReturnTarget((previous) => previous ?? getCurrentReturnTarget());
        setStartServerError('');
        setStartServerLoading(true);
        const hide = messageApi.loading('正在启动客户端...', 0);
        try {
            const payload = await workspace.startActiveProjectServer();
            messageApi.success(payload?.reused ? '客户端已在运行' : '客户端已启动');
        } catch (error: any) {
            const message = error?.message || '启动客户端失败';
            setStartServerError(message);
            messageApi.error(message);
        } finally {
            hide();
            setStartServerLoading(false);
        }
    };

    const handleOpenCanvasInIDE = useCallback(async (canvasFilePath: string) => {
        const targetPath = canvasFilePath.trim();
        await openFileInIDE({
            filePath: targetPath,
            copyText: targetPath ? `[画布](${targetPath})` : undefined,
            emptySelectionMessage: '当前画布文件路径不可用，无法在编辑器中打开',
        });
    }, [openFileInIDE]);

    const handleOpenCanvasGenie = useCallback(async () => {
        await Promise.resolve(handleOpenGenieWebAgent());
    }, [handleOpenGenieWebAgent]);

    const switchProjectWithReturnTarget = async (projectId: string) => {
        setPendingReturnTarget(getCurrentReturnTarget());
        await workspace.switchProject(projectId);
    };

    const connectBridge = bridge.connect;
    const clearBridgeContext = bridge.clearContext;
    const disconnectBridge = bridge.disconnect;
    const assistantVisible = assistantController.assistantVisible;

    // Connect the bridge when the OpenCode panel opens;
    // disconnect when it closes. The hook handles reconnection internally.
    useEffect(() => {
        if (assistantVisible) {
            connectBridge();
        } else {
            clearBridgeContext();
            disconnectBridge();
        }
    }, [assistantVisible, connectBridge, clearBridgeContext, disconnectBridge]);

    // Auto-sync bridge context when the user's active selection changes.
    useOpenCodeBridgeSync({
        bridge,
        selectedItem,
        selectedDoc: resources.selectedDoc,
        selectedCanvas: resources.selectedCanvas,
        selectedTheme: resources.selectedTheme,
        resourceSection,
        sidebarTab,
        viewMode,
    });

    // ── Canvas → Bridge context callbacks ──
    const handleAddCanvasElementsToContext = useCallback((elements: CanvasElementContextInfo[]) => {
        if (bridge.connectionState !== 'connected') return;
        for (const info of elements) {
            const comment = [
                info.title ? `元素: ${info.title}` : `元素: ${info.type}`,
                info.annotation ? `标注: ${info.annotation}` : '',
                info.link ? `链接: ${info.link}` : '',
            ].filter(Boolean).join('\n');
            bridge.addContext({
                id: `axhub:canvas-element:${info.elementId}`,
                type: 'file',
                path: resolveOpenCodeCurrentFilePath({
                    selectedItem,
                    selectedDoc: resources.selectedDoc,
                    selectedCanvas: resources.selectedCanvas,
                    selectedTheme: resources.selectedTheme,
                    resourceSection,
                    sidebarTab,
                    viewMode,
                }) || '',
                comment,
                preview: info.title || info.type || info.elementId,
            });
        }
    }, [bridge, resourceSection, selectedItem, resources.selectedDoc, resources.selectedCanvas, resources.selectedTheme, sidebarTab, viewMode]);

    const [canvasAnnotations, setCanvasAnnotations] = useState<CanvasElementContextInfo[]>([]);
    const handleCanvasAnnotationsChange = useCallback((annotations: CanvasElementContextInfo[]) => {
        setCanvasAnnotations(annotations);
    }, []);

    // Auto-sync annotations to bridge context
    const prevSyncedAnnotationIdsRef = React.useRef<Set<string>>(new Set());
    useEffect(() => {
        const currentIds = new Set(canvasAnnotations.map(a => a.elementId));
        const prevIds = prevSyncedAnnotationIdsRef.current;

        const currentFilePath = resolveOpenCodeCurrentFilePath({
            selectedItem,
            selectedDoc: resources.selectedDoc,
            selectedCanvas: resources.selectedCanvas,
            selectedTheme: resources.selectedTheme,
            resourceSection,
            sidebarTab,
            viewMode,
        }) || '';

        syncAssistantCanvasComments(canvasAnnotations, assistantCurrentFilePath);

        if (bridge.connectionState === 'connected') {
            // Remove annotations that no longer exist
            for (const prevId of prevIds) {
                if (!currentIds.has(prevId)) {
                    bridge.removeContext(`axhub:canvas-annotation:${prevId}`);
                }
            }

            // Add or update current annotations
            for (const ann of canvasAnnotations) {
                const item = resolveOpenCodeCanvasAnnotationContext(ann, currentFilePath);
                if (!item) continue;
                if (prevIds.has(ann.elementId)) {
                    bridge.updateContext(item);
                } else {
                    bridge.addContext(item);
                }
            }
        }

        prevSyncedAnnotationIdsRef.current = currentIds;
    }, [assistantCurrentFilePath, bridge, canvasAnnotations, resourceSection, selectedItem, resources.selectedDoc, resources.selectedCanvas, resources.selectedTheme, sidebarTab, syncAssistantCanvasComments, viewMode]);

    // Handle "open in editor" from canvas embed toolbar
    useEffect(() => {
        function handleEmbedOpenInEditorDetail(detail: any) {
            if (!detail?.link) return;

            const embedLink = String(detail.link).trim();
            const embedKind = detail.kind; // 'web' | 'doc'
            const embedTitle = detail.title || '';

            // Resolve embed URL to an item with a file path
            let matchedItem: ItemData | null = null;
            if (embedKind === 'doc') {
                // Doc embeds: match by specUrl or previewUrl
                matchedItem = docsItems.find((item) =>
                    item.specUrl === embedLink || item.previewUrl === embedLink,
                ) ?? null;
            } else {
                // Prototype embeds: match by previewUrl or clientUrl
                matchedItem = (prototypes || []).find((item) =>
                    item.previewUrl === embedLink || item.clientUrl === embedLink,
                ) ?? null;
            }

            if (!matchedItem) {
                // Fallback: try matching by name substring from URL
                // e.g., /preview/my-prototype → prototypes find by name
                const urlPath = embedLink.replace(/^https?:\/\/[^/]+/, '');
                matchedItem = (prototypes || []).find((item) =>
                    urlPath.includes(item.name),
                ) ?? docsItems.find((item) =>
                    urlPath.includes(item.name),
                ) ?? null;
            }

            const filePath = getExplicitLocalPath(matchedItem);
            const basePath = filePath ? stripIndexFilePath(filePath) : '';

            void openFileInIDE({
                filePath: filePath || undefined,
                copyText: matchedItem && filePath
                    ? `[${matchedItem.displayName || embedTitle}](${basePath || filePath})`
                    : undefined,
                emptySelectionMessage: matchedItem
                    ? '当前资源未声明本地文件路径，无法在 IDE 中打开'
                    : '未找到对应的本地文件路径，无法在 IDE 中打开',
            });
        }

        const handler = (e: Event) => {
            handleEmbedOpenInEditorDetail((e as CustomEvent).detail);
        };

        const messageHandler = (event: MessageEvent) => {
            if (event.source === window) return;
            if (event.origin !== window.location.origin) return;

            const payload = event.data;
            if (payload?.type !== 'axhub:embedOpenInEditor') return;
            handleEmbedOpenInEditorDetail(payload.detail);
        };

        window.addEventListener('axhub:embedOpenInEditor', handler);
        window.addEventListener('message', messageHandler);
        return () => {
            window.removeEventListener('axhub:embedOpenInEditor', handler);
            window.removeEventListener('message', messageHandler);
        };
    }, [openFileInIDE, prototypes, docsItems]);

    const sidebarProps = useIndexPageSidebarPropsBuilder({
        state: {
            collapsed,
            loading: workspace.loading,
            sidebarTab,
            viewMode,
            data: workspace.data,
            docsItems: workspace.docsItems,
            canvasItems: workspace.canvasItems,
            themes: workspace.themes,
            searchText: workspace.searchText,
            selectedItem,
            selectedPrototypePageId,
            resourceSection,
            projectTitle: workspace.projectTitle,
            activeProjectId: workspace.activeProjectId,
            projectSetupRequired: workspace.projectSetupRequired,
            projects: workspace.projects,
            resourceWriteCapabilities,
            localExportCapabilities,
            lanAccessAllowed,
            isDarkMode,
            sidebarTrees: workspace.sidebarTrees,
            defaultThemeName: resources.defaultThemeName,
            selectedDoc: resources.selectedDoc,
            selectedCanvas: resources.selectedCanvas,
            selectedTheme: resources.selectedTheme,
            webAgentPanelOpen: assistantController.assistantVisible,
        },
        deps: {
            preferredPromptClient: preferences.preferredPromptClient,
            preferredIDE: preferences.preferredIDE,
            ideAvailability: preferences.ideAvailability,
            agentAvailability: preferences.agentAvailability,
            setPreferredIDE: preferences.setPreferredIDE,
            setIsDarkMode,
            setSettingsDialogOpen,
            setActiveTab,
            setSidebarTab,
            setViewMode,
            setResourceSection,
            setSearchText: workspace.setSearchText,
            switchProject: switchProjectWithReturnTarget,
            deleteProject: workspace.deleteProject,
            stopProjectDevServer: workspace.stopProjectDevServer,
            addProjectFromLocalPath: workspace.addProjectFromLocalPath,
            createBlankMakeProject: workspace.createBlankMakeProject,
            loadProjects: workspace.loadProjects,
            setCreateDialogVisible,
            setInitialCreateDialogTab,
            handleTabChange: selection.handleTabChange,
            handleMenuClick: selection.handleMenuClick,
            setSelectedPrototypePageId,
            handleOpenProjectInIDE: ideActions.handleOpenProjectInIDE,
            handleOpenGenieWebAgent,
            handleOpenWebAgentInPanel: assistantController.openRawUrlInAssistantPanel,
            onCloseWebAgentPanel: handleCloseWebAgentPanel,
            refreshAvailability: preferences.refreshAvailability,
            handleOpenSelectedDocInIDE: ideActions.handleOpenSelectedDocInIDE,
            handleOpenSelectedThemeInIDE: ideActions.handleOpenSelectedThemeInIDE,
            handleOpenSelectedThemeDocInIDE: ideActions.handleOpenSelectedThemeDocInIDE,
            handleCopyItemPath: ideActions.handleCopyItemPath,
            previewHandleSelectDoc: preview.handleSelectDoc,
            resources,
        },
    });

    const handleEnterSelectedPrototypePreview = useCallback(() => {
        setActiveTab('prototypes');
        setSidebarTab('prototype');
        setViewMode('demo');
    }, [setActiveTab, setSidebarTab, setViewMode]);

    const handleRefreshCanvasPrototypeItems = useCallback(async () => {
        await workspace.loadData();
        const projectId = workspace.activeProjectId?.trim();
        if (projectId) {
            const projectResponse = await fetch(`/api/projects/${encodeURIComponent(projectId)}/resources`).catch(() => null);
            if (projectResponse?.ok) {
                const payload = await projectResponse.json().catch(() => null);
                return normalizeProjectResourcesPayload(payload, projectId).prototypes;
            }
        }
        const response = await fetch('/api/entries.json').catch(() => null);
        if (!response?.ok) {
            return workspace.data.prototypes;
        }
        const body = await response.json().catch(() => null);
        return Array.isArray(body?.prototypes) ? body.prototypes : workspace.data.prototypes;
    }, [workspace]);

    const presentationAreaProps = useIndexPagePresentationPropsBuilder({
        state: {
            collapsed,
            selectedItem,
            viewMode,
            activeTab,
            assistantVisible: assistantController.assistantVisible,
            isDarkMode,
            contentMode,
            docsItems: workspace.docsItems,
            selectedDoc: resources.selectedDoc,
            selectedResourceFolder: resources.selectedResourceFolder,
            selectedTemplate: resources.selectedTemplate,
            selectedCanvas: resources.selectedCanvas,
            selectedTheme: resources.selectedTheme,
            selectedDataTable: resources.selectedDataTable,
            preferredPromptClient: preferences.preferredPromptClient,
            preferredIDE: preferences.preferredIDE,
            ideAvailability: preferences.ideAvailability,
            agentAvailability: preferences.agentAvailability,
            projectRuntimeStatus: workspace.projectRuntimeStatus,
            projectRuntimeStatusLoading: workspace.projectRuntimeStatusLoading,
            projectAccessDeniedReason: workspace.projectAccessDeniedReason,
            projectSetupRequired: workspace.projectSetupRequired,
            lanAccessAllowed,
            hasPrototypeItems: workspace.data.prototypes.length > 0,
            hasDocItems: workspace.docsItems.length > 0,
            excalidrawPropertyPanelMode,
            excalidrawPropertyPanelPosition,
            bridgeConnected: bridge.connectionState === 'connected',
            activeProjectId: workspace.activeProjectId,
            webAgentPanelOpen: assistantController.assistantVisible,
            assistantApiBaseUrl: assistantController.assistantApiBaseUrl,
            assistantProjectPath: assistantController.assistantProjectPath,
            prototypes: workspace.data.prototypes,
            themes: workspace.themes,
            defaultThemeName: resources.defaultThemeName,
        },
        preview,
        actions: {
            setCollapsed,
            setViewMode,
            handleEnterSelectedPrototypePreview,
            handleToggleAssistant: handleToggleAssistantPanel,
            handleStartCurrentProjectServer,
            handleOpenIdeFile: ideActions.handleOpenIdeFile,
            handleOpenSelectedDocInIDE: ideActions.handleOpenSelectedDocInIDE,
            handleOpenSelectedThemeInIDE: ideActions.handleOpenSelectedThemeInIDE,
            handleOpenSelectedThemeDocInIDE: ideActions.handleOpenSelectedThemeDocInIDE,
            handleOpenSelectedDataTableInIDE: ideActions.handleOpenSelectedDataTableInIDE,
            handleCopyCurrentAddress,
            onSelectResourceFolder: resources.handleSelectResourceFolder,
            onSelectResourceFolderItem: (item) => {
                preview.handleSelectDoc(item);
                setViewMode('demo');
            },
            onOpenResourceFolderInSystem: resources.handleOpenResourceFolderInSystem,
            setExcalidrawPropertyPanelMode: handleExcalidrawPropertyPanelModeChange,
            setExcalidrawPropertyPanelPosition: handleExcalidrawPropertyPanelPositionChange,
            onAddCanvasElementToContext: handleAddCanvasElementsToContext,
            onCanvasAnnotationsChange: handleCanvasAnnotationsChange,
            onOpenCanvasInIDE: handleOpenCanvasInIDE,
            onOpenCanvasGenie: handleOpenCanvasGenie,
            handleOpenProjectInIDE: ideActions.handleOpenProjectInIDE,
            onOpenGenieWebAgent: handleOpenGenieWebAgent,
            onOpenWebAgentInPanel: assistantController.openRawUrlInAssistantPanel,
            onCloseWebAgentPanel: handleCloseWebAgentPanel,
            onPreferredIDEChange: preferences.setPreferredIDE,
            onRefreshAvailability: preferences.refreshAvailability,
            onRefreshPrototypes: handleRefreshCanvasPrototypeItems,
        },
        ui: {
            startServerLoading,
            startServerError,
        },
    });

    const handleMobileItemClick = (item: ItemData) => {
        const targetUrl = resolveMobileItemOpenUrl(item);
        if (!targetUrl) {
            return;
        }
        window.open(targetUrl, '_blank');
    };

    const assistantPanelProps = {
        mounted: assistantController.assistantPanelMounted,
        visible: assistantController.assistantVisible,
        width: assistantController.assistantPanelWidth,
        minWidth: assistantController.assistantPanelMinWidth,
        maxWidth: assistantController.assistantPanelMaxWidth,
        iframeSrc: assistantController.assistantIframeSrc,
        iframeRef: assistantController.assistantIframeRef,
        onLoad: assistantController.handleAssistantIframeLoad,
        onResize: assistantController.setAssistantPanelWidth,
    };

    const dialogsProps = {
        docReferencePromptDialog: resources.docReferencePromptDialog,
        setDocReferencePromptDialog: resources.setDocReferencePromptDialog,
        preferredPromptClient: preferences.preferredPromptClient,
        preferredIDE: preferences.preferredIDE,
        ideAvailability: preferences.ideAvailability,
        createDialog: {
            visible: createDialogVisible,
            activeTab: selection.activeTab,
            selectedThemes,
            availableThemes,
            selectedDocs,
            availableDocs,
            selectedDataAssets,
            availableDataAssets,
            initialTab: initialCreateDialogTab,
            resourceWriteCapabilities,
            ideAvailability: preferences.ideAvailability,
            onClose: handleCreateCancel,
            setSelectedDocs,
            setSelectedThemes,
            setSelectedDataAssets,
            buildPrompt,
            onAfterCreatePromptAction: clearCreateDialogState,
            onUploadSuccess: resources.handleCreateDialogUploadSuccess,
        },
        createThemeDialog: {
            visible: resources.themeCreateDialogVisible,
            initialTab: resources.initialThemeDialogTab,
            selectedDocs: resources.selectedThemeDocRefs,
            availableDocs: availableDocOptions,
            selectedReferencePages: resources.selectedThemeReferencePages,
            availableReferencePages: availablePrototypeOptions,
            resourceWriteCapabilities,
            ideAvailability: preferences.ideAvailability,
            onClose: resources.handleThemeCreateCancel,
            setSelectedDocs: resources.setSelectedThemeDocRefs,
            setSelectedReferencePages: resources.setSelectedThemeReferencePages,
            buildCreateThemePrompt: resources.buildThemePrompt,
            onAfterCreatePromptAction: resources.clearThemeCreateDialogState,
            onImportSuccess: resources.refreshSidebarAssets,
        },
        exportDialog: {
            open: preview.isExportModalOpen,
            preferencesStorageKey: preview.exportPreferencesStorageKey,
            imageConfig: preview.imageConfig,
            axureCopyOptions: preview.axureCopyOptions,
            isExporting: preview.isExporting,
            activeTab: selection.activeTab,
            itemName: selection.selectedItem?.name,
            sourceTargetPath: stripIndexFilePath(getExplicitLocalPath(selection.selectedItem)),
            initialReviewResult: preview.pendingExportReviewResult,
            exportAvailability: preview.exportAvailability,
            ideAvailability: preferences.ideAvailability,
            onClose: () => preview.setIsExportModalOpen(false),
            onInitialReviewHandled: () => preview.setPendingExportReviewResult(null),
            setImageConfig: preview.setImageConfig as any,
            setAxureCopyOptions: preview.setAxureCopyOptions,
            onDimensionChange: preview.handleDimensionChange,
            onSwapDimensions: preview.handleSwapDimensions,
            onDimensionBlur: preview.handleDimensionBlur,
            onExport: preview.handleExport,
            onCopyRuntimeComponent: preview.handleCopyRuntimeComponent,
            onCopyToAxure: preview.handleCopyToAxure,
            onCopyConfig: preview.handleCopyConfig,
        },
        figmaMakeExportDialog: {
            open: preview.isFigmaMakeExportDialogOpen,
            itemName: selection.selectedItem?.name,
            itemDisplayName: selection.selectedItem?.displayName,
            targetPath: selection.selectedItem ? getSelectedResourceTargetPath(selection.selectedItem) : '',
            ideTargetPath: stripIndexFilePath(getExplicitLocalPath(selection.selectedItem)),
            onOpenChange: preview.setIsFigmaMakeExportDialogOpen,
            onDownloadSuccess: preview.handleFigmaMakeExportDownloadSuccess,
            onDownloadFailure: preview.handleFigmaMakeExportDownloadFailure,
        },
        cloudPublishSettingsDialog: {
            open: preview.cloudPublishSettingsOpen,
            initialTarget: preview.cloudPublishSettingsInitialTarget,
            onOpenChange: preview.setCloudPublishSettingsOpen,
            onSaved: () => undefined,
        },
        settingsDialogOpen,
        setSettingsDialogOpen,
        onSettingsSaved: preferences.handleSettingsSaved,
        excalidrawPropertyPanelMode,
        setExcalidrawPropertyPanelMode,
        excalidrawPropertyPanelPosition,
        setExcalidrawPropertyPanelPosition,
        versionDialogVisible: resources.versionDialogVisible,
        setVersionDialogVisible: resources.setVersionDialogVisible,
        currentVersionItem: resources.currentVersionItem,
        versionActiveTab: selection.activeTab,
    };

    const mobileProps = {
        loading: workspace.loading,
        items: workspace.data.prototypes,
        searchText: workspace.searchText,
        assistantVisible: assistantController.assistantVisible,
        onSearchTextChange: workspace.setSearchText,
        onCopyProjectDirectory: assistantController.handleCopyProjectDirectory,
        onOpenAssistant: assistantController.handleOpenAssistantInNewWindowNoContext,
        onOpenItem: handleMobileItemClick,
        onOpenAssistantWithItemContext: assistantController.handleOpenAssistantWithItemContext,
    };

    return (
        <IndexPageLayout
            sidebarProps={sidebarProps}
            presentationAreaProps={presentationAreaProps}
            assistantPanelProps={assistantPanelProps}
            dialogsProps={dialogsProps}
            mobileProps={mobileProps}
        />
    );
}
