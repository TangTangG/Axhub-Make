import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './canvas-generation-acp-scope.css';
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  useAui,
  useAuiState,
  type Attachment,
  type AttachmentAdapter,
  type ThreadMessage,
} from '@assistant-ui/react';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { ComposerAttachments } from '@axhub/acp/composer';
import { ACP_CAPABILITY_REFRESH_EVENT, AcpUiProvider, acpApiClient, configureAcpUiRuntime, hydrateAcpCapabilityCacheFromDefaults, useAcpUiRuntimeContext } from '@axhub/acp/runtime';
import type { AcpCapabilitySnapshot, ContextBundleV2, ContextItem } from '@axhub/acp/runtime';
import type {
  ChatTransport,
  FileUIPart,
  UIMessage,
  UIMessageChunk,
} from 'ai';
import { ArrowUp, Check, ChevronDown, ChevronRight, Gauge, Network, PlusIcon, Settings2, SlidersHorizontal, Sparkles, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getAcpProviderOption, resolveAcpPromptClientProvider, type AcpProviderKey } from '../../../common/acpModelConfig';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { apiService } from '../../services/index.api';
import { shouldUseCanvasReferencePaste } from './canvasReferenceClipboard';
import type { CanvasLocalContextRef } from '../ai-image/canvasReferenceImages';
import {
  appendCanvasAiQuickPrompt,
  type CanvasAiQuickPrompt,
} from '../ai-generation/canvasAiSceneRegistry';
import type { PromptClientPreference } from '../../types';
import {
  clearCanvasGenerationComposerDraft,
  getCanvasGenerationComposerDraftStorage,
  readCanvasGenerationComposerDraft,
  resolveCanvasGenerationComposerDraftRestoreText,
  writeCanvasGenerationComposerDraft,
} from './canvasGenerationComposerDraft';
import { getClipboardImageFiles } from './clipboardImages';

export interface CanvasGenerationComposerPlacement {
  left: number;
  top: number;
  width: number;
}

type CanvasGenerationComposerPlacementMode = 'absolute' | 'fixed-bottom-center';

export type CanvasAiScene = 'page' | 'design' | 'document';

const FIXED_CANVAS_ACP_PROVIDER_OPTIONS = ['claude', 'codex', 'opencode'] as const satisfies readonly AcpProviderKey[];

export interface CanvasAcpSelectorDefaults {
  defaultProvider: AcpProviderKey;
  defaultModel: string | null;
  providerOptions: readonly AcpProviderKey[];
}

export function resolveCanvasAcpSelectorDefaults(
  preferredPromptClient?: PromptClientPreference,
): CanvasAcpSelectorDefaults {
  const defaultProvider = resolveAcpPromptClientProvider(preferredPromptClient) || 'codex';
  return {
    defaultProvider,
    defaultModel: getAcpProviderOption(defaultProvider)?.defaultAnnotationModel || null,
    providerOptions: resolveCanvasAcpRuntimeProviderOptions(undefined, defaultProvider),
  };
}

export function resolveCanvasAcpRuntimeProviderOptions(
  providerOptions?: readonly AcpProviderKey[] | null,
  selectedProvider?: string | null,
): readonly AcpProviderKey[] {
  const resolvedOptions = providerOptions?.length
    ? [...providerOptions]
    : [...FIXED_CANVAS_ACP_PROVIDER_OPTIONS];
  const currentProvider = resolveAcpPromptClientProvider(selectedProvider);
  return currentProvider && !resolvedOptions.some((provider) => provider === currentProvider)
    ? [...resolvedOptions, currentProvider]
    : resolvedOptions;
}

export interface CanvasAiSubmitResult {
  ok: boolean;
  text: string;
  error?: string;
  artifactRefs?: string[];
}

export type CanvasGenerationSubmitResult = CanvasAiSubmitResult;

export interface CanvasAiSubmitRequest<SceneSettings = unknown> {
  scene: CanvasAiScene;
  prompt: string;
  message: ThreadMessage;
  contextBundle: ContextBundleV2 | null;
  referenceImages: string[];
  provider: string;
  model: string | null;
  mode: string | null;
  thought: string | null;
  sceneSettings?: SceneSettings;
}

export interface CanvasGenerationDisplaySubmitSelection {
  contextBundle: ContextBundleV2 | null;
  provider: string;
  model: string | null;
  mode: string | null;
  thought: string | null;
  referenceImages: string[];
}

type CanvasGenerationDisplaySubmitResult = boolean | void;

export interface CanvasGenerationDisplayComposerProps {
  placeholder: string;
  ariaLabel: string;
  onSubmit?: (text: string, selection?: CanvasGenerationDisplaySubmitSelection) => CanvasGenerationDisplaySubmitResult | Promise<CanvasGenerationDisplaySubmitResult>;
  onOpenAISettings?: () => void;
  className?: string;
  disabled?: boolean;
  draftStorageKey?: string | null;
  leadingActions?: React.ReactNode;
  postSelectorActions?: React.ReactNode;
  preferredPromptClient?: PromptClientPreference;
  quickPrompts?: readonly CanvasAiQuickPrompt[];
  showSelectors?: boolean;
  workspacePath?: string | null;
}

interface CanvasGenerationRuntimeComposerProps {
  addAttachmentTooltip: string;
  allowAttachments: boolean;
  ariaLabel: string;
  canPasteReferenceImages?: boolean;
  draftStorageKey?: string | null;
  initialLocalContextRefs?: CanvasLocalContextRef[];
  initialReferenceImages?: string[];
  onPasteReferenceImages?: () => Promise<string[]>;
  placeholder: string;
  preferredPromptClient?: PromptClientPreference;
  quickPrompts?: readonly CanvasAiQuickPrompt[];
  renderActions?: (props: { submitting: boolean }) => React.ReactNode;
  renderLeadingActions?: (props: { submitting: boolean }) => React.ReactNode;
  renderPostSelectorActions?: (props: { submitting: boolean }) => React.ReactNode;
  renderTriggerPopovers?: () => React.ReactNode;
  scene: CanvasAiScene;
  rootClassName?: string;
  footerActionsClassName?: string;
  footerLeadingActionsClassName?: string;
  onEnsureAcpRuntime?: (autoStart?: boolean) => Promise<boolean>;
  onOpenAISettings?: () => void;
  sendTooltip: string;
  showModelSelectorFallback?: boolean;
  showSelectors?: boolean;
  submitting: boolean;
}

export interface CanvasGenerationComposerProps extends CanvasGenerationRuntimeComposerProps {
  attachmentsClassName?: string;
  className?: string;
  dataAttribute: string;
  footerClassName?: string;
  onSubmitPrompt: (request: CanvasAiSubmitRequest) => Promise<CanvasAiSubmitResult>;
  placement: CanvasGenerationComposerPlacement;
  placementMode?: CanvasGenerationComposerPlacementMode;
  topContent?: React.ReactNode;
  workspacePath?: string | null;
}

export function extractCanvasGenerationPromptFromMessage(message: ThreadMessage): string {
  return message.content
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n')
    .trim();
}

export function extractCanvasGenerationReferenceImagesFromMessage(message: ThreadMessage): string[] {
  return message.attachments
    ?.flatMap((attachment) => attachment.content ?? [])
    .flatMap((part) => {
      if (part.type === 'image' && typeof part.image === 'string') {
        return [part.image];
      }
      if (part.type === 'file' && typeof part.data === 'string' && part.mimeType?.startsWith('image/')) {
        return [part.data];
      }
      return [];
    }) ?? [];
}

