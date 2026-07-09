# Review Prompt 执行场景

本文记录 Make 管理端原型预览页右侧 Review 面板里，AI 评审的“AI 执行 / 网页中 AI 执行 / 复制提示词”三种动作当前如何生成和投递 prompt。

这里的 Review 面板指 `UiReviewPanel` 底部“AI 评审”区域，不包含 Axure 导出前检查弹窗里的“复制检查信息”。

## 结论

同一个评审类型下，三种动作使用的是同一套评审 prompt 模板，不会因为“AI 执行”“网页中 AI 执行”或“复制提示词”而改写正文。

差异主要在执行通道：

| 动作 | Prompt 正文 | 运行通道 | 默认 AI 检测 | 结果处理 |
| --- | --- | --- | --- | --- |
| AI 执行 | 使用当前 `ReviewKind` 对应的 `reviewPrompts[kind]` | 直接调用 `/api/ai/runs` 相关 direct run | 会检测默认本地 AI Agent | 等待执行完成后刷新评审报告列表并打开报告 |
| 网页中 AI 执行 | 同上 | 打开/使用右侧网页 AI 侧栏并提交 | 会检测默认本地 AI Agent | 只提示已发送；失败时回退复制 |
| 复制提示词 | 同上 | 写入剪贴板 | 不检测 | 只提示复制成功 |

## 两种评审类型

Review 面板当前有两个评审类型，而不是三套 prompt 模板：

| `ReviewKind` | UI 标签 | 报告标题 | 规则文件 | 输出文件 |
| --- | --- | --- | --- | --- |
| `design` | 设计评审 | `UI Review` | `rules/ui-review-guide.md` | `.spec/reviews/ui-review.md` |
| `requirements` | 需求评审 | `Prototype Review` | `rules/prototype-review-guide.md` | `.spec/reviews/prototype-review.md` |

这两种评审类型都会显示同样的三个动作：`AI 执行`、`网页中 AI 执行`、`复制提示词`。

## Prompt 生成流程

Review 面板里的每一行动作都调用：

```text
buildReviewPromptForKind(kind)
```

它会先执行：

```text
onStartReview(kind)
```

把当前 pending review 类型切到对应的 `kind`，再返回：

```text
reviewPrompts[kind] || reviewPrompt
```

`reviewPrompts` 在 `useIndexPagePreviewActions` 中预先按两种 `ReviewKind` 构造：

```text
design       -> buildReviewPrompt({ kind: 'design', ... })
requirements -> buildReviewPrompt({ kind: 'requirements', ... })
```

因此，对同一个 `kind` 来说，三个动作拿到的是同一份 prompt 文本。

## Prompt 模板

`buildReviewPrompt` 的公共结构如下：

```text
请对{当前原型执行 UI Review 或 当前原型执行 Prototype Review / 需求评审}，并把结果写成 Markdown。

【前置阅读】
- 请先读取并严格遵循：{规则文件}
- 请先读取并套用报告模板：{报告模板}

【评审目标】
- 原型：{prototypeLabel}
- 源码路径：{sourcePath}
- 评审结果写入：{reviewDocumentPath}

【执行要求】
1. {按对应评审流程执行}
2. {读取对应依据}
3. 输出 Markdown，不要输出 JSON，不要写 .impeccable 产物作为交付。
4. 优先级只使用 P0-P3，最多列出 5 条优先级问题。
5. Markdown 至少包含：{最低章节要求}
6. 请严格按报告模板输出，不要删掉模板中的 frontmatter、固定一级标题或固定分组。
{frontmatter、title、reviewer、createdAt、source、score 的固定要求}
7. 正文必须使用 Markdown 标题语法：报告标题、分组标题和问题小节都要使用井号标题；问题小节的优先级按实际判断填写，不要照抄模板占位或固定优先级。

【最终回复要求】
- 说明已写入的路径：{reviewDocumentPath}
- 汇总 P0-P3 数量。
```

