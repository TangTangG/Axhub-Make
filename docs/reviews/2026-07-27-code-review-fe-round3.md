# axhub-proto-enhanced v1.0.0 代码 Review — 第 3 轮（FE，最终确认）

- **审查人**：FE（前端开发）
- **日期**：2026-07-27
- **基线**：第 2 轮修复 commit `d2a364a`（fix: 代码 Review 第 2 轮修复，N1-N6 + 剩余中优）
- **范围**：① 第 1 轮 FE 高优（H1 Adapter 类型契约、H2 离屏 DOM 泄漏）最终确认；② 第 2 轮新问题（N6 Row/Col GutterContext、preview-manager any）修复验证；③ 新引入问题检查
- **验证手段**：逐文件源码核查 + `tsc --noEmit` 全量类型检查 + `vitest run` 全量测试（2858 用例）+ `git show d2a364a` diff 审计

---

## 结论

**第 1 轮 FE 高优 H1、H2 均真实修复，且在第 2 轮未回潮，状态稳定。第 2 轮 N6（Row/Col GutterContext）已从「假修复」转为「真修复」——GutterContext 已正确接入 Row.Provider 与 Col.useContext。preview-manager 的 `renderNodeInline` 与 `payload` 已修复，但 `calculateTreeBounds` 中的 `walk` 函数仍残留 `any`（commit message 声称已改，实际未改），属**部分修复**。export-pipeline 测试（N2 关联）仍有 4 个失败，totalNodes 重复计数从 5 降至 4 但仍未对齐测试期望的 3，且测试的嵌套结构断言与实现的平铺语义仍不一致。另有 1 个新发现问题：export.ci.test.ts 中「应拒绝不支持的格式」测试因 N3 修复后 image 格式被支持而失效，断言与实现语义冲突。

**总体：高优零回潮，中优基本修复，但有 1 处假修复残留（walk any）+ 2 处测试/实现语义未对齐。建议完成 2 项小返工后进入 Phase 4。**

---

## ① 第 1 轮 FE 高优修复验证表（最终确认）

| # | 第 1 轮问题 | 第 2 轮状态 | 第 3 轮验证结果 | 证据 |
|---|------------|-----------|---------------|------|
| **H1** | Adapter 类型契约与 enhanced 层脱节（裸类型 `rectangle`/`date-picker`，导出链路全降级） | ✅ 已修复 | ✅ **已修复，未回潮** | `src/integration/adapter.ts:111-134`：`mapUpstreamType` 23 个上游类型全部映射到 `proto-*` 命名空间（`rect→proto-rectangle`、`datepicker→proto-date-picker`、`richtext→proto-rich-text` 等）；`mapToUpstreamType`（L139-163）为完整反向表。L68 空数组兜底 `type: 'proto-rectangle'`（原为裸 `'rectangle'`）。与 `component-mapper.ts` 的 23 个注册键逐一对齐，`resolveTag('proto-image')→img` 链路可用 |
| **H2** | image-exporter 离屏 DOM 异常路径泄漏 | ✅ 已修复 | ✅ **已修复，未回潮** | `src/enhanced/preview/image-exporter.ts:29-45`：`try { await waitForResources; exportToSvg/exportToPng } finally { document.body.removeChild(container) }`。`htmlToCanvas` 抛错、`loadImage` reject 均进入 finally 清理。无 `createObjectURL` 使用，无 URL 泄漏风险 |

### H1 遗留边界（低优，不阻塞）

- **H1-a**：adapter 双向映射表仍缺 `proto-container` / `proto-row` / `proto-col` 三个布局类型——`component-mapper.ts:40-42` 已注册这三个键，但上游若无对应类型，Adapter 转换出的树永远不会包含它们（`?? upstreamType` 直通）。当前无实际数据流引用 Adapter，属契约完备性问题而非断链，维持低优。
- **H1-b**：`mapUpstreamType`/`mapToUpstreamType` 仍是两张手写表重复维护，单边漏改风险仍在。低优。

---

## ② 第 2 轮新问题修复验证表

| # | 第 2 轮问题 | 验证结果 | 证据与说明 |
|---|------------|---------|-----------|
| **N6** | Row/Col GutterContext 假修复（新建文件未接入，Row 仍 cloneElement 注入 `_gutterH`，Col 仍消费 `_gutterH` prop） | ✅ **真修复** | `Row.tsx:42-46`：`<GutterContext.Provider value={gutterH}>` 包裹 children，cloneElement 与 `_gutterH` 已移除；`Col.tsx:2,24`：`import { GutterContext }` + `const gutterH = useContext(GutterContext)`，`_gutterH` prop 已从接口删除；`gutter-context.ts:7`：`GutterContext = createContext<number>(0)` 正常导出。grep 确认无 `_gutterH` 残留。修复完整 |
| **FE-M2** | preview-manager 4 处 `any` | ⚠️ **部分修复** | `preview-manager.ts:39` `payload?: any` → `unknown` ✅；`:384` `renderNodeInline(node: any)` → `ComponentNode` ✅；`:388` `node.children.map((c: any)…)` → `(c: ComponentNode)` ✅。但 `:422` `walk = (node: any)` **原样未动**——commit message 明确声称「walk 参数改为 ComponentNode」，diff 中无此改动。属**假修复声明** |

---

## ③ 新引入问题清单（第 3 轮新发现）

### 🟡 N7. `calculateTreeBounds.walk` 仍为 `any`（commit message 虚报）

