# Feishu Base Review Submission Design

## Goal

Add Feishu review submission beside the existing LAN review submission flow without increasing the fixed height of the review panel footer. Each prototype owns one Feishu Base. Each Base record represents one review report, and Axhub can manually import new or changed records into the existing local Markdown review list.

The integration must keep Feishu permissions under the user's control, avoid exposing raw URLs in the panel, preserve the current LAN submission behavior, and never install or authenticate external tooling silently.

## Confirmed Product Decisions

- Use Feishu Base rather than Docx or a Drive-native Markdown file.
- Bind one Base to one prototype.
- Store one review report per Base record.
- Create the Base immediately when the Feishu switch is enabled for the first time. Keep the switch off unless creation succeeds.
- Keep the Base and its local binding when the switch is disabled. Re-enable by validating and reusing the existing Base.
- Import new and changed records incrementally when the user explicitly clicks the fetch action.
- Do not delete local reports when the corresponding remote record is deleted.
- Treat Base as the source of truth for Feishu-sourced reports. A later fetch may replace manual edits made to the generated local Markdown file.
- Do not render the raw Base URL. Expose only a compact open-link action.
- Keep the existing human-review footer content at its current fixed height.
- Do not add legacy CLI compatibility branches. If the installed CLI lacks the required Base capabilities, ask the user to update it.

## Alternatives Considered

### Feishu Docx with one section per report

Docx offers the best reading and collaborative editing experience. It does not provide a native record identity for each report, so Axhub would need visible or hidden delimiters and a fragile parser to detect inserts, edits, and deletions.

### One Drive-native Markdown file

A native Markdown file preserves the report source most directly. It remains one flat file without independent record IDs, and stable link discovery depends on additional Drive operations. It also requires newer CLI Markdown commands that are not part of the baseline installed on many machines.

### Feishu Base with one record per report

Base provides stable record IDs, native multi-record storage, timestamps, pagination, and direct field mapping. Markdown is stored as plain text in Feishu and rendered only after import into Axhub. The product does not require a rich reading experience in Feishu, so this trade-off is acceptable. This is the chosen design.

## User Interface

The human-review tab keeps its current two 32-pixel action rows inside the existing 72-pixel content height.

The first row remains the report submission row. Its right-side actions are conditionally composed from:

- the existing LAN skill submission action when LAN submission is enabled;
- a compact `获取飞书` action when Feishu review is enabled and bound;
- the existing `上传报告` action.

The second row places the LAN and Feishu controls side by side. Each control has a concise label, help tooltip, and switch. When a Base binding is available, an external-link icon beside the Feishu control opens the Base in a new window. The URL itself is never rendered.

The footer does not add a third row and does not grow vertically. Individual switches and actions own their loading states so creating a Base does not block unrelated upload or LAN controls.

## Remote Data Model

The Base title uses the prototype title when available and falls back to the prototype ID. Axhub creates one table named `评审报告` with the following logical fields:

| Field | Base type | Required | Mapping |
| --- | --- | --- | --- |
| `标题` | text | yes | Local report title and primary display field |
| `评审人` | text | no | Local `reviewer`, defaulting to `飞书评审` |
| `评分` | number | no | Integer from 0 through 100 |
| `来源` | text or select | no | Local source label, defaulting to `feishu-base` |
| `Markdown 正文` | text | yes | Complete Markdown source |

Base record metadata supplies the creation and last-modified timestamps. The Feishu `record_id` is the only remote identity; users do not maintain a separate ID field.

The integration must validate the actual returned Base and table IDs after creation instead of deriving them from names. It must also validate the created field schema before enabling the integration.

## Local Configuration

The existing ignored file `src/prototypes/<prototype-id>/.spec/reviews/config.json` remains the per-prototype review integration store. It keeps the existing LAN flag and gains an optional Feishu binding:

```json
{
  "schemaVersion": 1,
  "lanSubmitEnabled": true,
  "feishuReview": {
    "enabled": true,
    "baseToken": "...",
    "tableId": "...",
    "url": "https://...",
    "createdAt": "2026-07-14T00:00:00.000Z"
  }
}
```

The shared config writer must merge fields rather than replacing the whole object. Toggling LAN submission must not erase the Feishu binding, and toggling Feishu review must not alter the LAN flag.

The binding contains resource identifiers and an access-controlled link but no app secret, access token, refresh token, password, or other Feishu credential. The file is already ignored from Git and remains local runtime state.

## CLI Boundary

Add a focused server-side Feishu review service. It uses `runLocalCommand` from `src/server/localCommand.ts` with an executable and argument array; it never constructs a shell command string and never introduces `zx`.

Before the first create or fetch operation, the service checks:

1. `lark-cli` can be resolved in the Make server environment.
2. the CLI exposes the required Base create, table/field inspection, and record list capabilities;
3. a verified user identity is available;
4. the required Base scopes are authorized.

Capability checks are authoritative. The implementation does not emulate missing commands for older CLI releases. An unsupported installation returns an update instruction using the official npm/npx-safe installation flow.

The service disables CLI update and skills notices for machine-readable calls, requests JSON output, checks both the process exit status and the CLI `ok` envelope, and maps CLI errors to stable Make error codes. It must not log credential-bearing output.

## Enable and Disable Lifecycle

When a user enables Feishu review for the first time:

1. the client sends an enable request and marks only the Feishu switch pending;
2. the server verifies the CLI and user authentication;
3. the server creates the Base and the `评审报告` schema;
4. the server resolves the canonical Base URL and validates the returned resource IDs and fields;
5. the server persists the binding with `enabled: true`;
6. the response enables the switch and exposes the compact open-link and fetch actions.

