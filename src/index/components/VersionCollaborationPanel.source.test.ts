import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readPanelSource() {
  return readFileSync(resolve(__dirname, './VersionCollaborationPanel.tsx'), 'utf8');
}

function readDrawerSource() {
  return readFileSync(resolve(__dirname, './WorkspaceVersionCollaborationDrawer.tsx'), 'utf8');
}

function readVersionManagerSource() {
  return readFileSync(resolve(__dirname, './VersionManager.tsx'), 'utf8');
}

describe('VersionCollaborationPanel source', () => {
  it('hides local change and commit cards when there are no local changes', () => {
    const source = readPanelSource();
    const localPanelStart = source.indexOf('{showLocalPanel ? (');
    const onlinePanelStart = source.indexOf('{showOnlinePanel ? (');

    expect(localPanelStart).toBeGreaterThan(-1);
    expect(onlinePanelStart).toBeGreaterThan(localPanelStart);

    const localPanelSource = source.slice(localPanelStart, onlinePanelStart);

    expect(localPanelSource).toMatch(/status\?\.hasChanges \? \(\s*<>\s*<SectionCard title="更改文件">[\s\S]*?<ChangeItemList items=\{changeItems\} \/>[\s\S]*?<\/SectionCard>[\s\S]*?<SectionCard title="提交版本">/);
  });

  it('keeps branch selection out of the connect-remote form', () => {
    const source = readPanelSource();
    const connectFormStart = source.indexOf("{onlineMode === 'connect' ? (");
    const createFormStart = source.indexOf('仓库名称', connectFormStart);
    const onlineInfoStart = source.indexOf('const renderOnlineInfoCard = () =>');

    expect(connectFormStart).toBeGreaterThan(-1);
    expect(createFormStart).toBeGreaterThan(connectFormStart);
    expect(onlineInfoStart).toBeGreaterThan(createFormStart);

    const connectFormSource = source.slice(connectFormStart, createFormStart);
    const onlineInfoSource = source.slice(onlineInfoStart);

    expect(connectFormSource).toContain('仓库 URL');
    expect(connectFormSource).toContain('连接已有仓库');
    expect(connectFormSource).not.toContain('在线分支');
    expect(connectFormSource).not.toContain('defaultBranch');
    expect(connectFormSource).not.toContain('请选择在线分支');
    expect(connectFormSource).not.toContain('setDefaultBranch');
    expect(connectFormSource).not.toContain('remoteBranchOptions.map');
    expect(onlineInfoSource).toContain('线上分支');
    expect(onlineInfoSource).toContain('renderOnlineBranchSelect()');
  });

  it('moves git management prompts into a dedicated skill tab', () => {
    const panelSource = readPanelSource();
    const drawerSource = readDrawerSource();

    expect(drawerSource).toContain('grid-cols-3');
    expect(drawerSource).toContain('<TabsTrigger value="skills"');
    expect(drawerSource).toContain('管理技能');
    expect(drawerSource).toContain('<VersionCollaborationPanel activeTab="skills" />');

    expect(panelSource).toContain("export type VersionCollaborationTab = 'local' | 'online' | 'skills' | 'all';");
    expect(panelSource).toContain("const showSkillPanel = activeTab === 'skills' || activeTab === 'all';");
    expect(panelSource).toContain('GIT_REPO_BEGINNER_GUIDE_SKILL_URL');
    expect(panelSource).toContain('https://github.com/lintendo/Axhub-Skills/blob/main/skills/git-repo-beginner-guide/SKILL.md');
    expect(panelSource).toContain('INSTALL_GIT_REPO_SKILL_PROMPT');
    expect(panelSource).toContain('版本管理、团队协作、异地办公，以及在多台设备间同步项目');
    expect(panelSource).toContain('<SectionCard title="管理技能">');
    expect(panelSource).toContain('复制提示词');
    expect(panelSource).not.toContain('branchPromptAction');
    expect(panelSource).not.toContain('handleCopyBranchPrompt');
    expect(panelSource).not.toContain('分支管理');
    expect(panelSource).not.toContain('复制分支处理提示词');
    expect(panelSource).not.toContain('apiService.getGitWorkspacePrompt');
    expect(panelSource).not.toContain('GitBranch');
  });

  it('labels collapsed change counts as remaining changes', () => {
    const panelSource = readPanelSource();

    expect(panelSource).toContain('summaryNode.textContent = `+${Math.max(0, totalItemCount - visibleItemCount)} 变更`;');
    expect(panelSource).toContain('+{visibleChangeItems.remainingCount} 变更');
    expect(panelSource).not.toContain('summaryNode.textContent = `+${Math.max(0, totalItemCount - visibleItemCount)}`;');
  });

  it('renders historical versions as read-only local version snapshots', () => {
    const panelSource = readPanelSource();

    expect(panelSource).toContain('const historicalVersion = getHistoricalVersionFromLocation();');
    expect(panelSource).toContain('apiService.getGitWorkspaceStatus({ gitVersion: historicalVersion })');
    expect(panelSource).toContain('<InfoRow label="版本">');
    expect(panelSource).toContain('function getWorkspaceVersionText(');
    expect(panelSource).toContain('status.currentCommit?.shortHash');
    expect(panelSource).toContain('getWorkspaceVersionText(status)');
    expect(panelSource).toContain('<InfoRow label="版本提交信息">');
    expect(panelSource).toContain('status?.currentCommit?.message');
    expect(panelSource).toContain('!status?.isHistoricalVersion && status?.hasChanges ? (');
    expect(panelSource).toContain('status?.isHistoricalVersion && status?.hasChanges ? (');
  });

  it('uses consistent information value styling and avoids vague version fallbacks', () => {
    const panelSource = readPanelSource();
    const refreshAction = panelSource.indexOf('onClick={() => loadStatus()}');
    const localInfoStart = panelSource.indexOf('<InfoRow label="状态">', refreshAction);
    const localInfoEnd = panelSource.indexOf('{status?.isHistoricalVersion && status?.hasChanges ? (', localInfoStart);

    expect(refreshAction).toBeGreaterThan(-1);
    expect(localInfoStart).toBeGreaterThan(-1);
    expect(localInfoEnd).toBeGreaterThan(localInfoStart);

    const localInfoSource = panelSource.slice(localInfoStart, localInfoEnd);

    expect(panelSource).toContain('function InfoValue(');
    expect(panelSource).toContain('function getWorkspaceVersionText(');
    expect(panelSource).toContain("if (!status) return '读取中';");
    expect(panelSource).toContain("return status.currentCommit?.shortHash || '版本号读取失败';");
    expect(localInfoSource).toContain('<StatusValue');
    expect(localInfoSource).toContain('<InfoValue contentClassName="font-mono">');
    expect(localInfoSource).toContain('getWorkspaceVersionText(status)');
    expect(localInfoSource).not.toContain("|| '未检测'");
    expect(localInfoSource).not.toContain('rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium');
  });

  it('generates version notes from an AI icon inside the workspace commit input', () => {
    const panelSource = readPanelSource();
    const commitSectionStart = panelSource.indexOf('<SectionCard title="提交版本">');
    const commitSectionEnd = panelSource.indexOf('</SectionCard>', commitSectionStart);
    const commitSectionSource = panelSource.slice(commitSectionStart, commitSectionEnd);

    expect(panelSource).toContain("import { generateGitCommitMessage } from '../domains/ai-generation/gitCommitMessageGeneration';");
    expect(panelSource).toContain('const handleGenerateCommitMessage = async () =>');
    expect(panelSource).toContain('await generateGitCommitMessage({');
    expect(panelSource).toContain("scope: 'workspace'");
    expect(panelSource).toContain('setCommitMessage(generatedMessage);');
    expect(panelSource).toContain("toast.error(error instanceof Error ? error.message : 'AI 生成版本记录失败');");
    expect(panelSource).toContain("import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';");
    expect(panelSource).toContain("import { Textarea } from '@/components/ui/textarea';");
    expect(commitSectionSource).toContain('<Textarea');
    expect(commitSectionSource).not.toContain('<Input');
    expect(commitSectionSource).toContain('AI生成版本记录');
    expect(commitSectionSource).toContain('<Sparkles');
    expect(commitSectionSource).toContain("generatingCommitMessage ? <Loader2 className=\"h-3.5 w-3.5 animate-spin\" /> : <Sparkles");
    expect(commitSectionSource).toContain('<TooltipProvider>');
    expect(commitSectionSource).toContain('<TooltipTrigger asChild>');
    expect(commitSectionSource).toContain('<TooltipContent side="top">AI生成版本记录</TooltipContent>');
    expect(commitSectionSource).not.toContain('title="AI生成版本记录"');
    expect(commitSectionSource).not.toContain('复制给 AI 处理');
    expect(panelSource).not.toContain('handleCopyCommitPrompt');
    expect(panelSource).not.toContain('function buildWorkspaceCommitMessageSuggestion(');
  });

  it('renders prototype version management as a two-tab version collaboration drawer', () => {
    const source = readVersionManagerSource();

    expect(source).toContain('<Sheet open={visible} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>');
    expect(source).toContain('<SheetTitle className="sr-only">版本和协作');
    expect(source).toContain('<Tabs defaultValue="local" className="flex h-full flex-col">');
    expect(source).toContain('<TabsTrigger value="local"');
    expect(source).toContain('本地仓库');
    expect(source).toContain('<TabsTrigger value="online"');
    expect(source).toContain('在线仓库');
    expect(source).not.toContain('<TabsTrigger value="skills"');
    expect(source).not.toContain('管理技能');
    expect(source).not.toContain('<DialogContent');
    expect(source).not.toContain('版本管理 -');
  });

  it('keeps prototype local changes as status-only while preserving history actions', () => {
    const source = readVersionManagerSource();
    const localTabStart = source.indexOf('<TabsContent value="local"');
    const onlineTabStart = source.indexOf('<TabsContent value="online"');
    const localTabSource = source.slice(localTabStart, onlineTabStart);

    expect(source).toContain('function getPrototypeLocalStatusText(');
    expect(source).toContain('const localStatusText = getPrototypeLocalStatusText({');
    expect(localTabSource).toContain('{localStatusText}');
    expect(localTabSource).not.toContain('uncommittedFiles');
    expect(localTabSource).not.toContain('changedFilesCount');
    expect(localTabSource).not.toContain('ChangeItemList');
    expect(localTabSource).toContain('aria-label="预览历史版本"');
    expect(localTabSource).toContain('aria-label="恢复此版本"');
    expect(localTabSource).not.toContain('title="预览历史版本"');
    expect(localTabSource).not.toContain('title="恢复此版本"');
  });

  it('shows hover tooltips for prototype history icon buttons', () => {
    const source = readVersionManagerSource();
    const localTabStart = source.indexOf('<TabsContent value="local"');
    const onlineTabStart = source.indexOf('<TabsContent value="online"');
    const localTabSource = source.slice(localTabStart, onlineTabStart);

    expect(source).toContain("import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';");
    expect(localTabSource).toContain('<TooltipProvider>');
    expect(localTabSource).toContain('<TooltipTrigger asChild>');
    expect(localTabSource).toContain('<TooltipContent side="top">预览历史版本</TooltipContent>');
    expect(localTabSource).toContain('<TooltipContent side="top">恢复此版本</TooltipContent>');
    expect(localTabSource).not.toContain('title="预览历史版本"');
    expect(localTabSource).not.toContain('title="恢复此版本"');
  });

  it('filters prototype history entries that have no current prototype entry', () => {
    const source = readVersionManagerSource();
    const localTabStart = source.indexOf('<TabsContent value="local"');
    const onlineTabStart = source.indexOf('<TabsContent value="online"');
    const localTabSource = source.slice(localTabStart, onlineTabStart);

    expect(source).toContain('hasPrototype?: boolean;');
    expect(source).toContain("data.commits.filter((commit: CommitItem) => commit.hasPrototype !== false)");
    expect(localTabSource).toContain('const canPreview = commit.hasPrototype !== false;');
    expect(localTabSource).toContain('{canPreview ? (');
    expect(source).toContain('这个历史版本里还没有当前原型，无法预览。');
    expect(source).not.toContain('该版本没有原型文件');
  });

  it('opens historical preview links through the current prototype runtime origin', () => {
    const source = readVersionManagerSource();

    expect(source).toContain('function resolvePrototypeVersionPreviewUrl(');
    expect(source).toContain('targetItem?.clientUrl || targetItem?.previewUrl');
    expect(source).toContain('new URL(value, runtimeOrigin).toString()');
    expect(source).toContain("window.open(resolvePrototypeVersionPreviewUrl(item, data.prototypeUrl), '_blank', 'noopener,noreferrer')");
  });

  it('generates version notes from an AI icon inside the prototype commit input', () => {
    const source = readVersionManagerSource();
    const localTabStart = source.indexOf('<TabsContent value="local"');
    const onlineTabStart = source.indexOf('<TabsContent value="online"');
    const localTabSource = source.slice(localTabStart, onlineTabStart);

    expect(source).toContain("import { generateGitCommitMessage } from '../domains/ai-generation/gitCommitMessageGeneration';");
    expect(source).toContain('const handleGenerateCommitMessage = async () =>');
    expect(source).toContain('await generateGitCommitMessage({');
    expect(source).toContain("scope: 'prototype'");
    expect(source).toContain('setCommitMessage(generatedMessage);');
    expect(source).toContain("toast.error(error instanceof Error ? error.message : 'AI 生成版本记录失败');");
    expect(source).toContain("import { Textarea } from '@/components/ui/textarea';");
    expect(localTabSource).toContain('<Textarea');
    expect(localTabSource).not.toContain('<Input');
    expect(localTabSource).toContain('AI生成版本记录');
    expect(localTabSource).toContain('<Sparkles');
    expect(localTabSource).toContain("generatingCommitMessage ? <Loader2 className=\"h-3.5 w-3.5 animate-spin\" /> : <Sparkles");
    expect(localTabSource).toContain('<TooltipProvider>');
    expect(localTabSource).toContain('<TooltipTrigger asChild>');
    expect(localTabSource).toContain('<TooltipContent side="top">AI生成版本记录</TooltipContent>');
    expect(localTabSource).not.toContain('title="AI生成版本记录"');
    expect(localTabSource).not.toContain('PromptActionButton');
    expect(localTabSource).not.toContain('复制给 AI 处理');
    expect(source).not.toContain('function buildPrototypeCommitMessageSuggestion(');
  });

  it('keeps prototype local tab minimal until repository data is actionable', () => {
    const source = readVersionManagerSource();
    const localTabStart = source.indexOf('<TabsContent value="local"');
    const onlineTabStart = source.indexOf('<TabsContent value="online"');
    const localTabSource = source.slice(localTabStart, onlineTabStart);

    expect(source).toContain("const [loadedHistoryPath, setLoadedHistoryPath] = useState('');");
    expect(source).toContain('const hasLoadedLocalHistory = loadedHistoryPath === targetPath;');
    expect(source).toContain('const showLocalSetupHint = hasLoadedLocalHistory && Boolean(gitUnavailableState);');
    expect(source).toContain('const showLocalStatus = hasLoadedLocalHistory && !showLocalSetupHint && Boolean(item && targetPath);');
    expect(source).toContain('const showLocalCommit = showLocalStatus && hasUncommitted;');
    expect(source).toContain('const showLocalHistory = showLocalStatus && commits.length > 0;');
    expect(localTabSource).toContain('{showLocalSetupHint ? renderSetupHint(gitUnavailableState?.description || \'\') : null}');
    expect(localTabSource).toContain('{showLocalStatus ? (');
    expect(localTabSource).toContain('{showLocalCommit ? (');
    expect(localTabSource).toContain('{showLocalHistory ? (');
    expect(localTabSource).not.toContain('暂无版本历史');
  });

  it('keeps prototype online tab minimal until remote sync is actionable', () => {
    const source = readVersionManagerSource();
    const onlineTabStart = source.indexOf('<TabsContent value="online"');
    const onlineTabSource = source.slice(onlineTabStart);

    expect(source).toContain('const hasLoadedWorkspaceStatus = Boolean(workspaceStatus);');
    expect(source).toContain('const showOnlineSetupHint = hasLoadedWorkspaceStatus && (!isRepositoryReady || !hasConfiguredRemote);');
    expect(source).toContain('const showOnlineContent = hasLoadedWorkspaceStatus && !showOnlineSetupHint;');
    expect(source).toContain('const showOnlineIncoming = showOnlineContent && incomingTotal > 0;');
    expect(source).toContain('const showOnlineOutgoing = showOnlineContent && outgoingTotal > 0;');
    expect(onlineTabSource).toContain('{showOnlineSetupHint ? renderSetupHint(onlineSetupDescription) : null}');
    expect(onlineTabSource).toContain('{showOnlineContent ? (');
    expect(onlineTabSource).toContain('{showOnlineIncoming ? (');
    expect(onlineTabSource).toContain('{showOnlineOutgoing ? (');
    expect(onlineTabSource).not.toContain("getPrototypeOnlineChangeText(incomingTotal, '当前原型有线上更新', '当前原型暂无线上更新')");
    expect(onlineTabSource).not.toContain("getPrototypeOnlineChangeText(outgoingTotal, '当前原型待同步到在线', '当前原型暂无待同步内容')");
  });
});
