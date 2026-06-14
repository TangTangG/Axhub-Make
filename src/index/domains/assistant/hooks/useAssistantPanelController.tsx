import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type {
    CanvasItem,
    AssistantContextV1,
    ItemData,
    PromptClientPreference,
    TabType,
    ViewMode,
} from '../../../types';
import type { DataTableResourceItem, ThemeResourceItem } from '../../../domains/resources/resource.types';
import { apiService } from '../../../services/index.api';
import { ASSISTANT_OPEN_URL_EVENT, STORAGE_KEY_ASSISTANT_WIDTH } from '../../../constants';
import {
    type AssistantContentMode,
    type AssistantMarkdownResourceSelection,
    buildAssistantContextWithCanvasComments,
    buildAssistantCurrentFileSyncContext,
    getAssistantCanvasCommentsSignature,
    getAssistantContextCurrentFilePath,
    mergeAssistantContextForActiveFile,
    resolveAssistantCurrentFile,
    shouldSyncAssistantCurrentFile,
} from '../../../utils/genieContext';
import type { CanvasElementContextInfo } from '../../../components/content/canvas-embeds/AnnotationOverlay';
import { useAssistantBridge } from './useAssistantBridge';
import { useAssistantRuntime } from './useAssistantRuntime';
import {
    type AcpContextItem,
    type AssistantImageGenerationConfig,
    buildAcpContextPostMessage,
    getAcpCanvasMcpConfigSignature,
    getAcpImageGenerationConfigSignature,
} from '../assistantAcpContext';
import { buildAssistantContextItemsFromCanvasElements, type AssistantImageAttachmentPayload } from '../assistantContextPayload';
import {
    getAssistantResourceThreadId,
    getAssistantResourceThreadIdWithFallback,
    setAssistantResourceThreadId,
} from '../assistantResourceThread';
import {
    getGenieCurrentFilePath,
    mergeGenieContextV1,
    normalizeGenieCurrentFileV1,
} from '@/common/genie/bridge';
import type { GenieProvider } from '@/common/genie/types';

type AssistantTriggerSource = 'button' | 'event';
type AssistantRuntimeState = Awaited<ReturnType<typeof apiService.getAssistantRuntime>>;
type EnsureAssistantOpenOptions = {
    loadingText?: string | false;
    suppressResourceThreadBinding?: boolean;
    openSettingsOnFailure?: boolean;
};
type OpenAssistantSubmitOptions = {
    forceNewThread?: boolean;
};
type AcpNavigationChangedMessage = {
    href: string;
    threadId?: string | null;
};
type AssistantCanvasMcpRuntimeConfig = {
    makeOrigin: string;
    token: string;
};

const ACP_NAVIGATION_CHANGED_EVENT = 'acp.navigation.changed';

const LEGACY_ASSISTANT_OPEN_PARAMS = [
    'context',
    'prompt',
    'provider',
    'model',
    'modeId',
    'thoughtLevel',
    'permissionMode',
    'integrationWs',
    'integrationClientId',
    'integrationChannel',
    'genieApiBaseUrl',
    'genieIntegrationChannel',
    'genieTargetClientId',
    'editorClientId',
    'editorIntegrationWs',
    'editorApiBaseUrl',
    'editorIntegrationChannel',
    'editorSessionId',
    'editorMobileMode',
    'slashCommands',
] as const;

function removeLegacyAssistantOpenParams(url: URL): void {
    for (const paramName of LEGACY_ASSISTANT_OPEN_PARAMS) {
        url.searchParams.delete(paramName);
    }
}

function readAcpNavigationChangedMessage(data: unknown): AcpNavigationChangedMessage | null {
    if (!data || typeof data !== 'object') {
        return null;
    }

    const record = data as { type?: unknown; payload?: unknown };
    if (record.type !== ACP_NAVIGATION_CHANGED_EVENT || !record.payload || typeof record.payload !== 'object') {
        return null;
    }

    const payload = record.payload as { href?: unknown; threadId?: unknown };
    const href = typeof payload.href === 'string' ? payload.href.trim() : '';
    if (!href) {
        return null;
    }

    const threadId = typeof payload.threadId === 'string'
        ? payload.threadId.trim() || null
        : payload.threadId === null
            ? null
            : undefined;

    return {
        href,
        ...(threadId !== undefined ? { threadId } : {}),
    };
}

function resolveAcpNavigationThreadId(navigationUrl: string): string | null {
    try {
        const url = new URL(navigationUrl);
        const match = url.pathname.match(/^\/thread\/([^/]+)\/?$/u);
        if (!match) {
            return null;
        }
        try {
            return decodeURIComponent(match[1]).trim() || null;
        } catch {
            return match[1]?.trim() || null;
        }
    } catch {
        return null;
    }
}

function waitForAssistantPanelPaint(): Promise<void> {
    return new Promise((resolve) => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
        });
    });
}

function isUntitledPrototypeName(value: string): boolean {
    return /^untitled(?:-[a-z0-9-]+)?$/u.test(value.trim());
}

function resolveAssistantFallbackResourcePathFromUrl(targetPath?: string): string {
    const normalizedTargetPath = String(targetPath || '').trim().replace(/\\/g, '/');
    if (!normalizedTargetPath.match(/^src\/prototypes\/[^/]+\/canvas\.excalidraw$/u)) {
        return '';
    }
    if (typeof window === 'undefined') {
        return '';
    }

    try {
        const url = new URL(window.location.href);
        const fromP = String(url.searchParams.get('fromP') || '').trim();
        if (!fromP || !isUntitledPrototypeName(fromP)) {
            return '';
        }
        return `src/prototypes/${fromP}/canvas.excalidraw`;
    } catch {
        return '';
    }
}

function isAssistantCanvasMcpContext(context: AssistantContextV1): boolean {
    const currentFilePath = getAssistantContextCurrentFilePath(context).replace(/\\/g, '/');
    return /^src\/prototypes\/[^/]+\/canvas\.excalidraw$/u.test(currentFilePath);
}

function getAssistantCanvasMcpRuntimeConfig(context: AssistantContextV1): AssistantCanvasMcpRuntimeConfig | null {
    if (!isAssistantCanvasMcpContext(context) || typeof window === 'undefined') {
        return null;
    }
    const token = String((window as unknown as Record<string, unknown>).__AXHUB_CANVAS_MCP_TOKEN__ || '').trim();
    if (!token) {
        return null;
    }
    return {
        makeOrigin: window.location.origin,
        token,
    };
}

interface AssistantMessageApi {
    success: (content: string) => void;
    error: (content: string) => void;
    warning: (content: string) => void;
    info: (content: string) => void;
    loading: (content: string, duration?: number) => () => void;
}

