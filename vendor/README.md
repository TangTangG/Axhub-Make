# Make Server Vendor Packages

This directory stores built artifacts for internal packages that are not copied
as source into the standalone Axhub-Make repository.

Run `pnpm --filter @axhub/make vendor:sync` from the workspace root to refresh
the artifacts from the source packages.
