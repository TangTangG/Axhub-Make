import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    buildAssistantContextUrl,
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
import { mergeSelectedElementsBySelector, dedupeSelectedElementsByTriple } from '../assistant.utils';
import {
    getGenieCurrentFilePath,
    mergeGenieContextV1,
    normalizeGenieContextV1,
    normalizeGenieCurrentFileV1,
    normalizeWebEditorGenieRequestPayload,
} from '@/common/genie/bridge';
import type { GenieProvider, WebEditorGenieRequestPayload } from '@/common/genie/types';
import { createGenieIntegrationBridge } from '@/common/genie/ws';
import {
    appendRequiredGenieOpenParams,
} from '@/common/genie/url';
import { toGenieProvider } from '@/common/promptExecution';

type AssistantTriggerSource = 'button' | 'event';
type AssistantRuntimeState = Awaited<ReturnType<typeof apiService.getAssistantRuntime>>;

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

interface UseAssistantPanelControllerParams {
    messageApi: AssistantMessageApi;
    modal: AssistantModalApi;
    preferredPromptClient: PromptClientPreference;
    activeProjectId: string | null;
    activeTab: TabType;
    viewMode: ViewMode;
    selectedItem: ItemData | null;
    contentMode: AssistantContentMode;
    currentMarkdownResource: AssistantMarkdownResourceSelection;
    currentCanvas?: CanvasItem | null;
    currentTheme?: ThemeResourceItem | null;
    currentDataTable?: DataTableResourceItem | null;
}

