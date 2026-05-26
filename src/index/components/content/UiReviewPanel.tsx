import React from 'react';
import { Copy, RotateCw, Scaling } from 'lucide-react';
import { XMarkdown } from '@ant-design/x-markdown';
import type { ComponentProps } from '@ant-design/x-markdown';
import { Mermaid, XProvider } from '@ant-design/x';
import zhCN_X from '@ant-design/x/locale/zh_CN';
import { Segmented } from 'antd';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { REVIEW_KIND_CONFIGS, type ReviewKind } from '../../utils/uiReviewPrompt';

interface UiReviewPanelProps {
    activeKind: ReviewKind;
    markdown: string;
    updatedAt?: string | null;
    loading?: boolean;
    error?: string;
    pageZoomEnabled: boolean;
    onKindChange: (kind: ReviewKind) => void;
    onCopyPrompt: () => void | Promise<void>;
    onTogglePageZoom: () => void;
}

function formatReviewTime(value?: string | null): string {
    if (!value) return '暂无';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无';
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const Code: React.FC<ComponentProps> = (props) => {
    const { className, children } = props;
    const lang = className?.match(/language-(\w+)/u)?.[1] || '';
    if (typeof children !== 'string') return <code className={className}>{children}</code>;
    if (lang === 'mermaid') {
        return <Mermaid>{children}</Mermaid>;
    }
    return <code className={className}>{children}</code>;
};

export default function UiReviewPanel({
    activeKind,
    markdown,
    updatedAt = null,
    loading = false,
    error = '',
    pageZoomEnabled,
    onKindChange,
    onCopyPrompt,
    onTogglePageZoom,
}: UiReviewPanelProps) {
    const trimmedMarkdown = markdown.trim();
    const hasReview = trimmedMarkdown.length > 0;
    const activeConfig = REVIEW_KIND_CONFIGS[activeKind] ?? REVIEW_KIND_CONFIGS.design;

    return (
        <aside className="flex h-full w-[380px] shrink-0 flex-col border-l bg-background shadow-sm">
            <div className="flex min-h-[58px] items-center justify-between gap-3 border-b px-4 py-2">
                <div className="min-w-0 flex-1">
                    <Segmented
                        size="small"
                        value={activeKind}
                        options={[
                            { value: 'design', label: '设计评审' },
                            { value: 'requirements', label: '需求评审' },
                        ]}
                        style={{ fontSize: 12 }}
                        onChange={(value) => onKindChange(value as ReviewKind)}
                    />
                    <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                        最后评审：{formatReviewTime(updatedAt)}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="复制提示词"
                        title="复制提示词"
                        onClick={() => { void onCopyPrompt(); }}
                    >
                        <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant={pageZoomEnabled ? 'secondary' : 'ghost'}
                        size="icon-xs"
                        className={cn(pageZoomEnabled && 'bg-secondary text-secondary-foreground')}
                        aria-label="页面缩放模式"
                        title="页面缩放模式"
                        onClick={onTogglePageZoom}
                    >
                        <Scaling className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
                {loading ? (
                    <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
                        <RotateCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                        正在读取评审结果...
                    </div>
                ) : error ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] leading-5 text-destructive">
                        {error}
                    </div>
                ) : hasReview ? (
                    <XProvider locale={zhCN_X}>
                        <div className="prose prose-sm max-w-none text-[13px] leading-6 dark:prose-invert">
                            <XMarkdown
                                content={trimmedMarkdown}
                                components={{
                                    code: Code,
                                }}
                            />
                        </div>
                    </XProvider>
                ) : (
                    <div className="flex h-full items-center justify-center text-center">
                        <div className="max-w-[260px]">
                            <div className="text-[13px] font-medium text-foreground">暂无评审内容</div>
                            <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                                {activeConfig.emptyDescription}
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                className="mt-4 h-8 gap-1.5 text-[12px]"
                                onClick={() => { void onCopyPrompt(); }}
                            >
                                <Copy className="h-3.5 w-3.5" />
                                复制提示词
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
