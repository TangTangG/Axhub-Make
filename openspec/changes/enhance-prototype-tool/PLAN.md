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

### 任务 1.6: 同步 tag 与回滚机制

**目标**：确保上游同步失败时可快速回滚。

**实现**：
```bash
# scripts/sync-upstream.sh（补充）
# 成功同步后自动打 tag
git tag upstream-sync-$(date +%Y%m%d)

# CI 失败时输出回滚命令
echo "回滚命令: git reset --hard $(git describe --tags --abbrev=0)"
```

**验收标准**：
- [ ] 每次成功同步自动打 tag
- [ ] CI 失败时输出回滚命令
- [ ] 回滚操作文档化

### 任务 1.7: UPSTREAM_API_LOCK.md

**目标**：锁定上游 API 符号，检测意外变更。

**实现**：
```markdown
# UPSTREAM_API_LOCK.md
# 记录上游 axhub-export-core 的公共导出符号

## 导出函数
- htmlToAxure(html: string, options: ExportOptions): AxureDocument
- parseComponentTree(tree: ComponentTree): AxureWidget[]

## 类型定义
- ExportOptions
- AxureDocument
- AxureWidget
```

**验收标准**：
- [ ] 初始化符号清单
- [ ] CI 检测符号漂移
- [ ] 变更时自动报警

---

## 三、Phase 2: 设计 Token 与组件系统（Week 2）

### 目标
建立统一的设计语言，实现 6 个基础组件。

### 任务清单
### 任务 2.1: 设计 Token

> **注意**：本任务不直接定义 Token JSON，而是从 DESIGN_SPEC.md §1 自动生成。

**生成脚本**：
```bash
# scripts/generate-tokens.ts
# 从 DESIGN_SPEC.md 解析 Token 表格，生成 design-tokens.json
npm run generate:tokens
```

**输出**：`src/enhanced/tokens/design-tokens.json`（与 DESIGN_SPEC.md §1 完全一致）

**验收标准**：
- [ ] `design-tokens.json` 与 DESIGN_SPEC.md §1 diff 为空
- [ ] 包含全部 5 维度：color/typography/spacing/radius/shadow
- [ ] 支持 JSON 导入导出
### 任务 2.2: 组件接口

> **注意**：本接口以 design.md §2 为唯一蓝本，任何修改需同步更新 design.md。

