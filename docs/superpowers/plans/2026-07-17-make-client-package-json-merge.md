# Make Client package.json Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve project-owned package dependencies, scripts, and top-level fields during Make client upgrades while letting the official template win every conflict.

**Architecture:** Add a focused pure module that parses, validates, merges, and serializes Make client package manifests. The existing update orchestrator will validate the current manifest before any template write, build one merged result, back up the original file, and atomically write the merged manifest instead of copying the template manifest verbatim.

**Tech Stack:** TypeScript 5.x, Node.js `fs`/`path`/`crypto`, Vitest 4, pnpm workspace scripts.

## Global Constraints

- Use `pnpm` for repository development and tests; do not add a runtime dependency.
- Preserve project-only keys in `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`, and `scripts`.
- Let the official template win same-name dependency and script conflicts.
- If the template declares a dependency in any dependency section, remove the project's same-name declaration from every dependency section before applying the template declaration.
- Preserve project-only top-level fields; let the official template win all other top-level conflicts.
- Reject invalid manifests before writing any project file.
- Keep `package.json` in the existing `plannedFiles` and `writtenFiles` API fields.
- Keep the existing backup, install-warning, metadata-sync, and lockfile behavior.
- Preserve unrelated staged and working-tree changes; every commit must use an explicit pathspec.

---

## File Structure

- Create `src/server/makeClientPackageJson.ts`: package manifest parsing, validation, merge rules, and deterministic serialization.
- Create `src/server/makeClientPackageJson.test.ts`: focused tests for every merge rule and invalid input.
- Modify `src/server/makeClientProject.ts`: error mapping, pre-write preparation, atomic package write, and upgrade integration.
- Modify `src/server/__tests__/projects-make-client-api.test.ts`: full update-path regression tests for preservation, official conflict precedence, backups, and invalid project manifests.

### Task 1: Pure Package Manifest Merge

**Files:**
- Create: `src/server/makeClientPackageJson.ts`
- Test: `src/server/makeClientPackageJson.test.ts`

**Interfaces:**
- Produces: `MakeClientPackageJsonSource = 'project' | 'template'`.
- Produces: `MakeClientPackageJsonError` with a public `source` property.
- Produces: `parseMakeClientPackageJson(source: MakeClientPackageJsonSource, content: string): Record<string, unknown>`.
- Produces: `mergeMakeClientPackageJson(projectPackage: Record<string, unknown>, templatePackage: Record<string, unknown>): string`.

- [ ] **Step 1: Write failing merge and validation tests**

Create `src/server/makeClientPackageJson.test.ts` with tests that use these representative inputs:

