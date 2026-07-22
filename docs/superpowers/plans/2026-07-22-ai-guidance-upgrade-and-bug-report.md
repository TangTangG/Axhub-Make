# AI Guidance Upgrade Priority and Bug Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make version upgrades the first troubleshooting action and require a detailed Markdown report for suspected Axhub Make bugs.

**Architecture:** Update the existing AI-facing guidance in three coordinated places: one global work principle, one explicit standard-flow step, and one dedicated suspected-bug section. Keep report structure flexible while requiring comprehensive environment, version, reproduction, error, log, and evidence details.

**Tech Stack:** Markdown, Git

## Global Constraints

- Modify only `docs/guide-users-with-axhub-make.md` during implementation.
- For every problem, check Axhub Make and Make client versions first; when updates are available, upgrade before continuing diagnosis.
- Do not hard-code current version numbers; read the user's actual environment.
- Bug report format is flexible, but available local environment and technical details must be as complete as possible.
- Do not add a report narrative-perspective rule or require the AI to write in a special voice.
- Do not invent a fixed report filename, template, or official submission channel.
- Preserve unrelated staged and unstaged work, including the existing `docs/faq.md` modification.

---

### Task 1: Add upgrade priority and detailed Bug reporting guidance

**Files:**
- Modify: `docs/guide-users-with-axhub-make.md`

**Interfaces:**
- Consumes: the existing work principles, standard guidance flow, `.local/` privacy rules, and versions detected from the user's current Axhub Make environment.
- Produces: an AI workflow that upgrades first and creates a comprehensive Markdown report when a suspected product bug remains or has reliable evidence.

- [ ] **Step 1: Inspect the target guidance sections**

Run:

```bash
sed -n '10,110p' docs/guide-users-with-axhub-make.md
```

Expected: work principles and the standard flow mention the current version but do not prioritize upgrades; there is no suspected-system-bug section.

- [ ] **Step 2: Add the global upgrade-first work principle**

Replace the current six-item “工作原则” list with:

```markdown
1. 先确认用户想完成什么，以及当前所在页面、项目和版本。
2. 处理任何问题时，先确认 Axhub Make 和当前 Make 客户端是否有可用更新；有新版本时优先升级，并在升级后的版本上重新尝试原操作。
3. 先查证，再回答。不要根据产品名称、按钮名称或行业惯例猜测功能。
4. 使用用户当前环境中的真实入口和界面名称，不给出脱离当前版本的泛化步骤。
5. 每轮只让用户处理当前必要步骤，避免一次提供大量技术信息。
6. 出现问题时先查明原因，再提供恢复步骤，不要求用户阅读日志自行判断。
7. 用户没有完成时，从当前状态继续指导，不让用户无故从头开始。
```

- [ ] **Step 3: Add version upgrade to the standard flow**

Replace the current six-item “标准指导流程” list with:

```markdown
1. 确认用户目标、当前页面、项目和版本。
2. 检查 Axhub Make 和当前 Make 客户端是否有可用更新；有新版本时先升级，并重新尝试用户原操作。
3. 检查与问题直接相关的本地状态和官方资料。
4. 确认入口、权限、前置条件和完成后的预期结果。
5. 判断文字是否足以让用户完成操作；不足时再使用标注截图或带字幕视频。
6. 给出当前步骤，并说明用户完成后应该看到什么。
7. 确认问题是否解决；未解决时基于用户当前状态继续。
```

- [ ] **Step 4: Add the suspected-system-bug section**

Insert the following section after “标准指导流程” and before “选择指导形式”:

```markdown
## 疑似系统 Bug 时

完成版本检查和优先升级后，如果问题在当前可用版本上仍存在，或虽然不能稳定复现但已有可靠错误与日志证据，整理一份 Markdown 报告提供给 Axhub Make 官方。不能稳定复现时，记录出现频率、最近发生时间和已知触发条件；缺少的事实写明“未确认”，不要猜测根因。

报告不强制使用固定模板，可以按问题自由组织，但应尽量保留完整的本地环境和技术细节，方便官方定位。至少包含：

- 一句话问题摘要；
- Axhub Make 版本和 Make 客户端版本；无法确认时明确标记；
- 操作系统版本与架构，以及 Node.js、npm 等相关运行环境版本；
- 浏览器名称与版本，以及与问题直接相关的 Agent/CLI、Axure 或其他第三方软件版本；
- 用户目标和发生问题的页面、入口或功能；
- 可复现步骤和已知触发条件；
- 实际结果与预期结果，以及问题出现频率和是否可以稳定复现；
- 完整报错文本、浏览器控制台、服务端或客户端日志、相关网络请求和响应；
- 截图、视频、发生时间，以及与问题直接相关且已脱敏的配置或文件片段；
- 已执行的版本升级，以及升级后的复现结果；
- 影响范围和已知临时绕过方式；没有时可以省略。

报告和附件默认保存在项目已忽略的 `.local/` 目录，不提交仓库。交给官方前遮挡账号、项目名称、访问地址、密钥和其他隐私信息。
```

- [ ] **Step 5: Verify content coverage and corrected scope**

Run:

```bash
rg -n '处理任何问题时|有新版本时优先升级|有新版本时先升级|^## 疑似系统 Bug 时|Axhub Make 版本和 Make 客户端版本|操作系统版本与架构|Node\.js、npm|浏览器名称与版本|完整报错文本|网络请求和响应|已执行的版本升级|\.local/' docs/guide-users-with-axhub-make.md
```

Expected: both upgrade-first rules and every required Bug-report evidence category are present. The new section contains no “报告视角”, “受影响用户向”, or “保持简短” wording, and explicitly says the template is not fixed.

- [ ] **Step 6: Check the document diff and whitespace**

Run:

```bash
git diff --check -- docs/guide-users-with-axhub-make.md
git diff -- docs/guide-users-with-axhub-make.md
```

Expected: `git diff --check` prints nothing; the diff only updates the two lists and adds the approved Bug-report section.

- [ ] **Step 7: Commit only the guidance document**

Run:

```bash
git commit --only docs/guide-users-with-axhub-make.md -m "docs: add upgrade-first bug reporting guidance"
```

Expected: one commit that changes only `docs/guide-users-with-axhub-make.md`; the user's existing `docs/faq.md` modification remains untouched.
