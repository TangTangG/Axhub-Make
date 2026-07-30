import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('PrototypeSpecNavigationDialog', () => {
  it('offers continue, page clear, and cancel as separate actions', () => {
    const source = readFileSync(resolve(__dirname, './PrototypeSpecNavigationDialog.tsx'), 'utf8');

    expect(source).toContain('继续跳转');
    expect(source).toContain('清空批注并跳转');
    expect(source).toContain('取消');
    expect(source).toContain('onContinue');
    expect(source).toContain('onClearAndContinue');
    expect(source).toContain('onCancel');
    expect(source).toContain('clearing');
    expect(source).toContain('annotationCount: number;');
    expect(source).toContain('当前页面可能有未处理的批注');
    expect(source).toContain('{annotationCount} 条，若已处理可以忽略。');
    expect(source).toContain('<DialogHeader className="gap-2">');
    expect(source).toContain('<DialogTitle className="leading-6">');
    expect(source).not.toContain('目标文档：');
    expect(source).not.toContain('text-destructive hover:text-destructive');
  });
});
