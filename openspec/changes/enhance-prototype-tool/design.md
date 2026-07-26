# 技术方案：增强原型工具（上游同步优先架构）

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                 axhub-proto-enhanced (fork)                  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              upstream/ (只读，git subtree)            │    │
│  │  ├─ client/          # 上游前端（每周 sync）          │    │
│  │  ├─ src/server/      # 上游后端                      │    │
│  │  ├─ src/index/       # 上游管理界面                   │    │
│  │  └─ vendor/axhub-export-core/  # 上游导出核心        │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              patches/ (patch-package)                │    │
│  │  ├─ axhub-export-core+1.0.0.patch  # 组件映射扩展    │    │
│  │  └─ client+xyz.patch               # 小修改          │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           src/enhanced/ (完全自研，隔离)              │    │
│  │  ├─ components/        # 扩展组件库                   │    │
│  │  ├─ export/            # 增强导出逻辑                 │    │
│  │  │   ├─ axure-mapper.ts      # CSS→Axure 映射       │    │
│  │  │   ├─ html-exporter.ts     # HTML 导出            │    │
│  │  │   └─ image-exporter.ts    # 图片导出             │    │
│  │  ├─ preview/           # 多模式预览                   │    │
│  │  ├─ tokens/            # 设计 Token 系统              │    │
│  │  └─ bridge/            # Axure Bridge 客户端封装      │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           src/integration/ (适配层)                   │    │
│  │  ├─ upstream-adapter.ts    # 上游 API 适配           │    │
│  │  ├─ export-pipeline.ts     # 统一导出管道            │    │
│  │  └─ component-registry.ts  # 组件注册中心            │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           scripts/ & CI                              │    │
│  │  ├─ sync-upstream.sh       # 上游同步                │    │
│  │  ├─ apply-patches.sh       # 应用补丁                │    │
│  │  └─ .github/workflows/     # 定时同步 CI             │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 核心模块设计

### 1. 上游同步机制（最高优先级）

**策略**：git subtree + patch-package

```bash
# 目录结构
axhub-proto-enhanced/
├── upstream/           # git subtree，只读
├── patches/            # patch-package 补丁
├── src/enhanced/       # 完全自研，不修改上游文件
└── src/integration/    # 适配层
```

**同步流程**：
```bash
# 1. 拉取上游最新
git subtree pull --prefix=upstream https://github.com/lintendo/Axhub-Make.git main --squash

# 2. 应用本地补丁
npx patch-package

# 3. 运行测试
npm test
npm run test:e2e
npm run test:axure-export

# 4. 冲突处理
# - 自动解决：patches/ 中的补丁重新生成
# - 人工介入：上游删除了我们 patch 的文件
```

**CI 自动化** (`.github/workflows/upstream-sync.yml`)：
```yaml
name: Upstream Sync
on:
  schedule:
    - cron: '0 1 * * 1'  # 每周一 09:00 (Asia/Shanghai)
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Sync upstream
        run: |
          git subtree pull --prefix=upstream https://github.com/lintendo/Axhub-Make.git main --squash
          npx patch-package
      - name: Run tests
        run: |
          npm install
          npm test
          npm run test:e2e
      - name: Create PR or Issue
        # 成功：自动 merge；失败：创建 issue 通知人工
```

### 2. 组件系统（设计 Token + 状态规范）

**设计 Token** (`src/enhanced/tokens/design-tokens.json`)：
```json
{
  "color": {
    "primary": { "value": "#0066cc", "hover": "#0071e3", "active": "#005bb5" },
    "text": { "primary": "#1d1d1f", "secondary": "#7a7a7a", "disabled": "#cccccc" },
    "background": { "primary": "#ffffff", "secondary": "#f5f5f7", "hover": "#f0f0f0" },
    "border": { "default": "#e0e0e0", "hover": "#cccccc", "focus": "#0066cc" },
    "state": { "success": "#34c759", "warning": "#ff9500", "error": "#ff3b30" }
  },
  "typography": {
    "fontFamily": { "display": "SF Pro Display", "body": "SF Pro Text" },
    "fontSize": { "xs": "12px", "sm": "14px", "md": "16px", "lg": "18px", "xl": "24px" },
    "fontWeight": { "regular": 400, "medium": 500, "semibold": 600, "bold": 700 }
  },
  "spacing": { "xxs": "4px", "xs": "8px", "sm": "12px", "md": "16px", "lg": "24px", "xl": "32px" },
  "radius": { "sm": "4px", "md": "8px", "lg": "12px", "full": "9999px" },
  "shadow": {
    "sm": "0 1px 2px rgba(0,0,0,0.05)",
    "md": "0 4px 6px rgba(0,0,0,0.07)",
    "lg": "0 10px 15px rgba(0,0,0,0.1)"
  }
}
```

