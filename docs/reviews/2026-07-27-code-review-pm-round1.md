# axhub-proto-enhanced v1.0.0 代码 Review — PM 第 1 轮

- **审查人**：产品经理（PM）
- **审查日期**：2026-07-27
- **审查轮次**：代码 Review 第 1 轮（前置：需求 Review 3 轮通过、设计 Review 3 轮通过）
- **审查范围**：`src/enhanced/`（组件系统、导出、预览、埋点、Bridge、容量守卫）、`src/integration/`（适配层、统一导出管道），对照 `openspec/changes/enhance-prototype-tool/proposal.md` 与 `design.md`
- **审查重点**：需求符合性 / 用户价值交付完整性 / v1.0 功能边界 / 功能缺失与范围蔓延

---

## 一、结论

**有条件通过（Conditional Pass）**

整体代码对 proposal.md 与 design.md 的需求覆盖度较高：组件系统（基础 6 + 表单 7 + 布局 9 + 高级 3 = 25 个组件映射）、Axure 导出增强、多模式预览（iframe/HTML/图片）、Bridge 客户端（gzip/分片/错误码）、数据埋点（事件 + 北极星指标）、容量守卫均已实现，且未发现「手动编辑画布」等 v1.0 范围外功能蔓延。

但存在 **2 个高优先级问题**：① `src/integration/export-pipeline.ts` 中的统一导出管道内部实现是占位 stub，没有真正调用 `src/enhanced/` 下已完成的真实导出逻辑，且 image 导出错误返回 HTML Blob —— 这直接破坏「AI 生成→导出→预览」的用户价值主链路；② 缺少 Bridge 不可用时的降级方案（剪贴板复制 + 手动粘贴引导），这是 proposal 风险对策中的明确承诺。另有多项中低优先级问题需在第 2 轮前修复或明确豁免理由。

---

## 二、需求覆盖核对

| proposal.md 需求项 | 代码实现 | 覆盖判定 |
|---|---|---|
| 1. AI 生成原型（复用上游） | `src/integration/adapter.ts` 双向转换 ComponentTree ↔ 上游数据格式 | ✅ 覆盖 |
| 2. Axure 导入增强 - 组件类型扩展（基础/表单/布局/高级） | `export/component-mapper.ts` 注册 25 个组件类型映射 | ✅ 覆盖 |
| 2. 样式映射（CSS→Axure） | `export/axure-mapper.ts`（尺寸/位置/边框/背景/文本/阴影，不支持属性降级） | ✅ 覆盖 |
| 2. 降级策略（占位矩形 + 图注） | `export/export-pipeline.ts` `createFallbackWidget()`，灰色虚线占位 + `[组件名]` 图注 | ✅ 覆盖 |
| 3. iframe 内嵌预览 | `preview/preview-manager.ts` `renderIframeMode()`（sandbox、实时同步） | ✅ 覆盖 |
| 3. 独立 HTML 导出 | `preview/html-exporter.ts`（资源内联、交互脚本、5MB 上限警告） | ✅ 覆盖 |
| 3. 静态图片导出（PNG/SVG，DPI，背景） | `preview/image-exporter.ts`（离屏 DOM 渲染、PNG/SVG、1x/2x/3x、背景选项） | ✅ 覆盖 |
| 4. 完整组件库（25 组件 React 实现） | `components/`：basic 6 个、form 7 个、layout 9 个均有 .tsx + .css + .stories.tsx；**advanced（chart/map/rich-text）无 React 组件实现** | ⚠️ 部分覆盖 |
| 设计 Token 系统 | `tokens/design-tokens.json`（color/typography/spacing/radius/shadow） | ✅ 覆盖 |
| 组件状态规范（hover/active/focus/disabled/loading/error） | `components/types.ts` `ComponentStateName` 7 态定义；各组件 CSS 中实现 | ✅ 覆盖 |
| 数据埋点（激活漏斗/AI 采纳率/留存） | `analytics/`：事件 18 个 + 关键事件立即上报 + 队列持久化 + 3 个北极星指标 | ✅ 覆盖 |
| Axure Bridge（localhost:32767，不生成 .rp） | `bridge/client.ts`：/available 探测、/copyaxvg、gzip、分片、错误码 400/413/500/503 | ✅ 覆盖 |
| 容量限制（10MB payload / 5MB 分片 / 60s 超时） | `guards/capacity-guard.ts` + `bridge/client.ts` 常量一致 | ✅ 覆盖 |
| 上游同步机制（git subtree + patch-package + CI） | **未找到 `scripts/sync-upstream.sh`、`apply-patches.sh`、`.github/workflows/upstream-sync.yml`** | ❌ 未覆盖 |
| AI 再生成策略（全量替换 + 确认弹窗 + 埋点） | **代码中未找到确认弹窗逻辑与 `ai_regenerate` 埋点事件** | ❌ 未覆盖 |
| Bridge 不可用降级（剪贴板 + 手动粘贴引导） | **未找到剪贴板降级实现**（proposal「风险与对策」第 1 条） | ❌ 未覆盖 |
| v1.0 不包含：手动编辑画布 | 全库检索 `undo/redo/drag/手动编辑` 未在 `src/enhanced/` 发现编辑能力；上游 Excalidraw 画布相关均为 preview/embed 用途 | ✅ 边界守住 |

