# 代码 Review 报告 — QA 第 3 轮（最终确认）

- **项目**：axhub-proto-enhanced v1.0.0
- **审查角色**：测试工程师（QA）
- **审查 commit**：`d23d6df`（第 3 轮修复）
- **审查日期**：2026-07-30（重跑，此前因 API 429 失败）
- **测试环境**：macOS 26.3.1 / Node / vitest 4.0.16 / pnpm

---

## 一、结论

**结论：不通过（BLOCKED），不可进入 Phase 4。**

第 1 轮高优（H1–H5）中，H1/H2/H3/H5 的**实现侧**修复已确认到位；但 **H4（enhanced 单元测试）所对应的测试套件目前有 7 个用例失败**，其中包含第 2 轮遗留问题 **N2（exportToAxure 计数）修复不完整**、**N3（exportImage 矛盾）在 CI 层仍未被覆盖**，以及 `vitest run` 实际执行后暴露的 **3 处断言与实现不一致**。这些失败不是环境噪音，而是「实现与测试契约未对齐」的真实缺陷，必须在进入 Phase 4 前清零。

---

## 二、阻塞验证表（逐条核对）

| # | 检查项 | 验证方式 | 结果 | 证据 |
|---|--------|----------|------|------|
| **H1** | 测试运行器统一为 vitest | 读取 `package.json` | ✅ **通过** | `devDependencies.vitest: 4.0.16`，`test/test:e2e` 脚本均指向 vitest；`vitest.config.ts` 存在且 `include: ['src/**/*.test.ts','tests/**/*.test.ts']` |
| **H2** | BridgeError 在统一管道中被捕获并透传 | 读取 `src/integration/export-pipeline.ts` L85-88 | ✅ **通过** | `catch` 分支显式 `instanceof BridgeError`，映射为 `BRIDGE_${err.code}`，使用 `err.userMessage` |
| **H3** | exportImage 真实实现（非 stub） | 读取 `src/enhanced/preview/image-exporter.ts` | ⚠️ **部分通过** | 实现真实（离屏 DOM → SVG foreignObject → Canvas → Blob），非占位；**但** `package.json` 未声明 `html-to-image` 依赖（见「新发现 N3-a」），且该模块依赖 DOM API，在 `environment: 'node'` 的 vitest 中无法直接单测 |
| **H4** | enhanced 单元测试存在且通过 | 读取 `src/enhanced/export/export-pipeline.test.ts` + 实际运行 | ❌ **阻塞** | 测试文件存在（214 行，9 用例），但 `vitest run` 结果：**4 failed / 9**，详见「四、实测结果」 |
| **H5** | 分片按字节切分，不断 UTF-8 | 读取 `src/enhanced/bridge/client.ts` L244-256 | ✅ **通过** | `splitIntoChunks` 使用 `TextEncoder` → 按字节 `slice` → `TextDecoder('utf-8',{stream:true})` 流式解码，多字节字符不会被切断 |
| **N2** | exportToAxure 双重计数修复 | 读取 `src/enhanced/export/export-pipeline.ts` + 单测 | ❌ **阻塞（修复不完整）** | 实现引入 `skipCount=true` 防止根节点二次计数（L63-70, L117-121），**但递归子节点仍会被重复计数**（children 先被顶层循环转换，再随 rootWidget 递归转换一次），实测 `totalNodes=4`（期望 3） |
| **N3** | exportImage 矛盾（声明支持 vs 实际 stub） | 读取 `export.ci.test.ts` + `image-exporter.ts` | ❌ **阻塞（矛盾未解）** | `supportsFormat('image')===true` 且 `exportImage` 有真实实现，但 **CI E2E 中没有任何 image 导出断言**；同时 `export.ci.test.ts` L246 仍把 `format:'image'` 当作「不支持」来断言 `FORMAT_NOT_SUPPORTED`，与实现直接矛盾 |
| **R3-1** | 埋点接入（exportToAxure 全链路） | 读取 `src/enhanced/export/export-pipeline.ts` L36-101 | ✅ **通过** | START/SUCCESS/FAIL 三个事件均已接入，FAIL 在 catch 中上报后 rethrow，不吞异常 |
| **R3-2** | prompt 脱敏接线 | 读取 `src/enhanced/analytics/tracker.ts` L62-69 | ✅ **通过** | `track()` 内对 `prompt_text` 强制 `sanitizePrompt`，业务方传原文也会被拦截，双保险 |
| **R3-3** | opt-out API（setEnabled/optOut） | 读取 `tracker.ts` L91-107 | ✅ **通过** | `setEnabled` 正确启停 flushTimer；`optOut` 清空队列 + 清 localStorage + 禁用 |

