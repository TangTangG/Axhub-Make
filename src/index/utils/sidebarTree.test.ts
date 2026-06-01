import { describe, expect, it } from 'vitest';

import type { ItemData, SidebarTreeNode } from '../types';
import {
    buildDefaultTree,
    createSidebarTreeItemLookup,
    resolveSidebarTreeItem,
    sanitizeSidebarTree,
} from './sidebarTree';

function createPrototype(overrides: Partial<ItemData> = {}): ItemData {
	    return {
	        name: 'ref-app-home',
	        displayName: '健身 App 首页',
	        jsUrl: '/build/prototypes/ref-app-home.js',
	        specUrl: '/prototypes/ref-app-home/spec',
	        ...overrides,
	    };
}

describe('sidebarTree', () => {
    it('builds a flat tree for prototypes', () => {
        const tree = buildDefaultTree('prototypes', [
            createPrototype(),
            createPrototype({
                name: 'ref-antd',
                displayName: 'Antd 电商后台',
            }),
        ]);

        expect(tree).toEqual([
            {
                id: 'item:prototypes:ref-app-home',
                kind: 'item',
                title: '健身 App 首页',
                itemKey: 'prototypes/ref-app-home',
            },
            {
                id: 'item:prototypes:ref-antd',
                kind: 'item',
                title: 'Antd 电商后台',
                itemKey: 'prototypes/ref-antd',
            },
        ]);
    });

    it('keeps regular folders, persisted item titles, and removes missing items during sanitize', () => {
        const items = [
            createPrototype(),
            createPrototype({
                name: 'ref-antd',
                displayName: 'Antd 电商后台',
            }),
        ];
        const persistedTree: SidebarTreeNode[] = [
            {
                id: 'folder:demos',
                kind: 'folder',
                title: '演示原型',
                children: [
                    {
                        id: 'item:prototypes:ref-antd',
                        kind: 'item',
                        title: '旧标题',
                        itemKey: 'prototypes/ref-antd',
                    },
                    {
                        id: 'item:prototypes:ghost-app',
                        kind: 'item',
                        title: 'Ghost',
                        itemKey: 'prototypes/ghost-app',
                    },
                ],
            },
        ];

        const tree = sanitizeSidebarTree('prototypes', persistedTree, items);

        expect(tree[0]).toMatchObject({
            itemKey: 'prototypes/ref-app-home',
        });
        expect(tree[1]).toMatchObject({
            kind: 'folder',
            title: '演示原型',
        });
        expect(tree[1]?.children).toEqual([
            {
                id: 'item:prototypes:ref-antd',
                kind: 'item',
                title: '旧标题',
                itemKey: 'prototypes/ref-antd',
            },
        ]);
    });

    it('refreshes generated file-name titles from resource display names while preserving manual titles', () => {
        const items = [
            createPrototype({
                name: 'express-home',
                displayName: '快递官网移动端首页',
            }),
            createPrototype({
                name: 'ref-antd',
                displayName: 'Antd 电商后台',
            }),
            createPrototype({
                name: 'ref-app-home',
                displayName: '健身 App 首页',
            }),
        ];
        const persistedTree: SidebarTreeNode[] = [
            {
                id: 'folder:demos',
                kind: 'folder',
                title: '演示原型',
                children: [
                    {
                        id: 'item:prototypes:express-home',
                        kind: 'item',
                        title: 'express home',
                        itemKey: 'prototypes/express-home',
                    },
                ],
            },
            {
                id: 'item:prototypes:ref-antd',
                kind: 'item',
                title: 'ref antd',
                itemKey: 'prototypes/ref-antd',
            },
            {
                id: 'item:prototypes:ref-app-home',
                kind: 'item',
                title: '手动标题',
                itemKey: 'prototypes/ref-app-home',
            },
        ];

        const tree = sanitizeSidebarTree('prototypes', persistedTree, items);

        expect(tree).toEqual([
            {
                id: 'folder:demos',
                kind: 'folder',
                title: '演示原型',
                children: [
                    {
                        id: 'item:prototypes:express-home',
                        kind: 'item',
                        title: '快递官网移动端首页',
                        itemKey: 'prototypes/express-home',
                    },
                ],
            },
            {
                id: 'item:prototypes:ref-antd',
                kind: 'item',
                title: 'Antd 电商后台',
                itemKey: 'prototypes/ref-antd',
            },
            {
                id: 'item:prototypes:ref-app-home',
                kind: 'item',
                title: '手动标题',
                itemKey: 'prototypes/ref-app-home',
            },
        ]);
    });

    it('refreshes generated repeated theme titles from resource display names', () => {
        const items = [
            createPrototype({
                name: 'figma',
                displayName: 'Figma',
            }),
            createPrototype({
                name: 'orderful',
                displayName: 'Orderful',
            }),
            createPrototype({
                name: 'custom-theme',
                displayName: 'Custom Theme',
            }),
        ];
        const persistedTree: SidebarTreeNode[] = [
            {
                id: 'item-themes-figma',
                kind: 'item',
                title: 'Figma 主题 - Figma',
                itemKey: 'themes/figma',
            },
            {
                id: 'item-themes-orderful',
                kind: 'item',
                title: 'Orderful 主题 - Orderful',
                itemKey: 'themes/orderful',
            },
            {
                id: 'item-themes-custom-theme',
                kind: 'item',
                title: '手动主题名',
                itemKey: 'themes/custom-theme',
            },
        ];

        const tree = sanitizeSidebarTree('themes', persistedTree, items);

        expect(tree).toEqual([
            {
                id: 'item:themes:figma',
                kind: 'item',
                title: 'Figma',
                itemKey: 'themes/figma',
            },
            {
                id: 'item:themes:orderful',
                kind: 'item',
                title: 'Orderful',
                itemKey: 'themes/orderful',
            },
            {
                id: 'item:themes:custom-theme',
                kind: 'item',
                title: '手动主题名',
                itemKey: 'themes/custom-theme',
            },
        ]);
    });

    it('keeps persisted trees while entry items are still loading', () => {
        const persistedTree: SidebarTreeNode[] = [
            {
                id: 'folder:demos',
                kind: 'folder',
                title: '演示原型',
                children: [
                    {
                        id: 'item:prototypes:ref-antd',
                        kind: 'item',
                        title: 'Antd 电商后台',
                        itemKey: 'prototypes/ref-antd',
                    },
                ],
            },
        ];

        expect(sanitizeSidebarTree('prototypes', persistedTree, [])).toEqual(persistedTree);
    });

    it('matches resource docs inside real subfolders', () => {
        const items = [
            createPrototype({
                name: 'assets/icons/photos/2026-04-03-10.20.43.md',
                displayName: '2026-04-03-10.20.43',
            }),
        ];
        const persistedTree: SidebarTreeNode[] = [
            {
                id: 'folder-docs-assets',
                kind: 'folder',
                title: 'assets',
                children: [
                    {
                        id: 'item-docs-assets-icons-photos-2026-04-03-10-20-43-md',
                        kind: 'item',
                        title: '2026-04-03-10.20.43',
                        itemKey: 'docs/assets/icons/photos/2026-04-03-10.20.43.md',
                    },
                ],
            },
        ];

        expect(sanitizeSidebarTree('docs', persistedTree, items)).toEqual([
            {
                id: 'folder-docs-assets',
                kind: 'folder',
                title: 'assets',
                children: [
                    {
                        id: 'item:docs:assets/icons/photos/2026-04-03-10.20.43.md',
                        kind: 'item',
                        title: '2026-04-03-10.20.43',
                        itemKey: 'docs/assets/icons/photos/2026-04-03-10.20.43.md',
                    },
                ],
            },
        ]);
    });

    it('keeps filesystem resource files that do not have metadata docs', () => {
        const items = [
            createPrototype({
                name: 'README',
                displayName: 'README',
            }),
        ];
        const scannedTree: SidebarTreeNode[] = [
            {
                id: 'folder-docs-test-files',
                kind: 'folder',
                title: 'test-files',
                path: 'test-files',
                folderPath: 'test-files',
                children: [
                    {
                        id: 'item-docs-test-files-sample-pdf',
                        kind: 'item',
                        title: 'sample',
                        itemKey: 'docs/test-files/sample.pdf',
                        path: 'test-files/sample.pdf',
                    },
                    {
                        id: 'item-docs-test-files-sample-xlsx',
                        kind: 'item',
                        title: 'sample',
                        itemKey: 'docs/test-files/sample.xlsx',
                        path: 'test-files/sample.xlsx',
                    },
                ],
            },
            {
                id: 'item-docs-README-md',
                kind: 'item',
                title: 'README',
                itemKey: 'docs/README.md',
                path: 'README.md',
            },
        ];

        expect(sanitizeSidebarTree('docs', scannedTree, items)).toEqual(scannedTree);
    });

    it('does not re-add stale root docs after a filesystem doc moves into a folder', () => {
        const items = [
            createPrototype({
                name: 'index',
                displayName: 'index',
            }),
        ];
        const scannedTree: SidebarTreeNode[] = [
            {
                id: 'folder-docs-test',
                kind: 'folder',
                title: '测试',
                path: '测试',
                folderPath: '测试',
                children: [
                    {
                        id: 'item-docs-test-index-md',
                        kind: 'item',
                        title: 'index',
                        itemKey: 'docs/测试/index.md',
                        path: '测试/index.md',
                    },
                ],
            },
        ];

        expect(sanitizeSidebarTree('docs', scannedTree, items)).toEqual(scannedTree);
    });

    it('lifts legacy subpage folders into regular items', () => {
        const items = [
            createPrototype({
                name: 'legacy-page-a',
                displayName: '旧页面 A',
            }),
            createPrototype({
                name: 'legacy-page-b',
                displayName: '旧页面 B',
            }),
        ];
        const persistedTree: SidebarTreeNode[] = [
            {
                id: 'subpage-group:prototypes:ref-app-home',
                kind: 'folder',
                title: '旧自动分组',
                children: [
                    {
                        id: 'item:prototypes:legacy-page-a',
                        kind: 'item',
                        title: '旧页面 A',
                        itemKey: 'prototypes/legacy-page-a',
                    },
                    {
                        id: 'item:prototypes:legacy-page-b',
                        kind: 'item',
                        title: '旧页面 B',
                        itemKey: 'prototypes/legacy-page-b',
                    },
                ],
            },
        ];

        const tree = sanitizeSidebarTree('prototypes', persistedTree, items);

        expect(tree).toEqual([
            {
                id: 'item:prototypes:legacy-page-a',
                kind: 'item',
                title: '旧页面 A',
                itemKey: 'prototypes/legacy-page-a',
            },
            {
                id: 'item:prototypes:legacy-page-b',
                kind: 'item',
                title: '旧页面 B',
                itemKey: 'prototypes/legacy-page-b',
            },
        ]);
    });

    it('resolves resource tree file nodes to metadata docs stored without file extensions', () => {
        const item = createPrototype({
            name: 'assets/icons/photos/2026-04-03-10.20.43',
            displayName: '2026-04-03-10.20.43',
        });
        const lookup = createSidebarTreeItemLookup('docs', [item]);

        const resolved = resolveSidebarTreeItem('docs', {
            id: 'item-docs-assets-icons-photos-2026-04-03-10-20-43-md',
            kind: 'item',
            title: '2026-04-03-10.20.43',
            itemKey: 'docs/assets/icons/photos/2026-04-03-10.20.43.md',
        }, lookup);

        expect(resolved).toEqual({
            ...item,
            name: 'assets/icons/photos/2026-04-03-10.20.43.md',
        });
    });
});