interface AssistantModalApi {
    confirm: (config: any) => void;
}

interface OpenAssistantUrlEventDetail {
    url?: string;
    targetPath?: string;
}

interface ResolvedAssistantUrl {
    url: string;
    resourceThreadStoragePath: string;
}

interface UseAssistantPanelControllerParams {
    messageApi: AssistantMessageApi;
    modal: AssistantModalApi;
    preferredPromptClient: PromptClientPreference;
    onOpenAISettings?: (runtime?: AssistantRuntimeState | null, message?: string) => void;
    activeProjectId: string | null;
    activeTab: TabType;
    viewMode: ViewMode;
    selectedItem: ItemData | null;
    contentMode: AssistantContentMode;
    currentMarkdownResource: AssistantMarkdownResourceSelection;
    assistantImageGenerationConfig?: AssistantImageGenerationConfig | null;
    currentCanvas?: CanvasItem | null;
    currentTheme?: ThemeResourceItem | null;
    currentDataTable?: DataTableResourceItem | null;
}

export function useAssistantPanelController({
    messageApi,
    modal: _modal,
    onOpenAISettings,
    activeProjectId,
    activeTab,
    viewMode,
    selectedItem,
    contentMode,
    currentMarkdownResource,
    assistantImageGenerationConfig = null,
    currentCanvas = null,
    currentTheme = null,
    currentDataTable = null,
}: UseAssistantPanelControllerParams) {
    const ASSISTANT_RUNTIME_UI_LOG_PREFIX = '[assistant-runtime-ui]';
    const DEFAULT_ASSISTANT_WEB_BASE_URL = 'http://localhost:32123';
    const DEFAULT_ASSISTANT_INSTALL_CMD = 'npx -y @axhub/acp --port 32123';
    const DEFAULT_ASSISTANT_PANEL_WIDTH = 320;
    const MIN_ASSISTANT_PANEL_WIDTH = 320;
    const MAX_ASSISTANT_PANEL_WIDTH = 640;
    const projectId = activeProjectId?.trim() || undefined;
    const DEFAULT_ASSISTANT_RUNTIME_STATE: AssistantRuntimeState = {
        webBaseUrl: DEFAULT_ASSISTANT_WEB_BASE_URL,
        apiBaseUrl: `${DEFAULT_ASSISTANT_WEB_BASE_URL}/api`,
        projectPath: '',
        source: 'default',
        health: {
            status: 'runtime_unreachable',
            message: 'AI 助手不可用，请先启动 AI 助手。',
            checkedAt: new Date().toISOString(),
            commandSource: 'default',
            hints: {
                installGlobal: DEFAULT_ASSISTANT_INSTALL_CMD,
                start: DEFAULT_ASSISTANT_INSTALL_CMD,
                status: 'curl http://localhost:32123/api/chat',
            },
        },
    };

    const [assistantVisible, setAssistantVisible] = useState(false);
    const [assistantPanelMounted, setAssistantPanelMounted] = useState(false);
    const [assistantPanelWidth, setAssistantPanelWidth] = useState<number>(() => {
        const saved = localStorage.getItem(STORAGE_KEY_ASSISTANT_WIDTH);
        const parsed = saved ? Number(saved) : Number.NaN;
        if (Number.isFinite(parsed) && parsed >= MIN_ASSISTANT_PANEL_WIDTH) {
            return Math.min(parsed, MAX_ASSISTANT_PANEL_WIDTH);
        }
        return DEFAULT_ASSISTANT_PANEL_WIDTH;
    });
    const [assistantIframeOverrideUrl, setAssistantIframeOverrideUrl] = useState<string | null>(null);
    const [assistantPanelMode, setAssistantPanelMode] = useState<'assistant' | 'external'>('assistant');
    const [assistantExternalContext, setAssistantExternalContext] = useState<AssistantContextV1 | null>(null);
    const assistantCurrentFilePathRef = useRef('');
    const assistantContextCommentsSignatureRef = useRef('');
    const assistantIframeLoadSyncSignatureRef = useRef('');
    const assistantImageGenerationConfigSyncSignatureRef = useRef('');
    const assistantCanvasMcpConfigSyncSignatureRef = useRef('');
    const assistantIframeCurrentUrlRef = useRef('');
    const latestAssistantSyncContextRef = useRef<AssistantContextV1 | null>(null);
    const latestAssistantResourcePathRef = useRef('');
    const latestAssistantNavigationThreadIdRef = useRef<string | null | undefined>(undefined);
    const assistantResourceThreadBindingSuppressedRef = useRef(false);
    const previousAssistantProjectIdRef = useRef(projectId || '');
    const {
        runtime: assistantRuntime,
        setRuntime: setAssistantRuntime,
        checking: assistantChecking,
        setChecking: setAssistantChecking,
        refreshRuntime,
    } = useAssistantRuntime({
        defaultRuntime: DEFAULT_ASSISTANT_RUNTIME_STATE,
        projectId,
    });

    const buildAssistantIframeUrlForRuntime = useCallback((runtime?: AssistantRuntimeState | null) => {
        const webBaseUrl = (runtime?.webBaseUrl || DEFAULT_ASSISTANT_WEB_BASE_URL).replace(/\/+$/g, '');
        const url = new URL(`${webBaseUrl}/`);
        const projectPath = runtime?.projectPath || '';
        if (projectPath) {
            url.searchParams.set('cwd', projectPath);
        }
        return url.toString();
    }, []);

    const assistantIframeUrl = useMemo(() => (
        buildAssistantIframeUrlForRuntime(assistantRuntime)
    ), [assistantRuntime, buildAssistantIframeUrlForRuntime]);

    const assistantIframeSrc = assistantIframeOverrideUrl || assistantIframeUrl;
    const assistantSupportsAcpContext = assistantPanelMode === 'assistant';
    const assistantContextAppendAvailable = assistantSupportsAcpContext && assistantVisible;

    useEffect(() => {
        assistantIframeCurrentUrlRef.current = assistantIframeSrc;
    }, [assistantIframeSrc]);

    const handleAssistantActiveThreadChange = useCallback((threadId: string | null | undefined) => {
        if (assistantResourceThreadBindingSuppressedRef.current) {
            return;
        }
        const resourcePath = latestAssistantResourcePathRef.current;
        if (!resourcePath) {
            return;
        }
        setAssistantResourceThreadId({
            projectScope: projectId || assistantRuntime?.projectPath || '',
            resourcePath,
        }, threadId);
    }, [
        assistantRuntime?.projectPath,
        projectId,
    ]);
    const assistantBridgeOptions = useMemo(() => ({
        onActiveThreadChanged: handleAssistantActiveThreadChange,
    }), [handleAssistantActiveThreadChange]);

    const {
        iframeRef: assistantIframeRef,
        iframeLoaded: assistantIframeLoaded,
        setIframeLoaded: setAssistantIframeLoaded,
        syncContext: postAssistantContextToIframe,
        syncContextWithRetry: postAssistantContextToIframeWithRetry,
        addContextItems: postAssistantContextItemsToIframe,
        syncImageGenerationConfigWithRetry: postAssistantImageGenerationConfigToIframeWithRetry,
        syncCanvasMcpConfigWithRetry: postAssistantCanvasMcpConfigToIframeWithRetry,
        addImageAttachmentWithRetry,
        appendComposerTextWithRetry,
        submitPromptWithRetry,
        waitForReady: waitForAssistantIframeReady,
    } = useAssistantBridge(assistantIframeSrc, assistantBridgeOptions);

    const resolveAssistantNavigationUrl = useCallback((href: string) => {
        const baseUrl = assistantIframeCurrentUrlRef.current || assistantIframeSrc || assistantIframeUrl;
        try {
            const navigationUrl = new URL(href, baseUrl);
            const assistantUrl = new URL(baseUrl, window.location.origin);
            if (navigationUrl.origin !== assistantUrl.origin) {
                return '';
            }
            return navigationUrl.toString();
        } catch {
            return '';
        }
    }, [
        assistantIframeSrc,
        assistantIframeUrl,
    ]);

    const resolveAssistantMessageOrigin = useCallback(() => {
        const baseUrl = assistantIframeCurrentUrlRef.current || assistantIframeSrc || assistantIframeUrl;
        try {
            return new URL(baseUrl, window.location.origin).origin;
        } catch {
            return '';
        }
    }, [
        assistantIframeSrc,
        assistantIframeUrl,
    ]);

    useEffect(() => {
        const handleAssistantNavigationChanged = (event: MessageEvent) => {
            if (!assistantSupportsAcpContext) {
                return;
            }
            if (event.source !== assistantIframeRef.current?.contentWindow) {
                return;
            }
            const assistantOrigin = resolveAssistantMessageOrigin();
            if (assistantOrigin && event.origin !== assistantOrigin) {
                return;
            }

            const navigation = readAcpNavigationChangedMessage(event.data);
            if (!navigation) {
                return;
            }

            const navigationUrl = resolveAssistantNavigationUrl(navigation.href);
            if (!navigationUrl) {
                return;
            }

            assistantIframeCurrentUrlRef.current = navigationUrl;
            const navigationThreadId = navigation.threadId ?? resolveAcpNavigationThreadId(navigationUrl);
            latestAssistantNavigationThreadIdRef.current = navigationThreadId;
            handleAssistantActiveThreadChange(navigationThreadId);
        };

        window.addEventListener('message', handleAssistantNavigationChanged);
        return () => {
            window.removeEventListener('message', handleAssistantNavigationChanged);
        };
    }, [
        assistantIframeRef,
        assistantSupportsAcpContext,
        handleAssistantActiveThreadChange,
        resolveAssistantMessageOrigin,
        resolveAssistantNavigationUrl,
    ]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_ASSISTANT_WIDTH, String(Math.round(assistantPanelWidth)));
    }, [assistantPanelWidth]);

    const syncAssistantContextToTargets = useCallback((
        context: AssistantContextV1,
        mode: 'replace' | 'append' = 'replace',
        options: {
            retryIframe?: boolean;
        } = {},
    ) => {
        latestAssistantSyncContextRef.current = context;

        if (assistantSupportsAcpContext && assistantVisible && assistantIframeLoaded && assistantIframeRef.current?.contentWindow) {
            if (options.retryIframe ?? mode === 'replace') {
                postAssistantContextToIframeWithRetry(context, mode);
            } else {
                postAssistantContextToIframe(context, mode);
            }
        }
    }, [
        assistantIframeLoaded,
        assistantIframeRef,
        assistantSupportsAcpContext,
        assistantVisible,
        postAssistantContextToIframe,
        postAssistantContextToIframeWithRetry,
    ]);

    const syncAssistantImageGenerationConfigToIframe = useCallback((options: { requireLoaded?: boolean } = {}) => {
        const requireLoaded = options.requireLoaded !== false;
        if (
            !assistantSupportsAcpContext
            || !assistantVisible
            || (requireLoaded && !assistantIframeLoaded)
            || !assistantIframeRef.current?.contentWindow
        ) {
            return;
        }

        const imageConfigSignature = getAcpImageGenerationConfigSignature(assistantImageGenerationConfig);
        if (assistantImageGenerationConfigSyncSignatureRef.current === imageConfigSignature) {
            return;
        }

        assistantImageGenerationConfigSyncSignatureRef.current = imageConfigSignature;
        postAssistantImageGenerationConfigToIframeWithRetry(assistantImageGenerationConfig);
    }, [
        assistantIframeLoaded,
        assistantIframeRef,
        assistantImageGenerationConfig,
        assistantSupportsAcpContext,
        assistantVisible,
        postAssistantImageGenerationConfigToIframeWithRetry,
    ]);

    const syncAssistantCanvasMcpConfigToIframe = useCallback((options: { requireLoaded?: boolean } = {}) => {
        const requireLoaded = options.requireLoaded !== false;
        if (
            !assistantSupportsAcpContext
            || !assistantVisible
            || (requireLoaded && !assistantIframeLoaded)
            || !assistantIframeRef.current?.contentWindow
        ) {
            return;
        }

        const canvasMcpConfig = getAssistantCanvasMcpRuntimeConfig(assistantContextV1);
        const canvasMcpConfigSignature = getAcpCanvasMcpConfigSignature(canvasMcpConfig);
        if (assistantCanvasMcpConfigSyncSignatureRef.current === canvasMcpConfigSignature) {
            return;
        }

        assistantCanvasMcpConfigSyncSignatureRef.current = canvasMcpConfigSignature;
        postAssistantCanvasMcpConfigToIframeWithRetry(canvasMcpConfig);
    }, [
        assistantContextV1,
        assistantIframeLoaded,
        assistantIframeRef,
        assistantSupportsAcpContext,
        assistantVisible,
        postAssistantCanvasMcpConfigToIframeWithRetry,
    ]);

    const postAssistantContextToWindowWithRetry = useCallback((
        targetWindow: Window | null,
        targetUrl: string,
        context: AssistantContextV1 | null | undefined,
    ) => {
        if (!targetWindow || !context) {
            return;
        }

        let targetOrigin = '*';
        try {
            targetOrigin = new URL(targetUrl, window.location.origin).origin;
        } catch {
            // Keep wildcard only for malformed URLs that still opened.
        }

        const postContext = () => {
            try {
                targetWindow.postMessage(buildAcpContextPostMessage(context, 'replace'), targetOrigin);
            } catch (error) {
                console.warn(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} child window context sync failed`, error);
            }
        };

        postContext();
        window.setTimeout(postContext, 160);
        window.setTimeout(postContext, 520);
        window.setTimeout(postContext, 1200);
    }, []);

    const assistantBaseContextV1 = useMemo<AssistantContextV1>(() => {
        const currentFile = resolveAssistantCurrentFile({
            selectedItem,
            activeTab,
            viewMode,
            contentMode,
            currentMarkdownResource,
            currentCanvas,
            currentTheme,
            currentDataTable,
        });
        const currentFilePath = getGenieCurrentFilePath(currentFile);
        const currentFileDirectory = currentFilePath.replace(/\/[^/]+$/u, '');
        const currentMarkdownItem = currentMarkdownResource.item;
        const selectedResource = contentMode === 'doc' || contentMode === 'template'
            ? currentMarkdownItem
            : selectedItem;

        return {
            version: '1',
            systemContext: '',
            currentFile,
            selectedElements: [],
            extensions: {
                source: 'axhub-runtime',
                projectPath: assistantRuntime?.projectPath || '',
                viewMode,
                activeTab,
                contentMode,
                selectedItem: selectedResource
	                    ? {
	                        name: selectedResource.name,
	                        displayName: selectedResource.displayName,
	                        clientUrl: selectedResource.clientUrl,
	                        previewUrl: selectedResource.previewUrl,
	                        specUrl: selectedResource.specUrl,
	                    }
                    : null,
                paths: {
                    currentFilePath,
                    currentFileDirectory,
                },
                updatedAt: new Date().toISOString(),
            },
        };
    }, [
        activeTab,
        assistantRuntime?.projectPath,
        contentMode,
        currentCanvas,
        currentDataTable,
        currentMarkdownResource,
        currentTheme,
        selectedItem,
        viewMode,
    ]);

    const assistantContextV1 = useMemo<AssistantContextV1>(() => (
        mergeAssistantContextForActiveFile(assistantBaseContextV1, assistantExternalContext)
    ), [assistantBaseContextV1, assistantExternalContext]);

    useEffect(() => {
        if (assistantResourceThreadBindingSuppressedRef.current) {
            return;
        }
        latestAssistantResourcePathRef.current = getAssistantContextCurrentFilePath(assistantContextV1);
    }, [assistantContextV1]);

    const buildAssistantContextForItem = useCallback((
        item: ItemData,
        options?: {
            viewMode?: ViewMode;
            activeTab?: TabType;
            externalContext?: AssistantContextV1 | null;
        },
    ): AssistantContextV1 => {
        const resolvedViewMode = options?.viewMode ?? 'demo';
        const resolvedActiveTab = options?.activeTab ?? activeTab;
        const currentFile = resolveAssistantCurrentFile({
            selectedItem: item,
            activeTab: resolvedActiveTab,
            viewMode: resolvedViewMode,
            contentMode: 'preview',
            currentMarkdownResource: { kind: 'doc', item: null },
        });
        const currentFilePath = getGenieCurrentFilePath(currentFile);
        const currentFileDirectory = currentFilePath.replace(/\/[^/]+$/u, '');

        const baseContext: AssistantContextV1 = {
            version: '1',
            systemContext: '',
            currentFile,
            selectedElements: [],
            extensions: {
                source: 'axhub-runtime',
                projectPath: assistantRuntime?.projectPath || '',
                viewMode: resolvedViewMode,
                activeTab: resolvedActiveTab,
	                selectedItem: {
	                    name: item.name,
	                    displayName: item.displayName,
	                    clientUrl: item.clientUrl,
	                    previewUrl: item.previewUrl,
	                    specUrl: item.specUrl,
	                },
                paths: {
                    currentFilePath,
                    currentFileDirectory,
                },
                updatedAt: new Date().toISOString(),
            },
        };

        const externalContext = options?.externalContext;
        if (!externalContext) {
            return baseContext;
        }

        return mergeGenieContextV1(baseContext, externalContext) ?? baseContext;
    }, [activeTab, assistantRuntime?.projectPath]);

    useEffect(() => {
        const nextCurrentFilePath = getAssistantContextCurrentFilePath(assistantBaseContextV1);
        const previousCurrentFilePath = assistantCurrentFilePathRef.current;
        const nextContext = buildAssistantCurrentFileSyncContext(assistantBaseContextV1);

        assistantCurrentFilePathRef.current = nextCurrentFilePath;

        if (!shouldSyncAssistantCurrentFile(previousCurrentFilePath, nextCurrentFilePath)) {
            return;
        }

        setAssistantExternalContext((prev) => {
            if (!prev) {
                return prev;
            }

            const normalizedCurrentFile = normalizeGenieCurrentFileV1(assistantBaseContextV1.currentFile);
            if (getGenieCurrentFilePath(prev.currentFile) !== normalizedCurrentFile.path) {
                return null;
            }
            if (
                prev.selectedElements.length === 0
            ) {
                return prev;
            }

            return {
                ...prev,
                currentFile: normalizedCurrentFile,
                selectedElements: [],
            };
        });

        syncAssistantContextToTargets(nextContext, 'replace', {
            retryIframe: true,
        });
    }, [
        assistantBaseContextV1,
        syncAssistantContextToTargets,
    ]);

    useEffect(() => {
        syncAssistantContextToTargets(assistantContextV1, 'replace');
    }, [assistantContextV1, syncAssistantContextToTargets]);

    useEffect(() => {
        syncAssistantImageGenerationConfigToIframe();
    }, [syncAssistantImageGenerationConfigToIframe]);

    useEffect(() => {
        syncAssistantCanvasMcpConfigToIframe();
    }, [syncAssistantCanvasMcpConfigToIframe]);

    useEffect(() => {
        if (!assistantSupportsAcpContext || !assistantVisible || !assistantIframeLoaded) {
            return;
        }

        const contextSignature = JSON.stringify(assistantContextV1);
        if (assistantIframeLoadSyncSignatureRef.current === contextSignature) {
            return;
        }

        assistantIframeLoadSyncSignatureRef.current = contextSignature;
        syncAssistantContextToTargets(assistantContextV1, 'replace', {
            retryIframe: true,
        });
    }, [
        assistantContextV1,
        assistantIframeLoaded,
        assistantSupportsAcpContext,
        assistantVisible,
        syncAssistantContextToTargets,
    ]);

    const resolveAssistantThreadLandingUrl = useCallback((
        sourceUrl: string,
        targetPath?: string,
        runtimeOverride?: AssistantRuntimeState | null,
    ): ResolvedAssistantUrl => {
        const resourceThreadStoragePath = String(targetPath || '').trim();
        if (!targetPath) {
            return {
                url: sourceUrl,
                resourceThreadStoragePath,
            };
        }

        const runtimeForUrl = runtimeOverride || assistantRuntime;
        const projectScope = projectId || runtimeForUrl?.projectPath || '';
        const fallbackResourcePath = resolveAssistantFallbackResourcePathFromUrl(targetPath);
        const threadId = getAssistantResourceThreadId({
            projectScope,
            resourcePath: targetPath,
        });
        const resolvedThreadId = threadId || getAssistantResourceThreadIdWithFallback({
            projectScope,
            resourcePath: targetPath,
            fallbackResourcePath,
        });
        if (!resolvedThreadId) {
            return {
                url: sourceUrl,
                resourceThreadStoragePath,
            };
        }
        const resolvedResourceThreadStoragePath = threadId
            ? resourceThreadStoragePath
            : fallbackResourcePath || resourceThreadStoragePath;

        try {
            const parsedUrl = new URL(sourceUrl, window.location.origin);
            parsedUrl.pathname = `/thread/${encodeURIComponent(resolvedThreadId)}`;
            return {
                url: parsedUrl.toString(),
                resourceThreadStoragePath: resolvedResourceThreadStoragePath,
            };
        } catch {
            return {
                url: sourceUrl,
                resourceThreadStoragePath,
            };
        }
    }, [
        assistantRuntime,
        projectId,
    ]);

    const resolveAssistantUrl = useCallback((
        targetUrl?: string,
        targetPath?: string,
        runtimeOverride?: AssistantRuntimeState | null,
    ) => {
        const runtimeForUrl = runtimeOverride || assistantRuntime;
        const sourceUrl = targetUrl || buildAssistantIframeUrlForRuntime(runtimeForUrl);
        let nextUrl = sourceUrl;

        try {
            const parsedUrl = new URL(sourceUrl, window.location.origin);
            removeLegacyAssistantOpenParams(parsedUrl);
            const runtimeProjectPath = runtimeForUrl?.projectPath || '';

            if (!parsedUrl.searchParams.get('cwd') && runtimeProjectPath) {
                parsedUrl.searchParams.set('cwd', runtimeProjectPath);
            }

            nextUrl = parsedUrl.toString();
        } catch {
            nextUrl = sourceUrl;
        }

        return resolveAssistantThreadLandingUrl(nextUrl, targetPath, runtimeForUrl);
    }, [
        assistantRuntime,
        buildAssistantIframeUrlForRuntime,
        resolveAssistantThreadLandingUrl,
    ]);

    const openAssistantWithUrl = useCallback((
        targetUrl?: string,
        targetPath?: string,
        runtimeOverride?: AssistantRuntimeState | null,
        options: Pick<EnsureAssistantOpenOptions, 'suppressResourceThreadBinding'> = {},
    ) => {
        assistantResourceThreadBindingSuppressedRef.current = options.suppressResourceThreadBinding === true;
        const resolvedAssistantUrl = resolveAssistantUrl(targetUrl, targetPath, runtimeOverride);
        latestAssistantResourcePathRef.current = options.suppressResourceThreadBinding === true
            ? ''
            : resolvedAssistantUrl.resourceThreadStoragePath;
        const nextUrl = resolvedAssistantUrl.url;
        assistantIframeCurrentUrlRef.current = nextUrl;
        latestAssistantNavigationThreadIdRef.current = resolveAcpNavigationThreadId(nextUrl);

        flushSync(() => {
            setAssistantPanelMode('assistant');
            setAssistantPanelMounted(true);
            setAssistantVisible(true);
            setAssistantIframeLoaded(false);
            setAssistantIframeOverrideUrl(nextUrl);
        });
    }, [resolveAssistantUrl, setAssistantIframeLoaded]);

    const openRawUrlInAssistantPanel = useCallback((url: string) => {
        const nextUrl = String(url || '').trim();
        if (!nextUrl) {
            return false;
        }

        assistantIframeCurrentUrlRef.current = nextUrl;
        latestAssistantNavigationThreadIdRef.current = undefined;
        setAssistantPanelMode('external');
        setAssistantPanelMounted(true);
        setAssistantVisible(true);
        setAssistantIframeLoaded(false);
        setAssistantIframeOverrideUrl(nextUrl);
        return true;
    }, [setAssistantIframeLoaded]);

    const openAssistantInNewWindowWithUrl = useCallback((
        targetUrl?: string,
        targetPath?: string,
        runtimeOverride?: AssistantRuntimeState | null,
        contextOverride?: AssistantContextV1 | null,
    ) => {
        assistantResourceThreadBindingSuppressedRef.current = false;
        const resolvedAssistantUrl = resolveAssistantUrl(targetUrl, targetPath, runtimeOverride);
        latestAssistantResourcePathRef.current = resolvedAssistantUrl.resourceThreadStoragePath;
        const nextUrl = resolvedAssistantUrl.url;
        assistantIframeCurrentUrlRef.current = nextUrl;
        latestAssistantNavigationThreadIdRef.current = resolveAcpNavigationThreadId(nextUrl);
        const windowFeatures = contextOverride ? undefined : 'noopener,noreferrer';
        const childWindow = window.open(nextUrl, '_blank', windowFeatures);
        postAssistantContextToWindowWithRetry(childWindow, nextUrl, contextOverride);
    }, [postAssistantContextToWindowWithRetry, resolveAssistantUrl]);

    const openAISettingsForAssistantRuntime = useCallback((
        runtime?: AssistantRuntimeState | null,
        message?: string,
    ) => {
        onOpenAISettings?.(runtime, message);
    }, [onOpenAISettings]);

    const waitForAssistantRuntimeReady = useCallback(async (runtime: AssistantRuntimeState): Promise<AssistantRuntimeState> => {
        if (runtime.health.status !== 'runtime_unreachable') {
            return runtime;
        }

        let latestRuntime = runtime;
        const maxAttempts = 5;
        const intervalMs = 700;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, intervalMs));

            try {
                const nextRuntime = await refreshRuntime({ autoStart: false }) as AssistantRuntimeState;
                latestRuntime = nextRuntime;
                setAssistantRuntime(nextRuntime);

                if (nextRuntime.health.status === 'ready') {
                    return nextRuntime;
                }

                if (
                    nextRuntime.health.status === 'missing_cli'
                    || nextRuntime.health.status === 'needs_update'
                    || nextRuntime.health.status === 'cli_error'
                ) {
                    return nextRuntime;
                }
            } catch (pollError) {
                console.warn(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} runtime poll failed`, pollError);
                break;
            }
        }

        return latestRuntime;
    }, [refreshRuntime]);

    const ensureAssistantReadyThenOpen = useCallback(async (
        trigger: AssistantTriggerSource,
        targetUrl?: string,
        targetPath?: string,
        openTarget: 'iframe' | 'window' = 'iframe',
        contextOverride?: AssistantContextV1 | null,
        options: EnsureAssistantOpenOptions = {},
    ): Promise<boolean> => {
        if (assistantChecking) {
            return false;
        }

        setAssistantChecking(true);
        const hideLoading = options.loadingText === false
            ? () => undefined
            : messageApi.loading(options.loadingText || '正在打开 AI...', 0);
        const shouldOpenSettingsOnFailure = options.openSettingsOnFailure !== false;
        console.info(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} begin runtime check`, {
            trigger,
            openTarget,
            targetUrl: targetUrl || null,
            targetPath: targetPath || null,
        });

        try {
            const runtime = await apiService.getAssistantRuntime({ autoStart: true, projectId }) as AssistantRuntimeState;
            setAssistantRuntime(runtime);
            console.info(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} runtime response`, {
                status: runtime.health.status,
                message: runtime.health.message,
                source: runtime.source,
                commandSource: runtime.health.commandSource,
                webBaseUrl: runtime.webBaseUrl,
                apiBaseUrl: runtime.apiBaseUrl,
            });

            const resolvedRuntime = await waitForAssistantRuntimeReady(runtime);

            if (resolvedRuntime.health.status === 'ready') {
                if (openTarget === 'window') {
                    openAssistantInNewWindowWithUrl(targetUrl, targetPath, resolvedRuntime, contextOverride);
                } else {
                    openAssistantWithUrl(targetUrl, targetPath, resolvedRuntime, {
                        suppressResourceThreadBinding: options.suppressResourceThreadBinding,
                    });
                }
                return true;
            }

            console.warn(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} runtime not ready`, {
                status: resolvedRuntime.health.status,
                message: resolvedRuntime.health.message,
                hints: resolvedRuntime.health.hints,
            });
            if (shouldOpenSettingsOnFailure) {
                openAISettingsForAssistantRuntime(resolvedRuntime, resolvedRuntime.health.message || '本地 ACP 服务未链接');
                messageApi.warning('已打开 AI 设置，请检查本地 ACP 服务');
            }
        } catch (error: any) {
            const runtime = assistantRuntime || DEFAULT_ASSISTANT_RUNTIME_STATE;
            setAssistantRuntime(runtime);
            console.error(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} runtime check failed`, error);
            if (shouldOpenSettingsOnFailure) {
                messageApi.error(error?.message || '检测 AI 助手状态失败');
                openAISettingsForAssistantRuntime(runtime, error?.message || '检测 AI 助手状态失败');
                messageApi.warning('已打开 AI 设置，请检查本地 ACP 服务');
            }
        } finally {
            hideLoading();
            setAssistantChecking(false);
        }

        return false;
    }, [
        assistantChecking,
        assistantRuntime,
        messageApi,
        openAssistantInNewWindowWithUrl,
        openAssistantWithUrl,
        projectId,
        setAssistantChecking,
        openAISettingsForAssistantRuntime,
        waitForAssistantRuntimeReady,
        DEFAULT_ASSISTANT_RUNTIME_STATE,
    ]);

    useEffect(() => {
        const nextProjectId = projectId || '';
        if (previousAssistantProjectIdRef.current === nextProjectId) {
            return;
        }

        previousAssistantProjectIdRef.current = nextProjectId;
        const reopenMountedAssistantForProjectChange = assistantPanelMounted
            && assistantVisible
            && assistantSupportsAcpContext;
        if (!assistantPanelMounted || !assistantSupportsAcpContext) {
            return;
        }

        assistantResourceThreadBindingSuppressedRef.current = false;
        assistantIframeCurrentUrlRef.current = '';
        latestAssistantResourcePathRef.current = getAssistantContextCurrentFilePath(assistantContextV1);
        latestAssistantNavigationThreadIdRef.current = undefined;
        assistantIframeLoadSyncSignatureRef.current = '';
        assistantImageGenerationConfigSyncSignatureRef.current = '';
        assistantCanvasMcpConfigSyncSignatureRef.current = '';
        setAssistantIframeLoaded(false);
        setAssistantIframeOverrideUrl(null);

        if (!reopenMountedAssistantForProjectChange) {
            return;
        }

        void ensureAssistantReadyThenOpen('event', undefined, getAssistantContextCurrentFilePath(assistantContextV1), 'iframe', null, {
            loadingText: false,
            openSettingsOnFailure: false,
        });
    }, [
        assistantContextV1,
        assistantPanelMounted,
        assistantSupportsAcpContext,
        assistantVisible,
        ensureAssistantReadyThenOpen,
        projectId,
        setAssistantIframeLoaded,
    ]);

    const syncAssistantCanvasComments = useCallback((annotations: CanvasElementContextInfo[], currentFilePath: string) => {
        const nextContext = buildAssistantContextWithCanvasComments(
            assistantBaseContextV1,
            annotations,
            currentFilePath,
        );
        const nextSignature = getAssistantCanvasCommentsSignature(nextContext);
        if (assistantContextCommentsSignatureRef.current === nextSignature) {
            return;
        }

        assistantContextCommentsSignatureRef.current = nextSignature;
        setAssistantExternalContext(nextContext);
        syncAssistantContextToTargets(nextContext, 'replace', {
            retryIframe: true,
        });
    }, [
        assistantBaseContextV1,
        syncAssistantContextToTargets,
    ]);

    const addContextItems = useCallback((items: AcpContextItem[]) => {
        if (!assistantContextAppendAvailable || !Array.isArray(items) || items.length === 0) {
            return false;
        }

        const postItems = () => {
            postAssistantContextItemsToIframe(items);
        };

        if (assistantIframeLoaded && assistantIframeRef.current?.contentWindow) {
            postItems();
            return true;
        }

        void waitForAssistantIframeReady().then((ready) => {
            if (ready) {
                postItems();
            }
        });
        return true;
    }, [
        assistantContextAppendAvailable,
        assistantIframeLoaded,
        assistantIframeRef,
        postAssistantContextItemsToIframe,
        waitForAssistantIframeReady,
    ]);

    const addImageAttachment = useCallback(async (attachment: AssistantImageAttachmentPayload) => {
        if (!assistantSupportsAcpContext || !assistantVisible) {
            messageApi.warning('请先打开 AI 助手');
            return false;
        }
        try {
            await addImageAttachmentWithRetry(attachment);
            return true;
        } catch (error: any) {
            messageApi.error(error?.message || '添加图片到 AI 失败');
            return false;
        }
    }, [
        addImageAttachmentWithRetry,
        assistantSupportsAcpContext,
        assistantVisible,
        messageApi,
    ]);

    const appendComposerText = useCallback(async (text: string) => {
        if (!assistantSupportsAcpContext || !assistantVisible) {
            messageApi.warning('请先打开 AI 助手');
            return false;
        }
        try {
            await appendComposerTextWithRetry(text);
            return true;
        } catch (error: any) {
            messageApi.error(error?.message || '填充 AI 提示词失败');
            return false;
        }
    }, [
        appendComposerTextWithRetry,
        assistantSupportsAcpContext,
        assistantVisible,
        messageApi,
    ]);

    const addCanvasElementsToAssistantContext = useCallback((
        elements: CanvasElementContextInfo[],
        currentFilePath: string,
    ) => {
        if (!assistantContextAppendAvailable || !Array.isArray(elements) || elements.length === 0) {
            return false;
        }

        return addContextItems(buildAssistantContextItemsFromCanvasElements(elements, currentFilePath));
    }, [
        addContextItems,
        assistantContextAppendAvailable,
    ]);

    const handleToggleAssistant = useCallback(() => {
        if (assistantVisible) {
            setAssistantVisible(false);
            return;
        }

        if (assistantPanelMounted) {
            setAssistantVisible(true);
            return;
        }

        void ensureAssistantReadyThenOpen(
            'button',
            undefined,
            getAssistantContextCurrentFilePath(assistantContextV1),
            'iframe',
        );
    }, [
        assistantContextV1,
        assistantPanelMounted,
        assistantVisible,
        ensureAssistantReadyThenOpen,
    ]);

    const handleOpenGenieWebAgent = useCallback((targetPath?: string, _provider?: GenieProvider) => {
        void ensureAssistantReadyThenOpen('button', undefined, targetPath, 'iframe');
    }, [ensureAssistantReadyThenOpen]);

    const hideAssistantPanelTemporarily = useCallback(() => {
        setAssistantVisible(false);
    }, []);

    const restoreAssistantPanel = useCallback((targetPath?: string) => {
        if (assistantVisible) {
            return true;
        }
        if (assistantPanelMounted) {
            setAssistantVisible(true);
            return true;
        }
        return ensureAssistantReadyThenOpen('event', undefined, targetPath, 'iframe', null, {
            loadingText: false,
            openSettingsOnFailure: false,
        });
    }, [
        assistantPanelMounted,
        assistantVisible,
        ensureAssistantReadyThenOpen,
    ]);

    useEffect(() => {
        const handleOpenAssistantUrl = (event: Event) => {
            const customEvent = event as CustomEvent<OpenAssistantUrlEventDetail>;
            const detail = customEvent.detail;
            const targetUrl = detail?.url;
            if (!targetUrl || typeof targetUrl !== 'string') {
                return;
            }

            void ensureAssistantReadyThenOpen('event', targetUrl, detail?.targetPath);
            customEvent.preventDefault();
        };

        window.addEventListener(ASSISTANT_OPEN_URL_EVENT, handleOpenAssistantUrl as EventListener);
        return () => {
            window.removeEventListener(ASSISTANT_OPEN_URL_EVENT, handleOpenAssistantUrl as EventListener);
        };
    }, [ensureAssistantReadyThenOpen]);

    const clearAssistantSelectedElementsOnExit = useCallback(() => {
        setAssistantExternalContext((prev) => {
            if (!prev) {
                return prev;
            }
            return {
                ...prev,
                selectedElements: [],
            };
        });

        syncAssistantContextToTargets({
            version: assistantContextV1.version,
            systemContext: assistantContextV1.systemContext,
            currentFile: assistantContextV1.currentFile,
            selectedElements: [],
            extensions: assistantContextV1.extensions,
        }, 'replace', {
            retryIframe: true,
        });
    }, [
        assistantContextV1,
        syncAssistantContextToTargets,
    ]);

    const handleOpenAssistantInNewWindowNoContext = useCallback(() => {
        void ensureAssistantReadyThenOpen('button', assistantIframeUrl, undefined, 'window');
    }, [assistantIframeUrl, ensureAssistantReadyThenOpen]);

    const handleOpenAssistantWithItemContext = useCallback((item: ItemData) => {
        const itemContext = buildAssistantContextForItem(item, {
            viewMode: 'demo',
            activeTab: 'prototypes',
        });
        const targetPath = getGenieCurrentFilePath(itemContext.currentFile);
        setAssistantExternalContext(itemContext);
        latestAssistantSyncContextRef.current = itemContext;

        try {
            const url = new URL(assistantIframeUrl);
            removeLegacyAssistantOpenParams(url);
            void ensureAssistantReadyThenOpen('button', url.toString(), undefined, 'window', itemContext);
        } catch {
            void ensureAssistantReadyThenOpen('button', assistantIframeUrl, targetPath, 'window', itemContext);
        }
    }, [assistantIframeUrl, buildAssistantContextForItem, ensureAssistantReadyThenOpen]);

    const openAssistantWithContext = useCallback(async (context: AssistantContextV1 | null) => {
        if (context) {
            setAssistantExternalContext(context);
            latestAssistantSyncContextRef.current = context;
        }
        const targetPath = context ? getAssistantContextCurrentFilePath(context) : undefined;
        return ensureAssistantReadyThenOpen('button', assistantIframeUrl, targetPath, 'iframe', context);
    }, [assistantIframeUrl, ensureAssistantReadyThenOpen]);

    const openAssistantWithContextAndSubmitPrompt = useCallback(async (
        context: AssistantContextV1 | null,
        prompt: string,
        options: OpenAssistantSubmitOptions = {},
    ) => {
        const text = String(prompt || '').trim();
        if (!text) {
            messageApi.warning('请输入提示词');
            return false;
        }

        const shouldForceNewThread = options.forceNewThread === true;
        assistantResourceThreadBindingSuppressedRef.current = shouldForceNewThread;
        if (shouldForceNewThread) {
            latestAssistantNavigationThreadIdRef.current = undefined;
        }
        const panelAlreadyOpen = assistantSupportsAcpContext
            && (assistantVisible || assistantPanelMounted)
            && Boolean(assistantIframeRef.current?.contentWindow);
        if (panelAlreadyOpen && !assistantVisible) {
            setAssistantVisible(true);
        }
        let hideLoading = panelAlreadyOpen
            ? () => undefined
            : messageApi.loading('正在启动 AI 助手...', 0);
        const closeLoading = () => {
            hideLoading();
            hideLoading = () => undefined;
        };
        try {
            if (context) {
                setAssistantExternalContext(context);
                latestAssistantSyncContextRef.current = context;
                if (!shouldForceNewThread) {
                    syncAssistantContextToTargets(context, 'replace', {
                        retryIframe: true,
                    });
                }
            }

            const targetPath = shouldForceNewThread
                ? undefined
                : context ? getAssistantContextCurrentFilePath(context) : undefined;
            const assistantOpenUrl = assistantIframeUrl;
            if (shouldForceNewThread) {
                latestAssistantResourcePathRef.current = '';
            } else if (targetPath) {
                latestAssistantResourcePathRef.current = targetPath;
            }
            const opened = panelAlreadyOpen
                ? true
                : await ensureAssistantReadyThenOpen('button', assistantOpenUrl, targetPath, 'iframe', context, {
                    loadingText: false,
                    suppressResourceThreadBinding: shouldForceNewThread,
                });
            if (!opened) {
                return false;
            }

            await waitForAssistantPanelPaint();
            const ready = panelAlreadyOpen
                ? await waitForAssistantIframeReady(8_000)
                : await waitForAssistantIframeReady(30_000);
            if (!ready) {
                messageApi.error('AI 助手未就绪，请稍后重试');
                return false;
            }

            if (context) {
                postAssistantContextToIframeWithRetry(context, 'replace');
            }

            closeLoading();
            await submitPromptWithRetry(text, { newThread: shouldForceNewThread });
            return true;
        } catch (error: any) {
            messageApi.error(error?.message || '提交 AI 助手对话失败');
            return false;
        } finally {
            if (shouldForceNewThread) {
                assistantResourceThreadBindingSuppressedRef.current = false;
                latestAssistantResourcePathRef.current = context ? getAssistantContextCurrentFilePath(context) : getAssistantContextCurrentFilePath(assistantContextV1);
                const latestNavigationThreadId = latestAssistantNavigationThreadIdRef.current;
                if (latestNavigationThreadId !== undefined) {
                    handleAssistantActiveThreadChange(latestNavigationThreadId);
                }
            }
            closeLoading();
        }
    }, [
        assistantContextV1,
        assistantIframeLoaded,
        assistantIframeRef,
        assistantIframeUrl,
        assistantPanelMounted,
        assistantSupportsAcpContext,
        assistantVisible,
        ensureAssistantReadyThenOpen,
        handleAssistantActiveThreadChange,
        messageApi,
        postAssistantContextToIframeWithRetry,
        submitPromptWithRetry,
        syncAssistantContextToTargets,
        waitForAssistantIframeReady,
    ]);

    const probeAssistantRuntimeSilently = useCallback(async () => {
        if (assistantChecking) {
            return assistantRuntime;
        }

        if (assistantRuntime?.health.status === 'ready') {
            return assistantRuntime;
        }

        try {
            const runtime = await refreshRuntime({ autoStart: false }) as AssistantRuntimeState;
            setAssistantRuntime(runtime);
            return runtime;
        } catch (error) {
            console.warn(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} silent runtime probe failed`, error);
            return assistantRuntime;
        }
    }, [assistantChecking, assistantRuntime, refreshRuntime, setAssistantRuntime]);

    const connectAssistantRuntimeSilently = useCallback(async () => {
        if (assistantChecking) {
            return assistantRuntime;
        }

        if (assistantRuntime?.health.status === 'ready') {
            return assistantRuntime;
        }

        try {
            const runtime = await refreshRuntime({ autoStart: true }) as AssistantRuntimeState;
            setAssistantRuntime(runtime);
            const resolvedRuntime = await waitForAssistantRuntimeReady(runtime);
            setAssistantRuntime(resolvedRuntime);
            return resolvedRuntime;
        } catch (error) {
            console.warn(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} silent runtime connect failed`, error);
            return assistantRuntime;
        }
    }, [
        assistantChecking,
        assistantRuntime,
        refreshRuntime,
        setAssistantRuntime,
        waitForAssistantRuntimeReady,
    ]);

    const handleCopyProjectDirectoryForMobile = useCallback(async () => {
        const projectPath = (assistantRuntime?.projectPath || '').trim();
        if (!projectPath) {
            messageApi.warning('当前未获取到项目目录');
            return;
        }

        try {
            await navigator.clipboard.writeText(projectPath);
            messageApi.success('项目目录已复制');
        } catch (error) {
            console.error('Failed to copy project path: ', error);
            messageApi.error('复制失败');
        }
    }, [assistantRuntime?.projectPath, messageApi]);

    const handleAssistantIframeLoad = useCallback(() => {
        assistantIframeLoadSyncSignatureRef.current = '';
        assistantImageGenerationConfigSyncSignatureRef.current = '';
        assistantCanvasMcpConfigSyncSignatureRef.current = '';
        setAssistantIframeLoaded(true);
        syncAssistantImageGenerationConfigToIframe({ requireLoaded: false });
        syncAssistantCanvasMcpConfigToIframe({ requireLoaded: false });
    }, [
        setAssistantIframeLoaded,
        syncAssistantCanvasMcpConfigToIframe,
        syncAssistantImageGenerationConfigToIframe,
    ]);

    return {
        assistantVisible,
        assistantContextAppendAvailable,
        assistantPanelMounted,
        assistantPanelWidth,
        setAssistantPanelWidth,
        assistantPanelMinWidth: MIN_ASSISTANT_PANEL_WIDTH,
        assistantPanelMaxWidth: MAX_ASSISTANT_PANEL_WIDTH,
        assistantIframeRef,
        assistantIframeSrc,
        handleAssistantIframeLoad,
        assistantContextV1,
        assistantProjectPath: assistantRuntime?.projectPath || '',
        assistantApiBaseUrl: (assistantRuntime?.apiBaseUrl || DEFAULT_ASSISTANT_RUNTIME_STATE.apiBaseUrl).trim(),
        probeAssistantRuntimeSilently,
        connectAssistantRuntimeSilently,
        addCanvasElementsToAssistantContext,
        addContextItems,
        addImageAttachment,
        appendComposerText,
        handleToggleAssistant,
        handleOpenGenieWebAgent,
        hideAssistantPanelTemporarily,
        restoreAssistantPanel,
        openRawUrlInAssistantPanel,
        syncAssistantCanvasComments,
        clearAssistantSelectedElementsOnExit,
        handleOpenAssistantInNewWindowNoContext,
        handleOpenAssistantWithItemContext,
        openAssistantWithContext,
        openAssistantWithContextAndSubmitPrompt,
        handleCopyProjectDirectory: handleCopyProjectDirectoryForMobile,
    };
}
