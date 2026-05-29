import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.AXHUB_MAKE_RELEASE_SKIP_MAIN = '1';

const releaseMake = await import('./release-make.mjs');

const tempRoots = [];

function createTempRoot(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function stripTypeImportQueries(source) {
  return source
    .replace(/^\s*import\s+type\s+[^;]+;\s*$/gmu, '')
    .replace(/typeof\s+import\(['"][^'"]+['"]\)/gu, 'type-import-query');
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('release make artifact helpers', () => {
  it('builds independent make client template zip metadata', () => {
    const metadata = releaseMake.createTemplateZipMetadata({
      templateVersion: '0.2.0-beta.1',
      githubRepo: 'lintendo/Axhub-Make',
    });
    const prefixedMetadata = releaseMake.createTemplateZipMetadata({
      templateVersion: 'v0.2.0-beta.1',
      githubRepo: 'lintendo/Axhub-Make',
    });

    assert.deepEqual(metadata, {
      templateVersion: '0.2.0-beta.1',
      tagName: 'make-client-template-v0.2.0-beta.1',
      githubReleaseAssetName: 'axhub-make-client-template.zip',
      primaryUrl: 'https://github.com/lintendo/Axhub-Make/releases/download/make-client-template-v0.2.0-beta.1/axhub-make-client-template.zip',
      mirrorUrl: 'https://gitee.com/axhub/Axhub-Make/releases/download/make-client-template-v0.2.0-beta.1/axhub-make-client-template.zip',
    });
    assert.deepEqual(prefixedMetadata, metadata);
  });

  it('keeps ordinary make release commands free of the client template zip', () => {
    const commands = releaseMake.publishCommands({
      tagName: 'make-v1.2.3',
      templateZip: {
        path: '/tmp/axhub-make-client-template.zip',
      },
      releaseAssets: [
        { zipPath: '/tmp/axhub-make-1.2.3-macos-arm64.zip' },
      ],
    }, {
      githubRepo: 'lintendo/Axhub-Make',
      npmTag: 'latest',
    });

    assert(commands.releaseArgs.includes('/tmp/axhub-make-1.2.3-macos-arm64.zip'));
    assert(!commands.releaseArgs.includes('/tmp/axhub-make-client-template.zip'));
  });

  it('builds template-only release commands with only the client template zip', () => {
    const commands = releaseMake.publishTemplateCommands({
      tagName: 'make-client-template-v0.2.0-beta.1',
      templateVersion: '0.2.0-beta.1',
      templateZip: {
        path: '/tmp/axhub-make-client-template.zip',
      },
    }, {
      githubRepo: 'lintendo/Axhub-Make',
    });

    assert.deepEqual(commands.releaseArgs, [
      'release',
      'create',
      'make-client-template-v0.2.0-beta.1',
      '/tmp/axhub-make-client-template.zip',
      '--repo',
      'lintendo/Axhub-Make',
      '--title',
      'Axhub Make Client Template 0.2.0-beta.1',
      '--generate-notes',
    ]);
  });

  it('packages the make client template zip without local runtime artifacts', async () => {
    const sourceRoot = createTempRoot('axhub-release-template-source-');
    const outputRoot = createTempRoot('axhub-release-template-output-');
    const clientRoot = path.join(sourceRoot, 'client');
    writeFile(path.join(clientRoot, 'package.json'), '{"name":"@axhub/make-client"}\n');
    writeFile(path.join(clientRoot, 'src/prototypes/template-home/index.tsx'), 'export {};\n');
    writeFile(path.join(clientRoot, 'src/prototypes/template-home/TsangerJinKai02-W04.ttf'), 'source font\n');
    writeFile(path.join(clientRoot, 'src/prototypes/template-home/TsangerJinKai02-W04.subset.woff2'), 'subset font\n');
    writeFile(path.join(clientRoot, 'tests/template.test.mjs'), 'export {};\n');
    writeFile(path.join(clientRoot, '.git/config'), '[core]\n');
    writeFile(path.join(clientRoot, 'node_modules/left-pad/index.js'), 'module.exports = null;\n');
    writeFile(path.join(clientRoot, 'dist/build.js'), 'console.log("built");\n');
    writeFile(path.join(clientRoot, '.agents/skills/local/SKILL.md'), 'npm run typecheck\n');
    writeFile(path.join(clientRoot, '.claude/skills/local/SKILL.md'), 'npm run typecheck\n');
    writeFile(path.join(clientRoot, '.trae/local.json'), '{}\n');
    writeFile(path.join(clientRoot, 'temp/scratch.txt'), 'scratch\n');
    writeFile(path.join(clientRoot, '.axhub/make/client.json'), '{}\n');
    writeFile(path.join(clientRoot, '.axhub/make/README.md'), '# Make client\n');
    writeFile(path.join(clientRoot, '.axhub/make/sidebar-tree.json'), '{"version":1,"themesTree":[]}\n');
    writeFile(path.join(clientRoot, '.axhub/make/project.json'), '{}\n');
    writeFile(path.join(clientRoot, '.axhub/make/.dev-server-info.json'), '{}\n');
    writeFile(path.join(clientRoot, '.axhub/make/axhub.config.json'), '{}\n');
    writeFile(path.join(clientRoot, '.axhub/make/sessions/stale.json'), '{}\n');
    writeFile(path.join(clientRoot, '.axhub/make/exports/stale.json'), '{}\n');

    const result = await releaseMake.createMakeClientTemplateZip({
      sourceClientDir: clientRoot,
      outputDir: outputRoot,
    });

    assert.equal(path.basename(result.path), 'axhub-make-client-template.zip');
    assert.match(result.sha256, /^[a-f0-9]{64}$/u);
    const entries = releaseMake.listZipEntries(result.path);
    assert(entries.includes('package.json'));
    assert(entries.includes('src/prototypes/template-home/index.tsx'));
    assert(!entries.includes('src/prototypes/template-home/TsangerJinKai02-W04.ttf'));
    assert(entries.includes('src/prototypes/template-home/TsangerJinKai02-W04.subset.woff2'));
    assert(!entries.some((entry) => entry.startsWith('tests/')));
    assert(!entries.some((entry) => entry.startsWith('.git/')));
    assert(!entries.some((entry) => entry.startsWith('node_modules/')));
    assert(!entries.some((entry) => entry.startsWith('dist/')));
    assert(entries.includes('.agents/skills/local/SKILL.md'));
    assert(entries.includes('.claude/skills/local/SKILL.md'));
    assert(!entries.some((entry) => entry.startsWith('.trae/')));
    assert(!entries.some((entry) => entry.startsWith('temp/')));
    assert(entries.includes('.axhub/make/client.json'));
    assert(entries.includes('.axhub/make/README.md'));
    assert(entries.includes('.axhub/make/sidebar-tree.json'));
    assert(!entries.includes('.axhub/make/project.json'));
    assert(!entries.includes('.axhub/make/.dev-server-info.json'));
    assert(!entries.includes('.axhub/make/axhub.config.json'));
    assert(!entries.some((entry) => entry.startsWith('.axhub/make/sessions/')));
    assert(!entries.some((entry) => entry.startsWith('.axhub/make/exports/')));
  });

  it('exposes npm-only latest and beta release scripts from the workspace root', () => {
    const rootPackageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));

    assert.equal(
      rootPackageJson.scripts['release:make:npm:latest'],
      'node scripts/release-make.mjs --skip-github --npm-tag latest',
    );
    assert.equal(
      rootPackageJson.scripts['release:make:npm:beta'],
      'node scripts/release-make.mjs --skip-github --npm-tag beta',
    );
    assert.equal(
      rootPackageJson.scripts['release:make-client-template:prepare'],
      'node scripts/release-make.mjs --template-only --prepare-only',
    );
    assert.equal(
      rootPackageJson.scripts['release:make-client-template'],
      'node scripts/release-make.mjs --template-only',
    );
  });

  it('keeps the source workspace package private so npm publishing uses the staged package', () => {
    const sourcePackageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));

    assert.equal(sourcePackageJson.private, true);
  });

  it('keeps make publish source independent from the project-core workspace package', () => {
    const sourcePackageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));

    assert.equal(sourcePackageJson.dependencies?.['@axhub/project-core'], undefined);
    assert.equal(sourcePackageJson.devDependencies?.['@axhub/project-core'], undefined);
  });

  it('uses the vendored canvas fig sync script in the standalone workspace', () => {
    const releaseSource = fs.readFileSync(path.resolve('scripts/release-make.mjs'), 'utf8');

    assert.match(releaseSource, /vendor\/axhub-export-core\/scripts\/canvas-fig-sync\.mjs/u);
    assert.doesNotMatch(releaseSource, /packages\/axhub-export-core\/scripts\/canvas-fig-sync\.mjs/u);
  });

  it('copies only explicit admin runtime assets into the admin build', () => {
    const viteConfigSource = fs.readFileSync(path.resolve('vite.config.ts'), 'utf8');

    assert.match(viteConfigSource, /ADMIN_RUNTIME_ASSETS/u);
    assert.match(viteConfigSource, /assets\/auto-debug-client\.js/u);
    assert.doesNotMatch(viteConfigSource, /copyDirRecursive\(srcDir, adminOutDir\)/u);
  });

  it('builds only the admin app when preparing npm release artifacts', () => {
    const releaseSource = fs.readFileSync(path.resolve('scripts/release-make.mjs'), 'utf8');

    assert.match(releaseSource, /run\('pnpm', \['--filter', '@axhub\/make', 'admin:build'\]\)/u);
    assert.doesNotMatch(releaseSource, /run\('pnpm', \['--filter', '@axhub\/make', 'build'\]\)/u);
  });

  it('keeps Vite build tooling out of the static npm server bundle graph', () => {
    const onDemandBuildSource = fs.readFileSync(path.resolve('src/server/onDemandBuild.ts'), 'utf8');
    const viteDevServerSource = fs.readFileSync(path.resolve('src/server/viteDevServer.ts'), 'utf8');
    const canvasHotUpdateFilterSource = fs.readFileSync(path.resolve('src/server/canvasHotUpdateFilter.ts'), 'utf8');

    for (const source of [onDemandBuildSource, viteDevServerSource, canvasHotUpdateFilterSource].map(stripTypeImportQueries)) {
      assert.doesNotMatch(source, /from ['"]vite['"]/u);
      assert.doesNotMatch(source, /import\(['"]vite['"]\)/u);
      assert.doesNotMatch(source, /from ['"]@vitejs\/plugin-react['"]/u);
      assert.doesNotMatch(source, /from ['"]@tailwindcss\/vite['"]/u);
    }
    assert.match(onDemandBuildSource, /importPackageFromProject/u);
    assert.match(viteDevServerSource, /importRuntimePackage/u);
  });

  it('creates a public dependency-free npm package manifest with all CLI aliases', () => {
    const packageJson = releaseMake.createPublishPackageJson({
      name: '@axhub/make',
      version: '1.2.3',
      description: 'Axhub Make test package',
    });

    assert.equal(packageJson.name, '@axhub/make');
    assert.equal(packageJson.version, '1.2.3');
    assert.equal(packageJson.private, undefined);
    assert.deepEqual(packageJson.bin, {
      'axhub-make': './bin/cli.mjs',
      make: './bin/cli.mjs',
      'make-server': './bin/cli.mjs',
    });
    assert.equal(packageJson.files.includes('assets'), false);
    assert.equal(packageJson.files.includes('README.md'), false);
    assert.deepEqual(packageJson.engines, { node: '>=20' });
    assert.deepEqual(packageJson.publishConfig, { access: 'public' });
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      assert.equal(packageJson[field], undefined);
    }
  });

  it('rejects staged npm packages that are not self-contained npx artifacts', () => {
    const root = createTempRoot('axhub-release-make-guard-');
    const packageDir = path.join(root, 'npm-package');
    const validPackageJson = releaseMake.createPublishPackageJson({
      name: '@axhub/make',
      version: '1.2.3',
      description: 'Axhub Make test package',
    });
    const validPackInfo = {
      size: 34 * 1024 * 1024,
      unpackedSize: 79 * 1024 * 1024,
      entryCount: 6,
      files: [
        { path: 'package.json', size: 400, mode: 0o644 },
        { path: 'bin/cli.mjs', size: 180, mode: 0o755 },
        { path: 'dist/server/cli.mjs', size: 1000, mode: 0o644 },
        { path: 'dist/admin/index.html', size: 100, mode: 0o644 },
        { path: 'dist/admin/assets/favicon.ico', size: 100, mode: 0o644 },
        { path: 'dist/admin/auto-debug-client.js', size: 100, mode: 0o644 },
        { path: 'scripts/canvas-fig-sync.mjs', size: 100, mode: 0o755 },
      ],
    };

    writeFile(path.join(packageDir, 'package.json'), `${JSON.stringify(validPackageJson, null, 2)}\n`);

    assert.doesNotThrow(() => releaseMake.assertNpmPackageShape({
      dryRunInfo: [validPackInfo],
      packageDir,
    }));

    writeFile(path.join(packageDir, 'package.json'), `${JSON.stringify({
      ...validPackageJson,
      dependencies: { '@axhub/project-core': 'workspace:*' },
    }, null, 2)}\n`);
    assert.throws(
      () => releaseMake.assertNpmPackageShape({ dryRunInfo: [validPackInfo], packageDir }),
      /must not include dependencies/,
    );

    writeFile(path.join(packageDir, 'package.json'), `${JSON.stringify(validPackageJson, null, 2)}\n`);
    assert.throws(
      () => releaseMake.assertNpmPackageShape({
        dryRunInfo: [{ ...validPackInfo, files: validPackInfo.files.filter((file) => file.path !== 'dist/admin/index.html') }],
        packageDir,
      }),
      /missing required file: dist\/admin\/index\.html/,
    );

    for (const pathName of [
      'src/server/cli.ts',
      'dist/server/__tests__/cli.test.mjs',
      'dist/server/cli.test.mjs',
      'coverage/index.html',
      'node_modules/example/index.js',
      '.DS_Store',
      'dist/admin/.DS_Store',
      '.env',
      '.local/notes.md',
      'dist/server/tsconfig.node.tsbuildinfo',
      'dist/server/vite.config.ts.timestamp-123456.mjs',
      'README.md',
      'assets/auto-debug-client.js',
      'assets/images/make-demo-prd-annotation.png',
      'dist/admin/images/make-demo-prd-annotation.png',
    ]) {
      assert.throws(
        () => releaseMake.assertNpmPackageShape({
          dryRunInfo: [{ ...validPackInfo, files: [...validPackInfo.files, { path: pathName, size: 1, mode: 0o644 }] }],
          packageDir,
        }),
        new RegExp(`must not include ${pathName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`),
      );
    }

    assert.throws(
      () => releaseMake.assertNpmPackageShape({
        dryRunInfo: [{ ...validPackInfo, size: 36 * 1024 * 1024 }],
        packageDir,
      }),
      /packed size/,
    );
  });

  it('externalizes project-side build toolchain packages from the bundled npm server', () => {
    const args = releaseMake.createServerBundleArgs('/tmp/axhub-make-server.mjs', '/repo/src/server/cli.ts');

    for (const packageName of ['vite', '@vitejs/plugin-react', '@tailwindcss/vite']) {
      assert(args.includes('--external'), `missing --external for ${packageName}`);
      assert(args.includes(packageName), `missing external package ${packageName}`);
    }
  });

  it('externalizes project-side build toolchain packages from platform executables', () => {
    const args = releaseMake.createExecutableBundleArgs(
      { bunTarget: 'bun-darwin-arm64' },
      '/tmp/axhub-make',
      '/tmp/bun-cli-entry.mjs',
    );

    for (const packageName of ['vite', '@vitejs/plugin-react', '@tailwindcss/vite']) {
      assert(args.includes('--external'), `missing --external for ${packageName}`);
      assert(args.includes(packageName), `missing external package ${packageName}`);
    }
  });

  it('builds npm exec smoke args that exercise the npx default make bin', () => {
    assert.deepEqual(
      releaseMake.createNpmExecSmokeArgs('/tmp/axhub-make-1.2.3.tgz'),
      ['exec', '--yes', '--package', '/tmp/axhub-make-1.2.3.tgz', '--', 'make', '--help'],
    );
  });

  it('omits OpenCode WebUI static assets from release packaging while disabled', () => {
    const root = createTempRoot('axhub-release-make-opencode-disabled-');
    const releaseAdminDir = path.join(root, 'release-admin');
    const npmPackageDistDir = path.join(root, 'npm-package', 'dist');
    const artifactDir = path.join(root, 'artifact');

    assert.equal(releaseMake.copyOpenCodeWebUiToRelease({ releaseAdminDir }), null);
    assert.equal(releaseMake.copyOpenCodeWebUiToNpmPackage({ releaseAdminDir, npmPackageDistDir }), null);
    assert.equal(releaseMake.copyOpenCodeWebUiToPlatformArtifact({ releaseAdminDir, artifactDir }), null);
    assert.equal(fs.existsSync(path.join(root, 'opencode-webui')), false);
    assert.equal(fs.existsSync(path.join(npmPackageDistDir, 'opencode-webui')), false);
    assert.equal(fs.existsSync(path.join(artifactDir, 'opencode-webui')), false);
  });
});
