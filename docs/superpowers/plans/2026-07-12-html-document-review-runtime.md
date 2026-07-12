# HTML Document Review Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Make-only, framework-independent HTML review feedback, Mermaid/Draw.io diagram editing handoff, reference-only prompts, and a plain HTML example resource.

**Architecture:** `@axhub/commentary` owns a small global feedback registry, element association, generic card tools, and prompt aggregation. Make's injected HTML bootstrap supplies diagram detection and host actions, while Make server APIs own raw-source extraction, validated supporting-asset paths, manifests, and durable files. The existing canvas and Draw.io editors remain the editing surfaces.

**Tech Stack:** TypeScript 5.x, React 18.2.0 inside existing runtimes, Vitest 4, pnpm workspace, `@excalidraw/mermaid-to-excalidraw`, patched `@axhub/excalidraw`, native HTML forms.

## Global Constraints

- Use pnpm for repository development and tests.
- Keep React and ReactDOM at 18.2.0.
- Version 1 supports only HTML documents under the active Make project's `src/resources/`.
- Do not add an Axhub HTML component DSL.
- The generated example must be plain HTML and must not import React.
- Page feedback is collected first; only existing individual/global Commentary actions send it.
- Large files are referenced only by project-relative paths; never put full HTML, Mermaid, Excalidraw, Draw.io, Base64, DOM snapshots, or machine-absolute paths into prompts.
- Keep `@axhub/commentary-react` unchanged in version 1.
- Preserve unrelated staged and unstaged work; every commit uses explicit file paths.

---

### Task 1: Framework-independent review feedback registry

**Files:**
- Create: `packages/axhub-commentary/src/review/feedback-protocol.ts`
- Create: `packages/axhub-commentary/src/review/feedback-protocol.test.ts`
- Modify: `packages/axhub-commentary/src/index.ts`

**Interfaces:**
- Produces: `CommentaryReviewFeedbackInput`, `CommentaryReviewFeedbackSnapshot`, `CommentaryReviewFeedbackProtocol`, `createCommentaryReviewFeedbackProtocol()`, `ensureGlobalCommentaryReviewFeedbackProtocol()`, and global `window.axhubReview` with `setFeedback`, `clearFeedback`, `listFeedback`, and `subscribe`.
- Consumes: `createElementLocator()` and `locateElement()` from the existing locator module.

- [ ] **Step 1: Write failing protocol tests**

Add Vitest cases proving that `setFeedback` replaces the same key, two keys coexist, `clearFeedback` removes one item, subscriptions fire once per mutation, strings and `data` are bounded, an element locator survives serialization, and scope changes isolate persisted values.

```ts
const protocol = createCommentaryReviewFeedbackProtocol({
  storage: memoryStorage,
  scope: 'html-doc:review/demo.html',
});
protocol.setFeedback({
  key: 'layout',
  element: card,
  title: '布局',
  value: '宽松',
  instruction: '采用宽松布局',
});
protocol.setFeedback({
  key: 'layout',
  element: card,
  title: '布局',
  value: '紧凑',
  instruction: '采用紧凑布局',
});
expect(protocol.listFeedback()).toHaveLength(1);
expect(protocol.listFeedback()[0]?.value).toBe('紧凑');
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
pnpm exec vitest run packages/axhub-commentary/src/review/feedback-protocol.test.ts
```

