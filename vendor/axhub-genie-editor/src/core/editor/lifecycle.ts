import { WEB_EDITOR_V2_LOG_PREFIX } from '../../constants';
import { mountShadowHost } from '../../ui/shadow-host';
import { createWebEditorUiRuntime } from '../../ui/web-editor-ui-runtime';
import { createCanvasOverlay } from '../../overlay/canvas-overlay';
import { createHandlesController } from '../../overlay/handles-controller';
import { createParentSelectCorner } from '../../overlay/parent-select-corner';
import { createSelectionEngine } from '../../selection/selection-engine';
import { createTextCommentManager } from '../../selection/text-comment-manager';
import { createEventController } from '../event-controller';
import { createPositionTracker } from '../position-tracker';
import { createTransactionManager, type TransactionManager } from '../transaction-manager';
import { createPerfMonitor } from '../perf-monitor';
import { createDesignTokensService } from '../design-tokens';
import { locateElement } from '../locator';
import {
  exportSelectionToDesignTool,
  getDesignToolExportBlockReason,
  isExportableDesignElement,
} from '../../design-tool-export';
import { clearEditorRuntimeRefs, resetEditorTransientState } from './state';
import type { EditorLifecycleDeps } from './contracts';
import { TEXT_COMMENT_TARGET_ATTR } from './text-comment-target';
import { getGlobalGenieEditorTweakProtocol } from '../../tweak/protocol';
import { resolveWebEditorOptions } from './state';
import type { PropertyPanelOptions } from '../../ui/property-panel';

interface EditorLifecycle {
  start(): void;
  startPanelOnly(): void;
  stop(options?: { keepPanelOnly?: boolean }): void;
  stopPanelOnly(): void;
  flushPendingCommentContextSync(): void;
}

