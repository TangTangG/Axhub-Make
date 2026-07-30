# axhub-proto-enhanced v1.0.0 代码 Review — PM 第 2 轮

- **审查人**：产品经理（PM）
- **审查日期**：2026-07-27
- **审查轮次**：代码 Review 第 2 轮（前置：第 1 轮有条件通过，修复已 commit d0cebf8）
- **审查范围**：第 1 轮高优问题修复验证（H1 集成层接线、H2 Bridge 降级）+ 新引入问题排查 + v1.0 功能边界复核
- **重点文件**：`src/integration/export-pipeline.ts`、`src/integration/adapter.ts`、`src/enhanced/export/export-pipeline.ts`、`src/enhanced/preview/html-exporter.ts`、`src/enhanced/preview/image-exporter.ts`、`src/integration/export-pipeline.test.ts`、`src/enhanced/analytics/events.ts`

---

## 一、结论

**通过（Pass）**

第 1 轮两个高优问题（H1、H2）均已真正修复：UnifiedExportPipeline 已删除全部占位实现，三种导出格式均委托到 enhanced 真实模块；Bridge 不可用时剪贴板降级路径完整落地（代码 + 类型 + 埋点 + 测试四位一体）。未发现新引入的阻断性问题，v1.0 功能边界仍然守住。可进入第 3 轮。

---

## 二、修复验证表

| 原问题 | 修复证据 | 验证结果 |
|---|---|---|
| **H1. UnifiedExportPipeline 是占位实现，未接真实导出逻辑** | `src/integration/export-pipeline.ts`：① 私有 `convertTreeToAxure`/`renderTreeToHtml` 占位方法已删除（git diff 该文件 215 行变更）；② `exportAxure()` 第 112 行直接调用 `exportToAxure()`，`stats` 真实透传 `fallbackNodes`/`skippedNodes`（第 124-131 行）；③ `exportHtml()` 第 186 行调用 `exportHtmlEnhanced()`，返回真实 Blob（`text/html`）；④ `exportImage()` 第 211 行调用 `exportImageEnhanced()`，enhanced 侧 `canvasToBlob` 明确 `image/png`、`exportToSvg` 明确 `image/svg+xml` MIME type（image-exporter.ts 第 274、299 行）；⑤ payloadSize 用 `TextEncoder` 字节数（第 115 行），中文场景不漏报 | ✅ **已修复**。三种格式全部接线，Axure JSON 含 widgetType/style/interactions，HTML 含真实渲染内容，图片 Blob MIME 正确，降级统计不再硬编码为 0 |
| **H2. 缺少 Bridge 不可用时的降级方案（剪贴板 + 手动粘贴引导）** | ① `exportAxure()` 第 106-110 行：`isAvailable()` 返回 false 时调用 `exportAxureFallbackClipboard()`；② 降级方法（第 138-182 行）：`exportToAxure` 序列化 → `navigator.clipboard.writeText` → 返回 `success: true, degraded: true, fallback: 'clipboard'`；③ 类型契约：`ExportResult` 新增 `degraded`/`fallback` 字段（types.ts 第 101-103 行）；④ 埋点：新增 `EXPORT_AXURE_FALLBACK_CLIPBOARD` 事件（events.ts 第 17 行，P0 优先级），降级时上报 component_count/page_count/payload_size/clipboard_success；⑤ 测试：`export-pipeline.test.ts` 覆盖 4 个场景（降级成功、bridgeClient 未配置、clipboard 不存在仍返回 degraded、clipboard 写入失败返回错误） | ✅ **已修复**。降级路径完整，埋点可观测降级率。唯一缺口：UI 层「请在 Axure RP 中 Ctrl+V 粘贴」的引导文案不在本仓库（属上层应用职责），代码层已提供 `degraded`/`fallback` 信号供 UI 消费，符合设计分层 |
| **M5（关联验证）. COMPONENT_MATRIX.md 缺失** | `openspec/changes/enhance-prototype-tool/COMPONENT_MATRIX.md` 已存在 | ✅ 已补齐（位置在 openspec change 目录而非仓库根，可接受） |
| **M1（关联验证）. 上游同步机制未实现** | `scripts/sync-upstream.sh` 已存在 | ✅ 已补齐脚本 |

---

## 三、新问题清单

### 🟡 中优先级（Medium）

#### N1. 集成层 `ExportOptions.axureOptions` 与 enhanced `AxureExportOptions` 类型不匹配（潜在运行时丢参）

- **位置**：`src/integration/types.ts` 第 87-91 行 vs `src/enhanced/export/types.ts` 的 `AxureExportOptions`
- **描述**：集成层定义 `axureOptions: { compress, includeInteractions, bridgeUrl }`，但 `exportAxure()` 第 112 行将其直接透传给 `exportToAxure()`，后者期望的是 enhanced 侧自己的 `AxureExportOptions`（含 `includeChildren`/`placeholderText` 等字段）。`compress`/`bridgeUrl` 对 `exportToAxure` 无意义会被忽略，而 enhanced 的 `placeholderText` 等选项从集成层无法传入。第 1 轮时这套类型就已存在（非本轮新引入），但修复接线后参数透传路径真正生效，类型错配从「死代码瑕疵」变成「活代码缺陷」。
- **风险**：调用方传 `axureOptions.compress: true` 预期压缩，实际无效；`placeholderText` 等合法选项无法从统一管道配置。中低概率踩坑。
- **建议**：集成层 `ExportOptions.axureOptions` 改为复用 enhanced 的 `AxureExportOptions` 类型（`import type`），删除自定义重复定义。

