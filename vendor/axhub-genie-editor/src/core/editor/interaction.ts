import type { WebEditorElementKey, WebEditorRevertElementResponse, ElementLocator } from '../../web-editor-types';
import { createElementLocator, locateElement } from '../locator';
import { aggregateTransactionsByElement } from '../transaction-aggregator';
import type { EventModifiers } from '../event-controller';
import type { TrackedRects } from '../position-tracker';
import type { ViewportRect } from '../../overlay/canvas-overlay';
import { resolveMarkerAnchorRect } from './marker-anchor';
import type {
  EditorChangesService,
  EditorGenieBridgeService,
  EditorInteractionService,
  EditorPersistenceService,
  EditorTextSessionService,
} from './contracts';
import type { EditorRuntimeState } from './state';
import { DEFAULT_MODIFIERS, filterUnprocessedTransactions } from './state';
import type { AnnotationEntryMode } from '../../ui/selection-ui-mode';
import type { TextAnnotation } from '../../selection/text-annotation-manager';
import { createMarkerAnchor } from './marker-anchor';
import { formatTextAnnotationLabel } from './text-annotation-target';

export function createInteractionService(options: {
  state: EditorRuntimeState;
  changes: EditorChangesService;
  persistence: EditorPersistenceService;
  textSession: EditorTextSessionService;
  genieBridge: EditorGenieBridgeService;
  logPrefix: string;
  onStatusChange?: () => void;
}): EditorInteractionService {
  const { state, genieBridge } = options;

  function syncShadowHostMount(anchorElement: Element | null): void {
    state.shadowHost?.setMountContainer?.(anchorElement);
  }

  function resolveSelectionAnchorViewportRect(): ViewportRect | null {
    const anchor = state.selectionAnchor;
    if (!anchor) return null;

    const selected = state.selectedElement;
    const textAnnotationSource = state.activeTextAnnotation?.sourceElement;
    const liveAnchorElement = (
      selected && selected.isConnected
        ? selected
        : textAnnotationSource && textAnnotationSource.isConnected
          ? textAnnotationSource
          : null
    );
    const liveRect =
      liveAnchorElement instanceof HTMLElement
        ? liveAnchorElement.getBoundingClientRect()
        : null;
    return resolveMarkerAnchorRect(anchor, {
      liveRect,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      viewportWidth: window.innerWidth,
    });
  }

  function getSelectionAnchorRect(): ViewportRect | null {
    return resolveSelectionAnchorViewportRect();
  }

  function handleHover(element: Element | null): void {
    if (element && genieBridge.isElementInteractionLocked(element)) {
      element = null;
    }
    const prevElement = state.hoveredElement;
    state.hoveredElement = element;

    const shouldAnimate = prevElement !== null && element !== null && prevElement !== element;
    state.pendingHoverTransition = shouldAnimate;

    state.positionTracker?.setHoverElement(element);
    state.positionTracker?.forceUpdate();
  }

  function handleSelect(
    element: Element,
    modifiers: EventModifiers,
    selectionAnchor?: { clientX: number; clientY: number },
  ): void {
    if (genieBridge.isElementInteractionLocked(element)) {
      return;
    }
    options.changes.rememberSelectionAnchor(element, selectionAnchor);

    state.selectedElement = element;
    state.hoveredElement = null;

    state.positionTracker?.setHoverElement(null);
    state.positionTracker?.setSelectionElement(element);
    state.positionTracker?.forceUpdate();

    syncShadowHostMount(element);
    state.breadcrumbs?.setTarget(element);
    state.propertyPanel?.setTarget(element);
    state.handlesController?.setTarget(element);
    state.parentSelectController?.setTarget(element);
    options.onStatusChange?.();

    const modInfo = modifiers.alt ? ' (Alt: drill-up)' : '';
    console.log(`${options.logPrefix} Selected${modInfo}:`, element.tagName, element);
  }

  function handleDeselect(): void {
    if (!state.selectedElement && state.activeTextAnnotation) {
      options.changes.clearPendingSelectionAnchor();
      state.selectionAnchor = null;
      state.activeTextAnnotation = null;
      state.canvasOverlay?.setTextHighlightRects(null);
      state.textAnnotationManager?.clearActiveHighlight();
      if (state.textAnnotationTargetElement) {
        delete state.textAnnotationTargetElement.dataset.weTextAnnotationId;
      }
      state.positionTracker?.setSelectionElement(null);
      state.positionTracker?.forceUpdate();
      state.breadcrumbs?.setTarget(null);
      state.breadcrumbs?.setAnchorRect(null);
      state.propertyPanel?.setTarget(null);
      state.propertyPanel?.refresh();
      state.handlesController?.setTarget(null);
      state.parentSelectController?.setTarget(null);
      options.onStatusChange?.();

      console.log(`${options.logPrefix} Deselected`);
      return;
    }

    state.selectedElement = null;
    options.changes.clearPendingSelectionAnchor();

    state.positionTracker?.setSelectionElement(null);
    state.positionTracker?.forceUpdate();

    syncShadowHostMount(null);
    state.breadcrumbs?.setTarget(null);
    state.propertyPanel?.setTarget(null);
    state.handlesController?.setTarget(null);
    state.parentSelectController?.setTarget(null);
    options.onStatusChange?.();

    console.log(`${options.logPrefix} Deselected`);
  }

  function handlePositionUpdate(rects: TrackedRects): void {
    const selectionAnchorRect = getSelectionAnchorRect();
    const textAnnotationActive = Boolean(state.activeTextAnnotation);
    state.breadcrumbs?.setAnchorRect(
      textAnnotationActive ? selectionAnchorRect : (rects.selection ?? selectionAnchorRect),
    );

    const animateHover = state.pendingHoverTransition;
    state.pendingHoverTransition = false;

    if (!state.canvasOverlay) return;

    const suppressHover =
      !!state.selectedElement && state.hoveredElement === state.selectedElement;
    const hideChrome = !state.selectionChromeVisible;
    const hoverRect = hideChrome ? null : suppressHover ? null : rects.hover;
    const selectionRect = hideChrome || textAnnotationActive ? null : rects.selection;
    const selectionLocked = genieBridge.isElementInteractionLocked(state.selectedElement);
    const inlineTextEditing = Boolean(state.inlineTextEditingActive);
    const selectionEffect =
      !hideChrome && !!selectionRect
        ? inlineTextEditing
          ? 'inline-editing'
          : selectionLocked
            ? 'ai-editing'
            : 'default'
        : 'default';
    const handlesRect =
      hideChrome || state.annotationEntryMode === 'bubble-card' || selectionLocked || inlineTextEditing
        ? null
        : rects.selection;
    state.canvasOverlay.setHoverRect(hoverRect, { animate: animateHover });
    state.canvasOverlay.setSelectionEffect(selectionEffect);
    state.canvasOverlay.setSelectionRect(selectionRect);
    state.canvasOverlay.setEditingRects(null);
    state.handlesController?.setSelectionRect(handlesRect);
    state.parentSelectController?.setSelectionRect(selectionRect);
    options.changes.renderChangeMarkers();
    state.canvasOverlay.render();
  }

  function handleTransactionChange(event: import('../transaction-manager').TransactionChangeEvent): void {
    const { action, undoCount, redoCount } = event;
    console.log(
      `${options.logPrefix} Transaction: ${action} (undo: ${undoCount}, redo: ${redoCount})`,
    );

    options.changes.syncEditMetaWithTransactions();
    state.propertyPanel?.setHistory(undoCount, redoCount);
    state.breadcrumbs?.refresh();

    if (action === 'undo' || action === 'redo') {
      state.propertyPanel?.refresh();
    }

    state.positionTracker?.forceUpdate(true);
    options.persistence.scheduleWrite();
    options.onStatusChange?.();
  }

  function enterAnnotationInput(mode: AnnotationEntryMode = 'bubble-card'): void {
    state.annotationEntryMode = mode;
    state.propertyPanel?.enterAnnotationInput?.(mode);
  }

  function enterAnnotationFromTrigger(
    selectionAnchor?: { clientX: number; clientY: number },
  ): boolean {
    const selected = state.selectedElement;
    let target = selected && selected.isConnected ? selected : null;

    if (!target && selectionAnchor) {
      target =
        state.selectionEngine?.findBestTarget(
          selectionAnchor.clientX,
          selectionAnchor.clientY,
          DEFAULT_MODIFIERS,
        ) ?? null;
    }

    target = genieBridge.resolveSelectableElement(target);

    if (!target || !target.isConnected) return false;

    if (state.selectedElement !== target) {
      handleSelect(target, DEFAULT_MODIFIERS, selectionAnchor);
    }

    enterAnnotationInput('bubble-card');
    return true;
  }

  function clearSelection(): void {
    const hadElementSelection = Boolean(state.selectedElement);
    const hadTextAnnotationSelection = Boolean(state.activeTextAnnotation);
    if (!hadElementSelection && !hadTextAnnotationSelection && !state.selectionAnchor) return;

    const clearIdleTextAnnotationMeta = () => {
      if (
        typeof options.changes.getMetaForElement !== 'function' ||
        typeof options.changes.normalizeNote !== 'function' ||
        typeof options.changes.setNoteForElement !== 'function'
      ) {
        return;
      }
      const textAnnotationTarget = state.textAnnotationTargetElement ?? null;
      const textAnnotationMeta = options.changes.getMetaForElement(textAnnotationTarget);
      const hasCommittedTextAnnotationContent = Boolean(
        textAnnotationMeta &&
        (
          options.changes.normalizeNote(textAnnotationMeta.note).trim() ||
          textAnnotationMeta.images.length > 0 ||
          textAnnotationMeta.changeKinds.length > 0
        )
      );
      if (textAnnotationTarget && !hasCommittedTextAnnotationContent) {
        options.changes.setNoteForElement(textAnnotationTarget, '');
      }
    };

    if (state.eventController) {
      state.eventController.setMode('hover');
      if (state.selectedElement) {
        handleDeselect();
      } else {
        clearIdleTextAnnotationMeta();
        options.changes.clearPendingSelectionAnchor();
        state.selectionAnchor = null;
        state.activeTextAnnotation = null;
        state.canvasOverlay?.setTextHighlightRects(null);
        state.textAnnotationManager?.clearActiveHighlight();
        if (state.textAnnotationTargetElement) {
          delete state.textAnnotationTargetElement.dataset.weTextAnnotationId;
        }
        syncShadowHostMount(null);
        state.breadcrumbs?.setTarget(null);
        state.breadcrumbs?.setAnchorRect(null);
        state.propertyPanel?.setTarget(null);
        state.propertyPanel?.refresh();
        state.handlesController?.setTarget(null);
        state.parentSelectController?.setTarget(null);
        options.onStatusChange?.();
      }
    } else {
      if (state.selectedElement) {
        handleDeselect();
      } else {
        clearIdleTextAnnotationMeta();
        options.changes.clearPendingSelectionAnchor();
        state.selectionAnchor = null;
        state.activeTextAnnotation = null;
        state.canvasOverlay?.setTextHighlightRects(null);
        state.textAnnotationManager?.clearActiveHighlight();
        if (state.textAnnotationTargetElement) {
          delete state.textAnnotationTargetElement.dataset.weTextAnnotationId;
        }
        syncShadowHostMount(null);
        state.breadcrumbs?.setTarget(null);
        state.breadcrumbs?.setAnchorRect(null);
        state.propertyPanel?.setTarget(null);
        state.propertyPanel?.refresh();
        state.handlesController?.setTarget(null);
        state.parentSelectController?.setTarget(null);
        options.onStatusChange?.();
      }
    }

    console.log(`${options.logPrefix} Selection cleared`);
  }

  async function revertElement(
    elementKey: WebEditorElementKey,
  ): Promise<WebEditorRevertElementResponse> {
    const key = String(elementKey ?? '').trim();
    if (!key) {
      return { success: false, error: 'elementKey is required' };
    }

    const tm = state.transactionManager;
    if (!tm) {
      return { success: false, error: 'Transaction manager not ready' };
    }

    try {
      const undoStack = filterUnprocessedTransactions(state, tm.getUndoStack());
      const summaries = aggregateTransactionsByElement(undoStack);
      const summary = summaries.find((item) => item.elementKey === key);

      if (!summary) {
        return { success: false, error: 'Element not found in current changes' };
      }

      const element = locateElement(summary.locator);
      if (!element || !element.isConnected) {
        return { success: false, error: 'Failed to locate element for revert' };
      }

      const reverted: NonNullable<WebEditorRevertElementResponse['reverted']> = {};
      let didRevert = false;

      const classChanges = summary.netEffect.classChanges;
      if (classChanges) {
        const baselineClasses = Array.isArray(classChanges.before) ? classChanges.before : [];
        const beforeClasses = (() => {
          try {
            const list = (element as HTMLElement).classList;
            if (list && typeof list[Symbol.iterator] === 'function') {
              return Array.from(list).filter(Boolean);
            }
          } catch {
            // Fallback below.
          }

          const raw = element.getAttribute('class') ?? '';
          return raw
            .split(/\s+/)
            .map((token) => token.trim())
            .filter(Boolean);
        })();

        const tx = tm.recordClass(element, beforeClasses, baselineClasses);
        if (tx) {
          reverted.class = true;
          didRevert = true;
        }
      }

      const textChange = summary.netEffect.textChange;
      if (textChange) {
        const baselineText = String(textChange.before ?? '');
        const beforeText = element.textContent ?? '';

        if (beforeText !== baselineText) {
          element.textContent = baselineText;
          const tx = tm.recordText(element, beforeText, baselineText);
          if (tx) {
            reverted.text = true;
            didRevert = true;
          }
        }
      }

      const styleChanges = summary.netEffect.styleChanges;
      if (styleChanges) {
        const before = styleChanges.before ?? {};
        const after = styleChanges.after ?? {};
        const properties = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
          .map((prop) => String(prop ?? '').trim())
          .filter(Boolean);

        if (properties.length > 0) {
          const handle = tm.beginMultiStyle(element, properties);
          if (handle) {
            handle.set(before);
            const tx = handle.commit({ merge: false });
            if (tx) {
              reverted.style = true;
              didRevert = true;
            }
          }
        }
      }

      if (!didRevert) {
        return { success: false, error: 'No changes were reverted' };
      }

      state.propertyPanel?.refresh();
      options.onStatusChange?.();
      return { success: true, reverted };
    } catch (error) {
      console.error(`${options.logPrefix} Revert element failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Enter text annotation flow: create an editMeta entry from a TextAnnotation
   * and trigger the bubble card UI.
   */
  function enterTextAnnotation(
    annotation: TextAnnotation,
    anchor: { clientX: number; clientY: number },
  ): void {
    const elementKey = annotation.id as WebEditorElementKey;
    const sourceElement = annotation.sourceElement?.isConnected ? annotation.sourceElement : null;
    const selectionRect = annotation.boundingRect;
    const hasFiniteSelectionRect = (
      Number.isFinite(selectionRect.left) &&
      Number.isFinite(selectionRect.top) &&
      Number.isFinite(selectionRect.width) &&
      Number.isFinite(selectionRect.height)
    );
    const anchorClientX = hasFiniteSelectionRect
      ? selectionRect.left + selectionRect.width / 2
      : anchor.clientX;
    const anchorClientY = hasFiniteSelectionRect
      ? selectionRect.top + selectionRect.height / 2
      : anchor.clientY;
    const sourceRect = (
      sourceElement &&
      'getBoundingClientRect' in sourceElement &&
      typeof sourceElement.getBoundingClientRect === 'function'
    )
      ? sourceElement.getBoundingClientRect()
      : null;
    const offsetX = (
      sourceRect &&
      Number.isFinite(sourceRect.left) &&
      Number.isFinite(sourceRect.width)
    )
      ? anchorClientX - sourceRect.left
      : undefined;
    const offsetY = (
      sourceRect &&
      Number.isFinite(sourceRect.top) &&
      Number.isFinite(sourceRect.height)
    )
      ? anchorClientY - sourceRect.top
      : undefined;

    // Build a synthetic ElementLocator so the rest of the system
    // (persistence, summaries, etc.) can reference this annotation
    const locator: ElementLocator = sourceElement
      ? createElementLocator(sourceElement)
      : {
          selectors: [],
          fingerprint: annotation.selectedText.slice(0, 80),
          path: [],
        };

    // Build a label from the selected text (first 30 chars)
    const label = formatTextAnnotationLabel(annotation.selectedText);

    // Create/get editMeta
    const meta = options.changes.getOrCreateEditMeta(elementKey, locator, label);

    // Anchor to the selected text rect itself instead of the mouse-up point.
    const markerAnchor = createMarkerAnchor({
      clientX: anchorClientX,
      clientY: anchorClientY,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      viewportWidth: window.innerWidth,
      isFixed: false,
      offsetX,
      offsetY,
    });

    // Since text annotations don't have a real target element,
    // we keep DOM selection empty and use a synthetic target node for UI plumbing.
    state.selectedElement = null;
    state.selectionAnchor = markerAnchor;
    state.hoveredElement = null;
    state.activeTextAnnotation = annotation;
    state.positionTracker?.setSelectionElement(sourceElement);
    meta.anchor = markerAnchor;
    syncShadowHostMount(sourceElement);

    const textAnnotationTargetElement = state.textAnnotationTargetElement;
    if (textAnnotationTargetElement) {
      textAnnotationTargetElement.dataset.weTextAnnotationId = annotation.id;
      textAnnotationTargetElement.style.left = `${Math.round(anchorClientX)}px`;
      textAnnotationTargetElement.style.top = `${Math.round(anchorClientY)}px`;
      state.breadcrumbs?.setTarget(null);
      state.propertyPanel?.setTarget(null);
      state.breadcrumbs?.setTarget(textAnnotationTargetElement);
      state.propertyPanel?.setTarget(textAnnotationTargetElement);
    } else {
      state.breadcrumbs?.setTarget(null);
      state.propertyPanel?.setTarget(null);
    }
    state.breadcrumbs?.setAnchorRect(annotation.boundingRect);
    state.handlesController?.setTarget(null);
    state.parentSelectController?.setTarget(null);

    // Enter bubble card mode
    enterAnnotationInput('bubble-card');
    state.propertyPanel?.refresh();

    options.onStatusChange?.();
    console.log(`${options.logPrefix} Text annotation:`, annotation.selectedText.slice(0, 50));
  }

  return {
    handleHover,
    handleSelect,
    handleDeselect,
    handlePositionUpdate,
    handleTransactionChange,
    enterAnnotationInput,
    enterAnnotationFromTrigger,
    enterTextAnnotation,
    clearSelection,
    revertElement,
  };
}
