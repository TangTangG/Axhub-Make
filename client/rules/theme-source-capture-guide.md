# 主题网页来源采集指南

本文档只处理“从网页收集主题证据”的场景。采集完成后，回到 `rules/theme-guide.md` 生成或更新 `src/themes/<theme-key>/` 的标准交付物。

## 何时读取

- 用户提供 URL，并要求参考网站、提取主题、生成主题、分析设计风格或补预览图。
- 当前主题缺少可靠预览图、色彩/字体/组件证据，无法安全补齐 `DESIGN.md`。
- 需要校准响应式、首屏、section 节奏、产品截图风格或真实控件形态。

不需要读取的情况：

- 用户已经提供明确的 `DESIGN.md`、品牌规范、设计稿或人工确认的 token。
- 只是同步已有主题的 `theme.json`、`style.css`、`tw.css`、`index.tsx`。
- 用户只要求局部改文案、标签、预览描述或演示页展示字段。

## 采集目标

采集是为了拿到足够证据，而不是克隆页面。优先收集：

- 全页截图：判断视觉主题、页面节奏、信息层级和主要素材风格。
- 响应式截图：desktop/tablet/mobile 的布局变化、导航折叠和卡片重排。
- 设计 token：颜色、字体、字号、圆角、边框、阴影、过渡和 CSS 变量。
- 关键 section：header、hero、核心产品展示、卡片组、footer 的截图或 computed style。
- 预览资产：一张可稳定放入主题 `assets/` 的官网截图或裁切图。

## 推荐采集方式

优先使用项目脚本：

```bash
pnpm run capture:theme-source -- --theme <theme-key> --url <url>
```

也可以使用 Playwright、in-app Browser、Chrome 自动化或同等能力的工具。工具不是硬性绑定；只要能稳定获得截图、token 和必要页面证据，就可以使用等价工具。

建议落点：

```text
.local/theme-capture-<theme-key>/
├── screenshot.png
├── responsive/
│   ├── desktop.png
│   ├── tablet.png
│   └── mobile.png
├── theme.json 或 computed-tokens.json
├── meta.json
└── sections/            # 可选
```

不要把采集原始数据放入主题目录。主题目录只保留标准交付物和必要的稳定预览资源。

## JSON 如何获取

这些 JSON 是采集过程的中间证据，不是主题最终产物：

- `meta.json`：页面元信息，通常由采集工具自动写入，至少包含来源 URL、页面标题、视口、采集时间。若使用等效工具，也可以手动写一个最小版本。
- `theme.json`：结构化设计 token，通常由页面采集工具从 computed style 中统计生成，包括颜色、字体、字号、间距、圆角、边框、阴影、过渡、CSS 变量等。
- `computed-tokens.json`：当 `theme.json` 没有生成或不可靠时，用 Playwright / Browser evaluate 在页面里抽样 `getComputedStyle` 后生成的替代摘要。

常见来源：

```bash
# 项目默认采集入口：产出截图、响应式截图、theme.json、computed-tokens.json、meta.json
pnpm run capture:theme-source -- --theme <theme-key> --url <url>

# 有现成采集工具时，直接产出 theme.json / meta.json / screenshot.png
node <extract-page-data>/scripts/extract.mjs <url> --theme --screenshot --scroll -o .local/theme-capture-<theme-key>

# 或用支持 clone/page data 的工具采集截图、theme 和响应式数据
node <clone-page>/scripts/clone.mjs <url> quick -o .local/theme-capture-<theme-key> --scroll
node <clone-page>/scripts/clone.mjs <url> responsive -o .local/theme-capture-<theme-key>
```

如果这些工具失败或不可用，就用 Playwright、in-app Browser、Chrome 自动化等效实现：

1. 截图写入 `screenshot.png` 和 `responsive/*.png`。
2. 在页面上下文执行 `getComputedStyle`，统计可见元素的颜色、字体、字号、圆角、边框、阴影和 transition。
3. 把结果写成 `computed-tokens.json`，同时写一个包含 URL、title、viewport、timestamp 的 `meta.json`。

项目现有的 `scripts/capture-theme-homepage.mjs` 主要用于抓稳定官网预览图，不负责生成 `theme.json`；若只使用它，需要再用等效方式补 `theme.json` 或 `computed-tokens.json`。

## 证据优先级

1. 用户明确说明、附件、设计稿或品牌规范。
2. 原始网页截图，尤其是全页截图和响应式截图。
3. 页面 CSS 变量和官方命名 token。
4. computed style / `theme.json` 的统计值。
5. 自动推断结果。

当截图和 token 冲突时，以截图和用户说明为准。`theme.json` 或 computed style 常会混入 cookie 弹窗、第三方组件、浏览器默认值和隐藏元素，需要人工排除。

## 分析检查点

看截图时至少确认：

- 品牌气质：极简、科技、温暖、高端、实验、工具感等。
- 色彩策略：主背景、主文本、唯一或多个强调色、状态色边界。
- 排版策略：标题大小/重量、正文字号、字距、代码字体。
- 组件形态：按钮圆角、高度、边框、卡片表面、输入框、标签、弹窗。
- 布局节奏：首屏留白、section 间距、容器宽度、网格或横向滚动。
- 深度表达：阴影、边框、层级、毛玻璃、渐变、噪点或纯色面。
- 响应式：导航是否折叠、CTA 是否全宽、卡片列数如何变化。
- 素材风格：产品截图、摄影、3D、插画、图标或视频。

这些结论应写入 `DESIGN.md` 的 9 段式规范，而不是只留在交付说明里。

## 常见降级

- Playwright 浏览器缺失：可连接系统 Chrome、使用 in-app Browser、Chrome 自动化或其他截图工具。
- `networkidle` 等待过久：改用 `domcontentloaded` 加固定等待，确保截图稳定即可。
- token 脚本失败：保留截图，改用浏览器 evaluate 或手工 computed style 抽样补齐关键 token。
- DOM 骨架或 section 采集失败：不阻塞主题生成；优先保留全页截图、响应式截图和关键视觉观察。
- 第三方弹窗污染：在 `DESIGN.md` 中明确排除，不把其字体、按钮或颜色作为品牌 token。

## 采集后回填

- 把稳定预览图复制到 `src/themes/<theme-key>/assets/`，路径必须是主题内相对路径。
- 在 `theme.json.source` 标记网页来源和采集方式，`assets.previewHtml` 指向主题内预览图。
- 在 `DESIGN.md` 开头写清来源 URL 和采集日期；若某些规则来自推断，明确写“按截图观察/保守默认处理”。
- 同步 `theme.json.tokens`、`assets/tokens.json`、`style.css`、`tw.css`，不要让采集数据成为另一套事实源。