**组件定义** (`src/enhanced/components/types.ts`)：
```typescript
interface ComponentDefinition {
  // 基础信息
  type: string;                    // 组件类型标识（如 'proto-button'）
  name: string;                    // 显示名称
  category: 'basic' | 'form' | 'layout' | 'advanced';
  icon: string;                    // Lucide 图标名
  
  // 属性系统
  defaultProps: Record<string, any>;
  propSchema: PropSchema[];        // 属性配置 schema（驱动属性面板）
  
  // 状态系统
  states: StateSchema[];           // hover/active/focus/disabled/loading/error
  
  // Axure 映射
  axureMapping: {
    widgetType: string;            // Axure widget 类型
    propertyMap: Record<string, string>;  // CSS 属性 → Axure 属性
    fallback?: FallbackStrategy;   // 降级策略
  };
  
  // 渲染
  render: React.ComponentType<ComponentProps>;
  
  // 版本
  version: string;                 // 组件 schema 版本
}

interface StateSchema {
  name: 'default' | 'hover' | 'active' | 'focus' | 'disabled' | 'loading' | 'error';
  styleOverrides: Record<string, string>;  // CSS 属性覆盖
}

interface FallbackStrategy {
  type: 'placeholder' | 'image' | 'text';
  placeholderText?: string;        // 占位文本（如 "[图表]"）
  preserveSize?: boolean;          // 是否保持原尺寸
}
```

**组件清单**（v1.0 覆盖 20+ 种）：

| 类别 | 组件 | Axure 映射 | 降级策略 |
|------|------|-----------|---------|
| 基础 | 矩形 rectangle | rectangle | - |
| 基础 | 文本 text | text | - |
| 基础 | 按钮 button | button | - |
| 基础 | 输入框 input | text_field | - |
| 基础 | 图片 image | image | - |
| 基础 | 链接 link | text + interaction | - |
| 表单 | 下拉选择 select | dropdown | - |
| 表单 | 单选框 radio | radio_button | - |
| 表单 | 复选框 checkbox | checkbox | - |
| 表单 | 表格 table | table/repeater | 复杂表格降级为占位 |
| 表单 | 开关 switch | dynamic_panel | - |
| 表单 | 滑块 slider | dynamic_panel | 降级为占位 |
| 表单 | 日期选择 date-picker | text_field + panel | 降级为输入框 |
| 布局 | 导航栏 nav | group + rectangles | - |
| 布局 | 标签页 tabs | dynamic_panel | - |
| 布局 | 卡片 card | group + rectangle | - |
| 布局 | 分割线 divider | line | - |
| 布局 | 栅格容器 grid | group | 降级为绝对定位 |
| 布局 | 模态框 modal | dynamic_panel | - |
| 布局 | 抽屉 drawer | dynamic_panel | - |
| 高级 | 图表 chart | inline_frame / image | 尽力而为，失败降级为占位图 |
| 高级 | 地图 map | inline_frame / image | 尽力而为，失败降级为占位图 |
| 高级 | 富文本 rich-text | text | 尽力保持格式，失败降级为纯文本 |

### 3. Axure 导出增强

**核心机制**：改造 `htmlToAxure`，从 DOM 遍历改为 **组件树驱动**

