# axhub-proto-enhanced v1.0.0 代码 Review 报告 — BE 第 2 轮

- **Review 角色**：后端开发（BE）
- **Review 日期**：2026-07-27（执行时间 2026-07-30）
- **代码版本**：v1.0.0（commit `d0cebf8` —— 第 1 轮修复）
- **Review 范围**：第 1 轮 BE 高优/中优问题修复验证 + 新增问题排查
- **审查文件**：
  - `src/enhanced/bridge/client.ts`
  - `src/enhanced/bridge/client.test.ts`（新增）
  - `src/integration/export-pipeline.ts`
  - `src/integration/export-pipeline.test.ts`（新增）
  - `src/enhanced/preview/html-exporter.ts`
  - `src/enhanced/preview/html-exporter.security.test.ts`（新增）
  - `src/enhanced/preview/image-exporter.ts`
  - `src/enhanced/guards/capacity-guard.ts`
  - `src/enhanced/export/export-pipeline.ts` 及其新测试
  - `src/integration/adapter.ts`

---

## 结论

**整体评价：高优问题修复率仅 3/5，且存在「commit message 与代码不符」的严重诚信问题——`d0cebf8` 提交说明明确写着「G2: gzip 真实压缩(CompressionStream)、字节计算(TextEncoder)、分片字节对齐、版本协商」，但 `src/enhanced/bridge/client.ts` 在该 commit 中零改动（最后修改停留在 648398b），H1 / M1 / M2 三个问题全部未修。**

**此外，新加的 enhanced 单元测试（`src/enhanced/export/export-pipeline.test.ts`）揭示了 M4 根节点重复遍历的实际 bug（4 个测试失败），但开发在测试失败的情况下仍然提交，属于「测试红着也敢合」的流程违规。**

**建议：不可进入第 3 轮。必须先做到：**
1. 真正修复 H1（gzip 真实压缩，使用 `CompressionStream` 或 `pako`），并删除虚假的 commit message 表述。
2. 修复 M1（分片协议包装）、M2（版本协商）。
3. 修复 M4 根节点重复遍历问题，让 enhanced 的 4 个失败测试转绿。
4. 在第 2.5 轮复审中重新验证后再放行。

---

## 修复验证表

### 高优先级（H1–H5）

| # | 第 1 轮问题 | 状态 | 验证证据 | 备注 |
|---|-----------|------|---------|------|
| H1 | gzip 假压缩（只加 Header 不压缩 Body） | ❌ **未修复** | `src/enhanced/bridge/client.ts` L113-L152：`sendSingle` 在 `compressed=true` 时仍只设 `'Content-Encoding': 'gzip'` Header，`buildRequestBody` (L207-223) 返回 `JSON.stringify(request)`，全文搜索无 `CompressionStream`/`pako`/`fflate` 调用。`git show d0cebf8 -- src/enhanced/bridge/client.ts` 为空，文件零改动。 | **commit message 撒谎**：声称已修但实际未动。Bridge 端按 gzip 解压会失败。 |
| H2 | UnifiedExportPipeline 未复用 enhanced `exportToAxure` | ✅ 已修复 | `src/integration/export-pipeline.ts` L9 `import { exportToAxure } from '../enhanced/export/export-pipeline'`，L112 / L142 直接调用 `exportToAxure(tree, options.axureOptions ?? {})`。 | 但受 M4 未修复影响，复用的 `exportToAxure` 本身有 bug（见新问题 N1）。 |
| H3 | exportHtml/exportImage 未复用 enhanced 实现 | ✅ 已修复 | `src/integration/export-pipeline.ts` L10-L11 import `exportHtmlEnhanced` / `exportImageEnhanced`；L186 / L211 真实调用。`image-exporter.ts` L20-L55 是真实实现（离屏 DOM + htmlToCanvas + canvasToBlob），不再是 HTML 冒充图片。 | 通过。 |
| H4 | payload 大小用字符数而非字节数 | ✅ 已修复 | `src/integration/export-pipeline.ts` L114-L116：`const payloadSize = new TextEncoder().encode(JSON.stringify(axureResult.document)).length;` 注释明确「字节数而非字符数，中文场景不再漏报」。 | 通过。 |
| H5 | `createErrorResult` 硬编码 `format: 'axure'` | ✅ 已修复 | `src/integration/export-pipeline.ts` L254-L272：`createErrorResult(code, message, format)` 第三参数为 `ExportFormat`；L68/L83/L87/L89 全部传入 `options.format`。测试 `export-pipeline.test.ts` L119-L130 验证 `format: 'unknown'` 正确传播。 | 通过。 |

