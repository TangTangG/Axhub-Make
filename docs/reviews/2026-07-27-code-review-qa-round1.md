# axhub-proto-enhanced v1.0.0 — QA 代码 Review（第 1 轮）

- 日期：2026-07-27
- 审查人：QA（测试工程师）
- 审查范围：`tests/e2e/export.ci.test.ts`、`tests/e2e/export.local.test.ts`、`src/enhanced/guards/capacity-guard.ts`、`src/enhanced/bridge/client.ts`、`src/enhanced/export/export-pipeline.ts`、`src/integration/export-pipeline.ts`、`openspec/changes/enhance-prototype-tool/TEST_SPEC.md`
- 测试文件盘点：全仓 `.test.ts/.spec.ts` 约 300 个（绝大多数为既有 axhub-make 上游模块），**`src/enhanced/` 与 `src/integration/` 新增代码的测试仅 2 个 E2E 文件（`tests/e2e/export.ci.test.ts` 15 个用例、`export.local.test.ts` 9 个用例），无任何单元测试**。

---

## 一、结论

**不通过，不建议进入第 2 轮。**

存在 3 个阻断级问题：① E2E 测试运行器错配（脚本用 Playwright 跑 Vitest API 的测试文件，且无 `playwright.config.*`，E2E 实际无法执行）；② 导出管道把 Bridge 的 400/413/500/503 错误码全部吞成 `UNKNOWN`，异常路径既有实现缺陷又无测试覆盖；③ `exportImage` 是假实现（返回 `text/html` Blob），测试却断言其成功，形成"假绿"背书。此外 enhanced 核心模块（mapper/exporter/analytics/preview）零单元测试，TEST_SPEC 中约 70% 的验收项无对应自动化测试。

---

## 二、问题清单

### 🔴 高（阻断，必须先修）

| # | 问题 | 位置 | 说明 |
|---|------|------|------|
| H1 | **E2E 测试运行器错配，测试实际不可运行** | `package.json:81-83` vs `tests/e2e/*.test.ts` | 脚本为 `playwright test tests/e2e/*.ci.test.ts`，但测试文件 `import { describe, it, vi } from 'vitest'` 并使用 `vi.stubGlobal`；仓库根目录不存在 `playwright.config.ts`。两条路都走不通：Playwright 无法识别 vitest API；vitest 虽在 `vitest.config.ts` include 了 `tests/**/*.test.ts`，但文件名 `*.ci.test.ts`/`*.local.test.ts` 会被 `pnpm test` 一并跑起，local 文件还会尝试连接 localhost:32767。需统一为 vitest（推荐，改名/配置单独 project）或改写为 Playwright 风格。 |
| H2 | **Bridge 错误码被吞为 `UNKNOWN`** | `src/integration/export-pipeline.ts:72-77` | `export()` 的 catch 只识别 `CapacityError`，`BridgeError`（400/413/500/503，含用户友好文案 `userMessage`）落入 `UNKNOWN` 分支，错误码与用户提示全部丢失。TEST_SPEC §6.3 要求的「版本不兼容提示升级」「超时提示重试」等差异化处理因此无法实现。且无任何测试断言该路径。建议显式捕获 `BridgeError` 并映射到 `ExportError.code`。 |
| H3 | **`exportImage` 假实现被测试背书** | `src/integration/export-pipeline.ts:130-146`、`export.ci.test.ts:209-213` | `exportImage` 实际返回 `type: 'text/html'` 的 Blob，与 `exportHtml` 完全相同；测试只断言 `supportsFormat('image') === true`，未断言导出内容。TEST_SPEC §2.3 要求 PNG/SVG、1x/2x/3x、背景可选 — 实现与测试双双缺失。要么实现真实图片导出 + 测试，要么在 v1.0.0 中移除 `image` 格式声明。 |
| H4 | **`src/enhanced/` 核心模块零单元测试** | `src/enhanced/export/component-mapper.ts`、`axure-mapper.ts`、`preview/html-exporter.ts`、`preview/image-exporter.ts`、`preview/preview-manager.ts`、`analytics/*` | 全仓 300 个测试文件无一覆盖 enhanced 新代码的组件映射、样式转换、HTML/图片导出、埋点。TEST_SPEC §1.2 的 15 个组件可编辑性矩阵、§7.1 的 10 个必埋事件均无自动化验证。当前仅有的 E2E 走的是 `integration/export-pipeline.ts` 的内部简化转换器（`convertNodeToWidget`），**`enhanced/export/export-pipeline.ts`（exportToAxure、降级 fallback、warnings/stats 统计）完全没有被任何测试执行到**。 |
| H5 | **分片传输（sendChunked）零覆盖且实现有缺陷** | `src/enhanced/bridge/client.ts:155-205, 235-241` | CI mock 未实现 chunk 协议，10MB+ 的分片路径无测试。实现上 `splitIntoChunks` 按**字符**而非字节切片（`data.slice(i, i+chunkSize)` 与 5MB 字节预算不符），且可能在多字节 UTF-8 字符中间切断，导致桥端拼接出乱码 — 中文场景必现。需补 mock chunk 端到端测试 + 改按字节切分（TextEncoder 边界对齐）。 |

