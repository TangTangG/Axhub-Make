# Axhub Make Read-Only Branch View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Admin UI's real Git branch switching with read-only branch queries that never change `HEAD` or the worktree.

**Architecture:** Keep the existing workspace status endpoint as the single read model. Its existing top-level fields remain tied to the real worktree and `HEAD`; a new `branchView` object contains the explicitly selected local branch, selected remote branch, commit history, and read-only comparison. The UI stores viewed branch names locally, reloads status with GET query parameters, and enables write actions only when the viewed branch pair exactly matches the real operation pair.

**Tech Stack:** TypeScript 5.x, React 18.2.0, Vite 5, Vitest 4, Node.js Git integration tests, pnpm workspace.

## Global Constraints

- Use `pnpm`; do not use npm or yarn for repository development commands.
- A branch-view request must not execute `git switch`, `checkout`, `merge`, `rebase`, `reset`, `stash`, `branch -f`, or any other command that changes `HEAD`, the index, worktree files, or local branch refs.
- Execute Git through the existing `execGit`/command-executor path with argument arrays; do not construct shell command strings.
- Keep `currentBranch`, top-level commit fields, worktree changes, commit actions, and operational remote comparison tied to the real `HEAD`.
- Put selected-branch data under `branchView`; do not make existing fields change meaning based on query parameters.
- Do not retain a compatibility endpoint for `POST /api/git/workspace/branch`.
- Preserve React at 18.2.0 and do not add dependencies.
- Preserve all pre-existing user changes. In particular, `src/index/services/api.ts` and `src/index/services/api.test.ts` already contain unrelated export-image work; stage only branch-view hunks from those files.
- Run all commands from `/Volumes/WORK/rd/Axhub Runtime/apps/axhub-make` unless a step says otherwise.

---

### Task 1: Add the server-side read-only branch view contract

**Files:**
- Modify: `src/server/__tests__/projects-git-api.test.ts`
- Modify: `src/server/managementApi.git.ts`

**Interfaces:**
- Consumes: existing `getWorkspaceVersionCommit(projectRoot, ref, executor)`, `getWorkspaceVersionCommitList(projectRoot, range, executor, scopePath, maxCount)`, `getWorkspaceBranchOverview(projectRoot, executor)`, and `getWorkspaceRemoteComparison(...)` behavior.
- Produces: `GET /api/git/workspace/status?branch=<local>&remoteBranch=<remote>` with `branchView`; top-level status remains worktree-based; `POST /api/git/workspace/branch` is removed.

- [ ] **Step 1: Replace the branch-switch integration test with failing read-only branch-view coverage**

In `src/server/__tests__/projects-git-api.test.ts`, replace `switches existing workspace branches without exposing merge operations` with a test that creates a real `feature` branch, returns to the original branch, dirties the worktree, and then queries `feature`:

```ts
it('reads another branch without switching HEAD or rejecting a dirty worktree', async () => {
  const projectRoot = createTempRoot('axhub-workspace-git-branch-view-');
  writeProjectMetadata(projectRoot, {
    project: { id: 'workspace-branch-view', name: 'Workspace Branch View' },
  });
  fs.writeFileSync(path.join(projectRoot, 'README.md'), '# Main\n', 'utf8');
  await initGitRepo(projectRoot);

  const { execFile } = await import('node:child_process');
  const runGit = (args: string[]) => new Promise<string>((resolve, reject) => {
    execFile('git', args, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr || stdout || error.message)));
        return;
      }
      resolve(String(stdout).trim());
    });
  });

  const workspaceBranch = await runGit(['branch', '--show-current']);
  await runGit(['switch', '-c', 'feature']);
  fs.writeFileSync(path.join(projectRoot, 'README.md'), '# Feature\n', 'utf8');
  await commitAll(projectRoot, 'feature version');
  const featureHead = await runGit(['rev-parse', 'HEAD']);
  await runGit(['switch', workspaceBranch]);
  fs.writeFileSync(path.join(projectRoot, 'scratch.txt'), 'dirty\n', 'utf8');

  const server = await startTestServer(projectRoot);
  try {
    await registerProject(server.origin, projectRoot, 'workspace-branch-view', 'Workspace Branch View');

    const status = await fetch(`${server.origin}/api/git/workspace/status?branch=feature`)
      .then(async (response) => ({ status: response.status, body: await response.json() }));

    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      currentBranch: workspaceBranch,
      hasChanges: true,
      branchView: {
        branch: 'feature',
        commit: { hash: featureHead, message: 'feature version' },
        recentCommits: [expect.objectContaining({ hash: featureHead })],
      },
    });
    expect(await runGit(['branch', '--show-current'])).toBe(workspaceBranch);
    expect(await runGit(['status', '--porcelain'])).toContain('scratch.txt');

    const removedSwitchRoute = await fetch(`${server.origin}/api/git/workspace/branch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch: 'feature' }),
    });
    expect(removedSwitchRoute.status).toBe(404);
  } finally {
    await server.close();
  }
}, GIT_INTEGRATION_TIMEOUT_MS);
```

In the existing workspace status test around the old `branch-management` prompt request, delete the prompt request and its assertions. Add a separate failing invalid-branch assertion:

```ts
const missingBranch = await fetch(`${server.origin}/api/git/workspace/status?branch=missing`)
  .then(async (response) => ({ status: response.status, body: await response.json() }));
