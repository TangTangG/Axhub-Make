# UI Review 指导

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
3. 如果没有用户指定或项目默认的 `DESIGN.md`，必须停止，要求用户提供

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
3. If no DESIGN.md is available, stop and ask for one.
4. Do not call /impeccable commands or run Impeccable context injection scripts.
5. Produce a Markdown report, not JSON.
6. Write the result to the target prototype .spec directory.
7. Include sections in order: 总体点评, P0-P3 优先级问题, 核心元件.
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
   - 未指定且项目默认不存在时，停止

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
   - 原型级：`src/prototypes/<prototype-id>/.spec/ui-review.md`
   - 页面级如后续需要：`src/prototypes/<prototype-id>/.spec/<page-id>/ui-review.md`

## Markdown 模板

```markdown
# UI Review

- 审查目标：src/prototypes/<prototype-id>
- 使用设计依据：src/themes/<theme-id>/DESIGN.md
- 生成时间：2026-05-22 00:00

## 总体点评

用 1-3 段总结整体设计质量、与 DESIGN.md 的一致性、主要风险和最值得保留的亮点。

## P0-P3 优先级问题

### P1 - Finding title

- 证据：说明出现位置、截图/预览观察或源码线索。
- 影响：说明对用户任务、理解、可访问性或品牌一致性的影响。
- 修复方向：给出可执行的设计或实现建议。

## 核心元件

### Hero / Header / Form / Navigation

按关键 UI 区块点评是否符合 DESIGN.md，指出保留点和调整点。

## 响应式与可访问性

记录桌面/移动端差异、键盘/语义/对比度等发现。没有明显问题时也要说明已检查。

## 证据与评估说明

- 浏览器/截图：说明是否使用。
- Scanner：说明是否使用。
- 独立评估：full 或 degraded，并说明原因。
```

## 分组要求

前三组固定且顺序不可变：

1. `总体点评`
2. `P0-P3 优先级问题`，最多 5 条
3. `核心元件`

可以追加额外分组，例如 `响应式与可访问性`、`证据与评估说明`，但必须放在前三组之后。

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

当审查 3 个以上独立页面或组件时，优先按目标拆分并行审查，最后统一综合成 `.spec/ui-review.md`。

## 交付说明

最终回复至少包含：

- 审查目标
- 使用的 `DESIGN.md`
- 写入的 `.spec/ui-review.md` 路径
- P0-P3 数量
- 是否使用浏览器/截图/scanner
- 独立评估是否完整
