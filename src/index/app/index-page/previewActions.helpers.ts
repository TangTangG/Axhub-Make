import type { GenieEditorHostToolbarAction, GenieEditorHostToolbarState } from '@/common/web-editor-types';
import type { AxureCopyOptions, ImageConfig } from '../../types';
import type { ExportIndexBundle } from '../../services/api';
import { getExplicitLocalPath, stripIndexFilePath } from '../../utils/localPath';
import { appendEditorLaunchOptionsToUrl, type BuildEditorUrlOptions } from '../../utils/url';

export const DEVICE_SIZES = {
    desktop: { id: 'desktop', width: 1440, height: 900 },
    mobile: { id: 'mobile', width: 393, height: 852 },
    tablet: { id: 'tablet', width: 820, height: 1180 },
} as const;

export type PreviewPane = 'primary' | 'secondary';
export type QuickEditRuntimeStatus = 'idle' | 'pending' | 'ready' | 'missing' | 'error';
export type QuickEditMessageType =
    | 'axhub.quickEdit.runtimeReady'
    | 'axhub.quickEdit.patch'
    | 'axhub.quickEdit.save'
    | 'axhub.quickEdit.exit'
    | 'axhub.quickEdit.error'
    | 'axhub.quickEdit.export.copyToFigmaResult'
    | 'axhub.quickEdit.export.captureScreenshotResult'
    | 'axhub.quickEdit.export.axureJsonResult';
export type QuickEditSaveAction = 'save-text' | 'save-style' | 'clear-style';

export const QUICK_EDIT_RUNTIME_MISSING_TIMEOUT_MS = 1500;
const QUICK_EDIT_MESSAGE_TYPES = new Set<QuickEditMessageType>([
    'axhub.quickEdit.runtimeReady',
    'axhub.quickEdit.patch',
    'axhub.quickEdit.save',
    'axhub.quickEdit.exit',
    'axhub.quickEdit.error',
    'axhub.quickEdit.export.copyToFigmaResult',
    'axhub.quickEdit.export.captureScreenshotResult',
    'axhub.quickEdit.export.axureJsonResult',
]);

export function isQuickEditRuntimeMessage(data: unknown): data is { type: QuickEditMessageType; [key: string]: any } {
    return Boolean(
        data
        && typeof data === 'object'
        && QUICK_EDIT_MESSAGE_TYPES.has((data as { type?: QuickEditMessageType }).type as QuickEditMessageType),
    );
}

export function normalizePreviewWidth(width: number, fallback: number): number {
    if (!Number.isFinite(width) || width <= 0) {
        return fallback;
    }
    return Math.max(280, Math.round(width));
}

export function normalizePreviewHeight(height: number, fallback: number): number {
    if (!Number.isFinite(height) || height <= 0) {
        return fallback;
    }
    return Math.max(240, Math.round(height));
}

export const DEFAULT_AXURE_COPY_OPTIONS: AxureCopyOptions = {
    preserveHierarchy: false,
    preserveSvgIcons: true,
};

export const DEFAULT_EXPORT_IMAGE_CONFIG: ImageConfig = {
    width: 500,
    height: 300,
    includeConfig: 'code',
    contentType: 'title',
    isFullScreen: true,
    rawScreenshotUrl: '',
    screenshotWidth: 0,
    screenshotHeight: 0,
    previewUrl: '',
};

export type HostToolbarEditorsApi = {
    getHostToolbarState?: () => GenieEditorHostToolbarState;
    subscribeHostToolbarState?: (listener: (state: GenieEditorHostToolbarState) => void) => () => void;
    runHostToolbarAction?: (action: GenieEditorHostToolbarAction) => Promise<boolean>;
    getCopyPromptText?: () => string;
    getDecisionDataCount?: () => number;
};

export type DocumentEditorApi = HostToolbarEditorsApi & {
    enableDocumentEditor?: (options?: { toolbarMode?: 'inline' | 'host'; initialDarkMode?: boolean }) => void | Promise<void>;
    disableDocumentEditor?: () => void | Promise<void>;
};

