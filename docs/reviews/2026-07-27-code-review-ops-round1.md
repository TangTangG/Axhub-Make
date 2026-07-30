# 运营代码 Review — 第 1 轮（数据埋点 / 增长 / 隐私 / 品牌）

> 项目：axhub-proto-enhanced v1.0.0
> 审查人：运营
> 日期：2026-07-27
> 审查范围：`src/enhanced/analytics/`（events / metrics / tracker / types）、`src/enhanced/index.ts`、`src/enhanced/preview/html-exporter.ts`、`src/enhanced/export/export-pipeline.ts`、`openspec/changes/enhance-prototype-tool/ANALYTICS_SPEC.md`，并对全仓库做了埋点调用 grep 扫描。

---

## 一、结论（TL;DR）

**埋点系统目前处于"SDK 骨架完成、业务接入为零"的状态，不可进入第 2 轮 Review。**

- ✅ 已就绪：`tracker.ts` 客户端 SDK（队列 / 批量 flush / 关键事件立即上报 / localStorage 离线缓存 / sendBeacon 兜底 / 失败重试 ≤3 次）、19 个事件常量定义、3 个北极星指标计算函数、公共属性结构，与 ANALYTICS_SPEC.md §4.1 的设计高度一致。
- ❌ 阻断性缺口：**全仓库业务代码中没有任何一处 `tracker.track(...)` 调用**（grep 证据见 §四），事件仅被定义、从未被触发；服务端接收端点 `/api/analytics/track` 不存在；`prompt_text` 在类型层声明为原文上报、无任何脱敏实现；导出 HTML 无品牌标识/水印；spec 中"分享"环节在事件体系中完全缺失。
- 运营视角判断：以当前代码上线，数据面板将是一块**全零的白板**——19 个事件、3 个北极星指标、激活漏斗、留存指标全部无从谈起。

**是否可进入第 2 轮：否（No-Go）。** 需先完成高危项 H1–H4（埋点业务接入、服务端接收、prompt 脱敏、品牌水印）后重新提交第 1 轮复审。

---

## 二、按审查重点逐项核对

### ① 埋点实现与 ANALYTICS_SPEC.md 一致性（19 事件 + 3 北极星指标）

**事件定义层：一致 ✅**
- `events.ts` 定义了 19 个事件常量，与 spec §2.2 五类（激活漏斗 5 + 导出 6 + 预览 3 + 组件 2 + 错误 3）**逐一对应，无遗漏、无多定义**。
- `EVENT_PRIORITY` 中 P0/P1/P2 与 spec 表格完全一致（如 `export_batch`=P1、`preview_iframe_load`=P2）。
- `CRITICAL_EVENTS` 集合（app_open / ai_generate_fail / export_axure_fail / error_boundary / api_error）对应 spec §4.1 "关键事件立即上报"语义。
- `types.ts` 各事件的 Properties 接口与 spec 表格中的自定义属性逐项吻合（含 `export_image` 的 `format/dpi/file_size_kb/duration_ms`、`bridge_disconnect` 的 `last_success_time/retry_count` 等）。

**指标计算层：基本一致，2 处偏差 ⚠️**
- `metrics.ts` 实现了全部 3 个北极星指标（WAU-Export / AI 采纳率 / 导出成功率），目标值（100 / 60% / 90%）与 spec §3.1 一致。
- 偏差 1（中）：**导出成功率公式被错误地计入分母**。`EXPORT_START_EVENTS` 包含了 `EXPORT_HTML` 和 `EXPORT_IMAGE`，但这两个事件在 spec 中是"点击即触发"的单一事件（没有对应的 `_start`），而 `EXPORT_AXURE_START` 才是真正的一次"尝试"。当前实现会让每次成功的 HTML/图片导出同时 +1 分母 +1 分子，把成功率**系统性地推向虚高**（Axure 失败会被 HTML 成功稀释）。spec 公式是 `COUNT(export_success) / COUNT(export_start)`，实现与 spec 的事件归类不一致。
- 偏差 2（低）：AI 采纳率 spec 定义是 "生成后**未手动修改**直接导出"，实现用 "5 分钟内首次导出" 近似。spec §3.1 计算方式本身也写了 `first_export_within_5min`，所以实现是忠于 spec 的；但 spec 指标语义与计算方式自相矛盾（"未手动修改"无法用现有事件判定，因为根本没有"编辑"类事件），建议 spec 侧修订措辞，否则该指标名不副实。

