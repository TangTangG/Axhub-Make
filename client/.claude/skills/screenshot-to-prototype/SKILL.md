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
- 主规格：`src/prototypes/<slug>/.spec/spec.html`
- 最终素材：`src/prototypes/<slug>/assets/`
- 最终素材清单：`src/prototypes/<slug>/assets/asset-manifest.json`
- 临时文件：`.local/screenshot-to-prototype/<slug>/`
- 候选矩阵：`.local/screenshot-to-prototype/<slug>/asset-sheet.png`
- 候选切图：`.local/screenshot-to-prototype/<slug>/candidates/`
- 候选清单：`.local/screenshot-to-prototype/<slug>/candidate-manifest.json`

## 规格与评审（本技能特例）

- 主规格强制使用 `.spec/spec.html`，从 HTML 模板创建，不提供 Markdown 选项。
- 在 HTML 中先展示源截图，素材评审以逐项左右对照为主：左侧展示候选矩阵中的对应素材或候选切图，右侧展示最终裁切素材、重绘 SVG 或组件化结果；同项对齐并标注用途，后续实现采用右侧结果，不能只列文件路径。
- 需求与设计完成第一轮对齐时必须确定 `DESIGN.md`。client 内没有符合需求的现成规范时主动创建；无论复用或新建，都把原文件路径和关键设计规范作为可评审内容直接呈现在 HTML 中。
- 用户确认 HTML 主规格前不得开始实现；实现后同步规格中的素材、设计决策和实际结果。
- 本节覆盖通用对齐规则中关于规格格式可选、不主动创建 `DESIGN.md` 以及主规格只引用设计基底的默认约定。

## 流程

1. 先应用退出规则，确认用户明确要求把截图/设计稿还原成可运行原型，并确认源图本地路径、图片生成通道、视觉回归工具。
2. 若图片生成通道不明确，先按 `ui-design-image` 的工作流检查 ACP UI 图片 MCP、等价 MCP、Agent 图片配置和系统 `imagegen`，再决定是否停止。
3. 所有素材提取、修复、高清化、设计分析都必须把用户本地图片路径作为参考图传入，不能只用文字描述生成素材。
4. 让图片 AI 输出透明 PNG 候选素材矩阵；由图片 AI 判断具体提取对象，只说明筛选规则：保留可复用且 HTML/CSS 难快速稳定还原的视觉素材，包括背景图、背景纹理或复杂背景层；排除纯文本、简单布局容器、普通 CSS 形状和整页截图。
5. 候选矩阵只用于定位和分流，不直接视为最终可消费素材。临时候选矩阵放 `.local/screenshot-to-prototype/<slug>/`，再切到 `.local/screenshot-to-prototype/<slug>/candidates/`：

```bash
node .agents/skills/screenshot-to-prototype/scripts/slice-asset-sheet.mjs \
  --input .local/screenshot-to-prototype/<slug>/asset-sheet.png \
  --output-dir .local/screenshot-to-prototype/<slug>/candidates \
  --grid 4x3 \
  --names icon-search,logo-brand,avatar-user,banner-hero \
  --manifest .local/screenshot-to-prototype/<slug>/candidate-manifest.json
```

6. 审计候选切图：

```bash
node .agents/skills/screenshot-to-prototype/scripts/audit-assets.mjs \
  --manifest .local/screenshot-to-prototype/<slug>/candidate-manifest.json
```

7. 逐个候选做最终化分流，最终素材必须从以下三类产生：
   - SVG/组件重绘：简单图标、线性图标、几何 logo、少色块图形、需要颜色继承、交互状态或 hover/focus 状态的元素。
   - 高清透明 PNG：复杂插画、拟物图标、纹理、照片、渐变阴影重的图形、banner/封面。
   - 直接消费 PNG：仅当候选切图通过审计且人工视觉检查无明显污染、误切、模糊、低分辨率时使用。
8. 做 SVG/组件重绘或高清透明 PNG 时，必须同时参考原始本地源图和候选切图；候选切图只提供对象范围和风格线索，不能作为唯一依据。
9. 只把最终文件型素材放入 `src/prototypes/<slug>/assets/`。最终 `asset-manifest.json` 只登记最终 SVG/PNG 文件并指向最终文件名和尺寸；组件化图标可直接放在原型代码中，不必登记到清单。React 原型不得引用 `.local/` 候选切图。
10. 页面用真实文本、React 结构、Grid/Flex、CSS variables、稳定 `aspect-ratio` 和响应式约束还原；不要把整张截图当背景。
11. 运行 `node scripts/check-app-ready.mjs /prototypes/<slug>`，再用视觉回归工具检查真实运行截图。
12. 最终回复提供轻量偏差报告，不新建长文档：
    - 展示或链接原图与真实运行截图。
    - 按 P0-P3 列出偏差，重点写未还原到位的问题，不写泛泛总结。
    - P0：阻塞验收或页面不可用；P1：关键布局/比例/内容明显不符；P2：素材风格、间距、图标、阴影等显著偏差；P3：细节优化。
    - 明确等待用户反馈选择是否继续修，不擅自进入下一轮大改。

## 命名

素材名用 kebab-case：`icon-*`、`logo-*`、`avatar-*`、`image-*`、`banner-*`、`cover-*`、`background-*`、`decoration-*`、`border-*`。含义不清时用 `asset-01`。

## 可消费素材标准

- 候选切图是中间产物；最终可消费素材是 `src/prototypes/<slug>/assets/` 中的 SVG/高清透明 PNG，或原型代码里的组件化图标。
- 默认不要把候选切图直接当最终素材。直接消费只适用于清晰、干净、尺寸足够、边缘不脏且没有误切的候选。
- 简单图标优先 SVG/组件化；复杂视觉优先用源图参考单独高清化或修复为透明 PNG。
- 最终清单只登记最终文件型素材，不登记 `.local/` 中间产物或代码组件。

## 提示词

写图片生成提示词时再读 `references/prompts.md`。
