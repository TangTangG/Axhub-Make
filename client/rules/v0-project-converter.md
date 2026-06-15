# V0 项目转换规则

用于将 V0 生成的 Next.js 项目转换为本项目原型页面，保持视觉和功能，并符合 `rules/prototype-development-guide.md`。

## 目标

- 保持页面视觉一致性。
- 移除 Next.js 特有实现。
- 产出可在 `src/prototypes/<name>/` 中运行的 React 页面。

## 预处理

Make 服务端上传接口会自动运行内置 V0 预处理器。它会复制项目、分析路径别名和依赖，并生成任务文档与分析 JSON。预处理器不直接修改业务代码。

如果项目需要覆盖默认预处理行为，可以在目标项目中提供 `scripts/v0-converter.mjs`；否则使用服务端内置版本。

## 默认页面格式

默认转换为普通 React 页面。只有明确需要 Axhub / Axure 接管时才接入 Axure API。

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

需要 Axure API 时，再参考 `rules/axure-api-guide.md`。

## 移除 Next.js 代码

移除或替换：

- `"use client"`：删除。
- `next/navigation`：删除或改为组件内状态/普通链接。
- `next/image`：改为 `<img>`。
- `next/link`：改为 `<a>`。
- `Metadata`、`@vercel/*`：删除。

## 路径别名

将 `@/` 转换为相对路径：

```typescript
// V0
import { cn } from "@/lib/utils";

// 转换后
import { cn } from "../lib/utils";
```

以脚本生成的分析表为准逐项检查。

## 样式

`style.css` 以 Tailwind V4 入口开头：

```css
@import "tailwindcss";
```

随后合并源项目全局样式文件、主题变量和自定义样式。

## 依赖

排除：

- `next` 和 `next-*`
- `@vercel/*`
- `react` 和 `react-dom`

保留并按需安装：

- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `@radix-ui/*`
- `lucide-react`
- `recharts`
- `date-fns`

新增依赖优先使用 npm，便于生成项目在没有 pnpm 的用户环境中继续运行：

```bash
npm install <package-name>
```

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
