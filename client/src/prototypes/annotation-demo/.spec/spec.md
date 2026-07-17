# 标注演示规格

> 本文档是用户与 Agent 围绕当前原型进行方案沟通、确认和持续生成的事实依据。只维护当前有效方案，并简短记录会影响当前原型的重要用户决策和变更。

## 当前方案

- 原型意图：说明 Axhub Make 如何把可运行原型、节点标注、状态控制和补充文档组织在同一个评审入口中，以原型承载界面和交互，以标注补充边界、原因和决策。
- 使用场景：产品负责人、设计师、研发、评审者和 Agent 沿七个章节理解标注协作方式，并从目录切换页面、阅读六篇 PRD 文档或打开外部设计来源。
- 当前表达：七个 Hash 章节依次呈现“原型即 PRD”、内容标注、状态标注、原型目录、开启标注、编辑标注和 Agent 读取；默认章节为 `prototype-as-prd`。

## 事实与输入

### 用户确认事实

- 原型名称为“标注演示”，原型 id 为 `annotation-demo`。
- 当前主规格采用 Markdown，固定路径为 `.spec/spec.md`；原 `.spec/spec.html` 删除，不保留双格式主规格。

### 参考资料

- `src/prototypes/annotation-demo/index.tsx`：七个章节、页面文案、状态渲染、目录内联和 `AnnotationViewer` 配置。
- `src/prototypes/annotation-demo/style.css`：Swiss 文档式布局、IKB 强调色、响应式断点和可访问性表现。
- `src/prototypes/annotation-demo/annotation-source.json`：11 个标注节点、三种标注颜色、Markdown 正文、三组分段控件和目录树。
- `src/prototypes/annotation-demo/docs/prd-00-overview.md` 至 `docs/prd-05-handoff.md`：总览、角色、流程、状态、风险和交付说明。
- `src/prototypes/annotation-demo/assets/`：开启标注、编辑标注、Agent 读取等章节和目录文档使用的六张截图。
- `src/common/useHashPage.ts`：Hash/查询参数解析、页面切换和嵌入宿主路由通知。
- `src/resources/templates/规格文档 Markdown 模板.md`：当前主规格的结构基准。

### 当前假设

- 无。当前方案只记录可运行实现和关联资料能够证明的事实；资料与页面表现不一致时，以可运行原型为准。

## 原型范围

### 本次呈现

- 七个 Hash 章节及侧栏、上一页、下一页导航。
- 任意元素说明、Markdown 正文、三种功能性标注颜色、颜色筛选和同一节点多条标注。
- 结果、列表、指标三类状态及其由标注分段控件提供的分支。
- 由七个页面、六篇 PRD 文档和一个外部链接构成的原型目录。
- 开启标注的三种方式、编辑标注的两组方式，以及 Agent 读取源码、标注、文档和截图的说明。

### 本次不呈现

- 真实后端接口、用户权限系统、多人实时协作冲突处理或正式发布审批流。
- 真实业务数据、提交与恢复流程；结果卡按钮仅显示“查看详情”或“重新提交”，没有点击处理函数。
- 页面内自动执行 AI 修改或开发任务；“Agent 读取”只说明能力，不在当前页面启动任务。
- 主规格自身的搜索、分页、Hash 导航或验收勾选持久化；这些旧 HTML 文档交互不属于原型方案。

## 页面与内容方案

| 页面/视图 | 页面作用 | 主要模块与内容 | 示例数据或素材 | 与其他页面的关系 |
| --- | --- | --- | --- | --- |
| `prototype-as-prd` / 原型即 PRD | 建立“原型是需求主载体”的核心原则 | 章节头、“我们的目的”、三维度对比表；说明统一入口、生产效率和研发效率 | `01 · PRINCIPLE`；“原型即 PRD”与“原型 + PRD”对比 | 默认页；下一页为 `content-annotation` |
| `content-annotation` / 内容标注 | 演示标注的基本阅读与组织方式 | 点击预览节点、多颜色标注、侧边栏筛选、同一节点多条标注 | `#D97706` 说明、`#059669` 分类、`#7C3AED` 筛选；4 个定位节点承载 6 条标注 | 上接核心原则，下接状态标注 |
| `state-annotation` / 状态标注 | 演示由标注控件切换的业务状态 | 结果页、列表页、指标卡三张状态卡 | `result_state`、`list_state`、`metric_state` | 上接内容标注，下接原型目录 |
| `prototype-directory` / 原型目录 | 说明页面、文档和链接在同一目录中的组织方式 | 七个页面 route；PRD 00–05；外部设计来源 `op7418/guizang-ppt-skill` | 目录三个文件夹默认展开；外部链接在新窗口打开 | route 节点可切换到任一已注册章节 |
| `generate-annotation` / 开启标注 | 说明可生成的标注内容和开启方式 | 任意元素标注、状态标注、目录内容、默认状态；批注工具、Agent 标注技能、批注模式更多菜单 | `assets/make-annotation.png`、`ai-skill-open.png`、`comment-menu-open.png` | 上接目录，下接编辑标注 |
| `edit-comments` / 编辑标注 | 说明 AI 编辑和手动编辑两组方式 | 对话框直接提、批注后通过 AI 执行、编辑节点、编辑文档 | `assets/manual-edit-comment.png`、`document-edit.png`；编辑文档需要 AI 关联文档 | 上接开启标注，下接 Agent 读取 |
| `agent-read` / Agent 读取 | 说明开发 Agent 可获取的上下文 | 源码、标注内容、文档内容、截图四类来源 | `assets/agent-read.png` | 最后一章；上一页为 `edit-comments` |

