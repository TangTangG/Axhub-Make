import React from 'react';
import {
    ChevronDown,
    ImageOff,
    Maximize2,
    RotateCcw,
    Settings2,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ItemData } from '../../types';
import type {
    MultiPageColumns,
    MultiPageLayoutResult,
    PreviewConfig,
    PreviewSinglePreset,
} from '../../domains/device/preview-layout';
import { buildPrototypePageHashUrl } from '../../app/index-page/previewActions.helpers';
import {
    derivePrototypePageScreenshotUrl,
    derivePrototypeScreenshotUrl,
    persistPrototypeScreenshot,
} from './canvas-embeds/screenshotPersistence';
import { captureSameOriginIframeScreenshot } from './canvas-embeds/parentScreenshotCapture';
import {
    activateMultiPageLiveSlot,
    resolveMultiPageCardPages,
    type MultiPagePreviewPage,
} from './multiPagePreviewState';

type CardState = {
    pageId: string;
};

interface MultiPagePreviewCanvasProps {
    selectedItem: ItemData;
    previewConfig: PreviewConfig;
    layout: MultiPageLayoutResult;
    previewUrl: string;
    iframeKey: React.Key;
    previewIframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
    onPreviewIframeLoad?: () => void;
    handleChangeMultiPageColumns: (columns: MultiPageColumns) => void;
    handleSelectPreviewSinglePreset: (preset: PreviewSinglePreset) => void;
    handleSelectCustomPreview: () => void;
    handleActivateMultiPagePreview: (pageCount?: number) => void;
    handleChangeCustomPreviewWidth: (width: number) => void;
    handleChangeCustomPreviewHeight: (height: number) => void;
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.1;
const MULTI_PAGE_SCREENSHOT_LOAD_DELAY_MS = 350;
const MULTI_PAGE_GRID_GAP = 16;

function clampZoom(value: number): number {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(value.toFixed(2))));
}

function appendVersion(url: string | undefined, version: number): string | undefined {
    if (!url) return undefined;
    try {
        const parsed = new URL(url, window.location.origin);
        parsed.searchParams.set('v', String(version));
        return parsed.toString();
    } catch {
        return url;
    }
}

function commitPositiveDraft(draft: string, onCommit: (value: number) => void) {
    const parsed = Number.parseInt(draft.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        onCommit(parsed);
    }
}

async function capturePageScreenshotFromIframe({
    iframe,
    selectedItem,
    previewUrl,
    page,
    width,
    height,
}: {
    iframe: HTMLIFrameElement | null | undefined;
    selectedItem: ItemData;
    previewUrl: string;
    page: MultiPagePreviewPage | undefined;
    width: number;
    height: number;
}): Promise<boolean> {
    if (!iframe?.contentWindow || !page) {
        return false;
    }

    try {
        const screenshot = await captureSameOriginIframeScreenshot({
            iframe,
            width,
            height,
        });
        await persistPrototypeScreenshot({
            previewUrl,
            prototypeId: selectedItem.name,
            pageId: page.id,
            dataUrl: screenshot.dataUrl,
            width: screenshot.width,
            height: screenshot.height,
        });
        return true;
    } catch {
        return false;
    }
}