```typescript
// src/enhanced/export/axure-mapper.ts

// CSS → Axure 属性映射表
const CSS_TO_AXURE_MAP: Record<string, AxurePropertyMapping> = {
  // 尺寸
  'width': { target: 'size.width', transform: parsePixelValue },
  'height': { target: 'size.height', transform: parsePixelValue },
  
  // 位置
  'left': { target: 'position.x', transform: parsePixelValue },
  'top': { target: 'position.y', transform: parsePixelValue },
  
  // 边框
  'border-radius': { target: 'cornerRadius', transform: parsePixelValue },
  'border-width': { target: 'border.width', transform: parsePixelValue },
  'border-color': { target: 'border.color', transform: parseColorValue },
  'border-style': { target: 'border.style', transform: mapBorderStyle },
  
  // 背景
  'background-color': { target: 'fill.color', transform: parseColorValue },
  
  // 文本
  'font-family': { target: 'textStyle.fontFamily', transform: mapFontFamily },
  'font-size': { target: 'textStyle.fontSize', transform: parsePixelValue },
  'font-weight': { target: 'textStyle.fontWeight', transform: mapFontWeight },
  'color': { target: 'textStyle.color', transform: parseColorValue },
  'text-align': { target: 'textStyle.alignment', transform: mapTextAlign },
  'line-height': { target: 'textStyle.lineHeight', transform: parsePixelValue },
  
  // 阴影
  'box-shadow': { target: 'shadow', transform: parseBoxShadow },
  
  // 不支持的属性（降级处理）
  'transform': { target: null, fallback: 'ignore', warning: true },
  'filter': { target: null, fallback: 'ignore', warning: true },
  'flex': { target: null, fallback: 'absolute-layout', warning: true },
  'grid': { target: null, fallback: 'absolute-layout', warning: true },
};

// 组件类型映射
const COMPONENT_TO_AXURE_WIDGET: Record<string, AxureWidgetMapping> = {
  'proto-button': { widgetType: 'button', editable: true },
  'proto-input': { widgetType: 'text_field', editable: true },
  'proto-select': { widgetType: 'dropdown', editable: true },
  'proto-table': { widgetType: 'table', editable: true, complexity: 'high' },
  'proto-chart': { widgetType: 'inline_frame', editable: false, fallback: 'placeholder' },
  'proto-map': { widgetType: 'inline_frame', editable: false, fallback: 'placeholder' },
  // ...
};

// 导出管道
async function exportToAxure(componentTree: ComponentTree): Promise<AxureDocument> {
  const axureDoc: AxureDocument = {
    masters: [],
    imageMap: {},
    scene: { items: [] },
  };
  
  for (const node of componentTree.nodes) {
    const widget = await convertNodeToAxureWidget(node);
    axureDoc.scene.items.push(widget);
  }
  
  return axureDoc;
}

async function convertNodeToAxureWidget(node: ComponentNode): Promise<AxureWidget> {
  const definition = getComponentDefinition(node.type);
  const mapping = definition.axureMapping;
  
  // 检查是否支持直接映射
  if (mapping.fallback && !canMapToAxure(node)) {
    return createFallbackWidget(node, mapping.fallback);
  }
  
  // 转换属性
  const widget: AxureWidget = {
    type: mapping.widgetType,
    id: node.id,
    label: node.name,
    position: extractPosition(node),
    size: extractSize(node),
    style: convertStyles(node.styles, mapping.propertyMap),
    interactions: convertInteractions(node.events),
    children: await Promise.all(node.children.map(convertNodeToAxureWidget)),
  };
  
  return widget;
}
```

### 4. 多模式预览

**iframe 预览**（复用上游，增强）：
- 实时渲染组件树
- 支持交互（点击、悬停）
- 与编辑器双向同步

**HTML 导出** (`src/enhanced/export/html-exporter.ts`)：
```typescript
interface HtmlExportOptions {
  standalone: boolean;           // 是否独立文件（无外部依赖）
  includeInteractions: boolean;  // 是否包含交互
  inlineResources: boolean;      // 是否内联图片/字体
  maxFileSize: number;           // 最大文件大小（默认 5MB）
}

async function exportHtml(componentTree: ComponentTree, options: HtmlExportOptions): Promise<Blob> {
  // 1. 渲染组件树为 HTML
  const html = renderToStaticMarkup(componentTree);
  
  // 2. 收集资源
  const resources = await collectResources(componentTree);
  
  // 3. 内联或外链处理
  if (options.inlineResources) {
    html = await inlineResources(html, resources, options.maxFileSize);
  }
  
  // 4. 添加交互脚本
  if (options.includeInteractions) {
    html = injectInteractionRuntime(html);
  }
  
  return new Blob([html], { type: 'text/html' });
}
```

