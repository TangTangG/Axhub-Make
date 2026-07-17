# Axhub Make 0.6.7 Open-Source Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the release-ready Axhub Make 0.6.7 source state onto the latest local `main` without exposing development residue, machine paths, credentials, or private runtime data.

**Architecture:** Curate the existing 0.6.7 source worktree into a clean local source branch, then materialize that final tree as one release-state commit on an integration branch created from current `main`. Add a permanent tracked-tree audit using TDD, run the complete standalone release verification matrix, and fast-forward local `main` only after every gate passes.

**Tech Stack:** pnpm 10.20.0, Node.js ESM, TypeScript 5.x, React 18.2.0, Vitest, Git worktrees, Axhub Make release scripts.

## Global Constraints

- Work only in the standalone repository rooted at `apps/axhub-make`.
- Use pnpm for repository development, tests, and release scripts.
- Preserve committed `vendor/` artifacts required by standalone builds.
- Keep only `client.json`, `axhub.config.json`, `README.md`, and `sidebar-tree.json` under the published client `.axhub/make/` directory.
- Use the current worktree's `@axhub/make` version `0.6.7` as the release source and commit `0004b82` as the integration base.
- Do not push, publish, tag, force-update, rotate credentials, or rewrite history.
- Do not place `docs/superpowers`, generated release files, automation reports, Midscene output, caches, or machine-specific runtime state in final `main`.
- Preserve uncertain local-only content under ignored `.local/open-source-0.6.7-quarantine/`.
- Do not use subagents; repository instructions require inline execution.

---

### Task 1: Curate And Commit The 0.6.7 Source State

**Files:**
- Modify: `.gitignore`
- Preserve outside the final tree: `docs/superpowers/`
- Preserve in local quarantine: `midscene_run/`
- Preserve in local quarantine: `client/src/prototypes/home/`
- Preserve in local quarantine: `client/src/prototypes/untitled-84/`
- Preserve in local quarantine: `client/src/prototypes/beginner-guide/.spec/2026-07-11-ai-uncertainty-design.md`
- Preserve in local quarantine: `client/src/prototypes/beginner-guide/.spec/2026-07-11-ai-uncertainty-implementation.md`
- Preserve in local quarantine: `client/src/resources/new-folder/`
- Preserve in local quarantine: `client/src/resources/image.png`
- Preserve in local quarantine: `client/src/resources/untitled.excalidraw`
- Preserve in local quarantine: `client/src/resources/annotation-demo.assets/`
- Preserve in local quarantine: `client/src/resources/annotation-demo.excalidraw`
- Preserve in local quarantine: `client/src/resources/examples/html-review-demo.assets/.sessions/`
- Keep: `client/template-manifest.json`
- Keep: `client/template-seed/.axhub/make/README.md`
- Keep: `client/template-seed/.axhub/make/axhub.config.json`
- Keep: `client/template-seed/.axhub/make/client.json`
- Keep: `client/template-seed/.axhub/make/sidebar-tree.json`

**Interfaces:**
- Consumes: The current dirty worktree on `codex/commentary-agent-phase-4-5` and the approved content policy.
- Produces: Local branch `codex/axhub-make-0.6.7-open-source-source` whose final tree is the curated 0.6.7 source state.

- [ ] **Step 1: Create a dedicated source branch without discarding the current worktree**

```bash
git switch -c codex/axhub-make-0.6.7-open-source-source
git status --short --branch
```

Expected: the new branch is checked out and all existing tracked and untracked work remains present.

- [ ] **Step 2: Quarantine known local-only content while preserving its relative paths**

```bash
quarantine=.local/open-source-0.6.7-quarantine
for source_path in \
  midscene_run \
  client/src/prototypes/home \
  client/src/prototypes/untitled-84 \
  client/src/prototypes/beginner-guide/.spec/2026-07-11-ai-uncertainty-design.md \
  client/src/prototypes/beginner-guide/.spec/2026-07-11-ai-uncertainty-implementation.md \
  client/src/resources/new-folder \
  client/src/resources/image.png \
  client/src/resources/untitled.excalidraw \
  client/src/resources/annotation-demo.assets \
  client/src/resources/annotation-demo.excalidraw \
  client/src/resources/examples/html-review-demo.assets/.sessions
do
  if [ -e "$source_path" ]; then
    mkdir -p "$quarantine/$(dirname "$source_path")"
    mv "$source_path" "$quarantine/$source_path"
  fi
done
```

