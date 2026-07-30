# axhub-proto-enhanced v1.0.0 代码 Review 报告 — BE 第 1 轮

- **Review 角色**：后端开发（BE）
- **Review 日期**：2026-07-27
- **代码版本**：v1.0.0
- **Review 范围**：Bridge 客户端协议、导出管线数据流、错误处理与降级策略、数据一致性、安全性
- **审查文件**：
  - `src/enhanced/bridge/client.ts`
  - `src/enhanced/export/export-pipeline.ts`
  - `src/enhanced/export/axure-mapper.ts`
  - `src/enhanced/export/component-mapper.ts`
  - `src/enhanced/guards/capacity-guard.ts`
  - `src/enhanced/preview/html-exporter.ts`
  - `src/integration/export-pipeline.ts`
  - `src/integration/adapter.ts`
  - `openspec/changes/enhance-prototype-tool/design.md`（Bridge 协议契约核对）

---

## 结论

**整体评价：架构清晰，核心模块职责分离良好，但存在多处关键实现缺陷，特别是统一导出管线（`src/integration/export-pipeline.ts`）几乎未复用 enhanced 层的成熟实现，导致数据流不一致、统计信息失真、HTML/Axure 导出逻辑两套并行。**

**建议：当前代码存在高优先级阻断问题，不可直接进入第 2 轮 Review。需先修复高优先级问题，特别是统一导出管线的实现。**

---

## 问题清单

### 高优先级（High）— 阻断发布

| # | 问题描述 | 文件 | 影响 | 建议修复 |
|---|---------|------|------|---------|
| H1 | **gzip 压缩未真正执行，但声明了压缩头** | `src/enhanced/bridge/client.ts` L113-L152 | `sendSingle` 在 `avail.capabilities.compression = true` 时，仅在 HTTP Header 加了 `Content-Encoding: gzip`，但 `body` 仍是原始 JSON 字符串（`buildRequestBody` 返回 `JSON.stringify(request)`）。Bridge 端若按 gzip 解压会失败；若不检查 Header，则 Header 与 Body 不一致，导致协议层数据不一致。 | 使用 `CompressionStream('gzip')` 或 `fflate` 等库对 body 做真实 gzip 压缩，或在不压缩时移除 `Content-Encoding` 头。 |
| H2 | **统一导出管线 `exportAxure` 未使用 enhanced 导出管线，导致样式/交互/降级全部丢失** | `src/integration/export-pipeline.ts` L148-L174 | `convertTreeToAxure` 自行实现节点转换，仅拷贝 `id/type/name/position/size`，完全未调用 `exportToAxure` 或 `convertNodeToAxureWidget`，也未调用 `axure-mapper.ts` 的 `convertStyles`。结果：所有 CSS 样式、组件类型映射（如 `proto-button` → `button`）、降级策略、交互事件全部丢失，导出的 Axure JSON 是“空壳”。 | 直接复用 `src/enhanced/export/export-pipeline.ts` 的 `exportToAxure()`，删除 `UnifiedExportPipeline.convertTreeToAxure`。 |
| H3 | **统一导出管线 `exportHtml`/`exportImage` 未使用 enhanced HTML 导出器，功能严重退化** | `src/integration/export-pipeline.ts` L112-L146, L176-L188 | `renderTreeToHtml` 仅输出 `<div data-component="..." id="...">${children}</div>`，未内联资源、未注入交互脚本、未处理图片/字体、未使用 `html-exporter.ts` 的完整实现。Image 导出甚至直接返回 HTML Blob 冒充图片。 | 复用 `src/enhanced/preview/html-exporter.ts` 的 `exportHtml()`；Image 导出需接入 `image-exporter.ts`（若已实现）或明确标记为未实现。 |
| H4 | **`exportAxure` 中 payload 大小检查使用字符串长度而非字节长度，且未考虑 gzip 压缩收益** | `src/integration/export-pipeline.ts` L92-L93 | `JSON.stringify(axureDoc).length` 是字符数，非字节数（UTF-8 中文占 3 字节），可能漏报超限。同时，若 Bridge 支持 gzip，压缩后可能远低于 10MB，但此处直接拒绝，导致可压缩场景被误杀。 | 使用 `new TextEncoder().encode(str).length` 计算字节数；将大小检查移至 Bridge Client 内部（已在 `client.ts` 中按字节检查），或在此处也按字节检查。 |
| H5 | **错误码硬编码 `format: 'axure'` 导致非 Axure 导出错误时元数据错误** | `src/integration/export-pipeline.ts` L204-L217 | `createErrorResult` 固定返回 `format: 'axure'`，当 HTML/Image 导出失败时，返回的 `ExportResult.format` 也是 `axure`，调用方无法区分。 | 将 `format` 作为参数传入 `createErrorResult`。 |

