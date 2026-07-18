# Axhub Make AI Agent 使用 FAQ 设计

## 背景

Axhub Make 可以通过本地 ACP 服务在网页中调用用户本地的 AI Agent，也可以直接打开本地 CLI、应用或 IDE。不同 Agent 的支持路径不同：网页 ACP 只接受当前支持的 provider，版本检测和连接测试依赖 CLI，手动打开项目则依赖 Agent 自己的工作空间或项目目录入口。

## 目标

在 `docs/faq.md` 中增加一个面向 AI 的“如何设置和使用本地 AI Agent？”条目，帮助 AI 按问题表现选择最短的处理路径。

## 已确认的技术事实

- 入口是 Axhub Make 的“项目设置 → AI 设置”，其中包含本地 ACP 服务和本地 Agent 配置。
- 当前 ACP provider 列表为 Claude Code、Codex CLI、OpenCode、Cursor CLI、Qoder CLI、CodeBuddy CLI、Reasonix CLI、Grok Build。
- 网页中调用本地 Agent 的路径要求 Agent 支持当前 ACP provider；TRAE 不在当前 ACP provider 列表中，不能按 ACP 网页调用路径强行接入。
- Agent 版本检测和连接测试面向 CLI。只安装桌面 APP 不等于对应 CLI 可用；用户还需要在 CLI 中完成登录、授权并先跑通一次基本对话。Make 不代替用户处理第三方账号登录和授权。
- 列表存在但检测或测试失败时，AI 可以继续检查 CLI 是否安装、PATH、安装路径、命令执行权限和 ACP 连接。
- 手动打开 AI 的官方指导是：在 Agent 中新建对话并选择工作空间，或新建项目并把当前 Make 客户端目录设为项目根目录。不同 Agent 的入口名称可以不同。

## FAQ 结构

### 常用 Agent 不在列表中

说明“AI 设置”中的网页调用是 ACP provider 列表，不是所有桌面 AI 应用的通用启动器。TRAE 等不支持当前 ACP 的工具不能从网页 ACP 直接调用。优先鼓励用户继续使用已有 Agent，手动打开当前 Make 客户端目录；本地 Agent 仍可完成绝大多数 Make 工作。

### 列表中有，但检测不到或测试失败

先区分桌面 APP 和 CLI：检测不到通常表示 CLI 未安装、命令不在 PATH 或权限不足；测试失败还可能是 CLI 尚未登录或授权。先在 CLI 中完成登录、授权和一次成功对话，再回到“AI 设置”刷新版本并测试。仍失败时由 AI 排查安装路径、命令权限和 ACP 连接，不要求用户自行阅读日志。

### 怎样在本地 Agent 中打开当前项目

支持自动唤起时使用“打开 AI”。无法自动打开时，在 Agent 中新建对话选择工作空间，或新建项目选择当前 Make 客户端目录作为项目根目录。AI 不应猜目录，应使用 Make 当前项目给出的客户端目录；不同软件可以使用“工作空间”“项目”“工作目录”等不同名称。

## 范围

- 只修改 `docs/faq.md`。
- 不修改 ACP 服务、Agent 检测、设置界面或三个默认教程。
- 不把 TRAE 或其他未支持工具写成可以直接接入 ACP 的工具。
- 不替用户处理第三方登录、授权或账号安全操作。
- FAQ 保持简短，不为每个 Agent 编写独立软件教程。

## 验证

- FAQ 提到“项目设置 → AI 设置”、ACP 支持范围和 TRAE 不支持当前 ACP 的边界。
- FAQ 区分桌面 APP 与 CLI，并说明登录授权由用户在 CLI 中完成。
- FAQ 提供列表中检测失败后的 AI 排查方向。
- FAQ 提供自动打开失败时选择工作空间或项目根目录的路径。
- `git diff --check` 无空白错误，最终实现只修改 `docs/faq.md`。
