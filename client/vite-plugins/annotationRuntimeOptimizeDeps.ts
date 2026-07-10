import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { searchForWorkspaceRoot } from 'vite';
import type { Plugin, UserConfig } from 'vite';

const ANNOTATION_PACKAGE_NAME = '@axhub/annotation';
const ANNOTATION_SIGNATURE_DEFINE = '__AXHUB_ANNOTATION_OPTIMIZE_DEPS_SIGNATURE__';

type PackageJson = {
  version?: unknown;
  module?: unknown;
  main?: unknown;
};

function findWorkspaceRoots(startDir: string): string[] {
  let current = path.resolve(startDir);
  const roots: string[] = [];
  while (true) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      roots.push(current);
    }
    const parent = path.dirname(current);
    if (parent === current) return roots;
    current = parent;
  }
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function readFileIfExists(filePath: string): string {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  } catch {
    return '';
  }
}

function resolvePackageRoot(
  packageName: string,
  projectRoot: string,
  requireFromProject = createRequire(path.join(projectRoot, 'package.json')),
): string | null {
  try {
    return path.dirname(requireFromProject.resolve(`${packageName}/package.json`));
  } catch {
    return null;
  }
}

export function resolveLocalAnnotationRuntimeAlias(projectRoot = process.cwd()): string | null {
  for (const workspaceRoot of findWorkspaceRoots(projectRoot)) {
    const localEntry = path.join(workspaceRoot, 'packages/axhub-annotation/dist/index.mjs');
    if (fs.existsSync(localEntry)) {
      return localEntry;
    }
  }
  return null;
}

export function resolveLocalAnnotationRuntimeWorkspaceRoot(projectRoot = process.cwd()): string | null {
  const localEntry = resolveLocalAnnotationRuntimeAlias(projectRoot);
  return localEntry ? path.dirname(path.dirname(path.dirname(path.dirname(localEntry)))) : null;
}

function resolveAnnotationRuntimeEntry(
  projectRoot: string,
  requireFromProject?: NodeRequire,
): {
  packageRoot: string;
  rawPackageJson: string;
  packageJson: PackageJson;
  entry: string;
  entryPath: string;
} | null {
  const localEntry = resolveLocalAnnotationRuntimeAlias(projectRoot);
  if (localEntry) {
    const packageRoot = path.dirname(path.dirname(localEntry));
    const packageJsonPath = path.join(packageRoot, 'package.json');
    const rawPackageJson = readFileIfExists(packageJsonPath);
    let packageJson: PackageJson = {};
    try {
      packageJson = rawPackageJson ? JSON.parse(rawPackageJson) as PackageJson : {};
    } catch {
      packageJson = {};
    }
    return {
      packageRoot,
      rawPackageJson,
      packageJson,
      entry: path.relative(packageRoot, localEntry),
      entryPath: localEntry,
    };
  }

  const packageRoot = resolvePackageRoot(ANNOTATION_PACKAGE_NAME, projectRoot, requireFromProject);
  if (!packageRoot) {
    return null;
  }

  const packageJsonPath = path.join(packageRoot, 'package.json');
  const rawPackageJson = readFileIfExists(packageJsonPath);
  let packageJson: PackageJson = {};
  try {
    packageJson = rawPackageJson ? JSON.parse(rawPackageJson) as PackageJson : {};
  } catch {
    packageJson = {};
  }

  const entry = typeof packageJson.module === 'string'
    ? packageJson.module
    : typeof packageJson.main === 'string'
      ? packageJson.main
      : 'dist/index.mjs';
  const entryPath = path.resolve(packageRoot, entry);

  return {
    packageRoot,
    rawPackageJson,
    packageJson,
    entry,
    entryPath,
  };
}

export function createAnnotationRuntimeOptimizeDepsSignature(
  projectRoot = process.cwd(),
  requireFromProject?: NodeRequire,
): string {
  const runtimeEntry = resolveAnnotationRuntimeEntry(projectRoot, requireFromProject);
  if (!runtimeEntry) {
    return 'missing';
  }

  const entryContent = readFileIfExists(runtimeEntry.entryPath);

  return [
    runtimeEntry.packageRoot,
    String(runtimeEntry.packageJson.version || ''),
    runtimeEntry.entry,
    shortHash(`${runtimeEntry.rawPackageJson}\n${entryContent}`),
  ].join('|');
}

export function applyAnnotationRuntimeOptimizeDepsSignature(
  config: UserConfig,
  signature: string,
): UserConfig {
  return {
    ...config,
    optimizeDeps: {
      ...config.optimizeDeps,
      esbuildOptions: {
        ...config.optimizeDeps?.esbuildOptions,
        define: {
          ...config.optimizeDeps?.esbuildOptions?.define,
          [ANNOTATION_SIGNATURE_DEFINE]: JSON.stringify(signature),
        },
      },
    },
  };
}

export function annotationRuntimeOptimizeDepsPlugin(projectRoot = process.cwd()): Plugin {
  return {
    name: 'annotation-runtime-optimize-deps-signature',
    config(config) {
      const nextConfig = applyAnnotationRuntimeOptimizeDepsSignature(
        config,
        createAnnotationRuntimeOptimizeDepsSignature(projectRoot),
      );
      const localAnnotationAlias = resolveLocalAnnotationRuntimeAlias(projectRoot);
      if (!localAnnotationAlias) {
        return nextConfig;
      }
      const localAnnotationWorkspaceRoot = resolveLocalAnnotationRuntimeWorkspaceRoot(projectRoot);
      const existingAllow = nextConfig.server?.fs?.allow;
      const serverFsAllow = [
        ...(Array.isArray(existingAllow) ? existingAllow : [searchForWorkspaceRoot(projectRoot)]),
        ...(localAnnotationWorkspaceRoot ? [localAnnotationWorkspaceRoot] : []),
      ];

      return {
        ...nextConfig,
        resolve: {
          ...nextConfig.resolve,
          alias: [
            {
              find: ANNOTATION_PACKAGE_NAME,
              replacement: localAnnotationAlias,
            },
            ...(Array.isArray(nextConfig.resolve?.alias) ? nextConfig.resolve.alias : []),
          ],
        },
        server: {
          ...nextConfig.server,
          fs: {
            ...nextConfig.server?.fs,
            allow: Array.from(new Set(serverFsAllow)),
          },
        },
      };
    },
  };
}
