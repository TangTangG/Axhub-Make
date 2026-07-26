# UI 设计规范 Review — 第 3 轮（最终验证）

**Review 角色**：资深 UI/UX 设计师
**评审对象**：
- `DESIGN_SPEC.md` v1.0（设计 Token + 组件状态规范 + 画布交互预留 + 预览模式 + a11y）
- `COMPONENT_MATRIX.md` v1.0（25 个组件矩阵 + CSS→Axure 属性映射表）

**评审维度**：设计规范完整性 / Token 一致性 / 组件覆盖度 / 状态完备性 / 降级策略可操作性 / 与 design.md 一致性

---

## 一、结论

**✅ 有条件通过（Conditional Pass）— 可进入 Phase 2 开发**

设计规范两份核心文档已达到开发可执行的颗粒度，Token 系统完整、组件矩阵覆盖了 25 个组件、降级策略具备可操作性。第 1、2 轮 review 中 UI 设计师提出的关键问题（组件状态集不明确、降级策略未定义、CSS 映射表缺失）均已闭环。剩余问题为非阻塞性问题，可在 Phase 2 开发过程中并行完善。

---

## 二、验证结果

### 2.1 设计 Token 系统（DESIGN_SPEC §一）✅ 完整

| 维度 | 验证结果 | 备注 |
|------|---------|------|
| 颜色系统 | ✅ | 品牌色/文本/背景/边框/状态色 5 组 20+ Token，与 design.md 中的 `design-tokens.json` schema 一致 |
| 字体系统 | ✅ | 3 族 × 6 阶字号 × 4 字重，覆盖 SF Pro 体系 |
| 间距系统 | ✅ | 8 级（4px 基准），符合 4px 网格约定 |
| 圆角系统 | ✅ | 4 级（含 full 9999px），覆盖按钮/卡片/模态/头像 |
| 阴影系统 | ✅ | 4 级，与 iOS/macOS 视觉语言一致 |

**结论**：Token 完整、命名规范统一、可被 `design-tokens.json` 直接消费。

### 2.2 组件状态规范（DESIGN_SPEC §二）✅ 完整

7 状态集（default/hover/active/focus/disabled/loading/error）覆盖了 v1.0 全部使用场景，且：
- 与 `COMPONENT_MATRIX.md` 中每个组件的状态集一一对应（如按钮 6 状态、输入框 6 状态、表格 5 状态）。
- `COMPONENT_MATRIX.md` §组件状态详细规范 给出了 Button/Input/Table 三个代表性组件的状态级视觉映射表，可直接驱动 CSS 实现。

### 2.3 组件覆盖度（COMPONENT_MATRIX）✅ 达标

- 基础组件 6 个、表单组件 8 个、布局组件 7 个、高级组件 4 个，**共 25 个**，与 proposal.md "≥20 种" 的成功标准一致。
- 每个组件均标注了：Axure Widget 映射、状态集、属性集、预览支持、降级策略、可编辑性等级（✅ / ⚠️）。
- 可编辑性三档分类清晰：完全可编辑（19）/ 简单可编辑+复杂降级（1）/ 降级后可编辑占位（3）/ inline_frame 不可编辑（3）—— 直接支撑 proposal 成功标准 1（基础 100% / 表单 90% / 布局 80% / 高级尽力而为）。

### 2.4 CSS → Axure 属性映射表（COMPONENT_MATRIX §首章）✅ 完整

覆盖 6 大属性组：
- 布局属性（width/height/position/z-index/display 共 16 项）
- 盒模型（margin/padding/border/shadow 共 12 项）
- 溢出与滚动（7 项）
- 变换与动画（7 项）
- 字体与文本（11 项）
- 背景与颜色（6 项）
- **Flexbox 详细映射（15 项）** ← 第 1 轮 review 缺失，本轮已补
- **Grid 详细映射（8 项）** ← 第 1 轮 review 缺失，本轮已补

每项均给出"直接映射 / 降级策略 / 备注"三列，可被 `axure-mapper.ts` 直接消费。

### 2.5 画布交互规范（DESIGN_SPEC §三）✅ 正确归位

v1.0 明确不含手动画布，§三标注为"v1.1 预留"，与 proposal.md "v1.0 不包含手动画布" 一致。选中态、拖拽、快捷键清单完整，作为 v1.1 spike 的输入资料充分。

### 2.6 预览模式规范（DESIGN_SPEC §四）✅ 完整

三模式切换、防抖 500ms、导出选项（格式/DPI/背景/范围/内联资源 ≤5MB）与 design.md 中 `HtmlExportOptions`/`ImageExportOptions` 接口字段完全一致。