Expected: every listed path that existed is under `.local/open-source-0.6.7-quarantine/`; formal HTML review fixtures outside `.sessions/` remain in place.

- [ ] **Step 3: Extend ignore coverage for recurrent local outputs**

Add these exact rules to `.gitignore` if they are not already covered:

```gitignore
midscene_run/
**/.sessions/
```

- [ ] **Step 4: Quarantine development process documents outside the release tree**

```bash
mkdir -p "$quarantine/docs"
mv docs/superpowers "$quarantine/docs/superpowers"
```

Expected: all tracked and untracked designs and implementation plans remain available under ignored local quarantine while `docs/superpowers` is absent from the public source tree. The later `git add -A` stages tracked process documents for deletion.

- [ ] **Step 5: Confirm template inputs match the manifest boundary**

```bash
node -e "const fs=require('node:fs');const m=JSON.parse(fs.readFileSync('client/template-manifest.json','utf8'));if(m.schemaVersion!==1)process.exit(1);for(const f of m.makeMetadata.files){const p='client/template-seed/.axhub/make/'+f.path;if(!fs.existsSync(p)){console.error(p);process.exitCode=1}}"
pnpm exec vitest run client/tests/html-review-demo.test.ts client/tests/review-guidance.test.ts client/tests/beginner-guide-annotations.test.ts client/tests/beginner-guide-clipboard.test.ts
```

Expected: manifest validation exits 0 and all targeted client tests pass.

- [ ] **Step 6: Stage and inspect the curated source snapshot**

```bash
git add -A
git diff --cached --check
git diff --cached --stat
git status --short
```

Expected: no whitespace errors; no staged path contains `docs/superpowers`, `midscene_run`, `.sessions`, `untitled-84`, `src/prototypes/home`, or `src/resources/new-folder` as an added file.

- [ ] **Step 7: Commit the curated release source**

```bash
git commit -m "feat: consolidate Axhub Make 0.6.7 release source"
git status --short --branch
```

Expected: the source branch is clean except for ignored `.local/`, `.release/`, dependency, build, and automation output.

### Task 2: Create A Clean Integration Worktree From Main

**Files:**
- Create ignored worktree: `.local/worktrees/open-source-0.6.7/`
- No tracked file changes in this task.

**Interfaces:**
- Consumes: `main` at `0004b82` and source branch `codex/axhub-make-0.6.7-open-source-source`.
- Produces: Integration branch `codex/axhub-make-0.6.7-open-source` in an isolated worktree.

- [ ] **Step 1: Verify worktree placement is ignored**

```bash
git check-ignore -q .local/worktrees/open-source-0.6.7
```

Expected: exit 0 because `.local/` is ignored.

- [ ] **Step 2: Create the integration worktree from local main**

```bash
git worktree add .local/worktrees/open-source-0.6.7 -b codex/axhub-make-0.6.7-open-source main
```

Expected: the worktree is created on `codex/axhub-make-0.6.7-open-source` with `HEAD` at `0004b82`.

- [ ] **Step 3: Install the clean main baseline**

Run inside `.local/worktrees/open-source-0.6.7`:

```bash
pnpm install --frozen-lockfile
```

Expected: exit 0 without modifying tracked lockfiles.

- [ ] **Step 4: Verify the clean main baseline**

```bash
pnpm test
```

Expected: exit 0 with no failed test files. If baseline tests fail, record the exact failures and stop before applying the source state.

### Task 3: Materialize The Curated 0.6.7 Tree On The Integration Branch

**Files:**
- Replace tracked integration tree with the final tree from `codex/axhub-make-0.6.7-open-source-source`.

**Interfaces:**
- Consumes: The curated source branch tree.
- Produces: One release-state commit based directly on `main`, without making the 45 development commits ancestors of public `main`.

