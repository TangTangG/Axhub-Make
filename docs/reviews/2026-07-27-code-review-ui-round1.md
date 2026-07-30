# axhub-proto-enhanced v1.0.0 代码 Review 报告 — UI 设计师第 1 轮

> 审查人：UI 设计师
> 日期：2026-07-27
> 审查范围：设计 Token 实现与 DESIGN_SPEC.md 一致性、组件状态集完整性、CSS 实现质量、交互反馈、a11y 实现

---

## 结论

**有条件通过，可进入第 2 轮**。Token 系统与硬编码检查质量极高（49 Token 全量一致、零硬编码 hex），但存在 2 个高优先级 a11y 缺陷（Switch 焦点环不可见、焦点环透明度不足）和若干规范不一致项，建议修复后进入第 2 轮。

## 审查结果摘要

| 维度 | 结果 |
|------|------|
| ① Token 一致性 | ✅ 49 个 Token、5 维度与 DESIGN_SPEC 完全一致 |
| ② 状态集完整性 | ⚠️ Card 缺 selected、Slider dragging 部分实现、types.ts 状态联合类型不全 |
| ③ CSS 质量 | ✅ 零硬编码 hex；⚠️ 9 处 rgba() 焦点环绕过 Token |
| ④ 交互反馈 | ⚠️ 过渡时长 150ms 与规范 200ms 不符；Button focus 环与表单组件不一致 |
| ⑤ a11y | ❌ Switch 焦点环绑定错位（不可见）；焦点环 15% 透明度可见性不足；Radio 缺 name |

## 问题清单

### 🔴 高优先级（P0）

1. **Switch 焦点环不可见**（`switch.css:39` + `Switch.tsx:63-73`）：`:focus` 样式绑定在 `.switch__track`，但 `tabIndex` 设在外层 `<div>`，焦点落在外层 div，track 永远拿不到 :focus → 键盘用户完全看不到焦点指示。违反 DESIGN_SPEC §5.2「焦点环清晰可见」。
2. **焦点环透明度不足**：Input/Checkbox/Radio/Select/DatePicker/Slider/Switch 全部使用 `box-shadow: 0 0 0 2px rgba(0,102,204,0.15)`——15% 透明度的 2px 环在白色背景上实际对比度远低于 3:1，不满足 DESIGN_SPEC「2px primary 边框、清晰可见」。Button 则用双层实色 ring（2px 白 + 4px primary），两套实现不一致。
3. **Radio 组缺 `name` 属性**（`Radio.tsx:71-84`）：同一组 radio input 无 name，浏览器原生方向键组内导航失效，且每个 option 都会进入 Tab 序列，违反键盘导航规范。

### 🟡 中优先级（P1）

4. **Button 属性与 COMPONENT_MATRIX 不符**：矩阵定义 `type: primary/secondary/text/link`、`size: small/medium/large`；实现为 `primary/default/dashed/link`、`large/middle/small`。导出走 matrix schema 时会失配。
5. **Card 缺 `selected` 状态**：矩阵要求 default/hover/selected，`card.css`/`Card.tsx` 均无 selected 实现。
6. **过渡时长与规范不符**：DESIGN_SPEC 规定 hover 过渡 200ms，实际大量为 150ms/100ms（仅 Switch/Card/Modal/Drawer 为 200/300ms）。
7. **9 处 rgba() 硬编码绕过 Token**：`rgba(0,102,204,0.15)`（= primary 的 15%）、`rgba(255,59,48,0.15)`、`rgba(255,255,255,0.3)`（switch loading）。grep 虽因排除规则未报，但实质上破坏了「Token 单一来源」，建议新增 `--color-primary-focus-ring` 等 Token。
8. **Modal/Drawer 缺 `role="dialog"` 与 `aria-modal`**，无焦点陷阱（focus trap），仅 Escape 关闭，不符合 a11y 对话框模式。
9. **Select 键盘导航不完整**：ArrowDown 仅开面板，无法用键盘遍历/选中 option（option 无 tabIndex、无 activedescendant）。
10. **`types.ts` 状态联合类型不全**：`ComponentStateName` 仅 7 项（default/hover/active/focus/disabled/loading/error），缺矩阵实际使用的 placeholder/visited/checked/open/selected/indeterminate/dragging。
11. **Button disabled 文本色不一致**：矩阵要求 `#999999`，实现用 `--color-text-disabled`（#cccccc），且 Token 体系无 #999999；disabled 实现用换色而非 §二 规定的 `opacity: 0.5`（规范内部自相矛盾，建议统一口径）。

### 🟢 低优先级（P2）

12. **表单组件用 `:focus` 而非 `:focus-visible`**（Button 用了 `:focus-visible`）——鼠标点击也会显示焦点环，行为不一致。
13. **`--color-mask: rgba(0,0,0,0.45)`** 存在于 tokens.css 但不在 design-tokens.json/DESIGN_SPEC 中——Token 来源不同步。
14. **Text 组件 hover 变色为 primary**——文本悬停变蓝易被误认作链接，交互语义存疑。
15. **Slider `dragging` 状态**仅以 thumb `:active` scale(1.15) 近似，无独立 dragging class。
16. **Input 无 label 关联机制与 `aria-describedby`**（errorMessage 未与 input 关联）；Checkbox 无 id/htmlFor；Modal/Drawer 关闭按钮 `aria-label="Close"` 为英文，与中文 UI 不一致。
17. **对比度风险项**：`border.default #e0e0e0` on `#ffffff` ≈ 1.3:1，输入框边界不满足 UI 组件 3:1；`text.secondary #7a7a7a` ≈ 4.6:1 压线通过。
18. **组件覆盖缺口**（提示，非本轮阻塞）：矩阵中的 Table/Upload/Navbar/Tabs/Chart/Map/RichText/Video 未实现，v1.0 仅交付 19 个组件。

## 亮点

- `design-tokens.json` 49 个 Token 与 DESIGN_SPEC 逐值一致，tokens.css 完整映射，且新增 mask 有注释。
- grep 硬编码检查：tokens.css 定义行之外 **零 hex 硬编码**。
- Link 完整实现 visited；Image loading/error 占位与 `role="img"` aria-label 到位；Slider 键盘（方向键/Home/End）+ `role="slider"` + aria-value* 完整；DatePicker 日历网格语义与中文 aria-label 良好。

## 是否可进入第 2 轮

**是（有条件）**：建议先修复 P0-1（Switch 焦点环）、P0-2（焦点环透明度/统一为实色 ring）、P0-3（Radio name），并将 P1-4（Button schema 对齐矩阵）一并处理后进入第 2 轮 Review。

---

*报告生成时间：2026-07-27*
*Review 人：UI 设计师 Agent*
