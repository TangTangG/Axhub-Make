# 上游同步脚本
# 用于从 Axhub-Make 上游仓库拉取最新代码

set -e

echo "=== 上游同步 $(date +%Y-%m-%d) ==="

# 检查是否在 git 仓库中
if [ ! -d ".git" ]; then
    echo "错误：当前目录不是 git 仓库"
    exit 1
fi

# 检查 upstream remote
if ! git remote | grep -q upstream; then
    echo "添加 upstream remote..."
    git remote add upstream https://github.com/lintendo/Axhub-Make.git
fi

# 拉取上游最新
echo "拉取上游最新代码..."
git fetch upstream main

# 使用 git subtree 合并（如果 upstream/ 目录存在）
if [ -d "upstream" ]; then
    echo "使用 git subtree 合并上游变更..."
    git subtree pull --prefix=upstream https://github.com/lintendo/Axhub-Make.git main --squash -m "chore: sync upstream $(date +%Y-%m-%d)"
else
    echo "警告：upstream/ 目录不存在，跳过 subtree 合并"
    echo "建议：git subtree add --prefix=upstream https://github.com/lintendo/Axhub-Make.git main --squash"
fi

# 应用补丁
if [ -d "patches" ] && [ "$(ls -A patches 2>/dev/null)" ]; then
    echo "应用 patch-package 补丁..."
    npx patch-package
else
    echo "无补丁需要应用"
fi

# 运行测试
echo "运行测试..."
if npm test; then
    echo "✅ 测试通过"
else
    echo "❌ 测试失败"
    echo "回滚命令: git reset --hard HEAD~1"
    exit 1
fi

# 打 tag
TAG_NAME="upstream-sync-$(date +%Y%m%d)"
echo "创建 tag: $TAG_NAME"
git tag "$TAG_NAME" || echo "tag 已存在"

echo "=== 同步完成 ==="