Expected: FAIL because `feedback-protocol.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal registry**

Implement the public input and snapshot types, a plain-object store keyed by bounded `key`, locator creation at registration time, `localStorage`-compatible persistence, scope switching, immutable list snapshots, and a global facade.

Use these limits:

```ts
const REVIEW_KEY_MAX = 160;
const REVIEW_TITLE_MAX = 240;
const REVIEW_VALUE_MAX = 1_000;
const REVIEW_INSTRUCTION_MAX = 4_000;
const REVIEW_DATA_MAX_BYTES = 8_192;
```

The persisted record stores the locator and text fields, never the DOM `Element` reference. `listFeedback()` resolves a live element best-effort but retains the locator when the element is not mounted.

- [ ] **Step 4: Export and verify GREEN**

Export the protocol from `packages/axhub-commentary/src/index.ts`, rerun the focused test, and expect all cases to pass.

- [ ] **Step 5: Commit Task 1 files only**

```bash
git add packages/axhub-commentary/src/review/feedback-protocol.ts packages/axhub-commentary/src/review/feedback-protocol.test.ts packages/axhub-commentary/src/index.ts
git commit -m "feat(commentary): add html review feedback protocol"
```

### Task 2: Commentary prompt aggregation and reference-only guard

**Files:**
- Modify: `packages/axhub-commentary/src/web-editor-types.ts`
- Modify: `packages/axhub-commentary/src/core/editor/contracts.ts`
- Modify: `packages/axhub-commentary/src/core/editor/index.ts`
- Modify: `packages/axhub-commentary/src/core/editor/summaries.ts`
- Modify: `packages/axhub-commentary/src/core/editor/summaries.test.ts`

**Interfaces:**
- Consumes: `ensureGlobalCommentaryReviewFeedbackProtocol()` and `CommentaryReviewFeedbackSnapshot` from Task 1.
- Produces: `reviewFeedback` on `CommentaryCopyPromptContext`, element-level prompt inclusion, global prompt inclusion, and `CommentaryApi.getReviewFeedbackSnapshot()`.

- [ ] **Step 1: Add failing summary tests**

Add tests showing that one registered decision appears in the prompt associated with its locator, replacing the same key removes the older answer, global copy includes all pending decisions, and the prompt omits forbidden payloads.

```ts
expect(prompt).toContain('评审确认：结算页布局');
expect(prompt).toContain('用户选择：紧凑');
expect(prompt).toContain('相关文件：src/resources/review/demo.assets/diagram.excalidraw');
expect(prompt).not.toContain('{"type":"excalidraw"');
expect(prompt).not.toContain('data:image/png;base64');
expect(prompt).not.toContain('/Users/');
expect(prompt).not.toContain('/Volumes/');
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
pnpm exec vitest run packages/axhub-commentary/src/core/editor/summaries.test.ts
```

Expected: the new assertions fail because summaries do not read review feedback.

- [ ] **Step 3: Extend the public context and summary service**

Add `reviewFeedback: CommentaryReviewFeedbackSnapshot[]` to `CommentaryCopyPromptContext`. Pass a protocol snapshot reader into `createEditorSummariesService()`. Append bounded sections using only `title`, `value`, `instruction`, safe small scalar `data`, relative `sourcePath`, relative `previewPath`, and at most twelve summary lines.

Reject values matching absolute POSIX paths, Windows drive paths, `data:` URLs, or serialized Excalidraw/Draw.io document bodies from file-reference fields. Keep ordinary human instructions intact.

- [ ] **Step 4: Add API snapshot access and verify GREEN**

Expose:

```ts
getReviewFeedbackSnapshot(): CommentaryReviewFeedbackSnapshot[];
```

Wire it through `CommentaryApi`, contracts, and `createCommentary()`. Rerun summary and index tests.

- [ ] **Step 5: Commit Task 2 files only**

```bash
git add packages/axhub-commentary/src/web-editor-types.ts packages/axhub-commentary/src/core/editor/contracts.ts packages/axhub-commentary/src/core/editor/index.ts packages/axhub-commentary/src/core/editor/summaries.ts packages/axhub-commentary/src/core/editor/summaries.test.ts
git commit -m "feat(commentary): include review feedback in prompts"
```

### Task 3: Generic element-card tool extension and diagram target detection

**Files:**
- Create: `packages/axhub-commentary/src/review/diagram-target.ts`
- Create: `packages/axhub-commentary/src/review/diagram-target.test.ts`
- Modify: `packages/axhub-commentary/src/web-editor-types.ts`
- Modify: `packages/axhub-commentary/src/core/editor/state.ts`
- Modify: `packages/axhub-commentary/src/ui/runtime/types.ts`
- Modify: `packages/axhub-commentary/src/ui/runtime/create-web-editor-ui-runtime.tsx`
- Modify: `packages/axhub-commentary/src/ui/runtime/prompt-card-view.tsx`
- Modify: `packages/axhub-commentary/src/ui/runtime/prompt-card-view.test.tsx`
- Modify: `packages/axhub-commentary/src/index.ts`

**Interfaces:**
- Produces: `CommentaryDiagramTarget`, `resolveCommentaryDiagramTarget(element)`, `CommentaryElementTool`, `CommentaryHostOptions.getElementTools(element)`, and `CommentaryHostOptions.onElementToolAction(tool, element)`.
- Consumes: normal Mermaid `.mermaid` containers, Mermaid SVG output markers, `*.drawio.svg` references, inline `data-drawio`, and `metadata#drawio-source`.

