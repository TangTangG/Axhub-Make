import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Download, Loader2, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabelWithHint } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
    apiService,
    type GitWorkspaceChangeGroup,
    type GitWorkspaceChangeItem,
    type GitWorkspacePromptScene,
    type GitWorkspaceStatusResponse,
} from '../services/api';

export type VersionCollaborationTab = 'local' | 'online' | 'skills' | 'all';

type WorkspaceAction =
    | 'load'
    | 'init'
    | 'commit'
    | 'commit-prompt'
    | 'branch'
    | 'connect'
    | 'create'
    | 'fetch'
    | 'sync-down'
    | 'push';

interface WorkspacePromptState {
    text: string;
    scene: GitWorkspacePromptScene | 'commit';
    message?: string;
}

interface FlattenedChangeItem extends GitWorkspaceChangeItem {
    groupKey: GitWorkspaceChangeGroup['key'];
    groupLabel: string;
}

const MAX_VISIBLE_CHANGE_ITEM_ROWS = 3;
const GIT_REPO_BEGINNER_GUIDE_SKILL_URL = 'https://github.com/lintendo/Axhub-Skills/blob/main/skills/git-repo-beginner-guide/SKILL.md';
const INSTALL_GIT_REPO_SKILL_PROMPT = [
    '请帮我把下面这个 git-repo-beginner-guide 技能安装到当前项目内：',
    GIT_REPO_BEGINNER_GUIDE_SKILL_URL,
    '',
    '安装后，请使用这个技能帮助我处理当前项目的 git 相关问题，包括版本管理、团队协作、异地办公，以及在多台设备间同步项目。',
].join('\n');

function getVisibleChangeItems<T>(items: T[], visibleItemCount: number): { items: T[]; remainingCount: number } {
    if (items.length === 0) {
        return { items: [], remainingCount: 0 };
    }
    const normalizedVisibleItemCount = Math.max(0, Math.min(visibleItemCount, items.length));
    if (normalizedVisibleItemCount >= items.length) {
        return { items, remainingCount: 0 };
    }
    return {
        items: items.slice(0, normalizedVisibleItemCount),
        remainingCount: items.length - normalizedVisibleItemCount,
    };
}

function countWrappedRows(nodes: HTMLElement[]): number {
    const rowTops = Array.from(new Set(nodes.map((node) => Math.round(node.offsetTop))));
    return rowTops.length;
}

function countItemsInsideVisibleRows(items: HTMLElement[], maxRows: number): number {
    const rowTops = Array.from(new Set(items.map((item) => Math.round(item.offsetTop)))).sort((a, b) => a - b);
    if (rowTops.length <= maxRows) {
        return items.length;
    }
    const maxVisibleTop = rowTops[maxRows - 1];
    return items.filter((item) => Math.round(item.offsetTop) <= maxVisibleTop).length;
}

function measureCandidateVisibleRows(
    itemNodes: HTMLElement[],
    summaryNode: HTMLElement,
    visibleItemCount: number,
    totalItemCount: number,
): number {
    itemNodes.forEach((node, index) => {
        node.style.display = index < visibleItemCount ? '' : 'none';
    });
    const shouldShowSummary = visibleItemCount < totalItemCount;
    summaryNode.style.display = shouldShowSummary ? '' : 'none';
    summaryNode.textContent = `+${Math.max(0, totalItemCount - visibleItemCount)} 变更`;

    const visibleNodes = itemNodes.slice(0, visibleItemCount);
    if (shouldShowSummary) {
        visibleNodes.push(summaryNode);
    }
    return countWrappedRows(visibleNodes);
}

function flattenChangeGroups(groups: GitWorkspaceChangeGroup[]): FlattenedChangeItem[] {
    return groups.flatMap((group) => (
        group.items.map((item) => ({
            ...item,
            id: `${group.key}:${item.id}`,
            groupKey: group.key,
            groupLabel: group.label,
        }))
    ));
}

function normalizeRemoteBranchName(branch: string): string {
    const value = branch.trim().replace(/^remotes\//u, '');
    if (!value || value === 'origin/HEAD' || value.endsWith('/HEAD')) {
        return '';
    }
    return value.replace(/^origin\//u, '');
}

function normalizeRemoteBranches(branches: string[] | undefined): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const branch of branches || []) {
        const normalized = normalizeRemoteBranchName(branch);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
}

function normalizeLocalBranches(branches: string[] | undefined, currentBranch?: string): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const branch of [currentBranch, ...(branches || [])]) {
        const normalized = String(branch || '').trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
}

