# Axhub Make AI User Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI-facing Axhub Make user-guidance document and a one-sentence FAQ reference document beside the existing AI startup guide.

**Architecture:** Keep the behavioral guidance in one Markdown file and keep the FAQ placeholder intentionally minimal. The guidance selects evidence by question type, treats the three tutorial prototypes as important but incomplete examples, and escalates from text to annotated screenshots or captioned video only when that improves the user's ability to complete the task.

**Tech Stack:** Markdown, Git diff checks

## Global Constraints

- The primary reader is an AI Agent; the guided user is assumed to be a non-technical product manager or designer.
- Do not create or install a Skill.
- Do not modify `README.md`, the three tutorial prototypes, product code, or existing Skill files.
- Do not present the tutorial prototypes as a complete product capability list.
- Do not invent product behavior, UI entry points, FAQ questions, or FAQ answers.
- Mention `docs/faq.md` only as a reference source; do not add FAQ maintenance or generation rules.
- Store any future temporary screenshots or recordings under ignored `.local/` paths and do not commit them by default.

---

### Task 1: Add the AI guidance and FAQ reference

**Files:**
- Create: `docs/guide-users-with-axhub-make.md`
- Create: `docs/faq.md`

**Interfaces:**
- Consumes: `docs/start-axhub-make-with-ai.md`, the current GitHub repository, the user's local project, and the three tutorial prototype directories.
- Produces: An AI-readable guidance protocol and the `docs/faq.md` reference target used by that protocol.

- [ ] **Step 1: Confirm both target paths are new**

Run:

```bash
test ! -e docs/guide-users-with-axhub-make.md
test ! -e docs/faq.md
```

Expected: both commands exit with status 0 and print no output.

- [ ] **Step 2: Create the AI-facing guidance document**

Create `docs/guide-users-with-axhub-make.md` with exactly this content:

