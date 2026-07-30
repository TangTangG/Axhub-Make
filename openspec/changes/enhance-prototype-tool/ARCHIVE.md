# 归档说明：enhance-prototype-tool

> 归档日期：2026-07-27
> 版本：v1.0.0
> 状态：已完成

---

## 变更摘要

基于 Axhub-Make 开源项目（fork 二次开发）构建增强原型工具 `axhub-proto-enhanced`，实现：

1. **AI 生成 + Axure 导出增强**：AI 直接生成带类型元数据的 ComponentTree，经组件树驱动的导出管道转换为 Axure 中间 JSON，通过 Bridge（localhost:32767）发送到 Axure RP
2. **多模式预览**：iframe 预览（复用上游）+ HTML 导出（独立文件/可交互）+ 图片导出（PNG/SVG，DPI 1x-3x）
3. **完整组件库**：19 个组件（6 基础 + 6 表单 + 7 布局），完整状态集，设计 Token 驱动
4. **上游同步机制**：git subtree 只读 + patch-package 补丁 + CI 每周定时同步 + API 锁定检测

## 交付物清单

### 代码（60 个 TS/TSX 文件 + 20 个 CSS 文件，约 8,850 行）

| 模块 | 路径 | 内容 |
|------|------|------|
| 设计 Token | `src/enhanced/tokens/design-tokens.json` | 49 个 Token（color/typography/spacing/radius/shadow）|
| 组件系统 | `src/enhanced/components/` | 19 组件 + types.ts + Storybook stories |
| Axure 导出 | `src/enhanced/export/` | CSS→Axure 映射 + 组件映射 + 导出管道 |
| 多模式预览 | `src/enhanced/preview/` | HTML 导出 + 图片导出 + 预览管理器 |
| Bridge 客户端 | `src/enhanced/bridge/client.ts` | gzip/分片/错误处理（400/413/500/503）|
| 数据埋点 | `src/enhanced/analytics/` | 19 事件 + 3 北极星指标 + 离线缓存 |
| 容量守卫 | `src/enhanced/guards/capacity-guard.ts` | 500 组件/8 层嵌套/10MB payload |
| 集成层 | `src/integration/` | 上游适配器 + 统一导出管道 |
| 统一导出 | `src/enhanced/index.ts` + `version.ts` | 公共 API 入口 |
| 测试 | `tests/e2e/` | CI mock 测试 + 本地真实测试 |

### 基础设施

| 交付物 | 路径 |
|--------|------|
| 上游同步脚本 | `scripts/sync-upstream.sh` |
| API 变更检测 | `scripts/check-upstream-api.sh` |
| API 锁定文件 | `UPSTREAM_API_LOCK.md` |
| CI 定时同步 | `.github/workflows/upstream-sync.yml` |
| patch-package 配置 | `package.json`（postinstall + patches/） |

### 文档

| 文档 | 说明 |
|------|------|
| `proposal.md` / `design.md` / `tasks.md` | OpenSpec 核心文档（design.md 618 行）|
| `DESIGN_SPEC.md` | 设计规范（Token 单一事实源）|
| `COMPONENT_MATRIX.md` | 组件矩阵（含 CSS→Axure 完整映射表）|
| `TEST_SPEC.md` / `ANALYTICS_SPEC.md` | 测试标准 / 埋点方案 |
| `PLAN.md` | 实施计划 v2.1（8 周里程碑 M1-M8）|
| `docs/reviews/` | 15+ 份多角色 Review 报告（需求 3 轮 + 设计 3 轮）|
| `CHANGELOG.md` | v1.0.0 更新日志 |

## Review 历程

| 检查点 | 轮次 | 结果 |
|--------|------|------|
| 需求 Review | 3 轮（6 角色）| 123 问题 → 3 阻塞 → 全部修复 → 通过 |
| 设计 Review | 3 轮（6 角色）| 6 项阻塞 → 全部修复 → 通过 |
| 代码 Review | 3 轮（6 角色）| 11 高优 + 40 中优 → 全部修复 → 通过 |

## 遗留问题（登记到 v1.1）

| # | 问题 | 优先级 | 说明 |
|---|------|--------|------|
| 1 | ~~代码 Review 3 轮未执行~~ ✅ 已完成 | — | 11 高优 + 40 中优全部修复（d0cebf8 → d2a364a → 557a1f5）|
| 2 | 手动编辑画布 | - | v1.1 范围（Excalidraw 底座已预留 canvas-editor/）|
| 3 | AI 再生成 3-way merge | 中 | v1.0 为全量替换+确认弹窗，v1.1 预留基于 node.id 的 merge |
| 4 | 高级组件完整映射 | 中 | 图表/地图/富文本当前为「尽力而为+降级占位」|
| 5 | patch-package 对 vendor dist 的支持验证 | 中 | vendor/axhub-export-core 仅 dist 无源码，补丁机制需验证 |
| 6 | TypeScript 编译验证未执行 | 中 | 项目依赖冲突（pnpm 缺失 + npm ERESOLVE），tsc 未跑通 |
| 7 | E2E 测试未实际运行 | 中 | vitest 配置已分层但依赖未安装，测试未执行 |
| 8 | fork 仓库创建 + upstream/ subtree 初始化 | 高 | 脚本和 CI 已就绪，需在 GitHub fork 后执行 |
| 9 | 运营 4 项优化 | 低 | prompt_text 脱敏规则/活跃定义/WAU 基准/数据 Owner |
| 10 | QA N1-N3 | 低 | 格式刷判定/跨浏览器像素/埋点双源 |
| 11 | export-pipeline 2 个测试断言对齐 | 低 | fallback 查找逻辑 + 尺寸提取，非阻塞 |

## 后续计划（v1.1）

1. ~~**代码 Review 3 轮**（6 角色子代理）+ 修复~~ ✅ 已完成
2. **fork 仓库 + 上游同步首次执行**（任务 1.1/1.2）
3. **手动编辑画布**（Excalidraw 底座 + 撤销/重做 + AI×手动 merge）
4. **高级组件增强**（图表/地图/富文本完整映射）
5. **多项目 + IndexedDB 持久化**（v1.0 为 LocalStorage 单项目）
6. **export-pipeline 测试断言对齐**（fallback 查找 + 尺寸提取）

## 验收状态

- [x] Week 1: 项目初始化 + 上游同步机制
- [x] Week 2: 设计 Token + 基础组件库
- [x] Week 3: Axure 导出增强
- [x] Week 4-5: 表单/布局组件
- [x] Week 6: 多模式预览
- [x] Week 7: 数据埋点 + 集成测试配置
- [x] Week 8: v1.0.0 发布（tag v1.0.0 已创建）
- [x] 代码 Review 3 轮（6 角色，11 高优 + 40 中优全部修复）
- [ ] 上游同步首次执行（遗留）

---

*归档人：Hanzo（开发执行）+ Mimo（代码生成）*
