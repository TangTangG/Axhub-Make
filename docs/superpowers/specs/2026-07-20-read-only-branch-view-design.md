# Axhub Make 网页端只读分支查看设计

## 背景

当前“版本和协作”面板把本地分支下拉框实现成了真实的 Git 分支切换。用户选择其他分支时，前端调用 `POST /api/git/workspace/branch`，服务端在工作区存在未提交文件时返回 `DIRTY_WORKTREE`，并附带 AI prompt。前端只要看到 prompt 就显示“需要 AI 协助处理”和合并冲突说明。

这与产品语义不符。网页端不负责切换 Git 分支；分支选择只是改变信息查询视角，不应改变 `HEAD`、工作区文件或仓库状态。未提交改动也不应阻止查看其他分支。

## 目标

- 把网页端分支选择改为纯只读查询。
- 明确区分真实工作区分支和页面当前查看的分支。
- 查看任意已有分支时不执行 Git 写操作，不受未提交改动影响。
- 查看分支时展示该分支的最新提交、提交历史和相对线上分支的差异。
- 工作区改动和提交操作始终绑定真实 `HEAD`。
- 普通查询错误不进入 AI 辅助流程。

## 非目标

- 不在网页端提供 `git switch` 或 `git checkout` 能力。
- 不自动提交、暂存、还原或丢弃工作区改动。
- 不自动合并、变基或解决冲突。
- 不让网页端更新非当前分支的本地 ref。
- 不改变现有提交、同步下来和推送操作本身的 Git 语义；本次只约束它们不能因只读查看状态而指向错误分支。
- 不为已废弃的分支切换 API 保留兼容入口。

## 术语与状态边界

- `currentBranch`：磁盘工作区真实检出的分支，由 `git branch --show-current` 读取。
- `viewedBranch`：本地分支下拉框当前选择的只读查询目标；默认等于 `currentBranch`。
- `viewedRemoteBranch`：线上分支下拉框当前选择的只读比较目标；默认优先使用与 `viewedBranch` 同名的线上分支。
- `operationRemoteBranch`：现有同步和推送流程真正使用的线上目标，即仓库配置的默认线上分支；它不随只读下拉选择改变。
- 工作区状态：`hasChanges`、`changedFilesCount`、`changeSummary`、提交输入和提交动作，只描述真实 `HEAD` 及其工作区。
- 分支视图：所查看分支的头部提交、提交历史、与所查看线上分支的提交和文件差异。

只读分支视图不能反向改变工作区状态。用户查看 `feature` 时，即使工作区实际位于 `main`，未提交文件仍明确属于 `main`，不能显示成 `feature` 的改动。

## 方案选择

采用扩展现有状态查询接口的方案：

```text
GET /api/git/workspace/status?branch=<local-branch>&remoteBranch=<remote-branch>
```

未采用以下方案：

- 独立新增分支摘要接口：职责清楚，但会重复现有状态接口的大量 Git 查询、分组和远端比较结构。
- 一次返回所有分支的完整状态：前端切换无需再次请求，但大仓库查询成本高，结果也更容易过期。
- 自动 stash 后真实切换：仍然会改变仓库状态，并可能产生隐藏 stash 或恢复冲突，违背只读要求。

## API 设计

### 请求参数

`getGitWorkspaceStatus` 增加两个可选参数：

- `branch`：要查看的本地分支。
- `remoteBranch`：要用于比较的线上分支。

后端先读取分支概览，再验证请求值：

- `branch` 必须完整匹配 `branchOverview.localBranches` 中的一项。
- `remoteBranch` 必须规范化掉 `remotes/` 和 `origin/` 前缀，并完整匹配已读取的 `origin/*` 分支。
- 所有 Git 命令继续使用参数数组执行，不拼接 shell 字符串。
- 未传 `branch` 时使用 `currentBranch`。
- 未传 `remoteBranch` 时，优先使用与 `viewedBranch` 同名的线上分支；同名分支不存在时，不自动回退到默认分支进行比较。

不存在的本地分支返回 `404 BRANCH_NOT_FOUND`。不存在的线上分支不是请求失败；状态响应将远端比较标记为不可用，并使用 `remote-branch-missing` 说明原因。

