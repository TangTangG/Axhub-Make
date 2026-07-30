# 运营代码 Review — 第 2 轮（数据埋点 / 增长 / 隐私 / 品牌）

> 项目：axhub-proto-enhanced v1.0.0
> 审查人：运营
> 日期：2026-07-27
> 复审对象：第 1 轮修复 commit `d0cebf8`（fix: 代码 Review 第 1 轮修复 11 高优 + 40 中优）
> 审查范围：`src/enhanced/index.ts`、`src/enhanced/export/export-pipeline.ts`、`src/enhanced/analytics/utils/prompt-sanitizer.ts`、`src/enhanced/analytics/tracker.ts`、`src/enhanced/analytics/types.ts`、`src/enhanced/analytics/metrics.ts`、`src/server/analytics-track.ts`、`src/server/managementApi.ts`、`src/enhanced/preview/html-exporter.ts`、`src/integration/export-pipeline.ts`，并对全仓库做埋点接入 grep 扫描 + 运行 vitest / tsc 回归。

---

## 一、结论（TL;DR）

**第 1 轮 OPS 高优问题 H1–H4 中，仅 H3（服务端路由）完全修复；H1 / H2 / H4 均为"部分修复、核心环节缺失"；中优 M1（成功率公式）已修正，M2（HTML 品牌标识）未修复。且工作区存在未完成的 merge 冲突，源码当前不可构建。**

**是否可进入第 3 轮：否（No-Go）。** 需先清理 merge 冲突使代码可编译，并补齐 H1 的 `app_open` / `export_axure_start/success/fail` 触发、H2 的脱敏函数实际接入、H4 的 opt-out API 落地到已提交代码。

---

## 二、高优问题修复验证表

| # | 第 1 轮问题 | 验证结果 | 证据 |
|---|---|---|---|
| **H1** | 19 个事件全部零触发 | ❌ **部分修复（核心事件仍缺失）** | `src/integration/export-pipeline.ts` 仅接入 3 个事件（L160 `export_axure_fallback_clipboard`、L189 `export_html`、L219 `export_image`）；**`app_open` 全仓库无调用**（`src/enhanced/index.ts` 仅 re-export 模块，无任何触发逻辑）；**`export_axure_start` / `export_axure_success` / `export_axure_fail` 在 `src/enhanced/export/export-pipeline.ts` 与 `src/integration/export-pipeline.ts` 中均无 `tracker.track` 调用**；AI 生成、预览、组件使用、错误边界等事件亦无接入。全仓库 grep 到的 `tracker.track` 调用仅上述 3 处 |
| **H2** | prompt_text 原文上报 + 无脱敏实现 | ⚠️ **工具已建，接线未提交** | `src/enhanced/analytics/utils/prompt-sanitizer.ts` 已创建（哈希 + 50 字符截断，含 `isSanitizedPrompt` 防重复处理），**但全仓库无任何文件 import 该模块**（grep `sanitizePrompt` 仅命中文件自身）。工作区存在 `tracker.ts` 的已暂存（staged）修改——在 `track()` 内对 `prompt_text` 自动脱敏并新增 `setEnabled/optOut`——**但该修改未包含在 `d0cebf8` commit 中**。另外 `types.ts` L26 仍将 `prompt_text` 声明为必填，与 spec §五"不采集输入内容"的矛盾未修订 |
| **H3** | 服务端 `/api/analytics/track` 路由不存在 | ✅ **已修复** | 新增 `src/server/analytics-track.ts`：POST 接收事件 → 校验（`event` 为 string、`timestamp` 为 number）→ 写入 SQLite（`node:sqlite` 动态导入，`.axhub/analytics.db`，含 `analytics_events` 表 + 双索引）；GET `/api/analytics/metrics` 简易查询。`src/server/managementApi.ts` L71 import、L1251 路由挂载。注意：依赖 Node 22+ 内置 `node:sqlite` 模块 |
| **H4** | opt-out API 缺失 | ⚠️ **代码存在但未提交** | 同 H2：`setEnabled(enabled)` / `optOut()`（清空队列 + 移除 localStorage 缓存）出现在 `tracker.ts` 的**已暂存未提交**修改中，`types.ts` 的 `ITracker` 接口同步扩展。commit `d0cebf8` 中的 tracker.ts 无此 API。UI 设置页入口全仓库未见 |

