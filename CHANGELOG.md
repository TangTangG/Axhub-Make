# Changelog

## [1.0.0] - 2026-07-27

### 新增

#### 组件系统
- 组件可编辑性分级（L1-L4）
- 组件分类（basic/form/layout/advanced）
- 组件状态管理（default/hover/active/focus/disabled/loading/error）
- 属性 Schema 定义
- Axure 映射配置
- 组件注册表（ComponentRegistry）

#### Axure 导出增强
- Axure 文档结构定义
- Widget 类型与样式映射
- 交互事件支持
- 导出管道（ExportPipeline）
- 组件映射器（ComponentMapper）
- Axure 映射器（AxureMapper）

#### 多模式预览
- iframe 预览模式
- HTML 导出预览
- 图片导出预览（PNG/SVG）
- 预览管理器（PreviewManager）
- 资源收集与内联

#### 数据埋点
- 激活漏斗事件追踪
- 导出行为事件追踪
- 预览行为事件追踪
- 组件使用事件追踪
- 错误与异常事件追踪
- 指标计算与统计

#### 集成层
- Bridge 客户端封装
- 容量守卫（CapacityGuard）

### 已知问题
- canvas-editor 模块为 v1.1 预留，暂未实现
- 高级组件（advanced）分类暂无具体实现

### 升级指南
- 本次为首个正式版本，无需升级