### 🟡 中（本轮应修，或在第 2 轮前给出计划）

| # | 问题 | 位置 | 说明 |
|---|------|------|------|
| M1 | **规格与实现不一致：表格行数上限** | `capacity-guard.ts:14`（100）vs `TEST_SPEC.md §4.2`（1000 行） | 实现为 `maxTableRows: 100` 且超限直接报错；规格为 1000 行且「超出启用虚拟滚动」。需对齐其一，并补测试（当前 `maxTableRows` 完全无测试）。另规格中「表格列数 50」「单项目页面数 20」「项目文件 5MB」「图片 2MB/张」均未实现也无测试。 |
| M2 | **边界值测试缺 on-boundary 用例** | `export.ci.test.ts:147-193` | 500 组件：只测了 501（拒绝），缺恰好 500（应通过）与 401–500（警告阈值 80% 触发 `warnings` 的断言，`warnings` 路径零覆盖）。10MB payload：只单测了 `validatePayloadSize(11MB/5MB)`，缺导出管道端到端 10MB 边界及「>10MB 且支持 chunkedTransfer 时分片、不支持时抛 413」的分支测试（`client.ts:102-108` 两个分支均无覆盖）。嵌套深度 8/9 已覆盖 ✅。 |
| M3 | **local 测试静默跳过造成假阳性绿** | `export.local.test.ts:110, 118, 136, ...` | Bridge 不可用时 `if (!bridgeAvailable) return;` 让用例直接通过，CI 报告全绿但实际 0 断言执行（如 `export.local.test.ts:157` 的 61 节点统计断言几乎从不运行）。建议改用 `it.skipIf(!bridgeAvailable)` / `describe.skipIf`，或在汇总输出中显式报告 skipped 数量并设门禁。 |
| M4 | **Bridge 失败路径 CI 无覆盖** | `export.ci.test.ts` mock 仅返回 200 | 未覆盖：`/available` 返回非 200（`client.ts:80-86`）、网络异常/连接拒绝（映射 503）、`sendSingle` 超时 AbortError（映射 500 + 「导出超时」文案，`client.ts:148-150`）、`/copyaxvg` 返回 400/413/500。仅 local 测试覆盖了「连接 localhost:1 → BRIDGE_UNAVAILABLE」一条路径，且常被跳过（见 M3）。 |
| M5 | **兼容性测试整体缺失** | TEST_SPEC §1.3、§五 | ① Axure 版本：mock 返回 `supportedAxureVersions: ['10.0.0']` 但客户端**从未校验**（`client.ts` 无版本比较逻辑），RP 9 降级 / RP 8 阻止导出未实现未测试。② 多浏览器（Chrome/Firefox/Safari/Edge）：无任何浏览器矩阵测试，Playwright 配置不存在。③ 多 DPI（1x/2x/3x）：随 H3 一并缺失。建议 v1.0.0 至少落地 Bridge 版本检查 + 单测，浏览器矩阵可排期到第 2 轮但需写入计划。 |
| M6 | **AI 生成异常路径无实现也无测试** | TEST_SPEC §6.1 | 非法 JSON、未知组件、循环嵌套、空响应、超时 6 个场景在 enhanced 模块无对应代码与测试。若 AI 生成复用上游 `src/index/domains/ai-generation/*`（该域有测试），需在报告中明确边界并在集成层补「AI 输出 → ComponentTree 校验」的契约测试（循环引用会直接导致 `countComponents` 无限递归栈溢出，`capacity-guard.ts:137` 无 visited 集合保护 — 建议优先修）。 |
| M7 | **`validateTree` 只抛第一个错误** | `capacity-guard.ts:65-67` | `for (const error of result.errors) { throw ... }` 循环首次迭代即抛出，多限制同时超限时用户只能看到第一条，修复后再撞第二条。应聚合抛出或返回全部（`check()` 已具备该能力，属导出管道未利用）。 |

