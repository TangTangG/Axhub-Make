import React, { useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, CircleHelp, Copy, FileText, ListChecks, Loader2, RefreshCw, Send, Trash2, UploadCloud } from 'lucide-react';
import { XMarkdown } from '@ant-design/x-markdown';
import type { ComponentProps } from '@ant-design/x-markdown';
import { Mermaid, XProvider } from '@ant-design/x';
import zhCN_X from '@ant-design/x/locale/zh_CN';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { type ReviewKind } from '../../utils/uiReviewPrompt';
import type {
    ReviewAxhubConfig,
    ReviewLanSubmitConfig,
    ReviewReportDetail,
    ReviewReportSummary,
} from '../../services/api';
import { getReviewScoreTone, normalizeReviewScore } from './reviewScore';

interface UiReviewPanelProps {
    reports: ReviewReportSummary[];
    selectedReport: ReviewReportDetail | null;
    activeReportId?: string | null;
    reviewPrompt: string;
    reviewDocumentPath?: string;
    reviewPrompts?: Partial<Record<ReviewKind, string>>;
    reviewDocumentPaths?: Partial<Record<ReviewKind, string>>;
    loading?: boolean;
    detailLoading?: boolean;
    uploadLoading?: boolean;
    error?: string;
    lanSubmitConfig?: ReviewLanSubmitConfig | null;
    axhubSubmitConfig?: ReviewAxhubConfig | null;
    onExecutePrompt?: (prompt: string, meta: { scene: string; targetPath?: string | null; autoSend?: boolean }) => Promise<boolean | void> | boolean | void;
    onSelectReport: (report: ReviewReportSummary) => void;
    onBackToList: () => void;
    onCopyReportPath: (report: ReviewReportDetail) => void | Promise<void>;
    onDeleteReport: (report: ReviewReportDetail) => void | Promise<void>;
    onStartReview: (kind: ReviewKind) => void | Promise<void>;
    onRunReviewDirect: (kind: ReviewKind) => Promise<boolean | void> | boolean | void;
    onUploadReport: (files: File[], meta: { title?: string; reviewer?: string }) => void | Promise<void>;
    onLanSubmitEnabledChange: (enabled: boolean) => void | Promise<void>;
    onAxhubSubmitEnabledChange: (enabled: boolean) => void | Promise<void>;
}

type ReviewPromptActionKind = 'direct' | 'web' | 'copy';

interface ReviewPromptActionButtonProps {
    scene: string;
    buildPrompt: () => Promise<string> | string;
    getTargetPath: () => string | null;
    onDirectExecute: () => Promise<boolean | void> | boolean | void;
    onExecutePrompt?: (prompt: string, meta: { scene: string; targetPath?: string | null; autoSend?: boolean }) => Promise<boolean | void> | boolean | void;
    disabled?: boolean;
    className?: string;
    directExecuteLabel: string;
    webExecuteLabel: string;
    copyLabel: string;
}

