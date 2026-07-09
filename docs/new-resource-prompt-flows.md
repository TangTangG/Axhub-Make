# 新建原型与设计 Prompt 流程

本文记录 Make 管理端里“新建原型”和“新建设计”相关入口当前会生成或发送的 AI prompt。这里的“prompt”指复制给 AI 或通过 AI 侧栏发送的文本；单纯创建占位资源本身不等于生成 prompt。

## 入口总览

| 入口 | 当前行为 | Prompt 来源 |
| --- | --- | --- |
| 左侧原型栏“新建原型” | 创建占位原型并打开空白开始页，不立即生成 prompt | 无 |
| 占位原型开始页提交 | 将用户输入包装为“创建原型页面” prompt 后提交 | `StartGuide` + `canvasAiSceneRegistry` + `canvasGenerationPromptSettings` |
| 原型导入弹窗“在线模板” | 复制或发送模板导入 prompt | `generateTemplateImportPrompt` |
| 原型导入弹窗“上传后继续交给 AI” | 使用上传接口返回的 `prompt` | `/api/upload` 相关转换逻辑 |
| 资产-设计“新建设计” | 打开设计系统开始页，不立即生成 prompt | 无 |
| 设计系统开始页提交 | 将用户输入包装为“生成设计规范或设计系统” prompt 后提交 | `StartGuide` + `canvasAiSceneRegistry` |
| 设计导入弹窗“在线选择” | 复制或发送设计系统导入 prompt | `generateThemeLibraryImportPrompt` |
| 设计导入弹窗“上传”或“直接导入” | 直接导入资源，不走 AI prompt | 无 |

## 新建原型

左侧原型栏的“新建原型”按钮接到 `onCreatePlaceholderPrototype`，最终调用 `handleCreatePlaceholderPrototype`。它请求 `/api/prototypes/create-placeholder`，创建一个占位原型并选中该原型。

因此点击按钮本身没有 AI prompt。占位页显示的引导文案是：

```text
这个原型还没有开始创建

告诉 AI 你想做什么：目标用户、使用场景、页面内容和参考风格。
```

占位页 tips 里会提示：

```text
模型不要用 auto，推荐：Claude Opus 4.8、Gemini 3.1 Pro、GPT-5.5、Kimi K2.7、GLM-5.2。
一个任务一个对话，避免多个需求互相干扰。
多用图片和语音，截图、草图和参考页面更清楚。
如果已有视觉规范，建议先创建设计系统。
```

## 占位原型开始页 Prompt

占位原型开始页只有 `page` 场景，来源标记为 `placeholder-start`。用户在输入框里提交后，最终 prompt 结构是：

```text
{用户输入}

请创建原型页面。

原型生成设置：
- 方案数量：{count} 个
- 多方案提示：用户选择了方案数量，请加载本地 explore-options（多方案探索）技能提示，生成 {count} 个真实不同的可行原型方案。
- 设计系统：{themeName}
- 需求分析：使用 $requirements-exploration 对当前需求做探索和完善，先补齐目标用户、核心任务、范围、关键流程和验收口径。
```

设置块只在有对应选项时追加：

- `方案数量`：用户选择数量时出现，范围会裁剪到 1-4。
- `设计系统`：用户选择非空设计系统时出现。
- `需求分析`：用户打开需求分析开关时出现。

直接提交给 AI 时不会追加收尾句。若通过开始页的“复制给本地 AI”动作复制，则先移除画布更新类指令，再追加：

```text
请回复了解并等待用户发送需求。
```

提交时，`handleSubmitPrototypeStartRequest` 会先把占位原型标记为生成中，再把 prompt 交给 `onSubmitCanvasAssistantPrompt`，最终走 `/api/ai/runs`。

## 原型在线模板导入 Prompt

原型导入弹窗的“在线导入”卡片会使用 `generateTemplateImportPrompt`。模板如下：

