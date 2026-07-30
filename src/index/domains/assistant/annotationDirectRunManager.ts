import type { ElementLocator } from '@/common/web-editor-types';

export interface AnnotationDirectRunTaskRef {
  provider: string | null;
  sessionId: string | null;
  requestId: string | null;
  error?: string | null;
  code?: string | null;
  output?: string | null;
  chunk?: unknown;
  details?: unknown;
}

export interface AnnotationDirectRunEditingTarget {
  pane?: 'primary' | 'secondary';
  iframe?: HTMLIFrameElement | null;
  elementKey: string;
  targetRef?: {
    locator?: ElementLocator | null;
    label?: string | null;
  } | null;
}

export interface AnnotationDirectRunSubmitPayload {
  provider?: string | null;
  threadId?: string | null;
  conversationId?: string | null;
  runId?: string | null;
}

export interface AnnotationDirectRunSubmitRequest<TContext> {
  context: TContext;
  prompt: string;
  editingTargets?: AnnotationDirectRunEditingTarget[];
  signal: AbortSignal;
  onPrepared?: (payload: AnnotationDirectRunSubmitPayload) => void | Promise<void>;
  onAccepted?: (payload: AnnotationDirectRunSubmitPayload) => void | Promise<void>;
}

export type AnnotationDirectRunSubmitResult =
  | boolean
  | void
  | {
      runId?: string | null;
      threadId?: string | null;
      conversationId?: string | null;
      provider?: string | null;
    };

export type AnnotationDirectRunEvent =
  | {
      type: 'started';
      runKey: string;
      taskRef: AnnotationDirectRunTaskRef;
      editingTargets?: AnnotationDirectRunEditingTarget[];
    }
  | {
      type: 'prepared' | 'accepted';
      runKey: string;
      taskRef: AnnotationDirectRunTaskRef;
      editingTargets?: AnnotationDirectRunEditingTarget[];
    }
  | {
      type: 'completed' | 'aborted';
      runKey: string;
      taskRef: AnnotationDirectRunTaskRef;
      editingTargets?: AnnotationDirectRunEditingTarget[];
    }
  | {
      type: 'error';
      runKey: string;
      taskRef: AnnotationDirectRunTaskRef;
      error: unknown;
      editingTargets?: AnnotationDirectRunEditingTarget[];
    }
  | {
      type: 'settled';
      runKey: string;
      activeRunCount: number;
    };

type AnnotationDirectRunTerminalEvent = Extract<
  AnnotationDirectRunEvent,
  { type: 'completed' | 'aborted' | 'error' }
>;

export type AnnotationDirectRunEventListener = (
  event: AnnotationDirectRunEvent,
) => void | Promise<void>;

export interface AnnotationDirectRunStartOptions<TContext> {
  context: TContext;
  prompt: string;
  maxActiveRuns: number;
  editingTargets?: AnnotationDirectRunEditingTarget[];
  submit: (
    request: AnnotationDirectRunSubmitRequest<TContext>,
  ) => Promise<AnnotationDirectRunSubmitResult>;
  onEvent?: AnnotationDirectRunEventListener;
}

export type AnnotationDirectRunStartResult =
  | {
      started: true;
      runKey: string;
      controller: AbortController;
      promise: Promise<boolean>;
      abort: () => Promise<boolean>;
    }
  | {
      started: false;
      reason: 'concurrency';
      activeRunCount: number;
    };

interface ActiveAnnotationDirectRun {
  runKey: string;
  controller: AbortController;
  taskRef: AnnotationDirectRunTaskRef;
  editingTargets?: AnnotationDirectRunEditingTarget[];
  onEvent?: AnnotationDirectRunEventListener;
  terminalEmitted: boolean;
}

export interface AnnotationDirectRunRegistry {
  startRun<TContext>(
    options: AnnotationDirectRunStartOptions<TContext>,
  ): AnnotationDirectRunStartResult;
  abortAll(): Promise<number>;
  getActiveRunCount(): number;
}

function defaultCreateRequestId(): string {
  return `annotation-direct-${Date.now()}`;
}

function isAbortError(error: unknown): boolean {
  const name = typeof (error as { name?: unknown } | null)?.name === 'string'
    ? String((error as { name?: string }).name)
    : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return name === 'AbortError' || message.includes('aborted');
}

function normalizeTaskRef(
  payload: AnnotationDirectRunSubmitPayload | null | undefined,
  fallback: AnnotationDirectRunTaskRef,
): AnnotationDirectRunTaskRef {
  return {
    provider: String(payload?.provider || fallback.provider || 'api') || null,
    sessionId: String(payload?.threadId || payload?.conversationId || fallback.sessionId || '') || null,
    requestId: String(payload?.runId || fallback.requestId || '') || null,
  };
}

async function emitRunEvent(
  activeRun: ActiveAnnotationDirectRun,
  event: AnnotationDirectRunEvent,
): Promise<void> {
  await activeRun.onEvent?.(event);
}

async function emitTerminalOnce(
  activeRun: ActiveAnnotationDirectRun,
  event: AnnotationDirectRunTerminalEvent,
): Promise<boolean> {
  if (activeRun.terminalEmitted) {
    return false;
  }
  activeRun.terminalEmitted = true;
  await emitRunEvent(activeRun, event);
  return true;
}

