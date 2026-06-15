---
name: canvas-workspace
description: 仅当任务明确涉及 Axhub 画布、原型草稿、Excalidraw 画布文件、画布节点/批注/截图/图片，或需要在画布/原型草稿中创建、整理、读取 Drawio 图表时使用。
---

# Canvas Workspace — 画布工作区

仅当任务明确涉及 Axhub 画布、原型草稿或画布中的 Drawio 图表时使用本技能。每个原型拥有自己的 Excalidraw 画布文件：

```text
src/prototypes/<prototype-name>/canvas.excalidraw
src/prototypes/<prototype-name>/canvas-assets/
```

本技能用于按 Axhub Make 约定读取和写入画布，重点关注 `customData`、嵌入资源节点、批注、图片文件和 Drawio 节点。

## 读取顺序

1. 用户指定画布名或画布链接时，先从名称或链接定位对应的 `canvas.excalidraw`。
2. 查看 `elements`、`files` 和元素的 `customData`。
3. 只有元素引用了持久化截图或图片文件时，才读取 `canvas-assets/`。
4. 不使用 `axhub-make canvas` CLI；画布内容读取和修改仍以 `.excalidraw` 文件为准。

## 参考文档分流

- 读写画布文件本身仍不清楚时，才读 `references/canvas-read-write.md`。
- 遇到 Axhub 专属节点或不确定 `customData` 字段含义时，才读 `references/axhub-nodes.md`。

## 默认规则

- 优先直接编辑 `.excalidraw` JSON。
- 用户正在处理画布时，相关图片、原型页面、Markdown/Draw.io 文档、图表等产物原则上应落入或更新到当前画布，便于用户确认。
- 元素 `id` 必须唯一，并尽量沿用现有文件的 ID 风格。
- 修改元素时同步更新 `version`、`versionNonce` 和 `updated`。
- 结构性改动后检查绑定、容器、分组和 Frame 引用。
- 除非用户需求要求修改，否则保留已有 Axhub `customData`。
- 用户要求在草稿或画布上生成流程图、关系图或 Drawio 图时，先使用 `$drawio` 生成可编辑 Draw.io 图，再把结果创建或更新为当前原型 `canvas.excalidraw` 里的 Drawio 图片节点；不要只生成独立文档。
- 只有明确不使用 Draw.io，或需要普通 Excalidraw 图形、连线、分组、Frame、布局时，才读 `references/excalidraw-basics.md`。
- 创建或替换 prototype 预览节点时，画布上的节点尺寸与网页内部视口要分开处理：节点可以用较小可视尺寸避免占满画布，但网页仍按真实浏览器尺寸设计，通过 `customData.embedContentScale` 缩放显示。

## 回复要求

完成画布相关工作后，说明：

- 画布文件路径。
- 修改了什么，或读取到了什么。
- 相关节点 ID 或批注。
- 是否使用了本地图片或 `canvas-assets/`。
- 如果当前环境能确定，给出画布确认链接。
