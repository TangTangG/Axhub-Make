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
    const preferencesCall = source.slice(
      source.indexOf('const preferences = useIndexPagePreferences'),
      source.indexOf('const assistantController = useAssistantPanelController'),
    );
    const assistantControllerCall = source.slice(
      source.indexOf('const assistantController = useAssistantPanelController'),
      source.indexOf('const preview = useIndexPagePreviewActions'),
    );

    expect(source).toContain('activeProjectId: workspace.activeProjectId,');
    expect(preferencesCall).toContain('activeProjectId: workspace.activeProjectId,');
    expect(preferencesCall).toContain('enabled: !workspace.loading,');
    expect(assistantControllerCall).toContain('activeProjectId: workspace.activeProjectId,');
  });

  it('passes current image generation settings into the assistant controller', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const assistantControllerCall = source.slice(
      source.indexOf('const assistantController = useAssistantPanelController'),
      source.indexOf('const syncAssistantCanvasComments = assistantController.syncAssistantCanvasComments'),
    );

    expect(source).toContain('assistantImageGenerationConfig: preferences.assistantImageGenerationConfig,');
    expect(assistantControllerCall).toContain('assistantImageGenerationConfig: preferences.assistantImageGenerationConfig,');
  });

  it('passes active project id into resource actions for docs writes', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const resourceActionsCall = source.slice(
      source.indexOf('const resources = useIndexPageResourceActions'),
      source.indexOf('const contentMode = useMemo'),
    );

    expect(resourceActionsCall).toContain('activeProjectId: workspace.activeProjectId,');
  });

  it('initializes preferences before passing preference values into preview actions', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const preferencesIndex = source.indexOf('const preferences = useIndexPagePreferences');
    const previewIndex = source.indexOf('const preview = useIndexPagePreviewActions');
    const previewPreferenceIndex = source.indexOf('preferredPromptClient: preferences.preferredPromptClient', previewIndex);

    expect(preferencesIndex).toBeGreaterThan(-1);
    expect(previewIndex).toBeGreaterThan(-1);
    expect(previewPreferenceIndex).toBeGreaterThan(previewIndex);
    expect(preferencesIndex).toBeLessThan(previewPreferenceIndex);
  });

  it('wires the project default design through preferences, sidebar, and presentation props', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const preferencesCall = source.slice(
      source.indexOf('const preferences = useIndexPagePreferences'),
      source.indexOf('const assistantController = useAssistantPanelController'),
    );
    const sidebarBuilderCall = source.slice(
      source.indexOf('const sidebarProps = useIndexPageSidebarPropsBuilder'),
      source.indexOf('const handleEnterSelectedPrototypePreview'),
    );
    const presentationBuilderCall = source.slice(
      source.indexOf('const presentationAreaProps = useIndexPagePresentationPropsBuilder'),
      source.indexOf('const handleMobileItemClick'),
    );

    expect(preferencesCall).toContain('setDefaultThemeName: resources.setDefaultThemeName,');
    expect(sidebarBuilderCall).toContain('defaultThemeName: resources.defaultThemeName,');
    expect(presentationBuilderCall).toContain('defaultThemeName: resources.defaultThemeName,');
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

  it('refreshes the currently selected prototype after canvas-side prototype reloads', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const refreshSource = source.slice(
      source.indexOf('const handleRefreshCanvasPrototypeItems = useCallback(async () => {'),
      source.indexOf('const presentationAreaProps = useIndexPagePresentationPropsBuilder', source.indexOf('const handleRefreshCanvasPrototypeItems = useCallback(async () => {')),
    );

    expect(refreshSource).toContain('let nextPrototypes: ItemData[] = workspace.data.prototypes;');
    expect(refreshSource).toContain('nextPrototypes = normalizeProjectResourcesPayload(payload, projectId).data.prototypes;');
    expect(refreshSource).toContain("const refreshedSelectedItem = selectedItem?.name");
    expect(refreshSource).toContain('nextPrototypes.find((item) => item.name === selectedItem.name)');
    expect(refreshSource).toContain('setSelectedItem(refreshedSelectedItem);');
    expect(refreshSource).toContain('return nextPrototypes;');
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

  it('builds and exposes a copyable AI prompt for current project startup failures', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const startHandlerSource = source.slice(
      source.indexOf('const handleStartCurrentProjectServer = async () => {'),
      source.indexOf('const handleOpenCanvasInIDE = useCallback', source.indexOf('const handleStartCurrentProjectServer = async () => {')),
    );
    const presentationBuilderCall = source.slice(
      source.indexOf('const presentationAreaProps = useIndexPagePresentationPropsBuilder'),
      source.indexOf('const handleMobileItemClick', source.indexOf('const presentationAreaProps = useIndexPagePresentationPropsBuilder')),
    );

    expect(source).toContain('buildMakeClientStartupFailurePrompt');
    expect(source).toContain('const [startServerErrorPrompt, setStartServerErrorPrompt]');
    expect(startHandlerSource).toContain('const diagnostic = error?.diagnostic || error;');
    expect(startHandlerSource).toContain('setStartServerErrorPrompt(buildMakeClientStartupFailurePrompt(diagnostic');
    expect(startHandlerSource).toContain('const handleCopyStartServerErrorPrompt = useCallback');
    expect(startHandlerSource).toContain("messageApi.success('已复制给 AI 的处理说明')");
    expect(presentationBuilderCall).toContain('handleCopyStartServerErrorPrompt,');
  });

  it('uses draft wording when opening the selected canvas file in an IDE', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const openCanvasSource = source.slice(
      source.indexOf('const handleOpenCanvasInIDE = useCallback'),
      source.indexOf('const handleOpenCanvasGenie = useCallback'),
    );

    expect(openCanvasSource).toContain('copyText: targetPath ? `[画布](${targetPath})` : undefined');
    expect(openCanvasSource).toContain("emptySelectionMessage: '当前画布文件路径不可用，无法在编辑器中打开'");
    expect(openCanvasSource).not.toContain('[草稿]');
    expect(openCanvasSource).not.toContain('当前草稿文件路径不可用');
  });

  it('submits canvas AI prompts with canvas context and request metadata', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const submitSource = source.slice(
      source.indexOf('const buildCanvasAssistantContext = useCallback'),
      source.indexOf('const switchProjectWithReturnTarget', source.indexOf('const buildCanvasAssistantContext = useCallback')),
    );

    expect(source).toContain('resolveAssistantCurrentFile');
    expect(submitSource).toContain("const canvasFilePath = String(request.canvasFilePath || '').trim();");
    expect(submitSource).toContain("const isPrototypePlaceholderStart = request.source === 'placeholder-start' && request.scene === 'page';");
    expect(submitSource).toContain("const isDesignPlaceholderStart = request.source === 'placeholder-start' && request.scene === 'design';");
    expect(submitSource).toContain('const canvasCurrentFile = canvasFilePath');
    expect(submitSource).toContain("path: canvasFilePath");
    expect(submitSource).toContain("displayName: canvasFilePath.split('/').filter(Boolean).pop() || 'canvas.excalidraw'");
    expect(submitSource).toContain('const currentFile = isPrototypePlaceholderStart');
    expect(submitSource).toContain('currentFile,');
    expect(submitSource).toContain("viewMode: isPrototypePlaceholderStart ? 'demo' : isDesignPlaceholderStart ? 'canvas' : 'canvas'");
    expect(submitSource).toContain('canvasAiGeneration: {');
    expect(submitSource).toContain('scene: request.scene');
    expect(submitSource).toContain('source: request.source || \'canvas-node\'');
    expect(submitSource).toContain('generatorId: request.generatorId');
    expect(submitSource).toContain('canvasFilePath: isPrototypePlaceholderStart ? undefined : request.canvasFilePath');
    expect(submitSource).toContain('referenceImages: request.referenceImages || []');
    expect(submitSource).toContain('localContextRefs: isPrototypePlaceholderStart ? [] : request.localContextRefs || []');
    expect(submitSource).toContain('provider: request.provider');
    expect(submitSource).toContain('model: request.model');
    expect(submitSource).toContain('mode: request.mode');
    expect(submitSource).toContain('thought: request.thought');
    expect(submitSource).toContain('contextBundle: request.contextBundle');
    expect(submitSource).not.toContain('sceneSettings: request.sceneSettings');
    expect(submitSource).toContain('buildCanvasAssistantContext(request)');
    expect(submitSource).toContain('const handleSubmitCanvasAssistantPrompt = useCallback');
    expect(submitSource).not.toContain('assistantController.assistantContextV1,');
  });

  it('keeps canvas generation currentFile values on the canvas file except prototype placeholder starts', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const submitSource = source.slice(
      source.indexOf('const buildCanvasAssistantContext = useCallback'),
      source.indexOf('const switchProjectWithReturnTarget', source.indexOf('const buildCanvasAssistantContext = useCallback')),
    );

    expect(submitSource).toContain("const canvasFilePath = String(request.canvasFilePath || '').trim();");
    expect(submitSource).toContain("const isPrototypePlaceholderStart = request.source === 'placeholder-start' && request.scene === 'page';");
    expect(submitSource).toContain("const isDesignPlaceholderStart = request.source === 'placeholder-start' && request.scene === 'design';");
    expect(submitSource).toContain('const placeholderStartCurrentFile = isPrototypePlaceholderStart');
    expect(submitSource).toContain('resolveAssistantCurrentFile({');
    expect(submitSource).toContain("viewMode: 'demo'");
    expect(submitSource).toContain("contentMode: 'preview'");
    expect(submitSource).toContain('const canvasCurrentFile = canvasFilePath');
    expect(submitSource).toContain('? placeholderStartCurrentFile');
    expect(submitSource).toContain("const currentFilePath = isPrototypePlaceholderStart ? getAssistantContextCurrentFilePath({ currentFile }) : canvasFilePath || getAssistantContextCurrentFilePath({ currentFile });");
    expect(submitSource).toContain("const currentFileDirectory = currentFilePath.replace(/\\/[^/]+$/u, '');");
    expect(submitSource).toContain("viewMode: isPrototypePlaceholderStart ? 'demo' : isDesignPlaceholderStart ? 'canvas' : 'canvas'");
    expect(submitSource).toContain("canvasFilePath: isPrototypePlaceholderStart ? undefined : request.canvasFilePath");
  });

  it('starts every canvas generation request in a fresh assistant thread', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const submitSource = source.slice(
      source.indexOf('const handleSubmitCanvasAssistantPrompt = useCallback'),
      source.indexOf('const switchProjectWithReturnTarget', source.indexOf('const handleSubmitCanvasAssistantPrompt = useCallback')),
    );

    expect(submitSource).toContain('buildCanvasAssistantContext(request)');
    expect(submitSource).toContain('request.prompt');
    expect(submitSource).toContain('{ forceNewThread: true }');
    expect(submitSource).not.toContain('forceNewAssistantThread');
  });

  it('shows a short startup warning when the Make state directory is not writable', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');

    expect(source).toContain("fetch('/api/make-state/health')");
    expect(source).toContain('MAKE_STATE_DIR_NOT_WRITABLE');
    expect(source).toContain("title: '无法保存项目列表'");
    expect(source).toContain("description: '本机数据目录不可写，新建项目可能失败。'");
    expect(source).toContain("confirmText: '复制给 AI 处理'");
    expect(source).toContain('buildMakeStatePermissionPrompt');
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

  it('tracks the requested settings tab before opening the settings dialog', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const dialogsSource = readFileSync(resolve(__dirname, '../components/app/IndexDialogs.tsx'), 'utf8');

    expect(source).toContain("import type { SettingsDialogAIContext, SettingsDialogInitialTab } from '../components/SettingsDialog';");
    expect(source).toContain("const [settingsDialogInitialTab, setSettingsDialogInitialTab] = useState<SettingsDialogInitialTab>('project');");
    expect(source).toContain('const [settingsDialogAIContext, setSettingsDialogAIContext] = useState<SettingsDialogAIContext | null>(null);');
    expect(source).toContain("const openSettingsDialog = useCallback((tab: SettingsDialogInitialTab = 'project', aiContext?: SettingsDialogAIContext | null) => {");
    expect(source).toContain('setSettingsDialogInitialTab(tab);');
    expect(source).toContain("setSettingsDialogAIContext(tab === 'ai' ? aiContext || null : null);");
    expect(source).toContain('setSettingsDialogOpen(true);');
    expect(source).toContain('openSettingsDialog,');
    expect(source).toContain('settingsDialogInitialTab,');
    expect(source).toContain('settingsDialogAIContext,');
    expect(dialogsSource).toContain('settingsDialogInitialTab: SettingsDialogInitialTab;');
    expect(dialogsSource).toContain('settingsDialogAIContext: SettingsDialogAIContext | null;');
    expect(dialogsSource).toContain('settingsDialogInitialTab,');
    expect(dialogsSource).toContain('settingsDialogAIContext,');
    expect(dialogsSource).toContain('initialTab={settingsDialogInitialTab}');
    expect(dialogsSource).toContain('initialAcpRuntime={settingsDialogAIContext?.runtime}');
    expect(dialogsSource).toContain('initialAcpFailureSource={settingsDialogAIContext?.failureSource}');
    expect(dialogsSource).toContain('initialAcpFailureMessage={settingsDialogAIContext?.failureMessage}');
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
    const genieEnd = source.indexOf('const buildCanvasAssistantContext = useCallback', genieStart);
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

  it('restores the assistant panel after refresh when it was left open for the project', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');

    expect(source).toContain('buildAssistantAutoOpenDismissedStorageKey');
    expect(source).toContain('getAssistantAutoOpenDismissed');
    expect(source).toContain('setAssistantAutoOpenDismissed');
    expect(source).toContain("import type { GenieProvider } from '@/common/genie/types';");
    expect(source).toMatch(/import\s+\{[^}]*getAssistantContextCurrentFilePath[^}]*\}\s+from '..\/utils\/genieContext';/s);
    expect(source).toContain("const onlineOpenAutoTriggeredRef = useRef('');");
    expect(source).toContain('const assistantCurrentFilePath = getAssistantContextCurrentFilePath(assistantController.assistantContextV1);');
    expect(source).toContain('const assistantAutoOpenTargetPath = assistantCurrentFilePath');
    expect(source).toContain('const assistantAutoOpenDismissedStorageKey = useMemo(() => (');
    expect(source).toContain('buildAssistantAutoOpenDismissedStorageKey(assistantAutoOpenProjectScope)');
    expect(source).toContain('const handleOpenGenieWebAgent = useCallback((targetPath?: string, provider?: GenieProvider) => {');
    expect(source).toContain('setAssistantAutoOpenDismissed(buildAssistantAutoOpenKeyForTarget(targetPath), false);');
    expect(source).toContain('setAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey, false);');
    expect(source.indexOf('setAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey, false);'))
      .toBeLessThan(source.indexOf('return assistantController.openAssistantWithContextAndSubmitPrompt(context, prompt'));
    expect(source).toContain('const handleCloseWebAgentPanel = useCallback(() => {');
    expect(source).toContain('setAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey, true);');
    expect(source).toContain('if (!preferences.initialPreferencesLoaded || !assistantAutoOpenTargetPath) {');
    expect(source).toContain('if (!assistantAutoOpenTargetPath) {');
    expect(source).toContain('if (getAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey)) {');
    expect(source).toContain('onlineOpenAutoTriggeredRef.current = autoOpenTargetKey;');
    expect(source).toContain('assistantController.restoreAssistantPanel(assistantAutoOpenTargetPath);');
    expect(source).toContain('onCloseWebAgentPanel: handleCloseWebAgentPanel,');
    expect(source).toContain('assistantAutoOpenDismissedStorageKey,');
    expect(source).toContain('preferences.initialPreferencesLoaded,');
    expect(source).not.toContain('parseOpenMethod(preferences.preferredIDE)');
    expect(source).not.toContain('resolveCachedOnlineOpenProvider');

    const autoOpenEffectStart = source.indexOf('if (!preferences.initialPreferencesLoaded || !assistantAutoOpenTargetPath) {');
    const autoOpenEffectEnd = source.indexOf('assistantController.restoreAssistantPanel(assistantAutoOpenTargetPath);', autoOpenEffectStart);
    const autoOpenEffectSource = source.slice(autoOpenEffectStart, autoOpenEffectEnd);

    expect(autoOpenEffectSource.indexOf('const autoOpenTargetKey = assistantAutoOpenTargetPath;'))
      .toBeLessThan(autoOpenEffectSource.indexOf('if (getAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey)) {'));
    expect(autoOpenEffectSource.indexOf('if (onlineOpenAutoTriggeredRef.current === autoOpenTargetKey) {'))
      .toBeLessThan(autoOpenEffectSource.indexOf('if (getAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey)) {'));
    expect(autoOpenEffectSource.indexOf('if (getAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey)) {'))
      .toBeLessThan(autoOpenEffectSource.indexOf('onlineOpenAutoTriggeredRef.current = autoOpenTargetKey;'));
  });

  it('keys assistant auto-open attempts by target path without retrying failed automatic starts', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const autoOpenEffectStart = source.indexOf('if (!preferences.initialPreferencesLoaded || !assistantAutoOpenTargetPath) {');
    const autoOpenEffectEnd = source.indexOf('}, [', autoOpenEffectStart);
    const autoOpenEffectSource = source.slice(autoOpenEffectStart, autoOpenEffectEnd);

    expect(autoOpenEffectStart).toBeGreaterThan(-1);
    expect(autoOpenEffectEnd).toBeGreaterThan(autoOpenEffectStart);
    expect(source).toContain("const onlineOpenAutoTriggeredRef = useRef('');");
    expect(autoOpenEffectSource).toContain('const autoOpenTargetKey = assistantAutoOpenTargetPath;');
    expect(autoOpenEffectSource).toContain('if (onlineOpenAutoTriggeredRef.current === autoOpenTargetKey) {');
    expect(autoOpenEffectSource).toContain('onlineOpenAutoTriggeredRef.current = autoOpenTargetKey;');
    expect(autoOpenEffectSource).toContain('assistantController.restoreAssistantPanel(assistantAutoOpenTargetPath);');
    expect(autoOpenEffectSource).not.toContain('onlineOpenAutoTriggeredRef.current = \'\';');
  });

  it('keeps the assistant panel closed on the prototype placeholder start page', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const autoOpenEffectStart = source.indexOf('if (!preferences.initialPreferencesLoaded || !assistantAutoOpenTargetPath) {');
    const autoOpenEffectEnd = source.indexOf('assistantController.restoreAssistantPanel(assistantAutoOpenTargetPath);', autoOpenEffectStart);
    const autoOpenEffectSource = source.slice(autoOpenEffectStart, autoOpenEffectEnd);
    const autoCloseEffectStart = source.indexOf('if (!prototypePlaceholderAutoCloseKey) {');
    const autoCloseEffectEnd = source.indexOf('}, [', autoCloseEffectStart);
    const autoCloseEffectSource = source.slice(autoCloseEffectStart, autoCloseEffectEnd);

    expect(source).toContain("const prototypePlaceholderActive = contentMode === 'preview' && viewMode === 'demo' && selectedItem?.placeholder === true;");
    expect(source).toContain('const prototypePlaceholderAutoCloseKey = prototypePlaceholderActive && selectedItem');
    expect(source).toContain("const closedPrototypePlaceholderAutoCloseKeyRef = useRef('');");
    expect(autoOpenEffectSource).toContain('if (prototypePlaceholderActive) {');
    expect(autoOpenEffectSource.indexOf('if (prototypePlaceholderActive) {'))
      .toBeLessThan(autoOpenEffectSource.indexOf('const autoOpenTargetKey = assistantAutoOpenTargetPath;'));
    expect(autoCloseEffectSource).toContain("closedPrototypePlaceholderAutoCloseKeyRef.current = '';");
    expect(autoCloseEffectSource).toContain('if (!assistantController.assistantVisible) {');
    expect(autoCloseEffectSource).toContain('if (closedPrototypePlaceholderAutoCloseKeyRef.current === prototypePlaceholderAutoCloseKey) {');
    expect(autoCloseEffectSource).toContain('closedPrototypePlaceholderAutoCloseKeyRef.current = prototypePlaceholderAutoCloseKey;');
    expect(autoCloseEffectSource.indexOf('if (!assistantController.assistantVisible) {'))
      .toBeLessThan(autoCloseEffectSource.indexOf('closedPrototypePlaceholderAutoCloseKeyRef.current = prototypePlaceholderAutoCloseKey;'));
    expect(autoCloseEffectSource).toContain('assistantController.hideAssistantPanelTemporarily();');
    expect(autoCloseEffectSource).not.toContain('setAssistantAutoOpenDismissed(');
    expect(autoCloseEffectSource).not.toContain('assistantController.handleToggleAssistant();');
  });

  it('restores a temporarily hidden assistant after leaving a prototype placeholder', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const restoreHiddenEffectStart = source.indexOf('if (!assistantController.assistantPanelMounted) {');
    const restoreHiddenEffectEnd = source.indexOf('}, [', restoreHiddenEffectStart);
    const restoreHiddenEffectSource = source.slice(restoreHiddenEffectStart, restoreHiddenEffectEnd);

    expect(restoreHiddenEffectStart).toBeGreaterThan(-1);
    expect(restoreHiddenEffectEnd).toBeGreaterThan(restoreHiddenEffectStart);
    expect(restoreHiddenEffectSource).toContain('if (prototypePlaceholderActive) {');
    expect(restoreHiddenEffectSource).toContain('if (prototypeWaitingGenerationActive) {');
    expect(restoreHiddenEffectSource).toContain('if (!assistantController.assistantPanelMounted) {');
    expect(restoreHiddenEffectSource).toContain('if (assistantController.assistantVisible) {');
    expect(restoreHiddenEffectSource).toContain('if (!assistantAutoOpenTargetPath) {');
    expect(restoreHiddenEffectSource).toContain('if (getAssistantAutoOpenDismissed(assistantAutoOpenDismissedStorageKey)) {');
    expect(restoreHiddenEffectSource).toContain('assistantController.restoreAssistantPanel(assistantAutoOpenTargetPath);');
    expect(restoreHiddenEffectSource).not.toContain('onlineOpenAutoTriggeredRef.current');
  });

  it('does not auto-open a closed mounted assistant panel after switching projects', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const projectScopeEffectStart = source.indexOf('const previousAssistantAutoOpenProjectScopeRef = useRef');
    const autoOpenEffectStart = source.indexOf('if (!preferences.initialPreferencesLoaded || !assistantAutoOpenTargetPath) {');
    const restoreHiddenEffectStart = source.indexOf('if (!assistantController.assistantPanelMounted) {');
    const projectScopeEffectSource = source.slice(projectScopeEffectStart, autoOpenEffectStart);
    const autoOpenEffectSource = source.slice(
      autoOpenEffectStart,
      source.indexOf('assistantController.restoreAssistantPanel(assistantAutoOpenTargetPath);', autoOpenEffectStart),
    );
    const restoreHiddenEffectSource = source.slice(
      restoreHiddenEffectStart,
      source.indexOf('assistantController.restoreAssistantPanel(assistantAutoOpenTargetPath);', restoreHiddenEffectStart),
    );
    const waitingEffectStart = source.indexOf('if (!prototypeWaitingGenerationActive) {');
    const waitingEffectSource = source.slice(
      waitingEffectStart,
      source.indexOf('void assistantController.restoreAssistantPanel(assistantAutoOpenTargetPath);', waitingEffectStart),
    );

    expect(projectScopeEffectStart).toBeGreaterThan(-1);
    expect(projectScopeEffectSource).toContain('const previousScope = previousAssistantAutoOpenProjectScopeRef.current;');
    expect(projectScopeEffectSource).toContain('if (previousScope && nextScope && previousScope !== nextScope && !assistantController.assistantVisible) {');
    expect(projectScopeEffectSource).toContain('assistantAutoOpenSuppressedProjectScopeRef.current = nextScope;');
    expect(autoOpenEffectSource).toContain('if (assistantAutoOpenSuppressedProjectScopeRef.current === assistantAutoOpenProjectScope) {');
    expect(restoreHiddenEffectSource).toContain('if (assistantAutoOpenSuppressedProjectScopeRef.current === assistantAutoOpenProjectScope) {');
    expect(waitingEffectSource).toContain('if (assistantAutoOpenSuppressedProjectScopeRef.current === assistantAutoOpenProjectScope) {');
  });

  it('opens the assistant panel for waiting prototype previews with the active target path', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const autoOpenEffectStart = source.indexOf('if (!preferences.initialPreferencesLoaded || !assistantAutoOpenTargetPath) {');
    const autoOpenEffectEnd = source.indexOf('assistantController.restoreAssistantPanel(assistantAutoOpenTargetPath);', autoOpenEffectStart);
    const autoOpenEffectSource = source.slice(autoOpenEffectStart, autoOpenEffectEnd);
    const waitingEffectStart = source.indexOf('if (!prototypeWaitingGenerationActive) {');
    const waitingEffectEnd = source.indexOf('}, [', waitingEffectStart);
    const waitingEffectSource = source.slice(waitingEffectStart, waitingEffectEnd);

    expect(source).toContain("const prototypeWaitingGenerationActive = contentMode === 'preview' && viewMode === 'demo' && selectedItem?.generationStatus === 'waiting' && selectedItem?.placeholder !== true;");
    expect(source).toContain('const prototypeWaitingGenerationAutoOpenKey = prototypeWaitingGenerationActive && selectedItem');
    expect(source).toContain("const openedPrototypeWaitingGenerationKeyRef = useRef('');");
    expect(autoOpenEffectSource).toContain('if (prototypeWaitingGenerationActive) {');
    expect(autoOpenEffectSource.indexOf('if (prototypeWaitingGenerationActive) {'))
      .toBeLessThan(autoOpenEffectSource.indexOf('const autoOpenTargetKey = assistantAutoOpenTargetPath;'));
    expect(waitingEffectStart).toBeGreaterThan(-1);
    expect(waitingEffectEnd).toBeGreaterThan(waitingEffectStart);
    expect(waitingEffectSource).toContain("openedPrototypeWaitingGenerationKeyRef.current = '';");
    expect(waitingEffectSource).toContain('if (!preferences.initialPreferencesLoaded) {');
    expect(waitingEffectSource).toContain('if (!prototypeWaitingGenerationAutoOpenKey) {');
    expect(waitingEffectSource).toContain('const waitingGenerationAutoOpenKey = prototypeWaitingGenerationAutoOpenKey;');
    expect(waitingEffectSource).toContain('if (openedPrototypeWaitingGenerationKeyRef.current === waitingGenerationAutoOpenKey) {');
    expect(waitingEffectSource).toContain('openedPrototypeWaitingGenerationKeyRef.current = waitingGenerationAutoOpenKey;');
    expect(waitingEffectSource).toContain('if (!assistantAutoOpenTargetPath) {');
    expect(waitingEffectSource.indexOf('if (!assistantAutoOpenTargetPath) {'))
      .toBeLessThan(waitingEffectSource.indexOf('openedPrototypeWaitingGenerationKeyRef.current = waitingGenerationAutoOpenKey;'));
    expect(source).toContain('assistantController.restoreAssistantPanel(assistantAutoOpenTargetPath);');
  });

  it('does not retry failed automatic assistant starts for waiting prototype previews', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const waitingEffectStart = source.indexOf('if (!prototypeWaitingGenerationActive) {');
    const waitingEffectEnd = source.indexOf('}, [', waitingEffectStart);
    const waitingEffectSource = source.slice(waitingEffectStart, waitingEffectEnd);

    expect(waitingEffectStart).toBeGreaterThan(-1);
    expect(waitingEffectEnd).toBeGreaterThan(waitingEffectStart);
    expect(waitingEffectSource).toContain('const waitingGenerationAutoOpenKey = prototypeWaitingGenerationAutoOpenKey;');
    expect(waitingEffectSource).toContain('openedPrototypeWaitingGenerationKeyRef.current = waitingGenerationAutoOpenKey;');
    expect(waitingEffectSource).toContain('assistantController.restoreAssistantPanel(assistantAutoOpenTargetPath);');
    expect(waitingEffectSource).not.toContain('then((opened) => {');
    expect(waitingEffectSource).not.toContain('if (!opened && openedPrototypeWaitingGenerationKeyRef.current === waitingGenerationAutoOpenKey) {');
  });

  it('passes assistant drag/drop and screenshot attachment handlers into the assistant panel and canvas', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');

    expect(source).toContain("import type { AssistantImageAttachmentPayload } from '../domains/assistant/assistantContextPayload';");
    expect(source).toContain('const handleAddCanvasScreenshotToAssistant = useCallback(async (attachment: AssistantImageAttachmentPayload) => {');
    expect(source).toContain('assistantController.addImageAttachment(attachment)');
    expect(source).toContain('const handleAddCanvasImageToAssistant = useCallback(async (attachment: AssistantImageAttachmentPayload, promptText?: string) => {');
    expect(source).toContain('const added = await assistantController.addImageAttachment(attachment);');
    expect(source).toContain('if (!added) return false;');
    expect(source).toContain('return assistantController.appendComposerText(prompt);');
    expect(source).toContain('onAddCanvasScreenshotToAI: handleAddCanvasScreenshotToAssistant,');
    expect(source).toContain('onAddCanvasImageToAI: handleAddCanvasImageToAssistant,');
    expect(source).toContain('onAddContextItems: assistantController.addContextItems,');
    expect(source).toContain('handleAddCanvasScreenshotToAssistant');
    expect(source).toContain('handleAddCanvasImageToAssistant');
    expect(source).toContain('onAddCanvasImageToAI');
  });

  it('does not pass assistant artifact queries into the canvas presentation path', () => {
    const source = readFileSync(resolve(__dirname, './IndexPage.tsx'), 'utf8');
    const presentationBuilderCall = source.slice(
      source.indexOf('const presentationAreaProps = useIndexPagePresentationPropsBuilder'),
      source.indexOf('const handleMobileItemClick', source.indexOf('const presentationAreaProps = useIndexPagePresentationPropsBuilder')),
    );

    expect(source).not.toContain('getAssistantArtifacts: assistantController.getAssistantArtifacts,');
    expect(presentationBuilderCall).not.toContain('getAssistantArtifacts');
  });
});
