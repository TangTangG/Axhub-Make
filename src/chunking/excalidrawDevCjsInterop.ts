import path from 'node:path';

import type { Plugin, ResolvedConfig } from 'vite';

const EXCALIDRAW_CJS_OPTIMIZED_DEPS: Record<string, string> = {
  'png-chunk-text': '@axhub_excalidraw___png-chunk-text.js',
  'png-chunks-encode': '@axhub_excalidraw___png-chunks-encode.js',
  'png-chunks-extract': '@axhub_excalidraw___png-chunks-extract.js',
  'lodash.throttle': '@axhub_excalidraw___lodash__throttle.js',
  'lodash.debounce': '@axhub_excalidraw___lodash__debounce.js',
  fuzzy: '@axhub_excalidraw___fuzzy.js',
  '@excalidraw/markdown-to-text': '@axhub_excalidraw___@excalidraw_markdown-to-text.js',
};

type RewriteOptions = {
  root: string;
  cacheDir: string;
};

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/gu, '/');
}

function isExcalidrawDevBundleId(id: string): boolean {
  const normalizedId = normalizeFilePath(id.split('?')[0] || id);
  return normalizedId.includes('/@axhub/excalidraw/dist/dev/')
    || normalizedId.includes('/vendor/axhub-excalidraw/dist/dev/');
}

function toDevServerPath(filePath: string, root: string): string {
  const normalizedFilePath = normalizeFilePath(path.resolve(filePath));
  const normalizedRoot = normalizeFilePath(path.resolve(root));
  const relativePath = normalizeFilePath(path.relative(normalizedRoot, normalizedFilePath));

  if (relativePath && !relativePath.startsWith('../') && relativePath !== '..' && !path.isAbsolute(relativePath)) {
    return `/${relativePath}`;
  }
  return `/@fs/${normalizedFilePath}`;
}

function createOptimizedDepUrl(depFileName: string, options: RewriteOptions): string {
  return `${toDevServerPath(path.join(options.cacheDir, 'deps', depFileName), options.root)}`;
}

function rewriteImportSpecifiers(code: string, depName: string, optimizedDepUrl: string): string {
  const escapedDepName = depName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const staticImportPattern = new RegExp(`(\\bfrom\\s*)(["'])${escapedDepName}\\2`, 'gu');
  const dynamicImportPattern = new RegExp(`(\\bimport\\(\\s*)(["'])${escapedDepName}\\2`, 'gu');

  return code
    .replace(staticImportPattern, (_match, prefix: string, quote: string) => `${prefix}${quote}${optimizedDepUrl}${quote}`)
    .replace(dynamicImportPattern, (_match, prefix: string, quote: string) => `${prefix}${quote}${optimizedDepUrl}${quote}`);
}

export function rewriteExcalidrawDevCjsImports(
  code: string,
  id: string,
  options: RewriteOptions,
): string | null {
  if (!isExcalidrawDevBundleId(id)) {
    return null;
  }

  let rewritten = code;
  for (const [depName, depFileName] of Object.entries(EXCALIDRAW_CJS_OPTIMIZED_DEPS)) {
    const optimizedDepUrl = createOptimizedDepUrl(depFileName, options);
    rewritten = rewriteImportSpecifiers(rewritten, depName, optimizedDepUrl);
  }

  return rewritten === code ? null : rewritten;
}

export function excalidrawDevCjsInteropPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig | null = null;

  return {
    name: 'axhub-excalidraw-dev-cjs-interop',
    enforce: 'pre',
    configResolved(config) {
      resolvedConfig = config;
    },
    transform(code, id) {
      if (!resolvedConfig || resolvedConfig.command !== 'serve') {
        return null;
      }

      const rewritten = rewriteExcalidrawDevCjsImports(code, id, {
        root: resolvedConfig.root,
        cacheDir: resolvedConfig.cacheDir,
      });

      return rewritten ? { code: rewritten, map: null } : null;
    },
  };
}
