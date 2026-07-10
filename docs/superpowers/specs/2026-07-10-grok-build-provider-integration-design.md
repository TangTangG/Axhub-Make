# Grok Build Provider Integration Design

## Context

The sibling `acp-ui` project now defines `grok-build` as a standard ACP provider backed by `grok agent stdio`, with an official npm fallback. Axhub Make maintains its own provider metadata for configuration persistence, settings, version health, and Make-owned canvas selectors, so it must recognize the same provider key before the two projects are released together.

The published `@axhub/acp` package does not yet include the local Grok Build changes. This integration therefore updates Make's source contract without pinning a local checkout or changing the dependency version. The ACP package and Make will be published in sync later.

## Goals

- Recognize `grok-build` everywhere Make accepts an ACP provider or prompt client.
- Show Grok Build in Make's AI Agent and annotation execution settings.
- Preserve Grok Build through config normalization, persistence, and ACP requests.
- Expose Grok Build in the Make-owned canvas selector when the runtime reports it or it is already selected.
- Detect the local Grok CLI version and query the official npm package for the latest version.
- Keep the provider usable when the local CLI is absent because acp-ui can use its npm fallback.
- Add focused regression coverage without disturbing unrelated worktree changes.

## Non-Goals

- Do not implement or duplicate the ACP provider process profile in Make.
- Do not add Grok authentication, token storage, or login UI.
- Do not change the ACP chat transport or session lifecycle.
- Do not add Grok-specific mode, thought-level, or image capabilities.
- Do not pin Make to a local acp-ui checkout or an unpublished package version.
- Do not broaden the default canvas provider shortlist.

## Provider Contract

Make will use the following metadata:

| Field | Value |
| --- | --- |
| provider key | `grok-build` |
| prompt client | `acp:grok-build` |
| label | `Grok Build` |
| default annotation model | `grok-build` |
| local version command | `grok --version` |
| npm package for latest version | `@xai-official/grok` |
| settings icon | LobeHub Grok icon |

The corresponding acp-ui runtime owns the process commands:

- Primary: `grok agent stdio`
- Fallback: `npx -y @xai-official/grok@0.2.93 agent stdio`

Make will not duplicate these process commands outside version health detection.

## Architecture And Data Flow

`src/common/acpModelConfig.ts` remains the canonical Make-side provider catalog. Adding Grok Build there derives the settings-table option and gives annotation execution its default model. The shared prompt-client and assistant-context unions will accept `acp:grok-build` and normalize the bare `grok-build` value to that prompt client.

Server config normalization will include `acp:grok-build` in accepted prompt clients and map the bare legacy-style key `grok-build` to it. ACP execution will then resolve the prompt client back to provider key `grok-build` before sending the existing request body to acp-ui.

The Make-owned canvas selector will add Grok Build to its label and ordering maps. Its fixed fallback shortlist remains Claude, Codex, and OpenCode. Grok Build appears only when included in runtime provider options or when it is the current selected provider, matching acp-ui's hidden-by-default behavior.

## Version Health And Availability

The existing agent-version API will recognize `grok-build`, run `grok --version`, and query `@xai-official/grok` for the latest published version. A missing local command remains visible as version-health information.

Unlike providers that require a local executable, Grok Build must remain selectable when local detection reports `missing`, because acp-ui has an official npm fallback. This exception will be represented in provider metadata rather than inferred from display labels or duplicated command strings. Other providers retain their current disabled-when-missing behavior.

If both the local command and acp-ui's npm fallback fail, the existing ACP startup error is surfaced. Make will not introduce a separate Grok error state.

## UI Behavior

The AI Agent table and annotation execution selector show `Grok Build` with the LobeHub Grok icon. The table continues to show local and latest version status through the existing UI.

Selecting Grok Build can be saved as the default prompt client or annotation prompt client. The model preference defaults to `grok-build` when Make needs a provider-owned annotation model fallback. No mode, thought level, authentication, or image controls are added.

## Testing

Implementation will follow test-driven development:

1. Extend existing provider contract tests so they fail until `grok-build` and `acp:grok-build` are accepted by client and server normalization.
2. Add version API expectations for `grok --version` and `@xai-official/grok`.
3. Add settings source assertions for the provider label, Grok icon, and fallback-aware availability.
4. Add canvas selector assertions for the label/order entry and selected-provider inclusion while preserving the fixed default shortlist.
5. Run the focused Vitest files, then Make server typechecking or the documented build command if focused tests pass.

Tests will not require a real Grok login or network-backed ACP session. Runtime process behavior remains covered by acp-ui's own provider regression suite.

## Release Boundary

This change intentionally leaves `@axhub/acp` at its current dependency version. Before releasing Make with Grok Build exposed, publish the matching acp-ui package and update the release lockfile through the normal synchronized release process. Development against the sibling checkout can continue through the existing `AXHUB_ACP_UI_PROJECT_ROOT` mechanism.

## Acceptance Criteria

- Make accepts and persists both `grok-build` and `acp:grok-build` as the Grok Build ACP provider.
- Settings allow Grok Build to be selected for default and annotation execution.
- A missing local `grok` command does not disable the provider option.
- Version health uses `grok --version` and latest-package metadata from `@xai-official/grok`.
- ACP requests carry provider key `grok-build` through the existing transport.
- Grok Build is not added to the fixed default canvas provider shortlist.
- Focused provider, settings, server-config, ACP runner, and canvas selector tests pass.
- No local acp-ui path, unpublished version, credential flow, or provider process implementation is added to Make.
