---
name: canvas-workspace
description: 仅当任务明确涉及 Axhub 画布、原型草稿、Excalidraw 画布文件、画布节点/批注/截图/图片，或需要把文档、原型页面、图片、流程图等产物落到画布上时使用。
---

# Canvas Workspace — 画布工作区

仅当任务明确涉及 Axhub 画布、原型草稿，或需要把产物落到画布/Excalidraw 上时使用本技能。每个原型拥有自己的 Excalidraw 画布文件：

```text
src/prototypes/<prototype-name>/canvas.excalidraw
src/prototypes/<prototype-name>/canvas-assets/
```

本技能按四类产物分流：文档、原型页面、图片、流程图。先判断产物类型；产物类型不清时先问一个问题。如果用户已在画布/草稿中工作，不再询问放在哪里，默认更新当前 `canvas.excalidraw`。

## 工具优先级

- 实时画布已连接 MCP 时，优先调用 `axhub-canvas` 的工具更新当前画布。
- 生成 Mermaid 流程、关系、序列、状态、类、ER 或简单盒线架构图时，优先调用 `canvas_insert_mermaid`，传入 `mermaidCode` 和可选 `position`，由浏览器画布转换成可编辑 Excalidraw 元素并保存。
- MCP 不可用、没有实时画布、或用户明确要求离线编辑文件时，直接更新对应 `.excalidraw` 文件；需要插入 Mermaid 时，先得到已转换的 Excalidraw elements/files，再写入 `elements` 和 `files`。
- 只有需要读取状态、插入普通元素、刷新、截图、更新、删除或聚焦画布时，才改用 `canvas_get_state`、`canvas_insert_elements`、`canvas_refresh`、`canvas_capture`、`canvas_update_elements`、`canvas_delete_elements`、`canvas_focus`。

## 读取顺序

1. 用户指定画布名或画布链接时，先从名称或链接定位对应的 `canvas.excalidraw`。
2. 查看 `elements`、`files` 和元素的 `customData`。
3. 只有元素引用了持久化截图或图片文件时，才读取 `canvas-assets/`。
4. 不使用 `axhub-make canvas` CLI；画布内容读取和修改仍以 `.excalidraw` 文件为准。

## 参考文档分流

- 读写画布文件本身仍不清楚时，才读 `references/canvas-read-write.md`。
- 遇到 Axhub 专属节点或不确定 `customData` 字段含义时，才读 `references/axhub-nodes.md`。
- 需要普通 Excalidraw 元素绘制时，才读 `references/excalidraw-basics.md`。
- 确定要创建或编辑 Drawio 节点时，才读 `references/drawio/SKILL.md`。

## 产物分流

- 文档：用户要求生成文档、说明、PRD、清单、列表、报告或其他文本内容时，默认先生成 Markdown 文档到 `src/resources/`，再把该文档作为文档节点创建或更新到当前 `canvas.excalidraw`；不要把正文直接拆成大量画布文本框。
- 原型页面：创建或更新 `src/prototypes/<prototype-name>/` 中的页面，再把原型页面作为预览节点放到画布；节点尺寸与网页内部视口分开处理，用 `customData.embedContentScale` 缩放显示。
- 图片：先确认它是画布参考、画布节点，还是项目实现素材；需要持久化时放入当前原型的 `canvas-assets/`，再插入图片节点。
- 流程图：先判断图表类型和可编辑载体。流程、关系、序列、状态、类、ER 和简单盒线架构优先用 Mermaid 作为中间结构并转普通 Excalidraw 元素；简单手绘式图也可直接画普通 Excalidraw。复杂泳道、排期/甘特、复杂云架构、网络拓扑或厂商图标等需要 Draw.io 语义或素材库的图，才按 `references/drawio/SKILL.md` 生成或编辑 Drawio 资产，并按 `references/axhub-nodes.md` 的 Drawio 节点结构更新画布；只有类型或载体重叠不确定时才询问用户。

## 默认规则

- 优先使用可用的 `axhub-canvas` MCP 工具更新当前画布；离线或 MCP 不可用时直接编辑 `.excalidraw` JSON。
- 元素 `id` 必须唯一，并尽量沿用现有文件的 ID 风格。
- 修改元素时同步更新 `version`、`versionNonce` 和 `updated`。
- 结构性改动后检查绑定、容器、分组和 Frame 引用。
- 除非用户需求要求修改，否则保留已有 Axhub `customData`。

## 回复要求

完成画布相关工作后，说明：

- 画布文件路径。
- 修改了什么，或读取到了什么。
- 相关节点 ID 或批注。
- 是否使用了本地图片或 `canvas-assets/`。
- 如果当前环境能确定，给出画布确认链接。
