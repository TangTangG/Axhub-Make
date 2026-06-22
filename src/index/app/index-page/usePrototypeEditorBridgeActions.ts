import {
    useCallback,
    useEffect,
    useRef,
    type Dispatch,
    type MutableRefObject,
    type SetStateAction,
} from 'react';
import type {
    GenieEditorExternalEditingTargetRef,
    GenieEditorHostToolbarAction,
    GenieEditorHostToolbarState,
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
    selectedPageId?: string | null;
    isDarkMode: boolean;
    isDarkModeRef: MutableRefObject<boolean>;
    assistantPanelOpen: boolean;
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
    assistantPanelOpen?: boolean;
    commentPageScope?: string;
};
type PrototypeEditorEnterOptions = {
    showMissingWarning?: boolean;
};
type PrototypeEditorNodeEditingState = 'editing' | 'idle' | 'completed' | 'error';
type PrototypeEditorNodeEditingTaskRef = {
    provider: string | null;
    sessionId: string | null;
    requestId: string | null;
} | null;
type PrototypeEditorNodeEditingTargetRef = GenieEditorExternalEditingTargetRef | null;

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
    postPrototypeEditorNodeEditingState: (
        iframe: HTMLIFrameElement,
        elementKey: string,
        nextState: PrototypeEditorNodeEditingState,
        taskRef: PrototypeEditorNodeEditingTaskRef,
        targetRef?: PrototypeEditorNodeEditingTargetRef,
    ) => Promise<PrototypeEditorBridgeStateMessage | null>;
    queryPrototypeEditorState: (iframe: HTMLIFrameElement) => Promise<PrototypeEditorBridgeStateMessage | null>;
};

const HTML_TEMPLATE_BOOTSTRAP_SRC = '/assets/html-template-bootstrap.js';
const HTML_TEMPLATE_BOOTSTRAP_WAIT_MS = 2000;
const HTML_TEMPLATE_BOOTSTRAP_POLL_MS = 50;