### 设计评审 Prompt 差异

设计评审使用 `kind: 'design'`，核心差异是：

```text
请对当前原型执行 UI Review，并把结果写成 Markdown。

【前置阅读】
- 请先读取并严格遵循：rules/ui-review-guide.md
- 请先读取并套用报告模板：client/src/resources/templates/ui-review-report-template.md

【执行要求】
1. 按 rules/ui-review-guide.md 的 Impeccable 参考流程做评审，不要调用 /impeccable 命令。
2. 优先读取当前原型附近的 DESIGN.md；如果没有 DESIGN.md，则按常规设计评审执行。
5. Markdown 至少包含：总体点评、P0-P3 优先级问题、核心元件/关键区块点评。
```

输出路径优先解析为：

```text
src/prototypes/{prototype-id}/.spec/reviews/ui-review.md
```

如果当前资源有显式 `filePath` 或 `absoluteFilePath`，会先去掉末尾 `index.tsx / index.ts / index.jsx / index.js / index.html`，再拼：

```text
{prototypeDir}/.spec/reviews/ui-review.md
```

### 需求评审 Prompt 差异

需求评审使用 `kind: 'requirements'`，核心差异是：

```text
请对当前原型执行 Prototype Review / 需求评审，并把结果写成 Markdown。

【前置阅读】
- 请先读取并严格遵循：rules/prototype-review-guide.md
- 请先读取并套用报告模板：client/src/resources/templates/prototype-review-report-template.md

【执行要求】
1. 按 rules/prototype-review-guide.md 的需求评审流程做评审，不要引用 Impeccable。
2. 优先读取需求规范文件 src/prototypes/{prototype-id}/.spec/requirements.md；如果没有该文件，则按项目资料、.spec 决策和 src/resources 资料做常规需求评审。
5. Markdown 至少包含：总体点评、P0-P3 优先级问题、完整性与项目对齐。
```

输出路径优先解析为：

```text
src/prototypes/{prototype-id}/.spec/reviews/prototype-review.md
```

如果当前资源有显式 `filePath` 或 `absoluteFilePath`，同样先定位原型目录，再拼：

```text
{prototypeDir}/.spec/reviews/prototype-review.md
```

## 三个动作的具体差异

### 1. AI 执行

入口是 Review 面板每一行的主按钮，默认动作固定为 `direct`。

流程：

```text
点击 AI 执行
-> runAction('direct')
-> buildReviewPromptForKind(kind)
-> onRunReviewDirect(kind)
-> handleRunReviewDirect(kind)
-> onRunReviewAssistantPromptViaApi({ context, prompt, targetPath })
-> submitAnnotationPromptViaApi(...)
-> runAiStream(...)
```

这条链路会检查：

- 是否选中了原型。
- `onRunReviewAssistantPromptViaApi` 是否存在。
- prompt 是否为空。
- 默认本地 AI Agent 是否已配置。
- `annotationPromptClient || preferredPromptClient` 能否解析出 ACP provider。

提交时 scene 固定为：

```text
prototype-review-direct
```

targetPath 是对应评审报告路径，例如：

```text
src/prototypes/home/.spec/reviews/ui-review.md
src/prototypes/home/.spec/reviews/prototype-review.md
```

context 会被改成以评审报告路径为当前文件：

```text
currentFile.path = targetPath
extensions.paths.currentFilePath = targetPath
extensions.paths.currentFileDirectory = dirname(targetPath)
```

执行结束后会刷新 Review 报告列表，并尝试打开刚生成或更新的报告。

注意：`runAction('direct')` 里虽然会先读取一次 prompt 做空值校验，但实际提交的 prompt 来自 `handleRunReviewDirect` 里再次按 `kind` 读取的 `reviewPrompts[kind] || reviewPrompt`。

### 2. 网页中 AI 执行

入口是 Review 面板按钮右侧下拉里的“网页中 AI 执行”。

