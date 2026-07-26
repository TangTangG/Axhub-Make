# axhub-proto-enhanced

> Axhub 原型增强系统 - 组件化导出与多模式预览

## 功能特性

### 组件系统
- 组件可编辑性分级（L1-L4）
- 组件分类管理（基础/表单/布局/高级）
- 组件状态定义（default/hover/active/focus/disabled/loading/error）
- 属性 Schema 驱动属性面板
- Axure 映射配置

### Axure 导出增强
- Axure 文档结构完整定义
- Widget 类型与样式映射
- 交互事件支持
- 导出管道与组件映射

### 多模式预览
- iframe 实时预览
- HTML 独立文件导出
- 图片导出（PNG/SVG，支持 1x/2x/3x DPI）
- 预览管理器与编辑同步

### 数据埋点
- 激活漏斗追踪
- 导出行为分析
- 预览行为分析
- 组件使用统计
- 错误监控

## 快速开始

```typescript
import { ComponentRegistry, ExportPipeline, PreviewManager } from './enhanced';

// 注册组件
const registry = new ComponentRegistry();
registry.register({
  type: 'proto-button',
  name: '按钮',
  category: 'basic',
  icon: 'square',
  defaultProps: { text: '按钮' },
  version: '1.0.0',
  axureMapping: { widgetType: 'button', propertyMap: {}, fallback: { type: 'none' } },
  editability: 'L1',
  states: [],
  props: [],
  previewSupport: ['iframe', 'html', 'image'],
});

// 导出
const pipeline = new ExportPipeline();
const result = await pipeline.export(componentTree, { format: 'axure' });

// 预览
const preview = new PreviewManager({ initialMode: 'iframe' });
preview.render(componentTree);
```

## 文档

- [组件系统文档](./components/README.md)
- [导出系统文档](./export/README.md)
- [预览系统文档](./preview/README.md)
- [数据埋点文档](./analytics/README.md)

## 版本

当前版本：1.0.0

## 设计原则

1. **完全隔离**：不 import 上游任何内部模块
2. **通过 integration 层交互**：所有与上游的交互都通过 `src/integration/`
3. **独立可测试**：每个模块可独立测试，不依赖上游环境