expect(missingBranch).toMatchObject({
  status: 404,
  body: { code: 'BRANCH_NOT_FOUND' },
});
expect(missingBranch.body).not.toHaveProperty('prompt');
```

- [ ] **Step 2: Run the server test and verify the new contract fails**

Run:

```bash
pnpm exec vitest run src/server/__tests__/projects-git-api.test.ts
```

Expected: FAIL because `branchView` is absent, dirty status is not queried against `feature`, and the old POST route still switches branches.

- [ ] **Step 3: Add explicit-ref remote comparison support**

In `src/server/managementApi.git.ts`, change the helper to receive the local and remote refs explicitly. Keep existing top-level calls on `HEAD`, while branch-view calls pass the selected local branch:

```ts
async function getWorkspaceRemoteComparison(
  projectRoot: string,
  metadata: GitProjectContext['metadata'],
  remote: WorkspaceGitRemoteConfig,
  localRef: string,
  remoteBranch: string,
  executor?: GitWorkspaceCommandExecutor,
  scopePath?: string,
) {
  if (!remote.url) {
    return createUnavailableRemoteComparison('remote-not-configured');
  }
  if (!remoteBranch) {
    return createUnavailableRemoteComparison('remote-branch-missing');
  }

  const targetRef = `${DEFAULT_REMOTE_NAME}/${remoteBranch}`;
  try {
    await execGit(['rev-parse', '--verify', targetRef], projectRoot, executor);
  } catch {
    const outgoing = filterWorkspaceChangedFilesByScope(
      await getWorkspaceHeadFiles(projectRoot, executor, localRef),
      scopePath,
    );
    const localHead = await getWorkspaceVersionCommit(projectRoot, localRef, executor);
    const outgoingCommits = await getWorkspaceVersionCommitList(projectRoot, localRef, executor, scopePath);
    return {
      available: true,
      branch: remoteBranch,
      targetRef,
      reason: 'remote-branch-missing',
      localHead,
      remoteHead: null,
      aheadCount: outgoingCommits.length,
      behindCount: 0,
      incomingCommits: [],
      outgoingCommits,
      incoming: { totalFiles: 0, groups: [] },
      outgoing: createWorkspaceChangeSummary(metadata, outgoing),
    };
  }

  const incomingRange = `${localRef}..${targetRef}`;
  const outgoingRange = `${targetRef}..${localRef}`;
  try {
    const incoming = await execGit(['diff', '--name-status', incomingRange], projectRoot, executor);
    const outgoing = await execGit(['diff', '--name-status', outgoingRange], projectRoot, executor);
    const [localHead, remoteHead, incomingCommits, outgoingCommits] = await Promise.all([
      getWorkspaceVersionCommit(projectRoot, localRef, executor),
      getWorkspaceVersionCommit(projectRoot, targetRef, executor),
      getWorkspaceVersionCommitList(projectRoot, incomingRange, executor, scopePath),
      getWorkspaceVersionCommitList(projectRoot, outgoingRange, executor, scopePath),
    ]);

    return {
      available: true,
      branch: remoteBranch,
      targetRef,
      localHead,
      remoteHead,
      aheadCount: outgoingCommits.length,
      behindCount: incomingCommits.length,
      incomingCommits,
      outgoingCommits,
      incoming: createWorkspaceChangeSummary(
        metadata,
        filterWorkspaceChangedFilesByScope(parseGitNameStatus(incoming.stdout), scopePath),
      ),
      outgoing: createWorkspaceChangeSummary(
        metadata,
        filterWorkspaceChangedFilesByScope(parseGitNameStatus(outgoing.stdout), scopePath),
      ),
    };
  } catch (error: any) {
    return createUnavailableRemoteComparison(
      error?.message || 'remote-comparison-unavailable',
      remoteBranch,
    );
  }
}
```

Update `getWorkspaceHeadFiles` so its final argument is the supplied ref rather than hard-coded `HEAD`:

```ts
async function getWorkspaceHeadFiles(
  projectRoot: string,
  executor?: GitWorkspaceCommandExecutor,
  ref = 'HEAD',
): Promise<WorkspaceChangedFile[]> {
  const headFiles = await execGit(
    ['diff-tree', '--root', '--no-commit-id', '--name-status', '-r', ref],
    projectRoot,
    executor,
  );
  return parseGitNameStatus(headFiles.stdout);
}
```

Use a small constructor for unavailable comparisons so every response retains the required empty summaries:

```ts
function createUnavailableRemoteComparison(reason: string, branch = '') {
  return {
    available: false,
    ...(branch ? { branch, targetRef: `${DEFAULT_REMOTE_NAME}/${branch}` } : {}),
    reason,
    incoming: { totalFiles: 0, groups: [] },
    outgoing: { totalFiles: 0, groups: [] },
  };
}
```

- [ ] **Step 4: Build `branchView` in the GET status route and remove the write route**

In the status handler, read branch overview before resolving the view. Validate local branches by exact membership; normalize remote branches without ever passing an unknown remote ref to Git:

```ts
const currentBranch = await getWorkspaceCurrentBranch(projectRoot, executor);
const branchOverview = await getWorkspaceBranchOverview(projectRoot, executor);
const requestedBranch = requestedVersionRef
  ? ''
  : String(url.searchParams.get('branch') || '').trim();
