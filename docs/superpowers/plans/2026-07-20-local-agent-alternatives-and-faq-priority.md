# Local Agent Alternatives and FAQ Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document how local Agents replace three common webpage Agent scenarios and make the FAQ the first reference source in the AI user-guidance document.

**Architecture:** Add one compact scenario-mapping subsection to the existing local AI Agent FAQ. Reorder the existing one-line FAQ reference in the guidance document without changing the remaining evidence-source descriptions or conflict rules.

**Tech Stack:** Markdown, Git

## Global Constraints

- The FAQ audience is AI and may use technical names such as `$prototype-comments`.
- `$prototype-comments` handles prototype change-request comments; do not substitute `$prototype-annotation`.
- The copy action is a keyboard shortcut in the new-scene prompt input, not a visible copy button.
- Keep the FAQ reference in the guidance document to one sentence; do not add maintenance, origin, or generation details.
- Do not modify Agent, ACP, annotation, shortcut, or prompt-generation implementation.
- Preserve all unrelated staged and unstaged work.

---

### Task 1: Add local Agent alternatives to the FAQ

**Files:**
- Modify: `docs/faq.md`

**Interfaces:**
- Consumes: the `$prototype-comments` local workflow, current Make client workspace, and the new-scene prompt copy shortcut.
- Produces: one independently retrievable FAQ subsection with three webpage-to-local scenario mappings.

- [ ] **Step 1: Inspect the local AI Agent FAQ section**

Run:

```bash
sed -n '30,75p' docs/faq.md
```

Expected: “常用 Agent 不在列表中” is followed by detection, testing, and project-opening guidance; the new scenario-mapping heading is absent.

- [ ] **Step 2: Insert the approved scenario mapping**

Insert this subsection after “常用 Agent 不在列表中” and its answer:

```markdown
### 网页 Agent 的常用场景怎样用本地 Agent 代替

- **批注直接执行：** 确认本地 Agent 已打开当前 Make 客户端目录，再让它使用 `$prototype-comments` 处理批注。
- **侧边栏对话：** 直接在本地 Agent 的对话中继续相同任务，并保持当前 Make 客户端目录为工作目录。
- **新建场景的提示词和配置生成：** 光标位于提示词输入框且没有选中文字时，Windows 按 `Ctrl+C`，macOS 按 `⌘C`，即可复制包含当前场景设置的完整提示词，再粘贴到本地 Agent 中执行。该快捷键提示位于发送按钮的悬停提示中，入口较隐蔽。
```

- [ ] **Step 3: Verify all three mappings and technical boundaries**

Run:

```bash
rg -n '^### 网页 Agent 的常用场景怎样用本地 Agent 代替|\$prototype-comments|侧边栏对话|Ctrl\+C|⌘C|当前场景设置|悬停提示' docs/faq.md
```

Expected: the heading and every required mapping detail appear once; the new subsection names `$prototype-comments` and does not name `$prototype-annotation`.

- [ ] **Step 4: Check the FAQ diff and whitespace**

Run:

```bash
git diff --check -- docs/faq.md
git diff -- docs/faq.md
```

Expected: `git diff --check` prints nothing; the diff only adds the approved subsection.

- [ ] **Step 5: Commit only the FAQ**

Run:

```bash
git commit --only docs/faq.md -m "docs: add local agent alternatives FAQ"
```

Expected: one commit that changes only `docs/faq.md`.

---

### Task 2: Move the FAQ to the top of the guidance sources

**Files:**
- Modify: `docs/guide-users-with-axhub-make.md`

**Interfaces:**
- Consumes: the existing “参考信息源” section and its current FAQ link.
- Produces: a first-position FAQ reference followed by the unchanged current-page, repository, and tutorial sources.

- [ ] **Step 1: Inspect the reference-source order**

Run:

```bash
sed -n '20,70p' docs/guide-users-with-axhub-make.md
```

Expected: FAQ currently appears after the default-client tutorials.

- [ ] **Step 2: Move and tighten the FAQ reference**

Move the FAQ subsection to immediately after the introductory paragraph under “参考信息源” and use exactly:

```markdown
### FAQ

遇到相关问题时，优先查阅 [Axhub Make FAQ](./faq.md)。
```

Delete the old FAQ subsection from below the default-client tutorials. Do not change any other source description.

- [ ] **Step 3: Verify source order and one-sentence scope**

Run:

```bash
rg -n '^### (FAQ|用户当前页面和本地项目|Axhub Make GitHub 仓库|默认客户端教程)|^遇到相关问题时，优先查阅' docs/guide-users-with-axhub-make.md
```

Expected: FAQ has the lowest line number among the four source headings, its body is one sentence, and the other headings retain their relative order.

- [ ] **Step 4: Check the guidance diff and whitespace**

Run:

```bash
git diff --check -- docs/guide-users-with-axhub-make.md
git diff -- docs/guide-users-with-axhub-make.md
```

Expected: `git diff --check` prints nothing; the diff only moves the FAQ block and replaces its sentence with the approved priority wording.

- [ ] **Step 5: Commit only the guidance document**

Run:

```bash
git commit --only docs/guide-users-with-axhub-make.md -m "docs: prioritize FAQ in AI guidance"
```

Expected: one commit that changes only `docs/guide-users-with-axhub-make.md`.

---

### Task 3: Verify the committed documentation result

**Files:**
- Verify: `docs/faq.md`
- Verify: `docs/guide-users-with-axhub-make.md`

**Interfaces:**
- Consumes: the two committed Markdown updates from Tasks 1 and 2.
- Produces: fresh evidence that the requested content and ordering are present without whitespace errors or uncommitted target-file changes.

- [ ] **Step 1: Verify committed content and target-file cleanliness**

Run:

```bash
git diff --check HEAD~2 HEAD -- docs/faq.md docs/guide-users-with-axhub-make.md
git status --short -- docs/faq.md docs/guide-users-with-axhub-make.md
git log -2 --oneline -- docs/faq.md docs/guide-users-with-axhub-make.md
```

Expected: the whitespace check and target-file status print nothing; the log shows the two documentation commits.
