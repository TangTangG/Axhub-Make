import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Clock, Copy, ImageIcon, Images, LayoutTemplate, LinkIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  getAiImageTaskStore,
  type AiImageStoreState,
  type AiImageTaskParams,
  type AiImageTaskRecord,
} from './aiImageStore';

interface AiImageDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedImageId?: string;
  sourceTaskId?: string;
  onCreateImageToImage?: (imageDataUrl: string) => void;
  onCreateImageToPrototype?: (imageDataUrl: string) => void;
}

function formatTime(value: number | null): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value)).replace(/\//g, '-');
}

function formatDuration(task: AiImageTaskRecord): string {
  const elapsed = task.elapsed ?? Math.max(0, Date.now() - task.createdAt);
  const seconds = Math.floor(elapsed / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function statusLabel(task: AiImageTaskRecord): string {
  if (task.status === 'done') return `完成 ${task.outputImages.length}/${task.params.n}`;
  if (task.status === 'error') return '失败';
  if (task.stage === 'submitting') return '提交中';
  if (task.stage === 'preparing-context') return '准备上下文中';
  if (task.stage === 'generating-prompt') return '生成提示词中';
  if (task.stage === 'generating') return '生成图片中';
  if (task.stage === 'downloading') return '下载结果中';
  return '生成图片中';
}

function findTaskForImage(
  state: AiImageStoreState,
  selectedImageId?: string,
  sourceTaskId?: string,
): AiImageTaskRecord | null {
  if (sourceTaskId) {
    const taskBySource = state.tasks.find((task) => task.id === sourceTaskId);
    if (taskBySource) return taskBySource;
  }
  if (!selectedImageId) return null;
  return state.tasks.find((task) => task.outputImages.includes(selectedImageId)) ?? null;
}

function resolveCurrentImageId(task: AiImageTaskRecord | null, selectedImageId?: string): string {
  if (!task) return selectedImageId || '';
  if (selectedImageId && task.outputImages.includes(selectedImageId)) return selectedImageId;
  return task.outputImages[0] || selectedImageId || '';
}

function getParamDisplay(
  task: AiImageTaskRecord,
  key: keyof AiImageTaskParams,
  actualParams?: Partial<AiImageTaskParams>,
): string {
  const requested = task.params[key];
  const actual = actualParams?.[key] ?? task.actualParams?.[key];
  if (actual === undefined || actual === null || String(actual) === String(requested)) {
    return String(requested);
  }
  return `${String(requested)} | ${String(actual)}`;
}

function redactRawResponse(value: string): string {
  return value.replace(/"(b64_json|base64|data)"\s*:\s*"[^"]+"/g, '"$1": "<base64_data>"');
}

export default function AiImageDetailDialog({
  open,
  onOpenChange,
  selectedImageId,
  sourceTaskId,
  onCreateImageToImage,
  onCreateImageToPrototype,
}: AiImageDetailDialogProps) {
  const [state, setState] = useState<AiImageStoreState>(() => getAiImageTaskStore().getState());

  useEffect(() => getAiImageTaskStore().subscribe(setState), []);

  const task = useMemo(
    () => findTaskForImage(state, selectedImageId, sourceTaskId),
    [state, selectedImageId, sourceTaskId],
  );
  const currentImageId = resolveCurrentImageId(task, selectedImageId);
  const image = currentImageId ? state.images[currentImageId] : undefined;
  const actualParams = task && currentImageId ? task.actualParamsByImage?.[currentImageId] : undefined;
  const revisedPrompt = task && currentImageId ? task.revisedPromptByImage?.[currentImageId]?.trim() : '';
  const showRevisedPrompt = Boolean(task && revisedPrompt && revisedPrompt !== task.prompt.trim());

  const handleDelete = () => {
    if (!task) return;
    getAiImageTaskStore().deleteTask(task.id);
    onOpenChange(false);
  };

  const handleCreateImageToImage = () => {
    if (!image?.dataUrl) return;
    onCreateImageToImage?.(image.dataUrl);
    onOpenChange(false);
  };

  const handleCreateImageToPrototype = () => {
    if (!image?.dataUrl) return;
    onCreateImageToPrototype?.(image.dataUrl);
    onOpenChange(false);
  };

  const handleCopyText = async (text: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制提示词');
    } catch (error) {
      console.error('Failed to copy AI image prompt:', error);
      toast.error('复制提示词失败');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(84vh,760px)] min-h-[420px] flex-col w-[min(94vw,920px)] max-w-[920px] gap-0 overflow-hidden p-0 [&>[data-dialog-close]]:right-5 [&>[data-dialog-close]]:top-5">
        <DialogTitle className="sr-only">图片详情</DialogTitle>
        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(280px,0.95fr)_minmax(320px,1fr)]">
          <div className="relative flex min-h-[260px] items-center justify-center bg-muted/60 p-5">
            {task ? (
              <span className="absolute left-4 top-4 rounded bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
                {statusLabel(task)}
              </span>
            ) : null}
            {image ? (
              <img src={image.dataUrl} alt="" className="max-h-[calc(min(84vh,760px)-112px)] max-w-full rounded-md object-contain shadow-sm" />
            ) : (
              <div className="grid justify-items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
                未找到图片缓存
              </div>
            )}
          </div>
          <ScrollArea className="min-h-0">
            <div className="grid gap-5 p-5 pr-12">
              {!task ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  未找到这张图片的生成记录
                </div>
              ) : (
                <>
                  <section className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex min-w-0 items-center gap-1.5">
                        <h3 className="text-xs font-medium uppercase text-muted-foreground">输入内容</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 text-muted-foreground"
                          aria-label="复制输入提示词"
                          title="复制输入提示词"
                          onClick={() => { void handleCopyText(task.prompt); }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                      {task.prompt || '(无提示词)'}
                    </p>
                    {showRevisedPrompt ? (
                      <div className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="font-medium">API 改写提示词</div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-6 w-6 text-amber-900/70 hover:text-amber-950"
                            aria-label="复制 AI 改写提示词"
                            title="复制 AI 改写提示词"
                            onClick={() => { void handleCopyText(revisedPrompt); }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="whitespace-pre-wrap break-words">{revisedPrompt}</div>
                      </div>
                    ) : null}
                    {task.error ? (
                      <div className="flex gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="break-words">{task.error}</span>
                      </div>
                    ) : null}
                  </section>

                  <section className="grid gap-2">
                    <h3 className="text-xs font-medium uppercase text-muted-foreground">参数配置</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-muted/60 px-3 py-2">
                        <span className="text-muted-foreground">尺寸</span>
                        <div className="mt-1 font-medium">{getParamDisplay(task, 'size', actualParams)}</div>
                      </div>
                      <div className="rounded-md bg-muted/60 px-3 py-2">
                        <span className="text-muted-foreground">质量</span>
                        <div className="mt-1 font-medium">{getParamDisplay(task, 'quality', actualParams)}</div>
                      </div>
                      <div className="rounded-md bg-muted/60 px-3 py-2">
                        <span className="text-muted-foreground">格式</span>
                        <div className="mt-1 font-medium">{getParamDisplay(task, 'output_format', actualParams)}</div>
                      </div>
                      <div className="rounded-md bg-muted/60 px-3 py-2">
                        <span className="text-muted-foreground">审核</span>
                        <div className="mt-1 font-medium">{getParamDisplay(task, 'moderation', actualParams)}</div>
                      </div>
                      {task.params.output_compression != null || actualParams?.output_compression != null ? (
                        <div className="rounded-md bg-muted/60 px-3 py-2">
                          <span className="text-muted-foreground">压缩率</span>
                          <div className="mt-1 font-medium">{getParamDisplay(task, 'output_compression', actualParams)}</div>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="grid gap-2 text-xs text-muted-foreground">
                    <div className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      创建于 {formatTime(task.createdAt)}
                      <span>·</span>
                      耗时 {formatDuration(task)}
                    </div>
                    {image?.width && image?.height ? (
                      <div>原图尺寸 {image.width} x {image.height}</div>
                    ) : null}
                  </section>

                  {task.rawImageUrls?.length ? (
                    <section className="grid gap-2">
                      <h3 className="inline-flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                        <LinkIcon className="h-3.5 w-3.5" />
                        原始图片链接
                      </h3>
                      <div className="grid gap-1">
                        {task.rawImageUrls.map((url, index) => (
                          <div key={`${url}-${index}`} className="truncate rounded-md bg-muted/60 px-3 py-2 text-xs" title={url}>
                            {url}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {task.rawResponsePayload ? (
                    <section className="grid gap-2">
                      <h3 className="text-xs font-medium uppercase text-muted-foreground">原始响应数据</h3>
                      <pre className="max-h-40 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-md bg-muted/60 p-3 text-[11px] leading-5 text-muted-foreground">
                        {redactRawResponse(task.rawResponsePayload)}
                      </pre>
                    </section>
                  ) : null}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
        {task ? (
          <div className="flex shrink-0 justify-between border-t bg-background px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCreateImageToImage}>
                <Images className="h-4 w-4" />
                图生图
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleCreateImageToPrototype}>
                <LayoutTemplate className="h-4 w-4" />
                图生原型
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
              删除记录
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