```typescript
// src/enhanced/components/types.ts

/**
 * 组件可编辑性分级（L1-L4）
 * 定义见 DESIGN_SPEC.md §X（待补充）
 */
type EditabilityLevel = 'L1' | 'L2' | 'L3' | 'L4';

/**
 * 组件定义接口
 * 与 design.md §2 完全一致
 */
interface ComponentDefinition {
  /** 组件类型标识（如 proto-button） */
  type: string;
  
  /** 组件名称（如"按钮"） */
  name: string;
  
  /** 组件分类 */
  category: 'basic' | 'form' | 'layout' | 'advanced';
  
  /** 组件图标（属性面板显示） */
  icon: string;
  
  /** 默认属性值 */
  defaultProps: Record<string, any>;
  
  /** 组件 schema 版本 */
  version: string;
  
  /** Axure 映射配置 */
  axureMapping: {
    /** Axure Widget 类型 */
    widgetType: string;
    
    /** 属性映射表 */
    propertyMap: Record<string, string>;
    
    /** 降级策略 */
    fallback: {
      type: 'none' | 'placeholder' | 'image' | 'text';
      placeholderText?: string;
      preserveSize?: boolean;
    };
  };
  
  /** 可编辑性分级 */
  editability: EditabilityLevel;
  
  /** 组件状态集 */
  states: ComponentState[];
  
  /** 属性 Schema */
  props: PropSchema[];
  
  /** 预览支持 */
  previewSupport: ('iframe' | 'html' | 'image')[];
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
- [ ] 接口与 design.md §2 完全一致
- [ ] 包含 `icon`/`defaultProps`/`version` 字段
- [ ] `axureMapping` 为嵌套对象
- [ ] `editability` 分级在 DESIGN_SPEC.md 中有明确定义

#### 任务 2.3: 基础组件实现

| 组件 | 文件 | 状态 | 状态集（引用 COMPONENT_MATRIX） |
|------|------|------|------------------------------|
| 矩形 | `src/enhanced/components/basic/Rectangle.tsx` | 待实现 | default / hover / active / disabled |
| 文本 | `src/enhanced/components/basic/Text.tsx` | 待实现 | default / hover / disabled |
| 按钮 | `src/enhanced/components/basic/Button.tsx` | 待实现 | default / hover / active / focus / disabled / loading |
| 输入框 | `src/enhanced/components/basic/Input.tsx` | 待实现 | default / hover / focus / disabled / error / placeholder |
| 图片 | `src/enhanced/components/basic/Image.tsx` | 待实现 | default / loading / error |
| 链接 | `src/enhanced/components/basic/Link.tsx` | 待实现 | default / hover / active / visited |

**验收标准**：
- [ ] 每组件实现 COMPONENT_MATRIX 定义的完整状态集
- [ ] 组件样式必须引用 Token（无 hex 色值硬编码）
- [ ] 按钮/输入框/链接满足 WCAG AA 对比度 + 键盘可达
- [ ] 每个状态有 Storybook story

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

### 任务 3.4: AI 输出校验器

**目标**：确保 AI 生成的组件树符合规范，异常时优雅降级。

**实现**：
```typescript
// src/enhanced/ai/validator.ts
function validateAIOutput(output: unknown): ComponentTree {
  // 1. 非法 JSON 拒绝
  if (!isValidJSON(output)) {
    throw new AIValidationError('AI 响应格式错误，请重试');
  }
  
  // 2. 未知组件降级
  const tree = parseComponentTree(output);
  tree.walk(node => {
    if (!isKnownComponent(node.type)) {
      node.type = 'proto-rectangle'; // 降级为占位矩形
      node.props.placeholder = `未知组件: ${node.type}`;
    }
  });
  
  // 3. 循环嵌套截断
  const maxDepth = 8;
  tree.walk((node, depth) => {
    if (depth > maxDepth) {
      node.children = [];
      console.warn(`循环嵌套截断: 深度超过 ${maxDepth}`);
    }
  });
  
  return tree;
}
```

**验收标准**：
- [ ] 非法 JSON 抛出用户友好错误
- [ ] 未知组件降级为占位矩形
- [ ] 循环嵌套截断并警告
- [ ] 对应 TEST_SPEC.md §6.1

### 任务 3.4: 上游导出机制 Spike（Phase 3 前置）

**目标**：在 Phase 3 开发前，验证上游 `axhub-export-core` 的导出机制，避免理解偏差导致返工。

**时间**：1-2 天（Week 3 开始前）

**任务清单**：
1. 阅读 `vendor/axhub-export-core/dist/` 编译产物
2. 分析 `htmlToAxure` 函数的输入/输出/扩展点
3. 验证与 design.md 组件树结构的兼容性
4. 输出《上游导出机制分析报告》

**报告内容**：
- 输入格式：HTML 字符串 vs 组件树
- 输出格式：Axure JSON 结构
- 扩展点：如何注入自定义组件映射
- 限制：不支持的 CSS 属性/组件类型
- 建议：如何封装适配层

**验收标准**：
- [ ] 报告输出到 `docs/analysis/upstream-export-core.md`
- [ ] 明确扩展点，支持自定义组件映射
- [ ] 识别潜在风险（如不支持伪类映射）

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

### 任务 4.3: 容量上限守卫

**目标**：防止超出系统容量上限，提前预警并引导用户。

**实现**：
```typescript
// src/enhanced/guards/capacity-guard.ts
const CAPACITY_LIMITS = {
  maxComponents: 500,
  maxNestingDepth: 8,
  maxTableRows: 1000,
  maxTableColumns: 50,
  maxPages: 20,
  maxHtmlSize: 5 * 1024 * 1024, // 5MB
  maxPayloadSize: 10 * 1024 * 1024, // 10MB
  maxImageSize: 2 * 1024 * 1024, // 2MB
};

