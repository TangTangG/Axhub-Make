import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './CanvasAiImageTool.tsx'), 'utf8');
}

describe('CanvasAiImageTool source', () => {
  it('supports click and drag insertion for the AI image generator component', () => {
    const source = readSource();

    expect(source).toContain('AI_IMAGE_GENERATOR_DRAG_MIME');
    expect(source).toContain('resolveCanvasGeneratorPlacement');
    expect(source).toContain('insertGenerator()');
    expect(source).toContain("document.addEventListener('axhub:insertAiImageGenerator'");
    expect(source).toContain("document.removeEventListener('axhub:insertAiImageGenerator'");
    expect(source).toContain('handleToolbarInsert');
    expect(source).toContain('scrollToContent(generator.id');
    expect(source).not.toContain('pointer-events-none absolute left-1/2 top-3');
    expect(source).not.toContain('onDragStart={handleGeneratorDragStart}');
    expect(source).not.toContain('getViewportCenter(');
  });

  it('renders generation state over the generator element instead of only in a global toast', () => {
    const source = readSource();

    expect(source).toContain('CanvasNodeTitleLabel');
    expect(source).toContain('generatorTitleLabels');
    expect(source).toContain("title={label.title}");
    expect(source).toContain('generatorStatusOverlays');
    expect(source).toContain('stageLabel(overlay.task)');
    expect(source).toContain('formatElapsed(overlay.task)');
    expect(source).toContain('失败');
  });

  it('keeps the generation state overlay on stable generator bounds during canvas drags', () => {
    const source = readSource();

    expect(source).toContain("from '../shared/canvasGeneratorOverlayPosition';");
    expect(source).toContain('stableStatusOverlayBoundsRef');
    expect(source).toContain('pruneStableCanvasGeneratorOverlayBounds');
    expect(source).toContain('resolveStableCanvasGeneratorOverlayBounds');
    expect(source).toContain('bounds.x');
    expect(source).toContain('bounds.y');
    expect(source).toContain('bounds.width * zoom');
    expect(source).toContain('bounds.height * zoom');
  });

  it('refreshes generator title label positions when the canvas viewport changes', () => {
    const source = readSource();

    expect(source).toContain('canvasOverlayRevision');
    expect(source).toContain('canvasOverlaySignatureRef');
    expect(source).toContain('refreshCanvasOverlayRevision');
    expect(source).toContain('refreshCanvasOverlayRevision();');
    expect(source).toContain('appState.scrollX');
    expect(source).toContain('appState.scrollY');
    expect(source).toContain('appState.zoom?.value');
    expect(source).toMatch(/generatorTitleLabels[\s\S]*canvasOverlayRevision/);
  });

  it('stores image conversation metadata on the generator element for refresh recovery', () => {
    const source = readSource();

    expect(source).toContain('conversationId={String(selectedInfo.element.customData?.conversationId || \'\')}');
    expect(source).toContain('onTaskStarted={(task) => {');
    expect(source).toContain('generationTaskId: task.id');
    expect(source).toContain('conversationId: task.conversationId');
    expect(source).toContain('roundId: task.roundId');
  });

  it('does not render a global bottom running-task timer', () => {
    const source = readSource();

    expect(source).not.toContain('const runningTask = useMemo');
    expect(source).not.toContain('bottom-4 left-1/2');
    expect(source).not.toContain('stageLabel(runningTask)');
    expect(source).not.toContain('formatElapsed(runningTask)');
  });

  it('does not render generated image detail entry points', () => {
    const source = readSource();

    expect(source).toContain("selectedInfo?.kind === 'generator'");
    expect(source).toContain("kind: 'generator' | 'image';");
    expect(source).not.toContain('const [detailTarget, setDetailTarget]');
    expect(source).not.toContain('handleOpenSelectedImageDetail');
    expect(source).not.toContain('setDetailOpen(true)');
    expect(source).not.toContain('aria-label="查看图片详情"');
    expect(source).not.toContain("import AiImageDetailDialog from './AiImageDetailDialog';");
    expect(source).not.toContain('<AiImageDetailDialog');
    expect(source).not.toContain('selectedImageId={detailTarget?.imageId}');
    expect(source).not.toContain('sourceTaskId={detailTarget?.taskId}');
    expect(source).not.toContain('data-axhub-ai-image-detail-trigger');
    expect(source).not.toContain('<Info style={AI_IMAGE_DETAIL_ICON_STYLE} />');
    expect(source).not.toContain("import AiImageHistoryDialog from './AiImageHistoryDialog';");
    expect(source).not.toContain('<AiImageHistoryDialog');
    expect(source).not.toContain('历史');
    expect(source).not.toContain("selectedInfo.kind === 'generator' || selectedInfo.kind === 'image'");
    expect(source).not.toContain('setGenerationOpen(true)');
  });

  it('does not render inline controls for selected ordinary generated images', () => {
    const source = readSource();

    expect(source).not.toContain("{selectedInfo?.kind === 'image' ? (");
    expect(source).not.toContain('data-axhub-ai-image-detail-trigger');
    expect(source).not.toContain('createImageDetailTriggerStyle');
    expect(source).not.toContain('<Info style={AI_IMAGE_DETAIL_ICON_STYLE} />');
    expect(source).not.toContain('rounded-md border bg-background/95 p-1 shadow-sm backdrop-blur');
    expect(source).not.toContain("import { Button } from '@/components/ui/button';");
  });

  it('uses an anchored non-modal composer for selected generator elements', () => {
    const source = readSource();

    expect(source).toContain("import AiImageGenerationComposer from './AiImageGenerationComposer';");
    expect(source).toContain('<AiImageGenerationComposer');
    expect(source).toContain("selectedInfo?.kind === 'generator' ? (");
    expect(source).toContain('placement={selectedInfo.composerPlacement}');
    expect(source).toContain('clampComposerTop');
    expect(source).toContain('const AI_IMAGE_COMPOSER_WIDTH = 640;');
    expect(source).toContain('const AI_IMAGE_COMPOSER_ESTIMATED_HEIGHT = 128;');
    expect(source).toContain('containerHeight - AI_IMAGE_COMPOSER_ESTIMATED_HEIGHT - AI_IMAGE_COMPOSER_BOTTOM_INSET');
    expect(source).not.toContain("import AiImageGenerationDialog from './AiImageGenerationDialog';");
    expect(source).not.toContain('<AiImageGenerationDialog');
    expect(source).not.toContain('const [generationOpen');
  });

  it('scopes unsent image composer drafts to the selected image generator node', () => {
    const source = readSource();

    expect(source).toContain("import { createCanvasGenerationComposerDraftStorageKey } from '../shared/canvasGenerationComposerDraft';");
    expect(source).toContain('selectedImageComposerDraftStorageKey');
    expect(source).toContain('assistantProjectPath');
    expect(source).toContain('selectedInfo.element.id');
    expect(source).toContain("'ai-image'");
    expect(source).toContain('draftStorageKey={selectedImageComposerDraftStorageKey}');
  });

  it('resizes the selected generator placeholder when image size settings change', () => {
    const source = readSource();

    expect(source).toContain('getAiImageDisplaySize');
    expect(source).toContain('resizeSelectedGeneratorForParams');
    expect(source).toContain('onParamsChanged={resizeSelectedGeneratorForParams}');
    expect(source).toContain('width: size.width');
    expect(source).toContain('height: size.height');
  });

  it('suppresses native image crop hints only while an AI image generator placeholder is selected', () => {
    const source = readSource();

    expect(source).toContain('data-axhub-ai-image-generator-selected');
    expect(source).toContain("selectedInfo?.kind === 'generator'");
    expect(source).toContain("container.setAttribute('data-axhub-ai-image-generator-selected', 'true')");
    expect(source).toContain("container.removeAttribute('data-axhub-ai-image-generator-selected')");
  });

  it('refreshes old cached generator placeholder files to the current gray placeholder', () => {
    const source = readSource();

    expect(source).toContain('refreshAiImagePlaceholderFile');
    expect(source).toContain('migrateAiImageGeneratorPlaceholders');
    expect(source).toContain('element.fileId === AI_IMAGE_PLACEHOLDER_FILE_ID');
    expect(source).toContain('fileId: AI_IMAGE_PLACEHOLDER_FILE_ID');
    expect(source).toContain('onSceneMutated?.()');
  });

  it('fits a selected ungenerated AI image generator into view using canvas viewport rules', () => {
    const source = readSource();

    expect(source).toContain("import { shouldFitElementIntoCanvasViewport } from '../../components/content/canvas-embeds/activePreviewViewport';");
    expect(source).toContain('selectedGeneratorViewportFitRef');
    expect(source).toContain('cancelPendingSelectedGeneratorViewportFit');
    expect(source).toContain("kind === 'generator'");
    expect(source).toContain('shouldFitElementIntoCanvasViewport({');
    expect(source).toContain('element,');
    expect(source).toContain('appState,');
    expect(source).toContain('excalidrawAPI.scrollToContent(element.id, {');
    expect(source).toContain('fitToContent: true,');
    expect(source).toContain('animate: false,');
    expect(source).toContain('maxZoom: 1.4,');
  });

  it('turns copied canvas elements into composer reference images on paste', () => {
    const source = readSource();

    expect(source).toContain('createCanvasReferenceSnapshot');
    expect(source).toContain('renderCanvasReferenceContext');
    expect(source).toContain('copiedCanvasReferenceRef');
    expect(source).toContain('pendingInitialLocalContextRefs');
    expect(source).toContain('localContextRefs');
    expect(source).toContain("document.addEventListener('copy'");
    expect(source).toContain("document.removeEventListener('copy'");
    expect(source).toContain('canPasteReferenceImages');
    expect(source).toContain('onPasteReferenceImages');
    expect(source).toContain('initialLocalContextRefs={pendingInitialLocalContextRefs}');
    expect(source).toContain('toast.info(`已添加 ${images.length} 张画布参考图`)');
  });

  it('passes preferred prompt client into the AI image composer', () => {
    const source = readSource();

    expect(source).toContain('preferredPromptClient?: PromptClientPreference;');
    expect(source).toContain('preferredPromptClient,');
    expect(source).toContain('preferredPromptClient={preferredPromptClient}');
  });

  it('delegates completed image artifacts to the canvas-level image artifact listener', () => {
    const source = readSource();

    expect(source).toContain('onImageArtifact?: (event: CanvasImageArtifactEvent) => void;');
    expect(source).toContain("import { createCanvasImageArtifactEventFromAiImageTask, type CanvasImageArtifactEvent } from './canvasImageArtifacts';");
    expect(source).toContain('const handleImageTaskFinished = useCallback((task: AiImageTaskRecord) => {');
    expect(source).toContain('createCanvasImageArtifactEventFromAiImageTask(task, {');
    expect(source).toContain("sourceScene: 'design',");
    expect(source).toContain('onImageArtifact?.(artifactEvent);');
    expect(source).toContain('generatorElementId={selectedInfo.element.id}');
    expect(source).toContain('assistantProjectPath={assistantProjectPath}');
    expect(source).toContain('onTaskFinished={handleImageTaskFinished}');
    expect(source).not.toContain('const replaceSelectedGeneratorWithTask = useCallback');
    expect(source).not.toContain('replaceGeneratorWithImageElements');
  });

  it('shows local context and prompt generation stages in the generator overlay', () => {
    const source = readSource();

    expect(source).toContain("if (task.stage === 'preparing-context') return '准备上下文中';");
    expect(source).toContain("if (task.stage === 'generating-prompt') return '生成提示词中';");
    expect(source).toContain("return '生成图片中';");
  });

  it('keeps image-to-image detail dialog entry points removed from selected images', () => {
    const source = readSource();

    expect(source).toContain('pendingInitialReferenceImages');
    expect(source).toContain('initialReferenceImages={pendingInitialReferenceImages}');
    expect(source).toContain('width: placement.width');
    expect(source).toContain('height: placement.height');
    expect(source).not.toContain('handleCreateImageToImage');
    expect(source).not.toContain('handleCreateImageToPrototype');
    expect(source).not.toContain('resolveCanvasGeneratorPlacementFromReferenceElement');
    expect(source).not.toContain('createReferenceImageGeneratorPlacement');
    expect(source).not.toContain('onCreateImageToImage={handleCreateImageToImage}');
    expect(source).not.toContain('toast.success(\'已创建图生图生成器\')');
  });

  it('keeps an image-to-image generator deletable while reference attachments are preloaded', () => {
    const source = readSource();

    expect(source).toContain('shouldDeleteAiImageGeneratorFromComposerKeydown');
    expect(source).toContain("document.addEventListener('keydown', handleComposerKeyDown, true)");
    expect(source).toContain("document.removeEventListener('keydown', handleComposerKeyDown, true)");
    expect(source).toContain("container.querySelector('[data-axhub-ai-image-composer]')");
    expect(source).toContain("selectedInfo?.kind !== 'generator'");
    expect(source).toContain('element.id === selectedInfo.element.id');
    expect(source).toContain('isDeleted: true');
    expect(source).toContain('selectedElementIds: {}');
  });
});
