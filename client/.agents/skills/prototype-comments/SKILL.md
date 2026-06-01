---
name: prototype-comments
description: 批注、微调、编辑原型时使用：读取原型批注并定位页面元素，修改文案、样式、布局或交互，同步批注处理状态。
---

# 原型批注处理

当页面上存在原型批注，或 `/editor-todo` 要求处理当前项目的批注时使用本技能。

术语边界：

- 批注 / comment：Genie Editor 里的原型改稿意见，本技能只处理这类内容。
- 标注 / annotation：AnnotationViewer 的原型说明层，例如 `annotation-source.json` 和 `@axhub/annotation`，不属于本技能处理范围。

## 默认读取顺序

1. 先定位目标原型目录：`src/prototypes/<prototype-id>/`。
2. 优先读取本地文件：`src/prototypes/<prototype-id>/.spec/prototype-comments.json`。
3. 若文件不存在，再结合当前页面、用户上下文或旧缓存提示判断；需要截图、导出图片或同步页面状态时才使用页面同步能力。

## 本地文件结构

批注记录固定在 `.spec/prototype-comments.json`：

- `comments`：批注和修改记录，包含 locator、comment、marker，以及 text/style/tweak 的修改前后。
- `tasks`：按 `elementKey` 记录 `idle`、`editing`、`completed`、`error` 状态。
- `images`：只记录 metadata 和 `assetPath`。图片文件在 `.spec/prototype-comment-assets/`。

不要把新的 base64 图片内容写回 JSON；需要新增图片素材时放入 assets 目录，并在 `images[].assetPath` 里引用。

## 处理流程

1. 读取 `.spec/prototype-comments.json`，按 `comments` 理解修改意图和定位信息。
2. 只在定位不清、需要检查页面现状、需要导出批注图片时，使用页面截图或同步命令。
3. 修改 `src/prototypes/<prototype-id>/` 下的实现文件，保持改动范围聚焦。
4. 修改前后都更新本地 JSON：
   - 开始处理某项时，把 `tasks[elementKey].state` 设为 `editing`，记录 `provider`、`requestId`、`sessionId`、`updatedAt`。
   - 成功后设为 `completed`。
   - 失败或阻塞时设为 `error`，写清 `message`。
   - 放弃处理时设为 `idle`。
5. 页面状态同步只作为 best-effort。同步失败不阻塞代码修改和本地 JSON 记录。
6. 按项目规则完成预览验证；无法验证时说明原因。

## 页面同步辅助

需要时可以使用本地页面同步能力：

```bash
npx @axhub/genie status --json
npx @axhub/genie editor clients list --channel make
npx @axhub/genie editor node screenshot --channel <channel> --target-client-id <id> --element-key <key> --output-dir .local/genie-editor
npx @axhub/genie editor context-images export --channel <channel> --target-client-id <id> --output-dir .local/genie-editor
npx @axhub/genie editor editing set --channel <channel> --target-client-id <id> --element-key <key> --state completed --provider codex --task-request-id <request-id>
```

`snapshot` 和 `nodes list` 只作为诊断页面同步异常的工具，不是默认读取步骤。

## 完成回复

面向用户用自然语言说明：

- 哪些批注对应的界面修改已完成。
- 是否还有未处理或异常批注。
- 做了哪些验证。

不要把回复写成 CLI 日志；技术细节只在确实影响用户理解时简短说明。
