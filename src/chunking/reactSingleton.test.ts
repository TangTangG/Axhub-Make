import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('React singleton configuration', () => {
  it('dedupes React packages in the make-server Vite dev server', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');

    expect(viteConfigSource).toContain('dedupe');
    expect(viteConfigSource).toContain("'react'");
    expect(viteConfigSource).toContain("'react-dom'");
  });

  it('dedupes assistant-ui runtime packages used by the ACP composer', () => {
    const viteConfigSource = readFileSync(resolve(__dirname, '../../vite.config.ts'), 'utf8');

    expect(viteConfigSource).toContain('ASSISTANT_UI_SINGLETON_PACKAGES');
    expect(viteConfigSource).toContain('...ASSISTANT_UI_SINGLETON_PACKAGES');
    expect(viteConfigSource).toContain('createPackageSingletonAliases(ASSISTANT_UI_SINGLETON_PACKAGES)');
    expect(viteConfigSource).toContain("path.resolve(__dirname, 'node_modules', packageName)");
    for (const packageName of [
      '@assistant-ui/react',
      '@assistant-ui/react-ai-sdk',
    ]) {
      expect(viteConfigSource).toContain(`'${packageName}'`);
    }
  });
});
