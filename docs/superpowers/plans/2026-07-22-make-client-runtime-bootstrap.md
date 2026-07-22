# Make Client Runtime Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Make client's independent quick-edit and editor bootstrap tags with one deterministic module loader that publishes the existing ready signal only after the editor API exists.

**Architecture:** Keep `agentToolbar=host` as the sole activation gate and keep the Make Server assets and host message protocol unchanged. Generate one inline module loader in the client preview plugin; it awaits `dev-template-bootstrap.js`, validates `DevTemplateBootstrap.editors.enable`, then appends `quick-edit.js`, reporting staged failures through the existing `axhub.quickEdit.error` message.

**Tech Stack:** TypeScript 5.x, Vite 5, Vitest 4, Node `vm`, pnpm workspace commands.

## Global Constraints

- Support only the new Make client with the new Make Server; do not add compatibility fallbacks.
- Keep React at 18.2.0 and use pnpm for repository development commands.
- Do not modify Server runtime assets, Server routes, Make admin handshake code, or unrelated dirty worktree files.
- Keep `agentToolbar=host` as the explicit management runtime activation condition.
- `Referer` may help resolve an origin only after activation; it must never activate injection.
- Generated inline JavaScript must serialize dynamic URLs safely and remain idempotent.

---

## File Structure

- Modify `client/vite-plugins/clientPreviewPlugin.ts`: own management runtime activation, loader source generation, and single-tag HTML injection.
- Modify `client/tests/quick-edit-runtime-injection.test.ts`: execute the generated loader in a VM harness and cover lifecycle/error behavior.
- Modify `client/tests/client-preview-routes.test.ts`: assert the route-level single-loader contract, activation boundary, and React Refresh ordering.

No new production file is planned. The loader is small and belongs beside the preview HTML injection code that owns its lifecycle.

### Task 1: Replace Dual Script Injection With A Tested Loader

**Files:**
- Modify: `client/tests/quick-edit-runtime-injection.test.ts`
- Modify: `client/vite-plugins/clientPreviewPlugin.ts`

**Interfaces:**
- Consumes: `serverOrigin: string | null | undefined` returned by the existing `resolveAdminServerOrigin` path.
- Produces: `createManagementRuntimeLoaderSource(serverOrigin): string`, `createManagementRuntimeScriptTag(serverOrigin): string`, and `injectManagementRuntimeScript(html, serverOrigin): string`.
- Preserves: `shouldInjectManagementRuntime(requestUrl): boolean` and the existing `axhub.quickEdit.runtimeReady` / `axhub.quickEdit.error` host protocol.

- [ ] **Step 1: Replace tag-order tests with failing loader lifecycle tests**

Update the test imports and add a VM harness that replaces the generated dynamic import with an injected test function:

```ts
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

import {
  createManagementRuntimeLoaderSource,
  createManagementRuntimeScriptTag,
  injectManagementRuntimeScript,
  injectReactRefreshPreambleScript,
} from '../vite-plugins/clientPreviewPlugin';

function runManagementRuntimeLoader(importBootstrap: () => Promise<unknown>) {
  const appendedScripts: any[] = [];
  const messages: any[] = [];
  const windowStub: any = {
    DevTemplateBootstrap: undefined,
    __importBootstrap: vi.fn(importBootstrap),
    parent: {
      postMessage(message: unknown, targetOrigin: string) {
        messages.push({ message, targetOrigin });
      },
    },
  };
  const documentStub: any = {
    createElement: vi.fn(() => ({
      setAttribute: vi.fn(),
      src: '',
      onload: null,
      onerror: null,
    })),
    head: {
      appendChild(script: any) {
        appendedScripts.push(script);
        return script;
      },
    },
    documentElement: {
      appendChild(script: any) {
        appendedScripts.push(script);
        return script;
      },
    },
  };
  const source = createManagementRuntimeLoaderSource('http://localhost:5174')
    .replace('await import(', 'await window.__importBootstrap(');

  vm.runInNewContext(source, {
    window: windowStub,
    document: documentStub,
    console,
    Error,
    Promise,
    String,
  });

  return {
    appendedScripts,
    messages,
    promise: windowStub.__AXHUB_MANAGEMENT_RUNTIME_BOOTSTRAP__,
    windowStub,
  };
}
```

