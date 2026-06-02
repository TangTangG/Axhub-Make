import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readContentPanelSource() {
  return readFileSync(resolve(__dirname, './ContentPanel.tsx'), 'utf8');
}

describe('ContentPanel make client project setup source', () => {
  it('does not expose metadata sync as a separate setup progress step', () => {
    const source = readContentPanelSource();
    const setupPhasesSource = source.slice(
      source.indexOf('const MAKE_CLIENT_SETUP_PHASES = ['),
      source.indexOf('] as const;', source.indexOf('const MAKE_CLIENT_SETUP_PHASES = [')),
    );

    expect(setupPhasesSource).not.toContain("key: 'metadata'");
    expect(setupPhasesSource).not.toContain('同步 metadata');
  });

  it('uses an overall pending state for blank project creation instead of pinning it to template download', () => {
    const source = readContentPanelSource();
    const dialogSource = source.slice(
      source.indexOf('function ProjectSetupDialog'),
      source.indexOf('export default function ContentPanel'),
    );

    expect(source).toContain("const MAKE_CLIENT_SETUP_PENDING_LABEL = '创建并启动项目';");
    expect(dialogSource).toContain("setRunningPhase('creating')");
    expect(dialogSource).not.toContain("setRunningPhase('template')");
    expect(dialogSource).toContain('MAKE_CLIENT_SETUP_PENDING_LABEL');
    expect(dialogSource).toContain('MAKE_CLIENT_SETUP_PENDING_DESCRIPTION');
  });

  it('keeps blank project creation failures as a single inline error with details', () => {
    const source = readContentPanelSource();
    const dialogSource = source.slice(
      source.indexOf('function ProjectSetupDialog'),
      source.indexOf('export default function ContentPanel'),
    );

    expect(source).toContain("const MAKE_CLIENT_SETUP_FAILED_LABEL = '创建项目失败';");
    expect(dialogSource).toContain('const [failedMessage, setFailedMessage]');
    expect(dialogSource).toContain('const [failedDiagnostic, setFailedDiagnostic]');
    expect(dialogSource).toContain('setFailedMessage(errorMessage);');
    expect(dialogSource).toContain('setFailedDiagnostic(buildMakeClientSetupAiPrompt');
    expect(dialogSource).toContain('const fallbackDiagnostic = buildMakeClientSetupAiPrompt');
    expect(dialogSource).toContain('toast.error(errorMessage);');
    expect(dialogSource).toContain('MAKE_CLIENT_SETUP_FAILED_LABEL');
    expect(dialogSource).toContain('(pendingCreate || failedMessage)');
    expect(dialogSource).toContain('failedMessage || MAKE_CLIENT_SETUP_FAILED_DESCRIPTION');
    expect(dialogSource).toContain('复制给 AI 处理');
    expect(dialogSource).toContain('{failedMessage ? (');
    expect(dialogSource).toContain('const diagnosticPrompt = failedDiagnostic || fallbackDiagnostic;');
    expect(dialogSource).toContain('await copyToClipboard(diagnosticPrompt)');
    expect(dialogSource).not.toContain('{failedDiagnostic ? (');
    expect(dialogSource).not.toContain('MAKE_CLIENT_SETUP_PHASES.map((phase)');
  });

  it('preserves an explicitly blank project name when creating a blank make client project', () => {
    const source = readContentPanelSource();
    const handlerSource = source.slice(
      source.indexOf('const handleCreateBlankProject = async () => {'),
      source.indexOf('return (', source.indexOf('const handleCreateBlankProject = async () => {')),
    );

    expect(handlerSource).toContain('projectName: normalizedProjectName,');
    expect(handlerSource).not.toContain('projectName: normalizedProjectName || normalizedFolder');
  });

  it('forces the project setup dialog open without skipping the create/select guide', () => {
    const source = readContentPanelSource();
    const dialogPropsSource = source.slice(
      source.indexOf('interface ProjectSetupDialogProps'),
      source.indexOf('function ProjectSetupDialog'),
    );
    const dialogRenderSource = source.slice(
      source.indexOf('<ProjectSetupDialog'),
      source.indexOf('/>', source.indexOf('<ProjectSetupDialog')),
    );

    expect(dialogPropsSource).toContain('dismissDisabled?: boolean;');
    expect(dialogRenderSource).toContain('dismissDisabled={projectSetupRequired}');
    expect(dialogRenderSource).not.toContain('forceBlankProjectCreation={projectSetupRequired}');
  });

  it('keeps the forced project setup dialog non-dismissible while still showing project setup options', () => {
    const source = readContentPanelSource();
    const dialogSource = source.slice(
      source.indexOf('function ProjectSetupDialog'),
      source.indexOf('export default function ContentPanel'),
    );

    expect(dialogSource).toContain('if (dismissDisabled && !nextOpen && !allowCloseRef.current) {');
    expect(dialogSource).toContain('!forceBlankProjectCreation && setupMode === \'menu\'');
    expect(dialogSource).toContain('!dismissDisabled ? (');
  });

  it('allows successful required project setup to close the setup dialog', () => {
    const source = readContentPanelSource();
    const dialogSource = source.slice(
      source.indexOf('function ProjectSetupDialog'),
      source.indexOf('export default function ContentPanel'),
    );
    const renderSource = source.slice(
      source.indexOf('<ProjectSetupDialog'),
      source.indexOf('/>', source.indexOf('<ProjectSetupDialog')),
    );

    expect(dialogSource).toContain('onSetupComplete');
    expect(dialogSource).toContain('onSetupComplete();');
    expect(renderSource).toContain('onSetupComplete={() => {');
    expect(renderSource).toContain('setProjectSetupOpen(false);');
    expect(renderSource).toContain('setProjectSwitcherMenuOpen(false);');
  });

  it('switches to the prototype tab after an existing or blank project setup succeeds', () => {
    const source = readContentPanelSource();
    const dialogSource = source.slice(
      source.indexOf('function ProjectSetupDialog'),
      source.indexOf('export default function ContentPanel'),
    );
    const renderSource = source.slice(
      source.indexOf('<ProjectSetupDialog'),
      source.indexOf('/>', source.indexOf('<ProjectSetupDialog')),
    );

    expect(dialogSource.match(/onSetupComplete\(\);/gu)).toHaveLength(2);
    expect(renderSource).toContain("onTabChange('prototype');");
  });

  it('does not show blue borders or focus rings on setup option buttons', () => {
    const source = readContentPanelSource();
    const menuSource = source.slice(
      source.indexOf('{!forceBlankProjectCreation && setupMode === \'menu\' ? ('),
      source.indexOf('</div>', source.indexOf('选择已有项目')),
    );

    expect(menuSource).not.toContain('border-primary');
    expect(menuSource).toContain('focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 active:outline-none');
  });

  it('uses beginner-friendly project setup copy and exposes template download links', () => {
    const source = readContentPanelSource();
    const menuSource = source.slice(
      source.indexOf('{!forceBlankProjectCreation && setupMode === \'menu\' ? ('),
      source.indexOf('</div>', source.indexOf('下载客户端包')),
    );
    const existingOptionStart = source.indexOf('data-project-setup-option="existing"');
    const existingOptionSource = source.slice(
      existingOptionStart,
      source.indexOf('</div>', existingOptionStart),
    );

    expect(source).toContain("import { makeClientTemplateMirrorDownloadUrl, makeClientTemplatePrimaryDownloadUrl } from '../../../common/makeClientTemplate';");
    expect(source).toContain('const primaryTemplateDownloadUrl = makeClientTemplatePrimaryDownloadUrl();');
    expect(source).toContain('const mirrorTemplateDownloadUrl = makeClientTemplateMirrorDownloadUrl();');
    expect(source).toContain('function stopProjectSetupLinkPropagation(event: React.SyntheticEvent)');
    expect(source).toContain('data-project-setup-option="existing"');
    expect(menuSource).toContain('快速新建项目');
    expect(menuSource).toContain('从空白一键创建项目，系统会自动准备好基础项目，新手优先使用，不需要自己下载。');
    expect(menuSource).toContain('选择已有项目');
    expect(menuSource).toContain('已有项目可直接选择文件夹导入；没有客户端包可先');
    expect(menuSource).toContain('下载客户端包');
    expect(menuSource).toContain('打不开可用');
    expect(menuSource).toContain('备用下载');
    expect(menuSource).not.toContain('<br />');
    expect(existingOptionSource).toContain('下载客户端包');
    expect(existingOptionSource).toContain('备用下载');
    expect(existingOptionSource).not.toContain('主源下载');
    expect(existingOptionSource).not.toContain('主源下载地址');
    expect(existingOptionSource).not.toContain('备用源下载地址');
    expect(existingOptionSource).toContain('primaryTemplateDownloadUrl');
    expect(existingOptionSource).toContain('mirrorTemplateDownloadUrl');
    expect(existingOptionSource.match(/onClick=\{stopProjectSetupLinkPropagation\}/gu)).toHaveLength(2);
    expect(existingOptionSource.match(/onKeyDown=\{stopProjectSetupLinkPropagation\}/gu)).toHaveLength(2);
    expect(menuSource).not.toContain('仓库');
    expect(menuSource).not.toContain('开发服务');
  });

  it('uses the in-app folder browser for project setup paths without exposing folder creation', () => {
    const source = readContentPanelSource();
    const browserSource = source.slice(
      source.indexOf('function FolderBrowserDialog'),
      source.indexOf('interface ProjectSetupDialogProps'),
    );
    const dialogSource = source.slice(
      source.indexOf('function ProjectSetupDialog'),
      source.indexOf('export default function ContentPanel'),
    );

    expect(dialogSource).toContain('FolderBrowserDialog');
    expect(browserSource).toContain('browseProjectFolders');
    expect(browserSource).not.toContain('createProjectFolder');
    expect(browserSource).not.toContain('新建文件夹名称');
    expect(browserSource).not.toContain('新建');
    expect(dialogSource).toContain('onAddProject(selectedPath)');
    expect(dialogSource).not.toContain('onSelectParentFolder');
  });

  it('requests ASCII folder name suggestions until the user manually edits the folder name', () => {
    const source = readContentPanelSource();
    const dialogSource = source.slice(
      source.indexOf('function ProjectSetupDialog'),
      source.indexOf('export default function ContentPanel'),
    );

    expect(source).toContain('async function suggestProjectFolderName');
    expect(dialogSource).toContain('void refreshSuggestedFolderName(projectName, parentRoot);');
    expect(dialogSource).toContain('if (manualFolderName && !options.force) {');
    expect(dialogSource).toContain('setManualFolderName(true);');
    expect(source).toContain("fetch('/api/projects/make/folder-name-suggestion'");
  });

  it('remembers the last selected blank project parent directory in browser storage', () => {
    const source = readContentPanelSource();
    const dialogSource = source.slice(
      source.indexOf('function ProjectSetupDialog'),
      source.indexOf('export default function ContentPanel'),
    );

    expect(source).toContain("const MAKE_CLIENT_LAST_PARENT_ROOT_STORAGE_KEY = 'axhub.make.lastProjectParentRoot';");
    expect(source).toContain('function readStoredMakeClientParentRoot()');
    expect(source).toContain('function writeStoredMakeClientParentRoot(parentRoot: string)');
    expect(dialogSource).toContain('useState(readStoredMakeClientParentRoot)');
    expect(dialogSource).toContain('writeStoredMakeClientParentRoot(selectedPath);');
    expect(source).toContain('window.localStorage.getItem(MAKE_CLIENT_LAST_PARENT_ROOT_STORAGE_KEY)');
    expect(source).toContain('window.localStorage.setItem(MAKE_CLIENT_LAST_PARENT_ROOT_STORAGE_KEY, normalizedParentRoot)');
  });

  it('resets blank project name and folder name while keeping the remembered parent directory', () => {
    const source = readContentPanelSource();
    const dialogSource = source.slice(
      source.indexOf('function ProjectSetupDialog'),
      source.indexOf('export default function ContentPanel'),
    );

    expect(source).toContain("const DEFAULT_MAKE_CLIENT_PROJECT_NAME = '新建 Make 项目';");
    expect(dialogSource).toContain('function resetBlankProjectFields()');
    expect(dialogSource).toContain('setProjectName(DEFAULT_MAKE_CLIENT_PROJECT_NAME);');
    expect(dialogSource).toContain('setManualFolderName(false);');
    expect(dialogSource).toContain('void refreshSuggestedFolderName(DEFAULT_MAKE_CLIENT_PROJECT_NAME, parentRoot, { force: true });');
    expect(dialogSource).toContain('resetBlankProjectFields();');
    expect(dialogSource).not.toContain('setParentRoot(readStoredMakeClientParentRoot())');
  });
});

