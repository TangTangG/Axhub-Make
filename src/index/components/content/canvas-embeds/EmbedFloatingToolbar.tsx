import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    RefreshCw,
    Smartphone,
    Tablet,
    Monitor,
    RotateCcw,
    Code2,
    Eye,
    Link2,
    Maximize2,
} from 'lucide-react';
import { logEmbedDebug } from './AxhubWebEmbed';
import { resolveEmbedViewModeToggleUpdate } from './AnnotationOverlay';
import { CANVAS_ELEMENT_OVERLAY_Z_INDEX } from './canvasOverlayLayers';
import { fitEmbedSizeToViewport } from './embedViewportSizing';
import {
    EMBED_SIZE_PRESETS,
    EMBED_SIZE_PRESET_OPTIONS,
    applyEmbedSizePresetToElements,
    type EmbedSizePreset,
} from './embedSizePreset';
import {
    AXHUB_EMBED_ACTIVE_PREVIEW_CHANGED_EVENT,
    AXHUB_EMBED_EXIT_PREVIEW_EVENT,
    type ActiveEmbedPreview,
    type EmbedPreviewExitPrompt,
    type EmbedPreviewSessionHint,
    resolveEmbedPreviewExitPointerDecision,
    resolveEmbedPreviewSessionHint,
    shouldBlockCanvasWheelForActivePreview,
} from './embedPreviewSession';
import {
    EMBED_CONTENT_SCALE_OPTIONS,
    type EmbedContentScale,
    normalizeEmbedContentScale,
    updateEmbedContentScaleInElements,
} from './embedContentScale';
import {
    resolveEmbedClickActivationMode,
    type EmbedPointerIntentSnapshot,
    type EmbedSelectionActivationMode,
} from './embedActivationIntent';
import CanvasNodeTitleLabel, {
    CANVAS_NODE_TITLE_LABEL_HEIGHT,
    CANVAS_NODE_TITLE_LABEL_MAX_WIDTH,
    CANVAS_NODE_TITLE_LABEL_MIN_WIDTH,
    CANVAS_NODE_TITLE_LABEL_OFFSET,
    CANVAS_NODE_TITLE_LABEL_Z_INDEX,
} from './CanvasNodeTitleLabel';

/* ── Types ───────────────────────────────────────────────────────── */
interface SelectedEmbedInfo {
    elementId: string;
    /** URL used inside the canvas preview/iframe/doc renderer. */
    previewUrl: string;
    /** URL used when opening the resource outside the canvas. */
    openUrl: string;
    link: string;
    title: string;
    kind: 'web' | 'doc' | 'theme';
    /** Screen-space X of the element's top-left corner */
    screenX: number;
    /** Screen-space Y of the element's top-left corner */
    screenY: number;
    /** Screen-space width of the element */
    screenWidth: number;
    /** Screen-space height of the element */
    screenHeight: number;
    /** Canvas width of the element */
    canvasWidth: number;
    /** Canvas height of the element */
    canvasHeight: number;
    /** The element's stroke/border color */
    strokeColor: string;
    /** Current iframe content scale stored in customData */
    contentScale: EmbedContentScale;
    /** Current embed display mode */
    viewMode: 'link' | 'preview';
    previewable: boolean;
}

/** Label info for a single embeddable element (selected or not) */
interface EmbedLabelInfo {
    elementId: string;
    title: string;
    kind: 'web' | 'doc' | 'theme';
    viewMode: 'link' | 'preview';
    screenX: number;
    screenY: number;
    screenWidth: number;
    screenHeight: number;
    isSelected: boolean;
    /** The element's stroke/border color — used for highlight */
    strokeColor: string;
}

interface EmbedFloatingToolbarProps {
    excalidrawAPI: any;
    /** Ref to the container div wrapping <Excalidraw> */
    containerRef: React.RefObject<HTMLDivElement>;
}

/* ── Styles ──────────────────────────────────────────────────────── */
const LABEL_H = CANVAS_NODE_TITLE_LABEL_HEIGHT;
const ACTION_BTN_SIZE = 28;
const ACTION_GAP = 4;
const ACTION_ICON = { width: 16, height: 16 };
const LABEL_MAX_W = CANVAS_NODE_TITLE_LABEL_MAX_WIDTH;
const LABEL_MIN_W = CANVAS_NODE_TITLE_LABEL_MIN_WIDTH;
const LABEL_Z_INDEX = CANVAS_NODE_TITLE_LABEL_Z_INDEX;
const ACTION_Z_INDEX = CANVAS_ELEMENT_OVERLAY_Z_INDEX;
const POPOVER_Z_INDEX = CANVAS_ELEMENT_OVERLAY_Z_INDEX;
const AXHUB_EMBED_BRAND_COLOR = '#008F5D';
const CLICK_ACTIVATION_MOVEMENT_THRESHOLD = 5;
const TOOLTIP_DELAY_MS = 80;
const TOOLTIP_OFFSET = 8;

const actionBtnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: ACTION_BTN_SIZE,
    height: ACTION_BTN_SIZE,
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    transition: 'background 0.12s, color 0.12s, transform 0.12s',
};

/* ── Ratio pill popover styles ───────────────────────────────────── */
const pillContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.96)',
    boxShadow: '0 8px 24px rgba(15,23,42,0.16), 0 0 0 1px rgba(15,23,42,0.06)',
    backdropFilter: 'blur(8px)',
    fontSize: 12,
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
};

function pillBtnStyle(active: boolean, strokeColor: string): React.CSSProperties {
    return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 28,
        minWidth: 30,
        border: 'none',
        borderRadius: 6,
        background: active ? strokeColor : 'transparent',
        color: active ? '#fff' : '#64748b',
        cursor: 'pointer',
        padding: '0 7px',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        fontFamily: 'inherit',
        transition: 'background 0.12s, color 0.12s, transform 0.12s',
        gap: 4,
        flexShrink: 0,
    };
}

