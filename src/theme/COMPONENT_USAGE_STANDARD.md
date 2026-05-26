# 组件与样式统一规范（首页与操作区）

> 适用范围：Make Server Admin 首页主链路（`IndexPage`）及其操作对话框、配置面板、工具面板。

## 1. 目标

- 保证同类交互在视觉、尺寸、状态反馈上保持一致。
- 降低“局部手写样式”导致的 UI 漂移。
- 让新增页面默认继承主题，不再重复造样式。

## 2. 主题与颜色规则

- 颜色必须优先使用主题 token：`background/foreground/muted/border/primary/brand`。
- 禁止在业务组件中直接写十六进制颜色（如 `#999`、`#fff`）作为常规 UI 色。
- 允许直接写颜色的例外：品牌 logo 素材、导出图片内容、第三方图标文件。

## 3. 字体与尺寸规则

- 操作区（表单、弹窗、配置面板、工具面板）文本基准：`14px`（Tailwind `text-sm`）。
- 菜单/导航密度文本基准：`12px`（Tailwind `text-xs` 或 `text-[12px]`）。
- 任何输入型控件（Input/Select/Textarea/MultiSelect）默认使用 `h-9` + `text-sm`。
- 小按钮（`Button size=\"sm\"` / `Button size=\"xs\"`）允许保持 12px，用于高密度次级操作。

## 4. 标准组件使用规则

必须优先使用 `src/components/ui` 下的标准组件，不允许在业务层重复写控件样式。

- 输入框：`Input`
- 多行输入：`Textarea`
- 选择器：`Select` + `SelectTrigger`
- 多选：`MultiSelect`
- 复选：`Checkbox`
- 按钮：`Button`
- 提示：`Tooltip`（默认黑底/浅字官方样式）
- 字段容器：`Field` + `FieldLabelWithHint` + `FieldDescription`

禁止做法：

- 在业务组件中直接写 `<input className="...大量样式..." />`。
- 在业务组件中直接写 `<textarea className="...大量样式..." />`。
- 每次使用标准控件时重复写相同样式（如反复写 `h-9 text-sm`）。应优先使用组件默认值，仅在确有差异需求时覆盖。
- 在 `TooltipContent` 上覆盖默认语义样式（如改回浅底、边框、11px）且无明确设计评审结论。
- 同一页面混用不同字号策略（例如部分 `text-xs`，部分 `text-sm`）且无明确菜单语义。

允许例外（需保持最小化）：

- 原生文件上传触发器可使用 `<input type="file" className="hidden" />`。
- 侧边栏内联重命名可使用共享类 `ax-inline-rename-input`，禁止新增一次性输入样式。

## 5. Toast（吐司）规范

- 统一使用 Sonner，视觉样式保持官方默认样式。
- 不使用 `richColors`。
- 根节点仅在 `AppRoot` 挂载一个 `Toaster`。
- 跟随主题：`theme={isDarkMode ? 'dark' : 'light'}`。
- 后台默认位置使用 `top-right`；`sonner` 无内建“屏幕正中央”位置，优先采用右上角作为稳定方案。
- 成功/失败/提示类 toast 默认停留 `2500ms`。
- 开启 `closeButton`，允许用户立即关闭。
- `visibleToasts` 默认不超过 `2`，避免连续操作时堆叠遮挡。
- `toast.loading(...)` 结束后应优先通过同一个 `id` 更新为成功/失败态，而不是额外再弹一个 toast。

当前标准实现位置：

- `src/index/app/AppRoot.tsx`
- `src/components/ui/sonner.tsx`

## 6. 主按钮规范

- 主按钮（`variant=default|brand`）文案必须为白色。
- 页面中“提交/保存/执行”类主操作优先使用 `variant="brand"` 或 `variant="default"`。

## 7. 开发与评审检查项

提交前至少自检以下内容：

- 是否存在新的硬编码颜色（`#`/`rgb`）用于普通 UI。
- 表单控件是否全部来自 `components/ui`。
- 操作区字号是否保持 `text-sm`。
- 菜单字号是否保持 `text-xs`。
- toast 是否仍为官方默认样式（未启用 `richColors`）。
- toast 是否仍使用后台标准配置（右上角、可关闭、短时停留、不堆叠）。

## 8. 变更流程建议

- 新增 UI 需求优先修改标准组件，再改业务组件。
- 若需要新增视觉规则，先更新本规范和 `src/theme/README.md`，再改代码。
- 评审时以“是否复用标准组件”作为必过项，不符合则回退修改。
