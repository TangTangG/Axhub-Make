# axhub-proto-enhanced v1.0.0 代码 Review — 第 1 轮（FE）

- **审查人**：FE（前端开发）
- **日期**：2026-07-27
- **范围**：`src/enhanced/**`（components/basic·form·layout、tokens、export、preview）、`src/integration/**`
- **审查重点**：① TS 类型安全 ② 组件复用与架构 ③ 性能隐患 ④ 边界 case ⑤ Design Token 一致性（零硬编码色值）

---

## 结论

**整体质量良好，但有 2 个高优先级问题必须在进入第 2 轮前修复**（Adapter 类型契约不一致 + image-exporter 离屏 DOM 泄漏）。Design Token 体系整体合规（`.tsx` 中零硬编码色值，hex 全部收敛于 tokens.css 单一来源），组件实现规范、事件监听清理基本到位。**结论：修复 P0 问题后可进入第 2 轮。**

---

## 问题清单

### 🔴 高（P0 — 阻塞进入第 2 轮）

#### H1. `integration/adapter.ts` 组件类型契约与 enhanced 层完全脱节

- **位置**：`src/integration/adapter.ts:68, 111-135`（`mapUpstreamType` / `mapToUpstreamType`）
- **问题**：Adapter 产出的 `ComponentNode.type` 使用 `'rectangle'`、`'button'`、`'date-picker'` 等裸类型，而 enhanced 层全部消费方均以 `'proto-*'` 前缀作为键：
  - `component-mapper.ts` 的 `COMPONENT_TO_AXURE_WIDGET` 键全部是 `'proto-rectangle'` / `'proto-button'` / …；
  - `html-exporter.ts:163` 与 `image-exporter.ts:327` 的 `tagMap` 键全部是 `'proto-image'` / `'proto-input'` / …。
- **后果**：上游数据经 Adapter 转换后，所有组件在 `getWidgetMapping()` 中全部落入默认降级分支（`rectangle` + `placeholder`）；`resolveHtmlTag()` 永远返回 `'div'`，图片/输入框导出为错误的 HTML 标签。**整条「上游 → 导出」链路实际不可用**，属于集成断链。
- **建议**：二选一（推荐前者）：① Adapter 的 typeMap 统一映射到 `'proto-*'` 命名空间（`rect → 'proto-rectangle'`、`datepicker → 'proto-date-picker'` 等），并删除 adapter.ts:68 的 `type: 'rectangle'` 裸类型兜底；② 或在类型层定义 `type ComponentType = 'proto-button' | …` 联合类型，让编译器拦截此类漂移。同时 `mapUpstreamType`/`mapToUpstreamType` 两张表存在重复维护，建议用一张双向表生成，避免未来单边漏改。

#### H2. `image-exporter.ts` 离屏 DOM 在异常路径泄漏

- **位置**：`src/enhanced/preview/image-exporter.ts:29-50`（`exportImage`）
- **问题**：`renderToOffscreenDom()` 将 `container` 挂到 `document.body`，清理依赖函数末尾的 `document.body.removeChild(container)`（L44）。但中间任一环节抛错（`waitForResources` 之外的 `htmlToCanvas` 抛 "无法创建 Canvas 2D 上下文"、`loadImage` reject、`elementToSvgDataUrl` 异常等）都会跳过 removeChild，离屏节点永久残留在 DOM 中。连续失败导出会累积隐藏节点。
- **建议**：用 `try { … } finally { document.body.removeChild(container); }` 包裹渲染与导出逻辑。另外 `canvas` 与 `Image` 对象在失败时也应显式置空辅助 GC（次要）。
- **附注**：同文件 `loadImage` 的错误信息将 dataURL 截断到 100 字符，实际排查价值有限（低）。

---

### 🟡 中（P1 — 本轮修复或排入第 2 轮修复计划）

#### M1. CSS Modules 无类型声明，`styles['button--loading']` 等为隐式 any