function getWorkspaceStatusText(status: GitWorkspaceStatusResponse | null): string {
    if (!status) return '读取中';
    if (!status.gitAvailable) return '本机未检测到版本工具';
    if (!status.isGitRepo) return '尚未初始化';
    if (!status.hasCommits) return '缺少基线版本';
    if (status.isHistoricalVersion) return '历史版本';
    if (status.hasChanges) return `有 ${status.changedFilesCount || status.changeSummary.totalFiles} 个文件变更`;
    return '没有待提交变更';
}

function getWorkspaceStatusClass(status: GitWorkspaceStatusResponse | null): string {
    if (!status?.gitAvailable) return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300';
    if (!status.isGitRepo || !status.hasCommits) return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300';
    if (status.hasChanges) return 'border-primary/20 bg-primary/5 text-primary';
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300';
}

function getWorkspaceVersionText(status: GitWorkspaceStatusResponse | null): string {
    if (!status) return '读取中';
    if (!status.hasCommits) return '暂无版本';
    return status.currentCommit?.shortHash || '版本号读取失败';
}

function getRemoteStatusText(status: GitWorkspaceStatusResponse | null): string {
    if (!status?.isGitRepo || !status.hasCommits) return '未就绪';
    return status.remote?.url ? '已连接' : '未连接';
}

function getRemoteStatusClass(status: GitWorkspaceStatusResponse | null): string {
    if (!status?.isGitRepo || !status.hasCommits || status.remoteComparison?.available === false) {
        return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300';
    }
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300';
}

function getActionErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object') {
        const record = error as Record<string, unknown>;
        if (typeof record.error === 'string' && record.error.trim()) return record.error;
        if (typeof record.message === 'string' && record.message.trim()) return record.message;
    }
    return fallback;
}

function getPromptFromError(error: unknown): WorkspacePromptState | null {
    if (!error || typeof error !== 'object') return null;
    const record = error as Record<string, unknown>;
    if (typeof record.prompt !== 'string' || !record.prompt.trim()) return null;
    const scene = typeof record.promptScene === 'string'
        ? record.promptScene as GitWorkspacePromptScene
        : 'merge-required';
    return {
        text: record.prompt,
        scene,
        message: typeof record.error === 'string' ? record.error : undefined,
    };
}

function buildCommitPrompt(status: GitWorkspaceStatusResponse | null, changeItems: FlattenedChangeItem[]): string {
    const changeSummary = changeItems.length
        ? changeItems.slice(0, 24).map((item) => `- ${item.groupLabel}：${item.name}`).join('\n')
        : '- 当前项目有未提交变更';
    return [
        '请帮我提交当前 Axhub Make 项目的版本。',
        '',
        `当前分支：${status?.currentBranch || '(未检测)'}`,
        `变更数量：${status?.changedFilesCount || status?.changeSummary.totalFiles || 0} 个文件`,
        '',
        '变更内容：',
        changeSummary,
        '',
        '请先查看 git status 和 git diff，概括变更内容，并给出一个简洁中文版本说明。',
        '获得我确认后再提交；不要处理合并、变基或冲突。',
    ].join('\n');
}

function getHistoricalVersionFromLocation(): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('gitVersion')?.trim() || '';
}

async function copyText(text: string, successMessage: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(successMessage);
    } catch {
        toast.error('复制失败，请手动选择提示词');
    }
}

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
    contentClassName,
    title,
}: {
    children: ReactNode;
    className?: string;
    contentClassName?: string;
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
            <span className={cn('min-w-0 truncate', contentClassName)}>{children}</span>
        </div>
    );
}

function StatusValue({ status }: { status: GitWorkspaceStatusResponse | null }) {
    return (
        <InfoValue className={getWorkspaceStatusClass(status)}>
            {getWorkspaceStatusText(status)}
        </InfoValue>
    );
}

function RemoteStatusValue({ status }: { status: GitWorkspaceStatusResponse | null }) {
    return (
        <InfoValue className={getRemoteStatusClass(status)}>
            {getRemoteStatusText(status)}
        </InfoValue>
    );
}

