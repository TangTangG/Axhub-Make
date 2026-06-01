import type { ItemData, SidebarTreeNode, SidebarTreeTab } from '../types';

const LEGACY_SUBPAGE_GROUP_ID_PREFIX = 'subpage-group:';

export interface SidebarTreeItemLookupEntry {
    item: ItemData;
    canonicalKey: string;
}

export type SidebarTreeItemLookup = Map<string, SidebarTreeItemLookupEntry>;

function normalizeTreeKey(value: string): string {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '')
        .replace(/\/+/g, '/');
}

function stripFinalPathExtension(value: string): string {
    return value.replace(/\/?$/u, '').replace(/\.[^./]+$/u, '');
}

function toGeneratedTitle(value: string): string {
    const name = value.split('/').pop() || value;
    return name
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || name;
}

function isGeneratedRepeatedThemeTitle(title: string, item: ItemData): boolean {
    const match = title.match(/^(.+?)\s+主题\s*-\s*(.+)$/u);
    if (!match) {
        return false;
    }

    const before = match[1]?.trim();
    const after = match[2]?.trim();
    const displayName = item.displayName?.trim();
    if (!before || !after || before.toLowerCase() !== after.toLowerCase()) {
        return false;
    }

    return Boolean(displayName && after.toLowerCase() === displayName.toLowerCase());
}

function resolveItemTitle(tab: SidebarTreeTab, item: ItemData, persistedTitle?: string): string {
    const title = persistedTitle?.trim();
    if (!title) {
        return item.displayName || item.name;
    }

    const itemKey = `${tab}/${item.name}`;
    const defaultTitleCandidates = new Set([
        item.name,
        item.name.split('/').pop() || item.name,
        itemKey,
        itemKey.split('/').pop() || itemKey,
        toGeneratedTitle(item.name),
        toGeneratedTitle(itemKey),
    ]);

    if (defaultTitleCandidates.has(title)) {
        return item.displayName || item.name;
    }

    if (tab === 'themes' && isGeneratedRepeatedThemeTitle(title, item)) {
        return item.displayName || item.name;
    }

    return title;
}

function createItemNode(tab: SidebarTreeTab, item: ItemData, title?: string, itemKeyOverride?: string): SidebarTreeNode {
    const itemKey = itemKeyOverride || `${tab}/${item.name}`;
    const itemName = itemKey.startsWith(`${tab}/`) ? itemKey.slice(`${tab}/`.length) : item.name;
    return {
        id: `item:${tab}:${itemName}`,
        kind: 'item',
        title: resolveItemTitle(tab, item, title),
        itemKey,
    };
}

function createFallbackFolderId(tab: SidebarTreeTab): string {
    return `folder:${tab}:${Math.random().toString(36).slice(2, 8)}`;
}

function addLookupEntry(lookup: SidebarTreeItemLookup, key: string, entry: SidebarTreeItemLookupEntry) {
    const normalizedKey = normalizeTreeKey(key);
    if (normalizedKey && !lookup.has(normalizedKey)) {
        lookup.set(normalizedKey, entry);
    }
}

export function createSidebarTreeItemLookup(tab: SidebarTreeTab, items: ItemData[]): SidebarTreeItemLookup {
    const lookup: SidebarTreeItemLookup = new Map();

    for (const item of items) {
        const itemName = normalizeTreeKey(item.name);
        if (!itemName) {
            continue;
        }
        const canonicalKey = `${tab}/${itemName}`;
        const entry = { item, canonicalKey };
        addLookupEntry(lookup, canonicalKey, entry);

        if (tab === 'docs') {
            addLookupEntry(lookup, stripFinalPathExtension(canonicalKey), entry);
        }
    }

    return lookup;
}

function getNodeItemKey(tab: SidebarTreeTab, node: SidebarTreeNode): string {
    const itemKey = normalizeTreeKey(node.itemKey || '');
    if (itemKey.startsWith(`${tab}/`)) {
        return itemKey;
    }
    return '';
}

function getItemNameFromKey(tab: SidebarTreeTab, itemKey: string): string {
    return itemKey.startsWith(`${tab}/`) ? itemKey.slice(`${tab}/`.length) : itemKey;
}

function createFilesystemDocNode(node: SidebarTreeNode, itemKey: string, title: string): SidebarTreeNode | null {
    const nodePath = normalizeTreeKey(node.path || getItemNameFromKey('docs', itemKey));
    if (!nodePath) {
        return null;
    }

    return {
        ...node,
        id: node.id || `item:docs:${nodePath}`,
        kind: 'item',
        title: title || toGeneratedTitle(nodePath),
        itemKey,
        path: nodePath,
    };
}

