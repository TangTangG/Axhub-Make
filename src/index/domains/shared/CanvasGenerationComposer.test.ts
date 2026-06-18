import type { ThreadMessage } from '@assistant-ui/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@axhub/acp/react', () => ({
  AcpUiProvider: ({ children }: { children: unknown }) => children,
  useAcpUiRuntimeContext: () => ({
    consumeContextBundle: () => null,
    modeId: null,
    model: null,
    provider: 'codex',
    replaceContextItems: vi.fn(),
    thoughtLevel: null,
  }),
}));

vi.mock('@axhub/acp/runtime', () => ({
  ACP_CAPABILITY_REFRESH_EVENT: 'axhub:acp-capability-refresh',
  acpApiClient: {
    cancelChat: vi.fn(),
  },
  configureAcpUiRuntime: vi.fn(),
}));

vi.mock('@axhub/acp/ui', () => ({
  AcpComposerSelectors: () => null,
  ComposerAttachments: () => null,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: unknown }) => children,
  PopoverContent: ({ children }: { children: unknown }) => children,
  PopoverTrigger: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: unknown }) => children,
  TooltipContent: ({ children }: { children: unknown }) => children,
  TooltipTrigger: ({ children }: { children: unknown }) => children,
}));

vi.mock('../../services/index.api', () => ({
  apiService: {
    getAssistantRuntime: vi.fn(),
  },
}));

vi.mock('./canvasReferenceClipboard', () => ({
  shouldUseCanvasReferencePaste: vi.fn(() => false),
}));

vi.mock('../ai-generation/canvasAiSceneRegistry', () => ({
  appendCanvasAiQuickPrompt: (current: string, prompt: string) => `${current}${prompt}`,
}));

async function loadMessageExtraction() {
  const mod = await import('./CanvasGenerationComposer');
  return {
    canvasReferenceImageAttachmentAdapter: mod.canvasReferenceImageAttachmentAdapter,
    extractCanvasGenerationPromptFromMessage: mod.extractCanvasGenerationPromptFromMessage,
    extractCanvasGenerationReferenceImagesFromMessage: mod.extractCanvasGenerationReferenceImagesFromMessage,
  };
}

describe('CanvasGenerationComposer message extraction', () => {
  it('extracts prompt text from text message parts', async () => {
    const { extractCanvasGenerationPromptFromMessage } = await loadMessageExtraction();
    const message = {
      content: [
        { type: 'text', text: 'Create a product card.' },
        { type: 'text', text: 'Use the attached screenshot.' },
      ],
    } as ThreadMessage;

    expect(extractCanvasGenerationPromptFromMessage(message)).toBe(
      'Create a product card.\n\nUse the attached screenshot.',
    );
  });

  it('extracts image reference data URLs from assistant-ui image attachments', async () => {
    const { extractCanvasGenerationReferenceImagesFromMessage } = await loadMessageExtraction();
    const dataUrl = 'data:image/png;base64,aW1hZ2U=';
    const message = {
      attachments: [
        {
          id: 'reference-1',
          type: 'image',
          name: 'reference.png',
          contentType: 'image/png',
          content: [{ type: 'image', image: dataUrl, filename: 'reference.png' }],
          status: { type: 'complete' },
        },
      ],
    } as ThreadMessage;

    expect(extractCanvasGenerationReferenceImagesFromMessage(message)).toEqual([dataUrl]);
  });

  it('extracts image reference data URLs from AI SDK file attachment content', async () => {
    const { extractCanvasGenerationReferenceImagesFromMessage } = await loadMessageExtraction();
    const dataUrl = 'data:image/png;base64,aW1hZ2U=';
    const message = {
      attachments: [
        {
          id: 'reference-1',
          type: 'image',
          name: 'reference.png',
          contentType: 'image/png',
          content: [{ type: 'file', data: dataUrl, mimeType: 'image/png', filename: 'reference.png' }],
          status: { type: 'complete' },
        },
      ],
    } as ThreadMessage;

    expect(extractCanvasGenerationReferenceImagesFromMessage(message)).toEqual([dataUrl]);
  });

  it('keeps canvas composer attachments image-only and sends assistant-ui image content', async () => {
    const { canvasReferenceImageAttachmentAdapter } = await loadMessageExtraction();
    const file = new File(['image'], 'reference.png', { type: 'image/png' });

    const pendingAttachment = await canvasReferenceImageAttachmentAdapter.add({ file });
    const completeAttachment = await canvasReferenceImageAttachmentAdapter.send(pendingAttachment);

    expect(canvasReferenceImageAttachmentAdapter.accept).toBe('image/*');
    expect(pendingAttachment.type).toBe('image');
    expect(pendingAttachment.file).toBe(file);
    expect(completeAttachment.content).toEqual([
      {
        type: 'image',
        image: 'data:image/png;base64,aW1hZ2U=',
        filename: 'reference.png',
      },
    ]);
  });
});
