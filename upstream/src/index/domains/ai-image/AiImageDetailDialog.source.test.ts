import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './AiImageDetailDialog.tsx'), 'utf8');
}

describe('AiImageDetailDialog source', () => {
  it('renders a generated image detail view instead of a history grid', () => {
    const source = readSource();

    expect(source).toContain('interface AiImageDetailDialogProps');
    expect(source).toContain('selectedImageId?: string');
    expect(source).toContain('图片详情');
    expect(source).toContain('<DialogTitle className="sr-only">图片详情</DialogTitle>');
    expect(source).toContain('输入内容');
    expect(source).toContain('API 改写提示词');
    expect(source).toContain('参数配置');
    expect(source).toContain('创建于');
    expect(source).toContain('耗时');
    expect(source).toContain('原始图片链接');
    expect(source).toContain('原始响应数据');
    expect(source).not.toContain('grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3');
    expect(source).not.toContain('生成历史');
  });

  it('keeps the detail footer fixed and moves status out of the scroll header', () => {
    const source = readSource();

    expect(source).not.toContain('<DialogHeader');
    expect(source).not.toContain('ImageIcon className="h-4 w-4 text-primary"');
    expect(source).toContain('className="flex max-h-[min(84vh,760px)] min-h-[420px] flex-col w-[min(94vw,920px)] max-w-[920px] gap-0 overflow-hidden p-0');
    expect(source).toContain('className="relative flex min-h-[260px] items-center justify-center bg-muted/60 p-5"');
    expect(source).toContain('className="absolute left-4 top-4 rounded bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm"');
    expect(source).toContain('className="flex shrink-0 justify-between border-t bg-background px-5 py-4"');
    expect(source).toContain('[&>[data-dialog-close]]:right-5 [&>[data-dialog-close]]:top-5');
    expect(source).not.toContain('<span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">');
  });

  it('adds copy icon buttons for the original and revised prompts', () => {
    const source = readSource();

    expect(source).toContain('Copy');
    expect(source).toContain('handleCopyText');
    expect(source).toContain("navigator.clipboard.writeText(text)");
    expect(source).toContain('aria-label="复制输入提示词"');
    expect(source).toContain('title="复制输入提示词"');
    expect(source).toContain('aria-label="复制 AI 改写提示词"');
    expect(source).toContain('title="复制 AI 改写提示词"');
    expect(source).toContain("toast.success('已复制提示词')");
  });

  it('offers image-to-image and image-to-prototype actions from the detail footer', () => {
    const source = readSource();

    expect(source).toContain('onCreateImageToImage?: (imageDataUrl: string) => void');
    expect(source).toContain('onCreateImageToPrototype?: (imageDataUrl: string) => void');
    expect(source).toContain('handleCreateImageToImage');
    expect(source).toContain('handleCreateImageToPrototype');
    expect(source).toContain('图生图');
    expect(source).toContain('图生原型');
    expect(source).toContain('onClick={handleCreateImageToImage}');
    expect(source).toContain('onClick={handleCreateImageToPrototype}');
    expect(source).toContain('className="flex shrink-0 justify-between border-t bg-background px-5 py-4"');
  });

  it('does not show the requested image count in the detail parameter cards', () => {
    const source = readSource();

    expect(source).toContain('参数配置');
    expect(source).not.toContain('<span className="text-muted-foreground">数量</span>');
    expect(source).not.toContain("getParamDisplay(task, 'n', actualParams)");
  });

  it('wraps raw response data without a horizontal scrollbar', () => {
    const source = readSource();

    expect(source).toContain('max-h-40 overflow-y-auto overflow-x-hidden');
    expect(source).toContain('whitespace-pre-wrap break-words');
    expect(source).not.toContain('max-h-40 overflow-auto rounded-md');
  });

  it('shows all AI image task stages in the detail status badge', () => {
    const source = readSource();

    expect(source).toContain("if (task.stage === 'preparing-context') return '准备上下文中';");
    expect(source).toContain("if (task.stage === 'generating-prompt') return '生成提示词中';");
    expect(source).toContain("if (task.stage === 'generating') return '生成图片中';");
    expect(source).toContain("if (task.stage === 'downloading') return '下载结果中';");
  });
});
