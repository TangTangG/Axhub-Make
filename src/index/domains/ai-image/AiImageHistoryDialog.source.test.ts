import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './AiImageHistoryDialog.tsx'), 'utf8');
}

describe('AiImageHistoryDialog source', () => {
  it('lays out mixed generation records as compact two-column cards', () => {
    const source = readSource();

    expect(source).toContain('md:grid-cols-2');
    expect(source).not.toContain('lg:grid-cols-3');
    expect(source).toContain("import { getPrototypeGenerationTaskStore, type PrototypeGenerationTaskRecord } from '../prototype-generation/prototypeTaskStore';");
    expect(source).toContain('const historyEntries = useMemo');
    expect(source).toContain("kind: 'image'");
    expect(source).toContain("kind: 'prototype'");
    expect(source).toContain("grid h-[136px] grid-cols-[112px_minmax(0,1fr)]");
    expect(source).toContain("relative flex h-full items-center justify-center overflow-hidden bg-muted");
    expect(source).toContain('h-full w-full object-cover');
    expect(source).toContain('line-clamp-2');
    expect(source).not.toContain('h-[292px]');
    expect(source).not.toContain('h-40');
  });

  it('renders copy prompt, add image, and delete actions in the compact card header', () => {
    const source = readSource();

    expect(source).toContain("import { Clock, Copy, ImageIcon, LayoutTemplate, Loader2, Plus, Trash2 } from 'lucide-react';");
    expect(source).toContain('handleCopyPrompt');
    expect(source).toContain("navigator.clipboard.writeText(prompt)");
    expect(source).toContain("toast.success('已复制提示词')");
    expect(source).toContain('aria-label="复制提示词"');
    expect(source).toContain('title="复制提示词"');
    expect(source).toContain('aria-label="添加到画布"');
    expect(source).toContain('title="添加到画布"');
    expect(source).toContain('onClick={() => onInsertImages?.(entry.task)}');
    expect(source).toContain('<Plus className="h-3.5 w-3.5" />');
    expect(source).toContain('aria-label="删除记录"');
    expect(source).toContain('title="删除记录"');
    expect(source).toContain("entry.kind === 'image'");
    expect(source).toContain("entry.kind === 'prototype'");
  });

  it('shows all AI image task stages in history records', () => {
    const source = readSource();

    expect(source).toContain("if (task.stage === 'preparing-context') return '准备上下文中';");
    expect(source).toContain("if (task.stage === 'generating-prompt') return '生成提示词中';");
    expect(source).toContain("if (task.stage === 'generating') return '生成图片中';");
    expect(source).toContain("if (task.stage === 'downloading') return '下载结果中';");
  });
});
