# UI设计师 Review — Phase 2 实施计划

> Review 对象：`openspec/changes/enhance-prototype-tool/PLAN.md`（v2.0）
> 评审人：UI/UX 设计师视角
> 日期：2026-07-26
> 对照文档：`DESIGN_SPEC.md` v1.0 / `COMPONENT_MATRIX.md` v1.0 / `design.md`

---

## 结论

**有条件通过（Conditional Pass）**

PLAN.md 整体结构清晰、里程碑可执行、风险对策可落地，第 3 轮 Review 的 3 项阻塞问题（伪类映射、容量上限、AI 异常输入）均已在文档中闭环登记。但 **设计 Token 与 DESIGN_SPEC.md 存在系统性不一致**，**6 个基础组件的状态集与组件矩阵不匹配**，这两类问题属于开发前必须修正的"实现依据错误"。修正后即可进入 Phase 3 开发。

---

## 问题清单

### 高优

#### H1. PLAN.md 设计 Token 与 DESIGN_SPEC.md 全面不一致（违反单一事实源）

PLAN.md 任务 2.1 的 `design-tokens.json` 与已评审的 DESIGN_SPEC.md v1.0 在**色值、命名、维度上均不一致**，这不是细节偏差，而是采用了另一套（疑似 Ant Design）体系：

| 维度 | DESIGN_SPEC.md（已评审） | PLAN.md 任务 2.1 | 偏差 |
|------|--------------------------|------------------|------|
| 主色 | `#0066cc` | `#1890ff` | ❌ 色值完全不同（Ant Design 蓝） |
| 主色 hover | `#0071e3` | `#40a9ff` | ❌ |
| 主色 active | `#005bb5` | `#096dd9` | ❌ |
| 状态色 | `state.success/warning/error/info` | `success/warning/error`（无 info） | ❌ 缺 info，且色值不同（`#34c759` vs `#52c41a`） |
| 文本色 | `text.primary #1d1d1f` / `text.secondary #7a7a7a` | `rgba(0,0,0,0.85)` / `rgba(0,0,0,0.45)` | ❌ 色值+格式均不同 |
| 背景色 | 有 `bg.primary/secondary/hover/selected` 4 项 | **完全缺失** | ❌ 整个 bg 维度丢失 |
| 字体族 | `display/body/mono` 三族 | 单一 family | ❌ 缺 display/mono |
| 字号阶梯 | `xs/sm/md/lg/xl/xxl` 6 级 | `xs/sm/base/lg/xl` 5 级（无 xxl，且 `base` 命名不符 SPEC 的 `md`） | ❌ 命名+层级都不一致 |
| 字重 | `regular/medium/semibold/bold` 4 级 | `normal/medium/bold` 3 级（缺 semibold） | ❌ |
| 间距 | `xxs/xs/sm/md/lg/xl/xxl/section` 8 级（4px 网格） | `spacing.0~spacing.8` 数字命名 8 级 | ❌ 命名体系完全不同 |
| 圆角 | `sm 4 / md 8 / lg 12 / full` | `sm 2 / base 4 / lg 8 / full` | ❌ 数值与命名都不一致 |
| 阴影 | `sm/md/lg/xl` 4 级 | `sm/base/lg` 3 级（缺 xl） | ❌ |
| 禁用主色 | `color.primary.disabled #cccccc` | 缺失 | ❌ |

**风险**：验收标准里写着"与 DESIGN_SPEC.md 一致"，但 Token 文件本身就是 SPEC 的"竞争对手"。Phase 2 完成后，按钮、输入框的状态色板（COMPONENT_MATRIX 中 `按钮 default=primary` 等）会指向错误色值，后续 Phase 3 的 Axure 导出颜色全部错位。
**对策**：任务 2.1 的 JSON 必须**逐字**对齐 DESIGN_SPEC.md §1，把 PLAN 中那份当成草稿删除。同时在验收标准中加一条"Token JSON 与 DESIGN_SPEC.md diff 为空"。

#### H2. 基础组件状态集与 COMPONENT_MATRIX 不一致

PLAN.md 任务 2.3 验收标准只笼统写"6 状态可切换 / 4 状态可切换"，与 COMPONENT_MATRIX §基础组件的实际定义不符：

