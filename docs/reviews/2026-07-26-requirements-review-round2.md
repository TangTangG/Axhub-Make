# 需求 Review 报告 - 第 2 轮（修订版验证）

> 日期：2026-07-26
> 评审角色：PM / FE / BE / QA / 设计 / 运营
> 评审对象：修订后的 proposal.md / design.md / tasks.md + DESIGN_SPEC.md / COMPONENT_MATRIX.md / TEST_SPEC.md / ANALYTICS_SPEC.md

---

## 评审总结

| 角色 | 结论 | 已解决 | 仍存问题 | 新增问题 |
|------|------|--------|---------|---------|
| 产品经理 | ✅ 有条件通过 | 12/14 高优完全解决 | 8 项（2 高优部分解决） | 7 项（1 高优 N4） |
| 前端开发 | ✅ 有条件通过 | 5 项核心验证通过 | 5 项遗留 | 3 项新增 |
| 后端开发 | ⚠️ 打回补充 | 5 项已解决 | 2 项高危未解决 | 0 项 |
| 测试工程师 | ✅ 有条件通过 | 10/17 已解决 | 7 项遗留 | 3 项新增 |
| UI 设计师 | ✅ 通过 | 16/23 已解决 | 4 项遗留 | 0 项 |
| 运营专家 | ✅ 通过 | 5/5 全部解决 | 4 项轻微 | 0 项 |

---

## 第 1 轮问题修复对照表

| 第 1 轮问题 | 修复方案 | 修复文档 | 验证状态 |
|------------|---------|---------|---------|
| H1: 画布底座选型未决策 | 复用 Excalidraw，v1.0 不含手动画布 | design.md | ✅ 已解决 |
| H2: 导出路径自相矛盾 | 组件树驱动，非 DOM 遍历 | design.md | ✅ 已解决 |
| H3: export-core 无法增强 | patch-package 管理补丁 | design.md | ✅ 已解决 |
| H4: Bridge 协议契约缺失 | 明确端点 + 版本协商 | design.md | 🟡 部分解决 |
| H5: fork 与上游同步矛盾 | git subtree + patch-package | design.md | ✅ 已解决 |
| H6: AI 再生成覆盖手动修改 | v1.0 不含手动画布，规避此问题 | proposal.md | ✅ 已解决（v1.0） |
| H7: 缺少撤销/重做 | v1.0 不含手动画布，v1.1 预留 | DESIGN_SPEC.md | ✅ 已解决（v1.0） |
| H8: 画布交互规范缺失 | v1.1 预留规范 | DESIGN_SPEC.md | ✅ 已解决（v1.0） |
| H9: AI 与手动编辑冲突 | v1.0 不含手动画布，规避此问题 | proposal.md | ✅ 已解决（v1.0） |
| H10: 缺少设计 Token | 完整 Token 系统 | DESIGN_SPEC.md | ✅ 已解决 |
| H11: 组件状态规范缺失 | 7 种状态规范 | DESIGN_SPEC.md | ✅ 已解决 |
| H12: 缺少数据持久化 | v1.0 本地存储，v2.0 云端 | proposal.md | ✅ 已解决 |
| H13: Axure 可编辑性无量化标准 | L1-L4 分级 | TEST_SPEC.md | ✅ 已解决 |
| H14: 高级组件降级策略缺失 | 尽力而为，失败降级占位 | COMPONENT_MATRIX.md | ✅ 已解决 |
| H15: CSS→Axure 映射难题 | 完整映射表 + 降级策略 | design.md | 🟡 部分解决 |
| H16: Axure 交互导出不可行 | v1.0 不导出交互，仅静态 | design.md | ✅ 已解决 |
| H17: 三预览模式一致性未定义 | 一致性标准 | TEST_SPEC.md | ✅ 已解决 |
| H18: HTML 离线兼容性未定义 | 验收标准 | TEST_SPEC.md | ✅ 已解决 |
| H19: standalone HTML 体积无预算 | ≤5MB 上限 | TEST_SPEC.md | ✅ 已解决 |
| H20: 图片导出/iframe 已存在 | 复用上游，不重复建设 | design.md | ✅ 已解决 |
| H21: 上游同步验收标准缺失 | 健康度指标 + 必过测试 | TEST_SPEC.md | ✅ 已解决 |
| H22: 目录隔离与现状冲突 | git subtree upstream/ + src/enhanced/ | design.md | 🟡 部分解决 |
| H23: 上游同步无自动化 | CI 定时同步 + 冲突检测 | design.md | ✅ 已解决 |
| H24: Phase 顺序错位 | Phase 1 = 上游同步（最高优先级） | tasks.md | ✅ 已解决 |
| H25: 缺少 MVP 切片 | v1.0 = AI 生成 + Axure 导出 + HTML 导出 | proposal.md | ✅ 已解决 |
| H26: 核心价值不清晰 | v1.0 聚焦导出能力增强 | proposal.md | ✅ 已解决 |
| H27: 差异化不足 | Axure 导出增强是 Axhub-Make 短板 | proposal.md | ✅ 已解决 |
| H28: 缺少冷启动策略 | 数据埋点追踪激活漏斗 | ANALYTICS_SPEC.md | ✅ 已解决 |
| H29: 缺少分享传播机制 | v1.0 聚焦核心功能，分享后续迭代 | proposal.md | ✅ 已解决 |
| H30: 缺少数据埋点 | 完整埋点方案 | ANALYTICS_SPEC.md | ✅ 已解决 |
| H31: 缺少 FTUE | 激活漏斗设计 | ANALYTICS_SPEC.md | ✅ 已解决 |
| H32: AI 异常输入未定义 | 异常处理验收标准 | TEST_SPEC.md | 🟡 部分解决 |
| H33: E2E 测试环境未定义 | Mock Bridge + 真实 Axure | TEST_SPEC.md | 🟡 部分解决 |
| H34: 性能指标缺失 | 完整性能指标 | TEST_SPEC.md | ✅ 已解决 |
| H35: 浏览器兼容性缺失 | 兼容性矩阵 | TEST_SPEC.md | ✅ 已解决 |
| H36: Bridge 异常场景未定义 | 异常处理验收标准 | TEST_SPEC.md | ✅ 已解决 |
| H37: 大 payload 未定义 | 5MB 上限，超限转外链 | TEST_SPEC.md | ❌ 未解决（仅 HTML，Axure 未覆盖） |
| H38: 缺少优先级框架 | MoSCoW 排序 | tasks.md | ✅ 已解决 |