export type PrototypeEditorContext = {
    projectId?: string;
    resourceId?: string;
    resourceType: 'prototype' | 'theme';
    pane: PreviewPane;
    mobileMode: boolean;
};

export type PrototypeEditorApi = HostToolbarEditorsApi & {
    enable?: (mode: 'webEditorV2', options?: { toolbarMode?: 'inline' | 'host'; initialDarkMode?: boolean }) => void | Promise<void>;
    disable?: () => void | Promise<void>;
    setContext?: (context: PrototypeEditorContext) => void;
    saveWebEditorTextChanges?: () => void | Promise<void>;
    saveWebEditorStyleChanges?: () => void | Promise<void>;
    clearWebEditorForcedStyles?: () => void | Promise<void>;
    enablePanelOnly?: (options?: { toolbarMode?: 'inline' | 'host'; initialDarkMode?: boolean }) => void | Promise<void>;
    disablePanelOnly?: () => void | Promise<void>;
};

export type PrototypeEditorBridgeStateMessage = {
    type: 'AXHUB_PROTOTYPE_EDITOR_STATE';
    requestId?: string;
    success?: boolean;
    handled?: boolean;
    active?: boolean;
    mode?: string;
    error?: string;
    hostToolbarState?: GenieEditorHostToolbarState | null;
    promptText?: string;
    decisionDataCount?: number;
};

export type PrototypeEditorSaveActionMessage = {
    type: 'AXHUB_PROTOTYPE_EDITOR_SAVE_ACTION';
    action: QuickEditSaveAction;
};

export type PrototypeEditorBridgePendingRequest = {
    iframe: HTMLIFrameElement;
    resolve: (message: PrototypeEditorBridgeStateMessage | null) => void;
    timeoutId: number;
};

const HOST_TOOLBAR_STATE_SETTLE_TIMEOUT_MS = 1500;
export const PROTOTYPE_EDITOR_BRIDGE_TIMEOUT_MS = 1500;

export function readPreviewFrameEditorApi<T extends object>(
    iframe: HTMLIFrameElement | null | undefined,
    bootstrapKey: 'DevTemplateBootstrap' | 'SpecTemplateBootstrap',
): T | null {
    try {
        const editors = (iframe?.contentWindow as any)?.[bootstrapKey]?.editors;
        return editors && typeof editors === 'object' ? editors as T : null;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'SecurityError') {
            return null;
        }
        return null;
    }
}

export function isHostToolbarWakePendingState(state: GenieEditorHostToolbarState | null | undefined): boolean {
    return Boolean(state && (state.robotLoading || state.robotState === 'waking'));
}

export function isHostToolbarGenieAwake(state: GenieEditorHostToolbarState | null | undefined): boolean {
    return state?.robotState === 'awake' || state?.robotState === 'working';
}

export function resolveHostToolbarStateForDisplay(
    previousState: GenieEditorHostToolbarState | null,
    nextState: GenieEditorHostToolbarState | null,
    hostDarkMode?: boolean,
): GenieEditorHostToolbarState | null {
    if (!nextState) {
        return previousState;
    }
    const resolvedDarkMode = typeof hostDarkMode === 'boolean' ? hostDarkMode : nextState.darkMode;
    if (nextState.toolbarMode === 'host' && !nextState.visible) {
        if (previousState?.visible) {
            return previousState;
        }
        return {
            ...createDefaultHostToolbarState(),
            toolbarMode: 'host',
            visible: true,
            darkMode: resolvedDarkMode,
            disablePageAnimations: nextState.disablePageAnimations,
            pageZoomEnabled: nextState.pageZoomEnabled,
            propertyPanelOpen: nextState.propertyPanelOpen,
            modifiedCount: nextState.modifiedCount,
            terminalTaskCount: nextState.terminalTaskCount,
            selectedAgent: nextState.selectedAgent,
            agentOptions: nextState.agentOptions,
            fullExitAvailable: nextState.fullExitAvailable,
        };
    }
    if (isHostToolbarWakePendingState(nextState) && previousState?.visible) {
        return previousState;
    }
    if (!nextState.visible && previousState?.visible && previousState.toolbarMode === 'host') {
        return previousState;
    }
    const resolvedState = {
        ...nextState,
        darkMode: resolvedDarkMode,
    };
    if (resolvedState.toolbarMode === 'host') {
        return {
            ...resolvedState,
            sendVisible: true,
            interruptVisible: true,
            copyPromptVisible: true,
        };
    }
    return resolvedState;
}

