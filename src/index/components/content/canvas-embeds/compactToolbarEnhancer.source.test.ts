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

  it('injects the AI image generator as the penultimate toolbar icon before the extra tools menu', () => {
    const source = readSource();

    expect(source).toContain("const AI_IMAGE_TOOLBAR_LABEL = 'AI 生成图片';");
    expect(source).toContain('onAiImageToolClick: () => void;');
    expect(source).toContain('this.injectAiGenerationToolbarButtons()');
    expect(source).toContain('private injectAiImageToolbarButton()');
    expect(source).toContain("data-axhub-ai-image-toolbar-btn");
    expect(source).toContain("data-axhub-ai-image-toolbar-wrapper");
    expect(source).toContain('extraToolsTrigger.closest');
    expect(source).toContain('extraToolsWrapper.parentElement');
    expect(source).toContain('const aiImageWrapper = this.injectAiImageToolbarButton(toolbarParent);');
    expect(source).toContain('this.syncAiGenerationToolbarButtonOrder(toolbarParent, aiImageWrapper, prototypeWrapper, extraToolsWrapper);');
    expect(source).toContain("wrapper.className = 'ToolIcon axhub-ai-image-toolbar-tool';");
    expect(source).toContain('this.applyToolbarVisualTooltip(wrapper, AI_IMAGE_TOOLBAR_LABEL);');
    expect(source).toContain('this.applyToolbarAriaLabel(button, AI_IMAGE_TOOLBAR_LABEL);');
    expect(source).not.toContain('toolbar.insertBefore(wrapper, extraToolsWrapper)');
    expect(source).not.toContain('extraToolsWrapper.after(wrapper)');
  });

  it('injects the prototype generator immediately after the AI image generator before extra tools', () => {
    const source = readSource();

    expect(source).toContain("const PROTOTYPE_TOOLBAR_LABEL = 'AI 生成原型';");
    expect(source).toContain('onPrototypeToolClick: () => void;');
    expect(source).toContain('private onPrototypeToolClick: () => void;');
    expect(source).toContain('this.onPrototypeToolClick = opts.onPrototypeToolClick;');
    expect(source).toContain('PROTOTYPE_ICON_SVG');
    expect(source).toContain('private injectAiGenerationToolbarButtons()');
    expect(source).toContain('private injectPrototypeToolbarButton(');
    expect(source).toContain("data-axhub-prototype-toolbar-btn");
    expect(source).toContain("data-axhub-prototype-toolbar-wrapper");
    expect(source).toContain("wrapper.className = 'ToolIcon axhub-prototype-toolbar-tool';");
    expect(source).toContain('this.applyToolbarVisualTooltip(wrapper, PROTOTYPE_TOOLBAR_LABEL);');
    expect(source).toContain('this.applyToolbarAriaLabel(button, PROTOTYPE_TOOLBAR_LABEL);');
    expect(source).toContain('this.wireToolbarButton(button, () => this.onPrototypeToolClick());');
    expect(source).toContain('const prototypeWrapper = this.injectPrototypeToolbarButton(toolbarParent);');
    expect(source).toContain('this.syncAiGenerationToolbarButtonOrder(toolbarParent, aiImageWrapper, prototypeWrapper, extraToolsWrapper);');
    expect(source).not.toContain('aiImageWrapper.after(wrapper)');
  });

  it('uses a document-plus prototype icon that matches the image-plus toolbar style', () => {
    const source = readSource();
    const prototypeIcon = source.match(/const PROTOTYPE_ICON_SVG = `([^`]+)`;/)?.[1] ?? '';

    expect(prototypeIcon).toContain('width="18" height="18"');
    expect(prototypeIcon).toContain('stroke-width="2"');
    expect(prototypeIcon).toContain('<path d="M19 3v6"/>');
    expect(prototypeIcon).toContain('<path d="M16 6h6"/>');
    expect(prototypeIcon).toContain('<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/>');
    expect(prototypeIcon).toContain('<path d="M8 8h5"/>');
    expect(prototypeIcon).toContain('<path d="M8 12h6"/>');
    expect(prototypeIcon).not.toContain('<path d="M8 21h8"/>');
    expect(prototypeIcon).not.toContain('<path d="M12 18v3"/>');
  });

  it('keeps the AI image and prototype toolbar buttons stable before the extra tools menu', () => {
    const source = readSource();

    expect(source).toContain('private syncAiGenerationToolbarButtonOrder(');
    expect(source).toContain('const expectedOrder = [aiImageWrapper, prototypeWrapper, extraToolsWrapper];');
    expect(source).toContain('if (currentNode === expectedNode) {');
    expect(source).toContain('toolbarParent.insertBefore(expectedNode, currentNode);');
    expect(source).not.toContain('wrapper.nextElementSibling !== extraToolsWrapper');
  });

  it('rewires hot-reloaded AI toolbar buttons so existing DOM remains clickable', () => {
    const source = readSource();

    expect(source).toContain('TOOLBAR_BUTTON_HANDLER_VERSION');
    expect(source).toContain('private ensureAiImageToolbarButton(wrapper: HTMLElement)');
    expect(source).toContain('private ensurePrototypeToolbarButton(wrapper: HTMLElement)');
    expect(source).toContain("button.setAttribute('data-axhub-toolbar-handler-version', TOOLBAR_BUTTON_HANDLER_VERSION);");
    expect(source).toContain('existingButton.replaceWith(button);');
    expect(source).toContain("button.addEventListener('pointerdown', handleActivation, true);");
    expect(source).toContain("button.addEventListener('click', handleActivation);");
    expect(source).toContain('this.removeAiGenerationToolbarButtons();');
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
    expect(source).toContain('this.applyToolbarAriaLabel(button, label)');
    expect(source).toContain("target.title = label;");
  });

  it('adds a single visual tooltip to each injected AI toolbar wrapper without native title bubbles', () => {
    const source = readSource();

    expect(source).toContain('private applyToolbarVisualTooltip(target: HTMLElement, label: string)');
    expect(source).toContain('target.removeAttribute(\'title\');');
    expect(source).toContain("target.setAttribute('aria-label', label);");
    expect(source).toContain("target.setAttribute('data-axhub-toolbar-tooltip', label);");
    expect(source).toContain('this.applyToolbarVisualTooltip(wrapper, AI_IMAGE_TOOLBAR_LABEL);');
    expect(source).toContain('this.applyToolbarAriaLabel(button, AI_IMAGE_TOOLBAR_LABEL);');
    expect(source).toContain('this.applyToolbarVisualTooltip(wrapper, PROTOTYPE_TOOLBAR_LABEL);');
    expect(source).toContain('this.applyToolbarAriaLabel(button, PROTOTYPE_TOOLBAR_LABEL);');
    expect(source).not.toContain('this.applyToolbarVisualTooltip(button, AI_IMAGE_TOOLBAR_LABEL);');
    expect(source).not.toContain('this.applyToolbarVisualTooltip(button, PROTOTYPE_TOOLBAR_LABEL);');
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
