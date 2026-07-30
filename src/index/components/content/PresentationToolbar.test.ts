import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readToolbarSource() {
  return readFileSync(resolve(__dirname, './PresentationToolbar.tsx'), 'utf8');
}

describe('PresentationToolbar cloud publishing source', () => {
  it('moves the device switcher behind the sidebar toggle as an icon-only button', () => {
    const source = readToolbarSource();
    const deviceSwitcherButtonSource = source.slice(
      source.indexOf('const deviceSwitcherButton = ('),
      source.indexOf('const shouldShowDeviceSwitcher'),
    );
    const toolbarReturnSource = source.slice(
      source.lastIndexOf('\n    return ('),
      source.indexOf('{/* Center: Tools */}'),
    );

    expect(deviceSwitcherButtonSource).toContain('aria-label="设备"');
    expect(deviceSwitcherButtonSource).toContain('edgeIconButtonClass');
    expect(deviceSwitcherButtonSource).not.toContain('<span>设备</span>');
    expect(toolbarReturnSource).toContain('{deviceSwitcher}');
  });

  it('keeps the left toolbar limited to sidebar and device controls', () => {
    const source = readToolbarSource();
    const toolbarLeftSource = source.slice(
      source.indexOf('{/* Left: Sidebar Collapse */}'),
      source.indexOf('{/* Center: Tools */}'),
    );

    expect(toolbarLeftSource).toContain('{deviceSwitcher}');
    expect(toolbarLeftSource).not.toContain('leftRefreshButton');
    expect(toolbarLeftSource).not.toContain('shouldShowLeftRefreshButton');
  });

  it('does not expose a prototype canvas entry in the preview toolbar', () => {
    const source = readToolbarSource();
    const centerToolsSource = source.slice(
      source.indexOf('{/* Center: Tools */}'),
      source.indexOf('{/* Right: Export */}'),
    );

    expect(source).not.toContain('const canvasEntryButton = (');
    expect(source).not.toContain('const shouldShowCanvasEntryButton =');
    expect(source).not.toContain('<LayoutDashboard /> 画布');
    expect(source).not.toContain('<TooltipContent>进入画布</TooltipContent>');
    expect(source).not.toContain('<LayoutDashboard /> 草稿');
    expect(source).not.toContain('<TooltipContent>进入草稿</TooltipContent>');
    expect(source).not.toContain("onClick={() => setViewMode('canvas')}");
    expect(centerToolsSource).not.toContain('shouldShowCanvasEntryButton');
    expect(centerToolsSource).not.toContain('{deviceSwitcher}');
  });

  it('uses one consistent gap between centered toolbar buttons', () => {
    const source = readToolbarSource();
    const centerToolsSource = source.slice(
      source.indexOf('{/* Center: Tools */}'),
      source.indexOf('{/* Right: Export */}'),
    );

    expect(centerToolsSource).toContain('gap-1');
    expect(centerToolsSource).not.toContain('gap-2');
  });

  it('does not render a normal preview refresh button in the top toolbar', () => {
    const source = readToolbarSource();
    const normalPreviewActionsSource = source.slice(
      source.indexOf(') : viewMode === \'canvas\' ? ('),
      source.indexOf('</>', source.indexOf(') : viewMode === \'canvas\' ? (')),
    );

    expect(source).not.toContain('const leftRefreshButton = (');
    expect(source).not.toContain('const shouldShowLeftRefreshButton =');
    expect(normalPreviewActionsSource).not.toContain('<RotateCw /> 刷新');
  });

  it('keeps HTML prototype specs annotation-only without persistence actions', () => {
    const source = readToolbarSource();

    expect(source).toContain("const isReadOnlyHtmlPrototypeSpec = contentMode === 'prototype-spec'");
    expect(source).toContain('isQuickEditActive && !isReadOnlyHtmlPrototypeSpec');
  });

  it('keeps only the default publish action, copy URL, and platform settings visible by default', () => {
    const source = readToolbarSource();

    expect(source).toContain('<span>发布</span>');
    expect(source).toContain('云服务');
    expect(source).toContain("visibleCloudPublishTargets = ['axhub']");
    expect(source).toContain("visibleCloudPublishTargetSet.has('axhub')");
    expect(source).toContain('<Cloud className="h-3.5 w-3.5" /> 发布到 Axhub');
    expect(source).toContain('<Send className="h-3.5 w-3.5" /> 发布到对象存储');
    expect(source).toContain("visibleCloudPublishTargetSet.has('s3')");
    expect(source).toContain("visibleCloudPublishTargetSet.has('vercel')");
    expect(source).toContain("visibleCloudPublishTargetSet.has('cloudflare-pages')");
    expect(source).toContain("visibleCloudPublishTargetSet.has('github-pages')");
    expect(source).toContain('复制发布地址');
    expect((source.match(/复制发布地址/g) || []).length).toBe(1);
    expect(source).not.toContain('Vercel 最近发布地址');
    expect(source).not.toContain('Cloudflare Pages 最近发布地址');
    expect(source).not.toContain('S3 最近发布地址');
    expect(source).not.toContain('发布到 S3 对象存储');
    expect(source).toContain('<Settings2 className="h-3.5 w-3.5" /> 更多平台与设置');
    expect(source).toContain("onClick={() => handleOpenCloudPublishSettings('publish-settings')}");
  });

  it('offers separate HTML export actions with and without source files', () => {
    const source = readToolbarSource();

    expect(source).toContain('handleExportHtml({ includeSource: true })');
    expect(source).toContain('导出 HTML（含源码）');
  });

  it('wires cloud publishing menu actions through explicit target handlers', () => {
    const source = readToolbarSource();

    expect(source).toContain('currentPublishResourcePath?: string;');
    expect(source).toContain('currentPublishResourcePath = \'\',');
    expect(source).toContain("visibleCloudPublishTargets?: CloudPublishTarget[];");
    expect(source).toContain('const hasCurrentPublishResource = Boolean(currentPublishResourcePath);');
    expect(source).toContain("handlePublishCloudTarget('vercel')");
    expect(source).toContain("handlePublishCloudTarget('cloudflare-pages')");
    expect(source).toContain("handlePublishCloudTarget('s3')");
    expect(source).toContain("handlePublishCloudTarget('github-pages')");
    expect(source).toContain('handleOpenAxhubPublishDialog: () => void | Promise<void>;');
    expect(source).toContain('handleOpenAxhubPublishDialog,');
    expect(source).toContain('onClick={() => handleOpenAxhubPublishDialog()}');
    expect(source).toContain('<Cloud className="h-3.5 w-3.5" /> 发布到 Axhub');
    expect(source).toContain('handleCopyLatestCloudPublishUrl()');
    expect(source).not.toContain('handleCopyLatestCloudPublishUrl(\'vercel\')');
    expect(source).not.toContain('handleCopyLatestCloudPublishUrl(\'cloudflare-pages\')');
    expect(source).not.toContain('handleCopyLatestCloudPublishUrl(\'s3\')');
    expect(source).toContain('disabled={!hasCurrentPublishResource}');
    expect(source).toContain('disabled={!latestCloudPublishUrl || !hasCurrentPublishResource}');
    expect(source).not.toContain('disabled={!latestCloudPublishUrls.vercel}');
    expect(source).not.toContain("disabled={!latestCloudPublishUrls['cloudflare-pages']}");
    expect(source).not.toContain('disabled={!latestCloudPublishUrls.s3}');
    expect(source).toContain('handleOpenCloudPublishSettings');
  });

  it('adds a publish menu action that copies the current preview screenshot', () => {
    const source = readToolbarSource();

    expect(source).toContain('handleCopyCurrentScreenshot: () => void | Promise<void>;');
    expect(source).toContain('handleCopyCurrentScreenshot,');
    expect(source).toContain('onClick={handleCopyCurrentScreenshot}');
    expect(source).toContain('<ImageIcon className="h-3.5 w-3.5" /> 复制截图');
    const exportMenuSegment = source.slice(
      source.indexOf('const exportMenuButton = ('),
      source.indexOf('</DropdownMenuContent>', source.indexOf('const exportMenuButton = (')),
    );
    expect(exportMenuSegment).toContain('复制截图');
    expect(exportMenuSegment.indexOf('复制截图')).toBeGreaterThan(exportMenuSegment.indexOf('设置'));
  });

  it('shows only lightweight Axure and export actions for theme previews', () => {
    const source = readToolbarSource();
    const exportMenuSegment = source.slice(
      source.indexOf('const exportMenuButton = ('),
      source.indexOf('</DropdownMenuContent>', source.indexOf('const exportMenuButton = (')),
    );

    expect(source).toContain("const showMakeExportEntry = isPreviewContent && viewMode === 'demo'");
    expect(source).toContain("const showInteractiveAxureExportEntry = isPreviewContent && viewMode === 'demo'");
    expect(source).toContain('const showEditableAxureCopyEntry = Boolean(currentRuntimeExportResource);');
    expect(source).toContain('const showAxureUsageGuideEntry = showInteractiveAxureExportEntry;');
    expect(exportMenuSegment).toContain('{showInteractiveAxureExportEntry ? (');
    expect(exportMenuSegment).toContain('{showEditableAxureCopyEntry ? (');
    expect(exportMenuSegment).toContain('{showAxureUsageGuideEntry ? (');
  });

  it('keeps the publish menu available when the Agent host toolbar is visible', () => {
    const source = readToolbarSource();
    const segment = source.slice(
      source.indexOf('const showExportMenuButton ='),
      source.indexOf('const exportMenuButton ='),
    );

    expect(segment).toContain("((isPreviewContent && viewMode === 'demo') || contentMode === 'theme')");
    expect(segment).toContain('(Boolean(selectedItem) || Boolean(selectedTheme))');
    expect(segment).not.toContain('shouldShowPreviewShellActions');
  });

  it('does not render the AI open menu in the top toolbar', () => {
    const source = readToolbarSource();
    const rightToolbarSource = source.slice(
      source.indexOf('{/* Right: Export */}'),
      source.indexOf('</div>', source.indexOf('{/* Right: Export */}')),
    );

    expect(source).not.toContain("import OpenInDropdown from '../sidebar/OpenInDropdown';");
    expect(rightToolbarSource).toContain('{showExportMenuButton ? exportMenuButton : null}');
    expect(rightToolbarSource).not.toContain('<OpenInDropdown');
    expect(source).not.toContain('variant="toolbar"');
    expect(rightToolbarSource).not.toContain('onOpenAISettings');
  });
});