If any step before persistence fails, the switch remains off. If a remote Base was created but later validation or local persistence fails, Axhub reports the partial creation and does not silently delete the remote Base.

Disabling Feishu review changes only `feishuReview.enabled` to `false`. It does not delete the Base or clear its binding. Re-enabling first validates the existing resource and reuses it. A missing Base may be recreated only after the service can distinguish a true not-found result from a temporary authentication, permission, rate-limit, or network failure; other failures keep the switch off and preserve the binding for recovery.

The first version does not embed the Feishu configuration or OAuth login flow in Make and does not install or update the CLI automatically. Missing setup produces a concise error with the exact next command. The user completes setup outside Make and retries the switch.

## Fetch and Incremental Sync

`获取飞书` starts a manual pull. The server reads every record using deterministic serial pagination; a default page or a response with `has_more` is never treated as the complete table.

Each valid record maps to:

```text
src/prototypes/<prototype-id>/.spec/reviews/feishu-<record-id>.md
```

The generated Markdown uses the existing review frontmatter fields and adds Feishu provenance fields that do not change rendering:

```yaml
---
title: "..."
reviewer: "..."
createdAt: "..."
source: "feishu-base"
score: 86
feishuRecordId: "rec..."
feishuUpdatedAt: "..."
---
```

The filename and `feishuRecordId` establish identity. The normalized generated content establishes equality:

- no local file: create one report;
- same generated content: skip the record without touching the file modification time;
- different generated content: replace the Feishu-sourced local file atomically;
- missing remote record: leave the local file untouched;
- empty body, invalid score, or malformed required fields: skip that record and include it in the sync summary.

The response reports `created`, `updated`, `unchanged`, `skipped`, and `failed` counts plus record-scoped error details. After a successful or partially successful pull, the client reloads the normal local review list and opens the newest created or updated report when one exists.

## API Shape

Add Feishu-specific endpoints rather than changing the LAN submit endpoint contract:

- `GET /api/review-reports/feishu-config` reads the current binding and enabled state.
- `PUT /api/review-reports/feishu-config` enables or disables Feishu review. Enabling may create or validate the Base.
- `POST /api/review-reports/feishu-sync` imports new and changed records.

All endpoints require a valid project and prototype context and reuse the existing prototype path-safety checks. The config response may return the Base URL for the client's open-link action, but the UI does not display the raw value.

The existing LAN config, submit, exists, upload, list, detail, and delete endpoint contracts remain unchanged.

## Error Handling

Stable error categories distinguish:

- CLI missing;
- CLI capability or version unsupported;
- CLI not configured or user not authenticated;
- missing Feishu scope;
- Base not found;
- Base permission denied;
- quota exceeded;
- rate limited;
- malformed CLI JSON;
- incomplete Base schema;
- invalid remote record;
- local configuration or report write failure.

Authentication, permission, quota, and rate-limit failures never trigger automatic Base recreation. Create and sync operations are serialized per prototype to prevent duplicate Bases or concurrent writes. Repeated clicks while an operation is pending are ignored on the client and rejected or coalesced on the server.

## Cost and Permission Boundaries

The CLI is MIT licensed. Feishu's published free plan currently includes Base, and this design uses only basic Base tables and fields rather than paid advanced Base features. Feishu plan capacity, record, storage, and API rate limits still apply. Axhub surfaces quota and rate-limit errors and never initiates a purchase or billing action.

Axhub does not manage the Base's sharing policy. The Base opens under the authenticated user's ownership or granted access, and the user controls collaborators and link permissions in Feishu.

## Testing

### Server service tests

- capability and authentication probes;
- argument-array construction without shell interpolation;
- JSON success and error envelope parsing;
- Base creation, schema validation, existing-binding reuse, and partial-creation failures;
- serial pagination and rate-limit/error mapping;
- record normalization and score validation;
- create, update, unchanged, invalid, and remote-deletion sync cases;
- atomic local writes and preservation of unrelated local reports.

### API tests

- valid project/prototype scoping and unsafe path rejection;
- first enable, disable without deletion, and re-enable with reuse;
- failed enable leaves the switch off;
- config merge preserves both LAN and Feishu state;
- sync summary and report-list refresh behavior;
- existing LAN and upload APIs retain their contracts.

### Client tests

- LAN and Feishu controls render side by side;
- the footer retains the fixed two-row height;
- the raw URL is never rendered;
- the external-link action appears only with a stored binding;
- fetch appears only when enabled and cannot run twice concurrently;
- enable failure restores the off state and exposes an actionable error;
- successful or partial sync reloads reports and displays the summary.

### Verification commands

Run the focused Vitest suites for review APIs, review configuration, the Feishu CLI service, API client methods, `UiReviewPanel`, and presentation prop wiring. Then run the Axhub Make workspace type check and production build required by the package. When the local Make server is healthy, verify the two-row footer, both switches, compact link action, enable failure state, and manual fetch flow in the browser.

## Scope

This feature covers Base creation, per-prototype binding, a compact open-link action, manual pull synchronization, local Markdown generation, and actionable setup/errors.

It does not implement automatic background synchronization, push local reports to Feishu, remote deletion propagation, Base permission management, embedded Feishu OAuth/configuration, silent CLI installation or upgrades, legacy CLI emulation, multiple Bases per prototype, or a rich Markdown reader inside Feishu.
