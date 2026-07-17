import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const { htmlToAxure } = vi.hoisted(() => ({
  htmlToAxure: vi.fn(async () => ({ scene: { items: [] } })),
}));

vi.mock('axhub-export-core', () => ({ htmlToAxure }));

describe('axure-export-runtime', () => {
  it('delegates DOM conversion to axhub-export-core', async () => {
    const runtime = await import('./axure-export-runtime');
    const options = {
      rootName: 'Home',
      preserveHierarchy: true,
      preserveSvgIcons: false,
    };

    await expect(runtime.htmlToAxure('#root', options)).resolves.toEqual({ scene: { items: [] } });
    expect(htmlToAxure).toHaveBeenCalledWith('#root', options);
  });

  it('does not depend on the shared runtime export entry', () => {
    const source = readFileSync(resolve(__dirname, './axure-export-runtime.ts'), 'utf8');

    expect(source).toContain("from 'axhub-export-core'");
    expect(source).not.toContain("from './runtime-export-core'");
    expect(source).not.toContain('@zumer/snapdom');
  });
});
