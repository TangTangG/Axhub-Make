import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Eye, GitCommit, Loader2, RefreshCw, RotateCcw, Sparkles, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { apiService, type GitWorkspaceStatusResponse } from '../services/api';
import { generateGitCommitMessage } from '../domains/ai-generation/gitCommitMessageGeneration';
import { ItemData } from '../types';
import { getGitVersionUnavailableState, type GitVersionUnavailableState } from '../utils/gitVersionErrors';
import { useAppDialog } from './dialogs/AppDialogProvider';

interface VersionManagerProps {
    visible: boolean;
    onCancel: () => void;
    item: ItemData | null;
    onOpenWorkspaceVersionCollaboration?: () => void;
}

interface CommitItem {
    hash: string;
    message: string;
    author: string;
    timestamp: number;
    hasPrototype?: boolean;
}

type PrototypeVersionAction = 'load' | 'commit' | 'fetch' | 'push';

function SectionCard({
    title,
    actions,
    children,
}: {
    title: string;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="rounded-md border border-border bg-background p-3.5">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-[13px] font-semibold leading-5 text-foreground">{title}</h3>
                {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
            </div>
            {children}
        </section>
    );
}

function InfoRow({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="grid min-h-8 grid-cols-[88px_minmax(0,1fr)] items-center gap-2 text-xs">
            <span className="whitespace-nowrap text-muted-foreground">{label}</span>
            <div className="min-w-0 text-foreground">{children}</div>
        </div>
    );
}

function InfoValue({
    children,
    className,
    title,
}: {
    children: ReactNode;
    className?: string;
    title?: string;
}) {
    return (
        <div
            className={cn(
                'flex h-8 min-w-0 items-center rounded-md border border-border/70 bg-muted/30 px-2.5 text-xs font-medium text-foreground',
                className,
            )}
            title={title}
        >
            <span className="min-w-0 truncate">{children}</span>
        </div>
    );
}

function getPrototypeLocalStatusText(options: {
    loading: boolean;
    unavailableState: GitVersionUnavailableState | null;
    hasUncommitted: boolean;
}) {
    if (options.loading) return '读取中';
    if (options.unavailableState) return options.unavailableState.title;
    return options.hasUncommitted ? '当前原型有未提交变更' : '当前原型暂无未提交变更';
}

function getPrototypeOnlineStatusText(status: GitWorkspaceStatusResponse | null): string {
    if (!status) return '读取中';
    if (!status.gitAvailable) return '本机未检测到版本工具';
    if (!status.isGitRepo || !status.hasCommits) return '请先初始化本地仓库';
    if (!status.remote?.url) return '请先配置在线仓库';
    return '已连接在线仓库';
}

function normalizeGitPath(rawPath: string) {
    let normalizedPath = String(rawPath || '').trim().replace(/\\/g, '/');

    const srcMarkerIndex = normalizedPath.lastIndexOf('/src/');
    if (srcMarkerIndex >= 0) {
        normalizedPath = normalizedPath.substring(srcMarkerIndex + '/src/'.length);
    } else if (normalizedPath.startsWith('src/')) {
        normalizedPath = normalizedPath.substring('src/'.length);
    }

    return normalizedPath
        .replace(/^\/+/, '')
        .replace(/\/index\.(t|j)sx?$/i, '')
        .replace(/\/+$/, '');
}

function getGitTargetPath(targetItem: ItemData | null) {
    if (!targetItem) return '';
    const rawPath = String(targetItem.filePath || targetItem.absoluteFilePath || '').trim();
    return rawPath ? normalizeGitPath(rawPath) : '';
}

function resolvePrototypeVersionPreviewUrl(targetItem: ItemData | null, prototypeUrl: string): string {
    const value = String(prototypeUrl || '').trim();
    if (!value) return '';
    try {
        const parsed = new URL(value);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.toString();
        }
    } catch {
        // Relative preview URLs are resolved below.
    }

    const runtimeUrl = String(targetItem?.clientUrl || targetItem?.previewUrl || '').trim();
    if (runtimeUrl) {
        try {
            const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
            const runtimeOrigin = new URL(runtimeUrl, fallbackOrigin).origin;
            return new URL(value, runtimeOrigin).toString();
        } catch {
            // Keep the API-provided URL if the stored runtime URL is not parseable.
        }
    }
    return value;
}

