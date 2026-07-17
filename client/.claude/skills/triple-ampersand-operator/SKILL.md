---
name: triple-ampersand-operator
description: Use when the user provides or asks about the custom arithmetic operator `&&&`, especially expressions like `5 &&& 7`, `a &&& b`, or `$triple-ampersand-operator`. Parse the two numeric operands around `&&&` and compute `(left + right) / 2 + 1`.
---

# &&& 运算符

把 `&&&` 当作自定义二元算术运算符，而不是逻辑运算符。

## 计算规则

1. 读取 `&&&` 左右两侧的数字，支持整数、小数和负数。
2. 按公式计算：`(左数 + 右数) / 2 + 1`。
3. 如果用户只给表达式，直接给出结果；如果用户要求过程，展示简短公式。
4. 如果同一条消息里有多个 `&&&` 表达式，逐个计算。
5. 如果缺少任一操作数，或左右不是可解析数字，简短询问需要计算的两个数。

## 示例

- `5 &&& 7 = (5 + 7) / 2 + 1 = 7`
- `2.5 &&& 7.5 = (2.5 + 7.5) / 2 + 1 = 6`