function ReviewPromptActionButton({
    scene,
    buildPrompt,
    getTargetPath,
    onDirectExecute,
    onExecutePrompt,
    disabled = false,
    className,
    directExecuteLabel,
    webExecuteLabel,
    copyLabel,
}: ReviewPromptActionButtonProps) {
    const [loading, setLoading] = useState(false);
    const runningRef = useRef(false);
    const defaultAction: ReviewPromptActionKind = 'direct';
    const secondaryActions: ReviewPromptActionKind[] = ['web', 'copy'];
    const canRunWebAi = typeof onExecutePrompt === 'function';

    const readPrompt = async () => {
        const prompt = await buildPrompt();
        const text = String(prompt || '').trim();
        if (!text) {
            toast.warning('没有可用的 Prompt');
            return '';
        }
        return text;
    };

    const copyPromptText = async (prompt: string) => {
        await navigator.clipboard.writeText(prompt);
        toast.success('评审 Prompt 已复制到剪贴板');
    };

    const executeWebPromptText = async (prompt: string) => {
        if (!onExecutePrompt) {
            await copyPromptText(prompt);
            return;
        }
        const executed = await onExecutePrompt(prompt, { scene, targetPath: getTargetPath(), autoSend: false });
        if (executed === false) {
            await copyPromptText(prompt);
            toast.warning('网页 AI 执行失败，已回退为复制提示词');
            return;
        }
        toast.success('已发送到网页 AI 侧栏');
    };

    const runAction = async (action: ReviewPromptActionKind) => {
        if (loading || runningRef.current) return;
        runningRef.current = true;
        setLoading(true);
        try {
            const prompt = await readPrompt();
            if (!prompt) return;
            if (action === 'direct') {
                await onDirectExecute();
                return;
            }
            if (action === 'web') {
                await executeWebPromptText(prompt);
                return;
            }
            await copyPromptText(prompt);
        } catch (error: any) {
            toast.error(error?.message || '操作失败');
        } finally {
            runningRef.current = false;
            setLoading(false);
        }
    };

    const getActionLabel = (action: ReviewPromptActionKind) => {
        if (action === 'direct') return directExecuteLabel;
        if (action === 'web') return webExecuteLabel;
        return copyLabel;
    };

    const getActionIcon = (action: ReviewPromptActionKind) => {
        if (loading) return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
        return action === 'copy'
            ? <Copy className="h-3.5 w-3.5" />
            : <Send className="h-3.5 w-3.5" />;
    };

    return (
        <div className={cn('inline-flex items-center', className)}>
            <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={disabled || loading}
                className="h-7 shrink-0 rounded-r-none px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => { void runAction(defaultAction); }}
            >
                {getActionIcon(defaultAction)}
                <span>{getActionLabel(defaultAction)}</span>
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        disabled={disabled || loading}
                        className="h-7 w-7 shrink-0 rounded-l-none px-0 text-muted-foreground hover:text-foreground"
                    >
                        <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-36">
                    {secondaryActions.map((action) => (
                        <DropdownMenuItem
                            key={action}
                            disabled={action === 'web' && !canRunWebAi}
                            className="gap-2"
                            onSelect={(event) => {
                                event.preventDefault();
                                void runAction(action);
                            }}
                        >
                            {getActionIcon(action)}
                            {getActionLabel(action)}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function formatReviewTime(value?: string | null): string {
    if (!value) return '暂无时间';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无时间';
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function ReviewScoreBadge({ score: rawScore }: { score?: number }) {
    const score = normalizeReviewScore(rawScore);
    if (score === null) {
        return null;
    }
    const degrees = Math.max(0, Math.min(100, score)) * 3.6;
    const scoreTone = getReviewScoreTone(score);
    return (
        <div
            className="relative h-11 w-11 shrink-0"
            aria-label={`评审总分 ${score} 分`}
            title={`评审总分 ${score} 分`}
        >
            <div
                className="absolute inset-0 rounded-full"
                style={{
                    background: `conic-gradient(${scoreTone} ${degrees}deg, hsl(var(--muted)) 0deg)`,
                }}
            />
            <div className="absolute inset-[4px] flex items-center justify-center rounded-full bg-background text-[11px] font-semibold text-foreground">
                <span>{score}分</span>
            </div>
        </div>
    );
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

const ReviewMarkdownHeading1: React.FC<ComponentProps> = ({ children, className }) => (
    <h1 className={cn('mb-4 !mt-0 text-[21px] font-semibold leading-8 text-foreground', className)}>
        {children}
    </h1>
);

const ReviewMarkdownHeading2: React.FC<ComponentProps> = ({ children, className }) => (
    <h2 className={cn('mb-2 !mt-7 border-b border-border/70 pb-1.5 text-[17px] font-semibold leading-7 text-foreground first:!mt-0', className)}>
        {children}
    </h2>
);

const ReviewMarkdownHeading3: React.FC<ComponentProps> = ({ children, className }) => (
    <h3 className={cn('mb-1.5 !mt-5 text-[14px] font-semibold leading-6 text-foreground', className)}>
        {children}
    </h3>
);

const ReviewMarkdownHeading4: React.FC<ComponentProps> = ({ children, className }) => (
    <h4 className={cn('mb-1 !mt-4 text-[13px] font-semibold leading-5 text-foreground', className)}>
        {children}
    </h4>
);

const ReviewMarkdownParagraph: React.FC<ComponentProps> = ({ children, className }) => (
    <p className={cn('my-3 text-[13px] leading-6 text-foreground', className)}>
        {children}
    </p>
);

const ReviewMarkdownUnorderedList: React.FC<ComponentProps> = ({ children, className }) => (
    <ul className={cn('my-3 list-disc space-y-1.5 pl-5 text-[13px] leading-6 text-foreground', className)}>
        {children}
    </ul>
);

const ReviewMarkdownOrderedList: React.FC<ComponentProps> = ({ children, className }) => (
    <ol className={cn('my-3 list-decimal space-y-1.5 pl-5 text-[13px] leading-6 text-foreground', className)}>
        {children}
    </ol>
);

const ReviewMarkdownListItem: React.FC<ComponentProps> = ({ children, className }) => (
    <li className={cn('pl-1', className)}>
        {children}
    </li>
);

const ReviewMarkdownBlockquote: React.FC<ComponentProps> = ({ children, className }) => (
    <blockquote className={cn('my-4 border-l-2 border-primary/45 bg-muted/40 py-2 pl-3 pr-2 text-[13px] leading-6 text-muted-foreground', className)}>
        {children}
    </blockquote>
);

const reviewMarkdownComponents = {
    h1: ReviewMarkdownHeading1,
    h2: ReviewMarkdownHeading2,
    h3: ReviewMarkdownHeading3,
    h4: ReviewMarkdownHeading4,
    p: ReviewMarkdownParagraph,
    ul: ReviewMarkdownUnorderedList,
    ol: ReviewMarkdownOrderedList,
    li: ReviewMarkdownListItem,
    blockquote: ReviewMarkdownBlockquote,
    code: Code,
};

const REVIEW_ACTIONS: Array<{ kind: ReviewKind; label: string; description: string }> = [
    {
        kind: 'design',
        label: '设计评审',
        description: '优先读取 DESIGN.md；没有则按常规设计评审执行。',
    },
    {
        kind: 'requirements',
        label: '需求评审',
        description: '优先读取 .spec/spec.html，其次 .spec/spec.md，并跟随必要的子文档。',
    },
];

const REVIEW_REPORT_SUBMIT_SKILL_URL = 'https://github.com/lintendo/Axhub-Skills/blob/main/skills/axhub-prototype-context/SKILL.md';
const INSTALL_REVIEW_REPORT_SUBMIT_SKILL_PROMPT = [
    `请把下面这个技能安装到当前项目：${REVIEW_REPORT_SUBMIT_SKILL_URL}`,
    '安装到当前项目后，请用 $axhub-prototype-context 读取 Axhub 原型上下文，并按页面注入的评审提交地址把报告提交到当前原型的评审列表。',
].join('\n');

export default function UiReviewPanel({
    reports,
    selectedReport,
    activeReportId,
    reviewPrompt,
    reviewDocumentPath,
    reviewPrompts,
    reviewDocumentPaths,
    loading = false,
    detailLoading = false,
    uploadLoading = false,
    error = '',
    lanSubmitConfig,
    axhubSubmitConfig,
    onExecutePrompt,
    onSelectReport,
    onBackToList,
    onCopyReportPath,
    onDeleteReport,
    onStartReview,
    onRunReviewDirect,
    onUploadReport,
    onLanSubmitEnabledChange,
    onAxhubSubmitEnabledChange,
}: UiReviewPanelProps) {
    const [lanSubmitPending, setLanSubmitPending] = useState(false);
    const [axhubSubmitPending, setAxhubSubmitPending] = useState(false);
    const uploadInputRef = useRef<HTMLInputElement | null>(null);

    const getReviewPrompt = (kind: ReviewKind) => reviewPrompts?.[kind] || reviewPrompt;

    const getReviewDocumentPath = (kind: ReviewKind) => reviewDocumentPaths?.[kind] || reviewDocumentPath || '';

    const buildReviewPromptForKind = async (kind: ReviewKind) => {
        await onStartReview(kind);
        return getReviewPrompt(kind);
    };

    const renderReviewActionRow = (action: typeof REVIEW_ACTIONS[number]) => {
        const actionPrompt = getReviewPrompt(action.kind);
        return (
            <div
                key={action.kind}
                className="flex h-8 items-center justify-between gap-2 px-2"
            >
                <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-foreground">
                    <span>{action.label}</span>
                    <TooltipProvider delayDuration={150}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                    aria-label={`${action.label}说明`}
                                >
                                    <CircleHelp className="h-3.5 w-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[280px]">
                                <div className="text-[11px] leading-5">{action.description}</div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <ReviewPromptActionButton
                    scene={`prototype-review-${action.kind}`}
                    buildPrompt={() => buildReviewPromptForKind(action.kind)}
                    getTargetPath={() => getReviewDocumentPath(action.kind) || null}
                    onDirectExecute={() => onRunReviewDirect(action.kind)}
                    onExecutePrompt={onExecutePrompt}
                    directExecuteLabel="AI 执行"
                    webExecuteLabel="网页中 AI 执行"
                    copyLabel="复制提示词"
                    disabled={!actionPrompt.trim()}
                    className="shrink-0"
                />
            </div>
        );
    };

    const handleFilesSelected = (files: File[]) => {
        const markdownFiles = files.filter((file) => {
            const name = file.name.toLowerCase();
            return name.endsWith('.md') || name.endsWith('.markdown') || file.type === 'text/markdown';
        });
        if (markdownFiles.length === 0) {
            return;
        }
        void onUploadReport(markdownFiles.slice(0, 1), {});
    };

    const handleUploadInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        handleFilesSelected(Array.from(event.target.files || []));
        event.target.value = '';
    };

    const handleLanSubmitToggle = async (enabled: boolean) => {
        setLanSubmitPending(true);
        try {
            await onLanSubmitEnabledChange(enabled);
        } finally {
            setLanSubmitPending(false);
        }
    };

    const handleAxhubSubmitToggle = async (enabled: boolean) => {
        setAxhubSubmitPending(true);
        try {
            await onAxhubSubmitEnabledChange(enabled);
        } finally {
            setAxhubSubmitPending(false);
        }
    };

    const handleCopySubmitSkillPrompt = async () => {
        try {
            await navigator.clipboard.writeText(INSTALL_REVIEW_REPORT_SUBMIT_SKILL_PROMPT);
            toast.success('已复制提交技能提示词');
        } catch {
            toast.error('复制失败，请手动选择提示词');
        }
    };

    const handleDeleteSelectedReport = () => {
        if (!selectedReport) return;
        if (!window.confirm(`确定删除评审报告「${selectedReport.title}」吗？删除后无法恢复。`)) {
            return;
        }
        void onDeleteReport(selectedReport);
    };

    const renderReportList = () => (
        <>
            <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
                {loading ? (
                    <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
                        <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                        正在加载报告...
                    </div>
                ) : error ? (
                    <div className="flex h-full items-center justify-center text-center">
                        <div className="max-w-[260px]">
                            <FileText className="mx-auto mb-3 h-9 w-9 text-muted-foreground/45" />
                            <div className="text-[13px] font-medium text-foreground">暂时无法加载评审报告</div>
                            <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                                请确认当前原型已存在，或稍后刷新列表。
                            </div>
                        </div>
                    </div>
                ) : reports.length > 0 ? (
                    <div className="space-y-2">
                        {reports.map((report) => (
                            <button
                                key={report.id}
                                type="button"
                                className={cn(
                                    'w-full rounded-md border border-border/70 bg-background px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40',
                                    activeReportId === report.id && 'border-primary/50 bg-primary/5',
                                )}
                                onClick={() => onSelectReport(report)}
                            >
                                <div className="flex items-start gap-2">
                                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-[13px] font-medium text-foreground">
                                            {report.title}
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-muted-foreground">
                                            <span>{report.reviewer}</span>
                                            <span>{formatReviewTime(report.createdAt)}</span>
                                        </div>
                                    </div>
                                    <ReviewScoreBadge score={report.score} />
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center text-center">
                        <div className="max-w-[260px]">
                            <FileText className="mx-auto mb-3 h-9 w-9 text-muted-foreground/45" />
                            <div className="text-[13px] font-medium text-foreground">暂无评审报告</div>
                            <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                                可以从底部发起一次评审，或上传已有 Markdown 报告。
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="shrink-0 border-t bg-muted/10 px-3 py-3">
                <Tabs defaultValue="ai-review" className="w-full">
                    <TabsList className="grid h-8 w-full grid-cols-2">
                        <TabsTrigger value="ai-review" className="h-6 text-xs">AI 评审</TabsTrigger>
                        <TabsTrigger value="human-review" className="h-6 text-xs">人工评审</TabsTrigger>
                    </TabsList>
                    <TabsContent value="ai-review" className="mt-3 h-[72px] space-y-1">
                        {REVIEW_ACTIONS.map(renderReviewActionRow)}
                    </TabsContent>
                    <TabsContent value="human-review" className="mt-3 h-[72px] space-y-1">
                        <div className="flex h-8 items-center justify-between gap-2 px-2">
                            <div className="flex min-w-0 items-center gap-2 text-[12px] font-medium text-foreground">
                                <UploadCloud className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span>提交报告</span>
                            </div>
                            <input
                                ref={uploadInputRef}
                                type="file"
                                accept=".md,.markdown,text/markdown"
                                className="hidden"
                                disabled={uploadLoading}
                                onChange={handleUploadInputChange}
                            />
                            <div className="flex shrink-0 items-center gap-0.5">
                                {lanSubmitConfig?.lanSubmitEnabled === true || axhubSubmitConfig?.submitEnabled === true ? (
                                    <Button
                                        type="button"
                                        size="xs"
                                        variant="ghost"
                                        className="h-7 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                                        onClick={() => { void handleCopySubmitSkillPrompt(); }}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        技能提交
                                    </Button>
                                ) : null}
                                <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost"
                                    className="h-7 shrink-0 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                                    disabled={uploadLoading}
                                    onClick={() => uploadInputRef.current?.click()}
                                >
                                    {uploadLoading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <UploadCloud className="h-3.5 w-3.5" />
                                    )}
                                    上传报告
                                </Button>
                            </div>
                        </div>
                        <div className="flex h-8 items-center justify-between gap-2 px-2">
                            <div className="flex min-w-0 items-center gap-2 text-[12px] font-medium text-foreground">
                                <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span>提交方式</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-3 text-[12px] font-medium text-foreground">
                                <div className="flex items-center gap-1.5">
                                    <Checkbox
                                        id="review-lan-submit"
                                        checked={lanSubmitConfig?.lanSubmitEnabled === true}
                                        disabled={lanSubmitPending || lanSubmitConfig?.projectLanAllowed === false}
                                        onCheckedChange={(checked) => { void handleLanSubmitToggle(checked === true); }}
                                    />
                                    <label htmlFor="review-lan-submit" className="whitespace-nowrap">局域网提交</label>
                                    <TooltipProvider delayDuration={150}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    aria-label="局域网提交说明"
                                                >
                                                    <CircleHelp className="h-3.5 w-3.5" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-[320px]">
                                                允许研发团队成员的 AI agent 通过局域网提交 Markdown 评审报告。
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Checkbox
                                        id="review-axhub-submit"
                                        checked={axhubSubmitConfig?.submitEnabled === true}
                                        disabled={axhubSubmitPending || axhubSubmitConfig?.bound !== true}
                                        onCheckedChange={(checked) => { void handleAxhubSubmitToggle(checked === true); }}
                                    />
                                    <label htmlFor="review-axhub-submit" className="whitespace-nowrap">Axhub 提交</label>
                                    <TooltipProvider delayDuration={150}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    aria-label="Axhub 提交说明"
                                                >
                                                    <CircleHelp className="h-3.5 w-3.5" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-[320px]">
                                                {axhubSubmitConfig?.bound === true
                                                    ? '允许评审者通过已发布的 Axhub 原型提交 Markdown 评审报告。'
                                                    : '重新发布到 Axhub 后可开启'}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );

    const renderReportDetail = () => (
        <>
            <div className="flex min-h-[50px] items-center justify-between gap-2 border-b px-3 py-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={onBackToList}
                >
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    返回列表
                </Button>
                {selectedReport ? (
                    <TooltipProvider delayDuration={150}>
                        <div className="flex shrink-0 items-center gap-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        aria-label="复制报告路径"
                                        onClick={() => { void onCopyReportPath(selectedReport); }}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">复制报告路径</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        aria-label="删除报告"
                                        onClick={handleDeleteSelectedReport}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">删除报告</TooltipContent>
                            </Tooltip>
                        </div>
                    </TooltipProvider>
                ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
                {detailLoading ? (
                    <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        正在读取报告...
                    </div>
                ) : selectedReport ? (
                    <XProvider locale={zhCN_X}>
                        <div className="max-w-none text-[13px] leading-6">
                            <XMarkdown
                                content={selectedReport.markdown}
                                components={reviewMarkdownComponents}
                            />
                        </div>
                    </XProvider>
                ) : (
                    <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground">
                        未选择报告
                    </div>
                )}
            </div>
        </>
    );

    return (
        <aside className="flex h-full w-[380px] shrink-0 flex-col border-l bg-background shadow-sm">
            {selectedReport || detailLoading ? renderReportDetail() : renderReportList()}
        </aside>
    );
}
