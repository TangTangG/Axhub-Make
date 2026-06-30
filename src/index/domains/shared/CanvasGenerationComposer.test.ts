import type { ThreadMessage } from '@assistant-ui/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@axhub/acp/runtime', () => ({
  ACP_CAPABILITY_REFRESH_EVENT: 'axhub:acp-capability-refresh',
  AcpUiProvider: ({ children }: { children: unknown }) => children,
  acpApiClient: {
    cancelChat: vi.fn(),
  },
  configureAcpUiRuntime: vi.fn(),
  useAcpUiRuntimeContext: () => ({
    consumeContextBundle: () => null,
    modeId: null,
    model: null,
    provider: 'codex',
    replaceContextItems: vi.fn(),
    thoughtLevel: null,
  }),
}));

vi.mock('@axhub/acp/composer', () => ({
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

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: () => null,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: unknown }) => children,
  DialogContent: ({ children }: { children: unknown }) => children,
  DialogFooter: ({ children }: { children: unknown }) => children,
  DialogHeader: ({ children }: { children: unknown }) => children,
  DialogTitle: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/components/ui/toggle-group', () => ({
  ToggleGroup: ({ children }: { children: unknown }) => children,
  ToggleGroupItem: ({ children }: { children: unknown }) => children,
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
    canvasGeneralFileAttachmentAdapter: mod.canvasGeneralFileAttachmentAdapter,
    canvasReferenceImageAttachmentAdapter: mod.canvasReferenceImageAttachmentAdapter,
    extractCanvasGenerationAttachmentPartsFromMessage: mod.extractCanvasGenerationAttachmentPartsFromMessage,
    extractCanvasGenerationPromptFromMessage: mod.extractCanvasGenerationPromptFromMessage,
    extractCanvasGenerationReferenceImagesFromMessage: mod.extractCanvasGenerationReferenceImagesFromMessage,
    buildCanvasProjectResourceContextItems: mod.buildCanvasProjectResourceContextItems,
    resolveCanvasAcpRuntimeProviderOptions: mod.resolveCanvasAcpRuntimeProviderOptions,
    resolveCanvasAcpSelectorDefaults: mod.resolveCanvasAcpSelectorDefaults,
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

  it('lets placeholder display composer attachments accept any file and keeps file content', async () => {
    const { canvasGeneralFileAttachmentAdapter } = await loadMessageExtraction();
    const file = new File(['pdf'], 'brief.pdf', { type: 'application/pdf' });

    const pendingAttachment = await canvasGeneralFileAttachmentAdapter.add({ file });
    const completeAttachment = await canvasGeneralFileAttachmentAdapter.send(pendingAttachment);

    expect(canvasGeneralFileAttachmentAdapter.accept).toBe('*');
    expect(pendingAttachment.type).toBe('file');
    expect(pendingAttachment.file).toBe(file);
    expect(completeAttachment.content).toEqual([
      {
        type: 'file',
        data: 'data:application/pdf;base64,cGRm',
        filename: 'brief.pdf',
        mimeType: 'application/pdf',
      },
    ]);
  });

  it('extracts all attachment file parts while still using only images as references', async () => {
    const {
      extractCanvasGenerationAttachmentPartsFromMessage,
      extractCanvasGenerationReferenceImagesFromMessage,
    } = await loadMessageExtraction();
    const imageDataUrl = 'data:image/png;base64,aW1hZ2U=';
    const pdfDataUrl = 'data:application/pdf;base64,cGRm';
    const message = {
      attachments: [
        {
          id: 'reference-1',
          type: 'image',
          name: 'reference.png',
          contentType: 'image/png',
          content: [{ type: 'image', image: imageDataUrl, filename: 'reference.png' }],
          status: { type: 'complete' },
        },
        {
          id: 'file-1',
          type: 'file',
          name: 'brief.pdf',
          contentType: 'application/pdf',
          content: [{ type: 'file', data: pdfDataUrl, mimeType: 'application/pdf', filename: 'brief.pdf' }],
          status: { type: 'complete' },
        },
      ],
    } as ThreadMessage;

    expect(extractCanvasGenerationReferenceImagesFromMessage(message)).toEqual([imageDataUrl]);
    expect(extractCanvasGenerationAttachmentPartsFromMessage(message)).toEqual([
      {
        type: 'image',
        image: imageDataUrl,
        filename: 'reference.png',
      },
      {
        type: 'file',
        data: pdfDataUrl,
        mimeType: 'application/pdf',
        filename: 'brief.pdf',
      },
    ]);
  });

  it('limits ACP selector providers to Claude Code, Codex, OpenCode, plus the user default provider', async () => {
    const { resolveCanvasAcpSelectorDefaults } = await loadMessageExtraction();

    expect(resolveCanvasAcpSelectorDefaults('acp:codex')).toEqual({
      defaultProvider: 'codex',
      defaultModel: 'gpt-5.5',
      providerOptions: ['claude', 'codex', 'opencode'],
    });
    expect(resolveCanvasAcpSelectorDefaults('acp:gemini')).toEqual({
      defaultProvider: 'gemini',
      defaultModel: 'gemini-3-pro-preview',
      providerOptions: ['claude', 'codex', 'opencode', 'gemini'],
    });
  });

  it('falls back to fixed ACP provider options when the runtime context omits providerOptions', async () => {
    const { resolveCanvasAcpRuntimeProviderOptions } = await loadMessageExtraction();

    expect(resolveCanvasAcpRuntimeProviderOptions(undefined, 'codex')).toEqual(['claude', 'codex', 'opencode']);
    expect(resolveCanvasAcpRuntimeProviderOptions(undefined, 'gemini')).toEqual(['claude', 'codex', 'opencode', 'gemini']);
  });

  it('builds project resource context from selected files and folders without expanding folders', async () => {
    const { buildCanvasProjectResourceContextItems } = await loadMessageExtraction();

    const items = buildCanvasProjectResourceContextItems({
      trees: {
        prototypes: [
          {
            id: 'folder:prototypes:admin',
            kind: 'folder',
            title: '后台原型',
            folderPath: 'admin',
            children: [
              {
                id: 'item:prototypes:settings',
                kind: 'item',
                title: '设置页',
                itemKey: 'prototypes/settings',
              },
            ],
          },
          {
            id: 'item:prototypes:dashboard',
            kind: 'item',
            title: '首页',
            itemKey: 'prototypes/dashboard',
          },
        ],
        docs: [
          {
            id: 'folder:docs:assets',
            kind: 'folder',
            title: '素材',
            folderPath: 'assets',
            children: [
              {
                id: 'item:docs:assets/guide.md',
                kind: 'item',
                title: '指南',
                itemKey: 'docs/assets/guide.md',
                path: 'assets/guide.md',
              },
            ],
          },
        ],
        themes: [
          {
            id: 'folder:themes:brand',
            kind: 'folder',
            title: '品牌设计',
            folderPath: 'brand',
            children: [
              {
                id: 'item:themes:brand-dark',
                kind: 'item',
                title: '深色主题',
                itemKey: 'themes/brand-dark',
              },
            ],
          },
          {
            id: 'folder-themes-zhineng',
            kind: 'folder',
            title: '智能',
            children: [
              {
                id: 'item:themes:claude',
                kind: 'item',
                title: 'Claude',
                itemKey: 'themes/claude',
              },
            ],
          },
          {
            id: 'item:themes:brand-light',
            kind: 'item',
            title: '浅色主题',
            itemKey: 'themes/brand-light',
          },
        ],
      },
      items: {
        prototypes: [
          {
            name: 'dashboard',
            displayName: '首页',
            jsUrl: '',
            specUrl: '',
          },
          {
            name: 'settings',
            displayName: '设置页',
            jsUrl: '',
            specUrl: '',
          },
        ],
        docs: [
          {
            name: 'assets/guide.md',
            displayName: '指南',
            jsUrl: '',
            specUrl: '',
            filePath: 'assets/guide.md',
          },
        ],
        themes: [
          {
            name: 'brand-light',
            displayName: '浅色主题',
            path: 'src/themes/brand-light',
          },
          {
            name: 'brand-dark',
            displayName: '深色主题',
            path: 'src/themes/brand-dark',
          },
          {
            name: 'claude',
            displayName: 'Claude',
            path: 'src/themes/claude',
          },
        ],
      },
      selectedKeys: new Set([
        'prototypes:folder:prototypes:admin',
        'prototypes:item:prototypes:dashboard',
        'docs:folder:docs:assets',
        'themes:folder:themes:brand',
        'themes:folder-themes-zhineng',
        'themes:item:themes:brand-light',
      ]),
    });

    expect(items).toEqual([
      expect.objectContaining({
        kind: 'file',
        id: 'axhub:project-resource-folder:prototypes:src/prototypes/admin',
        path: 'src/prototypes/admin',
        name: '后台原型',
        metadata: expect.objectContaining({
          source: 'axhub-make-placeholder-resource-picker',
          resourceType: 'prototype',
          resourceKind: 'folder',
        }),
      }),
      expect.objectContaining({
        kind: 'file',
        path: 'src/prototypes/dashboard/index.tsx',
        name: '首页',
      }),
      expect.objectContaining({
        kind: 'file',
        id: 'axhub:project-resource-folder:docs:src/resources/assets',
        path: 'src/resources/assets',
        name: '素材',
        metadata: expect.objectContaining({
          source: 'axhub-make-placeholder-resource-picker',
          resourceType: 'doc',
          resourceKind: 'folder',
        }),
      }),
      expect.objectContaining({
        kind: 'file',
        id: 'axhub:project-resource-folder:themes:src/themes/brand',
        path: 'src/themes/brand',
        name: '品牌设计',
        metadata: expect.objectContaining({
          source: 'axhub-make-placeholder-resource-picker',
          resourceType: 'theme',
          resourceKind: 'folder',
        }),
      }),
      expect.objectContaining({
        kind: 'file',
        id: 'axhub:project-resource-folder:themes:src/themes/智能',
        path: 'src/themes/智能',
        name: '智能',
        metadata: expect.objectContaining({
          source: 'axhub-make-placeholder-resource-picker',
          resourceType: 'theme',
          resourceKind: 'folder',
          inferredFolderPath: true,
        }),
      }),
      expect.objectContaining({
        kind: 'file',
        path: 'src/themes/brand-light/index.tsx',
        name: '浅色主题',
      }),
    ]);
    expect(items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'src/prototypes/settings/index.tsx' }),
      expect.objectContaining({ path: 'src/resources/assets/guide.md' }),
      expect.objectContaining({ path: 'src/themes/brand-dark/index.tsx' }),
      expect.objectContaining({ path: 'src/themes/claude/index.tsx' }),
      expect.objectContaining({ path: 'src/themes/folder-themes-zhineng' }),
    ]));
  });
});
