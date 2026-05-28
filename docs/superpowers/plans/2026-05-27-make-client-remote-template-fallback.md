# Make Client Remote Template Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/api/projects/make/create` fetch the Make client template from GitHub and fall back to the Gitee mirror when the primary remote fails.

**Architecture:** Add a focused remote template acquisition helper to `src/server/makeClientProject.ts`. It tries configured Git sources in order, sparse-checks out the `client/` directory into a temporary checkout, copies it through the existing ignore-aware template copier, and returns the repository URL used for marker metadata.

**Tech Stack:** TypeScript, Node fs/path/os, existing `runLocalCommand`, Vitest server API tests.

---

### Task 1: Remote Template Source Tests

**Files:**
- Modify: `src/server/__tests__/projects-make-client-api.test.ts`
- Modify: `src/server/makeClientProject.ts`

- [x] **Step 1: Write failing tests**

Add tests proving primary success, fallback success, and both-source failure for `/api/projects/make/create`. The `runLocalCommand` mock simulates `git clone`, `git sparse-checkout`, `pnpm install`, and `pnpm metadata:sync`.

- [x] **Step 2: Verify tests fail**

Run:

```bash
pnpm exec vitest run src/server/__tests__/projects-make-client-api.test.ts
```

Result: the new tests failed because create still copied the local template path and never called Git.

- [x] **Step 3: Implement remote acquisition**

Added constants for the primary GitHub repository and Gitee mirror, a remote template acquisition helper, and changed `createBlankMakeClientProject` to use remote acquisition with no embedded-template fallback.

- [x] **Step 4: Verify tests pass**

Run:

```bash
pnpm exec vitest run src/server/__tests__/projects-make-client-api.test.ts
```

Result: all tests in the file passed.

### Task 2: Project Core Marker Alignment

**Files:**
- Review: `src/server/projectCore/make-client-marker.ts`
- Modify: `src/server/__tests__/projects-api.helpers.ts`

- [x] **Step 1: Align default repository metadata**

Confirmed the default marker repository and test helpers use the GitHub `Axhub-Make/tree/main/client` URL; removed obsolete test-only template root plumbing.

- [x] **Step 2: Verify targeted tests**

Run:

```bash
pnpm exec vitest run src/server/__tests__/projects-make-client-api.test.ts src/server/__tests__/assistant-runtime-api.test.ts
```

Result: both test files passed.

### Task 3: Final Verification

**Files:**
- Review: `src/server/makeClientProject.ts`
- Review: `src/server/__tests__/projects-make-client-api.test.ts`
- Review: `src/server/projectCore/make-client-marker.ts`

- [x] **Step 1: Run server build check**

Run:

```bash
pnpm server:build
```

Result: TypeScript server build passed.

- [x] **Step 2: Inspect diff**

Run:

```bash
git diff --stat
```

Result: diff is scoped to remote template fallback, tests, and this design/plan documentation, plus pre-existing unrelated `src/chunking/*` edits in the working tree.