describe('ContentPanel prototype canvas entry source', () => {
  it('removes the per-prototype canvas row action after moving canvas to the top toolbar', () => {
    const source = readContentPanelSource();

    expect(source).not.toContain('const renderPrototypeCanvasEntry = (item: ItemData) => (');
    expect(source).not.toContain("void Promise.resolve(onPrototypeViewSelect(item, 'canvas'));");
    expect(source).not.toContain('<TooltipContent>进入画布</TooltipContent>');

    const itemActionsSource = source.slice(
      source.indexOf('const renderItemActions ='),
      source.indexOf('const renderFolderActions ='),
    );

    expect(itemActionsSource).not.toContain('renderPrototypeCanvasEntry(item)');
  });
});

describe('ContentPanel resource folder selection source', () => {
  it('selects resource folders separately from file items', () => {
    const source = readContentPanelSource();

    expect(source).toContain('selectedFolder?: SelectedResourceFolder | null;');
    expect(source).toContain('onFolderClick?: (folder: SidebarTreeNode) => void;');
    expect(source).toContain('const isFolderSelected =');
    expect(source).toContain("dataTab === 'docs'");
    expect(source).toContain('onFolderClick?.(node);');
    expect(source).toContain('selected={isFolderSelected || isSelected}');
  });

  it('toggles resource folders from the row without reselecting them while collapsing', () => {
    const source = readContentPanelSource();
    const folderClickSource = source.slice(
      source.indexOf("if (dataTab === 'docs') {"),
      source.indexOf("if (item) {", source.indexOf("if (dataTab === 'docs') {")),
    );

    expect(folderClickSource).toContain('const isCollapsingFolder = isExpanded;');
    expect(folderClickSource).toContain('toggleFolder(node.id);');
    expect(folderClickSource).toContain('if (!isCollapsingFolder) {');
    expect(folderClickSource).toContain('onFolderClick?.(node);');
  });

  it('keeps folders collapsed by default when a tree first loads', () => {
    const source = readContentPanelSource();

    expect(source).toContain('knownFolderIdsRef.current = new Set(collectFolderIds(tree));');
    expect(source).not.toContain('newIds.forEach((id) => next.add(id));');
  });
});