| 组件 | COMPONENT_MATRIX 定义的状态集 | PLAN.md 写的 | 问题 |
|------|------------------------------|--------------|------|
| 矩形 | default / hover / active / **disabled** | "可渲染 + 属性可配置" | ❌ 未要求实现任何状态 |
| 文本 | default / hover / disabled | "字体/颜色可配置" | ❌ 未要求实现状态 |
| 按钮 | default/hover/active/focus/disabled/**loading** | "6 状态可切换" | ⚠️ 数量对了但未列出状态名 |
| 输入框 | default/hover/focus/disabled/**error**/**placeholder**（6 个） | "占位符/值/类型可配置" | ❌ 未要求实现 error 态（高优功能） |
| 图片 | default/**loading**/**error** | "填充模式可配置" | ❌ 未要求 loading/error |
| 链接 | default/hover/active/**visited** | "4 状态可切换" | ⚠️ 数量对了但 visited 容易被遗漏 |

**风险**：开发按 PLAN 验收时只验证"属性可配置"，状态机漏实现，到 Phase 3 做伪类→Axure 映射时才发现没有状态样式可映射。
**对策**：把任务 2.3 表格的"验收标准"列改为直接引用 COMPONENT_MATRIX 的状态集（按组件列出状态名清单），并要求每个状态有 Storybook/测试用例。

#### H3. 组件接口缺少 DESIGN_SPEC 要求的字段

PLAN.md 任务 2.2 的 `ComponentDefinition` 与 `design.md` §2 中已对齐的接口相比，缺失以下字段：

- `icon: string`（属性面板/组件库显示需要）
- `defaultProps: Record<string, any>`（与 propSchema 分离）
- `version: string`（组件 schema 演进必需）
- `axureMapping.fallback` 在 PLAN 中是顶层 `fallbackStrategy`，但 design.md 已统一收敛到 `axureMapping.fallback` 子对象（`{ type, placeholderText, preserveSize }`）
- `previewSupport` 的取值 `'iframe' | 'html' | 'image'` 与 COMPONENT_MATRIX 一致 ✅，但 PLAN 把 `editability` 写成 `'L1'|'L2'|'L3'|'L4'`，DESIGN_SPEC 与 MATRIX 用的是 "完全可编辑 / 降级后可编辑 / inline_frame 不可编辑" 三档描述，**L1–L4 的分级定义从未在任何已评审文档中出现过**。

**对策**：以 design.md §2 的 `ComponentDefinition` 为唯一接口蓝本；`editability` 分级需要在 DESIGN_SPEC 中补一节定义 L1/L2/L3/L4 的判定标准，否则任务 6.2 的 "L1 可编辑 / L3 占位可编辑" 验收无判定依据。

---

### 中优

#### M1. 「三种模式一致性 ≤1px」不可达问题被降级但未真正解决

PLAN.md M6 验收标准仍写"三种模式一致性 ≤1px"，但遗留问题登记表 #9 已自承"跨浏览器布局 ≤1px 不可达"并标注"登记到 Phase 6"。两处口径冲突：
- M6 表里仍把它当硬指标
- 遗留表已承认达不到

**对策**：M6 验收标准改为分级指标——同浏览器内 ≤1px，跨浏览器（Chrome/Edge/Safari）允许 ≤3px 或限定为"布局结构一致，像素偏差不作为阻塞"。

#### M2. 按钮 `transform: scale(0.98)` 在 Axure 中无映射

COMPONENT_MATRIX §按钮 active 态要求 `transform: scale(0.98)`，但同文档"变换与动画"表中明确 `transform: scale()` **不支持**（降级为宽高缩放）。PLAN.md 任务 3.1 的 `CSS_TO_AXURE_MAP` 也未声明 scale 处理规则。

**对策**：在任务 3.1 中显式补一行：`'transform: scale': { target: null, fallback: 'ignore-interaction' }`，并在 COMPONENT_MATRIX 的按钮 active 行注明"Axure 导出时降级为无 scale"。

#### M3. 字体栈与 Axure 字体可用性未验证

DESIGN_SPEC 用 `SF Pro Display / SF Pro Text`，PLAN 用系统通用栈。两者在 Windows 版 Axure 上都会回退，但未声明回退规则。COMPONENT_MATRIX 已有 "自定义字体降级为系统字体"，但未指明具体降级目标（如 Segoe UI / 苹方）。

**对策**：任务 2.1 增加一条字体降级映射表（mac 字体 → Axure 通用字体），并在任务 3.1 的 `font-family` transform 中实现。

#### M4. a11y 规范未进入 Phase 2 验收

DESIGN_SPEC §5 定义了对比度（AA 4.5:1）、键盘导航、语义化三组硬性要求，但 PLAN.md Phase 2 的验收标准完全未提及。风险：Phase 2 实现的 6 个基础组件若不带焦点环/aria 属性，后续返工成本高。

**对策**：任务 2.3 验收标准加一条"按钮/输入框/链接满足 WCAG AA 对比度 + 键盘可达"，可借助 axe-core 自动化校验。

#### M5. 阴影/圆角的"Token 引用"未在组件层落地

PLAN 任务 2.3 的验收只说"可渲染 + 属性可配置"，没有要求"组件样式必须引用 Token 而非硬编码色值"。这是设计 Token 系统的核心价值，不强制约束等于没建。

**对策**：加验收标准——"组件源码扫描无 hex 色值硬编码（白名单：transparent / currentColor）"，可写一个简单的 lint 规则。

---

### 低优

#### L1. 间距命名建议沿用 SPEC 语义化命名

PLAN 的 `spacing.0`–`spacing.8` 数字命名对设计师不友好，DESIGN_SPEC 已用 `xxs/xs/sm/md/lg/xl/xxl/section`。建议统一回语义命名。

#### L2. 缺少「暗色模式」Token 维度

DESIGN_SPEC 与 PLAN 都未涉及 dark mode。如果 v1.1+ 有规划，建议在 Token JSON 结构上预留 `color.*.dark` 命名空间，避免后期 breaking change。本期可不实现，但需文档明示"v1.0 不含暗色模式"。

#### L3. 图片导出 1x/2x/3x 命名与 DPI 概念混用

任务 4.2 写 "1x/2x/3x 分辨率"，DESIGN_SPEC 写 "DPI 1x/2x/3x"。1x/2x/3x 是 scale factor，不是 DPI。建议统一为 `scale: 1 | 2 | 3`。

#### L4. 遗留问题登记表中 #6-#10 没有具体 owner 和验收方式

登记了"登记到 Phase 6"，但 Phase 6 任务清单（6.1/6.2）里并未显式列出这 5 项的验收动作。建议在 Phase 6 增加任务 6.3「遗留问题回归」，逐项写明如何验证。

---

## 建议

1. **建立 Token 单一事实源**：删掉 PLAN.md §三.任务 2.1 中的 JSON，改为"引用 DESIGN_SPEC.md §1，按 SPEC 生成 tokens.json"。可以在 Phase 2 增加一个 `scripts/generate-tokens.ts`，从 DESIGN_SPEC 的 markdown 表格自动生成 JSON，避免双源漂移。
2. **状态实现优先级**：6 个基础组件中，按钮的 focus/loading、输入框的 error/placeholder 是表单高优场景，建议在任务 2.3 内排序为 P0；矩形/文本的状态可以延后到 Phase 3 再补。
3. **接口契约先行**：把任务 2.2 的 TypeScript 接口单独提取为 PR 评审，三方（设计/前端/导出）签字后再开始 2.3，避免并行返工。
4. **Storybook 作为可视化验收载体**：建议 Phase 2 交付物中增加 Storybook 站点，每个组件的每个状态一个 story，这是设计走查最低成本的方式。
5. **设计走查节点**：M2 里程碑验收时设计师应参与，逐组件比对 COMPONENT_MATRIX 中的状态表。

---

## 是否可进入 Phase 3 开发

**暂不可**。需先完成以下阻塞项：

- [ ] **H1 修复**：任务 2.1 Token JSON 与 DESIGN_SPEC.md 对齐
- [ ] **H2 修复**：任务 2.3 验收标准列出每组件的完整状态集
- [ ] **H3 修复**：`ComponentDefinition` 接口对齐 design.md，并补 L1–L4 分级定义

中优问题（M1–M5）建议与 Phase 2 开发并行修复，不阻塞启动。低优问题登记到 v1.1 即可。

预计 H1–H3 修复工作量约 **0.5 人日**（主要是文档对齐，不涉及代码返工），修复后即可正式进入 Phase 2 开发。
