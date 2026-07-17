import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { CaptureUpdateAction } from '@axhub/excalidraw';
import { CircleStop, Loader2, Play, Sparkles, Trash2, X } from 'lucide-react';

import { createMergedTextSceneUpdate } from './canvasTextMerge';
import { resolveContextMenuViewportFit } from './contextMenuViewport';
import { getLinkEmbedSize } from './linkEmbedSizing';
import { fitEmbedSizeToViewport, type EmbedViewportRect } from './embedViewportSizing';
import { reorganizeContextMenu } from './contextMenuReorganizer';
import { CANVAS_ELEMENT_OVERLAY_Z_INDEX } from './canvasOverlayLayers';
import { resolveCanvasImageContextMenuState } from './canvasImageContextMenu';
import {
    getCanvasDirectRunAnnotationTaskRef,
    type CanvasDirectRunAnnotationTaskRef,
} from '../../../domains/ai-generation/CanvasDirectRunOverlay';

/* ── Types ───────────────────────────────────────────────────────── */

/** Info about a canvas element for bridge context injection. */
export interface CanvasElementContextInfo {
    elementId: string;
    type: string;
    annotation?: string;
    title?: string;
    link?: string;
    width: number;
    height: number;
    resourceType?: 'preview' | 'prototype' | 'doc' | 'theme';
    resourceId?: string;
    filePath?: string;
    absoluteFilePath?: string;
    path?: string;
    displayName?: string;
    mimeType?: string;
}

interface AnnotationOverlayProps {
    excalidrawAPI: any;
    /** Ref to the container div wrapping <Excalidraw> */
    containerRef: React.RefObject<HTMLDivElement>;
    /** Whether the OpenCode bridge is connected (AI panel open). */
    bridgeConnected?: boolean;
    /** Callback when user adds selected elements as a screenshot attachment to AI. */
    onAddScreenshotToAI?: (elements: CanvasElementContextInfo[]) => void | Promise<void>;
    /** Callback when user adds selected elements as node context to AI. */
    onAddNodesToAI?: (elements: CanvasElementContextInfo[]) => void;
    /** Callback when user adds the selected original image file to AI. */
    onAddImageToAI?: (elements: CanvasElementContextInfo[], promptText?: string) => void | Promise<void>;
    /** Callback when user copies the selected original image file to the system clipboard. */
    onCopyImageToClipboard?: (elements: CanvasElementContextInfo[]) => void | Promise<void>;
    /** Callback when user runs local transparent-background processing on a selected image. */
    onMakeImageBackgroundTransparent?: (elements: CanvasElementContextInfo[]) => void | Promise<void>;
    /** Callback when the set of annotated elements changes. */
    onAnnotationsChange?: (annotations: CanvasElementContextInfo[]) => void;
    /** Callback when the annotation prompt card should execute its prompt through canvas AI. */
    onExecuteAnnotationPrompt?: (element: CanvasElementContextInfo, promptText: string) => Promise<string | { statusTaskId?: string | null } | boolean | void> | string | { statusTaskId?: string | null } | boolean | void;
    onStopAnnotationTask?: (statusTaskId: string) => void;
}

function getResourceTypeFromElement(element: any): 'prototype' | 'doc' | 'theme' {
    const sourceResourceType = element?.customData?.sourceResourceType;
    if (sourceResourceType === 'doc') return 'doc';
    if (sourceResourceType === 'theme') return 'theme';
    if (sourceResourceType === 'prototype') return 'prototype';
    const resourceType = element?.customData?.resourceType;
    if (resourceType === 'doc' || element?.customData?.type === 'axhub-doc') return 'doc';
    if (resourceType === 'theme' || element?.customData?.type === 'axhub-theme') return 'theme';
    return 'prototype';
}

function resolveString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function resolveElementResourceType(element: any): 'prototype' | 'doc' | 'theme' | undefined {
    const sourceResourceType = element?.customData?.sourceResourceType;
    if (sourceResourceType === 'prototype' || sourceResourceType === 'doc' || sourceResourceType === 'theme') {
        return sourceResourceType;
    }
    const resourceType = element?.customData?.resourceType;
    if (resourceType === 'prototype' || resourceType === 'doc' || resourceType === 'theme') {
        return resourceType;
    }
    if (element?.customData?.type === 'axhub-doc') return 'doc';
    if (element?.customData?.type === 'axhub-theme') return 'theme';
    return undefined;
}

function buildCanvasElementContextInfo(element: any): CanvasElementContextInfo {
    const annotationTaskRef = getCanvasDirectRunAnnotationTaskRef(element);
    return {
        elementId: element.id,
        type: element.type || 'unknown',
        annotation: resolveString(element?.customData?.annotation) || undefined,
        title: resolveString(element?.customData?.title),
        link: annotationTaskRef ? undefined : resolveString(element?.link),
        width: element.width || 0,
        height: element.height || 0,
        resourceType: resolveElementResourceType(element),
        resourceId: resolveString(element?.customData?.resourceId),
        filePath: resolveString(element?.customData?.filePath),
        absoluteFilePath: resolveString(element?.customData?.absoluteFilePath),
        path: resolveString(element?.customData?.path),
        displayName: resolveString(element?.customData?.displayName) || resolveString(element?.customData?.title),
        mimeType: resolveString(element?.customData?.mimeType),
    };
}

function getDefaultPreviewSize(element: any): { width: number; height: number } {
    const resourceType = getResourceTypeFromElement(element);
    if (resourceType === 'doc') return { width: 720, height: 480 };
    if (resourceType === 'theme') return { width: 800, height: 600 };
    return { width: 1280, height: 800 };
}

function normalizeStoredPreviewSize(value: any): { width: number; height: number } | null {
    const width = Number(value?.width);
    const height = Number(value?.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null;
    }
    return { width, height };
}

