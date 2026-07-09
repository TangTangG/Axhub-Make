import { describe, expect, it } from 'vitest';

import { stripMarkdownPreviewFrontmatter } from './previewMarkdownContent';

describe('stripMarkdownPreviewFrontmatter', () => {
  it('removes YAML frontmatter from read-only Markdown preview content', () => {
    const content = [
      '---',
      'title: "原型评审"',
      'reviewer: "AI"',
      'createdAt: "<ISO 时间>"',
      'source: "ai-review"',
      'score: <百分制整数总分>',
      '---',
      '',
      '# 原型评审',
      '',
      '- 审查目标：src/prototypes/<prototype-id>',
    ].join('\n');

    expect(stripMarkdownPreviewFrontmatter(content)).toBe([
      '',
      '# 原型评审',
      '',
      '- 审查目标：src/prototypes/<prototype-id>',
    ].join('\n'));
  });

  it('keeps regular Markdown horizontal rules when they are not metadata blocks', () => {
    const content = [
      '---',
      '',
      'Opening note',
      '',
      '---',
      '',
      '# Body',
    ].join('\n');

    expect(stripMarkdownPreviewFrontmatter(content)).toBe(content);
  });
});