- [ ] **Step 1: Write failing diagram detection tests**

Cover a child `<path>` inside rendered Mermaid SVG, a child label inside inline Draw.io SVG, an `<img src="flows/order.drawio.svg">`, a plain SVG, and an unrelated child element.

```ts
expect(resolveCommentaryDiagramTarget(mermaidPath)).toMatchObject({
  kind: 'mermaid',
  owner: mermaidContainer,
});
expect(resolveCommentaryDiagramTarget(plainSvgPath)).toBeNull();
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm exec vitest run packages/axhub-commentary/src/review/diagram-target.test.ts
```

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement the resolver**

Normalize a child target to the closest editable diagram owner. Return `kind`, `owner`, `diagramId`, `sourceUrl`, `documentIndex`, and `editable`. Do not add or require Axhub-specific markup.

- [ ] **Step 4: Write failing card-tool rendering tests**

Add a host tool fixture:

```ts
getElementTools: () => [{ id: 'open-diagram', label: '在画布中打开', icon: 'diagram' }],
onElementToolAction: onElementToolAction,
```

Assert that the action appears only when returned, invokes the host with the current target, remains independent of normal execute, and displays host errors without closing the card.

- [ ] **Step 5: Run card tests and verify RED**

Run:

```bash
pnpm exec vitest run packages/axhub-commentary/src/ui/runtime/prompt-card-view.test.tsx
```

Expected: the new host tool is absent.

- [ ] **Step 6: Implement generic card tools and verify GREEN**

Pass host callbacks through resolved options and UI runtime props. Render compact secondary actions below existing annotation-document actions. Use `ExportOutlined` for the initial diagram action; the public interface uses icon keys rather than React nodes.

Rerun both Task 3 suites and related runtime-shell tests.

- [ ] **Step 7: Commit Task 3 files only**

```bash
git add packages/axhub-commentary/src/review/diagram-target.ts packages/axhub-commentary/src/review/diagram-target.test.ts packages/axhub-commentary/src/web-editor-types.ts packages/axhub-commentary/src/core/editor/state.ts packages/axhub-commentary/src/ui/runtime/types.ts packages/axhub-commentary/src/ui/runtime/create-web-editor-ui-runtime.tsx packages/axhub-commentary/src/ui/runtime/prompt-card-view.tsx packages/axhub-commentary/src/ui/runtime/prompt-card-view.test.tsx packages/axhub-commentary/src/index.ts
git commit -m "feat(commentary): add diagram card tools"
```

### Task 4: Make server HTML diagram source and supporting-asset APIs

**Files:**
- Create: `apps/axhub-make/src/server/htmlReviewArtifacts.ts`
- Create: `apps/axhub-make/src/server/__tests__/html-review-artifacts-api.test.ts`
- Modify: `apps/axhub-make/src/server/managementApi.ts`
- Modify: `apps/axhub-make/src/server/resourceFiles.ts`
- Modify: `apps/axhub-make/package.json`
- Modify: `apps/axhub-make/pnpm-lock.yaml`

