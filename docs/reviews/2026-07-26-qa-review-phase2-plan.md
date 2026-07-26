# 测试工程师 Review — Phase 2 实施计划

> 日期：2026-07-26
> 评审角色：资深测试工程师（QA）
> 评审对象：`openspec/changes/enhance-prototype-tool/PLAN.md` v2.0
> 对照文档：`TEST_SPEC.md` v1.0 / `COMPONENT_MATRIX.md` v1.0 / `DESIGN_SPEC.md` v1.0 / `design.md` / `ANALYTICS_SPEC.md` v1.0
> 评审维度：验收标准可测试性 / 测试计划完整性 / 风险对策可行性 / 遗留问题登记完整性

---

## 结论

### ⚠️ **有条件通过（Conditional Pass）**

PLAN.md 整体结构清晰、里程碑合理，TEST_SPEC.md 中 L1–L4 可编辑性矩阵、性能指标、容量上限、异常场景测试已达**可实现、可量化、可自动化**的验收基线水平，QA 在前 3 轮 Review 中提出的 P1/P4/P5 等高优问题（伪类映射、回滚策略、API 变更检测）确已在 PLAN 中闭环。但**遗留问题登记表与 TEST_SPEC.md 实际内容不一致**——表中声称"已修复"的 #2/#3/#4/#5 在 TEST_SPEC.md 中**未真正落实**，仅出现在遗留表的"已修复"标记中；任务 6.2 的 Axure 导入测试**断言方式不可执行**（无可编程验证接口）；E2E 测试未声明环境分层（CI mock vs 本地真实 Axure）。

修复 4 项高优问题（预计 0.5 人日）后可进入 Phase 3 开发。

---

## 问题清单

### 高优

#### H1. 遗留问题登记表与 TEST_SPEC.md 实际内容不一致（"已修复"未真正落地）

PLAN.md §十 遗留问题登记表声称以下 4 项"✅ 已修复"，但对照 TEST_SPEC.md / design.md 实际内容，**均未落实**：

| 登记项 | PLAN 声称 | 实际状态 | 证据 |
|--------|----------|---------|------|
| #2 容量上限定义 | ✅ 已修复（Phase 6） | ⚠️ **未在 TEST_SPEC.md §四 落实** | TEST_SPEC.md §4.2 容量上限表已存在（500 组件 / 8 层 / 1000 行 / 50 列 / 20 页 / 5MB / 10MB / 2MB）✅ —— 但 PLAN.md 任务清单中**无任何任务负责将容量上限的"超限处理"（提示/虚拟滚动/分片/压缩）落地为代码**，验收无任务载体 |
| #3 AI 异常输入三场景 | ✅ 已修复（Phase 6） | ⚠️ **TEST_SPEC.md §6.1 已包含**（非法 JSON / 未知组件 / 循环嵌套 / 空响应 / 超时）✅ —— 但 PLAN.md 任务清单中**无任何任务负责实现这些异常的捕获与用户提示**，Phase 3（Axure 导出）和 Phase 6（E2E）都未提及 AI 输入校验 |
| #4 回滚策略 | ✅ 已修复（Phase 1） | ❌ **PLAN.md Phase 1 任务 1.1–1.5 全部无"git tag + git reset"内容** | TEST_SPEC.md §3.4 回滚策略表已定义 ✅，但 Phase 1 的同步脚本 `scripts/sync-upstream.sh`（任务 1.4）和 CI workflow（任务 1.5）**均未包含打 tag / 失败回滚逻辑**，仅有"失败时创建 issue" |
| #5 上游 API 变更检测 | ✅ 已修复（Phase 1） | ❌ **PLAN.md Phase 1 无 UPSTREAM_API_LOCK.md / 符号漂移检测任务** | TEST_SPEC.md §3.5 上游 API 变更检测表已定义 ✅，但 Phase 1 任务清单中**无对应任务**负责生成符号清单、配置 CI 检测脚本 |

