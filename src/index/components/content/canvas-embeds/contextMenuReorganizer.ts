/**
 * contextMenuReorganizer.ts
 *
 * Reorganizes Excalidraw's native context menu DOM to be more compact:
 *   1. Groups copy-related actions into a titled icon-button row
 *   2. Groups layer/flip actions into a titled icon-button row
 *   3. Folds infrequently-used actions into a horizontally-expanding submenu
 *   4. Keeps cut/copy/paste, link, lock, delete as regular items
 *
 * Menu items are matched by their `data-testid` attribute on the <li> elements.
 * If a particular item is not present (different element types show different
 * menus), it is silently skipped.
 *
 * Excalidraw owns these menu nodes through React, so this module never moves
 * native <li> items. It hides originals in place and inserts Axhub-owned proxy
 * controls that trigger the original menu buttons.
 */

/* ── SVG icon paths (from lucide-react 24×24 viewBox) ─────────────── */

const ICONS: Record<string, string> = {
    copyAsPng: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><circle cx="10" cy="13" r="2"/><path d="m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22"/>',
    copyAsSvg: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    copyText: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
    copyStyles: '<path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"/><path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/><path d="M14.5 17.5 4.5 15"/>',
    pasteStyles: '<path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M16 4h2a2 2 0 0 1 2 2v2M11 14h10"/><path d="m17 10 4 4-4 4"/>',
    sendBackward: '<path d="m6 9 6 6 6-6"/>',
    bringForward: '<path d="m18 15-6-6-6 6"/>',
    sendToBack: '<path d="m7 6 5 5 5-5"/><path d="m7 13 5 5 5-5"/>',
    bringToFront: '<path d="m17 18-5-5-5 5"/><path d="m17 11-5-5-5 5"/>',
    flipHorizontal: '<path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3"/><path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><line x1="12" x2="12" y1="20" y2="4"/>',
    flipVertical: '<path d="M3 8V5a2 2 0 0 1 2-2h14c1.1 0 2 .9 2 2v3"/><path d="M3 16v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><line x1="4" x2="20" y1="12" y2="12"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
};

const ICON_BUTTON_TOOLTIPS: Record<string, string> = {
    copyAsPng: '复制为 PNG',
    copyAsSvg: '复制为 SVG',
    copyText: '复制文本',
    copyStyles: '拷贝样式',
    pasteStyles: '粘贴样式',
    sendBackward: '下移一层',
    bringForward: '上移一层',
    sendToBack: '置于底层',
    bringToFront: '置于顶层',
    flipHorizontal: '水平翻转',
    flipVertical: '垂直翻转',
};

/* ── Helpers ────────────────────────────────────────────────────────── */

function findItemByTestId(menu: Element, testId: string): HTMLLIElement | null {
    return menu.querySelector<HTMLLIElement>(`li[data-testid="${testId}"]`);
}

function isAxhubContextMenuItem(el: Element | null): boolean {
    return !!el?.hasAttribute('data-axhub-context-menu-item');
}

function isHiddenContextMenuItem(el: Element | null): boolean {
    return !!el?.hasAttribute('data-axhub-ctx-hidden');
}

function hideContextMenuElement(el: Element | null) {
    if (!el) return;
    el.setAttribute('data-axhub-ctx-hidden', 'true');
    if (el instanceof HTMLElement) {
        el.style.display = 'none';
    }
}

function hideAdjacentSeparators(menu: Element, testId: string) {
    const item = findItemByTestId(menu, testId);
    if (!item) return;
    const prev = item.previousElementSibling;
    if (prev && prev.tagName === 'HR') hideContextMenuElement(prev);
    const next = item.nextElementSibling;
    if (next && next.tagName === 'HR') hideContextMenuElement(next);
}

function clickOriginalMenuItem(li: HTMLLIElement) {
    const button = li.querySelector<HTMLButtonElement>('button.context-menu-item, button');
    (button || li).click();
}

function createSvgIcon(pathContent: string, size = 14): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = pathContent;
    return svg;
}

function createSeparator(): HTMLHRElement {
    const hr = document.createElement('hr');
    hr.className = 'context-menu-item-separator';
    return hr;
}

/* ── Style injection ────────────────────────────────────────────────── */

let tooltipStyleInjected = false;