const viewedBranch = requestedBranch || currentBranch;
if (requestedBranch && !branchOverview.localBranches.includes(viewedBranch)) {
  sendJson(res, {
    error: 'Branch does not exist',
    code: 'BRANCH_NOT_FOUND',
    projectId: context.project.id,
    branchOverview,
  }, { status: 404 });
  return;
}

const remoteBranchNames = branchOverview.remoteBranches
  .map((branch) => branch.replace(/^remotes\//u, ''))
  .filter((branch) => branch.startsWith(`${DEFAULT_REMOTE_NAME}/`))
  .map((branch) => branch.slice(`${DEFAULT_REMOTE_NAME}/`.length))
  .filter((branch) => branch && branch !== 'HEAD');
const requestedRemoteBranch = String(requestedVersionRef ? '' : url.searchParams.get('remoteBranch') || '')
  .trim()
  .replace(/^remotes\//u, '')
  .replace(/^origin\//u, '');
const viewedRemoteBranch = requestedRemoteBranch
  || (remoteBranchNames.includes(viewedBranch) ? viewedBranch : '');
```

Keep the existing top-level calculations on `HEAD`. For ordinary workspace queries, reuse top-level data when no explicit branch query is present; otherwise query explicit refs:

```ts
const operationRemoteBranch = remote.defaultBranch || currentBranch;
const remoteComparison = await getWorkspaceRemoteComparison(
  projectRoot,
  context.metadata,
  remote,
  'HEAD',
  operationRemoteBranch,
  executor,
  scopedGitPath,
);

let branchView;
if (!requestedVersionRef) {
  const hasExplicitLocalView = Boolean(requestedBranch || viewedBranch !== currentBranch);
  const hasExplicitRemoteView = Boolean(
    hasExplicitLocalView
    || requestedRemoteBranch
    || viewedRemoteBranch !== operationRemoteBranch,
  );
  const remoteBranchExists = Boolean(viewedRemoteBranch && remoteBranchNames.includes(viewedRemoteBranch));
  const viewedRemoteComparison = !remote.url
    ? createUnavailableRemoteComparison('remote-not-configured')
    : !viewedRemoteBranch || !remoteBranchExists
      ? createUnavailableRemoteComparison('remote-branch-missing', viewedRemoteBranch)
      : hasExplicitRemoteView
      ? await getWorkspaceRemoteComparison(
          projectRoot,
          context.metadata,
          remote,
          viewedBranch,
          viewedRemoteBranch,
          executor,
          scopedGitPath,
        )
      : remoteComparison;
  branchView = {
    branch: viewedBranch,
    ...(viewedRemoteBranch ? { remoteBranch: viewedRemoteBranch } : {}),
    commit: hasExplicitLocalView
      ? await getWorkspaceVersionCommit(projectRoot, viewedBranch, executor)
      : currentCommit,
    recentCommits: hasExplicitLocalView
      ? await getWorkspaceVersionCommitList(projectRoot, viewedBranch, executor, scopedGitPath, 20)
      : recentCommits,
    remoteComparison: viewedRemoteComparison,
  };
}
```

Add `branchView` to the response only when it exists. Delete the complete `POST /api/git/workspace/branch` handler. Remove `'branch-management'` from `GitWorkspacePromptScene`, the prompt builder branch, and the prompt endpoint's allowed scenes. Change the prompt endpoint's invalid-or-missing fallback from `'branch-management'` to `'merge-required'`:

```ts
const scene = String((body as any)?.scene || 'merge-required') as GitWorkspacePromptScene;
const allowedScenes: GitWorkspacePromptScene[] = [
  'create-remote',
  'auth-failed',
  'merge-required',
  'conflict-required',
  'push-rejected',
];
const promptScene = allowedScenes.includes(scene) ? scene : 'merge-required';
```

In the existing historical-version test, include a branch that does not exist and prove historical queries ignore branch-view parameters instead of validating them:

```ts
const historicalStatus = await fetch(
  `${server.origin}/api/git/workspace/status?gitVersion=${currentStatus.body.currentCommit.shortHash}&branch=missing`,
).then(async (response) => ({ status: response.status, body: await response.json() }));
expect(historicalStatus.status).toBe(200);
expect(historicalStatus.body.isHistoricalVersion).toBe(true);
expect(historicalStatus.body).not.toHaveProperty('branchView');
```

- [ ] **Step 5: Add a command-executor regression for explicit refs and forbidden commands**

Add this test beside the other remote-comparison tests. Test setup may switch branches before the server starts; every command executed through the server's recorded executor must remain read-only:

```ts
it('uses explicit refs for branch views and never executes branch mutations', async () => {
  const projectRoot = createTempRoot('axhub-workspace-git-explicit-branch-view-');
  writeProjectMetadata(projectRoot, {
    project: { id: 'workspace-explicit-branch-view', name: 'Workspace Explicit Branch View' },
  });
  fs.writeFileSync(path.join(projectRoot, 'README.md'), '# Main\n', 'utf8');
  await initGitRepo(projectRoot);

  const { execFile } = await import('node:child_process');
  const run = (command: string, args: string[], cwd: string) => new Promise<{ stdout: string; stderr: string }>(
    (resolve, reject) => {
      execFile(command, args, { cwd }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      });
    },
  );
  const runGit = async (args: string[]) => (await run('git', args, projectRoot)).stdout.trim();

  const workspaceBranch = await runGit(['branch', '--show-current']);
  const workspaceHead = await runGit(['rev-parse', 'HEAD']);
  await runGit(['switch', '-c', 'feature']);
  fs.writeFileSync(path.join(projectRoot, 'README.md'), '# Feature\n', 'utf8');
  await commitAll(projectRoot, 'feature version');
  const featureHead = await runGit(['rev-parse', 'HEAD']);
  await runGit(['switch', workspaceBranch]);
  await runGit(['update-ref', `refs/remotes/origin/${workspaceBranch}`, workspaceHead]);
  await runGit(['update-ref', 'refs/remotes/origin/feature', featureHead]);
  fs.writeFileSync(path.join(projectRoot, 'scratch.txt'), 'dirty\n', 'utf8');
  fs.mkdirSync(path.join(projectRoot, '.axhub', 'make'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'), JSON.stringify({
    versionCollaboration: {
      remote: {
        url: 'https://example.com/team/branch-view.git',
        defaultBranch: workspaceBranch,
      },
    },
  }), 'utf8');

  const commandExecutor = vi.fn((command: string, args: string[], options: { cwd: string }) => (
    run(command, args, options.cwd)
  ));
  const server = await startTestServer(
    projectRoot,
    createTempRoot('axhub-workspace-git-explicit-branch-view-home-'),
    { gitWorkspaceCommandExecutor: commandExecutor },
  );

  try {
    await registerProject(
      server.origin,
      projectRoot,
      'workspace-explicit-branch-view',
      'Workspace Explicit Branch View',
    );
    const status = await fetch(
      `${server.origin}/api/git/workspace/status?branch=feature&remoteBranch=feature`,
    ).then(async (response) => ({ status: response.status, body: await response.json() }));

    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      currentBranch: workspaceBranch,
      hasChanges: true,
      branchView: {
        branch: 'feature',
        remoteBranch: 'feature',
        commit: { hash: featureHead },
      },
    });
    expect(commandExecutor).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-status', 'feature..origin/feature'],
      { cwd: projectRoot },
    );
    expect(commandExecutor).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-status', 'origin/feature..feature'],
      { cwd: projectRoot },
    );

    const forbidden = new Set(['switch', 'checkout', 'merge', 'rebase', 'reset', 'stash']);
    for (const [, args] of commandExecutor.mock.calls) {
      expect(forbidden.has(args[0])).toBe(false);
      expect(args.slice(0, 2)).not.toEqual(['branch', '-f']);
    }

    commandExecutor.mockClear();
    const missingRemote = await fetch(
      `${server.origin}/api/git/workspace/status?branch=feature&remoteBranch=missing`,
    ).then(async (response) => ({ status: response.status, body: await response.json() }));
    expect(missingRemote.status).toBe(200);
    expect(missingRemote.body.branchView.remoteComparison).toMatchObject({
      available: false,
      reason: 'remote-branch-missing',
    });
    expect(commandExecutor.mock.calls.some(([, args]) => args.some((arg) => arg.includes('origin/missing')))).toBe(false);
  } finally {
    await server.close();
  }
}, GIT_INTEGRATION_TIMEOUT_MS);
```

- [ ] **Step 6: Run the server regression suite**

Run:

```bash
pnpm exec vitest run src/server/__tests__/projects-git-api.test.ts
```

Expected: PASS with all tests in `projects-git-api.test.ts` green.

- [ ] **Step 7: Commit the server contract**

```bash
git add src/server/managementApi.git.ts src/server/__tests__/projects-git-api.test.ts
git diff --cached --check
git commit -m "fix: make branch selection read only"
```

Expected: the commit contains only the server route/helper changes and their regression tests.

---

### Task 2: Update the Admin API client contract

**Files:**
- Modify: `src/index/services/api.test.ts`
- Modify: `src/index/services/api.ts`

**Interfaces:**
- Consumes: server `branchView` shape from Task 1.
- Produces: `GitWorkspaceRemoteComparison`, `GitWorkspaceBranchView`, and `getGitWorkspaceStatus({ gitVersion?, path?, branch?, remoteBranch? })`; removes `switchGitWorkspaceBranch` and `'branch-management'`.

- [ ] **Step 1: Write failing API-client assertions**

Update the existing workspace Git API test to call:

```ts
await apiService.getGitWorkspaceStatus({
  gitVersion: 'abc1234',
  path: 'prototypes/home',
  branch: 'feature/ui',
  remoteBranch: 'feature/ui',
});
```

Change its expected first URL to:

```ts
'/api/git/workspace/status?gitVersion=abc1234&path=prototypes%2Fhome&branch=feature%2Fui&remoteBranch=feature%2Fui&projectId=client-b'
```

Remove the `switchGitWorkspaceBranch('feature')` and `getGitWorkspacePrompt({ scene: 'branch-management' })` calls and remove their POST URLs from the expected call list. Add source assertions:

```ts
const apiSource = readFileSync(resolve(__dirname, './api.ts'), 'utf8');
expect(apiSource).toContain('branch?: string;');
expect(apiSource).toContain('remoteBranch?: string;');
expect(apiSource).toContain('branchView?: GitWorkspaceBranchView;');
expect(apiSource).not.toContain('switchGitWorkspaceBranch');
expect(apiSource).not.toContain("| 'branch-management'");
```

- [ ] **Step 2: Run the client tests and verify they fail**

Run:

```bash
pnpm exec vitest run src/index/services/api.test.ts
```

Expected: FAIL because the GET options and `branchView` types do not exist and the old switch method remains.

- [ ] **Step 3: Define reusable comparison and branch-view types**

In `src/index/services/api.ts`, extract the current inline comparison shape and add the branch-view type:

```ts
export interface GitWorkspaceRemoteComparison {
    available: boolean;
    branch?: string;
    targetRef?: string;
    reason?: string;
    localHead?: GitWorkspaceCommitSummary | null;
    remoteHead?: GitWorkspaceCommitSummary | null;
    aheadCount?: number;
    behindCount?: number;
    incomingCommits?: GitWorkspaceCommitSummary[];
    outgoingCommits?: GitWorkspaceCommitSummary[];
    incoming: {
        totalFiles: number;
        groups: GitWorkspaceChangeGroup[];
    };
    outgoing: {
        totalFiles: number;
        groups: GitWorkspaceChangeGroup[];
    };
}

