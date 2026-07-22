# Make Client Template 0.1.15 Release Design

## Goal

Prepare and verify `@axhub/make-client` template version `0.1.15` without publishing it externally. The release candidate must include the current official skill and preview-runtime changes while excluding project-specific working data.

## Release Content

The release includes:

- replacement of `prototype-comments` with the `handle-comments` skill in both `.agents` and `.claude` skill directories;
- the shared Commentary storage conventions for `.axhub/make/comments/` and `.axhub/make/comment-assets/`;
- the matching Git ignore rules and template-seed metadata documentation;
- the preview management-runtime bootstrap changes made after `make-client-template-v0.1.14`;
- version `0.1.15`, matching release notes, and synchronized Make runtime defaults.

The release excludes:

- actual files under `.axhub/make/comments/` and `.axhub/make/comment-assets/`;
- project-specific `src/resources/prd/` content;
- the four `xunhang-logistics-*` prototypes;
- the local `trae` theme;
- local caches, reports, build output, review configuration, and other files already rejected by the template safety rules.

Deletion of the HTML review example is source cleanup only. The resource was not selected by `template-manifest.json`, so it does not need a release-note entry.

## Sidebar Generation

Do not edit or clean `client/.axhub/make/sidebar-tree.json` as part of release preparation. It is current project state and is not a release input.

The release process reads `client/template-seed/.axhub/make/sidebar-tree.json`, derives the allowed prototype and theme identifiers from `client/template-manifest.json`, and writes a newly filtered `.axhub/make/sidebar-tree.json` into the ZIP. The generated tree must contain every declared official item and omit project-only items.

## Metadata And Notes

Update:

- `client/package.json` to `0.1.15`;
- `client/RELEASE_NOTES.md` with the shipped skill, comment-storage, and preview-runtime changes;
- the version assertion in `scripts/release-make.test.mjs`;
- `client/template-seed/.axhub/make/README.md` with shared comment-storage behavior.

Run the template prepare command to synchronize `DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION` and `DEFAULT_MAKE_CLIENT_TEMPLATE_RELEASE_NOTES` in `src/common/makeClientTemplate.ts`. Do not edit generated release artifacts by hand.

## Verification

Verification must cover:

1. release helper tests and focused client preview-runtime tests;
2. a fresh `release:make-client-template:prepare` run;
3. a template-only dry run;
4. ZIP inspection proving `handle-comments` is present and `prototype-comments` is absent;
5. ZIP inspection proving real comment data, project PRDs, local prototypes, and Trae are absent;
6. generated sidebar inspection against the manifest-selected prototypes and themes;
7. manifest version, release notes, URLs, and SHA-256 consistency.

External GitHub or Gitee publishing remains outside this task and requires a separate explicit confirmation.
