# Feishu Base Review Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-prototype Feishu Base review channel beside LAN submission, with compact fixed-height controls and manual incremental import into the existing local Markdown review list.

**Architecture:** A focused server service owns `lark-cli` capability checks, Base lifecycle, record normalization, pagination, and local Markdown synchronization. Existing review-report routes gain Feishu config/sync endpoints; the admin API client and preview-action hook expose that state to `UiReviewPanel`, which keeps the existing two-row footer.

**Tech Stack:** TypeScript 5, Node.js, `execa` through `runLocalCommand`, React 18.2, Vitest 4, Tailwind/shadcn UI, `lark-cli` Base shortcuts.

## Global Constraints

- Use `pnpm`; do not use npm or yarn for repository development commands.
- Invoke local commands through `src/server/localCommand.ts` with argument arrays and `shell: false`; do not introduce `zx` or shell-string interpolation.
- Keep React at 18.2.0 and TypeScript at 5.x.
- Keep the human-review footer at the existing two-row, 72-pixel content height.
- Never render the raw Feishu URL; expose only a compact open-link action.
- Do not install, update, configure, or authenticate `lark-cli` silently.
- Do not implement legacy CLI command fallbacks; capability failure must return an update instruction.
- Preserve existing LAN submission APIs and config values.
- Do not propagate remote Base deletions into local report deletion.
- Base wins when a Feishu-sourced local Markdown file differs from the corresponding remote record.
- The current workspace already contains user modifications in target files. During inline execution, do not stage or commit implementation files; preserve existing changes and leave the final code diff unstaged for review.

---

## File Structure

- Create `src/server/feishuReviewBase.ts`: CLI gateway, capability/auth checks, Base binding creation/validation, paginated record reads, record normalization, Markdown synchronization, and stable error mapping.
- Create `src/server/__tests__/feishu-review-base.test.ts`: isolated flat/enveloped command output, Base lifecycle, pagination, mapping, and sync tests with an injected executor.
- Modify `src/server/reviewLanSubmitConfig.ts`: merge-safe shared review config plus optional Feishu binding accessors.
- Modify `src/server/managementApi.reviewReports.ts`: Feishu config/sync routes and Feishu provenance parsing.
- Modify `src/server/managementApi.ts`, `src/server/index.ts`, and `src/server/__tests__/projects-api.helpers.ts`: optional Feishu command executor injection for API tests.
- Modify `src/server/__tests__/review-reports-api.test.ts`: end-to-end API lifecycle and sync coverage.
- Modify `src/index/services/api.ts` and `src/index/services/api.test.ts`: Feishu config/sync contracts and API calls.
- Modify `src/index/app/index-page/useIndexPagePreviewActions.tsx` and `src/index/app/index-page/useIndexPagePreviewActions.test.ts`: Feishu state, load, toggle, sync, open-link, and refresh behavior.
- Modify `src/index/types/index-page.types.ts`, `src/index/app/hooks/useIndexPagePresentationPropsBuilder.ts`, `src/index/components/content/PresentationArea.tsx`, and `src/index/components/content/PresentationArea.source.test.ts`: state/action prop plumbing.
- Modify `src/index/components/content/UiReviewPanel.tsx` and `src/index/components/content/UiReviewPanel.source.test.ts`: fixed-height two-row controls and compact Feishu actions.

---

### Task 1: Merge-safe review integration configuration

**Files:**
- Modify: `src/server/reviewLanSubmitConfig.ts`
- Test: `src/server/__tests__/review-reports-api.test.ts`

**Interfaces:**
- Produces: `FeishuReviewBinding`, `readPrototypeReviewFeishuBinding`, `writePrototypeReviewFeishuConfig`.
- Preserves: `readPrototypeReviewLanSubmitEnabled`, `writePrototypeReviewLanSubmitConfig`.

- [ ] **Step 1: Write failing config merge tests**

Add focused assertions that start with a LAN-only config, write a Feishu binding, toggle LAN, and verify both values remain present:

