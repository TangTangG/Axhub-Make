import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CaptureUpdateAction } from '@axhub/excalidraw';
import { StickyNote, Trash2, X, MessageSquarePlus } from 'lucide-react';

import { createMergedTextSceneUpdate } from './canvasTextMerge';
import { resolveContextMenuViewportFit } from './contextMenuViewport';
import { getLinkEmbedSize } from './linkEmbedSizing';
import { fitEmbedSizeToViewport, type EmbedViewportRect } from './embedViewportSizing';
import { reorganizeContextMenu } from './contextMenuReorganizer';
import { CANVAS_ELEMENT_OVERLAY_Z_INDEX } from './canvasOverlayLayers';

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
}

interface AnnotationOverlayProps {
    excalidrawAPI: any;
    /** Ref to the container div wrapping <Excalidraw> */
    containerRef: React.RefObject<HTMLDivElement>;
    /** Whether the OpenCode bridge is connected (AI panel open). */
    bridgeConnected?: boolean;
    /** Callback when user adds selected elements to the AI conversation context. */
    onAddToContext?: (elements: CanvasElementContextInfo[]) => void;
    /** Callback when the set of annotated elements changes. */
    onAnnotationsChange?: (annotations: CanvasElementContextInfo[]) => void;
}

function getResourceTypeFromElement(element: any): 'prototype' | 'doc' | 'theme' {
    const resourceType = element?.customData?.resourceType;
    if (resourceType === 'doc' || element?.customData?.type === 'axhub-doc') return 'doc';
    if (resourceType === 'theme' || element?.customData?.type === 'axhub-theme') return 'theme';
    return 'prototype';
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
    /** Screen-space X of the element's top-right corner */
    screenRight: number;
    /** Screen-space Y of the element's top-left corner */
    screenTop: number;
}

/** Info about the currently selected element for the annotation action */
interface SelectedElementAnnotationInfo {
    elementId: string;
    annotation: string;
    /** Screen-space coords for toolbar placement */
    screenX: number;
    screenY: number;
    screenWidth: number;
}

/* ── Styles ──────────────────────────────────────────────────────── */

const BADGE_SIZE = 20;
const BADGE_OFFSET_X = -4;
const BADGE_OFFSET_Y = -8;

const badgeStyle: React.CSSProperties = {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: '50%',
    background: '#008f5d',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    zIndex: CANVAS_ELEMENT_OVERLAY_Z_INDEX,
    pointerEvents: 'auto',
    boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
    transition: 'transform 0.12s ease',
    userSelect: 'none' as const,
};

const badgeIconStyle = { width: 11, height: 11 };

const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '100%',
    right: 0,
    marginBottom: 6,
    padding: '6px 10px',
    borderRadius: 6,
    background: 'rgba(15, 23, 42, 0.92)',
    color: '#f8fafc',
    fontSize: 11,
    lineHeight: '1.45',
    width: 'max-content',
    minWidth: 80,
    maxWidth: 240,
    wordBreak: 'break-word' as const,
    whiteSpace: 'pre-wrap' as const,
    pointerEvents: 'none',
    zIndex: CANVAS_ELEMENT_OVERLAY_Z_INDEX,
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const popoverStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: CANVAS_ELEMENT_OVERLAY_Z_INDEX,
    width: 280,
    background: '#fff',
    borderRadius: 10,
    boxShadow: '0 4px 24px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.04)',
    padding: '12px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 80,
    maxHeight: 200,
    resize: 'vertical' as const,
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 12,
    lineHeight: '1.5',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
    color: '#1e293b',
};

const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 28,
    padding: '0 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.12s',
};