**Interfaces:**
- Produces:
  - `GET /api/html-review/diagrams?path=<resource>` returning bounded Mermaid/Draw.io descriptors and source hashes;
  - `POST /api/html-review/diagram-drafts` creating or restoring a validated sidecar draft;
  - `PUT /api/html-review/diagram-drafts/:sessionId` updating relative source/preview metadata and bounded summaries;
  - `GET /api/html-review/diagram-drafts/:sessionId` recovering the cross-window association.
- Consumes: active project root, `src/resources/` HTML path, standard Mermaid `.mermaid` markup, and Draw.io SVG metadata.

- [ ] **Step 1: Write failing pure extraction and path tests**

Test HTML containing two Mermaid blocks, an inline Draw.io SVG, an external `.drawio.svg`, duplicate headings, missing IDs, entity-encoded arrows, and traversal attempts. Assert stable ordinal fallback, normalized source hash, and paths under `<html-name>.assets/diagrams/`.

- [ ] **Step 2: Write failing API tests**

Assert that valid requests create:

```text
src/resources/review/demo.assets/diagram-manifest.json
src/resources/review/demo.assets/diagrams/mermaid-flow.excalidraw
```

and reject `../`, absolute paths, wrong project resources, unsupported extensions, oversized bodies, and arbitrary client-selected output paths.

- [ ] **Step 3: Run server tests and verify RED**

Run:

```bash
pnpm --dir apps/axhub-make exec vitest run src/server/__tests__/html-review-artifacts-api.test.ts
```

Expected: FAIL because the API and extractor are absent.

- [ ] **Step 4: Implement extraction, manifest, and session persistence**

Add `parse5@7.3.0` as a direct Make dependency. Use it for authoritative raw HTML parsing together with SHA-256 truncated hashes, server-derived slugs, atomic JSON writes, and opaque session IDs. Store only project-relative paths in API responses. The manifest uses `version: 1`, document path, diagram key, kind, locator context, source hash, current source path, preview path, summary, and update time.

- [ ] **Step 5: Hide supporting assets in the normal resource list**

Update resource scanning so a directory matching a sibling HTML basename plus `.assets` is treated as supporting data rather than independent sidebar resources. Do not hide ordinary user folders that merely contain `.assets` in their name without a matching HTML sibling.

- [ ] **Step 6: Run server tests and verify GREEN**

Rerun the focused suites, then:

```bash
pnpm --dir apps/axhub-make server:build
```

Expected: all focused tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit Task 4 files only in the Make repository**

```bash
git -C apps/axhub-make add src/server/htmlReviewArtifacts.ts src/server/__tests__/html-review-artifacts-api.test.ts src/server/managementApi.ts src/server/resourceFiles.ts package.json pnpm-lock.yaml
git -C apps/axhub-make commit -m "feat: add html diagram review artifacts"
```

### Task 5: HTML bootstrap diagram handoff and feedback bridge

**Files:**
- Create: `apps/axhub-make/src/html-template/htmlReviewBridge.ts`
- Create: `apps/axhub-make/src/html-template/htmlReviewBridge.test.ts`
- Modify: `apps/axhub-make/src/html-template/index.tsx`
- Modify: `apps/axhub-make/src/html-template/annotation-boundary.test.ts`
- Modify: `apps/axhub-make/src/index/app/index-page/usePrototypeEditorBridgeActions.ts`
- Modify: `apps/axhub-make/src/index/app/index-page/usePrototypeEditorBridgeActions.test.ts`
- Modify: `apps/axhub-make/src/index/app/index-page/useIndexPagePreviewActions.tsx`
- Modify: `apps/axhub-make/src/index/app/index-page/useIndexPagePreviewActions.test.ts`

