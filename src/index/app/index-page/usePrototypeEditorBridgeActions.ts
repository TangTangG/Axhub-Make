import {
    useCallback,
    useEffect,
    useRef,
    type Dispatch,
    type MutableRefObject,
    type SetStateAction,
} from 'react';
import type {
    GenieEditorGenieBridgeOptions,
    GenieEditorHostToolbarAction,
    GenieEditorHostToolbarState,
    GenieEditorIntegrationWsOptions,
} from '@/common/web-editor-types';
import {
    createDefaultHostToolbarState,
    PROTOTYPE_EDITOR_BRIDGE_TIMEOUT_MS,
    readPreviewFrameEditorApi,
    resolveHostToolbarStateForDisplay,
    type PreviewPane,
    type PrototypeEditorApi,
    type PrototypeEditorBridgePendingRequest,
    type PrototypeEditorBridgeStateMessage,
    type PrototypeEditorContext,
    type PrototypeEditorSaveActionMessage,
    type QuickEditSaveAction,
} from './previewActions.helpers';

type UsePrototypeEditorBridgeActionsParams = {
    getPrimaryPreviewIframe: () => HTMLIFrameElement | null;
    getSecondaryPreviewIframe: () => HTMLIFrameElement | null;
    getPreviewIframes: () => HTMLIFrameElement[];
    getIframeOrigin: (iframe?: HTMLIFrameElement | null) => string;
    selectedEditablePreviewResource: any;
    resourceType: 'prototype' | 'theme';
    assistantApiBaseUrl?: string;
    assistantProjectPath?: string;
    assistantWebEditorClientId?: string;
    isDarkMode: boolean;
    isDarkModeRef: MutableRefObject<boolean>;
    messageApi: {
        warning: (content: string) => void;
    };
    prototypeHostToolbarUnsubscribeRef: MutableRefObject<(() => void) | null>;
    setHostToolbarState: Dispatch<SetStateAction<GenieEditorHostToolbarState | null>>;
};

type PrototypeEditorEnableOptions = {
    toolbarMode: 'host';
    initialDarkMode: boolean;
    mobileMode?: boolean;
    genieBridge: GenieEditorGenieBridgeOptions;
    integrationWs: GenieEditorIntegrationWsOptions;
};

type PrototypeEditorRuntimeOverride = {
    apiBaseUrl?: string;
    projectPath?: string;
} | null | undefined;

type PrototypeEditorEnterOptions = {
    showMissingWarning?: boolean;
    runtime?: PrototypeEditorRuntimeOverride;
};

type PrototypeEditorBridgeActions = {
    getPrototypeEditorApi: (iframe?: HTMLIFrameElement | null) => PrototypeEditorApi | null;
    enterPrototypeEditor: (
        iframe?: HTMLIFrameElement | null,
        options?: PrototypeEditorEnterOptions,
    ) => Promise<boolean>;
    enterPrototypeEditorPanelOnly: (
        iframe?: HTMLIFrameElement | null,
    ) => Promise<boolean>;
    exitPrototypeEditorPanelOnly: (
        iframe?: HTMLIFrameElement | null,
    ) => void;
    postPrototypeEditorDisable: (iframe: HTMLIFrameElement) => Promise<PrototypeEditorBridgeStateMessage | null>;
    postPrototypeEditorHostToolbarAction: (
        iframe: HTMLIFrameElement,
        action: GenieEditorHostToolbarAction,
    ) => Promise<PrototypeEditorBridgeStateMessage | null>;
    postPrototypeEditorSaveAction: (
        iframe: HTMLIFrameElement,
        action: QuickEditSaveAction,
    ) => Promise<PrototypeEditorBridgeStateMessage | null>;
    queryPrototypeEditorState: (iframe: HTMLIFrameElement) => Promise<PrototypeEditorBridgeStateMessage | null>;
};

