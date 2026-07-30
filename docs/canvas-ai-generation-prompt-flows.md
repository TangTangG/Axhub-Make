# 画布 AI 生成 Prompt 流程

本文整理 Make 管理端画布里的 AI 生成 prompt 拼装规则，重点覆盖画布通用生成入口、批注卡片执行、AI 图片节点和提示词优化。

## 当前原则

- 不再提供「快捷提示」预设：输入框、`/` 触发、图片右键菜单都不追加预设 prompt。
- 场景开始指令需要明确生成结果要更新到当前画布。
- 画布写回定位只提供必要信息：画布文件、占位节点、首个产物覆盖占位节点。
- 具体读写 Excalidraw JSON、files、customData 等细节交给 `canvas-workspace` 技能说明，不在入口 prompt 里重复展开。
- 占位节点只给 ID，不再把 `x/y/w/h` 拼进 prompt。

## 通用画布生成入口

位置：`src/index/domains/ai-generation/CanvasAiGenerationTool.tsx`。

通用入口支持三个场景：

| 场景 | 产物 | 开始指令 |
| --- | --- | --- |
| `page` | 原型页面 | `请生成原型页面，并更新到当前画布。` |
| `design` | 设计图 / 图片 | `请使用内置工具生成图片；若无相关工具，请停止并告知用户。生成后请更新到当前画布。` |
| `document` | 文档 / 流程图 / 关系图 | `请生成文档、流程图或关系图，并更新到当前画布。` |

提交时最终模板：

```text
{用户输入}

{场景开始指令}

{生成设置，可选}

画布写回定位：
- 画布文件：{canvasFilePath}
- 占位节点：{statusTaskId}
- 首个产物必须覆盖或替换占位节点；多个产物从该位置向右排列。
- 写回方式按 canvas-workspace 技能执行。
```

`画布写回定位` 只在存在 `canvasFilePath` 或 `statusTaskId` 时追加。默认不再额外追加“完成后再阅读 canvas-workspace 并更新画布”的收尾句，因为写回块已经明确让 AI 按技能执行。

## 生成设置块

生成设置由 `src/index/domains/ai-generation/canvasGenerationPromptSettings.ts` 追加，只输出用户实际选择的项。

### 页面

```text
原型生成设置：
- 方案数量：{count} 个
- 多方案提示：用户选择了方案数量，请加载本地 explore-options（多方案探索）技能提示，生成 {count} 个真实不同的可行原型方案。
- 设计系统：{themeName}
- 需求分析：使用 $requirements-exploration 对当前需求做探索和完善，先补齐目标用户、核心任务、范围、关键流程和验收口径。
```

### 设计图

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

### 文档

```text
文档生成设置：
- 文档格式：{HTML | Markdown | Mermaid 图表 | Drawio 图表}
- HTML 视觉主题：{label}。{description}。使用技能 {skillName}（{githubUrl}，若已安装可忽略；若未安装，请在线读取该 GitHub 技能说明）。{themeInstruction}。
- 文档模板：resources/templates/{templateName}
- 需求分析：使用 $requirements-exploration 对当前需求做探索和完善，先补齐目标用户、核心任务、范围、关键流程和验收口径。
```

## 本地 AI 复制模式

复制给本地 AI 时，会移除“更新到当前画布”的场景开始指令，并追加：

```text
请回复了解并等待用户发送需求。
```

这让本地 AI 先确认上下文，不会误以为已经可以直接写画布。

## 批注卡片执行

位置：`src/index/components/content/ExcalidrawCanvas.tsx`。

批注卡片执行走页面场景，也会创建画布占位任务节点。最终 prompt 与通用入口一致，只是用户输入来自批注卡片：

```text
{批注卡片 prompt}

请生成原型页面，并更新到当前画布。

画布写回定位：
- 画布文件：{canvasFilePath}
- 占位节点：{statusTaskId}
- 首个产物必须覆盖或替换占位节点；多个产物从该位置向右排列。
- 写回方式按 canvas-workspace 技能执行。
```

批注元素 ID、资源类型、文件路径等会进入结构化上下文或任务状态，不再在画布写回说明里重复展开。

## AI 图片节点

位置：

- `src/index/domains/ai-image/AiImageGenerationComposer.tsx`
- `src/index/domains/ai-image/aiImageStore.ts`
- `src/server/aiImageGeneration.ts`

画布里的专用 AI 图片节点不再有预设提示词。前端提交用户输入和结构化图片参数，后端再由 `buildImageGenerationPrompt` 包装英文图片工具 prompt。

结构化参数包括：

```text
size
quality
output_format
output_compression
moderation
background
n
disable_prompt_optimization
```

后端会要求使用 `generate_image` 工具，并按条件附加模型、尺寸、参考图和保存路径说明。

## 提示词优化

位置：`src/index/domains/ai-generation/canvasPromptOptimization.ts`。

「优化提示词」是一次 `scene: direct` 文本任务，只返回优化后的用户需求，不直接生成画布内容。真正提交生成时，仍会重新追加：

```text
{场景开始指令}
{生成设置，可选}
{画布写回定位，可选}
```

## 主要源码位置

- `src/index/domains/ai-generation/canvasAiSceneRegistry.ts`：场景定义、开始指令、占位文案。
- `src/index/domains/ai-generation/canvasGenerationPromptSettings.ts`：设置块、画布写回定位、本地 AI 收尾句。
- `src/index/domains/ai-generation/CanvasAiGenerationTool.tsx`：画布通用生成入口，创建占位节点并提交 prompt。
- `src/index/components/content/ExcalidrawCanvas.tsx`：批注卡片执行、画布 artifact 回填。
- `src/index/domains/ai-image/AiImageGenerationComposer.tsx`：AI 图片节点输入框和图片参数。
- `src/server/aiImageGeneration.ts`：后端图片工具 prompt 模板。
- `src/index/domains/ai-generation/canvasPromptOptimization.ts`：提示词优化模板。