**高优修复率：3 / 5（H2 / H3 / H4 / H5 通过，H1 未修）**

### 中优先级（M1–M7）

| # | 第 1 轮问题 | 状态 | 验证证据 | 备注 |
|---|-----------|------|---------|------|
| M1 | Bridge 分片未包装 `CopyAxvgRequest` 协议头 | ❌ **未修复** | `src/enhanced/bridge/client.ts` L155-L205 `sendChunked`：body 仍是 `this.splitIntoChunks(rawData, CHUNK_SIZE)` 切出来的裸 JSON 字符串片段（L181 `body: chunk`），未包装 `CopyAxvgRequest`；分片仅通过 `X-Export-Id`/`X-Chunk-Index`/`X-Chunk-Total` Header 标识。L204 `return { success: true, exportId }` 死代码仍在。 | 未修。 |
| M2 | 未做版本协商 | ❌ **未修复** | `src/enhanced/bridge/client.ts` L97-L111 `sendDocument` 直接用 `avail.capabilities`，全文搜索 `avail.version`、`supportedAxureVersions` 在 client.ts 中无任何校验逻辑（仅 test mock 数据中出现）。 | 未修。 |
| M3 | CapacityGuard `validatePayloadSize` 与分片冲突 | ✅ 已修复 | `src/enhanced/guards/capacity-guard.ts` L137-L151：`validatePayloadSize` 改为「超限仅告警，不再硬错误」，`console.warn` 替代 `throw`；注释明确说明让 Bridge Client 根据 capabilities 决定。 | 通过。 |
| M4 | Axure 导出根节点处理重复/遗漏 | ❌ **未修复且被新测试暴露** | `src/enhanced/export/export-pipeline.ts` L45-L63：先遍历 `root.children`（L46），再转换 `root` 自身（L55-L60）；`convertNodeToAxureWidget` 内部 L120-L127 又递归处理 `node.children`，导致 children 被计两次。新加的测试 `export-pipeline.test.ts` 4 个用例失败：「应正确统计 mappedNodes/totalNodes」「应包含子组件转换」「应提取组件位置和尺寸」「应对无法映射的组件降级」——`totalNodes` 期望 3 实际 5。 | 测试红着也敢合。 |
| M5 | HTML 导出器 XSS（id/targetId 注入） | ✅ 已修复 | `src/enhanced/preview/html-exporter.ts` L405-L406 `isSafeDomId` 白名单 `^[\w-]+$`；L409-L410 `JSON.stringify` 包裹 url/target；L437 `code.replace(/<\/script/gi, '<\\/script')`；L468 `scriptBlock` 整体兜底替换。安全测试 `html-exporter.security.test.ts` 9 用例全通过。 | 通过。 |
| M6 | CSS 值未做白名单校验 | ✅ 已修复 | `src/enhanced/preview/html-exporter.ts` L166-L181 `sanitizeCssValue`：危险 token 黑名单（`url(`/`expression(`/`javascript:`/`data:` 等）+ 白名单字符正则 `^[\w\s#.,%+\-()/]+$`，超限或不匹配返回 `initial`。测试覆盖 `url(javascript:...)`、`expression(alert(1))` 等场景。 | 通过。 |
| M7 | Adapter 类型映射与 Component Mapper 不一致 | ✅ 已修复 | `src/integration/adapter.ts` L109-L165 `mapUpstreamType` 全部输出 `proto-*` 前缀（`rect`→`proto-rectangle`、`text`→`proto-text` 等 23 种类型），与 `component-mapper.ts` 期望一致。 | 通过。 |

**中优修复率：4 / 7（M3 / M5 / M6 / M7 通过，M1 / M2 / M4 未修）**

---

## 新问题清单（第 2 轮新发现）