---

## 三、问题清单

### 🔴 高优先级（High）

#### H1. 统一导出管道 `UnifiedExportPipeline` 是占位实现，未接真实导出逻辑

- **位置**：`src/integration/export-pipeline.ts`
- **描述**：该类是 design.md 架构图中的「统一导出管道」，也是 e2e 测试（`tests/e2e/export.ci.test.ts`、`export.local.test.ts`）的入口，但其内部实现并未复用 `src/enhanced/` 已完成的真实模块：
  - `exportAxure()` 调用私有 `convertTreeToAxure()`（第 148-174 行）—— 一个**硬编码、不含样式转换、不含组件映射、不含降级、不含 interactions** 的极简转换器，**完全没有使用** `src/enhanced/export/export-pipeline.ts` 的 `exportToAxure()` + `component-mapper.ts` + `axure-mapper.ts`；
  - `exportHtml()` 调用私有 `renderTreeToHtml()`（第 176-183 行）—— 只输出空 `<div data-component>`，**没有使用** `src/enhanced/preview/html-exporter.ts` 的完整导出器（内联资源、交互脚本、标签映射）；
  - `exportImage()`（第 130-146 行）**直接返回 text/html 的 Blob**，连 HTML 骨架都不是图片格式 —— 这是明显的功能错误；
  - 统计字段 `fallbackNodes: 0`、`skippedNodes: 0` 硬编码为 0，丢失降级统计。