export function localContextRefsToAcpContextItems(refs: CanvasLocalContextRef[]): ContextItem[] {
  return refs.flatMap((ref) => ref.paths.map((path) => ({
    kind: 'file',
    id: `axhub:canvas-local-context:${ref.resourceType}:${ref.resourceId}:${path}`,
    path,
    name: ref.title || ref.resourceId,
    ...(ref.description ? { description: ref.description } : {}),
    metadata: {
      source: 'axhub-make-canvas',
      resourceType: ref.resourceType,
      resourceId: ref.resourceId,
    },
  } satisfies ContextItem)));
}

function dataUrlToImageFile(dataUrl: string, index: number): File {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/u);
  if (!match) {
    return new File([dataUrl], `canvas-reference-${index + 1}.png`, { type: 'image/png' });
  }
  const mimeType = match[1] || 'image/png';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let offset = 0; offset < binary.length; offset += 1) {
    bytes[offset] = binary.charCodeAt(offset);
  }
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  return new File([bytes], `canvas-reference-${index + 1}.${extension}`, { type: mimeType });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function readFileAsDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || 'application/octet-stream';
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

export const canvasReferenceImageAttachmentAdapter: AttachmentAdapter = {
  accept: 'image/*',
  async add({ file }) {
    return {
      id: `${file.name}-${file.lastModified || Date.now()}`,
      type: 'image',
      name: file.name,
      contentType: file.type,
      file,
      content: [],
      status: { type: 'requires-action', reason: 'composer-send' },
    };
  },
  async send(attachment) {
    return {
      ...attachment,
      status: { type: 'complete' },
      content: [{
        type: 'image',
        image: await readFileAsDataUrl(attachment.file),
        filename: attachment.name,
      }],
    };
  },
  async remove() {
    // Local canvas reference attachments do not need cleanup.
  },
};

function extractImageDataUrlsFromAttachmentContent(attachment: Attachment): string[] {
  return attachment.content?.flatMap((part) => {
    if (part.type === 'image' && typeof part.image === 'string') {
      return [part.image];
    }
    if (part.type === 'file' && typeof part.data === 'string' && part.mimeType?.startsWith('image/')) {
      return [part.data];
    }
    return [];
  }) ?? [];
}

async function resolveComposerAttachmentReferenceImages(attachments: readonly Attachment[]): Promise<string[]> {
  const images = await Promise.all(attachments.map(async (attachment) => {
    const contentImages = extractImageDataUrlsFromAttachmentContent(attachment);
    if (contentImages.length > 0) {
      return contentImages;
    }
    if (attachment.status.type === 'complete') {
      return [];
    }
    const completedAttachment = await canvasReferenceImageAttachmentAdapter.send(attachment);
    return extractImageDataUrlsFromAttachmentContent(completedAttachment);
  }));
  return images.flat();
}

function isTextPart(part: UIMessage['parts'][number]): part is { type: 'text'; text: string } {
  return part.type === 'text' && typeof part.text === 'string';
}

function isFilePart(part: UIMessage['parts'][number]): part is FileUIPart {
  return part.type === 'file' && typeof part.url === 'string';
}

function filePartToThreadContent(part: FileUIPart): ThreadMessage['content'][number] {
  if (part.mediaType.startsWith('image/')) {
    return {
      type: 'image',
      image: part.url,
      filename: part.filename,
    } as ThreadMessage['content'][number];
  }
  return {
    type: 'file',
    filename: part.filename,
    data: part.url,
    mimeType: part.mediaType,
  } as ThreadMessage['content'][number];
}

function uiMessageToThreadMessage(message: UIMessage, contextBundle: ContextBundleV2 | null): ThreadMessage {
  const content = message.parts.flatMap((part): ThreadMessage['content'][number][] => {
    if (isTextPart(part)) {
      return [{ type: 'text', text: part.text } as ThreadMessage['content'][number]];
    }
    if (isFilePart(part)) {
      return [filePartToThreadContent(part)];
    }
    return [];
  });
  const fileParts = message.parts.filter(isFilePart);
  const attachments = fileParts.map((part, index) => {
    const contentPart = filePartToThreadContent(part);
    return {
      id: `${message.id}-attachment-${index + 1}`,
      type: part.mediaType.startsWith('image/') ? 'image' : 'file',
      name: part.filename || `attachment-${index + 1}`,
      contentType: part.mediaType,
      content: [contentPart],
      status: { type: 'complete' },
    };
  });

  return {
    id: message.id,
    role: 'user',
    createdAt: new Date(),
    content,
    attachments,
    metadata: {
      custom: {
        acpContextBundle: contextBundle,
      },
    },
  } as ThreadMessage;
}

function createCanvasGenerationTextStream(
  text: string,
  ok: boolean,
): ReadableStream<UIMessageChunk> {
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      const messageId = `make-${Date.now().toString(36)}`;
      const partId = `${messageId}-text`;
      controller.enqueue({ type: 'start', messageId });
      controller.enqueue({ type: 'text-start', id: partId });
      if (text) {
        controller.enqueue({ type: 'text-delta', id: partId, delta: text });
      }
      controller.enqueue({ type: 'text-end', id: partId });
      controller.enqueue({ type: 'finish', finishReason: ok ? 'stop' : 'error' });
      controller.close();
    },
  });
}

type AssistantRuntimeState = Awaited<ReturnType<typeof apiService.getAssistantRuntime>>;

function configureCanvasAcpRuntime(runtime: AssistantRuntimeState, workspacePath?: string | null): boolean {
  if (runtime.health.status !== 'ready' || !runtime.apiBaseUrl) {
    return false;
  }
  configureAcpUiRuntime({ apiBaseUrl: runtime.apiBaseUrl });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACP_CAPABILITY_REFRESH_EVENT, {
      detail: {
        workspacePath: workspacePath ?? null,
      },
    }));
  }
  return true;
}

function useCanvasAcpRuntimeBridge({
  enabled,
  workspacePath,
}: {
  enabled?: boolean;
  workspacePath?: string | null;
}) {
  const [ready, setReadyState] = useState(false);
  const readyRef = useRef(false);
  const requestRef = useRef<{ autoStart: boolean; promise: Promise<boolean> } | null>(null);
  const setReady = useCallback((nextReady: boolean) => {
    readyRef.current = nextReady;
    setReadyState(nextReady);
  }, []);
  const ensureRuntime = useCallback(async (autoStart = false) => {
    if (!enabled) return false;
    if (requestRef.current) {
      const currentRequest = requestRef.current;
      if (!autoStart || currentRequest.autoStart) {
        return currentRequest.promise;
      }
      await currentRequest.promise;
      if (readyRef.current) return true;
    }

    const promise = (async () => {
      try {
        const runtime = await apiService.getAssistantRuntime({ autoStart });
        const configured = configureCanvasAcpRuntime(runtime, workspacePath);
        setReady(configured);
        if (!configured && autoStart) {
          toast.error(runtime.health.message || 'ACP UI 暂不可用，请稍后重试');
        }
        return configured;
      } catch (error: any) {
        setReady(false);
        if (autoStart) {
          toast.error(error?.message || '启动 ACP UI 失败');
        }
        return false;
      } finally {
        if (requestRef.current?.promise === promise) {
          requestRef.current = null;
        }
      }
    })();
    requestRef.current = { autoStart, promise };
    return promise;
  }, [enabled, setReady, workspacePath]);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }
    void ensureRuntime(false);
  }, [enabled, ensureRuntime, setReady]);

  return {
    ensureRuntime,
    needsFallback: Boolean(enabled) && !ready,
  };
}

