#!/bin/bash
# 上游 API 变更检测脚本
# 检查 vendor/axhub-export-core 的公共导出符号是否与 UPSTREAM_API_LOCK.md 一致

set -e

echo "=== 上游 API 变更检测 ==="

LOCK_FILE="UPSTREAM_API_LOCK.md"
VENDOR_DIR="vendor/axhub-export-core"

# 检查锁定文件
if [ ! -f "$LOCK_FILE" ]; then
    echo "❌ 错误：$LOCK_FILE 不存在"
    exit 1
fi

# 检查 vendor 目录
if [ ! -d "$VENDOR_DIR" ]; then
    echo "❌ 错误：$VENDOR_DIR 不存在"
    exit 1
fi

# 提取当前导出的符号（从 dist/index.d.ts 或类似文件）
echo "分析当前导出符号..."

# 查找 TypeScript 声明文件
DTS_FILES=$(find "$VENDOR_DIR" -name "*.d.ts" -type f 2>/dev/null || true)

if [ -z "$DTS_FILES" ]; then
    echo "⚠️ 警告：未找到 .d.ts 文件，无法精确检测"
    echo "尝试从 .js 文件分析..."
    
    # 从 JS 文件提取导出（简单 grep）
    JS_FILES=$(find "$VENDOR_DIR/dist" -name "*.js" -type f 2>/dev/null || true)
    if [ -n "$JS_FILES" ]; then
        echo "找到 JS 文件，提取导出符号..."
        grep -h "^export" $JS_FILES 2>/dev/null | sort | uniq > /tmp/current_exports.txt || true
    fi
else
    echo "找到 TypeScript 声明文件："
    echo "$DTS_FILES"
    
    # 提取导出的函数和类型
    > /tmp/current_exports.txt
    for file in $DTS_FILES; do
        grep -h "^export" "$file" 2>/dev/null >> /tmp/current_exports.txt || true
    done
fi

# 显示当前导出
if [ -f "/tmp/current_exports.txt" ]; then
    echo ""
    echo "当前导出符号："
    cat /tmp/current_exports.txt
    echo ""
fi

# 与锁定文件比较（简单文本比较）
echo "与锁定文件比较..."

# 提取锁定文件中的关键符号
grep -E "^function |^interface |^type " "$LOCK_FILE" 2>/dev/null | sort > /tmp/locked_symbols.txt || true

if [ -f "/tmp/locked_symbols.txt" ] && [ -f "/tmp/current_exports.txt" ]; then
    # 比较差异
    if diff -q /tmp/locked_symbols.txt /tmp/current_exports.txt > /dev/null 2>&1; then
        echo "✅ 未检测到 API 变更"
        exit 0
    else
        echo "⚠️ 检测到 API 变更："
        diff /tmp/locked_symbols.txt /tmp/current_exports.txt || true
        echo ""
        echo "请更新 $LOCK_FILE 并审查变更影响"
        exit 1
    fi
else
    echo "⚠️ 无法完成比较，跳过"
    exit 0
fi