export function createAnnotationDirectRunRegistry(options: {
  createRequestId?: () => string;
} = {}): AnnotationDirectRunRegistry {
  const createRequestId = options.createRequestId || defaultCreateRequestId;
  const activeRuns = new Map<string, ActiveAnnotationDirectRun>();
  let sequence = 0;

  function getActiveRunCount(): number {
    return Array.from(activeRuns.values())
      .filter((activeRun) => !activeRun.controller.signal.aborted)
      .length;
  }

  function startRun<TContext>(
    startOptions: AnnotationDirectRunStartOptions<TContext>,
  ): AnnotationDirectRunStartResult {
    const activeRunCount = getActiveRunCount();
    const maxActiveRuns = Math.max(1, Math.floor(Number(startOptions.maxActiveRuns) || 1));
    if (activeRunCount >= maxActiveRuns) {
      return {
        started: false,
        reason: 'concurrency',
        activeRunCount,
      };
    }

    const controller = new AbortController();
    const requestId = createRequestId();
    sequence += 1;
    const runKey = `${requestId}-${sequence}`;
    const activeRun: ActiveAnnotationDirectRun = {
      runKey,
      controller,
      taskRef: {
        provider: 'api',
        sessionId: null,
        requestId,
      },
      editingTargets: startOptions.editingTargets,
      onEvent: startOptions.onEvent,
      terminalEmitted: false,
    };
    activeRuns.set(runKey, activeRun);

    const promise = (async () => {
      try {
        await emitRunEvent(activeRun, {
          type: 'started',
          runKey,
          taskRef: activeRun.taskRef,
          editingTargets: activeRun.editingTargets,
        });
        if (controller.signal.aborted) {
          await emitTerminalOnce(activeRun, {
            type: 'aborted',
            runKey,
            taskRef: activeRun.taskRef,
            editingTargets: activeRun.editingTargets,
          });
          return false;
        }
        const submitted = await startOptions.submit({
          context: startOptions.context,
          prompt: startOptions.prompt,
          editingTargets: activeRun.editingTargets,
          signal: controller.signal,
          onPrepared: async (payload) => {
            activeRun.taskRef = normalizeTaskRef(payload, activeRun.taskRef);
            await emitRunEvent(activeRun, {
              type: 'prepared',
              runKey,
              taskRef: activeRun.taskRef,
              editingTargets: activeRun.editingTargets,
            });
          },
          onAccepted: async (payload) => {
            activeRun.taskRef = normalizeTaskRef(payload, activeRun.taskRef);
            await emitRunEvent(activeRun, {
              type: 'accepted',
              runKey,
              taskRef: activeRun.taskRef,
              editingTargets: activeRun.editingTargets,
            });
          },
        });
        if (controller.signal.aborted) {
          await emitTerminalOnce(activeRun, {
            type: 'aborted',
            runKey,
            taskRef: activeRun.taskRef,
            editingTargets: activeRun.editingTargets,
          });
          return false;
        }
        if (submitted === false) {
          throw new Error('AI execution failed');
        }
        if (submitted && typeof submitted === 'object') {
          activeRun.taskRef = normalizeTaskRef(submitted, activeRun.taskRef);
        }
        await emitTerminalOnce(activeRun, {
          type: 'completed',
          runKey,
          taskRef: activeRun.taskRef,
          editingTargets: activeRun.editingTargets,
        });
        return true;
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          await emitTerminalOnce(activeRun, {
            type: 'aborted',
            runKey,
            taskRef: activeRun.taskRef,
            editingTargets: activeRun.editingTargets,
          });
        } else {
          await emitTerminalOnce(activeRun, {
            type: 'error',
            runKey,
            taskRef: activeRun.taskRef,
            error,
            editingTargets: activeRun.editingTargets,
          });
        }
        return false;
      } finally {
        activeRuns.delete(runKey);
        await emitRunEvent(activeRun, {
          type: 'settled',
          runKey,
          activeRunCount: getActiveRunCount(),
        });
      }
    })();

    return {
      started: true,
      runKey,
      controller,
      promise,
      abort: async () => {
        if (controller.signal.aborted) {
          return false;
        }
        controller.abort();
        await emitTerminalOnce(activeRun, {
          type: 'aborted',
          runKey,
          taskRef: activeRun.taskRef,
          editingTargets: activeRun.editingTargets,
        });
        return true;
      },
    };
  }

  async function abortAll(): Promise<number> {
    const activeRunList = Array.from(activeRuns.values())
      .filter((activeRun) => !activeRun.controller.signal.aborted);
    await Promise.all(activeRunList.map(async (activeRun) => {
      activeRun.controller.abort();
      await emitTerminalOnce(activeRun, {
        type: 'aborted',
        runKey: activeRun.runKey,
        taskRef: activeRun.taskRef,
        editingTargets: activeRun.editingTargets,
      });
    }));
    return activeRunList.length;
  }

  return {
    startRun,
    abortAll,
    getActiveRunCount,
  };
}