function checkCapacity(componentTree: ComponentTree): CapacityWarning[] {
  const warnings: CapacityWarning[] = [];
  
  // 组件数量
  if (componentTree.count > CAPACITY_LIMITS.maxComponents) {
    warnings.push({
      type: 'component_count',
      message: `组件数量 ${componentTree.count} 超过上限 ${CAPACITY_LIMITS.maxComponents}，建议拆分为多个页面`,
      severity: 'warning',
    });
  }
  
  // 嵌套深度
  const maxDepth = componentTree.getMaxDepth();
  if (maxDepth > CAPACITY_LIMITS.maxNestingDepth) {
    warnings.push({
      type: 'nesting_depth',
      message: `嵌套深度 ${maxDepth} 超过上限 ${CAPACITY_LIMITS.maxNestingDepth}，建议扁平化结构`,
      severity: 'warning',
    });
  }
  
  // 表格行数（检测表格组件）
  componentTree.walk(node => {
    if (node.type === 'proto-table' && node.props.rows > CAPACITY_LIMITS.maxTableRows) {
      warnings.push({
        type: 'table_rows',
        message: `表格行数 ${node.props.rows} 超过上限 ${CAPACITY_LIMITS.maxTableRows}，已启用虚拟滚动`,
        severity: 'info',
      });
      node.props.virtualScroll = true;
    }
  });
  
  return warnings;
}
```

**验收标准**：
- [ ] 500 组件提示拆分
- [ ] 8 层嵌套提示扁平化
- [ ] 表格 1000 行启用虚拟滚动
- [ ] 图片 >2MB 自动压缩
- [ ] 对应 TEST_SPEC.md §4.2

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
### 任务 6.1: E2E 测试（环境分层）

**环境分层策略**：
- **CI 层**：使用 `msw` mock Bridge 端点，断言请求体结构
- **本地层**：连接真实 Axure Bridge，每周回归

**CI 层（GitHub Actions）**：
```typescript
// tests/e2e/export-flow.ci.test.ts
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const mockBridge = setupServer(
  rest.post('http://localhost:32767/copyaxvg', (req, res, ctx) => {
    return res(ctx.json({ success: true }));
  }),
  rest.get('http://localhost:32767/available', (req, res, ctx) => {
    return res(ctx.json({ available: true, maxPayloadSize: 10485760 }));
  })
);

beforeAll(() => mockBridge.listen());
afterAll(() => mockBridge.close());

describe('导出流程（CI Mock）', () => {
  it('AI 生成 → Axure 导出', async () => {
    await page.fill('[data-testid="prompt-input"]', '创建一个登录页面');
    await page.click('[data-testid="generate-button"]');
    await page.waitForSelector('[data-testid="canvas"]');
    
    await page.click('[data-testid="export-axure"]');
    
    // 断言请求体结构（而非真实 Axure 响应）
    const request = await page.waitForRequest('**/copyaxvg');
    const payload = request.postDataJSON();
    expect(payload.widgets[0].type).toBe('rectangle');
    expect(payload.widgets[0].style.fill).toBe('#0066cc');
    
    await page.waitForSelector('[data-testid="export-success"]');
  });
});
```

**本地层（真实 Axure）**：
```typescript
// tests/e2e/export-flow.local.test.ts
describe('导出流程（本地真实 Axure）', () => {
  it('AI 生成 → Axure 导出 → 真实导入验证', async () => {
    // 需要本地运行 Axure RP 10 + Bridge
    await page.fill('[data-testid="prompt-input"]', '创建一个登录页面');
    await page.click('[data-testid="generate-button"]');
    await page.waitForSelector('[data-testid="canvas"]');
    
    await page.click('[data-testid="export-axure"]');
    await page.waitForSelector('[data-testid="export-success"]');
    
    // 人工验证：在 Axure RP 中打开导出的文件
    console.log('请人工验证 Axure 导入结果');
  });
});
```

**package.json scripts**：
```json
{
  "scripts": {
    "test:e2e": "playwright test tests/e2e/*.ci.test.ts",
    "test:e2e:local": "playwright test tests/e2e/*.local.test.ts",
    "test:e2e:real-bridge": "npm run test:e2e:local"
  }
}
```

**验收标准**：
- [ ] CI 使用 mock，不依赖真实 Axure
- [ ] 本地脚本可连接真实 Bridge
- [ ] 每周本地回归记录到 `docs/qa/weekly-axure-check.md`

### 任务 6.2: Axure 导入测试（拆分为两层）

**自动化层（CI 可跑）**：
```typescript
// tests/axure/export-snapshot.test.ts
describe('Axure 导出快照测试', () => {
  it('基础组件导出结构正确', async () => {
    const componentTree = createTestComponentTree();
    const axureDoc = await exportToAxure(componentTree);
    
    // 快照测试：验证导出 JSON 结构
    expect(axureDoc).toMatchSnapshot({
      pages: [{
        widgets: expect.arrayContaining([
          expect.objectContaining({ type: 'rectangle' }),
          expect.objectContaining({ type: 'text' }),
          expect.objectContaining({ type: 'button' }),
        ]),
      }],
    });
  });
  
  it('CSS 属性映射正确', async () => {
    const componentTree = createComponentWithStyles({
      fill: '#0066cc',
      fontSize: '16px',
      borderRadius: '4px',
    });
    const axureDoc = await exportToAxure(componentTree);
    
    const widget = axureDoc.pages[0].widgets[0];
    expect(widget.style.fill).toBe('#0066cc');
    expect(widget.style.fontSize).toBe('16px');
    expect(widget.style.cornerRadius).toBe('4px');
  });
});
```

**人工验收层（每周一次）**：
```markdown
# Axure 可编辑性验收 Checklist
# 测试环境：Axure RP 10 + Bridge
# 日期：_______

