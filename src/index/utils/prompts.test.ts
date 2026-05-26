import { describe, expect, it } from 'vitest';

import { generateCreatePrompt } from './prompts';

const PROMPT_PATH_PATTERN = /(?:^|[\s`"'：（(【\[])(?:\/?(?:src|skills|rules|temp|docs|database|themes|prototypes|assets|media|\.axhub)\/|~\/|[A-Za-z]:[\\/]|(?:[A-Za-z0-9_.-]+[\\/]){2,})/u;

function expectPromptHasNoPaths(prompt: string): void {
  expect(prompt).not.toMatch(PROMPT_PATH_PATTERN);
}

describe('generateCreatePrompt', () => {
  it('does not force brainstorming in prototype flow', () => {
    const prompt = generateCreatePrompt('prototypes');

    expect(prompt).not.toContain('`/skills/third-party/brainstorming/SKILL.md`');
    expect(prompt).not.toContain('需求对齐');
    expect(prompt).not.toContain('首次回复模板');
    expect(prompt).not.toContain('确认前不要');
    expectPromptHasNoPaths(prompt);
  });

  it('does not include baked-in process or technical rule sections', () => {
    const prompt = generateCreatePrompt('components');

    expect(prompt).not.toContain('**📋 必读规范文档**：');
    expect(prompt).not.toContain('项目设计规范');
    expect(prompt).not.toContain('项目开发规范');
    expect(prompt).not.toContain('文件结构');
    expect(prompt).not.toContain('依赖引用');
    expect(prompt).not.toContain('样式规范');
    expect(prompt).not.toContain('导出规范');
    expect(prompt).not.toContain('首次回复模板');
    expect(prompt).not.toContain('确认前不要');
    expect(prompt).not.toContain('收到，准备创建');
    expectPromptHasNoPaths(prompt);
  });

  it('does not include the old global warning block', () => {
    const prompt = generateCreatePrompt('components');

    expect(prompt).not.toContain('请务必完整阅读以下所有规范文档和参考资料');
  });

  it('renders only existing theme capabilities and never emits theme paths', () => {
    const prompt = generateCreatePrompt(
      'components',
      [],
      [],
      ['firecrawl'],
      [
        {
          name: 'firecrawl',
          displayName: 'Firecrawl',
          hasDesignSpec: false,
          hasDesignToken: true,
          hasGlobals: false,
          hasIndexTsx: true,
        },
      ],
      [],
      [],
    );

    expect(prompt).toContain('Firecrawl');
    expect(prompt).toContain('设计 token');
    expect(prompt).toContain('运行入口');
    expectPromptHasNoPaths(prompt);
    expect(prompt).not.toContain('`src/themes/firecrawl/designToken.json`');
    expect(prompt).not.toContain('`src/themes/firecrawl/index.tsx`');
    expect(prompt).not.toContain('`src/themes/firecrawl/globals.css`');
    expect(prompt).not.toContain('style.css');
  });

  it('does not force fixed resource directories for selected docs or data assets', () => {
    const prompt = generateCreatePrompt(
      'prototypes',
      ['project-overview.md'],
      [{ name: 'project-overview.md', displayName: 'Project Overview' }],
      [],
      [],
      ['users.json'],
      [{ name: 'users.json', displayName: 'Users' }],
    );

    expect(prompt).toContain('`project-overview.md`');
    expect(prompt).toContain('`users.json`');
    expectPromptHasNoPaths(prompt);
    expect(prompt).not.toContain('`src/resources/project-overview.md`');
    expect(prompt).not.toContain('`src/database/users.json`');
  });

  it('lists design token and globals separately without exposing paths', () => {
    const prompt = generateCreatePrompt(
      'components',
      [],
      [],
      ['trae-design'],
      [
        {
          name: 'trae-design',
          displayName: 'Trae Design',
          hasDesignSpec: false,
          hasDesignToken: true,
          hasGlobals: true,
          hasIndexTsx: false,
        },
      ],
      [],
      [],
    );

    expect(prompt).toContain('设计 token');
    expect(prompt).toContain('全局样式');
    expectPromptHasNoPaths(prompt);
    expect(prompt).not.toContain('`src/themes/trae-design/designToken.json`');
    expect(prompt).not.toContain('`src/themes/trae-design/globals.css`');
    expect(prompt).not.toContain('`src/themes/trae-design/designToken.json` 或 `src/themes/trae-design/globals.css`');
    expect(prompt).not.toContain(' 或 ');
  });
});
