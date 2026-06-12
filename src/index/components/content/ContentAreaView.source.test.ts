import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readContentAreaViewSource() {
  return readFileSync(resolve(__dirname, './ContentAreaView.tsx'), 'utf8');
}

function readCanvasAiSceneRegistrySource() {
  return readFileSync(resolve(__dirname, '../../domains/ai-generation/canvasAiSceneRegistry.ts'), 'utf8');
}

function getSourceSegment(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('ContentAreaView review zoom source', () => {
  it('wraps both canvas render paths in a scoped error boundary', () => {
    const source = readContentAreaViewSource();
    const standaloneCanvasBranch = getSourceSegment(
      source,
      "if (contentMode === 'canvas') {",
      '    return (\n        <div\n            ref={containerRef}',
    );
    const prototypeCanvasBranch = getSourceSegment(
      source,
      ") : viewMode === 'canvas' ? (",
      ") : (",
    );

    expect(source).toContain('class CanvasErrorBoundary extends React.Component');
    expect(source).toContain('static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState');
    expect(source).toContain("console.error('[Axhub Make] Canvas render failed', error, errorInfo);");
    expect(source).not.toContain('data-canvas-error');
    expect(source).toContain('import.meta.env.DEV');
    expect(source).toContain('__AXHUB_CANVAS_RENDER_ERROR__');
    expect(source).toContain('componentDidUpdate(prevProps: CanvasErrorBoundaryProps)');
    expect(source).toContain('if (prevProps.resetKey !== this.props.resetKey && this.state.hasError)');
    expect(source).toContain('画布加载失败');
    expect(source).toContain('请刷新页面，或切换到其他画布后再回来重试。');
    expect(source).not.toContain('草稿加载失败');
    expect(source).not.toContain('请刷新页面，或切换到其他草稿后再回来重试。');
    expect(standaloneCanvasBranch).toContain('<CanvasErrorBoundary resetKey={selectedCanvas.name}>');
    expect(standaloneCanvasBranch).toContain('</CanvasErrorBoundary>');
    expect(prototypeCanvasBranch).toContain('<CanvasErrorBoundary resetKey={selectedPrototypeCanvasName}>');
    expect(prototypeCanvasBranch).toContain('</CanvasErrorBoundary>');
  });

  it('uses draft wording for the standalone canvas empty state', () => {
    const source = readContentAreaViewSource();
    const standaloneCanvasBranch = getSourceSegment(
      source,
      "if (contentMode === 'canvas') {",
      '        return (\n            <div className="h-full min-h-0 relative bg-background">',
    );

    expect(standaloneCanvasBranch).toContain('请从左侧选择或新建一个画布');
    expect(standaloneCanvasBranch).not.toContain('请从左侧选择或新建一个草稿');
  });

  it('forwards theme lists and default design into the canvas', () => {
    const source = readContentAreaViewSource();
    const propsSegment = getSourceSegment(
      source,
      'export default function ContentArea({',
      '}: ContentAreaProps)',
    );

    expect(propsSegment).toContain('themes,');
    expect(propsSegment).toContain('defaultThemeName,');
    expect(source).toContain('themes={themes}');
    expect(source).toContain('defaultThemeName={defaultThemeName}');
  });

  it('shows a copyable AI prompt action for make client startup failures in both empty states', () => {
    const source = readContentAreaViewSource();
    const projectEmptyStateSegment = getSourceSegment(
      source,
      'function ProjectContentEmptyState({',
      'function ClientPreviewUnavailableState({',
    );
    const previewUnavailableSegment = getSourceSegment(
      source,
      'function ClientPreviewUnavailableState({',
      'function PrototypeClientUnavailableState',
    );

    expect(source).toContain('onCopyStartServerErrorPrompt?: () => void | Promise<void>;');
    expect(projectEmptyStateSegment).toContain('onCopyStartServerErrorPrompt');
    expect(projectEmptyStateSegment).toContain('复制给 AI 处理');
    expect(projectEmptyStateSegment).toContain('startServerError && onCopyStartServerErrorPrompt');
    expect(previewUnavailableSegment).toContain('onCopyStartServerErrorPrompt');
    expect(previewUnavailableSegment).toContain('复制给 AI 处理');
    expect(previewUnavailableSegment).toContain('startServerError && onCopyStartServerErrorPrompt');
  });

  it('reuses the client unavailable state when the runtime proxy reports an unavailable preview document', () => {
    const source = readContentAreaViewSource();

    expect(source).toContain("payload.type !== 'axhub:runtime-unavailable'");
    expect(source).toContain('setRuntimeUnavailablePreviewPath(requestPath)');
    expect(source).toContain("runtimeUnavailablePathMatchesResource(runtimeUnavailablePreviewPath, 'prototypes', selectedItem?.name)");
    expect(source).toContain("runtimeUnavailablePathMatchesResource(runtimeUnavailablePreviewPath, 'themes', selectedTheme?.name)");
    expect(source).toContain('const selectedPrototypeClientUnavailable = selectedPrototypeRuntimeUnavailable || (');
    expect(source).toContain('const selectedThemeClientUnavailable = selectedThemeRuntimeUnavailable || (');
  });

  it('renders the prototype placeholder from the shared scene registry with start-specific prompt quick inputs', () => {
    const source = readContentAreaViewSource();
    const registrySource = readCanvasAiSceneRegistrySource();
    const placeholderGuideSegment = getSourceSegment(
      source,
      'function PrototypePlaceholderGuide({',
      'export default function ContentArea({',
    );

    expect(source).toContain("import { Segmented } from 'antd';");
    expect(source).not.toContain("import '../../domains/ai-image/AiImageGenerationComposer.css';");
    expect(source).toContain('CANVAS_AI_SCENE_OPTIONS');
    expect(source).toContain('getCanvasAiPrototypeStartPlaceholders');
    expect(source).toContain('getCanvasAiPrototypeStartQuickPrompts');
    expect(source).toContain('getCanvasAiPrototypeStartSystemPrompt');
    expect(source).toContain('getCanvasAiSceneDefinition');
    expect(source).toContain('pickCanvasAiPrototypeStartPlaceholder');
    expect(source).toContain("import { createCanvasGenerationComposerDraftStorageKey } from '../../domains/shared/canvasGenerationComposerDraft';");
    expect(source).toContain('CanvasGenerationDisplayComposer');
    expect(source).toContain('PrototypeStartSettingsPopover');
    expect(placeholderGuideSegment).toContain('我们先从哪里开始呢?');
    expect(placeholderGuideSegment).toContain('px-6 py-12');
    expect(placeholderGuideSegment).toContain('max-w-[960px]');
    expect(placeholderGuideSegment).toContain('mt-8 w-full');
    expect(placeholderGuideSegment).toContain('<Segmented');
    expect(placeholderGuideSegment).toContain('assistantProjectPath?: string;');
    expect(placeholderGuideSegment).toContain('assistantProjectPath,');
    for (const scene of ['页面', '设计图', '文档']) {
      expect(registrySource).toContain(scene);
    }
    expect(registrySource).not.toContain("label: '图表'");
    expect(registrySource).not.toContain("label: '其他'");
    expect(source).not.toContain("['页面', '设计稿', '文档', '图表', '其他']");
    expect(source).not.toContain('PROTOTYPE_PLACEHOLDER_SCENE_OPTIONS');
    expect(source).not.toContain('PROTOTYPE_PLACEHOLDER_QUICK_PROMPTS');
    expect(source).not.toContain('resolvePrototypePlaceholderScene');
    expect(source).not.toContain('上传设计稿');
    expect(placeholderGuideSegment).toContain('onSubmitPrototypeStartRequest');
    expect(placeholderGuideSegment).toContain('scene: activeScene');
    expect(placeholderGuideSegment).toContain('const activeSceneDefinition = getCanvasAiSceneDefinition(activeScene);');
    expect(placeholderGuideSegment).toContain('const activeStartPlaceholders = getCanvasAiPrototypeStartPlaceholders(activeScene);');
    expect(placeholderGuideSegment).toContain('const activeQuickPrompts = getCanvasAiPrototypeStartQuickPrompts(activeScene);');
    expect(placeholderGuideSegment).toContain('const activeStartSystemPrompt = getCanvasAiPrototypeStartSystemPrompt(activeScene);');
    expect(placeholderGuideSegment).toContain('const prototypeLocalContextRef = useMemo');
    expect(placeholderGuideSegment).toContain('paths: [prototypeIndexPath]');
    expect(placeholderGuideSegment).toContain("resourceType: 'prototype'");
    expect(placeholderGuideSegment).toContain('resourceId: item.name');
    expect(placeholderGuideSegment).toContain('const placeholderStartComposerDraftStorageKey = useMemo(() => (');
    expect(placeholderGuideSegment).toContain('createCanvasGenerationComposerDraftStorageKey([');
    expect(placeholderGuideSegment).toContain('assistantProjectPath || activeProjectId ||');
    expect(placeholderGuideSegment).toContain('item.name');
    expect(placeholderGuideSegment).toContain('prototypeIndexPath');
    expect(placeholderGuideSegment).toContain("'placeholder-start'");
    expect(placeholderGuideSegment).toContain('activeScene');
    expect(placeholderGuideSegment).toContain('pickCanvasAiPrototypeStartPlaceholder(activeScene)');
    expect(placeholderGuideSegment).toContain('showSelectors');
    expect(placeholderGuideSegment).toContain('workspacePath={assistantProjectPath}');
    expect(placeholderGuideSegment).toContain('draftStorageKey={placeholderStartComposerDraftStorageKey}');
    expect(placeholderGuideSegment).toContain('onSubmit={(prompt, selection) => {');
    expect(placeholderGuideSegment).toContain('return onSubmitPrototypeStartRequest?.({');
    expect(placeholderGuideSegment).toContain("source: 'placeholder-start'");
    expect(placeholderGuideSegment).toContain('const promptWithStartSystemPrompt = appendCanvasAiPrototypeStartSystemPrompt(prompt, activeStartSystemPrompt);');
    expect(placeholderGuideSegment).toContain("activeScene === 'page'");
    expect(placeholderGuideSegment).toContain('appendPrototypeStartPromptSettings({');
    expect(placeholderGuideSegment).toContain('appendImageStartPromptSettings({');
    expect(placeholderGuideSegment).not.toContain('appendCanvasGenerationPromptSettings({');
    expect(placeholderGuideSegment).toContain('prompt: promptWithStartSystemPrompt,');
    expect(placeholderGuideSegment).toContain("localContextRefs: activeScene === 'page' ? [] : [prototypeLocalContextRef],");
    expect(placeholderGuideSegment).not.toContain('sceneSettings: activeScene === \'page\'');
    expect(placeholderGuideSegment).toContain('count: prototypeGenerationCount');
    expect(placeholderGuideSegment).toContain('themeName: selectedThemeName === NO_PROTOTYPE_THEME_VALUE ? \'\' : selectedTheme?.name || \'\'');
    expect(placeholderGuideSegment).toContain(": activeScene === 'design'");
    expect(placeholderGuideSegment).toContain('imageStartParams');
    expect(placeholderGuideSegment).toContain('settings: imageStartParams');
    expect(placeholderGuideSegment).toContain('provider: selection?.provider');
    expect(placeholderGuideSegment).toContain('model: selection?.model');
    expect(placeholderGuideSegment).toContain('mode: selection?.mode');
    expect(placeholderGuideSegment).toContain('thought: selection?.thought');
    expect(placeholderGuideSegment).toContain('contextBundle: selection?.contextBundle');
    expect(placeholderGuideSegment).toContain('quickPrompts={activeQuickPrompts}');
    expect(placeholderGuideSegment).toContain('postSelectorActions={');
    expect(placeholderGuideSegment).not.toContain('leadingActions={');
    expect(placeholderGuideSegment).toContain("activeScene === 'page' ? (");
    expect(placeholderGuideSegment).toContain("activeScene === 'design' ? (");
    expect(placeholderGuideSegment).toContain('ImageStartSettingsPopover');
    expect(placeholderGuideSegment).toContain('w-full pt-24');
    expect(placeholderGuideSegment).not.toContain('onClick={() => onSubmitPrototypeStartRequest?.({');
    expect(placeholderGuideSegment).not.toContain('mt-5 flex flex-wrap items-center justify-center gap-2');
    expect(placeholderGuideSegment).not.toContain('rounded-md border border-slate-200 bg-white px-3.5');
    expect(placeholderGuideSegment).not.toContain('rounded-full border border-slate-200 bg-white px-4');
    expect(placeholderGuideSegment).not.toContain('shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50');
    expect(placeholderGuideSegment).not.toContain('打开画布创作原型');
    expect(placeholderGuideSegment).not.toContain('新手对话技巧');
    expect(placeholderGuideSegment).toContain('variant="inline-app-list"');
    expect(placeholderGuideSegment).toContain('targetPath={prototypeIndexPath}');
  });

  it('uses ACP selector-sized icons for prototype start settings triggers only', () => {
    const source = readContentAreaViewSource();

    expect(source).toContain('data-axhub-prototype-start-settings-trigger');
    expect(source).toContain('data-axhub-image-start-settings-trigger');
    expect(source).toContain('<SlidersHorizontal className="size-3.5 shrink-0" aria-hidden="true" />');
    expect(source).toContain('<ChevronDown className="size-3 shrink-0" aria-hidden="true" />');
  });

  it('uses the searchable design system selector in prototype start settings', () => {
    const source = readContentAreaViewSource();

    expect(source).toContain("import { PrototypeThemeSearchSelect } from '../../domains/prototype-generation/PrototypeThemeSearchSelect';");
    expect(source).toContain('<PrototypeThemeSearchSelect');
    expect(source).toContain('themes={themes}');
    expect(source).toContain('value={selectedThemeName}');
    expect(source).toContain('onValueChange={onThemeChange}');
    expect(source).not.toContain('<span className="text-xs font-medium text-muted-foreground">设计系统</span>\n                            <Select value={selectedThemeName}');
  });

  it('uses the project default design for prototype start settings until the user picks one', () => {
    const source = readContentAreaViewSource();
    const placeholderGuideSegment = getSourceSegment(
      source,
      'function PrototypePlaceholderGuide({',
      'export default function ContentArea({',
    );

    expect(source).toContain('defaultThemeName?: string | null;');
    expect(placeholderGuideSegment).toContain('defaultThemeName,');
    expect(placeholderGuideSegment).toContain('resolvePrototypeGenerationInitialThemeName(themes, defaultThemeName)');
    expect(placeholderGuideSegment).toContain('const previousDefaultThemeNameRef = useRef(defaultThemeName);');
    expect(placeholderGuideSegment).toContain('const userSelectedThemeRef = useRef(false);');
    expect(placeholderGuideSegment).toContain('previousDefaultThemeName,');
    expect(placeholderGuideSegment).toContain('userSelectedTheme: userSelectedThemeRef.current');
    expect(placeholderGuideSegment).toContain('defaultThemeName, themes');
    expect(placeholderGuideSegment).toContain('onThemeChange={(themeName) => {');
    expect(placeholderGuideSegment).toContain('userSelectedThemeRef.current = true;');
    expect(placeholderGuideSegment).toContain('setSelectedThemeName(themeName);');
  });

  it('keeps page placeholder start submissions in preview while dispatching through sidebar chat', () => {
    const source = readContentAreaViewSource();
    const submitHandlerSegment = getSourceSegment(
      source,
      'const handleSubmitPrototypeStartRequest = async (request: CanvasAiGenerationRequest) => {',
      'const selectedPrototypeRuntimeUnavailable = viewMode === \'demo\'',
    );

    expect(source).toContain('CanvasAiGenerationRequest');
    expect(source).toContain('onSubmitCanvasAssistantPrompt?: (request: CanvasAiGenerationRequest) => Promise<boolean> | boolean;');
    expect(source).toContain('const handleSubmitPrototypeStartRequest = async (request: CanvasAiGenerationRequest) => {');
    expect(submitHandlerSegment).toContain("if (request.scene === 'page' && selectedItem?.name)");
    expect(submitHandlerSegment).not.toContain("if ((request.scene === 'page' || request.scene === 'design') && selectedItem?.name)");
    expect(submitHandlerSegment).toContain('await apiService.startPlaceholderPrototypeGeneration(selectedItem.name);');
    expect(submitHandlerSegment).toContain('await onRefreshPrototypes?.();');
    expect(submitHandlerSegment).toContain("setViewMode?.('demo');");
    expect(submitHandlerSegment).toContain('return;');
    expect(submitHandlerSegment).toContain("setViewMode?.('canvas');");
    expect(submitHandlerSegment).toContain('await onSubmitCanvasAssistantPrompt?.(request);');
    expect(submitHandlerSegment.indexOf('await apiService.startPlaceholderPrototypeGeneration(selectedItem.name);'))
      .toBeLessThan(submitHandlerSegment.indexOf("setViewMode?.('demo');"));
    expect(submitHandlerSegment.indexOf("setViewMode?.('demo');"))
      .toBeLessThan(submitHandlerSegment.indexOf('await onSubmitCanvasAssistantPrompt?.(request);'));
    expect(submitHandlerSegment.indexOf('await onSubmitCanvasAssistantPrompt?.(request);'))
      .toBeLessThan(submitHandlerSegment.indexOf('return;'));
    expect(submitHandlerSegment.indexOf('return;'))
      .toBeLessThan(submitHandlerSegment.indexOf("setViewMode?.('canvas');"));
    expect(source).not.toContain('const [pendingCanvasAiGenerationRequest, setPendingCanvasAiGenerationRequest] = useState<CanvasAiGenerationRequest | null>(null);');
    expect(source).not.toContain('const submitSceneDefinition = getCanvasAiSceneDefinition(request.scene);');
    expect(source).not.toContain("if (submitSceneDefinition.submitMode === 'assistant-chat')");
    expect(source).not.toContain('setPendingCanvasAiGenerationRequest(request);');
    expect(source).toContain('onSubmitPrototypeStartRequest={handleSubmitPrototypeStartRequest}');
    expect(source).toContain('assistantProjectPath={assistantProjectPath}');
    expect(source).not.toContain('pendingAiGenerationRequest={pendingCanvasAiGenerationRequest}');
    expect(source).not.toContain('onPendingAiGenerationRequestConsumed={() => setPendingCanvasAiGenerationRequest(null)}');
  });

  it('keeps the placeholder start canvas empty while the sidebar owns generation', () => {
    const source = readContentAreaViewSource();
    const prototypeCanvasBranch = getSourceSegment(
      source,
      ") : viewMode === 'canvas' ? (",
      ") : (",
    );

    expect(prototypeCanvasBranch).not.toContain('pendingAiGenerationRequest=');
    expect(prototypeCanvasBranch).not.toContain('onPendingAiGenerationRequestConsumed=');
    expect(source).toContain('await onSubmitCanvasAssistantPrompt?.(request);');
  });

  it('passes sidebar-owned canvas AI submissions into both canvas render paths', () => {
    const source = readContentAreaViewSource();
    const standaloneCanvasBranch = getSourceSegment(
      source,
      "if (contentMode === 'canvas') {",
      '    return (\n        <div\n            ref={containerRef}',
    );
    const prototypeCanvasBranch = getSourceSegment(
      source,
      ") : viewMode === 'canvas' ? (",
      ") : (",
    );

    expect(standaloneCanvasBranch).toContain('onSubmitCanvasAssistantPrompt={onSubmitCanvasAssistantPrompt}');
    expect(prototypeCanvasBranch).toContain('onSubmitCanvasAssistantPrompt={onSubmitCanvasAssistantPrompt}');
    expect(source).not.toContain('onSubmitPrototypeAssistantPrompt={');
  });

  it('does not pass assistant artifact query callbacks into canvas render paths', () => {
    const source = readContentAreaViewSource();
    const standaloneCanvasBranch = getSourceSegment(
      source,
      "if (contentMode === 'canvas') {",
      '    return (\n        <div\n            ref={containerRef}',
    );
    const prototypeCanvasBranch = getSourceSegment(
      source,
      ") : viewMode === 'canvas' ? (",
      ") : (",
    );

    expect(source).not.toContain("import type { AssistantArtifactsQuery } from '../../domains/assistant/assistantArtifactBridge';");
    expect(source).not.toContain('getAssistantArtifacts?: AssistantArtifactsQuery;');
    expect(standaloneCanvasBranch).not.toContain('getAssistantArtifacts=');
    expect(prototypeCanvasBranch).not.toContain('getAssistantArtifacts=');
  });

  it('removes the prototype preview button from canvas overlays and forwards AI menu props', () => {
    const source = readContentAreaViewSource();
    const standaloneCanvasBranch = getSourceSegment(
      source,
      "if (contentMode === 'canvas') {",
      '    return (\n        <div\n            ref={containerRef}',
    );
    const prototypeCanvasBranch = getSourceSegment(
      source,
      ") : viewMode === 'canvas' ? (",
      ") : (",
    );

    expect(source).not.toContain('function CanvasPlayPrototypeButton');
    expect(source).not.toContain('<CanvasPlayPrototypeButton');
    expect(source).not.toContain('<Play />');
    expect(source).not.toContain('<span>预览</span>');

    for (const branch of [standaloneCanvasBranch, prototypeCanvasBranch]) {
      expect(branch).toContain('preferredIDE={preferredIDE}');
      expect(branch).toContain('ideAvailability={ideAvailability}');
      expect(branch).toContain('agentAvailability={agentAvailability}');
      expect(branch).toContain('onOpenGenieWebAgent={onOpenGenieWebAgent}');
      expect(branch).toContain('webAgentPanelOpen={webAgentPanelOpen}');
      expect(branch).toContain('onCloseWebAgentPanel={onCloseWebAgentPanel}');
      expect(branch).toContain('onPreferredIDEChange={onPreferredIDEChange}');
      expect(branch).not.toContain('onRefreshAvailability={onRefreshAvailability}');
      expect(branch).toContain('onOpenAISettings={onOpenAISettings}');
    }
    expect(prototypeCanvasBranch).toContain('overlayChildren={<CanvasFloatingToolbar />}');
    expect(prototypeCanvasBranch).not.toContain('showPrototypePreviewHint={canPlayPrototypePreview}');
  });

  it('uses host-side desktop review zoom without changing split or device preview paths', () => {
    const source = readContentAreaViewSource();
    const desktopBranch = getSourceSegment(
      source,
      ") : previewLayout.single.kind === 'desktop' ? (",
      ") : previewLayout.single.kind === 'custom' ? (",
    );

    expect(source).toContain('reviewPageZoomEnabled?: boolean;');
    expect(source).toContain('DEVICE_PRESET_SIZES');
    expect(source).toContain('const desktopReviewZoomLayout = useMemo');
    expect(source).toContain('reviewPageZoomEnabled && viewMode === \'demo\'');
    expect(source).toContain('DEVICE_PRESET_SIZES.desktop.width');
    expect(desktopBranch).toContain('desktopReviewZoomLayout.enabled');
    expect(desktopBranch).toContain('renderScaledIframe(');
    expect(desktopBranch).toContain('height: previewContainerSize.height');
    expect(desktopBranch).not.toContain('height: desktopReviewZoomLayout.viewportHeight');
    expect(desktopBranch).not.toContain('handleChangePreviewScaleMode');
    expect(source).not.toContain('reviewPageZoomEnabled && previewConfig.previewMode === \'split\'');
  });

  it('shows pane-scoped prompt buttons in split preview title bars only while quick edit is active', () => {
    const source = readContentAreaViewSource();
    const splitBranch = getSourceSegment(
      source,
      "previewLayout.mode === 'split' ? (",
      ") : previewLayout.single.kind === 'desktop' ? (",
    );

    expect(source).toContain("import { ChevronDown, Copy, ExternalLink, FileIcon, ImageIcon, Monitor, PencilRuler, Play, Rocket, SlidersHorizontal, Smartphone } from 'lucide-react';");
    expect(source).toContain('quickEditActive?: boolean;');
    expect(source).toContain("onRunPrototypePanePromptAction?: (pane: 'primary' | 'secondary', action: 'copy-prompt' | 'send-to-genie') => void | Promise<boolean>;");
    expect(source).toContain('const renderSplitPromptActions = (pane:');
    expect(source).toContain("title=\"复制本视窗提示词\"");
    expect(source).toContain("aria-label=\"复制本视窗提示词\"");
    expect(source).toContain("title=\"执行本视窗批注\"");
    expect(source).toContain("aria-label=\"执行本视窗批注\"");
    expect(source).toContain('quickEditActive && onRunPrototypePanePromptAction');
    expect(splitBranch).toContain("renderSplitPromptActions('primary')");
    expect(splitBranch).toContain("renderSplitPromptActions('secondary')");
  });

  it('routes multi-page preview through the dedicated canvas without changing split or single branches', () => {
    const source = readContentAreaViewSource();
    const multiPageBranch = getSourceSegment(
      source,
      "previewLayout.mode === 'multi-page' ? (",
      ") : previewLayout.mode === 'split' ? (",
    );

    expect(source).toContain("import MultiPagePreviewCanvas from './MultiPagePreviewCanvas';");
    expect(source).toContain('handleChangeMultiPageColumns: (columns: MultiPageColumns) => void;');
    expect(source).toContain('handleChangeMultiPageColumns,');
    expect(source).toContain('handleSelectPreviewSinglePreset,');
    expect(source).toContain('handleSelectCustomPreview,');
    expect(source).toContain('handleActivateMultiPagePreview,');
    expect(source).toContain('handleChangeCustomPreviewWidth,');
    expect(source).toContain('handleChangeCustomPreviewHeight,');
    expect(source).toContain('handleChangePreviewScaleMode,');
    expect(source).toContain("previewLayout.mode === 'split' || previewLayout.mode === 'multi-page' ? 'overflow-hidden' : 'overflow-auto'");
    expect(multiPageBranch).toContain('<MultiPagePreviewCanvas');
    expect(multiPageBranch).toContain('selectedItem={selectedItem}');
    expect(multiPageBranch).toContain('previewConfig={previewConfig}');
    expect(multiPageBranch).toContain('layout={previewLayout.multiPage}');
    expect(multiPageBranch).toContain('previewUrl={primaryIframeUrl}');
    expect(multiPageBranch).toContain('iframeKey={elementIframeKey}');
    expect(multiPageBranch).toContain('previewIframeRef={previewIframeRef}');
    expect(multiPageBranch).toContain('onPreviewIframeLoad={onPreviewIframeLoad}');
    expect(multiPageBranch).toContain('handleChangeMultiPageColumns={handleChangeMultiPageColumns}');
    expect(multiPageBranch).toContain('handleSelectPreviewSinglePreset={handleSelectPreviewSinglePreset}');
    expect(multiPageBranch).toContain('handleSelectCustomPreview={handleSelectCustomPreview}');
    expect(multiPageBranch).toContain('handleActivateMultiPagePreview={handleActivateMultiPagePreview}');
    expect(multiPageBranch).toContain('handleChangeCustomPreviewWidth={handleChangeCustomPreviewWidth}');
    expect(multiPageBranch).toContain('handleChangeCustomPreviewHeight={handleChangeCustomPreviewHeight}');
    expect(multiPageBranch).not.toContain('handleChangePreviewScaleMode={handleChangePreviewScaleMode}');
  });
});