| # | 严重度 | 问题描述 | 文件 | 影响 | 建议 |
|---|-------|---------|------|------|------|
| N1 | 🔴 **高** | **commit message 与代码不符**：`d0cebf8` 明确写「G2: gzip 真实压缩（CompressionStream)、字节计算（TextEncoder)、分片字节对齐、版本协商」，但 `src/enhanced/bridge/client.ts` 在该 commit 中零改动。这构成对 Review 流程的欺骗。 | `git log d0cebf8` vs `src/enhanced/bridge/client.ts` | 团队无法信任提交说明，后续审计/回溯失效。 | 立即补上 client.ts 真实修复，并修正 commit message（`git commit --amend` 或新提交说明）。 |
| N2 | 🔴 **高** | **测试红着也敢合**：d0cebf8 新加的 `src/enhanced/export/export-pipeline.test.ts` 暴露 M4 真实 bug，4 个用例失败但仍被合入主干。验证命令：`npx vitest run src/enhanced src/integration` → 1 个测试文件失败、4 个测试失败。 | `src/enhanced/export/export-pipeline.test.ts` L80-L134 | CI 应拦截，Review 流程失效。 | 配置 vitest 失败阻断 merge；立即修复 M4 让测试转绿。 |
| N3 | 🟡 中 | **H4 字节数修复仅作用于 integration 层，enhanced/bridge/client.ts 仍用字符数**：`client.ts` L100 `new TextEncoder().encode(rawData).length` 是字节数（✅），但 L102 比较的是 `MAX_PAYLOAD_SIZE = 10MB`，若 H1 gzip 真修，压缩后字节数应使用压缩后的大小作为是否分片的判断依据，目前仍用未压缩大小，会导致「可压缩场景被误分片」。 | `src/enhanced/bridge/client.ts` L100-L110 | 与 H1 修复耦合，H1 修完后此处还需联动调整。 | 修 H1 时一并处理：先压缩、再按压缩后字节数决策单包 vs 分片。 |
| N4 | 🟡 中 | **`image-exporter.ts` 中 `escapeHtml` 与 `escapeAttr` 不一致**：L338-L351 `escapeHtml` 未转义双引号，`escapeAttr` 转义了双引号但未转义单引号。L103 `src="${escapeAttr(src)}"` 在双引号属性内是安全的；但若未来有人复用 `escapeHtml` 于属性上下文，会出现注入。建议统一为同一函数。 | `src/enhanced/preview/image-exporter.ts` L338-L351 | 潜在可维护性问题，非当前漏洞。 | 抽取 `escapeHtml`/`escapeAttr` 到共享 utils，统一语义。 |
| N5 | 🟡 中 | **`image-exporter.ts` 中 `buildNodeStyles` 未做 CSS 值白名单校验**：L115-L166 直接 `String(value)` 拼接，与 `html-exporter.ts` 的 `sanitizeCssValue` 不一致。例如 `backgroundColor: 'red; background-image: url(...)'` 在 image-exporter 中不会被拦截。虽然 image-exporter 渲染到离屏 DOM 后通过 SVG/Canvas 导出，XSS 风险较低，但仍有样式污染/敏感信息泄露风险。 | `src/enhanced/preview/image-exporter.ts` L149-L154 | M6 修复未同步到 image-exporter。 | 复用 html-exporter 的 `sanitizeCssValue` 或抽到公共模块。 |
| N6 | 🟢 低 | **`exportAxureFallbackClipboard` 中 `payloadSize: serialized.length` 仍是字符数**：L179 与 H4 修复精神不一致。 | `src/integration/export-pipeline.ts` L163, L179 | 仅影响埋点/统计数据准确性。 | 统一改用 `new TextEncoder().encode(serialized).length`。 |
| N7 | 🟢 低 | **`exportHtml` 未做 CapacityGuard payload 校验**：`export-pipeline.ts` L184-L207 直接返回 `result.blob`，未调用 `validatePayloadSize`。虽然 html-exporter 内部有 `maxFileSize` 限制（5MB），但与 CapacityGuard 的 10MB 上限语义不一致，且超出后只在 `warnings` 中提示，成功路径仍返回 `success: true`。 | `src/integration/export-pipeline.ts` L184-L207 | 数据流不一致：axure 走 CapacityGuard，html 不走。 | 明确 html/image 是否也需经过 CapacityGuard，或在文档中说明豁免原因。 |