export function resolveEmbedViewModeToggleUpdate(
    element: any,
    isLinkMode: boolean,
    viewportRect?: EmbedViewportRect | null,
    zoom = 1,
) {
    const nextMode = isLinkMode ? 'preview' : 'link';
    const title = String(element?.customData?.title || element?.customData?.displayName || element?.customData?.name || '未命名');
    const previousPreviewSize = {
        width: Number(element?.width) || getDefaultPreviewSize(element).width,
        height: Number(element?.height) || getDefaultPreviewSize(element).height,
    };
    const storedPreviewSize = normalizeStoredPreviewSize(element?.customData?.storedPreviewSize)
        || getDefaultPreviewSize(element);
    const nextSize = nextMode === 'link'
        ? getLinkEmbedSize(title)
        : fitEmbedSizeToViewport(storedPreviewSize, viewportRect, zoom);
    const previewStrokeColor = typeof element?.customData?.previewStrokeColor === 'string'
        ? element.customData.previewStrokeColor
        : getResourceTypeFromElement(element) === 'theme' ? '#8b5cf6' : '#008F5D';

    return {
        ...element,
        width: nextSize.width,
        height: nextSize.height,
        strokeWidth: nextMode === 'link' ? 0 : 2,
        strokeColor: nextMode === 'link' ? 'transparent' : previewStrokeColor,
        customData: {
            ...element.customData,
            embedViewMode: nextMode,
            previousPreviewSize,
            storedPreviewSize: nextMode === 'link' ? previousPreviewSize : storedPreviewSize,
            previewStrokeColor,
        },
        version: (element.version || 0) + 1,
        versionNonce: Math.floor(Math.random() * 2147483647),
        updated: Date.now(),
    };
}

/** Info about an annotated element for badge rendering */
interface AnnotatedBadgeInfo {
    elementId: string;
    annotation: string;
    annotationTaskRef?: CanvasDirectRunAnnotationTaskRef | null;
    /** Screen-space X of the element's top-right corner */
    screenRight: number;
    /** Screen-space Y of the element's top-left corner */
    screenTop: number;
}

/** Info about the currently selected element for the annotation action */
interface SelectedElementAnnotationInfo {
    elementId: string;
    annotation: string;
    annotationTaskRef?: CanvasDirectRunAnnotationTaskRef | null;
    /** Screen-space coords for toolbar placement */
    screenX: number;
    screenY: number;
    screenWidth: number;
}

/* ── Styles ──────────────────────────────────────────────────────── */

const BADGE_SIZE = 22;
const BADGE_OFFSET_X = -4;
const BADGE_OFFSET_Y = -8;
const TASK_BADGE_OFFSET_X = 12;
const TASK_BADGE_OFFSET_Y = -14;
const TASK_POPOVER_OFFSET_X = 36;
const TASK_POPOVER_OFFSET_Y = 10;
const ANNOTATION_TEXTAREA_MAX_HEIGHT = 260;

const badgeStyle: React.CSSProperties = {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: 8,
    background: 'transparent',
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    zIndex: CANVAS_ELEMENT_OVERLAY_Z_INDEX,
    pointerEvents: 'auto',
    transition: 'transform 0.12s ease',
    userSelect: 'none' as const,
};

const badgeIconStyle = { width: 13, height: 13 };
const actionIconStyle = { width: 16, height: 16 };
const spinnerIconStyle: React.CSSProperties = {
    width: 13,
    height: 13,
    animation: 'axhubAnnotationSpin 0.8s linear infinite',
};

const actionTooltipStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '4px 8px',
    borderRadius: 6,
    background: 'rgba(15, 23, 42, 0.92)',
    color: '#f8fafc',
    fontSize: 11,
    lineHeight: '1.35',
    whiteSpace: 'nowrap' as const,
    pointerEvents: 'none',
    zIndex: CANVAS_ELEMENT_OVERLAY_Z_INDEX + 1,
    boxShadow: '0 4px 12px rgba(15,23,42,0.18)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const popoverStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: CANVAS_ELEMENT_OVERLAY_Z_INDEX,
    width: 360,
    maxWidth: 'calc(100vw - 24px)',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 14,
    boxShadow: '0 14px 36px rgba(15,23,42,0.12)',
    padding: 10,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
};

const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 58,
    maxHeight: ANNOTATION_TEXTAREA_MAX_HEIGHT,
    resize: 'none' as const,
    overflowY: 'auto' as const,
    scrollbarWidth: 'none',
    border: '1px solid #d1d5db',
    borderRadius: 14,
    padding: '12px 14px',
    fontSize: 15,
    lineHeight: '1.5',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
    color: '#1e293b',
};

const executeButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 28,
    minWidth: 28,
    padding: 0,
    borderRadius: 999,
    border: 'none',
    background: 'transparent',
    color: '#475569',
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1,
    cursor: 'pointer',
    fontFamily: 'inherit',
};

const iconButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 999,
    background: 'transparent',
    color: '#475569',
    cursor: 'pointer',
    padding: 0,
};

const disabledIconButtonStyle: React.CSSProperties = {
    ...iconButtonStyle,
    color: '#cbd5e1',
    cursor: 'not-allowed',
};

const PENDING_ANNOTATION_TASK_ID = '__pending_annotation_task__';

const CONTEXT_MENU_VIEWPORT_INSET = 8;