describe('ContentPanel resource drag and drop source', () => {
  it('keeps sidebar tree reordering separate from file upload drops', () => {
    const source = readContentPanelSource();
    const fileDropZoneSource = source.slice(
      source.indexOf('className="relative flex-1 min-h-0"'),
      source.indexOf('<ScrollArea className="h-full p-2'),
    );
    const treeDragSource = source.slice(
      source.indexOf('onDragStart={(e) => {', source.indexOf('const renderTreeNodes =')),
      source.indexOf('setDraggingNodeId(node.id);', source.indexOf('const renderTreeNodes =')),
    );

    expect(source).toContain("const SIDEBAR_TREE_DRAG_MIME = 'application/x-axhub-sidebar-tree-node';");
    expect(source).toContain('function isSidebarTreeDragEvent');
    expect(treeDragSource).toContain('e.dataTransfer.setData(SIDEBAR_TREE_DRAG_MIME, node.id);');
    expect(fileDropZoneSource).toContain('if (isSidebarTreeDragEvent(event)) return;');
  });
});

describe('ContentPanel prototype page children source', () => {
  it('derives page rows from prototype item pages without persisting them into the sidebar tree', () => {
    const source = readContentPanelSource();

    expect(source).toContain('selectedPrototypePageId?: string | null;');
    expect(source).toContain('onPrototypePageSelect: (item: ItemData, pageId: string) => void | Promise<void>;');
    expect(source).toContain("selectedVariant?: 'filled' | 'subtle';");
    expect(source).toContain('const getPrototypePageMatches = (item: ItemData)');
    expect(source).toContain('item.pages');
    expect(source).toContain('page.title');
    expect(source).toContain('page.id');
    expect(source).toContain('renderPrototypePageRows(item, depth + 1)');
    expect(source).toContain('buildPrototypePageCanvasPayload(item, page)');
    expect(source).toContain("draggable={true}");
    expect(source).toContain('actions={null}');
    expect(source).toContain('onPrototypePageSelect(item, page.id)');
    expect(source).not.toContain('onTreePersist(page');
  });

  it('drags prototype page rows as normal prototype embeds with only page-specific URLs', () => {
    const source = readContentPanelSource();
    const helperSource = source.slice(
      source.indexOf('function resolvePrototypePageEmbedDisplayName'),
      source.indexOf('const renderItemActions ='),
    );
    const payloadSource = source.slice(
      source.indexOf('function buildPrototypePageCanvasPayload'),
      source.indexOf('interface ProjectSetupDialogProps'),
    );

    expect(helperSource).toContain("resourceType: 'prototype'");
    expect(helperSource).toContain('resourceId');
    expect(helperSource).toContain("previewKind: 'web'");
    expect(helperSource).toContain("embedViewMode: 'link'");
    expect(helperSource).toContain('displayName: resolvePrototypePageEmbedDisplayName(item, page.title)');
    expect(helperSource).toContain('return `${trimmedPageTitle} - ${prototypeTitle}`;');
    expect(helperSource).toContain('buildPrototypePagePreviewUrl(item, page.id)');
    expect(helperSource).toContain('buildResourceDeepLinkUrl({');
    expect(helperSource).toContain('pageId: page.id');
    expect(payloadSource).not.toContain('pageId,');
    expect(payloadSource).not.toContain('pageTitle:');
  });

  it('uses a text-only selected state for prototype pages so parent and first page backgrounds do not stack', () => {
    const source = readContentPanelSource();
    const pageRowsSource = source.slice(
      source.indexOf('const renderPrototypePageRows ='),
      source.indexOf('const renderTreeNodes ='),
    );

    expect(pageRowsSource).toContain('selectedVariant="subtle"');
    expect(source).toContain("selectedVariant === 'subtle'");
    expect(source).toContain("? 'text-primary font-semibold'");
    expect(source).not.toContain('before:bg-primary');
    expect(pageRowsSource).not.toContain("selectedVariant=\"filled\"");
  });

  it('only renders prototype page rows for the active prototype item', () => {
    const source = readContentPanelSource();
    const treeNodeRenderSource = source.slice(
      source.indexOf('const isSelected = Boolean(item && selectedItem?.name === item.name);'),
      source.indexOf('const renderResourceFolderRows ='),
    );

    expect(treeNodeRenderSource).toContain('!isFolder && item && isSelected');
    expect(treeNodeRenderSource).toContain('renderPrototypePageRows(item, depth + 1)');
  });
});

