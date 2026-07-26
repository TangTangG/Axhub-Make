# 前端开发 Review - 第 3 轮（最终验证）

> 日期：2026-07-26
> 评审角色：前端开发
> 评审对象：design.md / COMPONENT_MATRIX.md
> 验证范围：第 2 轮打回的 3 项阻塞问题

---

## 1. 结论

✅ **通过（可进入 Phase 2 开发）**

3 项阻塞问题全部解决，第 2 轮遗留的 CSS 映射表缺口也已补齐。文档已达到可开发状态，剩余项均为非阻塞的 Phase 2 实施期任务。

---

## 2. 三项阻塞问题验证结果

### B1: Excalidraw → ComponentTree 语义识别 ✅ 已解决

**验证位置**：design.md「Excalidraw → ComponentTree 语义识别」章节（L430-478）+ 修正后的数据流图（L399-428）

**验证点**：
- ✅ 核心原则明确：**AI 生成时即携带组件类型元数据，Excalidraw 仅作渲染层**
- ✅ `AIGenerationOutput` / `Page` / `ComponentNode` Schema 完整定义，`type` 字段在 AI 生成时确定
- ✅ `ComponentNode.excalidraw.elementIds` 仅作预览关联，导出链路不依赖 Excalidraw 元素解析
- ✅ 识别流程 4 步清晰：AI 输出 ComponentNode → 渲染层转 Excalidraw（仅可视化）→ 导出直读 ComponentNode → v1.1 手动调整时双向同步
- ✅ 原 N1 问题（free-draw/arrow 反向解析规则缺失）被架构性规避 — 不再需要反向解析

**结论**：从根上消除了"语义识别不可靠"的风险，比第 2 轮建议的"补充转换规则文档"更彻底。

### B2: 组件树持久化 / AI 再生成 merge 策略 ✅ 已解决

**验证位置**：design.md「组件树持久化与并发设计」章节（L480-533）

**验证点**：
- ✅ `ProjectFile` Schema 完整（version/id/pages/globalStyles/metadata）
- ✅ 存储路径分级：v1.0 LocalStorage（单项目）→ v1.1 IndexedDB（多项目+版本历史）→ v2.0 云端
- ✅ **v1.0 显式声明「全量替换 + 确认弹窗」**，附完整交互流程图与埋点（ai_regenerate）
- ✅ v1.1 预留基于 node.id 的 3-way merge，含冲突提示策略
- ✅ 与"v1.0 不含手动画布"决策自洽 — 全量替换在 v1.0 场景下无并发冲突

**结论**：策略显式化，不再依赖隐式假设，确认弹窗保护了用户数据安全。

### B3: 大 payload 传输约束 ✅ 已解决

**验证位置**：design.md「Axure Bridge 传输协议」章节（L535-598）

**验证点**：
- ✅ 版本协商：`GET /available` 返回 `maxPayloadSize`（默认 10MB）、`capabilities.{compression, chunkedTransfer, asyncExport}`
- ✅ 请求契约：`CopyAxvgRequest` 含 `compressed` 标志、`totalSize`、可追踪的 `exportId`
- ✅ 超限处理三级降级链清晰：gzip 压缩 → 分片传输（5MB/片）→ 提示用户分批导出
- ✅ 传输限制表：body 10MB / 超时 60s / gzip / 分片 5MB
- ✅ 错误码完整：400 / 413 / 500 / 503 均含用户提示文案

**结论**：协议契约完整，覆盖了第 2 轮 H4 的所有缺失项（消息格式、版本协商、错误码、超时）。

---

## 3. 附带验证：第 2 轮 CSS 映射缺口

**验证位置**：COMPONENT_MATRIX.md「CSS → Axure 属性映射表」（L9-137）

第 2 轮指出的 5 项缺口全部补齐：

