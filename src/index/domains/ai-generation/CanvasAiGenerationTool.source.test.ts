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

  it('routes canvas start submissions directly to the sidebar assistant callback without old node composers', () => {
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
    expect(source).toContain('const submitted = await onSubmitCanvasAssistantPrompt({');
    expect(source).toContain('canvasFilePath,');
    expect(source).toContain('localContextRefs: canvasStartLocalContextRefs,');
    expect(source).toContain('attachments: selection?.attachments || [],');
    expect(source).toContain('referenceImages,');
    expect(source).toContain('appendCanvasGenerationPromptSettings({');
    expect(source).toContain('settings: canvasStartScene === \'design\' ? canvasStartImageSettings : canvasStartScene === \'document\' ? canvasStartDocumentSettings : canvasStartPrototypeSettings');
    expect(source).not.toContain("if (request.scene === 'page')");
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

    expect(source).toContain("import { createCanvasGenerationComposerDraftStorageKey } from '../shared/canvasGenerationComposerDraft';");
    expect(source).toContain('assistantProjectPath');
    expect(source).toContain('canvasFilePath');
    expect(source).toContain("'canvas-start'");
    expect(source).toContain('canvasStartScene');
    expect(source).toContain('draftStorageKey={canvasStartDraftStorageKey}');
    expect(source).not.toContain('selectedGeneratorComposerDraftStorageKey');
    expect(source).not.toContain("'canvas-node'");
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

  it('keeps image size presets on mobile portrait and PC landscape ratios', () => {
    const source = readToolSource();

    expect(source).toContain("{ label: '移动端 1K', value: '750x1624' }");
    expect(source).toContain("{ label: '移动端 2K', value: '1170x2532' }");
    expect(source).toContain("{ label: '移动端 4K', value: '1770x3840' }");
    expect(source).toContain("{ label: 'PC 端 1K', value: '1024x576' }");
    expect(source).toContain("{ label: 'PC 端 2K', value: '2048x1152' }");
    expect(source).toContain("{ label: 'PC 端 4K', value: '3840x2160' }");
    expect(source).not.toContain("{ label: '移动端 1K', value: '576x1024' }");
    expect(source).not.toContain("{ label: '移动端 2K', value: '1152x2048' }");
    expect(source).not.toContain("{ label: '移动端 4K', value: '2160x3840' }");
    expect(source).not.toContain("{ label: '移动端 1K', value: '1024x1536' }");
    expect(source).not.toContain("{ label: 'PC 端 1K', value: '1536x1024' }");
  });

  it('submits canvas start prompt requests directly to the sidebar without selecting inserted nodes', () => {
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
    expect(submitBody).toContain('attachments: selection?.attachments || []');
    expect(submitBody).toContain('referenceImages');
    expect(submitBody).toContain('localContextRefs');
    expect(submitBody).toContain('prompt: appendCanvasGenerationPromptSettings({');
    expect(submitBody).toContain('source: \'canvas-start\'');
    expect(submitBody).toContain('canvasName: canvasFilePath');
    expect(submitBody).not.toContain('generatorElementId');
    expect(submitBody).toContain('const submitted = await onSubmitCanvasAssistantPrompt({');
    expect(submitCallbackIndex).toBeGreaterThan(-1);
    expect(source).not.toContain('const selectedPromptClient = providerToPromptClientPreference(request.provider) || preferredPromptClient;');
    expect(source).not.toContain('preferredPromptClient: selectedPromptClient');
  });

  it('keeps canvas start on the sidebar-owned prompt path with ACP selector and pasted context', () => {
    const source = readToolSource();
    const submitSegment = source.slice(
      source.indexOf('const submitCanvasStartPrompt = useCallback'),
      source.indexOf('const canvasStartSceneDefinition', source.indexOf('const submitCanvasStartPrompt = useCallback')),
    );

    expect(submitSegment).toContain("source: 'canvas-start',");
    expect(submitSegment).toContain('canvasFilePath,');
    expect(submitSegment).toContain('attachments: selection?.attachments || [],');
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

    expect(source).toContain("source?: 'placeholder-start' | 'canvas-start';");
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
    expect(source).toContain('sceneSettings: canvasStartScene === \'design\' ? canvasStartImageSettings : canvasStartScene === \'document\' ? canvasStartDocumentSettings : canvasStartPrototypeSettings');
    expect(source).toContain('localContextRefs');
    expect(source).toContain('attachments: selection?.attachments || []');
    expect(source).toContain('referenceImages');
    expect(source).toContain('canPasteReferenceImages={hasCopiedCanvasReference}');
    expect(source).toContain('setHasCopiedCanvasReference(Boolean(copiedCanvasReferenceRef.current));');
    expect(source).toContain('initialLocalContextRefs={canvasStartLocalContextRefs}');
  });

  it('uses subdued canvas scene switch styling instead of a black primary active state', () => {
    const source = readToolSource();

    expect(source).toContain('data-[state=on]:bg-slate-100 data-[state=on]:text-slate-900');
    expect(source).toContain('text-muted-foreground hover:bg-slate-100 hover:text-slate-900');
    expect(source).not.toContain('bg-primary text-primary-foreground');
  });
});
