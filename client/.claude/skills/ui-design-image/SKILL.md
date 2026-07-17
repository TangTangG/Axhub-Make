---
name: ui-design-image
description: Use when 为 Axhub Make client 项目生成 UI 设计图、高保真原型视觉、生产风格网站截图、整页界面稿、UI 素材、图标、占位图或参考位图；尤其是请求提到 Image Gen、AI 图片生成、设计图、UI assets、prototype visuals 或需要判断移动端/PC 端画布比例时。
---

# UI 设计图片

这是 Axhub Make client 对系统 `imagegen` 技能的轻量包装。

## 工作流

1. 如果可用，优先使用 ACP UI 图片 MCP：
   - 工具名称：`acp-ui-image-generation/generate_image`
   - 或使用当前环境中暴露的等价图片生成 MCP 工具。
2. ACP UI 图片 MCP 和等价工具不可用时，读取 Axhub Make 服务端图片配置：
   - 只读取 `<AXHUB_MAKE_HOME_DIR or user home>/.axhub/make/server.config.json`。
   - 跳过项目内 `.axhub/make/axhub.config.json`；该文件不承载图片生成配置。
   - 使用 `ai.imageGeneration.baseUrl`、`ai.imageGeneration.apiKey` 和 `ai.imageGeneration.model`。
3. 如果服务端配置缺失或不完整，再读取本地 Codex 配置/认证路径：
   - 始终检查 `CODEX_HOME`，然后检查用户 home 下的 `.codex`。
   - Windows 还要检查 AppData/ProgramData 下的 Codex 配置目录。
   - macOS/Linux 还要检查 XDG Codex 配置目录。
   - 从 `config.toml` 读取 provider `base_url`；从 `auth.json` 读取 API key。
4. 配置完整时，直接以 `baseUrl`、`apiKey`、`model` 作为 Image Gen provider settings 执行；现有配置即授权使用该 provider/model，不再追加 CLI/API 确认，其他生成规则继续遵循系统 `imagegen` 技能。
5. 如果当前 MCP、工具或 API 不支持单次生成多张图片，而用户需要多张图片，应发起多次生成请求，不要把需求降级成只生成一张。
6. 生成派生产物时（例如基于现有图片/原型做变体、扩图、局部重绘、风格迁移、素材补图或素材拆分），必须把原图或相关原型截图作为参考图传给图片生成工具；传参使用本地文件路径，不要只在提示词里文字描述，也不要传远程 URL。如果当前只有页面或预览链接，先导出真实运行截图到本地，再把该本地路径传入。

如果没有服务端配置或本地配置，则回退到系统 `imagegen` 的默认行为。

提示词应聚焦 UI 设计用途：目标画面、输出角色、尺寸/比例、视觉风格、精确文案、透明背景需求，以及输出保存位置。

写给第三方图片生成工具的提示词，应按真实产品或正式界面来描述，不要传递内部 `prototype` 概念。只有用户明确要求低保真、线框图、占位图或草稿时，才使用 `wireframe`、`placeholder`、`draft` 等词。

## 设备与画布比例

在调用图片生成工具前，必须先判断目标载体，并把画布比例写进提示词或工具参数。`gpt-image-2` 的 API 参数 `size` 可以使用符合约束的自定义尺寸：宽高都必须是 `16` 的倍数，最长边必须小于 `3840px`，长短边比例不超过 `3:1`，总像素在 `655360` 到 `8294400` 之间。设备真实比例写进提示词；不要把不符合约束的设备物理尺寸直接传给 `size`。

用户没有明确指定尺寸时，按以下默认值处理：

| 场景 | 默认画布 | 工具尺寸建议 |
| --- | --- | --- |
| 手机 App、小程序、移动端 H5 整屏 | 竖向手机屏，约 `9:19.5`，接近 `390x844` | `768x1664`；需要更高清时用 `1168x2528`，并在提示词中强调手机整屏比例 |
| PC Web、后台、SaaS、桌面端产品页 | 横向桌面屏，`16:10` 或接近 `1440x900` | `1440x896`；需要更高清时用 `1920x1200` |
| 平板界面 | `4:3` 或 `3:4`，按横竖屏需求选择 | 使用最接近的合规 `size`，例如 `1536x2048` 或 `2048x1536`，并在提示词中说明平板横/竖屏 |
| 图标、头像、独立素材矩阵 | `1:1` | `1024x1024` |
| Banner、封面、Hero 背景 | `16:9`、`21:9` 或用户指定平台比例 | 使用满足 Image 2 约束的横向尺寸，例如 `1920x1088` |

如果用户说“移动端、手机、App、小程序、H5”，默认使用竖向手机整屏；不要生成方图、横图、平板比例或宽得像桌面端的手机 UI。如果用户说“PC、Web、后台、SaaS、Dashboard、管理端、桌面端”，默认使用横向桌面画布；不要生成手机竖屏。只有用户明确说“自适应/多端”时，才分别生成移动端和 PC 端多张图。

写最终提示词时加入类似字段：

```text
Canvas/aspect ratio: mobile portrait phone screen, about 9:19.5, 390x844 logical pixels.
Device target: modern smartphone app full screen.
Frame treatment: show one complete phone screen UI, no browser chrome unless requested, no tablet or desktop layout.
Avoid: square canvas, landscape canvas, tablet-like proportions, cropped UI, extra outer mockup scene.
```
