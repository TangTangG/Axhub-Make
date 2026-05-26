import React, { useEffect, useMemo, useState } from 'react';
import { Eye, GitCommit, History, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ItemData, PromptClientPreference, TabType } from '../types';
import { IDEAvailabilityMap, MainIDEPreference } from '../../common/ide';
import PromptActionButton from './PromptActionButton';
import { Button } from '@/components/ui/button';
import { getGitVersionUnavailableState, type GitVersionUnavailableState } from '../utils/gitVersionErrors';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useAppDialog } from './dialogs/AppDialogProvider';

interface VersionManagerProps {
    visible: boolean;
    onCancel: () => void;
    item: ItemData | null;
    activeTab: TabType;
    preferredPromptClient: PromptClientPreference;
    preferredIDE: MainIDEPreference;
    ideAvailability?: IDEAvailabilityMap;
}

interface CommitItem {
    hash: string;
    message: string;
    author: string;
    timestamp: number;
}

export default function VersionManager({
    visible,
    onCancel,
    item,
    activeTab,
    preferredPromptClient,
    preferredIDE,
    ideAvailability,
}: VersionManagerProps) {
    const appDialog = useAppDialog();
    const [commits, setCommits] = useState<CommitItem[]>([]);
    const [hasUncommitted, setHasUncommitted] = useState(false);
    const [uncommittedFiles, setUncommittedFiles] = useState('');
    const [commitMessage, setCommitMessage] = useState('');
    const [committing, setCommitting] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [viewingPrototypeId, setViewingPrototypeId] = useState<string | null>(null);
    const [gitUnavailableState, setGitUnavailableState] = useState<GitVersionUnavailableState | null>(null);

    const normalizeGitPath = (rawPath: string) => {
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
    };

    const getGitTargetPath = (targetItem: ItemData) => {
        const rawPath = String(targetItem.filePath || targetItem.absoluteFilePath || '').trim();
        return rawPath ? normalizeGitPath(rawPath) : '';
    };

    const formatCommitTimestamp = (timestamp: number) => {
        const d = new Date(timestamp);
        const pad2 = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    };

    const timeAgo = (timestamp: number) => {
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
    };

    const loadVersionHistory = async () => {
        if (!item) return;
        setLoadingHistory(true);
        setGitUnavailableState(null);
        try {
            const path = getGitTargetPath(item);
            if (!path) {
                toast.error('无法获取文件路径');
                return;
            }
            const response = await fetch(`/api/git/history?path=${encodeURIComponent(path)}`);
            const data = await response.json();

            if (response.ok) {
                setGitUnavailableState(getGitVersionUnavailableState(data));
                setCommits(Array.isArray(data.commits) ? data.commits : []);
                setHasUncommitted(Boolean(data.hasUncommitted));
                setUncommittedFiles(typeof data.uncommittedFiles === 'string' ? data.uncommittedFiles : '');
            } else {
                const unavailableState = getGitVersionUnavailableState(data);
                if (unavailableState) {
                    setGitUnavailableState(unavailableState);
                    setCommits([]);
                    setHasUncommitted(false);
                    setUncommittedFiles('');
                } else {
                    toast.error(data.error || '加载版本历史失败');
                }
            }
        } catch {
            toast.error('加载版本历史失败');
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (visible && item) {
            void loadVersionHistory();
        }
    }, [visible, item]);

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
            const path = getGitTargetPath(item);
            if (!path) {
                toast.error('无法获取文件路径');
                return;
            }
            const response = await fetch('/api/git/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, commitHash }),
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('版本恢复成功');
                void loadVersionHistory();
            } else {
                toast.error(data.error || '版本恢复失败');
            }
        } catch {
            toast.error('版本恢复失败');
        }
    };

    const handleSubmitCommit = async () => {
        if (!item || !commitMessage.trim()) {
            toast.warning('请输入提交信息');
            return;
        }

        setCommitting(true);
        try {
            const path = getGitTargetPath(item);
            if (!path) {
                toast.error('无法获取文件路径');
                return;
            }
            const response = await fetch('/api/git/commit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, message: commitMessage }),
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('提交成功');
                setCommitMessage('');
                void loadVersionHistory();
            } else {
                toast.error(data.error || '提交失败');
            }
        } catch {
            toast.error('提交失败');
        } finally {
            setCommitting(false);
        }
    };

    const buildAICommitPrompt = async () => {
        if (!item) {
            throw new Error('请选择条目后再执行');
        }

        const path = getGitTargetPath(item);
        if (!path) {
            throw new Error('当前资源未声明本地文件路径，无法生成提交指令');
        }
        return `我需要提交以下目录的更改，请帮我处理：

目标路径: ${path}

请执行以下步骤：
1. 使用 git status 和 git diff 查看该路径下的变更内容。
2. 分析变更，生成一个简洁明了的中文提交信息（Commit Message）。
3. 向我展示变更摘要和建议的提交信息，并询问是否继续。
4. 获得确认后，执行：
   git add ${path}
   git commit -m "你的提交信息"

请直接开始执行第 1 步。`;
    };

    const handleViewPrototype = async (commitHash: string) => {
        if (!item) return;
        setViewingPrototypeId(commitHash);
        try {
            const path = getGitTargetPath(item);
            if (!path) {
                toast.error('无法获取文件路径');
                return;
            }
            const response = await fetch('/api/git/build-version', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, commitHash }),
            });

            const data = await response.json();

            if (response.ok && data.hasPrototype && data.prototypeUrl) {
                window.open(data.prototypeUrl, '_blank');
            } else if (!data.hasPrototype) {
                toast.warning('该版本没有原型文件');
            } else {
                toast.error(data.error || '无法访问原型');
            }
        } catch {
            toast.error('加载原型失败');
        } finally {
            setViewingPrototypeId(null);
        }
    };

    const changedFilesCount = useMemo(
        () => uncommittedFiles.split('\n').filter(Boolean).length,
        [uncommittedFiles],
    );

    return (
        <Dialog open={visible} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
            <DialogContent className="max-h-[80vh] max-w-[760px] overflow-y-auto text-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        {`版本管理 - ${item?.displayName || '-'}`}
                    </DialogTitle>
                    <DialogDescription>查看历史版本、提交未保存更改并回滚到指定版本。</DialogDescription>
                </DialogHeader>

                {loadingHistory ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>
                ) : (
                    <div className="space-y-3">
                        {gitUnavailableState ? (
                            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                <div className="font-medium text-foreground">{gitUnavailableState.title}</div>
                                <div className="mt-2">{gitUnavailableState.description}</div>
                            </div>
                        ) : null}

                        {hasUncommitted ? (
                            <div className="rounded-md border border-amber-300/60 bg-amber-50/50 p-3 dark:border-amber-700/70 dark:bg-amber-950/20">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium text-foreground">未提交的更改</div>
                                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-sm text-amber-900 dark:bg-amber-700 dark:text-amber-100">
                                        未保存
                                    </span>
                                </div>
                                <div className="mt-3 space-y-3">
                                    <Input
                                        placeholder="手动输入提交信息..."
                                        value={commitMessage}
                                        onChange={(e) => setCommitMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                void handleSubmitCommit();
                                            }
                                        }}
                                    />
                                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                                        <div className="text-sm text-muted-foreground">
                                            {changedFilesCount > 0 ? `${changedFilesCount} 个文件变更` : '有文件变更'}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <PromptActionButton
                                                type="default"
                                                preferredClient={preferredPromptClient}
                                                preferredIDE={preferredIDE}
                                                ideAvailability={ideAvailability}
                                                scene={`version-commit-${activeTab}`}
                                                buildPrompt={buildAICommitPrompt}
                                                 getIdeTargetPath={() => {
                                                     if (!item) return null;
                                                     const path = getGitTargetPath(item);
                                                     return path || null;
                                                 }}
                                                copySuccessMessage="AI 指令已复制，请粘贴给助手"
                                                executeSuccessMessage="已打开新会话"
                                                fallbackMessage="自动执行失败，已回退为复制 Prompt"
                                            />
                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={() => void handleSubmitCommit()}
                                                disabled={committing || !commitMessage.trim()}
                                            >
                                                <GitCommit className="h-4 w-4" />
                                                {committing ? '提交中...' : '提交'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {commits.length === 0 ? (
                            gitUnavailableState || hasUncommitted ? null : (
                                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">暂无版本历史</div>
                            )
                        ) : (
                            <div className="space-y-3">
                                {commits.map((commit, index) => {
                                    const isCurrent = index === 0 && !hasUncommitted;
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
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-xs"
                                                            onClick={() => void handleViewPrototype(commit.hash)}
                                                            disabled={viewingPrototypeId === commit.hash}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-xs"
                                                            onClick={() => void handleRestore(commit.hash)}
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