**图片导出** (`src/enhanced/export/image-exporter.ts`)：
```typescript
interface ImageExportOptions {
  format: 'png' | 'svg';
  dpi: 1 | 2 | 3;
  background: 'transparent' | 'white' | 'page';
  range: 'full-page' | 'selection';
}

async function exportImage(componentTree: ComponentTree, options: ImageExportOptions): Promise<Blob> {
  // 使用 snapdom 或 html-to-image
  const element = renderToDom(componentTree);
  
  if (options.format === 'png') {
    return await snapdom.toPng(element, {
      scale: options.dpi,
      backgroundColor: options.background === 'transparent' ? undefined : '#ffffff',
    });
  } else {
    return await snapdom.toSvg(element, {
      embedFonts: true,
    });
  }
}
```

### 5. 数据埋点

**埋点方案** (`src/enhanced/analytics/`)：

```typescript
// 核心事件
const AnalyticsEvents = {
  // 激活漏斗
  APP_OPEN: 'app_open',
  AI_GENERATE_START: 'ai_generate_start',
  AI_GENERATE_SUCCESS: 'ai_generate_success',
  AI_GENERATE_FAIL: 'ai_generate_fail',
  
  // 导出
  EXPORT_AXURE_START: 'export_axure_start',
  EXPORT_AXURE_SUCCESS: 'export_axure_success',
  EXPORT_AXURE_FAIL: 'export_axure_fail',
  EXPORT_HTML: 'export_html',
  EXPORT_IMAGE: 'export_image',
  
  // 组件使用
  COMPONENT_USE: 'component_use',  // { componentType: string }
  
  // 预览
  PREVIEW_MODE_SWITCH: 'preview_mode_switch',  // { mode: 'iframe' | 'html' | 'image' }
} as const;

// 北极星指标
const NorthStarMetrics = {
  WEEKLY_ACTIVE_EXPORTERS: 'wau_export',  // 周活跃导出用户数
  AI_ADOPTION_RATE: 'ai_adoption',        // AI 生成后直接导出比例
  EXPORT_SUCCESS_RATE: 'export_success',  // 导出成功率
} as const;
```

## 数据流

```
用户输入需求
    │
    ▼
┌─────────────┐
│  AI 生成模块  │ ──▶ 生成 Excalidraw 元素（上游能力）
│  (upstream)   │
└─────────────┘
    │
    ▼
┌─────────────────┐
│ 组件树构建器      │ ──▶ Excalidraw 元素 → ComponentTree
│ (integration)   │
└─────────────────┘
    │
    ├─────────────────┬─────────────────┐
    ▼                 ▼                 ▼
┌─────────┐     ┌─────────────┐   ┌─────────────┐
│iframe 预览│     │  HTML 导出   │   │  图片导出    │
│(upstream)│     │ (enhanced)  │   │ (enhanced)  │
└─────────┘     └─────────────┘   └─────────────┘
    │
    ▼
┌─────────────┐
│ Axure 导出   │ ──▶ Axure Bridge ──▶ Axure RP
│ (enhanced)  │
└─────────────┘
```

## 关键技术决策

1. **上游同步优先**：git subtree + patch-package，确保每周可自动 merge
2. **不直接生成 .rp**：通过 Axure Bridge (localhost:32767) 实现
3. **组件树单一数据源**：AI 生成 → Excalidraw 元素 → ComponentTree → 导出
4. **CSS 样式作为中间格式**：所有组件最终渲染为 CSS，再映射到 Axure
5. **降级策略显式化**：无法映射的组件/样式自动降级，并记录警告
6. **v1.0 不含手动画布**：专注导出能力，画布编辑 v1.1 再做

## 风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| Axure Bridge 不可用 | 中 | 高 | 降级策略：复制剪贴板 + 手动粘贴引导 |
| 高级组件导出效果差 | 高 | 中 | 尽力而为，失败时降级为占位矩形+图注 |
| 上游更新导致冲突 | 中 | 高 | git subtree + patch-package，CI 自动检测 |
| CSS 映射不完整 | 高 | 中 | 建立映射表，未覆盖属性自动忽略并警告 |
| HTML 导出体积过大 | 中 | 中 | 5MB 上限，超限自动转为外链资源 |
| 图片导出跨域失败 | 高 | 低 | 地图/图表降级为占位图，提示用户 |
