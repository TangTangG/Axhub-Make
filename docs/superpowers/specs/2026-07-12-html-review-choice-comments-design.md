# HTML Review Choice Comments Design

## Goal

When a reviewer operates a page-authored choice inside an HTML resource while Commentary annotation mode is active, turn the current answer into an ordinary element comment on that question. The reviewer then decides whether to execute the comment or copy its prompt through the existing Commentary card.

This refinement removes the separate pending-review-feedback model introduced for HTML review decisions. Ordinary comments become the only actionable data model for page choices and diagram-edit summaries.

## Confirmed Product Behavior

- A choice never starts an Agent task and never copies a prompt automatically.
- The generated comment is anchored to the question container supplied by the HTML page.
- One question owns one generated comment. A later answer updates that comment instead of creating another numbered marker.
- Clearing every value from a multi-select question removes its generated comment.
- The generated marker and card behave exactly like a manually entered Commentary comment, including individual execute, copy-prompt, task state, clearing, and persistence.
- If annotation mode is inactive or Commentary is unavailable, the page control and its visible selected state continue to work, but no comment is generated.
- Diagram-edit summaries use the same ordinary-comment path so the removed feedback model has no remaining producer.

## Browser Protocol

Keep a small optional `window.axhubReview` facade for plain HTML pages, but make it a direct bridge to ordinary Commentary comments rather than a storage registry.

The page-facing operations are conceptually:

```ts
window.axhubReview?.setComment?.({
  element: document.querySelector('#layout-review'),
  comment: '首页采用平衡的信息密度。',
});

window.axhubReview?.clearComment?.({
  element: document.querySelector('#layout-review'),
});
```

The target element is the identity. The demo already gives every question section a stable semantic `id`, so a separate feedback key, answer registry, scope, subscription API, and local-storage record are unnecessary.

Calls return a success result that allows a host integration to distinguish “comment written” from the intentional no-op used when annotation mode is inactive. The page must not depend on a successful return to update its own UI.

## Data Flow

1. The HTML control updates its own radio or checkbox state.
2. The page formats the current answer as the same concise instruction a reviewer could type manually.
3. The optional HTML-review facade verifies that Commentary annotation mode is active and that the target element is connected.
4. The facade delegates to the existing Commentary note/change service for that element.
5. Existing persistence and marker rendering create or update the ordinary numbered comment node.
6. Clicking the node opens the existing card. Execute and copy-prompt use the existing element-comment prompt builder without any HTML-review-specific aggregation.

For a multi-select reset, the facade delegates to the existing element-comment clear path. It removes only the generated comment/edit state for that question target; it does not alter the page control state or delete durable diagram files.

## Removed Redundant Behavior

Delete the special `reviewFeedback` path rather than retaining a compatibility adapter. The API was introduced for the current HTML-review work and does not need a legacy compatibility layer.

Removal includes:

- the feedback registry, local-storage scope, subscriptions, snapshots, and global registry key;
- `reviewFeedback` fields on public prompt/snapshot types and Commentary API accessors;
- summary-builder branches that append separate review confirmations;
- clear-all handling dedicated to the feedback registry;
- demo wording and tests that describe choices as separately collected pending feedback;
- Make bridge code that reports diagram updates through `setFeedback`.

The generic diagram-target discovery, diagram editing, durable sidecar assets, and reference-only prompt protections remain. Diagram summaries are written as ordinary comments containing bounded human-readable instructions and project-relative evidence paths.

## Failure and Lifecycle Rules

- Missing `window.axhubReview`, inactive annotation mode, disconnected elements, or a destroyed Commentary instance produce a safe no-op.
- Page scripts continue using optional chaining and never fail the HTML document because the Make integration is absent.
- A failed comment write must not revert the native form selection.
- Changing routes or destroying Commentary detaches the facade from the old instance so a page cannot write into stale editor state.
- Comment text and diagram evidence retain the existing prompt-size and reference-only constraints. Full HTML, Mermaid source, Excalidraw JSON, Draw.io XML/SVG, Base64, DOM snapshots, and machine-absolute paths remain forbidden in prompts.

## Verification

Use test-driven implementation with these behavior checks:

- setting a choice while annotation mode is active creates one ordinary element comment;
- changing the choice updates the same element comment and marker;
- clearing a multi-select answer removes that generated comment;
- inactive annotation mode and an absent facade leave page controls functional without creating comments;
- an individual comment prompt contains the selected instruction exactly once;
- global copy-prompt uses the existing ordinary-comment aggregation and contains no duplicate review-feedback section;
- diagram draft refresh writes an ordinary comment with bounded relative-path evidence;
- the plain HTML demo remains React-free and binds both its single-select and multi-select questions to the direct comment facade;
- focused Commentary, HTML bridge, demo, and build checks pass.

## Scope Boundary

This change does not redesign the Commentary card, add automatic Agent execution, add a second answer-history UI, or introduce backward compatibility for the temporary feedback registry. It preserves the rest of the HTML document review runtime and changes only how page-authored interaction results enter the established Commentary workflow.
