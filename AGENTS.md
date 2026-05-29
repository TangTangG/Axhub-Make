# AGENTS.md

This is the standalone Axhub Make publishing repository.

- Use `pnpm` for this repository's development, tests, and release scripts.
- Do not force `pnpm` in published runtime or generated client projects. User environments may be Windows, may not have Git, and may not have pnpm; prefer `npm`/`npx`-safe flows outside development-only docs or scripts.
- Keep `vendor/` committed; it contains required vendor artifacts for standalone builds.
- Do not commit local runtime data, build outputs, caches, or generated project metadata.
- Under `client/.axhub/make/`, keep only `client.json`, `README.md`, and the template seed `sidebar-tree.json` in Git.