- [ ] **Step 1: Replace only the tracked integration tree with the curated source tree**

Run inside `.local/worktrees/open-source-0.6.7`:

```bash
git read-tree --reset -u codex/axhub-make-0.6.7-open-source-source
git status --short
```

Expected: the worktree shows the complete reviewed delta from `main`; ignored dependencies remain available.

- [ ] **Step 2: Assert release and standalone-main invariants before committing**

```bash
node -e "const fs=require('node:fs');const root=JSON.parse(fs.readFileSync('package.json','utf8'));const client=JSON.parse(fs.readFileSync('client/package.json','utf8'));if(root.version!=='0.6.7')throw new Error('root version');if(client.version!=='0.1.13')throw new Error('client version');if(client.packageManager!=='pnpm@10.20.0')throw new Error('client package manager')"
test -f assets/images/make-flow-create.png
test -f client/template-manifest.json
test ! -e docs/superpowers
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 3: Commit the release-state consolidation**

```bash
git add -A
git commit -m "feat: prepare Axhub Make 0.6.7"
```

Expected: one commit based on `main` contains the curated final release tree.

### Task 4: Add A Permanent Open-Source Audit Guard With TDD

**Files:**
- Create: `scripts/open-source-audit.test.mjs`
- Create: `scripts/open-source-audit.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Git tracked and non-ignored file paths, or an explicit directory tree supplied with `--directory`.
- Produces: `findForbiddenPathFindings(paths)`, `findSensitiveTextFindings(relativePath, content)`, `auditPaths(rootDir, paths, options)`, and CLI command `pnpm audit:open-source`.

- [ ] **Step 1: Write the failing audit tests**

Create `scripts/open-source-audit.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  findForbiddenPathFindings,
  findSensitiveTextFindings,
} from './open-source-audit.mjs';

describe('open-source audit', () => {
  it('rejects development output and disallowed Make metadata', () => {
    const findings = findForbiddenPathFindings([
      'docs/superpowers/plans/release.md',
      'midscene_run/report.html',
      'client/src/resources/example.assets/.sessions/run.json',
      'client/.axhub/make/sessions/private.json',
      'client/.axhub/make/client.json',
    ]);

    assert.deepEqual(
      findings.map((finding) => finding.path),
      [
        'docs/superpowers/plans/release.md',
        'midscene_run/report.html',
        'client/src/resources/example.assets/.sessions/run.json',
        'client/.axhub/make/sessions/private.json',
      ],
    );
  });

  it('detects machine paths, known local identity, and credential shapes', () => {
    const localPath = ['', 'Users', 'private-user', 'project'].join('/');
    const volumePath = ['', 'Volumes', 'PrivateDisk', 'project'].join('/');
    const githubToken = ['ghp', 'A'.repeat(36)].join('_');
    const knownIdentity = ['jian', 'zhoulin'].join('');
    const findings = findSensitiveTextFindings(
      'fixture.txt',
      [localPath, volumePath, githubToken, knownIdentity].join('\n'),
    );

    assert.deepEqual(
      new Set(findings.map((finding) => finding.rule)),
      new Set(['posix-home-path', 'mac-volume-path', 'github-token', 'known-local-identity']),
    );
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
node --test scripts/open-source-audit.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/open-source-audit.mjs`.

- [ ] **Step 3: Implement the minimal audit**

Create `scripts/open-source-audit.mjs`:

