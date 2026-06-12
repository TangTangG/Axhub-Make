import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './compactToolbarEnhancer.ts'), 'utf8');
}

describe('compactToolbarEnhancer source', () => {
  it('injects extra layer/action controls into the stroke settings popover without an opacity-count gate', () => {
    const source = readSource();

    expect(source).toContain('getOpenPopup: () => string | null | undefined;');
    expect(source).toContain("AXHUB_EXTRA_ACTIONS_OPEN_POPUP = 'compactStrokeStyles'");
    expect(source).toContain('this.getOpenPopup() !== AXHUB_EXTRA_ACTIONS_OPEN_POPUP');
    expect(source).toContain('injectExtraActionsIntoPropertiesPopover');
    expect(source).toContain('createExtraActionsSection');
    expect(source).not.toContain("data-testid=\"changeOpacity\"");
    expect(source).not.toContain('childElementCount >= 2');
  });

  it('moves the stroke settings trigger after the text properties trigger', () => {
    const source = readSource();

    expect(source).toContain('this.moveStrokeSettingsTriggerAfterTextProperties(actionsContainer)');
    expect(source).toContain('private moveStrokeSettingsTriggerAfterTextProperties(actionsContainer: Element)');
    expect(source).toContain('isStrokeSettingsTrigger');
    expect(source).toContain('isTextPropertiesTrigger');
    expect(source).toContain('textItem.after(strokeSettingsItem)');
  });

  it('does not maintain a second DOM-based generic shape popover', () => {
    const source = readSource();

    expect(source).toContain('private getTopToolbar()');
    expect(source).toContain("this.container.querySelector('.App-toolbar.App-toolbar--compact')");
    expect(source).toContain('this.installToolbarTooltips(toolbar)');
    expect(source).not.toContain('foldGenericShapeToolbarButtons');
    expect(source).not.toContain('collectGenericShapeToolbarOptions');
    expect(source).not.toContain('data-axhub-shape-popover-trigger');
    expect(source).not.toContain('data-axhub-hidden-shape-button');
    expect(source).not.toContain('axhub-shape-popover-menu');
    expect(source).not.toContain('shapePopover');
    expect(source).not.toContain("rectangleTool.addEventListener('pointerenter'");
  });

  it('does not inject an AI generation toolbar icon into the top canvas toolbar', () => {
    const source = readSource();

    expect(source).not.toContain("const AI_GENERATION_TOOLBAR_LABEL = 'AI 生成';");
    expect(source).not.toContain('onAiGenerationToolClick: () => void;');
    expect(source).not.toContain('this.injectAiGenerationToolbarButtons()');
    expect(source).not.toContain('private injectAiGenerationToolbarButton');
    expect(source).not.toContain("data-axhub-ai-generation-toolbar-btn");
    expect(source).not.toContain("const AI_IMAGE_TOOLBAR_LABEL = 'AI 生成图片';");
    expect(source).not.toContain("const PROTOTYPE_TOOLBAR_LABEL = 'AI 生成原型';");
    expect(source).not.toContain("data-axhub-ai-image-toolbar-btn");
    expect(source).not.toContain("data-axhub-prototype-toolbar-btn");
  });

  it('does not render AI image, prototype, or unified generation toolbar buttons', () => {
    const source = readSource();

    expect(source).not.toContain('this.wireToolbarButton(button, () => this.onAiGenerationToolClick());');
    expect(source).not.toContain('onAiImageToolClick: () => void;');
    expect(source).not.toContain('onPrototypeToolClick: () => void;');
    expect(source).not.toContain('private injectAiImageToolbarButton');
    expect(source).not.toContain('private injectPrototypeToolbarButton');
    expect(source).not.toContain('private injectAiGenerationToolbarButton');
    expect(source).not.toContain('AI_IMAGE_ICON_SVG');
    expect(source).not.toContain('PROTOTYPE_ICON_SVG');
  });

  it('injects a Drawio chart item into the extra tools menu', () => {
    const source = readSource();

    expect(source).toContain("const DRAWIO_TOOL_LABEL = 'Drawio 图表';");
    expect(source).toContain("const DRAWIO_TOOL_TOOLTIP = '插入 Drawio 图表';");
    expect(source).toContain('onDrawioToolClick: () => void;');
    expect(source).toContain('private onDrawioToolClick: () => void;');
    expect(source).toContain('this.onDrawioToolClick = opts.onDrawioToolClick;');
    expect(source).toContain('this.injectDrawioExtraToolsMenuItem();');
    expect(source).toContain('private injectDrawioExtraToolsMenuItem()');
    expect(source).toContain("data-axhub-drawio-extra-tools-item");
    expect(source).toContain('this.wireDropdownMenuItem(item, () => this.onDrawioToolClick());');
  });

  it('does not define a plus icon for a unified AI generation toolbar entry', () => {
    const source = readSource();
    const generationIcon = source.match(/const AI_GENERATION_ICON_SVG = `([^`]+)`;/)?.[1] ?? '';

    expect(generationIcon).toBe('');
    expect(generationIcon).not.toContain('PROTOTYPE_ICON_SVG');
  });

  it('does not keep ordering logic for a removed AI generation toolbar button', () => {
    const source = readSource();

    expect(source).not.toContain('private syncAiGenerationToolbarButtonOrder(');
    expect(source).not.toContain('const expectedOrder = [aiGenerationWrapper, extraToolsWrapper];');
    expect(source).not.toContain('wrapper.nextElementSibling !== extraToolsWrapper');
  });

  it('only removes legacy AI toolbar wrappers during cleanup', () => {
    const source = readSource();

    expect(source).toContain('TOOLBAR_BUTTON_HANDLER_VERSION');
    expect(source).toContain("button.setAttribute('data-axhub-toolbar-handler-version', TOOLBAR_BUTTON_HANDLER_VERSION);");
    expect(source).toContain('this.removeAiGenerationToolbarButtons();');
    expect(source).toContain('[data-axhub-ai-generation-toolbar-wrapper], [data-axhub-ai-image-toolbar-wrapper], [data-axhub-prototype-toolbar-wrapper]');
    expect(source).not.toContain('private ensureAiGenerationToolbarButton(wrapper: HTMLElement)');
    expect(source).not.toContain('existingButton.replaceWith(button);');
  });

  it('adds native tooltips while skipping grouped toolbar triggers', () => {
    const source = readSource();

    expect(source).toContain('private installToolbarTooltips(toolbar: Element)');
    expect(source).toContain('this.installToolbarTooltips(toolbar)');
    expect(source).toContain("const GROUPED_TOOLBAR_TOOLTIP_TEST_IDS = new Set(['toolbar-selection', 'toolbar-rectangle']);");
    expect(source).toContain("const TOOLBAR_TOOLTIP_LABELS: Record<string, string>");
    expect(source).toContain("'toolbar-selection': '选择工具'");
    expect(source).toContain("'toolbar-rectangle': '新增矩形'");
    expect(source).toContain("'toolbar-ellipse': '新增圆形'");
    expect(source).toContain("'toolbar-image': '新增图片'");
    expect(source).toContain('const isGroupedTrigger = GROUPED_TOOLBAR_TOOLTIP_TEST_IDS.has(testId);');
    expect(source).toContain('if (isGroupedTrigger && !input?.closest(\'.tool-popover-content\'))');
    expect(source).toContain('target.removeAttribute(\'title\');');
    expect(source).toContain('target.removeAttribute(\'data-axhub-toolbar-tooltip\');');
    expect(source).not.toContain("[data-axhub-ai-generation-toolbar-btn]");
    expect(source).toContain("target.title = label;");
  });

  it('does not add visual tooltip wiring for a removed AI toolbar wrapper', () => {
    const source = readSource();

    expect(source).not.toContain('this.applyToolbarVisualTooltip(wrapper, AI_GENERATION_TOOLBAR_LABEL);');
    expect(source).not.toContain('this.applyToolbarAriaLabel(button, AI_GENERATION_TOOLBAR_LABEL);');
    expect(source).not.toContain('this.applyToolbarVisualTooltip(button, AI_GENERATION_TOOLBAR_LABEL);');
  });

  it('keeps injected toolbar visual tooltips above open toolbar menus', () => {
    const source = readSource();

    expect(source).toContain('--axhub-toolbar-tooltip-z-index: calc(var(--zIndex-popup, 1000) + 1000);');
    expect(source).toContain('z-index: var(--axhub-toolbar-tooltip-z-index);');
    expect(source).not.toContain('.App-toolbar-content:has(.App-toolbar__extra-tools-dropdown) [data-axhub-toolbar-tooltip]:hover::after');
    expect(source).not.toContain('.App-toolbar-content:has(.tool-popover-content) [data-axhub-toolbar-tooltip]:hover::after');
  });

  it('appends the annotation entry as the last expanded property action', () => {
    const source = readSource();
    const actionsSection = source.match(
      /const extraActions = \[[\s\S]+?actionsFieldset\.appendChild\(actionsBtnList\);/,
    )?.[0] ?? '';
    const annotationButtonSection = source.match(
      /private createAnnotationActionButton\(\): HTMLButtonElement \{[\s\S]+?\n    \}/,
    )?.[0] ?? '';

    expect(source).toContain('private createAnnotationActionButton()');
    expect(actionsSection).toContain('actionsBtnList.appendChild(this.createAnnotationActionButton());');
    expect(actionsSection.indexOf('actionsBtnList.appendChild(this.createAnnotationActionButton());'))
      .toBeGreaterThan(actionsSection.indexOf('for (const action of extraActions)'));
    expect(annotationButtonSection).toContain('ANNOTATION_ICON_SVG');
    expect(annotationButtonSection).toContain('this.onAnnotationClick();');
  });
});