```ts
expect(readPrototypeReviewLanSubmitEnabled(prototypeDir)).toBe(true);
expect(readPrototypeReviewFeishuBinding(prototypeDir)).toMatchObject({
  enabled: true,
  baseToken: 'bas_mock',
  tableId: 'tbl_mock',
  url: 'https://example.feishu.cn/base/bas_mock',
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
pnpm exec vitest run src/server/__tests__/review-reports-api.test.ts
```

Expected: FAIL because the Feishu config accessors do not exist and the LAN writer currently replaces the entire file.

- [ ] **Step 3: Implement merge-safe accessors**

Add these exact public types and signatures:

```ts
export interface FeishuReviewBinding {
  enabled: boolean;
  baseToken: string;
  tableId: string;
  url: string;
  createdAt: string;
}

export function readPrototypeReviewFeishuBinding(
  prototypeDir: string,
): FeishuReviewBinding | null;

export function writePrototypeReviewFeishuConfig(
  prototypeDir: string,
  binding: FeishuReviewBinding | null,
): void;
```

Use one internal `readPrototypeReviewConfig` and `writePrototypeReviewConfig` pair. Both public writers must spread the existing parsed object before replacing only their own field.

- [ ] **Step 4: Run the focused test and verify green**

Run the Task 1 command again. Expected: PASS for config merge assertions and existing LAN API cases.

- [ ] **Step 5: Leave implementation unstaged**

Do not commit because this target file is existing user work. Record the passing command in the final handoff.

---

### Task 2: Feishu CLI gateway and Base lifecycle

**Files:**
- Create: `src/server/feishuReviewBase.ts`
- Create: `src/server/__tests__/feishu-review-base.test.ts`

**Interfaces:**
- Consumes: `FeishuReviewBinding` and `writePrototypeReviewFeishuConfig` from Task 1.
- Produces: `FeishuReviewCommandExecutor`, `FeishuReviewError`, `ensureFeishuReviewBinding`, `setFeishuReviewEnabled`, and `getFeishuReviewConfig`.

- [ ] **Step 1: Write failing CLI gateway tests**

Define an injected executor with captured argument arrays:

```ts
export type FeishuReviewCommandExecutor = (
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;
```

Cover:

- missing executable maps to `FEISHU_CLI_MISSING`;
- `base +base-create --help` without `--table-name` or `--fields` maps to `FEISHU_CLI_UPDATE_REQUIRED`;
- failed `auth status --json --verify` maps to `FEISHU_AUTH_REQUIRED`;
- successful create extracts `baseToken`, `tableId`, and canonical URL;
- existing binding is validated and reused;
- permission, quota, and rate-limit envelopes preserve distinct stable codes;
- no command is passed through a shell string.

- [ ] **Step 2: Run the lifecycle tests and verify red**

Run:

```bash
pnpm exec vitest run src/server/__tests__/feishu-review-base.test.ts
```

Expected: FAIL because `src/server/feishuReviewBase.ts` does not exist.

- [ ] **Step 3: Implement the command gateway**

Add a default executor that delegates to:

```ts
runLocalCommand('lark-cli', args, {
  cwd: projectRoot,
  timeoutMs: 30_000,
  env: {
    ...process.env,
    LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1',
    LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1',
  },
});
```

Parse only JSON envelopes with `ok === true`. Throw:

```ts
export class FeishuReviewError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) { super(message); }
}
```

Capability-probe `base +base-create --help` and require both `--table-name` and `--fields`. Verify user authentication before a create or validation call.

- [ ] **Step 4: Implement Base creation and validation**

Create `评审报告` with field JSON equivalent to:

```ts
const FEISHU_REVIEW_FIELDS = [
  { type: 'text', name: '标题' },
  { type: 'text', name: '评审人' },
  { type: 'number', name: '评分', style: { type: 'plain', precision: 0 } },
  { type: 'text', name: '来源' },
  { type: 'text', name: 'Markdown 正文' },
];
```

Run `base +field-list` after create and require every field/type before persisting. Re-enable by validating the stored Base and table. Do not delete a partially created Base.