class CanvasGenerationMakeTransport implements ChatTransport<UIMessage> {
  constructor(
    private readonly scene: CanvasAiScene,
    private readonly onSubmitPrompt: (request: CanvasAiSubmitRequest) => Promise<CanvasAiSubmitResult>,
    private readonly getSubmitContext: () => Pick<CanvasAiSubmitRequest, 'contextBundle' | 'provider' | 'model' | 'mode' | 'thought'>,
    private readonly draftStorageKey: string | null | undefined,
  ) {}

  async sendMessages({ messages, abortSignal }: Parameters<ChatTransport<UIMessage>['sendMessages']>[0]) {
    const message = messages.at(-1);
    const pendingThreadMessage = message ? uiMessageToThreadMessage(message, null) : null;
    const prompt = pendingThreadMessage ? extractCanvasGenerationPromptFromMessage(pendingThreadMessage) : '';
    if (!message || !pendingThreadMessage || !prompt) {
      toast.error('请输入提示词');
      return createCanvasGenerationTextStream('请输入提示词', false);
    }

    if (abortSignal?.aborted) {
      throw new DOMException('Canvas generation request was aborted.', 'AbortError');
    }

    const submitContext = this.getSubmitContext();
    const threadMessage = uiMessageToThreadMessage(message, submitContext.contextBundle);
    let result: CanvasAiSubmitResult;
    const storage = getCanvasGenerationComposerDraftStorage();
    try {
      result = await this.onSubmitPrompt({
        scene: this.scene,
        prompt,
        message: threadMessage,
        referenceImages: extractCanvasGenerationReferenceImagesFromMessage(threadMessage),
        contextBundle: submitContext.contextBundle,
        provider: submitContext.provider,
        model: submitContext.model,
        mode: submitContext.mode,
        thought: submitContext.thought,
      });
    } catch (error) {
      writeCanvasGenerationComposerDraft(storage, this.draftStorageKey, prompt);
      throw error;
    }
    if (abortSignal?.aborted) {
      writeCanvasGenerationComposerDraft(storage, this.draftStorageKey, prompt);
      throw new DOMException('Canvas generation request was aborted.', 'AbortError');
    }
    if (result.ok) {
      clearCanvasGenerationComposerDraft(storage, this.draftStorageKey);
    } else {
      writeCanvasGenerationComposerDraft(storage, this.draftStorageKey, prompt);
    }
    return createCanvasGenerationTextStream(result.text, result.ok);
  }

  async reconnectToStream() {
    return null;
  }
}

class CanvasGenerationDisplayTransport implements ChatTransport<UIMessage> {
  async sendMessages() {
    return createCanvasGenerationTextStream('', true);
  }

  async reconnectToStream() {
    return null;
  }
}

