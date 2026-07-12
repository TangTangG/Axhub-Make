# HTML Review Choice Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route plain-HTML choices and diagram summaries directly into ordinary Commentary element comments, then remove the redundant `reviewFeedback` registry and prompt path.

**Architecture:** `@axhub/commentary` will install a lifecycle-bound `window.axhubReview` facade whose `setComment` and `clearComment` operations delegate to the existing element-note service only while annotation mode is active. Make's HTML bridge and example page will use that facade. The separate feedback registry, snapshot types, persistence, subscriptions, and summary aggregation will be deleted so ordinary comments are the single actionable model.

**Tech Stack:** TypeScript 5.x, React 18.2.0, Vitest 4, pnpm workspace, native HTML form controls.

## Global Constraints

- Use pnpm; do not use npm or yarn.
- Preserve unrelated staged, unstaged, and untracked work in both the root repository and `apps/axhub-make` submodule.
- Do not add legacy compatibility for the temporary `setFeedback`/`clearFeedback` protocol.
- A page choice must never execute an Agent task or copy a prompt automatically.
- Plain HTML pages must remain React-free and functional when Commentary is absent or inactive.
- Prompts must not embed full HTML, Mermaid, Excalidraw, Draw.io, Base64, DOM snapshots, or machine-absolute paths.

---

### Task 1: Direct plain-HTML comment facade

**Files:**
- Create: `packages/axhub-commentary/src/review/comment-protocol.ts`
- Create: `packages/axhub-commentary/src/review/comment-protocol.test.ts`
- Modify: `packages/axhub-commentary/src/core/editor/index.ts`
- Modify: `packages/axhub-commentary/src/index.ts`
- Modify: `packages/axhub-commentary/src/web-editor-types.ts`
- Delete: `packages/axhub-commentary/src/review/feedback-protocol.ts`
- Delete: `packages/axhub-commentary/src/review/feedback-protocol.test.ts`

**Interfaces:**
- Produces: `CommentaryReviewCommentInput`, `CommentaryReviewCommentProtocol`, and `installGlobalCommentaryReviewCommentProtocol()`.
- Browser facade: `window.axhubReview.setComment({ element, comment }): boolean` and `window.axhubReview.clearComment({ element }): boolean`.
- Consumes: `EditorChangesService.setNoteForElement(element, note)` and Commentary runtime `state.active`.

- [ ] **Step 1: Replace the registry tests with failing direct-facade tests**

Cover active creation, same-element replacement through the delegate, clear, inactive no-op, disconnected-element no-op, absent-page safety, and owner-scoped disposal:

```ts
const setComment = vi.fn();
const installation = installGlobalCommentaryReviewCommentProtocol({
  windowRef,
  isActive: () => true,
  setComment,
  clearComment: vi.fn(),
});

expect(windowRef.axhubReview?.setComment({ element, comment: '采用平衡布局。' })).toBe(true);
expect(setComment).toHaveBeenCalledWith(element, '采用平衡布局。');
installation.dispose();
expect(windowRef.axhubReview).toBeUndefined();
```

- [ ] **Step 2: Run the focused protocol test and verify RED**

Run:

```bash
pnpm exec vitest run packages/axhub-commentary/src/review/comment-protocol.test.ts
```

Expected: FAIL because `comment-protocol.ts` does not exist.

- [ ] **Step 3: Implement the minimal lifecycle-bound facade**

Implement bounded, trimmed comment input with a 4,000-character limit. Reject missing/disconnected elements, empty `setComment` input, inactive runtimes, and disposed installations. Install directly on `window.axhubReview`; `dispose()` removes it only when the same installation still owns the global property.

- [ ] **Step 4: Wire the facade to the existing note service**

After `createChangesService()` is available in `createCommentary()`, install:

