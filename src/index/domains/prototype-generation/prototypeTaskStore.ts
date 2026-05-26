import type { ItemData, PromptClientPreference } from '../../types';
import { toGenieProvider } from '../../../common/promptExecution';
import type { GenieProvider } from '../../../common/genie/types';
import {
  runGeniePrototypeAgent,
  type PrototypeGenerationAgentEvent,
  type PrototypeGenerationPrototypeContext,
  type PrototypeGenerationSettings,
} from './genieAgentClient';

export type PrototypeGenerationTaskStatus = 'running' | 'done' | 'error';
export type PrototypeGenerationTaskStage =
  | 'submitting'
  | 'running'
  | 'refreshing'
  | 'done'
  | 'error';

export interface PrototypeGenerationTaskRecord {
  id: string;
  prompt: string;
  status: PrototypeGenerationTaskStatus;
  stage: PrototypeGenerationTaskStage;
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
  elapsed: number | null;
  sessionId?: string;
  acpxSessionName?: string;
  runId?: string;
  recoverable?: true;
  provider: GenieProvider;
  outputPrototypeName?: string;
  note?: string;
}

export interface PrototypeGenerationSubmitRequest {
  prompt: string;
  preferredPromptClient?: PromptClientPreference;
  canvasFilePath?: string;
  canvasName?: string;
  generatorElementId: string;
  currentPrototype?: PrototypeGenerationPrototypeContext | null;
  knownPrototypes?: PrototypeGenerationPrototypeContext[];
  referenceImages?: string[];
  settings?: PrototypeGenerationSettings;
}

export interface PrototypeGenerationTaskStore {
  getTasks(): PrototypeGenerationTaskRecord[];
  configure(options: { targetPath?: string | null }): Promise<void>;
  subscribe(listener: () => void): () => void;
  submit(request: PrototypeGenerationSubmitRequest, options?: {
    onCreated?: (task: PrototypeGenerationTaskRecord) => void;
    onAgentDone?: (task: PrototypeGenerationTaskRecord) => Promise<ItemData | null>;
  }): Promise<PrototypeGenerationTaskRecord>;
  deleteTask(taskId: string): void;
}

interface PrototypeGenerationTaskStoreOptions {
  now?: () => number;
}

const HISTORY_LIMIT = 30;

