# Resource Selection Extension Identity Design

## Goal

When two document resources share the same stem but use different file extensions, keep their existing display labels while selecting and opening only the resource that the user clicked. For example, `templates/prototype-spec-template.html` and `templates/prototype-spec-template.md` must remain independent sidebar entries.

## Root Cause

The filesystem sidebar tree already identifies both entries with full paths, including their extensions. The document metadata is less uniform: the HTML resource uses an extension-bearing `name`, while the Markdown resource keeps a legacy extensionless `name` and carries `.md` only in `filePath`.

`createSidebarTreeItemLookup` currently treats the raw document `filePath` (`src/resources/...`) as its canonical key. That key does not match the tree's project-relative `docs/templates/...` key, so resolution falls back to extensionless aliases. Because the HTML item registers the shared extensionless alias first, the Markdown tree node also resolves to the HTML item. Both rows then compare equal to the same selected item and both appear selected; clicking the Markdown row can also open the HTML resource.

## Chosen Design

Normalize document file paths to the same project-relative resource path used by the filesystem tree before registering canonical lookup keys. In particular, remove an optional leading `src/resources/` or `docs/` namespace while preserving the full remaining path and final extension.

For the example above, the lookup will contain distinct exact keys:

- `docs/templates/prototype-spec-template.html`
- `docs/templates/prototype-spec-template.md`

Tree resolution continues to prefer exact keys. The existing extensionless alias remains only as a fallback for older single-resource tree entries, so this fix does not require changing backend resource IDs, deep links, or persisted sidebar data. The visible title remains unchanged and may therefore be identical for the two resources.

Once each tree node resolves to the correct `ItemData`, the current sidebar selection comparison is sufficient because the resolved HTML and Markdown items retain distinct identities. No styling-only workaround is added.

## Alternatives Considered

### Change only the selected-row comparison

Comparing the selected resource with `node.path` could hide the double-highlight symptom, but the Markdown node would still resolve to and open the HTML item. This does not address the data-flow error.

### Require every backend resource ID to include its extension

Making Markdown IDs extension-bearing would also make the resources distinct, but it changes API, deep-link, and persisted metadata contracts beyond this sidebar bug. The client already has enough path information to resolve the resources correctly without that migration.

## Compatibility and Error Handling

- Preserve exact extension-bearing resource paths whenever they are available.
- Preserve the existing extensionless fallback for an older tree entry that has no exact match.
- Do not add a new compatibility format or migrate persisted trees.
- A filesystem node with no metadata match may continue using the existing fallback file item behavior.
- Ambiguous legacy extensionless keys do not override an available exact extension-bearing match.

## Testing

Add a focused regression to the existing `sidebarTree` unit suite before changing production code. The fixture will reproduce the live metadata shape:

- HTML: extension-bearing `name` and `filePath`.
- Markdown: extensionless `name` and extension-bearing `filePath`.
- Two filesystem nodes with identical stems and `.html` / `.md` suffixes.

The red test must show that both nodes currently resolve to the HTML item. After the fix, it must verify that each node resolves to its corresponding `ItemData` and therefore has a distinct `name`, `resourceId`, and file path. Existing sidebar-tree tests will verify that older extensionless lookup behavior is preserved.

Run the focused sidebar-tree test, the ContentPanel source/behavior tests that cover selected rows, and the Axhub Make admin build or documented frontend type/build check. Use the running Make project for a final browser check when the current development server is healthy: select the HTML and Markdown rows in turn and verify that exactly one row is highlighted and the matching resource opens.

## Scope

This change is limited to document resource identity normalization and sidebar tree resolution. It does not expose extensions in display labels, change server metadata IDs, migrate existing sidebar JSON, or alter selection behavior for prototypes and themes.
