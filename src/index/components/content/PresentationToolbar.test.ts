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
    const toolbarReturnSource = source.slice(source.indexOf('return ('), source.indexOf('{/* Center: Tools */}'));

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

  it('uses the old device slot as the prototype canvas entry', () => {
    const source = readToolbarSource();
    const centerToolsSource = source.slice(
      source.indexOf('{/* Center: Tools */}'),
      source.indexOf('{/* Right: Export */}'),
    );

    expect(source).toContain('const canvasEntryButton = (');
    expect(source).toContain("const shouldShowCanvasEntryButton = isPreviewContent && viewMode === 'demo' && Boolean(selectedItem) && !isQuickEditActive;");
    expect(source).toContain('<LayoutDashboard /> 画布');
    expect(source).toContain("onClick={() => setViewMode('canvas')}");
    expect(centerToolsSource).toContain('{shouldShowCanvasEntryButton ? canvasEntryButton : null}');
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

  it('renames the prototype export menu trigger to publish and adds cloud service targets', () => {
    const source = readToolbarSource();

    expect(source).toContain('<span>发布</span>');
    expect(source).toContain('云服务');
    expect(source).toContain('发布到 S3 对象存储');
    expect(source).toContain('发布到 Vercel');
    expect(source).toContain('发布到 Cloudflare Pages');
    expect(source).toContain('发布到 GitHub Pages');
    expect(source).toContain('最近发布地址');
    const cloudServiceSegment = source.slice(source.indexOf('云服务'), source.indexOf('<Copy className="h-3.5 w-3.5" /> 最近发布地址'));
    expect(cloudServiceSegment.indexOf('发布到 S3 对象存储')).toBeLessThan(cloudServiceSegment.indexOf('发布到 Vercel'));
    expect(cloudServiceSegment.indexOf('发布到 S3 对象存储')).toBeLessThan(cloudServiceSegment.indexOf('发布到 Cloudflare Pages'));
    expect(cloudServiceSegment.indexOf('发布到 S3 对象存储')).toBeLessThan(cloudServiceSegment.indexOf('发布到 GitHub Pages'));
    expect((source.match(/最近发布地址/g) || []).length).toBe(1);
    expect(source).not.toContain('Vercel 最近发布地址');
    expect(source).not.toContain('Cloudflare Pages 最近发布地址');
    expect(source).not.toContain('S3 最近发布地址');
    expect(source).toContain('<Settings2 className="h-3.5 w-3.5" /> 设置');
  });

  it('offers separate HTML export actions with and without source files', () => {
    const source = readToolbarSource();

    expect(source).toContain('handleExportHtml({ includeSource: true })');
    expect(source).toContain('导出 HTML（含源码）');
  });

  it('wires cloud publishing menu actions through explicit target handlers', () => {
    const source = readToolbarSource();

    expect(source).toContain("handlePublishCloudTarget('vercel')");
    expect(source).toContain("handlePublishCloudTarget('cloudflare-pages')");
    expect(source).toContain("handlePublishCloudTarget('s3')");
    expect(source).toContain("handlePublishCloudTarget('github-pages')");
    expect(source).toContain('handleCopyLatestCloudPublishUrl()');
    expect(source).not.toContain('handleCopyLatestCloudPublishUrl(\'vercel\')');
    expect(source).not.toContain('handleCopyLatestCloudPublishUrl(\'cloudflare-pages\')');
    expect(source).not.toContain('handleCopyLatestCloudPublishUrl(\'s3\')');
    expect(source).toContain('disabled={!latestCloudPublishUrl}');
    expect(source).not.toContain('disabled={!latestCloudPublishUrls.vercel}');
    expect(source).not.toContain("disabled={!latestCloudPublishUrls['cloudflare-pages']}");
    expect(source).not.toContain('disabled={!latestCloudPublishUrls.s3}');
    expect(source).toContain('handleOpenCloudPublishSettings');
  });

  it('keeps the publish menu available when the Genie host toolbar is visible', () => {
    const source = readToolbarSource();
    const segment = source.slice(
      source.indexOf('const showExportMenuButton ='),
      source.indexOf('const exportMenuButton ='),
    );

    expect(segment).toContain("isPreviewContent && viewMode === 'demo' && Boolean(selectedItem)");
    expect(segment).not.toContain('shouldShowPreviewShellActions');
  });
});

describe('PresentationToolbar Genie host controls source', () => {
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

  it('omits the removed host execution buttons from the top toolbar', () => {
    const source = readToolbarSource();

    expect(source).toContain('showHostAgentMenu');
    expect(source).not.toContain('showHostExecutionControls');
    expect(source).not.toContain('hostToolbarState.sendVisible || hostToolbarState.interruptVisible');
    expect(source).not.toContain("'host-send'");
    expect(source).not.toContain("'host-interrupt'");
    expect(source).toMatch(/showHostAgentMenu[\s\S]*执行 Agent/);
  });

  it('moves the local agent switch into the more menu with a brand active state', () => {
    const source = readToolbarSource();

    expect(source).toContain('hostLocalAgentConnected');
    expect(source).toContain("hostLocalAgentConnected ? '已链接本地 Agent' : '链接本地 Agent'");
    expect(source).toContain("hostLocalAgentConnected && 'text-brand hover:bg-brand/5 hover:text-brand'");
    expect(source).toContain("hostLocalAgentConnected ? 'disconnect-genie' : 'wake-genie'");
    expect(source).not.toContain("'host-local-agent'");
    expect(source).not.toMatch(/renderHostToolbarActionButton\([\s\S]*hostLocalAgentConnected \? '已链接/);
  });

  it('places the more button between refresh and exit while quick editing', () => {
    const source = readToolbarSource();

    expect(source).toMatch(/<RotateCw \/> 刷新[\s\S]*\{hostMoreMenu\}[\s\S]*<CircleX \/> 退出/);
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
});