export function usePrototypeEditorBridgeActions({
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
}: UsePrototypeEditorBridgeActionsParams): PrototypeEditorBridgeActions {
    const prototypeEditorBridgeRequestSeqRef = useRef(0);
    const prototypeEditorBridgePendingRequestsRef = useRef<Map<string, PrototypeEditorBridgePendingRequest>>(new Map());

    const getPrototypeEditorApi = useCallback((iframe: HTMLIFrameElement | null = getPrimaryPreviewIframe()): PrototypeEditorApi | null => {
        const editors = readPreviewFrameEditorApi<PrototypeEditorApi>(iframe, 'DevTemplateBootstrap');
        return editors;
    }, [getPrimaryPreviewIframe]);

    const buildPrototypeEditorContext = useCallback((iframe: HTMLIFrameElement): PrototypeEditorContext => {
        const pane: PreviewPane = iframe === getSecondaryPreviewIframe() ? 'secondary' : 'primary';
        return {
            projectId: selectedEditablePreviewResource?.projectId,
            resourceId: selectedEditablePreviewResource?.resourceId || selectedEditablePreviewResource?.name,
            resourceType,
            pane,
            mobileMode: resourceType === 'prototype' ? pane === 'secondary' : false,
        };
    }, [getSecondaryPreviewIframe, resourceType, selectedEditablePreviewResource]);

    const buildPrototypeEditorEnableOptions = useCallback((
        context: PrototypeEditorContext,
        runtimeOverride?: PrototypeEditorRuntimeOverride,
    ): PrototypeEditorEnableOptions => {
        const apiBaseUrl = runtimeOverride?.apiBaseUrl?.trim() || assistantApiBaseUrl?.trim() || '';
        const projectPath = runtimeOverride?.projectPath?.trim() || assistantProjectPath?.trim() || '';
        const integrationChannel = projectPath || 'axhub';
        const editorClientId = assistantWebEditorClientId?.trim() || '';

        return {
            toolbarMode: 'host',
            initialDarkMode: isDarkMode,
            mobileMode: context.mobileMode,
            genieBridge: {
                enabled: Boolean(apiBaseUrl && integrationChannel),
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
        isDarkMode,
    ]);

    const postPrototypeEditorBridgeMessage = useCallback((
        iframe: HTMLIFrameElement,
        payload: Record<string, unknown>,
    ): Promise<PrototypeEditorBridgeStateMessage | null> => {
        if (!iframe.contentWindow) {
            return Promise.resolve(null);
        }
        const requestId = `prototype-editor-${Date.now()}-${prototypeEditorBridgeRequestSeqRef.current += 1}`;
        return new Promise((resolve) => {
            const timeoutId = window.setTimeout(() => {
                prototypeEditorBridgePendingRequestsRef.current.delete(requestId);
                resolve(null);
            }, PROTOTYPE_EDITOR_BRIDGE_TIMEOUT_MS);
            const normalizedTimeoutId = Number(timeoutId);
            prototypeEditorBridgePendingRequestsRef.current.set(requestId, {
                iframe,
                resolve,
                timeoutId: normalizedTimeoutId,
            });
            iframe.contentWindow?.postMessage({
                ...payload,
                requestId,
            }, getIframeOrigin(iframe));
        });
    }, [getIframeOrigin]);

    const postPrototypeEditorEnable = useCallback((
        iframe: HTMLIFrameElement,
        context: PrototypeEditorContext,
        runtimeOverride?: PrototypeEditorRuntimeOverride,
    ) => postPrototypeEditorBridgeMessage(iframe, {
        type: 'AXHUB_PROTOTYPE_EDITOR_ENABLE',
        context,
        options: buildPrototypeEditorEnableOptions(context, runtimeOverride),
    }), [buildPrototypeEditorEnableOptions, postPrototypeEditorBridgeMessage]);

    const postPrototypeEditorDisable = useCallback((iframe: HTMLIFrameElement) => (
        postPrototypeEditorBridgeMessage(iframe, {
            type: 'AXHUB_PROTOTYPE_EDITOR_DISABLE',
        })
    ), [postPrototypeEditorBridgeMessage]);

    const postPrototypeEditorHostToolbarAction = useCallback((
        iframe: HTMLIFrameElement,
        action: GenieEditorHostToolbarAction,
    ) => postPrototypeEditorBridgeMessage(iframe, {
        type: 'AXHUB_PROTOTYPE_EDITOR_HOST_TOOLBAR_ACTION',
        action,
        options: buildPrototypeEditorEnableOptions(buildPrototypeEditorContext(iframe)),
    }), [
        buildPrototypeEditorContext,
        buildPrototypeEditorEnableOptions,
        postPrototypeEditorBridgeMessage,
    ]);

    const postPrototypeEditorSaveAction = useCallback((
        iframe: HTMLIFrameElement,
        action: QuickEditSaveAction,
    ) => postPrototypeEditorBridgeMessage(iframe, {
        type: 'AXHUB_PROTOTYPE_EDITOR_SAVE_ACTION',
        action,
    } satisfies PrototypeEditorSaveActionMessage), [postPrototypeEditorBridgeMessage]);

    const queryPrototypeEditorState = useCallback((iframe: HTMLIFrameElement) => (
        postPrototypeEditorBridgeMessage(iframe, {
            type: 'AXHUB_PROTOTYPE_EDITOR_QUERY_STATE',
        })
    ), [postPrototypeEditorBridgeMessage]);

    const enterPrototypeEditor = useCallback(async (
        iframe: HTMLIFrameElement | null = getPrimaryPreviewIframe(),
        options: PrototypeEditorEnterOptions = {},
    ) => {
        if (!iframe?.contentWindow) {
            if (options.showMissingWarning !== false) {
                messageApi.warning('未找到可操作的预览窗口');
            }
            return false;
        }
        const context = buildPrototypeEditorContext(iframe);
        const editors = getPrototypeEditorApi(iframe);
        if (editors?.enable) {
            editors.setContext?.(context);
            await Promise.resolve(editors.enable('webEditorV2', buildPrototypeEditorEnableOptions(context, options.runtime)));

            if (context.pane === 'primary') {
                prototypeHostToolbarUnsubscribeRef.current?.();
                prototypeHostToolbarUnsubscribeRef.current = editors.subscribeHostToolbarState?.((nextState) => {
                    setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(
                        previousState,
                        nextState,
                        isDarkModeRef.current,
                    ));
                }) ?? null;
                const nextState = editors.getHostToolbarState?.() ?? createDefaultHostToolbarState();
                setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, nextState, isDarkMode));
            }

            return true;
        }

        const bridgeResult = await postPrototypeEditorEnable(iframe, context, options.runtime);
        if (bridgeResult?.hostToolbarState && context.pane === 'primary') {
            setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, bridgeResult.hostToolbarState ?? null, isDarkMode));
        } else if (bridgeResult?.success && context.pane === 'primary') {
            setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, createDefaultHostToolbarState(), isDarkMode));
        }
        if (bridgeResult?.success) {
            // Schedule a delayed state sync to catch async Genie Bridge auto-connect.
            // The initial enable response may have robotState:'sleeping' because the
            // bridge hasn't connected yet. This re-query catches the state update.
            const DELAYED_STATE_SYNC_MS = 2500;
            window.setTimeout(async () => {
                if (!iframe.contentWindow || iframe !== getPrimaryPreviewIframe()) return;
                const syncResult = await queryPrototypeEditorState(iframe);
                if (syncResult?.hostToolbarState && iframe === getPrimaryPreviewIframe()) {
                    setHostToolbarState((prev) =>
                        resolveHostToolbarStateForDisplay(prev, syncResult.hostToolbarState ?? null, isDarkModeRef.current),
                    );
                }
            }, DELAYED_STATE_SYNC_MS);
            return true;
        }
        if (options.showMissingWarning !== false) {
            messageApi.warning('当前客户端页面尚未接入真正的快速编辑器，请确认预览页已加载 DevTemplateBootstrap');
        }
        return false;
    }, [
        buildPrototypeEditorContext,
        buildPrototypeEditorEnableOptions,
        getPrimaryPreviewIframe,
        getPrototypeEditorApi,
        isDarkModeRef,
        messageApi,
        postPrototypeEditorEnable,
        prototypeHostToolbarUnsubscribeRef,
        queryPrototypeEditorState,
        setHostToolbarState,
    ]);

    useEffect(() => () => {
        prototypeEditorBridgePendingRequestsRef.current.forEach((pendingRequest) => {
            window.clearTimeout(pendingRequest.timeoutId);
            pendingRequest.resolve(null);
        });
        prototypeEditorBridgePendingRequestsRef.current.clear();
    }, []);

    useEffect(() => {
        const handlePrototypeEditorBridgeMessage = (event: MessageEvent) => {
            if (event.data?.type !== 'AXHUB_PROTOTYPE_EDITOR_STATE') {
                return;
            }
            const message = event.data as PrototypeEditorBridgeStateMessage;
            const requestId = typeof message.requestId === 'string' ? message.requestId : '';
            const pendingRequest = requestId
                ? prototypeEditorBridgePendingRequestsRef.current.get(requestId)
                : null;
            const targetIframe = pendingRequest?.iframe
                ?? getPreviewIframes().find((iframe) => iframe.contentWindow === event.source)
                ?? null;
            if (!targetIframe || event.source !== targetIframe.contentWindow) {
                return;
            }
            if (event.origin !== getIframeOrigin(targetIframe)) {
                return;
            }
            if (pendingRequest) {
                window.clearTimeout(pendingRequest.timeoutId);
                prototypeEditorBridgePendingRequestsRef.current.delete(requestId);
                pendingRequest.resolve(message);
            }
            if (message.hostToolbarState && targetIframe === getPrimaryPreviewIframe()) {
                setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(
                    previousState,
                    message.hostToolbarState ?? null,
                    isDarkModeRef.current,
                ));
            }
        };

        window.addEventListener('message', handlePrototypeEditorBridgeMessage);
        return () => window.removeEventListener('message', handlePrototypeEditorBridgeMessage);
    }, [
        getIframeOrigin,
        getPreviewIframes,
        getPrimaryPreviewIframe,
        isDarkModeRef,
        setHostToolbarState,
    ]);

    const enterPrototypeEditorPanelOnly = useCallback(async (
        iframe: HTMLIFrameElement | null = getPrimaryPreviewIframe(),
    ) => {
        if (!iframe?.contentWindow) {
            return false;
        }
        const editors = getPrototypeEditorApi(iframe);
        if (editors?.enablePanelOnly) {
            const context = buildPrototypeEditorContext(iframe);
            editors.setContext?.(context);
            await Promise.resolve(editors.enablePanelOnly(buildPrototypeEditorEnableOptions(context)));

            prototypeHostToolbarUnsubscribeRef.current?.();
            prototypeHostToolbarUnsubscribeRef.current = editors.subscribeHostToolbarState?.((nextState) => {
                setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(
                    previousState,
                    nextState,
                    isDarkModeRef.current,
                ));
            }) ?? null;
            const nextState = editors.getHostToolbarState?.() ?? createDefaultHostToolbarState();
            setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, nextState, isDarkMode));

            return true;
        }
        // Fallback: bridge message for panel-only mode
        const bridgeResult = await postPrototypeEditorBridgeMessage(iframe, {
            type: 'AXHUB_PROTOTYPE_EDITOR_ENABLE_PANEL_ONLY',
            context: buildPrototypeEditorContext(iframe),
            options: buildPrototypeEditorEnableOptions(buildPrototypeEditorContext(iframe)),
        });
        if (bridgeResult?.success) {
            if (bridgeResult.hostToolbarState) {
                setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, bridgeResult.hostToolbarState ?? null, isDarkMode));
            }
            return true;
        }
        return false;
    }, [
        getPrototypeEditorApi,
        getPrimaryPreviewIframe,
        buildPrototypeEditorContext,
        buildPrototypeEditorEnableOptions,
        isDarkMode,
        isDarkModeRef,
        postPrototypeEditorBridgeMessage,
        prototypeHostToolbarUnsubscribeRef,
        setHostToolbarState,
    ]);

    const exitPrototypeEditorPanelOnly = useCallback((
        iframe: HTMLIFrameElement | null = getPrimaryPreviewIframe(),
    ) => {
        if (!iframe?.contentWindow) return;
        const editors = getPrototypeEditorApi(iframe);
        if (editors?.disablePanelOnly) {
            editors.disablePanelOnly();
        } else {
            void postPrototypeEditorBridgeMessage(iframe, {
                type: 'AXHUB_PROTOTYPE_EDITOR_DISABLE_PANEL_ONLY',
            });
        }
        prototypeHostToolbarUnsubscribeRef.current?.();
        prototypeHostToolbarUnsubscribeRef.current = null;
        setHostToolbarState(null);
    }, [
        getPrototypeEditorApi,
        getPrimaryPreviewIframe,
        postPrototypeEditorBridgeMessage,
        prototypeHostToolbarUnsubscribeRef,
        setHostToolbarState,
    ]);

    return {
        getPrototypeEditorApi,
        enterPrototypeEditor,
        enterPrototypeEditorPanelOnly,
        exitPrototypeEditorPanelOnly,
        postPrototypeEditorDisable,
        postPrototypeEditorHostToolbarAction,
        postPrototypeEditorSaveAction,
        queryPrototypeEditorState,
    };
}
