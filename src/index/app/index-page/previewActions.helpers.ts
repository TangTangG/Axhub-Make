import type {
    ElementLocator,
    CommentaryEditedSnapshot,
    CommentaryDebugState,
    CommentaryHostToolbarAction,
    CommentaryHostToolbarState,
} from '@/common/web-editor-types';
import type { AxureCopyOptions, ImageConfig } from '../../types';
import type { ExportIndexBundle } from '../../services/api';
import type { PreviewConfig } from '../../domains/device/preview-layout';
import { getExplicitLocalPath, stripIndexFilePath } from '../../utils/localPath';
import { appendEditorLaunchOptionsToUrl, type BuildEditorUrlOptions } from '../../utils/url';

export const DEVICE_SIZES = {
    desktop: { id: 'desktop', width: 1440, height: 900 },
    mobile: { id: 'mobile', width: 393, height: 852 },
    tablet: { id: 'tablet', width: 820, height: 1180 },
} as const;

export type PreviewPane = 'primary' | 'secondary';
export type PrototypePanePromptAction = 'copy-prompt' | 'send-to-agent';
export type PrototypePanePrompt = {
    pane: PreviewPane;
    promptText: string | null | undefined;
};
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

export function resolveCurrentPreviewScreenshotSize(
    config: PreviewConfig,
    fallback: { width: number; height: number },
): { width: number; height: number } {
    if (config.previewMode === 'split') {
        return {
            width: normalizePreviewWidth(config.splitWidths.primary, DEVICE_SIZES.desktop.width),
            height: normalizePreviewHeight(config.splitHeights.primary, DEVICE_SIZES.desktop.height),
        };
    }

    if (config.previewMode === 'single' && config.singlePreset === 'custom') {
        return {
            width: normalizePreviewWidth(config.customWidth ?? fallback.width, fallback.width),
            height: normalizePreviewHeight(config.customHeight ?? fallback.height, fallback.height),
        };
    }

    if (config.previewMode === 'single' && config.singlePreset in DEVICE_SIZES) {
        const deviceSize = DEVICE_SIZES[config.singlePreset as keyof typeof DEVICE_SIZES];
        return {
            width: deviceSize.width,
            height: deviceSize.height,
        };
    }

    if (config.singlePreset === 'custom') {
        return {
            width: normalizePreviewWidth(config.customWidth ?? fallback.width, fallback.width),
            height: normalizePreviewHeight(config.customHeight ?? fallback.height, fallback.height),
        };
    }

    if (config.singlePreset in DEVICE_SIZES) {
        const deviceSize = DEVICE_SIZES[config.singlePreset as keyof typeof DEVICE_SIZES];
        return {
            width: deviceSize.width,
            height: deviceSize.height,
        };
    }

    return fallback;
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
    getHostToolbarState?: () => CommentaryHostToolbarState;
    subscribeHostToolbarState?: (listener: (state: CommentaryHostToolbarState) => void) => () => void;
    runHostToolbarAction?: (action: CommentaryHostToolbarAction) => Promise<boolean>;
    getCopyPromptText?: () => string;
    getElementPromptText?: (elementKey: string) => string;
    getEditedSnapshot?: () => CommentaryEditedSnapshot;
    setNodeEditingState?: (
        elementKey: string,
        nextState: 'editing' | 'idle' | 'completed' | 'error',
        taskRef: {
            provider: string | null;
            sessionId: string | null;
            requestId: string | null;
        } | null,
        targetRef?: {
            locator?: ElementLocator | null;
            label?: string | null;
        } | null,
    ) => Promise<unknown>;
    getDecisionDataCount?: () => number;
};

export type DocumentEditorApi = HostToolbarEditorsApi & {
    enableDocumentEditor?: (options?: {
        toolbarMode?: 'inline' | 'host';
        quickEditMode?: 'comment' | 'edit';
        initialDarkMode?: boolean;
        assistantPanelOpen?: boolean;
    }) => void | Promise<void>;
    disableDocumentEditor?: () => void | Promise<void>;
};

export type PrototypeEditorContext = {
    projectId?: string;
    resourceId?: string;
    resourceType: 'prototype' | 'theme';
    pane: PreviewPane;
    pageId?: string;
    commentPageScope?: string;
    mobileMode: boolean;
};