| 第 2 轮缺口 | 当前覆盖 | 状态 |
|------------|---------|------|
| `position: fixed/sticky` | fixed→固定定位、sticky→降级 relative+注释 | ✅ |
| `z-index` | 直接映射 zOrder，负数降级为 0 | ✅ |
| `overflow: scroll/auto` | 直接映射，overflow-x/y 分别映射 | ✅ |
| `transform: rotate/scale` | rotate→rotation、scale→宽高缩放、skew 忽略 | ✅ |
| `flex`/`grid` 转换算法 | Flexbox 详细映射表 16 行 + Grid 详细映射表 8 行，含 justify-content/align-items/gap/flex-grow 等 | ✅ |

---

## 4. 仍存问题（非阻塞）

以下为 Phase 2 实施期任务，不阻塞开发启动：

### P1: 组件树 → Axure 嵌套结构映射规则（承接第 2 轮问题 3）
- group/dynamic_panel 与 `ComponentNode.children` 的对应规则需在 `convertNodeToAxureWidget` 实现时固化
- 深层嵌套（>3 层）兼容性需实测
- **建议**：Phase 2 第一周输出 `docs/component-tree-nesting.md` + 嵌套 fixture 测试

### P2: 降级可视标识与导出报告（承接第 2 轮问题 4）
- COMPONENT_MATRIX.md 已有降级策略汇总表（L226-233）和"导出日志中记录"承诺
- 但 Axure 端的视觉标识（如降级组件加橙色虚线框）和导出摘要 UI 仍待设计
- **建议**：随导出管道实现一并交付

### P3: patch-package 对 vendor/ 的支持验证（承接第 2 轮问题 5）
- 仍是未验证项，属于 Day 1 环境搭建任务
- **建议**：Phase 2 第一个 spike，失败则切换为 git subtree + 自定义 patch 脚本

### P4: 组件版本迁移策略（承接第 2 轮 N3）
- `ComponentDefinition.version` 与 `ProjectFile.version` 均存在，但迁移路径未定义
- v1.0 无历史项目，可延后至 v1.1 前
- **建议**：v1.0 期间保持 schema 冻结，v1.1 规划时补充

### P5: 三模式一致性 / HTML 离线兼容验收标准（承接第 2 轮 H17/H18）
- 属 TEST_SPEC 范围，需在 Phase 2 测试计划阶段定义
- **建议**：移交 QA 角色在测试方案中覆盖

---

## 5. 是否可进入 Phase 2 开发

✅ **可以。**

**依据**：
1. 3 项阻塞问题全部通过验证，且解决方案质量高于打回时的最低要求
2. 架构决策自洽：AI 携带元数据 → 无需语义反向识别；v1.0 无手动画布 → 全量替换无冲突；Bridge 协议三级降级链 → 大 payload 有兜底
3. CSS→Axure 映射表已具备实现级粒度（含 Flex/Grid 降级算法），可直接驱动 `axure-mapper.ts` 编码
4. 剩余 5 项问题均为实施期产出物或后续版本规划，不影响开工

**Phase 2 启动建议（优先级排序）**：
1. **Spike 0**：patch-package 对 vendor/ 的支持验证（P3，1 天）
2. **核心管道**：`axure-mapper.ts` + `convertNodeToAxureWidget`，先跑通基础 6 组件（矩形/文本/按钮/输入框/图片/链接）
3. **Bridge 客户端**：按 design.md 契约实现 `/available` 协商 + gzip/分片上传
4. **嵌套结构**：group/dynamic_panel 映射规则文档 + 3 层嵌套 fixture（P1）
5. **降级链路**：降级标识 + 导出摘要报告（P2）

---

## 评审轨迹

| 轮次 | 结论 | 关键变化 |
|------|------|---------|
| 第 1 轮 | 打回 | 识别 20 项问题（H1-H20） |
| 第 2 轮 | 有条件通过 | 15 项解决，识别 3 项阻塞（B1/B2/B3） |
| **第 3 轮** | **通过** | **3 项阻塞全部解决，可进入 Phase 2** |
