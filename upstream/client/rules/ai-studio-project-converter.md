# AI Studio 项目转换规则

用于将 Google AI Studio 生成的 React 项目转换为本项目原型页面，保持视觉和功能，并符合 `rules/prototype-development-guide.md`。

## 目标

- 移除 AI Studio 特定入口与 HTML 模板。
- 将 Import Map / CDN 依赖转为 npm 依赖。
- 产出可在 `src/prototypes/<name>/` 中运行的 React 页面。

## 预处理

Make 服务端上传接口会自动运行内置 AI Studio 预处理器。它会复制项目、分析 Import Map、样式、依赖和环境变量，并生成任务文档与分析 JSON。预处理器不直接修改业务代码。

如果项目需要覆盖默认预处理行为，可以在目标项目中提供 `scripts/ai-studio-converter.mjs`；否则使用服务端内置版本。

## 典型结构

```text
ai-studio-project/
├── assets/
├── components/
├── App.tsx
├── index.tsx
├── index.html
├── constants.ts
├── types.ts
├── vite.config.ts
└── metadata.json
```

重点处理：

- `App.tsx`：转换为本项目 `index.tsx` 入口组件。
- `index.html`：提取 Import Map、Tailwind CDN、自定义样式和字体后删除。
- `index.tsx`：本项目已有挂载入口，删除。

## 默认页面格式

```typescript
/**
 * @name 页面名称
 *
 * 参考资料：
 * - /rules/prototype-development-guide.md
 */

import './style.css';
import React from 'react';

export default function PageName() {
  return (
    <div />
  );
}
```

默认保持普通 React 组件；只有明确需要外部接管、配置、数据、事件或动作时，才参考 `rules/axure-api-guide.md` 接入 Axure API。

## 样式迁移

从 `index.html` 提取 `<style>` 和外部字体，写入 `style.css`：

```css
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=...');
```

保留原有 Tailwind 类名、自定义动画和 CSS 变量。

## Import Map 转换

将 CDN 依赖转换为 npm 包：

| Import Map | npm 包 |
|------------|--------|
| `https://esm.sh/lucide-react` | `lucide-react` |
| `https://esm.sh/framer-motion` | `framer-motion` |
| `https://esm.sh/@google/genai` | `@google/genai` |

排除 `react` 和 `react-dom`，本项目已提供。

## 环境变量

将 `process.env.*` 改为 `import.meta.env.VITE_*`，并告知用户需要配置的 `.env.local` 项。

## 移除文件

完成迁移后移除：

- `index.html`
- `index.tsx`
- `metadata.json`（可保留为参考，但不作为运行入口）

## 验收

```bash
node scripts/check-app-ready.mjs /prototypes/[页面名]
```

要求：

- 状态为 `READY`。
- 页面正常渲染。
- 无控制台错误。
- 关键交互正常。
- 样式显示正确。