function createSessionClientId(storageKey: string, prefix: string) {
    try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
            return stored;
        }
    } catch {
        // ignore sessionStorage failures
    }

    const next = `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

    try {
        sessionStorage.setItem(storageKey, next);
    } catch {
        // ignore sessionStorage failures
    }

    return next;
}

export function useAssistantPanelController({
    messageApi,
    modal,
    preferredPromptClient,
    activeProjectId,
    activeTab,
    viewMode,
    selectedItem,
    contentMode,
    currentMarkdownResource,
    currentCanvas = null,
    currentTheme = null,
    currentDataTable = null,
}: UseAssistantPanelControllerParams) {
    const ASSISTANT_RUNTIME_UI_LOG_PREFIX = '[assistant-runtime-ui]';
    const DEFAULT_ASSISTANT_WEB_BASE_URL = 'http://localhost:32123';
    const DEFAULT_ASSISTANT_INSTALL_CMD = 'npx @axhub/genie@latest';
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
                start: 'npx @axhub/genie@latest',
                status: 'npx @axhub/genie@latest status --json',
            },
        },
    };

    const genieProvider = useMemo(() => toGenieProvider(preferredPromptClient), [preferredPromptClient]);
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
    const [assistantPanelMode, setAssistantPanelMode] = useState<'genie' | 'external'>('genie');
    const [assistantExternalContext, setAssistantExternalContext] = useState<AssistantContextV1 | null>(null);
    const assistantBridgeRef = useRef<ReturnType<typeof createGenieIntegrationBridge> | null>(null);
    const assistantBridgeApiBaseUrlRef = useRef('');
    const assistantBridgeIntegrationChannelRef = useRef('');
    const assistantOpenedRef = useRef(false);
    const assistantTargetPageUrlRef = useRef('');
    const assistantCurrentFilePathRef = useRef('');
    const assistantContextCommentsSignatureRef = useRef('');
    const assistantBridgeContextSyncSignatureRef = useRef('');
    const assistantIframeLoadSyncSignatureRef = useRef('');
    const latestAssistantSyncContextRef = useRef<AssistantContextV1 | null>(null);
    const assistantBridgeExternalClientIdRef = useRef(
        createSessionClientId('__axhub_make_host_client_id__', 'make-host'),
    );
    const webEditorIntegrationClientIdRef = useRef(
        createSessionClientId('__axhub_make_editor_client_id__', 'make-editor'),
    );
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

    const buildAssistantIframeUrlForRuntime = useCallback((
        runtime?: AssistantRuntimeState | null,
        providerOverride?: GenieProvider | null,
    ) => {
        const webBaseUrl = (runtime?.webBaseUrl || DEFAULT_ASSISTANT_WEB_BASE_URL).replace(/\/+$/g, '');
        const url = new URL(`${webBaseUrl}/`);
        const projectPath = runtime?.projectPath || '';
        if (projectPath) {
            url.searchParams.set('cwd', projectPath);
        }
        const provider = providerOverride || genieProvider;
        if (provider) {
            url.searchParams.set('provider', provider);
        }
        return appendRequiredGenieOpenParams(url.toString(), window.location.origin);
    }, [genieProvider]);

    const assistantIframeUrl = useMemo(() => (
        buildAssistantIframeUrlForRuntime(assistantRuntime)
    ), [assistantRuntime, buildAssistantIframeUrlForRuntime]);

    const assistantIframeSrc = assistantIframeOverrideUrl || assistantIframeUrl;
    const assistantSupportsBridge = assistantPanelMode === 'genie';
    const {
        iframeRef: assistantIframeRef,
        iframeLoaded: assistantIframeLoaded,
        setIframeLoaded: setAssistantIframeLoaded,
        syncContext: postAssistantContextToIframe,
        syncContextWithRetry: postAssistantContextToIframeWithRetry,
        syncPrompt: postAssistantPromptToIframe,
        waitForReady: waitForAssistantIframeReady,
    } = useAssistantBridge(assistantIframeSrc);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_ASSISTANT_WIDTH, String(Math.round(assistantPanelWidth)));
    }, [assistantPanelWidth]);

    const buildAssistantUrlWithContext = useCallback((baseUrl: string, context: AssistantContextV1) => {
        return buildAssistantContextUrl(baseUrl, context, window.location.origin);
    }, []);

    const syncAssistantContextToTargets = useCallback((
        context: AssistantContextV1,
        mode: 'replace' | 'append' = 'replace',
        options: {
            retryIframe?: boolean;
            forceBridge?: boolean;
        } = {},
    ) => {
        latestAssistantSyncContextRef.current = context;

        if (assistantSupportsBridge && assistantVisible && assistantIframeLoaded && assistantIframeRef.current?.contentWindow) {
            if (options.retryIframe ?? mode === 'replace') {
                postAssistantContextToIframeWithRetry(context, mode);
            } else {
                postAssistantContextToIframe(context, mode);
            }
        }

        if (!assistantSupportsBridge || !assistantOpenedRef.current) {
            return;
        }

        const bridgeSignature = JSON.stringify({ mode, context });
        if (!options.forceBridge && assistantBridgeContextSyncSignatureRef.current === bridgeSignature) {
            return;
        }
        assistantBridgeContextSyncSignatureRef.current = bridgeSignature;

        void assistantBridgeRef.current?.updateContext(context, mode).catch((error) => {
            if (assistantBridgeContextSyncSignatureRef.current === bridgeSignature) {
                assistantBridgeContextSyncSignatureRef.current = '';
            }
            console.warn(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} integration context sync failed`, error);
        });
    }, [
        assistantIframeLoaded,
        assistantIframeRef,
        assistantSupportsBridge,
        assistantVisible,
        postAssistantContextToIframe,
        postAssistantContextToIframeWithRetry,
    ]);

    const stopAssistantIntegrationBridge = useCallback(() => {
        assistantBridgeRef.current?.stop();
        assistantBridgeRef.current = null;
        assistantBridgeApiBaseUrlRef.current = '';
        assistantBridgeIntegrationChannelRef.current = '';
        assistantTargetPageUrlRef.current = '';
        assistantBridgeContextSyncSignatureRef.current = '';
    }, []);

    const ensureAssistantIntegrationBridgeStarted = useCallback((runtime?: AssistantRuntimeState | null) => {
        assistantOpenedRef.current = true;
        const resolvedApiBaseUrl = String(
            runtime?.apiBaseUrl
            || assistantRuntime?.apiBaseUrl
            || DEFAULT_ASSISTANT_RUNTIME_STATE.apiBaseUrl,
        ).trim();
        const resolvedIntegrationChannel = String(
            runtime?.projectPath
            || assistantRuntime?.projectPath
            || 'axhub',
        ).trim();

        if (!resolvedApiBaseUrl || !resolvedIntegrationChannel) {
            return;
        }

        if (
            assistantBridgeRef.current
            && assistantBridgeApiBaseUrlRef.current === resolvedApiBaseUrl
            && assistantBridgeIntegrationChannelRef.current === resolvedIntegrationChannel
        ) {
            return;
        }

        stopAssistantIntegrationBridge();

        const bridge = createGenieIntegrationBridge({
            apiBaseUrl: resolvedApiBaseUrl,
            integrationChannel: resolvedIntegrationChannel,
            externalClientId: assistantBridgeExternalClientIdRef.current,
            probeOnStart: true,
            targetPageUrl: () => assistantTargetPageUrlRef.current || assistantIframeSrc,
            onAvailabilityChange: (available) => {
                if (!available) {
                    return;
                }
                const latestContext = latestAssistantSyncContextRef.current;
                if (!latestContext) {
                    return;
                }
                void assistantBridgeRef.current?.updateContext(latestContext, 'replace').catch((error) => {
                    console.warn(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} integration availability resync failed`, error);
                });
            },
        });
        bridge.start();
        assistantBridgeRef.current = bridge;
        assistantBridgeApiBaseUrlRef.current = resolvedApiBaseUrl;
        assistantBridgeIntegrationChannelRef.current = resolvedIntegrationChannel;
    }, [
        assistantRuntime?.apiBaseUrl,
        assistantRuntime?.projectPath,
        assistantIframeSrc,
        stopAssistantIntegrationBridge,
        DEFAULT_ASSISTANT_RUNTIME_STATE.apiBaseUrl,
    ]);

    useEffect(() => {
        if (!assistantOpenedRef.current) {
            return;
        }
        ensureAssistantIntegrationBridgeStarted(assistantRuntime);
    }, [assistantRuntime, ensureAssistantIntegrationBridgeStarted]);

    useEffect(() => () => {
        stopAssistantIntegrationBridge();
    }, [stopAssistantIntegrationBridge]);

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
                provider: genieProvider,
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
        genieProvider,
        selectedItem,
        viewMode,
    ]);

    const assistantContextV1 = useMemo<AssistantContextV1>(() => (
        mergeAssistantContextForActiveFile(assistantBaseContextV1, assistantExternalContext)
    ), [assistantBaseContextV1, assistantExternalContext]);

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
                provider: genieProvider,
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
    }, [activeTab, assistantRuntime?.projectPath, genieProvider]);

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
            forceBridge: true,
        });
    }, [
        assistantBaseContextV1,
        syncAssistantContextToTargets,
    ]);

    useEffect(() => {
        syncAssistantContextToTargets(assistantContextV1, 'replace');
    }, [assistantContextV1, syncAssistantContextToTargets]);

    useEffect(() => {
        if (!assistantSupportsBridge || !assistantVisible || !assistantIframeLoaded) {
            return;
        }

        const contextSignature = JSON.stringify(assistantContextV1);
        if (assistantIframeLoadSyncSignatureRef.current === contextSignature) {
            return;
        }

        assistantIframeLoadSyncSignatureRef.current = contextSignature;
        syncAssistantContextToTargets(assistantContextV1, 'replace', {
            retryIframe: true,
            forceBridge: true,
        });
    }, [
        assistantContextV1,
        assistantIframeLoaded,
        assistantSupportsBridge,
        assistantVisible,
        syncAssistantContextToTargets,
    ]);

    const resolveAssistantUrl = useCallback((
        targetUrl?: string,
        targetPath?: string,
        runtimeOverride?: AssistantRuntimeState | null,
        providerOverride?: GenieProvider | null,
    ) => {
        const runtimeForUrl = runtimeOverride || assistantRuntime;
        const sourceUrl = targetUrl || buildAssistantIframeUrlForRuntime(runtimeForUrl, providerOverride);
        let nextUrl = sourceUrl;

        try {
            const parsedUrl = new URL(appendRequiredGenieOpenParams(sourceUrl, window.location.origin));
            const runtimeProjectPath = runtimeForUrl?.projectPath || '';

            if (!parsedUrl.searchParams.get('cwd') && runtimeProjectPath) {
                parsedUrl.searchParams.set('cwd', runtimeProjectPath);
            }

            const provider = providerOverride || genieProvider;
            if (!parsedUrl.searchParams.get('provider') && provider) {
                parsedUrl.searchParams.set('provider', provider);
            }

            if (targetPath && !parsedUrl.searchParams.get('targetPath')) {
                parsedUrl.searchParams.set('targetPath', targetPath);
            }

            nextUrl = buildAssistantUrlWithContext(parsedUrl.toString(), assistantContextV1);
        } catch {
            nextUrl = buildAssistantUrlWithContext(sourceUrl, assistantContextV1);
        }

        return appendRequiredGenieOpenParams(nextUrl, window.location.origin);
    }, [assistantContextV1, assistantRuntime, buildAssistantIframeUrlForRuntime, buildAssistantUrlWithContext, genieProvider]);

    const openAssistantWithUrl = useCallback((
        targetUrl?: string,
        targetPath?: string,
        runtimeOverride?: AssistantRuntimeState | null,
        providerOverride?: GenieProvider | null,
    ) => {
        const nextUrl = resolveAssistantUrl(targetUrl, targetPath, runtimeOverride, providerOverride);

        assistantTargetPageUrlRef.current = nextUrl;
        setAssistantPanelMode('genie');
        setAssistantPanelMounted(true);
        setAssistantVisible(true);
        setAssistantIframeLoaded(false);
        setAssistantIframeOverrideUrl(nextUrl);
    }, [resolveAssistantUrl, setAssistantIframeLoaded]);

    const openRawUrlInAssistantPanel = useCallback((url: string) => {
        const nextUrl = String(url || '').trim();
        if (!nextUrl) {
            return false;
        }

        assistantOpenedRef.current = false;
        stopAssistantIntegrationBridge();
        setAssistantPanelMode('external');
        setAssistantPanelMounted(true);
        setAssistantVisible(true);
        setAssistantIframeLoaded(false);
        setAssistantIframeOverrideUrl(nextUrl);
        return true;
    }, [setAssistantIframeLoaded, stopAssistantIntegrationBridge]);

    const openAssistantInNewWindowWithUrl = useCallback((
        targetUrl?: string,
        targetPath?: string,
        runtimeOverride?: AssistantRuntimeState | null,
        providerOverride?: GenieProvider | null,
    ) => {
        const nextUrl = resolveAssistantUrl(targetUrl, targetPath, runtimeOverride, providerOverride);
        assistantTargetPageUrlRef.current = nextUrl;
        window.open(nextUrl, '_blank', 'noopener,noreferrer');
    }, [resolveAssistantUrl]);

    const showAssistantNotReadyModal = useCallback((
        runtime: AssistantRuntimeState,
        trigger: AssistantTriggerSource,
        _targetUrl?: string,
        _targetPath?: string,
        _openTarget: 'iframe' | 'window' = 'iframe',
    ) => {
        const hints = runtime.health.hints;
        const setupCommand = String(hints.installGlobal || DEFAULT_ASSISTANT_INSTALL_CMD).trim() || DEFAULT_ASSISTANT_INSTALL_CMD;

        modal.confirm({
            title: 'AI 助手未就绪',
            content: (
                <div className="space-y-3">
                    <div className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                        请先通过 CLI 启动 AI 助手。
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/70 px-4 py-3 font-mono text-[13px] leading-6 text-foreground shadow-sm">
                        {setupCommand}
                    </div>
                    <div className="text-xs leading-5 text-muted-foreground">
                        在终端执行这条启动命令，完成后再回来打开 AI。
                    </div>
                </div>
            ),
            okText: '复制命令',
            cancelText: '稍后再说',
            onOk: async () => {
                try {
                    await navigator.clipboard.writeText(setupCommand);
                    messageApi.success('启动命令已复制');
                } catch {
                    messageApi.warning('复制命令失败，请手动复制');
                }
            },
        });

        if (trigger === 'event') {
            messageApi.warning('AI 助手未就绪，已回退为安装引导。');
        }
    }, [messageApi, modal, DEFAULT_ASSISTANT_INSTALL_CMD]);

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
                const nextRuntime = await refreshRuntime() as AssistantRuntimeState;
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
        providerOverride?: GenieProvider | null,
    ): Promise<boolean> => {
        if (assistantChecking) {
            return false;
        }

        setAssistantChecking(true);
        const hideLoading = messageApi.loading('正在打开 AI...', 0);
        console.info(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} begin runtime check`, {
            trigger,
            openTarget,
            targetUrl: targetUrl || null,
            targetPath: targetPath || null,
        });

        try {
            const runtime = await apiService.getAssistantRuntime({ projectId }) as AssistantRuntimeState;
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
                ensureAssistantIntegrationBridgeStarted(resolvedRuntime);
                if (openTarget === 'window') {
                    openAssistantInNewWindowWithUrl(targetUrl, targetPath, resolvedRuntime, providerOverride);
                } else {
                    openAssistantWithUrl(targetUrl, targetPath, resolvedRuntime, providerOverride);
                }
                return true;
            }

            console.warn(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} runtime not ready`, {
                status: resolvedRuntime.health.status,
                message: resolvedRuntime.health.message,
                hints: resolvedRuntime.health.hints,
            });
            showAssistantNotReadyModal(resolvedRuntime, trigger, targetUrl, targetPath, openTarget);
        } catch (error: any) {
            const runtime = assistantRuntime || DEFAULT_ASSISTANT_RUNTIME_STATE;
            setAssistantRuntime(runtime);
            console.error(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} runtime check failed`, error);
            messageApi.error(error?.message || '检测 AI 助手状态失败');
            showAssistantNotReadyModal(runtime, trigger, targetUrl, targetPath, openTarget);
        } finally {
            hideLoading();
            setAssistantChecking(false);
        }

        return false;
    }, [
        assistantChecking,
        assistantRuntime,
        ensureAssistantIntegrationBridgeStarted,
        messageApi,
        openAssistantInNewWindowWithUrl,
        openAssistantWithUrl,
        projectId,
        setAssistantChecking,
        showAssistantNotReadyModal,
        waitForAssistantRuntimeReady,
        DEFAULT_ASSISTANT_RUNTIME_STATE,
    ]);

    const handleWebEditorGenieRequest = useCallback(async (payload: WebEditorGenieRequestPayload) => {
        const normalizedPayload = normalizeWebEditorGenieRequestPayload(payload, {
            fallbackCurrentFile: assistantContextV1.currentFile,
        });
        if (!normalizedPayload) {
            messageApi.warning('收到无效的 Genie 请求');
            return;
        }

        const targetPath = normalizedPayload.targetPath?.trim() || undefined;
        const context = normalizedPayload.context;
        const prompt = String(normalizedPayload.prompt || '').trim();
        const isSelectionAppend = normalizedPayload.mode === 'selection_context';

        const nextContext: AssistantContextV1 | null = (() => {
            if (!context) {
                return assistantExternalContext;
            }
            const activeBase = normalizeGenieContextV1(assistantContextV1, {
                fallbackCurrentFile: assistantContextV1.currentFile,
            }) ?? {
                version: '1' as const,
                systemContext: '',
                currentFile: normalizeGenieCurrentFileV1(assistantContextV1.currentFile),
                selectedElements: [],
                extensions: {},
            };
            const base = activeBase;
            const mergedSelectedElements = mergeSelectedElementsBySelector(
                base.selectedElements,
                context.selectedElements,
            );
            return mergeGenieContextV1(base, {
                version: '1',
                systemContext: context.systemContext || base.systemContext,
                currentFile: normalizeGenieCurrentFileV1(context.currentFile, normalizeGenieCurrentFileV1(base.currentFile)),
                selectedElements: dedupeSelectedElementsByTriple(mergedSelectedElements),
                extensions: {
                    ...(base.extensions || {}),
                    ...(context.extensions || {}),
                },
            });
        })();

        if (nextContext) {
            setAssistantExternalContext(nextContext);
            latestAssistantSyncContextRef.current = nextContext;
        }

        let isReady =
            assistantVisible
            && assistantIframeLoaded
            && !!assistantIframeRef.current?.contentWindow;

        if (!isReady) {
            const openContext = nextContext ?? context;
            const openUrl = openContext
                ? buildAssistantUrlWithContext(assistantIframeUrl, openContext)
                : undefined;
            const opened = await ensureAssistantReadyThenOpen('event', openUrl, targetPath);
            if (!opened) {
                return;
            }
            isReady = await waitForAssistantIframeReady(8000);
            if (!isReady) {
                messageApi.warning('助手面板尚未加载完成，请稍后再试。');
                return;
            }
        }

        if (nextContext) {
            const contextToSync = nextContext;
            if (contextToSync) {
                syncAssistantContextToTargets(contextToSync, 'replace', {
                    retryIframe: true,
                    forceBridge: true,
                });
            }
        }

        if (isSelectionAppend) {
            return;
        }

        if (!prompt) {
            messageApi.warning('缺少发送内容');
            return;
        }

        const posted = postAssistantPromptToIframe(prompt, true);
        if (!posted) {
            messageApi.error('发送失败：无法写入助手输入框');
        }
    }, [
        assistantContextV1,
        assistantExternalContext,
        assistantIframeLoaded,
        assistantIframeRef,
        assistantIframeUrl,
        assistantVisible,
        buildAssistantUrlWithContext,
        ensureAssistantReadyThenOpen,
        messageApi,
        postAssistantPromptToIframe,
        syncAssistantContextToTargets,
        waitForAssistantIframeReady,
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
            forceBridge: true,
        });
    }, [
        assistantBaseContextV1,
        syncAssistantContextToTargets,
    ]);

    const handleToggleAssistant = useCallback(() => {
        if (assistantVisible) {
            setAssistantVisible(false);
            setAssistantPanelMounted(false);
            setAssistantIframeLoaded(false);
            setAssistantIframeOverrideUrl(null);
            setAssistantPanelMode('genie');
            assistantOpenedRef.current = false;
            stopAssistantIntegrationBridge();
            return;
        }

        if (assistantPanelMounted) {
            setAssistantVisible(true);
            return;
        }

        void ensureAssistantReadyThenOpen('button');
    }, [
        assistantPanelMounted,
        assistantVisible,
        ensureAssistantReadyThenOpen,
        setAssistantIframeLoaded,
        stopAssistantIntegrationBridge,
    ]);

    const handleOpenGenieWebAgent = useCallback((targetPath?: string, provider?: GenieProvider) => {
        void ensureAssistantReadyThenOpen('button', undefined, targetPath, 'iframe', provider);
    }, [ensureAssistantReadyThenOpen]);

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

    const tryOpenByAssistantIframe = useCallback((url: string, targetPath?: string) => {
        try {
            const event = new CustomEvent<OpenAssistantUrlEventDetail>(ASSISTANT_OPEN_URL_EVENT, {
                detail: {
                    url,
                    ...(targetPath ? { targetPath } : {}),
                },
                cancelable: true,
            });
            const dispatched = window.dispatchEvent(event);
            return !dispatched;
        } catch {
            return false;
        }
    }, []);

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
            forceBridge: true,
        });
    }, [
        assistantContextV1,
        syncAssistantContextToTargets,
    ]);

    const handleOpenAssistantInNewWindowNoContext = useCallback(() => {
        try {
            const url = new URL(assistantIframeUrl);
            url.searchParams.set('context', JSON.stringify({ version: '1' }));
            void ensureAssistantReadyThenOpen('button', url.toString(), undefined, 'window');
        } catch {
            void ensureAssistantReadyThenOpen('button', assistantIframeUrl, undefined, 'window');
        }
    }, [assistantIframeUrl, ensureAssistantReadyThenOpen]);

    const handleOpenAssistantWithItemContext = useCallback((item: ItemData) => {
        const itemContext = buildAssistantContextForItem(item, {
            viewMode: 'demo',
            activeTab: 'prototypes',
        });
        const targetPath = getGenieCurrentFilePath(itemContext.currentFile);
        const targetUrl = buildAssistantUrlWithContext(assistantIframeUrl, itemContext);

        try {
            const url = new URL(targetUrl);
            url.searchParams.set('targetPath', targetPath);
            void ensureAssistantReadyThenOpen('button', url.toString(), undefined, 'window');
        } catch {
            void ensureAssistantReadyThenOpen('button', targetUrl, targetPath, 'window');
        }
    }, [assistantIframeUrl, buildAssistantContextForItem, buildAssistantUrlWithContext, ensureAssistantReadyThenOpen]);

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

    const startAssistantRuntimeForWebEditor = useCallback(async () => {
        if (assistantChecking) {
            return assistantRuntime;
        }

        if (assistantRuntime?.health.status === 'ready') {
            ensureAssistantIntegrationBridgeStarted(assistantRuntime);
            return assistantRuntime;
        }

        setAssistantChecking(true);
        try {
            const runtime = await apiService.getAssistantRuntime({ projectId }) as AssistantRuntimeState;
            setAssistantRuntime(runtime);
            const resolvedRuntime = await waitForAssistantRuntimeReady(runtime);
            setAssistantRuntime(resolvedRuntime);
            if (resolvedRuntime.health.status === 'ready') {
                ensureAssistantIntegrationBridgeStarted(resolvedRuntime);
            }
            return resolvedRuntime;
        } catch (error) {
            console.warn(`${ASSISTANT_RUNTIME_UI_LOG_PREFIX} web editor runtime start failed`, error);
            return assistantRuntime;
        } finally {
            setAssistantChecking(false);
        }
    }, [
        assistantChecking,
        assistantRuntime,
        ensureAssistantIntegrationBridgeStarted,
        projectId,
        setAssistantChecking,
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
        setAssistantIframeLoaded(true);
    }, [setAssistantIframeLoaded]);

    return {
        assistantVisible,
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
        assistantWebEditorClientId: webEditorIntegrationClientIdRef.current,
        probeAssistantRuntimeSilently,
        startAssistantRuntimeForWebEditor,
        handleToggleAssistant,
        handleOpenGenieWebAgent,
        openRawUrlInAssistantPanel,
        handleWebEditorGenieRequest,
        syncAssistantCanvasComments,
        clearAssistantSelectedElementsOnExit,
        tryOpenByAssistantIframe,
        handleOpenAssistantInNewWindowNoContext,
        handleOpenAssistantWithItemContext,
        handleCopyProjectDirectory: handleCopyProjectDirectoryForMobile,
    };
}
