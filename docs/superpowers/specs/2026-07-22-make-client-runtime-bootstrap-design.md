# Make Client Runtime Bootstrap Design

## Problem

The Make client preview plugin currently injects two independently managed
scripts when `agentToolbar=host` is present:

- `/runtime/quick-edit.js` as a classic script.
- `/assets/dev-template-bootstrap.js` as a module script.

The classic script can execute and publish `axhub.quickEdit.runtimeReady`
before the module script has mounted `window.DevTemplateBootstrap.editors`.
The Make admin then enables Quick Edit from the early runtime signal, but an
immediate editor activation cannot find the editor API and reports that the
page has not integrated the real editor.

Existing tests verify generated tag order rather than the browser lifecycle.
One route test explicitly requires the classic quick-edit tag to precede the
module bootstrap, so the suite preserves the race instead of detecting it.

## Scope

The supported target is the new Make client running with the new Make Server.
Other client/server version combinations are not acceptance targets for this
change. Existing Server asset URLs and runtime behavior remain unchanged
because changing them is unnecessary for the target path and would increase
the regression surface.

The change must:

- Keep `agentToolbar=host` as the explicit activation condition.
- Give the new client preview a single runtime injection entry point.
- Publish the existing quick-edit ready signal only after the editor bootstrap
  is available.
- Preserve the current Make admin message protocol.
- Preserve direct network previews without management runtime injection.

The change must not:

- Use `Referer` as an implicit activation signal.
- Add a new Make Server route or health capability.
- Change `quick-edit.js`, `DevTemplateBootstrap`, or the Make admin handshake.
- Add fallback branches for older clients or Servers.
- Refactor unrelated preview routing, editor state, export, or error-reporting
  behavior.

## Architecture

The client preview plugin replaces the two independent injected tags with one
inline module loader identified by a single stable marker such as
`data-axhub-management-runtime`.

The loader performs this sequence:

1. Import `${serverOrigin}/assets/dev-template-bootstrap.js` and await module
   evaluation.
2. Verify that `window.DevTemplateBootstrap.editors.enable` is available.
3. Create and append a classic script for
   `${serverOrigin}/runtime/quick-edit.js`.
4. Let the existing quick-edit runtime publish
   `axhub.quickEdit.runtimeReady` after it loads.

Because quick-edit is not loaded until the editor API has been verified, its
existing ready message becomes a reliable signal for the new client path
without changing the protocol or the Make admin state model.

The loader remains ahead of the preview entry loader. The existing React
Refresh preamble injection remains ahead of all module scripts, including the
new management runtime loader, so importing the React-based editor bootstrap
continues to run with the refresh globals installed.

The preview plugin first replaces the template placeholder with the external
preview loader, identified by `data-axhub-preview-loader`, and lets Vite
transform that HTML. It then injects the management loader into the transformed
HTML immediately before the marked preview loader. The injection helper does
nothing when the final preview-loader marker is absent. This keeps the inline
management module outside Vite's HTML transform and prevents Vite from
rewriting it to an `html-proxy` module.

## Activation And Origin Resolution

Activation and origin discovery remain separate concerns:

- `shouldInjectManagementRuntime(requestUrl)` is the only activation gate and
  continues to require `agentToolbar=host`.
- `resolveAdminServerOrigin(projectRoot, req)` runs only after that gate passes.
- `Referer`, forwarded host, stored server info, and the default admin origin
  may continue to participate in origin discovery and health validation.
- A healthy `Referer` must never enable injection when the explicit query flag
  is absent.

This preserves the current boundary that direct network previews do not load
management-only runtime code.

## Loader Generation

The loader source is generated from a normalized Server origin. Dynamic URLs
must be embedded with structured JavaScript string serialization rather than
manual quoting. The generated loader is idempotent:

- HTML injection skips pages that already contain the stable loader marker.
- The loader does not emit separate static quick-edit or dev-template script
  tags.
- The dynamically created quick-edit script receives its existing runtime
  marker so runtime diagnostics remain recognizable after execution.

The implementation may remain in `clientPreviewPlugin.ts` when concise. It may
be extracted into one focused loader-source module if that makes the generated
code and tests easier to understand. No broader abstraction is required.

## Error Handling

The loader reports failures through the existing
`axhub.quickEdit.error` parent message. Error payloads distinguish these
stages:

- `bootstrap-import`: the editor bootstrap could not be fetched or evaluated.
- `bootstrap-api`: the module completed without exposing a usable editor API.
- `quick-edit-load`: the classic quick-edit script failed to load.

On any failure, the loader stops and does not continue to later stages. It
also logs the original error for local diagnosis. The Make admin already maps
`axhub.quickEdit.error` to its runtime error state, so no new host behavior is
needed.

## Testing

Replace source-order assertions with lifecycle assertions:

- Unit-test that one management runtime loader is generated and repeated
  injection is idempotent.
- Assert that generated preview HTML contains neither an independent external
  quick-edit tag nor an independent external dev-template bootstrap tag.
- Execute the generated loader in a controlled VM harness with a deferred
  bootstrap import. Assert that no quick-edit script is appended before the
  import resolves, and exactly one is appended afterward.
- Resolve the bootstrap without `editors.enable` and assert a
  `bootstrap-api` error with no quick-edit load.
- Reject the bootstrap import and assert a `bootstrap-import` error with no
  quick-edit load.
- Trigger the dynamically appended script error callback and assert a
  `quick-edit-load` error.
- Keep route coverage proving that `agentToolbar=host` injects the loader and a
  direct network preview does not, even when the request has a healthy admin
  `Referer`.
- Keep coverage proving the React Refresh preamble precedes the management
  runtime module.
- Keep real-Vite route coverage proving the final management loader remains
  inline and the response contains no management-runtime `html-proxy` module.

Run the focused Make client injection and preview-route tests, followed by the
client typecheck. No Server test is required because Server behavior and
routes are unchanged.

## Change Surface And Risk

Expected production changes are limited to
`client/vite-plugins/clientPreviewPlugin.ts` and, only if useful, one small
loader-source module. Expected test changes are limited to the existing
runtime injection and preview route suites, with an optional focused loader
lifecycle test.

The risk is low. The main risks are malformed generated JavaScript,
cross-origin module failure, incorrect React Refresh ordering, and duplicate
runtime initialization. Structured URL serialization, staged error reporting,
idempotency, and the deferred-import lifecycle test cover those risks without
touching the currently changing Make admin and Server runtime files.

## Release And Operation

The fix ships in the next Make client template version and is evaluated only
for that new client with the new Make Server. Already running client dev
servers must be restarted after upgrading the Vite plugin, and open preview
iframes must be refreshed so the new loader is present in generated HTML.