export function createLifecycleService(deps: EditorLifecycleDeps): EditorLifecycle {
  const { state, services, onStatusChange } = deps;
  const rawOptions: NonNullable<Parameters<typeof resolveWebEditorOptions>[0]> = deps.options
    ? (deps.options as NonNullable<Parameters<typeof resolveWebEditorOptions>[0]>)
    : {};
  const options = resolveWebEditorOptions(rawOptions);
  if (
    rawOptions.genieBridge &&
    !Object.prototype.hasOwnProperty.call(rawOptions.genieBridge, 'enableContextAppend')
  ) {
    (options.genieBridge as { enableContextAppend?: boolean }).enableContextAppend = undefined;
  }
  let inlineTextEditingElement: HTMLElement | null = null;
  let pendingCommentContextSync = false;

  function isEventWithinElement(event: Event, element: Element): boolean {
    try {
      if (typeof event.composedPath === 'function') {
        return event.composedPath().some((node) => node === element);
      }
    } catch {
      // Fall back to target checks below.
    }

    const target = event.target;
    return target instanceof Node && element.contains(target);
  }

  function shouldAllowInlineEditingPageEvent(event: Event): boolean {
    if (!inlineTextEditingElement || !inlineTextEditingElement.isConnected) {
      return false;
    }

    if (isEventWithinElement(event, inlineTextEditingElement)) {
      return true;
    }

    const activeElement = document.activeElement;
    if (!(activeElement instanceof Node) || !inlineTextEditingElement.contains(activeElement)) {
      return false;
    }

    return (
      event.type.startsWith('key') ||
      event.type === 'beforeinput' ||
      event.type === 'input' ||
      event.type === 'change' ||
      event.type.startsWith('composition') ||
      event.type === 'selectionchange'
    );
  }

  function sendCommentContextSync(element: Element | null, mode: 'append' | 'replace'): void {
    void services.genieBridge.handleSyncCommentContextToGenie(element, mode).then(() => {
      if (mode === 'replace') {
        pendingCommentContextSync = false;
      }
    }).catch((error) => {
      pendingCommentContextSync = true;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`${WEB_EDITOR_V2_LOG_PREFIX} Failed to sync comment context:`, message);
    });
  }

  function hasCommentContextToSync(): boolean {
    try {
      return (services.changes.buildCommentCommentsContext?.() ?? []).length > 0;
    } catch {
      return pendingCommentContextSync;
    }
  }

  function flushPendingCommentContextSync(): void {
    if (!options.genieBridge.enabled || !services.genieBridge.isAvailable()) {
      return;
    }
    if (!pendingCommentContextSync && !hasCommentContextToSync()) {
      return;
    }

    sendCommentContextSync(null, 'replace');
  }

  function syncCommentContextAfterNoteSave(element: Element | null, note: string): void {
    const mode = String(note ?? '').trim() ? 'append' : 'replace';
    if (!options.genieBridge.enabled) {
      return;
    }
    if (!services.genieBridge.isAvailable()) {
      pendingCommentContextSync = true;
      return;
    }

    sendCommentContextSync(element, mode);
  }

  function resolvePromptTargetsFromEditHistory(): Element[] {
    const metas = Array.from(state.editMetaByKey.values())
      .filter(
        (meta) =>
          meta.dirtySince !== null ||
          String(meta.note ?? '').trim() ||
          (Array.isArray(meta.images) && meta.images.length > 0),
      )
      .sort((a, b) => Number(b.dirtySince ?? 0) - Number(a.dirtySince ?? 0));
    const elements: Element[] = [];
    const seen = new Set<Element>();

    for (const meta of metas) {
      try {
        const element = locateElement(meta.locator);
        if (element?.isConnected && !seen.has(element)) {
          seen.add(element);
          elements.push(element);
        }
      } catch {
        // Ignore stale locators and continue scanning the next edited element.
      }
    }

    return elements;
  }

  function resolvePromptTargets(preferredElement?: Element | null): Element[] {
    const recoveredElements = resolvePromptTargetsFromEditHistory();
    if (recoveredElements.length > 0) {
      return recoveredElements;
    }
    if (preferredElement?.isConnected) {
      return [preferredElement];
    }
    if (state.selectedElement?.isConnected) {
      return [state.selectedElement];
    }
    return [];
  }

  function resolvePromptTarget(preferredElement?: Element | null): Element | null {
    if (preferredElement?.isConnected) {
      return preferredElement;
    }
    if (state.selectedElement?.isConnected) {
      return state.selectedElement;
    }
    return resolvePromptTargetsFromEditHistory()[0] ?? null;
  }

  function handleTransactionError(error: unknown): void {
    console.error(`${WEB_EDITOR_V2_LOG_PREFIX} Transaction apply error:`, error);
  }

  function dismissVisibleElementGenieTaskStates(): void {
    const tasks = services.genieBridge.getVisibleTaskStates();
    for (const task of tasks) {
      try {
        const element = locateElement(task.locator);
        if (!element?.isConnected) {
          continue;
        }
        services.genieBridge.dismissElementTaskState(element);
      } catch {
        // Ignore stale locators while clearing visible task states.
      }
    }
  }

  function getClearableElementCount(): number {
    const clearableElementKeys = new Set<string>();

    for (const meta of state.editMetaByKey.values()) {
      if (meta.dirtySince !== null) {
        clearableElementKeys.add(meta.elementKey);
      }
    }

    for (const task of services.genieBridge.getVisibleTaskStates()) {
      if (task.status === 'completed' || task.status === 'error') {
        clearableElementKeys.add(task.elementKey);
      }
    }

    return clearableElementKeys.size;
  }

  function getTweakProtocol() {
    return getGlobalGenieEditorTweakProtocol();
  }

  function cleanupMountedRuntime(): void {
    inlineTextEditingElement = null;
    services.integrationWs?.stop();
    services.genieBridge.stop();

    state.uiResizeCleanup?.();
    state.uiResizeCleanup = null;

    state.propertyPanel?.dispose();
    state.propertyPanel = null;

    state.tokensService?.dispose();
    state.tokensService = null;

    state.breadcrumbs?.dispose();
    state.breadcrumbs = null;

    state.eventController?.dispose();
    state.eventController = null;

    state.commentShortcutCleanup?.();
    state.commentShortcutCleanup = null;

    if (state.textCommentTargetElement) {
      state.textCommentTargetElement.remove();
      state.textCommentTargetElement = null;
    }

    state.dragReorderController?.dispose();
    state.dragReorderController = null;

    state.handlesController?.dispose();
    state.handlesController = null;

    state.parentSelectController?.dispose();
    state.parentSelectController = null;

    state.transactionManager?.dispose();
    state.transactionManager = null;

    state.positionTracker?.dispose();
    state.positionTracker = null;

    state.selectionEngine?.dispose();
    state.selectionEngine = null;

    state.perfHotkeyCleanup?.();
    state.perfHotkeyCleanup = null;

    state.perfMonitor?.dispose();
    state.perfMonitor = null;

    state.canvasOverlay?.dispose();
    state.canvasOverlay = null;

    state.shadowHost?.dispose();
    state.shadowHost = null;

    clearEditorRuntimeRefs(state);
  }

  function installPerfHotkey(): void {
    const handler = (event: KeyboardEvent): void => {
      if (event.repeat) return;

      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod || !event.shiftKey || event.altKey) return;

      const key = (event.key || '').toLowerCase();
      if (key !== 'p') return;

      const monitor = state.perfMonitor;
      if (!monitor) return;

      monitor.toggle();
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const hotkeyOptions: AddEventListenerOptions = { capture: true, passive: false };
    window.addEventListener('keydown', handler, hotkeyOptions);
    state.perfHotkeyCleanup = () => {
      window.removeEventListener('keydown', handler, hotkeyOptions);
    };
  }

  function installUiResizeClamp(): void {
    let uiResizeRafId: number | null = null;
    let markerViewportSyncRafId: number | null = null;

    const clampFloatingUi = (): void => {
      if (state.propertyPanel && state.propertyPanelPosition) {
        state.propertyPanel.setPosition(state.propertyPanelPosition);
      }
    };

    const onWindowResize = (): void => {
      if (!state.active || uiResizeRafId !== null) return;
      uiResizeRafId = window.requestAnimationFrame(() => {
        uiResizeRafId = null;
        clampFloatingUi();
      });
    };

    const syncChangeMarkersToViewport = (): void => {
      if (!state.active || markerViewportSyncRafId !== null) return;
      markerViewportSyncRafId = window.requestAnimationFrame(() => {
        markerViewportSyncRafId = null;
        services.changes.renderChangeMarkers();
      });
    };

    const canListenOnDocument = typeof document?.addEventListener === 'function';

    window.addEventListener('resize', onWindowResize, { passive: true });
    window.addEventListener('resize', syncChangeMarkersToViewport, { passive: true });
    window.addEventListener('scroll', syncChangeMarkersToViewport, { passive: true, capture: true });
    if (canListenOnDocument) {
      document.addEventListener('scroll', syncChangeMarkersToViewport, { passive: true, capture: true });
    }
    state.uiResizeCleanup = () => {
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('resize', syncChangeMarkersToViewport);
      window.removeEventListener('scroll', syncChangeMarkersToViewport, true);
      if (canListenOnDocument) {
        document.removeEventListener('scroll', syncChangeMarkersToViewport, true);
      }
      if (uiResizeRafId !== null) {
        window.cancelAnimationFrame(uiResizeRafId);
        uiResizeRafId = null;
      }
      if (markerViewportSyncRafId !== null) {
        window.cancelAnimationFrame(markerViewportSyncRafId);
        markerViewportSyncRafId = null;
      }
    };

    clampFloatingUi();
  }

  function start(): void {
    if (state.active && !state.panelOnlyMode) {
      console.log(`${WEB_EDITOR_V2_LOG_PREFIX} Already active`);
      return;
    }

    // Upgrading from panel-only → full mode: reuse existing shadow host & UI.
    const upgradingFromPanelOnly = state.active && state.panelOnlyMode;
    if (upgradingFromPanelOnly) {
      try {
        upgradeFromPanelOnly();
        return;
      } catch (error) {
        console.error(`${WEB_EDITOR_V2_LOG_PREFIX} Failed to upgrade from panel-only:`, error);
        // Fall through to a clean full start below.
        cleanupMountedRuntime();
        state.active = false;
        state.panelOnlyMode = false;
      }
    }

    try {
      resetEditorTransientState(state);

      state.shadowHost = mountShadowHost({});
      const elements = state.shadowHost.getElements();
      if (!elements?.overlayRoot) {
        throw new Error('Shadow host overlayRoot not available');
      }

      const ensureMarkersVisible = (): void => {
        if (state.changeMarkersVisible) return;
        state.changeMarkersVisible = true;
        services.persistence.setMarkerVisibility(true);
      };

      state.changeMarkersVisible = services.persistence.readMarkerVisibility();
      ensureMarkersVisible();
      state.commentShortcutSettings = services.persistence.readCommentShortcutSettings();
      state.uiSettings = {
        ...services.persistence.readUiSettings(),
        darkMode: options.ui.initialDarkMode,
      };

      const markerLayer = document.createElement('div');
      markerLayer.className = 'we-change-markers';
      markerLayer.hidden = true;
      elements.uiRoot.append(markerLayer);
      state.markerLayer = markerLayer;

      state.canvasOverlay = createCanvasOverlay({
        container: elements.overlayRoot,
      });

      state.perfMonitor = createPerfMonitor({
        container: elements.overlayRoot,
        fpsUiIntervalMs: 500,
        memorySampleIntervalMs: 1000,
      });
      installPerfHotkey();

      const isTextComment = options.interactionProfile === 'text-comment';

      if (isTextComment) {
        const textCommentTarget = document.createElement('div');
        textCommentTarget.setAttribute(TEXT_COMMENT_TARGET_ATTR, 'true');
        textCommentTarget.setAttribute('aria-hidden', 'true');
        Object.assign(textCommentTarget.style, {
          position: 'fixed',
          left: '0px',
          top: '0px',
          width: '1px',
          height: '1px',
          opacity: '0',
          pointerEvents: 'none',
          userSelect: 'none',
        });
        elements.overlayRoot.append(textCommentTarget);
        state.textCommentTargetElement = textCommentTarget;

        state.textCommentManager = createTextCommentManager({
          isOverlayElement: state.shadowHost.isOverlayElement,
        });
        state.selectionEngine = null;
      } else {
        state.selectionEngine = createSelectionEngine({
          isOverlayElement: state.shadowHost.isOverlayElement,
        });
        state.textCommentManager = null;
        state.textCommentTargetElement = null;
      }

      state.positionTracker = createPositionTracker({
        onPositionUpdate: services.interaction.handlePositionUpdate,
      });

      state.commentShortcutCleanup = null;

      state.transactionManager = createTransactionManager({
        enableKeyBindings: true,
        isEventFromEditorUi: (event) => {
          return Boolean(state.shadowHost?.isEventFromUi(event));
        },
        onChange: services.interaction.handleTransactionChange,
        onApplyError: handleTransactionError,
      });

      void Promise.resolve(services.persistence.restoreCachedChanges())
        .then(() => {
          services.genieBridge.rehydratePersistedGenieState();
          ensureMarkersVisible();
          services.persistence.persistFromTransactions();
          state.propertyPanel?.refresh();
          onStatusChange?.();
        })
        .catch((error) => {
          console.warn(`${WEB_EDITOR_V2_LOG_PREFIX} Failed to restore cached changes:`, error);
          services.genieBridge.rehydratePersistedGenieState();
          ensureMarkersVisible();
          services.persistence.persistFromTransactions();
        });

      state.handlesController = createHandlesController({
        container: elements.overlayRoot,
        canvasOverlay: state.canvasOverlay,
        transactionManager: state.transactionManager,
        positionTracker: state.positionTracker,
      });

      state.parentSelectController = createParentSelectCorner({
        container: elements.overlayRoot,
        getParentCandidate: (element) => state.selectionEngine?.getParentCandidate(element) ?? null,
        onSelectParent: (parent) => {
          const rect = parent.getBoundingClientRect();
          const clientX = Number.isFinite(rect.left) ? rect.left + rect.width / 2 : undefined;
          const clientY =
            Number.isFinite(rect.top) ? rect.top + Math.min(18, Math.max(10, rect.height / 2)) : undefined;

          services.interaction.handleSelect(
            parent,
            {
              alt: false,
              shift: false,
              ctrl: false,
              meta: false,
            },
            clientX !== undefined && clientY !== undefined ? { clientX, clientY } : undefined,
          );
        },
      });

      state.eventController = createEventController({
        isOverlayElement: state.shadowHost.isOverlayElement,
        shouldAllowPageEvent: (event) =>
          Boolean(options.host.shouldAllowPageEvent?.(event)) || shouldAllowInlineEditingPageEvent(event),
        allowNativeTextSelection: isTextComment,
        onHover: isTextComment ? () => {} : services.interaction.handleHover,
        onSelect: isTextComment
          ? () => {}
          : (event) =>
              services.interaction.handleSelect(event.element, event.modifiers, {
                clientX: event.clientX,
                clientY: event.clientY,
              }),
        onDoubleClickSelected: isTextComment
          ? undefined
          : (event) => {
              if (!services.textSession.isEditable(event.element)) return;
              if (services.genieBridge.isElementInteractionLocked(event.element)) return;
              state.breadcrumbs?.enterInlineTextEdit?.();
              state.propertyPanel?.enterInlineTextEdit?.();
            },
        onDeselect: services.interaction.handleDeselect,
        resolveTargetForHover: isTextComment
          ? undefined
          : (target) => services.genieBridge.resolveSelectableElement(target),
        findTargetForSelect: isTextComment
          ? undefined
          : (_x, _y, modifiers, event) => {
              const target = state.selectionEngine?.findBestTargetFromEvent(event, modifiers) ?? null;
              return services.genieBridge.resolveSelectableElement(target);
            },
        getSelectedElement: () => state.selectedElement,
        isElementInteractionLocked: (element) => services.genieBridge.isElementInteractionLocked(element),
      });

      // Text-comment mode: listen for mouseup to commit text selections
      if (isTextComment && state.textCommentManager) {
        const textCommentManager = state.textCommentManager;
        let pendingTextSelectionCommitTimer: number | null = null;
        const queueTextSelectionCommit = (): void => {
          // Delay slightly so the browser has finished updating the selection.
          // Listen to both pointerup and mouseup because some environments
          // reliably emit only one of them for drag-selection completion.
          if (pendingTextSelectionCommitTimer !== null) {
            window.clearTimeout(pendingTextSelectionCommitTimer);
          }
          pendingTextSelectionCommitTimer = window.setTimeout(() => {
            pendingTextSelectionCommitTimer = null;
            const comment = textCommentManager.commitSelection();
            if (!comment) return;

            state.activeTextComment = comment;

            const usedNativeHighlight = textCommentManager.setActiveHighlight(comment);
            state.canvasOverlay?.setTextHighlightRects(
              usedNativeHighlight ? null : comment.clientRects,
            );
            state.canvasOverlay?.render();

            // Compute an anchor for the bubble card from the bounding rect
            const rect = comment.boundingRect;
            const clientX = rect.left + rect.width / 2;
            const clientY = rect.top;

            // Create a virtual "container element" reference using commonAncestorContainer
            // and enter the comment flow via the standard interaction service
            services.interaction.enterTextComment(comment, { clientX, clientY });
          }, 10);
        };

        window.addEventListener('pointerup', queueTextSelectionCommit, { capture: true });
        window.addEventListener('mouseup', queueTextSelectionCommit, { capture: true });
        state.commentShortcutCleanup = () => {
          if (pendingTextSelectionCommitTimer !== null) {
            window.clearTimeout(pendingTextSelectionCommitTimer);
            pendingTextSelectionCommitTimer = null;
          }
          window.removeEventListener('pointerup', queueTextSelectionCommit, { capture: true });
          window.removeEventListener('mouseup', queueTextSelectionCommit, { capture: true });
        };
      }

      if (options.ui.propertyPanel) {
        state.tokensService = createDesignTokensService();
      } else {
        state.tokensService = null;
      }

      if (options.ui.propertyPanel || options.ui.breadcrumbs) {
        const selectElementWithCenterAnchor = (element: Element): void => {
          if (!element.isConnected) return;
          const rect = element.getBoundingClientRect();
          const clientX = Number.isFinite(rect.left) ? rect.left + rect.width / 2 : undefined;
          const clientY = Number.isFinite(rect.top) ? rect.top + Math.min(18, Math.max(10, rect.height / 2)) : undefined;

          services.interaction.handleSelect(
            element,
            {
              alt: false,
              shift: false,
              ctrl: false,
              meta: false,
            },
            clientX !== undefined && clientY !== undefined ? { clientX, clientY } : undefined,
          );
        };

        const propertyPanelOptions: PropertyPanelOptions = {
          container: elements.uiRoot,
          transactionManager: state.transactionManager,
          tokensService: state.tokensService ?? undefined,
          initialPosition: state.propertyPanelPosition,
          initialUiMode: state.commentEntryMode,
          onPositionChange: (position) => {
            state.propertyPanelPosition = position;
          },
          getUiMode: () => state.commentEntryMode,
          onUiModeChange: (mode) => {
            state.commentEntryMode = mode;
            state.positionTracker?.forceUpdate(true);
            services.changes.renderChangeMarkers();
          },
          getCommentShortcutSettings: () => state.commentShortcutSettings,
          onCommentShortcutSettingsChange: (settings) => {
            state.commentShortcutSettings = settings;
            services.persistence.setCommentShortcutSettings(settings);
          },
          getUiSettings: () => state.uiSettings,
          interactionProfile: options.interactionProfile,
          onUiSettingsChange: (settings) => {
            state.uiSettings = settings;
            services.persistence.setUiSettings(settings);
          },
          onLocateElement: (element) => {
            const target = services.genieBridge.resolveSelectableElement(element) ?? element;
            if (!target?.isConnected) return;
            services.interaction.clearSelection();
            state.eventController?.setMode('hover');
            state.eventController?.setProgrammaticHoverElement(target);
            services.interaction.handleHover(target);
          },
          onCommentShortcutDialogOpenChange: (open) => {
            state.commentShortcutDialogOpen = open;
          },
          onUndo: () => state.transactionManager?.undo(),
          onRedo: () => state.transactionManager?.redo(),
          onCopyPrompt: services.localActions.handleCopyPrompt,
          onWakeGenie: options.genieBridge.allowWake !== false
            ? async () => {
                try {
                  return await services.genieBridge.requestWake();
                } catch (error) {
                  const message = error instanceof Error ? error.message : String(error);
                  if (message) {
                    services.feedback.toast('warning', message);
                  }
                  return false;
                }
              }
            : undefined,
          onSendPromptToGenie: async (element) => {
            const targetElements = resolvePromptTargets(element);
            if (targetElements.length === 0) {
              throw new Error('当前没有可发送给 AI 的编辑元素。');
            }
            const prompt = services.genieBridge.hasReusableConversation()
              ? services.summaries.buildAppendSaveRunPrompt()
              : services.summaries.buildSaveRunPrompt();
            try {
              await services.genieBridge.handleSendPromptToGenieForElements(
                targetElements,
                prompt,
              );
            } finally {
              state.positionTracker?.forceUpdate(true);
            }
          },
          onSendCurrentElementPromptToGenie: async (element) => {
            if (!element?.isConnected) {
              throw new Error('当前元素已失效，请重新选择后再试。');
            }
            const prompt = services.genieBridge.hasReusableConversation()
              ? services.summaries.buildAppendSaveRunPromptForElement(element)
              : services.summaries.buildSaveRunPromptForElement(element);
            if (!prompt) {
              throw new Error('当前元素没有可发送给 AI 的编辑。');
            }
            try {
              await services.genieBridge.handleSendPromptToGenieForElement(element, prompt);
            } finally {
              state.positionTracker?.forceUpdate(true);
            }
          },
          onAbortSendPromptToGenie: (element) => {
            const targetElement = resolvePromptTarget(element);
            if (!targetElement) {
              throw new Error('当前没有可中断的 AI 编辑元素。');
            }
            return services.genieBridge.interruptElementTask(targetElement);
          },
          onRequestClose: services.interaction.clearSelection,
          onRequestFullExit: options.ui.onRequestFullExit,
          onClearEdits: async (clearOptions) => {
            await services.localActions.handleClearEdits(clearOptions);
            services.genieBridge.invalidateCurrentConversation?.();
            dismissVisibleElementGenieTaskStates();
          },
          onClearCurrentElementEdits: async (element) => {
            const didClear = await services.localActions.handleClearElementEdits(element);
            if (didClear) {
              services.genieBridge.dismissElementTaskState(element, { includeRunning: true });
            }
            return didClear;
          },
          getCopyPromptBlockReason: services.summaries.getCopyPromptBlockReason,
          showCopyPromptAction: options.ui.showCopyPromptAction,
          toolbarMode: options.ui.toolbarMode,
          hideExecutionControls: options.ui.hideExecutionControls,
          externalEditingStatusDescription: options.ui.externalEditingStatusDescription,
          skillInstallSource: options.ui.skillInstallSource,
          getGenieBridgeAvailable: () => services.genieBridge.isAvailable(),
          getGenieBridgeConnected: () => services.genieBridge.isConnected(),
          getCanAbortSendPromptToGenie: (element) =>
            services.genieBridge.canInterruptElementTask(resolvePromptTarget(element)),
          getHasReusableGenieConversation: () => services.genieBridge.hasReusableConversation(),
          getCurrentGenieConversationState: () => services.genieBridge.getCurrentConversationState(),
          getElementGenieTaskState: (element) => services.genieBridge.getElementTaskState(element),
          getVisibleElementGenieTaskStates: () => services.genieBridge.getVisibleTaskStates(),
          getGenieProviderAvailability: (provider) =>
            services.genieBridge.getProviderAvailability(provider),
          getGenieProviderAvailabilities: () => services.genieBridge.getProviderAvailabilities(),
          refreshGenieProviderAvailabilities: (providers) =>
            services.genieBridge.refreshProviderAvailabilities(providers),
          subscribeSessionActivity: (target, listener) =>
            services.genieBridge.subscribeSessionActivity(target, listener),
          dismissElementGenieTaskState: (element) => services.genieBridge.dismissElementTaskState(element),
          dismissVisibleElementGenieTaskStates,
          getSendPromptToGenieBlockReason: (element) => {
            const targetElements = resolvePromptTargets(element);
            if (targetElements.length === 0) {
              return '当前没有可发送给 AI 的编辑元素';
            }
            return services.summaries.getSaveRunPromptBlockReason();
          },
          getSendCurrentElementPromptToGenieBlockReason: (element) => {
            if (!element?.isConnected) {
              return '当前元素已失效，请重新选择后再试。';
            }
            return services.summaries.getSaveRunPromptForElementBlockReason(element);
          },
          canExportSelectionToDesignTool: (_tool, element) => {
            const targetElement = resolvePromptTarget(element);
            return isExportableDesignElement(targetElement);
          },
          onExportSelectionToDesignTool: async (tool, element) => {
            const targetElement = resolvePromptTarget(element);
            if (!targetElement) {
              throw new Error('当前没有可导出的元素。');
            }
            try {
              await exportSelectionToDesignTool(tool, targetElement);
              services.feedback.toast('success', `已导出到 ${tool}`);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              services.feedback.toast('error', message || `导出到 ${tool} 失败`);
            }
          },
          getExportSelectionToDesignToolBlockReason: (_tool, element) => {
            const targetElement = resolvePromptTarget(element);
            if (!targetElement) {
              return '当前没有可导出的元素';
            }
            if (services.genieBridge.isElementInteractionLocked(targetElement)) {
              return '当前元素正在由 AI 更新';
            }
            return getDesignToolExportBlockReason(targetElement);
          },
          canEditText: (element) => services.textSession.isEditable(element),
          getTextValue: (element) => services.textSession.getText(element),
          onTextValueChange: (element, value, previousValue) => {
            services.textSession.commitText(element, value, previousValue);
          },
          onInlineTextEditingElementChange: (element) => {
            inlineTextEditingElement = element?.isConnected ? element : null;
            state.inlineTextEditingActive = Boolean(inlineTextEditingElement);
            state.positionTracker?.forceUpdate(true);
          },
          getTweakSchema: (element) => getTweakProtocol()?.getSchema(element) ?? null,
          getTweakValues: (element) => getTweakProtocol()?.getValues(element) ?? null,
          getPageTweakEntries: () => getTweakProtocol()?.listEntries(document) ?? [],
          onUpdateTweakValues: async (element, patch) => {
            const protocol = getTweakProtocol();
            if (!protocol) {
              throw new Error('Tweak protocol is unavailable.');
            }
            const schema = protocol.getSchema(element);
            const beforeValues = protocol.getValues(element);
            await protocol.update(element, patch);
            const afterValues = protocol.getValues(element);
            services.changes.recordTweakValuesForElement?.(element, {
              schema,
              beforeValues,
              afterValues,
            });
            state.positionTracker?.forceUpdate(true);
            onStatusChange?.();
          },
          subscribeTweak: (listener) => getTweakProtocol()?.subscribe(listener) ?? (() => undefined),
          getAiNote: (element) => services.changes.getMetaForElement(element)?.note ?? '',
          getAiNoteSkillIds: (element) => services.changes.getMetaForElement(element)?.skillIds?.slice() ?? [],
          getAiNoteImages: (element) => services.changes.getImagesForElement(element),
          getHoveredElement: () => state.hoveredElement,
          onRememberSelectionAnchor: (element, selectionAnchor) => {
            services.changes.rememberSelectionAnchor(element, selectionAnchor);
          },
          onAiNoteChange: (element, note, noteOptions) => {
            if (noteOptions) {
              services.changes.setNoteForElement(element, note, noteOptions);
            } else {
              services.changes.setNoteForElement(element, note);
            }
            state.positionTracker?.forceUpdate(true);
            syncCommentContextAfterNoteSave(element, note);
          },
          onAiNoteImagesChange: (element, images) => {
            services.changes.setImagesForElement(element, images);
            state.positionTracker?.forceUpdate(true);
          },
          onDismissSelection: services.interaction.clearSelection,
          getChangeMarkersVisible: () => state.changeMarkersVisible,
          onChangeMarkersVisible: services.changes.setChangeMarkersVisible,
          getModifiedElementCount: getClearableElementCount,
          onSelectionChromeVisibleChange: (visible) => {
            state.selectionChromeVisible = visible;
            if (!visible) {
              state.canvasOverlay?.setHoverRect(null);
              state.canvasOverlay?.setSelectionEffect('default');
              state.canvasOverlay?.setSelectionRect(null);
              state.canvasOverlay?.render();
              state.handlesController?.setSelectionRect(null);
            } else {
              state.positionTracker?.forceUpdate(true);
            }
            onStatusChange?.();
          },
          onPromptCardVisibleChange: (visible) => {
            if (state.promptCardVisible === visible) return;
            state.promptCardVisible = visible;
            services.changes.renderChangeMarkers();
            state.positionTracker?.forceUpdate(true);
            onStatusChange?.();
          },
          onToggleSelectionMode: (enabled, toggleOptions) => {
            const selectedElement = state.selectedElement;
            const hasSelection = !!selectedElement && selectedElement.isConnected;
            if (!state.eventController) {
              return;
            }

            if (enabled) {
              state.eventController.setMode(hasSelection ? 'selecting' : 'hover');
              return;
            }

            state.eventController.setMode('interaction', {
              allowPageInteraction:
                toggleOptions?.allowPageInteraction ?? !hasSelection,
            });
          },
        };

        const runtime = createWebEditorUiRuntime({
          container: elements.uiRoot,
          shadowRoot: elements.shadowRoot,
          propertyPanelVisible: options.ui.propertyPanel,
          toolbarMode: options.ui.toolbarMode,
          breadcrumbsOptions: options.ui.breadcrumbs
            ? {
                container: elements.uiRoot,
                dock: 'top',
                onSelect: selectElementWithCenterAnchor,
                getGenieBridgeAvailable: () => services.genieBridge.isAvailable(),
                hideExecutionControls: options.ui.hideExecutionControls,
                getCommentShortcutSettings: () => state.commentShortcutSettings,
                getElementGenieTaskState: (element) => services.genieBridge.getElementTaskState(element),
                getVisibleElementGenieTaskStates: () => services.genieBridge.getVisibleTaskStates(),
                dismissElementGenieTaskState: (element) => services.genieBridge.dismissElementTaskState(element),
                externalEditingStatusDescription: options.ui.externalEditingStatusDescription,
                onSendToGenie: options.genieBridge.enableContextAppend
                  ? (element) => {
                      if (!element.isConnected) return;
                      void services.genieBridge.handleSendSelectionToGenie(element);
                    }
                  : undefined,
                getElementStyleSummaryLines: (element) =>
                  services.changes.getMetaForElement(element)?.styleSummaryLines ?? [],
                onSelectParent: (element) => {
                  const parent = state.selectionEngine?.getParentCandidate(element) ?? null;
                  if (parent) {
                    selectElementWithCenterAnchor(parent);
                  }
                },
              }
            : null,
          propertyPanelOptions,
        });

        state.breadcrumbs = runtime.breadcrumbs;
        state.propertyPanel = runtime.propertyPanel;
      } else {
        state.breadcrumbs = null;
        state.propertyPanel = null;
      }

      if (state.propertyPanel) {
        state.propertyPanel.setHistory(
          state.transactionManager.getUndoStack().length,
          state.transactionManager.getRedoStack().length,
        );
        state.propertyPanel.refresh();
      }

      services.changes.renderChangeMarkers();
      installUiResizeClamp();

      state.active = true;
      state.panelOnlyMode = false;
      if (options.genieBridge.autoStartOnLaunch !== false) {
        services.genieBridge.start();
      }
      services.integrationWs?.start();
      onStatusChange?.();
      console.log(`${WEB_EDITOR_V2_LOG_PREFIX} Started`);
    } catch (error) {
      cleanupMountedRuntime();
      state.active = false;
      onStatusChange?.();
      console.error(`${WEB_EDITOR_V2_LOG_PREFIX} Failed to start:`, error);
    }
  }

  /**
   * Dispose only interaction-level subsystems while keeping
   * the shadow host, UI runtime, property panel and breadcrumbs alive.
   */
  function cleanupInteractionComponents(): void {
    inlineTextEditingElement = null;
    services.integrationWs?.stop();
    services.genieBridge.stop();

    state.uiResizeCleanup?.();
    state.uiResizeCleanup = null;

    state.tokensService?.dispose();
    state.tokensService = null;

    state.eventController?.dispose();
    state.eventController = null;

    state.commentShortcutCleanup?.();
    state.commentShortcutCleanup = null;

    if (state.textCommentTargetElement) {
      state.textCommentTargetElement.remove();
      state.textCommentTargetElement = null;
    }

    state.dragReorderController?.dispose();
    state.dragReorderController = null;

    state.handlesController?.dispose();
    state.handlesController = null;

    state.parentSelectController?.dispose();
    state.parentSelectController = null;

    state.transactionManager?.dispose();
    state.transactionManager = null;

    state.positionTracker?.dispose();
    state.positionTracker = null;

    state.selectionEngine?.dispose();
    state.selectionEngine = null;

    state.perfHotkeyCleanup?.();
    state.perfHotkeyCleanup = null;

    state.perfMonitor?.dispose();
    state.perfMonitor = null;

    state.canvasOverlay?.dispose();
    state.canvasOverlay = null;

    if (state.markerLayer) {
      state.markerLayer.remove();
      state.markerLayer = null;
    }
  }

  function stop(stopOptions?: { keepPanelOnly?: boolean }): void {
    if (!state.active) {
      return;
    }

    // Downgrade to panel-only mode instead of a full stop.
    if (stopOptions?.keepPanelOnly && !state.panelOnlyMode) {
      try {
        services.persistence.flushPendingWrite();
        cleanupInteractionComponents();
        state.panelOnlyMode = true;
        // Reset transient selection/edit state but keep the panel alive.
        state.hoveredElement = null;
        state.selectedElement = null;
        state.selectionAnchor = null;
        state.pendingHoverTransition = false;
        state.inlineTextEditingActive = false;
        state.promptCardVisible = false;
        state.propertyPanel?.refresh();
        onStatusChange?.();
        console.log(`${WEB_EDITOR_V2_LOG_PREFIX} Downgraded to panel-only mode`);
        return;
      } catch (error) {
        console.error(`${WEB_EDITOR_V2_LOG_PREFIX} Downgrade to panel-only failed, performing full stop:`, error);
        // Fall through to full stop below.
      }
    }

    state.active = false;
    state.panelOnlyMode = false;

    try {
      services.persistence.flushPendingWrite();
      cleanupMountedRuntime();
      onStatusChange?.();
      console.log(`${WEB_EDITOR_V2_LOG_PREFIX} Stopped`);
    } catch (error) {
      console.error(`${WEB_EDITOR_V2_LOG_PREFIX} Error during cleanup:`, error);
      cleanupMountedRuntime();
      onStatusChange?.();
    }
  }

  /**
   * Start the editor in property-panel-only mode.
   * Mounts the shadow host and property panel UI but does NOT create
   * interaction subsystems (selection, hover, event controller, etc.).
   */
  function startPanelOnly(): void {
    if (state.active) {
      if (state.panelOnlyMode) {
        console.log(`${WEB_EDITOR_V2_LOG_PREFIX} Already in panel-only mode`);
      } else {
        console.log(`${WEB_EDITOR_V2_LOG_PREFIX} Already fully active, ignoring startPanelOnly`);
      }
      return;
    }

    try {
      resetEditorTransientState(state);

      state.shadowHost = mountShadowHost({});
      const elements = state.shadowHost.getElements();
      if (!elements?.uiRoot) {
        throw new Error('Shadow host uiRoot not available');
      }

      state.uiSettings = {
        ...services.persistence.readUiSettings(),
        darkMode: options.ui.initialDarkMode,
      };

      if (options.ui.propertyPanel) {
        state.tokensService = createDesignTokensService();

        const propertyPanelOptions: PropertyPanelOptions = {
          container: elements.uiRoot,
          transactionManager: null as unknown as TransactionManager,
          tokensService: state.tokensService ?? undefined,
          initialPosition: state.propertyPanelPosition,
          initialUiMode: state.commentEntryMode,
          onPositionChange: (position) => {
            state.propertyPanelPosition = position;
          },
          getUiMode: () => state.commentEntryMode,
          onUiModeChange: (mode) => {
            state.commentEntryMode = mode;
          },
          getCommentShortcutSettings: () => state.commentShortcutSettings,
          onCommentShortcutSettingsChange: (settings) => {
            state.commentShortcutSettings = settings;
            services.persistence.setCommentShortcutSettings(settings);
          },
          getUiSettings: () => state.uiSettings,
          interactionProfile: options.interactionProfile,
          onUiSettingsChange: (settings) => {
            state.uiSettings = settings;
            services.persistence.setUiSettings(settings);
          },
          onLocateElement: () => {},
          onCommentShortcutDialogOpenChange: (open) => {
            state.commentShortcutDialogOpen = open;
          },
          onUndo: () => {},
          onRedo: () => {},
          onCopyPrompt: services.localActions.handleCopyPrompt,
          onWakeGenie: undefined,
          onSendPromptToGenie: async () => {},
          onSendCurrentElementPromptToGenie: async () => {},
          onAbortSendPromptToGenie: () => {},
          onRequestClose: () => {},
          onRequestFullExit: options.ui.onRequestFullExit,
          onClearEdits: async () => {},
          onClearCurrentElementEdits: async () => false,
          getCopyPromptBlockReason: services.summaries.getCopyPromptBlockReason,
          showCopyPromptAction: options.ui.showCopyPromptAction,
          toolbarMode: options.ui.toolbarMode,
          hideExecutionControls: options.ui.hideExecutionControls,
          externalEditingStatusDescription: options.ui.externalEditingStatusDescription,
          skillInstallSource: options.ui.skillInstallSource,
          getGenieBridgeAvailable: () => false,
          getGenieBridgeConnected: () => false,
          getCanAbortSendPromptToGenie: () => false,
          getHasReusableGenieConversation: () => false,
          getCurrentGenieConversationState: () => null,
          getElementGenieTaskState: () => null,
          getVisibleElementGenieTaskStates: () => [],
          getGenieProviderAvailability: () => null,
          getGenieProviderAvailabilities: () => [],
          refreshGenieProviderAvailabilities: () => Promise.resolve(),
          subscribeSessionActivity: () => () => undefined,
          dismissElementGenieTaskState: () => {},
          dismissVisibleElementGenieTaskStates: () => {},
          getSendPromptToGenieBlockReason: () => '属性面板仅预览模式，不可发送',
          getSendCurrentElementPromptToGenieBlockReason: () => '属性面板仅预览模式，不可发送',
          canExportSelectionToDesignTool: () => false,
          onExportSelectionToDesignTool: async () => {},
          getExportSelectionToDesignToolBlockReason: () => '属性面板仅预览模式，不可导出',
          canEditText: () => false,
          getTextValue: () => '',
          onTextValueChange: () => {},
          onInlineTextEditingElementChange: () => {},
          getTweakSchema: (element) => getTweakProtocol()?.getSchema(element) ?? null,
          getTweakValues: (element) => getTweakProtocol()?.getValues(element) ?? null,
          getPageTweakEntries: () => getTweakProtocol()?.listEntries(document) ?? [],
          onUpdateTweakValues: async (element, patch) => {
            const protocol = getTweakProtocol();
            if (!protocol) {
              throw new Error('Tweak protocol is unavailable.');
            }
            await protocol.update(element, patch);
            onStatusChange?.();
          },
          subscribeTweak: (listener) => getTweakProtocol()?.subscribe(listener) ?? (() => undefined),
          getAiNote: () => '',
          getAiNoteSkillIds: () => [],
          getAiNoteImages: () => [],
          getHoveredElement: () => null,
          onRememberSelectionAnchor: () => {},
          onAiNoteChange: () => {},
          onAiNoteImagesChange: () => {},
          onDismissSelection: () => {},
          getChangeMarkersVisible: () => false,
          onChangeMarkersVisible: () => {},
          getModifiedElementCount: () => 0,
          onSelectionChromeVisibleChange: () => {},
          onPromptCardVisibleChange: () => {},
          onToggleSelectionMode: () => {},
        };

        const runtime = createWebEditorUiRuntime({
          container: elements.uiRoot,
          shadowRoot: elements.shadowRoot,
          propertyPanelVisible: true,
          initialPropertyPanelOpen: true,
          toolbarMode: options.ui.toolbarMode,
          breadcrumbsOptions: null,
          propertyPanelOptions,
        });

        state.breadcrumbs = runtime.breadcrumbs;
        state.propertyPanel = runtime.propertyPanel;
      }

      state.propertyPanel?.refresh();
      installUiResizeClamp();

      state.active = true;
      state.panelOnlyMode = true;
      onStatusChange?.();
      console.log(`${WEB_EDITOR_V2_LOG_PREFIX} Started in panel-only mode`);
    } catch (error) {
      cleanupMountedRuntime();
      state.active = false;
      state.panelOnlyMode = false;
      onStatusChange?.();
      console.error(`${WEB_EDITOR_V2_LOG_PREFIX} Failed to start panel-only:`, error);
    }
  }

  /**
   * Upgrade from panel-only mode to full interaction mode.
   * Reuses the existing shadow host and disposes/recreates the UI runtime
   * so it gets the full set of callbacks.
   */
  function upgradeFromPanelOnly(): void {
    if (!state.active || !state.panelOnlyMode) return;

    // Dispose the lightweight panel-only UI so start() can recreate it
    // with the full set of interaction callbacks.
    state.propertyPanel?.dispose();
    state.propertyPanel = null;
    state.breadcrumbs?.dispose();
    state.breadcrumbs = null;
    state.tokensService?.dispose();
    state.tokensService = null;
    state.uiResizeCleanup?.();
    state.uiResizeCleanup = null;

    // Tear down the shadow host so start() can do a clean mount.
    state.shadowHost?.dispose();
    state.shadowHost = null;
    clearEditorRuntimeRefs(state);

    state.active = false;
    state.panelOnlyMode = false;

    // Delegate to the regular full start().
    start();
  }

  function stopPanelOnly(): void {
    if (!state.active) return;

    state.active = false;
    state.panelOnlyMode = false;

    try {
      cleanupMountedRuntime();
      onStatusChange?.();
      console.log(`${WEB_EDITOR_V2_LOG_PREFIX} Stopped panel-only mode`);
    } catch (error) {
      console.error(`${WEB_EDITOR_V2_LOG_PREFIX} Error during panel-only cleanup:`, error);
      cleanupMountedRuntime();
      onStatusChange?.();
    }
  }

  return { start, startPanelOnly, stop, stopPanelOnly, flushPendingCommentContextSync };
}
