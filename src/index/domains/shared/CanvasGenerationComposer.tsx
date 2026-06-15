import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './canvas-generation-acp-scope.css';
import {
  AssistantRuntimeProvider,
  useAui,
  useAuiState,
  type AttachmentAdapter,
  type ThreadMessage,
} from '@assistant-ui/react';
import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { AcpUiProvider, useAcpUiRuntimeContext } from '@axhub/acp/react';
import { AcpComposerSelectors, Composer } from '@axhub/acp/ui';
import { ACP_CAPABILITY_REFRESH_EVENT, configureAcpUiRuntime } from '@axhub/acp/runtime';
import type { ContextBundleV2, ContextItem } from '@axhub/acp/runtime';
import type {
  ChatTransport,
  FileUIPart,
  UIMessage,
  UIMessageChunk,
} from 'ai';
import { ArrowUp, ChevronDown, Plus, Settings2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { apiService } from '../../services/index.api';
import { shouldUseCanvasReferencePaste } from './canvasReferenceClipboard';
import type { CanvasLocalContextRef } from '../ai-image/canvasReferenceImages';
import {
  appendCanvasAiQuickPrompt,
  type CanvasAiQuickPrompt,
} from '../ai-generation/canvasAiSceneRegistry';
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

async function readFilesAsDataUrls(files: File[]): Promise<string[]> {
  return Promise.all(files.map((file) => readFileAsDataUrl(file)));
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

interface CanvasGenerationDisplayComposerContentProps extends Omit<CanvasGenerationDisplayComposerProps, 'onSubmit' | 'showSelectors' | 'workspacePath'> {
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [displayReferenceImages, setDisplayReferenceImages] = useState<string[]>([]);
  const loadedDisplayDraftStorageKeyRef = useRef<string | null>(null);
  const persistDisplayDraft = useCallback((text: string) => {
    const storage = getCanvasGenerationComposerDraftStorage();
    writeCanvasGenerationComposerDraft(storage, draftStorageKey, text);
  }, [draftStorageKey]);
  const submitDisplayText = useCallback(async () => {
    if (disabled) return;
    const text = inputRef.current?.value.trim() ?? '';
    if (!text) return;
    const referenceImages = displayReferenceImages;
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
    setDisplayReferenceImages([]);
  }, [disabled, displayReferenceImages, draftStorageKey, onSubmitText, persistDisplayDraft]);
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
    void readFilesAsDataUrls(pastedFiles).then((images) => {
      setDisplayReferenceImages((previous) => [...previous, ...images]);
    });
  }, [disabled]);
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
          {displayReferenceImages.length ? (
            <div className="flex items-center justify-between rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
              <span data-axhub-display-composer-attachment-count>
                已添加 {displayReferenceImages.length} 张图片
              </span>
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
                onClick={() => { setDisplayReferenceImages([]); }}
              >
                清除
              </button>
            </div>
          ) : null}
          <div className="aui-composer-action-wrapper relative flex items-center justify-between text-[13px] md:text-sm">
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                aria-label="添加附件"
                title="添加附件"
                disabled={disabled}
                className="aui-composer-add-attachment inline-flex size-8 items-center justify-center rounded-full p-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted-foreground/15 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {}}
              >
                <Plus className="aui-attachment-add-icon size-5 stroke-[1.5px]" />
              </button>
              {leadingActions}
              {showSelectors ? <AcpComposerSelectors /> : null}
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
  );
}

function CanvasGenerationDisplayComposerWithoutAcp({
  onSubmit,
  ...props
}: CanvasGenerationDisplayComposerProps) {
  return (
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
  const runtime = useChatRuntime<UIMessage>({ transport });
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
  ...props
}: CanvasGenerationDisplayComposerProps) {
  const canvasAcpRuntime = useCanvasAcpRuntimeBridge({ enabled: showSelectors, workspacePath });

  return (
    <AcpUiProvider defaultProvider="codex" workspacePath={workspacePath}>
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
  const handleQuickPromptSelect = useCallback((quickPrompt: CanvasAiQuickPrompt) => {
    const composer = aui.composer();
    composer.setText(appendCanvasAiQuickPrompt(composer.getState().text, quickPrompt.prompt));
  }, [aui]);

  return (
    <div className={cn('ax-acp-ui-scope', rootClassName)}>
      <Composer
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        showAttachments={allowAttachments}
        showCommandMenu={false}
        showSelectors={showSelectors && !postSelectorActions}
        leadingActions={
          showModelSelectorFallback || postSelectorActions || renderLeadingActions || quickPrompts?.length ? (
            <>
              {showModelSelectorFallback ? (
                <CanvasAcpModelSelectorFallback onEnsureAcpRuntime={onEnsureAcpRuntime} onOpenAISettings={onOpenAISettings} />
              ) : null}
              {showSelectors && postSelectorActions ? <AcpComposerSelectors /> : null}
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
            </>
          ) : null
        }
        trailingActions={
          renderActions ? (
            <div className={footerActionsClassName}>
              {renderActions?.({ submitting })}
            </div>
          ) : null
        }
        triggerPopovers={renderTriggerPopovers?.()}
        onPaste={handleComposerPaste}
      />
    </div>
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
    ...props
  }: CanvasGenerationRuntimeComposerProps & Pick<CanvasGenerationComposerProps, 'onSubmitPrompt' | 'workspacePath'>,
) {
  const canvasAcpRuntime = useCanvasAcpRuntimeBridge({ enabled: showSelectors, workspacePath });

  return (
    <AcpUiProvider defaultProvider="codex" workspacePath={workspacePath}>
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
