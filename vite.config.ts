import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import { getManualChunkName } from './src/chunking/manualChunks';
import { canvasHotUpdateFilterPlugin } from './src/server/canvasHotUpdateFilter';
import { DEFAULT_MAKE_SERVER_PORT } from './src/server/defaults';

const adminOutDir = path.resolve(__dirname, 'dist/admin');

function discoverEntries() {
  const srcDir = path.resolve(__dirname, 'src');
  const entries: Record<string, string> = {};
  const excludeDirs = new Set(['article-editor', 'dev-template', 'spec-template', 'html-template', 'canvas-template']);
  const excludeRootHtmlFiles = new Set(['index.html']);

  if (fs.existsSync(srcDir)) {
    for (const item of fs.readdirSync(srcDir, { withFileTypes: true })) {
      if (!item.isDirectory() || excludeDirs.has(item.name)) {
        continue;
      }
      const htmlPath = path.join(srcDir, item.name, 'index.html');
      if (fs.existsSync(htmlPath)) {
      entries[item.name === 'index' ? 'index' : item.name] = htmlPath;
      }
    }
  }

  for (const htmlFile of fs.readdirSync(__dirname).filter((file) => file.endsWith('.html') && !excludeRootHtmlFiles.has(file))) {
    entries[htmlFile.replace(/\.html$/u, '')] = path.resolve(__dirname, htmlFile);
  }

  return entries;
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function createVendorResolveAliases() {
  const generatedAliases = readJsonFile<{
    packages?: Array<{
      packageName?: string;
    }>;
  }>(path.resolve(__dirname, 'vendor/vendor-aliases.generated.json'));

  return (generatedAliases?.packages || []).flatMap((pkg) => {
    if (!pkg.packageName) {
      return [];
    }
    return [{
      find: new RegExp(`^${pkg.packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
      replacement: path.resolve(__dirname, 'node_modules', pkg.packageName),
    }];
  });
}

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyHtmlTemplatePlugin(name: string, sourceRelativePath: string, outputFileName: string) {
  return {
    name,
    closeBundle() {
      const srcPath = path.resolve(__dirname, sourceRelativePath);
      const destPath = path.resolve(adminOutDir, outputFileName);
      if (!fs.existsSync(srcPath)) {
        return;
      }
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ ${outputFileName} copied to make-server dist/admin`);
    },
  };
}

function copyAssetsPlugin() {
  return {
    name: 'copy-assets',
    closeBundle() {
      const srcDir = path.resolve(__dirname, 'assets');
      if (!fs.existsSync(srcDir)) {
        return;
      }
      copyDirRecursive(srcDir, adminOutDir);
    },
  };
}

function renameHtmlPlugin() {
  return {
    name: 'rename-html',
    closeBundle() {
      const nestedSrcDir = path.join(adminOutDir, 'src');
      if (!fs.existsSync(nestedSrcDir)) {
        return;
      }

      for (const entry of fs.readdirSync(nestedSrcDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }
        const indexHtmlPath = path.join(nestedSrcDir, entry.name, 'index.html');
        if (fs.existsSync(indexHtmlPath)) {
          fs.renameSync(indexHtmlPath, path.join(adminOutDir, entry.name === 'index' ? 'index.html' : `${entry.name}.html`));
        }
      }

      fs.rmSync(nestedSrcDir, { recursive: true, force: true });
    },
  };
}

function stampAdminAssetUrlsPlugin() {
  const buildVersion = Date.now().toString();
  const assetReferencePattern = /((?:href|src)=["'])(\/(?:assets|images)\/[^"'?#]+|(?:\.\.?\/)+(?:assets|images)\/[^"'?#]+)(?:\?[^"']*)?(["'])/g;
  const jsCssReferencePattern = /((?:["'`(]\s*))(\/(?:assets|images)\/[^"'`)#?]+|(?:\.\.?\/)+(?:assets|images|chunks)\/[^"'`)#?]+|(?:\.\.?\/)[^"'`)#?]+\.(?:js|css|png|jpe?g|gif|svg|ico|woff2?|ttf|eot|json))(?:\?[^"'`)]*)?((?:\s*["'`)]))/g;

  const collectFiles = (rootDir: string, extensions: Set<string>): string[] => {
    const files: string[] = [];
    const walk = (currentDir: string) => {
      for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (extensions.has(path.extname(entry.name))) {
          files.push(fullPath);
        }
      }
    };
    walk(rootDir);
    return files;
  };

  return {
    name: 'stamp-admin-asset-urls',
    closeBundle() {
      if (!fs.existsSync(adminOutDir)) {
        return;
      }
      for (const filePath of collectFiles(adminOutDir, new Set(['.html', '.js', '.css']))) {
        const originalContent = fs.readFileSync(filePath, 'utf8');
        const stampedContent = originalContent
          .replace(assetReferencePattern, `$1$2?v=${buildVersion}$3`)
          .replace(jsCssReferencePattern, (_, prefix, assetPath, suffix) => {
            if (
              assetPath.startsWith('http://')
              || assetPath.startsWith('https://')
              || assetPath.startsWith('//')
              || assetPath.includes('?v=')
            ) {
              return `${prefix}${assetPath}${suffix}`;
            }
            return `${prefix}${assetPath}?v=${buildVersion}${suffix}`;
          });

        if (stampedContent !== originalContent) {
          fs.writeFileSync(filePath, stampedContent, 'utf8');
        }
      }
    },
  };
}

const ADMIN_ENTRY_PRELOAD_BLOCKLIST = [
  'vendor-excalidraw',
  'ExcalidrawCanvas',
  'vendor-export',
  'vendor-editor',
  'vendor-assistant',
  'vendor-genie',
];

function filterAdminEntryPreloadDependencies(filename: string, deps: string[], context?: { hostId?: string; hostType?: string }) {
  const isAdminIndexEntry = filename === 'assets/index.js'
    || context?.hostId === 'src/index/index.html'
    || context?.hostId === 'index.html';
  if (!isAdminIndexEntry) {
    return deps;
  }
  return deps.filter((dep) => !ADMIN_ENTRY_PRELOAD_BLOCKLIST.some((blocked) => dep.includes(blocked)));
}

/**
 * Resolve @excalidraw/* sibling packages to the copies bundled inside
 * @axhub/excalidraw/dist/siblings. The upstream Excalidraw build keeps these
 * as external imports; without this plugin Rollup/esbuild cannot find them.
 */
function excalidrawSiblingsPlugin() {
  const siblingsBase = path.resolve(__dirname, 'vendor/axhub-excalidraw/dist/siblings');
  const siblingMap: Record<string, string> = {
    '@excalidraw/common': path.join(siblingsBase, 'common/dev/index.js'),
    '@excalidraw/element': path.join(siblingsBase, 'element/dev/index.js'),
    '@excalidraw/math': path.join(siblingsBase, 'math/dev/index.js'),
    '@excalidraw/fractional-indexing': path.join(siblingsBase, 'fractional-indexing/dev/index.js'),
  };

  return {
    name: 'excalidraw-siblings',
    enforce: 'pre' as const,
    resolveId(source: string) {
      // Exact match
      if (siblingMap[source]) {
        return siblingMap[source];
      }
      // Subpath match: @excalidraw/element/binding → same index.js
      const slashIndex = source.indexOf('/', '@excalidraw/'.length);
      if (slashIndex > 0) {
        const basePkg = source.substring(0, slashIndex);
        if (siblingMap[basePkg]) {
          return siblingMap[basePkg];
        }
      }
      return null;
    },
  };
}

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: { api: 'modern-compiler' },
      sass: { api: 'modern-compiler' },
    },
  },
  plugins: [
    excalidrawSiblingsPlugin(),
    canvasHotUpdateFilterPlugin(),
    react(),
    tailwindcss(),
    copyAssetsPlugin(),
    renameHtmlPlugin(),
    copyHtmlTemplatePlugin('copy-dev-template', 'src/dev-template/index.html', 'dev-template.html'),
    copyHtmlTemplatePlugin('copy-spec-template', 'src/spec-template/index.html', 'spec-template.html'),
    copyHtmlTemplatePlugin('copy-canvas-template', 'src/canvas-template/index.html', 'canvas-template.html'),
    copyHtmlTemplatePlugin('copy-html-template', 'src/html-template/index.html', 'html-template.html'),
    stampAdminAssetUrlsPlugin(),
  ],
  root: path.resolve(__dirname),
  publicDir: false,
  server: {
    port: DEFAULT_MAKE_SERVER_PORT,
    open: '/',
    cors: true,
    strictPort: false,
    watch: {
      ignored: ['**/client/**'],
    },
  },
  build: {
    outDir: adminOutDir,
    emptyOutDir: true,
    modulePreload: {
      resolveDependencies: filterAdminEntryPreloadDependencies,
    },
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
      input: {
        ...discoverEntries(),
        'dev-template-bootstrap': path.resolve(__dirname, 'src/dev-template/index.tsx'),
        'spec-template-styles': path.resolve(__dirname, 'src/spec-template/styles.ts'),
        'spec-template-bootstrap': path.resolve(__dirname, 'src/spec-template/index.tsx'),
        'canvas-template-bootstrap': path.resolve(__dirname, 'src/canvas-template/index.tsx'),
        'html-template-bootstrap': path.resolve(__dirname, 'src/html-template/index.tsx'),
        'runtime-export-core': path.resolve(__dirname, 'src/runtime-export-core.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/chunks/[name].js',
        minifyInternalExports: false,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/[name].css';
          }
          return 'assets/[name].[ext]';
        },
        manualChunks: getManualChunkName,
        onlyExplicitManualChunks: true,
      },
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      ...createVendorResolveAliases(),
      { find: /^@axhub\/excalidraw\/index\.css$/, replacement: path.resolve(__dirname, 'vendor/axhub-excalidraw/dist/prod/index.css') },
      { find: '@ant-design/cssinjs', replacement: path.resolve(__dirname, 'node_modules/@ant-design/cssinjs') },
      { find: '@ant-design/icons', replacement: path.resolve(__dirname, 'node_modules/@ant-design/icons') },
      { find: 'antd', replacement: path.resolve(__dirname, 'node_modules/antd') },
      { find: 'react', replacement: path.resolve(__dirname, 'node_modules/react') },
      { find: 'react-dom', replacement: path.resolve(__dirname, 'node_modules/react-dom') },
    ],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'antd',
      '@ant-design/icons',
      'cmdk',
      'lucide-react',
      'dayjs',
      '@braintree/sanitize-url',
      '@axhub/excalidraw > png-chunk-text',
      '@axhub/excalidraw > png-chunks-encode',
      '@axhub/excalidraw > png-chunks-extract',
      '@axhub/excalidraw > lodash.throttle',
      '@axhub/excalidraw > lodash.debounce',
      '@axhub/excalidraw > fuzzy',
      '@axhub/excalidraw > @excalidraw/markdown-to-text',
      'use-sync-external-store/shim',
      'use-sync-external-store/shim/with-selector',
      'use-sync-external-store/shim/with-selector.js',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
    ],
    exclude: [
      '@axhub/excalidraw',
      'axhub-genie-editor',
      'axhub-export-core',
      'tiptap-editor',
    ],
    esbuildOptions: {
      plugins: [
        {
          name: 'excalidraw-siblings-esbuild',
          setup(build) {
            const siblingsBase = path.resolve(__dirname, 'vendor/axhub-excalidraw/dist/siblings');
            const siblingMap: Record<string, string> = {
              '@excalidraw/common': path.join(siblingsBase, 'common/dev/index.js'),
              '@excalidraw/element': path.join(siblingsBase, 'element/dev/index.js'),
              '@excalidraw/math': path.join(siblingsBase, 'math/dev/index.js'),
              '@excalidraw/fractional-indexing': path.join(siblingsBase, 'fractional-indexing/dev/index.js'),
            };

            build.onResolve({ filter: /^@excalidraw\// }, (args) => {
              if (siblingMap[args.path]) {
                return { path: siblingMap[args.path] };
              }
              // Subpath: @excalidraw/element/binding → element/dev/index.js
              const slashIndex = args.path.indexOf('/', '@excalidraw/'.length);
              if (slashIndex > 0) {
                const basePkg = args.path.substring(0, slashIndex);
                if (siblingMap[basePkg]) {
                  return { path: siblingMap[basePkg] };
                }
              }
              return undefined;
            });
          },
        },
      ],
    },
  },
});