```js
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const allowedMakeMetadata = new Set([
  'client/.axhub/make/README.md',
  'client/.axhub/make/axhub.config.json',
  'client/.axhub/make/client.json',
  'client/.axhub/make/sidebar-tree.json',
]);

const forbiddenPathRules = [
  ['development-process-doc', /^docs\/superpowers(?:\/|$)/u],
  ['generated-report', /(?:^|\/)(?:automation-reports|midscene_run|test-results|coverage)(?:\/|$)/u],
  ['local-workspace', /(?:^|\/)(?:\.local|\.release|node_modules)(?:\/|$)/u],
  ['runtime-session', /(?:^|\/)\.sessions(?:\/|$)/u],
];

const sensitiveTextRules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/u],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/u],
  ['openai-token', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/u],
  ['posix-home-path', /\/(?:Users|home)\/[^/\s"'<>]+(?:\/|$)/u],
  ['mac-volume-path', /\/Volumes\/[^/\s"'<>]+(?:\/|$)/u],
  ['windows-home-path', /\b[A-Za-z]:\\Users\\[^\\\s"'<>]+(?:\\|$)/u],
  ['known-local-identity', new RegExp(['jian', 'zhoulin'].join(''), 'iu')],
];

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/').replace(/^\.\//u, '');
}

export function findForbiddenPathFindings(paths) {
  const findings = [];
  for (const rawPath of paths) {
    const filePath = normalizePath(rawPath);
    if (filePath.startsWith('client/.axhub/make/') && !allowedMakeMetadata.has(filePath)) {
      findings.push({ path: filePath, rule: 'disallowed-make-metadata' });
      continue;
    }
    const match = forbiddenPathRules.find(([, pattern]) => pattern.test(filePath));
    if (match) findings.push({ path: filePath, rule: match[0] });
  }
  return findings;
}

export function findSensitiveTextFindings(relativePath, content) {
  const findings = [];
  const lines = content.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    for (const [rule, pattern] of sensitiveTextRules) {
      if (pattern.test(lines[index])) {
        findings.push({ path: normalizePath(relativePath), line: index + 1, rule });
      }
    }
  }
  return findings;
}

function isText(buffer) {
  return !buffer.subarray(0, 8192).includes(0);
}

export function auditPaths(rootDir, paths, { checkForbiddenPaths = true } = {}) {
  const normalizedPaths = paths.map(normalizePath).sort();
  const findings = checkForbiddenPaths ? findForbiddenPathFindings(normalizedPaths) : [];
  for (const relativePath of normalizedPaths) {
    const absolutePath = path.join(rootDir, ...relativePath.split('/'));
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) continue;
    const content = fs.readFileSync(absolutePath);
    if (!isText(content)) continue;
    findings.push(...findSensitiveTextFindings(relativePath, content.toString('utf8')));
  }
  return findings;
}

function listGitFiles(repoRoot) {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: repoRoot },
  ).toString('utf8').split('\0').filter(Boolean);
}

function listDirectoryFiles(rootDir, currentDir = rootDir, relativeDir = '') {
  const files = [];
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) files.push(...listDirectoryFiles(rootDir, absolutePath, relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

export function runAudit({ repoRoot = process.cwd(), directory } = {}) {
  const rootDir = directory ? path.resolve(repoRoot, directory) : repoRoot;
  const paths = directory ? listDirectoryFiles(rootDir) : listGitFiles(repoRoot);
  return auditPaths(rootDir, paths, { checkForbiddenPaths: !directory });
}

function main() {
  const directoryIndex = process.argv.indexOf('--directory');
  const directory = directoryIndex >= 0 ? process.argv[directoryIndex + 1] : undefined;
  if (directoryIndex >= 0 && !directory) throw new Error('--directory requires a path');
  const findings = runAudit({ directory });
  if (findings.length > 0) {
    for (const finding of findings) {
      const location = finding.line ? `${finding.path}:${finding.line}` : finding.path;
      console.error(`${location} [${finding.rule}]`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(directory ? `Open-source audit passed: ${directory}` : 'Open-source audit passed: tracked tree');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

- [ ] **Step 4: Add the package command**

Add this exact script to the root `package.json` `scripts` object:

```json
"audit:open-source": "node scripts/open-source-audit.mjs"
```

- [ ] **Step 5: Run the audit unit test and verify GREEN**

```bash
node --test scripts/open-source-audit.test.mjs
```

Expected: 2 tests pass and 0 fail.

- [ ] **Step 6: Run the audit on the integration tree**

```bash
pnpm audit:open-source
```

Expected: exit 0 with `Open-source audit passed: tracked tree`. Fix each true finding using repository-relative paths, temporary directories, neutral placeholders, or clearly fake test credentials, and add a regression assertion before rerunning.

- [ ] **Step 7: Commit the permanent audit guard**

```bash
git add package.json scripts/open-source-audit.mjs scripts/open-source-audit.test.mjs
git diff --cached --check
git commit -m "chore: add open-source release audit"
```

Expected: the audit implementation and tests are committed separately from the release-state snapshot.

### Task 5: Verify Release Artifacts And Fast-Forward Local Main

**Files:**
- Generated only: `.release/make/`
- Generated only: `.local/release-audit/`
- No additional tracked files unless a failing check requires a tested correction.

**Interfaces:**
- Consumes: Verified integration branch.
- Produces: Clean local `main` at the verified 0.6.7 integration tip; `origin/main` remains at `0004b82`.

- [ ] **Step 1: Run the complete repository verification matrix**

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm server:build
pnpm client:typecheck
pnpm build
git diff --check
```

