# axhub-proto-enhanced v1.0.0 代码 Review — BE 第 3 轮（最终确认）

- **Reviewer**：BE
- **日期**：2026-07-27（重跑于 2026-07-30，此前因 API 429 失败）
- **范围**：第 1 轮 BE 高优 H1–H5 最终确认 + 第 2 轮 N1/N2/N3/分片切分确认 + 第 3 轮修复（埋点接入、prompt 脱敏）回归检查
- **HEAD**：`d23d6df fix: 代码 Review 第 3 轮修复（OPS H1-H4 + FE N7）`

---

## 结论

**不通过（2 项阻塞），暂不可进入 Phase 4。**

第 1 轮 H1/H2/H3/H5 与第 2 轮 N1/分片字节切分确认真正修复 ✅。但存在两个阻塞问题：

1. **B1（第 2 轮 N2 修复不彻底，高优遗留）**：`exportToAxure` 的 stats 双重计数只修了一半——根节点 `skipCount=true` 仅跳过根节点自身计数，但根节点转换时仍会递归 `root.children`，对每个子节点二次计数、二次转换。实测 `totalNodes = 4`（期望 3），对应单元测试仍红。文档结构不受影响，但 `mappedNodes/fallbackNodes/warnings` 均翻倍，且直接污染第 3 轮新接入的 `export_axure_success` 埋点数据（component_count 虚高）。
2. **B2（第 3 轮修复新引入，回归）**：`src/enhanced/index.ts` 模块顶层裸调 `localStorage.getItem('app_visited')`（无 `typeof localStorage !== 'undefined'` 防护），Node/SSR 环境下 `import 'src/enhanced'` 立即抛 `ReferenceError`。已实测复现。同时模块顶层副作用（import 即上报 `app_open`）本身是反模式。

另有 1 项中优（H4 修复遗漏 fallback 路径）与 3 处测试与实现不同步需一并处理。

---

## 阻塞验证表

| # | 问题 | 轮次/来源 | 验证方式 | 结果 | 状态 |
|---|------|-----------|----------|------|------|
| H1/N1 | gzip 真实压缩 | R1 高优 / R2 N1 | 读 `src/enhanced/bridge/client.ts:130-135`（d2a364a） | `new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'))` 真实压缩 body，正确设置 `Content-Encoding: gzip`，不再只加 header | ✅ 已修复 |
| H2 | UnifiedExportPipeline 复用 enhanced 导出 | R1 高优 | 读 `src/integration/export-pipeline.ts:9-11` | 直接复用 `exportToAxure`（enhanced/export）、`exportHtmlEnhanced`（html-exporter）、`exportImageEnhanced`（image-exporter），无重复实现 | ✅ 已修复 |
| H3 | exportHtml/exportImage 真实实现 | R1 高优 | 读 `html-exporter.ts`（548 行，真实渲染 + 资源内联 + 交互注入）、`image-exporter.ts`（351 行，离屏 DOM + html-to-image PNG/SVG） | 均为真实实现；`supportsFormat('image') === true` | ✅ 已修复 |
| H4 | payload 字节数而非字符数 | R1 高优 | 读 `integration/export-pipeline.ts:115` vs `:179` | 主路径 `new TextEncoder().encode(JSON.stringify(doc)).length` ✅；**fallback 路径 `payloadSize: serialized.length`（line 179）及埋点（line 163）仍是字符数**，中文场景漏报在降级路径仍存在 | ⚠️ 部分修复（中优遗留） |
| H5 | createErrorResult 携带 format | R1 高优 | 读 `integration/export-pipeline.ts:254-272` | `createErrorResult(code, message, format)` 签名带 format，全部 6 处调用点均传入 `options.format` | ✅ 已修复 |
| **B1** | exportToAxure 双重计数 | R2 N2 | 读 `enhanced/export/export-pipeline.ts:53-73` + 跑 `vitest run src/enhanced/export/export-pipeline.test.ts` | `skipCount=true` 只挡根节点自身；`convertNodeToAxureWidget(root, …, true)` 内部仍递归 `root.children`（line 146-153，skipCount 默认 false）→ 子节点二次计数 + 二次转换。实测 `totalNodes=4`（期望 3），`mappedNodes` 同为 4，warnings 重复；测试 `应正确统计 mappedNodes/totalNodes`、`应对无法映射的组件降级` 仍失败 | ❌ **未修彻底（阻塞）** |
| 分片 | splitIntoChunks 按字节切分 | R2 | 读 `client.ts:244-256` | TextEncoder 编码 → 按字节 slice → `TextDecoder('utf-8', {fatal:false})` + `{stream:true}` 流式解码，不会切断多字节 UTF-8 字符 | ✅ 已修复 |
| N3 | image 格式测试对齐 | R2 N3 | 读 `tests/e2e/export.ci.test.ts:209-213, 244-249` | `supportsFormat('image')===true` 断言已更新 ✅；但遗留 `应拒绝不支持的格式`（`format: 'image' as any` 期望 `FORMAT_NOT_SUPPORTED`）语义已失效，现失败（收到 `UNKNOWN`） | ⚠️ 测试遗留（非阻塞） |
| R3-埋点 | exportToAxure 全链路埋点 | R3 OPS H1 | 读 `enhanced/export/export-pipeline.ts:36-39, 88-93, 97-99` | start/success/fail 三处均已接入 | ✅（但 success 埋点数据受 B1 污染） |
| R3-脱敏 | prompt_text 强制脱敏 | R3 OPS H2 | 读 `analytics/tracker.ts:65-69` + `utils/prompt-sanitizer.ts` | `track()` 自动对 `prompt_text` 执行 `sanitizePrompt`（哈希前缀 + 50 字符截断），双保险成立 | ✅ 已接线 |
| R3-optout | setEnabled/optOut | R3 OPS H4 | 读 `tracker.ts:91-107` | 实现正确，optOut 清空队列并清 localStorage | ✅ |
| **B2** | enhanced 入口 SSR 安全 | R3 新引入 | 读 `src/enhanced/index.ts:36-42` + 实测 Node 环境 import | 模块顶层 `localStorage.getItem` 无环境防护，Node/SSR 下 import 即 `ReferenceError`（已实测复现）；import 即上报 `app_open` 属副作用反模式 | ❌ **新问题（阻塞）** |

