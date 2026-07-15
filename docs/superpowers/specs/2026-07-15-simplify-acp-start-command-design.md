# Simplify ACP start command

## Goal

Keep Make's ACP start and repair command short while passing only the CORS origin that ACP actually needs.

## Behavior

- For `http://localhost:53817` and `http://127.0.0.1:53817`, omit `--cors-origin` because ACP already allows those origins by default.
- For any other current Make origin, pass only that origin through `--cors-origin`.
- Preserve explicitly configured `AXHUB_ACP_UI_CORS_ORIGIN` or `ACP_UI_CORS_ORIGINS` values.
- Do not enumerate local network-interface addresses or synthesize localhost variants.
- Use the same resolved arguments for automatic start/restart and the command shown in Settings.

## Scope

Change only Make's ACP CORS-origin resolution and its focused tests. Do not change ACP, endpoint probing, or the Settings layout.

## Verification

Cover default origins, a non-default LAN origin, explicit environment configuration, command hints, and spawned command arguments.
