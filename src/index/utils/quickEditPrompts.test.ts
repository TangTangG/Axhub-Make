import { describe, expect, it } from 'vitest';

import { buildQuickEditGeniePrompt } from './quickEditPrompts';

const PROMPT_PATH_PATTERN = /(?:^|[\s`"'：（(【\[])(?:\/?(?:src|skills|rules|temp|docs|database|themes|prototypes|components|assets|media|\.axhub)\/|~\/|[A-Za-z]:[\\/]|(?:[A-Za-z0-9_.-]+[\\/]){2,})/u;

function expectPromptHasNoPaths(prompt: string): void {
    expect(prompt).not.toMatch(PROMPT_PATH_PATTERN);
    expect(prompt).not.toContain('路径');
}

describe('buildQuickEditGeniePrompt', () => {
  it('builds a quick-edit prompt with guidance names and selected elements without exposing paths', () => {
    const prompt = buildQuickEditGeniePrompt({
      currentFilePath: 'src/prototypes/home/index.tsx',
      currentFileDisplayName: '首页',
      projectPath: '/Users/demo/project',
      selectedElements: [
        {
          tag: 'button',
          selector: '#hero-cta',
          label: '主按钮',
        },
      ],
    });

    expect(prompt).toContain('原型批注处理');
    expect(prompt).toContain('页面同步与截图参考');
    expect(prompt).not.toContain('完整走通 CLI 流程');
    expect(prompt).toContain('.spec/prototype-comments.json');
    expect(prompt).not.toContain('src/prototypes/home/index.tsx');
    expect(prompt).toContain('首页');
    expect(prompt).not.toContain('/Users/demo/project');
    expect(prompt).toContain('主按钮');
    expect(prompt).toContain('#hero-cta');
    expect(prompt).toContain('结构、样式或文案');
    expect(prompt).toContain('页面状态同步为 best-effort');
    expectPromptHasNoPaths(prompt);
  });

  it('falls back gracefully when there are no selected elements', () => {
    const prompt = buildQuickEditGeniePrompt({
      currentFilePath: 'src/components/card/index.tsx',
      selectedElements: [],
    });

    expect(prompt).toContain('当前没有明确的页面选中元素');
    expect(prompt).toContain('card');
    expect(prompt).not.toContain('src/components/card/index.tsx');
    expectPromptHasNoPaths(prompt);
  });

  it('throws when current file path is missing', () => {
    expect(() => buildQuickEditGeniePrompt({
      currentFilePath: '',
    })).toThrow('当前文件路径为空');
  });
});
