import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templatesRoot = path.join(clientRoot, 'src/resources/templates');
const agentWritePrdPath = path.join(clientRoot, '.agents/skills/write-prd/SKILL.md');
const claudeWritePrdPath = path.join(clientRoot, '.claude/skills/write-prd/SKILL.md');
const agentPlanPrdsPath = path.join(clientRoot, '.agents/skills/plan-prds/SKILL.md');
const claudePlanPrdsPath = path.join(clientRoot, '.claude/skills/plan-prds/SKILL.md');

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

  it('keeps write-prd focused on writing from one selected template', () => {
    const agentSkill = fs.readFileSync(agentWritePrdPath, 'utf8');
    const claudeSkill = fs.readFileSync(claudeWritePrdPath, 'utf8');

    expect(agentSkill).toBe(claudeSkill);
    expect(agentSkill).toContain('根据选定的模板入口文件编写 PRD');
    expect(agentSkill).toContain('src/resources/templates/prd-template.md');
    expect(agentSkill).toContain('允许用户或项目指定其他模板文件');
    expect(agentSkill).toContain('按任务给出的目标路径写入');
    expect(agentSkill).toContain('允许用户或项目指定其他存储位置');
    expect(agentSkill).not.toContain('plan-prds');
    expect(agentSkill).not.toContain('任务级模板覆盖');
    expect(agentSkill).not.toContain('计划默认模板');
    expect(agentSkill).not.toContain('入口优先级');
    expect(agentSkill).not.toContain('模板文件不存在或不可读');
    expect(agentSkill).not.toContain('参考目录');
    expect(agentSkill).not.toContain('## 默认结构');
    expect(agentSkill).not.toContain('src/resources/<topic>-prd.md');
  });

  it('selects one plan-level PRD template with explicit task overrides', () => {
    const agentSkill = fs.readFileSync(agentPlanPrdsPath, 'utf8');
    const claudeSkill = fs.readFileSync(claudePlanPrdsPath, 'utf8');

    expect(agentSkill).toBe(claudeSkill);
    expect(agentSkill).toContain('#### 确认 PRD 模板');
    expect(agentSkill).not.toContain('#### 5.1 确认 PRD 模板');
    expect(agentSkill).toContain('src/resources/templates/prd-template.md');
    expect(agentSkill).toContain('src/resources/templates/prd-comprehensive-template.md');
    expect(agentSkill).toContain('用户自定义模板');
    expect(agentSkill).toContain('用户已指定模板时直接采用；未指定时确认一次并给出推荐');
    expect(agentSkill).toContain('同一计划默认共用一个模板，用户明确指定时可覆盖单个任务');
    expect(agentSkill).toContain('目标路径、来源集合和选定模板');
    expect(agentSkill).toContain('- PRD 模板。');
    expect(agentSkill).not.toContain('当前规划执行上下文');
    expect(agentSkill).not.toContain('`PLAN.md` 的结构或任务字段');
    expect(agentSkill).not.toContain('缺少原对话上下文');
    expect(agentSkill).not.toContain('任务级模板覆盖优先于计划默认模板');
    expect(agentSkill).not.toContain('不得仅因某篇文档内容较多');
  });
});
