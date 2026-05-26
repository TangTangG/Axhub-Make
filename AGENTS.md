# AGENTS.md

This is the standalone Axhub Make publishing repository.

- Use `pnpm`; do not use npm or yarn.
- Keep React at 18.2.0.
- Do not commit local runtime data, build outputs, caches, or system files.
- Keep `vendor/` committed; it contains required vendor artifacts for standalone builds.
- Do not add monorepo `packages/` source directories to this repository unless explicitly requested.
- Client metadata files under `client/.axhub/make/` may keep `project.json`, `client.json`, and `README.md`; sessions, exports, dev server info, generated entries, and sidebar trees stay ignored.