function CanvasGenerationDisplayQuickPromptsButton({
  disabled,
  onSelect,
  quickPrompts,
}: {
  disabled: boolean;
  onSelect: (quickPrompt: CanvasAiQuickPrompt) => void;
  quickPrompts?: readonly CanvasAiQuickPrompt[];
}) {
  const [open, setOpen] = useState(false);
  if (!quickPrompts?.length) return null;

  const handleSelect = (quickPrompt: CanvasAiQuickPrompt) => {
    onSelect(quickPrompt);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-axhub-canvas-generation-prompts-trigger
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          aria-label="打开提示词"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          <span>提示词</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="z-[1300] w-80 overflow-hidden p-0">
        <div
          data-axhub-canvas-generation-prompts-menu
          className="flex flex-col py-1"
        >
          {quickPrompts.map((quickPrompt) => (
            <button
              key={quickPrompt.id}
              type="button"
              data-axhub-canvas-generation-prompt-option
              className="flex w-full cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-start outline-none transition-colors hover:bg-accent focus:bg-accent"
              onClick={() => handleSelect(quickPrompt)}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                {quickPrompt.label}
              </span>
              {quickPrompt.description ? (
                <span className="ml-5 text-xs leading-tight text-muted-foreground">
                  {quickPrompt.description}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CanvasComposerAddAttachmentButton({
  label,
}: {
  label: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <ComposerPrimitive.AddAttachment asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="aui-composer-add-attachment size-8 rounded-full p-1 font-semibold text-xs hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30"
              aria-label={label}
            >
              <PlusIcon className="aui-attachment-add-icon size-5 stroke-[1.5px]" />
            </Button>
          </ComposerPrimitive.AddAttachment>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function useCancelCanvasActiveChatRun() {
  const { provider, workspacePath } = useAcpUiRuntimeContext();
  const remoteId = useAuiState((state) => state.threadListItem.remoteId);
  const mainThreadId = useAuiState((state) => state.threads.mainThreadId);
  const threadId = remoteId ?? mainThreadId;
  return useCallback(() => {
    void acpApiClient.cancelChat({
      threadId,
      provider,
      workspacePath,
    });
  }, [provider, threadId, workspacePath]);
}

function CanvasComposerSubmitButton({
  label,
}: {
  label: string;
}) {
  const threadIsRunning = useAuiState((state) => state.thread.isRunning);
  const cancelActiveChatRun = useCancelCanvasActiveChatRun();

  if (threadIsRunning) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <ComposerPrimitive.Cancel asChild>
              <Button
                type="button"
                variant="default"
                size="icon"
                className="aui-composer-cancel size-8 rounded-full"
                aria-label="停止生成"
                onClick={cancelActiveChatRun}
              >
                <Square className="aui-composer-cancel-icon size-3 fill-current" />
              </Button>
            </ComposerPrimitive.Cancel>
          </TooltipTrigger>
          <TooltipContent side="bottom">停止生成</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <ComposerPrimitive.Send asChild>
            <Button
              type="button"
              variant="default"
              size="icon"
              className="aui-composer-send size-8 rounded-full"
              aria-label={label}
            >
              <ArrowUp className="aui-composer-send-icon size-4" />
            </Button>
          </ComposerPrimitive.Send>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface CanvasGenerationDisplayComposerContentProps extends Omit<CanvasGenerationDisplayComposerProps, 'onSubmit' | 'preferredPromptClient' | 'showSelectors' | 'workspacePath'> {
  onEnsureAcpRuntime?: (autoStart?: boolean) => Promise<boolean>;
  onSubmitText?: (text: string, referenceImages: string[]) => CanvasGenerationDisplaySubmitResult | Promise<CanvasGenerationDisplaySubmitResult>;
  showModelSelectorFallback?: boolean;
  showSelectors?: boolean;
}

function CanvasGenerationDisplayComposerContent({
  ariaLabel,
  className,
  disabled = false,
  draftStorageKey,
  onEnsureAcpRuntime,
  onOpenAISettings,
  onSubmitText,
  placeholder,
  leadingActions,
  postSelectorActions,
  quickPrompts,
  showModelSelectorFallback = false,
  showSelectors = false,
}: CanvasGenerationDisplayComposerContentProps) {
  const aui = useAui();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const displayReferenceAttachments = useAuiState((state) => state.composer.attachments);
  const loadedDisplayDraftStorageKeyRef = useRef<string | null>(null);
  const persistDisplayDraft = useCallback((text: string) => {
    const storage = getCanvasGenerationComposerDraftStorage();
    writeCanvasGenerationComposerDraft(storage, draftStorageKey, text);
  }, [draftStorageKey]);
  const submitDisplayText = useCallback(async () => {
    if (disabled) return;
    const text = inputRef.current?.value.trim() ?? '';
    if (!text) return;
    const referenceImages = await resolveComposerAttachmentReferenceImages(displayReferenceAttachments);
    const submitResult = await onSubmitText?.(text, referenceImages);
    if (submitResult === false) {
      persistDisplayDraft(text);
      return;
    }
    const storage = getCanvasGenerationComposerDraftStorage();
    clearCanvasGenerationComposerDraft(storage, draftStorageKey);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    await aui.composer().clearAttachments();
  }, [aui, disabled, displayReferenceAttachments, draftStorageKey, onSubmitText, persistDisplayDraft]);
  useEffect(() => {
    if (!draftStorageKey) return;
    const storage = getCanvasGenerationComposerDraftStorage();
    const savedDraft = readCanvasGenerationComposerDraft(storage, draftStorageKey);
    const previousDraftStorageKey = loadedDisplayDraftStorageKeyRef.current;
    const draftStorageKeyChanged = previousDraftStorageKey !== null && previousDraftStorageKey !== draftStorageKey;
    loadedDisplayDraftStorageKeyRef.current = draftStorageKey;
    const currentText = inputRef.current?.value ?? '';
    const restoreText = resolveCanvasGenerationComposerDraftRestoreText({
      currentText,
      draftStorageKeyChanged,
      savedDraft,
    });
    if (restoreText === null || !inputRef.current || restoreText === currentText) return;
    inputRef.current.value = restoreText;
  }, [draftStorageKey]);
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    persistDisplayDraft(event.currentTarget.value);
  }, [persistDisplayDraft]);
  const handleInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submitDisplayText();
  }, [submitDisplayText]);
  const handleDisplayPaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    const pastedFiles = getClipboardImageFiles(event.nativeEvent);
    if (!pastedFiles.length) return;
    event.preventDefault();
    event.stopPropagation();
    void Promise.all(pastedFiles.map((file) => aui.composer().addAttachment(file)));
  }, [aui, disabled]);
  const handleQuickPromptClick = useCallback((quickPrompt: CanvasAiQuickPrompt) => {
    if (disabled) return;
    const nextText = appendCanvasAiQuickPrompt(inputRef.current?.value ?? '', quickPrompt.prompt);
    if (inputRef.current) {
      inputRef.current.value = nextText;
      inputRef.current.focus();
    }
    persistDisplayDraft(nextText);
  }, [disabled, persistDisplayDraft]);

  return (
    <TooltipProvider>
      <div className={cn('aui-root ax-acp-ui-scope ax-placeholder-display-composer mx-auto w-full max-w-[720px]', className)}>
        <div className="aui-composer-root relative flex w-full flex-col">
          <div
            data-slot="aui_composer-shell"
            className={cn(
              'flex min-h-[112px] w-full flex-col gap-2 rounded-2xl border border-border bg-background p-3 shadow-sm transition-colors focus-within:border-border-strong',
              disabled ? 'opacity-60' : '',
            )}
          >
            <textarea
              ref={inputRef}
              placeholder={placeholder}
              className="aui-composer-input max-h-32 min-h-14 w-full resize-none bg-transparent px-1.75 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed md:text-sm"
              rows={1}
              autoFocus
              aria-label={ariaLabel}
              disabled={disabled}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onPaste={handleDisplayPaste}
            />
            <ComposerAttachments />
            <div className="aui-composer-action-wrapper relative flex items-center justify-between text-[13px] md:text-sm">
              <div className="flex min-w-0 items-center gap-1">
                {disabled ? null : <CanvasComposerAddAttachmentButton label="添加附件" />}
                {leadingActions}
                {showSelectors ? <CanvasAcpComposerSelectors /> : null}
                {showModelSelectorFallback ? (
                  <CanvasAcpModelSelectorFallback onEnsureAcpRuntime={onEnsureAcpRuntime} onOpenAISettings={onOpenAISettings} />
                ) : null}
                {postSelectorActions}
                <CanvasGenerationDisplayQuickPromptsButton
                  disabled={disabled}
                  quickPrompts={quickPrompts}
                  onSelect={handleQuickPromptClick}
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="发送"
                  title="发送"
                  disabled={disabled}
                  className="aui-composer-send inline-flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => { void submitDisplayText(); }}
                >
                  <ArrowUp className="aui-composer-send-icon size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function CanvasGenerationDisplayComposerWithoutAcp({
  onSubmit,
  preferredPromptClient: _preferredPromptClient,
  ...props
}: CanvasGenerationDisplayComposerProps) {
  const transport = useMemo(() => new CanvasGenerationDisplayTransport(), []);
  const runtime = useChatRuntime<UIMessage>({
    transport,
    adapters: {
      attachments: canvasReferenceImageAttachmentAdapter,
    },
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <CanvasGenerationDisplayComposerContent
        {...props}
        onSubmitText={(text, referenceImages) => onSubmit?.(text, {
          contextBundle: null,
          provider: '',
          model: null,
          mode: null,
          thought: null,
          referenceImages,
        })}
      />
    </AssistantRuntimeProvider>
  );
}

function CanvasGenerationDisplayComposerRuntime({
  onEnsureAcpRuntime,
  onSubmit,
  showModelSelectorFallback,
  showSelectors,
  ...props
}: CanvasGenerationDisplayComposerContentProps & Pick<CanvasGenerationDisplayComposerProps, 'onSubmit'>) {
  const acpContext = useAcpUiRuntimeContext();
  const transport = useMemo(() => new CanvasGenerationDisplayTransport(), []);
  const runtime = useChatRuntime<UIMessage>({
    transport,
    adapters: {
      attachments: canvasReferenceImageAttachmentAdapter,
    },
  });
  const handleSubmitText = useCallback((text: string, referenceImages: string[]) => {
    return onSubmit?.(text, {
      contextBundle: acpContext.consumeContextBundle(),
      provider: acpContext.provider,
      model: acpContext.model,
      mode: acpContext.modeId,
      thought: acpContext.thoughtLevel,
      referenceImages,
    });
  }, [acpContext, onSubmit]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <CanvasGenerationDisplayComposerContent
        {...props}
        onEnsureAcpRuntime={onEnsureAcpRuntime}
        onSubmitText={handleSubmitText}
        showModelSelectorFallback={showModelSelectorFallback}
        showSelectors={showSelectors}
      />
    </AssistantRuntimeProvider>
  );
}

function CanvasGenerationDisplayComposerWithAcp({
  showSelectors,
  workspacePath,
  preferredPromptClient,
  ...props
}: CanvasGenerationDisplayComposerProps) {
  const canvasAcpRuntime = useCanvasAcpRuntimeBridge({ enabled: showSelectors, workspacePath });
  const acpSelectorDefaults = useMemo(() => resolveCanvasAcpSelectorDefaults(preferredPromptClient), [preferredPromptClient]);
  const acpRuntimeKey = useMemo(() => [
    acpSelectorDefaults.defaultProvider,
    acpSelectorDefaults.defaultModel ?? 'default-model',
    acpSelectorDefaults.providerOptions.join(','),
    workspacePath ?? 'global',
  ].join('|'), [acpSelectorDefaults, workspacePath]);

  return (
    <AcpUiProvider
      key={acpRuntimeKey}
      defaultProvider={acpSelectorDefaults.defaultProvider}
      defaultModel={acpSelectorDefaults.defaultModel}
      providerOptions={acpSelectorDefaults.providerOptions}
      showProviderSettings={false}
      workspacePath={workspacePath}
    >
      <CanvasGenerationDisplayComposerRuntime
        {...props}
        onEnsureAcpRuntime={canvasAcpRuntime.ensureRuntime}
        showModelSelectorFallback={showSelectors && canvasAcpRuntime.needsFallback}
        showSelectors={showSelectors && !canvasAcpRuntime.needsFallback}
      />
    </AcpUiProvider>
  );
}

export function CanvasGenerationDisplayComposer(props: CanvasGenerationDisplayComposerProps) {
  if (props.showSelectors) {
    return <CanvasGenerationDisplayComposerWithAcp {...props} />;
  }
  return <CanvasGenerationDisplayComposerWithoutAcp {...props} />;
}

interface CanvasAcpSelectorOption {
  value: string;
  label: string;
  description?: string;
}

interface CanvasAcpSelectorSection {
  key: 'provider' | 'model' | 'mode' | 'thinking';
  label: string;
  value: string | null;
  options: readonly CanvasAcpSelectorOption[];
  onChange: (value: string | null) => void;
  icon: React.ComponentType<{ className?: string }>;
}

const CANVAS_ACP_PROVIDER_LABELS: Record<AcpProviderKey, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  opencode: 'OpenCode',
  gemini: 'Gemini CLI',
  cursor: 'Cursor',
  qoder: 'Qoder',
  codebuddy: 'CodeBuddy',
  reasonix: 'Reasonix',
};

const CANVAS_ACP_PROVIDER_ORDER = [
  'claude',
  'codex',
  'opencode',
  'gemini',
  'cursor',
  'qoder',
  'codebuddy',
  'reasonix',
] as const satisfies readonly AcpProviderKey[];

const CANVAS_ACP_PROVIDER_OPTIONS = CANVAS_ACP_PROVIDER_ORDER.map((provider) => ({
  value: provider,
  label: CANVAS_ACP_PROVIDER_LABELS[provider],
}));

const CANVAS_ACP_CONFIG_MENU_DESKTOP_QUERY = '(min-width: 640px)';

function useCanvasAcpMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const syncMatches = () => setMatches(media.matches);
    syncMatches();
    media.addEventListener('change', syncMatches);
    return () => media.removeEventListener('change', syncMatches);
  }, [query]);

  return matches;
}

function canvasAcpCapabilityOptions(
  snapshot: AcpCapabilitySnapshot | null,
  key: 'model' | 'mode' | 'thought_level',
): CanvasAcpSelectorOption[] {
  return snapshot?.capabilities[key]?.options
    ?.filter((option) => option.value)
    .map((option) => ({
      value: option.value,
      label: option.label || option.value,
      description: option.description,
    })) ?? [];
}

function ensureCanvasAcpSelectedOption(
  options: readonly CanvasAcpSelectorOption[],
  selectedValue: string | null,
): CanvasAcpSelectorOption[] {
  if (!selectedValue || options.some((option) => option.value === selectedValue)) {
    return [...options];
  }
  return [{ value: selectedValue, label: selectedValue }, ...options];
}

function syncCanvasAcpCapabilitySnapshot(
  snapshot: AcpCapabilitySnapshot | null,
  actions: Pick<ReturnType<typeof useAcpUiRuntimeContext>, 'syncModel' | 'syncModeId' | 'syncThoughtLevel'>,
) {
  if (snapshot?.capabilities.model?.currentValue) {
    actions.syncModel(snapshot.capabilities.model.currentValue);
  }
  if (snapshot?.capabilities.mode?.currentValue) {
    actions.syncModeId(snapshot.capabilities.mode.currentValue);
  }
  if (snapshot?.capabilities.thought_level?.currentValue) {
    actions.syncThoughtLevel(snapshot.capabilities.thought_level.currentValue);
  }
}

function useCanvasAcpCapabilitySnapshot(): AcpCapabilitySnapshot | null {
  const { provider, workspacePath, syncModel, syncModeId, syncThoughtLevel } = useAcpUiRuntimeContext();
  const threadId = useAuiState((state) => state.threadListItem.remoteId ?? state.threads.mainThreadId);
  const [refreshToken, setRefreshToken] = useState(0);
  const [snapshot, setSnapshot] = useState<AcpCapabilitySnapshot | null>(() => (
    hydrateAcpCapabilityCacheFromDefaults(provider, workspacePath)
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleCapabilityRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{
        provider?: string | null;
        threadId?: string | null;
        workspacePath?: string | null;
      }>).detail;
      if (detail?.provider && detail.provider !== provider) return;
      if (detail?.threadId && detail.threadId !== threadId) return;
      if ('workspacePath' in (detail ?? {}) && (detail?.workspacePath ?? null) !== (workspacePath ?? null)) return;
      setRefreshToken((current) => current + 1);
    };

    window.addEventListener(ACP_CAPABILITY_REFRESH_EVENT, handleCapabilityRefresh);
    return () => window.removeEventListener(ACP_CAPABILITY_REFRESH_EVENT, handleCapabilityRefresh);
  }, [provider, threadId, workspacePath]);

  useEffect(() => {
    let cancelled = false;
    const cached = hydrateAcpCapabilityCacheFromDefaults(provider, workspacePath);
    setSnapshot(cached);
    syncCanvasAcpCapabilitySnapshot(cached, { syncModel, syncModeId, syncThoughtLevel });

    acpApiClient
      .getCapabilities({ provider, threadId, workspacePath })
      .then((body) => {
        if (cancelled) return;
        const nextSnapshot = body?.capabilitySnapshot ?? cached;
        setSnapshot(nextSnapshot);
        syncCanvasAcpCapabilitySnapshot(nextSnapshot, { syncModel, syncModeId, syncThoughtLevel });
      })
      .catch(() => {
        if (!cancelled) setSnapshot(cached);
      });

    return () => {
      cancelled = true;
    };
  }, [provider, refreshToken, syncModeId, syncModel, syncThoughtLevel, threadId, workspacePath]);

  return snapshot;
}

