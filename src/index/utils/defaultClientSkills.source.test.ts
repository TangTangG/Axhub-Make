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
  it('keeps Drawio as a canvas workspace reference instead of a default project skill', () => {
    const skillRoots = [
      '.agents/skills/canvas-workspace',
      '.claude/skills/canvas-workspace',
    ];

    expect(existsSync(resolve(__dirname, '../../../client', '.agents/skills/drawio'))).toBe(false);
    expect(existsSync(resolve(__dirname, '../../../client', '.claude/skills/drawio'))).toBe(false);

    for (const root of skillRoots) {
      const skillSource = readClientFile(`${root}/SKILL.md`);
      const referenceSource = readClientFile(`${root}/references/drawio/SKILL.md`);

      expect(skillSource).toContain('references/drawio/SKILL.md');
      expect(referenceSource).toContain('name: drawio');
      expect(referenceSource).toContain('Draw.io Base Skill');
      expect(referenceSource).toContain('Use this base skill');
      expect(existsSync(resolve(__dirname, '../../../client', `${root}/references/drawio/scripts/cli.js`))).toBe(true);
      expect(existsSync(resolve(__dirname, '../../../client', `${root}/references/drawio/scripts/package.json`))).toBe(true);
      expect(existsSync(resolve(__dirname, '../../../client', `${root}/references/drawio/references/workflows/create.md`))).toBe(true);
      expect(existsSync(resolve(__dirname, '../../../client', `${root}/references/drawio/assets/schemas/spec.schema.json`))).toBe(true);
    }
  });

  it('does not record hidden Drawio references in the project skill lockfile', () => {
    const lock = JSON.parse(readClientFile('skills-lock.json')) as any;

    expect(lock.skills.drawio).toBeUndefined();
  });

  it('keeps flowchart routing inside the canvas workspace instead of a standalone skill', () => {
    expect(existsSync(resolve(__dirname, '../../../client', '.agents/skills/flowchart'))).toBe(false);
    expect(existsSync(resolve(__dirname, '../../../client', '.claude/skills/flowchart'))).toBe(false);
  });

  it('keeps Impeccable as an on-demand rule reference instead of a default project skill', () => {
    expect(existsSync(resolve(__dirname, '../../../client', '.agents/skills/impeccable'))).toBe(false);
    expect(existsSync(resolve(__dirname, '../../../client', '.claude/skills/impeccable'))).toBe(false);
    expect(existsSync(resolve(__dirname, '../../../client', 'rules/references/impeccable/SKILL.md'))).toBe(true);
    expect(existsSync(resolve(__dirname, '../../../client', 'rules/references/impeccable/reference/critique.md'))).toBe(true);
    expect(existsSync(resolve(__dirname, '../../../client', 'rules/references/impeccable/scripts/detect.mjs'))).toBe(true);
  });

  it('routes canvas work through four product types', () => {
    const skillSources = [
      readClientFile('.agents/skills/canvas-workspace/SKILL.md'),
      readClientFile('.claude/skills/canvas-workspace/SKILL.md'),
    ];

    for (const source of skillSources) {
      expect(source).toContain('四类产物');
      expect(source).toContain('文档、原型页面、图片、流程图');
      expect(source).toContain('文档：');
      expect(source).toContain('原型页面：');
      expect(source).toContain('图片：');
      expect(source).toContain('流程图：');
      expect(source).toContain('产物类型不清时先问一个问题');
      expect(source).toContain('canvas.excalidraw');
      expect(source).not.toContain('$flowchart');
    }
  });

  it('routes canvas document text through Markdown resources before canvas placement', () => {
    const skillSources = [
      readClientFile('.agents/skills/canvas-workspace/SKILL.md'),
      readClientFile('.claude/skills/canvas-workspace/SKILL.md'),
    ];

    for (const source of skillSources) {
      expect(source).toContain('文档、说明、PRD、清单、列表、报告或其他文本内容');
      expect(source).toContain('默认先生成 Markdown 文档到 `src/resources/`');
      expect(source).toContain('再把该文档作为文档节点创建或更新到当前 `canvas.excalidraw`');
      expect(source).toContain('不要把正文直接拆成大量画布文本框');
    }
  });

  it('routes canvas diagrams by chart type before selecting Drawio', () => {
    const skillSources = [
      readClientFile('.agents/skills/canvas-workspace/SKILL.md'),
      readClientFile('.claude/skills/canvas-workspace/SKILL.md'),
    ];

    for (const source of skillSources) {
      expect(source).toContain('先判断图表类型和可编辑载体');
      expect(source).toContain('流程、关系、序列、状态、类、ER 和简单盒线架构');
      expect(source).toContain('优先用 Mermaid 作为中间结构并转普通 Excalidraw 元素');
      expect(source).toContain('复杂泳道、排期/甘特、复杂云架构、网络拓扑或厂商图标');
      expect(source).toContain('只有类型或载体重叠不确定时才询问用户');
      expect(source).not.toContain('$drawio');
    }
  });

  it('keeps the canvas workspace skill trigger scoped to canvas drafts and routed diagram placement', () => {
    const skillSources = [
      readClientFile('.agents/skills/canvas-workspace/SKILL.md'),
      readClientFile('.claude/skills/canvas-workspace/SKILL.md'),
    ];

    for (const source of skillSources) {
      const description = readSkillDescription(source);

      expect(description).toContain('Axhub 画布');
      expect(description).toContain('原型草稿');
      expect(description).toContain('流程图');
      expect(description).not.toContain('主题嵌入节点');
      expect(description).not.toContain('AI 生成节点');
    }
  });

  it('keeps canvas workspace reference docs gated and lean', () => {
    const skillRoots = [
      '.agents/skills/canvas-workspace',
      '.claude/skills/canvas-workspace',
    ];

    for (const root of skillRoots) {
      const skillSource = readClientFile(`${root}/SKILL.md`);

      expect(skillSource).toContain('references/canvas-read-write.md');
      expect(skillSource).toContain('references/axhub-nodes.md');
      expect(skillSource).toContain('需要普通 Excalidraw 元素绘制时');
      expect(skillSource).toContain('references/excalidraw-basics.md');
      expect(skillSource).toContain('确定要创建或编辑 Drawio 节点时');
      expect(skillSource).toContain('references/drawio/SKILL.md');
      expect(skillSource).not.toContain('element-templates.md');
      expect(existsSync(resolve(__dirname, '../../../client', `${root}/references/element-templates.md`))).toBe(false);
    }
  });

  it('bundles the Write PRD skill with Axhub resource and template rules', () => {
    const skillRoots = [
      '.agents/skills/write-prd',
      '.claude/skills/write-prd',
    ];

    for (const root of skillRoots) {
      const skillSource = readClientFile(`${root}/SKILL.md`);
      const interfaceSource = readClientFile(`${root}/agents/openai.yaml`);

      expect(skillSource).toContain('name: write-prd');
      expect(skillSource).toContain('src/resources/');
      expect(skillSource).toContain('用户提供的模板');
      expect(skillSource).toContain('canvas.excalidraw');
      expect(skillSource).not.toContain('ready-for-agent');
      expect(skillSource).not.toContain('/setup-matt-pocock-skills');
      expect(interfaceSource).toContain('display_name: "写 PRD"');
    }
  });
});
