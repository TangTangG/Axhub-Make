import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const agentRoot = path.join(clientRoot, '.agents/skills/plan-prds');
const claudeRoot = path.join(clientRoot, '.claude/skills/plan-prds');
const relativeFiles = [
  'SKILL.md',
  'agents/openai.yaml',
  'references/source-handlers.md',
  'references/requirements-interrogation.md',
  'assets/PROJECT.md',
  'assets/SOURCES.md',
  'assets/PLAN.md',
];

function read(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('plan-prds skill', () => {
  it('ships matching skill packages with source-first routing and durable product artifacts', () => {
    for (const relativePath of relativeFiles) {
      expect(fs.existsSync(path.join(agentRoot, relativePath)), `${relativePath} missing in .agents`).toBe(true);
      expect(fs.existsSync(path.join(claudeRoot, relativePath)), `${relativePath} missing in .claude`).toBe(true);
      expect(read(agentRoot, relativePath)).toBe(read(claudeRoot, relativePath));
    }

    const skill = read(agentRoot, 'SKILL.md');
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? '';
    const frontmatterKeys = frontmatter
      .split('\n')
      .map((line) => line.match(/^([a-z][a-z0-9_-]*):/u)?.[1])
      .filter(Boolean);

    expect(frontmatterKeys).toEqual(['name', 'description']);
    expect(frontmatter).toContain('name: plan-prds');
    expect(frontmatter).toContain('description: Use when');
    expect(frontmatter).not.toContain('multiple PRDs');
    expect(frontmatter).not.toContain('mixed scopes');
    expect(skill).toContain('# PRD 规划');
    expect(skill).toContain('再按业务边界决定文档数量');
    expect(skill).toContain('不预设 PRD 数量');
    expect(skill).not.toContain('默认每期安排');
    expect(skill).not.toContain('规划多篇 PRD');
    expect(skill).toContain('### 1. 先确认需求类型');
    expect(skill).not.toContain('### 1. 先确认当前阶段');
    expect(skill).toContain('现状反推');
    expect(skill).toContain('新增或创作需求');
    expect(skill).not.toContain('混合场景');
    expect(skill).toContain('先完成并确认现状反推，再进入新增或创作需求');
    expect(skill).toContain('两类内容分别登记来源、范围和 PRD 任务');
    expect(skill).not.toContain('两个阶段分别登记来源、范围和 PRD 任务');
    expect(skill).toContain('互联网调研');
    expect(skill).toContain('**REQUIRED SUB-SKILL:** Use `china-customer-research`');
    expect(skill).toContain('具体处理方式见 `references/source-handlers.md`');
    expect(skill).not.toContain('1. **搜索引擎检索**');
    expect(skill).not.toContain('搜索摘要只用于发现线索');
    expect(skill).toContain('需求拷问');
    expect(skill).toContain('references/requirements-interrogation.md');
    expect(skill).not.toContain('需求探索');
    expect(skill).not.toContain('references/requirements-exploration.md');
    expect(skill).not.toContain('Use `requirements-exploration`');
    expect(skill).not.toContain('两项都不自动开启');
    expect(skill).not.toContain('用户只选择互联网调研时');
    expect(skill).not.toContain('两项都开启时');
    expect(skill).not.toContain('采集用户指定的产品链接仍属于事实采集');
    expect(skill).not.toContain('互联网研究结果标记为外部研究');
    expect(skill).toContain('纯现状反推直接跳过');
    expect(skill).toContain('标为 `合理推断` 也不能把补造内容写入反推 PRD');
    expect(skill).toContain('补齐现状资料缺口仍属于现状反推');
    expect(skill).not.toContain('Chrome CDP');
    expect(skill).not.toContain('网站来源必须把页面目录');
    expect(skill).toContain('src/resources/prd/PROJECT.md');
    expect(skill).toContain('src/resources/<product-name>/');
    expect(skill).not.toContain('<product-id>');
    expect(skill).toContain('如果 `src/resources/prd/` 已属于其他产品');
    expect(skill).toContain('write-prd');
    expect(skill).toContain('默认使用子代理按 `PLAN.md` 的依赖顺序执行');
    expect(skill).toContain('如果没有子代理，建议用户为每个阶段新开一个对话');
    expect(skill).not.toContain('上下文充足且任务连续');
    expect(skill).not.toContain('上下文已经较大');
    expect(skill).not.toContain('相互独立且环境支持时可以使用子代理');
    expect(skill).not.toContain('DESIGN.md');
    expect(skill).not.toContain('<topic-id>');

    const metadata = read(agentRoot, 'agents/openai.yaml');
    expect(metadata).toContain('display_name: "PRD 规划"');
    expect(metadata).not.toContain('多篇 PRD');
    expect(metadata).toContain('$plan-prds');
  });

  it('defines source handlers and normalized semantic names', () => {
    const handlers = read(agentRoot, 'references/source-handlers.md');

    expect(handlers).toContain('| 网站链接 |');
    expect(handlers).not.toContain('| 公开网站 |');
    expect(handlers).not.toContain('| 登录后网站 |');
    expect(handlers).toContain('尽量覆盖当前访问条件下可进入的全部页面');
    expect(handlers).toContain('Chrome CDP');
    expect(handlers).toContain('Bridge');
    expect(handlers).toContain('extract-axure-data');
    expect(handlers).toContain('https://github.com/lintendo/Axhub-Skills/tree/main/skills/extract-axure-data');
    expect(handlers).toContain('https://www.skills.sh/larksuite/cli');
    expect(handlers).toContain('china-customer-research');
    expect(handlers).toContain('搜索引擎检索 -> 客户证据研究');
    expect(handlers).toContain(
      'https://github.com/lintendo/Axhub-Skills/blob/main/skills/china-customer-research/SKILL.md',
    );
    expect(handlers).toContain('<三位序号>-<page-id>-<state-id>-<viewport>.png');
    expect(handlers).toContain('所选产品目录');
    expect(handlers).not.toContain('src/resources/prd/<product-id>/sources/');
    expect(handlers).toContain('<原文件名去扩展名>.extracted.md');
    expect(handlers).toContain('不索取或持久化用户密码');
  });

  it('uses source collection state to gate product planning and dynamic phases', () => {
    const skill = read(agentRoot, 'SKILL.md');
    const handlers = read(agentRoot, 'references/source-handlers.md');
    const interrogation = read(agentRoot, 'references/requirements-interrogation.md');
    const sources = read(agentRoot, 'assets/SOURCES.md');
    const plan = read(agentRoot, 'assets/PLAN.md');

    expect(skill).toContain('先创建或更新 `SOURCES.md`');
    expect(skill).toContain('登记来源不等于完成采集');
    expect(skill).toContain('登记后立即继续采集');
    expect(skill).toContain('确认是同一产品时沿用现有 `PROJECT.md`');
    expect(skill).toContain('不得按新项目处理');
    expect(skill).toContain('已有的已完成来源可以复用');
    expect(skill).toContain('新增或变化的来源仍须经过第 4 步采集门禁');
    expect(skill).toContain('第 4 步登记后再执行');
    expect(skill).toContain('逐项尝试全部必需来源');
    expect(skill).toContain('完成所有当前可执行的主采集');
    expect(skill).toContain('规模超出单次执行时只报告进度');
    expect(skill).toContain('不创建或更新 `PROJECT.md` 和 `PLAN.md`');
    expect(skill).toContain('主采集未完成时必须继续采集，不询问用户');
    expect(skill).toContain('继续补采');
    expect(skill).toContain('接受缺口并进入计划确认');
    expect(skill).not.toContain('不询问用户是否接受缺口');
    expect(skill).toContain('真实阻塞仍需反馈原因和影响');
    expect(skill).toContain('所有必需来源均为 `已完成`，或用户接受已列补采项/真实阻塞后');
    expect(skill).not.toContain('如存在 `部分完成` 或 `阻塞`，反馈原因和缺口，请用户选择继续采集或接受缺口');
    expect(skill).toContain('只有用户明确接受后');
    expect(skill).toContain('来源缺口与冲突');
    expect(skill).toContain('决定、接受或排除范围和日期');
    expect(skill).toContain('全部完成后才能标为 `已完成`');
    expect(skill).toContain('根据 PRD 数量、依赖关系和上下文规模动态分期');
    expect(skill).toContain('采集不属于 `PLAN.md` 的阶段');
    expect(skill).toContain('任务少且一个上下文可以完成时只设一期');
    expect(skill).toContain('确认前不执行 `write-prd`');
    expect(skill).toContain('确认后把获批任务从 `待确认` 改为 `待编写`');
    expect(skill).toContain('只执行状态为 `待编写` 的任务');
    expect(plan).toContain('只执行状态为 `待编写` 的任务');
    expect(interrogation).toContain('确认结果先登记到 `SOURCES.md`');
    expect(interrogation).toContain('通过采集门禁后再写入 `PROJECT.md` 和 `PLAN.md`');
    expect(sources).toContain('| 来源 ID | 文件 | 内容范围 | 关联模块 | 提取结果 | 处理状态 |');
    expect(sources).toContain('| 来源 ID | 缺口/冲突/决定（含范围与日期） | 影响 | 后续处理 |');
    expect(sources).toContain('`部分完成`（仍有可执行采集）');
    expect(sources).toContain('`阻塞`（已尝试且因外部或待用户决策无法继续）');
    expect(handlers).toContain('在 `SOURCES.md` 标为 `阻塞`');
    expect(handlers).toContain('来源标为 `阻塞`');
    expect(handlers).toContain('仍有可采集证据时保持 `部分完成` 并继续');
    expect(handlers).toContain('穷尽可执行采集后仍缺证据才标为 `阻塞`');
    expect(handlers).toContain('主采集完成条件');
    expect(handlers).toContain('未展开的弹窗、抽屉、错误和权限状态登记为补采项');
    expect(handlers).toContain('不得将来源标为 `已完成`');
    expect(handlers).toContain('证据属性标为 `待用户确认`');
    expect(handlers).not.toContain('不登记为 `阻塞` 或 `部分完成`');
    expect(handlers).not.toContain('标为 `资料冲突/待确认`');
  });

  it('keeps product, evidence, and execution responsibilities in separate templates', () => {
    const project = read(agentRoot, 'assets/PROJECT.md');
    const sources = read(agentRoot, 'assets/SOURCES.md');
    const plan = read(agentRoot, 'assets/PLAN.md');

    for (const heading of ['## 产品概览', '## 用户与场景', '## 产品范围', '## 产品事实', '## 开放问题', '## PRD 目录', '## 产品决策']) {
      expect(project).toContain(heading);
    }
    expect(project).not.toContain('产品 ID');
    expect(project).not.toContain('任务状态');
    expect(project).not.toMatch(/src-\d{3}/u);
    expect(project).not.toMatch(/prd-\d{2}/u);
    expect(project).not.toContain('YYYY-MM-DD');
    expect(sources).toContain('## 来源总表');
    expect(sources).not.toMatch(/src-\d{3}/u);
    expect(sources).not.toContain('YYYY-MM-DD');
    expect(sources).toContain('证据属性');
    expect(sources).toContain('采集清单');
    expect(sources).toContain('## 网站架构');
    expect(plan).toContain('## PRD 任务');
    expect(plan).not.toMatch(/src-\d{3}/u);
    expect(plan).not.toMatch(/prd-\d{2}/u);
    expect(plan).toContain('按任务量、依赖关系和上下文规模动态生成');
    expect(plan).not.toMatch(/^\| 一期 \|/mu);
    for (const status of ['待确认', '待编写', '编写中', '待评审', '已完成', '阻塞']) {
      expect(plan).toContain(status);
    }
  });

  it('folds concise requirements interrogation into plan-prds and removes the standalone skill', () => {
    const interrogation = read(agentRoot, 'references/requirements-interrogation.md');

    expect(interrogation).toContain('# 需求拷问');
    expect(interrogation).toContain('每次只问一个');
    expect(interrogation).toContain('给出推荐答案');
    expect(interrogation).toContain('先自行查证');
    expect(interrogation).toContain('达成共同理解');
    expect(interrogation).not.toContain('需求探索');

    for (const skillRoot of [
      '.agents/skills/requirements-exploration',
      '.claude/skills/requirements-exploration',
    ]) {
      expect(fs.existsSync(path.join(clientRoot, skillRoot))).toBe(false);
    }
  });
});
