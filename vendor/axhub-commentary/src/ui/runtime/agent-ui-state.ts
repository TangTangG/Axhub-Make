import type { ElementAgentTaskState } from '../../core/editor/state';

export type AgentVisualState = 'sleeping' | 'awake';

export interface DerivedAgentUiState {
  currentTask: ElementAgentTaskState | null;
  currentTaskRunning: boolean;
  currentTaskSessionReady: boolean;
  currentTaskTerminal: boolean;
  pageTaskRunning: boolean;
  pageTaskSessionReady: boolean;
  hasReusableConversation: boolean;
  effectiveVisualState: AgentVisualState;
}

export function isAgentTaskRunning(
  task: Pick<ElementAgentTaskState, 'status'> | null | undefined,
): boolean {
  return task?.status === 'pending' || task?.status === 'created';
}

export function isAgentTaskTerminal(
  task: Pick<ElementAgentTaskState, 'status'> | null | undefined,
): boolean {
  return task?.status === 'completed' || task?.status === 'error';
}

export function deriveAgentUiState(options: {
  currentTarget: Element | null;
  visualState: AgentVisualState;
  getElementAgentTaskState?: ((element: Element | null) => ElementAgentTaskState | null) | undefined;
  getVisibleElementAgentTaskStates?: (() => ElementAgentTaskState[]) | undefined;
  getHasReusableAgentConversation?: (() => boolean) | undefined;
  getAgentBridgeConnected?: (() => boolean) | undefined;
}): DerivedAgentUiState {
  const currentTask = options.getElementAgentTaskState?.(options.currentTarget) ?? null;
  const visibleTasks = options.getVisibleElementAgentTaskStates?.() ?? [];
  const pageTaskRunning = visibleTasks.some((task) => isAgentTaskRunning(task));
  const currentTaskSessionReady = Boolean(
    isAgentTaskRunning(currentTask) && (currentTask?.status === 'created' || currentTask?.sessionId),
  );
  const pageTaskSessionReady = visibleTasks.some(
    (task) => isAgentTaskRunning(task) && (task.status === 'created' || Boolean(task.sessionId)),
  );
  const hasReusableConversation = Boolean(options.getHasReusableAgentConversation?.() ?? false);
  const bridgeConnected = options.getAgentBridgeConnected
    ? Boolean(options.getAgentBridgeConnected())
    : true;
  const effectiveVisualState: AgentVisualState =
    pageTaskRunning || (
      options.visualState === 'awake'
      && (bridgeConnected || hasReusableConversation)
    )
      ? 'awake'
      : 'sleeping';

  return {
    currentTask,
    currentTaskRunning: isAgentTaskRunning(currentTask),
    currentTaskSessionReady,
    currentTaskTerminal: isAgentTaskTerminal(currentTask),
    pageTaskRunning,
    pageTaskSessionReady,
    hasReusableConversation,
    effectiveVisualState,
  };
}