Add these behavioral cases:

```ts
it('waits for the editor bootstrap before appending quick-edit', async () => {
  let resolveBootstrap!: () => void;
  const bootstrapPromise = new Promise<void>((resolve) => {
    resolveBootstrap = resolve;
  });
  const harness = runManagementRuntimeLoader(() => bootstrapPromise);

  expect(harness.appendedScripts).toHaveLength(0);
  harness.windowStub.DevTemplateBootstrap = { editors: { enable: vi.fn() } };
  resolveBootstrap();
  await Promise.resolve();
  await Promise.resolve();

  expect(harness.appendedScripts).toHaveLength(1);
  expect(harness.appendedScripts[0].src).toBe('http://localhost:5174/runtime/quick-edit.js');
  harness.appendedScripts[0].onload();
  await harness.promise;
});

it('reports bootstrap-import and stops when import fails', async () => {
  const harness = runManagementRuntimeLoader(() => Promise.reject(new Error('bootstrap failed')));
  await harness.promise;
  expect(harness.appendedScripts).toHaveLength(0);
  expect(harness.messages.at(-1)?.message).toMatchObject({
    type: 'axhub.quickEdit.error',
    stage: 'bootstrap-import',
  });
});

it('reports bootstrap-api when editors.enable is unavailable', async () => {
  const harness = runManagementRuntimeLoader(() => Promise.resolve());
  await harness.promise;
  expect(harness.appendedScripts).toHaveLength(0);
  expect(harness.messages.at(-1)?.message).toMatchObject({
    type: 'axhub.quickEdit.error',
    stage: 'bootstrap-api',
  });
});

it('reports quick-edit-load when the classic runtime fails', async () => {
  const harness = runManagementRuntimeLoader(() => Promise.resolve());
  harness.windowStub.DevTemplateBootstrap = { editors: { enable: vi.fn() } };
  await Promise.resolve();
  await Promise.resolve();
  harness.appendedScripts[0].onerror();
  await harness.promise;
  expect(harness.messages.at(-1)?.message).toMatchObject({
    type: 'axhub.quickEdit.error',
    stage: 'quick-edit-load',
  });
});
```

Replace the old dual-tag helper tests with assertions that one module tag is generated, no origin produces no tag, and reinjection is idempotent.

- [ ] **Step 2: Run the focused test and verify the new API is missing**

Run:

```bash
cd client
pnpm exec vitest --run tests/quick-edit-runtime-injection.test.ts
```

Expected: FAIL because the three new loader helpers are not exported.

- [ ] **Step 3: Implement the single loader and remove the dual helpers**

In `client/vite-plugins/clientPreviewPlugin.ts`, replace the quick-edit and dev-template helpers with:

```ts
const MANAGEMENT_RUNTIME_MARKER = 'data-axhub-management-runtime';

function normalizeManagementRuntimeOrigin(serverOrigin: string | null | undefined): string {
  return String(serverOrigin || '').trim().replace(/\/+$/u, '');
}

function serializeInlineScriptString(value: string): string {
  return JSON.stringify(value).replace(/</gu, '\\u003c');
}

export function createManagementRuntimeLoaderSource(
  serverOrigin: string | null | undefined,
): string {
  const origin = normalizeManagementRuntimeOrigin(serverOrigin);
  if (!origin) return '';
  const bootstrapUrl = serializeInlineScriptString(`${origin}/assets/dev-template-bootstrap.js`);
  const quickEditUrl = serializeInlineScriptString(`${origin}/runtime/quick-edit.js`);

  return `window.__AXHUB_MANAGEMENT_RUNTIME_BOOTSTRAP__ ||= (async () => {
  const reportError = (stage, error) => {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[Axhub] Management runtime bootstrap failed:', stage, error);
    window.parent?.postMessage({
      type: 'axhub.quickEdit.error',
      stage,
      message: 'Management runtime bootstrap failed: ' + detail,
      error: detail,
    }, '*');
  };
  try {
    await import(${bootstrapUrl});
  } catch (error) {
    reportError('bootstrap-import', error);
    return;
  }
  const editors = window.DevTemplateBootstrap?.editors;
  if (!editors || typeof editors.enable !== 'function') {
    reportError('bootstrap-api', new Error('DevTemplateBootstrap.editors.enable is unavailable'));
    return;
  }
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.setAttribute('data-axhub-quick-edit-runtime', '');
      script.src = ${quickEditUrl};
      script.onload = () => resolve(undefined);
      script.onerror = () => reject(new Error('Failed to load quick-edit runtime'));
      (document.head || document.documentElement).appendChild(script);
    });
  } catch (error) {
    reportError('quick-edit-load', error);
  }
})();`;
}
```

