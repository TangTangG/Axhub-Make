# AGENTS.md

This is the standalone Axhub Make publishing repository.

- Use `pnpm`.
- Keep `vendor/` committed; it contains required vendor artifacts for standalone builds.
- Do not commit local runtime data, build outputs, caches, or generated project metadata.
- Under `client/.axhub/make/`, keep only `client.json` and `README.md` in Git.
