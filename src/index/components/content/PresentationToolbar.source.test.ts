import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './PresentationToolbar.tsx'), 'utf8');
}

function getSourceSegment(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('PresentationToolbar source', () => {
  it('uses updated Figma and Axure export menu labels', () => {
    const source = readSource();
    const exportMenuSegment = getSourceSegment(
      source,
      '<DropdownMenuContent align="end" className="w-56 text-sm">',
      '{showHtmlExportEntry ? (',
    );

    expect(exportMenuSegment).toContain('导出 Figma Make');
    expect(exportMenuSegment).toContain('导出带交互原型');
    expect(exportMenuSegment).toContain('复制可编辑原型');
    expect(exportMenuSegment).toContain('使用说明');
    expect(exportMenuSegment).not.toContain('导出 Make');
    expect(exportMenuSegment).not.toContain('导出到 Axure');
    expect(exportMenuSegment).not.toContain('复制到 RunTime 组件');
    expect(exportMenuSegment).not.toContain('复制 RunTime 组件');
    expect(exportMenuSegment).not.toContain('复制 Runtime 组件');
    expect(exportMenuSegment).not.toContain('复制 runtime 组件');
  });
});
