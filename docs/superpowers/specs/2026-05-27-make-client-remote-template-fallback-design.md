# Make Client Remote Template Fallback Design

## Goal

When the published `@axhub/make` server creates a new Make client project, it must fetch the client template from a remote repository because the npm package does not include the local `client/` template directory.

## Design

`/api/projects/make/create` will resolve a remote template source before copying files into the target project. The primary source is the current Axhub Make repository on GitHub, scoped to the `client/` directory. If the primary clone or sparse checkout fails, the server retries the same `client/` directory from the Gitee mirror at `https://gitee.com/axhub/Axhub-Make.git`.

The download step uses the existing `runLocalCommand` abstraction with command plus args, `shell: false`, explicit `cwd`, bounded output, and clear timeout handling. It creates a temporary directory under the OS temp folder, runs a shallow sparse Git checkout, copies only the checked-out `client/` folder through the existing template-copy ignore rules, then removes the temporary directory.

There is no embedded-template fallback. If both remote sources fail, the create API returns `MAKE_CLIENT_TEMPLATE_UNAVAILABLE` with source failure details. The marker written into the new project records the repository URL that actually succeeded.

## Testing

Server tests cover:

- primary remote template succeeds and Gitee is not used;
- primary fails and the Gitee mirror succeeds;
- both remote sources fail and the API returns `MAKE_CLIENT_TEMPLATE_UNAVAILABLE`;
- request-supplied template roots remain ignored because the template source is server-owned.
