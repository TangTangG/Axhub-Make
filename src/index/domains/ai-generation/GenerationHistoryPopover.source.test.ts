import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './GenerationHistoryPopover.tsx'), 'utf8');
}

describe('GenerationHistoryPopover source', () => {
  it('renders generic project artifacts in a top-right popover list', () => {
    const source = readSource();

    expect(source).toContain("import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';");
    expect(source).toContain("import { ScrollArea } from '@/components/ui/scroll-area';");
    expect(source).toContain('getGenerationArtifactHistoryStore');
    expect(source).toContain('targetPath');
    expect(source).toContain('side="bottom"');
    expect(source).toContain('align="end"');
    expect(source).toContain('w-[min(94vw,420px)]');
    expect(source).toContain('h-[min(70vh,640px)]');
    expect(source).toContain('生成记录');
  });

  it('is embeddable in the canvas capsule without owning absolute positioning', () => {
    const source = readSource();

    expect(source).toContain('buttonClassName?: string;');
    expect(source).toContain("open={open}");
    expect(source).toContain("onOpenChange={setOpen}");
    expect(source).toContain("data-active={open ? 'true' : undefined}");
    expect(source).toContain('className={cn(');
    expect(source).toContain("'axhub-generation-history-popover__trigger data-[active=true]:text-primary data-[active=true]:hover:text-primary'");
    expect(source).not.toContain('<div className="axhub-generation-history-popover">');
    expect(source).not.toContain('border-b px-3 py-2');
    expect(source).toContain('className="flex gap-1 overflow-x-auto px-3 py-2"');
    expect(source).toContain('className="grid gap-2.5 p-3"');
    expect(source).toContain('className="grid min-h-[116px] grid-cols-[minmax(0,1fr)_96px] gap-3 rounded-md border border-border bg-background p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"');
    expect(source).toContain('className="ml-auto flex aspect-square w-24 items-center justify-center overflow-hidden rounded-md bg-muted/50 text-muted-foreground transition-colors"');
    expect(source).toContain('className="mt-2 flex justify-start gap-0.5"');
    expect(source).not.toContain('className="mt-2 flex justify-end gap-0.5"');
    expect(source).not.toContain('min-h-[92px] grid-cols-[44px_minmax(0,1fr)]');
    expect(source).not.toContain('grid-cols-[40px_minmax(0,1fr)]');
  });

  it('supports all artifact kinds and expected record actions', () => {
    const source = readSource();

    expect(source).toContain("{ value: 'all', label: '全部' }");
    expect(source).toContain("{ value: 'image', label: '图片' }");
    expect(source).toContain("{ value: 'prototype', label: '原型' }");
    expect(source).toContain("{ value: 'document', label: '文档' }");
    expect(source).toContain("{ value: 'drawio', label: 'Drawio' }");
    expect(source).not.toContain("{ value: 'file', label: '文件' }");
    expect(source).not.toContain("{ value: 'link', label: '链接' }");
    expect(source).toContain("'image'");
    expect(source).toContain("'prototype'");
    expect(source).toContain("'document'");
    expect(source).toContain("'drawio'");
    expect(source).toContain("'file'");
    expect(source).toContain("'link'");
    expect(source).not.toContain('handleCopy');
    expect(source).not.toContain('Copy,');
    expect(source).toContain('handleOpen');
    expect(source).toContain('handleDelete');
    expect(source).toContain('onInsertArtifact');
    expect(source).not.toContain('aria-label="复制路径或链接"');
    expect(source).toContain("tooltip=\"打开产物\"");
    expect(source).toContain('aria-label="添加到画布"');
    expect(source).toContain('tooltip="添加到画布"');
    expect(source).toContain('当前画布没有项目级生成记录');
    expect(source).not.toContain('aria-label="添加到草稿"');
    expect(source).not.toContain('title="添加到草稿"');
    expect(source).not.toContain('当前草稿没有项目级生成记录');
    expect(source).toContain('aria-label="删除记录"');
    expect(source).toContain('tooltip="删除记录"');
  });

  it('keeps artifact titles readable and removes redundant preview buttons', () => {
    const source = readSource();

    expect(source).toContain('function displayArtifactTitle');
    expect(source).toContain('function resolveArtifactPreviewUrl');
    expect(source).toContain('function canShowImagePreview');
    expect(source).toContain('function buildArtifactHistoryAssetUrl');
    expect(source).toContain("replace(/^draw(?:\\.io|io)?\\s*图表产物[：:]\\s*/iu, '')");
    expect(source).toContain('className="line-clamp-2 text-[15px] font-semibold leading-5 text-foreground"');
    expect(source).toContain('title={displayTitle}');
    expect(source).toContain('const [failedPreviewUrls, setFailedPreviewUrls] = useState<Record<string, true>>({});');
    expect(source).toContain('const showImagePreview = canShowImagePreview(artifact, previewUrl) && !failedPreviewUrls[previewUrl];');
    expect(source).toContain('showImagePreview ? (');
    expect(source).toContain('<img');
    expect(source).toContain('src={previewUrl}');
    expect(source).toContain('alt={displayTitle}');
    expect(source).toContain('onError={() => markPreviewFailed(previewUrl)}');
    expect(source).toContain('className="h-full w-full object-cover"');
    expect(source).toContain('className="flex h-10 w-10 items-center justify-center rounded-md bg-background/70"');
    expect(source).toContain('function canOpenArtifact');
    expect(source).toContain("if (artifact.kind === 'image' || artifact.kind === 'drawio') return false;");
    expect(source).toContain('{canOpenArtifact(artifact) ? (');
  });

  it('opens generated prototypes and docs through the Make shell deep links', () => {
    const source = readSource();

    expect(source).toContain("import { buildIndexDeepLinkUrl } from '../../app/index-page/resourceDeepLink';");
    expect(source).toContain("resourceType: 'prototype'");
    expect(source).toContain("view: 'demo'");
    expect(source).toContain("resourceType: 'doc'");
    expect(source).not.toContain("return `/prototypes/${encodeURIComponent");
    expect(source).not.toContain("`/api/docs/${encodeURIComponent");
  });

  it('uses Radix tooltips for popover and card action buttons', () => {
    const source = readSource();

    expect(source).toContain("import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';");
    expect(source).toContain('function TooltipIconButton');
    expect(source).toContain('<TooltipProvider>');
    expect(source).toContain('<TooltipContent side="bottom">');
    expect(source).toContain('tooltip="刷新生成记录"');
  });
});
