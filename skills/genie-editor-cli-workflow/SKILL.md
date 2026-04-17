---
name: genie-editor-cli-workflow
description: Use when handling internal Genie editor backlog through `@axhub/genie` CLI on Axhub-hosted pages. Covers checking service health, finding the correct frontend client, reading pending nodes, collecting screenshots or context images, editing code, and writing node state back. Prefer this for internal hosts such as `frontend-page`.
---

# Internal Genie Editor Workflow

用这个 skill 处理内部宿主环境里的 Genie editor 待办：先读 backlog，再改代码，最后回写状态并复核。

命令模板、字段说明和常见错误见 `references/cli-reference.md`。

## 内部环境边界

- 默认面对内部页面宿主。
- 选客户端时优先看 `channel`、`pageUrl`、`sessionId`、显式给出的 `targetClientId` 和 `editor.*` 能力。
- 整个任务固定使用同一组 `channel + targetClientId`。

## 主流程

1. 先跑 `npx @axhub/genie status --json`。如果服务没起来或命令不可用，直接说明阻塞点。
2. 跑 `editor clients list --channel <channel>` 找目标客户端。优先匹配 `pageUrl`、`sessionId`、显式 client id 和 `editor.*` 能力。
3. 先做一次全局扫描：`editor snapshot` + `editor nodes list --status pending-dispatch,dirty`。没有 backlog 就如实返回。
4. 处理节点前先 `editor editing set --state editing`。同一任务保持稳定的 `provider`，每个节点使用唯一 `taskRequestId`。
5. 仅在需要时补上下文：页面级参考用 `context-images export`，节点定位不清时用 `node screenshot`。把导出的本地图片当作辅助证据，不要强行一一映射。
6. 修改代码后，至少再读一轮 `snapshot` 和 `nodes list --status pending-dispatch,dirty,error,editing`。
7. 每个已领取节点都必须写终态：成功 `completed`，失败 `error`，中断或放弃 `idle`。

## 多节点并行策略

- 同一块 UI 的节点优先合并处理，减少重复扫描和验证。
- 真正独立的节点可以并行改代码，但客户端选择、节点领取/释放、最终复核应由主代理统一负责。
- 节点位置还没判断清楚时，不要急着并行。

## 规则

- 不要把“代码改完”和“backlog 已消费”混为一谈；如果节点仍是 `dirty` 或 `pending-dispatch`，要同时说明代码状态和 backlog 状态。
- 服务离线、客户端不对、缺少能力、截图失败、节点无法定位时，直接报告问题，不要伪造完成。
- 不要留下没有终态的已领取节点。

## 交付要求

最终回复至少包含：
- 使用的 `channel + targetClientId`
- 本轮处理过的 `elementKey`
- 各节点终态
- 修改了哪些文件
- 做了哪些验证
- 还有哪些节点仍未处理或状态异常