function getCanvasAcpOptionLabel(options: readonly CanvasAcpSelectorOption[], value: string | null): string {
  if (!options.length) return '';
  return options.find((option) => option.value === value)?.label || options[0].label;
}

function getCanvasAcpSelectedLabel(section: CanvasAcpSelectorSection): string {
  const selectedValue = section.value || section.options[0]?.value || null;
  return section.options.find((option) => option.value === selectedValue)?.label || selectedValue || '';
}

function CanvasAcpComposerSelectors() {
  const context = useAcpUiRuntimeContext();
  const snapshot = useCanvasAcpCapabilitySnapshot();
  const contextProviderOptions = (context as { providerOptions?: readonly AcpProviderKey[] | null }).providerOptions;
  const runtimeProviderOptions = resolveCanvasAcpRuntimeProviderOptions(contextProviderOptions, context.provider);
  const providerOptions = useMemo(() => (
    CANVAS_ACP_PROVIDER_OPTIONS.filter((option) => runtimeProviderOptions.includes(option.value))
  ), [runtimeProviderOptions]);
  const modelOptions = useMemo(() => ensureCanvasAcpSelectedOption(
    canvasAcpCapabilityOptions(snapshot, 'model'),
    context.model,
  ), [context.model, snapshot]);
  const modeOptions = useMemo(() => ensureCanvasAcpSelectedOption(
    canvasAcpCapabilityOptions(snapshot, 'mode'),
    context.modeId,
  ), [context.modeId, snapshot]);
  const thoughtOptions = useMemo(() => ensureCanvasAcpSelectedOption(
    canvasAcpCapabilityOptions(snapshot, 'thought_level'),
    context.thoughtLevel,
  ), [context.thoughtLevel, snapshot]);
  const sections = useMemo<CanvasAcpSelectorSection[]>(() => [
    {
      key: 'provider',
      label: '供应商',
      value: context.provider,
      options: providerOptions,
      onChange: context.setProvider,
      icon: Network,
    },
    {
      key: 'model',
      label: '模型',
      value: context.model,
      options: modelOptions,
      onChange: context.setModel,
      icon: SlidersHorizontal,
    },
    {
      key: 'mode',
      label: '模式',
      value: context.modeId,
      options: modeOptions,
      onChange: context.setModeId,
      icon: SlidersHorizontal,
    },
    {
      key: 'thinking',
      label: '思考深度',
      value: context.thoughtLevel,
      options: thoughtOptions,
      onChange: context.setThoughtLevel,
      icon: Gauge,
    },
  ], [
    context.modeId,
    context.model,
    context.provider,
    context.setModeId,
    context.setModel,
    context.setProvider,
    context.setThoughtLevel,
    context.thoughtLevel,
    modeOptions,
    modelOptions,
    providerOptions,
    thoughtOptions,
  ]);

  return <CanvasAcpConfigMenu sections={sections} />;
}

