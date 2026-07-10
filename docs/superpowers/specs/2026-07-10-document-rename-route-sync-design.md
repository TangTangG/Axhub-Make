# Document Rename Route Sync Design

## Goal

Ensure every document resource, including images, Markdown files, and canvas files, remains selected and previewable immediately after it is renamed, while the `doc` URL parameter updates to the renamed resource path without a page refresh.

## Root Cause

The document rename request succeeds on the server, but the client then calls the removed `setSelectedThemeDocRefs` setter. That `ReferenceError` interrupts the success path before `reloadDocsItems()` and `setSelectedDoc()` run. Because the current URL is derived from `selectedDoc`, the stale selection also leaves the URL and preview source pointing at the old path.

## Design

Remove the obsolete `setSelectedThemeDocRefs` call from the document rename completion path. Keep the existing sequence after the server response:

1. Remap and persist the sidebar item key when necessary.
2. Reload document metadata.
3. Find the renamed item using the returned path and name.
4. Select the renamed item.
5. Let the existing `selectedDoc` deep-link effect update `window.history` and the preview source.

The rename handler will not write the URL directly. `selectedDoc` remains the single source of truth for document routing.

## Error Handling

Existing request, reference-check, and sidebar persistence handling remains unchanged. A successful server rename must not be reported as a client rename failure because of removed UI state. Metadata reload failures continue through the existing catch path and display the current error message.

## Testing

Add a focused regression assertion to the existing resource-action test suite before changing production code. The test must fail while the obsolete setter is present and pass only when the rename completion path no longer references it and still reloads documents before selecting the renamed resource.

Run the focused resource-action suite, related deep-link tests, and the admin build. Browser verification should confirm that renaming a selected nested image immediately updates the sidebar label, URL `doc` value, and visible preview without refreshing. If Midscene model configuration remains unavailable, report that limitation and use the user-provided reproduction plus automated coverage and build verification.

## Scope

This change is limited to the document rename success path and its regression coverage. It does not restore removed theme-document selection state, add legacy compatibility, or refactor routing.