function hasFilesystemResourcePath(nodes: SidebarTreeNode[]): boolean {
    for (const node of nodes) {
        if (normalizeTreeKey(node.path || node.folderPath || '')) {
            return true;
        }
        if (node.kind === 'folder' && hasFilesystemResourcePath(node.children || [])) {
            return true;
        }
    }
    return false;
}

function resolveSidebarTreeItemEntry(
    tab: SidebarTreeTab,
    node: SidebarTreeNode,
    lookup: SidebarTreeItemLookup,
): { item: ItemData; canonicalKey: string; itemKey: string } | null {
    const itemKey = getNodeItemKey(tab, node);
    if (!itemKey) {
        return null;
    }

    const exact = lookup.get(itemKey);
    if (exact) {
        return { ...exact, itemKey };
    }

    if (tab !== 'docs') {
        return null;
    }

    const withoutExtension = stripFinalPathExtension(itemKey);
    const extensionlessMatch = lookup.get(withoutExtension);
    if (!extensionlessMatch) {
        return null;
    }

    return {
        ...extensionlessMatch,
        item: {
            ...extensionlessMatch.item,
            name: getItemNameFromKey(tab, itemKey),
        },
        itemKey,
    };
}

export function resolveSidebarTreeItem(
    tab: SidebarTreeTab,
    node: SidebarTreeNode,
    lookup: SidebarTreeItemLookup,
): ItemData | null {
    return resolveSidebarTreeItemEntry(tab, node, lookup)?.item || null;
}

function isConsumedItem(tab: SidebarTreeTab, itemKey: string, consumedKeys: Set<string>): boolean {
    if (consumedKeys.has(itemKey)) {
        return true;
    }
    return tab === 'docs' && consumedKeys.has(stripFinalPathExtension(itemKey));
}

export function buildDefaultTree(tab: SidebarTreeTab, items: ItemData[]): SidebarTreeNode[] {
    return items.map((item) => createItemNode(tab, item));
}

export function sanitizeSidebarTree(tab: SidebarTreeTab, tree: SidebarTreeNode[], items: ItemData[]): SidebarTreeNode[] {
    if (items.length === 0 && tree.length > 0) {
        return tree;
    }

    const itemLookup = createSidebarTreeItemLookup(tab, items);
    const consumedKeys = new Set<string>();

    const walk = (nodes: SidebarTreeNode[]): SidebarTreeNode[] => {
        const result: SidebarTreeNode[] = [];

        nodes.forEach((node) => {
            if (node.kind === 'folder') {
                const children = walk(Array.isArray(node.children) ? node.children : []);

                if (node.id?.startsWith(LEGACY_SUBPAGE_GROUP_ID_PREFIX)) {
                    result.push(...children);
                    return;
                }

                result.push({
                    ...node,
                    id: node.id || createFallbackFolderId(tab),
                    title: node.title || '未命名文件夹',
                    kind: 'folder',
                    children,
                });
                return;
            }

            const resolved = resolveSidebarTreeItemEntry(tab, node, itemLookup);
            if (!resolved) {
                const itemKey = getNodeItemKey(tab, node);
                if (tab === 'docs' && itemKey && node.path) {
                    const filesystemNode = createFilesystemDocNode(node, itemKey, node.title);
                    if (filesystemNode) {
                        consumedKeys.add(itemKey);
                        consumedKeys.add(stripFinalPathExtension(itemKey));
                        result.push(filesystemNode);
                    }
                }
                return;
            }

            consumedKeys.add(resolved.canonicalKey);
            consumedKeys.add(resolved.itemKey);
            if (tab === 'docs') {
                consumedKeys.add(stripFinalPathExtension(resolved.itemKey));
            }
            if (tab === 'docs' && node.path) {
                const filesystemNode = createFilesystemDocNode(
                    node,
                    resolved.itemKey,
                    resolveItemTitle(tab, resolved.item, node.title),
                );
                if (filesystemNode) {
                    result.push(filesystemNode);
                    return;
                }
            }
            result.push(createItemNode(tab, resolved.item, node.title, resolved.itemKey));
        });

        return result;
    };

    const nextTree = walk(tree);
    if (tab === 'docs' && hasFilesystemResourcePath(tree)) {
        return nextTree;
    }

    const missingNodes = items
        .filter((item) => !isConsumedItem(tab, `${tab}/${normalizeTreeKey(item.name)}`, consumedKeys))
        .map((item) => createItemNode(tab, item));

    return [...missingNodes, ...nextTree];
}