function CanvasAcpConfigMenu({ sections }: { sections: readonly CanvasAcpSelectorSection[] }) {
  const [open, setOpen] = useState(false);
  const isDesktopLayout = useCanvasAcpMediaQuery(CANVAS_ACP_CONFIG_MENU_DESKTOP_QUERY);
  const visibleSections = useMemo(() => sections.filter((section) => section.options.length > 0), [sections]);
  const [desktopActiveKey, setDesktopActiveKey] = useState<CanvasAcpSelectorSection['key'] | null>(visibleSections[0]?.key ?? null);
  const [mobileExpandedKey, setMobileExpandedKey] = useState<CanvasAcpSelectorSection['key'] | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const providerSection = visibleSections.find((section) => section.key === 'provider');
  const modelSection = visibleSections.find((section) => section.key === 'model');
  const desktopActiveSection = visibleSections.find((section) => section.key === desktopActiveKey) ?? visibleSections[0];
  const providerLabel = providerSection ? getCanvasAcpSelectedLabel(providerSection) : '配置';
  const modelLabel = modelSection
    ? getCanvasAcpOptionLabel(modelSection.options, modelSection.value || modelSection.options[0]?.value || null)
    : '';

  useEffect(() => {
    const nextActiveKey = visibleSections.some((section) => section.key === desktopActiveKey)
      ? desktopActiveKey
      : visibleSections[0]?.key ?? null;
    if (nextActiveKey !== desktopActiveKey) {
      setDesktopActiveKey(nextActiveKey);
    }
    if (mobileExpandedKey && !visibleSections.some((section) => section.key === mobileExpandedKey)) {
      setMobileExpandedKey(null);
    }
  }, [desktopActiveKey, mobileExpandedKey, visibleSections]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const closeMenu = () => {
      setOpen(false);
      setMobileExpandedKey(null);
    };
    const isInside = (target: EventTarget | null) => target instanceof Node && Boolean(rootRef.current?.contains(target));
    const handlePointerDown = (event: PointerEvent) => {
      if (!isInside(event.target)) closeMenu();
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (!isInside(event.target)) closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!visibleSections.length) return null;

  const handleTriggerClick = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    setDesktopActiveKey((current) => current ?? visibleSections[0]?.key ?? null);
    if (!nextOpen) {
      setMobileExpandedKey(null);
    }
  };
  const handleSectionClick = (sectionKey: CanvasAcpSelectorSection['key']) => {
    if (isDesktopLayout) {
      setDesktopActiveKey(sectionKey);
      return;
    }
    setMobileExpandedKey((current) => (current === sectionKey ? null : sectionKey));
  };

  return (
    <div ref={rootRef} className="relative px-0.5">
      <button
        type="button"
        className="inline-flex h-8 max-w-56 items-center gap-1 rounded-md px-2 text-muted-foreground text-xs hover:bg-accent hover:text-accent-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
        data-axhub-acp-config-trigger
        onClick={handleTriggerClick}
      >
        <Settings2 className="size-3.5 shrink-0" />
        <span className="truncate">{modelLabel ? `${providerLabel} · ${modelLabel}` : providerLabel}</span>
        <ChevronDown className="size-3 shrink-0" />
      </button>
      {open ? (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-[min(20rem,calc(100vw-2rem))] rounded-md border bg-popover p-1 text-popover-foreground shadow-md max-sm:w-[calc(100vw-5rem)]"
          role="menu"
          data-axhub-acp-config-root-menu
        >
          <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">配置</div>
          <div className="relative">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const selectedValue = section.value || section.options[0]?.value || null;
              const selectedLabel = getCanvasAcpOptionLabel(section.options, selectedValue);
              const isDesktopActive = section.key === desktopActiveSection?.key;
              const isMobileExpanded = section.key === mobileExpandedKey;
              return (
                <div key={section.key}>
                  <button
                    type="button"
                    className={cn(
                      'flex min-h-11 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none',
                      isDesktopActive && 'sm:bg-accent/70 sm:text-accent-foreground',
                      isMobileExpanded && 'max-sm:bg-accent/70 max-sm:text-accent-foreground',
                    )}
                    aria-haspopup="menu"
                    aria-expanded={isDesktopLayout ? isDesktopActive : isMobileExpanded}
                    data-axhub-acp-config-section={section.key}
                    onPointerEnter={(event) => {
                      if (event.pointerType === 'mouse') {
                        setDesktopActiveKey(section.key);
                      }
                    }}
                    onFocus={() => {
                      if (isDesktopLayout) setDesktopActiveKey(section.key);
                    }}
                    onClick={() => handleSectionClick(section.key)}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{section.label}</span>
                      <span className="block truncate text-muted-foreground text-xs">{getCanvasAcpSelectedLabel(section) || selectedLabel || '默认'}</span>
                    </span>
                    <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" />
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground sm:hidden" />
                  </button>
                  {isMobileExpanded ? (
                    <CanvasAcpConfigSubmenu section={section} variant="mobile" />
                  ) : null}
                </div>
              );
            })}
            {desktopActiveSection ? (
              <CanvasAcpConfigSubmenu section={desktopActiveSection} variant="desktop" />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CanvasAcpConfigSubmenu({
  section,
  variant,
}: {
  section: CanvasAcpSelectorSection;
  variant: 'desktop' | 'mobile';
}) {
  const selectedValue = section.value || section.options[0]?.value || null;
  return (
    <div
      className={cn(
        'overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground',
        variant === 'desktop'
          ? 'absolute bottom-0 left-[calc(100%+0.5rem)] hidden max-h-80 w-[min(22rem,calc(100vw-2rem))] border shadow-md sm:block'
          : 'mt-1 max-h-56 w-full border-x-0 border-b-0 border-t sm:hidden',
      )}
      role="menu"
      data-axhub-acp-config-submenu={variant}
    >
      {variant === 'desktop' ? (
        <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">{section.label}</div>
      ) : null}
      {section.options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'flex min-h-10 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none',
            option.value === selectedValue && 'bg-accent/60',
          )}
          role="menuitemradio"
          aria-checked={option.value === selectedValue}
          data-axhub-acp-config-option={option.value}
          onClick={() => {
            section.onChange(option.value);
          }}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate">{option.label}</span>
            {option.description ? (
              <span className="block truncate text-muted-foreground text-xs">{option.description}</span>
            ) : null}
          </span>
          {option.value === selectedValue ? <Check className="size-4 shrink-0" /> : null}
        </button>
      ))}
    </div>
  );
}