- [ ] **Step 5: Run lifecycle tests and verify green**

Run the Task 2 command again. Expected: PASS with argument-array assertions and stable error mappings.

- [ ] **Step 6: Leave implementation unstaged**

Do not commit in the dirty workspace.

---

### Task 2A: Current CLI flat JSON compatibility

**Files:**
- Modify: `src/server/feishuReviewBase.ts`
- Modify: `src/server/__tests__/feishu-review-base.test.ts`

**Interfaces:**
- Preserves: `FeishuReviewCommandExecutor` and all public service functions.
- Extends: `executeJson` accepts both lark-cli 1.0.69 flat JSON objects and legacy `{ ok: true, data }` envelopes.

- [ ] **Step 1: Write failing flat-output regression tests**

Add a result helper beside `jsonResult`:

```ts
function flatJsonResult(data: unknown) {
  return { stdout: JSON.stringify(data), stderr: '' };
}
```

Add one authentication-error case using the real 1.0.69 output shape:

```ts
it('maps the current CLI flat auth status to the user-auth error', async () => {
  const { projectRoot, prototypeDir } = createPrototype();
  const commandExecutor: FeishuReviewCommandExecutor = async (args) => {
    if (args.includes('--help')) return capabilityResult();
    return flatJsonResult({
      verified: true,
      identity: 'bot',
      identities: {
        bot: { status: 'logged_in', tokenStatus: 'valid' },
        user: { status: 'missing', tokenStatus: 'expired' },
      },
    });
  };

  await expect(setFeishuReviewEnabled({
    projectRoot,
    prototypeDir,
    prototypeId: 'home',
    prototypeTitle: 'Home',
    enabled: true,
    commandExecutor,
  })).rejects.toMatchObject({
    code: 'FEISHU_AUTH_REQUIRED',
    status: 401,
  });
});
```

Add one successful lifecycle case where auth, Base create/get, and field-list all return flat objects:

```ts
it('accepts flat success objects from the current CLI', async () => {
  const { projectRoot, prototypeDir } = createPrototype();
  const commandExecutor: FeishuReviewCommandExecutor = async (args) => {
    if (args.includes('--help')) return capabilityResult();
    if (args[0] === 'auth') {
      return flatJsonResult({
        verified: true,
        identities: { user: { status: 'logged_in', tokenStatus: 'valid' } },
      });
    }
    if (args[1] === '+base-create') {
      return flatJsonResult({
        base: {
          base_token: 'bas_flat',
          table_id: 'tbl_flat',
          url: 'https://example.feishu.cn/base/bas_flat',
        },
      });
    }
    if (args[1] === '+base-get') {
      return flatJsonResult({ base: { base_token: 'bas_flat', url: 'https://example.feishu.cn/base/bas_flat' } });
    }
    if (args[1] === '+field-list') {
      return flatJsonResult({
        fields: [
          { name: '标题', type: 'text' },
          { name: '评审人', type: 'text' },
          { name: '评分', type: 'number' },
          { name: '来源', type: 'text' },
          { name: 'Markdown 正文', type: 'text' },
        ],
      });
    }
    throw new Error(`Unexpected command: ${args.join(' ')}`);
  };

  await expect(setFeishuReviewEnabled({
    projectRoot,
    prototypeDir,
    prototypeId: 'home',
    prototypeTitle: 'Home',
    enabled: true,
    commandExecutor,
  })).resolves.toMatchObject({ enabled: true, bound: true });
});
```

- [ ] **Step 2: Run the focused tests and verify red**

Run:

```bash
pnpm exec vitest run src/server/__tests__/feishu-review-base.test.ts
```

Expected: both new tests fail with `FEISHU_CLI_FAILED` because `executeJson` currently requires `ok === true` for every JSON object.

- [ ] **Step 3: Accept flat success objects without weakening envelope errors**

Replace the payload handling in `executeJson` with:

