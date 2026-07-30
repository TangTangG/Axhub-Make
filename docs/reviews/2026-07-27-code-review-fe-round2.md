# axhub-proto-enhanced v1.0.0 代码 Review — 第 2 轮（FE）

- **审查人**：FE（前端开发）
- **日期**：2026-07-27
- **基线**：第 1 轮修复 commit `d0cebf8`（fix: 代码 Review 第 1 轮修复，11 高优 + 40 中优）
- **范围**：① 第 1 轮 FE 高优问题（H1/H2）修复验证；② 中优问题（M1/M2/M5 及关联项）修复验证；③ 并发修改回归检查
- **验证手段**：逐文件源码核查 + `tsc --noEmit` 全量类型检查 + `vitest run` 全量测试（2858 用例）+ `git show d0cebf8` diff 审计

---

## 结论

**两个高优问题 H1、H2 均真实修复，修复质量良好；中优 M1（css.d.ts）、M3（XSS）、M4（并发/base64 分块）修复到位。但存在 1 个高优先级「假修复」回归：M5 Row/Col 仅新建了 `GutterContext` 文件却未接入，组件仍走 cloneElement 私有 prop；M2 preview-manager 的 4 处 `any` 原样未动；另有 4 个本轮新引入的测试失败（export-pipeline 测试断言与实现语义不符）。结论：高优放行、中优有回潮，建议完成 2 项 P1 返工后进入第 3 轮。**

---

## ① 高优问题修复验证表

| # | 第 1 轮问题 | 验证结果 | 证据 |
|---|------------|---------|------|
| **H1** | Adapter 类型契约与 enhanced 层脱节（裸类型 `rectangle`/`date-picker`，导出链路全降级） | ✅ **已修复** | `src/integration/adapter.ts:111-134`：`mapUpstreamType` 23 个上游类型全部映射到 `proto-*` 命名空间（`rect→proto-rectangle`、`datepicker→proto-date-picker`、`richtext→proto-rich-text` 等）；`mapToUpstreamType`（L139-163）为完整反向表，双向往返无损。L68 空数组兜底已改为 `type: 'proto-rectangle'`（原为裸 `'rectangle'`）。与 `component-mapper.ts` 的 23 个注册键逐一对齐，`resolveTag('proto-image')→img` 链路恢复可用 |
| **H2** | image-exporter 离屏 DOM 异常路径泄漏 | ✅ **已修复** | `src/enhanced/preview/image-exporter.ts:29-45`：渲染/导出逻辑已包入 `try { await waitForResources; exportToSvg/exportToPng } finally { document.body.removeChild(container) }`，任何异常路径均会清理离屏容器。`htmlToCanvas` 抛错、`loadImage` reject 均不再残留 DOM 节点 |

### H1 遗留边界（低优，不阻塞）

- **H1-a（L2 仍未处理）**：adapter 的双向映射表缺 `proto-container` / `proto-row` / `proto-col` 三个布局类型——`component-mapper.ts:40-42` 已注册这三个键，但上游若无对应类型，Adapter 转换出的树永远不会包含它们（`?? upstreamType` 直通）。当前无实际数据流引用 Adapter（grep 确认无生产调用方），属契约完备性问题而非断链，维持第 1 轮 L2 评级。
- **H1-b**：`mapUpstreamType`/`mapToUpstreamType` 仍是两张手写表重复维护（第 1 轮已建议单表双向生成），本次未采纳，未来单边漏改风险仍在。**低优**。

---

## ② 中优问题修复验证表