### 🟢 低优先级（Low）

#### N2. `exportImage` 集成层硬编码 `format: 'png'`，SVG 无法通过统一管道导出

- **位置**：`src/integration/export-pipeline.ts` 第 211-216 行
- **描述**：调用 `exportImageEnhanced` 时写死 `{ format: 'png', dpi: options.dpi ?? 2, background: 'white', range: 'full-page' }`，`ExportOptions` 中没有图片格式/背景/范围的配置入口（只有 `dpi`）。enhanced 的 `exportImage` 完整支持 PNG/SVG + 三种背景 + 范围选择，但统一管道只暴露了子集。
- **风险**：design.md 承诺「静态图片导出（PNG/SVG）」，经 UnifiedExportPipeline 走只能出 PNG。e2e 若用统一管道测 SVG 会缺入口。属功能口径收窄，不是错误。
- **建议**：`ExportOptions` 增加 `imageOptions?: Partial<ImageExportOptions>` 透传，或在文档中明确「统一管道 v1.0 仅 PNG，SVG 走 enhanced 直调」。

#### N3. 降级路径 `payloadSize` 用字符数而非字节数（与主路径不一致）

- **位置**：`src/integration/export-pipeline.ts` 第 179 行 `payloadSize: serialized.length`
- **描述**：主路径第 115 行已修正为 `TextEncoder` 字节数，但降级路径 stats 仍用 `serialized.length`（字符数）。中文原型场景字符数 ≠ 字节数，与修复注释「字节数而非字符数，中文场景不再漏报」的意图自相矛盾。
- **风险**：低（仅 stats 展示口径），但同一份结果两条路径口径不一，埋点分析时降级样本的 payload_size 偏小。
- **建议**：第 179 行改为 `new TextEncoder().encode(serialized).length`。

---

## 四、范围蔓延检查（复核）

✅ **无新增范围蔓延**：

- 全库检索 `undo|redo|drag|手动编辑|编辑画布`：0 命中（`src/enhanced/` 内）；
- 修复 commit（d0cebf8，50 文件）均为第 1 轮问题修复 + 测试补齐 + 安全加固，未引入 v1.0 排除项（无 .rp 生成、无多页面管理、无协作/云端功能）；
- 新增的 `EXPORT_AXURE_FALLBACK_CLIPBOARD` 埋点是 H2 修复的必要组成部分，不算蔓延；
- `src/server/analytics-track.ts`（新增 172 行）是埋点服务端路由，属 G5 埋点修复范围，可接受。

---

## 五、用户价值主链路复核

| 链路环节 | 第 1 轮状态 | 第 2 轮状态 |
|---|---|---|
| 组件树 → Axure 导出 | ⚠️ 链路断裂（占位实现） | ✅ 已接通，`exportToAxure` 真实调用，stats/warnings 透传 |
| Bridge 传输 → Axure RP | ✅ 但无降级 | ✅ 主路径 + 剪贴板降级双路径 |
| 组件树 → HTML 导出 | ⚠️ 链路断裂 | ✅ 已接通 `exportHtmlEnhanced`（含资源内联/交互脚本/XSS 防护） |
| 组件树 → 图片导出 | ❌ 返回 HTML Blob | ✅ 已接通 `exportImageEnhanced`，PNG/SVG 真实渲染，MIME 正确 |

**结论：「AI 生成 → Axure 可编辑导出 → 多模式预览」主链路已从「零件合格、整车无法启动」修复为端到端可用。**

---

## 六、是否可进入第 3 轮

**可以进入第 3 轮（无前置阻断条件）。**

第 3 轮建议关注：

1. **N1-N3 可在第 3 轮前顺手修复**（均为小改动，不阻断流程）；N1（类型不匹配）建议优先，因其影响 `exportToAxure` 的真实行为；
2. 第 3 轮基于真实 e2e 产物验收「成功标准」：Axure JSON 可编辑率抽检（基础组件 100%/表单 90%+/布局 80%+）、HTML ≤5MB、导出 ≤5s；
3. 剪贴板降级的 UI 引导文案（「请在 Axure RP 中 Ctrl+V 粘贴」）需在上层应用侧确认已消费 `degraded`/`fallback` 信号——这超出本仓库代码范围，建议在第 3 轮由 PM 向应用侧确认交付物清单。

---

*报告完。审查依据文件：src/integration/export-pipeline.ts、src/integration/adapter.ts、src/integration/types.ts、src/integration/export-pipeline.test.ts、src/enhanced/export/export-pipeline.ts、src/enhanced/preview/html-exporter.ts、src/enhanced/preview/image-exporter.ts、src/enhanced/analytics/events.ts、git commit d0cebf8（diff e12e7a7..d0cebf8）。*
