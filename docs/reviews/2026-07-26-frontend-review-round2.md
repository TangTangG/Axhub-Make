# 前端开发 Review - 第 2 轮（修订版验证）

> 日期：2026-07-26
> 评审角色：前端开发
> 评审对象：design.md / DESIGN_SPEC.md / COMPONENT_MATRIX.md

---

## 验证总结

| 第 1 轮问题 | 修复方案 | 状态 | 说明 |
|------------|---------|------|------|
| H1: 画布底座选型未决策 | 复用 Excalidraw，v1.0 不含手动画布 | ✅ 已解决 | design.md 明确复用上游 Excalidraw，v1.0 专注导出，v1.1 预留画布规范 |
| H2: 导出路径自相矛盾 | 组件树驱动，非 DOM 遍历 | ✅ 已解决 | design.md 明确"组件树单一数据源"，改造 htmlToAxure 为组件树驱动 |
| H3: export-core 无法增强 | patch-package 管理补丁 | ✅ 已解决 | design.md 明确 patch-package 方案，patches/ 目录结构清晰 |
| H4: Bridge 协议契约缺失 | 明确端点 + 版本协商 | ⚠️ 部分解决 | design.md 提及 Axure Bridge (localhost:32767)，但协议细节仍需补充 |
| H5: fork 与上游同步矛盾 | git subtree + patch-package | ✅ 已解决 | upstream/ 只读 + patches/ 管理修改，CI 自动同步流程完整 |
| H6: AI 再生成覆盖手动修改 | v1.0 不含手动画布 | ✅ 已解决 | v1.0 无手动编辑，规避此问题 |
| H7: 缺少撤销/重做 | v1.1 预留 | ✅ 已解决 | DESIGN_SPEC.md 明确 v1.1 预留规范 |
| H8: 画布交互规范缺失 | v1.1 预留规范 | ✅ 已解决 | DESIGN_SPEC.md 包含选中态、拖拽、快捷键等规范 |
| H9: AI 与手动编辑冲突 | v1.0 不含手动画布 | ✅ 已解决 | 规避此问题 |
| H10: 缺少设计 Token | 完整 Token 系统 | ✅ 已解决 | DESIGN_SPEC.md 包含颜色、字体、间距、圆角、阴影完整 Token |
| H11: 组件状态规范缺失 | 7 种状态规范 | ✅ 已解决 | DESIGN_SPEC.md 定义 default/hover/active/focus/disabled/loading/error |
| H12: 缺少数据持久化 | v1.0 本地存储，v2.0 云端 | ✅ 已解决 | proposal.md 明确（未在本次评审文档中，引用第 1 轮结论） |
| H13: Axure 可编辑性无量化标准 | L1-L4 分级 | ⚠️ 部分解决 | TEST_SPEC.md 提及（未在本次评审文档中），COMPONENT_MATRIX.md 有"可编辑性"列但无 L1-L4 定义 |
| H14: 高级组件降级策略缺失 | 尽力而为，失败降级占位 | ✅ 已解决 | COMPONENT_MATRIX.md 明确图表/地图/富文本/视频降级策略 |
| H15: CSS→Axure 映射难题 | 完整映射表 + 降级策略 | ✅ 已解决 | design.md 包含 CSS_TO_AXURE_MAP 完整映射表，不支持属性降级策略明确 |
| H16: Axure 交互导出不可行 | v1.0 不导出交互，仅静态 | ✅ 已解决 | design.md 明确 v1.0 仅静态导出，交互后续迭代 |
| H17: 三预览模式一致性未定义 | 一致性标准 | ⚠️ 部分解决 | TEST_SPEC.md 提及（未在本次评审文档中），design.md 未定义一致性标准 |
| H18: HTML 离线兼容性未定义 | 验收标准 | ⚠️ 部分解决 | TEST_SPEC.md 提及（未在本次评审文档中），design.md 未定义离线策略 |
| H19: standalone HTML 体积无预算 | ≤5MB 上限 | ✅ 已解决 | design.md 明确 5MB 上限，超限自动转外链 |
| H20: 图片导出/iframe 已存在 | 复用上游，不重复建设 | ✅ 已解决 | design.md 明确 iframe 预览复用上游，图片导出增强但不重复 |

---

## 仍存在的问题

### 1. Bridge 协议契约细节不足（原 H4）

**问题**：design.md 仅提及 "Axure Bridge (localhost:32767)"，但缺少：
- 消息格式定义（JSON Schema）
- 版本协商机制
- 错误码定义
- 超时处理策略

**建议**：补充 `docs/axure-bridge-protocol.md`，定义完整协议契约。

