import { describe, expect, it } from 'vitest';

import type { ItemData, SidebarTreeNode } from '../types';
import { createSidebarTreeItemLookup, resolveSidebarTreeItem } from './sidebarTree';

function createDocument(overrides: Partial<ItemData>): ItemData {
    return {
        name: 'templates/prototype-spec-template',
        displayName: 'prototype-spec-template',
        jsUrl: '',
        specUrl: '',
        ...overrides,
    };
}

describe('sidebarTree document resource identity', () => {
    it('resolves same-stem HTML and Markdown nodes by their extension-bearing file paths', () => {
        const htmlItem = createDocument({
            name: 'templates/prototype-spec-template.html',
            filePath: 'src/resources/templates/prototype-spec-template.html',
            resourceId: 'templates/prototype-spec-template.html',
        });
        const markdownItem = createDocument({
            name: 'templates/prototype-spec-template',
            filePath: 'src/resources/templates/prototype-spec-template.md',
            resourceId: 'templates/prototype-spec-template',
        });
        const htmlNode: SidebarTreeNode = {
            id: 'item-docs-templates-prototype-spec-template-html',
            kind: 'item',
            title: 'prototype-spec-template',
            itemKey: 'docs/templates/prototype-spec-template.html',
            path: 'templates/prototype-spec-template.html',
        };
        const markdownNode: SidebarTreeNode = {
            id: 'item-docs-templates-prototype-spec-template-md',
            kind: 'item',
            title: 'prototype-spec-template',
            itemKey: 'docs/templates/prototype-spec-template.md',
            path: 'templates/prototype-spec-template.md',
        };
        const lookup = createSidebarTreeItemLookup('docs', [htmlItem, markdownItem]);

        expect(resolveSidebarTreeItem('docs', htmlNode, lookup)).toBe(htmlItem);
        expect(resolveSidebarTreeItem('docs', markdownNode, lookup)).toBe(markdownItem);
    });
});