## 交互与状态方案

| 对象/场景 | 前置状态 | 用户操作 | 原型表现 | 后续状态 |
| --- | --- | --- | --- | --- |
| 页面路由 | 无路由或合法 `#page=<pageId>` / `?page=<pageId>` | 打开原型或改变 Hash | 初始化先读 Hash，再读查询参数，最后回退 `prototype-as-prd`；页面 id 仅允许小写字母、数字和连字符 | 当前章节、页码、内容及相邻页同步更新；格式合法但未注册的 id 在组件层显示首章 |
| 侧栏与前后页 | 当前章节已确定 | 点击章节、上一页或下一页 | 调用同一 `setPage` 写入 Hash；当前章节增加 `is-active`；首章禁用上一页，末章禁用下一页 | 线性切换章节，不循环 |
| 内容标注 | `annotation-source.json` 已载入 | 选择标注节点或按颜色筛选 | 展示 Markdown 说明、分类和筛选语义；同一 DOM 节点可承载多条不同颜色标注 | 页面内容不被标注操作改写 |
| 结果状态 | `result_state` 初始值为 `success` | 在分段控件选择成功或失败 | `success`：提交成功、绿色符号、“查看详情”；`failure`：提交失败、危险色符号、“重新提交” | 未知值回退 `success`；动作按钮不执行提交或重试 |
| 列表状态 | `list_state` 初始值为 `empty` | 在分段控件选择空列表或有内容 | `empty`：暂无数据；`filled`：显示“首页主按钮文案确认、空状态插画替换、指标卡阈值复核” | 未知值回退 `empty` |
| 指标状态 | `metric_state` 初始值为 `normal` | 在分段控件选择偏低、正常或偏高 | `low`：32% / 低于目标 18%；`normal`：68% / 接近目标区间；`high`：92% / 高于目标 12% | 未知值回退 `normal` |
| 原型目录 route | 目录 route 为字符串且匹配七个章节之一 | 点击页面节点 | 调用 `setPage` 切换章节；不匹配的 route 不处理 | 目录保持可继续浏览 |
| 原型目录文档与链接 | 目录数据已载入 | 打开 Markdown 文档或外部链接 | 六篇文档正文由构建依赖图内联；五个图片令牌替换为本地素材 URL；外部来源在新窗口打开 | 不请求运行时相对 Markdown 文件，不改写原型状态 |
| Viewer 工具栏 | `AnnotationViewer` 已挂载 | 使用目录、主题切换或颜色筛选 | 具体面板行为由 `@axhub/annotation` 提供；原型只传入 source 和 options | 不向 Make 宿主回写批注内容 |
| 嵌入宿主通知 | 当前窗口嵌入父窗口 | 路由注册或 Hash 变化 | 发送 `AXHUB_PROTOTYPE_ROUTE_INFO` 或 `AXHUB_PROTOTYPE_PAGE_CHANGE`，只包含路由信息 | 独立窗口不发送；消息不包含批注内容 |

## 设计基底与原型特有调整

- 采用的 `DESIGN.md`：无；当前原型未引用独立 `DESIGN.md`，仅以 `style.css` 中可观察的 Swiss International / IKB 设计语言为事实基底。
- 继承方式：不适用；当前实现使用纸张色 `#fafaf8`、墨色 `#0a0a0a`、IKB `#002FA7`，并以等宽元信息、细边框和文档阅读层级组织内容。
- 本原型特有调整：桌面为 270px sticky 侧栏加最大 980px 正文；内容标注为两列、状态标注为三列；在 1180px、900px、560px 断点调整目录指针、布局、导航和页脚；章节导航、页脚按钮和状态卡按钮提供清晰焦点轮廓，动态章节区使用 `aria-live="polite"`。

## 当前待确认事项

- 无。

## 用户重要决策与变更

| 日期 | 用户决策或变更 | 对当前原型的影响 |
| --- | --- | --- |
| 2026-07-13 | 以当前可运行实现反向归纳主规格。 | 功能、文案、状态和边界均须可追溯，不写入未经证据证明的未来行为。 |
| 2026-07-13 | 未发现原型专属 `DESIGN.md` 时只记录可观察设计语言。 | 记录 Swiss / IKB 和当前 CSS 事实，不补造主题来源。 |
| 2026-07-14 | 将默认主规格由 HTML 改为 Markdown，并严格采用仓库 Markdown 模板。 | 主规格固定为 `.spec/spec.md`；删除 `.spec/spec.html` 及其仅服务文档自身的交互描述。 |
