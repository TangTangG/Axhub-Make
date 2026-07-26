# 组件矩阵表

> 版本：v1.0
> 日期：2026-07-26
> 说明：组件 × 类别 × Axure 映射 × 状态集 × 属性集 × 预览支持 × 导出降级策略

---

## 基础组件

| 组件 | 类别 | Axure Widget | 状态集 | 属性集 | 预览支持 | 导出降级策略 | 可编辑性 |
|------|------|-------------|--------|--------|---------|-------------|---------|
| 矩形 | basic | rectangle | default/hover/active/disabled | 尺寸/位置/圆角/边框/背景/阴影 | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 文本 | basic | text | default/hover/disabled | 内容/字体/字号/字重/颜色/对齐/行高 | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 按钮 | basic | button | default/hover/active/focus/disabled/loading | 文本/尺寸/类型(primary/secondary/text)/图标/禁用 | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 输入框 | basic | text_field | default/hover/focus/disabled/error/placeholder | 占位文本/值/类型(text/password/number)/禁用/错误 | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 图片 | basic | image | default/loading/error | 源/替代文本/填充模式(fit/fill/stretch)/圆角 | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 链接 | basic | text + interaction | default/hover/active/visited | 文本/URL/目标(_blank/_self)/下划线 | iframe/HTML/图片 | - | ✅ 完全可编辑 |

## 表单组件

| 组件 | 类别 | Axure Widget | 状态集 | 属性集 | 预览支持 | 导出降级策略 | 可编辑性 |
|------|------|-------------|--------|--------|---------|-------------|---------|
| 下拉选择 | form | dropdown | default/hover/focus/disabled/open | 选项列表/选中值/占位文本/可搜索/多选 | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 单选框 | form | radio_button | default/hover/checked/disabled | 选项列表/选中值/排列方向(水平/垂直) | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 复选框 | form | checkbox | default/hover/checked/indeterminate/disabled | 标签/选中状态/半选状态/禁用 | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 表格 | form | table / repeater | default/hover/selected/loading/empty | 列定义/数据源/排序/筛选/分页/固定列/行展开 | iframe/HTML/图片 | 复杂表格→占位矩形+文本"[表格]" | ⚠️ 简单表格可编辑，复杂降级 |
| 开关 | form | dynamic_panel | default/hover/checked/disabled/loading | 标签/选中状态/禁用/加载 | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 滑块 | form | dynamic_panel | default/hover/dragging/disabled | 最小值/最大值/步长/默认值/标签/禁用 | iframe/HTML/图片 | 降级为占位矩形+文本"[滑块]" | ⚠️ 降级后可编辑占位 |
| 日期选择 | form | text_field + panel | default/hover/focus/open/disabled | 格式/默认值/禁用日期/范围选择 | iframe/HTML/图片 | 降级为输入框+文本"[日期选择]" | ⚠️ 降级后可编辑占位 |
| 上传 | form | dynamic_panel | default/hover/dragover/uploading/success/error | 接受类型/多文件/最大大小/提示文本 | iframe/HTML/图片 | 降级为按钮+文本"[上传]" | ⚠️ 降级后可编辑占位 |

## 布局组件

| 组件 | 类别 | Axure Widget | 状态集 | 属性集 | 预览支持 | 导出降级策略 | 可编辑性 |
|------|------|-------------|--------|--------|---------|-------------|---------|
| 导航栏 | layout | group + rectangles | default/sticky | 菜单项/ Logo/搜索框/用户头像/固定顶部 | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 标签页 | layout | dynamic_panel | default/hover/active/disabled | 标签列表/选中标签/位置(top/bottom/left/right) | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 卡片 | layout | group + rectangle | default/hover/selected | 标题/内容/操作区/阴影/圆角/边框 | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 分割线 | layout | line | default | 方向(水平/垂直)/粗细/颜色/样式(实线/虚线) | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 栅格容器 | layout | group | default | 列数/间距/响应式断点 | iframe/HTML/图片 | 降级为绝对定位矩形组 | ⚠️ 降级后可编辑 |
| 模态框 | layout | dynamic_panel | default/open/close | 标题/内容/宽度/遮罩/关闭按钮/动画 | iframe/HTML/图片 | - | ✅ 完全可编辑 |
| 抽屉 | layout | dynamic_panel | default/open/close | 位置(left/right/top/bottom)/宽度/遮罩/动画 | iframe/HTML/图片 | - | ✅ 完全可编辑 |