### 中优先级（Medium）— 需尽快修复

| # | 问题描述 | 文件 | 影响 | 建议修复 |
|---|---------|------|------|---------|
| M1 | **Bridge 分片传输逻辑存在协议与实现不一致** | `src/enhanced/bridge/client.ts` L155-L205 | ① 分片 Body 是 `rawData` 的切片（纯 JSON 字符串），但 `Content-Type` 仍标为 `application/json`，且未包装 `CopyAxvgRequest` 协议头；② 分片时未携带 `version`/`metadata` 等协议字段，Bridge 端无法识别分片归属；③ 非最后一个分片不解析响应，若 Bridge 在中间分片返回业务错误（如 400），会被捕获为 `BridgeError`，但无法区分是协议错误还是分片内容错误；④ 分片循环结束后 fallback `return { success: true, exportId }` 在逻辑上不可达（因为 `isLast` 时必然 return），但代码可读性差。 | 与 Bridge 端确认分片协议：是否每个分片仍需包裹 `CopyAxvgRequest`？建议每个分片携带完整协议头 + `chunk` 字段，或改用二进制分片协议。至少确保 `exportId` 在请求间一致，且 Bridge 端能重组。 |
| M2 | **Bridge 客户端未实现版本协商，仅缓存 availability** | `src/enhanced/bridge/client.ts` L70-L95, L97-L111 | `getAvailability` 获取了 `version` 和 `supportedAxureVersions`，但 `sendDocument` 中未检查客户端协议版本（`'1.0'`）与 Bridge 版本是否兼容，也未检查 Axure 版本是否在支持列表内。若 Bridge 升级协议，客户端可能静默失败。 | 在 `sendDocument` 前增加版本协商：若 `avail.version` 主版本 > 客户端支持版本，抛出明确错误；若 `axureVersion` 不在 `supportedAxureVersions` 中，给出警告或降级提示。 |
| M3 | **CapacityGuard 的 `validatePayloadSize` 与 Bridge 10MB 上限耦合，但未考虑分片场景** | `src/enhanced/guards/capacity-guard.ts` L124-L128 | `maxPayloadSize` 固定 10MB，当 payload > 10MB 时直接抛错。但 Bridge 支持分片（`chunkedTransfer`），理论上可传输 >10MB 的内容（受内存和 60s 超时限制）。此处与 `client.ts` 中“超过 10MB 且支持分片则走分片”的逻辑冲突，导致分片能力被 CapacityGuard 提前拦截。 | 移除 `CapacityGuard.validatePayloadSize` 中的硬上限，或将其改为“警告”而非“错误”；让 Bridge Client 根据 capabilities 决定是否分片。若保留硬上限，需确保与 `client.ts` 的 `MAX_PAYLOAD_SIZE` 语义一致（单包上限 vs 总上限）。 |
| M4 | **Axure 导出管线根节点处理逻辑有潜在重复/遗漏** | `src/enhanced/export/export-pipeline.ts` L44-L63 | 先遍历 `root.children` 转换子节点，若 `root` 本身有内容（`items.length === 0`）再转换 `root`。若 `root` 有 children 且自身也有视觉属性（如背景色），root 会被完全忽略，导致根节点样式丢失。 | 明确根节点语义：若根节点是画布/页面容器，应始终作为 `AxureWidget` 导出（或至少导出其样式到页面背景）；若根节点是虚拟容器，则不应进入 `items`。建议统一处理：始终转换 `root`，并将其 children 平铺到 `page.scene.items`。 |
| M5 | **HTML 导出器 XSS 防护不完整：`<script>` 注入风险** | `src/enhanced/preview/html-exporter.ts` L297-L323 | `generateInteractionCode` 中 `nodeId` 和 `targetId` 直接拼接进 `document.querySelector('[data-component-id="${nodeId}"]')`，若 `nodeId` 包含 `"` 或 `]`，可导致选择器逃逸甚至脚本注入。虽然 `escapeJs` 处理了 `'` 和 `\`，但未处理 `"`（在双引号字符串中）和 `</script>` 闭合标签。 | 使用 `CSS.escape(nodeId)` 或 JSON.stringify 包裹 ID；对拼接进 `<script>` 块的所有动态值做 `</script>` 转义（如 `<\/script>`）。 |
| M6 | **HTML 导出器 `buildInlineStyles` 未转义 CSS 值，可注入恶意样式** | `src/enhanced/preview/html-exporter.ts` L103-L148 | `props.backgroundColor` 等值直接拼接到 `style="..."`，若值为 `red; background-image: url(javascript:...)` 或 `expression(...)`，可导致 XSS。虽然现代浏览器对 `javascript:` in CSS 限制较多，但 `url(data:image/svg+xml;base64,...)` 仍可用于 XSS。 | 对 CSS 值做白名单校验（颜色、长度、枚举值），拒绝包含 `url(`、`expression(`、`javascript:` 的值；或对值做 HTML 属性转义（`"` → `&quot;`）。 |
| M7 | **Adapter 类型映射与 Component Mapper 不一致** | `src/integration/adapter.ts` L109-L135 vs `src/enhanced/export/component-mapper.ts` | Adapter 将上游 `rect` 映射为 `rectangle`，`text` → `text`，但 `component-mapper.ts` 期望的输入类型是 `proto-rectangle`、`proto-text` 等。若 Adapter 输出直接喂给导出管线，组件类型无法匹配，全部走 fallback。 | 统一类型命名：Adapter 应输出 `proto-*` 前缀，或 Component Mapper 应兼容无前缀类型。建议 Adapter 增加 `proto-` 前缀以匹配 enhanced 层约定。 |