export type PrototypeEditorApi = HostToolbarEditorsApi & {
    enable?: (mode: 'webEditorV2', options?: {
        toolbarMode?: 'inline' | 'host';
        initialDarkMode?: boolean;
        assistantPanelOpen?: boolean;
        commentPageScope?: string;
        annotationApiBaseUrl?: string;
        annotationProjectId?: string;
    }) => void | Promise<void>;
    disable?: () => void | Promise<void>;
    setContext?: (context: PrototypeEditorContext) => void;
    saveWebEditorTextChanges?: () => void | Promise<void>;
    saveWebEditorStyleChanges?: () => void | Promise<void>;
    clearWebEditorForcedStyles?: () => void | Promise<void>;
    enablePanelOnly?: (options?: {
        toolbarMode?: 'inline' | 'host';
        initialDarkMode?: boolean;
        assistantPanelOpen?: boolean;
        commentPageScope?: string;
        annotationApiBaseUrl?: string;
        annotationProjectId?: string;
    }) => void | Promise<void>;
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
    hostToolbarState?: CommentaryHostToolbarState | null;
    debugState?: CommentaryDebugState | null;
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
    bootstrapKey: 'DevTemplateBootstrap' | 'SpecTemplateBootstrap' | 'HtmlTemplateBootstrap',
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

export function isHostToolbarWakePendingState(state: CommentaryHostToolbarState | null | undefined): boolean {
    return Boolean(state && (state.robotLoading || state.robotState === 'waking'));
}

export function isHostToolbarAgentAwake(state: CommentaryHostToolbarState | null | undefined): boolean {
    return state?.robotState === 'awake' || state?.robotState === 'working';
}

function getPrototypePanePromptLabel(pane: PreviewPane): string {
    return pane === 'secondary' ? '手机端' : 'PC 端';
}

export function buildCombinedPrototypePrompt(prompts: PrototypePanePrompt[]): string {
    const nonEmptyPrompts = prompts
        .map((item) => ({
            pane: item.pane,
            promptText: String(item.promptText ?? '').trim(),
        }))
        .filter((item) => item.promptText.length > 0);

    if (nonEmptyPrompts.length === 0) {
        return '';
    }

    const intro = nonEmptyPrompts.length > 1
        ? '请同时处理以下两个端的批注修改。'
        : `请处理以下${getPrototypePanePromptLabel(nonEmptyPrompts[0].pane)}的批注修改。`;
    const sections = nonEmptyPrompts.flatMap((item) => [
        `## ${getPrototypePanePromptLabel(item.pane)}`,
        item.promptText,
    ]);

    return [intro, '', ...sections.flatMap((section, index) => (
        index > 0 && index % 2 === 0 ? ['', section] : [section]
    ))].join('\n');
}

export function resolveHostToolbarStateForDisplay(
    previousState: CommentaryHostToolbarState | null,
    nextState: CommentaryHostToolbarState | null,
    hostDarkMode?: boolean,
): CommentaryHostToolbarState | null {
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
            selectionModeActive: nextState.selectionModeActive,
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
    previousState: CommentaryHostToolbarState | null,
    nextState: CommentaryHostToolbarState | null,
    hostDarkMode?: boolean,
): CommentaryHostToolbarState | null {
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

export function resolveActiveAnnotationDirectRunToolbarState(
    state: CommentaryHostToolbarState | null,
    options: {
        activeRunCount: number;
        maxRunCount: number;
    },
): CommentaryHostToolbarState | null {
    const activeRunCount = Math.max(0, Math.floor(Number(options.activeRunCount) || 0));
    if (!state || activeRunCount <= 0) {
        return state;
    }
    const maxRunCount = Math.max(1, Math.floor(Number(options.maxRunCount) || 1));
    const concurrencyFull = activeRunCount >= maxRunCount;
    return {
        ...state,
        robotState: 'working',
        robotLoading: false,
        sendDisabled: concurrencyFull,
        sendLoading: concurrencyFull,
        interruptVisible: true,
        interruptDisabled: false,
        interruptLoading: false,
    };
}

export function waitForHostToolbarActionState(
    editors: HostToolbarEditorsApi,
    action: CommentaryHostToolbarAction,
    previousState?: CommentaryHostToolbarState | null,
): Promise<CommentaryHostToolbarState | null> {
    if (action.type === 'enable-annotation') {
        const initialState = editors.getHostToolbarState?.() ?? null;
        if (initialState?.annotationEnabled) {
            return Promise.resolve(initialState);
        }

        return new Promise((resolveState) => {
            let settled = false;
            let unsubscribe: (() => void) | undefined;
            const timerApi = typeof window !== 'undefined' ? window : globalThis;
            const finish = (state: CommentaryHostToolbarState | null) => {
                if (settled) return;
                settled = true;
                unsubscribe?.();
                timerApi.clearTimeout(timeoutId);
                resolveState(state);
            };
            const timeoutId = timerApi.setTimeout(() => {
                finish(editors.getHostToolbarState?.() ?? initialState ?? previousState ?? null);
            }, HOST_TOOLBAR_STATE_SETTLE_TIMEOUT_MS);

            if (!editors.subscribeHostToolbarState) {
                finish(initialState ?? previousState ?? null);
                return;
            }

            unsubscribe = editors.subscribeHostToolbarState((nextState) => {
                if (nextState?.annotationEnabled) {
                    finish(nextState);
                }
            });
        });
    }

    if (action.type !== 'wake-agent') {
        return Promise.resolve(editors.getHostToolbarState?.() ?? null);
    }

    const isSettledWakeState = (state: CommentaryHostToolbarState | null | undefined) =>
        Boolean(state && !isHostToolbarWakePendingState(state));
    const isSuccessfulWakeState = (state: CommentaryHostToolbarState | null | undefined) =>
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
        const finish = (state: CommentaryHostToolbarState | null) => {
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

export function createDefaultHostToolbarState(): CommentaryHostToolbarState {
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
        interruptTitle: '中断执行',
        interruptDisabled: true,
        interruptLoading: false,
        copyPromptVisible: true,
        copyPromptTitle: '复制提示词',
        copyPromptDisabled: true,
        clearEditsTitle: '清空编辑',
        clearEditsDisabled: true,
        propertyPanelVisible: false,
        propertyPanelOpen: false,
        propertyPanelTitle: '设计决策',
        modifiedCount: 0,
        terminalTaskCount: 0,
        selectedAgent: null,
        agentOptions: [{ value: null, label: '默认' }],
        aiExecutionConfigSummary: '',
        aiExecutionConfigConfigured: false,
        aiExecutionProvider: '',
        aiExecutionWorkspacePath: '',
        aiExecutionRunConcurrency: 5,
        aiExecutionProviderOptions: [],
        darkMode: false,
        disablePageAnimations: false,
        pageZoomEnabled: false,
        copySkillInstallPromptDisabled: false,
        selectionModeActive: true,
        fullExitAvailable: false,
        annotationEnabled: false,
        annotationEnableAvailable: false,
        annotationEnableLoading: false,
        annotationEnableDisabled: true,
        annotationEnableTitle: '开启需求标注',
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

function getWindowLocationOrigin(): string {
    return typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost';
}

function getMainPreviewRawUrl(resource: any): string {
    return typeof resource?.clientUrl === 'string' && resource.clientUrl.trim()
        ? resource.clientUrl
        : typeof resource?.previewUrl === 'string' && resource.previewUrl.trim()
            ? resource.previewUrl
            : '';
}

function getRuntimeOrigin(): string {
    return typeof window !== 'undefined'
        ? String((window as any).__RUNTIME_ORIGIN__ || '').trim().replace(/\/+$/u, '')
        : '';
}

function getHostRuntimeOrigin(): string {
    return getWindowLocationOrigin();
}

function hasExplicitUrlOrigin(value: string): boolean {
    return /^[a-z][a-z\d+.-]*:\/\//iu.test(value);
}

function isRuntimeOwnedRelativePreviewUrl(rawUrl: string): boolean {
    return /^(?:\/prototypes|\/themes)\//u.test(rawUrl);
}

function resolveMainPreviewUrl(rawUrl: string, options?: BuildEditorUrlOptions): URL {
    const runtimeOrigin = getRuntimeOrigin();
    const explicitOrigin = hasExplicitUrlOrigin(rawUrl);
    const baseOrigin = !explicitOrigin && runtimeOrigin && isRuntimeOwnedRelativePreviewUrl(rawUrl)
        ? runtimeOrigin
        : getWindowLocationOrigin();
    return appendEditorLaunchOptionsToUrl(new URL(rawUrl, baseOrigin), options);
}

export function buildMainPreviewIframeUrl(
    resource: any,
    options?: BuildEditorUrlOptions,
): string {
    if (!resource || resource.previewDisabled) {
        return '';
    }
    const rawUrl = getMainPreviewRawUrl(resource);
    if (!rawUrl) {
        return '';
    }
    try {
        return resolveMainPreviewUrl(rawUrl, options).toString();
    } catch {
        return rawUrl;
    }
}

export function buildProjectPrototypeIframeUrl(
    selectedItem: any,
    options?: BuildEditorUrlOptions,
    selectedPageId?: string | null,
): string {
    if (!selectedItem || selectedItem.previewDisabled) {
        return '';
    }
    const rawUrl = getMainPreviewRawUrl(selectedItem);
    if (!rawUrl) {
        return '';
    }
    try {
        const url = resolveMainPreviewUrl(rawUrl, options);
        const fallbackPageId = Array.isArray(selectedItem.pages) && selectedItem.pages.length > 0
            ? String(selectedItem.defaultPageId || selectedItem.pages[0]?.id || '').trim()
            : '';
        return buildPrototypePageHashUrl(url, selectedPageId || fallbackPageId);
    } catch {
        return rawUrl;
    }
}

export function buildSameOriginRuntimePreviewUrl(previewUrl: string): string {
    if (!previewUrl) {
        return '';
    }
    try {
        const currentOrigin = getWindowLocationOrigin();
        const runtimeOrigin = getRuntimeOrigin();
        const url = new URL(previewUrl, currentOrigin);
        if (
            runtimeOrigin
            && url.origin === runtimeOrigin
            && isRuntimeOwnedRelativePreviewUrl(url.pathname)
        ) {
            url.protocol = new URL(currentOrigin).protocol;
            url.host = new URL(currentOrigin).host;
        }
        return url.toString();
    } catch {
        return previewUrl;
    }
}

export function buildProjectPrototypeScreenshotIframeUrl(
    selectedItem: any,
    selectedPageId?: string | null,
): string {
    const previewUrl = buildProjectPrototypeIframeUrl(selectedItem, undefined, selectedPageId);
    return buildSameOriginRuntimePreviewUrl(previewUrl);
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

export function resolvePrototypeAnnotationTargetPath(selectedItem: any): string {
    const normalizeCandidate = (value: unknown): string => (
        typeof value === 'string'
            ? value.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
            : ''
    );
    const decodeResourceId = (value: string): string => {
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    };
    const candidates = [
        normalizeCandidate(selectedItem?.resourceId),
        normalizeCandidate(getSelectedResourceTargetPath(selectedItem)),
        normalizeCandidate(selectedItem?.name),
        normalizeCandidate(selectedItem?.clientUrl),
        normalizeCandidate(selectedItem?.previewUrl),
    ];

    for (const candidate of candidates) {
        if (!candidate) continue;
        const routeMatch = candidate.match(/(?:^|\/)prototypes\/([^/?#]+)(?:\/index\.[jt]sx?)?(?:[/?#].*)?$/u);
        if (routeMatch?.[1]) {
            return `prototypes/${decodeResourceId(routeMatch[1])}`;
        }
        const sourceMatch = candidate.match(/(?:^|\/)src\/prototypes\/([^/?#]+)(?:\/index\.[jt]sx?)?$/u);
        if (sourceMatch?.[1]) {
            return `prototypes/${decodeResourceId(sourceMatch[1])}`;
        }
        if (!candidate.includes('/') && candidate !== '.') {
            return `prototypes/${candidate}`;
        }
    }

    return '';
}

function normalizeSlashPath(value: unknown): string {
    return typeof value === 'string'
        ? value.trim().replace(/\\/g, '/').replace(/\/+$/, '')
        : '';
}

function normalizePublishResourceDirectoryPath(rawPath: unknown): string {
    const normalized = stripIndexFilePath(normalizeSlashPath(rawPath)).replace(/^\/+/, '');
    if (!normalized) {
        return '';
    }
    const sourceResourceMatch = normalized.match(/(?:^|\/)(src\/(?:prototypes|themes)\/.+)$/u);
    if (sourceResourceMatch) {
        return sourceResourceMatch[1];
    }
    const resourceMatch = normalized.match(/^(prototypes|themes)\/(.+)$/u);
    if (resourceMatch) {
        return `src/${resourceMatch[1]}/${resourceMatch[2]}`;
    }
    return normalized;
}

export function resolveCurrentPublishResourcePath({
    contentMode,
    selectedItem,
    selectedTheme,
}: {
    contentMode: string;
    selectedItem: any;
    selectedTheme: any;
}): string {
    if (contentMode === 'theme') {
        const themePath = normalizePublishResourceDirectoryPath(selectedTheme?.path)
            || normalizePublishResourceDirectoryPath(selectedTheme?.absoluteFilePath);
        if (themePath) {
            return themePath;
        }
        const themeName = typeof selectedTheme?.name === 'string' && selectedTheme.name.trim()
            ? selectedTheme.name.trim()
            : '';
        return themeName ? `src/themes/${themeName}` : '';
    }
    if (contentMode === 'preview') {
        return normalizePublishResourceDirectoryPath(getSelectedResourceTargetPath(selectedItem));
    }
    return '';
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
        runtimeOrigin: getHostRuntimeOrigin(),
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
        return resolveMainPreviewUrl(clientUrl).origin;
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
