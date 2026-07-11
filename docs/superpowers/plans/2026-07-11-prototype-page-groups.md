# Prototype Page Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional, read-only, collapsible groups to the selected prototype's page children in the Make sidebar.

**Architecture:** Extend the existing `pages` descriptors with `group?: string` and preserve it through static metadata, server normalization, frontend resource normalization, and runtime route messages. Convert the ordered pages into consecutive display segments in a small pure helper, while `ContentPanel` owns non-persisted expansion state and automatically reveals the active page.

**Tech Stack:** TypeScript 5.x, React 18.2.0, Vitest 4, pnpm, lucide-react.

## Global Constraints

- `group` is optional and blank values are discarded.
- Existing prototypes without groups retain the current flat page list.
- Page order is never changed; repeated non-consecutive labels create independent segments.
- Groups default to collapsed except for the current active page's group.
- Expansion state is React memory only and resets when the selected prototype changes or the page reloads.
- Make does not expose editing, persistence, sorting, drag management, or context actions for groups.
- The multi-page canvas card dropdown remains flat in this version.
- Do not commit overlapping user changes already present in target files; verify with scoped diffs instead.

---

### Task 1: Client Route and Static Metadata Contract

**Files:**
- Modify: `client/src/common/useHashPage.ts`
- Modify: `client/tests/useHashPage-route.test.ts`
- Modify: `client/scripts/sync-project-metadata.mjs`
- Modify: `client/tests/metadata-sync.test.ts`

**Interfaces:**
- Produces: `HashPageRoutePage { id: string; title: string; group?: string }`
- Produces: normalized route messages and static prototype metadata that retain valid group labels.

- [ ] **Step 1: Write failing route normalization and message tests**

Add grouped and blank-group pages to `useHashPage-route.test.ts` and assert:

```ts
expect(defineHashPageRoute([
  { id: 'orders', title: '订单列表', group: '  订单管理  ' },
  { id: 'customers', title: '客户列表', group: '   ' },
])).toEqual({
  pages: [
    { id: 'orders', title: '订单列表', group: '订单管理' },
    { id: 'customers', title: '客户列表' },
  ],
  defaultPageId: 'orders',
});
```

Also assert the `AXHUB_PROTOTYPE_ROUTE_INFO` payload contains the normalized group.

- [ ] **Step 2: Run client route tests and confirm failure**

Run: `pnpm --dir client exec vitest --run tests/useHashPage-route.test.ts`

Expected: FAIL because `group` is absent from normalized pages and route messages.

- [ ] **Step 3: Implement client route normalization**

Update `HashPageRoutePage`, trim the optional group in `normalizeRoutePages`, omit blank groups, and include group values in `routeSignature` so runtime metadata republishes when grouping changes.

```ts
const group = typeof page?.group === 'string' ? page.group.trim() : '';
return id && title ? { id, title, ...(group ? { group } : {}) } : null;
```

- [ ] **Step 4: Run client route tests and confirm pass**

Run: `pnpm --dir client exec vitest --run tests/useHashPage-route.test.ts`

Expected: all tests PASS.

- [ ] **Step 5: Write failing static metadata extraction test**

Change the literal fixture in `metadata-sync.test.ts` to include:

```ts
{ id: 'orders-list', title: '订单列表', group: '订单管理' }
```

Assert the collected prototype metadata preserves `group: '订单管理'`.

- [ ] **Step 6: Run metadata test and confirm failure**

Run: `pnpm --dir client exec vitest --run tests/metadata-sync.test.ts`

Expected: FAIL because `extractHashRouteFromCall` only emits `id` and `title`.

- [ ] **Step 7: Implement static group extraction**

Read literal `group` with `getLiteralPropertyValue`, trim it, and conditionally add it to each extracted page:

```js
const group = stringValue(getLiteralPropertyValue(element, 'group'));
pages.push({ id, title, ...(group ? { group } : {}) });
```

- [ ] **Step 8: Run both client tests**

Run: `pnpm --dir client exec vitest --run tests/useHashPage-route.test.ts tests/metadata-sync.test.ts`

Expected: all tests PASS.

### Task 2: Make Metadata and Runtime Transport

