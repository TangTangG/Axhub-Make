# Make Server Tests

Server tests live in this directory and run with Vitest in the Node environment.

## Commands

```bash
pnpm --filter @axhub/make server:test
pnpm --filter @axhub/make server:test:coverage
pnpm --filter @axhub/make server:test:api
pnpm --filter @axhub/make server:test:runtime
pnpm --filter @axhub/make server:test:exports
pnpm --filter @axhub/make exec vitest run src/server/__tests__/projects-git-api.test.ts
```

Use `server:test` for the full server suite. It runs with V8 coverage enabled and prints the server coverage summary at the end. Avoid `pnpm --filter @axhub/make test -- src/server/__tests__`; it can run non-server tests because the package `test` script already includes `vitest run`.

Coverage scope:

- `pnpm --filter @axhub/make test`: reports coverage for all `src/**/*.{ts,tsx}`.
- `pnpm --filter @axhub/make server:test`: reports coverage for `src/server/**/*.{ts,tsx}` only.
- Watch commands skip coverage for faster feedback.

## File Map

- `adminStatic.test.ts`: Admin HTML injection and static file safety.
- `adminRoot.test.ts`: Default Admin asset root resolution for packaged and local runs.
- `agent-open-api.test.ts`: CLI/Web agent availability and `/api/agent/*/open`.
- `assistant-runtime-api.test.ts`: Assistant runtime probe, bootstrap, and LAN URL rewrite.
- `cli.test.ts`: CLI argument parsing and entrypoint detection.
- `export-make-api.test.ts`: Figma Make artifact probe, repair prompt, and `.fig` download.
- `http.test.ts`: `startMakeServer` integration, health/context, Admin smoke, workspace navigation.
- `http-routing.test.ts`: Method handling and unknown `/api/*` JSON 404.
- `ide-open-api.test.ts`: IDE availability and `/api/ide/open`.
- `media-api.test.ts`: Media folder/file/delete API and traversal protection.
- `quickEditRuntimeApi.test.ts`: Quick Edit runtime script and export postMessage behavior.
- `runtimeProxy.test.ts`: Runtime-only route ownership and proxy target paths.
- `projects-registry-api.test.ts`: Project CRUD, active project, metadata errors, communication records.
- `projects-resource-capabilities-api.test.ts`: Effective resource-write capability gates.
- `projects-prototype-upload-api.test.ts`: Prototype folder/zip/screenshot upload paths.
- `projects-resource-writes-api.test.ts`: Declared docs/templates/data/themes/media writes and metadata sync.
- `projects-legacy-api.test.ts`: Legacy compatibility routes and explicit `projectId` handling.
- `projects-config-api.test.ts`: Server-owned assistant/automation preferences.
- `projects-data-theme-api.test.ts`: Data table and theme APIs.
- `projects-git-api.test.ts`: Git status/history/diff/commit/restore/build-version/version-file.
- `projects-export-bridge-api.test.ts`: Source-backed exports, adapter-required records, bridge/image proxy.
- `projects-api.helpers.ts`: Shared project API fixtures only; not a test entry.

## Conventions

- Keep tests colocated here for `src/server` behavior.
- Add a server test whenever adding or changing a server route, proxy rule, static serving rule, CLI behavior, or project capability contract.
- Keep one capability domain per file. If a file grows beyond roughly 700 lines, split it by behavior.
- Put shared temp-directory, metadata, registry, and server-start helpers in `*.helpers.ts`; keep assertions in `*.test.ts`.
- Path, upload, delete, proxy, and download routes need explicit traversal or outside-root coverage.
