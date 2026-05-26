/**
 * On-demand Vite build for Axure export.
 *
 * Mirrors the legacy `axhub-make` `generateAxureExportCode()` approach:
 * runs a full Vite lib-mode build in memory (`write: false`) for a single
 * prototype entry, producing a self-contained IIFE bundle with:
 *   - `lib.name = 'UserComponent'`
 *   - React / ReactDOM as external globals
 *   - CSS extracted separately for injection
 *
 * This guarantees the exported code always reflects the latest source,
 * without requiring a prior `pnpm build` step.
 */

import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const requireFromCurrentModule = createRequire(import.meta.url);

export interface OnDemandBuildResult {
  /** The IIFE JS code with `var UserComponent = …` */
  jsCode: string;
  /** Extracted CSS text (empty string if none) */
  cssText: string;
}

/**
 * Sanitize `process.env.NODE_ENV` references so the bundle can run in
 * environments that don't define `process`.
 */
function sanitizeProcessEnv(code: string): string {
  return String(code || '').replace(/\bprocess\.env\.NODE_ENV\b/g, '"production"');
}

/**
 * Try to load vendor aliases from the project (best-effort).
 * Returns an empty array if the project doesn't use them.
 */
function loadVendorAliases(projectRoot: string): Array<{ packageName: string; runtimeEntryAbsolute: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadVendorPackagesConfig, createVendorAliases } = require(
      path.resolve(projectRoot, 'scripts/utils/vendor-packages.mjs'),
    );
    const config = loadVendorPackagesConfig(projectRoot);
    return createVendorAliases(projectRoot, config);
  } catch {
    return [];
  }
}

async function importPackageFromProject<T = any>(projectRoot: string, packageName: string): Promise<T> {
  let entryPath: string;
  try {
    entryPath = requireFromCurrentModule.resolve(packageName, {
      paths: [projectRoot],
    });
  } catch {
    entryPath = requireFromCurrentModule.resolve(packageName);
  }
  return import(pathToFileURL(entryPath).href) as Promise<T>;
}

function getPackageExport<T = any>(module: any, exportName: string, packageName: string): T {
  const value = module?.[exportName] ?? module?.default?.[exportName];
  if (!value) {
    throw new Error(`Package ${packageName} does not export ${exportName}`);
  }
  return value as T;
}

function getDefaultExport<T = any>(module: any, packageName: string): T {
  const value = module?.default ?? module;
  if (!value) {
    throw new Error(`Package ${packageName} does not provide a default export`);
  }
  return value as T;
}

/**
 * Build a single prototype entry on-demand and return the IIFE JS + CSS.
 *
 * @param projectRoot - Absolute path to the project root.
 * @param entryFilePath - Absolute path to the entry file (e.g. `src/prototypes/express-home/index.tsx`).
 */
export async function buildOnDemand(projectRoot: string, entryFilePath: string): Promise<OnDemandBuildResult> {
  const vendorAliases = loadVendorAliases(projectRoot);
  const [viteModule, reactModule, tailwindcssModule] = await Promise.all([
    importPackageFromProject(projectRoot, 'vite'),
    importPackageFromProject(projectRoot, '@vitejs/plugin-react'),
    importPackageFromProject(projectRoot, '@tailwindcss/vite'),
  ]);
  const viteBuild = getPackageExport<typeof import('vite')['build']>(viteModule, 'build', 'vite');
  const react = getDefaultExport<any>(reactModule, '@vitejs/plugin-react');
  const tailwindcss = getDefaultExport<any>(tailwindcssModule, '@tailwindcss/vite');

  const bundleResult = await viteBuild({
    configFile: false,
    publicDir: false,
    logLevel: 'silent',
    root: projectRoot,
    plugins: [
      tailwindcss(),
      react({
        jsxRuntime: 'classic',
        babel: { configFile: false, babelrc: false },
      }),
    ],
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(projectRoot, 'src') },
        ...vendorAliases.map((alias: any) => ({
          find: new RegExp(`^${String(alias.packageName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
          replacement: alias.runtimeEntryAbsolute,
        })),
      ],
    },
    css: {
      preprocessorOptions: {
        scss: { api: 'modern-compiler' as any },
        sass: { api: 'modern-compiler' as any },
      },
    },
    build: {
      write: false,
      emptyOutDir: false,
      minify: 'esbuild',
      cssCodeSplit: false,
      target: 'es2015',
      assetsInlineLimit: 1024 * 1024,
      lib: {
        entry: entryFilePath,
        formats: ['iife'],
        name: 'UserComponent',
        fileName: () => 'axure-export.js',
      },
      rollupOptions: {
        external: ['react', 'react-dom'],
        output: {
          inlineDynamicImports: true,
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
          },
          generatedCode: {
            constBindings: false,
          },
        },
      },
    },
    esbuild: {
      target: 'es2015',
      legalComments: 'none',
      keepNames: true,
    },
  });

  // Extract JS and CSS from the in-memory build output
  const outputs = Array.isArray(bundleResult) ? bundleResult : [bundleResult];
  const outputBundle = outputs.find(
    (item: any) => item && item.output && Array.isArray(item.output),
  ) as { output: Array<{ type: string; fileName: string; code?: string; source?: string | Uint8Array }> } | undefined;

  const jsChunk = outputBundle?.output.find(
    (item) => item.type === 'chunk' && typeof item.code === 'string',
  );
  if (!jsChunk || typeof jsChunk.code !== 'string') {
    throw new Error('On-demand Vite build produced no JS output');
  }

  const cssAsset = outputBundle?.output.find(
    (item) =>
      item.type === 'asset' &&
      typeof item.fileName === 'string' &&
      item.fileName.endsWith('.css'),
  );
  const cssText =
    typeof cssAsset?.source === 'string'
      ? cssAsset.source
      : cssAsset?.source instanceof Uint8Array
        ? Buffer.from(cssAsset.source).toString('utf8')
        : '';

  return {
    jsCode: sanitizeProcessEnv(jsChunk.code),
    cssText,
  };
}

export const __onDemandBuildTestUtils = {
  getPackageExport,
  getDefaultExport,
};
