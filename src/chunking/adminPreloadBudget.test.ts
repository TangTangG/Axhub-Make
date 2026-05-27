import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function extractOptimizeDepsArray(source: string, name: 'include' | 'exclude') {
  const optimizeDepsStart = source.indexOf('optimizeDeps: {');
  expect(optimizeDepsStart).toBeGreaterThan(-1);

  const afterOptimizeDeps = source.slice(optimizeDepsStart);
  const match = afterOptimizeDeps.match(new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]`));
  expect(match).not.toBeNull();

  return match?.[1] || '';
}

describe('admin homepage preload budget', () => {
  it('declares direct dependencies required by dev pre-bundling', () => {
    const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies).toHaveProperty('use-sync-external-store');
    expect(packageJson.dependencies).toHaveProperty('dayjs');
    expect(packageJson.dependencies).toHaveProperty('@braintree/sanitize-url');
  });

  it('filters canvas, export, editor, and assistant chunks out of the homepage HTML preloads', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');

    expect(viteConfigSource).toContain('filterAdminEntryPreloadDependencies');
    expect(viteConfigSource).toContain('modulePreload');
    expect(viteConfigSource).toContain('resolveDependencies');
    for (const blockedChunk of [
      'vendor-excalidraw',
      'ExcalidrawCanvas',
      'vendor-export',
      'vendor-editor',
      'vendor-assistant',
    ]) {
      expect(viteConfigSource).toContain(blockedChunk);
    }
  });

  it('pre-bundles dependencies first reached by lazy-loaded homepage dialogs in dev', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');

    expect(viteConfigSource).toContain('optimizeDeps');
    expect(viteConfigSource).toContain("'cmdk'");
    expect(viteConfigSource).toContain("'@radix-ui/react-checkbox'");
    expect(viteConfigSource).toContain("'@radix-ui/react-select'");
    expect(viteConfigSource).toContain("'@radix-ui/react-separator'");
  });

  it('keeps the patched Excalidraw workspace package out of stale dev pre-bundles', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');
    const includeDeps = extractOptimizeDepsArray(viteConfigSource, 'include');
    const excludeDeps = extractOptimizeDepsArray(viteConfigSource, 'exclude');

    expect(includeDeps).not.toContain("'@axhub/excalidraw'");
    expect(excludeDeps).toContain("'@axhub/excalidraw'");
  });

  it('pre-bundles Excalidraw PNG CommonJS dependencies reached by the lazy canvas chunk', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');
    const includeDeps = extractOptimizeDepsArray(viteConfigSource, 'include');

    expect(includeDeps).toContain("'@axhub/excalidraw > png-chunk-text'");
    expect(includeDeps).toContain("'@axhub/excalidraw > png-chunks-encode'");
    expect(includeDeps).toContain("'@axhub/excalidraw > png-chunks-extract'");
  });

  it('pre-bundles Excalidraw CommonJS utility dependencies reached by the lazy canvas chunk', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');
    const includeDeps = extractOptimizeDepsArray(viteConfigSource, 'include');

    expect(includeDeps).toContain("'@axhub/excalidraw > lodash.throttle'");
    expect(includeDeps).toContain("'@axhub/excalidraw > lodash.debounce'");
    expect(includeDeps).toContain("'@axhub/excalidraw > fuzzy'");
    expect(includeDeps).toContain("'@axhub/excalidraw > @excalidraw/markdown-to-text'");
  });

  it('pre-bundles CommonJS external-store shims reached by the lazy canvas chunk', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');
    const includeDeps = extractOptimizeDepsArray(viteConfigSource, 'include');

    expect(includeDeps).toContain("'use-sync-external-store/shim'");
    expect(includeDeps).toContain("'use-sync-external-store/shim/with-selector'");
    expect(includeDeps).toContain("'use-sync-external-store/shim/with-selector.js'");
  });

  it('pre-bundles the CommonJS dayjs entry reached by the lazy canvas chunk', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');
    const includeDeps = extractOptimizeDepsArray(viteConfigSource, 'include');

    expect(includeDeps).toContain("'dayjs'");
  });

  it('pre-bundles the CommonJS sanitize-url entry reached by Mermaid inside the lazy canvas chunk', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');
    const includeDeps = extractOptimizeDepsArray(viteConfigSource, 'include');

    expect(includeDeps).toContain("'@braintree/sanitize-url'");
  });
});