### 低优先级（Low）— 可延后修复

| # | 问题描述 | 文件 | 影响 | 建议修复 |
|---|---------|------|------|---------|
| L1 | **`parseNumericValue` 与 `parsePixelValue` 重复实现** | `src/enhanced/export/export-pipeline.ts` L293-L300 vs `src/enhanced/export/axure-mapper.ts` L11-L18 | 两处解析逻辑完全一致（支持 px/rem/em），代码重复，后续维护易不同步。 | 复用 `axure-mapper.ts` 中的 `parsePixelValue`，删除 `export-pipeline.ts` 中的 `parseNumericValue`。 |
| L2 | **`extractPosition` 默认读取 `style.left/top`，但 Adapter 未保证 style 存在** | `src/enhanced/export/export-pipeline.ts` L181-L187 | `node.props?.style ?? {}` 若 props 中无 style，则回退到 `x/y` 或 `'0'`，可能产生 `(0,0)` 的幽灵位置。 | 建议优先读取 `node.props.position`（若 ComponentNode 定义支持），或明确文档说明 position 必须从 style 提取。 |
| L3 | **`countComponents` 统计逻辑与 CapacityGuard 不一致** | `src/enhanced/bridge/client.ts` L225-L233 vs `src/enhanced/guards/capacity-guard.ts` L137-L145 | Bridge Client 统计 `1 + (item.children?.length ?? 0)`，CapacityGuard 统计递归总数。若组件树嵌套较深，两者差异巨大，可能导致 Bridge 端看到的 componentCount 与客户端预期不符。 | 统一统计口径：建议使用 CapacityGuard 的递归统计作为唯一标准。 |
| L4 | **`getUserMessage` 中 413 的提示与 CapacityGuard 的提示不一致** | `src/enhanced/bridge/client.ts` L247-L255 | Bridge 413 提示“页面过大，请分批导出或简化页面”，但 CapacityGuard 抛错时提示“Capacity limit exceeded: maxPayloadSize...”，用户可能看到两种不同文案。 | 统一错误文案，或在上层（如 UI 层）做文案映射。 |
| L5 | **HTML 导出器 `fetchAndConvertToDataUri` 未限制资源大小** | `src/enhanced/preview/html-exporter.ts` L252-L266 | 仅通过 `currentSize + resourceSize > maxFileSize` 在事后判断，但 `fetch` 本身可能下载超大文件（如 100MB 图片），导致内存溢出。 | 在 `fetch` 时通过 `Content-Length` 预判断，或使用 `ReadableStream` 边下边算，超限即中断。 |
| L6 | **`generateExportId` 使用 `Math.random()` 存在碰撞风险** | `src/enhanced/bridge/client.ts` L243-L245 | `Date.now() + Math.random().toString(36).slice(2, 8)` 在高并发下可能碰撞，导致 Bridge 端分片归属错乱。 | 使用 `crypto.randomUUID()` 或 `ulid`。 |