```ts
const payload = parseJsonObject(String(result.stdout || ''));
if (!payload) {
  throw new FeishuReviewError('lark-cli 未返回有效 JSON。', 'FEISHU_CLI_INVALID_JSON', 502);
}
if (Object.prototype.hasOwnProperty.call(payload, 'ok')) {
  if (payload.ok !== true) {
    throw mapCliFailure({ stderr: JSON.stringify(payload), message: 'lark-cli command failed' });
  }
  return objectValue(payload.data);
}
return payload;
```

This keeps legacy error-envelope behavior intact while accepting the current CLI's successful flat objects.

- [ ] **Step 4: Run focused tests and verify green**

Run the Task 2A command again. Expected: all service tests pass, including both flat-output cases and existing envelope/error cases.

- [ ] **Step 5: Leave implementation unstaged**

Do not stage or commit the service and test files because they share the existing dirty feature workspace.

---

### Task 3: Paginated record normalization and Markdown sync

**Files:**
- Modify: `src/server/feishuReviewBase.ts`
- Modify: `src/server/managementApi.reviewReports.ts`
- Test: `src/server/__tests__/feishu-review-base.test.ts`

**Interfaces:**
- Produces: `FeishuReviewSyncResult` and `syncFeishuReviewReports`.
- Extends existing report parser frontmatter keys with `feishuRecordId` and `feishuUpdatedAt`.

- [ ] **Step 1: Write failing pagination and sync tests**

Use two mocked `+record-list` pages and assert the second request advances `--offset`. Cover created, updated, unchanged, invalid, and missing-remote cases with this result shape:

```ts
export interface FeishuReviewSyncResult {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  changedReportIds: string[];
  errors: Array<{ recordId?: string; code: string; message: string }>;
}
```

Assert generated filenames use `feishu-<safe-record-id>.md`, remote deletion leaves an existing local file intact, and an identical pull does not change `mtimeMs`.

- [ ] **Step 2: Run sync tests and verify red**

Run:

```bash
pnpm exec vitest run src/server/__tests__/feishu-review-base.test.ts
```

Expected: FAIL because pagination and sync are not implemented.

- [ ] **Step 3: Implement record normalization**

Normalize `record_id`/`id`, `fields`, `created_time`/`createdAt`, and `last_modified_time`/`updatedAt`. Text cells must accept either a string or arrays of `{ text }` fragments. Reject an empty title, empty Markdown body, or a finite score outside 0–100.

- [ ] **Step 4: Implement deterministic serial pagination**

Request `--limit 100 --offset <n>` serially. Continue while `has_more === true`; otherwise stop when the page contains fewer than 100 records. Abort with `FEISHU_PAGINATION_STALLED` if a page says `has_more` but returns zero records.

- [ ] **Step 5: Implement provenance Markdown and safe replacement**

Generate:

```yaml
---
title: "<escaped title>"
reviewer: "<escaped reviewer>"
createdAt: <ISO timestamp>
source: "feishu-base"
score: 86
feishuRecordId: "<record id>"
feishuUpdatedAt: "<ISO timestamp>"
---
```

Write through a same-directory temporary file and rename it into place. Skip the write when bytes are identical. Never enumerate local Feishu files for deletion.

- [ ] **Step 6: Extend the existing frontmatter parser**

Add `feishuRecordId` and `feishuUpdatedAt` to `FRONTMATTER_KEYS` so extra provenance does not bleed into `score` or `source`; keep the current public report response unchanged.

- [ ] **Step 7: Run sync tests and verify green**

Run the Task 3 command again. Expected: PASS for all lifecycle and sync tests.

- [ ] **Step 8: Leave implementation unstaged**

Do not commit in the dirty workspace.

---

### Task 4: Feishu review HTTP endpoints

**Files:**
- Modify: `src/server/managementApi.reviewReports.ts`
- Modify: `src/server/managementApi.ts`
- Modify: `src/server/index.ts`
- Modify: `src/server/__tests__/projects-api.helpers.ts`
- Modify: `src/server/__tests__/review-reports-api.test.ts`

**Interfaces:**
- Consumes: lifecycle and sync functions from Tasks 2–3.
- Produces: GET/PUT `/api/review-reports/feishu-config` and POST `/api/review-reports/feishu-sync`.

