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
    expect(source).toContain('{!isCanvasMode && !isResourceFolderPreview ? (');
  });

  it('passes review tab state and host page zoom into the review layout without panel close wiring', () => {
    const source = readPresentationAreaSource();
    const reviewPanelSource = source.slice(
      source.indexOf('{props.reviewPanelOpen && props.viewMode !== \'canvas\' ? ('),
      source.indexOf('</div>', source.indexOf('{props.reviewPanelOpen && props.viewMode !== \'canvas\' ? (')),
    );

    expect(source).toContain('reviewPageZoomEnabled={props.reviewPageZoomEnabled}');
    expect(source).toContain("{props.reviewPanelOpen && props.viewMode !== 'canvas' ? (");
    expect(reviewPanelSource).toContain('activeKind={props.activeReviewKind || \'design\'}');
    expect(reviewPanelSource).toContain('onKindChange={(kind) => props.handleReviewKindChange?.(kind)}');
    expect(reviewPanelSource).toContain('onTogglePageZoom={() => props.handleToggleReviewPageZoom?.()}');
    expect(reviewPanelSource).not.toContain('onClose');
    expect(reviewPanelSource).not.toContain('handleReviewPanelToggle');
  });

  it('forwards pane-scoped prototype prompt actions into the content area', () => {
    const source = readPresentationAreaSource();

    expect(source).toContain('onRunPrototypePanePromptAction={props.handleRunPrototypePanePromptAction}');
  });

  it('forwards canvas AI prompt submissions into the content area', () => {
    const source = readPresentationAreaSource();

    expect(source).toContain('onSubmitCanvasAssistantPrompt={props.onSubmitCanvasAssistantPrompt}');
    expect(source).not.toContain('onSubmitPrototypeAssistantPrompt={props.onSubmitPrototypeAssistantPrompt}');
  });
});