```markdown
# 使用 AI Agent 指导用户使用 Axhub Make

这份文档给 AI Agent 阅读。你的任务是结合用户当前页面、本地项目和 Axhub Make 的现有资料，为用户提供可以直接跟随的使用指导；必要时使用标注截图或带字幕视频。

这不是完整的产品功能手册，也不是 Skill。不要仅凭这份文档推断 Axhub Make 的全部能力。

## 默认用户

默认用户是不了解代码、终端和项目结构的产品经理或设计师。不要假设用户理解 Git、Node.js、npm、端口、路由、源码或项目目录。

由你承担资料检索、项目检查、版本确认和环境诊断。只有登录、授权、业务选择或必须由用户确认的操作，才交给用户完成。

## 工作原则

1. 先确认用户想完成什么，以及当前所在页面、项目和版本。
2. 先查证，再回答。不要根据产品名称、按钮名称或行业惯例猜测功能。
3. 使用用户当前环境中的真实入口和界面名称，不给出脱离当前版本的泛化步骤。
4. 每轮只让用户处理当前必要步骤，避免一次提供大量技术信息。
5. 出现问题时先查明原因，再提供恢复步骤，不要求用户阅读日志自行判断。
6. 用户没有完成时，从当前状态继续指导，不让用户无故从头开始。

## 参考信息源

先识别问题类型，再选择最直接、适用于当前版本的证据，不要机械地套用固定顺序。

### 用户当前页面和本地项目

用户当前看到的页面、正在执行的操作和本地项目文件，用于判断用户此刻所处的状态以及下一步应该做什么。涉及页面入口、项目配置、已有内容或当前错误时，优先检查这些实际状态。

### Axhub Make GitHub 仓库

[Axhub Make GitHub 仓库](https://github.com/lintendo/Axhub-Make)中的当前文档、配置和源码，用于确认产品实际支持的能力、入口、前置条件和版本行为。

### 默认客户端教程

默认客户端中的三个教程原型是重要的教学资料：

- `client/src/prototypes/beginner-guide/`
- `client/src/prototypes/touch-and-talk-annotation-demo/`
- `client/src/prototypes/annotation-demo/`

使用这些教程学习推荐流程、讲解方式和典型场景。它们只覆盖部分核心功能，不是完整的产品能力清单。教程没有提到某项能力，不代表产品不支持；继续检查当前 GitHub 仓库和用户本地项目。教程与当前页面或当前版本证据冲突时，以适用于用户当前环境的证据为准。

### FAQ

遇到相关问题时，将 [Axhub Make FAQ](./faq.md) 作为参考信息源。

## 处理证据冲突

- 回答“用户此刻如何操作”时，以用户当前页面和本地项目状态为准。
- 回答“产品当前支持什么”时，以当前 GitHub 仓库中的正式文档、配置和源码为准。
- 回答“怎样向新手讲清楚”时，可以借鉴默认客户端教程的结构和示例。
- 历史截图、旧视频或旧版本资料与当前证据冲突时，不得覆盖当前事实。
- 找不到可靠证据时，明确告诉用户尚未确认，并继续检查，不要猜测答案。

## 标准指导流程

1. 确认用户目标、当前页面、项目和版本。
2. 检查与问题直接相关的本地状态和官方资料。
3. 确认入口、权限、前置条件和完成后的预期结果。
4. 判断文字是否足以让用户完成操作；不足时再使用标注截图或带字幕视频。
5. 给出当前步骤，并说明用户完成后应该看到什么。
6. 确认问题是否解决；未解决时基于用户当前状态继续。

## 选择指导形式

### 文字

简单问题直接回答，并明确下一步。多步骤任务使用编号步骤，每一步只包含一个主要动作，并说明：

- 在哪里操作；
- 需要做什么；
- 完成后会看到什么。

### 标注截图

用户找不到入口、容易混淆相邻控件，或仅靠文字难以定位时，使用当前版本界面的标注截图。每张截图突出当前目标，不要堆叠大量标记。

### 带字幕视频

流程较长、包含连续动态操作，或截图无法清楚表达状态变化时，录制带字幕的视频。视频应展示经过验证的实际操作过程，不要模拟尚未确认的界面或结果。

## 表达要求

- 使用界面上的真实名称描述入口，避免技术黑话。
- 必须使用技术词时，紧接一句通俗解释。
- 不把终端命令、源码搜索或环境排查作为面向非技术用户的默认步骤。
- 无法继续时，说明缺少什么信息，并用最简单的方式取得当前状态，例如请用户提供当前页面截图或授权你检查。
- 不确定产品行为、入口或结果时明确说明，不得为了让回答显得完整而编造。

## 图片、视频和隐私

截图、录屏和临时标注文件保存在项目已忽略的 `.local/` 目录，默认不提交到仓库。向用户或其他人提供素材前，遮挡账号、项目名称、访问地址和其他隐私信息。

使用图片或视频时说明适用版本。旧素材不能冒充当前界面；界面已经变化时，重新获取当前版本素材。

## 完成标准

用户应当知道当前要做什么、在哪里操作，以及完成后会看到什么。指导结束前确认问题是否解决；如果没有解决，保留已有进度并从当前页面继续。
```

- [ ] **Step 3: Create the minimal FAQ reference**

Create `docs/faq.md` with exactly this content:

```markdown
# Axhub Make FAQ

本文件用于提供 Axhub Make 常见问题参考。
```

- [ ] **Step 4: Verify structure, required boundaries, and formatting**

Run:

```bash
test -f docs/guide-users-with-axhub-make.md
test -f docs/faq.md
rg -n "这份文档给 AI Agent 阅读|产品经理或设计师|只覆盖部分核心功能|标注截图|带字幕视频|\./faq\.md" docs/guide-users-with-axhub-make.md
test "$(wc -l < docs/faq.md | tr -d ' ')" -eq 3
git diff --check -- docs/guide-users-with-axhub-make.md docs/faq.md
git diff -- docs/guide-users-with-axhub-make.md docs/faq.md
```

Expected:

- Both `test -f` commands exit with status 0.
- `rg` finds all six required concepts in the guidance document.
- The FAQ line-count check exits with status 0.
- `git diff --check` prints no output.
- The final diff contains only the two new Markdown files and no invented FAQ entries.

- [ ] **Step 5: Commit the completed documentation**

Run:

```bash
git add docs/guide-users-with-axhub-make.md docs/faq.md
git commit --only docs/guide-users-with-axhub-make.md docs/faq.md -m "docs: add AI user guidance"
```

Expected: one commit containing exactly the two new documentation files; pre-existing staged Skill changes remain outside the commit.