**Interfaces:**
- Consumes: Tasks 1-4 protocols and APIs, existing `/canvas/resources/<path>.excalidraw` route, existing Draw.io resource deep links, and existing HTML editor bridge messages.
- Produces: automatic `window.axhubReview` setup, diagram host card actions, new-window opening, draft polling/recovery, and review feedback with relative source/preview paths.

- [ ] **Step 1: Write failing bridge unit tests**

Test tool labels, source-descriptor lookup, popup-blocked behavior, Mermaid draft creation, Draw.io deep-link creation, polling after opener reload, same-key feedback replacement, stale hash display, and path-only feedback fields.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm --dir apps/axhub-make exec vitest run src/html-template/htmlReviewBridge.test.ts src/html-template/annotation-boundary.test.ts src/index/app/index-page/usePrototypeEditorBridgeActions.test.ts src/index/app/index-page/useIndexPagePreviewActions.test.ts
```

Expected: FAIL because `htmlReviewBridge` does not exist.

- [ ] **Step 3: Implement runtime initialization**

On bootstrap load, set the feedback protocol scope from `storageScope`, expose it as `window.axhubReview`, and subscribe Commentary refresh/status updates without requiring React code in the document.

- [ ] **Step 4: Implement diagram actions**

Use `resolveCommentaryDiagramTarget()` to return one host tool for editable Mermaid or Draw.io targets. On click, request/create the server draft and open:

```text
/canvas/resources/<relative-excalidraw-path>
/?projectId=<projectId>&doc=<relative-drawio-path>&openDrawio=1
```

If `window.open()` returns `null`, retain the draft and surface a retryable popup-blocked message.

Add a one-shot `openDrawio=1` deep-link effect after the requested document is selected. It opens the existing Draw.io resource editor, then removes only `openDrawio` from the URL so refresh does not reopen the editor.

- [ ] **Step 5: Implement return-to-Commentary feedback**

Poll or subscribe to the Make-owned draft session. On update, call `setFeedback()` with a stable `diagram:<diagramKey>` key, associated owner element, bounded summary, source hash, and project-relative source/preview paths. Never put the scene or preview contents in the feedback object.

- [ ] **Step 6: Verify GREEN**

Rerun focused bridge tests and `pnpm --dir apps/axhub-make server:build`.

- [ ] **Step 7: Commit Task 5 files only**

```bash
git -C apps/axhub-make add src/html-template/htmlReviewBridge.ts src/html-template/htmlReviewBridge.test.ts src/html-template/index.tsx src/html-template/annotation-boundary.test.ts src/index/app/index-page/usePrototypeEditorBridgeActions.ts src/index/app/index-page/usePrototypeEditorBridgeActions.test.ts src/index/app/index-page/useIndexPagePreviewActions.tsx src/index/app/index-page/useIndexPagePreviewActions.test.ts
git -C apps/axhub-make commit -m "feat: connect html diagrams to review editors"
```

### Task 6: Default client plain HTML review example

**Files:**
- Create: `apps/axhub-make/client/src/resources/examples/html-review-demo.html`
- Create: `apps/axhub-make/client/src/resources/examples/html-review-demo.assets/diagrams/system-architecture.drawio.svg`
- Create: `apps/axhub-make/client/tests/html-review-demo.test.ts`

**Interfaces:**
- Consumes: `window.axhubReview.setFeedback()` and `clearFeedback()` from Task 1, standard `.mermaid`, and standard Draw.io SVG metadata.
- Produces: a committed first-run example visible under the default client's document resources.

- [ ] **Step 1: Write the failing static contract test**

Assert that the HTML file exists, contains no React imports or Axhub component tags, uses a `.mermaid` block, references the `.drawio.svg`, includes a radio-card group and multi-select group, checks `window.axhubReview` before integration calls, reuses stable keys, and contains no absolute paths or Base64 payloads.

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm --dir apps/axhub-make/client test:run -- tests/html-review-demo.test.ts
```

Expected: FAIL because the example files do not exist.