**触发层：完全缺失 ❌（见问题 H1）**

### ② 数据流完整性（触发 → 本地缓存 → 批量发送 → 离线恢复）

| 链路环节 | spec 要求 | 实现状态 |
|---|---|---|
| 事件触发 | 19 个业务触发点 | ❌ **0 处接入** |
| 内存队列 | 队列 + 满 100 自动 flush | ✅ `tracker.ts` L73–81 |
| 关键事件立即上报 | isCriticalEvent → flush | ✅ L75–77 |
| 定时 flush 30s | flushInterval=30000 | ✅ L137–139，可配置 |
| 批量发送 | POST /api/analytics/track | ⚠️ 客户端 fetch 就绪，**服务端路由不存在** |
| 失败重试 | 最多 3 次重新入队 | ✅ L101–108（`retryCount` 过滤 + unshift） |
| 离线缓存 | beforeunload → localStorage | ✅ L141–153，且**超出 spec 地增加了 `sendBeacon` 兜底**（好评） |
| 启动恢复 | 读取缓存→入队→flush | ✅ L164–178，含脏数据容错 |
| 服务端存储 | /api/track → 校验 → SQLite | ❌ 未实现（grep 无任何 `analytics/track` 路由） |
| 实时聚合 / 每日批处理 | 内存聚合 + cron | ❌ 未实现 |
| 分析面板 | 仪表盘/漏斗/事件查询 | ❌ 未实现 |

客户端 SDK 本身质量较好（destroy 时落盘、localStorage 写满容错、`keepalive: true`），但**整条链路在"触发"和"服务端"两端断头**，中间件再完善也没有数据流过。

另外两个 SDK 层小问题：
- `TrackEvent` 顶层已有 `timestamp`，`properties` 内又带一份公共属性 `timestamp`（types.ts L8），同值冗余，服务端入库时容易混淆该用哪个。
- `metrics.ts` 的 `computeAllMetrics` 要求传入全量事件数组做内存计算，属于离线/测试工具，没有与任何存储层或定时任务挂钩，当前是"死代码"。

### ③ 用户行为漏斗覆盖（生成 → 编辑 → 导出 → 分享）

| 漏斗环节 | 事件 | 定义 | 触发接入 |
|---|---|---|---|
| 访问 | `app_open` | ✅ | ❌ |
| 生成 | `ai_generate_start/success/fail` | ✅ | ❌ |
| 预览 | `preview_mode_switch/iframe_load/interaction` | ✅ | ❌ |
| **编辑** | （无事件） | ❌ **缺失** | — |
| 导出 | `first_export` + 6 个导出事件 | ✅ | ❌ |
| **分享** | （无事件） | ❌ **缺失** | — |

- spec §3.2 激活漏斗的"预览"阶段定义是"`preview_mode_switch` 或停留 30s+"，但**"停留 30s"没有任何对应事件或计时机制**，该转化路径无法度量。
- **编辑环节无埋点**：组件在画布上的增删改（生成结果是否被手动调整）完全没有事件，这直接导致北极星指标"AI 采纳率（未手动修改直接导出）"的分母语义无法验证——目前只能用 5 分钟时间窗近似，长期看需要补 `component_edit` / `canvas_modify` 类事件。
- **分享环节整体缺席**：spec 全文（grep 验证）没有任何 share 相关事件，`src/enhanced/` 下也没有任何分享功能代码。若 v1.0 定位包含"导出物传播/裂变"（见审查重点⑤），则漏斗在"导出→分享"处断链，运营无法评估导岀物的二次传播效果。需要产品侧明确：v1.0 是否有分享功能？若有，补 `share_link_create` / `share_open` 事件；若无，在 spec 中显式声明延期。

### ④ 隐私合规（prompt_text 脱敏、数据最小化）

**这是本次审查最严重的合规风险点。**

- spec §2.2 明确写 `ai_generate_start` 携带 `prompt_text` **（脱敏）**，但 spec §五又写"仅采集功能使用数据，**不采集输入内容**"——spec 自身已矛盾。
- 实现选择了矛盾中更危险的一侧：`types.ts` L26 把 `prompt_text: string` 声明为**必填属性**，全仓库 grep 不到任何脱敏/哈希/截断函数。一旦 H1 的接入按类型定义照抄实现，**用户输入的原始 prompt 将被原文上报并存入本地 SQLite**——用户 prompt 可能包含公司内部业务描述、未公开产品规划、人名等敏感信息，这是明确的 PII/商业机密泄露面。
- 数据最小化其他核对：
  - 用户标识：匿名 ID（localStorage 生成，`anon_*`）✅ 符合 spec；
  - `user_agent` / `url` / `referrer` 作为公共属性全量上报——`url` 和 `referrer` 可能携带查询参数中的敏感信息（如内网域名、token），建议至少做 query string 剥离（中风险）；
  - `error_message`、`component_stack` 原文上报，可能夹带用户内容片段，建议服务端侧做长度截断与关键词过滤（低风险）。