- **位置**：全部组件 `import styles from './xxx.css'`；`src/scss.d.ts` 仅声明了 `*.scss`，**未声明 `*.css`**。
- **问题**：`styles.button` / `styles[\`button--${type}\`]` 在 TS 下要么编译报错被静默忽略、要么整个 `styles` 是 `any`，意味着 class 名拼写错误（如 `button--loading` vs `button--load`）在编译期完全无法发现，运行时退化为样式丢失。当前 `styles[\`button--${type}\`]` 这类动态键更是类型黑洞。
- **建议**：接入 `vite-plugin-checker` 的 typescript-plugin-css-modules 或生成 `*.css.d.ts`（`declare const styles: { readonly [k: string]: string }` 兜底亦可）。

#### M2. `PropSchema.default: any` 与 `preview-manager.ts` 的 `node: any` 穿透类型边界

- **位置**：`src/enhanced/components/types.ts:55`（`default: any`）、`preview/preview-manager.ts:384,388,422`（`renderNodeInline(node: any)`、`walk(node: any)`）、`preview-manager.ts:39`（`payload?: any`）
- **问题**：`PropSchema.default` 的 `any` 有设计合理性（异构默认值），但 preview-manager 内部对 ComponentNode 走 `any` 属于绕开已有类型定义——该模块明明 import 了 `ComponentTree`，递归却退化成 `any`，树形数据一旦字段漂移（如 `children` 改名）只能在运行期炸。
- **建议**：`renderNodeInline(node: ComponentNode)`、`walk(node: ComponentNode)` 直接复用已有接口；`payload?: any` 改为 `unknown` + 各事件类型的泛型映射。

#### M3. `html-exporter.ts` 交互脚本注入存在 XSS / 注入风险

- **位置**：`src/enhanced/preview/html-exporter.ts:255-272`（`generateInteractionCode`）
- **问题**：`params.url` 经 `escapeJs` 后拼进 `'…'` 字符串字面量，但未处理 `</script>` 闭合逃逸（URL 中含 `</script><script>…` 序列时 `escapeJs` 不拦截 `<`/`>`，`assembleHtml` 直接拼进 `<script>` 块，可注入任意脚本）。`nodeId`/`targetId` 拼进 querySelector 字符串同样未过滤双引号。
- **建议**：scriptBlock 拼装前对整体做 `</script` → `<\/script` 替换；id 参数校验为 `[\w-]+`；或改用 `JSON.stringify` 注入字符串字面量。

#### M4. `html-exporter.ts` 大文件 base64 转换阻塞主线程 + 逐 URL 串行 fetch

- **位置**：`arrayBufferToBase64`（L402-409，`String.fromCharCode` 逐字节拼接）与 `inlineResources`（L230 起，`for…of await` 串行）
- **问题**：① 逐字节拼字符串对大图（数 MB）是 O(n) 字符串拷贝，明显卡顿；② 资源内联串行 fetch，N 张图 = N 个 RTT 叠加。
- **建议**：`String.fromCharCode.apply` 分块（每 32KB）或 `FileReader.readAsDataURL`；资源内联改 `Promise.allSettled` 并发 + 总预算闸门（现有 maxFileSize 检查逻辑可保留在合并阶段）。

#### M5. `Row.tsx` 的 `_gutterH` 通过 cloneElement 隐式注入，类型与复用双输

- **位置**：`src/enhanced/components/layout/Row.tsx:42-49`、`Col.tsx` 的 `_gutterH?: number`
- **问题**：`React.cloneElement(child as React.ReactElement<any>, { _gutterH })` —— 下划线私有 prop 约定脆弱（任何中间包装组件都会吞掉该 prop 且无任何警告），`as React.ReactElement<any>` 再次击穿类型。
- **建议**：改用 React Context（`GutterContext`）传递 gutter，Col 内部 `useContext` 消费；公开 API 更稳，也消除一个 any。

#### M6. `Slider.tsx` 拖拽期间组件卸载的监听残留窗口

