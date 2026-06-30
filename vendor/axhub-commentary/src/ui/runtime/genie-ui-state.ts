import type { ElementGenieTaskState } from '../../core/editor/state';

export type GenieVisualState = 'sleeping' | 'awake';

export interface DerivedGenieUiState {
  currentTask: ElementGenieTaskState | null;
  currentTaskRunning: boolean;
  currentTaskSessionReady: boolean;
  currentTaskTerminal: boolean;
  pageTaskRunning: boolean;
  pageTaskSessionReady: boolean;
  hasReusableConversation: boolean;
  effectiveVisualState: GenieVisualState;
}

export function isGenieTaskRunning(
  task: Pick<ElementGenieTaskState, 'status'> | null | undefined,
): boolean {
  return task?.status === 'pending' || task?.status === 'created';
}

export function isGenieTaskTerminal(
  task: Pick<ElementGenieTaskState, 'status'> | null | undefined,
): boolean {
  return task?.status === 'completed' || task?.status === 'error';
}

export function deriveGenieUiState(options: {
  currentTarget: Element | null;
  visualState: GenieVisualState;
  getElementGenieTaskState?: ((element: Element | null) => ElementGenieTaskState | null) | undefined;
  getVisibleElementGenieTaskStates?: (() => ElementGenieTaskState[]) | undefined;
  getHasReusableGenieConversation?: (() => boolean) | undefined;
  getGenieBridgeConnected?: (() => boolean) | undefined;
}): DerivedGenieUiState {
  const currentTask = options.getElementGenieTaskState?.(options.currentTarget) ?? null;
  const visibleTasks = options.getVisibleElementGenieTaskStates?.() ?? [];
  const pageTaskRunning = visibleTasks.some((task) => isGenieTaskRunning(task));
  const currentTaskSessionReady = Boolean(
    isGenieTaskRunning(currentTask) && (currentTask?.status === 'created' || currentTask?.sessionId),
  );
  const pageTaskSessionReady = visibleTasks.some(
    (task) => isGenieTaskRunning(task) && (task.status === 'created' || Boolean(task.sessionId)),
  );
  const hasReusableConversation = Boolean(options.getHasReusableGenieConversation?.() ?? false);
  const bridgeConnected = options.getGenieBridgeConnected
    ? Boolean(options.getGenieBridgeConnected())
    : true;
  const effectiveVisualState: GenieVisualState =
    pageTaskRunning || (
      options.visualState === 'awake'
      && (bridgeConnected || hasReusableConversation)
    )
      ? 'awake'
      : 'sleeping';

  return {
    currentTask,
    currentTaskRunning: isGenieTaskRunning(currentTask),
    currentTaskSessionReady,
    currentTaskTerminal: isGenieTaskTerminal(currentTask),
    pageTaskRunning,
    pageTaskSessionReady,
    hasReusableConversation,
    effectiveVisualState,
  };
}
