import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readPresentationAreaSource() {
  return readFileSync(resolve(__dirname, './PresentationArea.tsx'), 'utf8');
}

describe('PresentationArea resource folder source', () => {
  it('hides the presentation toolbar while previewing a resource folder', () => {
    const source = readPresentationAreaSource();

    expect(source).toContain("const isResourceFolderPreview = props.contentMode === 'doc' && Boolean(props.selectedResourceFolder);");
    expect(source).toContain('const shouldShowPresentationToolbar = !isCanvasMode');
    expect(source).toContain('{shouldShowPresentationToolbar ? (');
  });

  it('hides the presentation toolbar on the prototype start draft page', () => {
    const source = readPresentationAreaSource();

    expect(source).toContain('const isPrototypeStartDraft = isPreviewContentMode && props.prototypeStartDraftActive === true && !props.selectedItem;');
    expect(source).toContain('&& !isPrototypeStartDraft');
  });

  it('hides the presentation toolbar on existing placeholder prototype start pages', () => {
    const source = readPresentationAreaSource();

    expect(source).toContain("const isPrototypeStartPlaceholder = isPreviewContentMode && props.selectedItem?.placeholder === true && props.viewMode === 'demo';");
    expect(source).toContain('&& !isPrototypeStartPlaceholder');
  });

  it('hides the assistant side panel on prototype start pages even when it is open', () => {
    const source = readPresentationAreaSource();

    expect(source).toContain('const shouldShowAssistantPanel = props.reviewPanelOpen');
    expect(source).toContain('&& !isPrototypeStartDraft');
    expect(source).toContain('&& !isPrototypeStartPlaceholder');
    expect(source).toContain('{shouldShowAssistantPanel ? (');
    expect(source).not.toContain("{props.reviewPanelOpen && props.viewMode !== 'canvas' ? (");
  });

  it('shows a non-sticky canvas action in the old toolbar top-right position on prototype start pages', () => {
    const source = readPresentationAreaSource();
    const startActionSource = source.slice(
      source.indexOf('{shouldShowPrototypeStartActions ? ('),
      source.indexOf('{shouldShowPresentationToolbar ? ('),
    );
    const openCanvasHandlerSource = source.slice(
      source.indexOf('const handleOpenPrototypeStartCanvas = async () => {'),
      source.indexOf('return (', source.indexOf('const handleOpenPrototypeStartCanvas = async () => {')),
    );

    expect(source).toContain('const shouldShowPrototypeStartActions = isPrototypeStartDraft || isPrototypeStartPlaceholder;');
    expect(source).toContain('{shouldShowPrototypeStartActions ? (');
    expect(openCanvasHandlerSource).toContain('const draftCreatedItem = isPrototypeStartDraft');
    expect(openCanvasHandlerSource).toContain('await props.onCreatePrototypeForDraftStart?.()');
    expect(openCanvasHandlerSource).toContain('const startItem = draftCreatedItem || props.selectedItem;');
    expect(openCanvasHandlerSource).toContain("props.setViewMode?.('canvas');");
    expect(source).toContain('className="relative flex flex-col flex-1 h-full min-h-0 min-w-0 bg-background"');
    expect(startActionSource).toContain('absolute right-8 top-5 z-10');
    expect(startActionSource).toContain('aria-label="打开画布"');
    expect(startActionSource).toContain('onClick={() => { void handleOpenPrototypeStartCanvas(); }}');
    expect(startActionSource).toContain('<PencilRuler className="h-4 w-4" />');
    expect(startActionSource).toContain('<span>画布</span>');
    expect(startActionSource).not.toContain('sticky');
    expect(startActionSource).not.toContain('<PresentationToolbar');
  });

  it('scopes prototype start actions to prototype preview content so document pages keep their toolbar', () => {
    const source = readPresentationAreaSource();

    expect(source).toContain("const isPreviewContentMode = props.contentMode === 'preview';");
    expect(source).toContain('const isPrototypeStartDraft = isPreviewContentMode');
    expect(source).toContain('const isPrototypeStartPlaceholder = isPreviewContentMode');
  });

  it('passes review tab state and host page zoom into the review layout without panel close wiring', () => {
    const source = readPresentationAreaSource();
    const reviewPanelSource = source.slice(
      source.indexOf('{shouldShowAssistantPanel ? ('),
      source.indexOf('</div>', source.indexOf('{shouldShowAssistantPanel ? (')),
    );

    expect(source).toContain('reviewPageZoomEnabled={props.reviewPageZoomEnabled}');
    expect(source).toContain('{shouldShowAssistantPanel ? (');
    expect(reviewPanelSource).toContain('activeKind={props.activeReviewKind || \'design\'}');
    expect(reviewPanelSource).toContain('reviewPrompt={props.reviewPrompt || \'\'}');
    expect(reviewPanelSource).toContain('reviewDocumentPath={props.reviewDocumentPath}');
    expect(reviewPanelSource).toContain("assistantOpen={props.assistantVisible === true && props.aiPanelMode === 'general-ai'}");
    expect(reviewPanelSource).toContain('onExecutePrompt={props.onExecutePrompt}');
    expect(reviewPanelSource).toContain('onKindChange={(kind) => props.handleReviewKindChange?.(kind)}');
    expect(reviewPanelSource).toContain('onCopyPrompt={() => { void props.handleCopyReviewPrompt?.(); }}');
    expect(reviewPanelSource).toContain('onTogglePageZoom={() => props.handleToggleReviewPageZoom?.()}');
    expect(reviewPanelSource).not.toContain('onClose');
    expect(reviewPanelSource).not.toContain('handleReviewPanelToggle');
  });

  it('forwards pane-scoped prototype prompt actions into the content area', () => {
    const source = readPresentationAreaSource();

    expect(source).toContain('onRunPrototypePanePromptAction={props.handleRunPrototypePanePromptAction}');
  });

  it('forwards prototype decision availability into the presentation toolbar', () => {
    const source = readPresentationAreaSource();
    const toolbarSource = source.slice(
      source.indexOf('<PresentationToolbar'),
      source.indexOf('/>', source.indexOf('<PresentationToolbar')),
    );

    expect(toolbarSource).toContain('prototypeDecisionDataAvailable={props.prototypeDecisionDataAvailable}');
  });

  it('forwards canvas AI prompt submissions into the content area', () => {
    const source = readPresentationAreaSource();

    expect(source).toContain('onSubmitCanvasAssistantPrompt={props.onSubmitCanvasAssistantPrompt}');
    expect(source).not.toContain('onSubmitPrototypeAssistantPrompt={props.onSubmitPrototypeAssistantPrompt}');
  });
});