- [ ] **Step 1: Write failing endpoint tests**

Inject a `FeishuReviewCommandExecutor` into `startTestServer`. Cover:

```ts
GET  /api/review-reports/feishu-config?projectId=...&prototypeId=home
PUT  /api/review-reports/feishu-config
POST /api/review-reports/feishu-sync
```

Assert first enable creates/binds, disable retains tokens while setting `enabled: false`, re-enable reuses the binding, failed enable leaves it off, sync creates local files, and unsafe prototype IDs return 400.

- [ ] **Step 2: Run API tests and verify red**

Run:

```bash
pnpm exec vitest run src/server/__tests__/review-reports-api.test.ts
```

Expected: FAIL with 404 for Feishu endpoints.

- [ ] **Step 3: Add optional executor injection**

Add `feishuReviewCommandExecutor?: FeishuReviewCommandExecutor` to `StartMakeServerOptions` and `ManagementApiOptions`, pass it through server startup, and expose it in the API test helper without changing production defaults.

- [ ] **Step 4: Implement endpoint handlers**

Responses use:

```ts
interface ReviewFeishuConfig {
  projectId: string;
  prototypeId: string;
  enabled: boolean;
  bound: boolean;
  url?: string;
}
```

Map `FeishuReviewError.status` and `.code` directly into JSON errors. Serialize create/sync operations per prototype so concurrent enable requests cannot create duplicate Bases.

- [ ] **Step 5: Run API and LAN regression tests**

Run:

```bash
pnpm exec vitest run src/server/__tests__/review-reports-api.test.ts src/server/__tests__/localCommand.test.ts
```

Expected: PASS, including existing LAN submit and upload cases.

- [ ] **Step 6: Leave implementation unstaged**

Do not commit in the dirty workspace.

---

### Task 5: Admin API client and preview-action state

**Files:**
- Modify: `src/index/services/api.ts`
- Modify: `src/index/services/api.test.ts`
- Modify: `src/index/app/index-page/useIndexPagePreviewActions.tsx`
- Modify: `src/index/app/index-page/useIndexPagePreviewActions.test.ts`

**Interfaces:**
- Produces client types `ReviewFeishuConfig`, `ReviewFeishuSyncResult` and methods `getReviewFeishuConfig`, `updateReviewFeishuConfig`, `syncReviewFeishuReports`.
- Produces hook state/actions `reviewFeishuConfig`, `reviewFeishuSyncLoading`, `handleReviewFeishuEnabledChange`, `handleSyncReviewFeishuReports`, `handleOpenReviewFeishu`.

- [ ] **Step 1: Write failing API client tests**

Assert request paths, methods, and bodies:

```ts
await apiService.getReviewFeishuConfig('project', 'home');
await apiService.updateReviewFeishuConfig({ projectId: 'project', prototypeId: 'home', enabled: true });
await apiService.syncReviewFeishuReports({ projectId: 'project', prototypeId: 'home' });
```

- [ ] **Step 2: Run API client tests and verify red**

Run:

```bash
pnpm exec vitest run src/index/services/api.test.ts
```

Expected: FAIL because the methods and types do not exist.

- [ ] **Step 3: Implement API types and methods**

Use the endpoint contracts from Task 4 and the existing `readApiJsonResponse` helper. Do not share the LAN config type with Feishu state.

- [ ] **Step 4: Write failing preview-action wiring assertions**

Add source assertions for the new state, config load beside `loadReviewLanSubmitConfig`, enable/disable handler, sync summary toast, report reload, and `window.open(config.url, '_blank', 'noopener,noreferrer')`.

- [ ] **Step 5: Implement hook state and actions**

Load both configs when the review panel opens or the prototype changes. On sync, report counts in one toast, reload the local list, and open the newest ID from `changedReportIds` when available. A toggle error must keep the prior config state and rethrow for the panel's pending state cleanup.

- [ ] **Step 6: Run focused hook/client tests**

Run:

```bash
pnpm exec vitest run src/index/services/api.test.ts src/index/app/index-page/useIndexPagePreviewActions.test.ts
```

Expected: PASS.

- [ ] **Step 7: Leave implementation unstaged**

Do not commit in the dirty workspace.

---

### Task 6: Prop wiring and fixed-height Feishu controls

**Files:**
- Modify: `src/index/types/index-page.types.ts`
- Modify: `src/index/app/hooks/useIndexPagePresentationPropsBuilder.ts`
- Modify: `src/index/components/content/PresentationArea.tsx`
- Modify: `src/index/components/content/PresentationArea.source.test.ts`
- Modify: `src/index/components/content/UiReviewPanel.tsx`
- Modify: `src/index/components/content/UiReviewPanel.source.test.ts`

**Interfaces:**
- Consumes hook state/actions from Task 5.
- Adds `feishuConfig`, `feishuSyncLoading`, `onFeishuEnabledChange`, `onFeishuSync`, and `onOpenFeishu` to `UiReviewPanelProps`.

- [ ] **Step 1: Write failing presentation wiring tests**

Assert state/action propagation through the builder and `PresentationArea` into `UiReviewPanel`, using exact property names from the Interfaces block.

- [ ] **Step 2: Write failing panel layout tests**

Keep assertions for `h-[72px]` and exactly two `h-8` action rows. Add assertions that:

- LAN and Feishu switches occur in the second row;
- raw `feishuConfig.url` is not interpolated into visible text;
- an icon-only open button has `aria-label="打开飞书评审"`;
- `获取飞书` is conditional on `feishuConfig.enabled && feishuConfig.bound`;
- switch and sync loading states are independent.

- [ ] **Step 3: Run UI source tests and verify red**

Run:

```bash
pnpm exec vitest run src/index/components/content/UiReviewPanel.source.test.ts src/index/components/content/PresentationArea.source.test.ts
```

Expected: FAIL for missing Feishu props and controls.

- [ ] **Step 4: Implement prop plumbing**

Add the Feishu values to `PresentationAreaState`, `PresentationAreaActions`, the props builder, and the `UiReviewPanel` call without renaming existing LAN properties.

- [ ] **Step 5: Implement the compact two-row UI**

Use `ExternalLink` for the icon action and `RefreshCw` or `Loader2` for fetch. Keep the first row for report actions and the second row for two inline switch groups. Do not add another `TabsContent` child row and do not change `h-[72px]`.

- [ ] **Step 6: Run UI source tests and verify green**

Run the Task 6 command again. Expected: PASS.

- [ ] **Step 7: Leave implementation unstaged**

Do not commit in the dirty workspace.

---

### Task 7: Integrated verification

**Files:**
- Verify all files from Tasks 1–6.

**Interfaces:**
- Confirms the completed server, API client, hook, and panel contract.

- [ ] **Step 1: Run the focused Feishu and review suites**

```bash
pnpm exec vitest run \
  src/server/__tests__/feishu-review-base.test.ts \
  src/server/__tests__/review-reports-api.test.ts \
  src/index/services/api.test.ts \
  src/index/app/index-page/useIndexPagePreviewActions.test.ts \
  src/index/components/content/UiReviewPanel.source.test.ts \
  src/index/components/content/PresentationArea.source.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run server type checking**

```bash
pnpm server:build
```

Expected: exit 0 with no TypeScript diagnostics.

- [ ] **Step 3: Run the admin production build**

```bash
pnpm admin:build
```

Expected: exit 0 and Vite reports successful admin and Axure-export builds.

- [ ] **Step 4: Inspect the final diff**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended feature files plus the user's pre-existing changes are present. Do not stage or commit implementation changes.

- [ ] **Step 5: Browser verification when the local server is available**

Open the current prototype review panel and verify:

1. the human-review footer remains two rows and does not grow;
2. LAN and Feishu switches are side by side;
3. no raw URL is visible;
4. the external-link icon appears only when bound;
5. failed setup returns the switch to off;
6. manual fetch reports its incremental summary and refreshes the report list.