function resizeAnnotationTextareaToContent(textarea: HTMLTextAreaElement | null) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, ANNOTATION_TEXTAREA_MAX_HEIGHT)}px`;
    textarea.style.overflowY = textarea.scrollHeight > ANNOTATION_TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
}

function AnnotationTooltipButton({
    tooltip,
    children,
    disabled,
    onClick,
    style,
}: {
    tooltip: string;
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    style: React.CSSProperties;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <span
            style={{ position: 'relative', display: 'inline-flex' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <button
                type="button"
                aria-label={tooltip}
                onClick={onClick}
                disabled={disabled}
                style={style}
            >
                {children}
            </button>
            {hovered ? (
                <span role="tooltip" style={actionTooltipStyle}>
                    {tooltip}
                </span>
            ) : null}
        </span>
    );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

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

/* ── Component ───────────────────────────────────────────────────── */

export default function AnnotationOverlay({
    excalidrawAPI,
    containerRef,
    bridgeConnected = false,
    onAddScreenshotToAI,
    onAddNodesToAI,
    onAddImageToAI,
    onCopyImageToClipboard,
    onMakeImageBackgroundTransparent,
    onAnnotationsChange,
    onExecuteAnnotationPrompt,
    onStopAnnotationTask,
}: AnnotationOverlayProps) {
    const [badges, setBadges] = useState<AnnotatedBadgeInfo[]>([]);
    const [selectedInfo, setSelectedInfo] = useState<SelectedElementAnnotationInfo | null>(null);
    const [popoverElementId, setPopoverElementId] = useState<string | null>(null);
    const [popoverText, setPopoverText] = useState('');
    const [popoverTaskRef, setPopoverTaskRef] = useState<CanvasDirectRunAnnotationTaskRef | null>(null);
    const [popoverExecutionTaskId, setPopoverExecutionTaskId] = useState<string | null>(null);
    const [popoverPosition, setPopoverPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
    const rafRef = useRef<number>(0);
    const popoverRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const popoverExecutionTaskIdRef = useRef<string | null>(null);
    const popoverExecutionTaskSnapshotRef = useRef('');

    const prevAnnotationsHashRef = useRef('');

    useEffect(() => {
        popoverExecutionTaskIdRef.current = popoverExecutionTaskId;
    }, [popoverExecutionTaskId]);

    useLayoutEffect(() => {
        if (!popoverElementId) return;
        resizeAnnotationTextareaToContent(textareaRef.current);
    }, [popoverElementId, popoverText]);

    /* ── RAF polling: detect annotated elements + selected element ── */
    useEffect(() => {
        if (!excalidrawAPI || !containerRef.current) return;

        const poll = () => {
            const appState = excalidrawAPI.getAppState();
            const selectedIds = appState?.selectedElementIds || {};
            const selectedIdSet = new Set(Object.keys(selectedIds));
            const elements = excalidrawAPI.getSceneElements();
            const zoom = appState.zoom?.value ?? 1;
            const containerRect = containerRef.current!.getBoundingClientRect();

            const nextBadges: AnnotatedBadgeInfo[] = [];
            let nextSelected: SelectedElementAnnotationInfo | null = null;
            const annotatedElements: CanvasElementContextInfo[] = [];
            let executionTaskRef: CanvasDirectRunAnnotationTaskRef | null = null;
            const trackedExecutionTaskId = popoverExecutionTaskIdRef.current;

            for (const el of elements) {
                if (el.isDeleted) continue;

                const annotation = el.customData?.annotation;
                const annotationText = typeof annotation === 'string' ? annotation.trim() : '';
                const annotationTaskRef = getCanvasDirectRunAnnotationTaskRef(el);
                if (
                    trackedExecutionTaskId
                    && trackedExecutionTaskId !== PENDING_ANNOTATION_TASK_ID
                    && annotationTaskRef?.statusTaskId === trackedExecutionTaskId
                ) {
                    executionTaskRef = annotationTaskRef;
                }
                const isSelected = selectedIdSet.has(el.id);

                // Compute screen coords
                const topLeft = canvasToScreen(
                    el.x, el.y,
                    appState.scrollX || 0, appState.scrollY || 0,
                    zoom, containerRect.left, containerRect.top,
                );
                const screenW = (el.width || 0) * zoom;

                if (annotationText) {
                    nextBadges.push({
                        elementId: el.id,
                        annotation: annotationText,
                        annotationTaskRef,
                        screenRight: topLeft.x + screenW,
                        screenTop: topLeft.y,
                    });
                    annotatedElements.push(buildCanvasElementContextInfo(el));
                }

                // Track selected element (single selection only)
                if (isSelected && selectedIdSet.size === 1) {
                    nextSelected = {
                        elementId: el.id,
                        annotation: annotation || '',
                        annotationTaskRef,
                        screenX: topLeft.x,
                        screenY: topLeft.y,
                        screenWidth: screenW,
                    };
                }
            }

            setBadges(nextBadges);
            setSelectedInfo(nextSelected);

            if (trackedExecutionTaskId && trackedExecutionTaskId !== PENDING_ANNOTATION_TASK_ID) {
                const nextSnapshot = executionTaskRef
                    ? [
                        executionTaskRef.statusTaskId,
                        executionTaskRef.status,
                        executionTaskRef.updatedAt,
                        executionTaskRef.runId,
                        executionTaskRef.threadId,
                        executionTaskRef.conversationId,
                    ].join(':')
                    : '';
                if (nextSnapshot !== popoverExecutionTaskSnapshotRef.current) {
                    popoverExecutionTaskSnapshotRef.current = nextSnapshot;
                    if (executionTaskRef) {
                        setPopoverTaskRef(executionTaskRef);
                    } else {
                        setPopoverExecutionTaskId(null);
                        setPopoverTaskRef((current) => (
                            current?.statusTaskId === trackedExecutionTaskId ? null : current
                        ));
                    }
                }
            }

            // Notify parent about annotation changes (debounced via hash)
            if (onAnnotationsChange) {
                const hash = annotatedElements.map(a => `${a.elementId}:${a.annotation}`).join('|');
                if (hash !== prevAnnotationsHashRef.current) {
                    prevAnnotationsHashRef.current = hash;
                    onAnnotationsChange(annotatedElements);
                }
            }

            rafRef.current = requestAnimationFrame(poll);
        };

        rafRef.current = requestAnimationFrame(poll);
        return () => cancelAnimationFrame(rafRef.current);
    }, [excalidrawAPI, containerRef, onAnnotationsChange]);

    /* ── Update annotation in customData ─────────────────────────── */
    const setAnnotation = useCallback((elementId: string, text: string) => {
        if (!excalidrawAPI) return;
        const elements = excalidrawAPI.getSceneElements();
        const updated = elements.map((el: any) => {
            if (el.id !== elementId) return el;
            if (getCanvasDirectRunAnnotationTaskRef(el)) return el;
            const newCustomData = { ...el.customData };
            if (text.trim()) {
                newCustomData.annotation = text.trim();
                newCustomData.annotationUpdatedAt = new Date().toISOString();
            } else {
                delete newCustomData.annotation;
                delete newCustomData.annotationUpdatedAt;
            }
            return {
                ...el,
                customData: newCustomData,
                version: (el.version || 0) + 1,
                versionNonce: Math.floor(Math.random() * 2147483647),
                updated: Date.now(),
            };
        });
        excalidrawAPI.updateScene({ elements: updated as any });
    }, [excalidrawAPI]);

    const getElementInfoWithAnnotation = useCallback((elementId: string, annotationText: string) => {
        if (!excalidrawAPI) return null;
        const element = excalidrawAPI.getSceneElements()
            .find((el: any) => el.id === elementId && !el.isDeleted);
        if (!element || getCanvasDirectRunAnnotationTaskRef(element)) return null;
        return buildCanvasElementContextInfo({
            ...element,
            customData: {
                ...element.customData,
                annotation: annotationText.trim(),
            },
        });
    }, [excalidrawAPI]);

    const resolveExecutionTaskId = useCallback((result: string | { statusTaskId?: string | null } | boolean | void) => {
        if (typeof result === 'string') return result.trim();
        if (result && typeof result === 'object' && !Array.isArray(result)) {
            return typeof result.statusTaskId === 'string' ? result.statusTaskId.trim() : '';
        }
        return '';
    }, []);

    /* ── Open annotation popover ─────────────────────────────────── */
    const openPopover = useCallback((
        elementId: string,
        annotation: string,
        screenX: number,
        screenY: number,
        annotationTaskRef: CanvasDirectRunAnnotationTaskRef | null = null,
    ) => {
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        setPopoverElementId(elementId);
        setPopoverText(annotation);
        setPopoverTaskRef(annotationTaskRef);
        setPopoverExecutionTaskId(annotationTaskRef?.statusTaskId || null);
        popoverExecutionTaskSnapshotRef.current = '';
        const popoverOffsetX = annotationTaskRef ? TASK_POPOVER_OFFSET_X : 0;
        const popoverOffsetY = annotationTaskRef ? TASK_POPOVER_OFFSET_Y : 4;
        setPopoverPosition({
            left: screenX - containerRect.left + popoverOffsetX,
            top: screenY - containerRect.top + popoverOffsetY,
        });

        // Focus textarea after render – double RAF ensures React has committed the DOM
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!annotationTaskRef) textareaRef.current?.focus();
            });
        });
    }, [containerRef]);

    /* ── Save and close popover ───────────────────────────────────── */
    const saveAndClosePopover = useCallback(() => {
        if (popoverElementId && !popoverTaskRef) {
            setAnnotation(popoverElementId, popoverText);
        }
        setPopoverElementId(null);
        setPopoverText('');
        setPopoverTaskRef(null);
        setPopoverExecutionTaskId(null);
        popoverExecutionTaskSnapshotRef.current = '';
    }, [popoverElementId, popoverTaskRef, popoverText, setAnnotation]);

    const deleteAnnotationAndClose = useCallback(() => {
        if (popoverElementId && !popoverTaskRef) {
            setAnnotation(popoverElementId, '');
        }
        setPopoverElementId(null);
        setPopoverText('');
        setPopoverTaskRef(null);
        setPopoverExecutionTaskId(null);
        popoverExecutionTaskSnapshotRef.current = '';
    }, [popoverElementId, popoverTaskRef, setAnnotation]);

    const handleExecuteAnnotationPrompt = useCallback(async () => {
        if (!popoverElementId || popoverTaskRef || !onExecuteAnnotationPrompt) return;
        const trimmedPrompt = popoverText.trim();
        if (!trimmedPrompt) return;
        setAnnotation(popoverElementId, trimmedPrompt);
        const info = getElementInfoWithAnnotation(popoverElementId, trimmedPrompt);
        if (!info) return;
        setPopoverExecutionTaskId(PENDING_ANNOTATION_TASK_ID);
        popoverExecutionTaskSnapshotRef.current = '';
        try {
            const executionResult = await onExecuteAnnotationPrompt(info, trimmedPrompt);
            const statusTaskId = resolveExecutionTaskId(executionResult);
            setPopoverExecutionTaskId(statusTaskId || null);
            if (!statusTaskId) {
                setPopoverTaskRef(null);
            }
        } catch {
            setPopoverExecutionTaskId(null);
            setPopoverTaskRef(null);
        }
    }, [
        getElementInfoWithAnnotation,
        onExecuteAnnotationPrompt,
        popoverElementId,
        popoverTaskRef,
        popoverText,
        resolveExecutionTaskId,
        setAnnotation,
    ]);

    /* ── Handle badge click → open popover ────────────────────────── */
    const handleBadgeClick = useCallback((e: React.MouseEvent, badge: AnnotatedBadgeInfo) => {
        e.stopPropagation();
        e.preventDefault();
        openPopover(badge.elementId, badge.annotation, badge.screenRight, badge.screenTop, badge.annotationTaskRef || null);
    }, [openPopover]);


    /* ── Inject annotation items into Excalidraw's native context menu ── */
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !excalidrawAPI) return;

        const fitContextMenuInViewport = (ctxMenuEl: Element) => {
            if (!(ctxMenuEl instanceof HTMLElement)) return;

            const popoverEl = ctxMenuEl.closest('.context-menu-popover');
            if (!(popoverEl instanceof HTMLElement)) return;

            ctxMenuEl.style.maxHeight = '';
            ctxMenuEl.style.overflowY = '';

            const menuRect = ctxMenuEl.getBoundingClientRect();
            const popoverRect = popoverEl.getBoundingClientRect();
            const menuTopOffset = menuRect.top - popoverRect.top;
            const fit = resolveContextMenuViewportFit({
                menuTop: menuRect.top,
                menuHeight: menuRect.height,
                viewportHeight: window.innerHeight,
                viewportInset: CONTEXT_MENU_VIEWPORT_INSET,
            });

            ctxMenuEl.style.maxHeight = `${fit.maxHeight}px`;
            ctxMenuEl.style.overflowY = fit.overflowY;
            ctxMenuEl.style.boxSizing = 'border-box';
            ctxMenuEl.style.overscrollBehaviorY = 'contain';

            if (fit.popoverTop !== menuRect.top) {
                popoverEl.style.top = `${fit.popoverTop - menuTopOffset}px`;
            }
        };

        const closeContextMenuAfterAction = (sourceEl: Element) => {
            const outsideTarget = containerRef.current || document.body;
            outsideTarget.dispatchEvent(new PointerEvent('pointerdown', {
                bubbles: true,
                cancelable: true,
                pointerType: 'mouse',
            }));
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        };

        const collectSelectedElementInfos = (): CanvasElementContextInfo[] => {
            const appState = excalidrawAPI.getAppState();
            const selectedIds = Object.keys(appState?.selectedElementIds || {});
            if (selectedIds.length === 0) return [];
            const elements = excalidrawAPI.getSceneElements();
            const selectedIdSet = new Set(selectedIds);
            const infos: CanvasElementContextInfo[] = [];
            for (const el of elements) {
                if (el.isDeleted || !selectedIdSet.has(el.id)) continue;
                infos.push(buildCanvasElementContextInfo(el));
            }
            return infos;
        };

        const injectAnnotationItem = (ctxMenuEl: Element) => {
            // Prevent duplicate injection
            if (ctxMenuEl.querySelector('[data-axhub-annotation-item]')) return;

            const appState = excalidrawAPI.getAppState();
            const selectedIds = Object.keys(appState?.selectedElementIds || {});
            const selectedIdSet = new Set(selectedIds);
            const elements = excalidrawAPI.getSceneElements();
            const selectedElements = elements.filter((el: any) => !el.isDeleted && selectedIdSet.has(el.id));
            const imageContextMenuState = resolveCanvasImageContextMenuState({
                bridgeConnected,
                canAddScreenshotToAI: Boolean(onAddScreenshotToAI),
                canAddNodesToAI: Boolean(onAddNodesToAI),
                canAddImageToAI: Boolean(onAddImageToAI),
                selectedElements,
                files: excalidrawAPI.getFiles?.() || {},
            });
            const mergeTextUpdate = createMergedTextSceneUpdate({
                elements,
                selectedElementIds: appState?.selectedElementIds || {},
            });

            // Track items to prepend at the top (in reverse order)
            const topItems: Element[] = [];

            // ── Annotation items (single selection only) ──
            if (selectedIds.length === 1) {
                const elementId = selectedIds[0];
                const element = elements.find((el: any) => el.id === elementId && !el.isDeleted);

                if (element) {
                    const annotation = element.customData?.annotation || '';
                    const annotationTaskRef = getCanvasDirectRunAnnotationTaskRef(element);

                    // Create "添加标注" / "编辑标注" item
                    const addLi = document.createElement('li');
                    addLi.setAttribute('data-axhub-annotation-item', 'add');
                    const addBtn = document.createElement('button');
                    addBtn.className = 'context-menu-item';
                    addBtn.type = 'button';
                    const addLabel = document.createElement('span');
                    addLabel.className = 'context-menu-item__label';
                    addLabel.textContent = annotationTaskRef ? '查看批注' : annotation ? '编辑批注' : '添加批注';
                    const addShortcut = document.createElement('kbd');
                    addShortcut.className = 'context-menu-item__shortcut';
                    addShortcut.textContent = '⌘⇧M';
                    addBtn.appendChild(addLabel);
                    addBtn.appendChild(addShortcut);
                    addLi.appendChild(addBtn);

                    addBtn.addEventListener('click', () => {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                        const appState2 = excalidrawAPI.getAppState();
                        const zoom = appState2.zoom?.value ?? 1;
                        const containerRect = container.getBoundingClientRect();
                        const screenX = containerRect.left + (element.x + (element.width || 0) + appState2.scrollX) * zoom;
                        const screenY = containerRect.top + (element.y + appState2.scrollY) * zoom;
                        requestAnimationFrame(() => {
                            openPopover(elementId, annotation, screenX, screenY, annotationTaskRef);
                        });
                    });

                    topItems.push(addLi);

                    // Add "删除批注" item after the add item if annotation exists
                    if (annotation && !annotationTaskRef) {
                        const delLi = document.createElement('li');
                        delLi.setAttribute('data-axhub-annotation-item', 'delete');
                        const delBtn = document.createElement('button');
                        delBtn.className = 'context-menu-item dangerous';
                        delBtn.type = 'button';
                        const delLabel = document.createElement('span');
                        delLabel.className = 'context-menu-item__label';
                        delLabel.textContent = '删除批注';
                        delBtn.appendChild(delLabel);
                        delLi.appendChild(delBtn);

                        delBtn.addEventListener('click', () => {
                            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                            setAnnotation(elementId, '');
                        });
                        topItems.push(delLi);
                    }
                }
            }

            // ── View mode toggle for embeddable elements (single selection only) ──
            if (selectedIds.length === 1) {
                const elementId = selectedIds[0];
                const element = elements.find((el: any) => el.id === elementId && !el.isDeleted);

                if (
                    element
                    && element.type === 'embeddable'
                    && element.customData
                    && (element.customData.embedViewMode !== 'link' || element.customData.previewKind !== 'none')
                ) {
                    const currentViewMode = element.customData.embedViewMode || 'link';
                    const isLinkMode = currentViewMode === 'link';
                    const toggleLabel = isLinkMode ? '🖼 切换为预览模式' : '🔗 切换为链接模式';

                    const toggleLi = document.createElement('li');
                    toggleLi.setAttribute('data-axhub-annotation-item', 'toggle-view-mode');
                    const toggleBtn = document.createElement('button');
                    toggleBtn.className = 'context-menu-item';
                    toggleBtn.type = 'button';
                    const toggleLabelSpan = document.createElement('span');
                    toggleLabelSpan.className = 'context-menu-item__label';
                    toggleLabelSpan.textContent = toggleLabel;
                    toggleBtn.appendChild(toggleLabelSpan);
                    toggleLi.appendChild(toggleBtn);

                    toggleBtn.addEventListener('click', () => {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                        const allElements = excalidrawAPI.getSceneElements();
                        const appState = excalidrawAPI.getAppState();
                        const viewportRect = containerRef.current?.getBoundingClientRect();
                        const updated = allElements.map((el: any) => {
                            if (el.id !== elementId) return el;
                            return resolveEmbedViewModeToggleUpdate(el, isLinkMode, viewportRect, appState?.zoom?.value);
                        });
                        excalidrawAPI.updateScene({ elements: updated as any });
                    });

                    topItems.push(toggleLi);
                }
            }

            // ── AI context items (visible only when bridge is connected) ──
            if (bridgeConnected && selectedIds.length > 0) {
                if (onAddScreenshotToAI && imageContextMenuState.showScreenshotToAI) {
                    const screenshotLi = document.createElement('li');
                    screenshotLi.setAttribute('data-axhub-annotation-item', 'add-screenshot-to-ai');
                    const screenshotBtn = document.createElement('button');
                    screenshotBtn.className = 'context-menu-item';
                    screenshotBtn.type = 'button';
                    const screenshotLabel = document.createElement('span');
                    screenshotLabel.className = 'context-menu-item__label';
                    screenshotLabel.textContent = '将截图添加到 AI';
                    screenshotBtn.appendChild(screenshotLabel);
                    screenshotLi.appendChild(screenshotBtn);
                    screenshotBtn.addEventListener('click', () => {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                        const infos = collectSelectedElementInfos();
                        if (infos.length > 0) {
                            void onAddScreenshotToAI(infos);
                        }
                    });
                    topItems.push(screenshotLi);
                }
                if (onAddNodesToAI && imageContextMenuState.showNodeContextToAI) {
                    const nodesLi = document.createElement('li');
                    nodesLi.setAttribute('data-axhub-annotation-item', 'add-nodes-to-ai');
                    const nodesBtn = document.createElement('button');
                    nodesBtn.className = 'context-menu-item';
                    nodesBtn.type = 'button';
                    const nodesLabel = document.createElement('span');
                    nodesLabel.className = 'context-menu-item__label';
                    nodesLabel.textContent = selectedIds.length === 1
                        ? '将节点添加到 AI'
                        : `将 ${selectedIds.length} 个节点添加到 AI`;
                    const nodesShortcut = document.createElement('kbd');
                    nodesShortcut.className = 'context-menu-item__shortcut';
                    nodesShortcut.textContent = '⌘⇧↵';
                    nodesBtn.appendChild(nodesLabel);
                    nodesBtn.appendChild(nodesShortcut);
                    nodesLi.appendChild(nodesBtn);

                    nodesBtn.addEventListener('click', () => {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                        const infos = collectSelectedElementInfos();
                        if (infos.length > 0) {
                            onAddNodesToAI(infos);
                        }
                    });

                    topItems.push(nodesLi);
                }
                if (onAddImageToAI && imageContextMenuState.showOriginalImageToAI) {
                    const imageLi = document.createElement('li');
                    imageLi.setAttribute('data-axhub-annotation-item', 'add-image-to-ai');
                    const imageBtn = document.createElement('button');
                    imageBtn.className = 'context-menu-item';
                    imageBtn.type = 'button';
                    const imageLabel = document.createElement('span');
                    imageLabel.className = 'context-menu-item__label';
                    imageLabel.textContent = '添加图片到上下文';
                    imageBtn.appendChild(imageLabel);
                    imageLi.appendChild(imageBtn);
                    imageBtn.addEventListener('click', () => {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                        const infos = collectSelectedElementInfos();
                        if (infos.length > 0) {
                            void onAddImageToAI(infos);
                        }
                    });
                    topItems.push(imageLi);
                }
            }

            // ── Local image tools (no AI bridge required) ──
            if (onCopyImageToClipboard && imageContextMenuState.showCopyOriginalImage) {
                const copyLi = document.createElement('li');
                copyLi.setAttribute('data-axhub-annotation-item', 'copy-original-image');
                const copyBtn = document.createElement('button');
                copyBtn.className = 'context-menu-item';
                copyBtn.type = 'button';
                const copyLabel = document.createElement('span');
                copyLabel.className = 'context-menu-item__label';
                copyLabel.textContent = '复制图片';
                copyBtn.appendChild(copyLabel);
                copyLi.appendChild(copyBtn);
                copyBtn.addEventListener('click', async () => {
                    const infos = collectSelectedElementInfos();
                    if (infos.length > 0) {
                        await onCopyImageToClipboard(infos);
                        closeContextMenuAfterAction(copyBtn);
                    }
                });
                topItems.push(copyLi);
            }
            if (onMakeImageBackgroundTransparent && imageContextMenuState.showBackgroundToTransparent) {
                const transparentLi = document.createElement('li');
                transparentLi.setAttribute('data-axhub-annotation-item', 'background-to-transparent');
                const transparentBtn = document.createElement('button');
                transparentBtn.className = 'context-menu-item';
                transparentBtn.type = 'button';
                const transparentLabel = document.createElement('span');
                transparentLabel.className = 'context-menu-item__label';
                transparentLabel.textContent = '背景转透明';
                transparentBtn.appendChild(transparentLabel);
                transparentLi.appendChild(transparentBtn);
                transparentBtn.addEventListener('click', () => {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                    const infos = collectSelectedElementInfos();
                    if (infos.length > 0) {
                        void onMakeImageBackgroundTransparent(infos);
                    }
                });
                topItems.push(transparentLi);
            }

            // ── "合并文本" item (visible only for mergeable text selections) ──
            if (mergeTextUpdate) {
                const mergeLi = document.createElement('li');
                mergeLi.setAttribute('data-axhub-annotation-item', 'merge-text');
                const mergeBtn = document.createElement('button');
                mergeBtn.className = 'context-menu-item';
                mergeBtn.type = 'button';
                const mergeLabel = document.createElement('span');
                mergeLabel.className = 'context-menu-item__label';
                mergeLabel.textContent = '合并文本';
                mergeBtn.appendChild(mergeLabel);
                mergeLi.appendChild(mergeBtn);

                mergeBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

                    requestAnimationFrame(() => {
                        const nextAppState = excalidrawAPI.getAppState();
                        const nextUpdate = createMergedTextSceneUpdate({
                            elements: excalidrawAPI.getSceneElements(),
                            selectedElementIds: nextAppState?.selectedElementIds || {},
                        });
                        if (!nextUpdate) return;

                        excalidrawAPI.updateScene({
                            elements: nextUpdate.elements as any,
                            appState: nextUpdate.appState as any,
                            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
                        });
                    });
                });

                topItems.push(mergeLi);
            }

            // ── Prepend all custom items at the top of the menu ──
            if (topItems.length > 0) {
                const firstChild = ctxMenuEl.firstChild;
                // Insert items in reverse so they appear in the correct order
                for (let i = topItems.length - 1; i >= 0; i--) {
                    ctxMenuEl.insertBefore(topItems[i], firstChild);
                }
            }
        };

        // ── Inject custom shortcuts into Excalidraw Help Dialog ──
        const injectHelpDialogShortcuts = (helpDialog: Element) => {
            if (helpDialog.querySelector('[data-axhub-help-section]')) return;

            // Find the shortcuts container
            const shortcutsContainer = helpDialog.querySelector('.HelpDialog__shortcuts-container')
                || helpDialog.querySelector('[class*="shortcuts"]');
            if (!shortcutsContainer) return;

            const section = document.createElement('div');
            section.setAttribute('data-axhub-help-section', 'true');
            section.style.cssText = 'margin-top: 16px;';

            const header = document.createElement('h3');
            header.textContent = 'Axhub 扩展';
            header.style.cssText = 'font-size: 14px; font-weight: 600; margin: 0 0 8px 0; color: var(--color-on-surface);';
            section.appendChild(header);

            const isMac = /mac|ipod|iphone|ipad/i.test(navigator.platform || '');
            const modLabel = isMac ? '⌘' : 'Ctrl';

            const shortcuts = [
                { label: '添加/编辑批注', keys: `${modLabel} + Shift + M` },
                { label: '将节点添加到 AI', keys: `${modLabel} + Shift + Enter` },
            ];

            for (const sc of shortcuts) {
                const row = document.createElement('div');
                row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 12px; color: var(--color-on-surface);';
                const labelSpan = document.createElement('span');
                labelSpan.textContent = sc.label;
                const keysSpan = document.createElement('span');
                keysSpan.style.cssText = 'font-family: monospace; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: var(--color-surface-mid); color: var(--color-on-surface);';
                keysSpan.textContent = sc.keys;
                row.appendChild(labelSpan);
                row.appendChild(keysSpan);
                section.appendChild(row);
            }

            shortcutsContainer.appendChild(section);
        };

        // Watch for Excalidraw context menu + help dialog appearing in the DOM
        const observer = new MutationObserver(() => {
            // Context menus
            const menus = document.querySelectorAll('.context-menu:not([data-axhub-injected])');
            for (const menu of menus) {
                menu.setAttribute('data-axhub-injected', 'true');
                reorganizeContextMenu(menu);
                injectAnnotationItem(menu);
                fitContextMenuInViewport(menu);
            }
            // Help dialog
            const helpDialogs = document.querySelectorAll('.HelpDialog:not([data-axhub-help-injected])');
            for (const hd of helpDialogs) {
                hd.setAttribute('data-axhub-help-injected', 'true');
                injectHelpDialogShortcuts(hd);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        const handleWindowResize = () => {
            const menus = document.querySelectorAll('.context-menu[data-axhub-injected]');
            for (const menu of menus) {
                fitContextMenuInViewport(menu);
            }
        };
        window.addEventListener('resize', handleWindowResize);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', handleWindowResize);
        };
    }, [excalidrawAPI, containerRef, openPopover, setAnnotation, bridgeConnected, onAddScreenshotToAI, onAddNodesToAI, onAddImageToAI, onCopyImageToClipboard, onMakeImageBackgroundTransparent]);

    /* ── Close popover on outside click ───────────────────────────── */
    useEffect(() => {
        if (!popoverElementId) return;
        const handleClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                saveAndClosePopover();
            }
        };
        document.addEventListener('mousedown', handleClick, true);
        return () => document.removeEventListener('mousedown', handleClick, true);
    }, [popoverElementId, saveAndClosePopover]);

    /* ── Close popover when selection changes ─────────────────────── */
    useEffect(() => {
        if (popoverElementId && selectedInfo?.elementId !== popoverElementId) {
            saveAndClosePopover();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedInfo?.elementId]);

    /* ── Keyboard shortcuts ──────────────────────────────────────── */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Skip when typing in inputs
            const tag = (document.activeElement?.tagName || '').toLowerCase();
            if (tag === 'textarea' || tag === 'input' || (document.activeElement as HTMLElement)?.isContentEditable) return;

            const isMod = e.metaKey || e.ctrlKey;
            if (!isMod || !e.shiftKey) return;

            // ⌘+Shift+M → open annotation popover for single selected element
            if (e.key === 'M' || e.key === 'm') {
                e.preventDefault();
                e.stopPropagation();
                if (!selectedInfo) return;
                 openPopover(
                     selectedInfo.elementId,
                     selectedInfo.annotation,
                     selectedInfo.screenX + selectedInfo.screenWidth,
                     selectedInfo.screenY,
                     selectedInfo.annotationTaskRef || null,
                 );
                 return;
            }

            // ⌘+Shift+Enter → add selected nodes to AI context
            if (e.key === 'Enter') {
                if (!bridgeConnected || !onAddNodesToAI) return;
                e.preventDefault();
                e.stopPropagation();
                const appState = excalidrawAPI?.getAppState();
                const selectedIds = Object.keys(appState?.selectedElementIds || {});
                if (selectedIds.length === 0) return;
                const elements = excalidrawAPI.getSceneElements();
                const selectedIdSet = new Set(selectedIds);
                const infos: CanvasElementContextInfo[] = [];
                for (const el of elements) {
                    if (el.isDeleted || !selectedIdSet.has(el.id)) continue;
                    infos.push(buildCanvasElementContextInfo(el));
                }
                if (infos.length > 0) onAddNodesToAI(infos);
            }
        };

        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [excalidrawAPI, selectedInfo, bridgeConnected, onAddNodesToAI, openPopover]);

    /* ── Compact toolbar annotation button event ──────────────────── */
    useEffect(() => {
        const handler = () => {
            if (!selectedInfo) return;
            openPopover(
                selectedInfo.elementId,
                selectedInfo.annotation,
                selectedInfo.screenX + selectedInfo.screenWidth,
                selectedInfo.screenY,
                selectedInfo.annotationTaskRef || null,
            );
        };
        document.addEventListener('axhub:openAnnotationPopover', handler);
        return () => document.removeEventListener('axhub:openAnnotationPopover', handler);
    }, [selectedInfo, openPopover]);

    /* ── Render ──────────────────────────────────────────────────── */
    const containerRect = containerRef.current?.getBoundingClientRect();
    const taskPopoverRunning = popoverTaskRef?.status === 'running' || Boolean(popoverExecutionTaskId && !popoverTaskRef);
    const taskPopoverFailed = popoverTaskRef?.status === 'failed';
    const taskPopoverAborted = popoverTaskRef?.status === 'aborted';
    const activePopoverTaskId = popoverTaskRef?.statusTaskId
        || (popoverExecutionTaskId && popoverExecutionTaskId !== PENDING_ANNOTATION_TASK_ID ? popoverExecutionTaskId : '');
    const executeButtonLabel = taskPopoverRunning ? '执行中' : taskPopoverFailed ? '执行失败' : taskPopoverAborted ? '已终止' : '执行';
    const showExecuteButtonText = taskPopoverRunning || taskPopoverFailed || taskPopoverAborted;
    const executeButtonDisabled = taskPopoverRunning
        || Boolean(popoverTaskRef)
        || !popoverText.trim()
        || !onExecuteAnnotationPrompt;
    const handleStopPopoverTask = useCallback(() => {
        if (!activePopoverTaskId) return;
        if (popoverTaskRef) {
            onStopAnnotationTask?.(popoverTaskRef.statusTaskId);
            return;
        }
        onStopAnnotationTask?.(activePopoverTaskId);
    }, [activePopoverTaskId, onStopAnnotationTask, popoverTaskRef]);

    return (
        <>
            <style>
                {`
                    @keyframes axhubAnnotationSpin {
                        to { transform: rotate(360deg); }
                    }
                    .axhub-annotation-popover-textarea::-webkit-scrollbar {
                        display: none;
                    }
                `}
            </style>
            {/* ── Annotation badges on annotated elements ── */}
            {containerRect && badges.map((badge) => {
                const badgeOffsetX = badge.annotationTaskRef ? TASK_BADGE_OFFSET_X : BADGE_OFFSET_X;
                const badgeOffsetY = badge.annotationTaskRef ? TASK_BADGE_OFFSET_Y : BADGE_OFFSET_Y;
                const left = badge.screenRight - containerRect.left + badgeOffsetX;
                const top = badge.screenTop - containerRect.top + badgeOffsetY;

                return (
                    <div
                        key={`annotation-badge-${badge.elementId}`}
                        style={{
                            ...badgeStyle,
                            left,
                            top: Math.max(0, top),
                        }}
                        onClick={(e) => handleBadgeClick(e, badge)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        role="button"
                        aria-label="编辑批注"
                    >
                        <Sparkles style={badgeIconStyle} />
                    </div>
                );
            })}


            {/* ── Annotation editor popover ── */}
            {popoverElementId && (
                <div
                    ref={popoverRef}
                    style={{
                        ...popoverStyle,
                        left: popoverPosition.left,
                        top: popoverPosition.top,
                        transform: 'none',
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <AnnotationTooltipButton
                            tooltip={executeButtonLabel}
                            onClick={() => void handleExecuteAnnotationPrompt()}
                            disabled={executeButtonDisabled}
                            style={{
                                ...executeButtonStyle,
                                ...(showExecuteButtonText ? { width: 'auto', padding: 0 } : {}),
                                ...(executeButtonDisabled ? {
                                    opacity: taskPopoverRunning || popoverTaskRef ? 0.72 : 0.4,
                                    cursor: 'default',
                                } : {}),
                                ...(taskPopoverFailed ? { color: '#dc2626' } : {}),
                                ...(taskPopoverAborted ? { color: '#64748b' } : {}),
                            }}
                        >
                            {taskPopoverRunning ? (
                                <Loader2 style={spinnerIconStyle} />
                            ) : taskPopoverFailed || taskPopoverAborted ? (
                                <Sparkles style={actionIconStyle} />
                            ) : (
                                <Play style={actionIconStyle} />
                            )}
                            {showExecuteButtonText ? executeButtonLabel : null}
                        </AnnotationTooltipButton>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                        }}>
                            {taskPopoverRunning && activePopoverTaskId ? (
                                <AnnotationTooltipButton
                                    tooltip="终止执行"
                                    onClick={handleStopPopoverTask}
                                    style={{
                                        ...iconButtonStyle,
                                        color: '#dc2626',
                                    }}
                                >
                                    <CircleStop style={{ width: 16, height: 16 }} />
                                </AnnotationTooltipButton>
                            ) : null}
                            {popoverText.trim() ? (
                                <AnnotationTooltipButton
                                    tooltip="清空批注"
                                    onClick={deleteAnnotationAndClose}
                                    disabled={taskPopoverRunning || Boolean(popoverTaskRef)}
                                    style={taskPopoverRunning || Boolean(popoverTaskRef)
                                        ? disabledIconButtonStyle
                                        : iconButtonStyle}
                                >
                                    <Trash2 style={{ width: 16, height: 16 }} />
                                </AnnotationTooltipButton>
                            ) : null}
                            <AnnotationTooltipButton
                                tooltip="关闭并保存"
                                onClick={saveAndClosePopover}
                                style={iconButtonStyle}
                            >
                                <X style={{ width: 16, height: 16 }} />
                            </AnnotationTooltipButton>
                        </div>
                    </div>

                    {/* Textarea */}
                    <textarea
                        className="axhub-annotation-popover-textarea"
                        ref={textareaRef}
                        value={popoverText}
                        readOnly={Boolean(popoverTaskRef)}
                        disabled={taskPopoverRunning && !popoverTaskRef}
                        onChange={(e) => setPopoverText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                e.stopPropagation();
                                saveAndClosePopover();
                            }
                            // Prevent Excalidraw from handling keyboard events
                            e.stopPropagation();
                        }}
                        placeholder="输入给 AI 的需求"
                        style={{
                            ...textareaStyle,
                            ...(popoverTaskRef || taskPopoverRunning ? {
                                background: '#f8fafc',
                                color: '#334155',
                                cursor: 'default',
                            } : {}),
                        }}
                        onFocus={(e) => {
                            if (popoverTaskRef || taskPopoverRunning) return;
                            (e.target as HTMLTextAreaElement).style.borderColor = '#94a3b8';
                        }}
                        onBlur={(e) => {
                            (e.target as HTMLTextAreaElement).style.borderColor = '#d1d5db';
                        }}
                    />
                </div>
            )}
        </>
    );
}

/** Exported for use in MainMenu "清空所有批注" */
export function useClearAllAnnotations(excalidrawAPI: any) {
    return useCallback(() => {
        if (!excalidrawAPI) return;
        const elements = excalidrawAPI.getSceneElements();
        let changed = false;
        const updated = elements.map((el: any) => {
            if (!el.customData?.annotation) return el;
            changed = true;
            const newCustomData = { ...el.customData };
            delete newCustomData.annotation;
            delete newCustomData.annotationUpdatedAt;
            delete newCustomData.annotationTaskRef;
            return {
                ...el,
                customData: newCustomData,
                version: (el.version || 0) + 1,
                versionNonce: Math.floor(Math.random() * 2147483647),
                updated: Date.now(),
            };
        });
        if (changed) {
            excalidrawAPI.updateScene({ elements: updated as any });
        }
    }, [excalidrawAPI]);
}