**风险**：遗留表是 Review 闭环的"账本"，账本与实际任务脱节会导致 Phase 6 验收时发现"已修复"的问题其实无人实施，造成里程碑滑期。
**对策**：
1. PLAN.md §十 登记表增加"**实施任务编号**"列，指向具体任务（如 #4 → 任务 1.6「同步 tag 与回滚机制」）。
2. 在 Phase 1 补一个**任务 1.6**：在 `sync-upstream.sh` 中成功同步后自动 `git tag upstream-sync-$(date +%Y%m%d)`；CI 失败 step 输出回滚命令；UPSTREAM_API_LOCK.md 初始化（先列 axhub-export-core 公共导出符号）。
3. 在 Phase 3 补一个**任务 3.4**：AI 输出 Schema 校验器（非法 JSON 拒绝 / 未知组件降级 / 循环嵌套截断），对应 TEST_SPEC §6.1。
4. 在 Phase 4 补一个**任务 4.3**：容量上限守卫（500 组件提示 / 表格 1000 行虚拟滚动 / 图片 >2MB 自动压缩），对应 TEST_SPEC §4.2。

#### H2. 任务 6.2「Axure 导入测试」断言方式不可执行

PLAN.md 任务 6.2 示例代码：
```typescript
const axureDoc = await importAxureFile('test-fixtures/basic-components.axure');
expect(axureDoc.widgets.rectangle.editable).toBe(true);
expect(axureDoc.widgets.chart.editability).toBe('L3');
```

**问题**：
- `importAxureFile` 函数在 design.md 与 PLAN.md 中**均未定义**——Axure `.rp` 是 zip + 私有 JSON 格式，无可编程的"导入并读取 editable 属性"接口。
- `editable: true` / `editability: 'L3'` 这两个字段在 Axure 文档模型中**不存在**——L1–L4 是 TEST_SPEC.md 定义的**人工操作路径**（双击修改文本/修改尺寸/添加交互），不是文档属性。
- 该任务实际只能**人工执行**（按 TEST_SPEC §1.2 的 15 个组件 × 操作路径逐一点击），不能写成 `expect(...)` 单元测试。

**对策**：将任务 6.2 拆为两层：
1. **自动化层（CI 可跑）**：导出 Bridge 请求体的快照测试——`expect(exportPayload.widgets[0].type).toBe('rectangle')`、`expect(exportPayload.widgets[0].style.fill).toBe('#0066cc')`，验证 CSS→Axure 映射正确性。这是真单元测试。
2. **人工验收层（每周一次）**：按 TEST_SPEC §1.2 的 15 条操作路径在真实 Axure RP 10 中逐项点击，填写《Axure 可编辑性验收 checklist》。产物为勾选表格，不是代码。
3. 验收标准改为：「自动化快照测试 100% 通过 + 人工 checklist 15/15 通过」。

#### H3. E2E 测试未声明环境分层（CI mock vs 本地真实 Axure）

PLAN.md 任务 6.1 的 E2E 测试代码：
```typescript
await page.click('[data-testid="export-axure"]');
await page.waitForSelector('[data-testid="export-success"]');
```

**问题**：
- "导出成功"依赖 Axure Bridge（localhost:32767）真实响应，但 **GitHub Actions ubuntu-latest 跑不了 Axure RP**（无 License、无 GUI）。
- QA 第 2 轮 P7 + 第 3 轮遗留 #7 均要求"双层策略"，PLAN.md §十 登记"E2E 测试环境分层 → 登记到 Phase 6"，但任务 6.1 代码示例**未体现任何 mock**。
- 若按当前代码提交，CI 上 E2E 必失败，反而成为阻塞。

**对策**：任务 6.1 验收标准补三条：
1. **CI 层**：使用 `msw` 或 `nock` mock Bridge `/available` 和 `/copyaxvg` 端点，断言请求体结构（合 design.md 协议）+ 断言 UI 状态流转。
2. **本地层**：增加 `npm run test:e2e:real-bridge` 脚本，连接真实 Axure Bridge，每周本地跑一次（或定时任务），结果记录到 `docs/qa/weekly-axure-check.md`。
3. **package.json scripts 显式区分**：`test:e2e`（CI，全 mock）/ `test:e2e:local`（真实 Bridge）。
4. TEST_SPEC.md §3.2 同步后必过测试清单每一项标注 `(CI)` 或 `(本地)`。

