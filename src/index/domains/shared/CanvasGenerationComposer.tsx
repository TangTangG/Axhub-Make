import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import '@assistant-ui/react-ui/styles/index.css';
import '@assistant-ui/react-ui/styles/themes/default.css';
import { Composer, ThreadConfigProvider } from '@assistant-ui/react-ui';
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  SimpleImageAttachmentAdapter,
  useAui,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage,
} from '@assistant-ui/react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { shouldUseCanvasReferencePaste } from './canvasReferenceClipboard';

export interface CanvasGenerationComposerPlacement {
  left: number;
  top: number;
  width: number;
}

type CanvasGenerationComposerPlacementMode = 'absolute' | 'fixed-bottom-center';

export interface CanvasGenerationSubmitResult {
  ok: boolean;
  text: string;
  error?: string;
}

interface CanvasGenerationRuntimeComposerProps {
  allowAttachments: boolean;
  addAttachmentTooltip: string;
  ariaLabel: string;
  attachmentsClassName?: string;
  canPasteReferenceImages?: boolean;
  footerActionsClassName?: string;
  footerClassName?: string;
  footerLeadingActionsClassName?: string;
  initialReferenceImages?: string[];
  onPasteReferenceImages?: () => Promise<string[]>;
  placeholder: string;
  renderActions?: (props: { submitting: boolean }) => React.ReactNode;
  renderLeadingActions?: (props: { submitting: boolean }) => React.ReactNode;
  renderTriggerPopovers?: () => React.ReactNode;
  rootClassName?: string;
  sendTooltip: string;
  submitting: boolean;
}