function scaleBtnStyle(active: boolean, strokeColor: string): React.CSSProperties {
    return {
        height: 26,
        minWidth: 42,
        border: 'none',
        borderRadius: 5,
        background: active ? strokeColor : 'transparent',
        color: active ? '#fff' : '#475569',
        cursor: 'pointer',
        padding: '0 8px',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        transition: 'background 0.12s, color 0.12s',
    };
}

const PILL_ICON = { width: 14, height: 14 };

/* ── Helper: canvas coords → screen coords ───────────────────────── */
function canvasToScreen(
    canvasX: number,
    canvasY: number,
    scrollX: number,
    scrollY: number,
    zoom: number,
    containerLeft: number,
    containerTop: number,
) {
    return {
        x: containerLeft + (canvasX + scrollX) * zoom,
        y: containerTop + (canvasY + scrollY) * zoom,
    };
}

function resolveEmbedStrokeColor(strokeColor: unknown): string {
    if (
        typeof strokeColor !== 'string'
        || !strokeColor.trim()
        || strokeColor.toLowerCase() === '#1e1e1e'
        || strokeColor.toLowerCase() === 'transparent'
    ) {
        return AXHUB_EMBED_BRAND_COLOR;
    }
    return strokeColor;
}

function resolveEmbedKind(el: any): 'web' | 'doc' | 'theme' {
    if (el?.customData?.type === 'axhub-doc') return 'doc';
    if (el?.customData?.type === 'axhub-theme' || el?.customData?.resourceType === 'theme') return 'theme';
    return 'web';
}

function resolveString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function resolveEmbedPreviewUrl(el: any): string {
    return resolveString(el?.customData?.previewUrl) || resolveString(el?.link);
}

function resolveEmbedOpenUrl(el: any): string {
    const previewUrl = resolveEmbedPreviewUrl(el);
    if (el?.customData?.resourceType === 'prototype' && previewUrl) {
        return previewUrl;
    }

    return resolveString(el?.customData?.openUrl) || resolveString(el?.link);
}

function isEmbedPreviewable(el: any): boolean {
    return Boolean(resolveEmbedPreviewUrl(el)) && el?.customData?.previewKind !== 'none';
}

function resolveEmbedTitle(el: any): string {
    const customData = el?.customData || {};
    const titleCandidates = [customData.title, customData.displayName, customData.name];
    for (const candidate of titleCandidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
        }
    }

    if (typeof el?.link === 'string' && el.link.trim()) {
        try {
            const url = new URL(el.link, window.location.origin);
            const lastSegment = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
            return lastSegment || url.hostname || (resolveEmbedKind(el) === 'doc' ? '文档' : '网页');
        } catch {
            return el.link.trim();
        }
    }

    const kind = resolveEmbedKind(el);
    return kind === 'doc' ? '文档' : kind === 'theme' ? '设计系统' : '网页';
}

function getActionGroupWidth(kind: 'web' | 'doc' | 'theme', viewMode: 'link' | 'preview'): number {
    const actionCount = viewMode === 'link'
        ? 1
        : ((kind === 'web' || kind === 'theme') ? 3 : 2);
    return actionCount * ACTION_BTN_SIZE + (actionCount - 1) * ACTION_GAP;
}

function getLabelMaxWidth(label: EmbedLabelInfo): number {
    if (!label.isSelected) return LABEL_MAX_W;
    const availableWidth = label.screenWidth - getActionGroupWidth(label.kind, label.viewMode) - 6;
    return Math.max(LABEL_MIN_W, Math.min(LABEL_MAX_W, availableWidth));
}

function formatContentScaleLabel(scale: EmbedContentScale): string {
    return `${Math.round(scale * 100)}%`;
}

function createActionBtnStyle(active: boolean, strokeColor: string): React.CSSProperties {
    return {
        ...actionBtnBase,
        background: active ? 'rgba(15,23,42,0.06)' : 'transparent',
        color: active ? strokeColor : '#94a3b8',
    };
}

function labelsEqual(a: EmbedLabelInfo[], b: EmbedLabelInfo[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        const left = a[i];
        const right = b[i];
        if (
            left.elementId !== right.elementId
            || left.title !== right.title
            || left.kind !== right.kind
            || left.viewMode !== right.viewMode
            || left.screenX !== right.screenX
            || left.screenY !== right.screenY
            || left.screenWidth !== right.screenWidth
            || left.screenHeight !== right.screenHeight
            || left.isSelected !== right.isSelected
            || left.strokeColor !== right.strokeColor
        ) {
            return false;
        }
    }
    return true;
}

function selectedEmbedInfoEqual(a: SelectedEmbedInfo | null, b: SelectedEmbedInfo | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.elementId === b.elementId
        && a.previewUrl === b.previewUrl
        && a.openUrl === b.openUrl
        && a.link === b.link
        && a.title === b.title
        && a.kind === b.kind
        && a.screenX === b.screenX
        && a.screenY === b.screenY
        && a.screenWidth === b.screenWidth
        && a.screenHeight === b.screenHeight
        && a.canvasWidth === b.canvasWidth
        && a.canvasHeight === b.canvasHeight
        && a.strokeColor === b.strokeColor
        && a.contentScale === b.contentScale
        && a.viewMode === b.viewMode
        && a.previewable === b.previewable;
}

interface EmbedTooltipState {
    key: string;
    text: string;
    anchorLeft: number;
    anchorTop: number;
}