- **退出开关未实现**：spec §五承诺"提供'退出数据分析'开关"。`TrackerConfig.disabled` 只在构造时读取一次（L54），没有任何运行时切换 API（如 `setEnabled(false)` / `optOut()`），更没有 UI 入口。目前用户没有任何手段撤回同意。
- **数据保留策略未落地**：spec 承诺"原始事件保留 90 天"，服务端/清理 cron 不存在，无从执行。

### ⑤ 导出物品牌标识 / 分享机制

- `html-exporter.ts` 的 `assembleHtml()`（L340–368）生成的 HTML **只有标题和根 div，没有任何品牌水印、footer、"Powered by Axhub" 标识或生成来源注释**。`export-pipeline.ts`（Axure JSON 导出）同样无任何元信息注入（grep `watermark|brand|Powered by|logo` 全为空）。
- 运营视角：导出的 HTML 是产品最天然的传播物料——用户把原型链接/文件发给同事、客户时，**每一个导出物都是一次零成本获客曝光**。当前导出物完全匿名，等于主动放弃这条增长通路。
- 建议（中优先级，不阻断 v1.0 但强烈建议本期补）：
  1. HTML 导出物 `<head>` 注入 `<!-- Generated by axhub-proto-enhanced v1.0.0 -->` 注释 + `<body>` 末尾可选的轻量 "Made with Axhub" 角标（可在 export options 中提供 `branding: boolean` 开关，默认开启）；
  2. Axure 导出 JSON 的 document 层加 `generator` 元字段；
  3. 配合审查重点③补分享事件，否则品牌曝光带来的回流无法度量。

---

## 三、grep 扫描证据（埋点调用零接入）

```
$ grep -rn 'trackEvent|tracker\.track|\.track(' src/enhanced/ --include='*.ts' --include='*.tsx'
  （除 analytics/tracker.ts 自身定义外）→ 0 条结果

$ grep -rn 'AnalyticsEvents' src/ --include='*.ts' --include='*.tsx' | grep -v 'src/enhanced/analytics'
  → 仅 src/enhanced/index.ts 的 4 行 re-export，无任何业务文件 import

$ grep -rn 'api/analytics|analytics/track' src/ --include='*.ts'
  → 仅 tracker.ts L11 的 endpoint 常量，服务端无路由

$ grep -rn 'prompt_text' src/
  → 仅 types.ts L26 类型声明，无脱敏实现

$ find tests -iname '*analytic*' / grep -l 'tracker|analytics' *.test.ts
  → 无任何埋点相关测试
```

`src/enhanced/index.ts` 仅将 analytics 四个模块 re-export，未在任何应用入口处实例化/触发 `app_open`——连全局单例 `tracker`（tracker.ts L184 模块加载即构造）都因无人 import 而不会被加载。

---

## 四、问题清单（按优先级分级）

### 🔴 高（阻断发版 / 阻断第 2 轮）

| # | 问题 | 位置 | 要求 |
|---|---|---|---|
| H1 | **19 个事件全部零触发**：业务代码无任何 `tracker.track()` 调用，`app_open` 都未在应用入口接入 | 全局 | 按 spec §2.2 在生成按钮、导出按钮、预览切换、错误边界、API 拦截器、Bridge 断开等全部触发点接入埋点；接入后提供触发点清单供运营核对 |
| H2 | **prompt_text 原文上报风险 + 无脱敏实现**，且与 spec §五"不采集输入内容"自相矛盾 | `types.ts:26`、ANALYTICS_SPEC §2.2/§五 | 二选一：(a) 按 §五删除 `prompt_text`，只保留 `prompt_length`（运营推荐，数据最小化）；(b) 保留则必须实现脱敏（哈希或仅保留前 N 字符+去 PII），并修订 spec §五。第 2 轮复审前必须闭环 |
| H3 | **服务端接收链路不存在**：`/api/analytics/track` 路由、SQLite 表、数据校验均未实现 | `src/server/` | 按 spec §4.2/§4.3 实现接收端点 + 建表 + 校验；否则客户端 flush 永远 404（且注意：fetch 对 404 不抛异常，事件会被静默丢弃——重试逻辑只对网络错误生效，见 M4） |
| H4 | **"退出数据分析"开关缺失**：spec §五承诺的 opt-out 无 API、无 UI | `tracker.ts`、设置页 | 增加运行时 `setEnabled/optOut` 方法（含清空本地队列与匿名 ID）+ 设置页入口 |