function createTaskId(): string {
  return `prototype-task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function resolveProvider(preferredPromptClient?: PromptClientPreference): GenieProvider {
  return toGenieProvider(preferredPromptClient ?? null) || 'codex';
}

function normalizeTargetPath(value: string | null | undefined): string | undefined {
  const normalized = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/u, '');
  const match = normalized.match(/^prototypes\/([^/]+)$/u);
  if (!match?.[1] || match[1].startsWith('.') || match[1].includes('..')) {
    return undefined;
  }
  return `prototypes/${match[1]}`;
}

function historyEndpoint(targetPath: string): string {
  return `/api/ai-image/history?targetPath=${encodeURIComponent(targetPath)}`;
}

function normalizeLoadedPrototypeTasks(value: unknown): PrototypeGenerationTaskRecord[] {
  if (!value || typeof value !== 'object') return [];
  const data = value as { prototypeTasks?: unknown };
  return Array.isArray(data.prototypeTasks)
    ? data.prototypeTasks
        .filter((task): task is PrototypeGenerationTaskRecord => Boolean((task as PrototypeGenerationTaskRecord | undefined)?.id))
        .slice(0, HISTORY_LIMIT)
    : [];
}

function derivePrototypeIdFromTargetPath(value: string | undefined): string | null {
  const normalized = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/u, '');
  const match = normalized.match(/^prototypes\/([^/]+)$/u);
  return match?.[1] || null;
}

function derivePrototypeIdFromCanvasPath(canvasFilePath: string | undefined): string | null {
  const normalized = String(canvasFilePath || '').trim().replace(/\\/g, '/').replace(/^src\//u, '');
  const match = normalized.match(/(?:^|\/)prototypes\/([^/]+)\/canvas(?:\.excalidraw)?$/u);
  return match?.[1] || null;
}

function deriveTargetPathFromCanvasPath(canvasFilePath: string | undefined): string | undefined {
  const prototypeId = derivePrototypeIdFromCanvasPath(canvasFilePath);
  return prototypeId ? `prototypes/${prototypeId}` : undefined;
}

function trimPrototypeTasks(input: PrototypeGenerationTaskRecord[]): PrototypeGenerationTaskRecord[] {
  return [...input]
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, HISTORY_LIMIT);
}

function createPrototypeSessionRecord(params: {
  task: PrototypeGenerationTaskRecord;
  targetPath?: string;
  canvasFilePath?: string;
  generatorElementId: string;
}): Record<string, unknown> | null {
  const acpxSessionName = params.task.acpxSessionName || params.task.sessionId;
  const prototypeId = derivePrototypeIdFromTargetPath(params.targetPath)
    || derivePrototypeIdFromCanvasPath(params.canvasFilePath);
  if (!prototypeId || !acpxSessionName) return null;
  return {
    prototypeId,
    generatorElementId: params.generatorElementId,
    acpxSessionName,
    lastRun: {
      runId: params.task.runId || params.task.id,
      status: params.task.status,
      stage: params.task.stage,
      prompt: params.task.prompt,
      createdAt: params.task.createdAt,
      ...(params.task.finishedAt !== null ? { finishedAt: params.task.finishedAt } : {}),
      ...(params.task.elapsed !== null ? { elapsed: params.task.elapsed } : {}),
      ...(params.task.error ? { error: params.task.error } : {}),
    },
  };
}

function findKnownAcpxSessionName(params: {
  sessions: unknown;
  targetPath?: string;
  canvasFilePath?: string;
  generatorElementId: string;
}): string | undefined {
  const prototypeId = derivePrototypeIdFromTargetPath(params.targetPath)
    || derivePrototypeIdFromCanvasPath(params.canvasFilePath);
  if (!prototypeId || !Array.isArray(params.sessions)) return undefined;
  const session = params.sessions.find((item) => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return record.prototypeId === prototypeId && record.generatorElementId === params.generatorElementId;
  });
  if (!session || typeof session !== 'object') return undefined;
  const acpxSessionName = (session as Record<string, unknown>).acpxSessionName;
  return typeof acpxSessionName === 'string' && acpxSessionName.trim()
    ? acpxSessionName.trim()
    : undefined;
}

function upsertPrototypeSession(
  sessions: unknown,
  nextSession: Record<string, unknown> | null,
): unknown[] {
  const existing = Array.isArray(sessions) ? sessions : [];
  if (!nextSession) return existing;
  return [
    nextSession,
    ...existing.filter((session) => {
      if (!session || typeof session !== 'object') return true;
      const record = session as Record<string, unknown>;
      return !(
        record.prototypeId === nextSession.prototypeId
        && record.generatorElementId === nextSession.generatorElementId
      );
    }),
  ];
}

export function createPrototypeGenerationTaskStore(
  options: PrototypeGenerationTaskStoreOptions = {},
): PrototypeGenerationTaskStore {
  const now = options.now || (() => Date.now());
  let tasks: PrototypeGenerationTaskRecord[] = [];
  let targetPath: string | undefined;
  let lastRemoteHistory: Record<string, any> = {};
  let loadRevision = 0;
  let persistQueue: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const upsertTask = (task: PrototypeGenerationTaskRecord) => {
    tasks = trimPrototypeTasks([task, ...tasks.filter((item) => item.id !== task.id)]);
    emit();
  };

  const replaceTask = (previousTaskId: string, task: PrototypeGenerationTaskRecord) => {
    tasks = trimPrototypeTasks([task, ...tasks.filter((item) => item.id !== previousTaskId && item.id !== task.id)]);
    emit();
  };

  const persist = (options: { session?: Record<string, unknown> | null } = {}) => {
    if (!targetPath) return Promise.resolve();
    const revision = loadRevision;
    const persistTargetPath = targetPath;
    const runPersist = async () => {
      if (!persistTargetPath || revision !== loadRevision) return;
      const payload = {
        ...lastRemoteHistory,
        prototypeTasks: trimPrototypeTasks(tasks),
        prototypeSessions: upsertPrototypeSession(lastRemoteHistory.prototypeSessions, options.session || null),
      };
      try {
        const response = await fetch(historyEndpoint(persistTargetPath), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`保存原型生成历史失败 (${response.status})`);
        }
        const body = await response.json().catch(() => null);
        if (revision !== loadRevision) return;
        lastRemoteHistory = body && typeof body === 'object' ? body : payload;
        tasks = trimPrototypeTasks(tasks);
        emit();
      } catch (error) {
        console.warn('[Axhub Prototype Generation] Failed to persist generation history:', error);
      }
    };
    const operation = persistQueue.then(runPersist, runPersist);
    persistQueue = operation.catch(() => undefined);
    return operation;
  };

  const updateFromAgentEvent = (task: PrototypeGenerationTaskRecord, event: PrototypeGenerationAgentEvent) => {
    const nextStage: PrototypeGenerationTaskStage = event.stage === 'accepted'
      ? 'submitting'
      : event.stage === 'completed'
        ? 'refreshing'
        : event.stage === 'error'
          ? 'error'
          : 'running';
    const nextTask: PrototypeGenerationTaskRecord = {
      ...task,
      stage: nextStage,
      ...(event.sessionId ? { sessionId: event.sessionId, acpxSessionName: event.sessionId } : {}),
      ...(event.stage === 'error' ? { status: 'error', error: event.message || 'AI 生成执行失败' } : {}),
    };
    upsertTask(nextTask);
    return nextTask;
  };

  return {
    getTasks: () => tasks,
    async configure({ targetPath: nextTargetPath }) {
      const normalizedTargetPath = normalizeTargetPath(nextTargetPath);
      if (normalizedTargetPath === targetPath) return;
      targetPath = normalizedTargetPath;
      loadRevision += 1;
      tasks = [];
      lastRemoteHistory = {};
      persistQueue = Promise.resolve();
      emit();
      if (!targetPath) return;
      const revision = loadRevision;
      try {
        const response = await fetch(historyEndpoint(targetPath));
        if (!response.ok) {
          throw new Error(`加载原型生成历史失败 (${response.status})`);
        }
        const body = await response.json().catch(() => null);
        if (revision !== loadRevision) return;
        lastRemoteHistory = body && typeof body === 'object' ? body : {};
        tasks = normalizeLoadedPrototypeTasks(lastRemoteHistory);
        emit();
      } catch (error) {
        console.warn('[Axhub Prototype Generation] Failed to load generation history:', error);
        tasks = [];
        lastRemoteHistory = {};
        emit();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async submit(request, submitOptions = {}) {
      const createdAt = now();
      const knownAcpxSessionName = findKnownAcpxSessionName({
        sessions: lastRemoteHistory.prototypeSessions,
        targetPath,
        canvasFilePath: request.canvasFilePath,
        generatorElementId: request.generatorElementId,
      });
      let task: PrototypeGenerationTaskRecord = {
        id: createTaskId(),
        prompt: request.prompt,
        status: 'running',
        stage: 'submitting',
        error: null,
        createdAt,
        finishedAt: null,
        elapsed: null,
        runId: '',
        recoverable: true,
        provider: resolveProvider(request.preferredPromptClient),
        ...(knownAcpxSessionName ? { sessionId: knownAcpxSessionName, acpxSessionName: knownAcpxSessionName } : {}),
      };
      task = {
        ...task,
        runId: task.id,
      };
      upsertTask(task);
      submitOptions.onCreated?.(task);
      void persist({
        session: createPrototypeSessionRecord({
          task,
          targetPath: targetPath || deriveTargetPathFromCanvasPath(request.canvasFilePath),
          canvasFilePath: request.canvasFilePath,
          generatorElementId: request.generatorElementId,
        }),
      });

      try {
        const result = await runGeniePrototypeAgent({
          taskId: task.id,
          provider: task.provider,
          prompt: request.prompt,
          canvasFilePath: request.canvasFilePath,
          targetPath: targetPath || deriveTargetPathFromCanvasPath(request.canvasFilePath),
          canvasName: request.canvasName,
          generatorElementId: request.generatorElementId,
          currentPrototype: request.currentPrototype,
          knownPrototypes: request.knownPrototypes,
          referenceImages: request.referenceImages,
          settings: request.settings,
          onEvent: (event) => {
            task = updateFromAgentEvent(task, event);
          },
        });

        const acpxSessionName = result.sessionId || task.acpxSessionName;
        const localTaskId = task.id;
        if (acpxSessionName) {
          task = {
            ...task,
            sessionId: acpxSessionName,
            acpxSessionName,
            runId: localTaskId,
          };
        }

        if (result.status === 'error') {
          throw new Error(result.error || 'AI 生成执行失败');
        }

        task = {
          ...task,
          stage: 'refreshing',
        };
        upsertTask(task);

        const createdPrototype = await submitOptions.onAgentDone?.(task);
        const finishedAt = now();
        task = {
          ...task,
          id: localTaskId,
          status: 'done',
          stage: 'done',
          finishedAt,
          elapsed: Math.max(0, finishedAt - createdAt),
          outputPrototypeName: createdPrototype?.name,
          runId: localTaskId,
          recoverable: true,
          ...(createdPrototype ? {} : { note: 'AI 生成已完成，但暂未检测到新增原型资源。' }),
        };
        replaceTask(localTaskId, task);
        await persist({
          session: createPrototypeSessionRecord({
            task,
            targetPath,
            canvasFilePath: request.canvasFilePath,
            generatorElementId: request.generatorElementId,
          }),
        });
        return task;
      } catch (error: any) {
        const finishedAt = now();
        task = {
          ...task,
          status: 'error',
          stage: 'error',
          error: error?.message || '生成原型失败',
          finishedAt,
          elapsed: Math.max(0, finishedAt - createdAt),
        };
        upsertTask(task);
        void persist({
          session: createPrototypeSessionRecord({
            task,
            targetPath,
            canvasFilePath: request.canvasFilePath,
            generatorElementId: request.generatorElementId,
          }),
        });
        return task;
      }
    },
    deleteTask(taskId) {
      const nextTasks = tasks.filter((task) => task.id !== taskId);
      if (nextTasks.length === tasks.length) return;
      tasks = nextTasks;
      emit();
      void persist();
    },
  };
}

let singletonStore: PrototypeGenerationTaskStore | null = null;

export function getPrototypeGenerationTaskStore(): PrototypeGenerationTaskStore {
  if (!singletonStore) {
    singletonStore = createPrototypeGenerationTaskStore();
  }
  return singletonStore;
}