export interface GitWorkspaceBranchView {
    branch: string;
    remoteBranch?: string;
    commit: GitWorkspaceCommitSummary | null;
    recentCommits: GitWorkspaceCommitSummary[];
    remoteComparison: GitWorkspaceRemoteComparison;
}
```

Change `GitWorkspaceStatusResponse.remoteComparison` to `GitWorkspaceRemoteComparison`, add `branchView?: GitWorkspaceBranchView`, and remove `'branch-management'` from `GitWorkspacePromptScene`.

- [ ] **Step 4: Add query options and remove the write client**

Change the method signature and query construction:

```ts
async getGitWorkspaceStatus(options: {
    gitVersion?: string;
    path?: string;
    branch?: string;
    remoteBranch?: string;
} = {}): Promise<GitWorkspaceStatusResponse> {
    const query = new URLSearchParams();
    if (options.gitVersion) query.set('gitVersion', options.gitVersion);
    if (options.path) query.set('path', options.path);
    if (options.branch) query.set('branch', options.branch);
    if (options.remoteBranch) query.set('remoteBranch', options.remoteBranch);
    const path = query.toString()
        ? `/api/git/workspace/status?${query.toString()}`
        : '/api/git/workspace/status';
    const response = await fetch(buildCurrentProjectScopedUrl(path), { cache: 'no-store' });
    return readApiJsonResponse<GitWorkspaceStatusResponse>(response, '加载版本状态失败');
},
```

Delete `switchGitWorkspaceBranch`. Keep `setGitWorkspaceRemote` for connecting a URL and preserving the existing operational remote target; the branch-view selectors will no longer call it.

- [ ] **Step 5: Run the API-client tests**

Run:

```bash
pnpm exec vitest run src/index/services/api.test.ts
```

Expected: PASS with `api.test.ts` green.

- [ ] **Step 6: Stage only this task's hunks and commit**

Because both API files contain pre-existing unrelated export-image changes, inspect and interactively stage only the branch-view hunks:

```bash
git diff -- src/index/services/api.ts src/index/services/api.test.ts
git add -p src/index/services/api.ts src/index/services/api.test.ts
git diff --cached -- src/index/services/api.ts src/index/services/api.test.ts
git diff --cached --check
git commit -m "refactor: expose read-only branch views"
```

Expected: the staged diff contains branch-view types, query parameters, removed switch calls, and matching tests; it does not contain `fetchExportIndexBundle` or `includeImageAssets` changes.

---

### Task 3: Rewire the version panel to query branch views

**Files:**
- Modify: `src/index/components/VersionCollaborationPanel.source.test.ts`
- Modify: `src/index/components/VersionCollaborationPanel.tsx`
- Modify: `src/index/components/SettingsDialog.source.test.ts`

**Interfaces:**
- Consumes: `GitWorkspaceStatusResponse.branchView`, `getGitWorkspaceStatus({ branch, remoteBranch })`, existing top-level worktree fields, and `remote.defaultBranch` as the operational remote target.
- Produces: local-only `viewedBranch`/`viewedRemoteBranch` state, query-only selectors, and `canWriteViewedPair` for sync/push gating.

- [ ] **Step 1: Add failing source-contract tests for read-only selectors**

In `VersionCollaborationPanel.source.test.ts`, add a focused test:

```ts
it('treats branch selectors as read-only status views', () => {
  const panelSource = readPanelSource();

  expect(panelSource).toContain("const [viewedBranch, setViewedBranch] = useState('');");
  expect(panelSource).toContain("const [viewedRemoteBranch, setViewedRemoteBranch] = useState('');");
  expect(panelSource).toContain('branch: requestedBranch');
  expect(panelSource).toContain('remoteBranch: requestedRemoteBranch');
  expect(panelSource).toContain('<InfoRow label="工作区分支">');
  expect(panelSource).toContain('<InfoRow label="查看分支">');
  expect(panelSource).toContain('const branchView = status?.branchView;');
  expect(panelSource).toContain('branchView?.recentCommits');
  expect(panelSource).toContain('branchView?.remoteComparison');
  expect(panelSource).toContain('const canWriteViewedPair =');
  expect(panelSource).not.toContain('handleSwitchBranch');
  expect(panelSource).not.toContain('switchGitWorkspaceBranch');
  expect(panelSource).not.toContain("() => apiService.setGitWorkspaceRemote({ url, defaultBranch: branch })");
  expect(panelSource).toContain("getActionErrorCode(error) === 'BRANCH_NOT_FOUND'");
  expect(panelSource).toContain('查看的分支已不存在，已返回工作区分支');
});
```

Update existing source assertions so they expect “工作区分支”, “查看分支”, and “分支最新”, and no longer expect “切换分支失败”. Add assertions that both sync and push `disabled` expressions include `!canWriteViewedPair`.

In `SettingsDialog.source.test.ts`, replace the old positive expectations with:

```ts
expect(panelSource).not.toContain('apiService.switchGitWorkspaceBranch');
expect(panelSource).not.toContain('handleSwitchBranch');
expect(apiSource).toContain('branch?: string;');
expect(apiSource).toContain('remoteBranch?: string;');
expect(apiSource).not.toContain('async switchGitWorkspaceBranch(branch: string)');
```

- [ ] **Step 2: Run the panel tests and verify they fail**

Run:

```bash
pnpm exec vitest run src/index/components/VersionCollaborationPanel.source.test.ts src/index/components/SettingsDialog.source.test.ts
```

Expected: FAIL because selectors still execute POST operations and the panel still reads top-level history/comparison fields.

- [ ] **Step 3: Add viewed-branch state and branch-aware status loading**

In `VersionCollaborationPanel.tsx`, add state and error-code extraction:

```ts
function getActionErrorCode(error: unknown): string {
    if (!error || typeof error !== 'object') return '';
    const code = (error as Record<string, unknown>).code;
    return typeof code === 'string' ? code : '';
}