### 2.7 a11y 规范（DESIGN_SPEC §五）✅ 完整

WCAG AA 对比度（4.5:1 / 3:1）、键盘导航、语义化标签三维度覆盖。Token 色板中 `#1d1d1f` on `#ffffff` ≈ 16.7:1、`#0066cc` on `#ffffff` ≈ 5.6:1，均满足 AA。但 `color.text.secondary #7a7a7a` on `#ffffff` ≈ 4.5:1 刚好踩线，小字号下建议使用 ≥14px。

### 2.8 降级策略（COMPONENT_MATRIX §导出降级策略汇总）✅ 完整

5 类降级（占位矩形/图片替换/纯文本/绝对定位/属性忽略）+ 触发条件 + 用户提示，与 design.md `FallbackStrategy` 接口对齐。

---

## 三、仍存问题（非阻塞）

### 🟡 中（建议 Phase 2 中并行完善）

- **P1. 设计 Token 与 design.md 字段命名不一致**
  DESIGN_SPEC 使用 `color.primary` / `color.text.primary`，design.md `design-tokens.json` 使用 `color.primary.value` / `color.text.primary`（前者把 hover/active 嵌套为子字段）。两者需在 Phase 2.1 任务中对齐为同一份 JSON Schema，避免实现时二义性。

- **P2. 表格组件"复杂表格"判定标准未量化**
  COMPONENT_MATRIX 表格行写"复杂表格→占位矩形+文本'[表格]'"，但未定义"复杂"的边界（合并单元格？>5 列？嵌套表头？固定列？行展开？）。建议在 Phase 3.7 开始前补一条量化规则（例如：含合并单元格/嵌套表头/行展开任一 → 复杂）。

- **P3. 高级组件（图表/地图/视频）的 inline_frame 目标 URL 来源未说明**
  降级路径明确，但 inline_frame 加载什么 URL？需要后端代理？直接嵌 ECharts CDN？这影响 Axure 端能否实际渲染。建议在 Phase 3.9 spike 时给出方案。

- **P4. DESIGN_SPEC 缺少 icon 系统规范**
  Button 属性 schema 含 `icon: PropSchema[]`（icon 类型），但 DESIGN_SPEC 全文未定义图标库（Lucide？AntD Icons？）、尺寸阶梯（与 font.size 对齐？）、color 继承规则。建议补 §1.6 图标系统。

- **P5. 字体 license 风险**
  `SF Pro Display` / `SF Pro Text` 是 Apple 私有字体，Windows/Linux 用户无法获得。文档未声明 fallback 链或随包字体的 license 合规路径。建议显式声明 fallback 为系统字体栈。

### 🟢 低（可延后到 v1.1）

- **P6.** DESIGN_SPEC 缺少暗色模式 Token（v1.0 可接受，v1.1 必须补）。
- **P7.** 缺少组件缩略图规范（与 tasks.md 2.10 一致，已显式移至 v1.1）。
- **P8.** 缺少响应式断点 Token（栅格容器组件属性中提到"响应式断点"，但 Token 表未定义）。
- **P9.** 表格行高 48px、斑马纹等具体值未抽 Token，直接写在状态规范里，后续主题化时会困难。

---

## 四、是否可进入 Phase 2 开发

**✅ 可以进入。**

**理由**：
1. Token 系统、组件矩阵、CSS 映射表三份核心交付物已达到代码实现颗粒度。
2. v1.0 范围（导出能力增强，不含手动画布）与设计规范边界完全对齐。
3. 前 2 轮 review 的 UI 视角阻塞性问题（组件状态、降级策略、Flex/Grid 映射）已全部闭环。
4. 剩余 P1-P5 问题均为 Phase 2/3 任务内部的细化工作，不阻塞启动。

**进入 Phase 2 的前置条件**（建议在 Phase 2.1 启动当天完成）：
- 解决 P1：统一 DESIGN_SPEC 与 design.md 的 Token Schema，输出单一 `design-tokens.json`。
- 解决 P2：补一条"复杂表格"量化判定规则到 COMPONENT_MATRIX.md。

**Phase 2/3 期间的并行任务**：
- P3（高级组件 inline_frame URL 方案）→ 合入 Phase 3.9 spike。
- P4（图标系统）→ 合入 Phase 2.4 基础组件实现。
- P5（字体 license 与 fallback）→ 合入 Phase 2.1 Token 定义。

---

**评审人**：资深 UI/UX 设计师
**日期**：2026-07-26
**签字**：✅ 有条件通过
