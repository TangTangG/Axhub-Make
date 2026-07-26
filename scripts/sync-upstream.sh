#!/bin/bash
# 上游同步脚本
# 定期 merge Axhub-Make 上游更新

set -e

echo "=== Axhub Proto Enhanced 上游同步 ==="
echo ""

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  警告：有未提交的更改，请先提交或 stash"
    echo "未提交文件："
    git status --short
    exit 1
fi

# 获取上游更新
echo "1. 获取上游更新..."
git fetch upstream

# 检查是否有新提交
LOCAL=$(git rev-parse HEAD)
UPSTREAM=$(git rev-parse upstream/main)

if [ "$LOCAL" = "$UPSTREAM" ]; then
    echo "✅ 已是最新，无需同步"
    exit 0
fi

echo "2. 发现上游更新："
git log --oneline HEAD..upstream/main | head -20

echo ""
echo "3. 开始合并..."
echo "   策略：优先保留本地功能增强"
echo ""

# 尝试合并
if git merge upstream/main --no-commit --no-ff; then
    echo ""
    echo "✅ 合并成功，无冲突"
    
    # 检查是否有本地增强代码被影响
    if git diff --cached --name-only | grep -q "^src/enhanced/"; then
        echo "⚠️  注意：本地增强代码可能受到影响，请检查"
    fi
    
    git commit -m "chore: merge upstream updates from Axhub-Make"
    echo "✅ 已提交合并"
else
    echo ""
    echo "⚠️  合并存在冲突，需要手动解决"
    echo ""
    echo "冲突文件："
    git diff --name-only --diff-filter=U
    echo ""
    echo "解决步骤："
    echo "  1. 编辑冲突文件，保留本地功能增强"
    echo "  2. git add < resolved-files >"
    echo "  3. git commit"
    echo "  4. 重新运行此脚本验证"
    exit 1
fi

echo ""
echo "=== 同步完成 ==="
