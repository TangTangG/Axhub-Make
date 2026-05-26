import { toGenieProvider } from '../../../common/promptExecution';
import type { GenieProvider } from '../../../common/genie/types';
import type { PromptClientPreference } from '../../types';
import type { CanvasLocalContextRef } from './canvasReferenceImages';

export type AiImageTaskStatus = 'running' | 'done' | 'error';
export type AiImageTaskStage =
  | 'submitting'
  | 'preparing-context'
  | 'generating-prompt'
  | 'generating'
  | 'downloading'
  | 'done'
  | 'error';
export type AiImageQuality = 'auto' | 'low' | 'medium' | 'high';
export type AiImageOutputFormat = 'png' | 'jpeg' | 'webp';
export type AiImageModeration = 'auto' | 'low';

export interface AiImageTaskParams {
  size: string;
  quality: AiImageQuality;
  output_format: AiImageOutputFormat;
  output_compression: number | null;
  moderation: AiImageModeration;
  n: number;
  disable_prompt_optimization?: boolean;
}

export interface AiImageGenerateRequest {
  prompt: string;
  params: AiImageTaskParams;
  referenceImages?: string[];
  conversationId?: string;
  roundId?: string;
  referenceAssetIds?: string[];
  sourcePrompt?: string;
  localContextRefs?: CanvasLocalContextRef[];
  preferredPromptClient?: PromptClientPreference;
}

export interface AiImageReferenceAssetRef {
  id: string;
  assetPath: string;
  hash?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  createdAt?: number;
}

export interface AiImageTaskRecord {
  id: string;
  prompt: string;
  params: AiImageTaskParams;
  status: AiImageTaskStatus;
  stage: AiImageTaskStage;
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
  elapsed: number | null;
  outputImages: string[];
  actualParams?: Partial<AiImageTaskParams>;
  actualParamsByImage?: Record<string, Partial<AiImageTaskParams>>;
  revisedPromptByImage?: Record<string, string>;
  rawImageUrls?: string[];
  rawResponsePayload?: string;
  conversationId?: string;
  roundId?: string;
  interrupted?: boolean;
  referenceAssetRefs?: AiImageReferenceAssetRef[];
  referenceImages?: string[];
  sourcePrompt?: string;
  localContextRefs?: CanvasLocalContextRef[];
}

export interface AiImageStoredImage {
  id: string;
  dataUrl: string;
  assetPath?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  createdAt: number;
  source: 'generated';
}

export interface AiImageStoreState {
  tasks: AiImageTaskRecord[];
  images: Record<string, AiImageStoredImage>;
  imageConversations?: Record<string, unknown>[];
}

export interface AiImageTaskStore {
  getState(): AiImageStoreState;
  getTasks(): AiImageTaskRecord[];
  getImage(id: string): AiImageStoredImage | undefined;
  configure(options: { targetPath?: string | null }): Promise<void>;
  subscribe(listener: (state: AiImageStoreState) => void): () => void;
  load(): Promise<void>;
  submit(request: AiImageGenerateRequest, options?: {
    onCreated?: (task: AiImageTaskRecord) => void;
  }): Promise<AiImageTaskRecord>;
  deleteTask(taskId: string): void;
}

interface AiImageTaskStoreOptions {
  now?: () => number;
  storage?: Storage | null;
}

const HISTORY_LIMIT = 30;
const CANVAS_AI_IMAGE_PROMPT_GENERATION_SCENE = 'canvas-ai-image-prompt-generation';

