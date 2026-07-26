# 实施计划：axhub-proto-enhanced

> 版本：v2.0（第 3 轮 Review 通过后细化）
> 日期：2026-07-26
> 状态：已确认，待开发执行

---

## 一、项目里程碑

| 里程碑 | 目标 | 时间 | 交付物 | 验收标准 |
|--------|------|------|--------|---------|
| M1 | 项目初始化 + 上游同步机制 | Week 1 | 可构建的 fork 仓库 + CI 同步 | 构建通过 + 同步脚本可用 |
| M2 | 设计 Token + 基础组件库 | Week 2 | tokens.json + 6 个基础组件 | 组件可渲染 + Token 可配置 |
| M3 | Axure 导出增强（基础组件） | Week 3 | 矩形/文本/按钮/输入框可导出 | 导出后 L1 可编辑 |
| M4 | 表单组件 + Axure 导出 | Week 4 | 下拉/单选/复选/表格可导出 | 导出后 L1 可编辑 |
| M5 | 布局组件 + Axure 导出 | Week 5 | 导航/标签页/卡片可导出 | 导出后 L1 可编辑 |
| M6 | 多模式预览（HTML/图片导出） | Week 6 | HTML 导出 + 图片导出 | 三种模式一致性 ≤1px |
| M7 | 数据埋点 + 集成测试 | Week 7 | 埋点 SDK + E2E 测试 | 必埋事件 100% 触发 |
| M8 | v1.0.0 发布 | Week 8 | 发布包 + 文档 | 全部验收标准通过 |

---

## 二、Phase 1: 项目初始化与上游同步（Week 1）

### 目标
建立可维护的 fork 架构，支持定时拉取上游更新，自研代码完全隔离。

### 任务清单

#### 任务 1.1: Fork 与目录结构
```bash
# 1. Fork 仓库（GitHub 手动操作）
# 2. 克隆到本地
git clone https://github.com/YOUR_USERNAME/axhub-proto-enhanced.git
cd axhub-proto-enhanced

# 3. 添加上游远程
git remote add upstream https://github.com/lintendo/Axhub-Make.git

# 4. 创建目录结构
mkdir -p upstream patches src/enhanced/{components,export,preview,tokens,bridge} src/integration scripts .github/workflows
```

**验收标准**：
- [ ] 目录结构符合 design.md 规范
- [ ] `upstream/` 为只读 subtree
- [ ] `src/enhanced/` 完全自研
- [ ] `src/integration/` 为适配层

#### 任务 1.2: git subtree 初始化
```bash
# 将上游代码作为 subtree 引入
git subtree add --prefix=upstream https://github.com/lintendo/Axhub-Make.git main --squash

# 验证
ls upstream/client/src
ls upstream/src/server
```

**验收标准**：
- [ ] `upstream/` 包含完整上游代码
- [ ] `git log` 显示 subtree 提交

#### 任务 1.3: patch-package 配置
```bash
# 安装 patch-package
npm install --save-dev patch-package postinstall-postinstall

# package.json 添加脚本
{
  "scripts": {
    "postinstall": "patch-package"
  }
}
```

**验收标准**：
- [ ] `patch-package` 安装成功
- [ ] `patches/` 目录可存放补丁

#### 任务 1.4: 上游同步脚本
```bash
#!/bin/bash
# scripts/sync-upstream.sh

set -e

echo "=== 上游同步 ==="

# 1. 拉取上游最新
git subtree pull --prefix=upstream https://github.com/lintendo/Axhub-Make.git main --squash -m "chore: sync upstream $(date +%Y-%m-%d)"

# 2. 应用补丁
npx patch-package

# 3. 运行测试
npm test

echo "=== 同步完成 ==="
```

**验收标准**：
- [ ] 脚本可执行
- [ ] 同步后测试通过

#### 任务 1.5: CI 工作流
```yaml
# .github/workflows/upstream-sync.yml
name: Upstream Sync
on:
  schedule:
    - cron: '0 1 * * 1'  # 每周一 09:00 (Asia/Shanghai)
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Sync upstream
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git subtree pull --prefix=upstream https://github.com/lintendo/Axhub-Make.git main --squash -m "chore: sync upstream"
          npx patch-package
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Create PR on success
        if: success()
        run: |
          git push origin main
      
      - name: Create issue on failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '上游同步失败',
              body: '自动同步失败，请人工处理。',
              labels: ['upstream-sync', 'bug']
            })
```

**验收标准**：
- [ ] CI 每周自动运行
- [ ] 失败时自动创建 issue

### 依赖
- GitHub 账号（fork 权限）
- Node.js 20+