describe('ContentPanel LAN share source', () => {
  it('hides the whole LAN share group when the active project disallows LAN access', () => {
    const source = readContentPanelSource();
    const itemActionsSource = source.slice(
      source.indexOf('const renderItemActions ='),
      source.indexOf('const renderFolderActions ='),
    );
    const guardIndex = itemActionsSource.indexOf('const showLANShareGroup = lanAccessAllowed && Boolean(lanShareUrl);');
    const lanGroupIndex = itemActionsSource.indexOf('{showLANShareGroup ? (');
    const lanLabelIndex = itemActionsSource.indexOf('局域网链接');
    const qrIndex = itemActionsSource.indexOf('<QRCode value={lanShareUrl}');

    expect(source).toContain('lanAccessAllowed?: boolean;');
    expect(source).toContain('lanAccessAllowed = true,');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(lanGroupIndex).toBeGreaterThan(guardIndex);
    expect(lanLabelIndex).toBeGreaterThan(lanGroupIndex);
    expect(qrIndex).toBeGreaterThan(lanGroupIndex);
  });
});

describe('ContentPanel project switcher source', () => {
  it('uses middle-ellipsized display paths while keeping the full project root in the tooltip', () => {
    const source = readContentPanelSource();
    const projectSwitcherSource = source.slice(
      source.indexOf('{projects.length > 0 ? projects.map((project) => {'),
      source.indexOf(') : (', source.indexOf('{projects.length > 0 ? projects.map((project) => {')),
    );

    expect(source).toContain("import { formatProjectRootDisplayPath } from './projectSwitcherPathDisplay';");
    expect(projectSwitcherSource).toContain('const displayRoot = formatProjectRootDisplayPath(project.root);');
    expect(projectSwitcherSource).toContain('title={project.root}');
    expect(projectSwitcherSource).toContain('{displayRoot}');
    expect(projectSwitcherSource).not.toContain('>{project.root}</span>');
  });

  it('shows a hover-only project delete action that does not switch projects', () => {
    const source = readContentPanelSource();
    const projectSwitcherSource = source.slice(
      source.indexOf('{projects.length > 0 ? projects.map((project) => {'),
      source.indexOf(') : (', source.indexOf('{projects.length > 0 ? projects.map((project) => {')),
    );

    expect(source).toContain('onProjectDelete: (projectId: string) => void | Promise<void>;');
    expect(source).toContain('const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);');
    expect(source).toContain('const handleProjectDelete = async (projectId: string) => {');
    expect(projectSwitcherSource).toContain('group/project-item');
    expect(projectSwitcherSource).toContain('opacity-0 group-hover/project-item:opacity-100 focus-visible:opacity-100');
    expect(projectSwitcherSource).toContain('aria-label={`从列表移除 ${project.name || UNTITLED_PROJECT_LABEL}`}');
    expect(projectSwitcherSource).toContain('<Trash2 className="h-3.5 w-3.5" />');
    expect(projectSwitcherSource).toContain('event.stopPropagation();');
    expect(projectSwitcherSource).toContain('void handleProjectDelete(project.id);');
    expect(projectSwitcherSource).toContain('const deleting = project.id === deletingProjectId;');
  });

  it('uses the selected project background without a trailing check icon', () => {
    const source = readContentPanelSource();
    const projectSwitcherSource = source.slice(
      source.indexOf('{projects.length > 0 ? projects.map((project) => {'),
      source.indexOf(') : (', source.indexOf('{projects.length > 0 ? projects.map((project) => {')),
    );

    const deleteButtonIndex = projectSwitcherSource.indexOf('aria-label={`从列表移除 ${project.name || UNTITLED_PROJECT_LABEL}`}');

    expect(source).toContain("const UNTITLED_PROJECT_LABEL = '未命名项目';");
    expect(projectSwitcherSource).toContain('{project.name || UNTITLED_PROJECT_LABEL}');
    expect(projectSwitcherSource).toContain("active && 'bg-accent text-accent-foreground'");
    expect(deleteButtonIndex).toBeGreaterThan(-1);
    expect(projectSwitcherSource).not.toContain('<Check className="h-3.5 w-3.5 shrink-0 text-primary" />');
  });

  it('shows local runtime state and a stop action for running projects', () => {
    const source = readContentPanelSource();
    const projectSwitcherSource = source.slice(
      source.indexOf('{projects.length > 0 ? projects.map((project) => {'),
      source.indexOf(') : (', source.indexOf('{projects.length > 0 ? projects.map((project) => {')),
    );

    expect(source).toContain('onProjectStop: (projectId: string) => void | Promise<void>;');
    expect(source).toContain('const [stoppingProjectId, setStoppingProjectId] = useState<string | null>(null);');
    expect(source).toContain('const handleProjectStop = async (projectId: string) => {');
    expect(source).toContain('w-[360px]');
    expect(projectSwitcherSource).toContain('const running = project.runtimeStatus?.running === true;');
    expect(projectSwitcherSource).toContain('运行中');
    expect(projectSwitcherSource).toContain('aria-label={`终止 ${project.name || UNTITLED_PROJECT_LABEL}`}');
    expect(projectSwitcherSource).toContain('className="h-7 w-7 shrink-0 opacity-0 group-hover/project-item:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"');
    expect(projectSwitcherSource).toContain('<Square className="h-3.5 w-3.5" />');
    expect(projectSwitcherSource).toContain('void handleProjectStop(project.id);');
    expect(projectSwitcherSource).toContain('event.stopPropagation();');
  });
});

