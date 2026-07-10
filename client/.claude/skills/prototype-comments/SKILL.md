---
name: prototype-comments
description: 批注、微调、编辑原型时使用：读取本地原型批注并定位页面元素，修改文案、样式、布局或交互，完成后删除已处理批注任务。
---

# 原型批注处理

当页面上存在原型批注，或 `/editor-todo` 要求处理当前项目的批注时使用本技能。

术语边界：

- 批注 / comment：Commentary 里的原型改稿意见，本技能只处理这类内容。
- 标注 / annotation：AnnotationViewer 的原型说明层，例如 `annotation-source.json` 和 `@axhub/annotation`，不属于本技能处理范围。

## 默认读取顺序

1. 先定位目标原型目录：`src/prototypes/<prototype-id>/`。
2. 读取本地文件：`src/prototypes/<prototype-id>/.spec/prototype-comments.json`。
3. 若文件不存在，结合用户上下文和当前代码判断目标；不调用 CLI/API，也不依赖浏览器运行中的页面。

## 本地文件结构

批注记录固定在 `.spec/prototype-comments.json`，核心字段是 `comments/tasks/images`：

- `comments`：批注和修改记录，包含 locator、comment、marker，以及 text/style/tweak 的修改前后。
- `tasks`：按 `elementKey` 保存待处理任务信息。
- `images`：只记录 metadata 和 `images[].assetPath`。图片文件位于 `.spec/prototype-comment-assets/`。

读取图片时只使用本地 `images[].assetPath`，基于 `.spec/prototype-comment-assets/` 查找文件。不要把新的 base64 图片内容写回 JSON；需要新增图片素材时放入 assets 目录，并在 `images[].assetPath` 里引用。

## 处理流程

1. 读取 `.spec/prototype-comments.json`，按 `comments` 理解修改意图和定位信息。
2. 如有批注图片，按 `images[].assetPath` 读取本地文件辅助理解。
3. 修改 `src/prototypes/<prototype-id>/` 下的实现文件，保持改动范围聚焦。
4. 完成一个批注任务后，只清理本地批注文档：删除对应批注记录和任务记录，不写任务进度字段。
5. 按项目规则完成预览验证；无法验证时说明原因。

## 删除规则

- 用 `comments[].elementKey` 作为主键删除已完成批注。
- 删除同 key 的 `tasks[elementKey]`。
- 删除 `elementKey` 匹配且不再被其他剩余批注引用的 `images[]` 记录。
- 对 `.spec/prototype-comment-assets/`，只删除与被移除 `images[].assetPath` 对应、且不再被 JSON 引用的文件。
- 如果某条批注没有 `elementKey`，用 `locator`/`label` 辅助人工匹配；匹配不确定时保留，不误删。

清理规则示例：完成 `elementKey=hero` 后，移除 `comments` 中的 `hero` 批注、移除 `tasks.hero`、移除只属于 `hero` 的 `images` 记录及 `hero-only.png`；如果 `shared.png` 仍被其他剩余批注引用，则保留该图片记录和本地文件。

## 完成回复

面向用户用自然语言说明：

- 哪些批注对应的界面修改已完成。
- 是否还有未处理或异常批注。
- 做了哪些验证。

不要把回复写成 CLI 日志；技术细节只在确实影响用户理解时简短说明。
