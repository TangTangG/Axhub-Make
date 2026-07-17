import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Download, Loader2, RefreshCw, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabelWithHint } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    apiService,
    type GitWorkspaceChangeGroup,
    type GitWorkspaceChangeItem,
    type GitWorkspacePromptScene,
    type GitWorkspaceStatusResponse,
} from '../services/api';
import { generateGitCommitMessage } from '../domains/ai-generation/gitCommitMessageGeneration';
import {
    VersionChangeCard,
    VersionCommitRow,
    VersionInfoRow,
    VersionInfoValue,
    VersionSection,
    VersionSyncTabs,
    getVersionChangeTitle,
    type VersionCardCommit,
} from './VersionCards';

export type VersionCollaborationTab = 'local' | 'online' | 'skills' | 'all';

type WorkspaceAction =
    | 'load'
    | 'init'
    | 'commit'
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

const MAX_VISIBLE_CHANGE_ITEMS = 5;
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

const SectionCard = VersionSection;
const InfoRow = VersionInfoRow;
const InfoValue = VersionInfoValue;

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
    const visibleChangeItems = getVisibleChangeItems(items, MAX_VISIBLE_CHANGE_ITEMS);

    if (!items.length) {
        return <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">暂无变更</div>;
    }

    const renderChip = (item: FlattenedChangeItem) => {
        const shouldShowGroupLabel = item.groupKey !== 'other';
        return (
            <span
                key={item.id}
                data-change-item-chip
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
    );
}

export function VersionCollaborationPanel({ activeTab = 'all' }: { activeTab?: VersionCollaborationTab }) {
    const historicalVersion = getHistoricalVersionFromLocation();
    const [status, setStatus] = useState<GitWorkspaceStatusResponse | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [busyAction, setBusyAction] = useState<WorkspaceAction | null>(null);
    const [commitMessage, setCommitMessage] = useState('');
    const [generatingCommitMessage, setGeneratingCommitMessage] = useState(false);
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
    const incomingAllCommits = useMemo<VersionCardCommit[]>(
        () => status?.remoteComparison?.incomingCommits || [],
        [status],
    );
    const incomingRecentCommits = useMemo(() => incomingAllCommits.slice(0, 2), [incomingAllCommits]);
    const outgoingAllCommits = useMemo<VersionCardCommit[]>(
        () => status?.remoteComparison?.outgoingCommits || [],
        [status],
    );
    const outgoingRecentCommits = useMemo(() => outgoingAllCommits.slice(0, 2), [outgoingAllCommits]);
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
    const incomingTotal = status?.remoteComparison?.incoming.totalFiles || 0;
    const outgoingTotal = status?.remoteComparison?.outgoing.totalFiles || 0;
    const recentCommits = status?.recentCommits || [];
    const behindCount = status?.remoteComparison?.behindCount || incomingAllCommits.length;
    const aheadCount = status?.remoteComparison?.aheadCount || outgoingAllCommits.length;

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

    const handleGenerateCommitMessage = async () => {
        setGeneratingCommitMessage(true);
        try {
            const generatedMessage = await generateGitCommitMessage({
                scope: 'workspace',
                status,
                currentMessage: commitMessage,
            });
            setCommitMessage(generatedMessage);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'AI 生成版本记录失败');
        } finally {
            setGeneratingCommitMessage(false);
        }
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
                                {status?.isHistoricalVersion ? (
                                    <>
                                        <InfoRow label="版本">
                                            <InfoValue contentClassName="font-mono">{getWorkspaceVersionText(status)}</InfoValue>
                                        </InfoRow>
                                        <InfoRow label="版本提交信息">
                                            <InfoValue title={status?.currentCommit?.message || undefined}>
                                                {status?.currentCommit?.message || '无提交信息'}
                                            </InfoValue>
                                        </InfoRow>
                                    </>
                                ) : null}
                            </div>
                        </SectionCard>

                        {!status?.isHistoricalVersion && recentCommits.length > 0 ? (
                            <SectionCard title="历史版本" contentClassName="px-3.5 py-0">
                                <div className="divide-y divide-border/50">
                                    {recentCommits.map((commit, index) => (
                                        <VersionCommitRow
                                            key={commit.hash}
                                            commit={commit}
                                            badge={index === 0 && !status?.hasChanges ? (
                                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-100">
                                                    当前版本
                                                </span>
                                            ) : null}
                                        />
                                    ))}
                                </div>
                            </SectionCard>
                        ) : null}

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
                                        <div className="relative">
                                            <Textarea
                                                value={commitMessage}
                                                onChange={(event) => setCommitMessage(event.target.value)}
                                                placeholder="手动输入版本说明..."
                                                rows={4}
                                                className="min-h-[96px] resize-none pr-10"
                                                onKeyDown={(event) => {
                                                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                                                        event.preventDefault();
                                                        handleCommit();
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
                                                            disabled={isBusy || generatingCommitMessage || !isRepositoryReady || !status?.hasChanges}
                                                            aria-label="AI生成版本记录"
                                                        >
                                                            {generatingCommitMessage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">AI生成版本记录</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-end gap-2">
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

                            <VersionSyncTabs
                                incoming={incomingChangeItems.length > 0 ? (
                                    <VersionChangeCard
                                        title={getVersionChangeTitle('incoming', behindCount)}
                                        description={`从线上 ${status?.remoteComparison?.branch || onlineBranchValue || '当前'} 同步到本地，涉及 ${incomingTotal} 个文件。`}
                                        recentCommits={incomingRecentCommits}
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
                                    </VersionChangeCard>
                                ) : null}
                                outgoing={outgoingChangeItems.length > 0 ? (
                                    <VersionChangeCard
                                        title={getVersionChangeTitle('outgoing', aheadCount)}
                                        description={`推送到线上 ${status?.remoteComparison?.branch || onlineBranchValue || '当前'}，涉及 ${outgoingTotal} 个文件。`}
                                        recentCommits={outgoingRecentCommits}
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
                                                推送上去
                                            </Button>
                                        )}
                                    >
                                        <ChangeItemList items={outgoingChangeItems} />
                                    </VersionChangeCard>
                                ) : null}
                            />
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