describe('PresentationToolbar Agent host controls source', () => {
  it('labels open-in-editor tooltips with the resolved IDE app name', () => {
    const source = readToolbarSource();

    expect(source).toContain("import { MAIN_IDE_APP_NAMES, resolveVisibleIDEPreference } from '../../../common/ide';");
    expect(source).toContain('preferredIDE?: MainIDEPreference;');
    expect(source).toContain('ideAvailability?: IDEAvailabilityMap;');
    expect(source).toContain('resolveVisibleIDEPreference(preferredIDE, ideAvailability)');
    expect(source).toContain("const openInIdeTooltip = openInIdeName ? `在 ${openInIdeName} 中打开` : '在编辑器中打开';");
    expect(source).toContain("const getOpenInIdeTooltip = (targetLabel: string) => openInIdeName ? `在 ${openInIdeName} 中打开${targetLabel}` : `在编辑器中打开${targetLabel}`;");
    expect(source).toContain('{getOpenInIdeTooltip(currentMarkdownLabel)}');
    expect(source).toContain("{getOpenInIdeTooltip('主题')}");
    expect(source).toContain("{getOpenInIdeTooltip('数据表')}");
    expect(source).not.toContain("const openInIdeTooltip = '在编辑器中打开';");
  });

  it('keeps the device switcher button radius aligned with the other toolbar buttons', () => {
    const source = readToolbarSource();

    const segment = source.slice(
      source.indexOf('const deviceSwitcherButton = ('),
      source.indexOf('const shouldShowDeviceSwitcher'),
    );

    expect(segment).toContain('edgeIconButtonClass');
    expect(segment).not.toContain('rounded-full');
  });

  it('labels the standalone and host panel entry as design decisions', () => {
    const source = readToolbarSource();

    expect(source).toContain("'设计决策'");
    expect(source).toContain("'关闭设计决策'");
    expect(source).toContain('<SlidersHorizontal /> 决策');
    expect(source).not.toContain('<SlidersHorizontal /> 调整');
    expect(source).not.toContain("'属性调整'");
    expect(source).not.toContain("'关闭属性调整'");
  });

  it('hides design decision actions when the current prototype has no decision data', () => {
    const source = readToolbarSource();
    const hostControlsSource = source.slice(
      source.indexOf('const hostToolbarControls = hostToolbarState?.visible ? ('),
      source.indexOf('const activeQuickEditToolbarButtons = ('),
    );

    expect(source).toContain('prototypeDecisionDataAvailable?: boolean;');
    expect(source).toContain('prototypeDecisionDataAvailable = false,');
    expect(source).toContain('const canShowPrototypeDecisionActions = !isPreviewContent || prototypeDecisionDataAvailable;');
    expect(source).toContain('&& canShowPrototypeDecisionActions');
    expect(source).toContain('const showHostPropertyPanelAction = contentMode !== \'theme\'\n        && canShowPrototypeDecisionActions\n        && !isDocumentCommentActive;');
    expect(hostControlsSource).toContain('showHostPropertyPanelAction ? renderHostToolbarActionButton');
  });

  it('adds the review action after annotation and design decisions', () => {
    const source = readToolbarSource();
    const normalPreviewActionsSource = source.slice(
      source.indexOf(') : viewMode === \'canvas\' ? ('),
      source.indexOf('{contentMode === \'doc\' || contentMode === \'template\' ? ('),
    );

    expect(source).toContain('reviewPanelOpen?: boolean');
    expect(source).toContain('onReviewPanelToggle?: () => void');
    expect(source).toContain('<ListChecks /> 评审');
    expect(source).toContain("const reviewPanelTooltip = reviewPanelOpen ? '关闭评审' : '评审';");
    expect(normalPreviewActionsSource.indexOf('<PencilRuler /> 批注')).toBeLessThan(
      normalPreviewActionsSource.indexOf('<SlidersHorizontal /> 决策'),
    );
    expect(normalPreviewActionsSource.indexOf('<SlidersHorizontal /> 决策')).toBeLessThan(
      normalPreviewActionsSource.indexOf('<ListChecks /> 评审'),
    );
  });

  it('renders the AI execution button in the top toolbar and keeps interrupt in more menu', () => {
    const source = readToolbarSource();
    const hostMoreMenuSource = source.slice(
      source.indexOf('const hostMoreMenu = hostToolbarState?.visible ? ('),
      source.indexOf('const hostToolbarControls = hostToolbarState?.visible ? ('),
    );
    const hostControlsSource = source.slice(
      source.indexOf('const hostToolbarControls = hostToolbarState?.visible ? ('),
      source.indexOf('const activeQuickEditToolbarButtons = ('),
    );

    expect(source).toContain('showHostAgentMenu');
    expect(source).toContain('showHostExecutionControls');
    expect(source).toContain('hostToolbarState.sendVisible || hostToolbarState.interruptVisible');
    expect(hostControlsSource).toContain("'host-send'");
    expect(hostControlsSource).toContain("'AI 执行'");
    expect(hostControlsSource).not.toContain("'host-interrupt'");
    expect(hostMoreMenuSource).toContain("{ type: 'interrupt-agent' }");
    expect(hostMoreMenuSource).toContain('中断执行');
    expect(source).toMatch(/showHostAgentMenu[\s\S]*执行 Agent/);
  });

  it('lets the editor decide whether the host copy prompt action is enabled', () => {
    const source = readToolbarSource();
    const hostControlsSource = source.slice(
      source.indexOf('const hostToolbarControls = hostToolbarState?.visible ? ('),
      source.indexOf('const activeQuickEditToolbarButtons = ('),
    );

    expect(source).not.toContain('const hostToolbarHasPrompt = Boolean(');
    expect(hostControlsSource).toContain('disabled: hostToolbarState.copyPromptDisabled');
    expect(hostControlsSource).not.toContain('disabled: !hostToolbarHasPrompt');
  });

  it('labels the host more menu with ACP UI wording instead of Agent runtime wording', () => {
    const source = readToolbarSource();

    expect(source).toContain('aria-label="更多 ACP UI 操作"');
    expect(source).not.toContain('aria-label="更多 Genie 操作"');
  });

  it('uses neutral host action menu state names for ACP UI controls', () => {
    const source = readToolbarSource();

    expect(source).toContain('hostActionMenuOpen');
    expect(source).not.toContain('hostGenieMenuOpen');
    expect(source).not.toContain('hostGenieTriggerRef');
  });

  it('opens AI settings from the host more menu instead of linking the local agent directly', () => {
    const source = readToolbarSource();

    expect(source).toContain('onOpenAISettings?: () => void;');
    expect(source).toContain('onOpenAISettings,');
    expect(source).toContain('const handleOpenAISettingsFromHostMenu = React.useCallback(() => {');
    expect(source).toContain('onOpenAISettings?.();');
    expect(source).toContain('[closeHostMenus, onOpenAISettings]');
    expect(source).toContain('onClick={handleOpenAISettingsFromHostMenu}');
    expect(source).toContain('<Settings2 className={hostMenuIconClass} /> AI 设置');
    expect(source).not.toContain('hostLocalAgentConnected');
    expect(source).not.toContain("hostLocalAgentConnected ? '已链接本地 Agent' : '链接本地 Agent'");
    expect(source).not.toContain("hostLocalAgentConnected && 'text-brand hover:bg-brand/5 hover:text-brand'");
    expect(source).not.toContain("hostLocalAgentConnected ? 'disconnect-agent' : 'wake-agent'");
    expect(source).not.toContain('链接本地 Agent');
    expect(source).not.toContain('已链接本地 Agent');
    expect(source).not.toContain("'host-local-agent'");
    expect(source).not.toContain("type: 'wake-agent'");
    expect(source).not.toContain("type: 'disconnect-agent'");
  });

  it('groups host more menu actions by purpose', () => {
    const source = readToolbarSource();
    const hostMoreMenuSource = source.slice(
      source.indexOf('const hostMoreMenu = hostToolbarState?.visible ? ('),
      source.indexOf('const hostToolbarControls = hostToolbarState?.visible ? ('),
    );

    expect(hostMoreMenuSource).toContain('<div className={hostMenuGroupLabelClass}>Agent</div>');
    expect(hostMoreMenuSource).toContain('<div className={hostMenuGroupLabelClass}>标注</div>');
    expect(hostMoreMenuSource).toContain('<div className={hostMenuGroupLabelClass}>页面</div>');
    expect(hostMoreMenuSource).toContain('<div className={hostMenuGroupLabelClass}>帮助</div>');
    expect(hostMoreMenuSource).toContain('<div className={hostMenuGroupLabelClass}>保存与清理</div>');
    expect(hostMoreMenuSource).toContain("type: 'enable-annotation'");
    expect(hostMoreMenuSource).toContain('开启需求标注');
    expect(hostMoreMenuSource).toContain('hostToolbarState.annotationEnabled');
    expect(hostMoreMenuSource).toContain('hostToolbarState.annotationEnableLoading');
    expect(hostMoreMenuSource).toContain('hostToolbarState.annotationEnableDisabled');
    expect(hostMoreMenuSource).toContain("hostToolbarState.annotationEnabled && 'text-brand hover:bg-brand/5 hover:text-brand'");
    expect(hostMoreMenuSource.indexOf('<div className={hostMenuGroupLabelClass}>Agent</div>')).toBeLessThan(
      hostMoreMenuSource.indexOf('AI 设置'),
    );
    expect(hostMoreMenuSource.indexOf('AI 设置')).toBeLessThan(
      hostMoreMenuSource.indexOf('中断执行'),
    );
    expect(hostMoreMenuSource.indexOf('中断执行')).toBeLessThan(
      hostMoreMenuSource.indexOf('<div className={hostMenuGroupLabelClass}>标注</div>'),
    );
    expect(hostMoreMenuSource.indexOf('<div className={hostMenuGroupLabelClass}>标注</div>')).toBeLessThan(
      hostMoreMenuSource.indexOf('开启需求标注'),
    );
    expect(hostMoreMenuSource.indexOf('开启需求标注')).toBeLessThan(
      hostMoreMenuSource.indexOf('<div className={hostMenuGroupLabelClass}>页面</div>'),
    );
    expect(hostMoreMenuSource.indexOf('<div className={hostMenuGroupLabelClass}>页面</div>')).toBeLessThan(
      hostMoreMenuSource.indexOf("{ type: 'toggle-page-animations' }"),
    );
    expect(hostMoreMenuSource.indexOf("{ type: 'toggle-page-animations' }")).toBeLessThan(
      hostMoreMenuSource.indexOf('<div className={hostMenuGroupLabelClass}>帮助</div>'),
    );
    expect(hostMoreMenuSource.indexOf('<div className={hostMenuGroupLabelClass}>帮助</div>')).toBeLessThan(
      hostMoreMenuSource.indexOf("{ type: 'open-keyboard-shortcuts' }"),
    );
    expect(hostMoreMenuSource.indexOf("{ type: 'open-keyboard-shortcuts' }")).toBeLessThan(
      hostMoreMenuSource.indexOf('<div className={hostMenuGroupLabelClass}>保存与清理</div>'),
    );
  });

  it('places the more button between refresh and exit while quick editing', () => {
    const source = readToolbarSource();

    expect(source).toMatch(/<RotateCw \/> 刷新[\s\S]*\{hostMoreMenu\}[\s\S]*<CircleX \/> 退出/);
  });

  it('keeps quick edit save actions inside the more menu and out of the active toolbar row', () => {
    const source = readToolbarSource();
    const hostMoreMenuSource = source.slice(
      source.indexOf('const hostMoreMenu = hostToolbarState?.visible ? ('),
      source.indexOf('const hostToolbarControls = hostToolbarState?.visible ? ('),
    );
    const activeToolbarSource = source.slice(
      source.indexOf('const activeQuickEditToolbarButtons = ('),
      source.indexOf('const resourceActionButtons = (() => {'),
    );

    expect(hostMoreMenuSource).toContain("getQuickEditSaveMenuActionHandlers('save-text')");
    expect(hostMoreMenuSource).toContain('保存文本');
    expect(hostMoreMenuSource).toContain("getQuickEditSaveMenuActionHandlers('save-style')");
    expect(hostMoreMenuSource).toContain('保存样式');
    expect(hostMoreMenuSource).toContain("getQuickEditSaveMenuActionHandlers('clear-style')");
    expect(activeToolbarSource).not.toContain('quickEditSaveActions');
    expect(activeToolbarSource).not.toContain("runQuickEditSaveAction('save-text')");
    expect(activeToolbarSource).not.toContain("runQuickEditSaveAction('save-style')");
  });

  it('orders quick edit host controls as clear, refresh, more, then exit', () => {
    const source = readToolbarSource();
    const hostControlsSource = source.slice(
      source.indexOf('const hostToolbarControls = hostToolbarState?.visible ? ('),
      source.indexOf('const activeQuickEditToolbarButtons = ('),
    );
    const activeToolbarSource = source.slice(
      source.indexOf('const activeQuickEditToolbarButtons = ('),
      source.indexOf('const resourceActionButtons = (() => {'),
    );

    expect(hostControlsSource).toMatch(/'host-clear'[\s\S]*'清空'[\s\S]*<Trash2 \/>/);
    expect(hostControlsSource).not.toContain('清空编辑');
    expect(hostControlsSource).toContain("{ type: 'clear-edits', scope: 'prototype' }");
    expect(activeToolbarSource).toContain("runHostAction({ type: 'clear-edits', scope: 'prototype' })");
    expect(activeToolbarSource).toMatch(/\{hostToolbarControls\}[\s\S]*<RotateCw \/> 刷新[\s\S]*\{hostMoreMenu\}[\s\S]*<CircleX \/> 退出/);
  });

  it('shows host execution controls based on state visibility instead of local agent connection', () => {
    const source = readToolbarSource();
    const hostExecutionControlsSource = source.slice(
      source.indexOf('const showHostExecutionControls = Boolean('),
      source.indexOf('const renderHostToolbarActionButton = ('),
    );
    const hostControlsSource = source.slice(
      source.indexOf('const hostToolbarControls = hostToolbarState?.visible ? ('),
      source.indexOf('const activeQuickEditToolbarButtons = ('),
    );

    expect(hostExecutionControlsSource).not.toContain('hostLocalAgentConnected');
    expect(hostExecutionControlsSource).toContain('hostToolbarState.sendVisible || hostToolbarState.interruptVisible');
    expect(hostControlsSource).toContain("visible: showHostExecutionControls && hostToolbarState.sendVisible");
    expect(hostControlsSource).not.toContain("visible: showHostExecutionControls && hostToolbarState.interruptVisible");
  });

  it('adds a selection mode toggle controlled by hostToolbarState.selectionModeActive', () => {
    const source = readToolbarSource();
    const hostControlsSource = source.slice(
      source.indexOf('const hostToolbarControls = hostToolbarState?.visible ? ('),
      source.indexOf('const activeQuickEditToolbarButtons = ('),
    );

    expect(hostControlsSource).toContain("'host-selection-mode'");
    expect(hostControlsSource).toContain('选择元素');
    expect(hostControlsSource).toContain("{ type: 'toggle-selection-mode', active: !hostToolbarState.selectionModeActive }");
    expect(hostControlsSource).toContain('active: hostToolbarState.selectionModeActive');
  });

  it('hides element selection and design decision host controls during document annotation', () => {
    const source = readToolbarSource();
    const hostControlsSource = source.slice(
      source.indexOf('const hostToolbarControls = hostToolbarState?.visible ? ('),
      source.indexOf('const activeQuickEditToolbarButtons = ('),
    );

    expect(source).toContain('const showHostSelectionModeAction = !isDocumentCommentActive;');
    expect(source).toContain('&& !isDocumentCommentActive');
    expect(hostControlsSource).toContain('visible: showHostSelectionModeAction');
    expect(hostControlsSource).toContain('showHostPropertyPanelAction ? renderHostToolbarActionButton');
  });

  it('shows the selection mode shortcut hint in the host toolbar without binding it in the parent page', () => {
    const source = readToolbarSource();
    const hostControlsSource = source.slice(
      source.indexOf('const hostToolbarControls = hostToolbarState?.visible ? ('),
      source.indexOf('const activeQuickEditToolbarButtons = ('),
    );

    expect(source).toContain("const selectionModeShortcutLabel = 'Ctrl / Cmd + S';");
    expect(source).toContain("const selectionModeTooltip = `切换（${selectionModeShortcutLabel}）`;");
    expect(hostControlsSource).toContain('selectionModeTooltip');
    expect(hostControlsSource).not.toContain('shortcutLabel: selectionModeShortcutLabel');
    expect(hostControlsSource).not.toContain('<kbd');
    expect(hostControlsSource).not.toContain("document.addEventListener('keydown'");
    expect(hostControlsSource).not.toContain("window.addEventListener('keydown'");
  });

  it('reuses the prototype active toolbar when theme annotation is active', () => {
    const source = readToolbarSource();
    const themeResourceActionsSource = source.slice(
      source.indexOf("if (contentMode === 'theme' && selectedTheme) {"),
      source.indexOf("if (contentMode === 'data' && selectedDataTable) {"),
    );

    expect(source).toContain('const activeQuickEditToolbarButtons = (');
    expect(themeResourceActionsSource).toContain('if (isQuickEditActive) {');
    expect(themeResourceActionsSource).toContain('return activeQuickEditToolbarButtons;');
    expect(themeResourceActionsSource.indexOf('return activeQuickEditToolbarButtons;')).toBeLessThan(
      themeResourceActionsSource.indexOf('<PencilRuler /> 批注'),
    );
  });

  it('adds a top online edit action for drawio document and template previews', () => {
    const source = readToolbarSource();
    const documentResourceActionsSource = source.slice(
      source.indexOf('const resourceActionButtons = (() => {'),
      source.indexOf("if (contentMode === 'theme' && selectedTheme) {"),
    );

    expect(source).toContain('drawioResourceEditAvailable?: boolean;');
    expect(source).toContain('handleOpenDrawioResourceEditor: () => void | Promise<void>;');
    expect(source).toContain('drawioResourceEditAvailable = false,');
    expect(source).toContain('handleOpenDrawioResourceEditor,');
    expect(documentResourceActionsSource).toContain('drawioResourceEditAvailable');
    expect(documentResourceActionsSource).toContain('handleOpenDrawioResourceEditor');
    expect(documentResourceActionsSource).toContain('在线编辑');
    expect(documentResourceActionsSource.indexOf('在线编辑')).toBeGreaterThan(
      documentResourceActionsSource.indexOf('打开'),
    );
  });

  it('shows the document annotation action for commentable Markdown and HTML resources', () => {
    const source = readToolbarSource();
    const documentResourceActionsSource = source.slice(
      source.indexOf('const resourceActionButtons = (() => {'),
      source.indexOf("if (contentMode === 'theme' && selectedTheme) {"),
    );

    expect(source).toContain('isDocumentCommentableResource');
    expect(documentResourceActionsSource).toContain('const canCommentOnDocument = isDocumentCommentableResource(currentMarkdownItem);');
    expect(documentResourceActionsSource).toContain('{canCommentOnDocument ? (');
    expect(documentResourceActionsSource).toContain('<PencilRuler /> 批注');
    expect(documentResourceActionsSource).toContain('<TooltipContent>{`批注${currentMarkdownLabel}`}</TooltipContent>');
    expect(documentResourceActionsSource).not.toContain('<SquarePen /> 编辑');
  });

  it('opens document annotation and editing buttons directly in their requested mode', () => {
    const source = readToolbarSource();
    const documentResourceActionsSource = source.slice(
      source.indexOf('const resourceActionButtons = (() => {'),
      source.indexOf("if (contentMode === 'theme' && selectedTheme) {"),
    );

    expect(source).toContain('handleEnableDocEdit: (mode?: SpecQuickEditMode, options?: { disableSelectionMode?: boolean; preserveSidebar?: boolean }) => void;');
    expect(source).toContain('handleEnableDocEdit,');
    expect(documentResourceActionsSource).toContain("onClick={() => handleEnableDocEdit('comment')}");
    expect(documentResourceActionsSource).toContain("onClick={() => handleEnableDocEdit('edit')}");
    expect(documentResourceActionsSource).not.toContain('onClick={handleEnableDocEdit}');
  });

  it('reuses the page annotation host toolbar when HTML document annotation is active', () => {
    const source = readToolbarSource();
    const documentResourceActionsSource = source.slice(
      source.indexOf('const resourceActionButtons = (() => {'),
      source.indexOf("if (contentMode === 'theme' && selectedTheme) {"),
    );

    expect(source).toContain('isHtmlCommentableResource');
    expect(source).toContain('const isHtmlDocumentEditingContent = isDocumentEditingContent && isHtmlCommentableResource(currentMarkdownItem);');
    expect(source).toContain('const isQuickEditActive = quickEditActive && (!isDocumentEditingContent || isHtmlDocumentEditingContent);');
    expect(documentResourceActionsSource).toContain('if (isHtmlDocumentEditingContent && isQuickEditActive) {');
    expect(documentResourceActionsSource).toContain('return activeQuickEditToolbarButtons;');
  });
});

