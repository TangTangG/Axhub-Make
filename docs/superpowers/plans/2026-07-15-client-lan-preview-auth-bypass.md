# Client LAN Preview Auth Bypass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project-level “预览免验证” setting that lets the official client preview bypass LAN authentication without weakening Make admin or API authentication.

**Architecture:** Persist `server.skipLanPreviewAuth` in the existing project `.axhub/make/axhub.config.json` through `/api/config`. The settings dialog edits the boolean, while the client Vite preview plugin reads it dynamically before its existing LAN auth exchange; missing, invalid, or non-boolean values fail closed.

**Tech Stack:** TypeScript 5.x, React 18.2.0, Vite middleware, Vitest, pnpm workspace.

## Global Constraints

- UI label is exactly `预览免验证`.
- Help copy is exactly `开启后，局域网可直接访问当前项目预览；管理端和 API 仍需验证。`.
- Config key is exactly `server.skipLanPreviewAuth`; only strict boolean `true` bypasses preview authentication.
- The setting is project-scoped and defaults to disabled without migration or legacy compatibility code.
- Make admin and API LAN authentication remain unchanged.
- Preserve all pre-existing worktree changes. Target files already contain unrelated or in-progress edits, so execution uses focused diff review instead of commits that would capture those edits.

---

## File Structure

- `src/index/components/SettingsDialog.tsx`: extend the existing project settings form with the boolean and persist it through the current save request.
- `src/index/components/SettingsDialog.source.test.ts`: enforce the label, copy, boolean normalization, persistence, and switch binding.
- `src/server/__tests__/projects-config-api.test.ts`: verify the project config API round-trips the new server property while still removing legacy `allowLAN`.
- `client/vite-plugins/clientPreviewPlugin.ts`: read project config on each non-local preview request and short-circuit only the client auth gate when enabled.
- `client/tests/client-preview-routes.test.ts`: cover default protection, dynamic enablement without restart, and fail-closed malformed configuration.

### Task 1: Project Setting and Config Round Trip

**Files:**
- Modify: `src/index/components/SettingsDialog.source.test.ts`
- Modify: `src/server/__tests__/projects-config-api.test.ts`
- Modify: `src/index/components/SettingsDialog.tsx`

**Interfaces:**
- Consumes: existing `GET /api/config` and `POST /api/config` endpoints.
- Produces: optional `ServerConfig.skipLanPreviewAuth?: boolean` and required form state `SettingsFormState.skipLanPreviewAuth: boolean`.

- [ ] **Step 1: Add failing setting source assertions**

Extend the LAN settings source test with:

```ts
expect(source).toContain("import { Switch } from '@/components/ui/switch';");
expect(source).toContain('skipLanPreviewAuth?: boolean;');
expect(source).toContain('skipLanPreviewAuth: boolean;');
expect(source).toContain('skipLanPreviewAuth: config.server.skipLanPreviewAuth === true');
expect(source).toContain('skipLanPreviewAuth: formState.skipLanPreviewAuth');
expect(source).toContain('预览免验证');
expect(source).toContain('开启后，局域网可直接访问当前项目预览；管理端和 API 仍需验证。');
expect(source).toContain('checked={formState.skipLanPreviewAuth}');
expect(source).toContain("onCheckedChange={(checked) => updateField('skipLanPreviewAuth', checked === true)}");
```

- [ ] **Step 2: Add a failing config API round-trip assertion**

Update the existing LAN config API test POST and expectations:

```ts
server: {
  host: 'localhost',
  allowLAN: true,
  lanHost: '10.0.8.42',
  skipLanPreviewAuth: true,
},
```

```ts
expect(projectConfig.server).toEqual({
  host: 'localhost',
  lanHost: '10.0.8.42',
  skipLanPreviewAuth: true,
});
expect(after.server).toEqual(expect.objectContaining({
  host: 'localhost',
  lanHost: '10.0.8.42',
  skipLanPreviewAuth: true,
}));
```

