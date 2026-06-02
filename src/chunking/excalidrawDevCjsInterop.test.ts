import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  rewriteExcalidrawDevCjsImports,
} from './excalidrawDevCjsInterop';

const root = '/repo/apps/axhub-make';
const cacheDir = '/repo/apps/axhub-make/node_modules/.vite/axhub-make-dev-123';
const excalidrawDevId = [
  '/repo/node_modules/.pnpm/@axhub+excalidraw@file+apps+axhub-make+vendor+axhub-excalidraw/node_modules',
  '/@axhub/excalidraw/dist/dev/chunk-S4XMSDLZ.js?v=df47ed4b',
].join('');

describe('rewriteExcalidrawDevCjsImports', () => {
  it('points Excalidraw dev-bundle CommonJS imports at optimized dependency wrappers', () => {
    const source = [
      'import tEXt from "png-chunk-text";',
      'import encodePng from "png-chunks-encode";',
      'import decodePng from "png-chunks-extract";',
      'import throttle from "lodash.throttle";',
      'import debounce from "lodash.debounce";',
      'import fuzzy from "fuzzy";',
      'const markdown = import("@excalidraw/markdown-to-text");',
    ].join('\n');

    const rewritten = rewriteExcalidrawDevCjsImports(source, excalidrawDevId, {
      root,
      cacheDir,
    });

    expect(rewritten).not.toBeNull();
    expect(rewritten).toContain('from "/node_modules/.vite/axhub-make-dev-123/deps/@axhub_excalidraw___png-chunk-text.js"');
    expect(rewritten).toContain('from "/node_modules/.vite/axhub-make-dev-123/deps/@axhub_excalidraw___png-chunks-encode.js"');
    expect(rewritten).toContain('from "/node_modules/.vite/axhub-make-dev-123/deps/@axhub_excalidraw___png-chunks-extract.js"');
    expect(rewritten).toContain('from "/node_modules/.vite/axhub-make-dev-123/deps/@axhub_excalidraw___lodash__throttle.js"');
    expect(rewritten).toContain('from "/node_modules/.vite/axhub-make-dev-123/deps/@axhub_excalidraw___lodash__debounce.js"');
    expect(rewritten).toContain('from "/node_modules/.vite/axhub-make-dev-123/deps/@axhub_excalidraw___fuzzy.js"');
    expect(rewritten).toContain('import("/node_modules/.vite/axhub-make-dev-123/deps/@axhub_excalidraw___@excalidraw_markdown-to-text.js")');
    expect(rewritten).not.toContain('from "png-chunks-extract"');
    expect(rewritten).not.toContain('from "lodash.throttle"');
  });

  it('uses the default Vite cache URL when cacheDir is node_modules/.vite', () => {
    const rewritten = rewriteExcalidrawDevCjsImports(
      'import decodePng from "png-chunks-extract";',
      '/repo/apps/axhub-make/vendor/axhub-excalidraw/dist/dev/chunk-S4XMSDLZ.js',
      {
        root,
        cacheDir: '/repo/apps/axhub-make/node_modules/.vite',
      },
    );

    expect(rewritten).toContain('from "/node_modules/.vite/deps/@axhub_excalidraw___png-chunks-extract.js"');
  });

  it('does not rewrite non-Excalidraw files', () => {
    expect(
      rewriteExcalidrawDevCjsImports(
        'import decodePng from "png-chunks-extract";',
        '/repo/apps/axhub-make/src/index/components/content/ExcalidrawCanvas.tsx',
        { root, cacheDir },
      ),
    ).toBeNull();
  });

  it('does not rewrite non-import string literals in Excalidraw bundles', () => {
    const rewritten = rewriteExcalidrawDevCjsImports(
      'const packageName = "png-chunks-extract";',
      excalidrawDevId,
      { root, cacheDir },
    );

    expect(rewritten).toBeNull();
  });
});

describe('excalidrawDevCjsInteropPlugin', () => {
  it('is registered before Vite import analysis sees Excalidraw dev bundles', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');
    const pluginsStart = viteConfigSource.indexOf('plugins: [');
    const pluginIndex = viteConfigSource.indexOf('excalidrawDevCjsInteropPlugin()', pluginsStart);
    const siblingsPluginIndex = viteConfigSource.indexOf('excalidrawSiblingsPlugin()', pluginsStart);

    expect(viteConfigSource).toContain("import { excalidrawDevCjsInteropPlugin } from './src/chunking/excalidrawDevCjsInterop'");
    expect(pluginsStart).toBeGreaterThan(-1);
    expect(pluginIndex).toBeGreaterThan(-1);
    expect(siblingsPluginIndex).toBeGreaterThan(-1);
    expect(pluginIndex).toBeLessThan(siblingsPluginIndex);
  });
});
