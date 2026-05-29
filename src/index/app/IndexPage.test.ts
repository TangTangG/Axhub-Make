import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('IndexPage source', () => {
  it('passes the active markdown resource and content mode into the assistant controller', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const contentModeIndex = source.indexOf('const contentMode = useMemo');
    const markdownResourceIndex = source.indexOf('const currentMarkdownResource = useMemo');
    const assistantControllerIndex = source.indexOf('const assistantController = useAssistantPanelController');

    expect(contentModeIndex).toBeGreaterThan(-1);
    expect(markdownResourceIndex).toBeGreaterThan(-1);
    expect(assistantControllerIndex).toBeGreaterThan(-1);
    expect(contentModeIndex).toBeLessThan(assistantControllerIndex);
    expect(markdownResourceIndex).toBeLessThan(assistantControllerIndex);
    expect(source).toContain('contentMode,');
    expect(source).toContain('currentMarkdownResource,');
  });

  it('passes non-prototype active resources into the assistant controller for current-file sync', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const assistantControllerCall = source.slice(
      source.indexOf('const assistantController = useAssistantPanelController'),
      source.indexOf('const syncAssistantCanvasComments = assistantController.syncAssistantCanvasComments'),
    );

    expect(assistantControllerCall).toContain('currentCanvas: resources.selectedCanvas,');
    expect(assistantControllerCall).toContain('currentTheme: resources.selectedTheme,');
    expect(assistantControllerCall).toContain('currentDataTable: resources.selectedDataTable,');
  });

  it('passes active project id into the assistant controller like IDE and OpenCode actions', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const assistantControllerCall = source.slice(
      source.indexOf('const assistantController = useAssistantPanelController'),
      source.indexOf('const preview = useIndexPagePreviewActions'),
    );

    expect(source).toContain('activeProjectId: workspace.activeProjectId,');
    expect(assistantControllerCall).toContain('activeProjectId: workspace.activeProjectId,');
  });

  it('passes project setup required state into the sidebar builder', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const sidebarBuilderCall = source.slice(
      source.indexOf('const sidebarProps = useIndexPageSidebarPropsBuilder'),
      source.indexOf('const handleEnterSelectedPrototypePreview'),
    );

    expect(sidebarBuilderCall).toContain('projectSetupRequired: workspace.projectSetupRequired,');
  });

  it('keeps assistant active resource calculation aligned with preview documents and templates', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');

    expect(source).toContain("const [resourceSection, setResourceSection] = useState<ResourceSection>('themes')");
    expect(source).toContain('resolveIndexContentMode({');
    expect(source).toContain('viewMode,');
    expect(source).toContain("return { item: resources.selectedTemplate, kind: 'template' as const };");
    expect(source).not.toContain('setResourceSection: () => undefined');
  });

  it('syncs the browser URL to the current short deep link state', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');

    expect(source).toContain('buildIndexDeepLinkUrl');
    expect(source).toContain('shouldSyncIndexDeepLinkUrl');
    expect(source).toContain('initialResourceDeepLinkHandled');
    expect(source).toContain('const handleInitialResourceDeepLinkHandled = useCallback(() => {');
    expect(source).toContain('onInitialResourceDeepLinkHandled: handleInitialResourceDeepLinkHandled');
    expect(source).toContain('if (!canSyncCurrentDeepLinkUrl || !currentDeepLinkUrl');
    expect(source).toContain('handleCopyCurrentAddress');
    expect(source).toContain('copyToClipboard');
    expect(source).toContain('window.history.replaceState');
    expect(source).toContain('activeProjectId: workspace.activeProjectId');
    expect(source).toContain('resourceType: \'prototype\'');
    expect(source).toContain('resourceType: \'doc\'');
    expect(source).toContain('resourceType: \'theme\'');
  });

  it('keeps prototype page selection separate from the selected prototype resource', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');

    expect(source).toContain('const [selectedPrototypePageId, setSelectedPrototypePageId] = useState<string | null>(null);');
    expect(source).toContain('selectedPrototypePageId,');
    expect(source).toContain('setSelectedPrototypePageId,');
    expect(source).toContain('selectedPageId: selectedPrototypePageId');
    expect(source).toContain('onPrototypePageChange: setSelectedPrototypePageId');
    expect(source).toContain('if (contentMode === \'preview\' && selectedItem)');
    expect(source).toContain('pageId: selectedPrototypePageId || undefined');
  });

  it('merges runtime prototype route info into workspace state before syncing the selected page', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');

    expect(source).toContain('workspace.setData');
    expect(source).toContain('setSelectedItem((previous) =>');
    expect(source).toContain('item.name !== selectedItem.name');
    expect(source).toContain('pages: nextPages');
    expect(source).toContain('defaultPageId: normalizePrototypeRoutePageId(routeInfo.defaultPageId) || nextPages[0]?.id || \'\'');
    expect(source).toContain('resolveSelectedPrototypePageAfterRouteInfo');
    expect(source).toContain('setSelectedPrototypePageId((previousPageId) =>');
    expect(source).not.toContain('setSelectedPrototypePageId(normalizePrototypeRoutePageId(routeInfo.activePageId) || null)');
    expect(source).toContain('onPrototypeRouteInfo:');
  });

  it('does not reload the sidebar tree on every workspace object identity change', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const ensureEffectStart = source.indexOf('workspace.ensureSidebarTreeLoaded(sidebarTab);');
    const ensureEffectEnd = source.indexOf('});', ensureEffectStart);
    const ensureEffectSource = source.slice(ensureEffectStart, ensureEffectEnd);

    expect(ensureEffectStart).toBeGreaterThan(-1);
    expect(ensureEffectSource).toContain('workspace.ensureSidebarTreeLoaded');
    expect(ensureEffectSource).not.toContain('[sidebarTab, workspace]');
  });

  it('retries loading the current sidebar tree after the initial workspace loading completes', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const ensureEffectStart = source.indexOf('workspace.ensureSidebarTreeLoaded(sidebarTab);');
    const ensureEffectEnd = source.indexOf('});', ensureEffectStart);
    const ensureEffectSource = source.slice(ensureEffectStart, ensureEffectEnd);

    expect(ensureEffectStart).toBeGreaterThan(-1);
    expect(ensureEffectSource).toContain('workspace.loading');
    expect(ensureEffectSource).toContain('[sidebarTab, workspace.ensureSidebarTreeLoaded, workspace.loading]');
  });

  it('labels current project dev startup as client startup', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');

    expect(source).toContain("messageApi.loading('正在启动客户端...', 0)");
    expect(source).toContain("payload?.reused ? '客户端已在运行' : '客户端已启动'");
    expect(source).toContain("error?.message || '启动客户端失败'");
    expect(source).not.toContain('正在启动服务器...');
    expect(source).not.toContain('服务器已启动');
  });

  it('keeps the desktop preview workspace available in narrow desktop browser panes', () => {
    const styles = readFileSync(resolve(__dirname, './styles/index-page.css'), 'utf8');

    expect(styles).toContain('@media (max-width: 640px)');
    expect(styles).toContain('@media (min-width: 641px)');
    expect(styles).not.toContain('@media (max-width: 768px)');
    expect(styles).not.toContain('@media (min-width: 769px)');
  });

  it('destructures the initial create dialog tab before passing it to dialogs', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const createDialogHookStart = source.indexOf('} = useCreateDialog(activeTab, workspace.data);');
    const createDialogHookSource = source.slice(
      source.lastIndexOf('const {', createDialogHookStart),
      createDialogHookStart,
    );
    const dialogsPropsStart = source.indexOf('const dialogsProps = {');
    const dialogsPropsEnd = source.indexOf('const presentationProps = useIndexPagePresentationPropsBuilder', dialogsPropsStart);
    const dialogsPropsSource = source.slice(dialogsPropsStart, dialogsPropsEnd);

    expect(createDialogHookStart).toBeGreaterThan(-1);
    expect(createDialogHookSource).toContain('initialCreateDialogTab,');
    expect(dialogsPropsSource).toContain('initialTab: initialCreateDialogTab,');
  });

  it('connects the hidden Admin bridge while a Web Agent panel is open', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');

    expect(source).toContain('const assistantVisible = assistantController.assistantVisible;');
    expect(source).toContain('if (assistantVisible) {');
    expect(source).toContain('connectBridge();');
    expect(source).toContain('disconnectBridge();');
    expect(source).not.toContain('onBridgeToggle: bridge.toggle');
  });

  it('clears OpenCode bridge context before disconnecting the Web Agent panel', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const effectStart = source.indexOf('if (assistantVisible) {');
    const effectEnd = source.indexOf('}, [assistantVisible, connectBridge, clearBridgeContext, disconnectBridge]);', effectStart);
    const effectSource = source.slice(effectStart, effectEnd);

    expect(effectStart).toBeGreaterThan(-1);
    expect(effectEnd).toBeGreaterThan(effectStart);
    expect(source).toContain('const clearBridgeContext = bridge.clearContext;');
    expect(effectSource).toContain('clearBridgeContext();');
    expect(effectSource.indexOf('clearBridgeContext();')).toBeLessThan(effectSource.indexOf('disconnectBridge();'));
  });

  it('does not expose a dedicated canvas OpenCode WebUI opener', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const genieStart = source.indexOf('const handleOpenCanvasGenie = useCallback(async () =>');
    const genieEnd = source.indexOf('const switchProjectWithReturnTarget', genieStart);
    const genieSource = source.slice(genieStart, genieEnd);

    expect(source).not.toContain('handleOpenCanvasOpenCode');
    expect(source).not.toContain('onOpenCanvasOpenCode');
    expect(source).not.toContain("assistantController.handleOpenGenieWebAgent(undefined, 'opencode')");
    expect(genieStart).toBeGreaterThan(-1);
    expect(genieEnd).toBeGreaterThan(genieStart);
    expect(genieSource).not.toContain('canvasFilePath');
    expect(genieSource).toContain('handleOpenGenieWebAgent()');
  });

  it('syncs canvas annotation comments with the assistant current file path', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const effectStart = source.indexOf('// Auto-sync annotations to bridge context');
    const effectEnd = source.indexOf('// Handle "open in editor" from canvas embed toolbar', effectStart);
    const effectSource = source.slice(effectStart, effectEnd);

    expect(effectStart).toBeGreaterThan(-1);
    expect(effectEnd).toBeGreaterThan(effectStart);
    expect(effectSource).toContain('syncAssistantCanvasComments(canvasAnnotations, assistantCurrentFilePath);');
    expect(effectSource).not.toContain('syncAssistantCanvasComments(canvasAnnotations, currentFilePath);');
  });

  it('auto-opens cached online open methods once after initial preferences load', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');

    expect(source).toContain("import { parseOpenMethod, type OpenMethod } from '../../common/ide';");
    expect(source).toContain('buildAssistantAutoOpenDismissedStorageKey');
    expect(source).toContain('getAssistantAutoOpenDismissed');
    expect(source).toContain('setAssistantAutoOpenDismissed');
    expect(source).toContain("import type { GenieProvider } from '@/common/genie/types';");
    expect(source).toContain("import { getAssistantContextCurrentFilePath } from '../utils/genieContext';");
    expect(source).toContain('const onlineOpenAutoTriggeredRef = useRef(false);');
    expect(source).toContain('const resolveCachedOnlineOpenProvider = (method: OpenMethod): GenieProvider | undefined | null => {');
    expect(source).toContain("if (method.type !== 'web') {");
    expect(source).toContain("if (method.value === 'genie') {");
    expect(source).toContain("if (method.value === 'claude' || method.value === 'codex' || method.value === 'gemini' || method.value === 'opencode') {");
    expect(source).toContain('const assistantCurrentFilePath = getAssistantContextCurrentFilePath(assistantController.assistantContextV1);');
    expect(source).toContain('const assistantAutoOpenTargetPath = assistantCurrentFilePath');
    expect(source).toContain('const assistantAutoOpenDismissedStorageKey = useMemo(() => (');
    expect(source).toContain('buildAssistantAutoOpenDismissedStorageKey(assistantAutoOpenProjectScope)');
    expect(source).toContain('const handleOpenGenieWebAgent = useCallback((targetPath?: string, provider?: GenieProvider) => {');
    expect(source).toContain('setAssistantAutoOpenDismissed(buildAssistantAutoOpenKeyForTarget(targetPath), false);');
    expect(source).toContain('const handleCloseWebAgentPanel = useCallback(() => {');
    expect(source).toContain('setAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey, true);');
    expect(source).toContain("if (!preferences.initialPreferencesLoaded || onlineOpenAutoTriggeredRef.current) {");
    expect(source).toContain('const cachedOpenMethod = parseOpenMethod(preferences.preferredIDE);');
    expect(source).toContain('const cachedOnlineProvider = cachedOpenMethod ? resolveCachedOnlineOpenProvider(cachedOpenMethod) : null;');
    expect(source).toContain('if (!assistantAutoOpenTargetPath) {');
    expect(source).toContain('if (getAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey)) {');
    expect(source).toContain('onlineOpenAutoTriggeredRef.current = true;');
    expect(source).toContain('assistantController.handleOpenGenieWebAgent(assistantAutoOpenTargetPath, cachedOnlineProvider);');
    expect(source).toContain('onCloseWebAgentPanel: handleCloseWebAgentPanel,');
    expect(source).not.toContain('assistantController.handleOpenGenieWebAgent(undefined, cachedOnlineProvider);');
    expect(source).toContain('assistantAutoOpenDismissedStorageKey,');
    expect(source).toContain('initialResourceDeepLink,');
    expect(source).toContain('preferences.initialPreferencesLoaded,');

    const autoOpenEffectStart = source.indexOf('if (!preferences.initialPreferencesLoaded || onlineOpenAutoTriggeredRef.current) {');
    const autoOpenEffectEnd = source.indexOf('assistantController.handleOpenGenieWebAgent(assistantAutoOpenTargetPath, cachedOnlineProvider);', autoOpenEffectStart);
    const autoOpenEffectSource = source.slice(autoOpenEffectStart, autoOpenEffectEnd);

    expect(autoOpenEffectSource).toContain('if (initialResourceDeepLink) {');
    expect(autoOpenEffectSource.indexOf('if (initialResourceDeepLink) {'))
      .toBeLessThan(autoOpenEffectSource.indexOf('if (cachedOnlineProvider === null) {'));
    expect(autoOpenEffectSource.indexOf('if (cachedOnlineProvider === null) {'))
      .toBeLessThan(autoOpenEffectSource.indexOf('if (!assistantAutoOpenTargetPath) {'));
    expect(autoOpenEffectSource.indexOf('if (!assistantAutoOpenTargetPath) {'))
      .toBeLessThan(autoOpenEffectSource.indexOf('if (getAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey)) {'));
    expect(autoOpenEffectSource.indexOf('if (getAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey)) {'))
      .toBeLessThan(autoOpenEffectSource.indexOf('onlineOpenAutoTriggeredRef.current = true;'));
  });
});
