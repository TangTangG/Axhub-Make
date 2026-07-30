# axhub-proto-enhanced v1.0.0 代码 Review 第 1 轮 — 6 角色汇总报告

> 日期：2026-07-27
> 版本：v1.0.0
> 轮次：代码 Review 第 1 轮
> 审查范围：src/enhanced/（58 TS/TSX + 20 CSS，~8,850 行）、src/integration/、tests/e2e/

---

## 一、6 角色结论总览

| 角色 | 结论 | 高优 | 中优 | 低优 | 报告文件 |
|------|------|------|------|------|---------|
| 产品经理（PM） | 有条件通过 | 2 | 5 | 6 | `2026-07-27-code-review-pm-round1.md` |
| 前端开发（FE） | 条件通过 | 2 | 6 | 7 | `2026-07-27-code-review-fe-round1.md` |
| 后端开发（BE） | **不通过** | 5 | 7 | 6 | `2026-07-27-code-review-be-round1.md` |
| UI 设计师 | 有条件通过 | 3 | 11 | 6 | `2026-07-27-code-review-ui-round1.md` |
| 测试工程师（QA） | **不通过** | 5 | 7 | 5 | `2026-07-27-code-review-qa-round1.md` |
| 运营 | **不通过** | 4 | 4 | 3 | `2026-07-27-code-review-ops-round1.md` |

**总问题数（去重前）：高优 21 / 中优 40 / 低优 33**

---

## 二、高优问题去重汇总（必须修复后才能进入第 2 轮）

### 🔴 集成层断裂（多角色共识）

| # | 问题 | 发现角色 | 影响 | 修复方案 |
|---|------|---------|------|---------|
| H1 | **`UnifiedExportPipeline` 未接线到真实导出模块** | PM-H1 / BE-H2 / BE-H3 / QA-H4 | Axure 导出走硬编码极简转换器（无样式/无组件映射/无降级），HTML 导出输出空 div，图片导出返回 HTML Blob 冒充图片 | 复用 `exportToAxure()` + `exportHtml()` + `exportImage()`，删除占位实现 |
| H2 | **Adapter 类型契约与 enhanced 层脱节** | FE-H1 / BE-M7 / PM-M3 | Adapter 产出 `'rectangle'`，enhanced 期望 `'proto-rectangle'`，所有组件走 fallback | Adapter 统一映射到 `'proto-*'` 命名空间 |

### 🔴 Bridge 客户端缺陷

| # | 问题 | 发现角色 | 影响 | 修复方案 |
|---|------|---------|------|---------|
| H3 | **gzip「假压缩」** | BE-H1 | 只加 `Content-Encoding: gzip` header，body 未压缩，Bridge 解析失败 | 用 `CompressionStream('gzip')` 真实压缩，或移除 header |
| H4 | **payload 大小检查用字符数非字节数** | BE-H4 / QA-H5 | 中文场景漏报超限；分片按字符切可能切断 UTF-8 字符 | 用 `TextEncoder().encode().length` 计算字节数，分片按字节切 |

### 🔴 错误处理与降级

| # | 问题 | 发现角色 | 影响 | 修复方案 |
|---|------|---------|------|---------|
| H5 | **BridgeError 被吞为 UNKNOWN** | QA-H2 / BE-H5 | 400/413/500/503 错误码与用户文案全部丢失 | `export()` catch 显式捕获 `BridgeError` 并映射到 `ExportError.code` |
| H6 | **缺 Bridge 不可用降级方案（剪贴板）** | PM-H2 | 头号风险无对策，Axure 未启动时完全无法导出 | 实现剪贴板复制 + 手动粘贴引导 + 埋点 |

### 🔴 测试体系失效

| # | 问题 | 发现角色 | 影响 | 修复方案 |
|---|------|---------|------|---------|
| H7 | **E2E 测试运行器错配（Playwright 跑 Vitest API）** | QA-H1 | E2E 实际无法执行 | 统一为 Vitest（改名/配置 project），或改写为 Playwright 风格 |
| H8 | **`exportImage` 假实现被测试背书** | QA-H3 / PM-H1 / BE-H3 | 返回 text/html Blob，测试断言成功 → 假绿 | 实现真实图片导出，或从 v1.0.0 声明中移除 image 格式 |

### 🔴 数据埋点零接入

| # | 问题 | 发现角色 | 影响 | 修复方案 |
|---|------|---------|------|---------|
| H9 | **埋点 SDK 完成但业务零接入** | OPS-H1 | 全仓库无 `tracker.track()` 调用，数据面板上线即白板 | 在关键路径（app_open/ai_generate/export/preview）接入埋点 |
| H10 | **prompt_text 无脱敏 + 服务端断头** | OPS-H2/H3/H4 | 用户原文上报合规风险；`/api/analytics/track` 不存在；退出开关无 API | 实现 prompt 脱敏/哈希；补服务端路由；实现 opt-out API |

### 🔴 a11y 缺陷

| # | 问题 | 发现角色 | 影响 | 修复方案 |
|---|------|---------|------|---------|
| H11 | **Switch 焦点环不可见 + 焦点环透明度不足 + Radio 缺 name** | UI-P0-1/2/3 | 键盘用户完全看不到焦点指示，违反 DESIGN_SPEC | 修复 Switch focus 绑定、统一实色 ring、Radio 补 name |

---

## 三、中优问题分类汇总（40 项，本轮修复或排入第 2 轮计划）

