# Make vendor dependencies

本文档说明 Axhub Make 独立发布仓库的 vendor 依赖方式。它属于仓库级发布说明，不放在 server 源码目录内。

## 范围

仓库根目录提交下列内部包的构建产物到 `vendor/`：

- `@axhub/excalidraw`
- `axhub-export-core`
- `axhub-genie-editor`
- `tiptap-editor`

不在本轮 vendor 范围内的依赖：

- `@axhub/project-core`：server 侧已经完成清理和本地化，不再作为 vendor 包处理。
- `@axhub/annotation`：只由 `client` 使用，并且已经发布为 npm 包，client 直接依赖 `@axhub/annotation@^1.0.3`。

## 更新方式

在仓库根目录运行：

```bash
pnpm --filter @axhub/make vendor:sync
```

该命令会按 `vendor-packages.config.json`：

1. 如果存在 monorepo source 包，则构建对应内部包。
2. 复制稳定产物到 `vendor/`；如果 source 包不存在，则使用已提交的完整 vendor 产物。
3. 生成 vendor alias 和 TypeScript path metadata。

`@axhub/make` 的 `dev`、`build`、`server:build`、`test` 等脚本，以及 `@axhub/make-client` 的 `dev`、`build`、`typecheck`、`test` 等脚本，都会先执行 `vendor:sync`，确保本地开发和构建使用最新 vendor 产物。

`@axhub/annotation` 不走 vendor 流程。升级这类 client npm 依赖时，应先发布对应 npm 版本，再在本仓库根目录运行 `pnpm install --lockfile-only --filter @axhub/make-client` 同步 `client` 依赖锁定。

## 发布仓库行为

发布仓库只提交 `vendor/` 中的必要构建产物和 generated metadata，不提交 monorepo 的 `packages/` 源码。没有 monorepo source 包时，`vendor:sync` 会在已存在完整 vendor 产物时继续使用已提交产物，不要求重新构建源包。

如果需要升级某个 vendor 包，应在 monorepo 内更新源包并重新运行：

```bash
pnpm --filter @axhub/make vendor:sync
```

然后提交更新后的 vendor 产物、generated metadata、相关 lockfile 和 package metadata。