### 风险
| 风险 | 概率 | 对策 |
|------|------|------|
| 上游仓库结构变更 | 低 | 监控上游 release notes |
| patch-package 冲突 | 中 | 人工解决后重新生成 patch |

---

## 三、Phase 2: 设计 Token 与组件系统（Week 2）

### 目标
建立统一的设计语言，实现 6 个基础组件。

### 任务清单

#### 任务 2.1: 设计 Token
```json
// src/enhanced/tokens/design-tokens.json
{
  "color": {
    "primary": { "value": "#1890ff", "type": "color" },
    "primary.hover": { "value": "#40a9ff", "type": "color" },
    "primary.active": { "value": "#096dd9", "type": "color" },
    "success": { "value": "#52c41a", "type": "color" },
    "warning": { "value": "#faad14", "type": "color" },
    "error": { "value": "#f5222d", "type": "color" },
    "text.primary": { "value": "rgba(0,0,0,0.85)", "type": "color" },
    "text.secondary": { "value": "rgba(0,0,0,0.45)", "type": "color" },
    "border.default": { "value": "#d9d9d9", "type": "color" },
    "border.hover": { "value": "#40a9ff", "type": "color" },
    "border.focus": { "value": "#1890ff", "type": "color" },
    "border.error": { "value": "#f5222d", "type": "color" }
  },
  "typography": {
    "font.family": { "value": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", "type": "fontFamily" },
    "font.size.xs": { "value": "12px", "type": "fontSize" },
    "font.size.sm": { "value": "14px", "type": "fontSize" },
    "font.size.base": { "value": "16px", "type": "fontSize" },
    "font.size.lg": { "value": "18px", "type": "fontSize" },
    "font.size.xl": { "value": "20px", "type": "fontSize" },
    "font.weight.normal": { "value": "400", "type": "fontWeight" },
    "font.weight.medium": { "value": "500", "type": "fontWeight" },
    "font.weight.bold": { "value": "700", "type": "fontWeight" }
  },
  "spacing": {
    "spacing.0": { "value": "0", "type": "spacing" },
    "spacing.1": { "value": "4px", "type": "spacing" },
    "spacing.2": { "value": "8px", "type": "spacing" },
    "spacing.3": { "value": "12px", "type": "spacing" },
    "spacing.4": { "value": "16px", "type": "spacing" },
    "spacing.5": { "value": "20px", "type": "spacing" },
    "spacing.6": { "value": "24px", "type": "spacing" },
    "spacing.8": { "value": "32px", "type": "spacing" }
  },
  "radius": {
    "radius.sm": { "value": "2px", "type": "borderRadius" },
    "radius.base": { "value": "4px", "type": "borderRadius" },
    "radius.lg": { "value": "8px", "type": "borderRadius" },
    "radius.full": { "value": "9999px", "type": "borderRadius" }
  },
  "shadow": {
    "shadow.sm": { "value": "0 1px 2px 0 rgba(0,0,0,0.05)", "type": "shadow" },
    "shadow.base": { "value": "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)", "type": "shadow" },
    "shadow.lg": { "value": "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)", "type": "shadow" }
  }
}
```

**验收标准**：
- [ ] Token 覆盖颜色/字体/间距/圆角/阴影 5 维度
- [ ] 与 DESIGN_SPEC.md 一致
- [ ] 支持 JSON 导入导出

#### 任务 2.2: 组件接口
```typescript
// src/enhanced/components/types.ts
interface ComponentDefinition {
  type: string;
  name: string;
  category: 'basic' | 'form' | 'layout' | 'advanced';
  axureWidget: string;
  editability: 'L1' | 'L2' | 'L3' | 'L4';
  states: ComponentState[];
  props: PropSchema[];
  previewSupport: ('iframe' | 'html' | 'image')[];
  fallbackStrategy: 'none' | 'placeholder' | 'image' | 'text';
}

interface ComponentState {
  name: 'default' | 'hover' | 'active' | 'focus' | 'disabled' | 'loading' | 'error';
  styles: Record<string, string>;
}

interface PropSchema {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'color' | 'icon';
  default: any;
  required?: boolean;
  options?: string[];
}
```

**验收标准**：
- [ ] 接口覆盖 design.md 定义
- [ ] 支持 TypeScript 类型检查

#### 任务 2.3: 基础组件实现

