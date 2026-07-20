# README AI 使用指导入口设计

## 背景

README 已提供“让 AI 帮你启动”入口：用户可以复制一段提示词，让 AI 读取 `docs/start-axhub-make-with-ai.md`。现在需要增加一个并列入口，让 AI 读取 `docs/guide-users-with-axhub-make.md` 后指导用户使用 Axhub Make。

## 目标

在 README 前部增加一个容易发现、可直接复制给 AI 的使用指导入口，并保持与现有 AI 启动入口相同的表达结构。

## 设计

在“让 AI 帮你启动”之后、“产品流程”之前增加“让 AI 指导你使用”小节，包含：

1. 一句说明：让用户把下方内容发给 AI Agent，由 AI 读取使用指导并结合当前页面和项目指导用户。
2. 一个提示词代码块，要求 AI 读取文档并指导用户使用 Axhub Make。
3. 使用 GitHub raw URL 指向 `docs/guide-users-with-axhub-make.md`，与安装入口的链接形式一致。

采用独立小节，不把使用指导塞进安装段落；启动和使用是两个不同目标，独立入口更容易检索和复制。

## 文案

说明句：

> 把下面这段发给你的 AI Agent，让它读取使用指导，然后结合你当前的页面和项目指导你使用 Axhub Make：

提示词：

```text
请读取这个文档，并按里面的要求指导我使用 Axhub Make：

https://raw.githubusercontent.com/lintendo/Axhub-Make/main/docs/guide-users-with-axhub-make.md
```

## 范围

- 实现阶段只修改 `README.md`。
- 不修改安装入口、使用指导文档、FAQ 或产品代码。
- 不增加功能说明、维护说明或未确认的产品能力。

## 验证

- 新入口位于 AI 启动入口之后、产品流程之前。
- 文案包含使用指导 raw URL，且仓库内目标文件存在。
- 安装入口原文保持不变。
- `git diff --check` 无空白错误，最终实现提交只包含 `README.md`。