function ChangeItemList({ items }: { items: FlattenedChangeItem[] }) {
    const listContainerRef = useRef<HTMLDivElement | null>(null);
    const measureListRef = useRef<HTMLDivElement | null>(null);
    const visibleItemCountRef = useRef(items.length);
    const [visibleItemCount, setVisibleItemCount] = useState(items.length);
    const visibleChangeItems = getVisibleChangeItems(items, visibleItemCount);

    useLayoutEffect(() => {
        const listContainer = listContainerRef.current;
        const measureList = measureListRef.current;
        if (!listContainer || !measureList) return;

        const updateVisibleItemCount = (nextVisibleItemCount: number) => {
            if (visibleItemCountRef.current !== nextVisibleItemCount) {
                visibleItemCountRef.current = nextVisibleItemCount;
                setVisibleItemCount(nextVisibleItemCount);
            }
        };

        const measure = () => {
            if (listContainer.clientWidth <= 0) {
                return;
            }
            const itemNodes = Array.from(measureList.querySelectorAll<HTMLElement>('[data-change-item-measure-chip]'));
            const summaryNode = measureList.querySelector<HTMLElement>('[data-change-item-measure-summary]');
            if (itemNodes.length === 0 || !summaryNode) {
                updateVisibleItemCount(0);
                return;
            }

            const totalItemCount = items.length;
            if (measureCandidateVisibleRows(itemNodes, summaryNode, totalItemCount, totalItemCount) <= MAX_VISIBLE_CHANGE_ITEM_ROWS) {
                updateVisibleItemCount(totalItemCount);
                return;
            }

            let nextVisibleItemCount = Math.min(
                countItemsInsideVisibleRows(itemNodes, MAX_VISIBLE_CHANGE_ITEM_ROWS),
                totalItemCount - 1,
            );
            while (nextVisibleItemCount > 0) {
                if (measureCandidateVisibleRows(itemNodes, summaryNode, nextVisibleItemCount, totalItemCount) <= MAX_VISIBLE_CHANGE_ITEM_ROWS) {
                    break;
                }
                nextVisibleItemCount -= 1;
            }
            updateVisibleItemCount(nextVisibleItemCount);
        };

        measure();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(listContainer);
        window.requestAnimationFrame(measure);
        return () => observer?.disconnect();
    }, [items]);

    if (!items.length) {
        return <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">暂无变更</div>;
    }

    const renderChip = (item: FlattenedChangeItem, measure = false) => {
        const shouldShowGroupLabel = item.groupKey !== 'other';
        return (
            <span
                key={measure ? `${item.id}:measure` : item.id}
                data-change-item-chip={measure ? undefined : true}
                data-change-item-measure-chip={measure ? true : undefined}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs text-foreground"
                title={shouldShowGroupLabel ? `${item.groupLabel}：${item.name}` : item.name}
            >
                {shouldShowGroupLabel ? (
                    <span className="rounded bg-background/80 px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground">{item.groupLabel}</span>
                ) : null}
                <span className="max-w-[180px] truncate">{item.name}</span>
            </span>
        );
    };

    return (
        <div ref={listContainerRef} className="relative">
            <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
                {visibleChangeItems.items.map((item) => renderChip(item))}
                {visibleChangeItems.remainingCount > 0 ? (
                    <span
                        data-change-item-chip
                        className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground"
                        title={`还有 ${visibleChangeItems.remainingCount} 项变更，查看更多`}
                    >
                        +{visibleChangeItems.remainingCount} 变更
                    </span>
                ) : null}
            </div>
            <div
                ref={measureListRef}
                data-change-item-measure-list
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 flex h-0 w-full flex-wrap items-center gap-1.5 overflow-hidden opacity-0"
            >
                {items.map((item) => renderChip(item, true))}
                <span
                    data-change-item-measure-summary
                    className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground"
                >
                    +{items.length} 变更
                </span>
            </div>
        </div>
    );
}

