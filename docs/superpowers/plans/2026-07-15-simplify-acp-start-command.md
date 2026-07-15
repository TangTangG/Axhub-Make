# Simplify ACP Start Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop expanding ACP CORS arguments to every local address and omit the argument entirely for ACP's two default Make origins.

**Architecture:** Keep origin resolution in `assistantRuntime.ts`, where both displayed health hints and spawned ACP commands already consume it. Replace network-interface expansion with a small default-origin filter while retaining explicit environment origins.

**Tech Stack:** TypeScript 5.x, Node.js, Vitest, pnpm

## Global Constraints

- For `http://localhost:53817` and `http://127.0.0.1:53817`, omit `--cors-origin`.
- For another current Make origin, pass only that origin unless explicit environment origins were configured.
- Preserve `AXHUB_ACP_UI_CORS_ORIGIN` and `ACP_UI_CORS_ORIGINS` values without synthesizing variants.
- Use identical resolution for displayed commands and spawned commands.
- Do not change ACP or the Settings layout.

---

### Task 1: Simplify ACP CORS origin resolution

**Files:**
- Modify: `src/server/assistantRuntime.ts`
- Test: `src/server/__tests__/assistant-runtime-api.test.ts`

**Interfaces:**
- Consumes: `resolveAssistantMakeCorsOrigins(corsOrigin?, { env? })`
- Produces: a comma-separated string containing explicit environment origins plus a non-default current Make origin, or an empty string when only an ACP default origin is present.

- [ ] **Step 1: Write focused failing tests**

Add assertions covering the exact contract:

```ts
describe('resolveAssistantMakeCorsOrigins', () => {
  it.each([
    'http://localhost:53817',
    'http://127.0.0.1:53817',
  ])('omits the ACP default Make origin %s', (makeOrigin) => {
    expect(resolveAssistantMakeCorsOrigins(makeOrigin, { env: {} })).toBe('');
  });

  it('keeps only the current non-default Make origin', () => {
    expect(resolveAssistantMakeCorsOrigins('http://192.168.10.82:53817', { env: {} }))
      .toBe('http://192.168.10.82:53817');
  });

  it('preserves explicit origins without adding local variants', () => {
    expect(resolveAssistantMakeCorsOrigins('http://localhost:53817', {
      env: {
        AXHUB_ACP_UI_CORS_ORIGIN: 'https://configured.example.com',
        ACP_UI_CORS_ORIGINS: 'https://second.example.com',
      },
    })).toBe('https://configured.example.com,https://second.example.com');
  });
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
pnpm exec vitest run src/server/__tests__/assistant-runtime-api.test.ts
```

Expected: the new assertions fail because the current resolver adds localhost, loopback, and detected network-interface variants.

- [ ] **Step 3: Implement the minimal resolver**

Remove the `networkInterfaces` import and the local-host expansion helpers. Introduce the exact ACP defaults and filter only the caller-provided origin against them:

```ts
const DEFAULT_ACP_UI_CORS_ORIGINS = new Set([
  'http://localhost:53817',
  'http://127.0.0.1:53817',
]);

export function resolveAssistantMakeCorsOrigins(
  corsOrigin?: string,
  options: {
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  } = {},
): string {
  const env = options.env || process.env;
  const explicitOrigins = normalizeCorsOriginList(
    env.AXHUB_ACP_UI_CORS_ORIGIN,
    env.ACP_UI_CORS_ORIGINS,
  );
  const currentOrigins = normalizeCorsOriginList(corsOrigin)
    .split(',')
    .filter((origin) => origin && !DEFAULT_ACP_UI_CORS_ORIGINS.has(origin));
  return normalizeCorsOriginList(explicitOrigins, currentOrigins.join(','));
}
```

- [ ] **Step 4: Verify focused behavior and server types**

Run:

```bash
pnpm exec vitest run src/server/__tests__/assistant-runtime-api.test.ts
pnpm server:build
```

Expected: the focused Vitest file passes and the server TypeScript build exits successfully.

- [ ] **Step 5: Review and commit the implementation**

Run:

```bash
git diff --check -- src/server/assistantRuntime.ts src/server/__tests__/assistant-runtime-api.test.ts
git diff -- src/server/assistantRuntime.ts src/server/__tests__/assistant-runtime-api.test.ts
git add src/server/assistantRuntime.ts src/server/__tests__/assistant-runtime-api.test.ts
git commit -m "fix: simplify ACP start command origins"
```

Expected: only the resolver and its focused tests are included in the implementation commit.