export default function MultiPagePreviewCanvas({
    selectedItem,
    previewConfig,
    layout,
    previewUrl,
    iframeKey,
    previewIframeRef,
    onPreviewIframeLoad,
    handleChangeMultiPageColumns,
    handleSelectPreviewSinglePreset,
    handleSelectCustomPreview,
    handleActivateMultiPagePreview,
    handleChangeCustomPreviewWidth,
    handleChangeCustomPreviewHeight,
}: MultiPagePreviewCanvasProps) {
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const iframeRefs = React.useRef<Record<string, HTMLIFrameElement | null>>({});
    const hiddenScreenshotIframeRefs = React.useRef<Record<string, HTMLIFrameElement | null>>({});
    const loadScreenshotTimersRef = React.useRef<Record<string, number>>({});
    const isPanningRef = React.useRef(false);
    const panStartRef = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const activeSlotsRef = React.useRef<string[]>([]);
    const cardPagesRef = React.useRef<MultiPagePreviewPage[]>([]);
    const selectedItemRef = React.useRef(selectedItem);
    const capturedPageIdsRef = React.useRef<Set<string>>(new Set());
    const pendingHiddenPageCapturesRef = React.useRef<Set<string>>(new Set());
    const stalePageScreenshotIdsRef = React.useRef<Set<string>>(new Set());
    const [activeSlots, setActiveSlots] = React.useState<string[]>([]);
    const [cardStates, setCardStates] = React.useState<CardState[]>([]);
    const [zoom, setZoom] = React.useState(1);
    const [pan, setPan] = React.useState({ x: 24, y: 24 });
    const [isSpacePressed, setIsSpacePressed] = React.useState(false);
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const [showCanvasHelpTip, setShowCanvasHelpTip] = React.useState(true);
    const [customWidthDraft, setCustomWidthDraft] = React.useState('');
    const [customHeightDraft, setCustomHeightDraft] = React.useState('');
    const [imageFailures, setImageFailures] = React.useState<Record<string, 'page' | 'prototype'>>({});
    const [screenshotVersion, setScreenshotVersion] = React.useState(0);
    selectedItemRef.current = selectedItem;
    const pageOptions = React.useMemo(
        () => resolveMultiPageCardPages({ item: selectedItem }),
        [selectedItem],
    );
    const prototypeIdentityKey = selectedItem.name;
    const pageById = React.useMemo(
        () => new Map(pageOptions.allPages.map((page) => [page.id, page])),
        [pageOptions.allPages],
    );
    const visiblePageKey = React.useMemo(
        () => pageOptions.visiblePages.map((page) => page.id).join('|'),
        [pageOptions.visiblePages],
    );

    React.useEffect(() => {
        setCardStates(pageOptions.visiblePages.map((page) => ({ pageId: page.id })));
        setActiveSlots([]);
        activeSlotsRef.current = [];
        iframeRefs.current = {};
        hiddenScreenshotIframeRefs.current = {};
        capturedPageIdsRef.current = new Set();
        pendingHiddenPageCapturesRef.current = new Set();
        stalePageScreenshotIdsRef.current = new Set();
        setImageFailures({});
        setShowCanvasHelpTip(true);
    }, [prototypeIdentityKey, visiblePageKey]);

    const cardWidth = layout.card.viewportWidth;
    const cardHeight = layout.card.viewportHeight;
    const logicalWidth = layout.card.logicalWidth;
    const logicalHeight = layout.card.logicalHeight;
    const iframeScale = layout.card.scale;
    const displaySizeLabel = `${logicalWidth} × ${logicalHeight}`;
    const boardLabelHeight = 24 / zoom;
    const boardLabelGap = 4 / zoom;
    const gridWidth = layout.columns * cardWidth + Math.max(0, layout.columns - 1) * MULTI_PAGE_GRID_GAP;
    const gridHeight = Math.ceil(Math.max(1, cardStates.length) / layout.columns) * (cardHeight + boardLabelHeight + boardLabelGap + 4);

    const cardPages = cardStates.map((cardState) => (
        pageById.get(cardState.pageId)
        || pageOptions.allPages[0]
        || { id: pageOptions.defaultPageId, title: selectedItem.displayName }
    ));
    cardPagesRef.current = cardPages;
    const hiddenScreenshotPages = React.useMemo(() => {
        const pageMap = new Map<string, MultiPagePreviewPage>();
        for (const page of [...pageOptions.visiblePages, ...cardPages]) {
            pageMap.set(page.id, page);
        }
        return Array.from(pageMap.values());
    }, [
        cardPages,
        pageOptions.visiblePages,
    ]);

    const clearImageFailure = React.useCallback((pageId: string) => {
        setImageFailures((previous) => {
            if (!previous[pageId]) {
                return previous;
            }
            const next = { ...previous };
            delete next[pageId];
            return next;
        });
    }, []);

    const getPageScreenshotUrl = React.useCallback((page: MultiPagePreviewPage) => appendVersion(
        derivePrototypePageScreenshotUrl(previewUrl, selectedItem.name, page.id),
        screenshotVersion,
    ), [
        previewUrl,
        screenshotVersion,
        selectedItem.name,
    ]);

    const shouldWaitForPersistedPageScreenshot = React.useCallback((page: MultiPagePreviewPage) => (
        Boolean(getPageScreenshotUrl(page))
        && imageFailures[page.id] === undefined
        && !stalePageScreenshotIdsRef.current.has(page.id)
    ), [
        getPageScreenshotUrl,
        imageFailures,
    ]);

    const requestPageScreenshot = React.useCallback((slotId: string, _reason: string) => {
        const slotIndex = Number.parseInt(slotId.replace(/^card-/, ''), 10);
        const page = cardPagesRef.current[slotIndex];
        const iframe = iframeRefs.current[slotId];
        const item = selectedItemRef.current;
        void capturePageScreenshotFromIframe({
            iframe,
            selectedItem: item,
            previewUrl,
            page,
            width: logicalWidth,
            height: logicalHeight,
        }).then((success) => {
            if (success && page) {
                capturedPageIdsRef.current.add(page.id);
                clearImageFailure(page.id);
                setScreenshotVersion((version) => version + 1);
            }
        });
    }, [
        clearImageFailure,
        logicalHeight,
        logicalWidth,
        previewUrl,
    ]);

    const requestHiddenPageScreenshot = React.useCallback((page: MultiPagePreviewPage, iframe: HTMLIFrameElement | null | undefined) => {
        const item = selectedItemRef.current;
        if (
            !iframe?.contentWindow
            || capturedPageIdsRef.current.has(page.id)
            || pendingHiddenPageCapturesRef.current.has(page.id)
        ) {
            return;
        }
        pendingHiddenPageCapturesRef.current.add(page.id);

        void capturePageScreenshotFromIframe({
            iframe,
            selectedItem: item,
            previewUrl,
            page,
            width: logicalWidth,
            height: logicalHeight,
        }).then((success) => {
            pendingHiddenPageCapturesRef.current.delete(page.id);
            if (success) {
                capturedPageIdsRef.current.add(page.id);
                clearImageFailure(page.id);
                setScreenshotVersion((version) => version + 1);
            }
        });
    }, [
        clearImageFailure,
        logicalHeight,
        logicalWidth,
        previewUrl,
    ]);

    const requestMissingPageScreenshots = React.useCallback(() => {
        hiddenScreenshotPages.forEach((page) => {
            if (capturedPageIdsRef.current.has(page.id) || pendingHiddenPageCapturesRef.current.has(page.id)) {
                return;
            }
            if (shouldWaitForPersistedPageScreenshot(page)) {
                return;
            }
            const iframe = hiddenScreenshotIframeRefs.current[page.id];
            if (!iframe?.contentWindow) {
                return;
            }
            requestHiddenPageScreenshot(page, iframe);
        });
    }, [
        hiddenScreenshotPages,
        requestHiddenPageScreenshot,
        shouldWaitForPersistedPageScreenshot,
    ]);

    const persistSlotScreenshot = React.useCallback((slotId: string) => {
        requestPageScreenshot(slotId, 'exit-live');
    }, [requestPageScreenshot]);

    const activateSlot = React.useCallback((slotId: string) => {
        if (isPanningRef.current) {
            return;
        }
        const result = activateMultiPageLiveSlot(activeSlots, slotId);
        if (result.evictedSlot) {
            persistSlotScreenshot(result.evictedSlot);
        }
        activeSlotsRef.current = result.activeSlots;
        setActiveSlots(result.activeSlots);
    }, [activeSlots, persistSlotScreenshot]);

    const handlePageChange = React.useCallback((slotIndex: number, pageId: string) => {
        const slotId = `card-${slotIndex}`;
        if (activeSlots.includes(slotId)) {
            persistSlotScreenshot(slotId);
        }
        setActiveSlots((previous) => {
            const nextSlots = previous.filter((activeSlotId) => activeSlotId !== slotId);
            activeSlotsRef.current = nextSlots;
            return nextSlots;
        });
        setCardStates((previous) => previous.map((cardState, index) => (
            index === slotIndex ? { pageId } : cardState
        )));
        setImageFailures((previous) => {
            const next = { ...previous };
            delete next[pageId];
            return next;
        });
    }, [activeSlots, persistSlotScreenshot]);

    const handleLiveIframeLoad = React.useCallback((slotId: string, page: MultiPagePreviewPage) => {
        onPreviewIframeLoad?.();
        if (!capturedPageIdsRef.current.has(page.id)) {
            window.clearTimeout(loadScreenshotTimersRef.current[slotId]);
            loadScreenshotTimersRef.current[slotId] = window.setTimeout(() => {
                requestPageScreenshot(slotId, 'iframe-load');
            }, MULTI_PAGE_SCREENSHOT_LOAD_DELAY_MS);
        }
    }, [
        onPreviewIframeLoad,
        requestPageScreenshot,
    ]);

    const handleScreenshotImageLoad = React.useCallback((
        pageId: string,
        failure: 'page' | 'prototype' | undefined,
        event: React.SyntheticEvent<HTMLImageElement>,
    ) => {
        const image = event.currentTarget;
        if (image.naturalWidth === logicalWidth && image.naturalHeight === logicalHeight) {
            if (failure === undefined) {
                stalePageScreenshotIdsRef.current.delete(pageId);
                capturedPageIdsRef.current.add(pageId);
            }
            return;
        }
        if (failure === undefined) {
            stalePageScreenshotIdsRef.current.add(pageId);
            capturedPageIdsRef.current.delete(pageId);
            const page = pageById.get(pageId);
            const iframe = hiddenScreenshotIframeRefs.current[pageId];
            if (page && iframe?.contentWindow) {
                requestHiddenPageScreenshot(page, iframe);
            }
            return;
        }
        setImageFailures((previous) => ({
            ...previous,
            [pageId]: failure === 'page' ? 'prototype' : 'page',
        }));
    }, [
        logicalHeight,
        logicalWidth,
        pageById,
        requestHiddenPageScreenshot,
    ]);

    const handleFitView = React.useCallback(() => {
        const node = viewportRef.current;
        if (!node) return;
        const availableWidth = Math.max(1, node.clientWidth - 48);
        const availableHeight = Math.max(1, node.clientHeight - 48);
        const nextZoom = clampZoom(Math.min(1, availableWidth / Math.max(1, gridWidth), availableHeight / Math.max(1, gridHeight)));
        setZoom(nextZoom);
        setPan({ x: 24, y: 24 });
    }, [gridHeight, gridWidth]);

    const focusPageInViewport = React.useCallback((slotIndex: number) => {
        const node = viewportRef.current;
        if (!node) return;
        const availableWidth = Math.max(1, node.clientWidth - 48);
        const availableHeight = Math.max(1, node.clientHeight - 48);
        const nextZoom = clampZoom(Math.min(availableWidth / cardWidth, availableHeight / cardHeight));
        const column = slotIndex % layout.columns;
        const row = Math.floor(slotIndex / layout.columns);
        const nextBoardLabelHeight = 24 / nextZoom;
        const nextBoardLabelGap = 4 / nextZoom;
        const rowPitch = cardHeight + nextBoardLabelHeight + nextBoardLabelGap + 4;
        const pageX = column * (cardWidth + MULTI_PAGE_GRID_GAP);
        const pageY = row * rowPitch + nextBoardLabelHeight + nextBoardLabelGap;

        setZoom(nextZoom);
        setPan({
            x: node.clientWidth / 2 - (pageX + cardWidth / 2) * nextZoom,
            y: node.clientHeight / 2 - (pageY + cardHeight / 2) * nextZoom,
        });
    }, [
        cardHeight,
        cardWidth,
        layout.columns,
    ]);

    const dismissCanvasHelpTip = React.useCallback(() => {
        setShowCanvasHelpTip(false);
    }, []);

    React.useEffect(() => {
        if (!showCanvasHelpTip) {
            return undefined;
        }
        window.addEventListener('pointerdown', dismissCanvasHelpTip, { capture: true });
        return () => {
            window.removeEventListener('pointerdown', dismissCanvasHelpTip, { capture: true });
        };
    }, [
        dismissCanvasHelpTip,
        showCanvasHelpTip,
    ]);

    const clearPanningState = React.useCallback(() => {
        isPanningRef.current = false;
    }, []);

    const clearSpaceDragState = React.useCallback(() => {
        setIsSpacePressed(false);
        clearPanningState();
    }, [clearPanningState]);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('[data-multi-page-controls="true"]')) {
            return;
        }
        if (!isSpacePressed || event.button !== 0) {
            return;
        }
        event.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            panX: pan.x,
            panY: pan.y,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isPanningRef.current) {
            return;
        }
        const start = panStartRef.current;
        setPan(() => ({
            x: start.panX + event.clientX - start.x,
            y: start.panY + event.clientY - start.y,
        }));
    };
    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isPanningRef.current) {
            return;
        }
        clearPanningState();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Space' || event.ctrlKey || event.metaKey) {
                dismissCanvasHelpTip();
            }
            if (event.code === 'Space') {
                setIsSpacePressed(true);
            }
            if ((event.metaKey || event.ctrlKey) && event.key === '0') {
                event.preventDefault();
                setZoom(1);
                setPan({ x: 24, y: 24 });
            }
            if ((event.metaKey || event.ctrlKey) && event.key === '1') {
                event.preventDefault();
                handleFitView();
            }
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                clearSpaceDragState();
            }
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') {
                clearSpaceDragState();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('pointerup', clearPanningState);
        window.addEventListener('pointercancel', clearSpaceDragState);
        window.addEventListener('blur', clearSpaceDragState);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('pointerup', clearPanningState);
            window.removeEventListener('pointercancel', clearSpaceDragState);
            window.removeEventListener('blur', clearSpaceDragState);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [
        clearPanningState,
        clearSpaceDragState,
        dismissCanvasHelpTip,
        handleFitView,
    ]);

    React.useEffect(() => {
        const node = viewportRef.current;
        if (!node) return undefined;

        const handleWheel = (event: WheelEvent) => {
            if (!event.ctrlKey && !event.metaKey) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();

            const rect = node.getBoundingClientRect();
            const pointerX = event.clientX - rect.left;
            const pointerY = event.clientY - rect.top;
            const zoomDelta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            setZoom((currentZoom) => {
                const nextZoom = clampZoom(currentZoom + zoomDelta);
                if (nextZoom === currentZoom) {
                    return currentZoom;
                }
                setPan((currentPan) => {
                    const contentX = (pointerX - currentPan.x) / currentZoom;
                    const contentY = (pointerY - currentPan.y) / currentZoom;
                    const nextPan = {
                        x: pointerX - contentX * nextZoom,
                        y: pointerY - contentY * nextZoom,
                    };
                    return nextPan;
                });
                return nextZoom;
            });
        };

        node.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            node.removeEventListener('wheel', handleWheel);
        };
    }, []);

    React.useEffect(() => {
        setZoom(1);
        setPan({ x: 24, y: 24 });
    }, [layout.columns, previewConfig.singlePreset, previewConfig.customWidth, previewConfig.customHeight]);

    React.useEffect(() => {
        capturedPageIdsRef.current = new Set();
        stalePageScreenshotIdsRef.current = new Set();
        setImageFailures({});
    }, [logicalHeight, logicalWidth]);

    React.useEffect(() => {
        requestMissingPageScreenshots();
    }, [requestMissingPageScreenshots]);

    React.useEffect(() => {
        setCustomWidthDraft(String(logicalWidth));
        setCustomHeightDraft(String(logicalHeight));
    }, [
        logicalHeight,
        logicalWidth,
    ]);

    React.useEffect(() => () => {
        Object.values(loadScreenshotTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
        activeSlotsRef.current.forEach((slotId) => persistSlotScreenshot(slotId));
    }, [persistSlotScreenshot]);

    const handleSelectMultiPagePreset = React.useCallback((preset: PreviewSinglePreset) => {
        if (preset === 'custom') {
            handleSelectCustomPreview();
        } else {
            handleSelectPreviewSinglePreset(preset);
        }
        handleActivateMultiPagePreview();
    }, [
        handleActivateMultiPagePreview,
        handleSelectCustomPreview,
        handleSelectPreviewSinglePreset,
    ]);

    const renderScreenshotFallback = (page: MultiPagePreviewPage) => {
        const pageScreenshotUrl = getPageScreenshotUrl(page);
        const prototypeScreenshotUrl = appendVersion(derivePrototypeScreenshotUrl(previewUrl), screenshotVersion);
        const failure = imageFailures[page.id];
        const src = failure === 'page' ? prototypeScreenshotUrl : pageScreenshotUrl;

        if (src && failure !== 'prototype') {
            return (
                <img
                    key={`${src}-${logicalWidth}-${logicalHeight}`}
                    src={src}
                    alt={page.title}
                    className="h-full w-full object-cover"
                    draggable={false}
                    onLoad={(event) => handleScreenshotImageLoad(page.id, failure, event)}
                    onError={() => setImageFailures((previous) => ({
                        ...previous,
                        [page.id]: failure === 'page' ? 'prototype' : 'page',
                    }))}
                />
            );
        }

        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/30 px-4 text-center text-[12px] text-muted-foreground">
                <ImageOff className="h-7 w-7 opacity-40" />
                <div>双击激活页面</div>
            </div>
        );
    };

    return (
        <div
            ref={viewportRef}
            className={cn(
                "relative h-full w-full overflow-hidden bg-muted/20",
                isSpacePressed && "cursor-grab",
            )}
            onPointerDown={(event) => {
                dismissCanvasHelpTip();
                handlePointerDown(event);
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div
                className="absolute left-0 top-0 grid gap-4 pb-24"
                style={{
                    width: gridWidth,
                    gridTemplateColumns: `repeat(${layout.columns}, minmax(0, ${cardWidth}px))`,
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'top left',
                }}
            >
                {cardPages.map((page, index) => {
                    const slotId = `card-${index}`;
                    const active = activeSlots.includes(slotId);
                    const iframeSrc = buildPrototypePageHashUrl(previewUrl, page.id);

                    return (
                        <section
                            key={slotId}
                            className="multi-page-board-frame group min-w-0 overflow-visible"
                        >
                            <div
                                data-multi-page-controls="true"
                                className="multi-page-board-label mb-0 overflow-visible"
                                style={{
                                    height: boardLabelHeight,
                                    marginBottom: boardLabelGap,
                                }}
                            >
                                <div
                                    className="multi-page-board-label-scale flex h-6 items-center gap-2"
                                    style={{
                                        width: cardWidth * zoom,
                                        transform: `scale(${1 / zoom})`,
                                        transformOrigin: 'top left',
                                    }}
                                >
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                aria-label="切换页面"
                                                className="inline-flex max-w-full items-center gap-1 truncate text-[12px] font-medium text-[color:var(--axhub-border-strong-color)] outline-none hover:text-muted-foreground focus-visible:text-muted-foreground"
                                                onClick={(event) => event.stopPropagation()}
                                                onKeyDown={(event) => {
                                                    if (event.code === 'Space') {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        event.currentTarget.blur();
                                                    }
                                                }}
                                            >
                                                <span className="truncate">{page.title}</span>
                                                <ChevronDown className="h-3 w-3 shrink-0 text-current" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="start"
                                            className="max-h-72 w-56 overflow-y-auto text-[12px]"
                                            onClick={(event) => event.stopPropagation()}
                                            onCloseAutoFocus={(event) => {
                                                event.preventDefault();
                                                (document.activeElement as HTMLElement | null)?.blur?.();
                                            }}
                                        >
                                            {pageOptions.allPages.map((page) => (
                                                <DropdownMenuItem
                                                    key={page.id}
                                                    className={cn(
                                                        "h-7 text-[12px]",
                                                        page.id === cardPages[index]?.id && "font-medium",
                                                    )}
                                                    onSelect={() => handlePageChange(index, page.id)}
                                                >
                                                    {page.title}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <button
                                        type="button"
                                        aria-label="聚焦页面"
                                        title="聚焦页面"
                                        className="multi-page-board-focus-button ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[color:var(--axhub-border-strong-color)] opacity-70 outline-none transition-colors hover:bg-muted/40 hover:text-muted-foreground focus-visible:opacity-100"
                                        onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            focusPageInViewport(index);
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.code === 'Space') {
                                                event.preventDefault();
                                                event.stopPropagation();
                                            }
                                        }}
                                    >
                                        <Maximize2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                            <div
                                className={cn(
                                    "relative overflow-hidden rounded-sm border border-border bg-background",
                                    active && "border-primary ring-1 ring-primary/50",
                                )}
                                style={{
                                    width: cardWidth,
                                    height: cardHeight,
                                }}
                            >
                                {active ? (
                                    <iframe
                                        ref={(iframe) => {
                                            iframeRefs.current[slotId] = iframe;
                                            if (activeSlots[0] === slotId) {
                                                previewIframeRef.current = iframe;
                                            }
                                        }}
                                        key={`${iframeKey}-${slotId}-${page.id}`}
                                        src={iframeSrc}
                                        title={`${selectedItem.displayName} - ${page.title}`}
                                        onLoad={() => handleLiveIframeLoad(slotId, page)}
                                        className="block origin-top-left border-none"
                                        style={{
                                            width: logicalWidth,
                                            height: layout.card.iframeHeight,
                                            transform: `scale(${iframeScale})`,
                                            transformOrigin: 'top left',
                                        }}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        className="h-full w-full text-left"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            activateSlot(slotId);
                                        }}
                                    >
                                        {renderScreenshotFallback(page)}
                                    </button>
                                )}
                            </div>
                        </section>
                    );
                })}
            </div>
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    left: -10000,
                    top: 0,
                    width: logicalWidth,
                    height: logicalHeight,
                    overflow: 'hidden',
                    pointerEvents: 'none',
                }}
            >
                {hiddenScreenshotPages.map((page) => (
                    <iframe
                        key={`hidden-screenshot-${iframeKey}-${page.id}`}
                        ref={(iframe) => {
                            hiddenScreenshotIframeRefs.current[page.id] = iframe;
                        }}
                        src={buildPrototypePageHashUrl(previewUrl, page.id)}
                        title={`${selectedItem.displayName} - ${page.title} screenshot`}
                        onLoad={() => {
                            requestMissingPageScreenshots();
                        }}
                        className="block border-none"
                        style={{
                            width: logicalWidth,
                            height: logicalHeight,
                        }}
                    />
                ))}
            </div>
            {showCanvasHelpTip ? (
                <div className="multi-page-canvas-help-tip pointer-events-none absolute bottom-[62px] left-1/2 max-w-[calc(100%-32px)] -translate-x-1/2 rounded-md border bg-background/95 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
                    Ctrl/⌘ + 滚轮缩放 · 空格拖动画布
                    <span className="multi-page-canvas-help-tip-arrow absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r bg-background" />
                </div>
            ) : null}
            <div className="multi-page-zoom-toolbar absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-md border bg-background/95 p-1 shadow-sm" data-multi-page-controls="true">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    title="缩小"
                    onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
                >
                    <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="multi-page-zoom-trigger h-7 min-w-[132px] gap-2 px-2 text-[12px]"
                            title="多页面设置"
                        >
                            <span>{Math.round(zoom * 100)}%</span>
                            <span className="multi-page-toolbar-size text-[11px] text-muted-foreground">{displaySizeLabel}</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="center"
                        side="top"
                        className="multi-page-zoom-popover w-64 p-2"
                    >
                        <div className="mb-2 flex items-center gap-2 px-1 text-[12px] font-medium text-foreground">
                            <Settings2 className="h-3.5 w-3.5" />
                            多页面设置
                        </div>
                        <div className="grid gap-2">
                            <div className="multi-page-size-settings grid gap-2 rounded-md bg-muted/30 p-2">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-[11px] text-muted-foreground">尺寸</span>
                                    <span className="text-[11px] text-foreground">{displaySizeLabel}</span>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                    {([
                                        ['desktop', '桌面'],
                                        ['tablet', '平板'],
                                        ['mobile', '手机'],
                                        ['custom', '自定'],
                                    ] as const).map(([preset, label]) => (
                                        <Button
                                            key={preset}
                                            type="button"
                                            variant="ghost"
                                            size="xs"
                                            className={cn(
                                                "h-7 px-1 text-[11px]",
                                                previewConfig.singlePreset === preset && "bg-background text-foreground shadow-sm",
                                            )}
                                            onClick={() => handleSelectMultiPagePreset(preset)}
                                        >
                                            {label}
                                        </Button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Input
                                        value={customWidthDraft}
                                        inputMode="numeric"
                                        aria-label="多页面宽度"
                                        onFocus={() => handleSelectMultiPagePreset('custom')}
                                        onChange={(event) => setCustomWidthDraft(event.target.value)}
                                        onBlur={() => commitPositiveDraft(customWidthDraft, handleChangeCustomPreviewWidth)}
                                        onKeyDown={(event) => {
                                            event.stopPropagation();
                                            if (event.key === 'Enter') {
                                                commitPositiveDraft(customWidthDraft, handleChangeCustomPreviewWidth);
                                            }
                                        }}
                                        className="h-7 px-2 text-[11px]"
                                    />
                                    <span className="text-[11px] text-muted-foreground">×</span>
                                    <Input
                                        value={customHeightDraft}
                                        inputMode="numeric"
                                        aria-label="多页面高度"
                                        onFocus={() => handleSelectMultiPagePreset('custom')}
                                        onChange={(event) => setCustomHeightDraft(event.target.value)}
                                        onBlur={() => commitPositiveDraft(customHeightDraft, handleChangeCustomPreviewHeight)}
                                        onKeyDown={(event) => {
                                            event.stopPropagation();
                                            if (event.key === 'Enter') {
                                                commitPositiveDraft(customHeightDraft, handleChangeCustomPreviewHeight);
                                            }
                                        }}
                                        className="h-7 px-2 text-[11px]"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[11px] text-muted-foreground">列数</span>
                                <div className="multi-page-column-segment inline-flex rounded-md bg-muted p-0.5">
                                    {[1, 2, 3, 4].map((value) => (
                                        <Button
                                            key={value}
                                            type="button"
                                            variant="ghost"
                                            size="xs"
                                            className={cn(
                                                "h-7 min-w-8 px-2 text-[12px] font-normal text-muted-foreground",
                                                previewConfig.multiPageColumns === value && "bg-background text-foreground shadow-sm",
                                            )}
                                            onClick={() => handleChangeMultiPageColumns(value as MultiPageColumns)}
                                        >
                                            {value}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            <div className="multi-page-canvas-help-card grid gap-1 rounded-md bg-muted/30 p-2 text-[11px] leading-4 text-muted-foreground">
                                <div>Ctrl/⌘ + 滚轮缩放</div>
                                <div>空格 + 拖拽平移画布</div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => {
                                        setZoom(1);
                                        setPan({ x: 24, y: 24 });
                                    }}
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    重置
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={handleFitView}
                                >
                                    <Maximize2 className="h-3.5 w-3.5" />
                                    适合
                                </Button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    title="放大"
                    onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
                >
                    <ZoomIn className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}