export function resolveHostToolbarStateAfterClearEdits(
    previousState: GenieEditorHostToolbarState | null,
    nextState: GenieEditorHostToolbarState | null,
    hostDarkMode?: boolean,
): GenieEditorHostToolbarState | null {
    const resolvedState = resolveHostToolbarStateForDisplay(previousState, nextState, hostDarkMode);
    if (!resolvedState) {
        return resolvedState;
    }
    return {
        ...resolvedState,
        sendDisabled: true,
        sendLoading: false,
        copyPromptDisabled: true,
        clearEditsDisabled: true,
        modifiedCount: 0,
        terminalTaskCount: 0,
    };
}

export function waitForHostToolbarActionState(
    editors: HostToolbarEditorsApi,
    action: GenieEditorHostToolbarAction,
    previousState?: GenieEditorHostToolbarState | null,
): Promise<GenieEditorHostToolbarState | null> {
    if (action.type !== 'wake-genie') {
        return Promise.resolve(editors.getHostToolbarState?.() ?? null);
    }

    const isSettledWakeState = (state: GenieEditorHostToolbarState | null | undefined) =>
        Boolean(state && !isHostToolbarWakePendingState(state));
    const isSuccessfulWakeState = (state: GenieEditorHostToolbarState | null | undefined) =>
        state?.robotState === 'awake' || state?.robotState === 'working';
    const initialState = editors.getHostToolbarState?.() ?? null;
    if (isSuccessfulWakeState(initialState)) {
        return Promise.resolve(initialState);
    }
    if (isSettledWakeState(initialState) && isHostToolbarWakePendingState(previousState)) {
        return Promise.resolve(initialState);
    }

    return new Promise((resolveState) => {
        let settled = false;
        let unsubscribe: (() => void) | undefined;
        let sawPendingWakeState = isHostToolbarWakePendingState(initialState);
        const timerApi = typeof window !== 'undefined' ? window : globalThis;
        const finish = (state: GenieEditorHostToolbarState | null) => {
            if (settled) return;
            settled = true;
            unsubscribe?.();
            timerApi.clearTimeout(timeoutId);
            resolveState(state);
        };
        const timeoutId = timerApi.setTimeout(() => {
            finish(previousState ?? null);
        }, HOST_TOOLBAR_STATE_SETTLE_TIMEOUT_MS);

        if (!editors.subscribeHostToolbarState) {
            return;
        }

        unsubscribe = editors.subscribeHostToolbarState((nextState) => {
            if (isSuccessfulWakeState(nextState)) {
                finish(nextState);
                return;
            }
            if (isHostToolbarWakePendingState(nextState)) {
                sawPendingWakeState = true;
                return;
            }
            if (sawPendingWakeState && isSettledWakeState(nextState)) {
                finish(nextState);
            }
        });
    });
}

export function createDefaultHostToolbarState(): GenieEditorHostToolbarState {
    return {
        toolbarMode: 'host',
        visible: true,
        robotState: 'sleeping',
        robotTitle: '连接本地 AI',
        robotDisabled: false,
        robotLoading: false,
        sendVisible: true,
        sendTitle: '执行',
        sendDisabled: true,
        sendLoading: false,
        interruptVisible: true,
        interruptTitle: '中断',
        interruptDisabled: true,
        interruptLoading: false,
        copyPromptVisible: true,
        copyPromptTitle: '复制提示词',
        copyPromptDisabled: false,
        clearEditsTitle: '清空编辑',
        clearEditsDisabled: true,
        propertyPanelOpen: false,
        propertyPanelTitle: '设计决策',
        modifiedCount: 0,
        terminalTaskCount: 0,
        selectedAgent: null,
        agentOptions: [{ value: null, label: '默认' }],
        darkMode: false,
        disablePageAnimations: false,
        pageZoomEnabled: false,
        copySkillInstallPromptDisabled: false,
        fullExitAvailable: false,
    };
}

