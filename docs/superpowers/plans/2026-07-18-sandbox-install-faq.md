# Sandbox Install FAQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one concise AI-facing FAQ entry for recovering from project or client installation failures caused by an Axhub Make instance started inside a sandbox.

**Architecture:** Extend the existing Markdown FAQ with one question, a short cause statement, three recovery steps, and one fallback sentence. Link to the existing AI startup guide for the desktop launch script and avoid operating-system-specific process commands.

**Tech Stack:** Markdown, Git diff checks

## Global Constraints

- Modify only `docs/faq.md`.
- Keep the FAQ concise and written for an AI Agent.
- Treat incomplete sandbox permissions as a possible cause, not the only cause of installation failure.
- Prefer stopping the current sandbox instance and restarting from the desktop script before deeper troubleshooting.
- Do not include PID, port, `killall`, `taskkill`, or other process-management instructions.
- Do not modify the startup guide, AI user guidance, README, product code, or existing Skill files.

---

### Task 1: Add the sandbox installation recovery entry

**Files:**
- Modify: `docs/faq.md`

**Interfaces:**
- Consumes: The desktop launch workflow in `docs/start-axhub-make-with-ai.md`.
- Produces: A concise FAQ answer that an AI can apply after project or client installation fails in a sandbox-started Make instance.

- [ ] **Step 1: Confirm the FAQ entry does not already exist**

Run:

```bash
! rg -n "安装项目或安装客户端时报错怎么办" docs/faq.md
```

Expected: command exits with status 0 and prints no output because the question is not present.

- [ ] **Step 2: Add the FAQ entry**

Replace `docs/faq.md` with exactly this content:

```markdown
# Axhub Make FAQ

本文件用于提供 Axhub Make 常见问题参考。

## 安装项目或安装客户端时报错怎么办？

如果 Axhub Make 是由 AI 在沙箱环境中启动的，报错可能是沙箱进程权限不完整，导致脚本执行或文件读写受限。相比继续在同一沙箱中尝试修复，优先重新启动通常更快。

1. 停止当前 Make 服务端、客户端及其相关子进程。
2. 按照[启动指导](./start-axhub-make-with-ai.md)，引导用户双击安装阶段创建的桌面启动脚本，重新启动 Axhub Make。
3. 重试失败的安装操作。

如果仍然失败，再排查 Node.js、npm、网络、路径和其他权限问题。
```

- [ ] **Step 3: Verify content, scope, and formatting**

Run:

```bash
test -f docs/start-axhub-make-with-ai.md
rg -n "安装项目或安装客户端时报错怎么办|沙箱进程权限不完整|停止当前 Make 服务端、客户端及其相关子进程|\./start-axhub-make-with-ai\.md|如果仍然失败" docs/faq.md
! rg -n "killall|taskkill|PID|端口" docs/faq.md
git diff --check -- docs/faq.md
git diff -- docs/faq.md
```

Expected:

- The startup guide exists.
- `rg` finds the question, possible cause, recovery action, relative link, and fallback.
- The forbidden process-command search prints no output and exits with status 0.
- `git diff --check` prints no output.
- The diff contains only the concise FAQ entry in `docs/faq.md`.

- [ ] **Step 4: Commit the FAQ update**

Run:

```bash
git add docs/faq.md
git commit --only docs/faq.md -m "docs: add sandbox install FAQ"
```

Expected: one commit containing only `docs/faq.md`; pre-existing staged changes remain outside the commit.
