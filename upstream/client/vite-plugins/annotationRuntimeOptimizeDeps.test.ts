import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { ConfigEnv, Plugin, UserConfig } from 'vite';

import { afterEach, describe, expect, it } from 'vitest';

import {
  annotationRuntimeOptimizeDepsPlugin,
  applyAnnotationRuntimeOptimizeDepsSignature,
  createAnnotationRuntimeOptimizeDepsSignature,
  resolveLocalAnnotationRuntimeAlias,
  resolveLocalAnnotationRuntimeWorkspaceRoot,
} from './annotationRuntimeOptimizeDeps';

const tempRoots: string[] = [];

async function runConfigHook(plugin: Plugin, config: UserConfig, env: ConfigEnv): Promise<UserConfig> {
  const hook = plugin.config;
  if (typeof hook === 'function') {
    return await hook.call(undefined, config, env) as UserConfig;
  }
  return await hook?.handler.call(undefined, config, env) as UserConfig;
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function createFixtureProject(entryContent: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'annotation-runtime-optimize-deps-'));
  tempRoots.push(root);
  writeFile(path.join(root, 'package.json'), '{"type":"module"}\n');
  writeFile(path.join(root, 'node_modules/@axhub/annotation/package.json'), JSON.stringify({
    name: '@axhub/annotation',
    version: '1.0.9',
    module: './dist/index.mjs',
  }, null, 2));
  writeFile(path.join(root, 'node_modules/@axhub/annotation/dist/index.mjs'), entryContent);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('annotation runtime optimizeDeps signature', () => {
  it('changes when the installed annotation runtime entry changes', () => {
    const root = createFixtureProject('export const runtimeVersion = 1;\n');
    const requireFromProject = createRequire(path.join(root, 'package.json'));
    const firstSignature = createAnnotationRuntimeOptimizeDepsSignature(root, requireFromProject);

    writeFile(
      path.join(root, 'node_modules/@axhub/annotation/dist/index.mjs'),
      'export const runtimeVersion = 2;\n',
    );
    const nextSignature = createAnnotationRuntimeOptimizeDepsSignature(root, requireFromProject);

    expect(firstSignature).toContain('1.0.9');
    expect(nextSignature).toContain('1.0.9');
    expect(nextSignature).not.toBe(firstSignature);
  });

  it('preserves existing optimizeDeps esbuild options when applying the signature define', () => {
    const config = applyAnnotationRuntimeOptimizeDepsSignature({
      optimizeDeps: {
        include: ['lucide-react'],
        esbuildOptions: {
          define: {
            __EXISTING_DEFINE__: '"kept"',
          },
        },
      },
    }, 'annotation-signature');

    expect(config.optimizeDeps?.include).toEqual(['lucide-react']);
    expect(config.optimizeDeps?.esbuildOptions?.define).toMatchObject({
      __EXISTING_DEFINE__: '"kept"',
      __AXHUB_ANNOTATION_OPTIMIZE_DEPS_SIGNATURE__: '"annotation-signature"',
    });
  });

  it('resolves the workspace annotation runtime build for local monorepo development only', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'annotation-runtime-workspace-'));
    tempRoots.push(workspaceRoot);
    const projectRoot = path.join(workspaceRoot, 'apps/axhub-make/client');
    const localEntry = path.join(workspaceRoot, 'packages/axhub-annotation/dist/index.mjs');

    writeFile(path.join(workspaceRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'packages/*'\n");
    writeFile(path.join(projectRoot, 'package.json'), '{"type":"module"}\n');
    writeFile(localEntry, 'export const localAnnotationRuntime = true;\n');

    expect(resolveLocalAnnotationRuntimeAlias(projectRoot)).toBe(localEntry);

    fs.rmSync(path.join(workspaceRoot, 'packages/axhub-annotation/dist'), {
      recursive: true,
      force: true,
    });

    expect(resolveLocalAnnotationRuntimeAlias(projectRoot)).toBeNull();
  });

  it('skips nested workspace roots until it finds the monorepo annotation runtime build', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'annotation-runtime-nested-workspace-'));
    tempRoots.push(workspaceRoot);
    const nestedMakeRoot = path.join(workspaceRoot, 'apps/axhub-make');
    const projectRoot = path.join(nestedMakeRoot, 'client');
    const localEntry = path.join(workspaceRoot, 'packages/axhub-annotation/dist/index.mjs');

    writeFile(path.join(workspaceRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'packages/*'\n");
    writeFile(path.join(nestedMakeRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'client'\n");
    writeFile(path.join(projectRoot, 'package.json'), '{"type":"module"}\n');
    writeFile(localEntry, 'export const localAnnotationRuntime = true;\n');

    expect(resolveLocalAnnotationRuntimeAlias(projectRoot)).toBe(localEntry);
    expect(resolveLocalAnnotationRuntimeWorkspaceRoot(projectRoot)).toBe(workspaceRoot);
  });

  it('allows Vite dev server to serve the local monorepo annotation runtime build', async () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'annotation-runtime-fs-allow-'));
    tempRoots.push(workspaceRoot);
    const nestedMakeRoot = path.join(workspaceRoot, 'apps/axhub-make');
    const projectRoot = path.join(nestedMakeRoot, 'client');
    const localEntry = path.join(workspaceRoot, 'packages/axhub-annotation/dist/index.mjs');

    writeFile(path.join(workspaceRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'packages/*'\n");
    writeFile(path.join(nestedMakeRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'client'\n");
    writeFile(path.join(projectRoot, 'package.json'), '{"type":"module"}\n');
    writeFile(localEntry, 'export const localAnnotationRuntime = true;\n');

    const plugin = annotationRuntimeOptimizeDepsPlugin(projectRoot);
    const nextConfig = await runConfigHook(plugin, {
      server: {
        fs: {
          allow: [nestedMakeRoot],
        },
      },
    }, { command: 'serve', mode: 'development' });

    expect(nextConfig.resolve?.alias).toEqual([
      {
        find: '@axhub/annotation',
        replacement: localEntry,
      },
    ]);
    expect(nextConfig.server?.fs?.allow).toContain(nestedMakeRoot);
    expect(nextConfig.server?.fs?.allow).toContain(workspaceRoot);
  });
});
