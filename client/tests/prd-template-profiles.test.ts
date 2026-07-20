import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesRoot = path.join(clientRoot, 'src/resources/templates');
const agentWritePrdPath = path.join(clientRoot, '.agents/skills/write-prd/SKILL.md');
const claudeWritePrdPath = path.join(clientRoot, '.claude/skills/write-prd/SKILL.md');

function readTemplate(fileName: string): string {
  return fs.readFileSync(path.join(templatesRoot, fileName), 'utf8');
}

describe('PRD template profiles', () => {
  it('keeps the default PRD template lightweight while supporting business-model links', () => {
    const template = readTemplate('prd-template.md');

    expect(template).toMatch(/^# PRD 模板$/mu);
    expect(template).toContain('## 核心对象与数据模型');
    expect(template).toContain('业务对象、关键字段、对象关系和必要状态');
    expect(template).toContain('保留与当前 PRD 相关的摘要');
    expect(template).toContain('相对链接');
    expect(template).toContain('不展开数据库、接口或代码结构');
  });

  it('ships one comprehensive PRD entry with optional linked-document guidance', () => {
    const templatePath = path.join(templatesRoot, 'prd-comprehensive-template.md');

    expect(fs.existsSync(templatePath)).toBe(true);
    const template = fs.readFileSync(templatePath, 'utf8');
    for (const heading of [
      '# 完善型 PRD 模板',
      '## 文档目录与关联文档',
      '## 背景与问题',
      '## 目标与成功标准',
      '## 用户、角色与场景',
      '## 范围、能力与信息架构',
      '## 数据模型',
      '## 业务规则',
      '## 权限与作用范围',
      '## 状态、异常与边界',
      '## 字段、内容与交互要求',
      '## 非功能要求',
      '## 验收标准与来源追溯',
      '## 风险、依赖与开放问题',
    ]) {
      expect(template).toContain(heading);
    }
    expect(template).toContain('./models/domain-model.md');
    expect(template).toContain('按需');
    expect(template).toContain('不是固定生成清单');
    expect(template).toContain('主 PRD 保留与当前需求相关的结论摘要');
  });

  it('makes write-prd consume one selected template entry and only needed references', () => {
    const agentSkill = fs.readFileSync(agentWritePrdPath, 'utf8');
    const claudeSkill = fs.readFileSync(claudeWritePrdPath, 'utf8');

    expect(agentSkill).toBe(claudeSkill);
    expect(agentSkill).toContain('每次只读取一个明确的模板入口文件');
    expect(agentSkill).toContain('src/resources/templates/prd-template.md');
    expect(agentSkill).toContain('任务级模板覆盖');
    expect(agentSkill).toContain('计划默认模板');
    expect(agentSkill).toContain('只按需读取当前 PRD 使用的链接文档');
    expect(agentSkill).toContain('主 PRD 保留与当前需求相关的结论摘要');
    expect(agentSkill).toContain('模板文件不存在或不可读');
    expect(agentSkill).toContain('不得静默切换');
    expect(agentSkill).not.toContain('## 默认结构');
  });
});