---

## 测试现状（`npx vitest run` 全量）

**299 个测试文件，2858 个用例：11 failed / 2836 passed / 11 skipped。** 与 enhanced 导出链路相关的失败：

| 失败用例 | 性质 | 处置建议 |
|---|---|---|
| `export-pipeline.test.ts` 应正确统计 mappedNodes/totalNodes 等 2 个 | **B1 直接证据**（实测 totalNodes=4≠3）。注：该文件 4 个失败在 d0cebf8（R1 修复）时即存在，属预存失败，但 N2 声称修复后仍红，说明修复未验证 | 修 B1：根节点转换时传 `includeChildren:false`，或跳过整个根节点二次转换 |
| `export-pipeline.test.ts` 应包含子组件转换 / 应提取组件位置和尺寸 2 个 | 预存失败（测试期望 root 为 items[0]，实现是 children 平铺）——测试与设计意图不一致，需明确设计后二选一 | 与 B1 一并确认设计意图后修正 |
| `export.ci.test.ts` 应拒绝不支持的格式 | N3 遗留失效断言 | 改用真正非法格式（如 `'pdf' as any`）或删除该用例 |
| `export.ci.test.ts` validateTree/validatePayloadSize 应在超限时抛出 CapacityError 2 个 | 测试与实现不同步：`toThrow('CapacityError')` 匹配的是 message 而非 `error.name`；`validatePayloadSize` 已改为仅告警（有注释说明理由，属有意设计） | 更新断言为 `error.name === 'CapacityError'` / 改为断言 console.warn |
| `export.local.test.ts` Bridge 不可用 1 个、server 侧 2 个 | 真实 Bridge 依赖 / Node 24 NODE_OPTIONS 环境问题，与本轮修复无关 | 不阻塞 |

---

## 修复建议（进入 Phase 4 前必须完成）

**B1 — `src/enhanced/export/export-pipeline.ts`**：根节点二次转换时禁止递归 children：

```ts
const rootWidget = await convertNodeToAxureWidget(
  componentTree.root, warnings, stats,
  { ...options, includeChildren: false }, // children 已在上方遍历
  true,
);
```

修完后 `export-pipeline.test.ts` 的 stats 断言应转绿（mappedNodes/totalNodes = 3）。

**B2 — `src/enhanced/index.ts`**：加环境防护并消除顶层副作用，建议改为显式初始化函数：

```ts
export function initAnalytics(): void {
  if (typeof localStorage === 'undefined') return;
  const isFirstVisit = !localStorage.getItem('app_visited');
  tracker.track(AnalyticsEvents.APP_OPEN, { first_visit: isFirstVisit });
  if (isFirstVisit) localStorage.setItem('app_visited', 'true');
}
```

**中优（建议同轮带走）**：
- H4 遗留：`exportAxureFallbackClipboard` 的 `payloadSize` 与埋点 `payload_size` 改用 `new TextEncoder().encode(serialized).length`。
- N3 遗留：更新/删除 `应拒绝不支持的格式` 失效用例。
- 容量守卫 2 个测试断言与实现对齐。

---

## 是否可进入 Phase 4

**否。** B1（高优修复不彻底 + 埋点数据失真）与 B2（R3 新引入的 import 崩溃回归）均为阻塞级。两项修复量都很小（各约 5 行），修复 + 相关测试转绿后可快速复核放行。其余 ✅ 项（H1/H2/H3/H5、N1、分片字节切分、prompt 脱敏、opt-out）确认无问题。