### 2. CSS→Axure 映射表覆盖度待验证

**问题**：design.md 提供了 CSS_TO_AXURE_MAP，但缺少以下属性的映射策略：
- `position: fixed/sticky` → Axure 中的固定定位
- `z-index` → Axure 中的层叠顺序
- `overflow: scroll/auto` → Axure 中的滚动区域
- `transform: rotate/scale` → Axure 中的旋转/缩放（Axure 支持有限）
- `flex` / `grid` 布局 → 已标记为降级为绝对定位，但缺少具体转换算法

**建议**：补充 CSS 属性覆盖清单，明确每个属性的映射状态（支持/部分支持/不支持/降级）。

### 3. 组件树到 Axure 的嵌套结构映射不明确

**问题**：design.md 提到 `convertNodeToAxureWidget` 递归处理 children，但：
- Axure 的 group/dynamic_panel 与组件树的嵌套关系如何对应？
- 深层嵌套（>3 层）是否有性能或兼容性问题？
- 组件树中的 "layout" 组件（grid/flex）降级为绝对定位后，子组件坐标如何计算？

**建议**：补充组件树 → Axure 嵌套结构映射规则文档。

### 4. 降级策略的用户感知度不足

**问题**：COMPONENT_MATRIX.md 定义了降级策略，但：
- 降级后的组件在 Axure 中如何标识？（如添加特殊颜色边框或标签）
- 用户如何知道哪些组件被降级了？
- 是否有导出后的降级报告？

**建议**：增加降级可视化标识和导出摘要报告。

### 5. patch-package 对 vendor 包的管理边界

**问题**：design.md 使用 patch-package 管理 `vendor/axhub-export-core` 的修改，但：
- patch-package 通常用于 node_modules，对 vendor/ 目录的支持需要验证
- 如果上游 export-core 更新，patch 冲突如何解决？
- 是否有 patch 版本控制策略？

**建议**：验证 patch-package 对 vendor/ 的支持，或考虑使用 git subtree + 自定义 patch 脚本。

---

## 新增问题

### N1: Excalidraw 元素到 ComponentTree 的转换缺失

**问题**：design.md 数据流中提到 "Excalidraw 元素 → ComponentTree"，但缺少转换规则：
- Excalidraw 的 free-draw/arrow/text 等元素如何映射到组件？
- 样式属性（stroke/fill/roughness）如何转换为 CSS？
- 转换失败时的降级策略？

**建议**：补充 `src/integration/excalidraw-to-component-tree.ts` 的转换规则文档。

### N2: 多模式预览的一致性技术方案

**问题**：三种预览模式（iframe/HTML/图片）的技术实现差异较大：
- iframe：实时渲染，支持交互
- HTML 导出：静态文件，交互有限
- 图片导出：纯静态，无交互

**建议**：明确三种模式的功能边界，定义"一致性"标准（视觉一致 vs 交互一致）。

### N3: 组件版本控制策略

**问题**：`ComponentDefinition.version` 字段存在，但缺少版本升级策略：
- 组件 schema 变更后，旧项目如何迁移？
- 是否有版本兼容性检查？

**建议**：补充组件版本迁移策略。

---

## 总体结论

| 类别 | 数量 |
|------|------|
| 第 1 轮问题总数 | 20 |
| 已解决 | 15 |
| 部分解决 | 5 |
| 仍存在的问题 | 5 |
| 新增问题 | 3 |

**结论**：✅ **有条件通过**

修订版技术方案解决了第 1 轮的大部分核心问题（画布底座、导出路径、fork 策略、CSS 映射、降级策略），架构方向正确。

**通过条件**：
1. 补充 Bridge 协议契约文档
2. 完善 CSS→Axure 映射表（补充 position/z-index/overflow 等）
3. 明确组件树到 Axure 嵌套结构映射规则
4. 验证 patch-package 对 vendor/ 的支持
5. 补充 Excalidraw → ComponentTree 转换规则

**建议 Phase 1 优先任务**：
1. 实现 Bridge 协议契约定义
2. 完善 CSS 映射表
3. 验证 patch-package 工作流
4. 实现 Excalidraw → ComponentTree 转换器

---

## 下一步行动

1. 补充缺失文档：
   - `docs/axure-bridge-protocol.md`
   - `docs/css-to-axure-mapping.md`（完整版）
   - `docs/excalidraw-to-component-tree.md`
2. 技术验证：
   - patch-package 对 vendor/ 的支持验证
   - 组件树 → Axure 嵌套结构映射验证
3. 进入 Phase 1 开发