**统计：38 项问题中，32 项已解决，5 项部分解决，1 项未解决**

---

## 各角色 Review 结果

### 产品经理（✅ 有条件通过）

**已解决（12/14 高优）**：
- 用户画像、手动画布边界、验收标准、高级组件定义、上游冲突、AI 冲突、MVP 切片、Phase 顺序、CI 前置、Axure 版本、异常路径、a11y

**仍存问题（8 项）**：
- Q2: 未论证为何不选非 fork 方案（🟡）
- Q10: 未列现有 Axhub-Make 能力清单（🟡）
- Q14/Q15: 用户价值与差异化论证仍薄弱（🟡）
- Q19: 模板/示例库未提（🟡）
- Q23: 无工作量评估（🟡）
- Q26: 文档任务仍堆在 Phase 6（🟢）
- Q11/Q12: 图标资产来源、i18n（🟢）

**新增问题（7 项）**：
- **N1: proposal 组件清单自相矛盾**（🟡）— 两处清单不一致，应以 COMPONENT_MATRIX 为准
- **N2: v1.0 排除手动画布后，「组件属性配置面板」定位含糊**（🟡）— 没有画布何来「添加组件」？
- **N3: 多页面模型仍未定义**（🟡）— 页面/画板数据模型缺席
- **N4: Excalidraw → ComponentTree 的语义还原是隐藏高风险项**（🔴）— 如何识别「这组矩形+文本 = 一个按钮组件」？
- **N5: ANALYTICS_SPEC 与「本地单人工具」定位不匹配**（🟡）— 自研埋点 SDK 对 v1.0 本地工具偏重
- **N6: AI 采纳率定义与 v1.0 范围冲突**（🟢）— v1.0 无手动修改，该指标恒为 ~100%
- **N7: TEST_SPEC 性能指标缺测试环境基准**（🟢）— 「单页导出 ≤5s」未定义页面规模基准

**通过条件（5 项）**：
1. **N4（🔴）**：补充「Excalidraw → ComponentTree 语义识别」方案
2. **N2（🟡）**：明确 v1.0 是否支持手动添加组件
3. **N1（🟡）**：proposal 组件清单统一引用 COMPONENT_MATRIX
4. **N3（🟡）**：补一页「项目/页面数据模型」小节
5. **N5（🟡）**：埋点降级为本地事件 + 导出，分析面板移出 v1.0

---

### 前端开发（✅ 有条件通过）

**已解决（5 项核心验证）**：
1. 画布底座选型（复用 Excalidraw）✅
2. 导出路径统一（组件树驱动）✅
3. export-core fork 方式（patch-package）✅
4. CSS→Axure 映射表完整性 ⚠️ 部分解决
5. 降级策略明确性 ✅