#### H4. 风险对策缺少可验证的触发条件与回退路径

PLAN.md §八 风险表仅有"概率 / 影响 / 对策 / 负责人"，从 QA 视角无法验证对策是否生效：

| 风险 | 当前对策 | 不可验证点 |
|------|---------|-----------|
| 上游同步冲突 | CI 自动检测，人工介入 | "介入"的 SLA？解决失败如何回滚？（关联 H1 #4） |
| Axure Bridge 不可用 | 降级策略：复制剪贴板 | 判"不可用"的超时阈值？3s？5s？TEST_SPEC §1.4 未量化 |
| CSS 映射不完整 | 降级策略：占位矩形 | "不完整"的覆盖率门槛？映射表 80% 覆盖是否算达标？ |
| 性能不达标 | 优化渲染，分批导出 | 不达标的判定时间点？每个 Phase 末还是 M8 才发现？ |
| 容量超限 | 提前预警，引导拆分 | "预警"是 UI 提示还是开发期 lint？（关联 H1 #2） |

**对策**：风险表增加两列——「**触发阈值**」「**验证方式**」。例如：
| 风险 | 触发阈值 | 验证方式 |
|------|---------|---------|
| Bridge 不可用 | 连续 3 次 `/available` 超时 ≥3s | 单元测试模拟 setTimeout 不响应 |
| CSS 映射不完整 | 映射覆盖率 <80%（按 COMPONENT_MATRIX 属性总数计算） | `scripts/coverage-css-map.ts` CI 跑 |
| 性能不达标 | 任务 6.1 E2E 中导出 >5s | CI 性能断言（Playwright timing API） |

---

### 中优

#### M1. 「三种模式一致性 ≤1px」硬指标与遗留表口径冲突

PLAN.md M6 验收标准仍写「三种模式一致性 ≤1px」，但 §十 遗留表 #9 已自承"跨浏览器 ≤1px 不可达"。两处口径冲突：M6 当硬指标 / 遗留表当不可达问题。TEST_SPEC.md §2.1 同样未区分同浏览器/跨浏览器。

**对策**：
- M6 验收标准改为：「**同浏览器**（Chrome 90+ 同版本）三种模式布局偏差 ≤1px；**跨浏览器**仅验证布局结构一致（DOM 树 diff 为空），像素偏差不作为阻塞」。
- TEST_SPEC.md §2.1 同步修订，删除"跨浏览器 ≤1px"暗示。
- 测试方法具体化：使用 Playwright `page.screenshot()` + `pixelmatch`，阈值 `maxDiffPixels: 0`（同浏览器）/ 仅做结构对比（跨浏览器）。

#### M2. 性能指标缺少测量任务载体

TEST_SPEC.md §4.1 给出 7 项性能指标（首屏 ≤3s / AI ≤10s / HTML 导出 ≤5s / 图片 ≤3s / 批量 10 页 ≤30s / 大页面 ≤5s / 内存 ≤500MB），但 PLAN.md 任务清单中**无任何任务负责建立性能测量基线**：
- 无 Lighthouse CI 集成
- 无 Playwright timing 断言
- 无 100/500 组件的 fixture 项目
- 无内存测量脚本

**对策**：在 Phase 6 增加**任务 6.4「性能基线与回归」**：
1. 创建 `test-fixtures/perf/small-10components.json` / `medium-100components.json` / `large-500components.json` 三个基准项目。
2. CI 中加 `npm run test:perf`：用 Playwright 计时 API 跑 7 项指标，超过阈值失败。
3. 在 M6/M7/M8 里程碑验收中各跑一次，输出趋势表（防止缓慢劣化）。

#### M3. 异常场景测试缺fixture数据与触发方式