function CanvasAcpModelSelectorFallback({
  onEnsureAcpRuntime,
  onOpenAISettings,
}: {
  onEnsureAcpRuntime?: (autoStart?: boolean) => Promise<boolean>;
  onOpenAISettings?: () => void;
}) {
  const handleClick = async () => {
    const runtimeReady = await onEnsureAcpRuntime?.(false);
    if (!runtimeReady) {
      onOpenAISettings?.();
    }
  };

  return (
    <button
      type="button"
      data-axhub-acp-model-fallback-trigger
      aria-haspopup="menu"
      aria-expanded={false}
      className="inline-flex h-8 max-w-56 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      onClick={() => { void handleClick(); }}
    >
      <Settings2 className="size-3.5 shrink-0" />
      <span className="truncate">请选择模型</span>
      <ChevronDown className="size-3 shrink-0" />
    </button>
  );
}

function useCanvasGenerationComposerDraftBridge({
  draftStorageKey,
}: {
  draftStorageKey?: string | null;
}) {
  const aui = useAui();
  const composerText = useAuiState((state) => state.composer.text);
  const loadedDraftStorageKeyRef = useRef<string | null>(null);
  const lastDraftWriteRef = useRef<{ key: string; text: string } | null>(null);

  useEffect(() => {
    if (!draftStorageKey) return;
    const storage = getCanvasGenerationComposerDraftStorage();
    const savedDraft = readCanvasGenerationComposerDraft(storage, draftStorageKey);
    const composer = aui.composer();
    const previousDraftStorageKey = loadedDraftStorageKeyRef.current;
    const draftStorageKeyChanged = previousDraftStorageKey !== null && previousDraftStorageKey !== draftStorageKey;
    loadedDraftStorageKeyRef.current = draftStorageKey;
    const restoreText = resolveCanvasGenerationComposerDraftRestoreText({
      currentText: composer.getState().text,
      draftStorageKeyChanged,
      savedDraft,
    });
    if (restoreText === null || restoreText === composer.getState().text) return;
    composer.setText(restoreText);
  }, [aui, draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey) {
      lastDraftWriteRef.current = null;
      return;
    }
    const storage = getCanvasGenerationComposerDraftStorage();
    const lastDraftWrite = lastDraftWriteRef.current;
    if (!lastDraftWrite || lastDraftWrite.key !== draftStorageKey) {
      lastDraftWriteRef.current = { key: draftStorageKey, text: composerText };
      return;
    }
    if (composerText === lastDraftWrite.text) return;
    lastDraftWriteRef.current = { key: draftStorageKey, text: composerText };
    writeCanvasGenerationComposerDraft(storage, draftStorageKey, composerText);
  }, [composerText, draftStorageKey]);
}

function CanvasGenerationRuntimeComposerContent({
  addAttachmentTooltip,
  allowAttachments,
  ariaLabel,
  canPasteReferenceImages,
  draftStorageKey,
  footerActionsClassName,
  footerLeadingActionsClassName,
  initialLocalContextRefs,
  initialReferenceImages,
  onPasteReferenceImages,
  onEnsureAcpRuntime,
  onOpenAISettings,
  placeholder,
  quickPrompts,
  renderActions,
  renderLeadingActions,
  renderPostSelectorActions,
  renderTriggerPopovers,
  rootClassName = 'aui-composer-root',
  sendTooltip,
  showModelSelectorFallback = false,
  showSelectors = false,
  submitting,
}: CanvasGenerationRuntimeComposerProps) {
  const aui = useAui();
  const acpContext = useAcpUiRuntimeContext();
  const { replaceContextItems } = acpContext;
  const loadedInitialReferenceImagesKeyRef = useRef<string | null>(null);
  const loadedInitialLocalContextRefsKeyRef = useRef<string | null>(null);
  const initialReferenceImagesKey = useMemo(
    () => JSON.stringify(initialReferenceImages ?? []),
    [initialReferenceImages],
  );
  const initialLocalContextRefsKey = useMemo(
    () => JSON.stringify(initialLocalContextRefs ?? []),
    [initialLocalContextRefs],
  );
  const postSelectorActions = renderPostSelectorActions?.({ submitting });
  const shouldRenderInlineSelectors = showSelectors && !postSelectorActions;
  const cancelActiveChatRun = useCancelCanvasActiveChatRun();

  useCanvasGenerationComposerDraftBridge({ draftStorageKey });

  useEffect(() => {
    if (!allowAttachments || !initialReferenceImages?.length) return;
    if (loadedInitialReferenceImagesKeyRef.current === initialReferenceImagesKey) return;
    loadedInitialReferenceImagesKeyRef.current = initialReferenceImagesKey;
    const files = initialReferenceImages.map((image, index) => dataUrlToImageFile(image, index));
    void Promise.all(files.map((file) => aui.composer().addAttachment(file)));
  }, [allowAttachments, aui, initialReferenceImages, initialReferenceImagesKey]);

  useEffect(() => {
    const previousLocalContextRefsKey = loadedInitialLocalContextRefsKeyRef.current;
    if (previousLocalContextRefsKey === initialLocalContextRefsKey) return;
    loadedInitialLocalContextRefsKeyRef.current = initialLocalContextRefsKey;
    const contextItems = localContextRefsToAcpContextItems(initialLocalContextRefs ?? []);
    if (contextItems.length || previousLocalContextRefsKey !== null) {
      replaceContextItems(contextItems);
    }
  }, [initialLocalContextRefs, initialLocalContextRefsKey, replaceContextItems]);

  const handlePasteReferenceImages = useCallback(async () => {
    if (!onPasteReferenceImages) return;
    const images = await onPasteReferenceImages();
    const files = images.map((image, index) => dataUrlToImageFile(image, index));
    await Promise.all(files.map((file) => aui.composer().addAttachment(file)));
  }, [aui, onPasteReferenceImages]);

  const handleComposerPaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (canPasteReferenceImages && onPasteReferenceImages && shouldUseCanvasReferencePaste(event.clipboardData)) {
      event.preventDefault();
      event.stopPropagation();
      void handlePasteReferenceImages();
      return;
    }
    if (allowAttachments) {
      const pastedFiles = getClipboardImageFiles(event.nativeEvent);
      if (pastedFiles.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        void Promise.all(pastedFiles.map((file) => aui.composer().addAttachment(file)));
        return;
      }
    }
  }, [allowAttachments, aui, canPasteReferenceImages, handlePasteReferenceImages, onPasteReferenceImages]);
  const handleComposerKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Escape') return;
    const composer = aui.composer();
    queueMicrotask(() => {
      if (event.defaultPrevented) return;
      if (!composer.getState().canCancel) return;
      cancelActiveChatRun();
      composer.cancel();
    });
  }, [aui, cancelActiveChatRun]);
  const handleQuickPromptSelect = useCallback((quickPrompt: CanvasAiQuickPrompt) => {
    const composer = aui.composer();
    composer.setText(appendCanvasAiQuickPrompt(composer.getState().text, quickPrompt.prompt));
  }, [aui]);

  return (
    <TooltipProvider>
      <div className={cn('ax-acp-ui-scope', rootClassName)}>
        <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
          <ComposerPrimitive.AttachmentDropzone asChild>
            <div
              data-slot="aui_composer-shell"
              className="flex w-full flex-col gap-2 rounded-(--composer-radius) border bg-background p-(--composer-padding) transition-shadow focus-within:border-ring/75 focus-within:ring-2 focus-within:ring-ring/20 data-[dragging=true]:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/50"
            >
              <ComposerPrimitive.Unstable_TriggerPopoverRoot>
                {allowAttachments ? <ComposerAttachments /> : null}
                <ComposerPrimitive.Input
                  placeholder={placeholder}
                  className="aui-composer-input max-h-32 min-h-10 w-full resize-none bg-transparent px-1.75 py-1 text-[13px] outline-none placeholder:text-muted-foreground/80 md:text-sm"
                  rows={1}
                  autoFocus
                  aria-label={ariaLabel}
                  cancelOnEscape={false}
                  onKeyDown={handleComposerKeyDown}
                  onPaste={handleComposerPaste}
                />
                {renderTriggerPopovers?.()}
              </ComposerPrimitive.Unstable_TriggerPopoverRoot>
              <div className="aui-composer-action-wrapper relative flex items-center justify-between text-[13px] md:text-sm">
                <div className="flex min-w-0 items-center gap-1">
                  {allowAttachments ? <CanvasComposerAddAttachmentButton label={addAttachmentTooltip} /> : null}
                  {shouldRenderInlineSelectors ? <CanvasAcpComposerSelectors /> : null}
                  {showModelSelectorFallback ? (
                    <CanvasAcpModelSelectorFallback onEnsureAcpRuntime={onEnsureAcpRuntime} onOpenAISettings={onOpenAISettings} />
                  ) : null}
                  {showSelectors && postSelectorActions ? <CanvasAcpComposerSelectors /> : null}
                  {postSelectorActions}
                  <CanvasGenerationDisplayQuickPromptsButton
                    disabled={submitting}
                    quickPrompts={quickPrompts}
                    onSelect={handleQuickPromptSelect}
                  />
                  {renderLeadingActions ? (
                    <div className={footerLeadingActionsClassName}>
                      {renderLeadingActions?.({ submitting })}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  {renderActions ? (
                    <div className={footerActionsClassName}>
                      {renderActions?.({ submitting })}
                    </div>
                  ) : null}
                  <CanvasComposerSubmitButton label={sendTooltip} />
                </div>
              </div>
            </div>
          </ComposerPrimitive.AttachmentDropzone>
        </ComposerPrimitive.Root>
      </div>
    </TooltipProvider>
  );
}

function useAssistantUiDialogOverlayDismiss() {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (!target.closest('.aui-dialog-overlay')) return;
      event.preventDefault();
      event.stopPropagation();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);
}

