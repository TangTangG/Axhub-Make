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
3. 相关 `src/prototypes/<prototype-id>/.spec/` 文档。
4. 相关原型页面、`annotation-source.json`、批注、状态定义和可见文案。
5. 相关 `src/prototypes/<prototype-id>/canvas.excalidraw` 和 `canvas-assets/`，用于识别跨原型关系、流程草图和补充说明。

## 模板优先级

- 用户提供的模板优先，按其章节、字段和表达风格写。
- 如果 `src/resources/` 里已有 PRD 或项目模板，沿用其结构。
- 如果没有模板，使用下面的默认结构。
- PRD 只写产品决策、用户体验、范围、规则和验收。不要堆易过期的文件路径、代码片段或实现清单；如果某个原型片段能比文字更准确地表达状态机、数据结构或流程决策，只摘取最小必要片段并说明来自原型。

## 默认结构

```markdown
# <功能或产品名> PRD

## 背景与问题
为什么要做，当前问题是什么，依据来自哪些上下文。

## 目标
本 PRD 要达成的产品结果。

## 用户与场景
谁会使用，在什么情况下使用，要支持哪些核心场景。

## 范围
本次包含的能力、页面、流程或内容模块。

## 用户故事
用编号列表描述：作为 <角色>，我希望 <能力>，从而 <价值>。

## 体验与内容要求
页面、原型、标注、画布、内容、状态和交互层面的用户可见要求。

## 功能要求
行为、数据、权限、集成、边界条件和异常状态。

## 验收标准
产品、设计和实现评审时可以观察验证的检查项。

## 不在范围
明确不做或延后的内容。

## 开放问题
只保留会影响范围、验收或交付的问题。
```

## 存储位置

PRD 默认写入 `src/resources/`，因为它可能聚合多个原型，而不只服务单个原型。使用清晰的 Markdown 文件名，例如：

```text
src/resources/<topic>-prd.md
src/resources/prd/<topic>.md
```

只有用户明确要求 PRD 绑定单个原型、且不需要作为项目级资源沉淀时，才写入原型 `.spec/` 目录。

## 完成输出

完成后说明：

- PRD 路径。
- 使用了哪些主要来源，包括资源、原型和画布文件。
- 使用了用户模板、项目模板，还是默认结构。
- 仍然存在的开放问题或关键假设。
