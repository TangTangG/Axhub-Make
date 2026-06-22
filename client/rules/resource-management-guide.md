# 资源指南

`src/resources/` 用于存放项目资料、需求说明、文档、图表和原型讨论中需要长期保留的上下文，方便后续生成、修改和复盘原型时读取。新建项目文档时，默认保存到这里。

常见内容包括：

- 文档：Markdown、HTML 文档，如需求说明、页面说明、调研记录、会议纪要
- 图表：Draw.io 可编辑图表，如 `.drawio`、`.drawio.svg`
- 数据样例：JSON、CSV、TSV、YAML、TXT、表格导出文件
- 设计或业务附件：图片、PDF、Office 文档、压缩包等

## 目录边界

- `src/resources/` 存放长期项目资料、文档、图表、数据样例和业务附件。
- `src/resources/templates/` 存放可复用文档模板；模板也是文档资源的一种。
- 原型页面专属素材放在对应原型目录内，例如 `src/prototypes/<name>/assets/`。
- 画布截图、原型占位位图、画布生成图等放在对应原型的 `canvas-assets/`，不要搬到资源目录。
- 主题素材放在对应主题目录内，例如 `src/themes/<theme-key>/assets/`。

图片、截图、参考图等素材只在需要长期保留为项目资料时放入 `src/resources/`。

## 资源链接

资源通常保留两种链接：

- 只读链接：用于预览、嵌入、下载或外部读取。
- 编辑链接：Make 管理端地址，用于打开资源详情页，带顶部工具栏和系统编辑能力。

编辑链接统一使用 Make 管理端 deep link：

```text
/?projectId=<projectId>&doc=<resource-path>
```

其中 `resource-path` 是相对 `src/resources/` 的路径，例如 `templates/prd-template.md` 或 `flows/order-status.drawio`。

除 Markdown 外，所有资源的只读链接统一使用文档资源文件地址：

```text
/api/docs/<encoded-resource-path>?projectId=<projectId>
```

Markdown 文档 `.md` 的只读预览使用文档预览页：

```text
/spec-template.html?url=<encoded-doc-api-url>
```

其中 `doc-api-url` 通常是 `/api/docs/<encoded-resource-path>?projectId=<projectId>`。