describe('ContentPanel default design source', () => {
  it('restores the theme row action for setting the default design', () => {
    const source = readContentPanelSource();

    expect(source).toContain('defaultThemeName?: string | null;');
    expect(source).toContain('onSetDefaultTheme?: (themeName: string) => void | Promise<void>;');
    expect(source).toContain("const isThemeItem = dataTab === 'themes';");
    expect(source).toContain('const isDefaultDesign = isThemeItem && defaultThemeName === item.name;');
    expect(source).toContain('onSetDefaultTheme(item.name)');
    expect(source).toContain("isDefaultDesign ? '取消默认设计' : '设为默认设计'");
    expect(source).not.toContain('设为默认主题');
  });

  it('does not show folder-open or generate-design actions on design rows', () => {
    const source = readContentPanelSource();
    const itemActionsSource = source.slice(
      source.indexOf('const renderItemActions ='),
      source.indexOf('const renderFolderActions ='),
    );

    expect(itemActionsSource).toContain("const showOpenResourceDirectoryAction = dataTab === 'docs';");
    expect(itemActionsSource).toContain('{showOpenResourceDirectoryAction ? (');
    expect(itemActionsSource).toContain('{isPrototypeItem && onGenerateThemeFromPrototype ? (');
    expect(itemActionsSource).not.toContain('{isResourceTreeItem ? (');
    expect(itemActionsSource).not.toContain('{!isDocItem && onGenerateThemeFromPrototype ? (');
  });
});

