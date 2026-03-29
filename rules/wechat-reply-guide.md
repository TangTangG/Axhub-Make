# 微信回复指南

## 获取项目首页地址

先读取开发服务信息，拿到 `port` 和 `localIP`：

```bash
cat .axhub/make/.dev-server-info.json

# 如果当前工作目录是仓库根目录，则读取：
cat apps/axhub-make/.axhub/make/.dev-server-info.json
```

对外沟通时不要返回 `127.0.0.1` 或 `localhost`。至少返回 `localIP` 对应的局域网地址。

如果机器上还存在额外的可访问组网地址，也要一起返回，例如 Tailscale、ZeroTier 或其他 VPN/组网 IPv4。可以额外检查：

```bash
ifconfig | rg '^[A-Za-z0-9:._-]+:|\\s+inet\\s'

# 如果安装了 tailscale，再检查：
tailscale ip -4
```

只返回外部设备可访问的地址，忽略回环地址和明显不可对外访问的虚拟测试地址。

回复示例（根据实际值替换；按实际存在的地址返回，不要虚构不存在的项）：
```
项目首页：
• 局域网: http://{localIP}:{port}
• Tailscale: http://{tailscaleIP}:{port}
```

## 切换 AI Agent

直接运行项目内的脚本，无需网络请求：

```bash
node scripts/switch-agent.mjs <agent>
```

agent 可选值：`codex`、`claudecode`（别名 `claude`）、`gemini`（别名 `gem`）

查看当前状态：
```bash
node scripts/switch-agent.mjs --status
```

> 切换后 daemon 重启，会话上下文会重置。完成后告知用户已切换到哪个 Agent。