function isHtmlDocumentPreviewIframe(iframe: HTMLIFrameElement): boolean {
    const src = iframe.getAttribute('src') || iframe.src || '';
    if (!/\.html(?:[?#]|$)/iu.test(src)) {
        return false;
    }
    return src.includes('/api/docs/') || src.includes('/api/markdown-file');
}

function waitForHtmlDocumentPreviewEditorApi(iframe: HTMLIFrameElement): Promise<PrototypeEditorApi | null> {
    return new Promise((resolve) => {
        const startedAt = Date.now();
        const check = () => {
            const editors = readPreviewFrameEditorApi<PrototypeEditorApi>(iframe, 'HtmlTemplateBootstrap');
            if (editors?.enable) {
                resolve(editors);
                return;
            }
            if (Date.now() - startedAt >= HTML_TEMPLATE_BOOTSTRAP_WAIT_MS) {
                resolve(null);
                return;
            }
            window.setTimeout(check, HTML_TEMPLATE_BOOTSTRAP_POLL_MS);
        };
        check();
    });
}

async function ensureHtmlDocumentPreviewEditorApi(iframe: HTMLIFrameElement): Promise<PrototypeEditorApi | null> {
    const existing = readPreviewFrameEditorApi<PrototypeEditorApi>(iframe, 'HtmlTemplateBootstrap');
    if (existing?.enable) {
        return existing;
    }
    if (!isHtmlDocumentPreviewIframe(iframe)) {
        return null;
    }

    let doc: Document | null | undefined;
    try {
        doc = iframe.contentDocument;
        const contentType = doc?.contentType?.toLowerCase() || '';
        if (contentType && !contentType.includes('html')) {
            return null;
        }
    } catch {
        return null;
    }
    if (!doc) {
        return null;
    }

    if (!doc.querySelector('script[src*="html-template-bootstrap.js"]')) {
        const script = doc.createElement('script');
        script.type = 'module';
        script.src = HTML_TEMPLATE_BOOTSTRAP_SRC;
        doc.head?.appendChild(script) ?? doc.documentElement.appendChild(script);
    }
    return waitForHtmlDocumentPreviewEditorApi(iframe);
}

export function usePrototypeEditorBridgeActions({
    getPrimaryPreviewIframe,
    getSecondaryPreviewIframe,
    getPreviewIframes,
    getIframeOrigin,
    selectedEditablePreviewResource,
    resourceType,
    selectedPageId,
    isDarkMode,
    isDarkModeRef,
    assistantPanelOpen,
    messageApi,
    prototypeHostToolbarUnsubscribeRef,
    setHostToolbarState,
}: UsePrototypeEditorBridgeActionsParams): PrototypeEditorBridgeActions {
    const prototypeEditorBridgeRequestSeqRef = useRef(0);
    const prototypeEditorBridgePendingRequestsRef = useRef<Map<string, PrototypeEditorBridgePendingRequest>>(new Map());

    const normalizePrototypeEditorPageId = useCallback((value: unknown): string => {
        const pageId = typeof value === 'string' ? value.trim() : '';
        return /^[a-z0-9-]+$/u.test(pageId) ? pageId : '';
    }, []);

    const readPrototypeEditorPageIdFromIframe = useCallback((iframe: HTMLIFrameElement): string => {
        try {
            const href = iframe.contentWindow?.location?.href || iframe.src || '';
            const url = new URL(href, window.location.origin);
            const hashPageId = normalizePrototypeEditorPageId(new URLSearchParams(url.hash.replace(/^#/, '')).get('page'));
            return hashPageId || normalizePrototypeEditorPageId(url.searchParams.get('page'));
        } catch {
            return '';
        }
    }, [normalizePrototypeEditorPageId]);

    const buildPrototypeEditorCommentPageScope = useCallback((context: PrototypeEditorContext): string => {
        if (context.resourceType !== 'prototype' || !context.pageId) {
            return '';
        }
        const rawResourceId = typeof context.resourceId === 'string' ? context.resourceId.trim() : '';
        if (!rawResourceId) {
            return '';
        }
        const resourcePath = rawResourceId.startsWith('prototypes/')
            ? rawResourceId
            : `prototypes/${rawResourceId}`;
        return `${resourcePath}::page::${context.pageId}`;
    }, []);

    const getPrototypeEditorApi = useCallback((iframe: HTMLIFrameElement | null = getPrimaryPreviewIframe()): PrototypeEditorApi | null => {
        const editors = readPreviewFrameEditorApi<PrototypeEditorApi>(iframe, 'DevTemplateBootstrap');
        return editors ?? readPreviewFrameEditorApi<PrototypeEditorApi>(iframe, 'HtmlTemplateBootstrap');
    }, [getPrimaryPreviewIframe]);

    const buildPrototypeEditorContext = useCallback((iframe: HTMLIFrameElement): PrototypeEditorContext => {
        const pane: PreviewPane = iframe === getSecondaryPreviewIframe() ? 'secondary' : 'primary';
        return {
            projectId: selectedEditablePreviewResource?.projectId,
            resourceId: selectedEditablePreviewResource?.resourceId || selectedEditablePreviewResource?.name,
            resourceType,
            pane,
            pageId: normalizePrototypeEditorPageId(selectedPageId) || readPrototypeEditorPageIdFromIframe(iframe),
            mobileMode: resourceType === 'prototype' ? pane === 'secondary' : false,
        };
    }, [
        getSecondaryPreviewIframe,
        normalizePrototypeEditorPageId,
        readPrototypeEditorPageIdFromIframe,
        resourceType,
        selectedEditablePreviewResource,
        selectedPageId,
    ]);

    const buildPrototypeEditorEnableOptions = useCallback((context: PrototypeEditorContext): PrototypeEditorEnableOptions => {
        const commentPageScope = buildPrototypeEditorCommentPageScope(context);
        return {
            toolbarMode: 'host',
            initialDarkMode: isDarkMode,
            mobileMode: context.mobileMode,
            assistantPanelOpen,
            ...(commentPageScope ? { commentPageScope } : {}),
        };
    }, [assistantPanelOpen, buildPrototypeEditorCommentPageScope, isDarkMode]);

    const buildPrototypeEditorScopedContext = useCallback((context: PrototypeEditorContext): PrototypeEditorContext => {
        const commentPageScope = buildPrototypeEditorCommentPageScope(context);
        return commentPageScope
            ? { ...context, commentPageScope }
            : context;
    }, [buildPrototypeEditorCommentPageScope]);

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
    ) => postPrototypeEditorBridgeMessage(iframe, {
        type: 'AXHUB_PROTOTYPE_EDITOR_ENABLE',
        context: buildPrototypeEditorScopedContext(context),
        options: buildPrototypeEditorEnableOptions(context),
    }), [
        buildPrototypeEditorEnableOptions,
        buildPrototypeEditorScopedContext,
        postPrototypeEditorBridgeMessage,
    ]);

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

    const postPrototypeEditorNodeEditingState = useCallback((
        iframe: HTMLIFrameElement,
        elementKey: string,
        nextState: PrototypeEditorNodeEditingState,
        taskRef: PrototypeEditorNodeEditingTaskRef,
        targetRef?: PrototypeEditorNodeEditingTargetRef,
    ) => postPrototypeEditorBridgeMessage(iframe, {
        type: 'AXHUB_PROTOTYPE_EDITOR_NODE_EDITING_STATE',
        elementKey,
        nextState,
        taskRef,
        targetRef: targetRef ?? null,
    }), [postPrototypeEditorBridgeMessage]);

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
        const enableEditors = async (resolvedEditors: PrototypeEditorApi) => {
            resolvedEditors.setContext?.(buildPrototypeEditorScopedContext(context));
            await Promise.resolve(resolvedEditors.enable('webEditorV2', buildPrototypeEditorEnableOptions(context)));

            if (context.pane === 'primary') {
                prototypeHostToolbarUnsubscribeRef.current?.();
                prototypeHostToolbarUnsubscribeRef.current = resolvedEditors.subscribeHostToolbarState?.((nextState) => {
                    setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(
                        previousState,
                        nextState,
                        isDarkModeRef.current,
                    ));
                }) ?? null;
                const nextState = resolvedEditors.getHostToolbarState?.() ?? createDefaultHostToolbarState();
                setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, nextState, isDarkMode));
            }

            return true;
        };

        let editors = getPrototypeEditorApi(iframe);
        if (editors?.enable) {
            return enableEditors(editors);
        }

        editors = await ensureHtmlDocumentPreviewEditorApi(iframe);
        if (editors?.enable) {
            return enableEditors(editors);
        }

        const bridgeResult = await postPrototypeEditorEnable(iframe, context);
        if (bridgeResult?.hostToolbarState && context.pane === 'primary') {
            setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, bridgeResult.hostToolbarState ?? null, isDarkMode));
        } else if (bridgeResult?.success && context.pane === 'primary') {
            setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, createDefaultHostToolbarState(), isDarkMode));
        }
        if (bridgeResult?.success) {
            // Schedule a delayed state sync to catch async host editor connection.
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
            messageApi.warning('当前客户端页面尚未接入真正的快速编辑器，请确认预览页已加载 DevTemplateBootstrap 或 HtmlTemplateBootstrap');
        }
        return false;
    }, [
        buildPrototypeEditorContext,
        buildPrototypeEditorEnableOptions,
        buildPrototypeEditorScopedContext,
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
            editors.setContext?.(buildPrototypeEditorScopedContext(context));
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
        const context = buildPrototypeEditorContext(iframe);
        const bridgeResult = await postPrototypeEditorBridgeMessage(iframe, {
            type: 'AXHUB_PROTOTYPE_EDITOR_ENABLE_PANEL_ONLY',
            context: buildPrototypeEditorScopedContext(context),
            options: buildPrototypeEditorEnableOptions(context),
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
        buildPrototypeEditorScopedContext,
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
        postPrototypeEditorNodeEditingState,
        queryPrototypeEditorState,
    };
}
