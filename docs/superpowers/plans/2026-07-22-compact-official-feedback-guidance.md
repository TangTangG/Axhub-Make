# Compact Official Feedback Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized suspected-bug section with a compact rule for suggesting and generating official problem reports.

**Architecture:** Keep the existing global upgrade-first rules unchanged. Replace only the current “疑似系统 Bug 时” section with a neutral heading and two dense paragraphs: one for triggering feedback and one for comprehensive report contents, storage, and privacy.

**Tech Stack:** Markdown, Git

## Global Constraints

- Modify only `docs/guide-users-with-axhub-make.md` during implementation.
- Do not require AI to decide whether a problem is a system Bug before suggesting feedback.
- When the user agrees or already asks to report the issue, generate the Markdown report without asking again.
- Keep report format flexible and technical contents comprehensive.
- Preserve the existing upgrade-first work principle and standard-flow step exactly.
- Preserve the user's unrelated `docs/faq.md` modification.

---

### Task 1: Compress the official feedback section

**Files:**
- Modify: `docs/guide-users-with-axhub-make.md`

**Interfaces:**
- Consumes: the existing detailed report requirements and `.local/` privacy rule.
- Produces: one neutral official-feedback heading with exactly two body paragraphs and no field list.

- [ ] **Step 1: Inspect the current oversized section**

Run:

```bash
sed -n '55,92p' docs/guide-users-with-axhub-make.md
```

Expected: the section is titled “疑似系统 Bug 时” and contains two introductory paragraphs, eleven field bullets, and a storage paragraph.

- [ ] **Step 2: Replace the section with compact approved copy**

Replace everything from “## 疑似系统 Bug 时” up to but not including “## 选择指导形式” with:

```markdown
## 向官方反馈问题

遇到问题时，可以建议用户向 Axhub Make 官方反馈。用户同意或主动要求反馈时，直接整理一份 Markdown 报告，不再重复询问。

报告格式自由，但应尽量收集可取得的本地环境和技术细节，包括问题摘要、Axhub Make 与 Make 客户端版本、操作系统和运行环境版本、相关浏览器或第三方软件版本、问题入口、复现步骤、实际与预期结果、出现频率、完整报错、控制台/服务端/客户端日志、相关网络请求和响应、截图或视频、升级前后结果、影响范围和临时绕过方式。无法确认的内容标记为“未确认”，不要猜测；报告和附件保存在已忽略的 `.local/` 目录，提供给官方前完成脱敏。
```

- [ ] **Step 3: Verify compact structure and content coverage**

Run:

```bash
rg -n '^## 向官方反馈问题|主动要求反馈|不再重复询问|报告格式自由|Axhub Make 与 Make 客户端版本|网络请求和响应|\.local/' docs/guide-users-with-axhub-make.md
! rg -n '^## 疑似系统 Bug 时' docs/guide-users-with-axhub-make.md
! sed -n '/^## 向官方反馈问题$/,/^## 选择指导形式$/p' docs/guide-users-with-axhub-make.md | rg -q '^- '
section=$(sed -n '/^## 向官方反馈问题$/,/^## 选择指导形式$/p' docs/guide-users-with-axhub-make.md | sed '$d')
test "$(printf '%s\n' "$section" | sed '/^$/d' | wc -l | tr -d ' ')" -eq 3
```

Expected: the old heading and bullet list are absent; the new section contains one heading and exactly two non-empty body lines while retaining all required report categories.

- [ ] **Step 4: Verify upgrade rules remain unchanged**

Run:

```bash
rg -n '处理任何问题时，先确认 Axhub Make 和当前 Make 客户端是否有可用更新；有新版本时优先升级|检查 Axhub Make 和当前 Make 客户端是否有可用更新；有新版本时先升级' docs/guide-users-with-axhub-make.md
```

Expected: both existing upgrade-first rules remain present.

- [ ] **Step 5: Check the diff and whitespace**

Run:

```bash
git diff --check -- docs/guide-users-with-axhub-make.md
git diff -- docs/guide-users-with-axhub-make.md
```

Expected: `git diff --check` prints nothing; the diff only replaces the official-feedback section.

- [ ] **Step 6: Commit only the guidance document**

Run:

```bash
git commit --only docs/guide-users-with-axhub-make.md -m "docs: compact official feedback guidance"
```

Expected: one commit that changes only `docs/guide-users-with-axhub-make.md`; the user's `docs/faq.md` change remains uncommitted.