type DeferredAssistantRuntimeProbeParams<Runtime> = {
    probeRuntime?: (() => Runtime | Promise<Runtime>) | null;
    isEditorActive?: () => boolean;
    onRuntimeReady?: (runtime: Runtime) => void;
    onRuntimeError?: (error: unknown) => void;
};

export function isAssistantRuntimeReady(runtime: unknown): boolean {
    if (!runtime || typeof runtime !== 'object') {
        return false;
    }
    const health = (runtime as { health?: { status?: unknown } | null }).health;
    return Boolean(health && typeof health === 'object' && health.status === 'ready');
}

export function startDeferredAssistantRuntimeProbe<Runtime = unknown>({
    probeRuntime,
    isEditorActive,
    onRuntimeReady,
    onRuntimeError,
}: DeferredAssistantRuntimeProbeParams<Runtime>): void {
    if (!probeRuntime) {
        return;
    }

    let probeResult: Runtime | Promise<Runtime>;
    try {
        probeResult = probeRuntime();
    } catch (error) {
        onRuntimeError?.(error);
        return;
    }

    void Promise.resolve(probeResult)
        .then((runtime) => {
            if (!isAssistantRuntimeReady(runtime)) {
                return;
            }
            if (isEditorActive && !isEditorActive()) {
                return;
            }
            onRuntimeReady?.(runtime);
        })
        .catch((error) => {
            onRuntimeError?.(error);
        });
}

function encodeSvgToBase64(svgContent: string): string {
    const bytes = new TextEncoder().encode(svgContent);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return window.btoa(binary);
}