```text
请导入 Make Template 原型 `{template.slug}`。

**来源**：
- GitHub 目录：{sourceUrl}

**目标**：
- 优先放到当前项目 metadata 声明的 prototypes 目录：<prototypes>/{targetSlug}
- 读取不到 metadata 声明时，使用当前项目的 src/prototypes/{targetSlug}
{如果覆盖占位原型：- 必须覆盖当前占位原型目录；不要创建新的原型目录，不要改用模板自带目录名}
{如果新建原型：- 创建一个新原型；若目标目录已存在，停止并询问；不要覆盖或自动改名}

**要求**：
1. 复制来源目录的全部内容，保持目录结构。
2. 确认目标目录包含 index.tsx；缺失则停止并说明模板不完整。
3. 完成后运行项目适用的构建或运行验证；如有导入问题，修复后交付。

**额外依赖**：
{有依赖时逐条列出，并要求先检查当前项目是否已安装；缺失时使用 npm 只安装缺失依赖，并验证项目构建/运行。}
{无依赖时：无；除非验证明确报缺包，否则不要安装依赖。}
```

如果这个导入是从占位原型里发起，`targetSlug` 会优先用当前占位原型名，并带上“必须覆盖当前占位原型目录”的要求。

## 原型上传后继续交给 AI

原型导入弹窗上传后，如果上传类型需要 AI 继续处理，按钮不重新生成 prompt，而是直接使用上传接口返回的 `uploadResult.prompt`。

当前有两类主要返回形态：

```text
{converter 返回的 parsed.prompt}

**目标原型覆盖要求**：本次导入必须覆盖当前占位原型 `prototypes/{targetPrototypeName}`，不要创建新的原型目录，不要改用上传压缩包或转换产物自带的目录名。
```

或：

```text
{config.label} 项目已上传并预处理完成。

请先在仓库中读取以下转换任务清单：
- {tasksFile}

然后根据该任务清单和项目 rules，完成具体的转换工作。

**目标原型覆盖要求**：本次导入必须覆盖当前占位原型 `prototypes/{targetPrototypeName}`，不要创建新的原型目录，不要改用上传压缩包或转换产物自带的目录名。
```

如果上传 ZIP 文件名被清理后需要重命名目标目录，覆盖要求会变成“覆盖当前占位原型并将目录重命名为 `prototypes/{renamedFolderName}`”。

Axhub Make / Axhub 包这类可直接导入的类型不会展示 AI prompt 按钮。

## 新建设计

资产页“设计”区域的“新建设计”按钮接到 `handleCreateThemeStartDraft`。它只是切到 `assets -> themes`，清空当前选中的设计，并打开设计系统开始页，不立即生成 prompt。

设计系统开始页只有 `design` 场景，来源标记为 `theme-start`。提交时最终 prompt 结构是：

```text
{用户输入}

请生成设计规范或设计系统。
```

当前设计系统开始页不会追加“图片生成设置”块，也没有 quick prompt。它同样通过 `onSubmitCanvasAssistantPrompt` 提交。

## 设计系统在线导入 Prompt

设计导入弹窗的“在线选择”卡片会使用 `generateThemeLibraryImportPrompt`。模板如下：

```text
请导入设计系统主题 `{designSystem.slug}`。

**来源**：
- GitHub 目录：{sourceUrl}

**目标**：
- 优先放到当前项目 metadata 声明的 themes 目录：<themes>/{designSystem.slug}
- 读取不到 metadata 声明时，使用当前项目的 src/themes/{designSystem.slug}
- 若目标目录已存在，停止并询问；不要覆盖或自动改名

**要求**：
1. 导入前确认来源目录不是空内容；遇到来源为空、404、DESIGN NOT FOUND、Not Found 或只有空模板时，停止并说明来源不可用。
2. 不要补写、猜测或套用通用主题内容；没有明确来源证据的 token、页面、建议项/禁止项都不要生成或显示。
3. 复制来源目录的全部内容，保持目录结构。
4. 确认目标目录至少包含 index.tsx 或 designToken.json；缺失则停止并说明模板不完整。
5. 完成后运行项目适用的构建或运行验证；如有导入问题，修复后交付。
```

设计导入弹窗的“上传”会直接调用上传导入逻辑，在线卡片的“直接导入”会直接调用 `/api/theme-library/import`。这两条都不会生成 AI prompt。

## 相关资源开始页

