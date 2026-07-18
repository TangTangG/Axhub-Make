# Axhub Make AI Agent FAQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concise AI-facing FAQ entry covering ACP setup, CLI detection failures, and manually opening the current Make client project in a local Agent.

**Architecture:** Extend only `docs/faq.md` with one question and three symptom-based branches. The entry distinguishes the ACP provider list from generic desktop-app launching, distinguishes CLI from APP installation, and gives a software-agnostic workspace/project-root fallback.

**Tech Stack:** Markdown, Git diff checks

## Global Constraints

- Modify only `docs/faq.md`.
- Use the current “项目设置 → AI 设置” labels and ACP provider boundary.
- Do not promise ACP support for TRAE or any provider absent from the current list.
- Do not treat a desktop APP as proof that the corresponding CLI is installed or authenticated.
- Make does not handle third-party CLI login or authorization; the user must complete those in the CLI.
- For manual opening, use the Make client directory selected or created with the current project; do not guess a path.
- Keep the FAQ concise and do not write per-Agent software tutorials.

---

### Task 1: Add the AI Agent setup and opening FAQ

**Files:**
- Modify: `docs/faq.md`

**Interfaces:**
- Consumes: `src/common/acpModelConfig.ts`, `src/server/agentAvailability.ts`, `src/index/components/SettingsDialog.tsx`, `src/index/components/sidebar/OpenInDropdown.tsx`, and the beginner-guide copy.
- Produces: A short AI-readable FAQ entry with ACP support, CLI troubleshooting, and workspace selection guidance.

- [ ] **Step 1: Confirm the AI Agent FAQ entry is not already present**

Run:

```bash
! rg -n "如何设置和使用本地 AI Agent" docs/faq.md
```

Expected: command exits with status 0 and prints no output.

- [ ] **Step 2: Append the concise FAQ entry**

Append this exact content to `docs/faq.md`:

```markdown
## 如何设置和使用本地 AI Agent？

进入“项目设置 → AI 设置”，先连接本地 ACP 服务，再按下面的情况处理。

### 常用 Agent 不在列表中

AI 设置中的网页调用依赖 ACP，只支持当前列表中的 Claude Code、Codex CLI、OpenCode、Cursor CLI、Qoder CLI、CodeBuddy CLI、Reasonix CLI 和 Grok Build。TRAE 目前不支持这条 ACP 调用路径，不能强行接入。优先继续使用用户已有的 Agent；打开当前 Make 客户端目录后，仍可完成绝大多数功能。

### 列表中有，但检测不到或测试失败

检测的是 CLI，不是桌面 APP。先确认对应 CLI 已安装，并在 CLI 中完成登录、授权和一次成功对话；Make 不代替用户处理第三方账号登录和授权。然后回到“AI 设置”刷新版本并测试。仍失败时，再由 AI 检查 PATH、安装路径、命令执行权限和 ACP 连接。

### 怎样在本地 Agent 中打开当前项目

支持自动唤起时使用“打开 AI”。无法自动打开时，在 Agent 中新建对话并选择工作空间，或新建项目并把创建 Make 客户端时使用的目录设为项目根目录。不同软件可能叫“工作空间”“项目”或“工作目录”，但不要猜目录，必须选择当前 Make 客户端目录。
```

- [ ] **Step 3: Verify provider scope, CLI boundary, workspace guidance, and scope**

Run:

```bash
test -f src/common/acpModelConfig.ts
test -f src/server/agentAvailability.ts
test -f src/index/components/SettingsDialog.tsx
test -f src/index/components/sidebar/OpenInDropdown.tsx
rg -n "如何设置和使用本地 AI Agent|项目设置 → AI 设置|Claude Code|Codex CLI|TRAE|检测的是 CLI|桌面 APP|登录、授权|工作空间|当前 Make 客户端目录" docs/faq.md
! rg -n "保证.*支持|TRAE.*ACP.*支持|killall|taskkill" docs/faq.md
test "$(git diff --name-only -- docs | tr '\n' ' ')" = "docs/faq.md "
git diff --check -- docs/faq.md
git diff -- docs/faq.md
```

Expected:

- All four source-of-fact files exist.
- `rg` finds the question, AI settings entry, provider examples, TRAE boundary, CLI/APP distinction, login/authorization boundary, and workspace guidance.
- The forbidden-claim/process-command search prints no output and exits with status 0.
- Only `docs/faq.md` is modified under `docs/`.
- `git diff --check` prints no output.

- [ ] **Step 4: Commit the FAQ update**

Run:

```bash
git add docs/faq.md
git commit --only docs/faq.md -m "docs: add AI agent FAQ"
```

Expected: one commit containing only `docs/faq.md`; unrelated staged changes remain outside the commit.