### 🟢 低（建议改进）

| # | 问题 | 说明 |
|---|------|------|
| L1 | 注释与实现不符 | `export.ci.test.ts:3` 注释「使用 msw 模拟」，实际为手写 `mockFetch` + `vi.stubGlobal`。误导维护者，建议改正或真正引入 msw。 |
| L2 | 测试数据构造函数重复 | `createSmallTree` 等工厂函数在两个 E2E 文件中重复定义，建议提取 `tests/fixtures/component-trees.ts` 共享，并补充 500/8 层/10MB 边界夹具。 |
| L3 | 断言强度不足 | 多处只断言 `success === true`，未断言产物内容（如 Axure 导出的 `document.pages[0].scene.items` 结构、fallback 警告列表）。`createErrorResult` 硬编码 `format: 'axure'`（`integration/export-pipeline.ts:207`），HTML 导出失败时 format 字段错误，测试未捕获。 |
| L4 | 测试隔离性 | 两个 describe 各自 `beforeAll` stub 同一个全局 fetch，client 跨用例共享且 `availability` 有缓存（`client.ts:53, 98`），用例间存在隐式状态依赖；建议每个 describe 独立 client 或显式清缓存。 |
| L5 | 无 enhanced 覆盖率门禁 | `vitest.config.ts` 未对 `src/enhanced/**` 设覆盖率阈值，建议至少 lines 80% 并纳入 CI。 |

---

## 三、覆盖度对照（TEST_SPEC → 自动化测试）

| TEST_SPEC 章节 | 验收项 | 自动化覆盖 |
|---|---|---|
| §1.2 组件可编辑性矩阵（15 组件） | 映射正确性 | ❌ 无（H4） |
| §1.3 Axure 版本兼容（10/9/8） | 版本检查与降级 | ❌ 无实现无测试（M5） |
| §1.4 / §6.3 导出异常（5+5 场景） | 错误处理 | ⚠️ 仅 Bridge 不可用 1 条（且常被跳过），且存在 H2 吞码缺陷 |
| §2.2 HTML 导出 | 离线打开/大小/响应式 | ⚠️ 仅断言 Blob 存在 |
| §2.3 图片导出 | 分辨率/格式/背景 | ❌ 假实现（H3） |
| §4.2 容量上限（8 项） | 守卫 | ⚠️ 覆盖 3 项（组件数/深度/payload），缺表格行/列、页面数、项目/图片大小；表格行数规格不符（M1） |
| §4.3 大数据量 | 大表格/长列表/多页/复杂嵌套 | ❌ 无 |
| §五 浏览器矩阵 | 4 浏览器 × 4 功能 | ❌ 无（M5） |
| §6.1 AI 生成异常（6 场景） | 解析/降级/循环/空/超时 | ❌ 无（M6） |
| §7.1 埋点事件（10 个） | 事件上报 | ❌ 无（H4） |

**量化**：TEST_SPEC 可自动化验收项约 60 项，当前有效覆盖约 8 项（≈13%），且这 13% 依赖的 E2E 当前无法运行（H1）。

---

## 四、是否可进入第 2 轮

**否。** 进入第 2 轮的前置条件（建议）：

1. 修复 H1（统一测试运行器，确保 `pnpm test:e2e` 真实可跑且通过）；
2. 修复 H2（BridgeError 错误码透传）+ 补 M4 失败路径测试；
3. H3 二选一：实现真实图片导出或从 v1.0.0 声明中移除 image 格式；
4. 为 `enhanced/export/export-pipeline.ts`（exportToAxure/fallback/stats）补最小单元测试集，消除 H4 中「核心转换器零执行」；
5. 对齐 M1（表格行数规格 vs 实现）并给出 §4.2 其余容量项的处置结论（实现/降级/移出规格）。

M5（Axure 版本检查）、M6（AI 异常契约测试）可与第 2 轮并行推进，但需在本轮报告中明确排期。
