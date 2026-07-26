# src/integration - 集成层

> 本目录是上游 Axhub-Make 与自研代码 `src/enhanced/` 之间的桥梁。

## 设计原则

1. **单向依赖**：`src/enhanced/` 只依赖 `src/integration/`，不直接依赖上游
2. **接口抽象**：将上游内部实现抽象为稳定接口
3. **版本适配**：上游更新时，只需修改本层，不影响 `src/enhanced/`

## 目录结构

```
src/integration/
├── bridge/         # Axure Bridge 代理（对接上游 Bridge）
├── adapter/        # 上游接口适配器
├── types/          # 共享类型定义
└── index.ts        # 统一导出
```

## 核心模块

### bridge/
- 封装上游 `src/server/managementApi.bridge.ts`
- 提供稳定的 Axure Bridge 调用接口
- 处理连接、错误、重试

### adapter/
- 适配上游数据格式为自研格式
- 组件树转换、样式映射

### types/
- 与 `src/enhanced/` 共享的类型定义
- 确保接口一致性

## 开发状态

| 模块 | 状态 | 说明 |
|------|------|------|
| bridge/ | 待开发 | Week 3 |
| adapter/ | 待开发 | Week 3 |
| types/ | 待开发 | Week 2 |

---

*本目录代码不会提交到上游 Axhub-Make*
