# Explicit Project API Scope Design

## Problem

Make can open a project through a URL such as `/?projectId=project-b` without changing the server registry's global active project. This is required for independent browser pages, but project-scoped Admin requests currently use two different sources of truth:

- the Admin page renders resources from `workspace.activeProjectId`;
- project-scoped server handlers fall back to the registry's active project when a request omits `projectId`.

When the page displays project B while the registry still marks project A active, a request containing only a relative resource path such as `prototypes/home` resolves that path inside A. The visible failure is HTML export reporting missing source metadata, but the same ambiguity affects reads, writes, publishing, AI execution, and generated artifact history.

The Admin UI and management server are built, published, and started together as one `@axhub/make` product. There is no supported compatibility case where an old Admin frontend must continue calling a new management server. The official `@axhub/make-client` preview runtime does not call the project-scoped management endpoints covered by this design.

## Goals

- Make every project-scoped management request identify its project explicitly.
- Prevent project-scoped server routes from silently falling back to the global active project.
- Keep independent Admin pages and deep links isolated from one another.
- Prevent stale asynchronous responses and singleton stores from leaking state across projects with equal resource paths.
- Update repository smoke and regression callers with the same explicit project contract.
- Add regression coverage proving that a request for project B never reads from or writes to active project A.

## Non-Goals

- Removing the registry's active project concept from project selection or runtime proxying.
- Changing project IDs, resource paths, or metadata layout.
- Supporting an old Admin bundle against a new management server.
- Refactoring unrelated API response formats or resource implementations.
- Adding new dependencies.

## Project Identity Contract

Every management request belongs to one of three categories:

1. Global request: operates on Make itself and requires no project identity.
2. Path-scoped request: embeds the project ID in a route such as `/api/projects/:projectId/resources`.
3. Project-scoped request: must provide a non-empty `projectId` through query, JSON body, or multipart form data.

Normal Admin requests use a query parameter as the canonical transport, including POST, PUT, and DELETE requests:

```text
/api/export-html?projectId=project-b&path=prototypes/home
```

JSON body and multipart extraction remain available where the request protocol already requires them, including review submission and file upload flows. A project-scoped request without an explicit ID fails before metadata, files, configuration, commands, or external publishing are accessed.

The server returns:

```json
{
  "ok": false,
  "code": "PROJECT_ID_REQUIRED",
  "error": "Project-scoped API requires projectId"
}
```

with HTTP 400 when the ID is missing. An unknown ID continues to return HTTP 404 with `code: "project-not-found"`. `no-active-project` is reserved for global project-selection and startup behavior and is not a valid project-scoped API result.

## Frontend Architecture

`workspace.activeProjectId` is the only operational source of project identity after initial bootstrap. `window.location.search` may select the initial project, but API services and stores must not read the URL to infer the current project.

A focused project-scope utility provides the shared contract:

```ts
export interface ProjectScope {
  projectId: string;
}

export function requireProjectScope(projectId: string | null | undefined): ProjectScope;
export function withProjectScope(url: string, scope: ProjectScope): string;
export function withProjectScopeBody<T extends Record<string, unknown>>(
  body: T,
  scope: ProjectScope,
): T & { projectId: string };
```

`requireProjectScope` trims and validates the ID and throws a user-facing error before `fetch` is called. Existing helpers that independently read the URL or optionally append a project ID are replaced or routed through this utility.

Project-scoped service methods require `ProjectScope` or a non-optional `projectId`. React containers pass `workspace.activeProjectId` to dialogs, resource actions, settings, data views, version management, and AI tools. Download URLs and server-generated follow-up URLs retain the same scope.

## Server Architecture

The global registry active project remains responsible for project-list defaults, explicit project switching, and runtime proxy selection. It is not an authority for project-scoped management APIs.

Project-scoped route handlers call `resolveProjectContext` in `explicit-required` mode. Early domain handlers, the shared fallback request context, source-backed exports, cloud publishing, AI APIs, review APIs, Git APIs, and resource APIs must all preserve this rule. Global and path-scoped project registry routes remain unchanged.

Server-generated project asset URLs include the resolved `projectId`. This includes Axure export code paths, AI artifact assets, canvas screenshots, media files, document open-system actions, and other URLs that trigger a second management request.