- [ ] **Step 3: Run the focused tests and verify the UI contract fails**

Run:

```bash
pnpm exec vitest run src/index/components/SettingsDialog.source.test.ts src/server/__tests__/projects-config-api.test.ts
```

Expected: the settings source test fails because the switch/form property is absent. The API assertion may already pass because the endpoint preserves unknown project server fields.

- [ ] **Step 4: Implement the settings form boolean**

Import `Switch`, add `skipLanPreviewAuth?: boolean` to `ServerConfig`, add `skipLanPreviewAuth: boolean` to `SettingsFormState`, default it to `false`, and normalize only strict `true`:

```ts
skipLanPreviewAuth: config.server.skipLanPreviewAuth === true,
```

Preserve it in the existing save payload:

```ts
server: {
  host,
  port: currentConfig.server.port || 51720,
  lanHost: formState.lanHost.trim(),
  enableCommandAPI: currentConfig.server.enableCommandAPI || false,
  skipLanPreviewAuth: formState.skipLanPreviewAuth,
},
```

Add the setting after the LAN host field and before the LAN password field:

```tsx
<Field>
  <div className="flex items-center justify-between gap-4">
    <div className="space-y-1">
      <div className="text-sm font-medium text-foreground">预览免验证</div>
      <FieldDescription>
        开启后，局域网可直接访问当前项目预览；管理端和 API 仍需验证。
      </FieldDescription>
    </div>
    <Switch
      checked={formState.skipLanPreviewAuth}
      onCheckedChange={(checked) => updateField('skipLanPreviewAuth', checked === true)}
      aria-label="预览免验证"
    />
  </div>
</Field>
```

- [ ] **Step 5: Run the focused setting/config tests**

Run:

```bash
pnpm exec vitest run src/index/components/SettingsDialog.source.test.ts src/server/__tests__/projects-config-api.test.ts
```

Expected: both files pass with no failed tests.

- [ ] **Step 6: Review the focused Task 1 diff**

Run:

```bash
git diff --check -- src/index/components/SettingsDialog.tsx src/index/components/SettingsDialog.source.test.ts src/server/__tests__/projects-config-api.test.ts
git diff -- src/index/components/SettingsDialog.tsx src/index/components/SettingsDialog.source.test.ts src/server/__tests__/projects-config-api.test.ts
```

Expected: no whitespace errors; all existing LAN password and share-link behavior remains present.

### Task 2: Dynamic Client Preview Bypass

**Files:**
- Modify: `client/tests/client-preview-routes.test.ts`
- Modify: `client/vite-plugins/clientPreviewPlugin.ts`

**Interfaces:**
- Consumes: `.axhub/make/axhub.config.json` with optional `server.skipLanPreviewAuth`.
- Produces: `shouldSkipLanPreviewAuth(projectRoot: string): boolean`, true only for strict stored `true`.

- [ ] **Step 1: Add the failing dynamic bypass route test**

Add a test after the existing non-local blocking test. It starts one preview server, gets `401` by default, rewrites config to enable bypass and gets `200`, then corrupts config and gets `401`:

