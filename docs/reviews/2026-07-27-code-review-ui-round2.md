# axhub-proto-enhanced v1.0.0 代码 Review 报告 — UI 设计师第 2 轮

> 审查人：UI 设计师
> 日期：2026-07-27
> 审查范围：第 1 轮高优/中优问题修复验证、新引入问题排查

---

## 结论

**通过，可进入第 3 轮**。第 1 轮提出的 3 个高优问题（Switch 焦点环不可见、焦点环透明度不足、Radio 缺 name）和 3 个中优问题（Button 属性对齐矩阵、过渡 200ms、Modal/Drawer role=dialog）已全部修复，修复质量符合预期。发现 1 个新引入的低优问题，不阻塞第 3 轮。

## 修复验证表

| 问题编号 | 问题描述 | 验证结果 | 验证依据 |
|---------|---------|---------|---------|
| P0-1 | Switch 焦点环不可见 | ✅ 已修复 | `switch.css:39` 使用 `.switch:focus-visible` 绑定在外层容器，`Switch.tsx:68` `tabIndex` 也在外层 `<div>`，焦点环现在正确落在可聚焦元素上 |
| P0-2 | 焦点环透明度不足 | ✅ 已修复 | `tokens.css:38` 新增 `--color-focus-ring: #0066cc`；Input/Checkbox/Radio/Select/DatePicker/Slider/Switch 的焦点环已统一替换为 `box-shadow: 0 0 0 2px var(--color-focus-ring)`，不再使用 15% 透明度 |
| P0-3 | Radio 缺 name 属性 | ✅ 已修复 | `Radio.tsx:15` 新增 `name?: string` prop；`Radio.tsx:36-40` 通过 `useRef` + 模块级计数器自动生成唯一 group name；`Radio.tsx:82` 将 `name={groupName}` 绑定到原生 `<input type="radio">` |
| P1-4 | Button 属性对齐矩阵 | ✅ 已修复 | `Button.tsx:5-6` `type` 改为 `'primary' \| 'secondary' \| 'text' \| 'link'`、`size` 改为 `'small' \| 'medium' \| 'large'`；`button.css` 同步将 `default`→`secondary`、`dashed`→`text`、`middle`→`medium`；`Button.stories.tsx` 也已更新 |
| P1-6 | 过渡时长 200ms | ⚠️ 部分修复 | 主要组件（Button/Switch/Modal/Drawer/Card）已改为 200ms；但仍有 11 处次要过渡保留 `0.15s`/`0.1s`/`0.2s`，见「新问题清单」 |
| P1-8 | Modal/Drawer 缺 role=dialog | ✅ 已修复 | `Modal.tsx:59` 和 `Drawer.tsx:70` 均已添加 `role="dialog" aria-modal="true" aria-label={title ?? 'Modal/Drawer'}`；关闭按钮 `aria-label` 也从英文 "Close" 改为中文 "关闭" |

## 新问题清单

### 🟢 低优先级（P2）

1. **次要过渡时长未统一为 200ms**（`input.css:15`、`checkbox.css:32`、`radio.css:44`、`select.css:27`、`date-picker.css:26`、`slider.css:60`、`card.css:8`、`modal.css:88`、`drawer.css:115`、`rectangle.css:5`、`date-picker.css:130`）：`box-shadow`、`border-color`、`color` 等次要属性仍保留 `0.15s`/`0.1s`/`0.2s`，与 DESIGN_SPEC 200ms 规范存在轻微偏差。建议统一为 `200ms` 或提供 Token 分级（如 `--transition-fast: 150ms`、`--transition-normal: 200ms`）。

2. **错误状态焦点环仍使用硬编码 rgba**（`input.css:53`、`select.css:63`、`date-picker.css:62`）：`.input--error:focus` 等错误焦点环仍使用 `rgba(255, 59, 48, 0.15)`，未使用 `--color-focus-ring` 或新增 `--color-focus-ring-error`。与第 1 轮 P1-7「9 处 rgba() 硬编码绕过 Token」中提到的错误色问题一致，属于遗留未完全修复项。

3. **Slider 拖拽状态仍无独立 class**（`Slider.tsx:73-76` + `slider.css:73-76`）：`dragging` 状态仍仅以 `:active` 伪类近似，无独立的 `.slider--dragging` 或 `.slider__thumb--dragging` class，与第 1 轮 P2-15 一致，属于遗留问题。

4. **Card 仍缺 `selected` 状态**（`Card.tsx` + `card.css`）：矩阵要求 `default/hover/selected`，当前仍只有 `bordered`/`hoverable`，无 `selected` 状态实现，与第 1 轮 P1-5 一致，属于遗留问题。

5. **`types.ts` 状态联合类型仍不全**（`types.ts:24-31`）：`ComponentStateName` 仍仅 7 项，缺 `placeholder/visited/checked/open/selected/indeterminate/dragging`，与第 1 轮 P1-10 一致，属于遗留问题。

## 遗留问题汇总（第 1 轮未修复项）

| 问题编号 | 问题描述 | 优先级 | 状态 |
|---------|---------|-------|------|
| P1-5 | Card 缺 selected 状态 | P1 | ❌ 未修复 |
| P1-7 | 9 处 rgba() 硬编码绕过 Token | P1 | ⚠️ 部分修复（primary 焦点环已替换，error 焦点环仍硬编码） |
| P1-9 | Select 键盘导航不完整 | P1 | ❌ 未修复 |
| P1-10 | types.ts 状态联合类型不全 | P1 | ❌ 未修复 |
| P1-11 | Button disabled 文本色不一致 | P1 | ❌ 未修复 |
| P2-12 | 表单组件用 `:focus` 而非 `:focus-visible` | P2 | ❌ 未修复 |
| P2-13 | `--color-mask` 不在 design-tokens.json 中 | P2 | ❌ 未修复 |
| P2-14 | Text hover 变色为 primary | P2 | ❌ 未修复 |
| P2-15 | Slider dragging 状态无独立 class | P2 | ❌ 未修复 |
| P2-16 | Input/Checkbox/Modal/Drawer a11y 细节 | P2 | ⚠️ 部分修复（Close→关闭已改，label 关联未改） |
| P2-17 | 对比度风险项 | P2 | ❌ 未修复 |
| P2-18 | 组件覆盖缺口 | P2 | ❌ 未修复 |

## 是否可进入第 3 轮

**是**。第 1 轮高优问题已全部修复，中优核心问题（Button 属性对齐、Modal/Drawer role=dialog）也已修复。剩余未修复项以 P1/P2 为主，不阻塞 v1.0.0 核心交付。建议在第 3 轮或后续迭代中处理：
- 统一次要过渡时长为 200ms（或引入 Token 分级）
- 将 error 焦点环替换为 Token（如 `--color-focus-ring-error`）
- 补齐 Card selected 状态、Select 键盘导航、types.ts 状态联合类型

---

*报告生成时间：2026-07-27*
*Review 人：UI 设计师 Agent*