## API Scope

Global routes include health, Make-state health, version, project registry operations, project creation/import/clone, folder browsing, global agent version detection, Axhub authorization state, and Axure Bridge availability.

Explicit project scope is required for these route families:

- config and access: `/api/config*`, `/api/access/*`;
- resources: `/api/entries.json`, `/api/prototypes/*`, `/api/docs/*`, `/api/themes/*`, `/api/data/*`, `/api/template-library/*`, `/api/theme-library/*`;
- workspace and files: `/api/workspace/*`, `/api/canvas/*`, `/api/source`, `/api/zip`, `/api/upload*`, `/api/media/*`, `/api/spec-doc/*`, `/api/markdown-file*`;
- exports and checks: `/api/export-html`, `/api/export-make`, `/api/export-index-bundle`, `/api/axure-export-code`, `/api/code-review`, `/api/axure-api-preview`;
- publishing and reviews: `/api/cloud-publishing/*`, project-bound Axhub publishing, `/api/review-reports/*`;
- AI and local tools: `/api/ai/runs`, `/api/ai/artifact-history*`, `/api/ai/generation-tasks`, `/api/assistant/*`, `/api/ide/open`, project-opening agent routes;
- versioning and legacy resource operations: `/api/git/*`, `/api/delete`, `/api/rename`, `/api/copy`, `/api/items/check-references`.

Routes under `/api/projects/:projectId/*` already satisfy the explicit identity contract through their path and do not need a duplicate query parameter.

## Asynchronous Isolation

Each request captures the project scope at the time the user starts the operation. A later project switch does not retarget the request. When an asynchronous read completes, the UI applies its result only if the captured project ID still equals the current workspace project ID.

Project-owned singleton stores use a composite scope key:

```text
projectId + ":" + targetPath
```

This applies to AI image tasks, generation artifact history, prototype generation tasks where persisted state is project-owned, and any resource cache that currently keys only by a relative path. Switching from `project-a/prototypes/home` to `project-b/prototypes/home` clears and reloads state instead of treating the resource as unchanged.

## Error Handling

- The frontend rejects an empty project scope before sending the request and shows `请先选择项目`.
- The server independently rejects missing and unknown IDs before project I/O.
- Capability errors such as missing source metadata remain HTTP 424 after the project has been resolved correctly.
- Operation failures remain HTTP 500 and include the resolved project ID where existing response contracts support it.
- A stale response from a previous project is ignored rather than displayed in the new project.
- Mutations that started before a switch complete against the captured original project, and their result does not update the new project's local UI state.

## Testing Strategy

Frontend contract tests cover project-scope URL/body construction, rejection of empty IDs, explicit scope on every affected service, and generated download URLs. Source-contract tests prevent known project-scoped route families from returning to bare `fetch('/api/...')` calls.

Store tests configure two projects with the same `targetPath` and verify a reload, independent state, project-scoped asset URLs, and stale-response suppression.

Server integration tests use this invariant:

```text
registry active project = project-a
request projectId = project-b
```

Representative reads and writes cover configuration, all export variants, source ZIP, theme and data mutations, cloud publishing, AI execution working directory, artifact history, IDE/agent opening, and Git operations. Every mutation test also verifies that project A remains unchanged.

Missing-ID tests cover each project-context extraction style and assert HTTP 400 `PROJECT_ID_REQUIRED`. Unknown-ID tests assert HTTP 404 `project-not-found`. Spies or unchanged filesystem assertions prove that neither failure reaches active-project metadata, files, command execution, or publishing.

Repository smoke, real ACP regression, and Midscene scripts provide their registered project ID on project-scoped calls. Final validation runs focused frontend and server tests, TypeScript server build, Admin build, and smoke coverage.

## Acceptance Criteria

- With registry active project A and Admin workspace project B, every project-scoped read, write, export, publish, AI, IDE, and Git action targets B.
- A project-scoped request without `projectId` returns HTTP 400 and never touches A.
- Server-generated follow-up URLs preserve B.
- Switching between equal relative paths in different projects reloads project-owned stores and cannot display stale state.
- Global project registry, project creation, project switching, health, version, and folder browsing behavior remains unchanged.
- The official Make client preview runtime requires no compatibility change.
