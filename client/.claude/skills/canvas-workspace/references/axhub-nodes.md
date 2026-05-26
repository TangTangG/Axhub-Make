# Axhub 画布节点

Axhub 画布节点本质上是标准 Excalidraw 元素，Axhub 扩展信息存放在 `customData` 中。

## 通用字段

| 字段 | 含义 |
| --- | --- |
| `customData.title` | 面向用户的节点标题 |
| `customData.previewUrl` | 预览模式中渲染的 URL |
| `customData.openUrl` | 节点操作中打开的 URL |
| `customData.previewKind` | 渲染类型，例如 `web`、`doc`、`image`、`none`、`ai-image-generator`、`prototype-generator` |
| `customData.resourceType` | 资源类型：`prototype`、`doc` 或 `theme` |
| `customData.resourceId` | 项目 metadata 中的资源 id 或名称 |
| `customData.embedViewMode` | `link` 表示紧凑链接卡片，`preview` 表示渲染嵌入预览 |
| `customData.embedContentScale` | 预览内容缩放比例，例如 `0.5` 表示画布节点按 50% 显示，但 iframe 使用 2 倍视口渲染 |
| `customData.screenshotUrl` | 运行时已捕获的持久化预览截图 URL |
| `customData.annotation` | 元素批注文本 |
| `customData.annotationUpdatedAt` | 批注更新时间，ISO 8601 格式 |

## 嵌入资源节点

嵌入资源使用 `type: "embeddable"`。

### 原型节点

通过 `customData.resourceType: "prototype"` 识别；也可以结合指向原型的 `link` 或 `previewUrl` 判断。

常见字段：

```json
{
  "type": "embeddable",
  "link": "/?resourceType=prototype&resourceId=<prototype-id>&view=demo&sidebar=collapsed",
  "customData": {
    "title": "原型标题",
    "previewUrl": "http://localhost:<port>/prototypes/<prototype-id>",
    "openUrl": "/?resourceType=prototype&resourceId=<prototype-id>&view=demo&sidebar=collapsed",
    "previewKind": "web",
    "resourceType": "prototype",
    "resourceId": "<prototype-id>",
    "embedViewMode": "link"
  }
}
```

由 AI 原型生成能力产出的原型节点还可能包含：

```json
{
  "generatedBy": "axhub-prototype-generator",
  "sourceTaskId": "<task-id>",
  "prompt": "<prompt>"
}
```

### 文档节点

通过 `customData.type: "axhub-doc"` 或 `customData.resourceType: "doc"` 识别。

常见字段：

```json
{
  "type": "embeddable",
  "link": "/api/markdown-file?path=<encoded-path>",
  "customData": {
    "type": "axhub-doc",
    "title": "文档标题",
    "previewUrl": "/api/markdown-file?path=<encoded-path>",
    "previewKind": "doc",
    "resourceType": "doc",
    "resourceId": "<doc-id>",
    "embedViewMode": "link"
  }
}
```

### 主题节点

通过 `customData.resourceType: "theme"` 或 `customData.type: "axhub-theme"` 识别。

主题节点与原型/文档节点使用相同的 `embeddable` 结构，`resourceType` 为 `theme`，`previewKind` 通常为 `web` 或 `none`。

## AI 生成节点

AI 生成节点是图片元素。占位图或生成图片数据保存在 `files[fileId]`。

### AI 图片生成节点

```json
{
  "type": "image",
  "fileId": "axhub-ai-image-placeholder-v2",
  "customData": {
    "type": "axhub-ai-image-generator",
    "title": "AI 生成图片",
    "previewKind": "ai-image-generator"
  }
}
```

### AI 图片结果节点

```json
{
  "type": "image",
  "fileId": "<image-id>",
  "customData": {
    "type": "axhub-ai-image",
    "generatedBy": "axhub-ai-image",
    "sourceTaskId": "<task-id>",
    "prompt": "<prompt>",
    "previewKind": "image"
  }
}
```

多张生成图片可能共享同一个 `groupIds` 值。

### AI 原型生成节点

```json
{
  "type": "image",
  "fileId": "axhub-prototype-generator-placeholder-v1",
  "customData": {
    "type": "axhub-prototype-generator",
    "title": "AI 生成原型",
    "previewKind": "prototype-generator"
  }
}
```

生成完成后，占位节点会被替换为原型嵌入节点，并带有 `generatedBy: "axhub-prototype-generator"`。

AI 生成原型替换节点的推荐尺寸：

- 不要把网页内部布局做小；页面代码仍按正常浏览器视口设计。
- `previewUrl`、`openUrl`、`link` 使用客户端原型运行时地址，例如 `/prototypes/<prototypeId>` 或带 hash/page 的同源 runtime URL；不要使用 Make 管理端首页 deep link，例如 `/?p=...` 或 `/?resourceType=prototype...`。
- 为了避免画布被完整桌面尺寸占满，推荐生成节点可视尺寸为 `720 x 450`。
- 同时设置 `customData.embedSizePreset: "desktop"`、`customData.embedContentScale: 0.5`、`customData.storedPreviewSize: { "width": 720, "height": 450 }`。这样画布显示为 720x450，iframe 与截图按 1440x900 视口渲染。
- 新生成的 prototype embeddable 可设置 `customData.captureScreenshotOnMount: true`，让宿主首次渲染后自动捕获预览截图。截图成功后宿主会清除此字段并写入 `screenshotUrl`，不要手写 `screenshotUrl`。

## 图片文件

图片元素通过 `files[element.fileId]` 读取图片数据。

原型嵌入节点如果存在 `customData.screenshotUrl`，优先使用该截图地址。截图文件常见位置：

```text
src/prototypes/<prototype-name>/canvas-assets/embed-<elementId>.png
```

截图缓存不等同于页面实现素材；只有用户明确要求把它作为素材使用时，才把它当作实现资产处理。
