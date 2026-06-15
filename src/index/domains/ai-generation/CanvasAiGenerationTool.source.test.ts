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

function splitLegacyCanvasRuntime(source: string) {
  const legacyStart = source.indexOf('/* Legacy local canvas AI runtime');
  const legacyEnd = source.indexOf('End legacy local canvas AI runtime', legacyStart);
  return {
    activeSource: source.slice(0, legacyStart) + source.slice(legacyEnd),
    legacyEnd,
    legacySource: source.slice(legacyStart, legacyEnd),
    legacyStart,
  };
}

describe('CanvasAiGenerationTool source', () => {
  it('uses one unified generator element model while keeping design as a placeholder-start scene', () => {
    const toolSource = readToolSource();
    const modelSource = readModelSource();
    const registrySource = readRegistrySource();

    expect(modelSource).toContain("export const CANVAS_AI_GENERATION_CUSTOM_TYPE = 'axhub-ai-generation';");
    expect(modelSource).toContain("export const CANVAS_AI_GENERATION_PLACEHOLDER_FILE_ID = 'axhub-ai-generation-placeholder");
    expect(modelSource).toContain('export const CANVAS_AI_GENERATION_TITLE = \'AI 生成\';');
    expect(modelSource).toContain('export function createCanvasAiGenerationElement');
    expect(modelSource).toContain('export function isCanvasAiGenerationElement');
    expect(modelSource).toContain('scene: options.scene');
    expect(modelSource).toContain('artifactKind: options.artifactKind');
    expect(modelSource).toContain("previewKind: 'ai-generation'");
    expect(toolSource).toContain('CANVAS_AI_GENERATOR_NODE_SCENE_OPTIONS');
    expect(toolSource).not.toContain("const CANVAS_AI_SCENE_OPTIONS");
    expect(registrySource).toContain('CANVAS_AI_SCENE_OPTIONS');
    expect(registrySource).toContain('CANVAS_AI_GENERATOR_NODE_SCENE_OPTIONS');
    expect(registrySource).toContain(".filter((option) => option.value !== 'design')");
    for (const scene of ['page', 'design', 'document']) {
      expect(modelSource).toContain(`value === '${scene}'`);
    }
    expect(modelSource).toContain("if (value === 'image') return 'design';");
    expect(modelSource).not.toContain("if (value === 'design' || value === 'image') return 'page';");
    expect(registrySource).toContain("id: 'design'");
    expect(modelSource).toContain("if (value === 'chart' || value === 'other') return 'document';");
    expect(toolSource).toContain('getCanvasAiSceneDefinition(selectedScene)');
    expect(toolSource).toContain('pickCanvasAiScenePlaceholder(scene)');
    expect(registrySource).toContain("label: '设计图'");
    expect(registrySource).not.toContain("renderSettings: 'image'");
    expect(registrySource).not.toContain("label: '图表'");
    expect(registrySource).not.toContain("label: '其他'");
    expect(toolSource).not.toContain("label: '设计稿'");
  });

  it('uses one axhub:insertAiGeneration insert flow without legacy placeholder events', () => {
    const source = readToolSource();

    expect(source).toContain("const AI_GENERATION_INSERT_EVENT_NAME = 'axhub:insertAiGeneration';");
    expect(source).toContain("document.addEventListener(AI_GENERATION_INSERT_EVENT_NAME");
    expect(source).toContain("document.removeEventListener(AI_GENERATION_INSERT_EVENT_NAME");
    expect(source).not.toContain("document.addEventListener('axhub:insertAiImageGenerator'");
    expect(source).not.toContain("document.addEventListener('axhub:insertPrototypeGenerator'");
    expect(source).not.toContain('legacy-ai-image');
    expect(source).not.toContain('legacy-prototype');
    expect(source).toContain('referenceImages');
    expect(source).toContain('referencePlacement');
    expect(source).toContain('source');
  });

  it('routes page and generic submissions to the sidebar assistant callback without the AI image composer', () => {
    const source = readToolSource();

    expect(source).not.toContain("import AiImageGenerationComposer from '../ai-image/AiImageGenerationComposer';");
    expect(source).toContain("import PrototypeGenerationComposer");
    expect(source).not.toContain('<AiImageGenerationComposer');
    expect(source).toContain('<PrototypeGenerationComposer');
    expect(source).not.toContain("selectedSceneDefinition.renderSettings === 'image'");
    expect(source).toContain("selectedSceneDefinition.renderSettings === 'prototype'");
    expect(source).toContain('defaultThemeName?: string | null;');
    expect(source).toContain('defaultThemeName,');
    expect(source).toContain('defaultThemeName={defaultThemeName}');
    expect(source).toContain('export interface CanvasAiGenerationResult {');
    expect(source).toContain('artifacts?: GenerationArtifactRecord[];');
    expect(source).toContain('onSubmitCanvasAssistantPrompt?: (request: CanvasAiGenerationRequest) => Promise<CanvasAiGenerationResult | boolean> | CanvasAiGenerationResult | boolean;');
    expect(source).toContain('const submitCanvasAssistantPrompt = useCallback(async (');
    expect(source).toContain('request: CanvasAiSubmitRequest,');
    expect(source).toContain('const submitted = await onSubmitCanvasAssistantPrompt({');
    expect(source).toContain("const submittedOk = typeof submitted === 'object' && submitted !== null");
    expect(source).toContain('generatorId,');
    expect(source).toContain('canvasFilePath,');
    expect(source).toContain('localContextRefs,');
    expect(source).toContain('referenceImages,');
    expect(source).toContain('appendCanvasGenerationPromptSettings({');
    expect(source).toContain('settings: options.sceneSettings ?? request.sceneSettings');
    expect(source).not.toContain("if (request.scene === 'page')");
  });

  it('keeps document-style artifacts on the same node composer without active status overlays', () => {
    const source = readToolSource();
    const { activeSource } = splitLegacyCanvasRuntime(source);

    expect(source).toContain('GenericCanvasAiGenerationComposer');
    expect(source).toContain("selectedSceneDefinition.renderSettings === 'generic'");
    expect(source).not.toContain("selectedInfo.element.customData?.scene === 'document'");
    expect(source).not.toContain("selectedInfo.element.customData?.scene === 'chart'");
    expect(source).not.toContain("selectedInfo.element.customData?.scene === 'other'");
    expect(source).not.toContain('applyCanvasAiArtifactToElements');
    expect(source).toContain("data-axhub-ai-generation-composer");
    expect(source).toContain('data-axhub-ai-generation-generator-selected');
    expect(source).not.toContain('data-axhub-ai-image-generator-selected');
    expect(source).not.toContain('data-axhub-prototype-generator-selected');
    expect(activeSource).not.toContain('generatorStatusOverlays.map');
    expect(activeSource).not.toContain('stageLabel(overlay.task)');
    expect(activeSource).not.toContain('formatElapsed(overlay.task)');
    expect(activeSource).not.toContain('overlay.task.status === \'error\'');
  });

  it('scopes unsent composer drafts to the selected unified generator node and scene', () => {
    const source = readToolSource();

    expect(source).toContain("import { createCanvasGenerationComposerDraftStorageKey } from '../shared/canvasGenerationComposerDraft';");
    expect(source).toContain('selectedGeneratorComposerDraftStorageKey');
    expect(source).toContain('assistantProjectPath');
    expect(source).toContain('canvasFilePath');
    expect(source).toContain('selectedInfo.element.id');
    expect(source).toContain("'canvas-node'");
    expect(source).toContain('selectedScene');
    expect(source).toContain('draftStorageKey={selectedGeneratorComposerDraftStorageKey}');
  });

  it('keeps local canvas AI runtime code isolated behind the disabled legacy guard', () => {
    const source = readToolSource();
    const { activeSource, legacyEnd, legacySource, legacyStart } = splitLegacyCanvasRuntime(source);

    expect(source).toContain('const CANVAS_LOCAL_AI_RUNTIME_DISABLED = true;');
    expect(legacyStart).toBeGreaterThan(-1);
    expect(legacyEnd).toBeGreaterThan(legacyStart);
    expect(legacySource).toContain("import { runAiStream } from './aiRunClient';");
    expect(legacySource).toContain('getAiImageTaskStore().submit');
    expect(legacySource).toContain('getPrototypeGenerationTaskStore().submit');
    expect(legacySource).toContain('generatorStatusOverlays');
    expect(legacySource).toContain('stageLabel(overlay.task)');
    expect(legacySource).toContain('formatElapsed(overlay.task)');
    expect(activeSource).not.toContain('const result = await runAiStream({');
    expect(activeSource).not.toContain('getAiImageTaskStore().submit');
    expect(activeSource).not.toContain('getPrototypeGenerationTaskStore().submit');
    expect(activeSource).not.toContain('toast.error(task.error');
    expect(activeSource).not.toContain("toast.warning('本地 ACP 服务不可用");
    expect(source).toContain('onOpenAISettings,');
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
    expect(source).toContain('const generatorSceneSwitcher = selectedGeneratorId ? (');
    expect(source).toContain('data-axhub-ai-generation-scene-switcher');
    expect(source).toContain('<ToggleGroup');
    expect(source).toContain('type="single"');
    expect(source).toContain('value={selectedScene}');
    expect(source).toContain('onValueChange={(nextScene) => {');
    expect(source).toContain('<ToggleGroupItem');
    expect(source).toContain('value={option.value}');
    expect(source).toContain('topContent={generatorSceneSwitcher}');
    expect(source).not.toContain('interface GeneratorSceneSwitcherPlacement');
    expect(source).not.toContain('generatorSceneSwitcherPlacement');
    expect(source).not.toContain('AI_GENERATION_SCENE_SWITCHER_OFFSET');
    expect(source).not.toContain('Math.max(8, topLeft.y - rect.top -');
    expect(source).not.toContain('<button\\n              key={option.value}');
  });

  it('passes scene quick prompts into the canvas composer', () => {
    const source = readToolSource();

    expect(source).toContain('getCanvasAiSceneQuickPrompts');
    expect(source).toContain('quickPrompts={getCanvasAiSceneQuickPrompts(scene)}');
  });

  it('submits prompt requests from the placeholder start page to the sidebar after selecting the inserted node', () => {
    const source = readToolSource();
    const pendingContextRefsIndex = source.indexOf('const pendingInitialLocalContextRefs = useMemo');
    const submitCallbackIndex = source.indexOf('const submitCanvasAssistantPrompt = useCallback');

    expect(source).toContain('generatorId?: string;');
    expect(source).toContain('canvasFilePath?: string;');
    expect(source).toContain('provider?: string | null;');
    expect(source).toContain('model?: string | null;');
    expect(source).toContain('mode?: string | null;');
    expect(source).toContain('thought?: string | null;');
    expect(source).toContain('contextBundle?: CanvasAiSubmitRequest[\'contextBundle\'];');
    expect(source).toContain('sceneSettings?: CanvasAiSubmitRequest[\'sceneSettings\'];');
    expect(source).toContain('appendCanvasGenerationPromptSettings');
    expect(source).toContain('pendingAutoSubmitRequest');
    expect(source).toContain("const autoSubmitSource = request.source || 'placeholder-start';");
    expect(source).toContain('source: autoSubmitSource');
    expect(source).toContain('initialPrompt');
    expect(source).toContain('submitAutoStartRequest');
    expect(source).toContain('insertGenerator({');
    expect(source).toContain('const generatorId = options.generatorId || (selectedInfo?.element ? String(selectedInfo.element.id) : \'\');');
    expect(source).toContain('if (!generatorId) {');
    expect(source).toContain('provider: request.provider');
    expect(source).toContain('model: request.model');
    expect(source).toContain('mode: request.mode');
    expect(source).toContain('thought: request.thought');
    expect(source).toContain('contextBundle: request.contextBundle');
    expect(source).toContain('prompt: appendCanvasGenerationPromptSettings({');
    expect(source).toContain('settings: options.sceneSettings ?? request.sceneSettings');
    expect(source).toContain('canvasContext: {');
    expect(source).toContain('canvasName: canvasFilePath');
    expect(source).toContain('generatorElementId: generatorId');
    expect(source).not.toContain('sceneSettings: detail.sceneSettings');
    expect(source).not.toContain('sceneSettings: options.sceneSettings ?? request.sceneSettings');
    expect(source).toContain('const submitted = await onSubmitCanvasAssistantPrompt({');
    expect(pendingContextRefsIndex).toBeGreaterThan(-1);
    expect(submitCallbackIndex).toBeGreaterThan(-1);
    expect(pendingContextRefsIndex).toBeLessThan(submitCallbackIndex);
    expect(source).not.toContain('const selectedPromptClient = providerToPromptClientPreference(request.provider) || preferredPromptClient;');
    expect(source).not.toContain('preferredPromptClient: selectedPromptClient');
  });

  it('keeps both real entry sources on the sidebar-owned prompt path with ACP selector context', () => {
    const source = readToolSource();
    const insertSegment = source.slice(
      source.indexOf('const insertGenerator = useCallback'),
      source.indexOf('const refreshCanvasOverlayRevision = useCallback'),
    );
    const submitSegment = source.slice(
      source.indexOf('const submitCanvasAssistantPrompt = useCallback'),
      source.indexOf('const resizeSelectedGeneratorForParams = useCallback'),
    );
    const autoStartSegment = source.slice(
      source.indexOf('const submitAutoStartRequest = useCallback'),
      source.indexOf('useEffect(() => {\n    if (!pendingAutoSubmitRequest) return;'),
    );

    expect(insertSegment).toContain("source: detail.source || 'canvas-toolbar'");
    expect(insertSegment).toContain("const autoSubmitSource = request.source || 'placeholder-start';");
    expect(insertSegment).toContain('setPendingAutoSubmitRequest({');
    expect(insertSegment).toContain('generatorId: generator.id,');
    expect(insertSegment).toContain('provider: detail.provider,');
    expect(insertSegment).toContain('model: detail.model,');
    expect(insertSegment).toContain('mode: detail.mode,');
    expect(insertSegment).toContain('thought: detail.thought,');
    expect(insertSegment).toContain('contextBundle: detail.contextBundle,');
    expect(submitSegment).toContain("source: options.source || 'canvas-node',");
    expect(submitSegment).toContain('generatorId,');
    expect(submitSegment).toContain('canvasFilePath,');
    expect(submitSegment).toContain('provider: request.provider,');
    expect(submitSegment).toContain('model: request.model,');
    expect(submitSegment).toContain('mode: request.mode,');
    expect(submitSegment).toContain('thought: request.thought,');
    expect(submitSegment).toContain('contextBundle: request.contextBundle,');
    expect(submitSegment).toContain('canvasContext: {');
    expect(submitSegment).toContain('generatorElementId: generatorId');
    expect(autoStartSegment).toContain('source: request.source,');
    expect(autoStartSegment).toContain('provider: request.provider || \'\',');
    expect(autoStartSegment).toContain('model: request.model ?? null,');
    expect(autoStartSegment).toContain('mode: request.mode ?? null,');
    expect(autoStartSegment).toContain('thought: request.thought ?? null,');
    expect(autoStartSegment).toContain('contextBundle: request.contextBundle ?? null,');
    expect(source).not.toContain('runAiStream({');
    expect(source).not.toContain('dispatchAssistantArtifactsChanged');
  });

  it('passes explicit scene snapshots to persistence after programmatic generator mutations', () => {
    const source = readToolSource();
    const insertSegment = source.slice(
      source.indexOf('const insertGenerator = useCallback'),
      source.indexOf('const refreshCanvasOverlayRevision = useCallback'),
    );
    const sceneSwitchSegment = source.slice(
      source.indexOf('const updateSelectedGeneratorScene = useCallback'),
      source.indexOf('const insertGenerator = useCallback'),
    );
    const deleteSegment = source.slice(
      source.indexOf('const handleComposerKeyDown = (event: KeyboardEvent) => {'),
      source.indexOf('document.addEventListener(\'keydown\', handleComposerKeyDown, true);'),
    );

    expect(source).toContain('interface CanvasAiGenerationSceneSnapshot');
    expect(source).toContain('onSceneMutated?: (snapshot?: CanvasAiGenerationSceneSnapshot) => void;');
    expect(insertSegment).toContain('const currentElements = excalidrawAPI.getSceneElements();');
    expect(insertSegment).toContain('const nextElements = [...currentElements, generator];');
    expect(insertSegment).toContain('const nextAppState = {');
    expect(insertSegment).toContain('excalidrawAPI.updateScene({');
    expect(insertSegment).toContain('elements: nextElements,');
    expect(insertSegment).toContain('appState: nextAppState,');
    expect(insertSegment).toContain('onSceneMutated?.({ elements: nextElements, appState: nextAppState });');
    expect(insertSegment).not.toContain('onSceneMutated?.();');
    expect(sceneSwitchSegment).toContain('onSceneMutated?.({ elements, appState: excalidrawAPI.getAppState() });');
    expect(deleteSegment).toContain('const nextAppState = {');
    expect(deleteSegment).toContain('onSceneMutated?.({ elements, appState: nextAppState });');
  });

  it('does not recreate the AI placeholder file on every selection refresh frame', () => {
    const source = readToolSource();
    const ensureSegment = source.slice(
      source.indexOf('const ensurePlaceholderFile = useCallback'),
      source.indexOf('const updateSelectedGeneratorScene = useCallback'),
    );
    const refreshSelectionSegment = source.slice(
      source.indexOf('const refreshSelection = useCallback'),
      source.indexOf('useEffect(() => {\n    let raf = 0;'),
    );

    expect(ensureSegment).toContain('const files = excalidrawAPI.getFiles?.() || {};');
    expect(ensureSegment).toContain('if (!files[CANVAS_AI_GENERATION_PLACEHOLDER_FILE_ID]) {');
    expect(refreshSelectionSegment).toContain('ensurePlaceholderFile();');
    expect(refreshSelectionSegment).not.toContain('refreshPlaceholderFile(excalidrawAPI);');
  });

  it('uses subdued canvas scene switch styling instead of a black primary active state', () => {
    const source = readToolSource();

    expect(source).toContain('data-[state=on]:bg-slate-100 data-[state=on]:text-slate-900');
    expect(source).toContain('text-muted-foreground hover:bg-slate-100 hover:text-slate-900');
    expect(source).not.toContain('bg-primary text-primary-foreground');
  });
});
