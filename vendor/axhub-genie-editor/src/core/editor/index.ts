import type {
  GenieEditorApi,
  GenieEditorDebugState,
  GenieEditorEditedSnapshot,
  GenieEditorHostToolbarAction,
  GenieEditorHostToolbarState,
  GenieEditorHostToolbarStateListener,
  GenieEditorModifiedElementSummary,
  GenieEditorState,
  GenieEditorStyleChangeSet,
  GenieEditorStatus,
  GenieEditorStatusListener,
  GenieEditorTextChange,
  SelectedElementSummary,
  WebEditorElementKey,
  WebEditorRevertElementResponse,
} from '../../web-editor-types';
import { WEB_EDITOR_V2_VERSION } from '../../constants';
import { createElementLocator, locateElement } from '../locator';
import { generateFullElementLabel, generateStableElementKey } from '../element-key';
import type { EditorServices } from './contracts';
import { createChangesService } from './changes';
import { createFeedbackService } from './feedback';
import { createGenieBridgeService } from './genie-bridge';
import { createEditorIntegrationWsService } from './integration-ws';
import { createInteractionService } from './interaction';
import { createLifecycleService } from './lifecycle';
import { createLocalActionsService } from './local-actions';
import { createPersistenceService } from './persistence';
import { captureElementScreenshot } from './screenshot';
import {
  createEditorRuntimeState,
  DEFAULT_MODIFIERS,
  resolveWebEditorOptions,
  type ExternalEditingTaskRef,
  type GenieEditorInitOptions,
} from './state';
import { createEditorSummariesService } from './summaries';
import { createTextSessionService } from './text-session';
import { pushMobileModeOverride } from '../../utils/mobile-detect';

export type {
  GenieEditorGenieBridgeOptions,
  GenieEditorIntegrationWsOptions,
  GenieEditorUiOptions,
  GenieEditorInitOptions,
  GenieEditorPromptContextOptions,
  WebEditorV2GenieBridgeOptions,
  WebEditorV2IntegrationWsOptions,
  WebEditorV2UiOptions,
  WebEditorV2InitOptions,
  WebEditorV2PromptContextOptions,
} from './state';
export type {
  GenieEditorDesignAdjustmentTool,
  GenieEditorGenieAgent,
  GenieEditorUiSettings,
  WebEditorGenieAgent,
  WebEditorDesignAdjustmentTool,
  WebEditorUiSettings,
} from './ui-settings';

/**
 * Create the Genie Editor instance.
 *
 * The editor exposes a small local-only API while the implementation stays
 * split across lifecycle, interaction, persistence, and panel services.
 */