| 组件 | 文件 | 状态 | 验收标准 |
|------|------|------|---------|
| 矩形 | `src/enhanced/components/basic/Rectangle.tsx` | 待实现 | 可渲染 + 属性可配置 |
| 文本 | `src/enhanced/components/basic/Text.tsx` | 待实现 | 可渲染 + 字体/颜色可配置 |
| 按钮 | `src/enhanced/components/basic/Button.tsx` | 待实现 | 6 状态可切换 |
| 输入框 | `src/enhanced/components/basic/Input.tsx` | 待实现 | 占位符/值/类型可配置 |
| 图片 | `src/enhanced/components/basic/Image.tsx` | 待实现 | 填充模式可配置 |
| 链接 | `src/enhanced/components/basic/Link.tsx` | 待实现 | 4 状态可切换 |

**验收标准**：
- [ ] 组件可独立渲染
- [ ] 属性面板可配置
- [ ] 状态切换正常

---

## 四、Phase 3: Axure 导出增强（Week 3-5）

### 目标
实现组件树 → Axure 的完整导出链路。

### 任务清单

#### 任务 3.1: CSS → Axure 映射
```typescript
// src/enhanced/export/axure-mapper.ts
const CSS_TO_AXURE_MAP: Record<string, AxurePropertyMapping> = {
  // 尺寸
  'width': { target: 'size.width', transform: parsePixelValue },
  'height': { target: 'size.height', transform: parsePixelValue },
  'min-width': { target: 'constraints.minWidth', transform: parsePixelValue },
  'max-width': { target: 'constraints.maxWidth', transform: parsePixelValue },
  
  // 位置
  'position': { target: 'position.type', transform: mapPositionType },
  'top': { target: 'position.y', transform: parsePixelValue },
  'left': { target: 'position.x', transform: parsePixelValue },
  'z-index': { target: 'zOrder', transform: parseIntValue },
  
  // 盒模型
  'padding': { target: 'padding', transform: parseBoxValues },
  'border': { target: 'border', transform: parseBorder },
  'border-radius': { target: 'cornerRadius', transform: parsePixelValue },
  'box-shadow': { target: 'shadow', transform: parseShadow },
  
  // 文本
  'font-family': { target: 'font.family', transform: parseFontFamily },
  'font-size': { target: 'font.size', transform: parsePixelValue },
  'font-weight': { target: 'font.weight', transform: parseFontWeight },
  'color': { target: 'font.color', transform: parseColor },
  'text-align': { target: 'textAlign', transform: mapTextAlign },
  
  // 背景
  'background-color': { target: 'fill.color', transform: parseColor },
  
  // 伪类（交互状态）
  ':hover': { target: 'interactionStyles.hover', transform: mapInteractionState },
  ':active': { target: 'interactionStyles.active', transform: mapInteractionState },
  ':focus': { target: 'interactionStyles.focus', transform: mapInteractionState },
  ':disabled': { target: 'interactionStyles.disabled', transform: mapInteractionState },
};
```

**验收标准**：
- [ ] 覆盖 COMPONENT_MATRIX.md 全部 CSS 属性
- [ ] 支持伪类映射
- [ ] 支持动态值计算（calc/%/vw/vh/em/rem）

#### 任务 3.2: 组件 → Axure Widget 映射
```typescript
// src/enhanced/export/component-mapper.ts
const COMPONENT_TO_AXURE_WIDGET: Record<string, AxureWidgetMapping> = {
  'proto-rectangle': { widgetType: 'rectangle', editable: true, axureType: 'vectorShape' },
  'proto-text': { widgetType: 'text', editable: true, axureType: 'richTextPanel' },
  'proto-button': { widgetType: 'button', editable: true, axureType: 'vectorShape' },
  'proto-input': { widgetType: 'text_field', editable: true, axureType: 'textField' },
  'proto-image': { widgetType: 'image', editable: true, axureType: 'image' },
  'proto-link': { widgetType: 'link', editable: true, axureType: 'richTextPanel' },
  'proto-dropdown': { widgetType: 'dropdown', editable: true, axureType: 'droplist' },
  'proto-radio': { widgetType: 'radio', editable: true, axureType: 'radioButton' },
  'proto-checkbox': { widgetType: 'checkbox', editable: true, axureType: 'checkbox' },
  'proto-table': { widgetType: 'table', editable: true, axureType: 'repeater' },
  'proto-switch': { widgetType: 'switch', editable: true, axureType: 'dynamicPanel' },
  'proto-navbar': { widgetType: 'navbar', editable: true, axureType: 'group' },
  'proto-tabs': { widgetType: 'tabs', editable: true, axureType: 'dynamicPanel' },
  'proto-card': { widgetType: 'card', editable: true, axureType: 'group' },
  'proto-chart': { widgetType: 'chart', editable: false, axureType: 'inlineFrame', fallback: 'image' },
  'proto-map': { widgetType: 'map', editable: false, axureType: 'inlineFrame', fallback: 'image' },
  'proto-richtext': { widgetType: 'richtext', editable: true, axureType: 'richTextPanel', fallback: 'text' },
  'proto-video': { widgetType: 'video', editable: false, axureType: 'inlineFrame', fallback: 'image' },
};
```