const [viewedBranch, setViewedBranch] = useState('');
const [viewedRemoteBranch, setViewedRemoteBranch] = useState('');
```

Expand `loadStatus` so every selection remains a GET query and a disappearing branch falls back once:

```ts
interface LoadStatusOptions {
    silent?: boolean;
    branch?: string;
    remoteBranch?: string;
    allowBranchFallback?: boolean;
}

const loadStatus = async (options: LoadStatusOptions = {}): Promise<void> => {
    setBusyAction('load');
    setErrorMessage('');
    const requestedBranch = options.branch ?? viewedBranch;
    const requestedRemoteBranch = options.remoteBranch ?? viewedRemoteBranch;
    try {
        const nextStatus = await apiService.getGitWorkspaceStatus({
            gitVersion: historicalVersion,
            branch: historicalVersion ? undefined : requestedBranch || undefined,
            remoteBranch: historicalVersion ? undefined : requestedRemoteBranch || undefined,
        });
        setStatus(nextStatus);
        setRemoteUrl(nextStatus.remote?.url || '');
        setViewedBranch(nextStatus.branchView?.branch || nextStatus.currentBranch || '');
        setViewedRemoteBranch(nextStatus.branchView?.remoteBranch || '');
    } catch (error) {
        if (
            getActionErrorCode(error) === 'BRANCH_NOT_FOUND'
            && requestedBranch
            && options.allowBranchFallback !== false
        ) {
            const fallbackBranch = status?.currentBranch || '';
            setViewedBranch(fallbackBranch);
            setViewedRemoteBranch('');
            toast.warning('查看的分支已不存在，已返回工作区分支');
            await loadStatus({
                silent: true,
                branch: fallbackBranch,
                remoteBranch: '',
                allowBranchFallback: false,
            });
            return;
        }
        const message = getActionErrorMessage(error, '加载版本状态失败');
        setErrorMessage(message);
        if (!options.silent) toast.error(message);
    } finally {
        setBusyAction(null);
    }
};
```

The initial effect remains `loadStatus({ silent: true })`. The fallback does not run for historical-version requests because those requests omit branch query parameters.

- [ ] **Step 4: Replace selector handlers with GET reloads**

Replace `handleSwitchBranch`:

```ts
const handleSelectViewedBranch = (nextBranch: string) => {
    const branch = nextBranch.trim();
    if (!branch || branch === viewedBranch) return;
    setViewedBranch(branch);
    setViewedRemoteBranch('');
    void loadStatus({ branch, remoteBranch: '' });
};
```

Replace `handleSelectOnlineBranch` so it no longer persists `defaultBranch`:

```ts
const handleSelectOnlineBranch = (nextBranch: string) => {
    const branch = normalizeRemoteBranchName(nextBranch);
    if (!branch || branch === viewedRemoteBranch) return;
    setViewedRemoteBranch(branch);
    void loadStatus({ branch: viewedBranch, remoteBranch: branch });
};
```

Set the local selector's value to `viewedBranch` and its `onValueChange` to `handleSelectViewedBranch`. Set the online selector's value to `viewedRemoteBranch` and keep its handler as the new query-only `handleSelectOnlineBranch`.

```tsx
<Select
    value={viewedBranch}
    onValueChange={handleSelectViewedBranch}
    disabled={isBusy || !isRepositoryReady || localBranchOptions.length === 0}