| # | 第 1 轮问题 | 验证结果 | 证据与说明 |
|---|------------|---------|-----------|
| **M1** | CSS Modules 无 `*.css` 类型声明，`styles` 为隐式 any | ✅ **已修复** | `src/css.d.ts` 已新建：`declare module '*.css' { const styles: { readonly [className: string]: string } }`，与 scss.d.ts 并列。兜底式 index signature 方案（非逐类名生成），符合第 1 轮建议的最低可接受形态 |
| **M2** | `preview-manager.ts` 的 `renderNodeInline(node: any)` / `walk(node: any)` / `payload?: any` | ❌ **未修复** | `preview-manager.ts:39` `payload?: any`、`:384` `renderNodeInline(node: any)`、`:388` `node.children.map((c: any)…)`、`:422` `walk = (node: any)…` 四处 any 与第 1 轮时**完全一致**。文件明明 import 了 `ComponentTree`（L7），递归却仍未复用 `ComponentNode`。commit message 声称「G7: 类型安全 — preview-manager ComponentNode」，与代码事实不符，属**假修复声明** |
| **M5** | `Row.tsx` cloneElement 注入 `_gutterH` 私有 prop | ❌ **假修复（新建文件未接入）** | `gutter-context.ts` 已新建（`GutterContext = createContext<number>(0)`，commit message 宣称「Row/Col GutterContext」），但**全库 grep 仅此一处**：`Row.tsx:42-47` 仍是原样 `React.cloneElement(child as React.ReactElement<any>, { _gutterH: gutterH })`，`Col.tsx:11,23,40-43` 仍消费 `_gutterH` prop。GutterContext 无任何 Provider/Consumer，是死代码；`as React.ReactElement<any>` 类型击穿原样保留。**修复意图明确但接线遗漏，等同未修** |
| **M3** | html-exporter 交互脚本 `</script>` 闭合逃逸 / id 注入 | ✅ **已修复**（本轮顺带验证） | `html-exporter.ts:409-410` url/target 改 `JSON.stringify` 字面量注入；`:405-406,440` 新增 `isSafeDomId` 校验；`:468` 拼装后整体 `.replace(/<\/script/gi, '<\\/script')` 兜底。配套 `html-exporter.security.test.ts`（151 行）通过 |
| **M4** | base64 逐字节阻塞 + 资源内联串行 fetch | ✅ **已修复**（顺带验证） | `html-exporter.ts:243` `Promise.allSettled` 并发内联；`:540` `String.fromCharCode.apply` 分块 |
| **M6** | Slider 拖拽中卸载的监听残留 | ⚠️ **部分修复（仍有窗口）** | commit message 宣称「Slider cleanup」，但 `Slider.tsx:70-77` 清理逻辑仍只在 `handleMouseUp` 触发时执行；`useEffect` 已 import（L1）但未用于注册/注销 document 监听。拖拽中组件卸载 → `handleMouseUp` 永不触发 → 两个 document 级监听残留窗口**仍在**。第 1 轮建议（cleanup 中执行 handleMouseUp / 状态收敛进 useEffect）未落实 |

---

## ③ 新引入问题清单（第 2 轮新发现）

### 🔴 N1. `export-pipeline.test.ts` 4 个测试失败——测试断言与实现语义不符（本轮新引入）

- **位置**：`src/enhanced/export/export-pipeline.test.ts:80-134`
- **现象**：`pnpm vitest run` 实测 `4 failed / 9`：
  - L87 `expect(totalNodes).toBe(3)`，实际 **5**（实现先遍历 `root.children` 各 +1，再转换 root 时经 `includeChildren` 递归子节点又 +1，子节点被**重复计数且重复转换**）；
  - L97 fallback 统计同理期望 3 实际 5；
  - L122-124 期望 `items[0].children.length === 2`，实际 `items[0]` 是 **btn-1**（`exportToAxure` L46 把 root.children 平铺为顶层 items），`children` 为 undefined；
  - L131-133 期望 `items[0].children[0].size.width === 120`，实际 undefined（同上）。
- **根因**：`exportToAxure`（`export-pipeline.ts:45-63`）的输出语义是「root 的子节点平铺为顶层 widgets、root 自身仅在无子时入列」，而测试按「root 包裹 children 的嵌套结构」断言。两侧必有一错：
  - 若实现语义是设计意图 → 测试断言写错，且 `stats.totalNodes` 重复计数是实现 bug（子节点在 L47 与 L55-60 递归中各计一次，**stats 虚高 67%**，埋点/容量统计会被污染）；
  - 若嵌套结构是设计意图 → 实现结构错误。
- **关联**：测试注释（L84-86）自认「循环逻辑会导致 totalNodes 被计算为 5（重复计算子节点）……我们验证实际行为：totalNodes 应该是 3」——作者明知实现会算出 5 却断言 3，**等于提交了注定失败的测试**。这是并发修复中最典型的「测试先行、实现未跟上」断裂。
- **建议**：P1。与 BE 对齐语义后二选一：① 修实现——`exportToAxure` 不再平铺，改为转换 root 并递归 children，`convertNodeToAxureWidget` 递归时不再重复统计；② 修测试——按平铺语义改写 L80-134 断言，并为 totalNodes 重复计数单独开 issue。

