import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readPanelSource() {
  return readFileSync(resolve(__dirname, './VersionCollaborationPanel.tsx'), 'utf8');
}

function readDrawerSource() {
  return readFileSync(resolve(__dirname, './WorkspaceVersionCollaborationDrawer.tsx'), 'utf8');
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
});