### 中优问题修复验证

| # | 第 1 轮问题 | 验证结果 | 证据 |
|---|---|---|---|
| **M1** | 导出成功率公式失真（HTML/图片同时计入分子分母） | ✅ **已修复** | `metrics.ts` L21-23：`EXPORT_START_EVENTS` 现在仅含 `export_axure_start`，不再混入 `EXPORT_HTML`/`EXPORT_IMAGE`。公式分母语义修正。**遗留**：分子 `EXPORT_SUCCESS_EVENTS` 仍含 HTML/图片事件，由于 HTML/图片没有对应 `_start` 事件，跨格式汇总成功率仍会被稀释——且因为 H1 未接 `export_axure_start/success`，该指标目前分母永远为 0（函数返回 0），实际看板依然无数据 |
| **M2** | 导出 HTML 无品牌标识 | ❌ **未修复** | `html-exporter.ts` `assembleHtml()`（L459-489）生成的 HTML 仍只有 `<title>` + 根 div，**无 generator 注释、无 "Made with Axhub" 角标、无 branding 开关**。diff 确认本轮对 html-exporter 的修改全部为 XSS 安全加固（`</script` 转义、属性转义、CSS 值白名单），品牌标识未涉及。Axure JSON document 层（`export-pipeline.ts` L71-76）亦无 `generator` 元字段 |
| M4 | flush 对 4xx/5xx 不重试 | ❌ 未修复（tracker.ts 无改动提交） | — |
| M6 | url/referrer 原文上报 | ❌ 未修复 | `tracker.ts` L132-133 仍直接取 `window.location.href` / `document.referrer` |

---

## 三、新问题清单（第 2 轮发现）

### 🔴 高优（阻断）

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| **R2-H1** | **工作区存在未完成的 merge，19 个文件含冲突标记（`<<<<<<<`/`>>>>>>>`），`pnpm tsc --noEmit` 直接报 20+ 个 `TS1185: Merge conflict marker encountered` 错误** | `src/integration/export-pipeline.ts`、`src/integration/types.ts`、`src/integration/adapter.ts`、`src/enhanced/preview/html-exporter.ts`、`src/enhanced/preview/image-exporter.ts`、大量组件 CSS/TSX、`pnpm-workspace.yaml` | **源码当前不可构建、不可发布**。且 `src/integration/export-pipeline.ts` 恰好是本轮埋点接入的核心文件——冲突未解决意味着 H1 的 3 处已接入埋点也处于不可用状态。必须立即完成 merge 或 `git merge --abort` 回到 `d0cebf8` 干净状态 |
| **R2-H2** | **H2/H4 的修复代码（prompt 脱敏接线 + opt-out API）只存在于 git index（已暂存），未进入 `d0cebf8` commit** | `src/enhanced/analytics/tracker.ts`、`src/enhanced/analytics/types.ts` | 评审基准 commit 与实际工作区不一致，有"修复丢失"风险——若此时 `git merge --abort` 或 reset，脱敏接线和 opt-out 将一并丢失。需先将该 staged 修改提交（或合入冲突解决后的 commit） |

### 🟡 中优