function createTaskId(): string {
  return `ai-task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createConversationId(): string {
  return `ai-conversation-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createRoundId(): string {
  return `ai-round-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function sha256(value: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const encoded = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return `fallback-${Math.abs(hash)}`;
}

function parseImageSize(dataUrl: string): Promise<{ width?: number; height?: number }> {
  if (typeof Image === 'undefined') {
    return Promise.resolve({});
  }
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || undefined, height: image.naturalHeight || undefined });
    image.onerror = () => resolve({});
    image.src = dataUrl;
  });
}

function normalizeLoadedState(value: unknown, options: { interruptRunning?: boolean } = {}): AiImageStoreState {
  if (!value || typeof value !== 'object') {
    return { tasks: [], images: {}, imageConversations: [] };
  }
  const data = value as Partial<AiImageStoreState>;
  const tasks = Array.isArray(data.tasks)
    ? data.tasks
        .filter((task): task is AiImageTaskRecord => Boolean(task?.id))
        .map((task) => {
          const { rawResponsePayload: _rawResponsePayload, ...safeTask } = task;
          if (options.interruptRunning === true && safeTask.status === 'running') {
            return {
              ...safeTask,
              status: 'error',
              stage: 'error',
              interrupted: true,
              error: '请求中断，可重新生成',
            } as AiImageTaskRecord;
          }
          return safeTask as AiImageTaskRecord;
        })
    : [];
  return {
    tasks,
    images: data.images && typeof data.images === 'object' ? data.images : {},
    imageConversations: Array.isArray(data.imageConversations) ? data.imageConversations : [],
  };
}

function normalizeTargetPath(value: string | null | undefined): string | undefined {
  const normalized = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/u, '');
  const match = normalized.match(/^prototypes\/([^/]+)$/u);
  if (!match?.[1] || match[1].startsWith('.') || match[1].includes('..')) {
    return undefined;
  }
  return `prototypes/${match[1]}`;
}

function resolvePromptGenerationProvider(preferredPromptClient?: PromptClientPreference): GenieProvider {
  return toGenieProvider(preferredPromptClient ?? null) || 'codex';
}

function normalizeLocalContextRefs(value: unknown): CanvasLocalContextRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): CanvasLocalContextRef[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    const resourceType = source.resourceType === 'prototype' || source.resourceType === 'theme'
      ? source.resourceType
      : null;
    const resourceId = typeof source.resourceId === 'string' ? source.resourceId.trim() : '';
    if (!resourceType || !/^[a-z0-9_-]+$/iu.test(resourceId)) return [];
    const paths = Array.isArray(source.paths)
      ? source.paths
          .filter((path): path is string => typeof path === 'string')
          .map((path) => path.trim().replace(/\\/g, '/').replace(/^\/+/u, ''))
          .filter((path) => {
            if (!path || path.includes('..') || path.includes('\0') || path.startsWith('/')) return false;
            return resourceType === 'prototype'
              ? new RegExp(`^src/prototypes/${resourceId}/index\\.tsx?$`, 'iu').test(path)
              : new RegExp(`^src/themes/${resourceId}/(?:DESIGN\\.md|index\\.tsx?)$`, 'iu').test(path);
          })
      : [];
    if (!paths.length) return [];
    const title = typeof source.title === 'string' ? source.title.trim() : '';
    const description = typeof source.description === 'string' ? source.description.trim() : '';
    return [{
      resourceType,
      resourceId,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      paths: Array.from(new Set(paths)),
    }];
  });
}

function buildCanvasAiImagePromptGenerationPrompt(params: {
  sourcePrompt: string;
  localContextRefs: CanvasLocalContextRef[];
  referenceImageCount: number;
}): string {
  const refsText = params.localContextRefs.map((ref, index) => [
    `${index + 1}. ${ref.resourceType} ${ref.resourceId}`,
    ref.title ? `标题：${ref.title}` : '',
    ref.description ? `说明：${ref.description}` : '',
    `文件路径：${ref.paths.join(', ')}`,
  ].filter(Boolean).join('\n')).join('\n\n');

  return [
    '你正在为画布 AI 生图生成最终提示词。',
    '',
    '请根据用户原始需求和本地上下文文件路径，输出可以直接提交给图片生成接口的最终生图提示词。',
    '要求：只输出最终提示词，不要输出解释、标题、Markdown 代码块或文件内容。',
    '你可以在项目根目录内读取下列文件路径理解上下文；路径可能包含兼容候选文件，使用实际存在的文件。',
    '',
    `用户原始需求：${params.sourcePrompt}`,
    '',
    `已有参考图数量：${params.referenceImageCount}`,
    '',
    '本地上下文：',
    refsText,
  ].join('\n');
}

async function executeCanvasAiImagePromptGeneration(params: {
  sourcePrompt: string;
  localContextRefs: CanvasLocalContextRef[];
  referenceImageCount: number;
  preferredPromptClient?: PromptClientPreference;
}): Promise<string> {
  const response = await fetch('/api/prompt/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scene: CANVAS_AI_IMAGE_PROMPT_GENERATION_SCENE,
      client: resolvePromptGenerationProvider(params.preferredPromptClient),
      prompt: buildCanvasAiImagePromptGenerationPrompt(params),
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || '提示词生成失败');
  }
  const output = typeof body?.output === 'string' ? body.output.trim() : '';
  if (!output) {
    throw new Error('acpx 没有返回提示词');
  }
  return output;
}

function historyEndpoint(targetPath: string): string {
  return `/api/ai-image/history?targetPath=${encodeURIComponent(targetPath)}`;
}

function trimState(input: AiImageStoreState): AiImageStoreState {
  const tasks = [...input.tasks]
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, HISTORY_LIMIT)
    .map((task) => {
      const { rawResponsePayload: _rawResponsePayload, ...safeTask } = task;
      return safeTask as AiImageTaskRecord;
    });
  const referencedImages = new Set(tasks.flatMap((task) => task.outputImages));
  const images: Record<string, AiImageStoredImage> = {};
  for (const imageId of referencedImages) {
    const image = input.images[imageId];
    if (image) {
      images[imageId] = image;
    }
  }
  return {
    tasks,
    images,
    imageConversations: Array.isArray(input.imageConversations) ? input.imageConversations : [],
  };
}

function createPersistableState(input: AiImageStoreState): AiImageStoreState {
  const trimmed = trimState(input);
  return {
    tasks: trimmed.tasks,
    images: Object.fromEntries(Object.entries(trimmed.images).map(([id, image]) => [
      id,
      {
        id: image.id,
        ...(image.assetPath ? { assetPath: image.assetPath } : {}),
        ...(image.mimeType ? { mimeType: image.mimeType } : {}),
        ...(!image.assetPath && image.dataUrl ? { dataUrl: image.dataUrl } : {}),
        ...(image.width ? { width: image.width } : {}),
        ...(image.height ? { height: image.height } : {}),
        createdAt: image.createdAt,
        source: image.source,
      } as AiImageStoredImage,
    ])),
    imageConversations: Array.isArray(input.imageConversations) ? input.imageConversations : [],
  };
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function upsertImageConversation(
  conversations: unknown,
  params: {
    conversationId: string;
    roundId: string;
    prompt: string;
    sourcePrompt?: string;
    taskId: string;
    status: AiImageTaskStatus;
    createdAt: number;
    updatedAt: number;
    finishedAt?: number | null;
    outputImageIds?: string[];
    referenceImages?: string[];
    localContextRefs?: CanvasLocalContextRef[];
    error?: string | null;
  },
): Record<string, unknown>[] {
  const existing = Array.isArray(conversations) ? conversations.filter(isRecord) : [];
  const conversation = existing.find((item) => item.id === params.conversationId) || {
    id: params.conversationId,
    title: params.prompt.slice(0, 48) || '图片对话',
    rounds: [],
    messages: [],
    createdAt: params.createdAt,
  };
  const rounds = Array.isArray(conversation.rounds) ? conversation.rounds.filter(isRecord) : [];
  const messages = Array.isArray(conversation.messages) ? conversation.messages.filter(isRecord) : [];
  const nextRound = {
    ...(rounds.find((round) => round.id === params.roundId) || {}),
    id: params.roundId,
    prompt: params.prompt,
    taskId: params.taskId,
    outputTaskIds: [params.taskId],
    outputImageIds: params.outputImageIds || [],
    status: params.status,
    createdAt: rounds.find((round) => round.id === params.roundId)?.createdAt || params.createdAt,
    updatedAt: params.updatedAt,
    ...(params.finishedAt ? { finishedAt: params.finishedAt } : {}),
    ...(params.error ? { error: params.error } : {}),
    ...(params.referenceImages?.length ? { referenceImages: params.referenceImages } : {}),
    ...(params.sourcePrompt ? { sourcePrompt: params.sourcePrompt } : {}),
    ...(params.localContextRefs?.length ? { localContextRefs: params.localContextRefs } : {}),
  };
  const userMessageId = `message-${params.roundId}-user`;
  const assistantMessageId = `message-${params.roundId}-assistant`;
  const nextMessages = [
    ...messages.filter((message) => message.id !== userMessageId && message.id !== assistantMessageId),
    {
      id: userMessageId,
      role: 'user',
      content: params.prompt,
      roundId: params.roundId,
      taskId: params.taskId,
      createdAt: params.createdAt,
      ...(params.referenceImages?.length ? { referenceImages: params.referenceImages } : {}),
      ...(params.sourcePrompt ? { sourcePrompt: params.sourcePrompt } : {}),
      ...(params.localContextRefs?.length ? { localContextRefs: params.localContextRefs } : {}),
    },
    ...(params.status === 'running'
      ? []
      : [{
          id: assistantMessageId,
          role: 'assistant',
          content: params.status === 'done'
            ? `生成完成，共 ${params.outputImageIds?.length || 0} 张`
            : params.error || '图片生成失败',
          roundId: params.roundId,
          taskId: params.taskId,
          outputTaskIds: [params.taskId],
          outputImageIds: params.outputImageIds || [],
          createdAt: params.finishedAt || params.updatedAt,
          ...(params.error ? { error: params.error } : {}),
        }]),
  ];
  const nextConversation = {
    ...conversation,
    id: params.conversationId,
    title: typeof conversation.title === 'string' && conversation.title.trim()
      ? conversation.title
      : params.prompt.slice(0, 48) || '图片对话',
    rounds: [
      ...rounds.filter((round) => round.id !== params.roundId),
      nextRound,
    ],
    messages: nextMessages,
    updatedAt: params.updatedAt,
  };
  return [
    nextConversation,
    ...existing.filter((item) => item.id !== params.conversationId),
  ];
}

export function createAiImageTaskStore(options: AiImageTaskStoreOptions = {}): AiImageTaskStore {
  const now = options.now || (() => Date.now());
  let state: AiImageStoreState = { tasks: [], images: {}, imageConversations: [] };
  let targetPath: string | undefined;
  let lastRemoteHistory: Record<string, any> = {};
  let loadRevision = 0;
  const listeners = new Set<(state: AiImageStoreState) => void>();

  const emit = () => {
    for (const listener of listeners) listener(state);
  };

  const setState = (nextState: AiImageStoreState, options: { trim?: boolean } = {}) => {
    state = options.trim ? trimState(nextState) : nextState;
    emit();
  };

  const persist = async () => {
    if (!targetPath) return;
    const revision = loadRevision;
    const payload = {
      ...lastRemoteHistory,
      ...createPersistableState(state),
    };
    try {
      const response = await fetch(historyEndpoint(targetPath), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`保存图片历史失败 (${response.status})`);
      }
      const body = await response.json().catch(() => null);
      if (revision !== loadRevision) return;
      lastRemoteHistory = body && typeof body === 'object' ? body : payload;
      state = normalizeLoadedState(body);
      emit();
    } catch (error) {
      console.warn('[Axhub AI Image] Failed to persist image history:', error);
    }
  };

  const upsertTask = (task: AiImageTaskRecord) => {
    setState({
      ...state,
      tasks: [task, ...state.tasks.filter((item) => item.id !== task.id)],
    });
  };

  return {
    getState: () => state,
    getTasks: () => state.tasks,
    getImage: (id) => state.images[id],
    async configure({ targetPath: nextTargetPath }) {
      const normalizedTargetPath = normalizeTargetPath(nextTargetPath);
      if (normalizedTargetPath === targetPath) return;
      targetPath = normalizedTargetPath;
      loadRevision += 1;
      state = { tasks: [], images: {}, imageConversations: [] };
      lastRemoteHistory = {};
      emit();
      if (targetPath) {
        await this.load();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async load() {
      if (!targetPath) return;
      const revision = loadRevision;
      try {
        const response = await fetch(historyEndpoint(targetPath));
        if (!response.ok) {
          throw new Error(`加载图片历史失败 (${response.status})`);
        }
        const body = await response.json().catch(() => null);
        if (revision !== loadRevision) return;
        lastRemoteHistory = body && typeof body === 'object' ? body : {};
        state = normalizeLoadedState(body, { interruptRunning: true });
        emit();
      } catch (error) {
        console.warn('[Axhub AI Image] Failed to load image history:', error);
        state = { tasks: [], images: {}, imageConversations: [] };
        lastRemoteHistory = {};
        emit();
      }
    },
    async submit(request, submitOptions = {}) {
      const createdAt = now();
      const conversationId = request.conversationId || createConversationId();
      const roundId = request.roundId || createRoundId();
      const sourcePrompt = String(request.sourcePrompt || request.prompt || '').trim();
      const localContextRefs = normalizeLocalContextRefs(request.localContextRefs);
      let task: AiImageTaskRecord = {
        id: createTaskId(),
        prompt: request.prompt,
        params: request.params,
        status: 'running',
        stage: localContextRefs.length ? 'preparing-context' : 'submitting',
        error: null,
        createdAt,
        finishedAt: null,
        elapsed: null,
        outputImages: [],
        conversationId,
        roundId,
        ...(sourcePrompt && sourcePrompt !== request.prompt ? { sourcePrompt } : {}),
        ...(localContextRefs.length ? { sourcePrompt, localContextRefs } : {}),
        ...(Array.isArray(request.referenceImages) && request.referenceImages.length
          ? { referenceImages: request.referenceImages }
          : {}),
      };
      upsertTask(task);
      setState({
        ...state,
        imageConversations: upsertImageConversation(state.imageConversations, {
          conversationId,
          roundId,
          prompt: task.prompt,
          sourcePrompt: task.sourcePrompt,
          taskId: task.id,
          status: 'running',
          createdAt,
          updatedAt: createdAt,
          referenceImages: request.referenceImages,
          localContextRefs,
        }),
      });
      submitOptions.onCreated?.(task);
      await persist();

      try {
        let generateRequest: AiImageGenerateRequest = {
          ...request,
          ...(localContextRefs.length ? { localContextRefs } : {}),
        };
        if (localContextRefs.length) {
          task = { ...task, stage: 'generating-prompt' };
          upsertTask(task);
          const generatedPrompt = await executeCanvasAiImagePromptGeneration({
            sourcePrompt,
            localContextRefs,
            referenceImageCount: Array.isArray(request.referenceImages) ? request.referenceImages.length : 0,
            preferredPromptClient: request.preferredPromptClient,
          }).catch((error: any) => {
            throw new Error(`提示词生成失败：${error?.message || '未知错误'}`);
          });
          task = {
            ...task,
            prompt: generatedPrompt,
            sourcePrompt,
            localContextRefs,
          };
          upsertTask(task);
          generateRequest = {
            ...generateRequest,
            prompt: generatedPrompt,
            sourcePrompt,
            localContextRefs,
          };
        }
        task = { ...task, stage: 'generating' };
        upsertTask(task);
        const response = await fetch('/api/ai-image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(generateRequest),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw Object.assign(new Error(body?.error || '图片生成失败'), {
            rawImageUrls: body?.rawImageUrls,
          });
        }
        const images = Array.isArray(body.images) ? body.images.filter((image: unknown): image is string => typeof image === 'string') : [];
        task = { ...task, stage: 'downloading' };
        upsertTask(task);

        const storedImages = await Promise.all(images.map(async (dataUrl: string) => {
          const id = await sha256(dataUrl);
          const size = await parseImageSize(dataUrl);
          return {
            id,
            dataUrl,
            width: size.width,
            height: size.height,
            createdAt,
            source: 'generated' as const,
          };
        }));
        const outputImages = storedImages.map((image) => image.id);
        const actualParamsByImage: Record<string, Partial<AiImageTaskParams>> = {};
        const revisedPromptByImage: Record<string, string> = {};
        const actualParamsList = Array.isArray(body.actualParamsList) ? body.actualParamsList : [];
        const revisedPrompts = Array.isArray(body.revisedPrompts) ? body.revisedPrompts : [];
        outputImages.forEach((id, index) => {
          if (actualParamsList[index] && typeof actualParamsList[index] === 'object') {
            actualParamsByImage[id] = actualParamsList[index];
          }
          if (typeof revisedPrompts[index] === 'string' && revisedPrompts[index].trim()) {
            revisedPromptByImage[id] = revisedPrompts[index];
          }
        });
        const finishedAt = now();
        task = {
          ...task,
          status: 'done',
          stage: 'done',
          finishedAt,
          elapsed: Math.max(0, finishedAt - createdAt),
          outputImages,
          actualParams: body.actualParams && typeof body.actualParams === 'object' ? body.actualParams : undefined,
          actualParamsByImage: Object.keys(actualParamsByImage).length ? actualParamsByImage : undefined,
          revisedPromptByImage: Object.keys(revisedPromptByImage).length ? revisedPromptByImage : undefined,
          rawImageUrls: Array.isArray(body.rawImageUrls) ? body.rawImageUrls : undefined,
        };
        setState({
          images: {
            ...state.images,
            ...Object.fromEntries(storedImages.map((image) => [image.id, image])),
          },
          tasks: [task, ...state.tasks.filter((item) => item.id !== task.id)],
          imageConversations: upsertImageConversation(state.imageConversations, {
            conversationId,
            roundId,
            prompt: task.prompt,
            taskId: task.id,
            status: 'done',
            createdAt,
            updatedAt: finishedAt,
            finishedAt,
            outputImageIds: outputImages,
            referenceImages: generateRequest.referenceImages,
            sourcePrompt: task.sourcePrompt,
            localContextRefs: task.localContextRefs,
          }),
        }, { trim: true });
        await persist();
        return task;
      } catch (error: any) {
        const finishedAt = now();
        task = {
          ...task,
          status: 'error',
          stage: 'error',
          error: error?.message || '图片生成失败',
          rawImageUrls: Array.isArray(error?.rawImageUrls) ? error.rawImageUrls : undefined,
          finishedAt,
          elapsed: Math.max(0, finishedAt - createdAt),
        };
        upsertTask(task);
        setState({
          ...state,
          imageConversations: upsertImageConversation(state.imageConversations, {
            conversationId,
            roundId,
            prompt: task.prompt,
            taskId: task.id,
            status: 'error',
            createdAt,
            updatedAt: finishedAt,
            finishedAt,
            referenceImages: request.referenceImages,
            sourcePrompt: task.sourcePrompt,
            localContextRefs: task.localContextRefs,
            error: task.error,
          }),
        });
        void persist();
        return task;
      }
    },
    deleteTask(taskId) {
      setState({
        ...state,
        tasks: state.tasks.filter((task) => task.id !== taskId),
      }, { trim: true });
      void persist();
    },
  };
}

let singletonStore: AiImageTaskStore | null = null;

export function getAiImageTaskStore(): AiImageTaskStore {
  if (!singletonStore) {
    singletonStore = createAiImageTaskStore();
  }
  return singletonStore;
}