export function VersionCollaborationPanel({ activeTab = 'all' }: { activeTab?: VersionCollaborationTab }) {
    const historicalVersion = getHistoricalVersionFromLocation();
    const [status, setStatus] = useState<GitWorkspaceStatusResponse | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [busyAction, setBusyAction] = useState<WorkspaceAction | null>(null);
    const [commitMessage, setCommitMessage] = useState('');
    const [remoteUrl, setRemoteUrl] = useState('');
    const [onlineMode, setOnlineMode] = useState<'connect' | 'create'>('connect');
    const [createRepositoryName, setCreateRepositoryName] = useState('');
    const [visibility, setVisibility] = useState<'private' | 'public'>('private');
    const [promptState, setPromptState] = useState<WorkspacePromptState | null>(null);

    const changeItems = useMemo(() => flattenChangeGroups(status?.changeSummary.groups || []), [status]);
    const incomingChangeItems = useMemo(
        () => flattenChangeGroups(status?.remoteComparison?.incoming.groups || []),
        [status],
    );
    const outgoingChangeItems = useMemo(
        () => flattenChangeGroups(status?.remoteComparison?.outgoing.groups || []),
        [status],
    );
    const localBranchOptions = useMemo(
        () => normalizeLocalBranches(status?.branchOverview?.localBranches, status?.currentBranch),
        [status],
    );
    const remoteBranchOptions = useMemo(() => {
        const branches = normalizeRemoteBranches(status?.branchOverview?.remoteBranches);
        if (status?.remoteComparison?.branch && !branches.includes(status.remoteComparison.branch)) {
            branches.unshift(status.remoteComparison.branch);
        }
        if (status?.remote?.defaultBranch && !branches.includes(status.remote.defaultBranch)) {
            return [status.remote.defaultBranch, ...branches];
        }
        return branches;
    }, [status]);

    const isRepositoryReady = Boolean(status?.isGitRepo && status?.hasCommits);
    const hasConfiguredRemote = Boolean(status?.remote?.url);
    const onlineBranchValue = status?.remote?.defaultBranch || status?.remoteComparison?.branch || '';
    const isBusy = busyAction !== null;
    const showLocalPanel = activeTab === 'local' || activeTab === 'all';
    const showOnlinePanel = activeTab === 'online' || activeTab === 'all';
    const showSkillPanel = activeTab === 'skills' || activeTab === 'all';

    const loadStatus = async (options: { silent?: boolean } = {}) => {
        setBusyAction('load');
        setErrorMessage('');
        try {
            const nextStatus = await apiService.getGitWorkspaceStatus({ gitVersion: historicalVersion });
            setStatus(nextStatus);
            setRemoteUrl(nextStatus.remote?.url || '');
        } catch (error) {
            const message = getActionErrorMessage(error, '加载版本状态失败');
            setErrorMessage(message);
            if (!options.silent) toast.error(message);
        } finally {
            setBusyAction(null);
        }
    };

    useEffect(() => {
        void loadStatus({ silent: true });
    }, [historicalVersion]);

    const runAction = async (
        action: WorkspaceAction,
        operation: () => Promise<unknown>,
        successMessage: string,
        fallbackErrorMessage: string,
    ) => {
        setBusyAction(action);
        setErrorMessage('');
        setPromptState(null);
        try {
            const result = await operation() as { prompt?: string; promptScene?: GitWorkspacePromptScene; message?: string };
            if (result?.prompt) {
                setPromptState({
                    text: result.prompt,
                    scene: result.promptScene || 'create-remote',
                    message: result.message,
                });
            }
            toast.success(successMessage);
            await loadStatus({ silent: true });
        } catch (error) {
            const message = getActionErrorMessage(error, fallbackErrorMessage);
            const prompt = getPromptFromError(error);
            setErrorMessage(message);
            if (prompt) {
                setPromptState(prompt);
                toast.warning('操作已停止，已生成给 AI 处理的提示词');
            } else {
                toast.error(message);
            }
        } finally {
            setBusyAction(null);
        }
    };

    const handleInit = () => runAction(
        'init',
        () => apiService.initGitWorkspace(),
        '已初始化本地仓库',
        '初始化本地仓库失败',
    );

    const handleCommit = () => {
        const message = commitMessage.trim();
        if (!message) {
            toast.error('请填写版本说明');
            return;
        }
        void runAction(
            'commit',
            () => apiService.commitGitWorkspace(message),
            '已提交当前项目版本',
            '提交版本失败',
        );
    };

    const handleCopyCommitPrompt = async () => {
        const prompt = buildCommitPrompt(status, changeItems);
        await copyText(prompt, '已复制给 AI 处理的提示词');
    };

    const handleSwitchBranch = (nextBranch: string) => {
        const branch = nextBranch.trim();
        if (!branch || branch === status?.currentBranch) return;
        void runAction(
            'branch',
            () => apiService.switchGitWorkspaceBranch(branch),
            '已切换分支',
            '切换分支失败',
        );
    };

    const handleConnectRemote = () => {
        const url = remoteUrl.trim();
        if (!url) {
            toast.error('请粘贴在线仓库 URL');
            return;
        }
        void runAction(
            'connect',
            () => apiService.setGitWorkspaceRemote({ url }),
            '已连接在线仓库',
            '连接在线仓库失败',
        );
    };

    const handleFetchRemote = () => runAction(
        'fetch',
        () => apiService.fetchGitWorkspace(),
        '已读取在线仓库',
        '读取在线仓库失败',
    );

    const handleSelectOnlineBranch = (nextBranch: string) => {
        const branch = nextBranch.trim();
        const url = status?.remote?.url?.trim();
        if (!branch || !url || branch === status?.remote?.defaultBranch) return;
        void runAction(
            'connect',
            () => apiService.setGitWorkspaceRemote({ url, defaultBranch: branch }),
            '已更新线上分支',
            '更新线上分支失败',
        );
    };

    const handleCreateRemote = () => {
        const repositoryName = createRepositoryName.trim();
        if (!repositoryName) {
            toast.error('请填写仓库名称');
            return;
        }
        void runAction(
            'create',
            async () => {
                const result = await apiService.createGitWorkspaceRemoteRepository({ repositoryName, visibility });
                if (result.remote?.url) {
                    await apiService.setGitWorkspaceRemote({ url: result.remote.url });
                }
                return result;
            },
            '已创建在线仓库',
            '创建在线仓库失败',
        );
    };

    const handleSyncDown = () => runAction(
        'sync-down',
        () => apiService.syncDownGitWorkspace(),
        '已同步在线仓库',
        '同步下来失败',
    );

    const handlePush = () => runAction(
        'push',
        () => apiService.pushGitWorkspace(),
        '已同步到在线仓库',
        '同步到在线失败',
    );

    const handleCopyPrompt = () => {
        if (!promptState?.text) return;
        void copyText(promptState.text, '已复制给 AI 处理的提示词');
    };

    const handleCopySkillPrompt = () => {
        void copyText(INSTALL_GIT_REPO_SKILL_PROMPT, '已复制管理技能提示词');
    };

    const renderRepositoryNotReadyHint = (description: string) => (
        <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
            <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{description}</span>
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 bg-background"
                onClick={handleInit}
                disabled={isBusy || status?.gitAvailable === false}
            >
                {busyAction === 'init' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                一键初始化
            </Button>
        </div>
    );

    const renderBranchSelect = () => (
        <Select
            value={status?.currentBranch || ''}
            onValueChange={handleSwitchBranch}
            disabled={isBusy || !isRepositoryReady || localBranchOptions.length === 0}
        >
            <SelectTrigger className="h-8 min-w-0 border-border/70 bg-muted/30 px-2.5 text-xs font-medium">
                <SelectValue placeholder="选择分支" />
            </SelectTrigger>
            <SelectContent>
                {localBranchOptions.map((branch) => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    const renderOnlineBranchSelect = () => (
        <Select
            value={onlineBranchValue}
            onValueChange={handleSelectOnlineBranch}
            disabled={isBusy || !isRepositoryReady || remoteBranchOptions.length === 0}
        >
            <SelectTrigger className="h-8 min-w-0 border-border/70 bg-muted/30 px-2.5 text-xs font-medium">
                <SelectValue placeholder="选择线上分支" />
            </SelectTrigger>
            <SelectContent>
                {remoteBranchOptions.map((branch) => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    const renderOnlineRemoteSetupCard = () => (
        <SectionCard title="在线仓库">
            <div className="space-y-3">
                <div className="grid h-8 w-full max-w-[260px] grid-cols-2 rounded-lg border border-border/70 bg-muted/50 p-0.5">
                    <button
                        type="button"
                        className={`rounded-md px-2.5 text-[13px] font-medium leading-none transition ${onlineMode === 'connect' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setOnlineMode('connect')}
                    >
                        连接已有
                    </button>
                    <button
                        type="button"
                        className={`rounded-md px-2.5 text-[13px] font-medium leading-none transition ${onlineMode === 'create' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setOnlineMode('create')}
                    >
                        新建仓库
                    </button>
                </div>

                {onlineMode === 'connect' ? (
                    <div className="space-y-3">
                        <Field>
                            <FieldLabelWithHint hint="支持 HTTPS 或 SSH">仓库 URL</FieldLabelWithHint>
                            <Input
                                value={remoteUrl}
                                onChange={(event) => setRemoteUrl(event.target.value)}
                                placeholder="https://git.example.com/team/project.git"
                            />
                        </Field>
                        <div className="flex justify-end">
                            <Button
                                type="button"
                                variant="brand"
                                size="sm"
                                className="h-9 gap-1.5"
                                onClick={handleConnectRemote}
                                disabled={isBusy || !isRepositoryReady || !remoteUrl.trim()}
                            >
                                {busyAction === 'connect' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                连接已有仓库
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_124px]">
                            <Field>
                                <FieldLabelWithHint hint="使用小写字母、数字和连字符更稳妥">仓库名称</FieldLabelWithHint>
                                <Input
                                    value={createRepositoryName}
                                    onChange={(event) => setCreateRepositoryName(event.target.value)}
                                    placeholder="my-project"
                                />
                            </Field>
                            <Field>
                                <FieldLabelWithHint>可见性</FieldLabelWithHint>
                                <Select value={visibility} onValueChange={(value) => setVisibility(value === 'public' ? 'public' : 'private')}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="可见性" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="private">私有</SelectItem>
                                        <SelectItem value="public">公开</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                        <div className="flex justify-end">
                            <Button
                                type="button"
                                variant="brand"
                                size="sm"
                                className="gap-1.5"
                                onClick={handleCreateRemote}
                                disabled={isBusy || !isRepositoryReady || !createRepositoryName.trim()}
                            >
                                {busyAction === 'create' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                创建新仓库
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </SectionCard>
    );

    const renderOnlineInfoCard = () => (
        <SectionCard
            title="信息"
            actions={(
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2"
                    onClick={handleFetchRemote}
                    disabled={isBusy || !isRepositoryReady || !hasConfiguredRemote}
                >
                    {busyAction === 'fetch' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    读取分支
                </Button>
            )}
        >
            <div className="grid gap-2">
                <InfoRow label="状态">
                    <RemoteStatusValue status={status} />
                </InfoRow>
                <InfoRow label="线上分支">
                    {renderOnlineBranchSelect()}
                </InfoRow>
                {status?.remote?.url ? (
                    <InfoRow label="仓库">
                        <InfoValue title={status.remote.url}>{status.remote.url}</InfoValue>
                    </InfoRow>
                ) : null}
            </div>
        </SectionCard>
    );

    return (
        <div className="space-y-3.5">
            {showLocalPanel ? (
                !isRepositoryReady ? (
                    renderRepositoryNotReadyHint('当前项目还没有可用的本地版本记录，可以先创建一个基线版本。')
                ) : (
                    <>
                        <SectionCard
                            title="信息"
                            actions={(
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 px-2"
                                    onClick={() => loadStatus()}
                                    disabled={isBusy}
                                >
                                    {busyAction === 'load' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                    刷新
                                </Button>
                            )}
                        >
                            <div className="grid gap-2">
                                <InfoRow label="状态">
                                    <StatusValue status={status} />
                                </InfoRow>
                                {!status?.isHistoricalVersion ? (
                                    <InfoRow label="当前分支">
                                        {renderBranchSelect()}
                                    </InfoRow>
                                ) : null}
                                <InfoRow label="版本">
                                    <InfoValue contentClassName="font-mono">{getWorkspaceVersionText(status)}</InfoValue>
                                </InfoRow>
                                {status?.isHistoricalVersion ? (
                                    <InfoRow label="版本提交信息">
                                        <InfoValue title={status?.currentCommit?.message || undefined}>
                                            {status?.currentCommit?.message || '无提交信息'}
                                        </InfoValue>
                                    </InfoRow>
                                ) : null}
                            </div>
                        </SectionCard>

                        {status?.isHistoricalVersion && status?.hasChanges ? (
                            <SectionCard title="更改文件">
                                <ChangeItemList items={changeItems} />
                            </SectionCard>
                        ) : null}

                        {!status?.isHistoricalVersion && status?.hasChanges ? (
                            <>
                                <SectionCard title="更改文件">
                                    <ChangeItemList items={changeItems} />
                                </SectionCard>

                                <SectionCard title="提交版本">
                                    <div className="space-y-3">
                                        <Input
                                            value={commitMessage}
                                            onChange={(event) => setCommitMessage(event.target.value)}
                                            placeholder="手动输入版本说明..."
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    handleCommit();
                                                }
                                            }}
                                        />
                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="gap-1.5"
                                                onClick={() => void handleCopyCommitPrompt()}
                                                disabled={isBusy || !isRepositoryReady || !status?.hasChanges}
                                            >
                                                {busyAction === 'commit-prompt' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                                                复制给 AI 处理
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="brand"
                                                size="sm"
                                                className="gap-1.5"
                                                onClick={handleCommit}
                                                disabled={isBusy || !isRepositoryReady || !status?.hasChanges || !commitMessage.trim()}
                                            >
                                                {busyAction === 'commit' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                提交版本
                                            </Button>
                                        </div>
                                    </div>
                                </SectionCard>
                            </>
                        ) : null}
                    </>
                )
            ) : null}

            {showOnlinePanel ? (
                isRepositoryReady ? (
                    hasConfiguredRemote ? (
                        <>
                            {renderOnlineInfoCard()}

                            {incomingChangeItems.length > 0 ? (
                                <SectionCard
                                    title="线上有更新"
                                    actions={(
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 gap-1.5 px-2"
                                            onClick={handleSyncDown}
                                            disabled={isBusy || !isRepositoryReady || !hasConfiguredRemote}
                                        >
                                            {busyAction === 'sync-down' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                            同步下来
                                        </Button>
                                    )}
                                >
                                    <ChangeItemList items={incomingChangeItems} />
                                </SectionCard>
                            ) : null}

                            {outgoingChangeItems.length > 0 ? (
                                <SectionCard
                                    title="本地待同步"
                                    actions={(
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 gap-1.5 px-2"
                                            onClick={handlePush}
                                            disabled={isBusy || !isRepositoryReady || !hasConfiguredRemote}
                                        >
                                            {busyAction === 'push' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                            同步到在线
                                        </Button>
                                    )}
                                >
                                    <ChangeItemList items={outgoingChangeItems} />
                                </SectionCard>
                            ) : null}
                        </>
                    ) : (
                        renderOnlineRemoteSetupCard()
                    )
                ) : (
                    renderRepositoryNotReadyHint('本地仓库初始化后，才能连接或同步在线仓库。')
                )
            ) : null}

            {showSkillPanel ? (
                <SectionCard title="管理技能">
                    <div className="space-y-3">
                        <FieldDescription>
                            复制相关提示词，让 AI 安装这个技能后，可以协助处理版本管理、团队协作、异地办公，以及在多台设备间同步项目。
                        </FieldDescription>
                        <Button
                            type="button"
                            variant="brand"
                            size="sm"
                            className="gap-1.5"
                            onClick={handleCopySkillPrompt}
                        >
                            <Copy className="h-3.5 w-3.5" />
                            复制提示词
                        </Button>
                    </div>
                </SectionCard>
            ) : null}

            {errorMessage ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            ) : null}

            {promptState ? (
                <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                            <div className="font-medium">需要 AI 协助处理</div>
                            <FieldDescription className="text-amber-700/80 dark:text-amber-300/80">
                                Make 不会自动合并或解决冲突，请复制提示词交给 AI 判断。
                            </FieldDescription>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 gap-1.5 bg-background"
                            onClick={handleCopyPrompt}
                        >
                            <Copy className="h-3.5 w-3.5" />
                            复制给 AI 处理
                        </Button>
                    </div>
                    <Textarea
                        value={promptState.text}
                        readOnly
                        rows={5}
                        className="resize-none bg-background font-mono text-[11px] leading-5 text-foreground"
                    />
                </div>
            ) : null}
        </div>
    );
}
