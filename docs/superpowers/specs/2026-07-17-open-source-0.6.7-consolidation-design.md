# Axhub Make 0.6.7 Open-Source Consolidation Design

## Goal

Prepare the standalone Axhub Make repository for an open-source 0.6.7 release, consolidate the complete release-ready functionality onto the latest local `main`, and leave `origin/main` unchanged until the user explicitly approves a push.

## Scope

This work applies only to the repository rooted at `apps/axhub-make`. The Axhub Runtime parent repository and the `apps/skills` repository are out of scope.

The current worktree already produces an `@axhub/make` package with version `0.6.7`; that source state is the release candidate. The integration base is the current `origin/main` commit `0004b82`. The current feature branch is ahead of and behind `main`, and its working tree contains both release functionality and development residue.

## Consolidation Strategy

Use release-state consolidation instead of merging the feature branch history directly:

1. Preserve the current worktree and use its 0.6.7 source state as the functional source.
2. Classify tracked and untracked content before changing it.
3. Quarantine uncertain local-only content under ignored `.local/` storage instead of permanently deleting it.
4. Create a clean integration worktree and branch from the latest local `main`.
5. Squash the curated 0.6.7 source state onto the integration branch.
6. Resolve conflicts in favor of the complete 0.6.7 behavior while retaining independent release and standalone-repository fixes already present on `main`.
7. Verify the integrated result before fast-forwarding local `main`.

The 45 development commits on the feature branch will not become ancestors of public `main`. Only the reviewed final state and release-facing commit history will be reachable from `main`.

## Content Policy

Keep:

- Runtime and server source required by Axhub Make 0.6.7.
- Official tests that provide durable regression coverage.
- Release, build, and packaging scripts required to reproduce 0.6.7.
- Committed `vendor/` artifacts required by standalone builds.
- Product documentation and public usage documentation.
- Client template content explicitly selected by `client/template-manifest.json`.
- Under `client/.axhub/make/`, only `client.json`, `axhub.config.json`, `README.md`, and the template seed `sidebar-tree.json`.
- Product-owned client skills under `.agents/` and `.claude/` when they are part of the generated client experience.

Exclude from the public release state:

- Dependency directories, caches, build outputs, release outputs, test outputs, and local worktrees.
- `midscene_run/`, automation reports, screenshots generated solely for ad hoc verification, and tool caches.
- Runtime-generated project metadata, sessions, edit history, exports, reports, and machine-specific configuration.
- Development-only `docs/superpowers` specifications and plans, including this design after it has served its review purpose.
- Ad hoc prototypes, unnamed resources, temporary folders, and test assets not selected by the client template manifest or a formal regression test.
- Files containing credentials, personal identifiers, machine-specific absolute paths, or private service configuration.

Generated 0.6.7 packages and executables are verification evidence, not source files to commit.

## Privacy And Secret Safety

Audit three surfaces independently:

1. The final tracked source tree.
2. The generated npm package, client template archive, and executable release contents where inspection is supported.
3. The Git history reachable from the proposed local `main`.

Search for private keys, access tokens, common credential assignments, personal home-directory paths on macOS/Linux/Windows, local volume paths, and known local usernames. Replace machine paths with temporary-directory fixtures, repository-relative paths, or neutral placeholders.

Test fixtures that intentionally resemble secrets must use unmistakably fake values. Any true credential or private data found in reachable history blocks the merge. Credential rotation or history rewriting requires separate user approval and is not part of this consolidation by default.

## Integration Boundaries

All curation happens away from `main`. The existing dirty worktree remains the source worktree, and a separate ignored worktree holds the integration branch. Files of uncertain value are preserved locally in quarantine.

The final local `main` update must be a fast-forward from the verified integration branch. No force operation, remote push, tag creation, GitHub release, npm publication, or credential rotation is authorized by this design.

## Failure Handling

- Do not merge while any required verification command fails.
- Resolve source conflicts by comparing behavior, tests, release scripts, and template-manifest intent rather than choosing a branch wholesale.
- Treat missing manifest-required template files as release blockers.
- Treat unexplained files in release archives as release blockers.
- Treat true secret findings or personal paths in the proposed public history as release blockers.
- Preserve uncertain local-only files in ignored quarantine and report them rather than deleting them irreversibly.

## Verification

The integrated branch must pass fresh checks appropriate to the standalone repository:

1. Lockfile-consistent pnpm installation.
2. Full Axhub Make test suite.
3. Server TypeScript build.
4. Client TypeScript check.
5. Production build.
6. Official 0.6.7 release preparation or dry-run path, including package-content assertions.
7. Source-tree and release-artifact privacy scans.
8. Proposed-`main` reachable-history secret and local-path scans.
9. `git diff --check` and a clean final worktree.

If a release command requires unavailable external credentials or mutates a remote service, use the strongest local prepare/test mode and report the omitted external step. No remote mutation is permitted.

## Completion Criteria

- Local `main` contains the reviewed 0.6.7 source and reports package version `0.6.7`.
- The 0.6.7 functional surface represented by the release candidate is present after integration.
- Development residue and local/private data are absent from the tracked tree and generated release contents.
- Required tests, type checks, builds, packaging checks, whitespace checks, and privacy scans pass.
- The local `main` worktree is clean.
- `origin/main` remains unchanged and local `main` is ready for an explicit later push request.
