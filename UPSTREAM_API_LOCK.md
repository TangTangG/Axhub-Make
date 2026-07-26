# 上游 API 锁定文件
# 记录上游 axhub-export-core 的公共导出符号，用于检测意外变更

## 包信息
- **包名**: axhub-export-core
- **来源**: vendor/axhub-export-core
- **类型**: 预编译 dist/（无源码）

## 公共导出符号

### 函数

#### htmlToAxure
```typescript
function htmlToAxure(
  html: string,
  options: ExportOptions
): AxureDocument
```
- **用途**: 将 HTML 转换为 Axure 文档
- **参数**:
  - `html`: HTML 字符串
  - `options`: 导出选项
- **返回**: Axure 文档对象

#### parseComponentTree
```typescript
function parseComponentTree(
  tree: ComponentTree
): AxureWidget[]
```
- **用途**: 解析组件树为 Axure Widget 数组
- **参数**:
  - `tree`: 组件树对象
- **返回**: Axure Widget 数组

### 类型定义

#### ExportOptions
```typescript
interface ExportOptions {
  // 导出选项（具体字段待补充）
  [key: string]: any;
}
```

#### AxureDocument
```typescript
interface AxureDocument {
  version: string;
  pages: AxurePage[];
  masters?: AxureMaster[];
  imageMap?: Record<string, string>;
}
```

#### AxureWidget
```typescript
interface AxureWidget {
  id: string;
  type: string;
  name?: string;
  // ... 其他字段
}
```

#### ComponentTree
```typescript
interface ComponentTree {
  type: string;
  props: Record<string, any>;
  children?: ComponentTree[];
}
```

## 锁定说明

1. **本文件记录的符号为当前版本（v1.0.0）的公共 API**
2. **任何符号变更（新增/删除/修改）都应触发 CI 警报**
3. **变更检测脚本**: `scripts/check-upstream-api.sh`

## 变更历史

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-07-26 | 初始锁定 | - |

---

*本文件由 CI 自动验证，人工修改需同步更新检测脚本*
