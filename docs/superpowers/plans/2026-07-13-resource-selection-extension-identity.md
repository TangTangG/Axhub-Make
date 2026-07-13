# Resource Selection Extension Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve same-stem document resources by their complete extension-bearing resource paths so only the clicked HTML or Markdown row is selected and opened.

**Architecture:** Keep the server metadata and visible labels unchanged. Normalize document `filePath` values into the same project-relative namespace used by filesystem sidebar nodes, then let the existing exact-key-first lookup distinguish `.html` and `.md`; retain the existing extensionless lookup only as a fallback.

**Tech Stack:** TypeScript 5.x, Vitest 4, React 18.2.0, pnpm workspace.

## Global Constraints

- Use pnpm for repository development and verification commands.
- Preserve React at 18.2.0 and add no dependencies.
- Do not change backend resource IDs, deep-link contracts, visible resource labels, or persisted sidebar JSON.
- Preserve the existing extensionless fallback for an older tree entry that has no exact match.
- Do not overwrite, reorder, stage, or commit unrelated worktree changes.

---

### Task 1: Normalize Document Resource Identity for Sidebar Lookup

**Files:**
- Create: `src/index/utils/sidebarTree.resource-identity.test.ts`
- Modify: `src/index/utils/sidebarTree.ts:24-27,58-60`

**Interfaces:**
- Consumes: `createSidebarTreeItemLookup(tab: SidebarTreeTab, items: ItemData[]): SidebarTreeItemLookup` and `resolveSidebarTreeItem(tab: SidebarTreeTab, node: SidebarTreeNode, lookup: SidebarTreeItemLookup): ItemData | null`.
- Produces: canonical document lookup keys whose resource portion is project-relative and retains its final extension.

- [ ] **Step 1: Write the failing same-stem resource regression test**

Create `src/index/utils/sidebarTree.resource-identity.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run the regression test and verify RED**

Run:

```bash
pnpm exec vitest run src/index/utils/sidebarTree.resource-identity.test.ts
```

Expected: one failed assertion because the Markdown node resolves to `htmlItem` instead of `markdownItem`.

- [ ] **Step 3: Implement minimal project-relative document path normalization**

Replace `getDocsResourcePath` in `src/index/utils/sidebarTree.ts` with:

```ts
function getDocsResourcePath(value: string): string {
    const normalized = normalizeTreeKey(value);
    for (const prefix of ['src/resources/', 'docs/']) {
        if (normalized.startsWith(prefix)) {
            return normalized.slice(prefix.length);
        }
    }
    return normalized;
}
```

Replace `getItemResourceName` with:

```ts
function getItemResourceName(tab: SidebarTreeTab, item: ItemData): string {
    if (tab === 'docs') {
        return getDocsResourcePath(item.filePath || item.name);
    }
    return normalizeTreeKey(item.name);
}
```

- [ ] **Step 4: Run focused identity and existing sidebar-tree tests and verify GREEN**

Run:

```bash
pnpm exec vitest run src/index/utils/sidebarTree.resource-identity.test.ts src/index/utils/sidebarTree.test.ts
```

Expected: both files pass, including the new same-stem case and existing extensionless Markdown compatibility coverage.

- [ ] **Step 5: Run selected-row regression coverage**

Run:

```bash
pnpm exec vitest run src/index/components/sidebar/ContentPanel.source.test.ts
```

Expected: the ContentPanel source suite passes and the existing selected-row behavior remains intact.

- [ ] **Step 6: Run the Axhub Make admin build**

Run:

```bash
pnpm admin:build
```

Expected: both admin Vite builds complete with exit code 0.

- [ ] **Step 7: Verify the live sidebar behavior**

In the running Make project, select `prototype-spec-template.html` and `prototype-spec-template.md` in turn. Verify that each click opens the matching file and highlights exactly one row while the two visible labels remain unchanged.

- [ ] **Step 8: Commit only the isolated fix files**

Run:

```bash
git add src/index/utils/sidebarTree.resource-identity.test.ts
git diff -- src/index/utils/sidebarTree.ts
git add -p src/index/utils/sidebarTree.ts
git diff --cached --check
git commit -m "fix: distinguish same-stem resource files"
```

Stage only the `getDocsResourcePath` and `getItemResourceName` hunks from `sidebarTree.ts`; leave all pre-existing worktree hunks unstaged.
