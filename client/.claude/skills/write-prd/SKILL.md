---
name: write-prd
description: Use when the user explicitly asks to write, draft, create, update, or synthesize a PRD for an Axhub Make client project, especially when the PRD may aggregate multiple prototypes, resources, canvas notes, or existing product context.
---

# Write PRD

把当前对话、项目资源、原型和画布上下文整理成简洁 PRD。不要进行长轮需求访谈；如果缺少会影响范围或验收的关键决策，最多问一个聚焦问题，或写明合理假设。

## 上下文读取

优先看需求资料，不默认把工作流文档当成需求来源：

1. 用户当前说明、附件、截图，以及用户提供的模板。
2. `src/resources/` 中已有产品资料、PRD、模板、素材和长期文档。
3. 按 `rules/requirements-alignment-guide.md` 读取相关原型主规格。
4. 相关原型页面、`annotation-source.json`、批注、状态定义和可见文案。
5. 相关 `src/resources/**/*.excalidraw` 和同级 `<name>.assets/`，用于识别跨原型关系、流程草图和补充说明。

## 模板入口

每次只读取一个明确的模板入口文件，并按该文件的章节、字段和表达要求写作。入口优先级为：

1. 用户为当前任务明确指定的模板。
2. `plan-prds` 传入的任务级模板覆盖。
3. `plan-prds` 传入的计划默认模板。
4. 项目中已经明确采用的 PRD 模板。
5. 默认轻量模板 `src/resources/templates/prd-template.md`。

用户或 `plan-prds` 已经给出模板路径时直接使用，不重复询问。模板文件不存在或不可读时，说明具体路径问题并最多询问一次替代模板；不得静默切换到其他模板。

模板入口引用外部说明或成果文档时，只按需读取当前 PRD 使用的链接文档，不把参考目录视为多个模板入口。只有内容被多份 PRD 复用、需要独立评审或明显影响主文档可读性时才创建外部文档；拆分后，主 PRD 保留与当前需求相关的结论摘要、引用目的和有效相对链接。无需拆分时删除示例链接，不保留断链或空文件。

PRD 只写产品决策、用户体验、范围、业务模型、规则和验收。不要堆易过期的文件路径、代码片段或实现清单；如果某个原型片段能比文字更准确地表达状态机、数据结构或流程决策，只摘取最小必要片段并说明来自原型。

## 存储位置

PRD 默认写入 `src/resources/`，因为它可能聚合多个原型，而不只服务单个原型。使用清晰的 Markdown 文件名，例如：

```text
src/resources/<topic>-prd.md
src/resources/prd/<topic>.md
```

PRD 仍写入 `src/resources/prd/`。如果内容会改变单个原型的范围或行为，按 `rules/requirements-alignment-guide.md` 同步更新主规格中的引用或相关决策。

## 完成输出

完成后说明：

- PRD 路径。
- 使用了哪些主要来源，包括资源、原型和画布文件。
- 使用了用户模板、项目模板，还是默认结构。
- 仍然存在的开放问题或关键假设。
