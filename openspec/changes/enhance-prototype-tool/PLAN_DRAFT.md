# 实施计划：增强原型工具

> 版本：v1.0 草案
> 日期：2026-07-26
> 状态：待 Review 通过后细化

---

## 一、项目里程碑

| 里程碑 | 目标 | 时间 | 交付物 |
|--------|------|------|--------|
| M1 | 项目初始化 + 上游同步机制 | Week 1 | 可构建的 fork 仓库 + CI 同步 |
| M2 | 设计 Token + 基础组件库 | Week 2 | tokens.json + 6 个基础组件 |
| M3 | Axure 导出增强（基础组件） | Week 3 | 矩形/文本/按钮/输入框可导出 |
| M4 | 表单组件 + Axure 导出 | Week 4 | 下拉/单选/复选/表格可导出 |
| M5 | 布局组件 + Axure 导出 | Week 5 | 导航/标签页/卡片可导出 |
| M6 | 多模式预览（HTML/图片导出） | Week 6 | HTML 导出 + 图片导出 |
| M7 | 数据埋点 + 集成测试 | Week 7 | 埋点 SDK + E2E 测试 |
| M8 | v1.0.0 发布 | Week 8 | 发布包 + 文档 |

---

## 二、Phase 1: 项目初始化与上游同步（Week 1）

### 任务 1.1: Fork 与目录结构

```bash
# 1. Fork 仓库
git clone https://github.com/YOUR_USERNAME/axhub-proto-enhanced.git
cd axhub-proto-enhanced

# 2. 添加上游远程
git remote add upstream https://github.com/lintendo/Axhub-Make.git

# 3. 创建目录结构
mkdir -p upstream patches src/enhanced/{components,export,preview,tokens,bridge} src/integration scripts .github/workflows
```

### 任务 1.2: git subtree 初始化

```bash
# 将上游代码作为 subtree 引入
git subtree add --prefix=upstream https://github.com/lintendo/Axhub-Make.git main --squash

# 验证
ls upstream/client/src
ls upstream/src/server
```

### 任务 1.3: patch-package 配置

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

### 任务 1.4: 上游同步脚本

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

### 任务 1.5: CI 工作流

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

---

## 三、Phase 2: 设计 Token 与组件系统（Week 2）

### 任务 2.1: 设计 Token

```json
// src/enhanced/tokens/design-tokens.json
{
  "color": { ... },
  "typography": { ... },
  "spacing": { ... },
  "radius": { ... },
  "shadow": { ... }
}
```

### 任务 2.2: 组件接口

```typescript
// src/enhanced/components/types.ts
interface ComponentDefinition {
  type: string;
  name: string;
  category: 'basic' | 'form' | 'layout' | 'advanced';
  // ...
}
```

### 任务 2.3: 基础组件实现

| 组件 | 文件 | 状态 |
|------|------|------|
| 矩形 | `src/enhanced/components/basic/Rectangle.tsx` | 待实现 |
| 文本 | `src/enhanced/components/basic/Text.tsx` | 待实现 |
| 按钮 | `src/enhanced/components/basic/Button.tsx` | 待实现 |
| 输入框 | `src/enhanced/components/basic/Input.tsx` | 待实现 |
| 图片 | `src/enhanced/components/basic/Image.tsx` | 待实现 |
| 链接 | `src/enhanced/components/basic/Link.tsx` | 待实现 |

---

## 四、Phase 3: Axure 导出增强（Week 3-5）

### 任务 3.1: CSS → Axure 映射

```typescript
// src/enhanced/export/axure-mapper.ts
const CSS_TO_AXURE_MAP: Record<string, AxurePropertyMapping> = {
  'width': { target: 'size.width', transform: parsePixelValue },
  'height': { target: 'size.height', transform: parsePixelValue },
  // ...
};
```

### 任务 3.2: 组件 → Axure Widget 映射

```typescript
// src/enhanced/export/component-mapper.ts
const COMPONENT_TO_AXURE_WIDGET: Record<string, AxureWidgetMapping> = {
  'proto-button': { widgetType: 'button', editable: true },
  'proto-input': { widgetType: 'text_field', editable: true },
  // ...
};
```

### 任务 3.3: 导出管道

```typescript
// src/enhanced/export/export-pipeline.ts
async function exportToAxure(componentTree: ComponentTree): Promise<AxureDocument> {
  // 1. 遍历组件树
  // 2. 转换每个节点为 Axure Widget
  // 3. 处理降级策略
  // 4. 生成 Axure JSON
}
```

---

## 五、Phase 4: 多模式预览（Week 6）

### 任务 4.1: HTML 导出

```typescript
// src/enhanced/export/html-exporter.ts
async function exportHtml(componentTree: ComponentTree, options: HtmlExportOptions): Promise<Blob> {
  // 1. 渲染为静态 HTML
  // 2. 内联资源（≤5MB）
  // 3. 注入交互脚本
}
```

### 任务 4.2: 图片导出

```typescript
// src/enhanced/export/image-exporter.ts
async function exportImage(componentTree: ComponentTree, options: ImageExportOptions): Promise<Blob> {
  // 使用 snapdom 或 html-to-image
}
```

---

## 六、Phase 5: 数据埋点（Week 7）

### 任务 5.1: 埋点 SDK

```typescript
// src/enhanced/analytics/tracker.ts
class AnalyticsTracker {
  track(event: string, properties?: Record<string, any>): void {
    // ...
  }
}
```

### 任务 5.2: 服务端接收

```typescript
// src/server/routes/analytics.ts
export async function handleTrackEvents(req: Request, res: Response) {
  // ...
}
```

---

## 七、Phase 6: 集成与测试（Week 7-8）

### 任务 6.1: E2E 测试

```typescript
// tests/e2e/export-flow.test.ts
describe('导出流程', () => {
  it('AI 生成 → Axure 导出', async () => {
    // ...
  });
  
  it('AI 生成 → HTML 导出', async () => {
    // ...
  });
});
```

### 任务 6.2: Axure 导入测试

```typescript
// tests/axure/import.test.ts
describe('Axure 导入', () => {
  it('基础组件可编辑', async () => {
    // 验证 L1 可编辑性
  });
});
```

---

## 八、风险与对策

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| 上游同步冲突 | 中 | 高 | CI 自动检测，人工介入 |
| Axure Bridge 不可用 | 中 | 高 | 降级策略：复制剪贴板 |
| CSS 映射不完整 | 高 | 中 | 降级策略：占位矩形 |
| 高级组件导出失败 | 高 | 低 | 尽力而为，失败降级 |
| 性能不达标 | 中 | 中 | 优化渲染，分批导出 |

---

## 九、依赖与资源

| 依赖 | 版本 | 用途 |
|------|------|------|
| patch-package | ^8.0.0 | 上游补丁管理 |
| snapdom | ^1.0.0 | 图片导出 |
| zustand | ^4.0.0 | 状态管理（预留） |
| immer | ^10.0.0 | 不可变数据（预留） |

---

## 十、下一步

1. 等待第 2 轮 Review 通过
2. 细化每个任务的技术方案
3. 开始 Phase 1 开发
