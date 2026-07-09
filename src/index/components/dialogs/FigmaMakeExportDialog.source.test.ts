import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './FigmaMakeExportDialog.tsx'), 'utf8');
}

describe('FigmaMakeExportDialog source', () => {
  it('uses Figma Make as the visible export object label', () => {
    const source = readSource();

    expect(source).toContain('导出 Figma Make');
    expect(source).toContain('Figma Make 文件');
    expect(source).toContain('下载 Figma Make');
    expect(source).not.toContain('导出 Figma.Make');
    expect(source).not.toContain('MAKE 文件');
    expect(source).not.toContain('下载 Make');
  });
});