**验收标准**：
- [ ] 覆盖全部 25 个组件
- [ ] 高级组件有降级策略

#### 任务 3.3: 导出管道
```typescript
// src/enhanced/export/export-pipeline.ts
async function exportToAxure(componentTree: ComponentTree): Promise<AxureDocument> {
  // 1. 遍历组件树
  const widgets = await Promise.all(
    componentTree.children.map(node => convertNodeToWidget(node))
  );
  
  // 2. 处理降级策略
  const processedWidgets = widgets.map(widget => {
    if (widget.fallback && !widget.supported) {
      return applyFallbackStrategy(widget);
    }
    return widget;
  });
  
  // 3. 生成 Axure JSON
  return {
    version: '1.0',
    pages: [{
      name: componentTree.name,
      widgets: processedWidgets,
    }],
  };
}
```

**验收标准**：
- [ ] 导出 JSON 符合 Axure Bridge 协议
- [ ] 支持降级策略
- [ ] 导出时间 ≤5s

---

## 五、Phase 4: 多模式预览（Week 6）

### 目标
实现 iframe / HTML / 图片三种预览模式。

### 任务清单

#### 任务 4.1: HTML 导出
```typescript
// src/enhanced/export/html-exporter.ts
async function exportHtml(componentTree: ComponentTree, options: HtmlExportOptions): Promise<Blob> {
  // 1. 渲染为静态 HTML
  const html = renderToStaticMarkup(componentTree);
  
  // 2. 内联资源（≤5MB）
  const inlinedHtml = await inlineResources(html, {
    maxSize: 5 * 1024 * 1024,
    inlineImages: true,
    inlineFonts: true,
  });
  
  // 3. 注入交互脚本
  const interactiveHtml = injectInteractionScripts(inlinedHtml);
  
  return new Blob([interactiveHtml], { type: 'text/html' });
}
```

**验收标准**：
- [ ] 离线可打开
- [ ] 文件大小 ≤5MB
- [ ] 三种浏览器兼容

#### 任务 4.2: 图片导出
```typescript
// src/enhanced/export/image-exporter.ts
async function exportImage(componentTree: ComponentTree, options: ImageExportOptions): Promise<Blob> {
  const { format = 'png', dpi = 2, background = 'white' } = options;
  
  // 使用 snapdom 或 html-to-image
  const element = renderToElement(componentTree);
  
  return await snapdom.toBlob(element, {
    format,
    dpi,
    background,
  });
}
```

**验收标准**：
- [ ] PNG/SVG 可选
- [ ] 1x/2x/3x 分辨率可选
- [ ] 透明/白色/页面底色可选

---

## 六、Phase 5: 数据埋点（Week 7）

### 目标
实现完整的埋点采集、存储、分析链路。

### 任务清单

#### 任务 5.1: 埋点 SDK
```typescript
// src/enhanced/analytics/tracker.ts
class AnalyticsTracker {
  private queue: AnalyticsEvent[] = [];
  private batchSize = 10;
  private flushInterval = 5000;
  
  track(event: string, properties?: Record<string, any>): void {
    const eventData: AnalyticsEvent = {
      event_id: generateUUID(),
      event_name: event,
      timestamp: Date.now(),
      session_id: getSessionId(),
      user_id: getAnonymousUserId(),
      app_version: getAppVersion(),
      user_agent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer,
      properties,
    };
    
    this.queue.push(eventData);
    
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }
  
  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    
    const events = [...this.queue];
    this.queue = [];
    
    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      // 失败时重新入队
      this.queue.unshift(...events);
    }
  }
}
```

**验收标准**：
- [ ] 必埋事件 100% 触发
- [ ] 离线缓存可用
- [ ] 批量上报 ≤5s 延迟

#### 任务 5.2: 服务端接收
```typescript
// src/server/routes/analytics.ts
export async function handleTrackEvents(req: Request, res: Response) {
  const { events } = req.body;
  
  // 验证事件格式
  const validEvents = events.filter(validateEvent);
  
  // 存储到 SQLite
  await db.insert('analytics_events', validEvents);
  
  // 实时聚合
  await updateDailyAggregates(validEvents);
  
  res.json({ success: true, received: validEvents.length });
}
```

**验收标准**：
- [ ] 事件存储完整
- [ ] 支持离线补发

---

## 七、Phase 6: 集成与测试（Week 7-8）

### 目标
端到端测试，确保质量达标。