流程：

```text
点击 网页中 AI 执行
-> runAction('web')
-> buildReviewPromptForKind(kind)
-> onExecutePrompt(prompt, { scene, targetPath })
-> handleExecutePromptAction(...)
-> handleSubmitAnnotationAssistantPrompt(...)
-> openAssistantWithContextAndSubmitPrompt(...)
```

这里传入的 scene 是按评审类型区分的：

```text
prototype-review-design
prototype-review-requirements
```

targetPath 同样是对应评审报告路径。

这条链路也会检查默认本地 AI Agent，因为 `handleSubmitAnnotationAssistantPrompt` 会调用 `ensureDefaultAiConfigured(preferredPromptClient)`。

和 direct run 的主要区别：

- 它走右侧网页 AI 侧栏，不是 direct run。
- waitUntil 只等到 `started`。
- 成功后只提示“已发送到网页 AI 侧栏”，不会等待评审完成，也不会自动刷新报告列表。
- 如果 `onExecutePrompt` 不存在，或返回 `false`，会回退为复制 prompt。

### 3. 复制提示词

入口是 Review 面板按钮右侧下拉里的“复制提示词”。

流程：

```text
点击 复制提示词
-> runAction('copy')
-> buildReviewPromptForKind(kind)
-> navigator.clipboard.writeText(prompt)
```

这条链路不会检查默认 AI，也不会打开侧边栏或 direct run，只把 prompt 文本写入剪贴板。

## 和普通 PromptActionButton 的区别

Review 面板没有直接复用通用 `PromptActionButton`，而是在 `UiReviewPanel` 里实现了自己的 `ReviewPromptActionButton`。

关键差异：

- 通用 `PromptActionButton` 只有 `copy` 和 `execute` 两种动作。
- Review 的按钮有 `direct`、`web`、`copy` 三种动作。
- Review 的默认动作固定是 `direct`，不会根据 AI 侧栏是否打开切换默认动作。
- Review 的 `web` 动作才对应通用按钮里的“发送到 AI 侧栏”。

## Axure 导出前检查不是这三个场景

Axure 导出前检查失败时弹出的 `ExportReviewDialogView` 只提供“复制检查信息”，使用的是 `buildExportReviewPrompt(reviewResult)`。

这个 prompt 用于修复 Axure 导出阻断问题，结构大致是：

```text
请修复这个 Axure 导出阻断问题，保持现有业务行为、交互和视觉不变。

资源：{resourceName}
规则：
- Axure 导出工作流：`rules/axure-export-workflow.md`
- Axure API 规范：`rules/axure-api-guide.md`

阻断问题：
{blocking issues}

要求：
- 不要为了过检查强行新增非必需 Axure API
- 输出简短改动摘要
```

它不走 Review 面板的 `direct / web / copy` 三动作，也不会直接发送给 AI 侧栏。

## 主要源码位置

- `src/index/components/content/UiReviewPanel.tsx`：Review 面板、三动作按钮、按钮文案和动作分发。
- `src/index/app/index-page/useIndexPagePreviewActions.tsx`：评审 prompt、评审报告路径、direct run 提交与报告刷新。
- `src/index/utils/uiReviewPrompt.ts`：`ReviewKind` 配置、评审报告路径解析、评审 prompt 模板。
- `src/index/app/IndexPage.tsx`：默认 AI 检测、网页 AI 侧栏提交、direct run API 提交接线。
- `src/index/domains/assistant/annotationDirectRun.ts`：direct run 的 runId/threadId/contextBundle/targetPath 组装。
- `src/index/components/PromptActionButton.tsx`：通用两动作 prompt 按钮，对比 Review 专用按钮。
- `src/index/components/dialogs/ExportReviewDialogView.tsx`：Axure 导出前检查失败弹窗。
- `src/index/utils/exportReviewPrompt.ts`：Axure 导出检查失败的修复 prompt。
