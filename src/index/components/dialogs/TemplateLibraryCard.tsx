import React from 'react';
import { Copy, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface TemplateLibraryCardItem {
    id: string;
    title: string;
    sourcePath: string;
    coverUrl: string;
    description: string;
    author?: string;
    authorUrl?: string;
    previewUrl?: string;
    canDirectImport?: boolean;
    directImportDisabledReason?: string;
}

interface TemplateLibraryCardProps {
    template: TemplateLibraryCardItem;
    importing?: boolean;
    directImportDisabled?: boolean;
    directImportTooltip?: string;
    compact?: boolean;
    onPreview?: (template: TemplateLibraryCardItem) => void;
    onCopyPrompt?: (template: TemplateLibraryCardItem) => void;
    onDirectImport?: (template: TemplateLibraryCardItem) => void;
}

export default function TemplateLibraryCard({
    template,
    importing = false,
    directImportDisabled = false,
    directImportTooltip = '',
    compact = false,
    onPreview,
    onCopyPrompt,
    onDirectImport,
}: TemplateLibraryCardProps) {
    const authorLabel = String(template.author || '').trim();
    const previewHint = template.previewUrl ? '点击打开在线预览' : '该模板暂不支持在线预览';
    const canCopyPrompt = Boolean(onCopyPrompt);
    const canDirectImport = Boolean(onDirectImport);

    return (
        <div
            role="button"
            tabIndex={0}
            title={previewHint}
            aria-label={`${template.title}，${previewHint}`}
            className="overflow-hidden rounded-md border bg-background text-left transition hover:border-foreground/25 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => onPreview?.(template)}
            onKeyDown={(event) => {
                if (event.currentTarget !== event.target) {
                    return;
                }
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onPreview?.(template);
                }
            }}
        >
            <div className={compact ? 'grid grid-cols-1 gap-3 p-3' : 'grid grid-cols-[160px_minmax(0,1fr)] gap-4 p-3'}>
                <div className={compact ? 'aspect-[10/7] overflow-hidden rounded border bg-muted' : 'h-[112px] overflow-hidden rounded border bg-muted'}>
                    <img
                        src={template.coverUrl}
                        alt={template.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                </div>
                <div className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{template.title}</div>
                            <div className="mt-1 truncate text-[12px] text-muted-foreground">
                                {authorLabel ? (
                                    template.authorUrl ? (
                                        <a
                                            href={template.authorUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="hover:text-foreground hover:underline"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            作者：{authorLabel}
                                        </a>
                                    ) : (
                                        <span>作者：{authorLabel}</span>
                                    )
                                ) : (
                                    <span>{template.sourcePath}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <p className="line-clamp-2 break-words text-[12px] leading-5 text-muted-foreground [overflow-wrap:anywhere]">{template.description}</p>
                    {(canCopyPrompt || canDirectImport) ? (
                        <div
                            className="flex flex-wrap gap-1.5"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                        >
                            {canCopyPrompt ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onCopyPrompt?.(template);
                                    }}
                                    disabled={directImportDisabled && importing}
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                    复制提示词
                                </Button>
                            ) : null}
                            {canDirectImport ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="inline-flex">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onDirectImport?.(template);
                                                    }}
                                                    disabled={directImportDisabled}
                                                >
                                                    {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                                    直接导入
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        {directImportTooltip ? (
                                            <TooltipContent side="top">
                                                {directImportTooltip}
                                            </TooltipContent>
                                        ) : null}
                                    </Tooltip>
                                </TooltipProvider>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
