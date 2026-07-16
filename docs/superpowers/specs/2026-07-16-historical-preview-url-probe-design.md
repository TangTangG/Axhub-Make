# Historical Preview URL Probe Design

## Goal

Fix historical prototype preview clicks without relying on an asynchronous `window.open`, while avoiding any new persistent build-status metadata.

## Behavior

- Loading version history derives a preview URL for every historical commit that still contains the prototype.
- The Admin UI probes that commit's existing version entry URL.
- A successful probe marks the preview ready in component memory. Clicking a ready version opens its preview synchronously in a new tab.
- A failed probe leaves the version unprepared. Clicking it calls the existing `/api/git/build-version` endpoint.
- A successful build updates only the current component state and shows `历史版本已准备好，请再次点击预览`.
- Reopening the version drawer probes the URL again. Existing generated files return success and avoid another build.

## Data Flow

The history response includes the deterministic `prototypeUrl` for each commit. The client derives the same-version entry probe URL from the commit's first eight hash characters and the selected prototype path, then requests `/api/git/version-file/<versionId>/<path>/index.tsx`.

No completion marker, cache record, database value, or new status endpoint is introduced. The existing generated snapshot is the only source of truth.

## Error Handling

- A 404 probe means the snapshot is not ready and may be built on click.
- A failed build keeps the version unprepared and uses the existing error toast.
- A build response without a prototype URL is treated as unavailable.
- The preview button remains disabled while that commit is being built.

## Testing

- Unit-test probe URL construction, encoded paths, project selection, and 200/404 handling.
- Extend Git API integration coverage to prove history returns the deterministic preview URL before a build and the version entry URL changes from 404 to 200 after the build.
- Extend the component source regression to require a synchronous open for ready entries and no automatic open after building an unprepared entry.