**仍存问题（5 项）**：
1. Bridge 协议契约细节不足 — 缺消息格式/版本协商/错误码
2. CSS→Axure 映射覆盖度不全 — position/z-index/overflow/transform 策略缺失
3. 组件树→Axure 嵌套结构映射不明确 — group/dynamic_panel 嵌套规则未定义
4. 降级策略用户感知度低 — 降级后无可视化标识和导出报告
5. patch-package 对 vendor/ 的支持边界 — 需技术验证

**新增问题（3 项）**：
- N1: Excalidraw 元素 → ComponentTree 转换规则缺失
- N2: 三种预览模式一致性技术方案未定义
- N3: 组件版本控制/迁移策略缺失

**通过条件（5 项）**：
1. 补充 Bridge 协议契约文档
2. 完善 CSS 映射表（position/z-index/overflow）
3. 明确组件树→Axure 嵌套映射规则
4. 验证 patch-package 对 vendor/ 的支持
5. 补充 Excalidraw→ComponentTree 转换规则

---

### 后端开发（⚠️ 打回补充 2 项高危）

**已解决（5 项）**：
- H5: fork vendor 与上游同步矛盾 ✅
- H18: HTML 导出离线兼容性 ✅
- H19: standalone HTML 体积无预算 ✅
- H23: 每周同步无自动化细节 ✅
- H36: Bridge 异常场景未定义 ✅

**部分解决（2 项）**：
- H4: Bridge 协议契约完全缺失 🟡 — 仍未定义 payload schema、版本协商、大 payload 分片
- H22: 目录隔离与仓库现状冲突 🟡 — 未说明与现有 `client/` + `src/server/` + `vendor/` 的迁移路径

**未解决（2 项高危）**：
- **H6: 组件树持久化 / AI 覆盖手动修改** ❌ — 项目文件 schema、存储位置、多页面模型、版本快照、AI 再生成 merge 策略完全缺失
- **H37: 大 payload 传输约束未定义** ❌ — body 上限、超时、分片、压缩算法均未定义

**建议行动（4 项）**：
1. design.md 增加"组件树持久化与并发"章节
2. design.md 增加"Bridge 传输协议"章节
3. TEST_SPEC 3.2 增加"大 payload 导出"测试用例
4. 澄清批量导出 10 页 ≤30s 是串行还是并行口径

---

### 测试工程师（✅ 有条件通过）

**已解决（10/17）**：
- 可编辑性 L1-L4 量化标准 ✅
- 组件矩阵覆盖 ✅
- 性能指标可测量 ✅
- 异常场景覆盖 ⚠️ 基本解决
- 上游同步验收标准 ⚠️ 基本解决

**仍存问题（7 项）**：
- P1: CSS 伪类（:hover）→ Axure 交互样式映射规则缺失
- P2: Axure 回归测试自动化机制未定义
- P3: 组件数 / 嵌套层级 / 表格行数硬上限未定义
- P4: 上游同步失败的回滚策略未明确
- P5: UPSTREAM_API_LOCK.md 清单缺失
- P6: AI 异常输入三场景兜底未完整覆盖
- P7: E2E 测试环境的 CI mock vs 本地真实 Axure 分层策略未写入文档

**新增问题（3 项）**：
- N1: L2 级"通过格式刷"判定主观，不可测试
- N2: 跨浏览器"布局 ≤1px"不可达，建议同浏览器 ≤1px、跨浏览器 ≤3px
- N3: TEST_SPEC §七 与 ANALYTICS_SPEC 埋点定义重复，存在双源同步风险

**通过条件**：完成 P1-P7 七项修补（预计 1 个工作日）

---

### UI 设计师（✅ 通过）

**已解决（16/23）**：
- 设计 Token 完整性 ✅
- 组件状态规范 ✅
- 组件矩阵完整性 ✅
- 降级策略 ✅
- a11y ✅

**仍存问题（4 项，不阻断）**：
- R1: 页面级空态/加载/错误文案插画规范缺失（P2）
- R2: 桌面端基准宽度档（1280/1440/1920）未定义（P2）
- R3-R6: 图标规范、暗色 token 预留、多页面导航、prefers-reduced-motion（P3）

---

### 运营专家（✅ 通过）

**已解决（5/5）**：
- 数据埋点规划 ✅
- 核心指标定义 ✅
- 激活漏斗 ✅
- 留存指标 ✅
- 隐私合规 ✅

