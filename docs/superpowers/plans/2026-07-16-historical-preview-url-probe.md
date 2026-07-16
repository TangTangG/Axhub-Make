# Historical Preview URL Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make already-generated historical prototype previews open synchronously while ungenerated previews build once and ask for a second click.

**Architecture:** The Git history response exposes a deterministic preview URL without storing status. A focused client helper probes the existing version entry file, and `VersionManager` branches synchronously on its in-memory readiness result.

**Tech Stack:** React 18.2.0, TypeScript 5.x, Vitest 4, Node HTTP server, pnpm.

## Global Constraints

- Use pnpm for repository development and tests.
- Do not add legacy compatibility behavior without approval.
- Do not add persistent preview-status metadata or completion marker files.
- Preserve unrelated user changes in the dirty worktree.

---

### Task 1: Deterministic history preview URL

**Files:**
- Modify: `src/server/managementApi.git.ts:1546`
- Test: `src/server/__tests__/projects-git-api.test.ts:73`

**Interfaces:**
- Consumes: normalized `previewResourceName`, `gitScopePath`, `targetPath`, project id, and commit hash.
- Produces: `prototypeUrl: string | null` on each history commit and the unchanged build response.

- [ ] **Step 1: Write the failing integration assertions**

Assert that `history.commits[0].prototypeUrl` equals the deterministic `/prototypes/home?...` URL before `/api/git/build-version` runs, and that `/api/git/version-file/<versionId>/prototypes/home/index.tsx` returns 404 before the build and 200 after it.

- [ ] **Step 2: Run the focused server test and verify RED**

Run: `pnpm exec vitest run src/server/__tests__/projects-git-api.test.ts`

Expected: FAIL because history commits do not expose `prototypeUrl`.

- [ ] **Step 3: Add a shared response URL helper**

Implement a local helper equivalent to:

```ts
function buildGitVersionPrototypeUrl(options: {
  versionId: string;
  previewResourceName: string;
  targetPath: string;
  gitScopePath: string;
  projectId: string;
}): string | null {
  const previewName = options.previewResourceName || options.targetPath;
  if (!previewName) return null;
  return appendSearchParams(`/prototypes/${encodePreviewPathSegments(previewName)}`, {
    projectId: options.projectId,
    gitVersion: options.versionId,
    gitPath: normalizePreviewResourcePath(options.gitScopePath || options.targetPath),
  });
}
```

Use it in both the history mapping and `/api/git/build-version` response so their URLs cannot drift.

- [ ] **Step 4: Run the focused server test and verify GREEN**

Run: `pnpm exec vitest run src/server/__tests__/projects-git-api.test.ts`

Expected: PASS.

### Task 2: Probe helper and two-click UI behavior

**Files:**
- Create: `src/index/components/gitVersionPreview.ts`
- Create: `src/index/components/gitVersionPreview.test.ts`
- Modify: `src/index/components/VersionManager.tsx:29`
- Modify: `src/index/components/VersionCollaborationPanel.source.test.ts:217`

**Interfaces:**
- Consumes: `commitHash`, normalized `targetPath`, optional `projectId`, and a fetch implementation.
- Produces: `buildGitVersionEntryProbeUrl(...) => string` and `probeGitVersionEntry(...) => Promise<boolean>`.

- [ ] **Step 1: Write failing helper tests**

Cover encoded Unicode/nested paths and readiness responses:

```ts
expect(buildGitVersionEntryProbeUrl({
  commitHash: '8b8f52da12345678',
  targetPath: 'prototypes/未命名',
  projectId: 'make-project',
})).toBe('/api/git/version-file/8b8f52da/prototypes/%E6%9C%AA%E5%91%BD%E5%90%8D/index.tsx?projectId=make-project');
```

Use fetch doubles returning 200 and 404 to prove `probeGitVersionEntry` returns `true` and `false` respectively.

- [ ] **Step 2: Update the source regression to describe the desired click flow**

Require `CommitItem` to carry `prototypeUrl` and `previewReady`, require the load path to call `probeGitVersionEntry`, require the ready branch to synchronously call `window.open`, and require build success to update state plus show `历史版本已准备好，请再次点击预览` without opening.

- [ ] **Step 3: Run focused frontend tests and verify RED**

Run: `pnpm exec vitest run src/index/components/gitVersionPreview.test.ts src/index/components/VersionCollaborationPanel.source.test.ts`

Expected: FAIL because the helper and two-click behavior do not exist.

- [ ] **Step 4: Implement the minimal probe helper**

Implement segment-safe URL construction and a no-store GET probe. Treat only `response.ok` as ready and cancel the unused body when supported.

- [ ] **Step 5: Implement the component flow**

After history loads, probe every commit with a `prototypeUrl` and store `previewReady` in `commits`. Change `handleViewPrototype` to accept the commit: open immediately when ready; otherwise show a preparation toast, call the existing build endpoint, update that commit's `prototypeUrl` and `previewReady`, then show the second-click success toast.

- [ ] **Step 6: Run focused frontend tests and verify GREEN**

Run: `pnpm exec vitest run src/index/components/gitVersionPreview.test.ts src/index/components/VersionCollaborationPanel.source.test.ts`

Expected: PASS.

### Task 3: Verification

**Files:**
- Verify only; no new production files.

**Interfaces:**
- Consumes: completed server and client behavior.
- Produces: fresh evidence that the regression is fixed without unrelated breakage.

- [ ] **Step 1: Run all directly related tests**

Run: `pnpm exec vitest run src/index/components/gitVersionPreview.test.ts src/index/components/VersionCollaborationPanel.source.test.ts src/server/__tests__/projects-git-api.test.ts`

Expected: PASS with no test failures.

- [ ] **Step 2: Run the Admin production build**

Run: `pnpm admin:build`

Expected: both Vite builds complete successfully.

- [ ] **Step 3: Review the final diff**

Confirm only the URL helper, history URL field, two-click UI flow, focused tests, and these process documents changed as part of this task.
