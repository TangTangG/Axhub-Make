# UI 评审指导

用于审查 Axhub Make client 原型页面的 UI 质量、设计一致性、响应式、可访问性和核心元件表现。

## 审查入口

当用户说「UI review」「审查这个页面」「检查设计质量」「帮我挑一下 UI 问题」时，读取本规则并输出 Markdown 评审结论。

需要参考 Impeccable 的 UI critique 方法时，只在本次评审中按需读取以下文件：

- `rules/references/impeccable/SKILL.md`
- `rules/references/impeccable/reference/critique.md`

`rules/references/impeccable/` 是第三方技能的完整归档参考，不是默认项目技能。不要调用 `/impeccable critique`，不要运行原技能的上下文注入流程，也不要因为缺少 `PRODUCT.md` 中断评审。

## 审查依据

审查依据只允许是一个 `DESIGN.md`：

1. 用户明确指定的 `DESIGN.md` 或主题目录下的 `DESIGN.md`
2. 用户未指定时，使用项目默认设计的 `DESIGN.md`
3. 如果没有用户指定或项目默认的 `DESIGN.md`，按常规设计评审执行，并在报告中说明未使用设计规范

禁止把以下内容作为审查依据：

- `PRODUCT.md`
- `theme.json`
- `tokens.json`
- CSS 变量文件
- 截图
- README 或其他说明文档

这些文件可以作为证据或实现参考，但不能替代 `DESIGN.md` 的规范地位。

## Impeccable 参考约束

读取 Impeccable 参考流程时，必须以内化方式覆盖以下 Axhub 约束：

```text
Use the copied Impeccable critique reference as the review method, but follow Axhub rules:
1. Use only the selected DESIGN.md as the design basis.
2. Ignore PRODUCT.md and all other design files as normative criteria.
3. If no DESIGN.md is available, continue with a conventional design review and state that no design spec was used.
4. Do not call /impeccable commands or run Impeccable context injection scripts.
5. Produce a Markdown report, not JSON.
6. Write the result to the target prototype .spec directory.
7. Include sections in order: 总体点评, 评分依据, P0-P3 优先级问题, 核心元件.
8. Priorities must contain at most 5 P0-P3 findings.
9. Do not write .impeccable critique artifacts as the deliverable.
```

如果 Impeccable 的原始流程要求 `PRODUCT.md`、`.impeccable/critique`、`.agents/skills/impeccable/` 或额外上下文注入，与本规则冲突时，以本规则为准。

## 推荐审查流程

1. **确定目标**
   - 原型：`src/prototypes/<prototype-id>/`
   - 原型内页面：保留 `pageId`
   - 目标不清时，先问用户确认

2. **确定 DESIGN.md**
   - 用户指定主题时，读取 `src/themes/<theme-id>/DESIGN.md`
   - 用户指定路径时，只读取该 `DESIGN.md`
   - 未指定且项目默认不存在时，按常规设计评审执行，并在报告中说明

3. **参考 Impeccable critique**
   - 读取目标源码和本地样式
   - 有预览环境时检查桌面和移动端
   - 可用浏览器时保留截图证据
   - 允许使用 `rules/references/impeccable/scripts/detect.mjs` 作为辅助证据，但不要让 detector 输出先污染设计判断

4. **综合结论**
   - 不直接拼接 Impeccable 原报告或归档原文
   - 按 Axhub Markdown 模板重组
   - P0-P3 问题最多 5 条
   - 必须包含核心元件或关键 UI 区块点评

5. **写入 `.spec`**
   - 原型级：`src/prototypes/<prototype-id>/.spec/reviews/ui-review.md`
   - 页面级如后续需要：`src/prototypes/<prototype-id>/.spec/reviews/<page-id>-ui-review.md`

## 报告元数据与评分

AI 生成报告时，推荐在 Markdown 开头写 frontmatter；人工上传报告可以不写。系统会读取这些字段作为列表元数据，不会用它们推导正文结论。

设计评审报告的 `title` 固定写成 `UI 评审`，不要把原型名、产品名、主题名或页面名写进 `title`。
正文必须使用 Markdown 标题语法：报告标题、分组标题和问题小节都要使用井号标题；问题小节的优先级按实际判断填写，不要照抄模板占位或固定优先级。

