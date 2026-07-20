# Make Client Template 0.1.14 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish Axhub Make Client Template 0.1.14 to the GitHub primary source and Gitee mirror, while updating the Make runtime's bundled default template reference.

**Architecture:** The independent template release reads `client/package.json`, packages only entries selected by `client/template-manifest.json`, and generates a versioned ZIP plus a latest manifest. The prepare command synchronizes the Make runtime constants from the client version and release notes; the same audited artifacts are uploaded to GitHub and Gitee.

**Tech Stack:** Node.js 22, pnpm 10, Vitest, Node test runner, GitHub CLI, Gitee release API.

## Global Constraints

- Publish only the Make client template; do not publish `@axhub/make` to npm.
- Use template version `0.1.14` and tag `make-client-template-v0.1.14`.
- Include `src/resources/templates/prd-comprehensive-template.md` and do not include project-specific `src/resources/prd/` content.
- Preserve unrelated staged, unstaged, and untracked workspace changes.
- Publish the identical ZIP and latest manifest produced by one prepare run to both sources.

---

### Task 1: Prepare release metadata

**Files:**
- Modify: `client/package.json`
- Modify: `client/RELEASE_NOTES.md`
- Modify: `src/common/makeClientTemplate.ts`
- Modify: `scripts/release-make.test.mjs`

**Interfaces:**
- Consumes: client version and release notes read by `scripts/release-make.mjs`.
- Produces: template version `0.1.14` and matching Make default constants.

- [ ] **Step 1: Update `client/package.json` to version `0.1.14`.**
- [ ] **Step 2: Replace the release notes heading with `# Axhub Make Client 0.1.14` and summarize the shipped rule, skill, and PRD-template changes.**
- [ ] **Step 3: Update the package-version assertion in `scripts/release-make.test.mjs` to `0.1.14`.**
- [ ] **Step 4: Run `pnpm release:make-client-template:prepare` so the script synchronizes `DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION` and release notes.**

### Task 2: Verify and audit artifacts

**Files:**
- Test: `scripts/release-make.test.mjs`
- Test: `client/tests/prd-template-profiles.test.ts`
- Inspect: `.release/make-client-template/manifest.json`
- Inspect: `.release/make-client-template/artifacts/axhub-make-client-template.zip`

**Interfaces:**
- Consumes: prepared versioned template metadata.
- Produces: one verified ZIP and one latest-manifest JSON for both release sources.

- [ ] **Step 1: Run `node --test scripts/release-make.test.mjs`.**
- [ ] **Step 2: Run `pnpm --dir client exec vitest run tests/prd-template-profiles.test.ts`.**
- [ ] **Step 3: Run `pnpm release:make-client-template:prepare` and `pnpm release:make-client-template -- --github-repo lintendo/Axhub-Make --dry-run`.**
- [ ] **Step 4: Inspect the ZIP for required rules, skills, PRD templates, sanitized metadata, and excluded project-specific content.**
- [ ] **Step 5: Record the ZIP SHA-256 from the release manifest and ensure the generated latest manifest references version `0.1.14` and both versioned source URLs.**

### Task 3: Publish primary and mirror releases

**Files:**
- Publish: `.release/make-client-template/artifacts/axhub-make-client-template.zip`
- Publish: `.release/make-client-template/artifacts/axhub-make-client-template.latest.json`

**Interfaces:**
- Consumes: the audited artifacts from Task 2.
- Produces: downloadable GitHub and Gitee release assets for template version `0.1.14`.

- [ ] **Step 1: Create a release source commit and tag that contain the template payload, release metadata, and Make default reference without committing unrelated worktree changes.**
- [ ] **Step 2: Publish GitHub release `make-client-template-v0.1.14` with explicit confirmation.**
- [ ] **Step 3: Verify the GitHub release assets and compare the downloaded ZIP SHA-256 with the local manifest.**
- [ ] **Step 4: Publish the same artifacts with `pnpm release:make:mirror:gitee -- --confirm-publish`.**
- [ ] **Step 5: Verify both Gitee versioned ZIP and latest-manifest URLs, including version and SHA-256 fields.**