**Files:**
- Modify: `src/server/projectCore/project-metadata.ts`
- Modify: `src/server/projectCore/project-metadata.test.ts`
- Modify: `src/server/managementApi.prototypeUpload.ts`
- Modify: `src/server/__tests__/projects-prototype-upload-api.test.ts`
- Modify: `src/index/types.ts`
- Modify: `src/index/services/projectResources.ts`
- Modify: `src/index/services/projectResources.test.ts`
- Modify: `src/index/app/IndexPage.tsx`
- Modify: `src/index/app/IndexPage.test.ts`
- Modify: `src/index/app/index-page/useIndexPagePreviewActions.tsx`
- Modify: `src/index/app/index-page/useIndexPagePreviewActions.test.ts`

**Interfaces:**
- Consumes: page descriptors with optional normalized `group` from Task 1.
- Produces: `ItemData.pages?: Array<{ id: string; title: string; group?: string }>` for sidebar rendering.

- [ ] **Step 1: Write failing server and frontend normalization tests**

Add grouped and blank-group pages to project metadata and resource payload fixtures. Assert valid groups survive and blank groups are omitted:

```ts
pages: [
  { id: 'dashboard', title: '工作台' },
  { id: 'orders-list', title: '订单列表', group: '订单管理' },
  { id: 'customers', title: '客户列表' },
]
```

Add an upload API fixture assertion proving uploaded prototype metadata also retains `group`.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
pnpm exec vitest run \
  src/server/projectCore/project-metadata.test.ts \
  src/server/__tests__/projects-prototype-upload-api.test.ts \
  src/index/services/projectResources.test.ts
```

Expected: grouped expectations FAIL because current normalizers drop `group`.

- [ ] **Step 3: Implement server and resource normalization**

Add `group?: string` to `PrototypeResourcePage` and `ItemData.pages`. In every page normalizer, trim and conditionally preserve the label:

```ts
const group = stringValue(item.group);
return id && title ? { id, title, ...(group ? { group } : {}) } : null;
```

Use each file's existing string helper (`stringValue`, `pickString`, or direct trim) rather than introducing a shared cross-layer dependency.

- [ ] **Step 4: Run focused normalization tests and confirm pass**

Run the Step 2 command again.

Expected: all selected tests PASS.

- [ ] **Step 5: Write failing runtime route transport source tests**

Update the IndexPage and preview action source tests to require `group` in both normalization paths:

```ts
expect(source).toContain("const group = typeof page?.group === 'string' ? page.group.trim() : '';");
expect(source).toContain('...(group ? { group } : {})');
```

- [ ] **Step 6: Run runtime source tests and confirm failure**

Run:

```bash
pnpm exec vitest run \
  src/index/app/IndexPage.test.ts \
  src/index/app/index-page/useIndexPagePreviewActions.test.ts
```

Expected: FAIL because the runtime bridge currently reconstructs pages with only `id` and `title`.

- [ ] **Step 7: Preserve group in both runtime normalization paths**

Update `normalizePrototypeRoutePage` and `normalizePrototypeRoutePages` to return the optional group, and update local route-info types so assigning grouped pages remains type-safe.

- [ ] **Step 8: Run all Task 2 tests**

Run the Step 2 and Step 6 test files together.

Expected: all selected tests PASS.

### Task 3: Ordered Group Segments

**Files:**
- Create: `src/index/components/sidebar/prototypePageGroups.ts`
- Create: `src/index/components/sidebar/prototypePageGroups.test.ts`

**Interfaces:**
- Consumes: `PrototypePageItem[]` with `id`, `title`, and optional `group`.
- Produces: `buildPrototypePageSegments(prototypeId, pages): PrototypePageSegment[]`.
- Produces: `findPrototypePageGroupKey(segments, pageId): string | null`.

- [ ] **Step 1: Write failing pure helper tests**

Cover flat pages, adjacent grouped pages, mixed ungrouped pages, repeated non-consecutive labels, blank labels, and active-page lookup. Use the expected segment shape:

```ts
[
  { kind: 'page', page: { id: 'dashboard', title: '工作台' } },
  {
    kind: 'group',
    key: 'shop:group:1',
    title: '订单管理',
    pages: [
      { id: 'orders', title: '订单列表', group: '订单管理' },
      { id: 'order-detail', title: '订单详情', group: '订单管理' },
    ],
  },
]
```

- [ ] **Step 2: Run helper tests and confirm failure**

Run: `pnpm exec vitest run src/index/components/sidebar/prototypePageGroups.test.ts`

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement the pure segmentation helpers**

Iterate pages without sorting. Append to the previous group only when its normalized title matches; otherwise create a new segment keyed by prototype ID and starting page index. Return ungrouped pages as page segments.

```ts
export interface PrototypePageItem {
  id: string;
  title: string;
  group?: string;
}