```ts
const reviewCommentInstallation = installGlobalCommentaryReviewCommentProtocol({
  isActive: () => !destroyed && state.active,
  setComment: (element, comment) => changes.setNoteForElement(element, comment),
  clearComment: (element) => changes.setNoteForElement(element, ''),
});
```

Dispose it from `destroy()`. Export only the new facade types/functions and update the global `Window` declaration.

- [ ] **Step 5: Run protocol and editor index tests and verify GREEN**

Run:

```bash
pnpm exec vitest run packages/axhub-commentary/src/review/comment-protocol.test.ts packages/axhub-commentary/src/core/editor/index.test.ts
```

Expected: both files pass with zero failed tests.

### Task 2: Remove the separate review-feedback prompt model

**Files:**
- Modify: `packages/axhub-commentary/src/core/editor/index.ts`
- Modify: `packages/axhub-commentary/src/core/editor/contracts.ts`
- Modify: `packages/axhub-commentary/src/core/editor/summaries.ts`
- Modify: `packages/axhub-commentary/src/core/editor/summaries.test.ts`
- Modify: `packages/axhub-commentary/src/web-editor-types.ts`
- Modify: `packages/axhub-commentary/PUBLIC-API.md`

**Interfaces:**
- Removes: `CommentaryReviewFeedbackInput`, `CommentaryReviewFeedbackSnapshot`, `getReviewFeedbackSnapshot()`, `reviewFeedback` snapshot/context fields, and `getReviewFeedbackSnapshot` summary dependency.
- Retains: ordinary element notes, element-level prompt generation, global copy prompt, diagram target detection, and reference-only prompt filtering.

- [ ] **Step 1: Add failing regression assertions for a single ordinary-comment path**

Update summary and index tests to assert that a note-only element remains actionable and appears exactly once, while the public API no longer contains `reviewFeedback`:

```ts
expect(prompt.match(/首页采用平衡的信息密度。/gu)).toHaveLength(1);
expect(editor.getEditedSnapshot()).not.toHaveProperty('reviewFeedback');
expect('getReviewFeedbackSnapshot' in editor).toBe(false);
```

- [ ] **Step 2: Run summary and index tests and verify RED**

Run:

```bash
pnpm exec vitest run packages/axhub-commentary/src/core/editor/summaries.test.ts packages/axhub-commentary/src/core/editor/index.test.ts
```

Expected: the removal assertions fail while the old fields and API remain.

- [ ] **Step 3: Delete review-feedback aggregation and types**

Remove protocol initialization from `createCommentary()`, remove registry clearing from `clearAllEdits()`, remove feedback loops from all prompt builders, and collapse empty-state checks back to ordinary edit/comment inputs. Update `PUBLIC-API.md` so the plain-HTML section documents `setComment`/`clearComment`, annotation-mode gating, and normal comment-card behavior.

- [ ] **Step 4: Run focused package tests and verify GREEN**

Run:

```bash
pnpm exec vitest run packages/axhub-commentary/src/review/comment-protocol.test.ts packages/axhub-commentary/src/core/editor/index.test.ts packages/axhub-commentary/src/core/editor/summaries.test.ts
```

Expected: all focused tests pass and `rg -n "reviewFeedback|setFeedback|clearFeedback" packages/axhub-commentary/src packages/axhub-commentary/PUBLIC-API.md` returns no matches.

### Task 3: Migrate Make's HTML bridge and example

**Files:**
- Modify: `apps/axhub-make/src/html-template/htmlReviewBridge.ts`
- Modify: `apps/axhub-make/src/html-template/htmlReviewBridge.test.ts`
- Modify: `apps/axhub-make/client/src/resources/examples/html-review-demo.html`
- Modify: `apps/axhub-make/client/tests/html-review-demo.test.ts`
- Modify: `apps/axhub-make/client/src/resources/README.md`
- Generated by existing sync script: `apps/axhub-make/vendor/axhub-commentary/**`

