# 增强原型工具 - 本地开发代码

本目录存放基于 Axhub-Make fork 的本地增强代码，与上游代码隔离。

## 目录结构

```
src/enhanced/
├── canvas-editor/      # 手动编辑画布
├── components/         # 扩展组件库
├── export/             # 增强导出功能
└── preview/            # 多模式预览
```

## 与上游代码的关系

- **上游代码**：`src/index/`、`src/server/` 等目录（定期 merge）
- **本地增强**：`src/enhanced/` 目录（独立开发）
- **共享代码**：`src/common/` 目录（谨慎修改，优先扩展而非修改）

## 开发原则

1. **最小修改原则**：尽量不修改上游代码，通过扩展实现功能
2. **接口隔离**：本地代码通过定义清晰的接口与上游交互
3. **定期同步**：每周运行 `scripts/sync-upstream.sh` 同步上游更新
