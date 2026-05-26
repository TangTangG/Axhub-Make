# 画布读写能力参考

面向使用 Skill 的 Agent：优先读写本地 `.excalidraw` 文件。用户指定画布名或画布链接时，直接定位本地画布文件；CLI 用于获取当前浏览器会话信息或截图。

## 快速判断

| 目标 | 优先方式 |
|------|----------|
| 读取画布元素、批注、节点信息 | 直接读 `.excalidraw` |
| 修改画布内容 | 直接改 `.excalidraw` |
| 从用户给的画布链接定位元素 | 从链接提取画布名和元素 ID，再读文件 |
| 获取当前浏览器里画布的截图 | `axhub-make canvas screenshot` |
| 查看当前浏览器连接了哪些画布 | `axhub-make canvas info` |

## 文件位置

常见路径：

```text
src/prototypes/<prototype-name>/canvas.excalidraw
src/prototypes/<prototype-name>/canvas-assets/embed-<elementId>.png
```

`.excalidraw` 是 JSON。主要关注：

- `elements`：所有画布元素。
- `files`：嵌入图片数据或图片元信息。
- `appState.gridSize`：整理/对齐时参考。

## 读取画布

读取过程以本地 JSON 为准。

最常用字段：

| 字段 | 用途 |
|------|------|
| `id` | 元素唯一标识，链接定位和截图文件名会用到 |
| `type` | 元素类型，如 `text`、`image`、`embeddable`、`arrow` |
| `x` / `y` / `width` / `height` | 位置和尺寸 |
| `isDeleted` | 为 true 时跳过 |
| `link` | 嵌入节点链接 |
| `customData` | 批注、标题、截图地址等 Axhub 扩展信息 |
| `fileId` | 图片元素对应的 `files[fileId]` |

识别常见节点：

| 类型 | 判断方式 |
|------|----------|
| 原型节点 | `type == "embeddable"` 且 `customData.resourceType == "prototype"`，或 `link`/`previewUrl` 指向原型 |
| 文档节点 | `type == "embeddable"` 且 `customData.type == "axhub-doc"` 或 `customData.resourceType == "doc"` |
| 主题节点 | `type == "embeddable"` 且 `customData.resourceType == "theme"` 或 `customData.type == "axhub-theme"` |
| AI 图片生成节点 | `type == "image"` 且 `customData.type == "axhub-ai-image-generator"` |
| AI 图片结果节点 | `type == "image"` 且 `customData.type == "axhub-ai-image"` |
| AI 原型生成节点 | `type == "image"` 且 `customData.type == "axhub-prototype-generator"` |
| 图片元素 | `type == "image"` |
| 批注元素 | `customData.annotation` 有值 |

Axhub 节点字段见 `axhub-nodes.md`。

## CLI 读取

CLI 面向当前浏览器会话。读取元素、节点和批注时仍以 `.excalidraw` 文件为准。

查看当前浏览器连接的画布：

```bash
axhub-make canvas info
```

获取当前画布截图：

```bash
axhub-make canvas screenshot -o ./canvas.png
axhub-make canvas screenshot -c prototypes/my-proto/canvas -o ./canvas.png
```

## 从链接定位

用户可能给一个带节点 ID 的画布链接。处理步骤：

1. 从 URL 中提取画布名和元素 ID。
2. 找到对应 `.excalidraw` 文件。
3. 在 `elements` 中找同 ID 元素。
4. 如果是原型节点，预览截图通常在 `canvas-assets/embed-<elementId>.png`。
5. 如果是图片元素，按 `fileId` 找 `files[fileId]`。
6. 如果是嵌入节点，结合 `customData.resourceType`、`customData.previewUrl` 和 `customData.screenshotUrl` 判断资源来源。

## 写入画布

直接修改 `.excalidraw` 的 `elements` 数组。

### 添加元素

追加到 `elements`。必须有唯一 `id`，推荐沿用现有格式：`<timestamp>-<random>`。

### 修改元素

更新目标字段后，同时更新：

- `version` 加 1
- `versionNonce` 换成新的随机整数
- `updated` 设为当前毫秒时间戳

### 删除元素

默认直接从 `elements` 中移除。不要为了删除而设置 `isDeleted: true`，这会让画布文件持续膨胀。

如果遇到历史遗留的 `isDeleted: true` 元素，读取时跳过；整理画布时可以一并移除。

### 关系检查

修改连接、容器、分组时检查引用是否仍然存在：

- `boundElements`
- `containerId`
- `startBinding` / `endBinding`
- `groupIds`

## 热更新

保存 `.excalidraw` 后，打开中的画布会通过热更新同步。完成画布写入时，交付说明里标明画布文件路径和改动内容。