**Interfaces:**
- Consumes: `CommentaryReviewCommentProtocol.setComment()` and `.clearComment()` from Task 1.
- Produces: choice comments anchored to `#layout-review` and `#scope-review`; diagram-summary comments anchored to the resolved diagram owner.

- [ ] **Step 1: Write failing bridge and demo tests**

Change the bridge harness to inject `setComment` and assert diagram refresh calls:

```ts
expect(setComment).toHaveBeenCalledWith({
  element: owner,
  comment: expect.stringContaining('图表修改'),
});
```

Update the demo source test to require `window.axhubReview?.setComment?.(...)`, `clearComment`, the two stable question targets, and the absence of `setFeedback`/`clearFeedback` language.

- [ ] **Step 2: Run bridge and demo tests and verify RED**

Run:

```bash
pnpm --dir apps/axhub-make exec vitest run src/html-template/htmlReviewBridge.test.ts client/tests/html-review-demo.test.ts
```

Expected: assertions fail because both producers still call the old feedback API.

- [ ] **Step 3: Migrate the demo choices**

Use thin helpers:

```js
function setReviewComment(element, comment) {
  window.axhubReview?.setComment?.({ element, comment });
}

function clearReviewComment(element) {
  window.axhubReview?.clearComment?.({ element });
}
```

Single-select changes overwrite the note on `#layout-review`. Multi-select changes overwrite the note on `#scope-review`; clearing all values clears that note. Update page copy to say the result becomes a normal comment node and the reviewer chooses execute or copy.

- [ ] **Step 4: Migrate diagram draft refresh**

Replace the bridge's structured feedback payload with one bounded ordinary comment. Include the diagram key, stale state, summary lines, source path, preview path, and source hash as readable text; do not include full source or scene data.

- [ ] **Step 5: Synchronize the local Commentary vendor copy**

Run:

```bash
pnpm --dir apps/axhub-make vendor:sync
```

Expected: the vendored source and bundles expose `setComment`/`clearComment` and contain no review-feedback registry.

- [ ] **Step 6: Run focused bridge and demo tests and verify GREEN**

Run:

```bash
pnpm --dir apps/axhub-make exec vitest run src/html-template/htmlReviewBridge.test.ts client/tests/html-review-demo.test.ts src/html-template/annotation-boundary.test.ts
```

Expected: all focused tests pass.

### Task 4: Cross-repository verification and cleanup audit

**Files:**
- Verify all files changed by Tasks 1-3.

**Interfaces:**
- Confirms: ordinary comments are the only HTML interaction result model and both source and vendored runtime agree.

- [ ] **Step 1: Audit removal of the old path**

Run:

```bash
rg -n "reviewFeedback|CommentaryReviewFeedback|setFeedback|clearFeedback|REVIEW_FEEDBACK" packages/axhub-commentary apps/axhub-make/src apps/axhub-make/client apps/axhub-make/vendor/axhub-commentary --glob '!**/dist/**'
```

Expected: no runtime, test, or documentation matches for the removed model.

- [ ] **Step 2: Run the full affected Commentary test set**

Run:

```bash
pnpm exec vitest run packages/axhub-commentary/src/review packages/axhub-commentary/src/core/editor/index.test.ts packages/axhub-commentary/src/core/editor/summaries.test.ts
```

Expected: zero failed tests.

- [ ] **Step 3: Run Make's focused tests and type build**

Run:

```bash
pnpm --dir apps/axhub-make exec vitest run src/html-template/htmlReviewBridge.test.ts src/html-template/annotation-boundary.test.ts client/tests/html-review-demo.test.ts
pnpm --dir apps/axhub-make server:build
```

Expected: zero failed tests and TypeScript exits with status 0.

- [ ] **Step 4: Inspect diffs without touching unrelated work**

Run `git diff --check` and scoped `git diff` in both repositories. Confirm only the direct comment facade, old feedback removal, bridge/demo migration, docs, tests, and generated vendor updates belong to this task.
