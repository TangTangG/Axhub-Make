---
name: screenshot-to-prototype
description: Use only when 用户明确要求把本地截图、设计稿或高保真界面图还原成 Axhub Make client 可运行原型；或显式调用 $screenshot-to-prototype。仅提供图片作为素材、参考图、需求图或风格上下文时不要使用。
---

# Screenshot To Prototype

用本地截图/设计稿还原 client 可运行原型：先提取必要素材，再写 React/CSS，最后做真实运行截图回归。正文保持中文、简洁。

## 退出规则

任一条件不满足就停止：

- 用户未提供源图。
- 必须能获取源图的本地路径；如果源图没有本地路径，必须停止。
- 图片生成能力可以来自 `ui-design-image`、系统 `imagegen`、ACP UI 图片 MCP、等价图片 MCP，或 Agent 图片配置。
- 不能只因当前工具面板没有直接暴露图片生成工具就停止；停止前必须主动检查这些通道。
- 确认所有图片生成通道都不可用或都不支持传入本地图片路径时，才停止。
- 启动实现前必须确认存在视觉回归工具。
- 视觉回归工具必须能获取产物真实运行截图；如果无法获取真实运行截图，必须停止。
- 用户只是提供图片作为需求、内容、素材、风格上下文或普通参考图时，必须停止。
- 普通建站、URL 克隆、主题提取、单纯图片生成不要使用本技能。

## 路径

所有路径都以 client 包根目录为基准，文档里不要写本机绝对路径、平台路径或外层仓库路径。

- 原型：`src/prototypes/<slug>/`
- 素材：`src/prototypes/<slug>/assets/`
- 素材清单：`src/prototypes/<slug>/assets/asset-manifest.json`
- 临时文件：`.local/screenshot-to-prototype/<slug>/`

## 流程

1. 先应用退出规则，确认用户明确要求把截图/设计稿还原成可运行原型，并确认源图本地路径、图片生成通道、视觉回归工具。
2. 若图片生成通道不明确，先按 `ui-design-image` 的工作流检查 ACP UI 图片 MCP、等价 MCP、Agent 图片配置和系统 `imagegen`，再决定是否停止。
3. 所有素材提取、修复、高清化、设计分析都必须把用户本地图片路径作为参考图传入，不能只用文字描述生成素材。
4. 让图片 AI 输出透明 PNG 素材矩阵；由图片 AI 判断具体提取对象，只说明筛选规则：保留可复用且 HTML/CSS 难快速稳定还原的视觉素材，包括背景图、背景纹理或复杂背景层；排除纯文本、简单布局容器、普通 CSS 形状和整页截图。
5. 临时素材矩阵放 `.local/screenshot-to-prototype/<slug>/`，再切到 `src/prototypes/<slug>/assets/`：

```bash
node .agents/skills/screenshot-to-prototype/scripts/slice-asset-sheet.mjs \
  --input .local/screenshot-to-prototype/<slug>/asset-sheet.png \
  --output-dir src/prototypes/<slug>/assets \
  --grid 4x3 \
  --names icon-search,logo-brand,avatar-user,banner-hero \
  --manifest src/prototypes/<slug>/assets/asset-manifest.json
```

6. 审计素材：

```bash
node .agents/skills/screenshot-to-prototype/scripts/audit-assets.mjs \
  --manifest src/prototypes/<slug>/assets/asset-manifest.json
```

7. 对模糊、污染、不透明、尺寸不足或误切素材，允许用原始本地源图作为参考图单独生成或修复；必要时附带问题素材。
8. 页面用真实文本、React 结构、Grid/Flex、CSS variables、稳定 `aspect-ratio` 和响应式约束还原；不要把整张截图当背景。
9. 交互状态、颜色继承、hover/focus 或复用性强的图标，可参考切图后重绘为 SVG 或使用合适图标组件。
10. 运行 `node scripts/check-app-ready.mjs /prototypes/<slug>`，再用视觉回归工具检查真实运行截图。
11. 最终回复提供轻量偏差报告，不新建长文档：
    - 展示或链接原图与真实运行截图。
    - 按 P0-P3 列出偏差，重点写未还原到位的问题，不写泛泛总结。
    - P0：阻塞验收或页面不可用；P1：关键布局/比例/内容明显不符；P2：素材风格、间距、图标、阴影等显著偏差；P3：细节优化。
    - 明确等待用户反馈选择是否继续修，不擅自进入下一轮大改。

## 命名

素材名用 kebab-case：`icon-*`、`logo-*`、`avatar-*`、`image-*`、`banner-*`、`cover-*`、`background-*`、`decoration-*`、`border-*`。含义不清时用 `asset-01`。

## 提示词

写图片生成提示词时再读 `references/prompts.md`。
