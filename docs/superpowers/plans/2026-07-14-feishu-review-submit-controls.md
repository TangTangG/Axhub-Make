# 飞书评审提交控件精简 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将人工评审的局域网/飞书启用控件改成同组左对齐复选框，并统一使用“飞书提交”文案，同时保持底部两行和 72px 高度。

**Architecture:** 仅调整 `UiReviewPanel` 的呈现层，不改变现有回调、管理端 API 或服务端配置。使用项目已有 Radix `Checkbox`，将其三态值显式归一为布尔值后交给现有启用处理函数。

**Tech Stack:** React 18.2、TypeScript 5、Radix Checkbox、Tailwind CSS、Vitest 4。

## Global Constraints

- 人工评审区域继续使用 `h-[72px]`，保持两行，每行 `h-8`。
- 第二行使用“提交方式”标题，后接 `局域网提交` 和 `飞书提交` 两个连续左对齐配置项。
- 不使用 `Switch`；两个 `Checkbox` 继续保持独立 pending/disabled 状态。
- 飞书绑定后的外链入口继续使用图标按钮，不渲染原始 URL。
- 不修改局域网、飞书 API 契约或服务端行为。
- 当前工作区包含用户改动；实现文件保持未暂存、未提交。

---

## File Structure

- Modify `src/index/components/content/UiReviewPanel.source.test.ts`: 定义复选框、文案、连续布局和固定高度的回归断言。
- Modify `src/index/components/content/UiReviewPanel.tsx`: 替换控件并重排第二行。

### Task 1: 紧凑提交方式复选框

**Files:**
- Modify: `src/index/components/content/UiReviewPanel.source.test.ts`
- Modify: `src/index/components/content/UiReviewPanel.tsx`

**Interfaces:**
- Consumes: `onLanSubmitEnabledChange(enabled: boolean)`、`onFeishuEnabledChange(enabled: boolean)`、`ReviewLanSubmitConfig`、`ReviewFeishuConfig`。
- Produces: 不新增公共接口；只改变人工评审底部的呈现和控件事件归一化。

- [ ] **Step 1: 写入失败的源码回归断言**

在现有主用例中加入或更新以下断言：

```ts
expect(source).toContain("import { Checkbox } from '@/components/ui/checkbox';");
expect(source).not.toContain("import { Switch } from '@/components/ui/switch';");
expect(source.match(/<Checkbox/gu)).toHaveLength(2);
expect(source).toContain('提交方式');
expect(source).toContain('飞书提交');
expect(source).not.toContain('飞书评审');
expect(source).toContain('className="flex h-8 items-center gap-3 px-2');
expect(source).toContain('onCheckedChange={(checked) => { void handleLanSubmitToggle(checked === true); }}');
expect(source).toContain('onCheckedChange={(checked) => { void handleFeishuToggle(checked === true); }}');
expect(source).toContain('aria-label="打开飞书提交"');
expect(source).toContain('h-[72px] space-y-1');
expect(source).not.toContain('>{feishuConfig.url}<');
```

同时将旧的“飞书评审”和 switch pending 断言更新为新的提交文案与通用 pending 名称。

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```bash
pnpm exec vitest run src/index/components/content/UiReviewPanel.source.test.ts
```

Expected: FAIL，因为组件仍导入和渲染 `Switch`，没有“提交方式”与“飞书提交”。

- [ ] **Step 3: 实现最小复选框布局**

将组件导入改为：

```tsx
import { Checkbox } from '@/components/ui/checkbox';
```

两个 pending 状态使用不绑定具体控件类型的名称：

```tsx
const [lanSubmitPending, setLanSubmitPending] = useState(false);
const [feishuSubmitPending, setFeishuSubmitPending] = useState(false);
```

第二行使用单个左对齐配置组，结构等价于：

```tsx
<div className="flex h-8 items-center gap-3 px-2 text-[12px] font-medium text-foreground">
    <span className="shrink-0 text-muted-foreground">提交方式</span>
    <div className="flex min-w-0 items-center gap-3">
        <div className="flex items-center gap-1.5">
            <Checkbox
                id="review-lan-submit"
                checked={lanSubmitConfig?.lanSubmitEnabled === true}
                disabled={lanSubmitPending || lanSubmitConfig?.projectLanAllowed === false}
                onCheckedChange={(checked) => { void handleLanSubmitToggle(checked === true); }}
            />
            <label htmlFor="review-lan-submit" className="whitespace-nowrap">局域网提交</label>
            <TooltipProvider delayDuration={150}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="局域网提交说明"
                        >
                            <CircleHelp className="h-3.5 w-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[320px]">
                        允许研发团队成员的 AI agent 通过局域网提交 Markdown 评审报告。
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
        <div className="flex items-center gap-1.5">
            <Checkbox
                id="review-feishu-submit"
                checked={feishuConfig?.enabled === true}
                disabled={feishuSubmitPending}
                onCheckedChange={(checked) => { void handleFeishuToggle(checked === true); }}
            />
            <label htmlFor="review-feishu-submit" className="whitespace-nowrap">飞书提交</label>
            <TooltipProvider delayDuration={150}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="飞书提交说明"
                        >
                            <CircleHelp className="h-3.5 w-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[320px]">
                        创建并绑定飞书多维表格，文档权限由用户在飞书中管理。
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            {feishuConfig?.bound === true ? (
                <TooltipProvider delayDuration={150}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                size="icon-xs"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                aria-label="打开飞书提交"
                                onClick={onOpenFeishu}
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">打开飞书提交</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ) : null}
        </div>
    </div>
</div>
```

将飞书说明、外链按钮的可访问文案和 tooltip 统一改成“飞书提交”。不要改变第一行操作或 `h-[72px]`。

- [ ] **Step 4: 运行测试并确认 GREEN**

Run:

```bash
pnpm exec vitest run src/index/components/content/UiReviewPanel.source.test.ts
```

Expected: 4 tests PASS。

### Task 2: 集成验证

**Files:**
- Verify: `src/index/components/content/UiReviewPanel.tsx`
- Verify: `src/index/components/content/PresentationArea.tsx`

**Interfaces:**
- Confirms: 现有 `UiReviewPanel` 属性接线、固定高度和管理端生产构建不受影响。

- [ ] **Step 1: 运行相关 UI 套件**

Run:

```bash
pnpm exec vitest run \
  src/index/components/content/UiReviewPanel.source.test.ts \
  src/index/components/content/PresentationArea.source.test.ts
```

Expected: 2 files、16 tests PASS。

- [ ] **Step 2: 运行管理端生产构建**

Run:

```bash
pnpm admin:build
```

Expected: exit 0；Vite 完成管理端与 Axure-export 构建。

- [ ] **Step 3: 检查最终差异与暂存区**

Run:

```bash
git diff --check
git diff --cached --name-status
git status --short -- \
  src/index/components/content/UiReviewPanel.tsx \
  src/index/components/content/UiReviewPanel.source.test.ts
```

Expected: 无空白错误；实现文件保持未暂存；用户原有暂存资源不变。
