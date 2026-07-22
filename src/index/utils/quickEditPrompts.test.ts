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
    expect(prompt).toContain('统一的共享批注文件');
    expect(prompt).not.toContain('.spec/prototype-comments.json');
    expect(prompt).toContain('comments/tasks/images');
    expect(prompt).toContain('assetPath');
    expect(prompt).toContain('不调用 CLI/API');
    expect(prompt).toContain('不做 live sync');
    expect(prompt).toContain('deletedAt');
    expect(prompt).toContain('只标记本次明确目标');
    expect(prompt).toContain('不移除 JSON 记录');
    expect(prompt).toContain('不删除本地图片文件');
    expect(prompt).toContain('completed');
    expect(prompt).toContain('不等于删除');
    expect(prompt).toContain('comments[].elementKey');
    expect(prompt).toContain('page-scope:${encodeURIComponent(pageScope)}:${encodeURIComponent(elementKey)}');
    expect(prompt).toContain('没有 pageScope 时才直接使用 elementKey');
    expect(prompt).toContain('pageScope 和 elementKey 都匹配');
    expect(prompt).not.toContain('删除已处理');
    expect(prompt).not.toContain('npx @axhub/genie');
    expect(prompt).not.toContain('页面同步');
    expect(prompt).not.toContain('best-effort');
    expect(prompt).not.toContain('entries/tasks');
    expect(prompt).toMatch(/\bediting\b/u);
    expect(prompt).toMatch(/\berror\b/u);
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

describe('handle-comments skill docs', () => {
  const skillDocs = [
    '../../../client/.agents/skills/handle-comments/SKILL.md',
    '../../../client/.claude/skills/handle-comments/SKILL.md',
  ];

  function readSection(source: string, heading: string, nextHeading: string): string {
    return source.slice(source.indexOf(heading), source.indexOf(nextHeading));
  }

  it.each(skillDocs)('documents the persistent comment-status protocol in %s', (relativePath) => {
    const source = readFileSync(resolve(__dirname, relativePath), 'utf8');
    const migrationSection = readSection(source, '## 历史原型批注迁移', '## 处理流程');
    const processingSection = readSection(source, '## 处理流程', '## 明确删除');
    const deletionSection = readSection(source, '## 明确删除', '## 交付');

    expect(source).toContain('.axhub/make/comments/');
    expect(source).toContain('.axhub/make/comment-assets/');
    expect(source).toContain('prototype-comments:v1\\0');
    expect(source).toContain('document-comments:v1\\0');
    expect(source).toContain('`comments[]`');
    expect(source).toContain('`images[].assetPath`');
    expect(source).toContain('历史版本');
    expect(source).toContain('.spec/prototype-comments.json');
    expect(source).toContain('.spec/prototype-comment-assets/');
    expect(migrationSection).toContain('先征得用户确认');
    expect(migrationSection).toContain('复制到对应的新 hash 存储');
    expect(migrationSection).toContain('默认保留历史源文件');
    expect(migrationSection).toContain('目标已有数据时不覆盖或自行合并');
    expect(migrationSection).not.toContain('deletedAt');
    expect(migrationSection).not.toContain('搬到');
    expect(processingSection).toContain('resource.targetPath');
    expect(processingSection).toContain('documentPath');
    expect(processingSection).toContain('locator');
    expect(processingSection).toContain('(pageScope, elementKey)');
    expect(processingSection).toContain('跳过 `state` 为 `editing` 或 `completed` 的批注');
    expect(processingSection).toContain('将批注 `state` 改为');
    expect(processingSection).toContain('不删除或改名批注和图片');
    expect(processingSection).not.toContain('更新 `updatedAt`');
    expect(processingSection).not.toContain('刷新 `updatedAt`');
    expect(deletionSection).toContain('只有用户明确要求删除当前单条批注');
    expect(deletionSection).toContain('同一个 `deletedAt`');
    expect(deletionSection).toContain('虚拟删除');
    expect(deletionSection).toContain('前端读取标记后负责真实清理');
    expect(deletionSection).toContain('不移除 JSON 记录或图片文件');
    expect(source).not.toContain('npx @axhub/genie');
    expect(source).not.toContain('页面同步辅助');
    expect(source).not.toContain('页面同步');
    expect(source).not.toContain('best-effort');
    expect(source).not.toContain('entries/tasks');
    expect(source).toMatch(/\b(?:idle|editing|completed|error)\b/u);
    expect(source).toContain('`completed` 不表示删除');
  });

  it('keeps the Agent and Claude skill copies identical', () => {
    const [agentSkill, claudeSkill] = skillDocs.map((relativePath) => (
      readFileSync(resolve(__dirname, relativePath), 'utf8')
    ));

    expect(agentSkill).toBe(claudeSkill);
  });
});