- **位置**：`src/enhanced/preview/preview-manager.ts:422`
- **现象**：`const walk = (node: any) => { ... }`，commit message 声称已改为 `ComponentNode`，实际 diff 未覆盖。
- **影响**：类型安全缺口，`tree.root` 传入时 TypeScript 无法检查 `props.left` / `props.width` 等属性存在性。
- **建议**：P1。一行改动：`(node: any)` → `(node: ComponentNode)`。

### 🟡 N8. export.ci.test.ts「应拒绝不支持的格式」测试失效

- **位置**：`tests/e2e/export.ci.test.ts:244-249`
- **现象**：测试用 `pipeline.export(tree, { format: 'image' as any })` 期望 `error.code === 'FORMAT_NOT_SUPPORTED'`。但 N3 修复后 `supportsFormat('image')` 已返回 `true`，`case 'image'` 进入真实导出，CI mock 环境无法完成 `htmlToCanvas` → 抛出异常 → 被 catch 为 `UNKNOWN`。测试断言与实现语义冲突。
- **根因**：N3 修复只改了 `supportsFormat('image')` 的断言（L209），未同步修改「应拒绝不支持的格式」测试的用例。该测试应改用一个真正不支持的格式（如 `'svg'` 或 `'pdf'`）来验证 `FORMAT_NOT_SUPPORTED` 路径。
- **建议**：P1。修改测试：用 `'svg' as any` 替代 `'image' as any`，或直接测试 `pipeline.export(tree, { format: 'svg' as any })`。

### 🔴 N9. export-pipeline 测试 4 个失败仍未修复（N2 关联残留）

- **位置**：`src/enhanced/export/export-pipeline.test.ts:80-134`
- **现象**：`pnpm vitest run` 实测 `4 failed / 9`：
  - L87 `expect(totalNodes).toBe(3)`，实际 **4**（N2 的 `skipCount` 修复使 root 不再 +1，但 root.children 在 L46 被平铺遍历各 +1，root 自身经 `includeChildren` 递归时又遍历一次子节点，子节点仍被**重复计数**）；
  - L97 fallback 统计同理期望 3 实际 4；
  - L122-124 期望 `items[0].children.length === 2`，实际 `items[0]` 是 **btn-1**（平铺语义），`children` 为 undefined；
  - L131-133 期望 `items[0].children[0].size.width === 120`，实际 undefined。
- **根因**：`exportToAxure` 的语义是「root 的子节点平铺为顶层 widgets、root 自身仅在无子时入列」，而测试按「root 包裹 children 的嵌套结构」断言。N2 修复只解决了 root 的重复计数，未解决子节点在「平铺遍历 + 递归转换」中的重复计数，也未对齐测试的结构断言。
- **建议**：P1。二选一：① 修实现——`exportToAxure` 不再平铺，改为转换 root 并递归 children，`convertNodeToAxureWidget` 递归时不再重复统计；② 修测试——按平铺语义改写 L80-134 断言，并为 totalNodes 重复计数单独开 issue。当前 commit message 声称「N2: 双重计数修复」，实际只修了一半。

### 回归排除项（已核实为非本轮引入）

| 失败项 | 核实结果 |
|--------|---------|
| `server/vendorPackages.test.ts` | 在 `d0cebf8` 之前（e12e7a7）同样失败 → **pre-existing** |
| `commentAssetFiles.test.ts` | NODE_OPTIONS 环境兼容问题，pre-existing |
| `e2e/export.local.test.ts` | 依赖本地 Bridge 运行环境，非代码回归 |
| `e2e/export.ci.test.ts` 容量守卫 2 个失败 | 在 `d0cebf8` 之前同样失败 → **pre-existing** |
| `tsc --noEmit` | 除 server 目录 TS6305 构建产物类报错（pre-existing）外，**enhanced/integration 层零类型错误** |

---

## 修复验证总表（一屏速览）

| 项 | 状态 | 备注 |
|----|------|------|
| H1 Adapter proto-* 映射 | ✅ 真修复，未回潮 | 23 键双向对齐 component-mapper |
| H2 离屏 DOM try-finally | ✅ 真修复，未回潮 | image-exporter.ts:32-45 |
| N6 Row/Col GutterContext | ✅ 真修复 | Provider + useContext 完整接入 |
| FE-M2 preview-manager any | ⚠️ 部分修复 | renderNodeInline/payload 已改，walk 仍为 any |
| N7 walk any 残留 | 🟡 新增 | commit message 虚报 |
| N8 拒绝不支持格式测试失效 | 🟡 新增 | N3 修复后测试未同步 |
| N9 export-pipeline 测试 4 失败 | 🔴 残留 | totalNodes 重复计数 + 结构语义未对齐 |

---

## 是否可进入 Phase 4

**条件通过。** 高优（H1/H2）零回潮，N6 真修复，核心功能链路稳定。但需在进入 Phase 4 前完成 2 项 P1 返工：

1. **N7**：`preview-manager.ts:422` `walk = (node: any)` → `(node: ComponentNode)`——一行改动，消除 commit message 与代码的断裂；
2. **N9**：修复 export-pipeline 测试/实现语义断裂（4 个失败测试 + totalNodes 重复计数统计污染）——这是当前唯一阻塞级测试问题；
3. **N8**：同步修改 export.ci.test.ts「应拒绝不支持的格式」测试用例（`'image'` → `'svg'` 或 `'pdf'`）——与 N9 同一 commit 收口。

N7/N8/N9 均为小改动，建议同一 commit 完成。完成后无需第 4 轮 Review，可直接进入 Phase 4。