## 基础组件
- [ ] 矩形：双击可修改尺寸/颜色/圆角
- [ ] 文本：双击可修改内容/字体/颜色
- [ ] 按钮：双击可修改文本/颜色/状态
- [ ] 输入框：双击可修改占位符/类型
- [ ] 图片：双击可替换图片
- [ ] 链接：双击可修改文本/链接

## 表单组件
- [ ] 下拉：双击可修改选项
- [ ] 单选：双击可修改选项/选中态
- [ ] 复选：双击可修改选项/选中态
- [ ] 表格：双击可修改行列/内容
- [ ] 开关：双击可修改状态

## 布局组件
- [ ] 导航：双击可修改菜单项
- [ ] 标签页：双击可修改标签
- [ ] 卡片：双击可修改内容

## 高级组件（降级验证）
- [ ] 图表：显示为图片占位
- [ ] 地图：显示为图片占位
- [ ] 富文本：降级为纯文本可编辑
- [ ] 视频：显示为图片占位
```

**验收标准**：
- [ ] 自动化快照测试 100% 通过
- [ ] 人工 checklist 15/15 通过
- [ ] 对应 TEST_SPEC.md §1.2
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

## 十、遗留问题登记（第 3 轮 Review + Phase 2 Review）

| # | 问题 | 优先级 | 处理计划 | 阶段 | 实施任务编号 |
|---|------|--------|---------|------|-------------|
| 1 | CSS 伪类 → Axure 交互样式映射 | 高 | ✅ 已修复 | Phase 3 | 任务 3.1 |
| 2 | 容量上限定义 | 高 | ✅ 已修复 | Phase 4 | 任务 4.3 |
| 3 | AI 异常输入三场景 | 高 | ✅ 已修复 | Phase 3 | 任务 3.4 |
| 4 | 回滚策略 | 高 | ✅ 已修复 | Phase 1 | 任务 1.6 |
| 5 | 上游 API 变更检测 | 高 | ✅ 已修复 | Phase 1 | 任务 1.7 |
| 6 | Axure 回归测试自动化 | 中 | 登记到 Phase 6 | Phase 6 | 任务 6.2 |
| 7 | E2E 测试环境分层 | 中 | 登记到 Phase 6 | Phase 6 | 任务 6.1 |
| 8 | L2 级"格式刷"判定主观 | 低 | 登记到 Phase 6 | Phase 6 | 任务 6.3 |
| 9 | 跨浏览器"布局 ≤1px"不可达 | 低 | 登记到 Phase 6 | Phase 6 | 任务 6.3 |
| 10 | 埋点定义双源重复 | 低 | 登记到 Phase 5 | Phase 5 | 任务 5.1 |
| 11 | "复杂表格"判定量化 | 中 | 登记到 Phase 3 | Phase 3 | 任务 3.2 |
| 12 | inline_frame URL 来源 | 中 | 登记到 Phase 3 | Phase 3 | 任务 3.2 |
| 13 | prompt_text 脱敏规则 | 低 | 登记到 Phase 5 | Phase 5 | 任务 5.1 |
| 14 | "活跃"定义未明确 | 低 | 登记到 Phase 5 | Phase 5 | 任务 5.1 |

---

## 十一、下一步行动

1. **立即开始**：Phase 1 开发（Week 1）
2. **并行进行**：设计 Token 定义（Week 2 前置）
3. **每周检查**：上游同步状态
4. **里程碑评审**：每周末检查进度

---

*本文档为 Phase 2 最终实施计划，基于 3 轮 Review 结果制定。*