/* ── Component ───────────────────────────────────────────────────── */
export default function EmbedFloatingToolbar({ excalidrawAPI, containerRef }: EmbedFloatingToolbarProps) {
    const [info, setInfo] = useState<SelectedEmbedInfo | null>(null);
    const [labels, setLabels] = useState<EmbedLabelInfo[]>([]);
    const [previewSessionHint, setPreviewSessionHint] = useState<EmbedPreviewSessionHint | null>(null);
    const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
    const [tooltip, setTooltip] = useState<EmbedTooltipState | null>(null);
    const [sizePopoverOpen, setSizePopoverOpen] = useState(false);
    const rafRef = useRef<number>(0);
    /** Tracks previously selected embed element ID for change detection */
    const prevSelectedEmbedIdRef = useRef<string | null>(null);
    const lastEmbedSizeByIdRef = useRef<Map<string, { width: number; height: number }>>(new Map());
    const sizePopoverRef = useRef<HTMLDivElement>(null);
    const warnedPollErrorRef = useRef(false);
    const activePreviewElementIdRef = useRef<string | null>(null);
    const activePreviewRef = useRef<ActiveEmbedPreview | null>(null);
    const exitPromptRef = useRef<EmbedPreviewExitPrompt | null>(null);
    const previewSessionHintRef = useRef<EmbedPreviewSessionHint | null>(null);
    const previewSessionHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activePreviewSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pointerIntentRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        selectedEmbedIdAtPointerDown: string | null;
        moved: boolean;
        released: boolean;
    } | null>(null);
    const labelsRef = useRef<EmbedLabelInfo[]>([]);
    const infoRef = useRef<SelectedEmbedInfo | null>(null);

    const dispatchEmbedSelectionChanged = useCallback((
        elementId: string,
        isSelected: boolean,
        activationMode: 'activate' | 'select-only' = 'select-only',
    ) => {
        window.dispatchEvent(new CustomEvent('axhub:embedSelectionChanged', {
            detail: { elementId, isSelected, activationMode },
        }));
    }, []);

    const clearTooltip = useCallback(() => {
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
            tooltipTimeoutRef.current = null;
        }
        setTooltip(null);
    }, []);

    const scheduleTooltip = useCallback((key: string, text: string, target: HTMLElement) => {
        const rootRect = containerRef.current?.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        if (!rootRect) return;

        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
            tooltipTimeoutRef.current = null;
        }

        tooltipTimeoutRef.current = setTimeout(() => {
            setTooltip({
                key,
                text,
                anchorLeft: targetRect.left - rootRect.left + targetRect.width / 2,
                anchorTop: targetRect.top - rootRect.top,
            });
        }, TOOLTIP_DELAY_MS);
    }, [containerRef]);

    const clearExitPrompt = useCallback(() => {
        if (previewSessionHintTimeoutRef.current) {
            clearTimeout(previewSessionHintTimeoutRef.current);
            previewSessionHintTimeoutRef.current = null;
        }
        exitPromptRef.current = null;
        previewSessionHintRef.current = null;
        setPreviewSessionHint(null);
    }, []);

    const showPreviewSessionHint = useCallback((hint: EmbedPreviewSessionHint) => {
        if (previewSessionHintTimeoutRef.current) {
            clearTimeout(previewSessionHintTimeoutRef.current);
            previewSessionHintTimeoutRef.current = null;
        }
        if (hint.kind === 'exit-confirm') {
            exitPromptRef.current = {
                elementId: hint.elementId,
                expiresAt: hint.expiresAt,
            };
        } else {
            exitPromptRef.current = null;
        }
        previewSessionHintRef.current = hint;
        setPreviewSessionHint(hint);
        previewSessionHintTimeoutRef.current = setTimeout(() => {
            setPreviewSessionHint((currentHint) => {
                if (currentHint === hint) {
                    previewSessionHintRef.current = null;
                    return null;
                }
                return currentHint;
            });
            if (exitPromptRef.current?.elementId === hint.elementId && exitPromptRef.current.expiresAt === hint.expiresAt) {
                clearExitPrompt();
            }
        }, Math.max(0, hint.expiresAt - Date.now()));
    }, [clearExitPrompt]);

    const dispatchExitPreview = useCallback((elementId: string) => {
        window.dispatchEvent(new CustomEvent(AXHUB_EMBED_EXIT_PREVIEW_EVENT, {
            detail: { elementId, reason: 'confirmed-outside-click' },
        }));
        activePreviewElementIdRef.current = null;
        activePreviewRef.current = null;
        clearExitPrompt();
    }, [clearExitPrompt]);

    const isTargetWithinEmbedUi = useCallback((target: EventTarget | null): boolean => {
        return target instanceof Element && Boolean(target.closest('[data-axhub-embed-ui="true"]'));
    }, []);

    const isTargetWithinActivePreviewFrame = useCallback((target: EventTarget | null): boolean => {
        const activePreview = activePreviewRef.current;
        if (!activePreview || !(target instanceof Element)) return false;
        const iframe = target.closest('iframe[data-axhub-embed-id]');
        return iframe instanceof HTMLIFrameElement && iframe.dataset.axhubEmbedId === activePreview.elementId;
    }, []);

    const syncActivePreviewRect = useCallback((elementId: string | null | undefined): ActiveEmbedPreview | null => {
        if (!elementId) return null;

        const currentInfo = infoRef.current;
        if (currentInfo?.elementId === elementId && currentInfo.viewMode === 'preview') {
            const preview = {
                elementId,
                screenX: currentInfo.screenX,
                screenY: currentInfo.screenY,
                screenWidth: currentInfo.screenWidth,
                screenHeight: currentInfo.screenHeight,
            };
            activePreviewRef.current = preview;
            return preview;
        }

        const container = containerRef.current;
        if (!container) return null;

        const iframe = container.querySelector<HTMLIFrameElement>(`iframe[data-axhub-embed-id="${elementId}"]`);
        if (!iframe) {
            return null;
        }

        const iframeRect = iframe.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (!iframeRect.width || !iframeRect.height || !containerRect.width || !containerRect.height) {
            return null;
        }

        const preview = {
            elementId,
            screenX: iframeRect.left,
            screenY: iframeRect.top,
            screenWidth: iframeRect.width,
            screenHeight: iframeRect.height,
        };
        activePreviewRef.current = preview;
        return preview;
    }, [containerRef]);

    const resolveSelectionActivationMode = useCallback((
        currentSelectedId: string | null,
        previousSelectedId: string | null,
        pointerIntent: EmbedPointerIntentSnapshot | null | undefined,
    ): EmbedSelectionActivationMode => resolveEmbedClickActivationMode({
        currentSelectedId,
        previousSelectedId,
        pointerIntent,
    }), []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (event.button !== 0) return;
            const activePreview = syncActivePreviewRect(
                activePreviewElementIdRef.current ?? activePreviewRef.current?.elementId ?? null,
            ) ?? activePreviewRef.current;
            if (activePreview) {
                const decision = resolveEmbedPreviewExitPointerDecision({
                    activePreview,
                    currentPrompt: exitPromptRef.current,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    now: Date.now(),
                    targetWithinEmbedUi: isTargetWithinEmbedUi(event.target),
                });

                if (decision.action === 'prompt' && decision.nextPrompt) {
                    if (decision.shouldPreventCanvasEvent) {
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                    }
                    showPreviewSessionHint(resolveEmbedPreviewSessionHint({
                        kind: 'exit-confirm',
                        elementId: decision.nextPrompt.elementId,
                        now: Date.now(),
                    }));
                    syncActivePreviewRect(activePreview.elementId);
                    return;
                }

                if (decision.action === 'exit') {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    dispatchExitPreview(activePreview.elementId);
                    return;
                }
            }

            pointerIntentRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                selectedEmbedIdAtPointerDown: prevSelectedEmbedIdRef.current,
                moved: false,
                released: false,
            };
        };
        const handlePointerMove = (event: PointerEvent) => {
            const pointerIntent = pointerIntentRef.current;
            if (!pointerIntent || pointerIntent.pointerId !== event.pointerId) return;

            if (
                Math.abs(event.clientX - pointerIntent.startX) > CLICK_ACTIVATION_MOVEMENT_THRESHOLD
                || Math.abs(event.clientY - pointerIntent.startY) > CLICK_ACTIVATION_MOVEMENT_THRESHOLD
            ) {
                pointerIntent.moved = true;
            }
        };
        const clearPointerIntent = (event: PointerEvent, cancelled = false) => {
            const pointerIntent = pointerIntentRef.current;
            if (pointerIntent && pointerIntent.pointerId === event.pointerId) {
                pointerIntent.released = true;
                if (cancelled) pointerIntent.moved = true;
                window.setTimeout(() => {
                    if (pointerIntentRef.current === pointerIntent) {
                        pointerIntentRef.current = null;
                    }
                }, 100);
            }
        };

        container.addEventListener('pointerdown', handlePointerDown, true);
        const handleWheel = (event: WheelEvent) => {
            const activePreview = syncActivePreviewRect(
                activePreviewElementIdRef.current ?? activePreviewRef.current?.elementId ?? null,
            ) ?? activePreviewRef.current;
            if (!shouldBlockCanvasWheelForActivePreview({
                activePreview,
                targetWithinActivePreviewFrame: isTargetWithinActivePreviewFrame(event.target),
            })) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        };
        container.addEventListener('wheel', handleWheel, { capture: true, passive: false });
        window.addEventListener('pointermove', handlePointerMove, true);
        const handlePointerUp = (event: PointerEvent) => clearPointerIntent(event);
        const handlePointerCancel = (event: PointerEvent) => clearPointerIntent(event, true);

        window.addEventListener('pointerup', handlePointerUp, true);
        window.addEventListener('pointercancel', handlePointerCancel, true);

        return () => {
            container.removeEventListener('pointerdown', handlePointerDown, true);
            container.removeEventListener('wheel', handleWheel, true);
            window.removeEventListener('pointermove', handlePointerMove, true);
            window.removeEventListener('pointerup', handlePointerUp, true);
            window.removeEventListener('pointercancel', handlePointerCancel, true);
            pointerIntentRef.current = null;
        };
    }, [
        containerRef,
        dispatchExitPreview,
        isTargetWithinActivePreviewFrame,
        isTargetWithinEmbedUi,
        showPreviewSessionHint,
        syncActivePreviewRect,
    ]);

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            const elementId = typeof detail?.elementId === 'string' ? detail.elementId : null;
            if (!elementId) return;

            if (detail.active) {
                activePreviewElementIdRef.current = elementId;
                clearExitPrompt();
                showPreviewSessionHint(resolveEmbedPreviewSessionHint({
                    kind: 'entered',
                    elementId,
                    now: Date.now(),
                }));
                if (activePreviewSyncRef.current) {
                    clearTimeout(activePreviewSyncRef.current);
                }
                activePreviewSyncRef.current = setTimeout(() => {
                    syncActivePreviewRect(elementId);
                    activePreviewSyncRef.current = null;
                }, 0);
                return;
            }

            if (activePreviewElementIdRef.current === elementId) {
                activePreviewElementIdRef.current = null;
                activePreviewRef.current = null;
            }
            if (
                exitPromptRef.current?.elementId === elementId
                || previewSessionHintRef.current?.elementId === elementId
            ) {
                clearExitPrompt();
            }
        };

        window.addEventListener(AXHUB_EMBED_ACTIVE_PREVIEW_CHANGED_EVENT, handler);
        return () => window.removeEventListener(AXHUB_EMBED_ACTIVE_PREVIEW_CHANGED_EVENT, handler);
    }, [clearExitPrompt, showPreviewSessionHint, syncActivePreviewRect]);

    useEffect(() => () => {
        if (previewSessionHintTimeoutRef.current) {
            clearTimeout(previewSessionHintTimeoutRef.current);
            previewSessionHintTimeoutRef.current = null;
        }
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
            tooltipTimeoutRef.current = null;
        }
        if (activePreviewSyncRef.current) {
            clearTimeout(activePreviewSyncRef.current);
            activePreviewSyncRef.current = null;
        }
    }, []);

    /* ── Track all embeddable elements + selected embeddable via RAF polling ── */
    useEffect(() => {
        if (!excalidrawAPI || !containerRef.current) return;

        const poll = () => {
            const scheduleNextPoll = () => {
                rafRef.current = requestAnimationFrame(poll);
            };

            const container = containerRef.current;
            if (!container) {
                scheduleNextPoll();
                return;
            }

            try {
                const appState = excalidrawAPI.getAppState();
                const selectedIds = appState?.selectedElementIds || {};
                const selectedIdSet = new Set(Object.keys(selectedIds));
                const elements = excalidrawAPI.getSceneElements();
                const zoom = appState.zoom?.value ?? 1;
                const containerRect = container.getBoundingClientRect();

                // Collect ALL embeddable labels
                const nextLabels: EmbedLabelInfo[] = [];
                let selectedEmbed: SelectedEmbedInfo | null = null;

                for (const el of elements) {
                    if (el.type !== 'embeddable' || el.isDeleted || !el.link) continue;

                    const kind = resolveEmbedKind(el);
                    const title = resolveEmbedTitle(el);
                    const viewMode = el.customData?.embedViewMode === 'preview' ? 'preview' : 'link';

                    const { x, y } = canvasToScreen(
                        el.x, el.y,
                        appState.scrollX || 0, appState.scrollY || 0,
                        zoom, containerRect.left, containerRect.top,
                    );

                    const isSelected = selectedIdSet.has(el.id);
                    const strokeColor = resolveEmbedStrokeColor(el.strokeColor);
                    const previousSize = lastEmbedSizeByIdRef.current.get(el.id);
                    if (
                        previousSize
                        && (previousSize.width !== el.width || previousSize.height !== el.height)
                    ) {
                        window.dispatchEvent(new CustomEvent('axhub:embedResized', {
                            detail: { elementId: el.id, width: el.width, height: el.height },
                        }));
                    }
                    lastEmbedSizeByIdRef.current.set(el.id, { width: el.width, height: el.height });

                    const screenW = el.width * zoom;
                    const screenH = el.height * zoom;

                    nextLabels.push({
                        elementId: el.id,
                        title,
                        kind,
                        viewMode,
                        screenX: x,
                        screenY: y,
                        screenWidth: screenW,
                        screenHeight: screenH,
                        isSelected,
                        strokeColor,
                    });

                    // Also track selected embed for action buttons
                    if (isSelected && selectedIdSet.size === 1) {
                        const previewUrl = resolveEmbedPreviewUrl(el);
                        const openUrl = resolveEmbedOpenUrl(el);
                        const previewable = isEmbedPreviewable(el);
                        selectedEmbed = {
                            elementId: el.id,
                            previewUrl,
                            openUrl,
                            link: previewUrl,
                            title,
                            kind,
                            screenX: x,
                            screenY: y,
                            screenWidth: screenW,
                            screenHeight: screenH,
                            canvasWidth: el.width,
                            canvasHeight: el.height,
                            strokeColor,
                            contentScale: normalizeEmbedContentScale(el.customData?.embedContentScale),
                            viewMode,
                            previewable,
                        };
                    }
                }

                for (const elementId of Array.from(lastEmbedSizeByIdRef.current.keys())) {
                    if (!elements.some((el: any) => el.id === elementId && el.type === 'embeddable' && !el.isDeleted)) {
                        lastEmbedSizeByIdRef.current.delete(elementId);
                    }
                }

                if (!labelsEqual(labelsRef.current, nextLabels)) {
                    labelsRef.current = nextLabels;
                    setLabels(nextLabels);
                }
                if (!selectedEmbedInfoEqual(infoRef.current, selectedEmbed)) {
                    infoRef.current = selectedEmbed;
                    setInfo(selectedEmbed);
                }
                const activePreviewElementId = activePreviewElementIdRef.current;
                const activePreviewLabel = activePreviewElementId
                    ? nextLabels.find((label) => label.elementId === activePreviewElementId && label.viewMode === 'preview')
                    : null;
                activePreviewRef.current = activePreviewLabel
                    ? {
                        elementId: activePreviewLabel.elementId,
                        screenX: activePreviewLabel.screenX,
                        screenY: activePreviewLabel.screenY,
                        screenWidth: activePreviewLabel.screenWidth,
                        screenHeight: activePreviewLabel.screenHeight,
                    }
                    : null;

                /* ── Dispatch selection-change events for embed lifecycle ── */
                const currentSelectedId = selectedEmbed?.elementId ?? null;
                const prevId = prevSelectedEmbedIdRef.current;
                const pointerIntent = pointerIntentRef.current;
                if (currentSelectedId !== prevId) {
                    // Deselected previous
                    if (prevId) {
                        dispatchEmbedSelectionChanged(prevId, false);
                    }
                    // Selected new
                    if (currentSelectedId) {
                        const activationMode = resolveSelectionActivationMode(currentSelectedId, prevId, pointerIntent);
                        dispatchEmbedSelectionChanged(currentSelectedId, true, activationMode);
                    }
                    prevSelectedEmbedIdRef.current = currentSelectedId;
                } else if (currentSelectedId) {
                    const activationMode = resolveSelectionActivationMode(currentSelectedId, prevId, pointerIntent);
                    if (activationMode === 'activate') {
                        dispatchEmbedSelectionChanged(currentSelectedId, true, activationMode);
                        pointerIntentRef.current = null;
                    }
                }
            } catch (error) {
                if (!warnedPollErrorRef.current) {
                    warnedPollErrorRef.current = true;
                    console.warn('[Axhub Canvas Embed] floating toolbar poll failed', error);
                }
            }

            scheduleNextPoll();
        };

        rafRef.current = requestAnimationFrame(poll);
        return () => {
            cancelAnimationFrame(rafRef.current);
            // Emit deselection on cleanup so embed can tear down iframe
            if (prevSelectedEmbedIdRef.current) {
                dispatchEmbedSelectionChanged(prevSelectedEmbedIdRef.current, false);
                prevSelectedEmbedIdRef.current = null;
            }
        };
    }, [excalidrawAPI, containerRef, dispatchEmbedSelectionChanged, resolveSelectionActivationMode]);

    /* ── Apply one-time size preset ───────────────────────────────── */
    const applySizePreset = useCallback((preset: EmbedSizePreset) => {
        if (!excalidrawAPI || !info) return;
        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        const viewportRect = containerRef.current?.getBoundingClientRect();
        const presetSize = preset === 'free' ? null : EMBED_SIZE_PRESETS[preset];
        const size = presetSize
            ? fitEmbedSizeToViewport({ width: presetSize.width, height: presetSize.height }, viewportRect, appState?.zoom?.value)
            : null;
        const updated = size
            ? applyEmbedSizePresetToElements(
                elements,
                info.elementId,
                preset,
                { size },
            )
            : applyEmbedSizePresetToElements(elements, info.elementId, preset);
        excalidrawAPI.updateScene({ elements: updated as any });

        // Notify embed component about the resize
        const nextWidth = size?.width ?? info.canvasWidth;
        const nextHeight = size?.height ?? info.canvasHeight;
        window.dispatchEvent(new CustomEvent('axhub:embedResized', {
            detail: { elementId: info.elementId, width: nextWidth, height: nextHeight, reason: 'size-preset' },
        }));
    }, [excalidrawAPI, info, containerRef]);

    /* ── Toggle orientation (swap width ↔ height) ──────────────── */
    const handleToggleOrientation = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!excalidrawAPI || !info) return;

        const newW = info.canvasHeight;
        const newH = info.canvasWidth;
        const appState = excalidrawAPI.getAppState();
        const viewportRect = containerRef.current?.getBoundingClientRect();
        const fittedSize = fitEmbedSizeToViewport({ width: newW, height: newH }, viewportRect, appState?.zoom?.value);
        const elements = excalidrawAPI.getSceneElements();
        const updated = elements.map((el: any) =>
            el.id === info.elementId
                ? { ...el, width: fittedSize.width, height: fittedSize.height }
                : el,
        );
        excalidrawAPI.updateScene({ elements: updated as any });

        // Notify embed component about the resize
        window.dispatchEvent(new CustomEvent('axhub:embedResized', {
            detail: { elementId: info.elementId, width: fittedSize.width, height: fittedSize.height, reason: 'orientation' },
        }));
    }, [excalidrawAPI, info, containerRef]);

    const handleSelectContentScale = useCallback((scale: EmbedContentScale) => {
        if (!excalidrawAPI || !info) return;
        const elements = excalidrawAPI.getSceneElements();
        const updated = updateEmbedContentScaleInElements(elements, info.elementId, scale);
        excalidrawAPI.updateScene({ elements: updated as any });
        window.dispatchEvent(new CustomEvent('axhub:embedResized', {
            detail: { elementId: info.elementId, width: info.canvasWidth, height: info.canvasHeight, reason: 'content-scale' },
        }));
    }, [excalidrawAPI, info]);

    const handleRefresh = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!info) return;

        logEmbedDebug(info.kind, 'refresh', {
            url: info.previewUrl,
            title: info.title,
            elementId: info.elementId,
        });

        if (info.kind === 'doc') {
            // Doc embeds render inline (no iframe) — dispatch refresh event
            window.dispatchEvent(new CustomEvent('axhub:embedRefresh', {
                detail: { elementId: info.elementId },
            }));
            return;
        }

        // Web/theme embeds — reload iframe
        const embeddableContainer = document.querySelector(
            `[data-id="${info.elementId}"] iframe, .excalidraw__embeddable-container iframe`,
        ) as HTMLIFrameElement | null;
        if (embeddableContainer) {
            try { embeddableContainer.contentWindow?.location.reload(); }
            catch { embeddableContainer.src = info.previewUrl; }
        }
    }, [info]);

    const handleOpenInEditor = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!info) return;

        logEmbedDebug(info.kind, 'openInEditor', {
            url: info.previewUrl,
            title: info.title,
            elementId: info.elementId,
        });

        const detail = {
            elementId: info.elementId,
            link: info.previewUrl,
            openUrl: info.openUrl,
            title: info.title,
            kind: info.kind,
        };

        window.dispatchEvent(new CustomEvent('axhub:embedOpenInEditor', { detail }));
    }, [info]);

    const handleSwitchViewMode = useCallback((targetMode: 'link' | 'preview') => {
        if (!excalidrawAPI || !info) return;
        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        const viewportRect = containerRef.current?.getBoundingClientRect();
        const updated = elements.map((el: any) => {
            if (el.id !== info.elementId) return el;
            const currentMode = el.customData?.embedViewMode === 'preview' ? 'preview' : 'link';
            if (currentMode === targetMode) return el;
            return resolveEmbedViewModeToggleUpdate(el, currentMode === 'link', viewportRect, appState?.zoom?.value);
        });
        excalidrawAPI.updateScene({ elements: updated as any });
        setSizePopoverOpen(false);
        if (targetMode === 'preview') {
            dispatchEmbedSelectionChanged(info.elementId, true, 'activate');
        }
    }, [excalidrawAPI, info, containerRef, dispatchEmbedSelectionChanged]);

    /* ── Close size popover when selection changes ──────────────── */
    useEffect(() => {
        setSizePopoverOpen(false);
    }, [info?.elementId]);

    /* ── Close size popover on outside click ────────────────────── */
    useEffect(() => {
        if (!sizePopoverOpen) return;
        const handleOutsideClick = (e: MouseEvent) => {
            if (sizePopoverRef.current && !sizePopoverRef.current.contains(e.target as Node)) {
                setSizePopoverOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick, true);
        return () => document.removeEventListener('mousedown', handleOutsideClick, true);
    }, [sizePopoverOpen]);

    /* ── Render ──────────────────────────────────────────────────── */
    const containerRect = containerRef.current?.getBoundingClientRect();

    return (
        <>
            {/* ── Node title labels (always visible for all embeddables) ── */}
            {containerRect && labels.filter((label) => label.viewMode !== 'link').map((label) => {
                const left = label.screenX - containerRect.left;
                const top = label.screenY - containerRect.top - LABEL_H - CANVAS_NODE_TITLE_LABEL_OFFSET;

                return (
                    <CanvasNodeTitleLabel
                        key={`label-${label.elementId}`}
                        left={left}
                        top={top}
                        title={label.title}
                        strokeColor={label.strokeColor}
                        opacity={label.isSelected ? 1 : 0.55}
                        maxWidth={getLabelMaxWidth(label)}
                    />
                );
            })}

            {/* ── Action buttons at node top-right (only when selected) ── */}
            {info && containerRect && (() => {
                const left = info.screenX - containerRect.left + info.screenWidth;
                const top = info.screenY - containerRect.top - LABEL_H - 4;

                return (
                    <div
                        style={{
                            position: 'absolute',
                            left,
                            top: Math.max(0, top),
                            height: LABEL_H,
                            display: 'flex',
                            alignItems: 'center',
                            gap: ACTION_GAP,
                            zIndex: ACTION_Z_INDEX,
                            pointerEvents: 'auto',
                            transform: 'translateX(-100%)',
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        data-axhub-embed-ui="true"
                    >
                        {/* Link mode: expose only preview toggle */}
                        {info.viewMode === 'link' && info.previewable && (
                            <button
                                type="button"
                                aria-label="切换到预览模式"
                                style={{
                                    ...createActionBtnStyle(hoveredBtn === 'preview', info.strokeColor),
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleSwitchViewMode('preview');
                                }}
                                onMouseEnter={(e) => {
                                    setHoveredBtn('preview');
                                    scheduleTooltip('preview', '切换到预览模式', e.currentTarget);
                                }}
                                onMouseLeave={() => {
                                    setHoveredBtn(null);
                                    clearTooltip();
                                }}
                                onFocus={(e) => scheduleTooltip('preview', '切换到预览模式', e.currentTarget)}
                                onBlur={clearTooltip}
                            >
                                <Eye style={ACTION_ICON} />
                            </button>
                        )}

                        {/* Preview mode: open in editor */}
                        {info.viewMode === 'preview' && (
                            <button
                                type="button"
                                aria-label="在编辑器中打开"
                                style={{
                                    ...createActionBtnStyle(hoveredBtn === 'openInEditor', info.strokeColor),
                                }}
                                onClick={handleOpenInEditor}
                                onMouseEnter={(e) => {
                                    setHoveredBtn('openInEditor');
                                    scheduleTooltip('openInEditor', '在编辑器中打开', e.currentTarget);
                                }}
                                onMouseLeave={() => {
                                    setHoveredBtn(null);
                                    clearTooltip();
                                }}
                                onFocus={(e) => scheduleTooltip('openInEditor', '在编辑器中打开', e.currentTarget)}
                                onBlur={clearTooltip}
                            >
                                <Code2 style={ACTION_ICON} />
                            </button>
                        )}

                                {/* Preview mode: size / content scale controls (web & theme only) */}
                        {info.viewMode === 'preview' && (info.kind === 'web' || info.kind === 'theme') && (
                            <div style={{ position: 'relative' }}>
                                <button
                                    type="button"
                                    aria-label="调整尺寸和内容缩放"
                                    style={{
                                        ...createActionBtnStyle(hoveredBtn === 'size' || sizePopoverOpen, info.strokeColor),
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setSizePopoverOpen((prev) => !prev);
                                        clearTooltip();
                                    }}
                                    onMouseEnter={(e) => {
                                        setHoveredBtn('size');
                                        scheduleTooltip(
                                            'size',
                                            `${Math.round(info.canvasWidth)}x${Math.round(info.canvasHeight)} · 内容 ${formatContentScaleLabel(info.contentScale)}`,
                                            e.currentTarget,
                                        );
                                    }}
                                    onMouseLeave={() => {
                                        setHoveredBtn(null);
                                        clearTooltip();
                                    }}
                                    onFocus={(e) => scheduleTooltip('size', '调整尺寸和内容缩放', e.currentTarget)}
                                    onBlur={clearTooltip}
                                >
                                    <Maximize2 style={ACTION_ICON} />
                                </button>

                                {/* Size popover */}
                                {sizePopoverOpen && (
                                    <div
                                        ref={sizePopoverRef}
                                        style={{
                                            ...pillContainerStyle,
                                            position: 'absolute',
                                            top: '100%',
                                            right: 0,
                                            marginTop: 6,
                                            zIndex: POPOVER_Z_INDEX,
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        data-axhub-embed-ui="true"
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{
                                                color: '#64748b',
                                                fontSize: 12,
                                                fontWeight: 600,
                                                marginRight: 2,
                                            }}>
                                                尺寸
                                            </span>
                                            <span style={{
                                                height: 28,
                                                minWidth: 82,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '0 8px',
                                                borderRadius: 6,
                                                background: '#f8fafc',
                                                color: '#475569',
                                                fontSize: 11,
                                                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
                                                letterSpacing: 0,
                                            }}>
                                                {Math.round(info.canvasWidth)}x{Math.round(info.canvasHeight)}
                                            </span>
                                            {EMBED_SIZE_PRESET_OPTIONS.map((preset) => {
                                                let icon: React.ReactNode;
                                                const size = EMBED_SIZE_PRESETS[preset];
                                                const label = `${size.label}尺寸 ${size.width}x${size.height}`;
                                                if (preset === 'mobile') {
                                                    icon = <Smartphone style={PILL_ICON} />;
                                                } else if (preset === 'tablet') {
                                                    icon = <Tablet style={PILL_ICON} />;
                                                } else {
                                                    icon = <Monitor style={PILL_ICON} />;
                                                }

                                                return (
                                                    <button
                                                        key={preset}
                                                        type="button"
                                                        aria-label={label}
                                                        style={pillBtnStyle(false, info.strokeColor)}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            applySizePreset(preset);
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            setHoveredBtn(`size-${preset}`);
                                                            scheduleTooltip(`size-${preset}`, label, e.currentTarget);
                                                        }}
                                                        onMouseLeave={() => {
                                                            setHoveredBtn(null);
                                                            clearTooltip();
                                                        }}
                                                        onFocus={(e) => scheduleTooltip(`size-${preset}`, label, e.currentTarget)}
                                                        onBlur={clearTooltip}
                                                    >
                                                        {icon}
                                                    </button>
                                                );
                                            })}

                                            {/* Rotate button */}
                                            <button
                                                type="button"
                                                aria-label="旋转（交换宽高）"
                                                style={pillBtnStyle(false, info.strokeColor)}
                                                onClick={handleToggleOrientation}
                                                onMouseEnter={(e) => {
                                                    setHoveredBtn('rotate');
                                                    scheduleTooltip('rotate', '旋转（交换宽高）', e.currentTarget);
                                                }}
                                                onMouseLeave={() => {
                                                    setHoveredBtn(null);
                                                    clearTooltip();
                                                }}
                                                onFocus={(e) => scheduleTooltip('rotate', '旋转（交换宽高）', e.currentTarget)}
                                                onBlur={clearTooltip}
                                            >
                                                <RotateCcw style={PILL_ICON} />
                                            </button>

                                            {/* Switch back to link mode */}
                                            <button
                                                type="button"
                                                aria-label="切换为链接模式"
                                                style={pillBtnStyle(false, info.strokeColor)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    handleSwitchViewMode('link');
                                                }}
                                                onMouseEnter={(e) => {
                                                    setHoveredBtn('switch-link');
                                                    scheduleTooltip('switch-link', '切换为链接模式', e.currentTarget);
                                                }}
                                                onMouseLeave={() => {
                                                    setHoveredBtn(null);
                                                    clearTooltip();
                                                }}
                                                onFocus={(e) => scheduleTooltip('switch-link', '切换为链接模式', e.currentTarget)}
                                                onBlur={clearTooltip}
                                            >
                                                <Link2 style={PILL_ICON} />
                                            </button>

                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            paddingTop: 6,
                                            borderTop: '1px solid #e2e8f0',
                                        }}>
                                            <span style={{
                                                color: '#64748b',
                                                fontSize: 12,
                                                fontWeight: 600,
                                                marginRight: 2,
                                            }}>
                                                缩放
                                            </span>
                                            {EMBED_CONTENT_SCALE_OPTIONS.map((scale) => (
                                                <button
                                                    key={scale}
                                                    type="button"
                                                    style={scaleBtnStyle(info.contentScale === scale, info.strokeColor)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        handleSelectContentScale(scale);
                                                    }}
                                                >
                                                    {formatContentScaleLabel(scale)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Preview mode: refresh */}
                        {info.viewMode === 'preview' && (
                            <button
                                type="button"
                                aria-label="刷新"
                                style={{
                                    ...createActionBtnStyle(hoveredBtn === 'refresh', info.strokeColor),
                                }}
                                onClick={handleRefresh}
                                onMouseEnter={(e) => {
                                    setHoveredBtn('refresh');
                                    scheduleTooltip('refresh', '刷新', e.currentTarget);
                                }}
                                onMouseLeave={() => {
                                    setHoveredBtn(null);
                                    clearTooltip();
                                }}
                                onFocus={(e) => scheduleTooltip('refresh', '刷新', e.currentTarget)}
                                onBlur={clearTooltip}
                            >
                                <RefreshCw style={ACTION_ICON} />
                            </button>
                        )}
                    </div>
                );
            })()}

            {tooltip && containerRect ? (
                <div
                    key={tooltip.key}
                    style={{
                        position: 'absolute',
                        left: tooltip.anchorLeft,
                        top: Math.max(0, tooltip.anchorTop - TOOLTIP_OFFSET),
                        transform: 'translate(-50%, -100%)',
                        zIndex: POPOVER_Z_INDEX,
                        padding: '6px 9px',
                        borderRadius: 6,
                        background: 'rgba(15, 23, 42, 0.94)',
                        color: '#f8fafc',
                        fontSize: 12,
                        lineHeight: 1.35,
                        fontWeight: 500,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.22)',
                    }}
                    data-axhub-embed-ui="true"
                >
                    {tooltip.text}
                </div>
            ) : null}

            {previewSessionHint ? (
                <div
                    style={{
                        position: 'fixed',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        minHeight: 36,
                        maxWidth: 'min(360px, calc(100vw - 32px))',
                        zIndex: POPOVER_Z_INDEX,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 14px',
                        borderRadius: 6,
                        background: 'rgba(15, 23, 42, 0.92)',
                        color: '#f8fafc',
                        fontSize: 14,
                        fontWeight: 600,
                        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.22)',
                        pointerEvents: 'none',
                        userSelect: 'none',
                    }}
                    data-axhub-embed-ui="true"
                >
                    {previewSessionHint.message}
                </div>
            ) : null}
        </>
    );
}
