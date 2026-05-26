import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Copy, ImageIcon, LayoutTemplate, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

import { getAiImageTaskStore, type AiImageTaskRecord, type AiImageStoreState } from './aiImageStore';
import { getPrototypeGenerationTaskStore, type PrototypeGenerationTaskRecord } from '../prototype-generation/prototypeTaskStore';

interface AiImageHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertImages?: (task: AiImageTaskRecord) => void;
}

type HistoryEntry =
  | {
    kind: 'image';
    id: string;
    task: AiImageTaskRecord;
    title: string;
    prompt: string;
    status: string;
    meta: string;
    createdAt: number;
    error: string | null;
    coverDataUrl?: string;
  }
  | {
    kind: 'prototype';
    id: string;
    task: PrototypeGenerationTaskRecord;
    title: string;
    prompt: string;
    status: string;
    meta: string;
    createdAt: number;
    error: string | null;
  };

function formatDuration(task: { elapsed: number | null; createdAt: number }): string {
  const elapsed = task.elapsed ?? Math.max(0, Date.now() - task.createdAt);
  const seconds = Math.floor(elapsed / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function imageStatusLabel(task: AiImageTaskRecord): string {
  if (task.status === 'done') return `完成 ${task.outputImages.length}/${task.params.n}`;
  if (task.status === 'error') return '失败';
  if (task.stage === 'submitting') return '提交中';
  if (task.stage === 'preparing-context') return '准备上下文中';
  if (task.stage === 'generating-prompt') return '生成提示词中';
  if (task.stage === 'generating') return '生成图片中';
  if (task.stage === 'downloading') return '下载结果中';
  return '生成图片中';
}

function prototypeStatusLabel(task: PrototypeGenerationTaskRecord): string {
  if (task.status === 'error') return '失败';
  if (task.status === 'done') return task.outputPrototypeName ? `完成 ${task.outputPrototypeName}` : '完成';
  if (task.stage === 'submitting') return '提交中';
  if (task.stage === 'refreshing') return '刷新资源中';
  return '生成中';
}

function createImageEntry(task: AiImageTaskRecord, state: AiImageStoreState): HistoryEntry {
  const coverId = task.outputImages[0];
  const cover = coverId ? state.images[coverId] : undefined;
  return {
    kind: 'image',
    id: task.id,
    task,
    title: task.status === 'done' ? `图片生成 · ${task.outputImages.length} 张` : '图片生成',
    prompt: task.prompt,
    status: imageStatusLabel(task),
    meta: task.params.size,
    createdAt: task.createdAt,
    error: task.error,
    coverDataUrl: cover?.dataUrl,
  };
}

function createPrototypeEntry(task: PrototypeGenerationTaskRecord): HistoryEntry {
  return {
    kind: 'prototype',
    id: task.id,
    task,
    title: task.outputPrototypeName ? `原型生成 · ${task.outputPrototypeName}` : '原型生成',
    prompt: task.prompt,
    status: prototypeStatusLabel(task),
    meta: task.provider,
    createdAt: task.createdAt,
    error: task.error || task.note || null,
  };
}

export default function AiImageHistoryDialog({
  open,
  onOpenChange,
  onInsertImages,
}: AiImageHistoryDialogProps) {
  const [state, setState] = useState<AiImageStoreState>(() => getAiImageTaskStore().getState());
  const [prototypeTasks, setPrototypeTasks] = useState<PrototypeGenerationTaskRecord[]>(() => getPrototypeGenerationTaskStore().getTasks());

  useEffect(() => getAiImageTaskStore().subscribe(setState), []);
  useEffect(() => getPrototypeGenerationTaskStore().subscribe(() => {
    setPrototypeTasks([...getPrototypeGenerationTaskStore().getTasks()]);
  }), []);

  const historyEntries = useMemo(() => [
    ...state.tasks.map((task) => createImageEntry(task, state)),
    ...prototypeTasks.map((task) => createPrototypeEntry(task)),
  ].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)), [prototypeTasks, state]);

  const handleCopyPrompt = async (prompt: string) => {
    if (!prompt.trim()) return;
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success('已复制提示词');
    } catch (error) {
      console.error('Failed to copy generation prompt:', error);
      toast.error('复制提示词失败');
    }
  };

  const handleDeleteEntry = (entry: HistoryEntry) => {
    if (entry.kind === 'image') {
      getAiImageTaskStore().deleteTask(entry.task.id);
      return;
    }
    getPrototypeGenerationTaskStore().deleteTask(entry.task.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,980px)] max-w-[980px] gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4 text-primary" />
            生成历史
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[min(70vh,560px)]">
          <div className="grid gap-3 p-5 md:grid-cols-2">
            {historyEntries.length === 0 ? (
              <div className="col-span-full flex min-h-[132px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                暂无生成记录
              </div>
            ) : historyEntries.map((entry) => {
              const isImageDone = entry.kind === 'image' && entry.task.status === 'done' && entry.task.outputImages.length > 0;
              const isRunning = entry.task.status === 'running';
              return (
                <div
                  key={`${entry.kind}-${entry.id}`}
                  className="group grid h-[136px] grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-md border bg-background"
                >
                  <div className="relative flex h-full items-center justify-center overflow-hidden bg-muted text-muted-foreground">
                    {entry.kind === 'image' && entry.coverDataUrl ? (
                      <img src={entry.coverDataUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid justify-items-center gap-1.5 px-3 text-center text-[11px]">
                        {isRunning ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : entry.kind === 'prototype' ? (
                          <LayoutTemplate className="h-7 w-7" />
                        ) : (
                          <ImageIcon className="h-7 w-7" />
                        )}
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded bg-background/90 px-2 py-0.5 text-[11px] font-medium shadow-sm">
                      {entry.kind === 'image' ? '图片' : '原型'}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{entry.title}</div>
                        <div className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          <span className="truncate">{entry.status}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="h-6 w-6"
                          aria-label="复制提示词"
                          title="复制提示词"
                          onClick={() => { void handleCopyPrompt(entry.prompt); }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {entry.kind === 'image' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="h-6 w-6"
                            aria-label="添加到画布"
                            title="添加到画布"
                            onClick={() => onInsertImages?.(entry.task)}
                            disabled={!isImageDone || !onInsertImages}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          aria-label="删除记录"
                          title="删除记录"
                          onClick={() => handleDeleteEntry(entry)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="line-clamp-2 text-xs leading-5 text-foreground">
                      {entry.prompt || '(无提示词)'}
                    </div>
                    {entry.error ? (
                      <div className="line-clamp-1 text-[11px] leading-4 text-destructive">{entry.error}</div>
                    ) : null}
                    <div className="mt-auto flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(entry.task)}
                      </span>
                      <span className="truncate">{entry.meta}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