- [ ] **Step 3: Create the plain HTML example**

Build a self-contained responsive Chinese review document with ordinary CSS and JavaScript. Include visible instructions for element/text comments, local/global submission, Mermaid canvas opening, Draw.io opening, and decision replacement. The page controls must update visibly even when `window.axhubReview` is absent.

Use this integration pattern:

```js
function recordFeedback(payload) {
  window.axhubReview?.setFeedback?.(payload);
}
```

Do not load React. If Mermaid rendering uses an optional network module, keep the source block readable when the module cannot load.

- [ ] **Step 4: Add an editable Draw.io SVG fixture**

Create a small valid `.drawio.svg` with embedded Draw.io model metadata and no external assets. Reference it relatively from the HTML.

- [ ] **Step 5: Run example tests and client checks**

Run:

```bash
pnpm --dir apps/axhub-make/client test:run -- tests/html-review-demo.test.ts
pnpm --dir apps/axhub-make/client typecheck
```

Expected: focused tests pass and typecheck exits 0.

- [ ] **Step 6: Commit Task 6 files only**

```bash
git -C apps/axhub-make add client/src/resources/examples/html-review-demo.html client/src/resources/examples/html-review-demo.assets/diagrams/system-architecture.drawio.svg client/tests/html-review-demo.test.ts
git -C apps/axhub-make commit -m "feat: add html review example resource"
```

### Task 7: Cross-package verification and documentation sync

**Files:**
- Modify: `packages/axhub-commentary/PUBLIC-API.md`
- Modify: `apps/axhub-make/client/src/resources/README.md`
- Test: all files changed by Tasks 1-6

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: documented public browser protocol, documented supporting-asset convention, and final verification evidence.

- [ ] **Step 1: Add focused documentation assertions**

Extend existing package/source tests where available so public docs name `window.axhubReview`, `setFeedback`, `clearFeedback`, `.mermaid`, `.drawio.svg`, and reference-only relative paths.

- [ ] **Step 2: Run documentation tests and verify RED**

Run the focused documentation/source tests selected in Tasks 1-6 and confirm the new documentation assertions fail before editing docs.

- [ ] **Step 3: Update public documentation**

Document the optional browser API, graceful no-runtime fallback, diagram recognition, storage layout, and strict path-only prompt rule. State explicitly that `@axhub/commentary-react` is not required for plain HTML review.

- [ ] **Step 4: Run full relevant verification**

Run:

```bash
pnpm exec vitest run packages/axhub-commentary/src/review packages/axhub-commentary/src/core/editor/summaries.test.ts packages/axhub-commentary/src/ui/runtime/prompt-card-view.test.tsx
pnpm --filter @axhub/commentary build
pnpm --dir apps/axhub-make exec vitest run src/html-template src/server/__tests__/html-review-artifacts-api.test.ts src/index/app/index-page/usePrototypeEditorBridgeActions.test.ts
pnpm --dir apps/axhub-make server:build
pnpm --dir apps/axhub-make/client test:run -- tests/html-review-demo.test.ts
pnpm --dir apps/axhub-make/client typecheck
git diff --check
git -C apps/axhub-make diff --check
```

Expected: every command exits 0 with no test failures or whitespace errors.

- [ ] **Step 5: Browser end-to-end verification**

Start Make, open `src/resources/examples/html-review-demo.html`, and verify normal comments, text comments, two answer replacements, global copy, Mermaid new-window editing, Draw.io opening, return status, relative paths, and stale-source warning. Inspect the copied prompt and confirm it contains no full files, Base64, DOM snapshots, `/Users/`, `/Volumes/`, or Windows drive paths.

- [ ] **Step 6: Commit documentation only**

```bash
git add packages/axhub-commentary/PUBLIC-API.md
git commit -m "docs(commentary): document html review protocol"
git -C apps/axhub-make add client/src/resources/README.md
git -C apps/axhub-make commit -m "docs: document html review resources"
```