describe('ContentPanel design ZIP export source', () => {
  it('restores the design row ZIP export action through explicit local path metadata', () => {
    const source = readContentPanelSource();
    const itemActionsSource = source.slice(
      source.indexOf('const renderItemActions ='),
      source.indexOf('const renderFolderActions ='),
    );

    expect(source).toContain('handleDownloadThemeZip: (item: ThemeResourceItem) => void | Promise<void>;');
    expect(itemActionsSource).toContain("const canDownloadDesignZip = isThemeItem && showLocalPathActions && Boolean(handleDownloadThemeZip);");
    expect(itemActionsSource).toContain('{canDownloadDesignZip ? (');
    expect(itemActionsSource).toContain('handleDownloadThemeZip?.(item as ThemeResourceItem)');
    expect(itemActionsSource).toContain('导出 ZIP');
  });
});

describe('ContentPanel prototype ZIP download source', () => {
  it('restores the prototype row ZIP download action without restoring HTML export', () => {
    const source = readContentPanelSource();
    const itemActionsSource = source.slice(
      source.indexOf('const renderItemActions ='),
      source.indexOf('const renderFolderActions ='),
    );

    expect(source).toContain('handleDownloadItemSource: (item: ItemData) => void | Promise<void>;');
    expect(itemActionsSource).toContain('const canDownloadPrototypeZip = isPrototypeItem && showLocalPathActions && Boolean(handleDownloadItemSource);');
    expect(itemActionsSource).toContain('{canDownloadPrototypeZip ? (');
    expect(itemActionsSource).toContain('handleDownloadItemSource(item)');
    expect(itemActionsSource).toContain('下载 ZIP');
    expect(itemActionsSource).not.toContain('下载 HTML');
    expect(itemActionsSource).not.toContain('导出 HTML');
  });
});