| # | 问题 | 位置 | 影响 |
|---|---|---|---|
| **R2-M1** | `export_axure_fallback_clipboard` 事件未在 `CRITICAL_EVENTS` 集合中（虽已在 `EVENT_PRIORITY` 标为 P0），Bridge 降级这一关键运营信号不会触发立即上报，可能随页面关闭丢失（仅靠 beforeunload 落盘兜底） | `src/enhanced/analytics/events.ts` L42-48 | Bridge 可用性是导出成功率的核心解释变量，降级事件的丢失率会高于其他 P0 事件 |
| **R2-M2** | `export_axure_fallback_clipboard` 埋点的 `payload_size` 上报的是 `serialized.length`（**字符数**），而同文件 L115 对 Bridge 路径已改为 `TextEncoder().encode().length`（**字节数**），两处口径不一致，中文场景下剪贴板降级路径的 payload 指标系统性偏小 | `src/integration/export-pipeline.ts` L163 vs L115 | 容量分析数据失真（与第 1 轮 G2 修复"字节计算"自相矛盾） |
| **R2-M3** | `sanitizePrompt` 的注释自称"SHA-256 前 8 位哈希"，实际实现是 cyrb53 变体（双 32 位 imul 混合），并非 SHA-256。功能上脱敏目的可达，但注释与实现不符，且该哈希**非密码学安全**，spec/文档若引用"SHA-256"措辞会误导合规审计 | `src/enhanced/analytics/utils/prompt-sanitizer.ts` L11-13 | 文档可信度问题；若合规要求"不可逆哈希"，需改用 `crypto.subtle.digest` 或明确声明非安全哈希 |
| **R2-M4** | 新增的 `export_axure_fallback_clipboard` 事件（events.ts L17）在 `types.ts` 的 `EventProperties` 联合类型中没有对应接口定义，`clipboard_success` 等属性靠联合类型末尾的 `Record<string, unknown>` 兜底，类型约束力弱于其他 19 个事件 | `src/enhanced/analytics/types.ts` L139-159 | 接入方传错属性名不会被 TS 拦截 |

### 🟢 低优

| # | 问题 | 位置 |
|---|---|---|
| R2-L1 | 服务端 `analytics-track.ts` 的 `handleAnalyticsMetricsApi` 直接 `SELECT ... LIMIT 1000` 全量返回事件明细，无鉴权、无分页参数——本地工具场景可接受，但若管理端口对外暴露需注意 | `src/server/analytics-track.ts` L145 |
| R2-L2 | 第 1 轮 L6 指出的"模块级单例 import 即构造"未改，且新增 opt-out 后 `optOut()` 不重置 `userId`（匿名 ID 仍保留在 localStorage），严格意义上未满足第 1 轮 H4"含清空匿名 ID"的要求 | `src/enhanced/analytics/tracker.ts`（staged 版本） |

---

## 四、回归验证执行记录

| 验证项 | 命令 | 结果 |
|---|---|---|
| 集成层单测 | `pnpm vitest run src/integration/export-pipeline.test.ts` | ✅ 9/9 通过（BridgeError 映射、剪贴板降级） |
| 埋点模块单测 | `pnpm vitest run src/enhanced/analytics` | ⚠️ **无任何测试文件**（第 1 轮 L2 指出的问题未修——新增的服务端路由、脱敏工具、metrics 公式修正均无单测覆盖） |
| 类型检查 | `pnpm tsc --noEmit` | ❌ **失败**：`src/integration/export-pipeline.ts` 等文件 20+ 处 TS1185 merge 冲突标记错误 |

---

## 五、是否可进入第 3 轮

**否（No-Go）。**

进入第 3 轮的前置条件（按执行顺序）：

1. **清理 merge 状态**：解决 19 个冲突文件或 `git merge --abort`；保证 `pnpm tsc --noEmit` 通过——当前代码不可构建，一切功能验证都无从谈起；
2. **落盘 H2/H4 修复**：将已暂存的 tracker 脱敏接线 + `setEnabled/optOut` 提交进 commit；
3. **补齐 H1 核心触发点**（运营视角的最低集）：应用入口 `app_open`、Axure 导出路径 `export_axure_start/success/fail`（这是北极星指标"导出成功率"分子分母的唯一数据来源，当前该指标恒为 0）；
4. **M2 品牌标识**：HTML `<head>` 注入 generator 注释（一行代码，强烈建议本期闭环，勿再错过传播窗口）。

第 2 轮确认的积极进展：服务端接收链路（H3）完整落地且带 metrics 查询端点；成功率公式分母修正（M1）；剪贴板降级事件接入。但整体状态是"**修复在途、未闭环、工作区损坏**"，距离可评审状态还差一轮完整的收尾。