function formatCommitTimestamp(timestamp: number) {
    const d = new Date(timestamp);
    const pad2 = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function timeAgo(timestamp: number) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ' 年前';

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' 个月前';

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' 天前';

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ' 小时前';

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ' 分钟前';

    return '刚刚';
}

export default function VersionManager({
    visible,
    onCancel,
    item,
    onOpenWorkspaceVersionCollaboration,
}: VersionManagerProps) {
    const appDialog = useAppDialog();
    const [commits, setCommits] = useState<CommitItem[]>([]);
    const [hasUncommitted, setHasUncommitted] = useState(false);
    const [commitMessage, setCommitMessage] = useState('');
    const [generatingCommitMessage, setGeneratingCommitMessage] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadedHistoryPath, setLoadedHistoryPath] = useState('');
    const [viewingPrototypeId, setViewingPrototypeId] = useState<string | null>(null);
    const [gitUnavailableState, setGitUnavailableState] = useState<GitVersionUnavailableState | null>(null);
    const [workspaceStatus, setWorkspaceStatus] = useState<GitWorkspaceStatusResponse | null>(null);
    const [busyAction, setBusyAction] = useState<PrototypeVersionAction | null>(null);
    const targetPath = getGitTargetPath(item);
    const isBusy = busyAction !== null;
    const isRepositoryReady = Boolean(workspaceStatus?.isGitRepo && workspaceStatus?.hasCommits);
    const hasConfiguredRemote = Boolean(workspaceStatus?.remote?.url);
    const incomingTotal = workspaceStatus?.remoteComparison?.incoming.totalFiles || 0;
    const outgoingTotal = workspaceStatus?.remoteComparison?.outgoing.totalFiles || 0;
    const hasLoadedLocalHistory = loadedHistoryPath === targetPath;
    const hasLoadedWorkspaceStatus = Boolean(workspaceStatus);
    const showLocalSetupHint = hasLoadedLocalHistory && Boolean(gitUnavailableState);
    const showLocalStatus = hasLoadedLocalHistory && !showLocalSetupHint && Boolean(item && targetPath);
    const showLocalCommit = showLocalStatus && hasUncommitted;
    const showLocalHistory = showLocalStatus && commits.length > 0;
    const showOnlineSetupHint = hasLoadedWorkspaceStatus && (!isRepositoryReady || !hasConfiguredRemote);
    const showOnlineContent = hasLoadedWorkspaceStatus && !showOnlineSetupHint;
    const showOnlineIncoming = showOnlineContent && incomingTotal > 0;
    const showOnlineOutgoing = showOnlineContent && outgoingTotal > 0;
    const onlineSetupDescription = !isRepositoryReady
        ? '请先在全局版本和协作中初始化本地仓库，然后再同步当前原型。'
        : '请先在全局版本和协作中配置在线仓库。';

    const loadVersionHistory = async () => {
        if (!item) return;
        setLoadingHistory(true);
        setGitUnavailableState(null);
        setLoadedHistoryPath('');
        try {
            if (!targetPath) {
                toast.error('无法获取文件路径');
                return;
            }
            const response = await fetch(`/api/git/history?path=${encodeURIComponent(targetPath)}`);
            const data = await response.json();

            if (response.ok) {
                setGitUnavailableState(getGitVersionUnavailableState(data));
                setCommits(Array.isArray(data.commits)
                    ? data.commits.filter((commit: CommitItem) => commit.hasPrototype !== false)
                    : []);
                setHasUncommitted(Boolean(data.hasUncommitted));
            } else {
                const unavailableState = getGitVersionUnavailableState(data);
                if (unavailableState) {
                    setGitUnavailableState(unavailableState);
                    setCommits([]);
                    setHasUncommitted(false);
                } else {
                    toast.error(data.error || '加载版本历史失败');
                }
            }
        } catch {
            toast.error('加载版本历史失败');
        } finally {
            setLoadedHistoryPath(targetPath);
            setLoadingHistory(false);
        }
    };

    const loadWorkspaceStatus = async () => {
        if (!targetPath) return;
        setBusyAction('load');
        setWorkspaceStatus(null);
        try {
            setWorkspaceStatus(await apiService.getGitWorkspaceStatus({ path: targetPath }));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '加载版本状态失败');
        } finally {
            setBusyAction(null);
        }
    };

    const reloadAll = async () => {
        await Promise.all([
            loadVersionHistory(),
            loadWorkspaceStatus(),
        ]);
    };

    useEffect(() => {
        if (visible && item) {
            void reloadAll();
        }
    }, [visible, item?.name, item?.filePath, item?.absoluteFilePath]);

    const openWorkspaceVersionCollaboration = () => {
        onCancel();
        onOpenWorkspaceVersionCollaboration?.();
    };

    const handleRestore = async (commitHash: string) => {
        if (!item) return;
        const confirmed = await appDialog.confirm({
            title: '恢复此版本？',
            description: '当前未提交的更改将会丢失，请确认是否继续。',
            confirmText: '确认恢复',
            cancelText: '取消',
            tone: 'destructive',
            dismissible: false,
        });
        if (!confirmed) return;

        try {
            if (!targetPath) {
                toast.error('无法获取文件路径');
                return;
            }
            const response = await fetch('/api/git/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: targetPath, commitHash }),
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('版本恢复成功');
                void reloadAll();
            } else {
                toast.error(data.error || '版本恢复失败');
            }
        } catch {
            toast.error('版本恢复失败');
        }
    };

    const handleSubmitCommit = async () => {
        if (!commitMessage.trim()) {
            toast.warning('请输入提交信息');
            return;
        }
        if (!targetPath) {
            toast.error('无法获取文件路径');
            return;
        }

        setBusyAction('commit');
        try {
            await apiService.commitGitWorkspace(commitMessage.trim(), { path: targetPath });
            toast.success('提交成功');
            setCommitMessage('');
            await reloadAll();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '提交失败');
        } finally {
            setBusyAction(null);
        }
    };

    const handleGenerateCommitMessage = async () => {
        setGeneratingCommitMessage(true);
        try {
            const generatedMessage = await generateGitCommitMessage({
                scope: 'prototype',
                status: workspaceStatus,
                targetName: String(item?.displayName || item?.title || item?.name || '').trim(),
                targetPath,
                currentMessage: commitMessage,
            });
            setCommitMessage(generatedMessage);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'AI 生成版本记录失败');
        } finally {
            setGeneratingCommitMessage(false);
        }
    };

    const handleViewPrototype = async (commitHash: string) => {
        setViewingPrototypeId(commitHash);
        try {
            if (!targetPath) {
                toast.error('无法获取文件路径');
                return;
            }
            const response = await fetch('/api/git/build-version', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: targetPath, commitHash }),
            });

            const data = await response.json();

            if (response.ok && data.hasPrototype && data.prototypeUrl) {
                window.open(resolvePrototypeVersionPreviewUrl(item, data.prototypeUrl), '_blank', 'noopener,noreferrer');
            } else if (response.ok && data.hasPrototype === false) {
                toast.warning('这个历史版本里还没有当前原型，无法预览。');
            } else {
                toast.error(data.error || '无法访问原型');
            }
        } catch {
            toast.error('加载原型失败');
        } finally {
            setViewingPrototypeId(null);
        }
    };

    const handleFetchRemote = async () => {
        setBusyAction('fetch');
        try {
            await apiService.fetchGitWorkspace();
            await loadWorkspaceStatus();
            toast.success('已读取在线仓库');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '读取在线仓库失败');
        } finally {
            setBusyAction(null);
        }
    };

    const handlePush = async () => {
        setBusyAction('push');
        try {
            await apiService.pushGitWorkspace();
            await reloadAll();
            toast.success('已同步到在线仓库');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '同步到在线失败');
        } finally {
            setBusyAction(null);
        }
    };

    const renderSetupHint = (description: string) => (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
            <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{description}</span>
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 bg-background"
                onClick={openWorkspaceVersionCollaboration}
            >
                打开全局版本和协作
            </Button>
        </div>
    );

    const localStatusText = getPrototypeLocalStatusText({
        loading: loadingHistory,
        unavailableState: gitUnavailableState,
        hasUncommitted,
    });

    return (
        <Sheet open={visible} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
            <SheetContent
                side="left"
                className="flex w-full max-w-[620px] flex-col p-0 text-sm sm:max-w-[620px] [&>[data-sheet-close]]:hidden"
            >
                <Tabs defaultValue="local" className="flex h-full flex-col">
                    <SheetHeader className="border-b px-5 py-3.5">
                        <SheetTitle className="sr-only">版本和协作 - {item?.displayName || '-'}</SheetTitle>
                        <div className="flex items-center justify-between gap-3">
                            <TabsList className="grid h-8 w-full max-w-[260px] grid-cols-2 rounded-lg border border-border/70 bg-muted/50 p-0.5">
                                <TabsTrigger value="local" className="h-full rounded-md px-2.5 py-0 text-[13px] leading-none data-[state=active]:shadow-none">
                                    本地仓库
                                </TabsTrigger>
                                <TabsTrigger value="online" className="h-full rounded-md px-2.5 py-0 text-[13px] leading-none data-[state=active]:shadow-none">
                                    在线仓库
                                </TabsTrigger>
                            </TabsList>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-7 w-7 shrink-0 rounded-md"
                                onClick={onCancel}
                                aria-label="关闭"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </SheetHeader>

                    <TabsContent value="local" className="m-0 min-h-0 flex-1 overflow-y-auto px-5 py-4.5">
                        <div className="space-y-3.5">
                            {showLocalSetupHint ? renderSetupHint(gitUnavailableState?.description || '') : null}

                            {showLocalStatus ? (
                                <SectionCard
                                    title="信息"
                                    actions={(
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 gap-1.5 px-2"
                                            onClick={() => void reloadAll()}
                                            disabled={isBusy || loadingHistory}
                                        >
                                            {busyAction === 'load' || loadingHistory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                            刷新
                                        </Button>
                                    )}
                                >
                                    <InfoRow label="状态">
                                        <InfoValue className={hasUncommitted ? 'border-primary/20 bg-primary/5 text-primary' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300'}>
                                            {localStatusText}
                                        </InfoValue>
                                    </InfoRow>
                                </SectionCard>
                            ) : null}

                            {showLocalCommit ? (
                                <SectionCard title="提交版本">
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Textarea
                                                placeholder="手动输入版本说明..."
                                                value={commitMessage}
                                                onChange={(event) => setCommitMessage(event.target.value)}
                                                rows={4}
                                                className="min-h-[96px] resize-none pr-10"
                                                onKeyDown={(event) => {
                                                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                                                        event.preventDefault();
                                                        void handleSubmitCommit();
                                                    }
                                                }}
                                            />
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            className="absolute right-1.5 top-1.5 h-7 w-7 text-muted-foreground hover:text-foreground"
                                                            onClick={() => void handleGenerateCommitMessage()}
                                                            disabled={isBusy || generatingCommitMessage}
                                                            aria-label="AI生成版本记录"
                                                        >
                                                            {generatingCommitMessage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">AI生成版本记录</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <div className="flex justify-end">
                                            <Button
                                                variant="brand"
                                                size="sm"
                                                className="gap-1.5"
                                                onClick={() => void handleSubmitCommit()}
                                                disabled={isBusy || !commitMessage.trim()}
                                            >
                                                {busyAction === 'commit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCommit className="h-4 w-4" />}
                                                {busyAction === 'commit' ? '提交中...' : '提交版本'}
                                            </Button>
                                        </div>
                                    </div>
                                </SectionCard>
                            ) : null}

                            {showLocalHistory ? (
                                <SectionCard title="历史版本">
                                    <div className="space-y-3">
                                        {commits.map((commit, index) => {
                                            const isCurrent = index === 0 && !hasUncommitted;
                                            const canPreview = commit.hasPrototype !== false;
                                            return (
                                                <div key={commit.hash} className="rounded-md border bg-card px-4 py-3.5">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-medium text-foreground">{commit.message}</div>
                                                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                                                <span>{commit.author || 'Unknown'}</span>
                                                                <span>·</span>
                                                                <span title={formatCommitTimestamp(commit.timestamp)}>{timeAgo(commit.timestamp)}</span>
                                                                <span>·</span>
                                                                <code className="rounded bg-muted px-1 py-0.5 text-sm">{commit.hash.substring(0, 7)}</code>
                                                            </div>
                                                        </div>
                                                        {isCurrent ? (
                                                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-sm text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100">
                                                                当前版本
                                                            </span>
                                                        ) : (
                                                            <TooltipProvider>
                                                                <div className="flex items-center gap-1">
                                                                    {canPreview ? (
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon-xs"
                                                                                    onClick={() => void handleViewPrototype(commit.hash)}
                                                                                    disabled={viewingPrototypeId === commit.hash}
                                                                                    aria-label="预览历史版本"
                                                                                >
                                                                                    {viewingPrototypeId === commit.hash ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent side="top">预览历史版本</TooltipContent>
                                                                        </Tooltip>
                                                                    ) : null}
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon-xs"
                                                                                onClick={() => void handleRestore(commit.hash)}
                                                                                aria-label="恢复此版本"
                                                                            >
                                                                                <RotateCcw className="h-4 w-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="top">恢复此版本</TooltipContent>
                                                                    </Tooltip>
                                                                </div>
                                                            </TooltipProvider>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </SectionCard>
                            ) : null}
                        </div>
                    </TabsContent>

                    <TabsContent value="online" className="m-0 min-h-0 flex-1 overflow-y-auto px-5 py-4.5">
                        <div className="space-y-3.5">
                            {showOnlineSetupHint ? renderSetupHint(onlineSetupDescription) : null}

                            {showOnlineContent ? (
                                <>
                                    <SectionCard
                                        title="信息"
                                        actions={(
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 gap-1.5 px-2"
                                                onClick={handleFetchRemote}
                                                disabled={isBusy}
                                            >
                                                {busyAction === 'fetch' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                                读取分支
                                            </Button>
                                        )}
                                    >
                                        <div className="grid gap-2">
                                            <InfoRow label="状态">
                                                <InfoValue>{getPrototypeOnlineStatusText(workspaceStatus)}</InfoValue>
                                            </InfoRow>
                                            {workspaceStatus?.remote?.url ? (
                                                <InfoRow label="仓库">
                                                    <InfoValue title={workspaceStatus.remote.url}>{workspaceStatus.remote.url}</InfoValue>
                                                </InfoRow>
                                            ) : null}
                                        </div>
                                    </SectionCard>

                                    {showOnlineIncoming ? (
                                        <SectionCard title="线上更新">
                                            <InfoValue>当前原型有线上更新</InfoValue>
                                        </SectionCard>
                                    ) : null}

                                    {showOnlineOutgoing ? (
                                        <SectionCard
                                            title="同步到在线"
                                            actions={(
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 gap-1.5 px-2"
                                                    onClick={handlePush}
                                                    disabled={isBusy}
                                                >
                                                    {busyAction === 'push' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                                    同步到在线
                                                </Button>
                                            )}
                                        >
                                            <InfoValue>当前原型待同步到在线</InfoValue>
                                        </SectionCard>
                                    ) : null}
                                </>
                            ) : null}
                        </div>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
