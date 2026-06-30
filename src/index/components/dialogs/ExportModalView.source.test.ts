import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './ExportModalView.tsx'), 'utf8');
}

describe('ExportModalView source', () => {
  it('renames the dynamic Axure prototype tab without changing the tab key', () => {
    const source = readSource();

    expect(source).toContain('<DialogTitle className="sr-only">导出带交互原型</DialogTitle>');
    expect(source).toContain('value="dynamicPrototype"');
    expect(source).toContain('带交互原型');
    expect(source).not.toContain('导出到 Axure');
    expect(source).not.toContain('动态原型');
    expect(source).not.toContain('复制 runtime 组件');
  });
});