- **风险**：**用户价值主链路断裂**。e2e 测试通过 UnifiedExportPipeline 运行时，Axure 导出结果不可编辑（无样式/无类型映射/无 interactions），HTML 导出空白，图片导出返回的是 HTML 文件 —— 三种导出模式实际上都不可用。开发模块（enhanced/*）质量尚可，但集成层没有接线，等于交付「零件合格、整车无法启动」。
- **建议**：`UnifiedExportPipeline` 各分支改为委托：
  - `exportAxure` → `enhanced/export/export-pipeline.ts` 的 `exportToAxure()`（拿到 warnings/stats 透传）；
  - `exportHtml` → `enhanced/preview/html-exporter.ts` 的 `exportHtml()`；
  - `exportImage` → `enhanced/preview/image-exporter.ts` 的 `exportImage()`（修正 MIME type 为 `image/png` 或 `image/svg+xml`）；
  - 删除私有 `convertTreeToAxure` / `renderTreeToHtml` 等占位实现，避免两套逻辑并存漂移。
- **验收**：e2e 导出的 Axure JSON 应包含正确的 widgetType、style（fill.color/textStyle.*）、interactions；HTML 文件应包含真实渲染内容；图片 Blob 的 `type` 应为 `image/png|svg`。

#### H2. 缺少 Axure Bridge 不可用时的降级方案（剪贴板 + 手动粘贴引导）

- **位置**：全库无实现
- **描述**：proposal.md「风险与对策」第 1 条及 design.md 均明确承诺：「Axure Bridge 不可用 → 提供降级策略（复制剪贴板 + 手动粘贴）」。当前 `bridge/client.ts` 在 503 时仅抛 `BridgeError`（userMessage：「请确保 Axure RP 已启动且 Bridge 已启用」），`integration/export-pipeline.ts` 在 Bridge 不可用时直接返回 `BRIDGE_UNAVAILABLE` 错误结果，**没有任何将 Axure JSON 复制到剪贴板、并引导用户手动粘贴到 Axure RP 的降级路径**。
- **风险**：Bridge 不可用是概率「中」、影响「高」的头号风险。无降级意味着用户在 Axure 未启动/插件未装时**完全无法拿到导出结果**，核心卖点「AI 生成→Axure 可编辑」直接归零，且无任何挽回路径，会造成大量导出失败流失（埋点 `export_axure_fail` 将显著升高）。
- **建议**：在 `UnifiedExportPipeline.exportAxure()` 捕获 `BRIDGE_UNAVAILABLE` 后：
  1. 将 `AxureDocument` 序列化（必要时 gzip）写入 `navigator.clipboard`；
  2. 返回带 `degraded: true` + `fallback: 'clipboard'` 的成功结果；
  3. UI 层弹引导：「Bridge 未检测到，已将原型数据复制到剪贴板，请在 Axure RP 中 Ctrl+V 粘贴」；
  4. 埋点记录 `export_axure_fallback_clipboard` 事件用于观测降级率。

### 🟡 中优先级（Medium）

#### M1. 上游同步机制（git subtree + patch-package + 周更 CI）未实现

- **位置**：未找到 `scripts/sync-upstream.sh`、`apply-patches.sh`、`.github/workflows/upstream-sync.yml`
- **描述**：proposal.md「技术约束」第 1 条将「上游同步优先」列为**最高优先级**约束，design.md §1 给出完整脚本与 CI YAML，成功标准第 4 条要求「每周自动 sync，冲突率 ≤30%，同步后测试通过率 100%」。当前仓库中未见任何同步脚本、patch-package 补丁目录或 GitHub Actions workflow。
- **风险**：fork 项目失去上游同步机制 = 长期不可维护。Axhub-Make 上游持续迭代，无自动同步将在数月内落后多个版本，失去「复用上游 AI 生成能力」的立项根基，且冲突成本随时间指数上升。
- **建议**：若因仓库结构（未采用 `upstream/` subtree 目录布局）而有意调整，请在 README/CHANGELOG 中**显式记录决策变更**；否则补齐 `scripts/sync-upstream.sh`、`patches/`、`.github/workflows/upstream-sync.yml` 三个交付物，并跑一次 dry-run 验证。

#### M2. AI 再生成确认弹窗与 `ai_regenerate` 埋点缺失

- **位置**：全库未找到
- **描述**：design.md「AI 再生成策略」明确 v1.0 实现「全量替换 + 确认弹窗 + 记录埋点事件 ai_regenerate」。当前 `analytics/events.ts` 无 `AI_REGENERATE` 事件，代码中也未见确认弹窗逻辑。无确认弹窗意味着用户一键误触即**丢失当前画布全部内容**（v1.0 无撤销），属数据安全风险。
- **风险**：误操作导致工作内容不可逆丢失，属于典型的「一次事故毁掉产品口碑」场景；同时埋点缺失导致无法观测再生成行为。
- **建议**：在 `AnalyticsEvents` 增加 `AI_REGENERATE: 'ai_regenerate'`（P0 优先级）；在触发生成的入口前加确认弹窗（文案照 design.md：「重新生成将替换当前所有内容，是否继续？」），确认后埋点。

#### M3. 高级组件（chart/map/rich-text）无 React 渲染实现

- **位置**：`src/enhanced/components/` 下无 advanced 目录
- **描述**：component-mapper 已注册 `proto-chart`/`proto-map`/`proto-rich-text` 的 Axure 映射（inline_frame/占位降级），但 components/ 目录只有 basic(6) + form(7) + layout(9) = 22 个 React 组件，**advanced 3 个组件没有 .tsx/.css/.stories**。proposal「成功标准」第 3 条要求组件 ≥20 种且「每种组件有完整的状态规范」。
- **风险**：22 ≥ 20 刚好踩线达标，但高级组件无渲染实现意味着 HTML 导出/iframe 预览中遇到 chart/map 时**无对应渲染器**，html-exporter 的 `resolveHtmlTag` 只能回退为通用 div，预览效果与 Axure 占位降级不一致；且「完整组件库」卖点存在口径风险。
- **建议**：两个选项择一并文档化——① 补齐 advanced 3 组件的最小实现（可仅含 default 状态 + 占位渲染，标注「尽力而为」）；② 在 proposal/COMPONENT_MATRIX.md 中将 v1.0 组件数明确改为 22，并把 chart/map/rich-text 标注为「映射已支持、渲染占位」。

#### M4. `PreviewManager.switchMode` 中的异步竞态

- **位置**：`preview/preview-manager.ts` 第 98-111 行 `switchMode()` 与第 254-273 行 `renderCurrentMode()`
- **描述**：`switchMode` 是 `async` 但内部 `renderCurrentMode()` 是同步调用，而 `renderHtmlMode()`/`renderImageMode()` 本身是 `async`（含 `await exportHtml/exportImage`）却未被 await —— `renderCurrentMode` 的 switch 分支调用它们后**不等待完成即返回**，`state.loading` 在渲染尚未完成时就被置为 false，`mode-change` 事件先发出，图片/HTML 后落地。快速连续切换模式时可能出现**旧模式的异步渲染结果覆盖新模式**的竞态。
- **风险**：用户快速在 iframe/html/image 间切换时预览内容错乱或闪烁，loading 状态不可信；埋点 `preview_mode_switch` 的时序数据也会失真。
- **建议**：`renderCurrentMode` 改 async 并在 `switchMode` 中 await；加一个递增的 `renderToken`，异步渲染落地前校验 token 是否仍最新，过期则丢弃结果。

#### M5. 组件库文档 COMPONENT_MATRIX.md 缺失

- **位置**：仓库根目录未找到
- **描述**：proposal.md「v1.0 包含」明确引用「完整组件库（25 个组件，详见 COMPONENT_MATRIX.md）」，但该文件不存在（仅找到 CHANGELOG.md、UPSTREAM_API_LOCK.md）。组件可编辑性分级（L1-L4）、降级策略、状态覆盖矩阵等 PM/QA/用户沟通所需的权威清单无落地文档。
- **风险**：第 2/3 轮 review 及后续验收无对照基线；「基础组件 100% 可编辑、表单 90%+、布局 80%+」的成功标准无法逐组件核验。
- **建议**：补 `COMPONENT_MATRIX.md`，列 25 个组件的：Axure widgetType / editable / complexity / fallback / 状态覆盖 / EditabilityLevel。

### 🟢 低优先级（Low）

#### L1. `CapacityGuard.countTableRows` 的类型判定与注册不一致

- **位置**：`guards/capacity-guard.ts` 第 164 行
- **描述**：判定 `node.type === 'table'`，但 component-mapper 注册的类型是 `proto-table`，adapter 转换后是 `table`。两处命名空间（`proto-*` vs 裸名）混用，若 ComponentTree 来自 enhanced 链路（`proto-table`），表格行数限制永不触发。
- **风险**：大表格场景容量保护失效（边界场景）。
- **建议**：统一组件类型命名约定（建议全部 `proto-*` 前缀），或判定改为 `node.type === 'table' || node.type === 'proto-table'`。

#### L2. `export/export-pipeline.ts` 中 `convertStyles` 第二参数为无意义占位

- **位置**：`enhanced/export/export-pipeline.ts` 第 112 行：`convertStyles(..., mapping.widgetType ? undefined : undefined)`
- **描述**：三元表达式两个分支都是 `undefined`，属于明显的占位残留代码，可读性差且暗示未完成。
- **风险**：低（功能不受影响），但给人「未完工」信号，且第二参数若有设计意图则已丢失。
- **建议**：确认 convertStyles 签名后直接去掉第二参数，或补上原本设计的 propertyMap 参数。

#### L3. `PreviewManager.calculateTreeBounds` 与 `buildQuickStyles` 读 props 键不一致

- **位置**：`preview/preview-manager.ts` 第 394-406、422-427 行
- **描述**：`buildQuickStyles` 读 `props.left/top/width/height`，而 `export-pipeline.ts` 的 `extractPosition/extractSize` 读的是 `props.style.left/width`（带 px 解析），adapter 又透传上游 `props`。三条链路对位置/尺寸的取值路径不统一，预览边界计算（zoomToFit）在嵌套场景会漏算（walk 只累加不换算相对定位）。
- **风险**：zoomToFit 缩放比例错误、预览内容与导出结果位置不一致（视觉体验问题，非阻断）。
- **建议**：定义唯一的「节点几何获取」helper（如 `getNodeGeometry(node): {x,y,width,height}`），三条链路共用。

#### L4. 埋点事件 `EXPORT_HTML`/`EXPORT_IMAGE` 同时充任「开始」与「成功」

- **位置**：`analytics/metrics.ts` 第 15-25 行
- **描述**：`EXPORT_START_EVENTS` 与 `EXPORT_SUCCESS_EVENTS` 两个集合中都包含 `EXPORT_HTML` 和 `EXPORT_IMAGE`，即 HTML/图片导出的成功率计算恒为 100%（开始数=成功数），无法观测 HTML/图片导出失败。Axure 有 start/success/fail 三件套，HTML/Image 没有 fail 事件。
- **风险**：北极星指标「导出成功率」被 HTML/Image 的虚高数据稀释，掩盖真实失败。
- **建议**：补齐 `EXPORT_HTML_FAIL`/`EXPORT_IMAGE_FAIL` 事件，并在 html-exporter/image-exporter 的 catch 路径埋点。

#### L5. `BridgeClient.sendChunked` 与 design.md 协议字段不完全对齐

- **位置**：`bridge/client.ts` 第 155-205 行
- **描述**：分片传输用自定义 header（`X-Export-Id`/`X-Chunk-Index`/`X-Chunk-Total`/`X-Is-Last`）承载元数据，而 design.md「导出请求」约定的是 `CopyAxvgRequest` body 结构（version/payload/metadata）。分片 body 直接是裸 JSON 字符串片段，不是 `CopyAxvgRequest`。若 Bridge 端按 design 协议解析，分片模式会解析失败。
- **风险**：仅当 payload >10MB 且 Bridge 支持分片时触发（低频），但该路径一旦触发即失败。
- **建议**：与 Bridge 端实现对齐协议（以实际 Bridge 实现为准更新 design.md，或将分片也包装进 CopyAxvgRequest 结构并加 `chunk` 字段）。

#### L6. `version.ts` 的 FEATURES 清单未含「上游同步」与「组件库」

- **描述**：FEATURES 数组列了 6 项，缺「组件库（22/25 组件）」和「上游同步机制」两个 proposal 范围内的交付物描述（与 H/M 问题呼应）。
- **建议**：FEATURES 与实际交付对齐，作为版本发布说明的单一事实源。

---

## 四、范围蔓延检查

✅ **未发现范围蔓延**：

- 未在 `src/enhanced/` 发现手动编辑画布能力（无拖拽/撤销/重做/多选实现），符合 v1.0「不含手动编辑画布」声明；
- 未发现直接生成 .rp 二进制的代码（全部走 Bridge localhost:32767），符合技术约束；
- 未发现移动端、实时协作、云端项目库、多页面管理（adapter 只取 `pages[0]`，单页）等 v1.0 排除项的实现迹象；
- `EXPORT_BATCH` 事件已定义但 export 管道未见批量导出 UI 入口，属「埋点预留」，不算蔓延，可接受。

---

## 五、用户价值交付完整性评估

| 链路环节 | 状态 | 说明 |
|---|---|---|
| 需求文档 → AI 生成 | ✅（上游复用 + adapter 转换） | adapter 双向转换已实现 |
| 生成结果 → 浏览器预览 | ✅ | PreviewManager 三模式完整 |
| 组件树 → Axure 导出 | ⚠️ **链路断裂（H1）** | enhanced 模块完整，但集成层 UnifiedExportPipeline 未接线，实际走占位实现 |
| Bridge 传输 → Axure RP | ✅（协议/压缩/分片/错误码完整） | 但缺降级路径（H2） |
| 组件树 → HTML 导出 | ⚠️ **链路断裂（H1）** | 同上 |
| 组件树 → 图片导出 | ❌ **功能错误（H1）** | 返回 HTML Blob 而非图片 |
| 数据埋点闭环 | ✅（事件/队列/重试/持久化/指标） | 小瑕疵见 L4 |
| 容量保护 | ✅ | 小瑕疵见 L1 |

**结论：AI 生成→Axure 导出→多模式预览的全链路中，「导出」环节在集成层断裂，用户实际无法获得设计承诺的导出质量。修复 H1 前不具备可发布性。**

---

## 六、是否可进入第 2 轮

**可以进入第 2 轮，但附前置条件**：

1. **必须修复**（第 2 轮重点验证项）：
   - H1：UnifiedExportPipeline 接线到 enhanced 真实导出模块（含 image MIME type 修正）；
   - H2：Bridge 不可用降级（剪贴板 + 引导）方案，或给出 PM 认可的豁免理由并更新 proposal；
2. **建议修复或显式豁免**：
   - M1（上游同步机制）、M2（再生成确认 + 埋点）、M3（高级组件实现或口径调整）、M5（COMPONENT_MATRIX.md）；
3. 第 2 轮审查将基于真实 e2e 导出产物（Axure JSON 可编辑性抽检、HTML 文件内容、PNG/SVG 输出）验证「成功标准」第 1/2/5 条（可编辑率、三模式、性能 ≤5s / ≤5MB）。

---

*报告完。审查依据文件：proposal.md、design.md、src/enhanced/index.ts、version.ts、src/integration/export-pipeline.ts、src/integration/adapter.ts、src/enhanced/export/{export-pipeline,component-mapper,axure-mapper}.ts、src/enhanced/preview/{preview-manager,html-exporter,image-exporter}.ts、src/enhanced/bridge/client.ts、src/enhanced/analytics/{events,tracker,metrics,types}.ts、src/enhanced/guards/capacity-guard.ts、src/enhanced/components/types.ts、src/enhanced/tokens/design-tokens.json。*