const CONTEXT_MENU_VIEWPORT_INSET = 8;

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
    onAddToContext,
    onAnnotationsChange,
}: AnnotationOverlayProps) {
    const [badges, setBadges] = useState<AnnotatedBadgeInfo[]>([]);
    const [selectedInfo, setSelectedInfo] = useState<SelectedElementAnnotationInfo | null>(null);
    const [hoveredBadgeId, setHoveredBadgeId] = useState<string | null>(null);
    const [popoverElementId, setPopoverElementId] = useState<string | null>(null);
    const [popoverText, setPopoverText] = useState('');
    const [popoverPosition, setPopoverPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
    const rafRef = useRef<number>(0);
    const popoverRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const prevAnnotationsHashRef = useRef('');

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

            for (const el of elements) {
                if (el.isDeleted) continue;

                const annotation = el.customData?.annotation;
                const isSelected = selectedIdSet.has(el.id);

                // Compute screen coords
                const topLeft = canvasToScreen(
                    el.x, el.y,
                    appState.scrollX || 0, appState.scrollY || 0,
                    zoom, containerRect.left, containerRect.top,
                );
                const screenW = (el.width || 0) * zoom;

                // Badge for annotated elements
                if (annotation && typeof annotation === 'string' && annotation.trim()) {
                    nextBadges.push({
                        elementId: el.id,
                        annotation,
                        screenRight: topLeft.x + screenW,
                        screenTop: topLeft.y,
                    });
                    annotatedElements.push({
                        elementId: el.id,
                        type: el.type || 'unknown',
                        annotation,
                        title: el.customData?.title || '',
                        link: el.link || '',
                        width: el.width || 0,
                        height: el.height || 0,
                    });
                }

                // Track selected element (single selection only)
                if (isSelected && selectedIdSet.size === 1) {
                    nextSelected = {
                        elementId: el.id,
                        annotation: annotation || '',
                        screenX: topLeft.x,
                        screenY: topLeft.y,
                        screenWidth: screenW,
                    };
                }
            }

            setBadges(nextBadges);
            setSelectedInfo(nextSelected);

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

    /* ── Open annotation popover ─────────────────────────────────── */
    const openPopover = useCallback((elementId: string, annotation: string, screenX: number, screenY: number) => {
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        setPopoverElementId(elementId);
        setPopoverText(annotation);
        setPopoverPosition({
            left: screenX - containerRect.left,
            top: screenY - containerRect.top + 4,
        });

        // Focus textarea after render – double RAF ensures React has committed the DOM
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                textareaRef.current?.focus();
            });
        });
    }, [containerRef]);

    /* ── Save and close popover ───────────────────────────────────── */
    const saveAndClosePopover = useCallback(() => {
        if (popoverElementId) {
            setAnnotation(popoverElementId, popoverText);
        }
        setPopoverElementId(null);
        setPopoverText('');
    }, [popoverElementId, popoverText, setAnnotation]);

    const deleteAnnotationAndClose = useCallback(() => {
        if (popoverElementId) {
            setAnnotation(popoverElementId, '');
        }
        setPopoverElementId(null);
        setPopoverText('');
    }, [popoverElementId, setAnnotation]);

    /* ── Handle badge click → open popover ────────────────────────── */
    const handleBadgeClick = useCallback((e: React.MouseEvent, badge: AnnotatedBadgeInfo) => {
        e.stopPropagation();
        e.preventDefault();
        openPopover(badge.elementId, badge.annotation, badge.screenRight, badge.screenTop);
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

        const collectSelectedElementInfos = (): CanvasElementContextInfo[] => {
            const appState = excalidrawAPI.getAppState();
            const selectedIds = Object.keys(appState?.selectedElementIds || {});
            if (selectedIds.length === 0) return [];
            const elements = excalidrawAPI.getSceneElements();
            const selectedIdSet = new Set(selectedIds);
            const infos: CanvasElementContextInfo[] = [];
            for (const el of elements) {
                if (el.isDeleted || !selectedIdSet.has(el.id)) continue;
                infos.push({
                    elementId: el.id,
                    type: el.type || 'unknown',
                    annotation: el.customData?.annotation || undefined,
                    title: el.customData?.title || '',
                    link: el.link || '',
                    width: el.width || 0,
                    height: el.height || 0,
                });
            }
            return infos;
        };

        const injectAnnotationItem = (ctxMenuEl: Element) => {
            // Prevent duplicate injection
            if (ctxMenuEl.querySelector('[data-axhub-annotation-item]')) return;

            const appState = excalidrawAPI.getAppState();
            const selectedIds = Object.keys(appState?.selectedElementIds || {});
            const elements = excalidrawAPI.getSceneElements();
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

                    // Create "添加标注" / "编辑标注" item
                    const addLi = document.createElement('li');
                    addLi.setAttribute('data-axhub-annotation-item', 'add');
                    const addBtn = document.createElement('button');
                    addBtn.className = 'context-menu-item';
                    addBtn.type = 'button';
                    const addLabel = document.createElement('span');
                    addLabel.className = 'context-menu-item__label';
                    addLabel.textContent = annotation ? '编辑批注' : '添加批注';
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
                            openPopover(elementId, annotation, screenX, screenY);
                        });
                    });

                    topItems.push(addLi);

                    // Add "删除批注" item after the add item if annotation exists
                    if (annotation) {
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

            // ── "添加到对话" item (visible only when bridge is connected) ──
            if (bridgeConnected && onAddToContext && selectedIds.length > 0) {
                const ctxLi = document.createElement('li');
                ctxLi.setAttribute('data-axhub-annotation-item', 'add-to-context');
                const ctxBtn = document.createElement('button');
                ctxBtn.className = 'context-menu-item';
                ctxBtn.type = 'button';
                const ctxLabel = document.createElement('span');
                ctxLabel.className = 'context-menu-item__label';
                ctxLabel.textContent = selectedIds.length === 1
                    ? '💬 添加到对话'
                    : `💬 添加 ${selectedIds.length} 个元素到对话`;
                const ctxShortcut = document.createElement('kbd');
                ctxShortcut.className = 'context-menu-item__shortcut';
                ctxShortcut.textContent = '⌘⇧↵';
                ctxBtn.appendChild(ctxLabel);
                ctxBtn.appendChild(ctxShortcut);
                ctxLi.appendChild(ctxBtn);

                ctxBtn.addEventListener('click', () => {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                    const infos = collectSelectedElementInfos();
                    if (infos.length > 0) {
                        onAddToContext(infos);
                    }
                });

                topItems.push(ctxLi);
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
                { label: '添加到对话', keys: `${modLabel} + Shift + Enter` },
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
    }, [excalidrawAPI, containerRef, openPopover, setAnnotation, bridgeConnected, onAddToContext]);

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
                );
                return;
            }

            // ⌘+Shift+Enter → add selected elements to context
            if (e.key === 'Enter') {
                if (!bridgeConnected || !onAddToContext) return;
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
                    infos.push({
                        elementId: el.id,
                        type: el.type || 'unknown',
                        annotation: el.customData?.annotation || undefined,
                        title: el.customData?.title || '',
                        link: el.link || '',
                        width: el.width || 0,
                        height: el.height || 0,
                    });
                }
                if (infos.length > 0) onAddToContext(infos);
            }
        };

        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, [excalidrawAPI, selectedInfo, bridgeConnected, onAddToContext, openPopover]);

    /* ── Compact toolbar annotation button event ──────────────────── */
    useEffect(() => {
        const handler = () => {
            if (!selectedInfo) return;
            openPopover(
                selectedInfo.elementId,
                selectedInfo.annotation,
                selectedInfo.screenX + selectedInfo.screenWidth,
                selectedInfo.screenY,
            );
        };
        document.addEventListener('axhub:openAnnotationPopover', handler);
        return () => document.removeEventListener('axhub:openAnnotationPopover', handler);
    }, [selectedInfo, openPopover]);

    /* ── Render ──────────────────────────────────────────────────── */
    const containerRect = containerRef.current?.getBoundingClientRect();

    return (
        <>
            {/* ── Annotation badges on annotated elements ── */}
            {containerRect && badges.map((badge) => {
                const left = badge.screenRight - containerRect.left + BADGE_OFFSET_X;
                const top = badge.screenTop - containerRect.top + BADGE_OFFSET_Y;

                return (
                    <div
                        key={`annotation-badge-${badge.elementId}`}
                        style={{
                            ...badgeStyle,
                            left,
                            top: Math.max(0, top),
                            transform: hoveredBadgeId === badge.elementId ? 'scale(1.15)' : 'scale(1)',
                        }}
                        onClick={(e) => handleBadgeClick(e, badge)}
                        onMouseEnter={() => setHoveredBadgeId(badge.elementId)}
                        onMouseLeave={() => setHoveredBadgeId(null)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        title="点击编辑批注"
                    >
                        <StickyNote style={badgeIconStyle} />

                        {/* Tooltip on hover */}
                        {hoveredBadgeId === badge.elementId && (
                            <div style={tooltipStyle}>
                                {badge.annotation.length > 120
                                    ? badge.annotation.slice(0, 120) + '…'
                                    : badge.annotation}
                            </div>
                        )}
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
                        marginBottom: 8,
                    }}>
                        <span style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                        }}>
                            <StickyNote style={{ width: 13, height: 13, color: '#008f5d' }} />
                            批注
                        </span>
                        <button
                            type="button"
                            onClick={saveAndClosePopover}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 20,
                                height: 20,
                                border: 'none',
                                borderRadius: 4,
                                background: 'transparent',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: 0,
                            }}
                            title="关闭"
                        >
                            <X style={{ width: 13, height: 13 }} />
                        </button>
                    </div>

                    {/* Textarea */}
                    <textarea
                        ref={textareaRef}
                        value={popoverText}
                        onChange={(e) => setPopoverText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                e.stopPropagation();
                                saveAndClosePopover();
                            }
                            // Prevent Excalidraw from handling keyboard events
                            e.stopPropagation();
                        }}
                        placeholder="输入批注内容..."
                        style={textareaStyle}
                        onFocus={(e) => {
                            (e.target as HTMLTextAreaElement).style.borderColor = '#008f5d';
                        }}
                        onBlur={(e) => {
                            (e.target as HTMLTextAreaElement).style.borderColor = '#e2e8f0';
                        }}
                    />

                    {/* Actions */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 8,
                    }}>
                        {/* Delete button (only if annotation exists) */}
                        {popoverText.trim() ? (
                            <button
                                type="button"
                                onClick={deleteAnnotationAndClose}
                                style={{
                                    ...btnBase,
                                    background: 'transparent',
                                    color: '#ef4444',
                                }}
                                title="删除批注"
                            >
                                <Trash2 style={{ width: 12, height: 12 }} />
                                删除
                            </button>
                        ) : (
                            <div />
                        )}

                        {/* Save button */}
                        <button
                            type="button"
                            onClick={saveAndClosePopover}
                            style={{
                                ...btnBase,
                                background: '#008f5d',
                                color: '#fff',
                            }}
                        >
                            保存
                        </button>
                    </div>
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