Generate `<script type="module" data-axhub-management-runtime>` from that source, add an idempotent `injectManagementRuntimeScript`, and replace the two response-path calls with one call. Delete obsolete dual-tag exports after their tests are migrated.

- [ ] **Step 4: Run the lifecycle test and verify it passes**

Run the Step 2 command again. Expected: PASS for sequencing, all three errors, idempotency, and React Refresh ordering.

- [ ] **Step 5: Commit the loader lifecycle change**

```bash
git add client/vite-plugins/clientPreviewPlugin.ts client/tests/quick-edit-runtime-injection.test.ts
git commit -m "fix: serialize make client runtime bootstrap"
```

### Task 2: Update Route Contracts And Verify The Client

**Files:**
- Modify: `client/tests/client-preview-routes.test.ts`
- Verify: `client/vite-plugins/clientPreviewPlugin.ts`
- Verify: `client/tests/quick-edit-runtime-injection.test.ts`

**Interfaces:**
- Consumes: `injectManagementRuntimeScript(html, serverOrigin)` from Task 1.
- Produces: route-level proof that management previews contain one loader and direct previews contain none.

- [ ] **Step 1: Replace route assertions with the single-loader contract**

Use these assertions for the primary management preview:

```ts
expect(html).toContain('data-axhub-management-runtime');
expect(html).toContain('http://localhost:5174/assets/dev-template-bootstrap.js');
expect(html).toContain('http://localhost:5174/runtime/quick-edit.js');
expect(html.match(/data-axhub-management-runtime/g)).toHaveLength(1);
expect(html.indexOf('data-axhub-management-runtime')).toBeLessThan(html.indexOf('__axhub-preview-loader.js'));
expect(html).not.toMatch(/<script\b[^>]*src="http:\/\/localhost:5174\/runtime\/quick-edit\.js"/u);
expect(html).not.toMatch(/<script\b[^>]*src="http:\/\/localhost:5174\/assets\/dev-template-bootstrap\.js"/u);
```

Keep expected-origin assertions because both URLs remain visible inside the loader source. Keep direct network preview assertions that neither URL is present. Compare the React Refresh marker against `data-axhub-management-runtime` instead of the deleted dev-template tag.

- [ ] **Step 2: Run the route suite and verify obsolete assertions fail**

```bash
cd client
pnpm exec vitest --run tests/client-preview-routes.test.ts
```

Expected before all route assertions are migrated: FAIL on obsolete independent tag markers or order assertions. Remove only assertions that describe the deleted dual-tag implementation.

- [ ] **Step 3: Run both focused suites**

```bash
cd client
pnpm exec vitest --run tests/quick-edit-runtime-injection.test.ts tests/client-preview-routes.test.ts
```

Expected: both files PASS with zero failed tests.

- [ ] **Step 4: Run the Make client typecheck**

```bash
cd client
pnpm run typecheck
```

Expected: exit code 0 with no TypeScript diagnostics.

- [ ] **Step 5: Inspect the final diff for scope and whitespace**

```bash
git diff --check -- client/vite-plugins/clientPreviewPlugin.ts client/tests/quick-edit-runtime-injection.test.ts client/tests/client-preview-routes.test.ts
git diff --stat -- client/vite-plugins/clientPreviewPlugin.ts client/tests/quick-edit-runtime-injection.test.ts client/tests/client-preview-routes.test.ts
```

Expected: no whitespace errors and changes limited to the three planned client files.

- [ ] **Step 6: Commit the route contract update**

```bash
git add client/tests/client-preview-routes.test.ts
git commit -m "test: cover make client runtime bootstrap ordering"
```
