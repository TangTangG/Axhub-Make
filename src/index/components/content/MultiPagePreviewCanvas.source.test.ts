import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readMultiPagePreviewCanvasSource() {
  return readFileSync(resolve(__dirname, './MultiPagePreviewCanvas.tsx'), 'utf8');
}

function getSourceSegment(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('MultiPagePreviewCanvas source', () => {
  it('allows live and hidden preview iframes to write clipboard text', () => {
    const source = readMultiPagePreviewCanvasSource();
    const liveIframeSource = getSourceSegment(
      source,
      '{active ? (',
      ') : (',
    );
    const hiddenIframeSource = getSourceSegment(
      source,
      '{hiddenScreenshotPages.map((page) => (',
      '<div className="multi-page-zoom-toolbar',
    );

    expect(liveIframeSource).toContain('allow="clipboard-write"');
    expect(hiddenIframeSource).toContain('allow="clipboard-write"');
  });

  it('caps live iframes, renders all pages in the card selector, and renders page screenshots', () => {
    const source = readMultiPagePreviewCanvasSource();

    expect(source).toContain('activateMultiPageLiveSlot(activeSlots, slotId)');
    expect(source).toContain('resolveMultiPageCardPages({ item: selectedItem })');
    expect(source).toContain('cardState.pageId');
    expect(source).toContain('pageOptions.allPages.map((page)');
    expect(source).toContain('derivePrototypePageScreenshotUrl(screenshotPreviewUrl, selectedItem.name, page.id)');
    expect(source).not.toContain('derivePrototypeScreenshotUrl(previewUrl)');
    expect(source).toContain('persistPrototypeScreenshot({');
    expect(source).toContain('pageId: page.id');
    expect(source).toContain("import { captureSameOriginIframeScreenshot } from './canvas-embeds/parentScreenshotCapture';");
    expect(source).toContain('async function capturePageScreenshotFromIframe({');
    expect(source).toContain('const screenshot = await captureSameOriginIframeScreenshot({');
    expect(source).toContain('dataUrl: screenshot.dataUrl');
    expect(source).toContain('width: screenshot.width');
    expect(source).toContain('height: screenshot.height');
    expect(source).not.toContain("type: 'axhub.quickEdit.export.captureScreenshot'");
    expect(source).not.toContain("type: 'CAPTURE_SCREENSHOT'");
    expect(source).not.toContain("event.data.type === 'SCREENSHOT_FAILED'");
    expect(source).not.toContain('SCREENSHOT_RESULT_TIMEOUT_MS');
    expect(source).toContain('requestPageScreenshot(slotId, \'iframe-load\')');
    expect(source).toContain('hiddenScreenshotIframeRefs');
    expect(source).toContain('requestMissingPageScreenshots');
    expect(source).toContain('requestHiddenPageScreenshot');
    expect(source).toContain('hiddenScreenshotPages');
    expect(source).toContain('pendingHiddenPageCapturesRef');
    expect(source).toContain('const iframeSrc = buildPrototypePageHashUrl(previewUrl, page.id);');
    expect(source).toContain('src={iframeSrc}');
    expect(source).toContain('capturedPageIdsRef');
    expect(source).toContain('clearImageFailure(page.id)');
    expect(source).toContain('MULTI_PAGE_SCREENSHOT_LOAD_DELAY_MS');
    expect(source).toContain('naturalWidth');
    expect(source).toContain('naturalHeight');
    expect(source).toContain('handleScreenshotImageLoad(page.id, failure, event)');
    expect(source).toContain('`${src}-${logicalWidth}-${logicalHeight}`');
    expect(source).toContain('[logicalHeight, logicalWidth]');
    expect(source).toContain('双击激活页面');
    expect(source).toContain('activeSlots.includes(slotId)');
    expect(source).toContain('const visiblePageKey = React.useMemo');
    expect(source).toContain('const prototypeIdentityKey = selectedItem.name;');
    expect(source).toContain('[prototypeIdentityKey, visiblePageKey]');
  });

  it('does not show the prototype-level latest screenshot as a multi-page card fallback', () => {
    const source = readMultiPagePreviewCanvasSource();
    const fallbackSource = getSourceSegment(
      source,
      'const renderScreenshotFallback = (page: MultiPagePreviewPage) => {',
      'return (',
    );

    expect(fallbackSource).toContain('const pageScreenshotUrl = getPageScreenshotUrl(page);');
    expect(fallbackSource).not.toContain('prototypeScreenshotUrl');
    expect(fallbackSource).not.toContain("failure === 'page' ? prototypeScreenshotUrl : pageScreenshotUrl");
  });

  it('creates hidden same-origin iframes to capture missing multi-page screenshots without user activation', () => {
    const source = readMultiPagePreviewCanvasSource();
    const hiddenIframeSource = getSourceSegment(
      source,
      '{hiddenScreenshotPages.map((page) => (',
      '<div className="multi-page-zoom-toolbar',
    );

    expect(source).toContain('buildProjectPrototypeScreenshotIframeUrl(selectedItem)');
    expect(source).toContain('derivePrototypePageScreenshotUrl(screenshotPreviewUrl, selectedItem.name, page.id)');
    expect(source).toContain('previewUrl: screenshotPreviewUrl');
    expect(source).toContain('const hiddenScreenshotPages = React.useMemo');
    expect(source).toContain('for (const page of [...pageOptions.visiblePages, ...cardPages])');
    expect(source).toContain('return Array.from(pageMap.values());');
    expect(source).toContain('hiddenScreenshotIframeRefs.current[page.id] = iframe;');
    expect(source).toContain('requestMissingPageScreenshots();');
    expect(source).toContain('pendingHiddenPageCapturesRef.current.add(page.id);');
    expect(source).toContain('requestHiddenPageScreenshot(page, iframe);');
    expect(source).toContain('capturedPageIdsRef.current.add(page.id);');
    expect(source).toContain('setScreenshotVersion((version) => version + 1);');
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain('pointerEvents: \'none\'');
    expect(source).toContain('left: -10000');
    expect(source).toContain('hiddenScreenshotPages.map((page)');
    expect(hiddenIframeSource).toContain('src={buildPrototypePageHashUrl(screenshotPreviewUrl, page.id)}');
  });

  it('waits for persisted page screenshots before hidden recapture so entering multi-page does not always screenshot', () => {
    const source = readMultiPagePreviewCanvasSource();
    const requestMissingSource = getSourceSegment(
      source,
      'const requestMissingPageScreenshots = React.useCallback(() => {',
      'const persistSlotScreenshot = React.useCallback',
    );
    const hiddenIframeSource = getSourceSegment(
      source,
      '{hiddenScreenshotPages.map((page) => (',
      '<div className="multi-page-zoom-toolbar',
    );

    expect(source).toContain('const getPageScreenshotUrl = React.useCallback');
    expect(source).toContain('const shouldWaitForPersistedPageScreenshot = React.useCallback');
    expect(source).toContain('imageFailures[page.id] === undefined');
    expect(requestMissingSource).toContain('shouldWaitForPersistedPageScreenshot(page)');
    expect(requestMissingSource).toContain('requestHiddenPageScreenshot(page, iframe, { force: forceRefresh });');
    expect(hiddenIframeSource).toContain('requestMissingPageScreenshots();');
    expect(hiddenIframeSource).not.toContain('requestHiddenPageScreenshot(page, iframe);');
  });

  it('forces a hidden same-origin refresh when the user activates a live page card', () => {
    const source = readMultiPagePreviewCanvasSource();
    const requestMissingSource = getSourceSegment(
      source,
      'const requestMissingPageScreenshots = React.useCallback(() => {',
      'const persistSlotScreenshot = React.useCallback',
    );
    const activateSlotSource = getSourceSegment(
      source,
      'const activateSlot = React.useCallback((slotId: string) => {',
      'const handlePageChange = React.useCallback',
    );

    expect(source).toContain('const forceHiddenPageScreenshotIdsRef = React.useRef<Set<string>>(new Set());');
    expect(source).toContain('forceHiddenPageScreenshotIdsRef.current = new Set();');
    expect(requestMissingSource).toContain('const forceRefresh = forceHiddenPageScreenshotIdsRef.current.has(page.id);');
    expect(requestMissingSource).toContain('if ((!forceRefresh && capturedPageIdsRef.current.has(page.id)) || pendingHiddenPageCapturesRef.current.has(page.id))');
    expect(requestMissingSource).toContain('if (!forceRefresh && shouldWaitForPersistedPageScreenshot(page))');
    expect(activateSlotSource).toContain('const page = cardPagesRef.current[slotIndex];');
    expect(activateSlotSource).toContain('forceHiddenPageScreenshotIdsRef.current.add(page.id);');
    expect(activateSlotSource).toContain('capturedPageIdsRef.current.delete(page.id);');
    expect(activateSlotSource).toContain('requestHiddenPageScreenshot(page, iframe, { force: true });');
  });

  it('keeps stale persisted screenshots visible while scheduling a refresh instead of blanking the card', () => {
    const source = readMultiPagePreviewCanvasSource();
    const imageLoadSource = getSourceSegment(
      source,
      'const handleScreenshotImageLoad = React.useCallback((',
      'const handleFitView = React.useCallback',
    );

    expect(source).toContain('const stalePageScreenshotIdsRef = React.useRef<Set<string>>(new Set());');
    expect(imageLoadSource).toContain('capturedPageIdsRef.current.add(pageId);');
    expect(imageLoadSource).toContain('if (failure === undefined) {');
    expect(imageLoadSource).toContain('stalePageScreenshotIdsRef.current.add(pageId);');
    expect(imageLoadSource).toContain('requestHiddenPageScreenshot(page, iframe);');
    expect(imageLoadSource).toContain('return;');
    expect(imageLoadSource).not.toContain("failure === 'page' ? 'prototype' : 'page'");
    expect(source).toContain("const src = failure === undefined ? pageScreenshotUrl : undefined;");
    expect(source).toContain("[page.id]: 'page'");
  });

  it('captures multi-page screenshots from the parent page without iframe postMessage protocols', () => {
    const source = readMultiPagePreviewCanvasSource();
    const captureSource = getSourceSegment(
      source,
      'function capturePageScreenshotFromIframe({',
      'export default function MultiPagePreviewCanvas',
    );

    expect(captureSource).toContain('await captureSameOriginIframeScreenshot({');
    expect(captureSource).toContain('await persistPrototypeScreenshot({');
    expect(captureSource.indexOf('await captureSameOriginIframeScreenshot({')).toBeLessThan(
      captureSource.indexOf('await persistPrototypeScreenshot({'),
    );
    expect(captureSource).toContain('return true;');
    expect(captureSource).toContain('catch {');
    expect(captureSource).toContain('return false;');
    expect(captureSource).not.toContain('postMessage');
    expect(captureSource).not.toContain('addEventListener');
    expect(captureSource).not.toContain('removeEventListener');
  });

  it('keeps the canvas controls minimal and moves column settings out of the toolbar', () => {
    const source = readMultiPagePreviewCanvasSource();
    const toolbarSource = getSourceSegment(
      source,
      'multi-page-zoom-toolbar',
      'multi-page-zoom-popover',
    );

    expect(source).toContain('ZoomOut');
    expect(source).toContain('ZoomIn');
    expect(source).toContain('const ZOOM_MAX = 4;');
    expect(source).toContain('{Math.round(zoom * 100)}%');
    expect(toolbarSource).toContain('multi-page-zoom-trigger');
    expect(toolbarSource).toContain('multi-page-toolbar-size');
    expect(toolbarSource).toContain('{displaySizeLabel}');
    expect(toolbarSource).not.toContain('</Button>\n                    <span className="multi-page-toolbar-size');
    expect(source).toContain('多页面设置');
    expect(source).toContain('multi-page-zoom-popover');
    expect(source).toContain('multi-page-column-segment');
    expect(source).toContain('handleChangeMultiPageColumns(value as MultiPageColumns)');
    expect(source).toContain('multi-page-size-settings');
    expect(source).toContain("['desktop', '桌面']");
    expect(source).toContain("['tablet', '平板']");
    expect(source).toContain("['mobile', '手机']");
    expect(source).toContain("['custom', '自定']");
    expect(source).toContain('onClick={() => handleSelectMultiPagePreset(preset)}');
    expect(source).toContain('customWidthDraft');
    expect(source).toContain('customHeightDraft');
    expect(source).toContain('setCustomWidthDraft(String(logicalWidth));');
    expect(source).toContain('setCustomHeightDraft(String(logicalHeight));');
    expect(source).toContain('[logicalHeight, logicalWidth]');
    expect(source).toContain('handleChangeCustomPreviewWidth');
    expect(source).toContain('handleChangeCustomPreviewHeight');
    expect(source).not.toContain("handleChangePreviewScaleMode(value as PreviewScaleMode)");
    expect(source).not.toContain('缩放比例');
    expect(source).not.toContain('aria-label="多页面缩放比例"');
    expect(toolbarSource).not.toContain('[0.5, 0.75, 1].map((scaleValue)');
    expect(toolbarSource).not.toContain('live {activeSlots.length}/{MULTI_PAGE_ACTIVE_LIMIT}');
    expect(toolbarSource).not.toContain('多页面列数');
    expect(source).not.toContain("@/components/ui/select");
    expect(source).not.toContain('<Select');
    expect(source).not.toContain('<SelectTrigger');
    expect(source).not.toContain('<SelectContent');
    expect(source).not.toContain('<SelectItem');
    expect(source).not.toContain('multi-page-canvas-size pointer-events-none absolute');
    expect(source).toContain("node.addEventListener('wheel', handleWheel, { passive: false });");
    expect(source).toContain("node.removeEventListener('wheel', handleWheel);");
    expect(source).toContain('if (!event.ctrlKey && !event.metaKey) {');
    expect(source).toContain('event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP');
    expect(source).toContain('const nextPan = {');
    expect(source).toContain("event.code === 'Space'");
    expect(source).toContain('isSpacePressed');
    expect(source).toContain('isPanningRef');
    expect(source).toContain('setPan(() => ({');
    expect(source).toContain('multi-page-canvas-help-card');
    expect(source).toContain('Ctrl/⌘ + 滚轮缩放');
    expect(source).toContain('空格 + 拖拽平移画布');
  });

  it('shows an initial canvas help tip and hides it after canvas input intent', () => {
    const source = readMultiPagePreviewCanvasSource();

    expect(source).toContain('const [showCanvasHelpTip, setShowCanvasHelpTip] = React.useState(true);');
    expect(source).toContain('setShowCanvasHelpTip(true);');
    expect(source).toContain('const dismissCanvasHelpTip = React.useCallback(() => {');
    expect(source).toContain('setShowCanvasHelpTip(false);');
    expect(source).toContain('onPointerDown={(event) => {');
    expect(source).toContain('dismissCanvasHelpTip();');
    expect(source).toContain("if (event.code === 'Space' || event.ctrlKey || event.metaKey) {");
    expect(source).toContain('multi-page-canvas-help-tip');
    expect(source).toContain('bottom-[62px]');
    expect(source).toContain('multi-page-canvas-help-tip-arrow');
    expect(source).toContain('Ctrl/⌘ + 滚轮缩放');
    expect(source).toContain('空格拖动画布');
  });

  it('clears stuck space-drag state globally and keeps controls clickable', () => {
    const source = readMultiPagePreviewCanvasSource();
    const pointerSource = getSourceSegment(
      source,
      'const clearPanningState = React.useCallback(() => {',
      'const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {',
    );
    const keyboardSource = getSourceSegment(
      source,
      'React.useEffect(() => {\n        const handleKeyDown = (event: KeyboardEvent) => {',
      'React.useEffect(() => {\n        const node = viewportRef.current;',
    );

    expect(pointerSource).toContain('const clearSpaceDragState = React.useCallback(() => {');
    expect(pointerSource).toContain('setIsSpacePressed(false);');
    expect(pointerSource).toContain('clearPanningState();');
    expect(pointerSource).toContain("target?.closest('[data-multi-page-controls=\"true\"]')");
    expect(keyboardSource).toContain("window.addEventListener('pointerup', clearPanningState);");
    expect(keyboardSource).toContain("window.addEventListener('pointercancel', clearSpaceDragState);");
    expect(keyboardSource).toContain("window.addEventListener('blur', clearSpaceDragState);");
    expect(keyboardSource).toContain("document.addEventListener('visibilitychange', handleVisibilityChange);");
    expect(keyboardSource).toContain('clearSpaceDragState();');
    expect(keyboardSource).toContain("window.removeEventListener('pointerup', clearPanningState);");
    expect(source).toContain('data-multi-page-controls="true"');
    expect(source).toContain('hasPointerCapture(event.pointerId)');
  });

  it('uses a lightweight design-board frame with a title dropdown instead of card chrome', () => {
    const source = readMultiPagePreviewCanvasSource();
    const labelSource = getSourceSegment(
      source,
      'multi-page-board-label',
      '</DropdownMenu>',
    );

    expect(source).toContain('multi-page-board-frame');
    expect(source).toContain('multi-page-board-label');
    expect(source).toContain('aria-label="切换页面"');
    expect(labelSource).toContain('<DropdownMenu>');
    expect(labelSource).toContain('<DropdownMenuTrigger asChild>');
    expect(labelSource).toContain('<button');
    expect(labelSource).toContain('{page.title}');
    expect(labelSource).toContain('<ChevronDown');
    expect(labelSource).toContain('text-[color:var(--axhub-border-strong-color)]');
    expect(labelSource).toContain('hover:text-muted-foreground');
    expect(labelSource).toContain('text-current');
    expect(labelSource).toContain('onKeyDown={(event) => {');
    expect(labelSource).toContain("event.code === 'Space'");
    expect(labelSource).toContain('event.preventDefault();');
    expect(labelSource).toContain('event.currentTarget.blur();');
    expect(labelSource).toContain('onCloseAutoFocus={(event) => {');
    expect(labelSource).toContain('(document.activeElement as HTMLElement | null)?.blur?.();');
    expect(labelSource).toContain('multi-page-board-label-scale');
    expect(labelSource).toContain('width: cardWidth * zoom');
    expect(labelSource).toContain('transform: `scale(${1 / zoom})`');
    expect(labelSource).toContain("transformOrigin: 'top left'");
    expect(source).toContain('const boardLabelHeight = 24 / zoom;');
    expect(source).toContain('const boardLabelGap = 4 / zoom;');
    expect(labelSource).not.toContain('<Select');
    expect(labelSource).not.toContain('<SelectTrigger');
    expect(labelSource).not.toContain('<SelectValue');
    expect(labelSource).not.toContain('border-transparent');
    expect(labelSource).not.toContain('bg-');
    expect(labelSource).not.toContain('shadow');
    expect(source).not.toContain('border-b bg-background px-2');
    expect(source).not.toContain("active ? 'Live' : '截图'");
    expect(source).not.toContain('CheckCircle2');
    expect(source).not.toContain('<Play');
  });

  it('only activates live preview from the page canvas area, not the board title area', () => {
    const source = readMultiPagePreviewCanvasSource();
    const boardFrameSource = getSourceSegment(
      source,
      '<section',
      '<div className="multi-page-zoom-toolbar',
    );

    expect(boardFrameSource).not.toContain('onClick={() => activateSlot(slotId)}');
    expect(boardFrameSource).not.toContain('onDoubleClick={() => activateSlot(slotId)}');
    expect(boardFrameSource).toContain('className="h-full w-full text-left"');
    expect(boardFrameSource).toContain('activateSlot(slotId);');
  });

  it('adds a lightweight title-bar focus action that only adjusts zoom and pan', () => {
    const source = readMultiPagePreviewCanvasSource();
    const focusSource = getSourceSegment(
      source,
      'const focusPageInViewport = React.useCallback((slotIndex: number) => {',
      'const dismissCanvasHelpTip = React.useCallback',
    );
    const labelSource = getSourceSegment(
      source,
      'multi-page-board-label',
      '<div\n                                className={cn(',
    );

    expect(focusSource).toContain('const nextZoom = clampZoom(Math.min(availableWidth / cardWidth, availableHeight / cardHeight));');
    expect(focusSource).toContain('const nextBoardLabelHeight = 24 / nextZoom;');
    expect(focusSource).toContain('const pageX = column * (cardWidth + MULTI_PAGE_GRID_GAP);');
    expect(focusSource).toContain('const pageY = row * rowPitch + nextBoardLabelHeight + nextBoardLabelGap;');
    expect(focusSource).toContain('setZoom(nextZoom);');
    expect(focusSource).toContain('setPan({');
    expect(focusSource).toContain('x: node.clientWidth / 2 - (pageX + cardWidth / 2) * nextZoom,');
    expect(focusSource).toContain('y: node.clientHeight / 2 - (pageY + cardHeight / 2) * nextZoom,');
    expect(labelSource).toContain('multi-page-board-focus-button');
    expect(labelSource).toContain('aria-label="聚焦页面"');
    expect(labelSource).toContain('title="聚焦页面"');
    expect(labelSource).toContain('focusPageInViewport(index);');
    expect(labelSource).toContain('<Maximize2 className="h-3 w-3" />');
    expect(labelSource).not.toContain('activateSlot(slotId)');
  });
});