export type PrototypePageSegment =
  | { kind: 'page'; page: PrototypePageItem }
  | { kind: 'group'; key: string; title: string; pages: PrototypePageItem[] };

export function buildPrototypePageSegments(
  prototypeId: string,
  pages: readonly PrototypePageItem[],
): PrototypePageSegment[] {
  const segments: PrototypePageSegment[] = [];
  pages.forEach((page, index) => {
    const group = typeof page.group === 'string' ? page.group.trim() : '';
    if (!group) {
      const { group: _discardedGroup, ...ungroupedPage } = page;
      segments.push({ kind: 'page', page: ungroupedPage });
      return;
    }
    const normalizedPage = { ...page, group };
    const previous = segments[segments.length - 1];
    if (previous?.kind === 'group' && previous.title === group) {
      previous.pages.push(normalizedPage);
      return;
    }
    segments.push({
      kind: 'group',
      key: `${prototypeId}:group:${index}`,
      title: group,
      pages: [normalizedPage],
    });
  });
  return segments;
}

export function findPrototypePageGroupKey(
  segments: readonly PrototypePageSegment[],
  pageId: string | null | undefined,
): string | null {
  if (!pageId) return null;
  return segments.find((segment) => (
    segment.kind === 'group' && segment.pages.some((page) => page.id === pageId)
  ))?.key ?? null;
}
```

- [ ] **Step 4: Run helper tests and confirm pass**

Run: `pnpm exec vitest run src/index/components/sidebar/prototypePageGroups.test.ts`

Expected: all tests PASS.

### Task 4: Sidebar Rendering and Transient Expansion

**Files:**
- Modify: `src/index/components/sidebar/ContentPanel.tsx`
- Modify: `src/index/components/sidebar/ContentPanel.source.test.ts`

**Interfaces:**
- Consumes: helpers from Task 3 and `selectedPrototypePageId`.
- Produces: accessible, independently collapsible group rows with no persistence or editing.

- [ ] **Step 1: Write failing sidebar source tests**

Require the component to:

```ts
expect(source).toContain('buildPrototypePageSegments');
expect(source).toContain('findPrototypePageGroupKey');
expect(source).toContain('expandedPrototypePageGroups');
expect(source).toContain('setExpandedPrototypePageGroups');
expect(source).toContain('ChevronRight');
expect(source).toContain("aria-expanded");
```

Also assert the existing page row still carries selection, click, and assistant-context drag behavior.

- [ ] **Step 2: Run sidebar tests and confirm failure**

Run:

```bash
pnpm exec vitest run \
  src/index/components/sidebar/prototypePageGroups.test.ts \
  src/index/components/sidebar/ContentPanel.source.test.ts
```

Expected: source assertions FAIL because the sidebar is still flat.

- [ ] **Step 3: Add transient expansion state**

Store `{ prototypeId, keys: Set<string> }` in `ContentPanel`. Derive segments with `useMemo`. On prototype change, discard old keys. When `selectedPrototypePageId` resolves to a grouped segment, add that segment key so the active page is visible. Do not call local storage or sidebar persistence APIs.

```ts
const prototypeId = selectedItem?.name || '';
const prototypePageSegments = useMemo(
  () => buildPrototypePageSegments(
    prototypeId,
    selectedItem ? getPrototypePageMatches(selectedItem) : [],
  ),
  [prototypeId, selectedItem?.pages],
);
const activePrototypePageGroupKey = useMemo(
  () => findPrototypePageGroupKey(prototypePageSegments, selectedPrototypePageId),
  [prototypePageSegments, selectedPrototypePageId],
);
const [expandedPrototypePageGroups, setExpandedPrototypePageGroups] = useState<{
  prototypeId: string;
  keys: Set<string>;
}>({ prototypeId: '', keys: new Set() });