### 响应结构

现有工作区字段继续保持真实 `HEAD` 语义：

- `currentBranch`
- `currentCommit`
- `recentCommits`
- `hasChanges`
- `changedFilesCount`
- `changeSummary`
- `remoteComparison`

增加独立的只读视图字段：

```ts
interface GitWorkspaceBranchView {
  branch: string;
  remoteBranch?: string;
  commit: GitWorkspaceCommitSummary | null;
  recentCommits: GitWorkspaceCommitSummary[];
  remoteComparison: GitWorkspaceRemoteComparison;
}

interface GitWorkspaceStatusResponse {
  // Existing workspace fields remain tied to HEAD.
  currentBranch: string;
  branchView?: GitWorkspaceBranchView;
}
```

使用独立的 `branchView`，而不是让 `currentCommit` 等字段在不同请求下改变含义。这样原型级版本管理、提交说明生成和其他现有调用者仍可依赖真实工作区状态。正常工作区查询返回 `branchView`；带 `gitVersion` 的历史版本查询忽略 `branch` 和 `remoteBranch`，不返回 `branchView`，继续沿用现有历史版本字段语义。

### Git 查询

分支视图使用显式 ref：

- 分支头部：`git log -1 ... <viewedBranch>`
- 提交历史：`git log ... <viewedBranch>`
- 远端存在时，入站差异：`git diff --name-status <viewedBranch>..origin/<viewedRemoteBranch>`
- 远端存在时，出站差异：`git diff --name-status origin/<viewedRemoteBranch>..<viewedBranch>`
- 入站提交：`git log ... <viewedBranch>..origin/<viewedRemoteBranch>`
- 出站提交：`git log ... origin/<viewedRemoteBranch>..<viewedBranch>`

工作区改动仍由 `git status --porcelain -uall` 读取。查询过程中禁止执行 `switch`、`checkout`、`merge`、`rebase`、`reset`、`stash`、`branch -f` 或其他会改变工作区、索引、`HEAD`、本地分支 ref 的命令。

## 前端交互

本地信息卡将原“当前分支”拆成两行：

- “工作区分支”：只读展示 `currentBranch`。
- “查看分支”：下拉选择 `branchView.branch`。

用户选择其他本地分支时：

1. 更新页面内 `viewedBranch` 状态。
2. 为线上视图选择同名分支；不存在时清空线上比较目标。
3. 重新调用状态 GET 接口。
4. 使用 `branchView.commit` 和 `branchView.recentCommits` 更新历史版本区域。
5. 使用 `branchView.remoteComparison` 更新线上差异区域。

历史列表中原“当前版本”标记改为“分支最新”，避免它被理解成真实工作区的 `HEAD`。

线上分支选择同样只保存在当前页面状态，并通过 `remoteBranch` 查询参数改变比较目标；选择动作不再调用远端配置写接口。连接仓库时保存的默认线上分支继续作为同步和推送的操作目标，但不会因浏览其他分支而被覆盖。只读视图仍优先选择与本地查看分支同名的线上分支；同名分支不存在时保持“暂无对应分支”，用户可以再手动选择其他线上分支进行比较。

刷新本地或线上信息时保留当前查看选择。若刷新后所查看本地分支已经不存在，前端显示普通提示，回退到 `currentBranch` 并重新查询。

## 写操作边界

提交版本始终针对真实工作区，因此是否显示提交区域只取决于顶层工作区字段。

只有以下条件同时满足时，“同步下来”和“推送上去”才可用：

- `branchView.branch === currentBranch`
- `branchView.remoteBranch === operationRemoteBranch`

任一条件不满足时：

- 提交区域仍可用于提交真实工作区改动，但必须继续明确显示其所属的 `currentBranch`。
- “同步下来”和“推送上去”不可用，避免用户把只读比较结果误当成即将操作的目标。
- 禁用提示说明当前只是在查看其他分支信息；写操作只支持真实工作区分支和已配置的同步目标，不引导用户在网页端切换分支。

