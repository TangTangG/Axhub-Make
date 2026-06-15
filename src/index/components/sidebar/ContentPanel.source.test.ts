import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readContentPanelSource() {
  return readFileSync(resolve(__dirname, './ContentPanel.tsx'), 'utf8');
}

describe('ContentPanel make client project setup source', () => {
  it('renders the AI open dropdown in the sidebar header chrome', () => {
    const source = readContentPanelSource();
    const headerSource = source.slice(
      source.indexOf('<div className="border-b border-border">'),
      source.indexOf('<div className="px-2 pb-2">'),
    );

    expect(source).toContain("import OpenInDropdown from './OpenInDropdown';");
    expect(source).toContain('const openInSelectedItem =');
    expect(headerSource).toContain('<OpenInDropdown');
    expect(headerSource).toContain('handleOpenProjectInIDE={handleOpenProjectInIDE}');
    expect(headerSource).toContain('webAgentPanelOpen={webAgentPanelOpen}');
    expect(headerSource).toContain('onCloseWebAgentPanel={onCloseWebAgentPanel}');
    expect(headerSource).not.toContain('variant="toolbar"');
  });

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
    expect(source).toContain("const MAKE_CLIENT_SETUP_PENDING_DESCRIPTION = '首次新建会下载模板、安装依赖并启动客户端，可能需要几分钟；后续建议复制已有项目，会快很多';");
    expect(dialogSource).toContain("setRunningPhase('creating')");
    expect(dialogSource).not.toContain("setRunningPhase('template')");
    expect(dialogSource).toContain('MAKE_CLIENT_SETUP_PENDING_LABEL');
    expect(dialogSource).toContain('MAKE_CLIENT_SETUP_PENDING_DESCRIPTION');
  });

  it('adds a copy-current-project setup mode only inside the project setup dialog when an active project exists', () => {
    const source = readContentPanelSource();
    const dialogPropsSource = source.slice(
      source.indexOf('interface ProjectSetupDialogProps'),
      source.indexOf('function ProjectSetupDialog'),
    );
    const dialogSource = source.slice(
      source.indexOf('function ProjectSetupDialog'),
      source.indexOf('export default function ContentPanel'),
    );
    const dialogRenderSource = source.slice(
      source.indexOf('<ProjectSetupDialog'),
      source.indexOf('/>', source.indexOf('<ProjectSetupDialog')),
    );

    expect(source).toContain("type ProjectSetupMode = 'menu' | 'blank' | 'copy';");
    expect(dialogPropsSource).toContain('hasActiveProject?: boolean;');
    expect(dialogPropsSource).toContain('copyingProject: boolean;');
    expect(dialogPropsSource).toContain('onCopyProject: (params: {');
    expect(dialogSource).toContain("hasActiveProject ? (");
    expect(dialogSource).toContain('复制当前项目');
    expect(dialogSource).toContain("setSetupMode('copy');");
    expect(dialogSource).toContain('handleCopyMakeProject');
    expect(dialogSource).toContain("setupMode === 'copy'");
    expect(dialogSource).toContain('复制并启动');
    expect(dialogRenderSource).toContain('hasActiveProject={Boolean(activeProjectId)}');
    expect(dialogRenderSource).toContain('copyingProject={isCopyingProject}');
    expect(dialogRenderSource).toContain('onCopyProject={handleCopyMakeProject}');
    expect(source).toContain("const [projectSetupInitialMode, setProjectSetupInitialMode] = useState<'menu'>('menu');");
    expect(source).not.toContain("setProjectSetupInitialMode('copy');");
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
    expect(dialogSource).toContain('const renderFailureMessage = () => failedMessage ? (');
    expect(dialogSource).toContain('{renderFailureMessage()}');
    expect(dialogSource).toContain('复制给 AI 处理');
    expect(dialogSource).toContain('const diagnosticPrompt = failedDiagnostic || fallbackDiagnostic;');
    expect(dialogSource).toContain('await copyToClipboard(diagnosticPrompt)');
    expect(dialogSource).not.toContain('{failedDiagnostic ? (');
    expect(dialogSource).not.toContain('MAKE_CLIENT_SETUP_PHASES.map((phase)');
  });

  it('builds a concise AI prompt for Make state directory permission failures', () => {
    const source = readContentPanelSource();

    expect(source).toContain('MAKE_STATE_DIR_NOT_WRITABLE');
    expect(source).toContain('本机项目列表保存失败');
    expect(source).toContain('Make 数据目录：');
    expect(source).toContain('请判断当前系统是 macOS、Windows 还是 Linux');
    expect(source).toContain('不要直接使用 sudo，除非用户确认');
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

  it('does not expose the legacy create prototype action from document resource menus', () => {
    const source = readContentPanelSource();
    const renderItemActionsSource = source.slice(
      source.indexOf('const renderItemActions ='),
      source.indexOf('const renderFolderActions ='),
    );

    expect(renderItemActionsSource).not.toContain('创建原型');
    expect(renderItemActionsSource).not.toContain('onCreatePrototypeFromDoc');
  });

  it('does not show an import prototype action in the prototype toolbar', () => {
    const source = readContentPanelSource();
    const prototypeToolbarSource = source.slice(
      source.indexOf("{!isSearchExpanded && activeTab === 'prototype' ? ("),
      source.indexOf("{!isSearchExpanded && activeTab === 'assets' ? ("),
    );

    expect(prototypeToolbarSource).toContain('新建原型');
    expect(prototypeToolbarSource).toContain('新建文件夹');
    expect(prototypeToolbarSource).not.toContain('aria-label="导入原型"');
    expect(prototypeToolbarSource).not.toContain('<TooltipContent>导入原型</TooltipContent>');
    expect(prototypeToolbarSource).not.toContain('onImportPrototype');
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

  it('switches to the prototype tab after an existing, blank, or copied project setup succeeds', () => {
    const source = readContentPanelSource();
    const dialogSource = source.slice(
      source.indexOf('function ProjectSetupDialog'),
      source.indexOf('export default function ContentPanel'),
    );
    const renderSource = source.slice(
      source.indexOf('<ProjectSetupDialog'),
      source.indexOf('/>', source.indexOf('<ProjectSetupDialog')),
    );

    expect(dialogSource.match(/onSetupComplete\(\);/gu)).toHaveLength(3);
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
    const menuStart = source.indexOf('{!forceBlankProjectCreation && setupMode === \'menu\' ? (');
    const menuSource = source.slice(
      menuStart,
      source.indexOf('</div>', source.indexOf('下载客户端包', menuStart)),
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
    expect(menuSource).toContain('新建项目');
    expect(menuSource).toContain('首次会自动下载模板并安装依赖，可能需要几分钟。复制当前项目速度最快。');
    expect(menuSource).not.toContain('快速新建项目');
    expect(menuSource).not.toContain('已有项目时，复制当前项目会快很多。');
    expect(menuSource).toContain('选择已有项目');
    expect(menuSource).toContain('已有项目可直接选择文件夹导入；没有客户端包可先');
    expect(menuSource).toContain('下载客户端包');
    expect(menuSource).toContain('打不开可用');
    expect(menuSource).toContain('备用下载');
    expect(menuSource).not.toContain('<br />');
    expect(existingOptionSource).toContain('下载客户端包');
    expect(existingOptionSource).toContain('备用下载');
    expect(existingOptionSource).not.toContain('<Download');
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

  it('does not show client version labels in project setup options', () => {
    const source = readContentPanelSource();
    const dialogSource = source.slice(
      source.indexOf('function ProjectSetupDialog'),
      source.indexOf('export default function ContentPanel'),
    );
    const dialogRenderSource = source.slice(
      source.indexOf('<ProjectSetupDialog'),
      source.indexOf('/>', source.indexOf('<ProjectSetupDialog')),
    );
    const menuSource = source.slice(
      source.indexOf('{!forceBlankProjectCreation && setupMode === \'menu\' ? ('),
      source.indexOf('{renderFailureMessage()}'),
    );

    expect(source).not.toContain('DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION');
    expect(source).not.toContain('formatProjectClientVersion');
    expect(dialogSource).not.toContain('currentClientVersion');
    expect(menuSource).not.toContain('客户端版本');
    expect(dialogRenderSource).not.toContain('currentClientVersion=');
  });

  it('does not render an empty project setup footer divider in menu mode', () => {
    const source = readContentPanelSource();
    const dialogSource = source.slice(
      source.indexOf('function ProjectSetupDialog'),
      source.indexOf('export default function ContentPanel'),
    );

    expect(dialogSource).toContain("const showProjectSetupFooter = setupMode === 'blank' || setupMode === 'copy' || !dismissDisabled;");
    expect(dialogSource).toContain('{showProjectSetupFooter ? (');
    expect(dialogSource).toContain('<DialogFooter className="border-t p-3 sm:justify-between sm:space-x-0">');
    expect(dialogSource).toContain('</DialogFooter>\n                    ) : null}');
  });

  it('offers assistant project setup as the second setup option with a concise directory-first prompt', () => {
    const source = readContentPanelSource();
    const menuSource = source.slice(
      source.indexOf('{!forceBlankProjectCreation && setupMode === \'menu\' ? ('),
      source.indexOf('{renderFailureMessage()}'),
    );
    const quickCreateIndex = menuSource.indexOf('新建项目');
    const aiCreateIndex = menuSource.indexOf('AI 执行');
    const existingIndex = menuSource.indexOf('选择已有项目');

    expect(source).toContain('function buildMakeClientAiCreatePrompt');
    expect(source).toContain('const handleRunAiCreatePrompt = async () => {');
    expect(source).toContain('primaryTemplateDownloadUrl');
    expect(source).toContain('mirrorTemplateDownloadUrl');
    expect(source).toContain('先和我确认项目目录');
    expect(source).toContain('确认前不要下载、解压、安装依赖或写文件');
    expect(source).toContain('当前目录、我指定的目录，或你根据当前 workspace 推荐的目录');
    expect(source).toContain('不要要求我再手动选择或导入目录');
    expect(source).toContain('不要让我再回到 Axhub Make 选择“已有项目”手动导入该目录');
    expect(source).toContain('你已经负责把客户端项目写入到可识别的项目目录中');
    expect(source).toContain('实际使用的模板下载链接');
    expect(source).toContain('请按当前系统选择命令写法，兼容 macOS、Windows 和 Linux');
    expect(source).toContain('复制提示词');
    expect(source).toContain('AI 执行');
    expect(source).not.toContain('已复制 AI 新建提示词');
    expect(source).not.toContain('完成后告诉我项目目录，并让我回到 Axhub Make 选择“已有项目”导入该目录');
    expect(source).not.toContain('你将作为');
    expect(source).not.toContain('UI/UX 设计架构师');
    expect(quickCreateIndex).toBeGreaterThanOrEqual(0);
    expect(aiCreateIndex).toBeGreaterThan(quickCreateIndex);
    expect(existingIndex).toBeGreaterThan(aiCreateIndex);
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

  it('keeps existing project add failures in the setup menu with a copy-to-AI action', () => {
    const source = readContentPanelSource();
    const selectExistingSource = source.slice(
      source.indexOf('const handleSelectExisting = async (selectedPath: string) => {'),
      source.indexOf('const openFolderBrowser =', source.indexOf('const handleSelectExisting = async (selectedPath: string) => {')),
    );

    expect(selectExistingSource).toContain('setFailedMessage(errorMessage);');
    expect(selectExistingSource).toContain('setFailedDiagnostic(buildMakeClientSetupAiPrompt');
    expect(selectExistingSource).toContain('setFolderBrowserOpen(false);');
    expect(selectExistingSource).not.toContain("setSetupMode('blank');");
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

describe('ContentPanel draft wording source', () => {
  it('uses draft wording for external canvas actions in the sidebar', () => {
    const source = readContentPanelSource();

    expect(source).toContain('添加到画布');
    expect(source).toContain('<TooltipContent>新建画布</TooltipContent>');
    expect(source).toContain('toast.success(`已添加「${payload.displayName}」到画布`)');
    expect(source).not.toContain('添加到草稿');
    expect(source).not.toContain('<TooltipContent>新建草稿</TooltipContent>');
    expect(source).not.toContain('toast.success(`已添加「${payload.displayName}」到草稿`)');
  });
});

describe('ContentPanel sidebar rename source', () => {
  it('uses the visible sidebar title as the item rename default value', () => {
    const source = readContentPanelSource();
    const renderItemActionsSource = source.slice(
      source.indexOf('const renderItemActions ='),
      source.indexOf('const renderFolderActions ='),
    );

    expect(renderItemActionsSource).toContain('startItemRename(itemNodeId, node?.title || item.displayName || item.name)');
    expect(renderItemActionsSource).not.toContain('startItemRename(itemNodeId, item.displayName || item.name)');
  });
});

describe('ContentPanel chrome styles source', () => {
  it('uses an explicit design-token border color for the sidebar header divider', () => {
    const source = readContentPanelSource();

    expect(source).toContain('<div className="border-b border-border">');
  });

  it('labels the top-left settings entry as settings instead of project settings', () => {
    const source = readContentPanelSource();
    const settingsItemIndex = source.indexOf('onSelect={handleSettingsMenuSelect}');
    const menuSource = source.slice(
      source.lastIndexOf('<DropdownMenuContent align="start"', settingsItemIndex),
      source.indexOf('<DropdownMenuSeparator />', settingsItemIndex),
    );

    expect(menuSource).toContain('<Settings className="h-3.5 w-3.5" />');
    expect(menuSource).toContain('设置');
    expect(menuSource).not.toContain('项目设置');
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

describe('ContentPanel document paste upload source', () => {
  it('registers image paste upload only while the document tab resource panel is active', () => {
    const source = readContentPanelSource();
    const pasteEffectSource = source.slice(
      source.indexOf('const handleDocumentPaste = (event: ClipboardEvent) => {'),
      source.indexOf("document.addEventListener('paste'", source.indexOf('const handleDocumentPaste = (event: ClipboardEvent) => {')),
    );

    expect(source).toContain("const [documentPasteTargetFolder, setDocumentPasteTargetFolder] = useState<string | null>(null);");
    expect(pasteEffectSource).toContain("if (activeTab !== 'document') {");
    expect(pasteEffectSource).toContain('if (!isDocumentPasteUploadActive(documentPanelRoot, documentPasteArmedRef.current)) {');
    expect(source).toContain("document.addEventListener('paste', handleDocumentPaste, true);");
    expect(source).toContain("document.removeEventListener('paste', handleDocumentPaste, true);");
  });

  it('keeps paste armed after clicking the document resource surface even when the active element is outside the panel', () => {
    const source = readContentPanelSource();
    const pasteEffectSource = source.slice(
      source.indexOf('const handleDocumentPaste = (event: ClipboardEvent) => {'),
      source.indexOf("document.addEventListener('paste'", source.indexOf('const handleDocumentPaste = (event: ClipboardEvent) => {')),
    );

    expect(source).toContain('const documentPasteArmedRef = useRef(false);');
    expect(source).toContain('const armDocumentPasteUpload = useCallback((targetFolder: string | null = null) => {');
    expect(pasteEffectSource).toContain('if (!isDocumentPasteUploadActive(documentPanelRoot, documentPasteArmedRef.current)) {');
    expect(pasteEffectSource).not.toContain('if (!documentPanelRoot.contains(document.activeElement)) {');
  });

  it('marks implicit paste focus surfaces so they do not render the global focus ring', () => {
    const source = readContentPanelSource();
    const emptyStateSource = source.slice(
      source.lastIndexOf('<div', source.indexOf('className="px-4 py-8 text-center text-[12px] leading-5 text-muted-foreground"')),
      source.indexOf('暂无内容，拖拽或上传文件到此处'),
    );
    const treeRootSource = source.slice(
      source.lastIndexOf('<div', source.indexOf('className="space-y-0.5 w-full min-w-0"')),
      source.indexOf('onDragOver={(e) => {', source.indexOf('className="space-y-0.5 w-full min-w-0"')),
    );
    const panelRootSource = source.slice(
      source.lastIndexOf('<div', source.indexOf('ref={documentPanelRootRef}')),
      source.indexOf('onDragEnter={(event) => {', source.indexOf('ref={documentPanelRootRef}')),
    );

    expect(emptyStateSource).toContain('data-document-paste-focus-surface');
    expect(treeRootSource).toContain('data-document-paste-focus-surface');
    expect(panelRootSource).toContain('data-document-paste-focus-surface');
  });

  it('lets editable and control targets keep their own paste behavior', () => {
    const source = readContentPanelSource();

    expect(source).toContain('function isDocumentPasteBlockedTarget(target: EventTarget | null): boolean');
    expect(source).toContain("element.closest('input, textarea, [contenteditable=\"true\"], [role=\"textbox\"], button, [data-document-paste-ignore]')");
    expect(source).toContain("const roleButton = element.closest('[role=\"button\"]');");
    expect(source).toContain("!roleButton.hasAttribute('data-document-paste-surface')");
    expect(source).toContain('data-document-paste-surface');
    expect(source).toContain('if (isDocumentPasteBlockedTarget(event.target)) {');
  });

  it('extracts image clipboard items, keeps original names when available, and uploads them to the active folder', () => {
    const source = readContentPanelSource();
    const pasteEffectSource = source.slice(
      source.indexOf('const handleDocumentPaste = (event: ClipboardEvent) => {'),
      source.indexOf("document.addEventListener('paste'", source.indexOf('const handleDocumentPaste = (event: ClipboardEvent) => {')),
    );
    const uploadSource = source.slice(
      source.indexOf('const uploadResourceFiles = useCallback(async (files: FileList | File[], options?: { targetFolder?: string | null }) => {'),
      source.indexOf('const resetSidebarHorizontalScroll = () => {'),
    );

    expect(source).toContain("import { getClipboardImageFiles } from '../../domains/shared/clipboardImages';");
    expect(source).not.toContain('function getClipboardImageFiles(event: ClipboardEvent): File[]');
    expect(source).not.toContain('function createPastedImageFile(blob: Blob): File');
    expect(source).not.toContain('function getPastedImageFileName(blob: Blob): string');
    expect(source).not.toContain('pasted-image-${timestamp}');
    expect(pasteEffectSource).toContain('const pastedFiles = getClipboardImageFiles(event);');
    expect(pasteEffectSource).toContain('if (pastedFiles.length === 0) {');
    expect(pasteEffectSource).toContain('event.preventDefault();');
    expect(pasteEffectSource).toContain('void uploadResourceFiles(pastedFiles, { targetFolder: documentPasteTargetFolder });');
    expect(uploadSource).toContain("formData.append('projectId', activeProjectId);");
    expect(uploadSource).toContain("formData.append('targetFolder', targetFolder);");
  });

  it('passes uploaded document resources back to the parent so the new file can be selected', () => {
    const source = readContentPanelSource();
    const uploadSource = source.slice(
      source.indexOf('const uploadResourceFiles = useCallback(async (files: FileList | File[], options?: { targetFolder?: string | null }) => {'),
      source.indexOf('const resetSidebarHorizontalScroll = () => {'),
    );

    expect(source).toContain("import type { SelectedResourceFolder, UploadedResourceFile } from '../../types/index-page.types';");
    expect(source).toContain('onUploadedResourceFiles?: (files: UploadedResourceFile[]) => void | Promise<void>;');
    expect(uploadSource).toContain('const uploadedFiles = Array.isArray(result?.files)');
    expect(uploadSource).toContain('await Promise.resolve(onUploadedResourceFiles?.(uploadedFiles));');
  });

  it('expands the target document folder before selecting pasted uploads', () => {
    const source = readContentPanelSource();
    const uploadSource = source.slice(
      source.indexOf('const uploadResourceFiles = useCallback(async (files: FileList | File[], options?: { targetFolder?: string | null }) => {'),
      source.indexOf('const resetSidebarHorizontalScroll = () => {'),
    );

    expect(source).toContain('function findFolderIdByPath(nodes: SidebarTreeNode[], folderPath: string): string | null');
    expect(source).toContain('const expandDocumentFolderPath = useCallback((folderPath: string | null | undefined) => {');
    expect(source).toContain('const folderId = findFolderIdByPath(tree, folderPath);');
    expect(uploadSource).toContain("const targetFolder = String(options?.targetFolder || '').trim();");
    expect(uploadSource).toContain('expandDocumentFolderPath(targetFolder);');
    expect(uploadSource.indexOf('expandDocumentFolderPath(targetFolder);'))
      .toBeLessThan(uploadSource.indexOf('await Promise.resolve(onUploadedResourceFiles?.(uploadedFiles));'));
    expect(uploadSource).toContain('}, [activeProjectId, expandDocumentFolderPath, onUploadedResourceFiles]);');
  });

  it('syncs the selected document resource folder into the paste upload target', () => {
    const source = readContentPanelSource();
    const syncEffectSource = source.slice(
      source.indexOf('const selectedDocumentFolderPath = useMemo(() => {'),
      source.indexOf('const uploadResourceFiles = useCallback'),
    );

    expect(syncEffectSource).toContain("if (activeTab !== 'document' || !selectedFolder) {");
    expect(syncEffectSource).toContain("return String(selectedFolder.folderPath || selectedFolder.path || '').trim();");
    expect(syncEffectSource).toContain('armDocumentPasteUpload(selectedDocumentFolderPath);');
    expect(syncEffectSource).toContain('[activeTab, selectedDocumentFolderPath, armDocumentPasteUpload]');
  });

  it('tracks the document paste target from root and folder focus without switching to file paths', () => {
    const source = readContentPanelSource();
    const folderClickSource = source.slice(
      source.indexOf("if (dataTab === 'docs') {"),
      source.indexOf("if (item) {", source.indexOf("if (dataTab === 'docs') {")),
    );
    const itemClickSource = source.slice(
      source.indexOf("if (item) {", source.indexOf('const renderTreeNodes =')),
      source.indexOf('}', source.indexOf('onItemClick(item);')),
    );

    expect(source).toContain('const handleDocumentPanelRootFocus = useCallback(() => {');
    expect(source).toContain('armDocumentPasteUpload(null);');
    expect(source).toContain('const setDocumentPasteTargetFromFolder = useCallback((folder: SidebarTreeNode) => {');
    expect(source).toContain('armDocumentPasteUpload(String(folder.folderPath || folder.path || \'\').trim() || null);');
    expect(folderClickSource).toContain('setDocumentPasteTargetFromFolder(node);');
    expect(source).toContain('onFocus={() => {');
    expect(source).toContain('setDocumentPasteTargetFromFolder(node);');
    expect(itemClickSource).not.toContain('setDocumentPasteTargetFolder');
    expect(source).toContain('onMouseDown={(event) => {');
    expect(source).toContain('if (shouldUseDocumentRootPasteTarget(event.target)) {');
    expect(source).toContain('handleDocumentPanelRootFocus();');
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

  it('adds assistant-context drag payloads without changing existing tree and canvas drag payloads', () => {
    const source = readContentPanelSource();
    const pageRowsSource = source.slice(
      source.indexOf('const renderPrototypePageRows ='),
      source.indexOf('const renderTreeNodes ='),
    );
    const treeDragSource = source.slice(
      source.indexOf('onDragStart={(e) => {', source.indexOf('const renderTreeNodes =')),
      source.indexOf('setDraggingNodeId(node.id);', source.indexOf('const renderTreeNodes =')),
    );

    expect(source).toContain("import { ASSISTANT_CONTEXT_DRAG_MIME, buildAssistantContextDragPayload } from '../../domains/assistant/assistantContextDrag';");
    expect(source).toContain("import { buildAssistantContextItemsFromResource } from '../../domains/assistant/assistantContextPayload';");
    expect(pageRowsSource).toContain('event.dataTransfer.setData(CANVAS_DROP_MIME, JSON.stringify(payload));');
    expect(pageRowsSource).toContain('event.dataTransfer.setData(ASSISTANT_CONTEXT_DRAG_MIME, JSON.stringify(buildAssistantContextDragPayload({');
    expect(pageRowsSource).toContain("resourceType: 'prototype-page'");
    expect(treeDragSource).toContain('e.dataTransfer.setData(SIDEBAR_TREE_DRAG_MIME, node.id);');
    expect(treeDragSource).toContain('e.dataTransfer.setData(CANVAS_DROP_MIME, JSON.stringify(payload));');
    expect(treeDragSource).toContain('e.dataTransfer.setData(ASSISTANT_CONTEXT_DRAG_MIME, JSON.stringify(buildAssistantContextDragPayload({');
    expect(treeDragSource).toContain('items: buildAssistantContextItemsFromResource({');
  });
});

describe('ContentPanel prototype page children source', () => {
  it('uses a layout icon for prototype items while keeping file icons for prototype pages', () => {
    const source = readContentPanelSource();
    const pageRowsSource = source.slice(
      source.indexOf('const renderPrototypePageRows ='),
      source.indexOf('const renderTreeNodes ='),
    );
    const treeNodeRenderSource = source.slice(
      source.indexOf('const renderTreeNodes ='),
      source.indexOf('let actionsElement: React.ReactNode = null;'),
    );

    expect(source).toContain('PanelsTopLeft,');
    expect(pageRowsSource).toContain('icon={<File className="h-3.5 w-3.5" />}');
    expect(treeNodeRenderSource).toContain("} else if (dataTab === 'prototypes') {");
    expect(treeNodeRenderSource).toContain('iconElement = <PanelsTopLeft className="h-3.5 w-3.5" />;');
  });

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
    expect(helperSource).toContain("embedViewMode: 'preview'");
    expect(helperSource).toContain('displayName: resolvePrototypePageEmbedDisplayName(item, page.title)');
    expect(helperSource).toContain('return `${trimmedPageTitle} - ${prototypeTitle}`;');
    expect(helperSource).toContain('buildPrototypePagePreviewUrl(item, page.id)');
    expect(helperSource).toContain('buildResourceDeepLinkUrl({');
    expect(helperSource).toContain('pageId: page.id');
    expect(payloadSource).not.toContain('pageId,');
    expect(payloadSource).not.toContain('pageTitle:');
  });

  it('drags prototype and document items as preview embeds by default', () => {
    const source = readContentPanelSource();
    const payloadSource = source.slice(
      source.indexOf('const payload = {'),
      source.indexOf('try {', source.indexOf('const payload = {')),
    );

    expect(payloadSource).toContain('embedViewMode: \'preview\'');
    expect(payloadSource).not.toContain('embedViewMode: \'link\'');
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

  it('lets active project rows retry switching so stale selected state cannot swallow the click', () => {
    const source = readContentPanelSource();
    const switchStart = source.indexOf('const handleProjectSwitch = async');
    const deleteStart = source.indexOf('const handleProjectDelete = async', switchStart);
    const switchSource = source.slice(switchStart, deleteStart);

    expect(switchSource).toContain('if (!projectId) {');
    expect(switchSource).toContain('await Promise.resolve(onProjectSwitch(projectId));');
    expect(switchSource).not.toContain('projectId === activeProjectId');
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

  it('does not show make client versions in the project switcher', () => {
    const source = readContentPanelSource();
    const projectSwitcherSource = source.slice(
      source.indexOf('{projects.length > 0 ? projects.map((project) => {'),
      source.indexOf(') : (', source.indexOf('{projects.length > 0 ? projects.map((project) => {')),
    );

    expect(projectSwitcherSource).not.toContain('clientVersion');
    expect(projectSwitcherSource).not.toContain('客户端 {clientVersion}');
    expect(projectSwitcherSource).not.toContain('客户端版本');
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

  it('marks the default design row with a visible default badge', () => {
    const source = readContentPanelSource();
    const treeNodeRenderSource = source.slice(
      source.indexOf('const renderTreeNodes ='),
      source.indexOf('const dataTabTitle ='),
    );

    expect(treeNodeRenderSource).toContain("const isDefaultDesignItem = !isFolder && dataTab === 'themes' && item?.name === defaultThemeName;");
    expect(treeNodeRenderSource).toContain('const suffixElement = isDefaultDesignItem ? (');
    expect(treeNodeRenderSource).toContain('data-default-design-badge');
    expect(treeNodeRenderSource).toContain('默认');
    expect(treeNodeRenderSource).toContain('suffix={suffixElement}');
  });

  it('does not show folder-open or legacy generate-design prompt actions on design rows', () => {
    const source = readContentPanelSource();
    const itemActionsSource = source.slice(
      source.indexOf('const renderItemActions ='),
      source.indexOf('const renderFolderActions ='),
    );

    expect(itemActionsSource).toContain("const showOpenResourceDirectoryAction = dataTab === 'docs';");
    expect(itemActionsSource).toContain('{showOpenResourceDirectoryAction ? (');
    expect(itemActionsSource).not.toContain('onGenerateThemeFromPrototype');
    expect(itemActionsSource).not.toContain('生成设计');
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
  it('shows only new project creation below the project switcher list', () => {
    const source = readContentPanelSource();
    const switcherSource = source.slice(
      source.indexOf('<DropdownMenu open={projectSwitcherMenuOpen}'),
      source.indexOf('</DropdownMenuContent>', source.indexOf('<DropdownMenu open={projectSwitcherMenuOpen}')),
    );

    expect(source).toContain("const [projectSetupInitialMode, setProjectSetupInitialMode] = useState<'menu'>('menu');");
    expect(switcherSource).not.toContain('复制当前项目');
    expect(switcherSource).not.toContain('setProjectSetupInitialMode(\'copy\');');
    expect(switcherSource).toContain('setProjectSetupInitialMode(\'menu\');');
    expect(source).toContain('initialMode={projectSetupInitialMode}');
  });

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
