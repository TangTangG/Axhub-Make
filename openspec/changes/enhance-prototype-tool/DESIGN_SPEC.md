# 设计系统与画布交互规范

> 版本：v1.0
> 日期：2026-07-26
> 状态：已评审

---

## 一、设计 Token 系统

### 1.1 颜色系统

#### 品牌色

| Token | 值 | 用途 |
|-------|-----|------|
| `color.primary` | `#0066cc` | 主要按钮、链接、强调 |
| `color.primary.hover` | `#0071e3` | 主要按钮悬停 |
| `color.primary.active` | `#005bb5` | 主要按钮按下 |
| `color.primary.disabled` | `#cccccc` | 主要按钮禁用 |

#### 文本色

| Token | 值 | 用途 |
|-------|-----|------|
| `color.text.primary` | `#1d1d1f` | 标题、正文 |
| `color.text.secondary` | `#7a7a7a` | 辅助文本、说明 |
| `color.text.disabled` | `#cccccc` | 禁用文本 |
| `color.text.inverse` | `#ffffff` | 反色文本（深色背景） |

#### 背景色

| Token | 值 | 用途 |
|-------|-----|------|
| `color.bg.primary` | `#ffffff` | 主背景 |
| `color.bg.secondary` | `#f5f5f7` | 次要背景、卡片 |
| `color.bg.hover` | `#f0f0f0` | 悬停背景 |
| `color.bg.selected` | `#e3f2fd` | 选中背景 |

#### 边框色

| Token | 值 | 用途 |
|-------|-----|------|
| `color.border.default` | `#e0e0e0` | 默认边框 |
| `color.border.hover` | `#cccccc` | 悬停边框 |
| `color.border.focus` | `#0066cc` | 聚焦边框 |
| `color.border.error` | `#ff3b30` | 错误边框 |

#### 状态色

| Token | 值 | 用途 |
|-------|-----|------|
| `color.state.success` | `#34c759` | 成功状态 |
| `color.state.warning` | `#ff9500` | 警告状态 |
| `color.state.error` | `#ff3b30` | 错误状态 |
| `color.state.info` | `#007aff` | 信息状态 |

### 1.2 字体系统

| Token | 值 | 用途 |
|-------|-----|------|
| `font.family.display` | `SF Pro Display, -apple-system, sans-serif` | 标题 |
| `font.family.body` | `SF Pro Text, -apple-system, sans-serif` | 正文 |
| `font.family.mono` | `ui-monospace, SF Mono, monospace` | 代码 |

#### 字号阶梯

| Token | 值 | 用途 |
|-------|-----|------|
| `font.size.xs` | `12px` | 辅助文本、标签 |
| `font.size.sm` | `14px` | 正文、按钮 |
| `font.size.md` | `16px` | 标题、输入框 |
| `font.size.lg` | `18px` | 大标题 |
| `font.size.xl` | `24px` | 页面标题 |
| `font.size.xxl` | `32px` | 展示标题 |

#### 字重

| Token | 值 | 用途 |
|-------|-----|------|
| `font.weight.regular` | `400` | 正文 |
| `font.weight.medium` | `500` | 强调 |
| `font.weight.semibold` | `600` | 标题 |
| `font.weight.bold` | `700` | 大标题 |

### 1.3 间距系统（4px 网格）

| Token | 值 | 用途 |
|-------|-----|------|
| `spacing.xxs` | `4px` | 最小间距 |
| `spacing.xs` | `8px` | 紧凑间距 |
| `spacing.sm` | `12px` | 小间距 |
| `spacing.md` | `16px` | 默认间距 |
| `spacing.lg` | `24px` | 大间距 |
| `spacing.xl` | `32px` | 超大间距 |
| `spacing.xxl` | `48px` | 章节间距 |
| `spacing.section` | `80px` | 页面章节 |

### 1.4 圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `radius.sm` | `4px` | 小圆角（输入框、小按钮） |
| `radius.md` | `8px` | 默认圆角（卡片、按钮） |
| `radius.lg` | `12px` | 大圆角（模态框） |
| `radius.full` | `9999px` | 全圆角（标签、头像） |