> 图例：✅ 通过｜⚠️ 部分通过｜❌ 阻塞

---

## 三、第 2 轮遗留问题复核

### N2 — exportToAxure 双重计数：**修复不完整，仍阻塞**

`d23d6df` 确实给 `convertNodeToAxureWidget` 增加了 `skipCount` 参数，避免根节点被计两次（`export-pipeline.ts` L63-70）。但这只解决了**根节点**的重复计数，没有解决**子节点**的重复计数：

```
exportToAxure 流程：
1. 遍历 root.children → convertNodeToAxureWidget(child)  // child 计数 +1
2. 转换 root（skipCount=true，root 不计数）
   └─ 递归转换 root.children → convertNodeToAxureWidget(child)  // child 再次计数 +1
```

**实测证据**（`export-pipeline.test.ts`）：

- `应正确统计 mappedNodes / totalNodes`：期望 `totalNodes=3`，实际 `4`
- `应对无法映射的组件降级…`：期望 `totalNodes=3`，实际 `4`

修复建议：要么顶层循环改为只调用一次根节点转换（让递归统一处理），要么在顶层循环时同样传 `skipCount` 并只收集 widget。

### N3 — exportImage 矛盾：**未解决，仍阻塞**

矛盾点依旧存在：

1. `UnifiedExportPipeline.supportsFormat('image')` 返回 `true`，且 `exportImage()` 调用的是真实实现 `image-exporter.ts`；
2. 但 `tests/e2e/export.ci.test.ts` L244-249 的用例「应拒绝不支持的格式」**仍然用 `format: 'image'` 去断言 `FORMAT_NOT_SUPPORTED`**——这在当前实现下永远失败（实际走到 `exportImage` 分支，因 node 环境无 DOM 而抛 `UNKNOWN`）；
3. 整个 CI E2E 没有任何对 image 导出成功路径的断言。

即「实现说支持、测试说不支持、CI 不验证」的三方矛盾原样保留。

---

## 四、第 3 轮修复回归检查

第 3 轮（`d23d6df`）改动文件：`tracker.ts`、`export-pipeline.ts`(enhanced)、`index.ts`、`html-exporter.ts`、`preview-manager.ts`。

| 改动 | 回归风险 | 评估 |
|------|----------|------|
| 埋点接入 exportToAxure | tracker 为模块级单例，node 环境下 `localStorage`/`sessionStorage` 不存在，但代码已做 `typeof` 守卫，不会抛异常 | ✅ 无新问题；FAIL 事件 rethrow 不改变原有错误语义 |
| prompt 脱敏 | 仅作用于 `prompt_text` 字段，不影响其他属性 | ✅ 无新问题 |
| opt-out API | `setEnabled(false)` 正确清理 timer；`optOut` 清队列 | ✅ 无新问题 |
| `index.ts` 模块加载即上报 `app_open` | **中风险**：`src/enhanced/index.ts` L38-42 在模块顶层直接访问 `localStorage` 并 `tracker.track`，且未做 `typeof localStorage === 'undefined'` 守卫（tracker 内部有守卫，但 `index.ts` 自身的 `localStorage.getItem` 没有）。在 SSR/node 环境 `import` 该入口会直接 `ReferenceError` | ⚠️ 新发现问题 R3-a |
| HTML 品牌注释注入 | `assembleHtml` 加注释，无副作用 | ✅ 无新问题 |
| preview-manager walk 类型修复 | any → ComponentNode，纯类型层 | ✅ 无新问题 |

---

## 五、实测结果（vitest 实际运行）

执行命令：