>
```

```tsx
<Select
    value={viewedRemoteBranch}
    onValueChange={handleSelectOnlineBranch}
    disabled={isBusy || !hasConfiguredRemote || remoteBranchOptions.length === 0}
>
```

- [ ] **Step 5: Separate view data from real worktree data**

Derive branch-view display data with safe fallback for non-updated responses:

```ts
const branchView = status?.branchView;
const viewedRemoteComparison = branchView?.remoteComparison || status?.remoteComparison;
const recentCommits = branchView?.recentCommits || status?.recentCommits || [];
const incomingAllCommits = viewedRemoteComparison?.incomingCommits || [];
const outgoingAllCommits = viewedRemoteComparison?.outgoingCommits || [];
const incomingChangeItems = useMemo(
    () => flattenChangeGroups(viewedRemoteComparison?.incoming.groups || []),
    [viewedRemoteComparison],
);
const outgoingChangeItems = useMemo(
    () => flattenChangeGroups(viewedRemoteComparison?.outgoing.groups || []),
    [viewedRemoteComparison],
);
const onlineBranchValue = viewedRemoteBranch;
const incomingTotal = viewedRemoteComparison?.incoming.totalFiles || 0;
const outgoingTotal = viewedRemoteComparison?.outgoing.totalFiles || 0;
const behindCount = viewedRemoteComparison?.behindCount || incomingAllCommits.length;
const aheadCount = viewedRemoteComparison?.aheadCount || outgoingAllCommits.length;
```

Update `normalizeRemoteBranches` so it ignores remotes other than `origin`, while `normalizeRemoteBranchName` continues accepting the already-normalized values emitted by the dropdown:

```ts
function normalizeRemoteBranches(branches: string[] | undefined): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const branch of branches || []) {
        const qualified = String(branch || '').trim().replace(/^remotes\//u, '');
        if (!qualified.startsWith('origin/')) continue;
        const normalized = normalizeRemoteBranchName(qualified);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
}
```

Build online branch options only from `branchOverview.remoteBranches`; do not inject `remote.defaultBranch` when it is absent from the fetched `origin/*` refs:

```ts
const remoteBranchOptions = useMemo(
    () => normalizeRemoteBranches(status?.branchOverview?.remoteBranches),
    [status?.branchOverview?.remoteBranches],
);
```

Keep `changeItems`, `hasChanges`, commit-message generation, and `handleCommit` on the top-level `status`. Render the local info rows as:

```tsx
<InfoRow label="工作区分支">
    <InfoValue>{status?.currentBranch || '未检测'}</InfoValue>
</InfoRow>
<InfoRow label="查看分支">
    {renderBranchSelect()}
</InfoRow>
```

Change the latest-history badge text from `当前版本` to `分支最新`.

- [ ] **Step 6: Gate write actions on the real operation pair**

Derive the operation target and equality gate:

```ts
const operationRemoteBranch = status?.remote?.defaultBranch || status?.currentBranch || '';
const canWriteViewedPair = Boolean(
    status?.currentBranch
    && branchView?.branch === status.currentBranch
    && branchView.remoteBranch === operationRemoteBranch,
);
```

Read descriptions and counts from `viewedRemoteComparison`:

```tsx
description={`从线上 ${viewedRemoteComparison?.branch || onlineBranchValue || '当前'} 同步到本地，涉及 ${incomingTotal} 个文件。`}
```

```tsx
description={`推送到线上 ${viewedRemoteComparison?.branch || onlineBranchValue || '当前'}，涉及 ${outgoingTotal} 个文件。`}
```

Add `!canWriteViewedPair` to both sync and push button `disabled` expressions. Wrap each write button in the existing tooltip primitives so a disabled button still exposes its reason through a non-disabled trigger element:

```tsx
<TooltipProvider>
    <Tooltip>
        <TooltipTrigger asChild>
            <span className="inline-flex">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2"
                    onClick={handleSyncDown}
                    disabled={isBusy || !isRepositoryReady || !hasConfiguredRemote || !canWriteViewedPair}
                >
                    {busyAction === 'sync-down'
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Download className="h-3.5 w-3.5" />}
                    同步下来
                </Button>
            </span>
        </TooltipTrigger>
        {!canWriteViewedPair ? (
            <TooltipContent side="top">
                当前只是在查看其他分支，写操作仅支持工作区分支和已配置的线上分支
            </TooltipContent>
        ) : null}
    </Tooltip>
</TooltipProvider>
```

Use the complete corresponding wrapper for push:

```tsx
<TooltipProvider>
    <Tooltip>
        <TooltipTrigger asChild>
            <span className="inline-flex">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2"
                    onClick={handlePush}
                    disabled={isBusy || !isRepositoryReady || !hasConfiguredRemote || !canWriteViewedPair}
                >
                    {busyAction === 'push'
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Upload className="h-3.5 w-3.5" />}
                    推送上去
                </Button>
            </span>
        </TooltipTrigger>
        {!canWriteViewedPair ? (
            <TooltipContent side="top">
                当前只是在查看其他分支，写操作仅支持工作区分支和已配置的线上分支
            </TooltipContent>
        ) : null}
    </Tooltip>
</TooltipProvider>
```

Keep fetch enabled because it refreshes remote-tracking information without changing the worktree. Keep commit enabled according to the existing worktree checks because it still commits the real `currentBranch`.

- [ ] **Step 7: Run the panel tests**

Run:

```bash
pnpm exec vitest run src/index/components/VersionCollaborationPanel.source.test.ts src/index/components/SettingsDialog.source.test.ts
```

Expected: PASS with both source-contract files green.

- [ ] **Step 8: Commit the panel behavior**

```bash
git add src/index/components/VersionCollaborationPanel.tsx src/index/components/VersionCollaborationPanel.source.test.ts src/index/components/SettingsDialog.source.test.ts
git diff --cached --check
git commit -m "fix: query branches without changing the worktree"
```

Expected: the commit contains only the panel wiring and source-contract updates.

---

### Task 4: Verify the complete read-only workflow

**Files:**
- Verify only; no planned source changes.

**Interfaces:**
- Consumes: all contracts from Tasks 1-3.
- Produces: fresh test, type-check, build, and Git-state evidence for completion.

- [ ] **Step 1: Run all focused regression tests together**

```bash
pnpm exec vitest run \
  src/server/__tests__/projects-git-api.test.ts \
  src/index/services/api.test.ts \
  src/index/components/VersionCollaborationPanel.source.test.ts \
  src/index/components/SettingsDialog.source.test.ts
```

Expected: all listed test files pass with zero failed tests.

- [ ] **Step 2: Run server and Admin TypeScript checks**

```bash
pnpm exec tsc --noEmit -p tsconfig.node.json
pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: both commands exit 0 with no TypeScript diagnostics.

- [ ] **Step 3: Build the Admin UI without vendor resync**

```bash
pnpm exec vite build
```

Expected: Vite exits 0 and produces the Admin bundle. Do not run `pnpm admin:build` in the dirty workspace because its `vendor:sync` pre-step can modify unrelated vendor artifacts.

- [ ] **Step 4: Verify no branch-switch capability remains in the scoped source**

```bash
rg -n "switchGitWorkspaceBranch|handleSwitchBranch|/api/git/workspace/branch|branch-management" \
  src/index/components/VersionCollaborationPanel.tsx \
  src/index/services/api.ts \
  src/server/managementApi.git.ts
```

Expected: no matches and exit code 1 from `rg`.

- [ ] **Step 5: Verify the final diff and preserve unrelated work**

```bash
git diff --check
git status --short
git log -4 --oneline
```

Expected: no whitespace errors; the pre-existing user changes remain present; the three implementation commits appear after the design commits; no unrelated file is included in an implementation commit.