function CanvasGenerationRuntimeComposer({
  onSubmitPrompt,
  scene,
  draftStorageKey,
  ...composerProps
}: CanvasGenerationRuntimeComposerProps & Pick<CanvasGenerationComposerProps, 'onSubmitPrompt'>) {
  useAssistantUiDialogOverlayDismiss();
  const runtimeContext = useAcpUiRuntimeContext();
  const acpContext = runtimeContext;
  const transport = useMemo(
    () => new CanvasGenerationMakeTransport(scene, onSubmitPrompt, () => {
      const contextBundle = acpContext.consumeContextBundle();
      return {
        contextBundle,
        provider: runtimeContext.provider,
        model: runtimeContext.model,
        mode: runtimeContext.modeId,
        thought: runtimeContext.thoughtLevel,
      };
    }, draftStorageKey),
    [acpContext, draftStorageKey, onSubmitPrompt, runtimeContext.model, runtimeContext.modeId, runtimeContext.provider, runtimeContext.thoughtLevel, scene],
  );
  const runtime = useChatRuntime<UIMessage>({
    transport,
    adapters: {
      attachments: canvasReferenceImageAttachmentAdapter,
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <CanvasGenerationRuntimeComposerContent {...composerProps} draftStorageKey={draftStorageKey} scene={scene} />
    </AssistantRuntimeProvider>
  );
}

function CanvasGenerationRuntimeComposerWithAcp(
  {
    workspacePath,
    showSelectors,
    preferredPromptClient,
    ...props
  }: CanvasGenerationRuntimeComposerProps & Pick<CanvasGenerationComposerProps, 'onSubmitPrompt' | 'workspacePath'>,
) {
  const canvasAcpRuntime = useCanvasAcpRuntimeBridge({ enabled: showSelectors, workspacePath });
  const acpSelectorDefaults = useMemo(() => resolveCanvasAcpSelectorDefaults(preferredPromptClient), [preferredPromptClient]);
  const acpRuntimeKey = useMemo(() => [
    acpSelectorDefaults.defaultProvider,
    acpSelectorDefaults.defaultModel ?? 'default-model',
    acpSelectorDefaults.providerOptions.join(','),
    workspacePath ?? 'global',
  ].join('|'), [acpSelectorDefaults, workspacePath]);

  return (
    <AcpUiProvider
      key={acpRuntimeKey}
      defaultProvider={acpSelectorDefaults.defaultProvider}
      defaultModel={acpSelectorDefaults.defaultModel}
      providerOptions={acpSelectorDefaults.providerOptions}
      showProviderSettings={false}
      workspacePath={workspacePath}
    >
      <CanvasGenerationRuntimeComposer
        {...props}
        onEnsureAcpRuntime={canvasAcpRuntime.ensureRuntime}
        showModelSelectorFallback={showSelectors && canvasAcpRuntime.needsFallback}
        showSelectors={showSelectors && !canvasAcpRuntime.needsFallback}
      />
    </AcpUiProvider>
  );
}

export default function CanvasGenerationComposer({
  addAttachmentTooltip,
  allowAttachments,
  ariaLabel,
  canPasteReferenceImages,
  className = 'aui-root ax-ai-image-composer-host pointer-events-auto absolute z-30',
  dataAttribute,
  draftStorageKey,
  footerActionsClassName,
  footerLeadingActionsClassName,
  initialLocalContextRefs,
  initialReferenceImages,
  onOpenAISettings,
  onPasteReferenceImages,
  onSubmitPrompt,
  placement,
  placementMode = 'absolute',
  placeholder,
  preferredPromptClient,
  quickPrompts,
  renderActions,
  renderLeadingActions,
  renderPostSelectorActions,
  renderTriggerPopovers,
  rootClassName,
  scene,
  sendTooltip,
  showSelectors,
  submitting,
  topContent,
  workspacePath,
}: CanvasGenerationComposerProps) {
  const dataAttributes = { [dataAttribute]: true } as Record<string, boolean>;
  const placementStyle = placementMode === 'fixed-bottom-center'
    ? {
        position: 'absolute',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        width: placement.width,
        maxWidth: 'calc(100% - 32px)',
      }
    : {
        left: placement.left,
        top: placement.top,
        width: placement.width,
        maxWidth: 'calc(100vw - 32px)',
      };

  return (
    <div
      {...dataAttributes}
      className={className}
      style={placementStyle as React.CSSProperties}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      {topContent ? (
        <div className="ax-ai-image-composer-top-content">
          {topContent}
        </div>
      ) : null}
      <CanvasGenerationRuntimeComposerWithAcp
        addAttachmentTooltip={addAttachmentTooltip}
        allowAttachments={allowAttachments}
        ariaLabel={ariaLabel}
        canPasteReferenceImages={canPasteReferenceImages}
        draftStorageKey={draftStorageKey}
        footerActionsClassName={footerActionsClassName}
        footerLeadingActionsClassName={footerLeadingActionsClassName}
        initialLocalContextRefs={initialLocalContextRefs}
        initialReferenceImages={initialReferenceImages}
        onOpenAISettings={onOpenAISettings}
        onPasteReferenceImages={onPasteReferenceImages}
        onSubmitPrompt={onSubmitPrompt}
        placeholder={placeholder}
        preferredPromptClient={preferredPromptClient}
        quickPrompts={quickPrompts}
        renderActions={renderActions}
        renderLeadingActions={renderLeadingActions}
        renderPostSelectorActions={renderPostSelectorActions}
        renderTriggerPopovers={renderTriggerPopovers}
        rootClassName={rootClassName}
        scene={scene}
        sendTooltip={sendTooltip}
        showSelectors={showSelectors}
        submitting={submitting}
        workspacePath={workspacePath}
      />
    </div>
  );
}
