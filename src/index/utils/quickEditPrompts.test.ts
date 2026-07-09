import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildQuickEditAcpPrompt } from './quickEditPrompts';

const PROMPT_PATH_PATTERN = /(?:^|[\s`"'：（(【\[])(?:\/?(?:src|skills|rules|temp|docs|database|themes|prototypes|components|assets|media|\.axhub)\/|~\/|[A-Za-z]:[\\/]|(?:[A-Za-z0-9_.-]+[\\/]){2,})/u;

function expectPromptHasNoPaths(prompt: string): void {
    const normalized = prompt.replace(/comments\/tasks\/images/gu, 'comment-fields');
    expect(normalized).not.toMatch(PROMPT_PATH_PATTERN);
    expect(prompt).not.toContain('路径');
}

function expectPromptUsesLocalPrototypeCommentsProtocol(prompt: string): void {
    expect(prompt).toContain('.spec/prototype-comments.json');
    expect(prompt).toContain('comments/tasks/images');
    expect(prompt).toContain('assetPath');
    expect(prompt).toContain('prototype-comment-assets');
    expect(prompt).toContain('不调用 CLI/API');
    expect(prompt).toContain('不做 live sync');
    expect(prompt).toContain('删除已处理');
    expect(prompt).toContain('comments[].elementKey');
    expect(prompt).toContain('tasks[elementKey]');
    expect(prompt).not.toContain('npx @axhub/genie');
    expect(prompt).not.toContain('页面同步');
    expect(prompt).not.toContain('best-effort');
    expect(prompt).not.toContain('entries/tasks');
    expect(prompt).not.toMatch(/\b(?:editing|completed|error)\b/u);
}

describe('buildQuickEditAcpPrompt', () => {
  it('builds a quick-edit prompt with guidance names and selected elements without exposing paths', () => {
    const prompt = buildQuickEditAcpPrompt({
      currentFilePath: 'src/prototypes/home/index.tsx',
      currentFileDisplayName: '首页',
      projectPath: '/workspace/demo/project',
      selectedElements: [
        {
          tag: 'button',
          selector: '#hero-cta',
          label: '主按钮',
        },
      ],
    });

    expect(prompt).toContain('原型批注处理');
    expect(prompt).toContain('本地批注与图片素材参考');
    expect(prompt).not.toContain('完整走通 CLI 流程');
    expectPromptUsesLocalPrototypeCommentsProtocol(prompt);
    expect(prompt).not.toContain('src/prototypes/home/index.tsx');
    expect(prompt).toContain('首页');
    expect(prompt).not.toContain('/workspace/demo/project');
    expect(prompt).toContain('主按钮');
    expect(prompt).toContain('#hero-cta');
    expect(prompt).toContain('结构、样式或文案');
    expectPromptHasNoPaths(prompt);
  });

  it('falls back gracefully when there are no selected elements', () => {
    const prompt = buildQuickEditAcpPrompt({
      currentFilePath: 'src/components/card/index.tsx',
      selectedElements: [],
    });

    expect(prompt).toContain('当前没有明确的页面选中元素');
    expect(prompt).toContain('card');
    expect(prompt).not.toContain('src/components/card/index.tsx');
    expectPromptHasNoPaths(prompt);
  });

  it('throws when current file path is missing', () => {
    expect(() => buildQuickEditAcpPrompt({
      currentFilePath: '',
    })).toThrow('当前文件路径为空');
  });

  it('does not expose the obsolete Agent prompt builder name', () => {
    expect('buildQuickEditGeniePrompt' in { buildQuickEditAcpPrompt }).toBe(false);
  });
});

describe('prototype-comments skill docs', () => {
  const skillDocs = [
    '../../../client/.agents/skills/prototype-comments/SKILL.md',
    '../../../client/.claude/skills/prototype-comments/SKILL.md',
  ];

  it.each(skillDocs)('documents the local-only deletion protocol in %s', (relativePath) => {
    const source = readFileSync(resolve(__dirname, relativePath), 'utf8');

    expect(source).toContain('.spec/prototype-comments.json');
    expect(source).toContain('comments/tasks/images');
    expect(source).toContain('images[].assetPath');
    expect(source).toContain('.spec/prototype-comment-assets/');
    expect(source).toContain('comments[].elementKey');
    expect(source).toContain('tasks[elementKey]');
    expect(source).toContain('删除对应批注记录和任务记录');
    expect(source).toContain('仍被其他剩余批注引用');
    expect(source).toContain('tasks.hero');
    expect(source).toContain('hero-only.png');
    expect(source).toContain('shared.png');
    expect(source).toContain('不调用 CLI/API');
    expect(source).not.toContain('npx @axhub/genie');
    expect(source).not.toContain('页面同步辅助');
    expect(source).not.toContain('页面同步');
    expect(source).not.toContain('best-effort');
    expect(source).not.toContain('entries/tasks');
    expect(source).not.toMatch(/\b(?:idle|editing|completed|error)\b/u);
  });
});
