/**
 * compactToolbarEnhancer.ts
 *
 * Enhances the Excalidraw compact-mode element toolbar:
 *  1. Injects layer/action controls into the "adjust/properties" popover
 *     so they appear alongside style properties (fill, stroke, etc.).
 *  2. Injects a "批注" (annotation) button into the toolbar and expanded
 *     property action section.
 *
 * The module uses MutationObserver to detect when the compact toolbar
 * and its popovers appear in the DOM, then wires up button injection.
 * All DOM changes are cleaned up on disconnect().
 */

/* ── SVG icons ────────────────────────────────────────────────── */

const ANNOTATION_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`;
const AI_IMAGE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><circle cx="9" cy="9" r="2"/><path d="M19 3v6"/><path d="M16 6h6"/></svg>`;
const PROTOTYPE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><path d="M8 8h5"/><path d="M8 12h6"/><path d="M8 16h8"/><path d="M19 3v6"/><path d="M16 6h6"/></svg>`;
const AI_IMAGE_TOOLBAR_LABEL = 'AI 生成图片';
const PROTOTYPE_TOOLBAR_LABEL = 'AI 生成原型';

/* Layer action icons (matching Excalidraw style) */
const ICON_SEND_TO_BACK = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/><line x1="12" y1="9" x2="12" y2="21"/><polyline points="4 4 20 4"/></svg>`;
const ICON_SEND_BACKWARD = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
const ICON_BRING_FORWARD = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
const ICON_BRING_TO_FRONT = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/><line x1="12" y1="15" x2="12" y2="3"/><polyline points="4 20 20 20"/></svg>`;
const ICON_GROUP = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/><path d="M7 14v1a2 2 0 0 0 2 2h1"/><path d="M14 7h1a2 2 0 0 1 2 2v1"/></svg>`;
const ICON_UNGROUP = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/></svg>`;
const ICON_LINK = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

const AXHUB_EXTRA_ACTIONS_OPEN_POPUP = 'compactStrokeStyles';
const STROKE_SETTINGS_ICON_PATH = 'M14 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0';
const TEXT_PROPERTIES_ICON_PATH = 'M3 7v-2h13v2';
const TOOLBAR_BUTTON_HANDLER_VERSION = '2';
const GROUPED_TOOLBAR_TOOLTIP_TEST_IDS = new Set(['toolbar-selection', 'toolbar-rectangle']);
const TOOLBAR_TOOLTIP_LABELS: Record<string, string> = {
    'toolbar-hand': '移动画布',
    'toolbar-selection': '选择工具',
    'toolbar-freedraw': '自由绘制',
    'toolbar-eraser': '橡皮擦',
    'toolbar-rectangle': '新增矩形',
    'toolbar-diamond': '新增菱形',
    'toolbar-ellipse': '新增圆形',
    'toolbar-arrow': '新增箭头',
    'toolbar-line': '新增线条',
    'toolbar-text': '新增文字',
    'toolbar-image': '新增图片',
    'toolbar-frame': '新增框架',
    'toolbar-embeddable': '新增嵌入内容',
    'toolbar-laser': '激光笔',
};

/* ── Keyboard shortcut definitions ────────────────────────────── */

const IS_MAC = typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform || '');

function dispatchKeyboardShortcut(key: string, opts: { meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) {
    const target = document.querySelector('.excalidraw') as HTMLElement;
    if (!target) return;
    target.focus();
    const event = new KeyboardEvent('keydown', {
        key,
        code: `Key${key.toUpperCase()}`,
        bubbles: true,
        cancelable: true,
        metaKey: IS_MAC ? (opts.meta ?? false) : false,
        ctrlKey: IS_MAC ? false : (opts.ctrl ?? opts.meta ?? false),
        shiftKey: opts.shift ?? false,
        altKey: opts.alt ?? false,
    });
    target.dispatchEvent(event);
}

/* ── Types ─────────────────────────────────────────────────────── */

export interface CompactToolbarEnhancerOptions {
    /** The container wrapping the <Excalidraw> component. */
    container: HTMLElement;
    /** Callback when the user clicks the annotation button. */
    onAnnotationClick: () => void;
    /** Callback when the user clicks the AI image generator toolbar icon. */
    onAiImageToolClick: () => void;
    /** Callback when the user clicks the AI prototype generator toolbar icon. */
    onPrototypeToolClick: () => void;
    /** Returns true when the currently selected element has an annotation. */
    hasAnnotation: () => boolean;
    /** Returns the currently open Excalidraw compact popup. */
    getOpenPopup: () => string | null | undefined;
}

/* ── Main class ───────────────────────────────────────────────── */

export class CompactToolbarEnhancer {
    private container: HTMLElement;
    private onAnnotationClick: () => void;
    private onAiImageToolClick: () => void;
    private onPrototypeToolClick: () => void;
    private hasAnnotation: () => boolean;
    private getOpenPopup: () => string | null | undefined;
    private observer: MutationObserver | null = null;
    /** We schedule a RAF to batch DOM reads/writes. */
    private rafId = 0;

    constructor(opts: CompactToolbarEnhancerOptions) {
        this.container = opts.container;
        this.onAnnotationClick = opts.onAnnotationClick;
        this.onAiImageToolClick = opts.onAiImageToolClick;
        this.onPrototypeToolClick = opts.onPrototypeToolClick;
        this.hasAnnotation = opts.hasAnnotation;
        this.getOpenPopup = opts.getOpenPopup;
    }

    /* ── Public API ─────────────────────────────────────────────── */

    connect() {
        this.observer = new MutationObserver(() => this.scheduleEnhance());
        this.observer.observe(this.container, { childList: true, subtree: true });
        // Also observe body for popovers (they render via portals)
        this.bodyObserver = new MutationObserver(() => this.scheduleEnhance());
        this.bodyObserver.observe(document.body, { childList: true, subtree: true });
        // Initial run
        this.scheduleEnhance();
    }

    private bodyObserver: MutationObserver | null = null;

    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.bodyObserver) {
            this.bodyObserver.disconnect();
            this.bodyObserver = null;
        }
        cancelAnimationFrame(this.rafId);
        this.removeAiGenerationToolbarButtons();
    }

    /** Call when the selection changes to refresh the annotation button highlight. */
    refreshAnnotationHighlight() {
        const btns = document.querySelectorAll<HTMLButtonElement>('[data-axhub-annotation-btn]');
        const has = this.hasAnnotation();
        for (const btn of btns) {
            btn.classList.toggle('axhub-annotation-active', has);
            btn.title = has ? '编辑批注' : '添加批注';
        }
    }

    /* ── Internal ───────────────────────────────────────────────── */

    private scheduleEnhance() {
        cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(() => this.enhance());
    }

    private enhance() {
        const toolbar = this.getTopToolbar();
        if (toolbar) {
            this.installToolbarTooltips(toolbar);
        }
        this.injectAiGenerationToolbarButtons();

        const actionsContainer = this.container.querySelector('.compact-shape-actions');
        if (!actionsContainer) return;

        this.moveStrokeSettingsTriggerAfterTextProperties(actionsContainer);
        this.injectAnnotationButton(actionsContainer);
        this.injectExtraActionsIntoPropertiesPopover();
    }

    private moveStrokeSettingsTriggerAfterTextProperties(actionsContainer: Element) {
        const actionItems = Array.from(actionsContainer.querySelectorAll(':scope > .compact-action-item'));
        const strokeSettingsItem = actionItems.find((item) => {
            const trigger = this.getCompactPropertiesTrigger(item);
            return trigger ? this.isStrokeSettingsTrigger(trigger) : false;
        });
        const textItem = actionItems.find((item) => {
            const trigger = this.getCompactPropertiesTrigger(item);
            return trigger ? this.isTextPropertiesTrigger(trigger) : false;
        });

        if (!strokeSettingsItem || !textItem || strokeSettingsItem === textItem) return;
        if (strokeSettingsItem.previousElementSibling === textItem) return;

        textItem.after(strokeSettingsItem);
    }

    private getCompactPropertiesTrigger(item: Element) {
        return item.querySelector('.compact-action-button.properties-trigger') as HTMLButtonElement | null;
    }

    private isStrokeSettingsTrigger(trigger: HTMLButtonElement) {
        const title = (trigger.title || trigger.getAttribute('aria-label') || '').toLowerCase();
        if (title.includes('stroke') || title.includes('描边') || title.includes('设置')) return true;
        return trigger.innerHTML.includes(STROKE_SETTINGS_ICON_PATH);
    }

    private isTextPropertiesTrigger(trigger: HTMLButtonElement) {
        const title = (trigger.title || trigger.getAttribute('aria-label') || '').toLowerCase();
        if (title.includes('text') || title.includes('align') || title.includes('文本') || title.includes('对齐')) return true;
        return trigger.innerHTML.includes(TEXT_PROPERTIES_ICON_PATH);
    }

    private installToolbarTooltips(toolbar: Element) {
        for (const [testId, label] of Object.entries(TOOLBAR_TOOLTIP_LABELS)) {
            const input = this.getTopToolbarInput(toolbar, testId);
            const target = input ? this.getToolbarToolRoot(input) : toolbar.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
            if (!target) continue;

            const isGroupedTrigger = GROUPED_TOOLBAR_TOOLTIP_TEST_IDS.has(testId);
            if (isGroupedTrigger && !input?.closest('.tool-popover-content')) {
                target.removeAttribute('title');
                target.removeAttribute('data-axhub-toolbar-tooltip');
                target.setAttribute('aria-label', label);
                input?.setAttribute('aria-label', label);
                continue;
            }

            target.title = label;
            target.setAttribute('aria-label', label);
            target.setAttribute('data-axhub-toolbar-tooltip', label);
            input?.setAttribute('aria-label', label);
        }

        for (const button of toolbar.querySelectorAll<HTMLButtonElement>(
            '[data-axhub-ai-image-toolbar-btn], [data-axhub-prototype-toolbar-btn]',
        )) {
            const label = button.getAttribute('aria-label') || button.title || button.closest<HTMLElement>('[data-axhub-toolbar-tooltip]')?.getAttribute('data-axhub-toolbar-tooltip');
            if (!label) continue;
            this.applyToolbarAriaLabel(button, label);
        }
    }

    private applyToolbarVisualTooltip(target: HTMLElement, label: string) {
        target.removeAttribute('title');
        target.setAttribute('aria-label', label);
        target.setAttribute('data-axhub-toolbar-tooltip', label);
    }

    private applyToolbarAriaLabel(target: HTMLElement, label: string) {
        target.removeAttribute('title');
        target.removeAttribute('data-axhub-toolbar-tooltip');
        target.setAttribute('aria-label', label);
    }

    private getTopToolbarInput(toolbar: Element, testId: string) {
        return Array.from(toolbar.querySelectorAll<HTMLInputElement>(`[data-testid="${testId}"]`))
            .find((input) => !input.closest('.tool-popover-content')) ?? null;
    }

    private getToolbarToolRoot(input: HTMLInputElement): HTMLElement | null {
        return input.closest('.ToolIcon') as HTMLElement | null;
    }

    private injectAiGenerationToolbarButtons() {
        const toolbar = this.getTopToolbar();
        if (!toolbar) return;

        const extraToolsTrigger = toolbar.querySelector<HTMLElement>('.App-toolbar__extra-tools-trigger');
        if (!extraToolsTrigger) return;

        const menuWrapper = extraToolsTrigger.closest('.dropdown-menu') || extraToolsTrigger;
        const extraToolsWrapper = menuWrapper;
        const toolbarParent = extraToolsWrapper.parentElement;
        if (!toolbarParent || !toolbar.contains(toolbarParent)) return;

        const aiImageWrapper = this.injectAiImageToolbarButton(toolbarParent);
        const prototypeWrapper = this.injectPrototypeToolbarButton(toolbarParent);
        this.syncAiGenerationToolbarButtonOrder(toolbarParent, aiImageWrapper, prototypeWrapper, extraToolsWrapper);
    }

    private injectAiImageToolbarButton(): HTMLElement | null;
    private injectAiImageToolbarButton(toolbarParent: Element): HTMLElement | null;
    private injectAiImageToolbarButton(toolbarParent?: Element): HTMLElement | null {
        if (!toolbarParent) {
            this.injectAiGenerationToolbarButtons();
            return null;
        }
        const existingWrapper = toolbarParent.querySelector<HTMLElement>('[data-axhub-ai-image-toolbar-wrapper]');
        const wrapper = existingWrapper || this.createAiImageToolbarButton();
        this.ensureAiImageToolbarButton(wrapper);

        return wrapper;
    }

    private injectPrototypeToolbarButton(toolbarParent: Element): HTMLElement {
        const existingWrapper = toolbarParent.querySelector<HTMLElement>('[data-axhub-prototype-toolbar-wrapper]');
        const wrapper = existingWrapper || this.createPrototypeToolbarButton();
        this.ensurePrototypeToolbarButton(wrapper);

        return wrapper;
    }

    private syncAiGenerationToolbarButtonOrder(
        toolbarParent: Element,
        aiImageWrapper: HTMLElement | null,
        prototypeWrapper: HTMLElement,
        extraToolsWrapper: Element,
    ) {
        if (!aiImageWrapper) return;

        const expectedOrder = [aiImageWrapper, prototypeWrapper, extraToolsWrapper];
        for (const expectedNode of expectedOrder) {
            if (expectedNode.parentElement !== toolbarParent) {
                toolbarParent.insertBefore(expectedNode, extraToolsWrapper);
            }
        }

        let currentNode: Element | null = expectedOrder[0];
        for (const expectedNode of expectedOrder) {
            if (currentNode === expectedNode) {
                currentNode = currentNode.nextElementSibling;
                continue;
            }
            toolbarParent.insertBefore(expectedNode, currentNode);
            currentNode = expectedNode.nextElementSibling;
        }
    }

    private createAiImageToolbarButton(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'ToolIcon axhub-ai-image-toolbar-tool';
        wrapper.setAttribute('data-axhub-ai-image-toolbar-wrapper', 'true');
        this.applyToolbarVisualTooltip(wrapper, AI_IMAGE_TOOLBAR_LABEL);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ToolIcon_type_button ToolIcon_size_medium axhub-ai-image-toolbar-button';
        button.setAttribute('data-axhub-ai-image-toolbar-btn', 'true');
        this.applyToolbarAriaLabel(button, AI_IMAGE_TOOLBAR_LABEL);

        const icon = document.createElement('div');
        icon.className = 'ToolIcon__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = AI_IMAGE_ICON_SVG;
        button.appendChild(icon);

        this.wireToolbarButton(button, () => this.onAiImageToolClick());

        wrapper.appendChild(button);
        return wrapper;
    }

    private ensureAiImageToolbarButton(wrapper: HTMLElement) {
        const existingButton = wrapper.querySelector<HTMLButtonElement>('[data-axhub-ai-image-toolbar-btn]');
        if (existingButton?.getAttribute('data-axhub-toolbar-handler-version') === TOOLBAR_BUTTON_HANDLER_VERSION) {
            return;
        }
        const button = this.createAiImageToolbarButton().querySelector<HTMLButtonElement>('[data-axhub-ai-image-toolbar-btn]');
        if (!button) return;
        if (existingButton) {
            existingButton.replaceWith(button);
        } else {
            wrapper.replaceChildren(button);
        }
    }

    private createPrototypeToolbarButton(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'ToolIcon axhub-prototype-toolbar-tool';
        wrapper.setAttribute('data-axhub-prototype-toolbar-wrapper', 'true');
        this.applyToolbarVisualTooltip(wrapper, PROTOTYPE_TOOLBAR_LABEL);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ToolIcon_type_button ToolIcon_size_medium axhub-prototype-toolbar-button';
        button.setAttribute('data-axhub-prototype-toolbar-btn', 'true');
        this.applyToolbarAriaLabel(button, PROTOTYPE_TOOLBAR_LABEL);

        const icon = document.createElement('div');
        icon.className = 'ToolIcon__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = PROTOTYPE_ICON_SVG;
        button.appendChild(icon);

        this.wireToolbarButton(button, () => this.onPrototypeToolClick());

        wrapper.appendChild(button);
        return wrapper;
    }

    private ensurePrototypeToolbarButton(wrapper: HTMLElement) {
        const existingButton = wrapper.querySelector<HTMLButtonElement>('[data-axhub-prototype-toolbar-btn]');
        if (existingButton?.getAttribute('data-axhub-toolbar-handler-version') === TOOLBAR_BUTTON_HANDLER_VERSION) {
            return;
        }
        const button = this.createPrototypeToolbarButton().querySelector<HTMLButtonElement>('[data-axhub-prototype-toolbar-btn]');
        if (!button) return;
        if (existingButton) {
            existingButton.replaceWith(button);
        } else {
            wrapper.replaceChildren(button);
        }
    }

    private wireToolbarButton(button: HTMLButtonElement, onActivate: () => void) {
        button.setAttribute('data-axhub-toolbar-handler-version', TOOLBAR_BUTTON_HANDLER_VERSION);
        let suppressNextClick = false;
        const handleActivation = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.type === 'pointerdown' && 'button' in event && event.button !== 0) return;
            if (event.type === 'click' && suppressNextClick) {
                suppressNextClick = false;
                return;
            }
            suppressNextClick = event.type === 'pointerdown';
            onActivate();
        };
        button.addEventListener('pointerdown', handleActivation, true);
        button.addEventListener('click', handleActivation);
    }

    private removeAiGenerationToolbarButtons() {
        this.container.querySelectorAll('[data-axhub-ai-image-toolbar-wrapper], [data-axhub-prototype-toolbar-wrapper]')
            .forEach((node) => node.remove());
    }

    private getTopToolbar(): Element | null {
        return this.container.querySelector('.App-toolbar-content')
            || this.container.querySelector('.App-toolbar.App-toolbar--compact')
            || this.container.querySelector('.App-toolbar');
    }

    /**
     * Inject a "批注" button into the compact toolbar,
     * positioned before the duplicate button.
     */
    private injectAnnotationButton(actionsContainer: Element) {
        // Already injected?
        if (actionsContainer.querySelector('[data-axhub-annotation-btn]')) {
            // Just refresh highlight state
            this.refreshAnnotationHighlight();
            return;
        }

        // Find the duplicate button
        const actionItems = actionsContainer.querySelectorAll(':scope > .compact-action-item');
        let duplicateItem: Element | null = null;
        for (const item of actionItems) {
            const toolIcon = item.querySelector('.ToolIcon');
            if (!toolIcon) continue;
            const btn = toolIcon.querySelector('button');
            if (btn && (btn.getAttribute('aria-label')?.includes('复制') || btn.title?.includes('复制'))) {
                duplicateItem = item;
                break;
            }
        }

        // Create the annotation button wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'compact-action-item';
        wrapper.setAttribute('data-axhub-annotation-btn-wrapper', 'true');

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-axhub-annotation-btn', 'true');
        btn.className = 'compact-action-button';
        btn.title = this.hasAnnotation() ? '编辑批注' : '添加批注';
        btn.innerHTML = ANNOTATION_ICON_SVG;
        btn.style.cssText = 'transition: all 0.2s ease;';

        if (this.hasAnnotation()) {
            btn.classList.add('axhub-annotation-active');
        }

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.onAnnotationClick();
        });

        wrapper.appendChild(btn);

        if (duplicateItem) {
            actionsContainer.insertBefore(wrapper, duplicateItem);
        } else {
            // Insert before the last child (hidden "..." item)
            const lastItem = actionsContainer.lastElementChild;
            if (lastItem) {
                actionsContainer.insertBefore(wrapper, lastItem);
            } else {
                actionsContainer.appendChild(wrapper);
            }
        }
    }

    /**
     * When the properties/adjust popover is open, inject extra actions
     * (layers, group, link) into it as additional fieldsets at the bottom.
     *
     * We detect the popover by looking for `.properties-content` that
     * contains `.selected-shape-actions` and is visible (rendered by
     * CombinedShapeProperties).
     */
    private injectExtraActionsIntoPropertiesPopover() {
        if (this.getOpenPopup() !== AXHUB_EXTRA_ACTIONS_OPEN_POPUP) return;

        // Find all open properties popovers in the document
        // CombinedShapeProperties renders: <PropertiesPopover className={PROPERTIES_CLASSES}>
        // where PROPERTIES_CLASSES = "properties-content"
        const popovers = document.querySelectorAll('.properties-content');
        for (const popover of popovers) {
            // Skip if already injected
            if (popover.querySelector('[data-axhub-extra-actions]')) continue;
            // Make sure this popover belongs to CombinedShapeProperties
            // (not CombinedTextProperties or CombinedArrowProperties)
            // CombinedShapeProperties has: fillStyle, strokeWidth, strokeStyle, etc.
            const shapeActions = popover.querySelector('.selected-shape-actions');
            if (!shapeActions) continue;

            this.createExtraActionsSection(shapeActions);
        }
    }

    /** Create and append the layers + actions fieldsets into the popover. */
    private createExtraActionsSection(shapeActions: Element) {
        const section = document.createElement('div');
        section.setAttribute('data-axhub-extra-actions', 'true');
        section.style.cssText = 'border-top: 1px solid var(--default-border-color, #e5e5e5); margin-top: 0.75rem; padding-top: 0.75rem;';

        // ── Layers fieldset ──
        const layersFieldset = document.createElement('fieldset');
        layersFieldset.style.cssText = 'border: none; padding: 0; margin: 0 0 0.5rem 0;';
        const layersLegend = document.createElement('legend');
        layersLegend.textContent = '图层';
        layersLegend.style.cssText = 'font-size: 0.7rem; font-weight: 600; color: var(--color-gray-50, #6b7280); margin-bottom: 0.35rem; padding: 0;';
        layersFieldset.appendChild(layersLegend);

        const layersBtnList = document.createElement('div');
        layersBtnList.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.25rem;';

        const layerActions = [
            { icon: ICON_SEND_TO_BACK, title: '置于底层', shortcut: { key: '[', meta: true, alt: true } },
            { icon: ICON_SEND_BACKWARD, title: '下移一层', shortcut: { key: '[', meta: true } },
            { icon: ICON_BRING_FORWARD, title: '上移一层', shortcut: { key: ']', meta: true } },
            { icon: ICON_BRING_TO_FRONT, title: '置于顶层', shortcut: { key: ']', meta: true, alt: true } },
        ];

        for (const action of layerActions) {
            layersBtnList.appendChild(this.createActionButton(action.icon, action.title, () => {
                dispatchKeyboardShortcut(action.shortcut.key, action.shortcut);
            }));
        }
        layersFieldset.appendChild(layersBtnList);
        section.appendChild(layersFieldset);

        // ── Actions fieldset ──
        const actionsFieldset = document.createElement('fieldset');
        actionsFieldset.style.cssText = 'border: none; padding: 0; margin: 0;';
        const actionsLegend = document.createElement('legend');
        actionsLegend.textContent = '操作';
        actionsLegend.style.cssText = 'font-size: 0.7rem; font-weight: 600; color: var(--color-gray-50, #6b7280); margin-bottom: 0.35rem; padding: 0;';
        actionsFieldset.appendChild(actionsLegend);

        const actionsBtnList = document.createElement('div');
        actionsBtnList.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.25rem;';

        const extraActions = [
            { icon: ICON_GROUP, title: '编组', shortcut: { key: 'g', meta: true } },
            { icon: ICON_UNGROUP, title: '取消编组', shortcut: { key: 'g', meta: true, shift: true } },
            { icon: ICON_LINK, title: '添加链接', shortcut: { key: 'k', meta: true } },
        ];

        for (const action of extraActions) {
            actionsBtnList.appendChild(this.createActionButton(action.icon, action.title, () => {
                dispatchKeyboardShortcut(action.shortcut.key, action.shortcut);
            }));
        }
        actionsBtnList.appendChild(this.createAnnotationActionButton());
        actionsFieldset.appendChild(actionsBtnList);
        section.appendChild(actionsFieldset);

        shapeActions.appendChild(section);
    }

    /** Create the annotation entry that always appears last in expanded actions. */
    private createAnnotationActionButton(): HTMLButtonElement {
        const btn = this.createActionButton(
            ANNOTATION_ICON_SVG,
            this.hasAnnotation() ? '编辑批注' : '添加批注',
            () => {
                this.onAnnotationClick();
            },
        );
        btn.setAttribute('data-axhub-annotation-btn', 'true');
        if (this.hasAnnotation()) {
            btn.classList.add('axhub-annotation-active');
        }
        return btn;
    }

    /** Create a small icon button matching Excalidraw's style. */
    private createActionButton(iconSvg: string, title: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = title;
        btn.innerHTML = iconSvg;
        btn.style.cssText = `
            width: 2rem; height: 2rem; border: none; border-radius: var(--border-radius-lg, 0.5rem);
            background: var(--button-bg, var(--color-surface-low, #f5f5f5));
            color: var(--color-on-surface, #333); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.15s;
        `;
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'var(--button-hover-bg, var(--color-surface-mid, #e5e5e5))';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'var(--button-bg, var(--color-surface-low, #f5f5f5))';
        });
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });
        return btn;
    }
}

/* ── CSS injection for annotation button styles ────────────────── */

const STYLE_ID = 'axhub-compact-toolbar-enhancer-styles';

export function injectEnhancerStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        /* Annotation button in compact toolbar */
        [data-axhub-annotation-btn] {
            color: var(--color-on-surface) !important;
        }
        [data-axhub-annotation-btn]:hover {
            background: var(--color-surface-primary-container, var(--mobile-action-button-bg)) !important;
        }
        [data-axhub-annotation-btn].axhub-annotation-active {
            color: #008f5d !important;
            background: rgba(0, 143, 93, 0.1) !important;
        }
        [data-axhub-annotation-btn].axhub-annotation-active:hover {
            background: rgba(0, 143, 93, 0.18) !important;
        }
        [data-axhub-annotation-btn] svg {
            width: 1rem;
            height: 1rem;
        }
        .axhub-ai-image-toolbar-tool,
        .axhub-prototype-toolbar-tool {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .axhub-ai-image-toolbar-button,
        .axhub-prototype-toolbar-button {
            padding: 0;
            border: 0;
            background: transparent;
            color: var(--icon-fill-color, var(--axhub-excalidraw-control-text, currentColor));
        }
        .axhub-ai-image-toolbar-button:hover .ToolIcon__icon,
        .axhub-prototype-toolbar-button:hover .ToolIcon__icon {
            background: var(--button-hover-bg, var(--axhub-excalidraw-control-hover-bg, rgba(0, 0, 0, 0.06)));
        }
        .axhub-ai-image-toolbar-button .ToolIcon__icon svg,
        .axhub-prototype-toolbar-button .ToolIcon__icon svg {
            width: var(--axhub-excalidraw-icon-size, 17px);
            height: var(--axhub-excalidraw-icon-size, 17px);
        }
        [data-axhub-toolbar-tooltip] {
            position: relative;
            --axhub-toolbar-tooltip-z-index: calc(var(--zIndex-popup, 1000) + 1000);
        }
        [data-axhub-toolbar-tooltip]:hover::after {
            content: attr(data-axhub-toolbar-tooltip);
            position: absolute;
            left: 50%;
            top: calc(100% + 8px);
            transform: translateX(-50%);
            z-index: var(--axhub-toolbar-tooltip-z-index);
            max-width: 160px;
            padding: 4px 8px;
            border-radius: 6px;
            background: var(--color-on-surface, #1b1b1f);
            color: var(--color-surface-lowest, #ffffff);
            font-size: 12px;
            line-height: 1.35;
            font-weight: 500;
            white-space: nowrap;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
        }
        [data-axhub-toolbar-tooltip]:hover::before {
            content: '';
            position: absolute;
            left: 50%;
            top: calc(100% + 3px);
            transform: translateX(-50%);
            border: 5px solid transparent;
            border-bottom-color: var(--color-on-surface, #1b1b1f);
            z-index: var(--axhub-toolbar-tooltip-z-index);
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
}
