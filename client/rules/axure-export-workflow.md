# Axure 导出修复规则

用于“导出到 Axure”前的代码检查失败场景，处理规范问题、补齐 `@mode axure`，并让目标文件通过当前检测链路。

## 适用场景

- 用户在导出到 Axure 前触发 code-review 失败。
- 需要快速修复当前导出检测错误。
- 需要补齐 Axure 模式头注释。

## 目标

1. 优先修复 `error`，再评估 `warning`。
2. 不改变现有业务功能、交互和视觉表现。
3. 让目标文件通过当前导出前检查。

## 固定流程

### 1. 锁定修改范围

- 只修改报错目标文件，通常是 `src/prototypes/<name>/index.tsx`。
- 不主动重构无关代码。
- 不处理 Figma 等第三方导出链路。

### 2. 按优先级修复检查项

- `error` 必须修复。
- `warning` 尽量修复；无法安全修复时在交付说明中说明。
- 每项改动都保持原有行为一致。

### 3. 补齐头部注释

用于 Axure 导出的文件头建议包含：

- `@name`
- `@mode axure`
- `rules/axure-export-workflow.md`
- `rules/prototype-development-guide.md`
- `rules/axure-api-guide.md`（需要 Axure API 时）

模板：

```typescript
/**
 * @name 组件或页面名称
 * @mode axure
 *
 * 参考资料：
 * - /rules/axure-export-workflow.md
 * - /rules/prototype-development-guide.md
 * - /rules/axure-api-guide.md
 */
```

导出组件名必须满足当前检测要求；Axure 导出模式下默认使用 `Component` 并 `export default Component`。

### 4. Axure API 处理策略

- Axure API 是可选项。
- 不为了“通过导出检测”强行引入 `forwardRef<AxureHandle, AxureProps>`。
- 只有明确需要配置面板、外部数据源、事件回调或动作触发时，才按 `rules/axure-api-guide.md` 集成。

### 5. 标注数据随 Runtime 构建

- 如果页面使用 `@axhub/annotation` 的 `AnnotationViewer`，必须在当前导出入口文件里静态导入本地标注源，例如 `import annotationSourceDocument from './annotation-source.json'`。
- `AnnotationViewer` 的 `source` 必须直接使用该本地 JSON 导入，确保 on-demand Axure bundle 会把标注数据一起打进 Runtime 组件代码。
- 不要依赖运行后再请求 `annotation-source.json`，也不要只把标注源放在目录或外部文档里。
- Axure Runtime 组件运行后，对外读取入口是 `window.__AXHUB_ANNOTATION_SOURCE__`；该快照包含 `directory` 和已合并 Markdown 正文的 `nodes`，不是原始 `markdownMap`。

推荐写法：

```typescript
import {
  AnnotationViewer,
  type AnnotationSourceDocument,
} from '@axhub/annotation';
import annotationSourceDocument from './annotation-source.json';

// ...
<AnnotationViewer
  source={annotationSourceDocument as unknown as AnnotationSourceDocument}
/>
```

### 6. 交付前自检

- 全部阻断错误已修复。
- warning 已评估并尽量处理。
- 文件头包含 `@mode axure` 和相关 rules 路径。
- 默认导出符合当前导出检查逻辑。
- 如果使用 `AnnotationViewer`，当前文件已静态导入并传入 `annotation-source.json`。

## 非目标

- 不扩展到 Figma 或其他导出链路。
- 不修改构建插件和检查规则策略。
- 不进行大规模样式重写或架构重构。
