# CLI Reference

所有命令通过 `npx @axhub/genie` 调用，要求版本 ≥ 0.2.4。

建议先定义变量：

```bash
CHANNEL="project-a"
TARGET_CLIENT_ID=""
PROVIDER="agent"
```

选客户端时优先看 `channel`、`pageUrl`、`sessionId`、`capabilities`。

## 1. 服务检查

```bash
npx @axhub/genie status --json
```

确认 `running: true`；失败时直接停止并报告阻塞点。

## 2. 列出在线客户端

```bash
npx @axhub/genie editor clients list \
  --channel "$CHANNEL"
```

重点关注：`clientId`、`sessionId`、`pageUrl`、`capabilities`。

只有目标客户端在线且具备 `editor.*` 能力时，后续命令才有意义。

## 3. 获取编辑器快照

```bash
npx @axhub/genie editor snapshot \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID"
```

常看字段：`resource`、`selectedElement`、`modifiedElements`、`textChanges`、`styleChanges`、`statusSummary`。

## 4. 列出待处理节点

```bash
npx @axhub/genie editor nodes list \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --status pending-dispatch,dirty
```

```bash
npx @axhub/genie editor nodes list \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --status editing,error,completed
```

```bash
npx @axhub/genie editor nodes list \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --element-key "hero-card"
```

每个节点的关键字段：

- `elementKey`
- `label`
- `changeState`
- `taskState`
- `hasNote`
- `hasImages`
- `changeKinds`
- `dirtySince`
- `lastHandledAt`

状态别名：

- `pending-dispatch` = `changeState=dirty && taskState=idle`
- `dirty` / `handled` / `editing` / `completed` / `error` 直接匹配对应字段

## 5. 节点截图

```bash
npx @axhub/genie editor node screenshot \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --element-key "hero-card" \
  --output-dir /tmp/axhub-genie-shot
```

返回 `absolutePath`（本地文件路径）、`mimeType`、`width`、`height`、`size`。

## 6. 导出上下文图片

```bash
npx @axhub/genie editor context-images export \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --output-dir /tmp/axhub-genie-context
```

返回每张图片的 `absolutePath`、`mimeType`、`size`。

注意：这是页面级共享上下文，不保证能精准映射到单个 `elementKey`。

## 7. 设置节点编辑状态

```bash
npx @axhub/genie editor editing set \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --element-key "hero-card" \
  --state editing \
  --provider "$PROVIDER" \
  --task-request-id "${PROVIDER}_hero-card_$(date +%s)"
```

```bash
npx @axhub/genie editor editing set \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --element-key "hero-card" \
  --state completed \
  --provider "$PROVIDER" \
  --task-request-id "${PROVIDER}_hero-card_done_$(date +%s)"
```

```bash
npx @axhub/genie editor editing set \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --element-key "hero-card" \
  --state error \
  --provider "$PROVIDER" \
  --task-request-id "${PROVIDER}_hero-card_error_$(date +%s)"
```

```bash
npx @axhub/genie editor editing set \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --element-key "hero-card" \
  --state idle \
  --provider "$PROVIDER" \
  --task-request-id "${PROVIDER}_hero-card_idle_$(date +%s)"
```

说明：
- 同一任务保持稳定 `provider`
- 每个节点使用唯一 `taskRequestId`
- `editing.set` 改的是 `taskState`，不是 `changeState`

## 8. 推荐执行顺序

```bash
npx @axhub/genie status --json
npx @axhub/genie editor clients list --channel "$CHANNEL"
npx @axhub/genie editor snapshot --channel "$CHANNEL" --target-client-id "$TARGET_CLIENT_ID"
npx @axhub/genie editor nodes list --channel "$CHANNEL" --target-client-id "$TARGET_CLIENT_ID" --status pending-dispatch,dirty
```

然后按节点循环：

- `editor editing set --state editing`
- 如有需要，拉 `context-images export`
- 如仍难定位，拉 `node screenshot`
- 修改代码
- 重新拉 `snapshot` 与 `nodes list`
- 成功写 `completed`；失败写 `error`；中断写 `idle`

## 9. 最终复核

结束前至少再跑一次：

```bash
npx @axhub/genie editor nodes list \
  --channel "$CHANNEL" \
  --target-client-id "$TARGET_CLIENT_ID" \
  --status pending-dispatch,dirty,error,editing
```

如果列表仍有项，区分说明：
- 页面改动是否已完成
- 编辑器 backlog 是否仍残留
- 哪些节点状态异常或仍未消费

## 10. CLI 通用参数

| 参数 | 说明 |
|------|------|
| `--api-base <url>` | 显式指定 API Base，默认自动发现 |
| `--api-key <key>` | API Key（如开启鉴权） |
| `--channel <name>` | 目标业务通道 |
| `--target-client-id <id>` | 目标前端页面实例 |
| `--timeout-ms <ms>` | 请求超时 |
| `--json` | 显式声明 JSON 输出（editor 命令默认 JSON） |
| `--output-dir <path>` | 截图/图片导出目录 |

统一成功返回格式：

```json
{
  "ok": true,
  "requestId": "editor_001",
  "channel": "project-a",
  "targetClientId": "figma-123",
  "data": { ... }
}
```

失败时 `ok: false` + `error.code` + `error.message`，CLI 以非 0 退出码结束。

常见网络类错误 `CONNECTION_ERROR`、`CONNECTION_CLOSED`、`REQUEST_TIMEOUT` 可按 CLI 默认重试一次；持续失败时再上报。