**仍存问题（4 项，轻微）**：
- prompt_text 采集与隐私声明矛盾
- 留存指标缺少"活跃"定义
- WAU-Export 目标值 100 的基准缺失
- 缺少数据看板责任人/更新频率

---

## 总体结论

### 第 2 轮 Review 结果：**有条件通过**

| 角色 | 结论 | 关键条件 |
|------|------|---------|
| PM | ✅ 有条件通过 | 5 项通过条件（1 高优 N4） |
| FE | ✅ 有条件通过 | 5 项通过条件 |
| BE | ⚠️ 打回补充 | 2 项高危（H6 持久化 + H37 大 payload） |
| QA | ✅ 有条件通过 | 7 项修补（P1-P7） |
| 设计 | ✅ 通过 | 无阻断项 |
| 运营 | ✅ 通过 | 4 项轻微优化 |

### 关键共识

1. **架构方向正确**：git subtree + patch-package + CI 上游同步方案工程可行
2. **MVP 切片合理**：v1.0 聚焦 AI 生成 + Axure 导出 + HTML 导出，规避手动画布高风险
3. **文档体系完整**：7 份文档覆盖需求/设计/任务/规范/矩阵/测试/埋点

### 阻塞项（必须修复后才能进入开发）

| # | 问题 | 提出角色 | 优先级 |
|---|------|---------|--------|
| 1 | **Excalidraw → ComponentTree 语义识别方案缺失** | PM | 🔴 高 |
| 2 | **组件树持久化 / AI 再生成 merge 策略缺失** | BE | 🔴 高 |
| 3 | **大 payload 传输约束未定义** | BE | 🔴 高 |
| 4 | Bridge 协议契约细节不足 | FE/BE | 🟡 中 |
| 5 | CSS→Axure 映射覆盖度不全 | FE | 🟡 中 |

---

## 下一步行动

### 立即执行（进入 Phase 2 前必须完成）

1. **补充 Excalidraw → ComponentTree 语义识别方案**（design.md）
   - 优先方案：AI 生成时输出带组件类型的结构化 schema，Excalidraw 仅作渲染层
   - 备选方案：spike 验证自由图形 → 组件识别算法

2. **补充组件树持久化与并发设计**（design.md）
   - 项目文件 JSON schema
   - 存储位置（LocalStorage / IndexedDB）
   - AI 再生成策略：v1.0 显式声明"全量替换 + 确认弹窗"

3. **补充 Bridge 传输协议**（design.md）
   - `/copyaxvg` body 上限：10MB，超限分片
   - 超时：60s（大 payload）
   - 压缩：gzip
   - 版本协商：`/available` 返回 `version` + `maxPayloadSize`

4. **完善 CSS→Axure 映射表**（design.md / COMPONENT_MATRIX.md）
   - position: fixed/sticky/absolute 策略
   - z-index 层级映射
   - overflow 滚动/隐藏策略
   - transform 旋转/缩放降级

5. **明确 v1.0 手动组件添加能力**（proposal.md / tasks.md）
   - 决策：v1.0 是否支持手动添加组件？
   - 若不支持，砍 tasks 2.9/2.10 与 `component_use` 事件

### 可延后到 v1.1

- 替代方案论证（提 PR / plugin 包装 / 换底座）
- 模板/示例库
- 工作量估算
- 组件版本控制/迁移策略
- 暗色模式、多页面导航、响应式档位

---

## 文档状态

| 文档 | 版本 | 状态 | 下一步 |
|------|------|------|--------|
| proposal.md | v2.0 | 需修订 | 统一组件清单引用 COMPONENT_MATRIX |
| design.md | v2.0 | 需修订 | 补充语义识别 + 持久化 + Bridge 协议 |
| tasks.md | v2.0 | 需修订 | 明确 v1.0 手动组件能力 |
| DESIGN_SPEC.md | v1.0 | 通过 | 无需修改 |
| COMPONENT_MATRIX.md | v1.0 | 需修订 | 补充 CSS 映射（position/z-index/overflow） |
| TEST_SPEC.md | v1.0 | 需修订 | 补充大 payload 测试用例 |
| ANALYTICS_SPEC.md | v1.0 | 需修订 | 降级为本地事件 + 导出，删除 prompt_text |

---

## 评审记录

| 轮次 | 日期 | 参与角色 | 问题数 | 结论 |
|------|------|---------|--------|------|
| 第 1 轮 | 2026-07-26 | PM/FE/BE/QA/设计/运营 | 123 | 打回补充 |
| 第 2 轮 | 2026-07-26 | PM/FE/BE/QA/设计/运营 | 待统计 | 有条件通过（3 项阻塞） |