```bash
node_modules/.bin/vitest run \
  src/enhanced/export/export-pipeline.test.ts \
  tests/e2e/export.ci.test.ts \
  src/integration/export-pipeline.test.ts
```

**汇总：3 个测试文件，34 用例，7 failed / 27 passed。**

| 失败用例 | 位置 | 根因分类 |
|----------|------|----------|
| `exportToAxure > 应正确统计 mappedNodes/totalNodes`（期望 3 实得 4） | enhanced/export-pipeline.test.ts:87 | **实现缺陷**（N2 修复不完整，子节点双计） |
| `exportToAxure > 无法映射组件降级`（期望 3 实得 4） | 同上 :97 | **实现缺陷**（同上） |
| `exportToAxure > 应包含子组件转换`（items[0] 不是 root） | 同上 :123 | **测试缺陷**（断言未随「children 平铺」实现更新） |
| `exportToAxure > 应提取位置和尺寸`（读不到 children） | 同上 :132 | **测试缺陷**（同上） |
| `容量守卫 > validateTree 应抛出 CapacityError` | export.ci.test.ts:183 | **测试缺陷**（`toThrow('CapacityError')` 匹配 message 而非 name） |
| `容量守卫 > validatePayloadSize 超限时抛出` | export.ci.test.ts:187 | **测试过时**（实现已按设计改为「仅 console.warn 不抛错」，测试未同步） |
| `导出管道 > 应拒绝不支持的格式`（用 image 断言不支持） | export.ci.test.ts:248 | **N3 矛盾**（image 实际被 supportsFormat 支持） |

补充：`src/integration/export-pipeline.test.ts`（9 用例）全部通过；`src/enhanced/` 目录全量运行 42 用例，38 passed / 4 failed（失败即上表前 4 条）。

---

## 六、新发现问题（第 3 轮引入/暴露）

| # | 严重级 | 问题 | 位置 |
|---|--------|------|------|
| R3-a | 中 | `src/enhanced/index.ts` 顶层直接 `localStorage.getItem('app_visited')`，无环境守卫，SSR/node 环境 import 即 `ReferenceError` | index.ts:38-42 |
| N3-a | 低 | `image-exporter.ts` 文件头注释称「使用 html-to-image 作为渲染引擎」，实际为手写 SVG foreignObject 方案；`package.json` dependencies 中虽有 `html-to-image: ^1.11.13`，但未被 import，属于误导性注释/冗余依赖 | image-exporter.ts:4 |
| R3-b | 低 | `exportAxureFallbackClipboard` 在非浏览器环境 `clipboardSuccess` 恒为 false 但仍上报 `clipboard_success: false` 且返回 `success: true`，语义略含糊（降级成功但剪贴板未写入） | integration/export-pipeline.ts:145-181 |

---

## 七、是否可进入 Phase 4

**否（NO-GO）。**

进入 Phase 4 的前置条件（全部满足后方可重审）：

1. **修复 N2 计数缺陷**：`exportToAxure` 的 `totalNodes` 对每个节点只计一次（建议收敛为「单次递归从根开始计数」），使 `export-pipeline.test.ts` 两条统计断言通过；
2. **解决 N3 矛盾**：`export.ci.test.ts` 中「应拒绝不支持的格式」改用真正非法的 format（如 `'pdf'`），并为 image 导出补充 CI 可运行的断言（或显式标记 image 在 node 环境下 skip + 在浏览器环境测试中覆盖）；
3. **同步过时断言**：`validatePayloadSize` 超限断言改为「不抛错 + console.warn」；`toThrow('CapacityError')` 改为断言 `err.name === 'CapacityError'` 或匹配 message 片段；
4. **修复 R3-a**：`index.ts` 的 `app_open` 埋点加 `typeof localStorage !== 'undefined'` 守卫（或迁入初始化函数显式调用）；
5. **重跑 `vitest run`（enhanced + integration + e2e）全部通过**后，QA 第 4 轮确认（预计为快速回归）。

---

*报告生成：QA Subagent（Hermes），基于 commit `d23d6df` 实际代码与 vitest 4.0.16 实测输出。*