| 类别 | 数量 | 代表问题 |
|------|------|---------|
| 类型安全 / any 穿透 | 6 | CSS Modules 无类型声明（FE-M1）、preview-manager `node: any`（FE-M2）、Row cloneElement any（FE-M5） |
| XSS / 安全注入 | 3 | html-exporter `</script>` 注入（FE-M3/BE-M5）、CSS 值未白名单（BE-M6） |
| 性能隐患 | 3 | base64 主线程阻塞 + 串行 fetch（FE-M4）、离屏 DOM 泄漏（FE-H2）、Slider 监听残留（FE-M6） |
| 协议/契约不一致 | 8 | 分片协议未包装 CopyAxvgRequest（BE-M1）、版本协商未实现（BE-M2）、CapacityGuard 10MB 与分片冲突（BE-M3）、表格行数 100 vs 规格 1000（QA-M1）、Button 属性与矩阵不符（UI-M4）、过渡时长 150ms vs 200ms（UI-M6）、local 测试静默跳过（QA-M3）、导出成功率公式失真（OPS-M1） |
| 功能缺失 | 6 | 上游同步机制未实现（PM-M1）、AI 再生成确认弹窗缺失（PM-M2）、高级组件无 React 实现（PM-M3）、PreviewManager 竞态（PM-M4）、Modal/Drawer 缺 dialog 语义（UI-M8）、Select 键盘导航不完整（UI-M9） |
| 测试覆盖缺口 | 8 | 边界值测试缺 on-boundary（QA-M2）、Bridge 失败路径 CI 无覆盖（QA-M4）、兼容性测试缺失（QA-M5）、AI 异常路径无测试（QA-M6）、validateTree 只抛第一个错误（QA-M7）、enhanced 零单元测试（QA-H4）、无覆盖率门禁（QA-L5）、测试数据重复（QA-L2） |
| 数据/埋点偏差 | 3 | 导出成功率公式失真（OPS-M1）、编辑/分享环节无事件（OPS-M2/M3）、埋点服务端断头（OPS-H3） |
| a11y 规范 | 4 | Modal/Drawer 缺 dialog 语义（UI-M8）、Select 键盘导航不完整（UI-M9）、`:focus` vs `:focus-visible`（UI-L12）、aria-label 英文（UI-L16） |

---

## 四、第 1 轮 Review 结论

**不通过，不可进入第 2 轮。**

**理由：**
1. **BE / QA / OPS 三角色明确判定「不通过」**，高优问题覆盖导出链路、测试体系、数据埋点三大核心系统
2. **集成层断裂（H1/H2）** 导致 enhanced 层 8,850 行代码实际未接入用户主链路
3. **E2E 测试运行器错配（H7）** 导致现有测试无法执行，QA 覆盖率仅 13%
4. **埋点零接入（H9）** 导致运营数据体系完全失效

**修复策略（用户偏好：全部修复，不论严重程度）：**

| 优先级 | 数量 | 策略 |
|--------|------|------|
| 🔴 高优 11 项 | 导出链路 4 + Bridge 2 + 错误处理 2 + 测试 2 + 埋点 2 + a11y 1 | 立即修复，派 Mimo 子代理并行处理 |
| 🟡 中优 40 项 | 类型安全 6 + 安全 3 + 性能 3 + 契约 8 + 功能 6 + 测试 8 + 数据 3 + a11y 4 | 同步修复，按模块分组派发 |
| 🟢 低优 33 项 | 代码风格/命名/注释/边界 case | 登记到 v1.1，本轮不修 |

---

## 五、修复任务分组（供 Mimo 派发）

| 组 | 任务 | 高优项 | 中优项 | 预估工作量 |
|---|------|--------|--------|-----------|
| G1 | 集成层接线（UnifiedExportPipeline 复用 enhanced 导出） | H1, H2 | BE-M7, PM-M3 | 2h |
| G2 | Bridge 客户端修复（gzip 真实压缩 + 字节计算 + 分片协议） | H3, H4 | BE-M1, BE-M2, BE-M3 | 2h |
| G3 | 错误处理与降级（BridgeError 透传 + 剪贴板降级） | H5, H6 | QA-M4 | 1.5h |
| G4 | 测试体系修复（运行器统一 + 图片导出实现/移除 + 单元测试补全） | H7, H8 | QA-M1~M7, QA-L1~L5 | 3h |
| G5 | 数据埋点接入（业务触发 + prompt 脱敏 + 服务端路由 + opt-out） | H9, H10 | OPS-M1~M3 | 2.5h |
| G6 | a11y 修复（Switch focus + 焦点环统一 + Radio name + Modal/Drawer dialog） | H11 | UI-M8, UI-M9, UI-L12 | 1.5h |
| G7 | 类型安全收敛（CSS Modules 声明 + preview-manager 类型 + Row Context） | — | FE-M1~M2, FE-M5 | 1.5h |
| G8 | 安全加固（XSS 注入修复 + CSS 值白名单） | — | FE-M3, BE-M5, BE-M6 | 1h |
| G9 | 性能优化（base64 分块 + 并发 fetch + 离屏 DOM finally + Slider cleanup） | — | FE-M4, FE-H2, FE-M6 | 1h |
| G10 | 契约对齐（Button 属性对齐矩阵 + 过渡时长统一 + 表格行数对齐 + 成功率公式修正） | — | UI-M4, UI-M6, QA-M1, OPS-M1 | 1h |

**总预估工作量：~17h（Mimo 并行派发，实际墙钟时间 ~4-6h）**

---

## 六、进入第 2 轮的前置条件

- [ ] 全部 11 项高优修复完成并通过 grep/测试验证
- [ ] 全部 40 项中优修复完成或明确豁免理由
- [ ] `pnpm test:e2e` 真实可跑且通过
- [ ] 埋点关键事件（app_open/ai_generate/export）有实际调用
- [ ] 集成层导出产物（Axure JSON / HTML / 图片）经 e2e 验证正确

---

*报告生成时间：2026-07-27*
*汇总人：Hanzo*
*下一步：派发 Mimo 修复子代理（按 G1-G10 分组）*