## 高级组件（尽力而为）

| 组件 | 类别 | Axure Widget | 状态集 | 属性集 | 预览支持 | 导出降级策略 | 可编辑性 |
|------|------|-------------|--------|--------|---------|-------------|---------|
| 图表 | advanced | inline_frame / image | default/loading/error | 类型(柱状/折线/饼图)/数据源/标题/图例/颜色 | iframe/HTML/图片 | 优先 inline_frame，失败降级为图片+文本"[图表]" | ⚠️ inline_frame 不可编辑，图片可替换 |
| 地图 | advanced | inline_frame / image | default/loading/error | 中心点/缩放级别/标记点/类型(街道/卫星) | iframe/HTML/图片 | 优先 inline_frame，失败降级为图片+文本"[地图]" | ⚠️ inline_frame 不可编辑，图片可替换 |
| 富文本 | advanced | text | default/focus/disabled | 内容/字体/字号/颜色/对齐/列表/链接 | iframe/HTML/图片 | 尽力保持格式，失败降级为纯文本 | ⚠️ 格式可能丢失，文本可编辑 |
| 视频 | advanced | inline_frame / image | default/playing/paused/error | 源/封面/自动播放/循环/控制条 | iframe/HTML/图片 | 优先 inline_frame，失败降级为图片+文本"[视频]" | ⚠️ inline_frame 不可编辑，图片可替换 |

---

## 组件状态详细规范

### 按钮 (Button)

| 状态 | 背景色 | 文本色 | 边框 | 其他 |
|------|--------|--------|------|------|
| default | primary | white | none | - |
| hover | primary.hover | white | none | - |
| active | primary.active | white | none | transform: scale(0.98) |
| focus | primary | white | 2px primary | outline none |
| disabled | #cccccc | #999999 | none | cursor: not-allowed |
| loading | primary | white | none | 显示 spinner，禁止点击 |

### 输入框 (Input)

| 状态 | 背景色 | 边框色 | 文本色 | 占位符 |
|------|--------|--------|--------|--------|
| default | white | border.default | text.primary | text.secondary |
| hover | white | border.hover | text.primary | text.secondary |
| focus | white | border.focus | text.primary | text.secondary |
| disabled | #f5f5f5 | #e0e0e0 | text.disabled | text.disabled |
| error | white | border.error | text.primary | text.secondary |
| placeholder | - | - | - | text.secondary |

### 表格 (Table)

| 状态 | 表现 |
|------|------|
| default | 斑马纹，行高 48px |
| hover | 行背景色 #f5f5f5 |
| selected | 行背景色 #e3f2fd |
| loading | 显示骨架屏 |
| empty | 显示空状态插画+文本 |

---

## 导出降级策略汇总

| 降级类型 | 触发条件 | 降级表现 | 用户提示 |
|---------|---------|---------|---------|
| 占位矩形 | 组件无 Axure 对应 widget | 灰色矩形 + 组件名称文本 | 导出日志中记录 |
| 图片替换 | 组件无法保持可编辑 | 导出为图片，可替换 | 导出日志中记录 |
| 纯文本 | 富文本格式丢失 | 保留文本内容，丢失格式 | 导出日志中记录 |
| 绝对定位 | Flex/Grid 布局 | 转换为绝对定位矩形 | 导出日志中记录 |
| 属性忽略 | CSS 属性无映射 | 忽略该属性，使用默认值 | 导出日志中记录警告 |

---

## 组件属性 Schema 示例

```typescript
// 按钮组件属性 Schema
const ButtonPropSchema: PropSchema[] = [
  {
    name: 'text',
    label: '按钮文本',
    type: 'string',
    default: '按钮',
    required: true,
  },
  {
    name: 'type',
    label: '按钮类型',
    type: 'enum',
    options: ['primary', 'secondary', 'text', 'link'],
    default: 'primary',
  },
  {
    name: 'size',
    label: '尺寸',
    type: 'enum',
    options: ['small', 'medium', 'large'],
    default: 'medium',
  },
  {
    name: 'disabled',
    label: '禁用',
    type: 'boolean',
    default: false,
  },
  {
    name: 'loading',
    label: '加载中',
    type: 'boolean',
    default: false,
  },
  {
    name: 'icon',
    label: '图标',
    type: 'icon',
    default: null,
  },
  {
    name: 'onClick',
    label: '点击事件',
    type: 'event',
    default: null,
    axureMapping: 'interaction.onClick',
  },
];
```
