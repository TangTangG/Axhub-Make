import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readClientFile(relativePath: string): string {
  return readFileSync(resolve(__dirname, '../../../client', relativePath), 'utf8');
}

function readSkillDescription(source: string): string {
  const match = source.match(/^description:\s*(.+)$/mu);
  return match?.[1]?.trim() || '';
}

describe('default client skills', () => {
  it('bundles the Drawio skill for Codex and Claude Code project skills', () => {
    const skillRoots = [
      '.agents/skills/drawio',
      '.claude/skills/drawio',
    ];

    for (const root of skillRoots) {
      const skillSource = readClientFile(`${root}/SKILL.md`);

      expect(skillSource).toContain('name: drawio');
      expect(skillSource).toContain('YAML-first');
      expect(skillSource).toContain('scripts/cli.js');
      expect(existsSync(resolve(__dirname, '../../../client', `${root}/scripts/cli.js`))).toBe(true);
      expect(existsSync(resolve(__dirname, '../../../client', `${root}/scripts/package.json`))).toBe(true);
      expect(existsSync(resolve(__dirname, '../../../client', `${root}/scripts/package-lock.json`))).toBe(true);
      expect(existsSync(resolve(__dirname, '../../../client', `${root}/references/workflows/create.md`))).toBe(true);
      expect(existsSync(resolve(__dirname, '../../../client', `${root}/assets/schemas/spec.schema.json`))).toBe(true);
    }
  });

  it('records Drawio skill provenance in the project skill lockfile', () => {
    const lock = JSON.parse(readClientFile('skills-lock.json')) as any;

    expect(lock.skills.drawio).toMatchObject({
      source: 'bahayonghang/drawio-skills',
      sourceType: 'github',
      skillPath: 'skills/drawio/SKILL.md',
    });
    expect(lock.skills.drawio.computedHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('routes canvas Drawio requests through the Drawio skill before placing canvas nodes', () => {
    const skillSources = [
      readClientFile('.agents/skills/canvas-workspace/SKILL.md'),
      readClientFile('.claude/skills/canvas-workspace/SKILL.md'),
    ];

    for (const source of skillSources) {
      expect(source).toContain('$drawio');
      expect(source).toContain('$drawio` 生成可编辑 Draw.io 图');
      expect(source).toContain('canvas.excalidraw');
      expect(source).toContain('Drawio 图片节点');
    }
  });

  it('keeps the canvas workspace skill trigger scoped to canvas drafts and Drawio diagrams', () => {
    const skillSources = [
      readClientFile('.agents/skills/canvas-workspace/SKILL.md'),
      readClientFile('.claude/skills/canvas-workspace/SKILL.md'),
    ];

    for (const source of skillSources) {
      const description = readSkillDescription(source);

      expect(description).toContain('Axhub 画布');
      expect(description).toContain('原型草稿');
      expect(description).toContain('Drawio 图表');
      expect(description).not.toContain('主题嵌入节点');
      expect(description).not.toContain('AI 生成节点');
    }
  });
});