function ensureTooltipStyles() {
    if (tooltipStyleInjected) return;
    tooltipStyleInjected = true;

    const style = document.createElement('style');
    style.setAttribute('data-axhub-ctx-menu-styles', '');
    style.textContent = `
        /* ── Icon button group ──
         * The group itself provides visual separation via its title,
         * so NO extra <hr> separator is needed before/after.
         */
        .axhub-ctx-icon-group {
            padding: 2px 10px 4px;
        }
        .axhub-ctx-icon-group-title {
            font-size: 10px;
            font-weight: 500;
            color: var(--popup-text-color, #1e1e1e);
            opacity: 0.4;
            margin-bottom: 3px;
            padding-left: 1px;
            letter-spacing: 0.3px;
            user-select: none;
            line-height: 1;
        }
        .axhub-ctx-icon-row {
            display: flex;
            gap: 1px;
        }
        .axhub-ctx-icon-btn {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 26px;
            border: none;
            border-radius: 4px;
            background: transparent;
            color: var(--popup-text-color, #1e1e1e);
            cursor: pointer;
            transition: background 0.12s;
        }
        .axhub-ctx-icon-btn:hover {
            background: var(--select-highlight-color, #008f5d);
            color: var(--popup-bg-color, #fff);
        }

        /* ── CSS Tooltip ── */
        .axhub-ctx-icon-btn::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: calc(100% + 6px);
            left: 50%;
            transform: translateX(-50%);
            padding: 3px 7px;
            border-radius: 4px;
            background: rgba(15, 23, 42, 0.92);
            color: #f8fafc;
            font-size: 11px;
            line-height: 1.3;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s;
            z-index: 10;
        }
        .axhub-ctx-icon-btn:hover::after {
            opacity: 1;
        }

        /* ── Horizontal flyout submenu ── */
        .axhub-ctx-submenu-wrapper {
            position: relative;
        }
        .axhub-ctx-submenu-trigger {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 0.25rem 1rem 0.25rem 1.25rem;
            border: none;
            border-radius: 0;
            background: transparent;
            color: var(--popup-text-color, #1e1e1e);
            font-family: inherit;
            font-size: inherit;
            cursor: pointer;
            white-space: nowrap;
            text-align: start;
        }
        .axhub-ctx-submenu-trigger:hover {
            background: var(--select-highlight-color, #008f5d);
            color: var(--popup-bg-color, #fff);
        }
        .axhub-ctx-submenu-flyout {
            display: none;
            position: absolute;
            left: 100%;
            top: 0;
            min-width: 180px;
            background: var(--popup-secondary-bg-color, #fff);
            border: 1px solid var(--button-gray-3, #ddd);
            border-radius: 4px;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
            padding: 0.5rem 0;
            z-index: 100;
            flex-direction: column;
        }
        .axhub-ctx-submenu-flyout.axhub-ctx-submenu-expanded {
            display: flex;
        }
        .axhub-ctx-submenu-flyout.axhub-ctx-submenu-flip {
            left: auto;
            right: 100%;
        }
        [data-axhub-ctx-hidden="true"] {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}

/* ── Icon button row builder ────────────────────────────────────────── */

interface IconButtonDef {
    testId: string;
    iconKey: string;
}

function buildIconButtonRow(
    menu: Element,
    defs: IconButtonDef[],
    groupTitle: string,
): HTMLLIElement | null {
    const buttons: HTMLButtonElement[] = [];

    for (const def of defs) {
        const li = findItemByTestId(menu, def.testId);
        if (!li) continue;

        const iconSvg = ICONS[def.iconKey];
        if (!iconSvg) continue;

        const originalLi = li;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'axhub-ctx-icon-btn';
        btn.setAttribute('data-tooltip', ICON_BUTTON_TOOLTIPS[def.testId] || def.testId);
        btn.appendChild(createSvgIcon(iconSvg));

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            clickOriginalMenuItem(originalLi);
        });

        buttons.push(btn);

        hideAdjacentSeparators(menu, def.testId);
        hideContextMenuElement(li);
    }

    if (buttons.length === 0) return null;

    const rowLi = document.createElement('li');
    rowLi.setAttribute('data-axhub-context-menu-item', 'icon-row');

    const groupDiv = document.createElement('div');
    groupDiv.className = 'axhub-ctx-icon-group';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'axhub-ctx-icon-group-title';
    titleDiv.textContent = groupTitle;
    groupDiv.appendChild(titleDiv);

    const rowDiv = document.createElement('div');
    rowDiv.className = 'axhub-ctx-icon-row';
    for (const btn of buttons) {
        rowDiv.appendChild(btn);
    }
    groupDiv.appendChild(rowDiv);

    rowLi.appendChild(groupDiv);
    return rowLi;
}

/* ── Horizontal flyout submenu builder ──────────────────────────────── */

function buildSubmenu(
    menu: Element,
    triggerLabel: string,
    testIds: string[],
): HTMLLIElement | null {
    const collectedItems: HTMLLIElement[] = [];

    for (const testId of testIds) {
        const li = findItemByTestId(menu, testId);
        if (!li) continue;
        hideAdjacentSeparators(menu, testId);
        hideContextMenuElement(li);
        const proxyLi = document.createElement('li');
        proxyLi.setAttribute('data-axhub-context-menu-item', `submenu-${testId}`);

        const proxyButton = document.createElement('button');
        proxyButton.type = 'button';
        proxyButton.className = 'context-menu-item';
        const originalButton = li.querySelector<HTMLButtonElement>('button.context-menu-item, button');
        const originalLabel = originalButton?.querySelector('.context-menu-item__label');
        const originalShortcut = originalButton?.querySelector('.context-menu-item__shortcut');

        const label = document.createElement('span');
        label.className = 'context-menu-item__label';
        label.textContent = originalLabel?.textContent?.trim() || li.textContent?.trim() || testId;
        proxyButton.appendChild(label);

        if (originalShortcut?.textContent?.trim()) {
            const shortcut = document.createElement('kbd');
            shortcut.className = 'context-menu-item__shortcut';
            shortcut.textContent = originalShortcut.textContent.trim();
            proxyButton.appendChild(shortcut);
        }

        proxyButton.addEventListener('click', (e) => {
            e.stopPropagation();
            clickOriginalMenuItem(li);
        });
        proxyLi.appendChild(proxyButton);
        collectedItems.push(proxyLi);
    }

    if (collectedItems.length === 0) return null;

    const wrapperLi = document.createElement('li');
    wrapperLi.setAttribute('data-axhub-context-menu-item', 'submenu');
    wrapperLi.className = 'axhub-ctx-submenu-wrapper';

    const triggerBtn = document.createElement('button');
    triggerBtn.type = 'button';
    triggerBtn.className = 'axhub-ctx-submenu-trigger';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'context-menu-item__label';
    labelSpan.textContent = triggerLabel;
    triggerBtn.appendChild(labelSpan);

    const chevronSpan = document.createElement('span');
    chevronSpan.className = 'axhub-ctx-submenu-chevron';
    chevronSpan.appendChild(createSvgIcon(ICONS.chevronRight, 12));
    triggerBtn.appendChild(chevronSpan);

    const flyout = document.createElement('div');
    flyout.className = 'axhub-ctx-submenu-flyout';
    for (const proxyItem of collectedItems) {
        flyout.appendChild(proxyItem);
    }

    const openSubmenu = () => {
        flyout.classList.add('axhub-ctx-submenu-expanded');
        requestAnimationFrame(() => {
            const rect = flyout.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                flyout.classList.add('axhub-ctx-submenu-flip');
            } else {
                flyout.classList.remove('axhub-ctx-submenu-flip');
            }
        });
    };
    const closeSubmenu = () => {
        flyout.classList.remove('axhub-ctx-submenu-expanded');
        flyout.classList.remove('axhub-ctx-submenu-flip');
    };
    const toggleSubmenu = () => {
        if (flyout.classList.contains('axhub-ctx-submenu-expanded')) {
            closeSubmenu();
            return;
        }
        openSubmenu();
    };

    wrapperLi.addEventListener('mouseenter', openSubmenu);
    wrapperLi.addEventListener('mouseleave', closeSubmenu);
    triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleSubmenu();
    });

    wrapperLi.appendChild(triggerBtn);
    wrapperLi.appendChild(flyout);
    return wrapperLi;
}

/* ── Clean up orphan separators ─────────────────────────────────────── */

function cleanOrphanSeparators(menu: Element) {
    // Multiple passes to handle cascading orphans
    for (let pass = 0; pass < 3; pass++) {
        const visibleChildren = Array.from(menu.children).filter((child) => !isHiddenContextMenuItem(child));
        for (let i = visibleChildren.length - 1; i >= 0; i--) {
            const child = visibleChildren[i];
            if (child.tagName !== 'HR') continue;

            // Hide leading separator
            if (i === 0) { hideContextMenuElement(child); continue; }
            // Hide trailing separator
            if (i === visibleChildren.length - 1) { hideContextMenuElement(child); continue; }
            // Hide consecutive separators
            const prev = visibleChildren[i - 1];
            if (prev && prev.tagName === 'HR') { hideContextMenuElement(child); }
        }
    }
}

function hideNativeMenuItemsByLabel(menu: Element, labels: string[]) {
    const normalizedLabels = labels
        .map((label) => label.trim().toLowerCase())
        .filter(Boolean);
    if (normalizedLabels.length === 0) return;

    const items = Array.from(menu.querySelectorAll<HTMLLIElement>('li'));
    for (const item of items) {
        if (isAxhubContextMenuItem(item) || isHiddenContextMenuItem(item)) continue;
        const text = (item.textContent || '').replace(/\s+/gu, ' ').trim().toLowerCase();
        if (!text || !normalizedLabels.some((label) => text.includes(label))) continue;
        hideContextMenuElement(item);
        const prev = item.previousElementSibling;
        if (prev && prev.tagName === 'HR') hideContextMenuElement(prev);
        const next = item.nextElementSibling;
        if (next && next.tagName === 'HR') hideContextMenuElement(next);
    }
}

function insertBeforeOrAppend(menu: Element, node: Element, anchor: Element | null) {
    if (anchor && anchor.parentElement === menu) {
        menu.insertBefore(node, anchor);
        return;
    }
    menu.appendChild(node);
}

/* ── Main reorganization ────────────────────────────────────────────── */

export function reorganizeContextMenu(ctxMenuEl: Element): void {
    if (ctxMenuEl.hasAttribute('data-axhub-context-menu-reorganized')) return;
    ctxMenuEl.setAttribute('data-axhub-context-menu-reorganized', 'true');
    ensureTooltipStyles();

    hideNativeMenuItemsByLabel(ctxMenuEl, [
        '编辑嵌入链接',
        'Edit embeddable link',
        'Edit embeddable',
    ]);

    // ── 1. Build icon button rows with group titles ──

    const copyIconRow = buildIconButtonRow(ctxMenuEl, [
        { testId: 'copyAsPng', iconKey: 'copyAsPng' },
        { testId: 'copyAsSvg', iconKey: 'copyAsSvg' },
        { testId: 'copyText', iconKey: 'copyText' },
        { testId: 'copyStyles', iconKey: 'copyStyles' },
        { testId: 'pasteStyles', iconKey: 'pasteStyles' },
    ], '复制');

    const layerIconRow = buildIconButtonRow(ctxMenuEl, [
        { testId: 'sendBackward', iconKey: 'sendBackward' },
        { testId: 'bringForward', iconKey: 'bringForward' },
        { testId: 'sendToBack', iconKey: 'sendToBack' },
        { testId: 'bringToFront', iconKey: 'bringToFront' },
        { testId: 'flipHorizontal', iconKey: 'flipHorizontal' },
        { testId: 'flipVertical', iconKey: 'flipVertical' },
    ], '图层');

    // ── 2. Build horizontal flyout submenu ──

    const submenu = buildSubmenu(ctxMenuEl, '更多操作…', [
        'wrapSelectionInFrame',
        'wrapTextInContainer',
        'addToLibrary',
        'duplicateSelection',
    ]);

    // ── 3. Clean up orphan separators after detaching ──

    cleanOrphanSeparators(ctxMenuEl);

    // ── 4. Insert constructed elements ──
    // Strategy: icon groups and submenu go between the last link item and lock/delete.
    // Icon groups use their title as visual separation — NO extra <hr> before them.
    // Only a single <hr> separates the icon-group block from the lock/delete block.

    const lockItem = findItemByTestId(ctxMenuEl, 'toggleElementLock');
    const deleteItem = findItemByTestId(ctxMenuEl, 'deleteSelectedElements');
    const bottomAnchor = lockItem || deleteItem;

    if (bottomAnchor) {
        // Find the separator before lock/delete if any; we'll replace it with our content
        let insertBefore: Element = bottomAnchor;
        const prevSib = bottomAnchor.previousElementSibling;
        if (prevSib && prevSib.tagName === 'HR') {
            insertBefore = prevSib;
            // Hide the existing separator — we'll add our own clean one
            hideContextMenuElement(prevSib);
        }

        const proxyItems: Element[] = [];
        if (submenu) {
            proxyItems.push(createSeparator(), submenu);
        }
        if (copyIconRow) {
            proxyItems.push(copyIconRow);
        }
        if (layerIconRow) {
            proxyItems.push(layerIconRow);
        }
        if (proxyItems.length > 0) {
            proxyItems.push(createSeparator());
        }
        for (const item of proxyItems) {
            insertBeforeOrAppend(ctxMenuEl, item, insertBefore);
        }
    } else {
        // Fallback: append at end
        if (submenu) {
            ctxMenuEl.appendChild(createSeparator());
            ctxMenuEl.appendChild(submenu);
        }
        if (layerIconRow) {
            ctxMenuEl.appendChild(layerIconRow);
        }
        if (copyIconRow) {
            ctxMenuEl.appendChild(copyIconRow);
        }
    }

    // ── 5. Final cleanup ──
    cleanOrphanSeparators(ctxMenuEl);
}