```ts
import { describe, expect, it } from 'vitest';

import {
  MakeClientPackageJsonError,
  mergeMakeClientPackageJson,
  parseMakeClientPackageJson,
} from './makeClientPackageJson.ts';

describe('makeClientPackageJson', () => {
  it('preserves project-only fields and lets the template win conflicts', () => {
    const project = parseMakeClientPackageJson('project', JSON.stringify({
      name: 'local-name',
      version: '0.1.0',
      customConfig: { enabled: true },
      scripts: { dev: 'local-vite', 'deploy:staging': 'deploy-staging' },
      dependencies: { shared: '1.0.0', 'project-runtime': '2.0.0' },
      devDependencies: { moved: '1.0.0', 'project-tool': '3.0.0' },
      peerDependencies: { 'project-peer': '^4.0.0' },
      optionalDependencies: { 'project-optional': '^5.0.0' },
    }));
    const template = parseMakeClientPackageJson('template', JSON.stringify({
      name: '@axhub/make-client',
      version: '0.2.0',
      scripts: { dev: 'vite', build: 'vite build' },
      dependencies: { shared: '2.0.0', moved: '2.0.0', 'official-runtime': '1.0.0' },
      devDependencies: { 'official-tool': '1.0.0' },
    }));

    expect(JSON.parse(mergeMakeClientPackageJson(project, template))).toEqual({
      name: '@axhub/make-client',
      version: '0.2.0',
      customConfig: { enabled: true },
      scripts: {
        dev: 'vite',
        'deploy:staging': 'deploy-staging',
        build: 'vite build',
      },
      dependencies: {
        'project-runtime': '2.0.0',
        shared: '2.0.0',
        moved: '2.0.0',
        'official-runtime': '1.0.0',
      },
      devDependencies: {
        'project-tool': '3.0.0',
        'official-tool': '1.0.0',
      },
      peerDependencies: { 'project-peer': '^4.0.0' },
      optionalDependencies: { 'project-optional': '^5.0.0' },
    });
  });

  it('serializes without mutating either input', () => {
    const project = parseMakeClientPackageJson('project', '{"scripts":{"custom":"run"}}');
    const template = parseMakeClientPackageJson('template', '{"scripts":{"dev":"vite"}}');
    const projectBefore = structuredClone(project);
    const templateBefore = structuredClone(template);

    expect(mergeMakeClientPackageJson(project, template)).toBe([
      '{',
      '  "scripts": {',
      '    "custom": "run",',
      '    "dev": "vite"',
      '  }',
      '}',
      '',
    ].join('\n'));
    expect(project).toEqual(projectBefore);
    expect(template).toEqual(templateBefore);
  });

  it.each([
    ['project', '{'],
    ['template', '[]'],
    ['project', '{"scripts":null}'],
    ['template', '{"dependencies":[]}'],
  ] as const)('rejects invalid %s package content', (source, content) => {
    expect(() => parseMakeClientPackageJson(source, content)).toThrow(MakeClientPackageJsonError);
  });
});
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```bash
pnpm exec vitest run src/server/makeClientPackageJson.test.ts
```

Expected: FAIL because `./makeClientPackageJson.ts` does not exist.

- [ ] **Step 3: Implement the pure parser and merge**

Create `src/server/makeClientPackageJson.ts` with:

```ts
export type MakeClientPackageJsonSource = 'project' | 'template';

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;
const KEY_MERGE_FIELDS = [...DEPENDENCY_FIELDS, 'scripts'] as const;

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export class MakeClientPackageJsonError extends Error {
  constructor(public readonly source: MakeClientPackageJsonSource, message: string) {
    super(message);
    this.name = 'MakeClientPackageJsonError';
  }
}

export function parseMakeClientPackageJson(
  source: MakeClientPackageJsonSource,
  content: string,
): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    throw new MakeClientPackageJsonError(source, `Invalid ${source} package.json: ${message}`);
  }
  if (!isJsonRecord(parsed)) {
    throw new MakeClientPackageJsonError(source, `${source} package.json must contain an object`);
  }
  for (const field of KEY_MERGE_FIELDS) {
    if (field in parsed && !isJsonRecord(parsed[field])) {
      throw new MakeClientPackageJsonError(source, `${source} package.json field ${field} must contain an object`);
    }
  }
  return parsed;
}

function fieldRecord(pkg: JsonRecord, field: string): JsonRecord {
  return isJsonRecord(pkg[field]) ? pkg[field] : {};
}

export function mergeMakeClientPackageJson(
  projectPackage: JsonRecord,
  templatePackage: JsonRecord,
): string {
  const merged: JsonRecord = { ...projectPackage, ...templatePackage };
  const templateDependencyNames = new Set(
    DEPENDENCY_FIELDS.flatMap((field) => Object.keys(fieldRecord(templatePackage, field))),
  );

  for (const field of DEPENDENCY_FIELDS) {
    const projectOnly = Object.fromEntries(
      Object.entries(fieldRecord(projectPackage, field))
        .filter(([name]) => !templateDependencyNames.has(name)),
    );
    const templateDependencies = fieldRecord(templatePackage, field);
    const next = { ...projectOnly, ...templateDependencies };
    if (field in projectPackage || field in templatePackage || Object.keys(next).length > 0) {
      merged[field] = next;
    } else {
      delete merged[field];
    }
  }

  const scripts = {
    ...fieldRecord(projectPackage, 'scripts'),
    ...fieldRecord(templatePackage, 'scripts'),
  };
  if ('scripts' in projectPackage || 'scripts' in templatePackage || Object.keys(scripts).length > 0) {
    merged.scripts = scripts;
  } else {
    delete merged.scripts;
  }

  return `${JSON.stringify(merged, null, 2)}\n`;
}
```

- [ ] **Step 4: Run the focused unit test and TypeScript check**

Run:

```bash
pnpm exec vitest run src/server/makeClientPackageJson.test.ts
pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: all package merge tests pass and TypeScript exits with code 0.