---

## 协议契约核对（design.md § Axure Bridge 传输协议）

| 契约项 | 实现状态 | 偏差说明 |
|--------|---------|---------|
| `GET /available` 返回 `BridgeAvailability` | ✅ 已实现 | `client.ts` 正确解析了 `available/version/capabilities/maxPayloadSize` 等字段。 |
| `POST /copyaxvg` 请求体为 `CopyAxvgRequest` | ⚠️ 部分实现 | `sendSingle` 正确包装了 `CopyAxvgRequest`；`sendChunked` 未包装协议头，直接发送裸 JSON 切片。 |
| gzip 压缩 | ❌ 未实现 | 仅添加了 `Content-Encoding: gzip` 头，未对 body 做真实压缩。 |
| 分片传输（5MB/片） | ⚠️ 部分实现 | 分片大小正确（5MB），但分片协议与契约不符（缺少 `CopyAxvgRequest` 包装）。 |
| 10MB body 上限 | ✅ 已实现 | `client.ts` 在单包时检查 10MB；分片时绕过。 |
| 60s 超时 | ✅ 已实现 | `DEFAULT_TIMEOUT = 60_000`，`sendSingle`/`sendChunked` 均使用。 |
| 错误码 400/413/500/503 | ✅ 已实现 | `BridgeError` 正确定义了四种错误码及用户文案。 |
| 版本协商 | ❌ 未实现 | 未检查 `version` 和 `supportedAxureVersions`。 |

---

## 是否可进入第 2 轮 Review

**结论：不可直接进入第 2 轮。**

**理由：**
1. **H1（gzip 假压缩）** 导致协议层数据不一致，Bridge 端可能无法解析或产生静默错误。
2. **H2/H3（统一导出管线未复用 enhanced 实现）** 导致 Axure/HTML/Image 导出功能严重退化，核心数据流（ComponentTree → Axure JSON）不完整。
3. **H4（payload 大小检查错误）** 可能误杀可压缩的大页面导出。

**建议修复顺序：**
1. 修复 `src/integration/export-pipeline.ts`，复用 `exportToAxure` 和 `exportHtml`。
2. 修复 `src/enhanced/bridge/client.ts` 的 gzip 压缩实现。
3. 统一 CapacityGuard 与 Bridge Client 的 payload 上限语义。
4. 修复 HTML 导出器的 XSS 注入风险。
5. 重新提交 BE Review 第 1.5 轮（快速验证修复），通过后可进入第 2 轮（前端/集成 Review）。

---

*报告生成时间：2026-07-27*  
*Review 人：BE Agent*  
*下次 Review 建议：修复高优先级问题后，进行第 1.5 轮快速验证。*