- **位置**：`src/enhanced/components/form/Slider.tsx:65-80`
- **问题**：`mousemove`/`mouseup` 挂到 document 的清理依赖 `handleMouseUp` 触发。若拖拽中组件被卸载（弹层关闭/路由切换），`handleMouseUp` 永远等不到触发，两个 document 级监听残留并持有已卸载组件闭包。
- **建议**：`useEffect` 返回的 cleanup 中执行 `handleMouseUp`（或将拖拽状态收敛进 useEffect 由依赖驱动注册/注销）。

---

### 🟢 低（P2 — 记录待办）

| # | 位置 | 问题 | 建议 |
|---|------|------|------|
| L1 | `basic/tokens.css` 全量 + form/basic 各 `.css` | 14 处 `rgba(0,102,204,0.15)` 等 focus ring 色值硬编码（grep 命中的 20 处 hex 全部位于 tokens.css 本身——属合法单一来源；rgba 则散落于 7 个组件 css，语义上是 token 的 alpha 变体） | tokens.css 增补 `--color-focus-ring` / `--color-error-ring` 变量，组件引用变量 |
| L2 | `adapter.ts:58-68` | `convertElementsToNode` 取 `elements[0]` 作根，其余顶层元素静默丢弃；空数组返回的 root 硬编码 `type: 'rectangle'` | 多根时包一层 container 节点，或抛出带提示的 warning |
| L3 | `html-exporter.ts:75` vs `image-exporter.ts:330` | `extractTextContent`（含 `value`）与 `extractText`（不含 `value`）行为不一致，同一棵树两种导出文本内容可能不同 | 抽公共 util 统一取值优先级 |
| L4 | `axure-mapper.ts:13-19` | `parsePixelValue` 解析失败静默返回 0（如 `width: 50%` → 0px），导出尺寸塌陷且无 warning | 解析失败时写入 warnings 数组 |
| L5 | `DatePicker.tsx:226`、`Select.tsx:144` | `key={index}`（DatePicker days）/ `key={option.value}`（重复 value 会撞 key） | DatePicker 用 `item.day + item.outside` 复合 key；Select 文档注明 value 唯一性约束 |
| L6 | `adapter.ts:22-29` | `isAvailable()` / `getVersion()` 无超时，bridge 挂起时 UI 同步卡死 | 加 `AbortSignal.timeout(3000)` |
| L7 | `image-exporter.ts:196-206` | `calculateBounds` 对 `left/width` 为字符串（'100%'）的节点按 0 处理 | 与 L4 同步在 warning 中体现 |

---

## 审查维度小结

| 维度 | 评价 |
|------|------|
| ① TS 类型安全 | 中等偏上：核心 interface 完备（types.ts/integration/types.ts），但 `styles: any`（M1）、preview-manager 内部 any（M2）、Row cloneElement any（M5）三处穿透需收敛 |
| ② 复用与架构 | 良好：组件 Props 风格统一（className/style 透传、联合字面量），export/preview/integration 分层清晰；扣分点为 adapter ↔ mapper 命名空间脱节（H1）与两份类型映射表重复维护 |
| ③ 性能隐患 | 组件层健康（无大列表渲染场景）；导出层有 base64 主线程阻塞与串行 fetch（M4）、离屏 DOM 泄漏（H2）、Slider 监听残留窗口（M6） |
| ④ 边界 case | 中等：监听器 cleanup 大体到位（DatePicker/Select/Modal/Drawer 均正确 return cleanup）；但 Adapter 空 elements/多根、parsePixelValue 失败、fetch 无超时等边界静默吞掉 |
| ⑤ Design Token 一致性 | **基本达标**：`.tsx` 零硬编码色值；hex 全部收敛于 `tokens.css`（与设计 tokens.json 一一对应）；仅 14 处 rgba alpha 变体散落组件 css（L1） |

---

## 是否可进入第 2 轮

**条件通过**：修复 H1（Adapter 类型契约）与 H2（离屏 DOM finally 清理）后进入第 2 轮；M1–M6 建议在第 2 轮开始前一并处理或明确排期。L1–L7 记入待办即可。
