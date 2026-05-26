import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './CanvasPrototypeGenerationTool.tsx'), 'utf8');
}

describe('CanvasPrototypeGenerationTool source', () => {
  it('supports toolbar insertion, selection anchored composer, and status overlays', () => {
    const source = readSource();

    expect(source).toContain("document.addEventListener('axhub:insertPrototypeGenerator'");
    expect(source).toContain("document.removeEventListener('axhub:insertPrototypeGenerator'");
    expect(source).toContain('createPrototypeGeneratorElement');
    expect(source).toContain('resolveCanvasGeneratorPlacement');
    expect(source).toContain('<PrototypeGenerationComposer');
    expect(source).toContain('placement={selectedInfo.composerPlacement}');
    expect(source).toContain('CanvasNodeTitleLabel');
    expect(source).toContain('generatorTitleLabels');
    expect(source).toContain("title={label.title}");
    expect(source).toContain('generatorStatusOverlays');
    expect(source).toContain('stageLabel(overlay.task)');
    expect(source).toContain('formatElapsed(overlay.task)');
    expect(source).toContain('失败');
    expect(source).toContain('scrollToContent(generator.id');
    expect(source).not.toContain('getViewportCenter(');
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

  it('does not render a global bottom running-task timer', () => {
    const source = readSource();

    expect(source).not.toContain('const runningTask = useMemo');
    expect(source).not.toContain('bottom-4 left-1/2');
    expect(source).not.toContain('stageLabel(runningTask)');
    expect(source).not.toContain('formatElapsed(runningTask)');
  });

  it('runs acpx prompt execution and replaces the matching generator from prototype resource deltas', () => {
    const source = readSource();

    expect(source).toContain('getPrototypeGenerationTaskStore().submit');
    expect(source).not.toContain('onStartAssistantRuntime?.()');
    expect(source).not.toContain('Genie 运行时不可用');
    expect(source).toContain('derivePrototypeCanvasName');
    expect(source).toContain('deriveCurrentPrototypeContext');
    expect(source).toContain('canvasName: derivePrototypeCanvasName(canvasFilePath)');
    expect(source).toContain('currentPrototype: deriveCurrentPrototypeContext(canvasFilePath, prototypes)');
    expect(source).toContain('knownPrototypes: prototypes');
    expect(source).toContain('beforePrototypeNames');
    expect(source).toContain('refreshProjectPrototypes');
    expect(source).toContain('pickCreatedPrototype');
    expect(source).toContain('replacePrototypeGeneratorWithEmbeddable');
    expect(source).toContain('selectedInfo.element.id');
    expect(source).toContain('onSceneMutated?.()');
  });

  it('can start image-to-prototype from generated image details with the image attached', () => {
    const source = readSource();

    expect(source).toContain('PROTO_GENERATOR_EVENT_NAME');
    expect(source).toContain('referenceImages?: string[]');
    expect(source).toContain('referencePlacement?: CanvasGeneratorPlacement');
    expect(source).toContain('const referencePlacement = event.detail?.referencePlacement');
    expect(source).toContain('pendingInitialReferenceImages');
    expect(source).toContain('setPendingInitialReferenceImages(event.detail.referenceImages)');
    expect(source).toContain('insertGenerator(event.detail.referenceImages, referencePlacement)');
    expect(source).toContain('initialReferenceImages={pendingInitialReferenceImages}');
    expect(source).toContain('allowAttachments={true}');
    expect(source).toContain('width: placement.width');
    expect(source).toContain('height: placement.height');
  });

  it('suppresses native image crop hints while a prototype generator placeholder is selected', () => {
    const source = readSource();

    expect(source).toContain('data-axhub-prototype-generator-selected');
    expect(source).toContain("container.setAttribute('data-axhub-prototype-generator-selected', 'true')");
    expect(source).toContain("container.removeAttribute('data-axhub-prototype-generator-selected')");
  });

  it('fits a selected ungenerated prototype generator into view using canvas viewport rules', () => {
    const source = readSource();

    expect(source).toContain("import { shouldFitElementIntoCanvasViewport } from '../../components/content/canvas-embeds/activePreviewViewport';");
    expect(source).toContain('selectedGeneratorViewportFitRef');
    expect(source).toContain('cancelPendingSelectedGeneratorViewportFit');
    expect(source).toContain('shouldFitElementIntoCanvasViewport({');
    expect(source).toContain('element,');
    expect(source).toContain('appState,');
    expect(source).toContain('excalidrawAPI.scrollToContent(element.id, {');
    expect(source).toContain('fitToContent: true,');
    expect(source).toContain('animate: false,');
    expect(source).toContain('maxZoom: 1.4,');
  });

  it('aligns the prototype composer with the image composer layout and settings', () => {
    const source = readSource();

    expect(source).toContain('PROTOTYPE_COMPOSER_WIDTH = 640');
    expect(source).toContain('themes?: ThemeResourceItem[]');
    expect(source).toContain('defaultThemeName?: string | null');
    expect(source).toContain('themes={themes}');
    expect(source).toContain('defaultThemeName={defaultThemeName}');
  });

  it('turns copied canvas elements into prototype composer reference images on paste', () => {
    const source = readSource();

    expect(source).toContain('createCanvasReferenceSnapshot');
    expect(source).toContain('renderCanvasReferenceContext');
    expect(source).toContain('copiedCanvasReferenceRef');
    expect(source).toContain("document.addEventListener('copy'");
    expect(source).toContain("document.removeEventListener('copy'");
    expect(source).toContain('pasteCanvasReferenceImages');
    expect(source).toContain('canPasteReferenceImages={Boolean(copiedCanvasReferenceRef.current)}');
    expect(source).toContain('onPasteReferenceImages={pasteCanvasReferenceImages}');
    expect(source).toContain('toast.info(`已添加 ${images.length} 张画布参考图`)');
  });

  it('keeps a selected prototype generator deletable while the composer owns focus', () => {
    const source = readSource();

    expect(source).toContain('shouldDeleteCanvasGeneratorFromComposerKeydown');
    expect(source).toContain("document.addEventListener('keydown', handleComposerKeyDown, true)");
    expect(source).toContain("document.removeEventListener('keydown', handleComposerKeyDown, true)");
    expect(source).toContain("container.querySelector('[data-axhub-prototype-composer]')");
    expect(source).toContain('element.id === selectedInfo.element.id');
    expect(source).toContain('isDeleted: true');
    expect(source).toContain('selectedElementIds: {}');
  });
});