describe('NewSidebar prototype ZIP download source', () => {
  it('passes the resolved prototype ZIP download handler into ContentPanel', () => {
    const source = readFileSync(resolve(__dirname, './NewSidebar.tsx'), 'utf8');
    const propsSource = source.slice(
      source.indexOf('const {'),
      source.indexOf('} = resolveNewSidebarProps(rawProps);'),
    );
    const contentPanelPropsSource = source.slice(
      source.indexOf('<ContentPanel'),
      source.indexOf('loading={loading}'),
    );

    expect(propsSource).toContain('handleDownloadItemSource,');
    expect(contentPanelPropsSource).toContain('handleDownloadItemSource={handleDownloadItemSource}');
  });
});

describe('NewSidebar design ZIP export source', () => {
  it('keeps design local paths while adapting theme resources and passes ZIP export through', () => {
    const source = readFileSync(resolve(__dirname, './NewSidebar.tsx'), 'utf8');
    const themeAdapterSource = source.slice(
      source.indexOf('const themesAsItemData: ItemData[] = themes.map'),
      source.indexOf('const currentItems ='),
    );

    expect(themeAdapterSource).toContain('filePath: theme.path');
    expect(themeAdapterSource).toContain('absoluteFilePath: theme.absoluteFilePath');
    expect(source).toContain('handleDownloadThemeZip={(theme) => {');
    expect(source).toContain('const themeItem = themes.find((item) => item.name === theme.name) || theme as ThemeResourceItem;');
    expect(source).toContain('handleDownloadThemeZip(themeItem)');
  });
});

describe('ContentPanel settings menu source', () => {
  it('opens project settings from the dropdown select event after the menu closes', () => {
    const source = readContentPanelSource();
    const menuSource = source.slice(
      source.indexOf('<DropdownMenuContent align="start"'),
      source.indexOf('<DropdownMenuItem className="h-7 gap-2 text-sm" onClick={onToggleTheme}>'),
    );

    expect(source).toContain('const handleSettingsMenuSelect = useCallback(() => {');
    expect(source).toContain('window.setTimeout(() => {');
    expect(source).toContain('onSettingsClick();');
    expect(menuSource).toContain('onSelect={handleSettingsMenuSelect}');
    expect(menuSource).not.toContain('onClick={onSettingsClick}');
  });
});
