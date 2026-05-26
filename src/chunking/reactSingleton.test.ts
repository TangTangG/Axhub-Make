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
});