`score` 是百分制整数成熟度评分，可选。它必须用于拉开差距、帮助跨版本对比和判断改进幅度，不是礼貌性的中庸总评。
不要默认填写某个中庸分，不要沿用模板、示例或历史报告分数；无法给出明确总分时，删除 score 行。
AI 生成报告时，只要证据足够支撑判断，就应填写 score，并在正文写清楚评分依据。

成熟度评分：

- 90-100：标杆交付。整体设计稳定，符合 DESIGN.md，桌面/移动/键盘/动效等关键体验完整；没有 P0/P1，P2 极少且不影响交付。
- 80-89：可交付。核心体验和视觉系统成立，只有少量非关键问题；没有 P0/P1，P2 数量少且修复成本可控。
- 70-79：方向成立但需补齐。视觉方向、核心任务或主要区块可用，但存在 P1 或多个 P2，不能只做 polish 就交付。
- 60-69：初稿讨论稿。页面有可保留方向，但关键任务效率、响应式、可访问性或 DESIGN.md 一致性仍不稳定。
- 50-59：需要大改。核心视觉系统、信息层级或主要交互不成立，必须重构关键区块。
- 低于 50：阻断严重。核心任务难以完成，或与设计目标/用户任务严重冲突。

封顶规则：

- 有任何 `P0`，最高 59。
- 有 `2 个及以上 P1`，最高 69。
- 有 `1 个 P1`，最高 79。
- 有 `3 个及以上 P2`，最高 78。
- 未检查移动端或关键响应式断点，最高 75。
- 未检查键盘焦点、基本语义或明显对比度风险，最高 80。
- 未使用可用的 DESIGN.md 作为依据时，最高 75；确实没有 DESIGN.md 且已说明，则不触发该封顶。

扣分建议：

- P0：每项扣 30 分以上，并应用 P0 封顶。
- P1：每项扣 10-15 分，并应用 P1 封顶。
- P2：每项扣 4-8 分，并在 3 个及以上时应用 P2 封顶。
- P3：每项扣 1-3 分，不应单独把分数压到 80 以下。
- 证据不足：按缺失范围扣 3-10 分；如果缺失影响判断可信度，直接删除 score 行。

报告必须包含 `评分依据` 分组，至少说明：成熟度档位、触发的封顶规则、覆盖扣分、最终分数为什么成立。

## Markdown 模板

读取并套用资源模板：`client/src/resources/templates/ui-review-report-template.md`。

模板是报告结构的唯一来源；本规则只补充评审方法、评分口径和分组约束。输出时保留模板中的 frontmatter、固定一级标题、固定分组顺序和问题条目结构。

## 分组要求

前四组固定且顺序不可变：

1. `总体点评`
2. `评分依据`
3. `P0-P3 优先级问题`，最多 5 条
4. `核心元件`

可以追加额外分组，例如 `响应式与可访问性`、`证据与评估说明`，但必须放在前四组之后。

## 优先级

- `P0`：阻断核心任务完成，或违反 `DESIGN.md` 中强制规则
- `P1`：显著增加用户完成任务的难度，或造成 WCAG AA 级别可访问性问题
- `P2`：明显体验摩擦，但存在可用绕行
- `P3`：低影响 polish，修复后更好但不影响主要任务

不要使用 `P4` 或更低优先级。

## 子代理与独立评估

有子代理能力时，优先拆成两个独立评估：

- 设计评估：只看目标、`DESIGN.md`、截图/预览和源码
- 证据评估：看 scanner、响应式、可访问性和实现风险

两个评估完成前不要互相暴露结论。没有子代理时，先完成设计评估笔记，再看 scanner/证据，并在 `证据与评估说明` 中标记独立评估为 `degraded`。

当审查 3 个以上独立页面或组件时，优先按目标拆分并行审查，最后统一综合成 `.spec/reviews/ui-review.md`。

## 交付说明

最终回复至少包含：

- 审查目标
- 使用的 `DESIGN.md`
- 写入的 `.spec/reviews/ui-review.md` 路径
- P0-P3 数量
- 是否使用浏览器/截图/scanner
- 独立评估是否完整
