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
});