满足两个条件时，同步和推送继续使用现有真实工作区流程。它们不能读取 `branchView` 作为隐式操作目标，服务端仍以真实 `HEAD` 和配置中的 `operationRemoteBranch` 执行。

`git fetch` 保留为“刷新线上信息”。它可以更新 `origin/*` 远端跟踪 ref，但不会改变工作区文件、索引或 `HEAD`，符合网页端读取最新线上信息的用途。

## 移除旧切换链路

- 删除 `VersionCollaborationPanel` 中的 `handleSwitchBranch`。
- 删除 `apiService.switchGitWorkspaceBranch`。
- 删除 `POST /api/git/workspace/branch` 服务端处理器。
- 删除仅服务于该链路的 `DIRTY_WORKTREE` 分支管理 prompt。
- 从前后端场景类型、允许列表和 prompt 构造器中删除不再有调用者的 `branch-management` 场景。
- 不保留返回弃用提示的兼容接口；这是内部网页 API，保留入口会继续造成能力边界混乱。

同步下来时发现工作区未提交改动的现有保护不在本次删除范围内，因为同步确实会修改当前分支。

## 错误处理

- 本地分支不存在：`404 BRANCH_NOT_FOUND`，刷新列表并回退到 `currentBranch`。
- 线上分支不存在：响应成功，`branchView.remoteComparison.reason` 为 `remote-branch-missing`。
- Git 查询失败：显示具体的普通错误，不生成 AI prompt。
- Git 认证失败：用户主动刷新线上信息时，可以沿用认证类 AI 辅助入口。
- 真正的非快进同步、推送拒绝或冲突：保留现有 AI 辅助边界。
- 查看分支场景永远不返回 `DIRTY_WORKTREE`，也不显示“不会自动合并或解决冲突”。

## 测试设计

### 服务端测试

- 工作区存在已跟踪和未跟踪改动时，查询其他本地分支仍返回 200。
- 响应中的 `currentBranch` 保持真实分支，`branchView.branch` 为请求分支。
- `branchView.commit` 和提交历史来自请求分支，而顶层工作区提交及改动字段仍来自 `HEAD`。
- 远端比较使用显式的本地和线上 ref。
- 未传查询参数时，分支视图默认使用真实工作区分支和同名线上分支。
- 不存在的本地分支返回 `BRANCH_NOT_FOUND`。
- 不存在的线上分支返回成功状态和 `remote-branch-missing`。
- 命令调用记录中不存在 `switch`、`checkout`、`merge`、`rebase`、`reset`、`stash` 或 `branch -f`。
- 删除旧 `POST /api/git/workspace/branch` 的成功切换测试，改为断言该路由不存在。

### API 客户端测试

- `getGitWorkspaceStatus({ branch, remoteBranch })` 正确编码两个查询参数及项目 id。
- 不再导出或调用 `switchGitWorkspaceBranch`。
- 查询错误对象仍保留错误码，但普通分支查询错误不携带 AI prompt。

### 前端测试

- 页面同时显示工作区分支和查看分支。
- 选择查看分支只调用状态 GET，不调用任何 POST 分支接口。
- 历史版本和线上差异读取 `branchView`。
- 工作区改动、提交区域和提交说明生成继续读取顶层真实工作区字段。
- 查看分支对与真实同步分支对不一致时，同步和推送按钮禁用，刷新操作仍可用。
- 分支消失后回退到 `currentBranch`。
- 页面不再因查看分支显示 `DIRTY_WORKTREE`、AI prompt 或合并冲突说明。

## 验收标准

在真实工作区位于 `main` 且存在未提交改动时，从网页选择查看 `feature`：

- 页面能够正常显示 `feature` 的最新提交和历史。
- 若存在 `origin/feature`，页面能够显示两者的入站和出站差异。
- Git 的 `HEAD`、当前分支、索引和工作区文件均未改变。
- 页面仍明确显示工作区分支为 `main`，未提交改动仍归属 `main`。
- 当查看分支对与真实同步分支对不一致时，同步和推送不可用，提交真实 `main` 改动的能力不被错误重定向。
- 页面不出现未提交改动阻止查看的错误，也不要求 AI 介入。
