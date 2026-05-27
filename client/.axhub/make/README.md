# .axhub/make

这个目录用于存放 Axhub Make 项目的本地运行数据和项目配置索引。

## 目录职责

- `client.json`
  - 客户端身份与运行配置，可作为模板 marker 提交。
- `project.json`
  - 项目级 metadata 和资源声明，由同步脚本/运行时生成，不作为通用模板提交。
- `entries.json`
  - 入口扫描结果，通常由程序生成或刷新。
- `sidebar-tree.json`
  - 侧边栏树数据，通常由程序生成或刷新。
- `.dev-server-info.json`
  - 当前开发服务的本地运行信息。
- `artifacts/`
  - 导出或交付产物，例如 Axure artifact。
- `backups/`
  - 本地维护备份目录；不应提交临时备份内容。

## 不建议直接手改的文件

以下文件通常属于运行时或扫描产物，除非明确知道影响，否则不要手动编辑：

- `entries.json`
- `sidebar-tree.json`
- `.dev-server-info.json`
- `project.json`

涉及资源路径、上传、删除、代理、下载或资源写入时，必须遵循仓库根 `AGENTS.md` 和 Make server 的安全路径约束。