### 任务清单

#### 任务 6.1: E2E 测试
```typescript
// tests/e2e/export-flow.test.ts
describe('导出流程', () => {
  it('AI 生成 → Axure 导出', async () => {
    // 1. 输入需求
    await page.fill('[data-testid="prompt-input"]', '创建一个登录页面');
    
    // 2. AI 生成
    await page.click('[data-testid="generate-button"]');
    await page.waitForSelector('[data-testid="canvas"]');
    
    // 3. 导出 Axure
    await page.click('[data-testid="export-axure"]');
    
    // 4. 验证导出成功
    await page.waitForSelector('[data-testid="export-success"]');
  });
  
  it('AI 生成 → HTML 导出', async () => {
    // ... 类似流程
  });
  
  it('AI 生成 → 图片导出', async () => {
    // ... 类似流程
  });
});
```

**验收标准**：
- [ ] 全部 E2E 测试通过
- [ ] 覆盖核心用户路径

#### 任务 6.2: Axure 导入测试
```typescript
// tests/axure/import.test.ts
describe('Axure 导入', () => {
  it('基础组件可编辑', async () => {
    // 验证 L1 可编辑性
    const axureDoc = await importAxureFile('test-fixtures/basic-components.axure');
    
    expect(axureDoc.widgets.rectangle.editable).toBe(true);
    expect(axureDoc.widgets.text.editable).toBe(true);
    expect(axureDoc.widgets.button.editable).toBe(true);
  });
  
  it('高级组件降级', async () => {
    // 验证 L3 占位可编辑
    const axureDoc = await importAxureFile('test-fixtures/advanced-components.axure');
    
    expect(axureDoc.widgets.chart.editability).toBe('L3');
    expect(axureDoc.widgets.map.editability).toBe('L3');
  });
});
```

**验收标准**：
- [ ] 基础组件 L1 可编辑
- [ ] 高级组件 L3 占位可编辑

---

## 八、风险与对策

| 风险 | 概率 | 影响 | 对策 | 负责人 |
|------|------|------|------|--------|
| 上游同步冲突 | 中 | 高 | CI 自动检测，人工介入 | BE |
| Axure Bridge 不可用 | 中 | 高 | 降级策略：复制剪贴板 | BE |
| CSS 映射不完整 | 高 | 中 | 降级策略：占位矩形 | FE |
| 高级组件导出失败 | 高 | 低 | 尽力而为，失败降级 | FE |
| 性能不达标 | 中 | 中 | 优化渲染，分批导出 | FE |
| 容量超限 | 低 | 中 | 提前预警，引导拆分 | FE |

---

## 九、依赖与资源

| 依赖 | 版本 | 用途 | 安装命令 |
|------|------|------|---------|
| patch-package | ^8.0.0 | 上游补丁管理 | `npm install -D patch-package` |
| snapdom | ^1.0.0 | 图片导出 | `npm install snapdom` |
| zustand | ^4.0.0 | 状态管理（预留） | `npm install zustand` |
| immer | ^10.0.0 | 不可变数据（预留） | `npm install immer` |

---

## 十、遗留问题登记（第 3 轮 Review）

| # | 问题 | 优先级 | 处理计划 | 阶段 |
|---|------|--------|---------|------|
| 1 | CSS 伪类 → Axure 交互样式映射 | 高 | ✅ 已修复 | Phase 3 |
| 2 | 容量上限定义 | 高 | ✅ 已修复 | Phase 6 |
| 3 | AI 异常输入三场景 | 高 | ✅ 已修复 | Phase 6 |
| 4 | 回滚策略 | 高 | ✅ 已修复 | Phase 1 |
| 5 | 上游 API 变更检测 | 中 | ✅ 已修复 | Phase 1 |
| 6 | Axure 回归测试自动化 | 中 | 登记到 Phase 6 | Phase 6 |
| 7 | E2E 测试环境分层 | 中 | 登记到 Phase 6 | Phase 6 |
| 8 | L2 级"格式刷"判定主观 | 低 | 登记到 Phase 6 | Phase 6 |
| 9 | 跨浏览器"布局 ≤1px"不可达 | 低 | 登记到 Phase 6 | Phase 6 |
| 10 | 埋点定义双源重复 | 低 | 登记到 Phase 5 | Phase 5 |

---

## 十一、下一步行动

1. **立即开始**：Phase 1 开发（Week 1）
2. **并行进行**：设计 Token 定义（Week 2 前置）
3. **每周检查**：上游同步状态
4. **里程碑评审**：每周末检查进度

---

*本文档为 Phase 2 最终实施计划，基于 3 轮 Review 结果制定。*