### 🟡 中（应在 v1.0 内修复）

| # | 问题 | 位置 | 要求 |
|---|---|---|---|
| M1 | 导出成功率公式失真：`EXPORT_HTML`/`EXPORT_IMAGE` 同时计入分子分母，Axure 失败被稀释 | `metrics.ts:21–25` | 分母改为仅 `export_axure_start` + 为 HTML/图片补充 start/fail 事件，或按导出类型分开计算成功率 |
| M2 | 导出 HTML / Axure JSON 无品牌标识，传播通路浪费 | `html-exporter.ts:340`、`export-pipeline.ts` | 注入 generator 注释/元字段 + 可选 "Made with Axhub" 角标（带开关） |
| M3 | 分享环节事件与功能双双缺失，漏斗断链 | spec §2.2 / 全局 | 产品确认 v1.0 分享范围；有则补 `share_*` 事件，无则 spec 显式声明延期 |
| M4 | `flush()` 只对网络异常重试，HTTP 4xx/5xx 响应视为成功，事件静默丢失 | `tracker.ts:94–100` | 检查 `response.ok`，非 2xx 也走重试入队 |
| M5 | "预览停留 30s" 漏斗节点无对应事件/计时机制 | spec §3.2 | 补 `preview_dwell_30s` 事件或修订漏斗定义 |
| M6 | 公共属性 `url`/`referrer` 原文上报，可能泄露 query 参数 | `tracker.ts:132–133` | 上报前剥离 query string / hash |

### 🟢 低（建议改进）

| # | 问题 | 位置 |
|---|---|---|
| L1 | `TrackEvent` 顶层与 `properties` 内 `timestamp` 冗余，易混淆 | `types.ts:8,164` |
| L2 | `metrics.ts` 的 compute 函数为纯内存计算，未接入任何存储/调度，当前是死代码；且无埋点相关单测 | `metrics.ts`、`tests/` |
| L3 | `error_message`/`component_stack` 原文上报，建议服务端长度截断 + 敏感词过滤 | spec §4.2 |
| L4 | spec §3.1 "AI 采纳率"指标语义（未手动修改）与计算方式（5 分钟导出）不一致，且"编辑"无事件可验证 | ANALYTICS_SPEC §3.1 |
| L5 | 90 天数据保留清理策略无落地机制 | spec §五 |
| L6 | `tracker` 模块级单例在 import 即构造（注册 beforeunload 监听），测试环境/SSR 不友好，建议惰性初始化 | `tracker.ts:184` |

---

## 五、是否可进入第 2 轮

**否（No-Go）。**

进入第 2 轮的前置条件：
1. **H1 埋点接入完成**——提供全部触发点清单 + 可复现的触发演示（或单测断言），运营按 spec §2.2 的 19 事件逐项核对；
2. **H2 prompt 合规闭环**——删除或脱敏，spec 同步修订；
3. **H3 服务端接收链路可用**——端到端跑一次「触发→本地缓存→批量发送→SQLite 落库」；
4. **H4 opt-out 开关可用**。

中危项 M1–M6 允许与第 2 轮并行修复，但 M1（成功率公式）和 M2（品牌标识）强烈建议本期闭环——前者直接污染北极星看板，后者错过 v1.0 的首波传播窗口。

---

## 六、正向评价（值得保留的设计）

- `tracker.ts` 的离线恢复设计完整（beforeunload 落盘 + sendBeacon 兜底 + 启动恢复 + 脏数据容错 + 重试上限），超出 spec 要求；
- 事件优先级体系（P0/P1/P2 + CRITICAL_EVENTS 立即上报）在定义层落地得很干净；
- 匿名用户 ID 方案符合隐私预期；
- `types.ts` 事件属性接口与 spec 表格逐项对齐，类型约束可减少接入时的属性缺漏——前提是接入真正发生。