export function createGenieEditor(options: GenieEditorInitOptions = {}): GenieEditorApi {
  const resolvedOptions = resolveWebEditorOptions(options);
  const cleanupMobileModeOverride = pushMobileModeOverride(resolvedOptions.mobileMode);
  const state = createEditorRuntimeState();
  const statusListeners = new Set<GenieEditorStatusListener>();
  const hostResourceProjectPath = (() => {
    try {
      return String(resolvedOptions.host.getResourceContext?.()?.meta?.projectPath ?? '').trim();
    } catch {
      return '';
    }
  })();
  const resolvedProjectPath = String(
    resolvedOptions.genieBridge.projectPath || hostResourceProjectPath,
  ).trim();
  const summaries = createEditorSummariesService({
    state,
    promptContext: resolvedOptions.promptContext,
    projectPath: resolvedProjectPath,
    getResourceContext: resolvedOptions.host.getResourceContext,
    buildCopyPromptOverride: resolvedOptions.host.buildCopyPrompt,
  });
  const feedback = createFeedbackService({
    getUiRoot: () => state.shadowHost?.getElements()?.uiRoot ?? null,
  });
  let persistence: ReturnType<typeof createPersistenceService> | null = null;
  let interaction: ReturnType<typeof createInteractionService> | null = null;
  let genieBridge: ReturnType<typeof createGenieBridgeService> | null = null;
  let destroyed = false;

  function buildSelectedElementSummary(): SelectedElementSummary | null {
    const element = state.selectedElement;
    if (!element || !element.isConnected) return null;

    const locator = createElementLocator(element);
    const elementKey = generateStableElementKey(element, locator.shadowHostChain);
    const label = element.id
      ? `${element.tagName.toLowerCase()}#${element.id}`
      : element.tagName.toLowerCase();

    return {
      elementKey,
      locator,
      label,
      fullLabel: generateFullElementLabel(element, locator.shadowHostChain),
      tagName: element.tagName.toLowerCase(),
      updatedAt: Date.now(),
    };
  }

  function getHistoryCounts(): { undoCount: number; redoCount: number } {
    const tm = state.transactionManager;
    return {
      undoCount: tm?.getUndoStack().length ?? 0,
      redoCount: tm?.getRedoStack().length ?? 0,
    };
  }

  function getModifiedElements(): GenieEditorModifiedElementSummary[] {
    return Array.from(state.editMetaByKey.values())
      .filter((meta) => meta.dirtySince !== null)
      .sort((a, b) => Number(a.dirtySince ?? 0) - Number(b.dirtySince ?? 0))
      .map((meta) => ({
        elementKey: meta.elementKey,
        locator: meta.locator,
        label: meta.label,
        note: meta.note,
        imageCount: meta.images.length,
        changeKinds: meta.changeKinds.slice(),
      }));
  }

  function getTextChanges(): GenieEditorTextChange[] {
    return summaries.collectTextChanges();
  }

  function getClearableCount(): number {
    const clearableElementKeys = new Set<WebEditorElementKey>();

    for (const meta of state.editMetaByKey.values()) {
      if (meta.dirtySince !== null) {
        clearableElementKeys.add(meta.elementKey);
      }
    }

    for (const task of genieBridge?.getVisibleTaskStates() ?? []) {
      if (task.status === 'completed' || task.status === 'error') {
        clearableElementKeys.add(task.elementKey);
      }
    }

    return clearableElementKeys.size;
  }

  function getStyleChanges(): GenieEditorStyleChangeSet {
    return summaries.collectStyleChanges();
  }

  function getEditedSnapshot(): GenieEditorEditedSnapshot {
    let resource = null;
    try {
      resource = resolvedOptions.host.getResourceContext?.() ?? null;
    } catch {
      resource = null;
    }

    return {
      resource,
      selectedElement: buildSelectedElementSummary(),
      modifiedElements: getModifiedElements(),
      textChanges: getTextChanges(),
      styleChanges: getStyleChanges(),
    };
  }

  function getDebugState(): GenieEditorDebugState {
    const selectedElement = buildSelectedElementSummary();
    const currentConversation = genieBridge?.getCurrentConversationState() ?? null;
    const currentTask = genieBridge?.getElementTaskState(state.selectedElement) ?? null;
    const visibleTasks = genieBridge?.getVisibleTaskStates() ?? [];
    const bridgeConfig = genieBridge?.getDebugInfo?.() ?? null;
    const integrationWsDebugState = services.integrationWs?.getDebugState() ?? null;

    return {
      available: genieBridge?.isAvailable() ?? false,
      connected: genieBridge?.isConnected() ?? false,
      integrationWsStatus: integrationWsDebugState?.status ?? 'disconnected',
      integrationWsUrl: integrationWsDebugState?.url ?? null,
      integrationWsLastError: integrationWsDebugState?.lastError ?? null,
      bridgeConfig,
      selectedElementKey: selectedElement?.elementKey ?? null,
      currentConversation: currentConversation
        ? {
            scopeKey: currentConversation.scopeKey,
            sessionId: currentConversation.sessionId,
            provider: currentConversation.provider,
            invalidated: currentConversation.invalidated,
            sentCount: currentConversation.sentCount,
            expiresAt: currentConversation.expiresAt,
            sessionUrl: currentConversation.sessionUrl,
          }
        : null,
      hasReusableConversation: genieBridge?.hasReusableConversation() ?? false,
      currentElementTask: currentTask
        ? {
            elementKey: currentTask.elementKey,
            status: currentTask.status,
            sessionId: currentTask.sessionId,
            provider: currentTask.provider,
            message: currentTask.message,
            updatedAt: currentTask.updatedAt,
          }
        : null,
      visibleTasks: visibleTasks.map((task) => ({
        elementKey: task.elementKey,
        status: task.status,
        sessionId: task.sessionId,
        provider: task.provider,
        message: task.message,
        updatedAt: task.updatedAt,
      })),
    };
  }

  function getStatus(): GenieEditorStatus {
    const selectedElement = buildSelectedElementSummary();
    const textChanges = getTextChanges();
    const styleChanges = getStyleChanges();
    const modifiedCount = getModifiedElements().length;
    const clearableCount = getClearableCount();
    const { undoCount, redoCount } = getHistoryCounts();

    return {
      active: state.active,
      hasSelection: selectedElement !== null,
      selectedElement,
      undoCount,
      redoCount,
      modifiedCount,
      clearableCount,
      hasTextChanges: textChanges.length > 0,
      hasStyleChanges: Boolean(styleChanges.cssText),
      hasModifiedElements: modifiedCount > 0,
      hasClearableElements: clearableCount > 0,
    };
  }

  function getFallbackHostToolbarState(): GenieEditorHostToolbarState {
    return {
      toolbarMode: resolvedOptions.ui.toolbarMode,
      visible: false,
      robotState: 'sleeping',
      robotTitle: '打开 AI',
      robotDisabled: true,
      robotLoading: false,
      sendVisible: false,
      sendTitle: '发送给 AI',
      sendDisabled: true,
      sendLoading: false,
      interruptVisible: false,
      interruptTitle: '停止 AI 修改',
      interruptDisabled: true,
      interruptLoading: false,
      copyPromptVisible: false,
      copyPromptTitle: '复制 Prompt',
      copyPromptDisabled: true,
      clearEditsTitle: '清空全部编辑',
      clearEditsDisabled: true,
      propertyPanelOpen: false,
      propertyPanelTitle: '打开设计决策',
      modifiedCount: 0,
      terminalTaskCount: 0,
      selectedAgent: null,
      agentOptions: [{ value: null, label: '默认' }],
      darkMode: false,
      disablePageAnimations: false,
      pageZoomEnabled: false,
      copySkillInstallPromptDisabled: true,
      fullExitAvailable: false,
    };
  }

  function getHostToolbarState(): GenieEditorHostToolbarState {
    return state.propertyPanel?.getHostToolbarState?.() ?? getFallbackHostToolbarState();
  }

  function subscribeHostToolbarState(
    listener: GenieEditorHostToolbarStateListener,
  ): () => void {
    if (state.propertyPanel?.subscribeHostToolbarState) {
      return state.propertyPanel.subscribeHostToolbarState(listener);
    }
    listener(getFallbackHostToolbarState());
    return () => undefined;
  }

  async function runHostToolbarAction(
    action: GenieEditorHostToolbarAction,
  ): Promise<boolean> {
    if (destroyed) return false;
    return state.propertyPanel?.runHostToolbarAction?.(action) ?? false;
  }

  function normalizeExternalTaskRef(
    value: Partial<ExternalEditingTaskRef> | null | undefined,
  ): Partial<ExternalEditingTaskRef> | null {
    if (!value) return null;
    return {
      provider:
        typeof value.provider === 'string' && value.provider.trim() ? value.provider.trim() : null,
      sessionId:
        typeof value.sessionId === 'string' && value.sessionId.trim()
          ? value.sessionId.trim()
          : null,
      requestId:
        typeof value.requestId === 'string' && value.requestId.trim()
          ? value.requestId.trim()
          : null,
    };
  }

  function getTaskStateLabel(
    taskStatus: string | null | undefined,
  ): 'idle' | 'editing' | 'completed' | 'error' {
    if (taskStatus === 'pending' || taskStatus === 'created') {
      return 'editing';
    }
    if (taskStatus === 'completed') {
      return 'completed';
    }
    if (taskStatus === 'error') {
      return 'error';
    }
    return 'idle';
  }

  type EditorNodeChangeState = 'clean' | 'dirty' | 'handled';
  type EditorNodeTaskState = 'idle' | 'editing' | 'completed' | 'error';
  type EditorNodeItem = {
    elementKey: string;
    label: string;
    changeState: EditorNodeChangeState;
    taskState: EditorNodeTaskState;
    hasNote: boolean;
    hasImages: boolean;
    changeKinds: string[];
    dirtySince: number | null;
    lastHandledAt: number | null;
  };

  function resolveElementByKey(elementKey: string): Element | null {
    const selectedSummary = buildSelectedElementSummary();
    if (selectedSummary?.elementKey === elementKey && state.selectedElement?.isConnected) {
      return state.selectedElement;
    }

    const locator =
      state.editMetaByKey.get(elementKey)?.locator ??
      genieBridge?.getTaskStateByElementKey?.(elementKey)?.locator ??
      state.externalEditingTaskByElementKey.get(elementKey)?.locator ??
      state.genieTaskByElementKey.get(elementKey)?.locator ??
      null;
    if (!locator) return null;

    try {
      const element = locateElement(locator);
      return element?.isConnected ? element : null;
    } catch {
      return null;
    }
  }

  function listEditorNodes(): EditorNodeItem[] {
    const nodeKeys = new Set<string>([
      ...state.editMetaByKey.keys(),
      ...state.processedEditTimestampsByKey.keys(),
      ...state.genieTaskByElementKey.keys(),
      ...state.externalEditingTaskByElementKey.keys(),
    ]);

    const items = Array.from(nodeKeys)
      .map((elementKey) => {
        const meta = state.editMetaByKey.get(elementKey) ?? null;
        const task =
          genieBridge?.getTaskStateByElementKey?.(elementKey) ??
          state.externalEditingTaskByElementKey.get(elementKey) ??
          state.genieTaskByElementKey.get(elementKey) ??
          null;
        const lastHandledAtRaw = state.processedEditTimestampsByKey.get(elementKey);
        const lastHandledAt = Number.isFinite(Number(lastHandledAtRaw))
          ? Number(lastHandledAtRaw)
          : null;
        const hasNote = Boolean(String(meta?.note ?? '').trim());
        const hasImages = Boolean(meta?.images.length);
        const dirtySince = Number.isFinite(Number(meta?.dirtySince))
          ? Number(meta?.dirtySince)
          : null;
        const hasUnprocessedDirty =
          dirtySince !== null && (lastHandledAt === null || dirtySince > lastHandledAt);
        const changeState: EditorNodeChangeState =
          hasNote || hasImages || hasUnprocessedDirty
            ? 'dirty'
            : lastHandledAt !== null
              ? 'handled'
              : 'clean';
        const label =
          meta?.label ??
          task?.label ??
          (buildSelectedElementSummary()?.elementKey === elementKey
            ? buildSelectedElementSummary()?.fullLabel
            : null) ??
          elementKey;
        const taskState = getTaskStateLabel(task?.status);

        return {
          elementKey,
          label,
          changeState,
          taskState,
          hasNote,
          hasImages,
          changeKinds: meta?.changeKinds.slice() ?? [],
          dirtySince,
          lastHandledAt,
        };
      })
      .sort((a, b) => {
        const aTs = Math.max(Number(a.dirtySince ?? 0), Number(a.lastHandledAt ?? 0));
        const bTs = Math.max(Number(b.dirtySince ?? 0), Number(b.lastHandledAt ?? 0));
        if (aTs !== bTs) return bTs - aTs;
        return a.label.localeCompare(b.label);
      });

    return items;
  }

  function getEditedSnapshotPayload() {
    const snapshot = getEditedSnapshot();
    const nodeStateCounts = {
      clean: 0,
      dirty: 0,
      handled: 0,
      editing: 0,
      completed: 0,
      error: 0,
    } as Record<'clean' | 'dirty' | 'handled' | 'editing' | 'completed' | 'error', number>;
    const items = listEditorNodes();
    for (const item of items) {
      nodeStateCounts[item.changeState] += 1;
      if (
        item.taskState === 'editing' ||
        item.taskState === 'completed' ||
        item.taskState === 'error'
      ) {
        nodeStateCounts[item.taskState] += 1;
      }
    }

    return {
      ...snapshot,
      statusSummary: {
        active: getStatus().active,
        modifiedCount: items.filter((item) => item.changeState !== 'clean').length,
        nodeStateCounts,
      },
    };
  }

  function getContextImagesPayload() {
    const items = Array.from(state.editMetaByKey.values())
      .flatMap((meta) =>
        meta.images.map((image) => ({
          id: image.id,
          name: image.name,
          data: image.data,
          mimeType: image.mimeType,
          createdAt: image.createdAt,
          source: 'prompt-context' as const,
        })),
      )
      .sort((a, b) => a.createdAt - b.createdAt);

    return { items };
  }

  async function getNodeScreenshotPayload(elementKey: string) {
    const targetElement = resolveElementByKey(elementKey);
    if (!targetElement) {
      throw new Error(`NOT_FOUND: Element not found for key: ${elementKey}`);
    }

    const screenshot = await captureElementScreenshot(targetElement, elementKey);
    return {
      elementKey,
      image: screenshot,
      mimeType: 'image/png' as const,
      width: screenshot.width,
      height: screenshot.height,
    };
  }

  type EditingSetState = 'editing' | 'idle' | 'completed' | 'error';

  async function setNodeEditingState(
    elementKey: string,
    nextState: EditingSetState,
    taskRef: Partial<ExternalEditingTaskRef> | null,
  ) {
    const targetElement = resolveElementByKey(elementKey);
    if (!targetElement) {
      throw new Error(`NOT_FOUND: Element not found for key: ${elementKey}`);
    }

    if (!genieBridge?.setExternalEditingState || !genieBridge.clearExternalEditingState) {
      throw new Error('NOT_IMPLEMENTED: External editing state control is unavailable');
    }

    if (nextState === 'editing') {
      genieBridge.setExternalEditingState(targetElement, taskRef);
    } else if (nextState === 'idle') {
      genieBridge.clearExternalEditingState(targetElement, taskRef);
    } else if (nextState === 'completed' || nextState === 'error') {
      if (!genieBridge.setExternalEditingTerminalState) {
        // Fallback: treat completed as idle (clear), treat error as idle (clear)
        genieBridge.clearExternalEditingState(targetElement, taskRef);
      } else {
        genieBridge.setExternalEditingTerminalState(targetElement, nextState, taskRef);
      }
    }
    notifyStatusChange();

    const normalizedTaskRef = normalizeExternalTaskRef(taskRef);
    persistence?.recordCommentTaskState?.(elementKey, nextState, normalizedTaskRef);
    return {
      elementKey,
      state: nextState,
      applied: true,
      ...(normalizedTaskRef ? { taskRef: normalizedTaskRef } : {}),
    };
  }

  function notifyStatusChange(): void {
    const status = getStatus();
    for (const listener of statusListeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('[GenieEditor] Status listener failed:', error);
      }
    }
  }

  const changes = createChangesService({
    state,
    scheduleCacheWrite: () => persistence?.scheduleWrite(),
    persistMarkerVisibility: (visible) => persistence?.setMarkerVisibility(visible),
    onSelectMarkedElement: (element, anchor) => {
      if (!element.isConnected) return;
      state.eventController?.setMode('selecting');
      interaction?.handleSelect(element, DEFAULT_MODIFIERS, {
        clientX: anchor.clientX,
        clientY: anchor.clientY,
      });
    },
    onStatusChange: notifyStatusChange,
  });

  const textSession = createTextSessionService({
    state,
    ensureSelected: (element, modifiers) => {
      interaction?.handleSelect(element, modifiers);
    },
    logPrefix: '[WebEditorV2]',
  });

  persistence = createPersistenceService({
    state,
    changes,
    getResourceContext: resolvedOptions.host.getResourceContext,
    interactionProfile: resolvedOptions.interactionProfile,
  });

  let flushPendingCommentContextSync: (() => void) | null = null;

  genieBridge = createGenieBridgeService({
    state,
    changes,
    feedback,
    persistence,
    summaries,
    bridgeOptions: {
      ...resolvedOptions.genieBridge,
      projectPath: resolvedProjectPath,
    },
    onAvailabilityChange: (available) => {
      if (genieBridge?.isConnected() && !state.uiSettings.genieAwake) {
        state.uiSettings = {
          ...state.uiSettings,
          genieAwake: true,
        };
      }
      if (available) {
        flushPendingCommentContextSync?.();
      }
      state.breadcrumbs?.refresh();
      state.propertyPanel?.refresh();
    },
  });

  const integrationWs = createEditorIntegrationWsService({
    integrationWsOptions: resolvedOptions.integrationWs,
    getPageUrl: () => {
      if (typeof window === 'undefined') return resolvedOptions.integrationWs.pageUrl || null;
      return (
        String(resolvedOptions.integrationWs.pageUrl || window.location.href || '').trim() || null
      );
    },
    getSessionId: () => {
      const integrationSessionId = String(resolvedOptions.integrationWs.sessionId ?? '').trim();
      if (integrationSessionId) return integrationSessionId;
      return genieBridge?.getCurrentConversationState()?.sessionId ?? null;
    },
    getEditedSnapshotPayload,
    listEditorNodes,
    getContextImagesPayload,
    getNodeScreenshotPayload,
    setNodeEditingState,
    onConnectionStatusChange: () => {
      notifyStatusChange();
    },
  });

  interaction = createInteractionService({
    state,
    changes,
    persistence,
    textSession,
    genieBridge,
    logPrefix: '[WebEditorV2]',
    onStatusChange: notifyStatusChange,
  });

  const localActions = createLocalActionsService({
    state,
    feedback,
    changes,
    interaction,
    summaries,
    persistence,
    onStatusChange: notifyStatusChange,
  });

  const services: EditorServices = {
    feedback,
    summaries,
    changes,
    persistence,
    textSession,
    interaction,
    genieBridge,
    integrationWs,
    localActions,
  };

  const lifecycle = createLifecycleService({
    state,
    options: resolvedOptions,
    services,
    onStatusChange: notifyStatusChange,
  });
  flushPendingCommentContextSync = lifecycle.flushPendingCommentContextSync;

  function start(): void {
    if (destroyed) return;
    lifecycle.start();
  }

  function startPanelOnly(): void {
    if (destroyed) return;
    lifecycle.startPanelOnly();
  }

  function stop(): void {
    if (destroyed) return;
    lifecycle.stop();
  }

  function stopPanelOnly(): void {
    if (destroyed) return;
    lifecycle.stopPanelOnly();
  }

  function toggle(): boolean {
    if (destroyed) return false;
    if (state.active) {
      stop();
    } else {
      start();
    }
    return state.active;
  }

  function getState(): GenieEditorState {
    return {
      active: state.active,
      panelOnlyMode: state.panelOnlyMode,
      version: WEB_EDITOR_V2_VERSION,
    };
  }

  function subscribeStatus(listener: GenieEditorStatusListener): () => void {
    statusListeners.add(listener);
    listener(getStatus());
    return () => {
      statusListeners.delete(listener);
    };
  }

  function clearSelection(): void {
    if (destroyed) return;
    interaction?.clearSelection();
    notifyStatusChange();
  }

  function acknowledgeSavedTextChanges(): void {
    if (destroyed) return;
    persistence?.clearCachedChanges('text');
    notifyStatusChange();
  }

  function acknowledgeSavedStyleChanges(): void {
    if (destroyed) return;
    persistence?.clearCachedChanges('style');
    notifyStatusChange();
  }

  async function clearElementEdits(elementKey: string): Promise<boolean> {
    if (destroyed) return false;

    const meta = state.editMetaByKey.get(elementKey);
    if (!meta) return false;

    let element: Element | null = null;
    try {
      element = locateElement(meta.locator);
    } catch {
      element = null;
    }

    if (!element?.isConnected) return false;

    const cleared = await localActions.handleClearElementEdits(element);
    notifyStatusChange();
    return cleared;
  }

  async function clearAllEdits(): Promise<void> {
    if (destroyed) return;
    await localActions.handleClearEdits({ skipConfirm: true });
    for (const task of genieBridge?.getVisibleTaskStates() ?? []) {
      if (task.status !== 'completed' && task.status !== 'error') {
        continue;
      }
      const element = resolveElementByKey(task.elementKey);
      if (element?.isConnected) {
        genieBridge?.dismissElementTaskState(element);
      }
    }
    notifyStatusChange();
  }

  async function revertElement(elementKey: string): Promise<WebEditorRevertElementResponse> {
    if (destroyed) {
      return {
        success: false,
        error: 'Genie Editor instance has been destroyed.',
      };
    }
    if (!interaction) {
      return {
        success: false,
        error: 'Genie Editor interaction service is not ready.',
      };
    }
    const result = await interaction.revertElement(elementKey);
    notifyStatusChange();
    return result;
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    lifecycle.stop();
    statusListeners.clear();
    cleanupMobileModeOverride();
  }

  return {
    start,
    startPanelOnly,
    stop,
    stopPanelOnly,
    destroy,
    toggle,
    getState,
    getStatus,
    subscribeStatus,
    getSelectedElement: buildSelectedElementSummary,
    getModifiedElements,
    getTextChanges,
    getStyleChanges,
    getEditedSnapshot,
    getDebugState,
    getHistoryCounts,
    revertElement,
    clearSelection,
    acknowledgeSavedTextChanges,
    acknowledgeSavedStyleChanges,
    clearElementEdits,
    clearAllEdits,
    getHostToolbarState,
    subscribeHostToolbarState,
    runHostToolbarAction,
    getCopyPromptText: () => summaries.buildCopyPrompt(),
  };
}

export function createWebEditorV2(options: GenieEditorInitOptions = {}) {
  return createGenieEditor(options);
}