- [ ] **Step 5: Commit the isolated merge unit**

```bash
git add -- src/server/makeClientPackageJson.ts src/server/makeClientPackageJson.test.ts
git commit --only -m "feat: add make client package manifest merge" -- src/server/makeClientPackageJson.ts src/server/makeClientPackageJson.test.ts
```

### Task 2: Upgrade Pipeline Integration

**Files:**
- Modify: `src/server/makeClientProject.ts:40-50,192-220,1690-1733,1935-2051`
- Modify: `src/server/__tests__/projects-make-client-api.test.ts:161-223,4394-4451,4590-4675`
- Test: `src/server/__tests__/projects-make-client-api.test.ts`

**Interfaces:**
- Consumes: `MakeClientPackageJsonError`, `parseMakeClientPackageJson`, and `mergeMakeClientPackageJson` from Task 1.
- Produces: `MAKE_CLIENT_PACKAGE_INVALID` API error with phase `merge-package` and `details.source`/`details.filePath`.
- Produces: an atomic package writer used only for the merged `package.json` update override.

- [ ] **Step 1: Add failing API regressions**

Extend the object passed to `writeJson(path.join(templateRoot, 'package.json'), ...)` in `writeMakeClientTemplate()` with these exact fields:

```ts
scripts: {
  dev: 'vite',
  'metadata:sync': 'node scripts/sync-project-metadata.mjs',
  build: 'vite build',
},
dependencies: {
  shared: '2.0.0',
  moved: '2.0.0',
  'official-runtime': '1.0.0',
},
devDependencies: {
  'official-tool': '1.0.0',
},
```

Add these two complete tests beside the existing update apply tests:

```ts
it('preserves project package extensions while official package fields win conflicts', async () => {
  const defaultRoot = createTempRoot();
  writeProjectMetadata(defaultRoot, {
    project: { id: 'default-client', name: 'Default Client' },
  });
  const projectRoot = createTempRoot('axhub-make-client-update-package-merge-');
  writeMakeClientMarker(projectRoot, 'update-package-merge-client', 'Update Package Merge Client', '0.1.0');
  writeMakeClientMetadata(projectRoot, 'update-package-merge-client', 'Update Package Merge Client');
  const originalPackageContent = `${JSON.stringify({
    version: '0.1.0',
    customConfig: { enabled: true },
    scripts: {
      dev: 'local-vite',
      'metadata:sync': 'node scripts/sync-project-metadata.mjs',
      'deploy:staging': 'deploy-staging',
    },
    dependencies: {
      shared: '1.0.0',
      'project-runtime': '2.0.0',
    },
    devDependencies: {
      moved: '1.0.0',
      'project-tool': '3.0.0',
    },
    peerDependencies: { 'project-peer': '^4.0.0' },
    optionalDependencies: { 'project-optional': '^5.0.0' },
  }, null, 2)}\n`;
  fs.writeFileSync(path.join(projectRoot, 'package.json'), originalPackageContent, 'utf8');
  initCleanGitRepo(projectRoot);
  installRemoteTemplateFetchMock();
  installMakeClientUpdateCommandMock({
    metadataId: 'update-package-merge-client',
    metadataName: 'Update Package Merge Client',
  });
  const server = await startTestServer(defaultRoot);

  try {
    const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: projectRoot }),
    });
    expect(registerResponse.status).toBe(201);
    commitGitChangesIfNeeded(projectRoot, 'registered');

    const applyResponse = await fetch(`${server.origin}/api/projects/update-package-merge-client/make-client/update/apply`, {
      method: 'POST',
    });
    const applyBody = await applyResponse.json();

    expect(applyResponse.status).toBe(200);
    expect(applyBody.writtenFiles).toEqual(expect.arrayContaining(['package.json']));
    const updatedPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    expect(updatedPackage).toMatchObject({
      name: '@axhub/make-client',
      version: DEFAULT_TEMPLATE_VERSION,
      customConfig: { enabled: true },
      scripts: {
        dev: 'vite',
        'metadata:sync': 'node scripts/sync-project-metadata.mjs',
        'deploy:staging': 'deploy-staging',
        build: 'vite build',
      },
      dependencies: {
        shared: '2.0.0',
        moved: '2.0.0',
        'project-runtime': '2.0.0',
        'official-runtime': '1.0.0',
      },
      devDependencies: {
        'project-tool': '3.0.0',
        'official-tool': '1.0.0',
      },
      peerDependencies: { 'project-peer': '^4.0.0' },
      optionalDependencies: { 'project-optional': '^5.0.0' },
    });
    expect(updatedPackage.devDependencies).not.toHaveProperty('moved');
    expect(fs.readFileSync(path.join(applyBody.backupRoot, 'original', 'package.json'), 'utf8'))
      .toBe(originalPackageContent);
  } finally {
    await server.close();
  }
});

it('rejects an invalid project package before writing update files', async () => {
  const defaultRoot = createTempRoot();
  writeProjectMetadata(defaultRoot, {
    project: { id: 'default-client', name: 'Default Client' },
  });
  const projectRoot = createTempRoot('axhub-make-client-update-invalid-package-');
  writeMakeClientMarker(projectRoot, 'update-invalid-package-client', 'Update Invalid Package Client', '0.1.0');
  writeMakeClientPackage(projectRoot, '0.1.0');
  writeMakeClientMetadata(projectRoot, 'update-invalid-package-client', 'Update Invalid Package Client');
  fs.mkdirSync(path.join(projectRoot, 'src', 'prototypes', 'beginner-guide'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'prototypes', 'beginner-guide', 'index.tsx'), 'old official\n', 'utf8');
  initCleanGitRepo(projectRoot);
  installRemoteTemplateFetchMock();
  const server = await startTestServer(defaultRoot);

  try {
    const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: projectRoot }),
    });
    expect(registerResponse.status).toBe(201);
    const markerPath = getMakeClientMarkerPath(projectRoot);
    const originalMarkerContent = fs.readFileSync(markerPath, 'utf8');
    fs.writeFileSync(path.join(projectRoot, 'package.json'), '{"scripts":', 'utf8');

    const applyResponse = await fetch(`${server.origin}/api/projects/update-invalid-package-client/make-client/update/apply`, {
      method: 'POST',
    });
    const applyBody = await applyResponse.json();

    expect(applyResponse.status).toBe(409);
    expect(applyBody).toMatchObject({
      code: 'MAKE_CLIENT_PACKAGE_INVALID',
      phase: 'merge-package',
      details: { source: 'project' },
    });
    expect(fs.readFileSync(path.join(projectRoot, 'src', 'prototypes', 'beginner-guide', 'index.tsx'), 'utf8'))
      .toBe('old official\n');
    expect(fs.readFileSync(markerPath, 'utf8')).toBe(originalMarkerContent);
    expect(fs.existsSync(path.join(projectRoot, '.axhub', 'make', 'backups'))).toBe(false);
  } finally {
    await server.close();
  }
});
```

To cover an invalid template without changing the normal fixture, update the fixture helpers with the following signatures and branches:

```ts
function writeMakeClientTemplate(
  templateRoot: string,
  options: { packageContent?: string } = {},
) {
  if (options.packageContent !== undefined) {
    fs.mkdirSync(templateRoot, { recursive: true });
    fs.writeFileSync(path.join(templateRoot, 'package.json'), options.packageContent, 'utf8');
  } else {
    writeJson(path.join(templateRoot, 'package.json'), {
      name: '@axhub/make-client',
      version: DEFAULT_TEMPLATE_VERSION,
      scripts: {
        dev: 'vite',
        'metadata:sync': 'node scripts/sync-project-metadata.mjs',
        build: 'vite build',
      },
      dependencies: {
        shared: '2.0.0',
        moved: '2.0.0',
        'official-runtime': '1.0.0',
      },
      devDependencies: {
        'official-tool': '1.0.0',
      },
    });
  }
}

function createMakeClientTemplateZip(options: {
  unsafeEntry?: string;
  packageContent?: string;
} = {}) {
  writeMakeClientTemplate(
    path.join(sourceRoot, 'axhub-make-client-template'),
    { ...(options.packageContent !== undefined ? { packageContent: options.packageContent } : {}) },
  );
}
```