TEST_SPEC.md §1.4 / §6.1–6.4 定义了 20+ 异常场景（Bridge 未启动 / 导出超时 / 非法 JSON / 循环嵌套 / 断网 / 内存不足…），但 PLAN.md 未说明：
- 测试用例的 fixture 在哪？（如"非法 JSON"是手工构造还是 fuzz？）
- "Bridge 未启动"在 CI 上如何模拟？（kill 进程？防火墙规则？）
- "内存不足"如何触发？（Chrome `--js-flags="--max-old-space-size=100"`？）

**对策**：任务 6.1 验收标准补一段「**异常用例矩阵**」：
| 异常 | 触发方式 | 断言 |
|------|---------|------|
| Bridge 未启动 | `msw` 返回 503 | UI 显示降级提示，剪贴板内容非空 |
| 导出超时 | `msw` delay 35s | 30s 后 UI 取消，提示重试 |
| 非法 JSON | fixture `invalid-json.ai-response` | 错误提示"AI 响应格式错误" |
| 循环嵌套 | fixture `circular-component.json` | 截断 + console.warn |
| 大 payload | fixture `large-12mb-project.json` | 触发分片（mock 验证 chunk 数 ≥3） |

#### M4. 埋点验收"必埋事件 100% 触发"未对齐 ANALYTICS_SPEC 的 19 个事件

PLAN.md 任务 5.1 验收「必埋事件 100% 触发」，但「必埋」清单未列出。ANALYTICS_SPEC.md §二 定义了 5（激活）+ 6（导出）+ 3（预览）+ 2（组件）+ 3（错误）= **19 个事件**，且标了 P0/P1/P2 优先级。PLAN.md §十 遗留表 #10 仅说"埋点定义双源重复 → 登记到 Phase 5"，未给出**收敛方案**。

**对策**：
1. 任务 5.1 验收标准改为：「P0 事件（11 个）100% 触发；P1（5 个）覆盖 ≥80%；P2（3 个）v1.0 可选」。清单引用 ANALYTICS_SPEC.md §二。
2. TEST_SPEC.md §七 整段删除，改为「引用 ANALYTICS_SPEC.md」，消除双源。
3. 任务 5.1 增加「**事件触发断言脚本**」：用 Playwright 跑核心用户路径，捕获 `fetch('/api/analytics/track')` 请求体，断言必埋事件触发。

#### M5. 验收标准中"L1 可编辑"依赖未定义的判定函数

PLAN.md M3/M4/M5 三个里程碑验收均为「导出后 L1 可编辑」，但：
- L1 在 TEST_SPEC §1.1 的定义是「文本、尺寸、位置、样式、交互均可编辑」—— 这是**人工操作路径**。
- PLAN.md 任务 6.2 尝试用 `expect(widget.editable).toBe(true)` 自动化（H2 已指出不可行）。
- 中间缺失一个**可自动化的代理指标**：导出 payload 中 `interactionStyles` / `size` / `position` / `font.color` 等关键字段是否完整？

**对策**：定义**「L1 自动化代理指标」**——L1 可编辑 ⟺ 导出 payload 满足：
- `widget.type` ∈ 已映射 widget 白名单（rectangle/text/text_field/button/...）
- `widget.style` 至少包含 `fill`、`font.color`、`border`、`cornerRadius`
- `widget.interactionStyles.hover` 存在（若 CSS 定义了 `:hover`）
- `widget.size` / `widget.position` 非默认 0 值

写成 `scripts/validate-l1-proxy.ts`，CI 跑。人工 15 路径 checklist 作为最终签核（每周一次）。

---

### 低优

#### L1. 任务 4.1 HTML 导出"三种浏览器兼容"未指明自动化还是人工

验收标准「Chrome/Firefox/Safari/Edge 可正常打开」未说明工具链。建议：用 Playwright 多 browser 项目跑 `chromium/firefox/webkit`，自动断言 `console` 无 error + 关键选择器存在；Edge 复用 Chromium 通道。Safari 在 CI 上只能用 WebKit 引擎近似，真实 Safari 需 macOS runner 或本地手动。

