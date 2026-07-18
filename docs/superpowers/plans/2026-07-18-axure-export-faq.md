# Axhub Make Axure Export FAQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concise AI-facing FAQ entry for Axhub Make publishing or exporting to Axure failures.

**Architecture:** Extend only `docs/faq.md` with one question and three symptom-based branches: Axure Bridge/editable prototype failures, Windows font compatibility, and dynamic prototype copy failures. Keep the technical facts AI needs while routing users to the shortest verified recovery path.

**Tech Stack:** Markdown, Git diff checks

## Global Constraints

- Modify only `docs/faq.md`.
- Keep the FAQ short while including the verified Bridge host, port, routes, and Axure version requirement.
- Check the existing “使用说明” and font configuration before choosing a failure branch.
- For dynamic prototypes, “无法复制” means use the Runtime cover replacement path instead of repeating copy attempts.
- Do not add operating-system process commands or unverified client/version names.
- Do not modify Bridge implementation, export UI, startup guidance, AI user guidance, README, or Skill files.

---

### Task 1: Add the Axure export troubleshooting FAQ

**Files:**
- Modify: `docs/faq.md`

**Interfaces:**
- Consumes: `src/server/managementApi.bridge.ts`, `src/index/components/dialogs/ExportModalView.tsx`, and the two user-provided recovery links.
- Produces: A short AI-readable FAQ answer with host/port facts and symptom-specific recovery paths.

- [ ] **Step 1: Confirm the Axure FAQ entry is not already present**

Run:

```bash
! rg -n "发布或者导出到 Axure 失败怎么办" docs/faq.md
```

Expected: command exits with status 0 and prints no output.

- [ ] **Step 2: Add the concise FAQ entry**

Append this exact content to `docs/faq.md`:

```markdown
## 发布或者导出到 Axure 失败怎么办？

先按“使用说明”完成 Axure 准备和字体配置，再按报错表现处理。

### 可编辑原型复制失败

Axhub Make 默认通过 `http://localhost:32767` 连接 Axure Bridge：可用性检查为 `GET /available`，复制数据为 `POST /copyaxvg`。需要打开 3743 及以上版本的 Axure。Axure 多开时端口可能不同；如果最初打开的实例被关闭，原端口可能失效。关闭所有 Axure 实例，只重新打开一个符合版本的 Axure 后再试。

### Windows 粘贴或编辑报错

通常与字体兼容有关。优先使用 [Axhub Chrome 扩展](https://axhub.im/chrome/) 代替复制，也可以升级 Axure。先确认字体已按“使用说明”正确配置。

### 动态原型复制后失败

复制组件并非所有用户都能稳定成功，Windows 用户尤其容易受到字体兼容影响：

- **无法复制：** 不要继续反复尝试复制，改用 [Runtime 元件库](https://axhub-work.feishu.cn/file/ZR2UboHQ9oBsQsx48lscSMpenue) 的下载封面方法。下载 Runtime 封面，回到 Axure，双击对应 Runtime 元件，用下载的封面替换原图片。
- **可以复制但不显示：** 通常是 Axure 客户端兼容问题。升级 Axure，或下载 SVG 替换对应内容；前提是字体已按“使用说明”正确配置。
```

- [ ] **Step 3: Verify facts, links, brevity, and scope**

Run:

```bash
test -f src/server/managementApi.bridge.ts
test -f src/index/components/dialogs/ExportModalView.tsx
rg -n "发布或者导出到 Axure 失败怎么办|localhost:32767|GET /available|POST /copyaxvg|3743|axhub\.im/chrome|ZR2UboHQ9oBsQsx48lscSMpenue|无法复制|可以复制但不显示" docs/faq.md
! rg -n "killall|taskkill|PID|端口命令" docs/faq.md
git diff --check -- docs/faq.md
git diff -- docs/faq.md
```

Expected:

- Both source-of-fact files exist.
- `rg` finds the question, host/port, both routes, version, both links, and both dynamic-prototype outcomes.
- The forbidden process-command search prints no output and exits with status 0.
- `git diff --check` prints no output.
- The diff changes only `docs/faq.md` and remains a short FAQ entry.

- [ ] **Step 4: Commit the FAQ update**

Run:

```bash
git add docs/faq.md
git commit --only docs/faq.md -m "docs: add Axure export FAQ"
```

Expected: one commit containing only `docs/faq.md`; all unrelated staged changes remain outside the commit.
