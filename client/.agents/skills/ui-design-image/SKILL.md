---
name: ui-design-image
description: Use when 为 Axhub Make client 项目生成 UI 设计图、高保真原型视觉、生产风格网站截图、整页界面稿、UI 素材、图标、占位图或参考位图；尤其是请求提到 Image Gen、AI 图片生成、设计图、UI assets 或 prototype visuals 时。
---

# UI 设计图片

这是 Axhub Make client 对系统 `imagegen` 技能的轻量包装。

## 工作流

1. 如果可用，优先使用 ACP UI 图片 MCP：
   - 工具名称：`acp-ui-image-generation/generate_image`
   - 或使用当前环境中暴露的等价图片生成 MCP 工具。
2. 仅当需要回退到系统 `imagegen` 技能或直接图片 API 时，才读取 Axhub Make 图片配置：
   - 优先读取 `<AXHUB_MAKE_HOME_DIR or user home>/.axhub/make/server.config.json`。
   - 再回退到项目内 `.axhub/make/axhub.config.json`。
   - 使用 `ai.imageGeneration.baseUrl`、`ai.imageGeneration.apiKey` 和 `ai.imageGeneration.model`。
3. 如果 Make 配置缺失或不完整，再读取本地 Codex 配置/认证路径：
   - 始终检查 `CODEX_HOME`，然后检查用户 home 下的 `.codex`。
   - Windows 还要检查 AppData/ProgramData 下的 Codex 配置目录。
   - macOS/Linux 还要检查 XDG Codex 配置目录。
   - 从 `config.toml` 读取 provider `base_url`；从 `auth.json` 读取 API key。
4. 将所有非空值作为 Image Gen provider settings（`baseUrl`、`apiKey`、`model`）传入，然后继续遵循系统 `imagegen` 技能。
5. 如果当前 MCP、工具或 API 不支持单次生成多张图片，而用户需要多张图片，应发起多次生成请求，不要把需求降级成只生成一张。
6. 生成派生产物时（例如基于现有图片/原型做变体、扩图、局部重绘、风格迁移、素材补图或素材拆分），必须把原图或相关原型截图作为参考图传给图片生成工具；传参使用本地文件路径，不要只在提示词里文字描述，也不要传远程 URL。如果当前只有页面或预览链接，先导出真实运行截图到本地，再把该本地路径传入。

如果没有项目配置或本地配置，则回退到系统 `imagegen` 的默认行为。

提示词应聚焦 UI 设计用途：目标画面、输出角色、尺寸/比例、视觉风格、精确文案、透明背景需求，以及输出保存位置。

写给第三方图片生成工具的提示词，应按真实产品或正式界面来描述，不要传递内部 `prototype` 概念。只有用户明确要求低保真、线框图、占位图或草稿时，才使用 `wireframe`、`placeholder`、`draft` 等词。