describe('PresentationToolbar multi-page preview source', () => {
  it('keeps the top device menu focused on choosing multi-page mode, not configuring columns', () => {
    const source = readToolbarSource();
    const deviceMenuSource = source.slice(
      source.indexOf('<DropdownMenuContent'),
      source.indexOf('</DropdownMenuContent>', source.indexOf('<DropdownMenuContent')),
    );

    expect(source).toContain('LayoutGrid');
    expect(source).toContain('handleActivateMultiPagePreview');
    expect(source).toContain('handleChangeMultiPageColumns');
    expect(source).toContain("const isMultiPagePreview = previewConfig.previewMode === 'multi-page';");
    expect(source).toContain('title="多页面"');
    expect(source).toContain('平铺当前原型页面');
    expect(source).toContain('active={isMultiPagePreview}');
    expect(source).toContain('handleActivateMultiPagePreview(selectedItem?.pages?.length)');
    expect(deviceMenuSource).not.toContain('previewConfig.multiPageColumns');
    expect(deviceMenuSource).not.toContain('handleChangeMultiPageColumns(value as MultiPageColumns)');
    expect(deviceMenuSource).not.toContain('列数');
  });

  it('hides scale mode controls in multi-page mode while keeping the toolbar icon active', () => {
    const source = readToolbarSource();
    const deviceSwitcherButtonSource = source.slice(
      source.indexOf('const deviceSwitcherButton = ('),
      source.indexOf('const shouldShowDeviceSwitcher'),
    );

    expect(source).toContain('const shouldShowScaleMode = isCustomPreview || isSplitPreview;');
    expect(source).toContain('isMultiPagePreview ? <LayoutGrid className="h-3.5 w-3.5" />');
    expect(deviceSwitcherButtonSource).toContain('isMultiPagePreview && "bg-muted text-foreground"');
    expect(deviceSwitcherButtonSource).toContain('isSplitPreview && "bg-muted text-foreground"');
  });
});