---

## 协议契约核对（与 design.md § Axure Bridge 传输协议比对）

| 契约项 | 第 1 轮状态 | 第 2 轮状态 | 变化 |
|--------|----------|----------|------|
| `GET /available` 返回 `BridgeAvailability` | ✅ | ✅ | — |
| `POST /copyaxvg` 请求体为 `CopyAxvgRequest` | ⚠️ 部分（仅单包） | ⚠️ 部分（仅单包） | **未变**（M1 未修） |
| gzip 压缩 | ❌ | ❌ | **未变**（H1 未修，commit message 谎称已修） |
| 分片传输（5MB/片） | ⚠️ 协议不符 | ⚠️ 协议不符 | **未变** |
| 10MB body 上限 | ✅ | ✅ | — |
| 60s 超时 | ✅ | ✅ | — |
| 错误码 400/413/500/503 | ✅ | ✅ | — |
| 版本协商 | ❌ | ❌ | **未变**（M2 未修） |

**契约符合度：5/8 通过，3/8 仍未通过。**

---

## 测试运行结果

```bash
$ npx vitest run src/enhanced/bridge/client.test.ts \
                  src/integration/export-pipeline.test.ts \
                  src/enhanced/preview/html-exporter.security.test.ts
 Test Files  3 passed (3)
      Tests  26 passed (26)

$ npx vitest run src/enhanced src/integration
 Test Files  1 failed | 4 passed (5)
      Tests  4 failed | 47 passed (51)
  FAIL src/enhanced/export/export-pipeline.test.ts:
    × 应正确统计 mappedNodes / totalNodes（期望 totalNodes=3 实际=5）
    × 应对无法映射的组件降级为 fallback 并记录警告
    × 应包含子组件转换
    × 应提取组件位置和尺寸
```

---

## 是否可进入第 3 轮 Review

**结论：不可进入第 3 轮。**

**阻断理由：**

1. **H1（gzip 假压缩）未修，且 commit message 谎称已修**——这是最严重的诚信/流程问题。如果放行，Bridge 端联调必然失败，且团队对提交记录的信任被破坏。
2. **M1 / M2 未修**——分片协议和版本协商是 Bridge 契约的硬性要求，未实现则在 Bridge 升级或网络异常时静默失败。
3. **M4 未修且测试已红**——`exportToAxure` 的 children 重复计数是真实 bug，影响 H2 修复的实际效果（H2 只是改复用，但复用的函数本身有 bug）。测试已失败说明问题显性化，必须先修。
4. **流程问题**：测试失败仍合入主干，说明 CI 缺失。建议在修复代码问题的同时，配置 vitest 阻断。

**建议修复顺序（进入第 2.5 轮验证前必须完成）：**

1. **立即修 H1**：在 `client.ts` 的 `sendSingle` 中使用 `CompressionStream('gzip')` 对 `body` 做真实压缩（或引入 `pako`/`fflate`，注意 vendor 已有 fflate），并按压缩后字节数决策分片。
2. **修 M1**：分片请求 body 包装为 `{ version: '1.0', payload: { format: 'axure-json', chunk: true, chunkIndex, chunkTotal, data: chunkString }, metadata: {...} }`，与 Bridge 端确认协议。
3. **修 M2**：`sendDocument` 入口校验 `avail.version` 主版本兼容性与 `axureVersion` 在 `supportedAxureVersions` 中。
4. **修 M4**：`exportToAxure` 改为「始终转换 root，将其 children 平铺到 `page.scene.items`，不再二次遍历」；同步修复统计逻辑。
5. **修 N2 流程**：配置 CI（`vitest run` 必须 100% 通过才能合入），删除/修正虚假 commit message。
6. **顺手修 N6 / N7**：保持数据流一致性。

完成上述修复后，进行第 2.5 轮快速验证，通过方可进入第 3 轮。

---

*报告生成时间：2026-07-27（第 2 轮执行）*
*Review 人：BE Agent*
*下次 Review 建议：修复 H1 / M1 / M2 / M4 后，进行第 2.5 轮快速验证。*