#### L2. Phase 6 任务编号与遗留问题登记不闭环

§十 遗留表 #6–#10 均登记"Phase 6"，但 Phase 6 仅有任务 6.1（E2E）和 6.2（Axure 导入）两个任务，**无任务 6.3/6.4/6.5** 承接这 5 项。建议补：
- 任务 6.3「测试环境分层落地」（承接 #7）
- 任务 6.4「性能基线」（承接 M2 + #2 容量）
- 任务 6.5「遗留问题回归 checklist」（承接 #6/#8/#9）

#### L3. 任务 2.1 设计 Token 的验收"与 DESIGN_SPEC.md 一致"无自动化校验

UI Review H1 已指出 PLAN 的 token JSON 与 DESIGN_SPEC 严重不一致（色值/命名/维度全不同），QA 视角补一刀：验收标准应改为**自动化 diff**——`scripts/validate-tokens.ts` 读取 DESIGN_SPEC.md 表格 + 读取 `design-tokens.json`，输出 diff，为空则通过。避免"一致"靠肉眼。

#### L4. 缺少 QA 环境准备清单

PLAN.md 未说明 QA 团队的环境依赖：Axure RP 10 License、测试用 macOS/Windows 机器、Bridge 安装包、测试 fixture 仓库位置。建议 §九「依赖与资源」补一节「**QA 资源**」。

#### L5. 里程碑 M3–M5 验收仅"L1 可编辑"一句，未对接 TEST_SPEC §1.2 的 15 条路径

M3/M4/M5 三周的验收标准都只有「导出后 L1 可编辑」，过于笼统。建议每个里程碑明确**当周覆盖的组件清单 + 对应 TEST_SPEC §1.2 操作路径编号**：
- M3 验收：矩形/文本/按钮/输入框 → TEST_SPEC §1.2 行 1–4
- M4 验收：下拉/单选/复选/表格 → 行 5–8
- M5 验收：导航/标签页/卡片 → 行 9–11

#### L6. 缺 v1.0 发布前的"QA 签核 checklist"

M8 验收「全部验收标准通过」笼统。建议补一份**发布前 QA 签核 checklist**：
- [ ] TEST_SPEC §1.2 15 条 L1/L2/L3 操作路径人工通过
- [ ] TEST_SPEC §2.1 三模式同浏览器 ≤1px（pixelmatch 报告附件）
- [ ] TEST_SPEC §4.1 7 项性能指标全部达标
- [ ] TEST_SPEC §4.2 8 项容量上限触发提示正确
- [ ] TEST_SPEC §5 浏览器矩阵 4×4 全通过（Safari 图片降级除外）
- [ ] TEST_SPEC §6 异常场景 20+ 条全部触发预期提示
- [ ] ANALYTICS_SPEC §二 P0 事件 11/11 触发
- [ ] Phase 1 上游同步 CI 连续 2 周成功

---

## 建议

### 1. 修补优先级与工作分配（预估 0.5 人日）

| 优先 | 修补项 | 工作量 | 责任方 |
|------|--------|--------|--------|
| P0 | H1 #4 回滚策略 → Phase 1 任务 1.6 | 1h | BE |
| P0 | H2 任务 6.2 拆为「自动快照 + 人工 checklist」 | 2h | QA + FE |
| P0 | H3 任务 6.1 补 msw mock 层 | 2h | FE |
| P0 | H4 风险表补「触发阈值 / 验证方式」两列 | 1h | QA |
| P1 | M1 M6 验收口径统一（同浏览器 ≤1px） | 30min | QA |
| P1 | M2 增加任务 6.4 性能基线 | 1h | QA |
| P1 | M4 任务 5.1 验收对齐 ANALYTICS_SPEC 19 事件 | 30min | BE |
| P2 | L3 token 自动 diff 脚本 | 1h | FE |

### 2. 流程建议