export function buildRuntimeComponentAxvgPayload(params: {
    svgContent: string;
    width: number;
    height: number;
}) {
    const svgBase64 = encodeSvgToBase64(params.svgContent);
    let hash = 0;
    for (let i = 0; i < svgBase64.length; i += 1) {
        hash = (hash << 5) - hash + svgBase64.charCodeAt(i);
        hash |= 0;
    }

    const imageKey = `(svg)${Math.abs(hash).toString(36)}`;
    const itemId = globalThis.crypto?.randomUUID?.()
        ?? `axhub-runtime-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

    return {
        scene: {
            items: [{
                data: imageKey,
                isHash: true,
                corners: [],
                rect: {
                    location: { x: 113, y: 69 },
                    size: { width: params.width, height: params.height },
                },
                type: 4,
                opacity: 1,
                backgroundFills: [{
                    color: { r: 1, g: 1, b: 1, a: 1 },
                    type: 1,
                    enabled: true,
                }],
                strokes: [{
                    fill: {
                        color: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
                        type: 1,
                        enabled: true,
                    },
                    alignment: 0,
                }],
                strokePattern: [0, 0],
                strokeThickness: 0,
                text: {
                    paragraphs: [{
                        inlines: [{
                            text: '',
                            textColor: { r: 0, g: 0, b: 0, a: 1 },
                            highlight: { r: 0, g: 0, b: 0, a: 0 },
                            size: 13,
                            family: 'Arial',
                            typeface: null,
                            underline: false,
                            strikethrough: false,
                            superscript: 0,
                            baselineOffset: 0,
                            characterSpacing: 0,
                            transform: 0,
                            weight: 400,
                            style: 0,
                            stretch: 5,
                            type: 0,
                        }],
                        horizontalAlignment: 0,
                        lineSpacing: 15,
                        textListInfo: {
                            indentLevel: 0,
                            listChar: null,
                            listType: 0,
                        },
                    }],
                },
                textAlignment: 1,
                textPadding: [2, 2, 2, 2],
                effects: [{
                    shadowType: 1,
                    offset: { x: 0, y: 5 },
                    blur: 5,
                    spread: 0,
                    color: { r: 0, g: 0, b: 0, a: 0.34901960784313724 },
                    type: 1,
                    enabled: false,
                }, {
                    shadowType: 0,
                    offset: { x: 5, y: 5 },
                    blur: 5,
                    spread: 0,
                    color: { r: 0, g: 0, b: 0, a: 0.34901960784313724 },
                    type: 1,
                    enabled: false,
                }, {
                    blurType: 1,
                    radius: 4,
                    type: 0,
                    enabled: false,
                }, {
                    blurType: 0,
                    radius: 4,
                    type: 0,
                    enabled: false,
                }],
                textShadows: [{
                    shadowType: 0,
                    offset: { x: 1, y: 1 },
                    blur: 5,
                    spread: 0,
                    color: { r: 0, g: 0, b: 0, a: 0.6470588235294118 },
                    type: 1,
                    enabled: false,
                }],
                rotation: 0,
                textRotation: 0,
                flippedHorizontal: false,
                flippedVertical: false,
                visible: true,
                isMask: false,
                maskedScene: null,
                meta: null,
                isLocked: false,
                itemType: 1,
                id: itemId,
                name: 'axhub-react-runtime',
                resizingConstraints: {
                    hasFixedHeight: false,
                    hasFixedWidth: false,
                    hasFixedBottom: false,
                    hasFixedTop: false,
                    hasFixedRight: false,
                    hasFixedLeft: false,
                },
                isNameDynamic: false,
            }],
        },
        masters: null,
        imageMap: {
            [imageKey]: svgBase64,
        },
    };
}

export function createEmbeddedIndexBundle(indexBundle: ExportIndexBundle): ExportIndexBundle {
    return {
        ...indexBundle,
        entry: {
            ...indexBundle.entry,
            code: '',
            axureCode: '',
        },
    };
}

export function buildProjectPrototypeIframeUrl(
    selectedItem: any,
    options?: BuildEditorUrlOptions,
    selectedPageId?: string | null,
): string {
    if (!selectedItem || selectedItem.previewDisabled) {
        return '';
    }
    const rawUrl = typeof selectedItem.clientUrl === 'string' && selectedItem.clientUrl.trim()
        ? selectedItem.clientUrl
        : typeof selectedItem.previewUrl === 'string' && selectedItem.previewUrl.trim()
            ? selectedItem.previewUrl
            : '';
    if (!rawUrl) {
        return '';
    }
    try {
        const hasExplicitOrigin = /^[a-z][a-z\d+.-]*:\/\//iu.test(rawUrl);
        const runtimeOrigin = String((window as any).__RUNTIME_ORIGIN__ || '').trim();
        const baseOrigin = !hasExplicitOrigin && runtimeOrigin ? runtimeOrigin : window.location.origin;
        const url = appendEditorLaunchOptionsToUrl(new URL(rawUrl, baseOrigin), options);
        const fallbackPageId = Array.isArray(selectedItem.pages) && selectedItem.pages.length > 0
            ? String(selectedItem.defaultPageId || selectedItem.pages[0]?.id || '').trim()
            : '';
        return buildPrototypePageHashUrl(url, selectedPageId || fallbackPageId);
    } catch {
        return rawUrl;
    }
}

export function buildPrototypePageHashUrl(inputUrl: URL | string, pageId?: string | null): string {
    let url: URL;
    try {
        const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        url = inputUrl instanceof URL
            ? new URL(inputUrl.toString())
            : new URL(inputUrl, baseOrigin);
    } catch {
        return typeof inputUrl === 'string' ? inputUrl : inputUrl.toString();
    }

    const normalizedPageId = typeof pageId === 'string' && /^[a-z0-9-]+$/u.test(pageId.trim())
        ? pageId.trim()
        : '';
    if (!normalizedPageId) {
        url.hash = '';
        return url.toString();
    }

    const params = new URLSearchParams(url.hash.replace(/^#/, ''));
    params.set('page', normalizedPageId);
    url.hash = params.toString();
    return url.toString();
}

export function hasExplicitSourceContext(selectedItem: any): boolean {
    return Boolean(selectedItem?.filePath || selectedItem?.absoluteFilePath || selectedItem?.artifacts?.axure);
}

export function hasFigmaMakeExportContext(selectedItem: any): boolean {
    return Boolean(selectedItem?.filePath || selectedItem?.absoluteFilePath || selectedItem?.artifacts?.figma);
}

export function getSelectedSourcePath(selectedItem: any): string {
    return getExplicitLocalPath(selectedItem);
}

export function getSelectedSourceBasePath(selectedItem: any): string {
    return stripIndexFilePath(getSelectedSourcePath(selectedItem));
}

export function getSelectedResourceTargetPath(selectedItem: any): string {
    const sourceBasePath = getSelectedSourceBasePath(selectedItem);
    if (sourceBasePath) {
        return sourceBasePath;
    }
    const resourceId = typeof selectedItem?.resourceId === 'string' && selectedItem.resourceId.trim()
        ? selectedItem.resourceId.trim()
        : typeof selectedItem?.name === 'string'
            ? selectedItem.name.trim()
            : '';
    return resourceId;
}

export function createRuntimeExportRequestId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type RuntimeExportRequestType =
    | 'axhub.quickEdit.export.copyToFigma'
    | 'axhub.quickEdit.export.captureScreenshot'
    | 'axhub.quickEdit.export.axureJson';

export function createRuntimeExportMessage({
    type,
    selectedItem,
    requestId,
    payload = {},
}: {
    type: RuntimeExportRequestType;
    selectedItem: any;
    requestId: string;
    payload?: Record<string, unknown>;
}) {
    return {
        type,
        requestId,
        projectId: selectedItem.projectId,
        resourceId: selectedItem.resourceId || selectedItem.name,
        resourceType: 'prototypes',
        clientUrl: selectedItem.clientUrl,
        ...payload,
    };
}

function getSelectedProjectResourceIdentity(selectedItem: any) {
    const projectId = typeof selectedItem?.projectId === 'string' ? selectedItem.projectId.trim() : '';
    const resourceId = typeof selectedItem?.resourceId === 'string' && selectedItem.resourceId.trim()
        ? selectedItem.resourceId.trim()
        : typeof selectedItem?.name === 'string'
            ? selectedItem.name.trim()
            : '';
    return {
        projectId,
        resourceId,
        resourceType: 'prototype',
    };
}

export function getClientUrlOrigin(clientUrl: unknown): string {
    if (typeof clientUrl !== 'string' || !clientUrl.trim()) {
        return '';
    }
    try {
        const hasExplicitOrigin = /^[a-z][a-z\d+.-]*:\/\//iu.test(clientUrl);
        const runtimeOrigin = typeof window !== 'undefined'
            ? String((window as any).__RUNTIME_ORIGIN__ || '').trim()
            : '';
        const baseOrigin = !hasExplicitOrigin && runtimeOrigin
            ? runtimeOrigin
            : typeof window !== 'undefined'
                ? window.location.origin
                : 'http://localhost';
        return new URL(clientUrl, baseOrigin).origin;
    } catch {
        return '';
    }
}

export async function postProjectCommunicationRecord(
    selectedItem: any,
    target: 'sessions' | 'exports' | 'edit-history' | 'runtime-message',
    payload: Record<string, unknown>,
) {
    const identity = getSelectedProjectResourceIdentity(selectedItem);
    if (!identity.projectId) {
        return;
    }
    await fetch(`/api/projects/${encodeURIComponent(identity.projectId)}/communication/${target}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...identity,
            ...payload,
        }),
    });
}