Expected: every command exits 0; no test files fail; no tracked file changes remain after commands that should be read-only.

- [ ] **Step 2: Prepare and locally test the 0.6.7 release**

```bash
pnpm release:make:prepare
pnpm release:make:test-local
```

Expected: both commands exit 0, `.release/make/npm-package/package.json` reports `0.6.7`, and package-content assertions pass without publishing or creating a remote release.

- [ ] **Step 3: Audit generated package and template contents**

```bash
rm -rf .local/release-audit
mkdir -p .local/release-audit/npm .local/release-audit/template
tar -xzf .release/make/axhub-make-0.6.7.tgz -C .local/release-audit/npm
unzip -q .release/make/axhub-make-client-template.zip -d .local/release-audit/template
node scripts/open-source-audit.mjs --directory .local/release-audit/npm
node scripts/open-source-audit.mjs --directory .local/release-audit/template
```

Expected: both directory audits pass without local paths, known identity, or credential shapes.

- [ ] **Step 4: Run a standard secret scanner against proposed main history**

```bash
rm -rf .local/tools/gitleaks-download .local/tools/gitleaks
mkdir -p .local/tools/gitleaks-download .local/tools/gitleaks
gh release download --repo gitleaks/gitleaks --pattern 'gitleaks_*_darwin_arm64.tar.gz' --dir .local/tools/gitleaks-download --clobber
tar -xzf .local/tools/gitleaks-download/gitleaks_*_darwin_arm64.tar.gz -C .local/tools/gitleaks
.local/tools/gitleaks/gitleaks git . --redact --no-banner --log-opts=codex/axhub-make-0.6.7-open-source
```

Expected: exit 0 with no leaks. Any true positive blocks the main update. Test-only false positives must be converted to unmistakably fake constructed values or narrowly allowlisted with a documented reason.

- [ ] **Step 5: Scan reachable history for personal machine identity and paths**

```bash
if git log --format= --patch codex/axhub-make-0.6.7-open-source \
  | rg -n 'jianzhoulin|/Users/jianzhoulin|/Volumes/WORK|[A-Za-z]:\\Users\\jianzhoulin'
then
  echo 'Personal machine identity or path found in proposed main history' >&2
  exit 1
fi
```

Expected: no matches. A match in reachable history blocks the main update and requires a separate history-rewrite decision.

- [ ] **Step 6: Verify integration state before updating main**

```bash
git status --short --branch
node -p "require('./package.json').version"
git rev-list --left-right --count main...HEAD
```

Expected: clean integration worktree, version `0.6.7`, and local integration branch ahead of `main` with no commits missing from `main`.

- [ ] **Step 7: Fast-forward local main from its existing clean worktree**

Run inside `.local/worktrees/clean-main-non-client`:

```bash
git status --short --branch
git merge --ff-only codex/axhub-make-0.6.7-open-source
```

Expected: local `main` fast-forwards without a merge commit.

- [ ] **Step 8: Re-run release-critical verification on merged main**

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm server:build
pnpm client:typecheck
pnpm build
pnpm audit:open-source
git diff --check
git status --short --branch
git rev-list --left-right --count origin/main...main
```

Expected: every check passes, the main worktree is clean, `main` is ahead of `origin/main`, and no push occurs.