useEffect(() => {
  setExpandedPrototypePageGroups((previous) => {
    const keys = previous.prototypeId === prototypeId
      ? new Set(previous.keys)
      : new Set<string>();
    if (activePrototypePageGroupKey) keys.add(activePrototypePageGroupKey);
    if (
      previous.prototypeId === prototypeId
      && previous.keys.size === keys.size
      && [...keys].every((key) => previous.keys.has(key))
    ) {
      return previous;
    }
    return { prototypeId, keys };
  });
}, [activePrototypePageGroupKey, prototypeId]);
```

- [ ] **Step 4: Render group and page rows**

Refactor the existing page row JSX into a local renderer so both ungrouped and expanded grouped pages retain identical behavior. Render group rows with `ChevronRight`/`ChevronDown`, muted text, whole-row click, Enter/Space keyboard toggling, `aria-expanded`, no actions, and no drag handler.

Extend `SidebarRowProps` with `ariaExpanded?: boolean` and pass it to the row element as `aria-expanded={ariaExpanded}`. Toggle group keys without persistence:

```ts
const togglePrototypePageGroup = (prototypeId: string, groupKey: string) => {
  setExpandedPrototypePageGroups((previous) => {
    const keys = previous.prototypeId === prototypeId
      ? new Set(previous.keys)
      : new Set<string>();
    if (keys.has(groupKey)) keys.delete(groupKey);
    else keys.add(groupKey);
    return { prototypeId, keys };
  });
};

const expandedKeys = expandedPrototypePageGroups.prototypeId === item.name
  ? expandedPrototypePageGroups.keys
  : new Set<string>();

return segments.map((segment) => {
  if (segment.kind === 'page') return renderPrototypePageRow(item, segment.page, depth);
  const expanded = expandedKeys.has(segment.key);
  return (
    <React.Fragment key={segment.key}>
      <SidebarRow
        title={segment.title}
        icon={expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        actions={null}
        ariaExpanded={expanded}
        paddingLeft={`${8 + depth * 8}px`}
        className="cursor-pointer text-muted-foreground"
        onClick={() => togglePrototypePageGroup(item.name, segment.key)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            togglePrototypePageGroup(item.name, segment.key);
          }
        }}
      />
      {expanded
        ? segment.pages.map((page) => renderPrototypePageRow(item, page, depth + 1))
        : null}
    </React.Fragment>
  );
});
```

- [ ] **Step 5: Run sidebar tests and confirm pass**

Run the Step 2 command again.

Expected: all selected tests PASS.

### Task 5: Integrated Verification

**Files:**
- Verify all files from Tasks 1-4.

- [ ] **Step 1: Run focused feature tests**

Run:

```bash
pnpm --dir client exec vitest --run \
  tests/useHashPage-route.test.ts \
  tests/metadata-sync.test.ts

pnpm exec vitest run \
  src/server/projectCore/project-metadata.test.ts \
  src/server/__tests__/projects-prototype-upload-api.test.ts \
  src/index/services/projectResources.test.ts \
  src/index/app/IndexPage.test.ts \
  src/index/app/index-page/useIndexPagePreviewActions.test.ts \
  src/index/components/sidebar/prototypePageGroups.test.ts \
  src/index/components/sidebar/ContentPanel.source.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 2: Run type and build verification**

Run:

```bash
pnpm client:typecheck
pnpm server:build
pnpm admin:build
```

Expected: every command exits 0.

- [ ] **Step 3: Inspect scoped diffs**

Run `git diff --check` and inspect diffs only for files named in this plan. Confirm no persistence calls, group editing controls, page reordering, or unrelated changes were introduced.

- [ ] **Step 4: Verify the sidebar visually**

Start the Make development server, open a grouped multi-page prototype, and verify: ungrouped pages remain visible; grouped pages start collapsed; groups expand independently; selecting or navigating to a grouped page reveals it; switching prototypes resets expansion; existing flat prototypes are unchanged.

- [ ] **Step 5: Leave user-owned staged and unrelated changes untouched**

Do not create an implementation commit from overlapping modified files. Report the exact modified paths and verification results for user review.
