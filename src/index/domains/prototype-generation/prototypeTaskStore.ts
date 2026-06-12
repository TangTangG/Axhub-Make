import type { ItemData, PromptClientPreference } from '../../types';
import type { ContextBundleV2 } from '@axhub/acp/runtime';
import { toGenieProvider } from '../../../common/promptExecution';
import type { GenieProvider as AcpPromptProvider } from '../../../common/genie/types';
import {
  runAcpPrototypeAgent,
  type PrototypeGenerationAgentEvent,
  type PrototypeGenerationArtifact,
  type PrototypeGenerationPrototypeContext,
  type PrototypeGenerationSettings,
} from './acpPrototypeAgentClient';

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
  provider: AcpPromptProvider;
  outputPrototypeName?: string;
  note?: string;
}

export interface PrototypeGenerationSubmitRequest {
  prompt: string;
  preferredPromptClient?: PromptClientPreference;
  provider?: string | null;
  model?: string | null;
  mode?: string | null;
  thought?: string | null;
  contextBundle?: ContextBundleV2 | null;
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
    onArtifact?: (artifact: PrototypeGenerationArtifact, task: PrototypeGenerationTaskRecord) => Promise<void> | void;
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

function resolveProvider(preferredPromptClient?: PromptClientPreference, selectedProvider?: string | null): AcpPromptProvider {
  const normalizedProvider = String(selectedProvider || '').trim().toLowerCase();
  if (
    normalizedProvider === 'claude'
    || normalizedProvider === 'codex'
    || normalizedProvider === 'gemini'
    || normalizedProvider === 'opencode'
  ) {
    return normalizedProvider;
  }
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

export function createPrototypeGenerationTaskStore(
  options: PrototypeGenerationTaskStoreOptions = {},
): PrototypeGenerationTaskStore {
  const now = options.now || (() => Date.now());
  let tasks: PrototypeGenerationTaskRecord[] = [];
  let targetPath: string | undefined;
  let loadRevision = 0;
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

  const updateFromAgentEvent = (task: PrototypeGenerationTaskRecord, event: PrototypeGenerationAgentEvent) => {
    if (event.stage === 'activity') {
      const nextTask: PrototypeGenerationTaskRecord = {
        ...task,
        stage: 'running',
        ...(event.sessionId ? { sessionId: event.sessionId, acpxSessionName: event.sessionId } : {}),
      };
      upsertTask(nextTask);
      return nextTask;
    }
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
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async submit(request, submitOptions = {}) {
      const createdAt = now();
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
        provider: resolveProvider(request.preferredPromptClient, request.provider),
      };
      task = {
        ...task,
        runId: task.id,
      };
      upsertTask(task);
      submitOptions.onCreated?.(task);
      const artifactHandlerPromises: Promise<void>[] = [];

      try {
        const result = await runAcpPrototypeAgent({
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
          model: request.model,
          mode: request.mode,
          thought: request.thought,
          contextBundle: request.contextBundle,
          onEvent: (event) => {
            task = updateFromAgentEvent(task, event);
            if (event.artifact) {
              const artifactHandlerPromise = Promise.resolve(submitOptions.onArtifact?.(event.artifact, task))
                .catch((error) => console.warn('[Axhub Prototype Generation] Failed to apply streamed artifact:', error));
              artifactHandlerPromises.push(artifactHandlerPromise);
            }
          },
        });
        await Promise.all(artifactHandlerPromises);

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
        return task;
      }
    },
    deleteTask(taskId) {
      const nextTasks = tasks.filter((task) => task.id !== taskId);
      if (nextTasks.length === tasks.length) return;
      tasks = nextTasks;
      emit();
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
