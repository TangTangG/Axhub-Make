# README AI User Guidance Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a README entry that users can copy to an AI Agent so it reads the Axhub Make user-guidance document and guides them through the product.

**Architecture:** Mirror the existing “让 AI 帮你启动” section with a separate adjacent section for product usage. Keep the entry self-contained with one explanatory sentence and one copyable prompt that links to the raw guidance document.

**Tech Stack:** Markdown, Git

## Global Constraints

- Modify only `README.md` during implementation.
- Place the new section after “让 AI 帮你启动” and before “产品流程”.
- Keep the explanatory copy to one sentence.
- Use the GitHub raw URL for `docs/guide-users-with-axhub-make.md`.
- Do not modify the existing installation entry or add product capability claims.
- Preserve all unrelated staged and unstaged work.

---

### Task 1: Add the AI user-guidance entry

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the existing AI installation-entry format and `docs/guide-users-with-axhub-make.md`.
- Produces: a copyable README prompt that tells an AI Agent to read the guidance document and guide the user through Axhub Make.

- [ ] **Step 1: Inspect the current README entry order**

Run:

```bash
sed -n '18,48p' README.md
```

Expected: “让 AI 帮你启动” is followed directly by “产品流程”.

- [ ] **Step 2: Insert the approved entry**

Insert the following content between the existing AI startup prompt and “产品流程”:

````markdown
## 让 AI 指导你使用

把下面这段发给你的 AI Agent，让它读取使用指导，然后结合你当前的页面和项目指导你使用 Axhub Make：

```
请读取这个文档，并按里面的要求指导我使用 Axhub Make：

https://raw.githubusercontent.com/lintendo/Axhub-Make/main/docs/guide-users-with-axhub-make.md
```
````

- [ ] **Step 3: Verify the entry, URL, and section order**

Run:

```bash
test -f docs/guide-users-with-axhub-make.md
rg -n '^## (让 AI 帮你启动|让 AI 指导你使用|产品流程)|guide-users-with-axhub-make\.md' README.md
```

Expected: the three headings appear in startup, guidance, product-flow order, and the raw guidance URL appears once.

- [ ] **Step 4: Check the README diff and whitespace**

Run:

```bash
git diff --check -- README.md
git diff -- README.md
```

Expected: `git diff --check` prints nothing; the diff only adds the approved section and leaves the installation entry unchanged.

- [ ] **Step 5: Commit only README**

Run:

```bash
git commit --only README.md -m "docs: add AI user guidance entry"
```

Expected: one commit that changes only `README.md`.
