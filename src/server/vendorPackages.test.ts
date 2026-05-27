import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildVendorImportMap,
  createVendorAliases,
  loadVendorPackagesConfig,
  syncVendorPackages,
  withVendorSyncLock,
} from '../../scripts/utils/vendor-packages.mjs';

const appRoot = path.resolve(__dirname, '..', '..');

describe('make-server vendor packages', () => {
  it('uses vendored packages from make-server config instead of workspace paths', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
    const viteConfig = fs.readFileSync(path.join(appRoot, 'vite.config.ts'), 'utf8');
    const tsconfig = JSON.parse(fs.readFileSync(path.join(appRoot, 'tsconfig.json'), 'utf8'));

    expect(packageJson.dependencies).toMatchObject({
      '@axhub/excalidraw': 'file:vendor/axhub-excalidraw',
      'axhub-export-core': 'file:vendor/axhub-export-core',
      'axhub-genie-editor': 'file:vendor/axhub-genie-editor',
      'tiptap-editor': 'file:vendor/tiptap-editor',
    });
    expect(packageJson.dependencies).not.toHaveProperty('@axhub/project-core');
    expect(packageJson.dependencies).not.toHaveProperty('@axhub/annotation');
    expect(packageJson.scripts?.['vendor:sync']).toBe('node scripts/sync-vendor-package.mjs');
    expect(packageJson.scripts?.dev).toBe('pnpm --filter @axhub/make-client dev');
    expect(packageJson.scripts?.['server:dev']).toContain('pnpm vendor:sync &&');
    expect(packageJson.scripts?.['server:dev']).toContain('src/server/cli.ts -- ./client --dev');
    expect(packageJson.scripts?.['make-server:dev']).toBe('pnpm server:dev');
    expect(packageJson.scripts?.build).toContain('pnpm vendor:sync &&');
    expect(packageJson.scripts?.['server:build']).toContain('pnpm vendor:sync &&');
    expect(packageJson.scripts?.test).toContain('pnpm vendor:sync &&');

    expect(viteConfig).not.toContain('../../packages/');
    expect(viteConfig).not.toContain('path.resolve(__dirname, pkg.runtimeEntryRelative)');
    expect(viteConfig).toContain('vendor-aliases.generated.json');
    expect(JSON.stringify(tsconfig.compilerOptions.paths)).not.toContain('../../packages/');
    expect(tsconfig.compilerOptions.paths).toMatchObject({
      '@axhub/excalidraw': ['./vendor/axhub-excalidraw/dist/types/excalidraw/index.d.ts'],
      'axhub-export-core': ['./vendor/axhub-export-core/dist/index.d.ts'],
      'axhub-genie-editor': ['./vendor/axhub-genie-editor/src/index.ts'],
      'tiptap-editor': ['./vendor/tiptap-editor/dist/index.d.ts'],
    });
  });

  it('loads server-owned vendor packages without client-only annotation runtime', () => {
    const config = loadVendorPackagesConfig(appRoot);

    expect(config.packages.map((pkg) => pkg.packageName)).toEqual([
      '@axhub/excalidraw',
      'axhub-export-core',
      'axhub-genie-editor',
      'tiptap-editor',
    ]);
    expect(config.packages.map((pkg) => pkg.packageName)).not.toContain('@axhub/annotation');

    const aliases = createVendorAliases(appRoot, config);
    expect(aliases).toEqual(expect.arrayContaining([
      expect.objectContaining({
        packageName: '@axhub/excalidraw',
        runtimeEntryRelative: 'vendor/axhub-excalidraw/dist/prod/index.js',
        typesEntryRelative: 'vendor/axhub-excalidraw/dist/types/excalidraw/index.d.ts',
      }),
      expect.objectContaining({
        packageName: 'axhub-export-core',
        runtimeEntryRelative: 'vendor/axhub-export-core/dist/index.mjs',
        typesEntryRelative: 'vendor/axhub-export-core/dist/index.d.ts',
      }),
      expect.objectContaining({
        packageName: 'axhub-genie-editor',
        runtimeEntryRelative: 'vendor/axhub-genie-editor/dist/index.mjs',
        typesEntryRelative: 'vendor/axhub-genie-editor/src/index.ts',
      }),
      expect.objectContaining({
        packageName: 'tiptap-editor',
        runtimeEntryRelative: 'vendor/tiptap-editor/dist/index.js',
        typesEntryRelative: 'vendor/tiptap-editor/dist/index.d.ts',
      }),
    ]));

    const importMap = buildVendorImportMap(appRoot, config);
    expect(importMap.paths).not.toHaveProperty('@axhub/annotation');
    expect(importMap.paths['tiptap-editor']).toEqual(['./vendor/tiptap-editor/dist/index.d.ts']);
  });

  it('syncs prebuilt package artifacts and writes generated metadata', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'make-server-vendor-test-'));
    const appTempRoot = path.join(tempRoot, 'apps', 'make-server');
    const sourceRoot = path.join(tempRoot, 'packages', 'demo-package');
    const sourceDistRoot = path.join(sourceRoot, 'dist');

    fs.mkdirSync(sourceDistRoot, { recursive: true });
    fs.mkdirSync(appTempRoot, { recursive: true });
    fs.writeFileSync(path.join(appTempRoot, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@/*': ['src/*'],
        },
      },
    }, null, 2), 'utf8');
    fs.writeFileSync(path.join(sourceDistRoot, 'index.mjs'), 'export const demo = true;\n', 'utf8');
    fs.writeFileSync(path.join(sourceDistRoot, 'index.d.ts'), 'export declare const demo: true;\n', 'utf8');
    fs.writeFileSync(path.join(sourceDistRoot, '.DS_Store'), 'local metadata should not be vendored\n', 'utf8');
    fs.writeFileSync(
      path.join(sourceRoot, 'package.json'),
      JSON.stringify({ name: 'demo-package', type: 'module' }, null, 2),
      'utf8',
    );

    const config = {
      packages: [
        {
          packageName: 'demo-package',
          aliases: ['demo-alias'],
          sourceDir: '../../packages/demo-package',
          outputDir: 'vendor/demo-package',
          runtimeEntry: 'dist/index.mjs',
          typesEntry: 'dist/index.d.ts',
          copy: ['dist', 'package.json'],
          buildCommand: [],
        },
      ],
    };

    try {
      const result = syncVendorPackages(appTempRoot, config, {
        shouldBuild: false,
        onBuildPackage: () => {
          throw new Error('build hook should not run when shouldBuild=false');
        },
      });

      expect(result.packages).toHaveLength(2);
      expect(fs.existsSync(path.join(appTempRoot, 'vendor/demo-package/dist/index.mjs'))).toBe(true);
      expect(fs.existsSync(path.join(appTempRoot, 'vendor/demo-package/package.json'))).toBe(true);
      expect(fs.existsSync(path.join(appTempRoot, 'vendor/demo-package/dist/.DS_Store'))).toBe(false);

      const generatedAliases = JSON.parse(
        fs.readFileSync(path.join(appTempRoot, 'vendor/vendor-aliases.generated.json'), 'utf8'),
      );
      expect(generatedAliases.packages).toEqual(expect.arrayContaining([
        expect.objectContaining({
          packageName: 'demo-package',
          runtimeEntryRelative: 'vendor/demo-package/dist/index.mjs',
          typesEntryRelative: 'vendor/demo-package/dist/index.d.ts',
        }),
        expect.objectContaining({
          packageName: 'demo-alias',
          runtimeEntryRelative: 'vendor/demo-package/dist/index.mjs',
          typesEntryRelative: 'vendor/demo-package/dist/index.d.ts',
        }),
      ]));

      const generatedTsconfig = JSON.parse(
        fs.readFileSync(path.join(appTempRoot, 'vendor/vendor-tsconfig.generated.json'), 'utf8'),
      );
      expect(generatedTsconfig.compilerOptions.paths).toMatchObject({
        '@/*': ['src/*'],
        'demo-package': ['./vendor/demo-package/dist/index.d.ts'],
        'demo-alias': ['./vendor/demo-package/dist/index.d.ts'],
      });
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rewrites workspace dependencies between vendored packages to relative file specs', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'make-server-vendor-deps-test-'));
    const appTempRoot = path.join(tempRoot, 'apps', 'make-server');
    const sourceRoot = path.join(tempRoot, 'packages', 'consumer-package');
    const dependencyRoot = path.join(tempRoot, 'packages', 'dependency-package');

    for (const root of [sourceRoot, dependencyRoot]) {
      fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(root, 'dist/index.mjs'), 'export const demo = true;\n', 'utf8');
      fs.writeFileSync(path.join(root, 'dist/index.d.ts'), 'export declare const demo: true;\n', 'utf8');
    }
    fs.mkdirSync(appTempRoot, { recursive: true });
    fs.writeFileSync(path.join(appTempRoot, 'tsconfig.json'), JSON.stringify({ compilerOptions: { paths: {} } }), 'utf8');
    fs.writeFileSync(
      path.join(sourceRoot, 'package.json'),
      JSON.stringify({
        name: 'consumer-package',
        type: 'module',
        dependencies: {
          'dependency-package': 'workspace:*',
          'external-package': '^1.0.0',
        },
      }, null, 2),
      'utf8',
    );
    fs.writeFileSync(
      path.join(dependencyRoot, 'package.json'),
      JSON.stringify({ name: 'dependency-package', type: 'module' }, null, 2),
      'utf8',
    );

    const config = {
      packages: [
        {
          packageName: 'consumer-package',
          aliases: [],
          sourceDir: '../../packages/consumer-package',
          outputDir: 'vendor/consumer-package',
          runtimeEntry: 'dist/index.mjs',
          typesEntry: 'dist/index.d.ts',
          copy: ['dist', 'package.json'],
          buildCommand: [],
        },
        {
          packageName: 'dependency-package',
          aliases: [],
          sourceDir: '../../packages/dependency-package',
          outputDir: 'vendor/dependency-package',
          runtimeEntry: 'dist/index.mjs',
          typesEntry: 'dist/index.d.ts',
          copy: ['dist', 'package.json'],
          buildCommand: [],
        },
      ],
    };

    try {
      syncVendorPackages(appTempRoot, config, { shouldBuild: false });

      const vendoredPackageJson = JSON.parse(
        fs.readFileSync(path.join(appTempRoot, 'vendor/consumer-package/package.json'), 'utf8'),
      );
      expect(vendoredPackageJson.dependencies).toMatchObject({
        'dependency-package': 'file:../dependency-package',
        'external-package': '^1.0.0',
      });
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('serializes vendor sync operations with a lock directory', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'make-server-vendor-lock-test-'));
    const appTempRoot = path.join(tempRoot, 'apps', 'make-server');
    const syncLog: string[] = [];

    fs.mkdirSync(appTempRoot, { recursive: true });

    try {
      const firstResult = withVendorSyncLock(appTempRoot, () => {
        syncLog.push('first');
        return 'locked';
      }, {
        retryDelayMs: 1,
        timeoutMs: 20,
      });

      expect(firstResult).toBe('locked');
      expect(syncLog).toEqual(['first']);
      expect(fs.existsSync(path.join(appTempRoot, 'vendor/.sync.lock'))).toBe(false);

      fs.mkdirSync(path.join(appTempRoot, 'vendor/.sync.lock'), { recursive: true });

      expect(() => withVendorSyncLock(appTempRoot, () => {
        syncLog.push('blocked');
      }, {
        retryDelayMs: 1,
        timeoutMs: 3,
      })).toThrow(/Timed out waiting for vendor sync lock/);
      expect(syncLog).toEqual(['first']);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