export interface CanvasGenerationComposerProps extends CanvasGenerationRuntimeComposerProps {
  className?: string;
  dataAttribute: string;
  onSubmitPrompt: (prompt: string, message: ThreadMessage) => Promise<CanvasGenerationSubmitResult>;
  placement: CanvasGenerationComposerPlacement;
  placementMode?: CanvasGenerationComposerPlacementMode;
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
    .filter((part): part is { type: 'image'; image: string } => part.type === 'image')
    .map((part) => part.image) ?? [];
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

function CanvasGenerationRuntimeComposerContent({
  allowAttachments,
  addAttachmentTooltip,
  ariaLabel,
  attachmentsClassName,
  canPasteReferenceImages,
  footerActionsClassName,
  footerClassName,
  footerLeadingActionsClassName,
  initialReferenceImages,
  onPasteReferenceImages,
  placeholder,
  renderActions,
  renderLeadingActions,
  rootClassName = 'aui-composer-root',
  sendTooltip,
  submitting,
}: CanvasGenerationRuntimeComposerProps) {
  const aui = useAui();
  const loadedInitialReferenceImagesKeyRef = useRef<string | null>(null);
  const initialReferenceImagesKey = useMemo(
    () => JSON.stringify(initialReferenceImages ?? []),
    [initialReferenceImages],
  );

  useEffect(() => {
    if (!allowAttachments || !initialReferenceImages?.length) return;
    if (loadedInitialReferenceImagesKeyRef.current === initialReferenceImagesKey) return;
    loadedInitialReferenceImagesKeyRef.current = initialReferenceImagesKey;
    const files = initialReferenceImages.map((image, index) => dataUrlToImageFile(image, index));
    void Promise.all(files.map((file) => aui.composer().addAttachment(file)));
  }, [allowAttachments, aui, initialReferenceImages, initialReferenceImagesKey]);

  const handlePasteReferenceImages = useCallback(async () => {
    if (!onPasteReferenceImages) return;
    const images = await onPasteReferenceImages();
    const files = images.map((image, index) => dataUrlToImageFile(image, index));
    await Promise.all(files.map((file) => aui.composer().addAttachment(file)));
  }, [aui, onPasteReferenceImages]);

  return (
    <Composer.Root
      className={rootClassName}
      onPaste={(event: React.ClipboardEvent<HTMLFormElement>) => {
        if (!canPasteReferenceImages || !onPasteReferenceImages) return;
        if (!shouldUseCanvasReferencePaste(event.clipboardData)) return;
        event.preventDefault();
        event.stopPropagation();
        void handlePasteReferenceImages();
      }}
    >
      {allowAttachments ? <Composer.Attachments /> : null}
      <Composer.Input
        rows={1}
        autoFocus
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      <div className={footerClassName}>
        {allowAttachments || renderLeadingActions ? (
          <div className={footerLeadingActionsClassName}>
            {allowAttachments ? <Composer.AddAttachment tooltip={addAttachmentTooltip} /> : null}
            {renderLeadingActions?.({ submitting })}
          </div>
        ) : null}
        <div className={footerActionsClassName}>
          {renderActions?.({ submitting })}
          <Composer.Send
            tooltip={sendTooltip}
            className={submitting ? 'opacity-60' : undefined}
            disabled={submitting}
            aria-label={sendTooltip}
          >
            {submitting ? <Loader2 className="animate-spin" /> : null}
          </Composer.Send>
        </div>
      </div>
    </Composer.Root>
  );
}

function CanvasGenerationRuntimeComposer(props: CanvasGenerationRuntimeComposerProps) {
  useAssistantUiDialogOverlayDismiss();

  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      {props.renderTriggerPopovers?.()}
      <CanvasGenerationRuntimeComposerContent {...props} />
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
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

export default function CanvasGenerationComposer({
  addAttachmentTooltip,
  allowAttachments,
  ariaLabel,
  attachmentsClassName,
  canPasteReferenceImages,
  className = 'aui-root ax-ai-image-composer-host pointer-events-auto absolute z-30',
  dataAttribute,
  footerActionsClassName,
  footerClassName,
  footerLeadingActionsClassName,
  initialReferenceImages,
  onPasteReferenceImages,
  onSubmitPrompt,
  placement,
  placementMode = 'absolute',
  placeholder,
  renderActions,
  renderLeadingActions,
  renderTriggerPopovers,
  rootClassName,
  sendTooltip,
  submitting,
}: CanvasGenerationComposerProps) {
  const chatModelAdapter = useMemo<ChatModelAdapter>(() => ({
    async run({ messages }) {
      const message = messages.at(-1);
      const prompt = message ? extractCanvasGenerationPromptFromMessage(message) : '';
      if (!message || !prompt) {
        toast.error('请输入提示词');
        return {
          content: [{ type: 'text', text: '请输入提示词' }],
          status: { type: 'incomplete', reason: 'error', error: '请输入提示词' },
        };
      }

      const result = await onSubmitPrompt(prompt, message);
      return {
        content: [{ type: 'text', text: result.text }],
        status: result.ok
          ? { type: 'complete', reason: 'stop' }
          : { type: 'incomplete', reason: 'error', error: result.error || result.text },
      };
    },
  }), [onSubmitPrompt]);
  const attachmentsAdapter = useMemo(() => new SimpleImageAttachmentAdapter(), []);
  const runtime = useLocalRuntime(chatModelAdapter, {
    adapters: {
      attachments: attachmentsAdapter,
    },
  });
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
      <AssistantRuntimeProvider runtime={runtime}>
        <ThreadConfigProvider
          config={{
            composer: { allowAttachments },
            strings: {
              composer: {
                addAttachment: { tooltip: addAttachmentTooltip },
                send: { tooltip: sendTooltip },
                input: { placeholder },
              },
            },
          }}
        >
          <CanvasGenerationRuntimeComposer
            addAttachmentTooltip={addAttachmentTooltip}
            allowAttachments={allowAttachments}
            ariaLabel={ariaLabel}
            attachmentsClassName={attachmentsClassName}
            canPasteReferenceImages={canPasteReferenceImages}
            footerActionsClassName={footerActionsClassName}
            footerClassName={footerClassName}
            footerLeadingActionsClassName={footerLeadingActionsClassName}
            initialReferenceImages={initialReferenceImages}
            onPasteReferenceImages={onPasteReferenceImages}
            placeholder={placeholder}
            renderActions={renderActions}
            renderLeadingActions={renderLeadingActions}
            renderTriggerPopovers={renderTriggerPopovers}
            rootClassName={rootClassName}
            sendTooltip={sendTooltip}
            submitting={submitting}
          />
        </ThreadConfigProvider>
      </AssistantRuntimeProvider>
    </div>
  );
}
