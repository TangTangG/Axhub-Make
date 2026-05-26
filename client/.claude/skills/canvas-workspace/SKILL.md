---
name: canvas-workspace
description: 当任务涉及 Axhub 画布、Excalidraw 文件、画布节点、批注、截图、画布图片、原型/文档/主题嵌入节点或 AI 生成节点时使用。
---

# Canvas Workspace — 画布工作区

当任务涉及 Axhub 画布时使用本技能。每个原型拥有自己的 Excalidraw 画布文件：

```text
src/prototypes/<prototype-name>/canvas.excalidraw
src/prototypes/<prototype-name>/canvas-assets/
```

本技能用于按 Axhub Make 约定读取和写入画布，重点关注 `customData`、嵌入资源节点、批注、图片文件和 AI 生成节点。

## 读取顺序

1. 用户指定画布名或画布链接时，先从名称或链接定位对应的 `canvas.excalidraw`。
2. 查看 `elements`、`files` 和元素的 `customData`。
3. 只有元素引用了持久化截图或图片文件时，才读取 `canvas-assets/`。
4. CLI 用于获取当前浏览器会话信息或截图。

## 参考文档

- 文件路径、读写规则、CLI 命令和关系检查：`references/canvas-read-write.md`
- Axhub 专属节点和 `customData` 字段：`references/axhub-nodes.md`
- Excalidraw 图形结构与布局基础：`references/excalidraw-basics.md`
- JSON 元素结构模板：`references/element-templates.md`

## 默认规则

- 优先直接编辑 `.excalidraw` JSON。
- 元素 `id` 必须唯一，并尽量沿用现有文件的 ID 风格。
- 修改元素时同步更新 `version`、`versionNonce` 和 `updated`。
- 结构性改动后检查绑定、容器、分组和 Frame 引用。
- 除非用户需求要求修改，否则保留已有 Axhub `customData`。
- 创建或替换 prototype 预览节点时，画布上的节点尺寸与网页内部视口要分开处理：节点可以用较小可视尺寸避免占满画布，但网页仍按真实浏览器尺寸设计，通过 `customData.embedContentScale` 缩放显示。

## 回复要求

完成画布相关工作后，说明：

- 画布文件路径。
- 修改了什么，或读取到了什么。
- 相关节点 ID 或批注。
- 是否使用了本地图片或 `canvas-assets/`。
- 如果当前环境能确定，给出画布确认链接。
