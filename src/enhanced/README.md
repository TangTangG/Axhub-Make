# src/enhanced - 自研代码目录

> 本目录包含 axhub-proto-enhanced 的全部自研代码，与上游 Axhub-Make 完全隔离。

## 目录结构

```
src/enhanced/
├── components/     # 组件系统（基础/表单/布局/高级组件）
├── export/         # 导出引擎（Axure/HTML/图片导出）
├── preview/        # 预览系统（iframe/HTML/图片预览）
├── tokens/         # 设计 Token（颜色/字体/间距/圆角/阴影）
├── bridge/         # Axure Bridge 代理封装
├── analytics/      # 数据埋点
└── canvas-editor/  # 画布编辑器（v1.1 预留）
```

## 设计原则

1. **完全隔离**：不 import 上游任何内部模块
2. **通过 integration 层交互**：所有与上游的交互都通过 `src/integration/`
3. **独立可测试**：每个模块可独立测试，不依赖上游环境

## 开发状态

| 模块 | 状态 | 说明 |
|------|------|------|
| components/ | 待开发 | Week 2 |
| export/ | 待开发 | Week 3-5 |
| preview/ | 待开发 | Week 6 |
| tokens/ | 待开发 | Week 2 |
| bridge/ | 待开发 | Week 3 |
| analytics/ | 待开发 | Week 7 |
| canvas-editor/ | 预留 | v1.1 |

---

*本目录代码不会提交到上游 Axhub-Make*