1. **测试左移到 Phase 2**：QA 在 Week 2（组件系统）就介入，每个组件交付时同步产出 storybook 状态用例 + 属性面板测试用例，避免 Phase 6 集中爆雷。
2. **建立「QA 签核」作为 Phase 门禁**：每个里程碑（M1–M8）验收会 QA 必须出席并签核，未签核不进入下一阶段。
3. **Axure 回归测试节奏**：CI 每次 push 跑 mock；每周一（与上游同步同日）跑本地真实 Bridge；每月一次完整 15 路径人工 checklist。三层节奏错开，平衡成本与覆盖。
4. **建立 bug Bash**：Week 7 末安排 0.5 天全员 bug bash，按 TEST_SPEC §6 异常矩阵逐项"打破"产品。

### 3. 工具链建议

| 用途 | 推荐工具 | 理由 |
|------|---------|------|
| E2E + Bridge mock | Playwright + msw | 同栈、拦截 fetch 简单 |
| 性能测量 | Playwright timing API + Lighthouse CI | 无需引入新工具 |
| 像素对比 | pixelmatch + playwright screenshot | 轻量、CI 友好 |
| 快照测试 | Jest + `jest-specific-snapshot` | 导出 payload 大对象 diff 友好 |
| Token 校验 | 自研 `scripts/validate-tokens.ts` | 读 markdown 表格 + JSON diff |

---

## 是否可进入 Phase 3 开发

### ⚠️ **暂不可，需先完成 4 项 P0 修补**

**理由**：Phase 3（Axure 导出增强）是 PLAN 中**技术风险最高**的环节，其验收依据（L1 可编辑 / Bridge 协议 / 异常降级）当前在测试侧存在三处不可执行的盲区（H2 断言方式、H3 环境分层、M5 代理指标）。若带盲区进入 Phase 3，Week 5 末会发现大量"代码写完但无法验证"的返工。

**进入 Phase 3 的前置条件**（按截止时间排序）：

| # | 条件 | 截止 | 责任方 |
|---|------|------|--------|
| 1 | H1 #4 修复：Phase 1 补任务 1.6 同步 tag + 回滚脚本 | Phase 1 结束前（Week 1 周五） | BE |
| 2 | H3 修复：任务 6.1 E2E 补 msw mock 分层方案 | Phase 2 结束前（Week 2 周五） | FE |
| 3 | H2 修复：任务 6.2 拆为「自动快照 + 人工 checklist」两层 | Phase 3 开始前 | QA + FE |
| 4 | H4 修复：风险表补「触发阈值 / 验证方式」 | Phase 3 开始前 | QA |
| 5 | M5 修复：定义 L1 自动化代理指标 + 校验脚本 | Phase 3 任务 3.3 完成前 | QA + FE |

**可并行启动 Phase 1（Week 1）**：Phase 1（项目初始化 + 上游同步）与上述修补无依赖，可按 PLAN 立即开始。Phase 2（Token + 组件）建议在 H1 #4 修复确认后启动。

**修补工作量预估**：4 项 P0 + 3 项 P1 共约 **0.5–1 人日**，纯文档 + 脚本工作，无架构变更。

---

## 评审记录

| 轮次 | 日期 | 评审角色 | 问题数 | 结论 |
|------|------|---------|--------|------|
| 需求第 1 轮 | 2026-07-26 | QA | 17 (T1–T17) | ❌ 打回 |
| 需求第 2 轮 | 2026-07-26 | QA | 7 项 P + 3 项 N | ✅ 有条件通过 |
| 需求第 3 轮 | 2026-07-26 | QA | 7 项 P 未解决 + 3 项 N 未解决 | ⚠️ 有条件通过（条件未满足） |
| **计划第 1 轮** | **2026-07-26** | **QA** | **4 高 / 5 中 / 6 低** | **⚠️ 有条件通过** |

---

*本报告基于 PLAN.md v2.0、TEST_SPEC.md v1.0、COMPONENT_MATRIX.md v1.0、DESIGN_SPEC.md v1.0、design.md、ANALYTICS_SPEC.md v1.0 及前 3 轮 QA Review 记录撰写。*