```ts
it('applies project LAN preview auth bypass changes without restarting and fails closed', async () => {
  const projectRoot = createFixtureProject();
  const adminOrigin = 'http://localhost:5174';
  const accessCalls: string[] = [];
  globalThis.fetch = vi.fn(async (input: any) => {
    const url = new URL(String(input));
    if (url.pathname.startsWith('/api/access/')) accessCalls.push(url.pathname);
    if (url.pathname === '/api/health') {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          role: 'admin',
          capabilities: { reviewReports: true },
          server: {
            pid: 5174,
            port: 5174,
            host: 'localhost',
            origin: adminOrigin,
            projectRoot,
            startedAt: '2026-05-08T00:00:00.000Z',
          },
        }),
      } as any;
    }
    if (url.pathname === '/api/access/status') {
      return { ok: true, json: async () => ({ passwordSet: true }) } as any;
    }
    throw new Error(`Unexpected access path \${url.pathname}`);
  }) as any;
  writeServerInfo(projectRoot, 'admin', {
    pid: 12345,
    port: 5174,
    host: 'localhost',
    origin: adminOrigin,
    projectRoot,
    startedAt: '2026-05-04T00:00:00.000Z',
  });
  process.chdir(projectRoot);
  const server = await createPreviewViteServer(projectRoot);
  const origin = await listenPreviewViteServer(server);
  const request = () => originalFetch(`\${origin}/prototypes/home`, {
    headers: { 'x-forwarded-for': '192.168.1.55' },
  });

  expect((await request()).status).toBe(401);
  writeFile(path.join(projectRoot, '.axhub/make/axhub.config.json'), JSON.stringify({
    server: { skipLanPreviewAuth: true },
  }));
  expect((await request()).status).toBe(200);
  const callsAfterBypass = accessCalls.length;
  writeFile(path.join(projectRoot, '.axhub/make/axhub.config.json'), '{ invalid');
  expect((await request()).status).toBe(401);
  expect(accessCalls.length).toBeGreaterThan(callsAfterBypass);
});
```

- [ ] **Step 2: Run the focused client test and verify it fails**

Run:

```bash
pnpm --dir client exec vitest run tests/client-preview-routes.test.ts -t "applies project LAN preview auth bypass changes without restarting and fails closed"
```

Expected: FAIL because the enabled request still returns `401`.

- [ ] **Step 3: Implement fail-closed config reading**

Add:

```ts
function shouldSkipLanPreviewAuth(projectRoot: string): boolean {
  try {
    const config = JSON.parse(fs.readFileSync(
      path.join(projectRoot, '.axhub', 'make', 'axhub.config.json'),
      'utf8',
    ));
    return config?.server?.skipLanPreviewAuth === true;
  } catch {
    return false;
  }
}
```

Change the first guard in `handleClientLanAccess`:

```ts
if (isLocalPreviewRequest(req) || shouldSkipLanPreviewAuth(projectRoot)) {
  return false;
}
```

Do not change `src/server/lanAccessControl.ts` or any `/api/access/*` allowlist.

- [ ] **Step 4: Run all client preview route tests**

Run:

```bash
pnpm --dir client exec vitest run tests/client-preview-routes.test.ts
```

Expected: all tests pass, including existing token exchange, cookie validation, default blocking, and direct network preview cases.

- [ ] **Step 5: Review the focused Task 2 diff**

Run:

```bash
git diff --check -- client/vite-plugins/clientPreviewPlugin.ts client/tests/client-preview-routes.test.ts
git diff -- client/vite-plugins/clientPreviewPlugin.ts client/tests/client-preview-routes.test.ts
```

Expected: no whitespace errors; the only auth behavior change is the project config short-circuit in the client preview plugin.

### Task 3: Integrated Verification

**Files:**
- Verify only: all files from Tasks 1 and 2.

**Interfaces:**
- Consumes: completed settings/config and client preview changes.
- Produces: evidence that the feature works and admin/API security remains unchanged.

- [ ] **Step 1: Run all focused regression tests**

Run:

```bash
pnpm exec vitest run src/index/components/SettingsDialog.source.test.ts src/server/__tests__/projects-config-api.test.ts src/server/__tests__/lan-access-control.test.ts
pnpm --dir client exec vitest run tests/client-preview-routes.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 2: Build Make and the official client**

Run:

```bash
pnpm build
```

Expected: exit code `0` for Make Vite builds and `@axhub/make-client` build.

- [ ] **Step 3: Run final whitespace and scope checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no new whitespace errors. Existing unrelated dirty files remain untouched; the feature diff is limited to the five implementation/test files named above.
