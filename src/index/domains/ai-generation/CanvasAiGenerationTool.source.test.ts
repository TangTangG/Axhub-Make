import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readToolSource() {
  return readFileSync(resolve(__dirname, './CanvasAiGenerationTool.tsx'), 'utf8');
}

function readModelSource() {
  return readFileSync(resolve(__dirname, './canvasAiGeneration.ts'), 'utf8');
}

function readRegistrySource() {
  return readFileSync(resolve(__dirname, './canvasAiSceneRegistry.ts'), 'utf8');
}

describe('CanvasAiGenerationTool source', () => {
  it('keeps scene metadata while the canvas tool no longer creates AI placeholder nodes', () => {
    const toolSource = readToolSource();
    const modelSource = readModelSource();
    const registrySource = readRegistrySource();

    expect(modelSource).toContain("export const CANVAS_AI_GENERATION_CUSTOM_TYPE = 'axhub-ai-generation';");
    expect(modelSource).toContain('export const CANVAS_AI_GENERATION_TITLE = \'AI 生成\';');
    expect(toolSource).not.toContain('createCanvasAiGenerationElement');
    expect(toolSource).not.toContain('isCanvasAiGenerationElement');
    expect(toolSource).not.toContain('CANVAS_AI_GENERATOR_NODE_SCENE_OPTIONS');
    expect(toolSource).not.toContain("const CANVAS_AI_SCENE_OPTIONS");
    expect(registrySource).toContain('CANVAS_AI_SCENE_OPTIONS');
    for (const scene of ['page', 'design', 'document']) {
      expect(modelSource).toContain(`value === '${scene}'`);
    }
    expect(modelSource).toContain("if (value === 'image') return 'design';");
    expect(modelSource).not.toContain("if (value === 'design' || value === 'image') return 'page';");
    expect(registrySource).toContain("id: 'design'");
    expect(modelSource).toContain("if (value === 'chart' || value === 'other') return 'document';");
    expect(registrySource).toContain("label: '设计图'");
    expect(registrySource).not.toContain("renderSettings: 'image'");
    expect(registrySource).not.toContain("label: '图表'");
    expect(registrySource).not.toContain("label: '其他'");
    expect(toolSource).not.toContain("label: '设计稿'");
  });

  it('does not register AI generation insert events or old node composers', () => {
    const source = readToolSource();

    expect(source).not.toContain("AI_GENERATION_INSERT_EVENT_NAME");
    expect(source).not.toContain("axhub:insertAiGeneration");
    expect(source).not.toContain("document.addEventListener(AI_GENERATION_INSERT_EVENT_NAME");
    expect(source).not.toContain("document.removeEventListener(AI_GENERATION_INSERT_EVENT_NAME");
    expect(source).not.toContain("document.addEventListener('axhub:insertAiImageGenerator'");
    expect(source).not.toContain("document.addEventListener('axhub:insertPrototypeGenerator'");
    expect(source).not.toContain('legacy-ai-image');
    expect(source).not.toContain('legacy-prototype');
    expect(source).not.toContain('GenericCanvasAiGenerationComposer');
    expect(source).not.toContain('data-axhub-ai-generation-composer');
    expect(source).not.toContain('data-axhub-ai-generation-generator-selected');
    expect(source).toContain('referenceImages');
    expect(source).toContain('attachments');
    expect(source).toContain('source');
  });

  it('routes canvas start submissions through the direct API controller without old node composers', () => {
    const source = readToolSource();

    expect(source).not.toContain("import AiImageGenerationComposer from '../ai-image/AiImageGenerationComposer';");
    expect(source).not.toContain("import PrototypeGenerationComposer");
    expect(source).not.toContain('<AiImageGenerationComposer');
    expect(source).not.toContain('<PrototypeGenerationComposer');
    expect(source).not.toContain("selectedSceneDefinition.renderSettings === 'image'");
    expect(source).toContain('defaultThemeName?: string | null;');
    expect(source).toContain('defaultThemeName,');
    expect(source).toContain('preferredPromptClient?: PromptClientPreference;');
    expect(source).toContain('preferredPromptClient={preferredPromptClient}');
    expect(source).toContain('export interface CanvasAiGenerationResult {');
    expect(source).toContain('artifacts?: GenerationArtifactRecord[];');
    expect(source).toContain('onSubmitCanvasAssistantPrompt?: (request: CanvasAiGenerationRequest) => Promise<CanvasAiGenerationResult | boolean> | CanvasAiGenerationResult | boolean;');
    expect(source).toContain('const submitCanvasStartPrompt = useCallback(async (prompt: string, selection?: {');
    expect(source).toContain('createCanvasDirectRunController({');
    expect(source).toContain('const startResult = controller?.start(request);');
    expect(source).toContain('signal,');
    expect(source).toContain('onPrepared,');
    expect(source).toContain('onAccepted,');
    expect(source).toContain('canvasFilePath,');
    expect(source).toContain('const localContextRefs = selection?.localContextRefs || canvasStartLocalContextRefs;');
    expect(source).toContain('localContextRefs,');
    expect(source).toContain('statusTaskId: statusTask.id,');
    expect(source).not.toContain('statusTaskKind');
    expect(source).toContain('const attachments = selection?.attachments || [];');
    expect(source).toContain('attachments,');
    expect(source).toContain('referenceImages,');
    expect(source).toContain('appendCanvasGenerationPromptSettings({');
    expect(source).toContain('const sceneSettings = canvasStartScene === \'design\' ? canvasStartImageSettings : canvasStartScene === \'document\' ? canvasStartDocumentSettings : canvasStartPrototypeSettings;');
    expect(source).toContain('settings: sceneSettings,');
    expect(source).toContain('statusTaskBounds: {');
    expect(source).toContain('x: statusTask.x,');
    expect(source).toContain('y: statusTask.y,');
    expect(source).toContain('width: statusTask.width,');
    expect(source).toContain('height: statusTask.height,');
    expect(source).not.toContain("if (request.scene === 'page')");
  });

  it('requires a configured default AI provider before optimizing canvas start prompts', () => {
    const source = readToolSource();
    const optimizeSegment = source.slice(
      source.indexOf('const optimizeCanvasStartPrompt = useCallback'),
      source.indexOf('const submitCanvasStartPrompt = useCallback'),
    );

    expect(source).toContain("import { normalizePromptClientPreference } from '@/common/promptExecution';");
    expect(source).toContain("import { resolveAcpPromptClientProvider } from '@/common/acpModelConfig';");
    expect(optimizeSegment).toContain('if (!resolveAcpPromptClientProvider(normalizePromptClientPreference(preferredPromptClient))) {');
    expect(optimizeSegment).toContain("toast.warning('请先在 AI 设置中选择本地 AI Agent');");
    expect(optimizeSegment).toContain("throw { action: 'open-ai-settings' };");
    expect(optimizeSegment).toContain('return optimizeCanvasPrompt({');
    expect(optimizeSegment).toContain('preferredPromptClient,');
  });

  it('removes old selected-node composer UI and active status overlays', () => {
    const source = readToolSource();

    expect(source).not.toContain('GenericCanvasAiGenerationComposer');
    expect(source).not.toContain("selectedSceneDefinition.renderSettings === 'generic'");
    expect(source).not.toContain("selectedInfo.element.customData?.scene === 'document'");
    expect(source).not.toContain("selectedInfo.element.customData?.scene === 'chart'");
    expect(source).not.toContain("selectedInfo.element.customData?.scene === 'other'");
    expect(source).not.toContain('applyCanvasAiArtifactToElements');
    expect(source).not.toContain("data-axhub-ai-generation-composer");
    expect(source).not.toContain('data-axhub-ai-generation-generator-selected');
    expect(source).not.toContain('data-axhub-ai-image-generator-selected');
    expect(source).not.toContain('data-axhub-prototype-generator-selected');
    expect(source).not.toContain('generatorStatusOverlays.map');
    expect(source).not.toContain('stageLabel(overlay.task)');
    expect(source).not.toContain('formatElapsed(overlay.task)');
    expect(source).not.toContain('overlay.task.status === \'error\'');
  });

  it('scopes unsent composer drafts to the canvas start scene instead of selected AI nodes', () => {
    const source = readToolSource();

    expect(source).toContain('createCanvasGenerationComposerDraftStorageKey,');
    expect(source).toContain('readCanvasGenerationComposerDraft,');
    expect(source).toContain('writeCanvasGenerationComposerDraft,');
    expect(source).toContain('assistantProjectPath');
    expect(source).toContain('canvasFilePath');
    expect(source).toContain("'canvas-start'");
    expect(source).toContain('canvasStartScene');
    expect(source).toContain('draftStorageKey={canvasStartDraftStorageKey}');
    expect(source).not.toContain('selectedGeneratorComposerDraftStorageKey');
    expect(source).not.toContain("'canvas-node'");
    expect(source).toContain('onOpenAISettings,');
  });

  it('does not overwrite a newer canvas start draft when restoring a failed direct run', () => {
    const source = readToolSource();
    const submitCallbackIndex = source.indexOf('const submitCanvasStartPrompt = useCallback');
    const submitBody = source.slice(submitCallbackIndex, source.indexOf('const canvasStartSceneDefinition', submitCallbackIndex));

    expect(submitBody).toContain('const draftStorage = getCanvasGenerationComposerDraftStorage();');
    expect(submitBody).toContain('const currentDraft = readCanvasGenerationComposerDraft(draftStorage, canvasStartDraftStorageKey);');
    expect(submitBody).toContain('if (!currentDraft.trim()) {');
    expect(submitBody).toContain('writeCanvasGenerationComposerDraft(draftStorage, canvasStartDraftStorageKey, trimmedPrompt);');
    expect(submitBody).toContain('setCanvasStartDraftRestoreVersion((version) => version + 1);');
    expect(submitBody.indexOf('const currentDraft = readCanvasGenerationComposerDraft')).toBeLessThan(
      submitBody.indexOf('writeCanvasGenerationComposerDraft(draftStorage, canvasStartDraftStorageKey, trimmedPrompt);'),
    );
  });

  it('does not expose AI image detail or image-to-image creation entry points', () => {
    const source = readToolSource();

    expect(source).not.toContain("import AiImageDetailDialog from '../ai-image/AiImageDetailDialog';");
    expect(source).not.toContain('data-axhub-ai-image-detail-trigger');
    expect(source).not.toContain('handleOpenSelectedImageDetail');
    expect(source).not.toContain('handleCreateImageToImage');
    expect(source).not.toContain('handleCreateImageToPrototype');
    expect(source).not.toContain('<AiImageDetailDialog');
    expect(source).not.toContain('onCreateImageToImage=');
    expect(source).not.toContain('onCreateImageToPrototype=');
  });

  it('renders the scene switcher above the composer input instead of above the canvas element', () => {
    const source = readToolSource();

    expect(source).toContain("import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';");
    expect(source).not.toContain('const generatorSceneSwitcher = selectedGeneratorId ? (');
    expect(source).not.toContain('data-axhub-ai-generation-scene-switcher');
    expect(source).toContain('const canvasStartSceneSwitcher = (');
    expect(source).toContain('data-axhub-canvas-start-scene-switcher');
    expect(source).toContain('<ToggleGroup');
    expect(source).toContain('type="single"');
    expect(source).toContain('value={canvasStartScene}');
    expect(source).toContain('onValueChange={(nextScene) => {');
    expect(source).toContain('<ToggleGroupItem');
    expect(source).toContain('value={option.value}');
    expect(source).not.toContain('interface GeneratorSceneSwitcherPlacement');
    expect(source).not.toContain('generatorSceneSwitcherPlacement');
    expect(source).not.toContain('AI_GENERATION_SCENE_SWITCHER_OFFSET');
    expect(source).not.toContain('Math.max(8, topLeft.y - rect.top -');
    expect(source).not.toContain('<button\\n              key={option.value}');
  });

  it('does not pass quick prompts into the canvas start composer', () => {
    const source = readToolSource();

    expect(source).not.toContain('getCanvasAiSceneQuickPrompts');
    expect(source).not.toContain('quickPrompts=');
  });

  it('keeps image size presets within GPT Image 2 supported canvas constraints', () => {
    const source = readToolSource();

    expect(source).toContain("{ label: '自动', value: 'auto' }");
    expect(source).toContain("{ label: '手机整屏 768x1664', value: '768x1664' }");
    expect(source).toContain("{ label: '手机高清 1168x2528', value: '1168x2528' }");
    expect(source).toContain("{ label: 'PC 工作台 1440x896', value: '1440x896' }");
    expect(source).toContain("{ label: 'PC 高清 1920x1200', value: '1920x1200' }");
    expect(source).toContain("{ label: '方图 1024x1024', value: '1024x1024' }");
    expect(source).not.toContain("value: '1024x1536'");
    expect(source).not.toContain("value: '1152x2048'");
    expect(source).not.toContain("value: '1536x1024'");
    expect(source).not.toContain("value: '2048x1152'");
    expect(source).not.toContain("value: '750x1624'");
    expect(source).not.toContain("value: '1170x2532'");
    expect(source).not.toContain("value: '1770x3840'");
    expect(source).not.toContain("value: '1024x576'");
    expect(source).not.toContain("value: '3840x2160'");
    expect(source).not.toContain("{ label: '移动端 1K', value: '576x1024' }");
    expect(source).not.toContain("{ label: '移动端 4K', value: '2160x3840' }");
  });

  it('submits canvas start prompt requests through direct runs without selecting inserted nodes', () => {
    const source = readToolSource();
    const submitCallbackIndex = source.indexOf('const submitCanvasStartPrompt = useCallback');
    const submitBody = source.slice(submitCallbackIndex, source.indexOf('const canvasStartSceneDefinition', submitCallbackIndex));

    expect(source).toContain('canvasFilePath?: string;');
    expect(source).toContain('createdPrototype?: ItemData;');
    expect(source).toContain('provider?: string | null;');
    expect(source).toContain('model?: string | null;');
    expect(source).toContain('mode?: string | null;');
    expect(source).toContain('thought?: string | null;');
    expect(source).toContain('contextBundle?: CanvasAiSubmitRequest[\'contextBundle\'];');
    expect(source).toContain('sceneSettings?: CanvasAiSubmitRequest[\'sceneSettings\'];');
    expect(source).toContain('appendCanvasGenerationPromptSettings');
    expect(source).not.toContain('pendingAutoSubmitRequest');
    expect(source).not.toContain('submitAutoStartRequest');
    expect(source).not.toContain('insertGenerator({');
    expect(source).not.toContain('selectedInfo?.element');
    expect(submitBody).toContain('provider: selection?.provider');
    expect(submitBody).toContain('model: selection?.model');
    expect(submitBody).toContain('mode: selection?.mode');
    expect(submitBody).toContain('thought: selection?.thought');
    expect(submitBody).toContain('contextBundle: selection?.contextBundle');
    expect(submitBody).toContain('const attachments = selection?.attachments || [];');
    expect(submitBody).toContain('attachments,');
    expect(submitBody).toContain('referenceImages');
    expect(submitBody).toContain('localContextRefs');
    expect(submitBody).toContain('prompt: appendCanvasGenerationPromptSettings({');
    expect(submitBody).toContain('source: \'canvas-start\'');
    expect(submitBody).toContain('canvasName: canvasFilePath');
    expect(submitBody).toContain('statusTaskId: statusTask.id');
    expect(submitBody).toContain('statusTaskBounds: {');
    expect(submitBody).toContain('x: statusTask.x,');
    expect(submitBody).toContain('y: statusTask.y,');
    expect(submitBody).toContain('width: statusTask.width,');
    expect(submitBody).toContain('height: statusTask.height,');
    expect(submitBody).not.toContain('statusTaskKind');
    expect(submitBody).not.toContain('generatorElementId');
    expect(submitBody).toContain('const request: CanvasAiGenerationRequest = {');
    expect(submitBody).toContain('const startResult = controller?.start(request);');
    expect(submitBody).toContain('canvasDirectRunOverlayController.createStatusTask({');
    expect(submitBody).toContain('canvasDirectRunOverlayController.removeStatusTask(statusTask.id');
    expect(submitBody).toContain('canvasDirectRunOverlayController.markStatusTaskFailed(statusTask.id');
    expect(submitBody).toContain('canvasDirectRunOverlayController.registerStatusTaskStopped(statusTask.id');
    expect(submitBody).toContain("canvasDirectRunOverlayController.updateStatusTaskRef(statusTask.id, { status: 'aborted' });");
    expect(submitBody).not.toContain("status: 'running'");
    expect(submitBody).not.toContain("status: 'done'");
    expect(submitBody).not.toContain("status: 'error'");
    expect(submitCallbackIndex).toBeGreaterThan(-1);
    expect(source).not.toContain('const selectedPromptClient = providerToPromptClientPreference(request.provider) || preferredPromptClient;');
    expect(source).not.toContain('preferredPromptClient: selectedPromptClient');
  });

  it('uses annotation-backed canvas direct-run task nodes and refreshes their run refs', () => {
    const source = readToolSource();

    expect(source).toContain('CanvasDirectRunOverlayController');
    expect(source).toContain('canvasDirectRunOverlayController?: CanvasDirectRunOverlayController;');
    expect(source).not.toContain('buildCanvasDirectStatusPromptInstruction');
    expect(source).not.toContain('canvasDirectStatusElement');
    expect(source).toContain('onEvent: (event) => {');
    expect(source).toContain('canvasDirectRunOverlayController?.updateStatusTaskRef(statusTaskId, {');
    expect(source).toContain("if (event.type === 'error') {");
    expect(source).toContain('canvasDirectRunOverlayController?.markStatusTaskFailed(');
    expect(source).toContain("status: event.type === 'aborted' ? 'aborted' : 'running'");
    expect(source).toContain('provider: event.taskRef.provider');
    expect(source).toContain('runId: event.taskRef.requestId');
    expect(source).toContain('threadId: event.taskRef.sessionId');
    expect(source).toContain('const statusTask = canvasDirectRunOverlayController.createStatusTask({');
    expect(source).toContain('const activeStatusTaskRunsRef = useRef(new Map<string, { abort: () => Promise<boolean> }>());');
    expect(source).toContain('activeStatusTaskRunsRef.current.set(statusTask.id');
    expect(source).toContain('canvasDirectRunOverlayController.removeStatusTask(statusTask.id');
    expect(source).toContain('canvasDirectRunOverlayController.markStatusTaskFailed(statusTask.id');
    expect(source).toContain("canvasDirectRunOverlayController.updateStatusTaskRef(statusTask.id, { status: 'aborted' });");
    expect(source).toContain('canvasDirectRunOverlayController.registerStatusTaskStopped(statusTask.id');
    expect(source).not.toContain('CanvasStartDirectRunTasks');
    expect(source).not.toContain('data-axhub-canvas-direct-run-tasks');
    expect(source).not.toContain('canvasDirectTasks');
  });

  it('keeps direct-run overlay details focused on prompt, context, type, and explicit settings', () => {
    const source = readToolSource();
    const detailsSource = source.slice(
      source.indexOf('function buildCanvasDirectRunOverlayTaskDetails'),
      source.indexOf('function CanvasStartSettingsPopover'),
    );

    expect(detailsSource).toContain('getCanvasStartSettingsSummary(scene, settings)');
    expect(detailsSource).not.toContain('Provider:');
    expect(detailsSource).not.toContain('Model:');
    expect(detailsSource).not.toContain('模式:');
    expect(detailsSource).not.toContain('思考:');
  });

  it('clears canvas start prompt context and settings after a direct run is accepted', () => {
    const source = readToolSource();
    const submitBody = source.slice(
      source.indexOf('const submitCanvasStartPrompt = useCallback'),
      source.indexOf('const handleCanvasStartSubmit = useCallback', source.indexOf('const submitCanvasStartPrompt = useCallback')),
    );

    expect(source).toContain('const resetCanvasStartSubmitState = useCallback(() => {');
    expect(source).toContain('setCanvasStartLocalContextRefs([]);');
    expect(source).toContain('copiedCanvasReferenceRef.current = null;');
    expect(source).toContain('setHasCopiedCanvasReference(false);');
    expect(source).toContain('setCanvasStartPrototypeCount(undefined);');
    expect(source).toContain('setCanvasStartPrototypeNeedsRequirementsAnalysis(false);');
    expect(source).toContain('setCanvasStartImageParams({ ...DEFAULT_CANVAS_START_IMAGE_SETTINGS });');
    expect(source).toContain("setCanvasStartDocumentFormat('');");
    expect(source).toContain('setCanvasStartDocumentUsePrdPlanning(false);');
    expect(source).toContain('canvasStartUserSelectedThemeRef.current = false;');
    expect(submitBody).toContain('resetCanvasStartSubmitState();');
    expect(submitBody.indexOf('const startResult = controller?.start(request);')).toBeLessThan(
      submitBody.indexOf('resetCanvasStartSubmitState();'),
    );
  });

  it('labels the document workflow by PRD planning rather than document count or generic analysis', () => {
    const source = readToolSource();

    expect(source).toContain('PRD 规划');
    expect(source).toContain('画布 AI 文档使用 PRD 规划流程');
    expect(source).not.toContain('画布 AI 文档需要需求分析');
    expect(source).not.toContain('单篇 PRD');
    expect(source).not.toContain('多篇 PRD');
  });

  it('clears and closes the canvas start composer after submitting a prompt', () => {
    const source = readToolSource();
    const submitBody = source.slice(
      source.indexOf('const submitCanvasStartPrompt = useCallback'),
      source.indexOf('const handleCanvasStartSubmit = useCallback', source.indexOf('const submitCanvasStartPrompt = useCallback')),
    );
    const composerSegment = source.slice(
      source.indexOf('<CanvasGenerationDisplayComposer'),
      source.indexOf('postSelectorActions={() => (', source.indexOf('<CanvasGenerationDisplayComposer')),
    );

    expect(source).toContain('const handleCanvasStartSubmit = useCallback(async (prompt: string, selection?: Parameters<typeof submitCanvasStartPrompt>[1]) => {');
    expect(source).toContain('const submitResult = await submitCanvasStartPrompt(prompt, selection);');
    expect(source).toContain('if (submitResult !== false) {');
    expect(source).toContain('setCanvasStartComposerOpen(false);');
    expect(source).toContain('return submitResult;');
    expect(composerSegment).toContain('onSubmit={handleCanvasStartSubmit}');
    expect(composerSegment).not.toContain('onSubmit={submitCanvasStartPrompt}');
    expect(submitBody).not.toContain('setCanvasStartComposerOpen(false);');
  });

  it('keeps canvas start on the sidebar-owned prompt path with ACP selector and pasted context', () => {
    const source = readToolSource();
    const submitSegment = source.slice(
      source.indexOf('const submitCanvasStartPrompt = useCallback'),
      source.indexOf('const canvasStartSceneDefinition', source.indexOf('const submitCanvasStartPrompt = useCallback')),
    );

    expect(submitSegment).toContain("source: 'canvas-start',");
    expect(submitSegment).toContain('canvasFilePath,');
    expect(submitSegment).toContain('const attachments = selection?.attachments || [];');
    expect(submitSegment).toContain('attachments,');
    expect(submitSegment).toContain('provider: selection?.provider,');
    expect(submitSegment).toContain('model: selection?.model,');
    expect(submitSegment).toContain('mode: selection?.mode,');
    expect(submitSegment).toContain('thought: selection?.thought,');
    expect(submitSegment).toContain('contextBundle: selection?.contextBundle,');
    expect(submitSegment).toContain('canvasContext: {');
    expect(submitSegment).toContain("source: 'canvas-start'");
    expect(source).toContain('hasCopiedCanvasReference');
    expect(source).toContain('canvasStartLocalContextRefs');
    expect(source).toContain('onPasteReferenceImages={pasteCanvasReferenceImages}');
    expect(source).not.toContain('runAiStream({');
    expect(source).not.toContain('dispatchAssistantArtifactsChanged');
  });

  it('adds a bottom-center canvas start composer without restoring the old top toolbar entry', () => {
    const source = readToolSource();
    const cssSource = readFileSync(resolve(__dirname, '../shared/canvas-generation-acp-scope.css'), 'utf8');

    expect(source).toContain("source?: 'placeholder-start' | 'resource-start' | 'theme-start' | 'canvas-start';");
    expect(source).toContain('const [canvasStartComposerOpen, setCanvasStartComposerOpen] = useState(false);');
    expect(source).toContain('data-axhub-canvas-start-ai-launcher');
    expect(source).toContain('<Sparkles className="size-[17px]" aria-hidden="true" />');
    expect(cssSource).toContain('width: 30px;');
    expect(cssSource).toContain('height: 30px;');
    expect(cssSource).toContain('border-radius: var(--radius-md, 6px);');
    expect(source).toContain('data-axhub-canvas-start-composer');
    expect(source).toContain('aria-label="打开画布 AI 输入框"');
    expect(source).toContain('aria-label="关闭画布 AI 输入框"');
    expect(source).toContain('const canvasStartSceneSwitcher = (');
    expect(source).toContain('data-axhub-canvas-start-scene-switcher');
    expect(source).toContain('className="ax-canvas-start-composer-topbar"');
    expect(source).toContain('className="ax-canvas-start-composer-topbar__close"');
    expect(source).toContain('<CanvasGenerationDisplayComposer');
    expect(source).toContain("source: 'canvas-start'");
    expect(source).not.toContain('insertGenerator({');
    expect(source).not.toContain("document.dispatchEvent(new CustomEvent('axhub:insertPrototypeGenerator'))");
    expect(source).not.toContain("data-axhub-prototype-toolbar-btn");
  });

  it('uses placeholder-start prompt behavior for the canvas start composer while keeping it canvas scoped', () => {
    const source = readToolSource();
    const canvasStartComposerSegment = source.slice(
      source.indexOf('<CanvasGenerationDisplayComposer'),
      source.indexOf('postSelectorActions={() => (', source.indexOf('<CanvasGenerationDisplayComposer')),
    );

    expect(source).toContain('appendCanvasAiPrototypeStartSystemPrompt');
    expect(source).toContain('getCanvasAiPrototypeStartSystemPrompt(canvasStartScene)');
    expect(source).toContain('pickCanvasAiPrototypeStartPlaceholder(canvasStartScene)');
    expect(source).not.toContain('getCanvasAiPrototypeStartQuickPrompts');
    expect(canvasStartComposerSegment).not.toContain('quickPrompts=');
    expect(source).toContain('canvasStartDraftStorageKey');
    expect(source).toContain("'canvas-start'");
    expect(source).toContain('sceneSettings,');
    expect(source).toContain('localContextRefs');
    expect(source).toContain('const attachments = selection?.attachments || [];');
    expect(source).toContain('referenceImages');
    expect(source).toContain('canPasteReferenceImages={hasCopiedCanvasReference}');
    expect(source).toContain('setHasCopiedCanvasReference(Boolean(copiedCanvasReferenceRef.current));');
    expect(source).toContain('initialLocalContextRefs={canvasStartLocalContextRefs}');
  });

  it('passes canvas scene settings and context into prompt optimization', () => {
    const source = readToolSource();
    const optimizeSegment = source.slice(
      source.indexOf('const optimizeCanvasStartPrompt = useCallback'),
      source.indexOf('const submitCanvasStartPrompt = useCallback'),
    );

    expect(source).toContain("import { optimizeCanvasPrompt } from './canvasPromptOptimization';");
    expect(source).toContain('onOptimizePrompt={optimizeCanvasStartPrompt}');
    expect(optimizeSegment).toContain('scene: canvasStartScene');
    expect(optimizeSegment).toContain("sceneSettings: canvasStartScene === 'design' ? canvasStartImageSettings : canvasStartScene === 'document' ? canvasStartDocumentSettings : canvasStartPrototypeSettings");
    expect(optimizeSegment).toContain('canvasFilePath,');
    expect(optimizeSegment).toContain('workspacePath: assistantProjectPath');
    expect(optimizeSegment).toContain('contextBundle: request.contextBundle');
    expect(optimizeSegment).toContain('attachments: request.attachments');
    expect(optimizeSegment).toContain('provider: request.provider');
    expect(optimizeSegment).toContain('model: request.model');
    expect(optimizeSegment).toContain('mode: request.mode');
    expect(optimizeSegment).toContain('thought: request.thought');
  });

  it('copies the canvas start prompt with the same scene settings used by direct creation', () => {
    const source = readToolSource();
    const copySegment = source.slice(
      source.indexOf('const copyCanvasStartPrompt = useCallback'),
      source.indexOf('const submitCanvasStartPrompt = useCallback'),
    );

    expect(copySegment).toContain('const startSystemPrompt = getCanvasAiPrototypeStartSystemPrompt(canvasStartScene);');
    expect(copySegment).toContain('const promptWithStartSystemPrompt = appendCanvasAiPrototypeStartSystemPrompt(trimmedPrompt, startSystemPrompt);');
    expect(copySegment).toContain('return appendCanvasGenerationPromptSettings({');
    expect(copySegment).toContain('scene: canvasStartScene');
    expect(copySegment).toContain("settings: canvasStartScene === 'design' ? canvasStartImageSettings : canvasStartScene === 'document' ? canvasStartDocumentSettings : canvasStartPrototypeSettings");
    expect(copySegment).toContain("finalGuide: 'local-ai-acknowledgement'");
    expect(source).toContain('onCopyPrompt={copyCanvasStartPrompt}');
  });

  it('uses subdued canvas scene switch styling instead of a black primary active state', () => {
    const source = readToolSource();

    expect(source).toContain('data-[state=on]:bg-slate-100 data-[state=on]:text-slate-900');
    expect(source).toContain('text-muted-foreground hover:bg-slate-100 hover:text-slate-900');
    expect(source).not.toContain('bg-primary text-primary-foreground');
  });
});