These snippets replace only the existing package-write block and the existing `writeMakeClientTemplate(...)` call; all following fixture file creation and zip creation statements remain as they are.

Add `packageContent?: string` to the existing `installRemoteTemplateFetchMock()` option type, then build its primary and mirror buffers as follows:

```ts
const primaryZip = createMakeClientTemplateZip({
  ...(options.unsafePrimaryZipEntry ? { unsafeEntry: options.unsafePrimaryZipEntry } : {}),
  ...(options.packageContent !== undefined ? { packageContent: options.packageContent } : {}),
});
const mirrorZip = createMakeClientTemplateZip();
```

Add this complete test after the invalid-project test:

```ts
it('rejects an invalid template package before writing update files', async () => {
  const defaultRoot = createTempRoot();
  writeProjectMetadata(defaultRoot, {
    project: { id: 'default-client', name: 'Default Client' },
  });
  const projectRoot = createTempRoot('axhub-make-client-update-invalid-template-package-');
  writeMakeClientMarker(projectRoot, 'update-invalid-template-package-client', 'Update Invalid Template Package Client', '0.1.0');
  writeMakeClientPackage(projectRoot, '0.1.0');
  writeMakeClientMetadata(projectRoot, 'update-invalid-template-package-client', 'Update Invalid Template Package Client');
  fs.mkdirSync(path.join(projectRoot, 'src', 'prototypes', 'beginner-guide'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'src', 'prototypes', 'beginner-guide', 'index.tsx'), 'old official\n', 'utf8');
  initCleanGitRepo(projectRoot);
  installRemoteTemplateFetchMock({ packageContent: '{"scripts":' });
  const server = await startTestServer(defaultRoot);

  try {
    const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root: projectRoot }),
    });
    expect(registerResponse.status).toBe(201);
    const markerPath = getMakeClientMarkerPath(projectRoot);
    const originalMarkerContent = fs.readFileSync(markerPath, 'utf8');

    const applyResponse = await fetch(`${server.origin}/api/projects/update-invalid-template-package-client/make-client/update/apply`, {
      method: 'POST',
    });
    const applyBody = await applyResponse.json();

    expect(applyResponse.status).toBe(500);
    expect(applyBody).toMatchObject({
      code: 'MAKE_CLIENT_PACKAGE_INVALID',
      phase: 'merge-package',
      details: { source: 'template' },
    });
    expect(fs.readFileSync(path.join(projectRoot, 'src', 'prototypes', 'beginner-guide', 'index.tsx'), 'utf8'))
      .toBe('old official\n');
    expect(fs.readFileSync(markerPath, 'utf8')).toBe(originalMarkerContent);
    expect(fs.existsSync(path.join(projectRoot, '.axhub', 'make', 'backups'))).toBe(false);
  } finally {
    await server.close();
  }
});
```

In the existing `returns success with a post-update warning when dependency install fails after template files are written` test, extend the final package assertion to prove the official merged dependency declaration remains after installation failure:

```ts
expect(JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))).toMatchObject({
  version: DEFAULT_TEMPLATE_VERSION,
  dependencies: {
    'official-runtime': '1.0.0',
  },
});
```

- [ ] **Step 2: Run both new API tests and verify the red state**

Run:

```bash
pnpm exec vitest run src/server/__tests__/projects-make-client-api.test.ts -t "preserves project package extensions|rejects an invalid project package before writing update files|rejects an invalid template package before writing update files"
```

Expected: the preservation test fails because the template still replaces the manifest, the invalid-project test returns the current `NOT_MAKE_CLIENT_PROJECT` response, and the invalid-template test currently overwrites update files instead of returning `MAKE_CLIENT_PACKAGE_INVALID`.

