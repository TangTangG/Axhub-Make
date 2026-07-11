# Prototype Page Groups Design

## Summary

Add optional, read-only grouping to the prototype page list in the Axhub Make sidebar. Prototype source data controls the groups. Make renders group rows with transient expand/collapse state, but does not provide editing or persist that state.

The feature stays invisible for existing prototypes: when no page declares a group, the page list renders exactly as it does today.

## Goals

- Let a multi-page prototype organize its sidebar page children into named groups.
- Keep the grouping definition next to the existing page route metadata.
- Default every group to collapsed.
- Allow groups to expand independently during the current UI session.
- Keep the currently selected page visible by expanding its group automatically.
- Preserve existing page selection and drag behavior.

## Non-goals

- No group editing, sorting, renaming, or drag-and-drop management in Make.
- No persisted expansion preferences in project metadata, sidebar metadata, or browser storage.
- No separate `pageGroups` tree or page ID reference list.
- No automatic inference from prototype DOM, menu markup, or page IDs.
- No grouping in the multi-page canvas card dropdown in the first version.

## Data Contract

Extend the existing page descriptor with an optional display label:

```ts
interface HashPageRoutePage {
  id: string;
  title: string;
  group?: string;
}
```

Example:

```ts
const pages = [
  { id: 'dashboard', title: 'Dashboard' },
  { id: 'orders', title: 'Orders', group: 'Order management' },
  { id: 'order-detail', title: 'Order detail', group: 'Order management' },
  { id: 'customers', title: 'Customers', group: 'Customer management' },
];

const route = defineHashPageRoute(pages, {
  defaultPageId: 'dashboard',
});
```

`group` is a trimmed, non-empty string when present. Invalid or blank values are discarded and the page is treated as ungrouped. Group identity is the normalized label because this version has no behavior that requires a separate stable ID.

The page array remains the ordering source. A group heading is emitted when a grouped page follows a page with a different group. Authors should keep pages from the same group adjacent. If a group label appears again after another group or an ungrouped page, Make renders the heading again instead of reordering pages.

## Metadata Flow

The existing page metadata path carries the optional field:

```text
defineHashPageRoute page descriptors
  -> static metadata extraction into project.json
  -> project metadata normalization and API resource normalization
  -> ItemData.pages
  -> AXHUB_PROTOTYPE_ROUTE_INFO runtime refresh
  -> selected prototype page list
```

Both static extraction and runtime route messages preserve `group`. This keeps the initial sidebar state and hot runtime discovery consistent.

Adding an optional field is backward compatible. Existing clients that ignore it continue to receive valid `id` and `title` values. Existing projects require no migration.

## Sidebar Interaction

For a selected prototype, ungrouped pages render as the current page rows. Grouped pages render beneath a non-selectable group row:

```text
v Commerce admin
    Dashboard
  > Order management
  v Customer management
      Customers
```

The group row contains a small right/down chevron and a muted label. The whole row toggles the group. It has no item icon, context menu, selected state, or drag behavior.

Each group has independent expansion state. Groups start collapsed unless a group contains the current active page, in which case that group is expanded so the selection remains visible. The state exists only in the sidebar React component and is cleared when the selected prototype changes or the page reloads.

When page selection changes, Make automatically expands the selected page's group. This applies to sidebar clicks, prototype runtime navigation, deep links, and any other path that updates `selectedPrototypePageId`. The user may collapse the group again after viewing it.

Pages retain their existing click target, selected styling, assistant-context drag payload, and indentation. Group rows add one visual hierarchy level without changing sidebar-tree persistence.

## Rendering Rules

- No grouped pages: preserve the current page-list DOM and appearance.
- Mixed grouped and ungrouped pages: ungrouped pages remain visible at their declared positions.
- Collapsed group: hide only the consecutive pages under that heading.
- Expanded group: render its pages in declared order.
- Repeated non-consecutive group label: render a separate heading and expansion segment.
- Blank group label: treat as ungrouped.
- Duplicate or invalid pages: continue using the existing page normalization behavior.

Expansion keys must include the prototype identity and the group segment position, not only the label. This prevents repeated non-consecutive labels from toggling each other and prevents state leaking between prototypes with the same group names.

## Failure Handling

Grouping is presentation metadata and must never block page navigation. If group data is missing, malformed, or removed during a runtime refresh, Make falls back to the flat list for the affected pages.

When runtime route metadata changes, expansion state is reconciled against the new group segments. Unknown keys are discarded. If the active page remains valid, its resulting group is expanded.

## Test Coverage

Focused tests should cover:

- `defineHashPageRoute` normalization preserves valid groups and removes blank groups.
- Static metadata extraction reads literal `group` values.
- Project metadata, upload metadata, API resources, and runtime route messages preserve `group`.
- A prototype without groups produces the existing flat page rows.
- Group headings follow page order and do not reorder pages.
- Groups default to collapsed and expand independently.
- Ungrouped pages remain visible.
- Selecting or navigating to a grouped page expands its group.
- Switching prototypes clears transient expansion state.
- Repeated non-consecutive group labels behave as independent segments.
- Page selection and assistant-context drag behavior remain unchanged.

## Acceptance Criteria

- Prototype authors can add `group` to page descriptors without adding another configuration structure.
- Make shows lightweight collapsible headings only when group data exists.
- Every group is collapsed on first display unless it contains the current active page.
- Expansion state is not persisted anywhere.
- The active page is never hidden solely because its group is collapsed.
- Existing ungrouped prototypes have no visual or behavioral regression.