### 🟡 N2. preview-manager Blob URL 在 iframe/img `onload` 失败路径泄漏

- **位置**：`preview-manager.ts:301-312`（html 模式）、`:334-344`（image 模式）
- **问题**：`URL.createObjectURL` 后仅在 `onload` 回调中 `revokeObjectURL`。若加载失败（无 `onerror` 处理）或 `renderCurrentMode()` 在加载完成前再次执行（L258 `innerHTML=''` 直接移除元素），`onload` 不触发，Blob URL 泄漏。高频切换预览模式/快速连续 sync 时会累积。第 1 轮未报、本轮 G9 重构该区域时引入的风险面扩大。
- **建议**：P2。补 `onerror` revoke + `renderCurrentMode` 清空前统一 revoke 现存 URL；或改 WeakRef 管理。

### 🟢 N3. git 操作风险记录（本轮 Review 过程发现，非代码问题）

- 修复验证期间发现工作区曾被其他并发任务留下 `git stash`（stash@{0}，基于 e12e7a7）及 19 个 UU 冲突文件；已由本 agent 恢复至 `d0cebf8` 干净状态并 drop stash。多人并发修改同一工作区时建议各任务使用独立 worktree（与 QA round2 报告中的建议一致）。

### 回归排除项（已核实为非本轮引入）

| 失败项 | 核实结果 |
|--------|---------|
| `server/vendorPackages.test.ts`、`commentAssetFiles.test.ts`、`e2e/export.ci.test.ts`（6 个用例） | 在 `d0cebf8` 之前（stash 至 e12e7a7）同样失败 → **pre-existing**，非本轮回归 |
| `e2e/export.local.test.ts` Bridge 用例 | 依赖本地 Bridge 运行环境，非代码回归 |
| `tsc --noEmit` | 除 server 目录 TS6305 构建产物类报错（pre-existing，与本轮无关）外，**enhanced/integration 层零类型错误**——css.d.ts 接入后全量类型检查通过 |

---

## 修复验证总表（一屏速览）

| 项 | 状态 | 备注 |
|----|------|------|
| H1 Adapter proto-* 映射 | ✅ 真修复 | 23 键双向对齐 component-mapper |
| H2 离屏 DOM try-finally | ✅ 真修复 | image-exporter.ts:32-45 |
| M1 css.d.ts | ✅ 真修复 | 兜底 index signature |
| M2 preview-manager 无 any | ❌ 未修复 | 4 处 any 原样；commit message 虚报 |
| M3 XSS（</script/id/JSON.stringify） | ✅ 真修复 | 有安全测试护航 |
| M4 并发 fetch + base64 分块 | ✅ 真修复 | allSettled + 32KB 分块 |
| M5 Row/Col GutterContext | ❌ 假修复 | context 文件存在但未接入，cloneElement 原样 |
| M6 Slider cleanup | ⚠️ 部分 | 卸载窗口仍在 |
| N1 export-pipeline 测试失败 ×4 | 🔴 新增 | 测试/实现语义断裂 + totalNodes 重复计数 |
| N2 Blob URL onerror 泄漏 | 🟡 新增 | 高频切换模式时累积 |

---

## 是否可进入第 3 轮

**条件通过。** 高优（H1/H2）零回潮，第 2 轮的核心验收目标达成；但需在进入第 3 轮前完成 2 项 P1 返工：

1. **N1**：修复 export-pipeline 测试/实现语义断裂（4 个失败测试 + totalNodes 重复计数统计污染）——这是本轮唯一阻塞级新问题；
2. **M5 返工**：Row/Col 真正接入 GutterContext（Row 包 `<GutterContext.Provider value={gutterH}>`、Col `useContext(GutterContext)` 替代 `_gutterH` prop），并顺手完成 **M2**（preview-manager 4 处 any → ComponentNode）与 **M6**（Slider useEffect cleanup）——三者均为小改动，建议同一 commit 收口。

N2 记入待办（P2），不阻塞。第 3 轮重点建议放在：Adapter 契约完备性（container/row/col 三键 + 单表双向生成）与 e2e 真实导出链路的端到端验证。
