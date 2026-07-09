import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readCompactCss() {
    return readFileSync(resolve(__dirname, './excalidraw-compact.css'), 'utf8');
}

function readRuleBlock(css: string, selector: string) {
    const start = css.indexOf(selector);
    expect(start).toBeGreaterThanOrEqual(0);

    const blockStart = css.indexOf('{', start);
    const blockEnd = css.indexOf('}', blockStart);
    expect(blockStart).toBeGreaterThanOrEqual(0);
    expect(blockEnd).toBeGreaterThan(blockStart);

    return css.slice(blockStart + 1, blockEnd);
}

describe('excalidraw compact canvas styles', () => {
    it('maps canvas selection affordances to Axhub brand tokens', () => {
        const css = readCompactCss();

        expect(css).toContain('--axhub-excalidraw-selection: #475569;');
        expect(css).toContain('--axhub-excalidraw-selection-fill: rgba(71, 85, 105, 0.04);');
        expect(css).toContain('--color-selection: var(--axhub-excalidraw-selection);');
        expect(css).toContain('--color-selection-fill: var(--axhub-excalidraw-selection-fill);');
        expect(css).toContain('--focus-highlight-color: rgba(71, 85, 105, 0.18);');
        expect(css).toContain('--axhub-excalidraw-selection: #94a3b8;');
        expect(css).toContain('--axhub-excalidraw-selection-fill: rgba(148, 163, 184, 0.1);');
        expect(css).toContain('--focus-highlight-color: rgba(148, 163, 184, 0.22);');
        expect(css).not.toContain('--axhub-excalidraw-selection: var(--axhub-excalidraw-brand);');
        expect(css).not.toContain('--axhub-excalidraw-selection-fill: rgba(0, 143, 93, 0.05);');
    });

    it('styles the property panel submenu like a standard dropdown menu', () => {
        const css = readCompactCss();

        expect(css).toContain('.axhub-canvas-property-panel-submenu .dropdown-menu-container');
        expect(css).toContain('min-width: 13rem;');
        expect(css).toContain('.axhub-canvas-property-panel-submenu .dropdown-menu-group-title');
        expect(css).toContain('font-size: 0.75rem;');
        expect(css).toContain('color: var(--color-gray-50, #999999);');
    });

    it('positions both compact and native full property panels from the menu preference', () => {
        const css = readCompactCss();

        expect(css).toContain('.axhub-excalidraw-property-panel-left .excalidraw .selected-shape-actions-container--compact');
        expect(css).toContain('.axhub-excalidraw-property-panel-right .excalidraw .selected-shape-actions-container:not(.selected-shape-actions-container--compact)');
        expect(css).toContain('.axhub-excalidraw-property-panel-right .excalidraw .selected-shape-actions-container:not(.selected-shape-actions-container--compact) .Island.App-menu__left');
        expect(css).toContain('.axhub-excalidraw-property-panel-left .excalidraw .selected-shape-actions-container:not(.selected-shape-actions-container--compact)');
    });

    it('keeps canvas background color controls styled in full property panel mode', () => {
        const css = readCompactCss();
        const controlRule = readRuleBlock(
            css,
            '.axhub-excalidraw-compact .excalidraw .axhub-canvas-background-expanded-control',
        );

        expect(css).toContain('.axhub-excalidraw-full .excalidraw .axhub-canvas-background-expanded-control');
        expect(css).toContain('.axhub-excalidraw-full .excalidraw .axhub-canvas-background-expanded-control__title');
        expect(css).toContain('.axhub-excalidraw-full .excalidraw .axhub-canvas-background-expanded-control__swatches');
        expect(css).toContain('.axhub-excalidraw-full .excalidraw .axhub-canvas-background-expanded-control__custom input[type=\'color\']');
        expect(controlRule).toContain('gap: 0;');
    });

    it('styles the canvas background title like a lightweight menu group title', () => {
        const css = readCompactCss();
        const titleRule = readRuleBlock(
            css,
            '.axhub-excalidraw-compact .excalidraw .axhub-canvas-background-expanded-control__title',
        );

        expect(titleRule).toContain('color: var(--color-gray-50, #999999);');
        expect(titleRule).toContain('font-size: 0.75rem;');
        expect(titleRule).toContain('font-weight: 500;');
        expect(titleRule).toContain('line-height: 1.2;');
        expect(titleRule).toContain('margin: 0.25rem 0 0.375rem;');
    });

    it('keeps the expanded top toolbar more menu trigger at the tuned compact size', () => {
        const css = readCompactCss();
        const triggerRule = readRuleBlock(
            css,
            '.axhub-excalidraw-full .excalidraw .App-toolbar__extra-tools-trigger',
        );
        const iconRule = readRuleBlock(
            css,
            '.axhub-excalidraw-full .excalidraw .App-toolbar__extra-tools-trigger svg',
        );

        expect(triggerRule).toContain('min-width: var(--axhub-excalidraw-large-button-size) !important;');
        expect(triggerRule).toContain('width: var(--axhub-excalidraw-large-button-size) !important;');
        expect(triggerRule).toContain('height: var(--axhub-excalidraw-button-size) !important;');
        expect(triggerRule).toContain('padding: 0 !important;');
        expect(iconRule).toContain('width: var(--axhub-excalidraw-prominent-icon-size) !important;');
        expect(iconRule).toContain('height: var(--axhub-excalidraw-prominent-icon-size) !important;');
    });

    it('does not keep selected AI generator placeholder hint overrides after removing the old composer node', () => {
        const css = readCompactCss();

        expect(css).not.toContain('[data-axhub-ai-generation-generator-selected=\'true\'] .excalidraw .HintViewer');
        expect(css).not.toContain('[data-axhub-ai-image-generator-selected=\'true\'] .excalidraw .HintViewer');
        expect(css).not.toContain('[data-axhub-prototype-generator-selected=\'true\'] .excalidraw .HintViewer');
    });

    it('keeps the injected prototype toolbar button on the same hover surface as native tools', () => {
        const css = readCompactCss();

        expect(css).toContain('.axhub-excalidraw-compact .excalidraw .App-toolbar-container .axhub-prototype-toolbar-button.ToolIcon_type_button .ToolIcon__icon');
        expect(css).not.toContain('axhub-ai-image-toolbar-button');
        expect(css).toContain('background: var(--button-hover-bg, var(--axhub-excalidraw-control-hover-bg)) !important;');
    });

    it('does not ship custom canvas welcome hint overlay styles', () => {
        const css = readCompactCss();

        expect(css).not.toContain('.axhub-canvas-welcome-hints');
        expect(css).not.toContain('.axhub-canvas-welcome-hint');
        expect(css).not.toContain('axhub-canvas-welcome-hint__arrow');
    });

    it('removes the duplicate footer help button and moves undo redo to the footer right', () => {
        const css = readCompactCss();
        const helpRule = readRuleBlock(
            css,
            '.axhub-excalidraw-compact .excalidraw .help-icon,\n.axhub-excalidraw-full .excalidraw .help-icon',
        );
        const undoRedoRule = readRuleBlock(
            css,
            '.axhub-excalidraw-compact .excalidraw .undo-redo-buttons,\n.axhub-excalidraw-full .excalidraw .undo-redo-buttons',
        );

        expect(css).toContain('.axhub-excalidraw-full .excalidraw .help-icon');
        expect(helpRule).toContain('display: none !important;');
        expect(css).toContain('.axhub-excalidraw-full .excalidraw .undo-redo-buttons');
        expect(undoRedoRule).toContain('position: absolute;');
        expect(undoRedoRule).toContain('right: 1rem;');
        expect(undoRedoRule).toContain('bottom: 0;');
        expect(undoRedoRule).toContain('margin-inline-start: 0;');
    });

    it('keeps top toolbar popovers close to their trigger controls', () => {
        const css = readCompactCss();
        const toolbarPopoverRule = readRuleBlock(
            css,
            '.axhub-excalidraw-compact .excalidraw .App-toolbar-content .tool-popover-content',
        );
        const extraToolsRule = readRuleBlock(
            css,
            '.axhub-excalidraw-compact .excalidraw .App-toolbar__extra-tools-dropdown',
        );

        expect(css).toContain('.axhub-excalidraw-full .excalidraw .App-toolbar-content .tool-popover-content');
        expect(toolbarPopoverRule).toContain('margin-top: 0.125rem !important;');
        expect(extraToolsRule).toContain('margin-top: 0.125rem !important;');
    });

    it('keeps Excalidraw tooltips above toolbar popovers and the extra tools menu', () => {
        const css = readCompactCss();
        const tooltipRule = readRuleBlock(css, '.excalidraw-tooltip');

        expect(tooltipRule).toContain('z-index: calc(var(--zIndex-popup, 1001) + 1000) !important;');
    });

    it('ships canvas chrome styles through the shared Excalidraw stylesheet entry', () => {
        const css = readCompactCss();
        const scopeRule = readRuleBlock(css, '.axhub-canvas-sidebar-toggle-scope');
        const capsuleRule = readRuleBlock(css, '.axhub-canvas-top-right-capsule');
        const welcomeTitleRule = readRuleBlock(css, '.excalidraw .axhub-canvas-welcome-title');
        const welcomeTitleIconRule = readRuleBlock(css, '.excalidraw .axhub-canvas-welcome-title__icon');

        expect(css).toContain('.axhub-canvas-sidebar-toggle-scope');
        expect(css).toContain('.excalidraw .axhub-canvas-sidebar-toggle-anchor');
        expect(css).toContain('.axhub-canvas-top-right-capsule');
        expect(css).toContain('.axhub-canvas-top-right-capsule__button');
        expect(css).toContain('.axhub-canvas-top-right-capsule__divider');
        expect(css).toContain('.excalidraw .welcome-screen-center__heading');
        expect(css).not.toContain('.excalidraw .axhub-canvas-return-anchor');
        expect(css).not.toContain('.excalidraw .axhub-welcome-menu-icon');
        expect(css).not.toContain('.excalidraw .axhub-canvas-welcome-subtitle');
        expect(scopeRule).toContain('width: 100%;');
        expect(scopeRule).toContain('height: 100%;');
        expect(scopeRule).toContain('min-width: 0;');
        expect(scopeRule).toContain('min-height: 0;');
        expect(scopeRule).toContain('--axhub-canvas-top-right-capsule-width: 73px;');
        expect(capsuleRule).toContain('width: var(--axhub-canvas-top-right-capsule-width);');
        expect(capsuleRule).toContain('border-radius: 0.5rem;');
        expect(capsuleRule).not.toContain('border-radius: 999px;');
        expect(welcomeTitleRule).toContain('color: var(--color-on-surface);');
        expect(welcomeTitleRule).toContain('display: inline-flex;');
        expect(welcomeTitleIconRule).toContain('color: var(--color-on-surface);');
    });

    it('nudges custom canvas top controls down in Excalidraw mobile mode to align with the native menu trigger', () => {
        const css = readCompactCss();
        const scopeRule = readRuleBlock(css, '.axhub-canvas-sidebar-toggle-scope');
        const mobileSidebarToggleRule = readRuleBlock(
            css,
            '.excalidraw.excalidraw--mobile .axhub-canvas-sidebar-toggle-anchor',
        );
        const mobileCapsuleRule = readRuleBlock(
            css,
            '.excalidraw.excalidraw--mobile ~ .axhub-canvas-top-right-capsule',
        );

        expect(scopeRule).toContain('--axhub-canvas-mobile-top-control-offset: 0.25rem;');
        expect(mobileSidebarToggleRule).toContain('top: calc(var(--editor-container-padding, 0.5rem) + var(--axhub-canvas-mobile-top-control-offset, 0.25rem));');
        expect(mobileCapsuleRule).toContain('top: calc(var(--editor-container-padding, 0.5rem) + var(--axhub-canvas-mobile-top-control-offset, 0.25rem));');
    });
});
