# Prototype Quality and Existing Product Import FAQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three concise, AI-facing FAQ entries for poor generation quality, visual consistency, and importing an existing product or prototype.

**Architecture:** Extend the existing single Markdown FAQ with three independent second-level questions so AI readers can retrieve each answer directly. Keep model and import-platform lists dynamic by referring readers to the current beginner guide and repository instead of copying volatile names into the FAQ.

**Tech Stack:** Markdown, Git

## Global Constraints

- The FAQ audience is AI; the answers may use technical names such as `$plan-prds` and `DESIGN.md`.
- Keep each answer short and operational.
- Recommend the current beginner-guide models without hard-coding model names.
- Refer to the current supported import range without hard-coding platform names.
- Do not invent capabilities, guarantees, platforms, models, or additional troubleshooting advice.
- Modify only `docs/faq.md` during implementation.

---

### Task 1: Add the three prototype workflow FAQ entries

**Files:**
- Modify: `docs/faq.md`

**Interfaces:**
- Consumes: the default client's current beginner-guide model recommendations, the `$plan-prds` workflow, `DESIGN.md`, and the repository's current import-support statements.
- Produces: three independent `##` FAQ headings that AI readers can retrieve by problem type.

- [ ] **Step 1: Inspect the current FAQ ending**

Run:

```bash
tail -80 docs/faq.md
```

Expected: the file ends after the existing local AI Agent guidance, and none of the three new headings already exists.

- [ ] **Step 2: Append the approved FAQ content**

Append exactly these three entries after the existing content:

```markdown
## 生成的原型效果不好怎么办？

优先引导用户改用默认客户端新手指导当前推荐的大模型。模型是影响生成效果的核心因素；确认使用推荐模型后，再考虑更换 Agent。不要根据本 FAQ 固定推荐具体模型，应以用户当前版本的新手指导为准。

## 如何保持视觉统一或与已有产品一致？

让用户提供已有产品的网站截图、页面截图和视觉规范资料，先基于这些资料生成 `DESIGN.md`。后续生成或修改原型时，以 `DESIGN.md` 作为统一的视觉依据。

## 如何导入已有产品资料或原型？

先使用 `$plan-prds` 导入并整理产品资料，再提取视觉规范并生成 `DESIGN.md`。如果外部原型属于 Axhub Make 当前支持的导入范围，优先直接导入；由 AI 查阅当前仓库确认支持范围，不要根据本 FAQ 猜测。

已有页面必须逐页还原，不要一次还原全部页面。最初几页因为项目尚未积累组件库或模板，通常需要更多打磨；完成约 5–10 个页面后，已有页面会形成可复用基础，后续新增页面通常会更快。
```

- [ ] **Step 3: Verify content coverage and volatile-list boundaries**

Run:

```bash
rg -n '^## (生成的原型效果不好怎么办|如何保持视觉统一或与已有产品一致|如何导入已有产品资料或原型)|推荐的大模型|再考虑更换 Agent|DESIGN\.md|\$plan-prds|逐页还原|5–10' docs/faq.md
```

Expected: all three headings and every required workflow phrase are present. The new entries contain no fixed model list and no fixed import-platform list.

- [ ] **Step 4: Check Markdown diff and whitespace**

Run:

```bash
git diff --check -- docs/faq.md
git diff -- docs/faq.md
```

Expected: `git diff --check` prints nothing; the diff contains only the three approved FAQ entries.

- [ ] **Step 5: Commit only the FAQ file**

Run:

```bash
git commit --only docs/faq.md -m "docs: add prototype workflow FAQ"
```

Expected: one commit that changes only `docs/faq.md`; unrelated staged and unstaged work remains untouched.