文档资源开始页和设计图资源开始页复用同一个 `StartGuide`。它们不是“原型新建”或“设计系统新建”的主入口，但 prompt 规则相同：

- `resource + design`：`{用户输入}\n\n请生成设计图资源。`，可追加“图片生成设置”。
- `resource + document`：`{用户输入}\n\n请生成文档资源。`，可追加“文档生成设置”。

图片生成设置模板：

```text
图片生成设置：
- 尺寸：{size}
- 质量：{quality}
- 方案数量：{n} 个
- 多方案提示：用户选择了方案数量，请加载本地 explore-options（多方案探索）技能提示，生成 {n} 个真实不同的可行设计方案。
- 格式：{output_format}
- 设计系统：{themeName}
- 禁止优化提示词：请不要改写用户输入的提示词，直接按原始提示词生成图片。
- 背景：transparent
```

文档生成设置模板：

```text
文档生成设置：
- 文档格式：{HTML | Markdown | Mermaid 图表 | Drawio 图表}
- HTML 视觉主题：{主题说明}
- 文档模板：resources/templates/{templateName}
- 需求分析：使用 $requirements-exploration 对当前需求做探索和完善，先补齐目标用户、核心任务、范围、关键流程和验收口径。
```

## 备用或遗留 Prompt 函数

下面两个函数名字仍然存在，但当前 UI 新建流程没有调用它们。

### `generateCreatePrompt`

位置：`src/index/utils/prompts.ts`。

输出结构：

```text
**任务**：新建一个{原型或组件}

**主题配置**：
- `{themeName}` - {themeDisplayName}

**参考文档**：
- `{docName}` - {docDisplayName}

**参考数据**：
- `{dataAssetName}` - {dataAssetDisplayName}
```

只有选中的 section 才会出现。

### `generateCreateThemePrompt`

位置：`src/index/utils/themePrompts.ts`。

输出结构：

```text
**系统指令**：你将作为 UI/UX 设计架构师 × 前端工程师（复合型），协助用户「新建设计系统」。

**📋 参考文档（必须阅读）**：
- `AGENTS.md`
- `rules/theme-guide.md`
- `rules/resource-management-guide.md`

**参考文档**：
{选中的文档；没有则为 - 无}

**参考原型页面**：
{选中的原型页面；没有则为 - 无}

**目标输出**：
- 在项目当前主题资源约定的位置创建一个新的设计系统目录
- 产出完整的 `DESIGN.md`、`theme.json`、`assets/tokens.json`、`style.css`、`tw.css` 和 `index.tsx`
- 设计系统应能被管理端识别，并能作为后续原型生成的主题配置使用

**执行要求**：
- 先阅读参考文档和参考原型，判断业务类型、信息密度、页面气质和可复用视觉规则
- 以 `DESIGN.md` 作为事实源，再同步派生 `theme.json`、token、样式和演示入口
- 新设计系统必须用自己的命名、色彩、字体、圆角、间距、组件规则和 Do/Don't，不要复制参考主题的品牌内容
- 资源引用使用主题目录内相对路径；不要写入本机绝对路径、根路径或跨目录逃逸路径
- 完成后运行项目适用的主题验收或就绪检查，并修复到通过
```

## 主要源码位置

- `src/index/app/index-page/useIndexPageResourceActions.tsx`：占位原型创建。
- `src/index/app/IndexPage.tsx`：新建设计开始页状态切换、提交动作接线。
- `src/index/components/content/ContentAreaView.tsx`：`StartGuide` prompt 组装与提交。
- `src/index/domains/ai-generation/canvasAiSceneRegistry.ts`：开始页场景、系统句、占位文案、quick prompt。
- `src/index/domains/ai-generation/canvasGenerationPromptSettings.ts`：原型、图片、文档设置块与收尾句。
- `src/index/components/dialogs/CreateDialogView.tsx`：原型导入弹窗。
- `src/index/utils/templateImportPrompts.ts`：在线模板导入 prompt。
- `src/index/components/dialogs/CreateThemeDialogView.tsx`：设计导入弹窗。
- `src/index/utils/themePrompts.ts`：设计系统导入 prompt 与备用新建设计系统 prompt。