### 1.5 阴影系统

| Token | 值 | 用途 |
|-------|-----|------|
| `shadow.sm` | `0 1px 2px rgba(0,0,0,0.05)` | 轻微阴影 |
| `shadow.md` | `0 4px 6px rgba(0,0,0,0.07)` | 默认阴影 |
| `shadow.lg` | `0 10px 15px rgba(0,0,0,0.1)` | 大阴影（模态框） |
| `shadow.xl` | `0 20px 25px rgba(0,0,0,0.15)` | 超大阴影（抽屉） |

---

## 二、组件状态规范

每个组件必须实现以下状态：

| 状态 | 说明 | 视觉表现 |
|------|------|---------|
| `default` | 默认状态 | 基础样式 |
| `hover` | 鼠标悬停 | 背景色/边框色变化，过渡 200ms |
| `active` | 按下/激活 | 背景色加深，轻微缩放 0.98 |
| `focus` | 键盘聚焦 | 边框高亮（2px primary），outline none |
| `disabled` | 禁用 | 透明度 0.5，cursor not-allowed |
| `loading` | 加载中 | 显示 spinner，禁止交互 |
| `error` | 错误 | 边框/文本变为 error 色，显示错误图标 |

---

## 三、画布交互规范（v1.1 预留）

> v1.0 不包含手动画布，以下为 v1.1 预留规范

### 3.1 选中态

- 单选：蓝色边框 2px + 8 个控制点
- 多选：蓝色边框 1px + 统一控制框
- 悬停预选：蓝色边框 1px，透明度 50%

### 3.2 拖拽

- 拖拽中：组件透明度 0.7，显示 ghost 轮廓
- 吸附阈值：5px 内自动吸附到对齐线
- 智能参考线：对齐时显示红色虚线（间距/居中/边缘）

### 3.3 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Delete` / `Backspace` | 删除选中 |
| `Cmd/Ctrl + D` | 复制选中 |
| `Cmd/Ctrl + G` | 成组 |
| `Cmd/Ctrl + Shift + G` | 解组 |
| `Cmd/Ctrl + Z` | 撤销 |
| `Cmd/Ctrl + Shift + Z` | 重做 |
| `Cmd/Ctrl + A` | 全选 |
| `Cmd/Ctrl + +/-` | 缩放 |
| `Shift + 1` | 适应屏幕 |
| `Space + 拖拽` | 平移画布 |
| `方向键` | 微调 1px |
| `Shift + 方向键` | 微调 10px |

---

## 四、预览模式规范

### 4.1 模式切换

- 顶部工具栏：iframe / HTML / 图片 三 Tab 切换
- 切换时保留当前缩放和位置
- 当前模式高亮显示

### 4.2 预览-编辑同步

- 编辑后预览自动刷新（防抖 500ms）
- 预览中点击组件 → 画布选中该组件（v1.1）

### 4.3 导出选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| 格式 | HTML / PNG / SVG | HTML |
| DPI | 1x / 2x / 3x | 2x |
| 背景 | 透明 / 白色 / 页面底色 | 白色 |
| 范围 | 整页 / 选区 | 整页 |
| 内联资源 | 是 / 否 | 是（≤5MB） |

---

## 五、可访问性（a11y）规范

### 5.1 对比度

- 正文文本：≥ 4.5:1（WCAG AA）
- 大文本（18px+）：≥ 3:1
- 图标和边框：≥ 3:1

### 5.2 键盘导航

- 所有交互元素可通过 Tab 聚焦
- 焦点环清晰可见（2px primary 边框）
- 画布支持键盘操作（方向键微调）

### 5.3 语义化

- 使用语义化 HTML 标签
- 图片必须有 alt 文本
- 表单元素必须有 label 关联

---

## 六、术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 组件 | Component | 可复用的 UI 元素 |
| 画布 | Canvas | 编辑原型的区域 |
| 画板 | Artboard | 一个页面的容器 |
| 元件 | Widget | Axure 中的组件 |
| 占位符 | Placeholder | 降级显示的矩形 |
| 动态面板 | Dynamic Panel | Axure 中的状态容器 |