- [ ] **Step 3: Add package preparation and error mapping**

In `src/server/makeClientProject.ts`:

```ts
import {
  MakeClientPackageJsonError,
  mergeMakeClientPackageJson,
  parseMakeClientPackageJson,
  type MakeClientPackageJsonSource,
} from './makeClientPackageJson.ts';
```

Add `'merge-package'` to `MakeClientPhase`, add `MAKE_CLIENT_PACKAGE_INVALID: 409` to `MAKE_CLIENT_ERROR_STATUS`, and add a reader that maps file and JSON errors before any project write:

```ts
function readMakeClientPackageJsonForUpdate(
  filePath: string,
  source: MakeClientPackageJsonSource,
): { content: string; packageJson: Record<string, unknown> } {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (source === 'template') {
      throw new MakeClientProjectError(
        'MAKE_CLIENT_TEMPLATE_UNAVAILABLE',
        'Make client template package.json is missing',
        { status: 500, phase: 'merge-package', details: { source, filePath } },
      );
    }
    throw new MakeClientProjectError(
      'MAKE_CLIENT_PACKAGE_INVALID',
      'Make client project package.json is missing or unreadable',
      { status: 409, phase: 'merge-package', details: { source, filePath } },
    );
  }

  try {
    return { content, packageJson: parseMakeClientPackageJson(source, content) };
  } catch (error) {
    if (!(error instanceof MakeClientPackageJsonError)) throw error;
    throw new MakeClientProjectError(
      'MAKE_CLIENT_PACKAGE_INVALID',
      error.message,
      {
        status: source === 'project' ? 409 : 500,
        phase: 'merge-package',
        details: { source, filePath },
      },
    );
  }
}
```

Read and validate the project package before `validateExistingMakeClientProject()`. After extracting the template, read its package, call `mergeMakeClientPackageJson(projectPackage, templatePackage)`, and compute `packageChanged` by comparing the merged serialized content with the original project content.

- [ ] **Step 4: Atomically write the merged package override**

Add this helper in the update writer section:

```ts
function writeUtf8FileAtomically(targetPath: string, content: string): void {
  const tempPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${crypto.randomUUID()}.tmp`,
  );
  try {
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, targetPath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}
```

Require `packageJsonContent: string` in `writeMakeClientUpdateTemplateFiles()` parameters. When `relativePath === 'package.json'`, call `writeUtf8FileAtomically(targetPath, params.packageJsonContent)` instead of `fs.copyFileSync(sourcePath, targetPath)`. Pass the precomputed merged content from `applyMakeClientUpdate()`.

- [ ] **Step 5: Run focused and adjacent update tests**

Run:

```bash
pnpm exec vitest run src/server/makeClientPackageJson.test.ts
pnpm exec vitest run src/server/__tests__/projects-make-client-api.test.ts -t "preserves project package extensions|rejects an invalid project package before writing update files|rejects an invalid template package before writing update files|allows updates when local changes would be overwritten and backs up original files first|updates official make client template files while preserving project-owned content|returns success with a post-update warning when dependency install fails"
```

Expected: all selected tests pass, including exact backup preservation and existing warning behavior.

- [ ] **Step 6: Run the complete affected test file and TypeScript check**

Run:

```bash
pnpm exec vitest run src/server/__tests__/projects-make-client-api.test.ts
pnpm exec tsc --noEmit -p tsconfig.json
```

Expected: all tests in `projects-make-client-api.test.ts` pass and TypeScript exits with code 0.

- [ ] **Step 7: Inspect the final diff and commit the integration**

Run:

```bash
git diff --check -- src/server/makeClientProject.ts src/server/__tests__/projects-make-client-api.test.ts
git diff -- src/server/makeClientProject.ts src/server/__tests__/projects-make-client-api.test.ts
```

Then commit only the integration files:

```bash
git add -- src/server/makeClientProject.ts src/server/__tests__/projects-make-client-api.test.ts
git commit --only -m "fix: preserve project package fields during client upgrades" -- src/server/makeClientProject.ts src/server/__tests__/projects-make-client-api.test.ts
```
