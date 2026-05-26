import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dev-template figma copy source', () => {
  it('switches copy-to-figma to the official clipboard method', () => {
    const source = readFileSync(resolve(__dirname, './index.tsx'), 'utf8');

    expect(source).toContain('copyDocumentForFigmaNewOfficialClipboard');
    expect(source).toContain('COPY_TO_FIGMA');
    expect(source).not.toContain('EXPORT_FIGMA_JSON');
  });
});
