import { describe, expect, it } from 'vitest';

import { isValidSkillPath, normalizeSkillPath } from './skillPath';

describe('normalizeSkillPath', () => {
  it('normalizes valid skill paths', () => {
    expect(normalizeSkillPath('skills/local-axure-workflow/SKILL.md')).toBe(
      '/skills/local-axure-workflow/SKILL.md'
    );
    expect(normalizeSkillPath('/skills//nested///guide.md')).toBe('/skills/nested/guide.md');
    expect(normalizeSkillPath('skills\\stitch-skills\\design-md\\SKILL.md')).toBe(
      '/skills/stitch-skills/design-md/SKILL.md'
    );
    expect(normalizeSkillPath(' /skills/foo/./bar.md ')).toBe('/skills/foo/bar.md');
    expect(normalizeSkillPath('.agents/skills/prototype-comments/SKILL.md')).toBe(
      '.agents/skills/prototype-comments/SKILL.md',
    );
    expect(normalizeSkillPath('.claude\\skills\\prototype-comments\\SKILL.md')).toBe(
      '.claude/skills/prototype-comments/SKILL.md',
    );
  });

  it('rejects invalid skill paths', () => {
    const invalidCases = [
      '',
      'skills',
      '/skills',
      '/other/path.md',
      '/skills/../escape.md',
      '.agents/skills/../escape.md',
      '.claude/skills/../../escape.md',
      'C:/skills/file.md',
      'https://example.com/skills/file.md',
      '/skills/with\0nul.md',
    ];

    for (const input of invalidCases) {
      expect(normalizeSkillPath(input)).toBeNull();
      expect(isValidSkillPath(input)).toBe(false);
    }
  });
});
