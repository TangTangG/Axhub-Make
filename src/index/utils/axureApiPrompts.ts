import type { TabType } from '../types';

const FIXED_RULE_PATHS = [
    '/rules/axure-export-workflow.md',
    '/rules/axure-api-guide.md',
] as const;

const FIXED_GUIDANCE_NAMES = [
    'Axure 导出工作流',
    'Axure API 规范',
] as const;

interface BuildAxureApiUpdatePromptParams {
    activeTab: TabType;
    itemName: string;
}

export function buildAxureApiUpdatePrompt(params: BuildAxureApiUpdatePromptParams): string {
    const { itemName } = params;

    return `请为当前项目执行「新增或更新 Axure API（代码+文档）」任务，严格按固定要求处理，不依赖已有解析结果。

必须先阅读并遵循以下固定规则/规范（由系统上下文提供）：
${FIXED_GUIDANCE_NAMES.map((ruleName) => `- ${ruleName}`).join('\n')}

目标资源：
- \`${itemName}\`
- 当前资源的运行入口与规格说明

任务要求：
1. 以 \`useImperativeHandle\` 返回对象作为 Axure API 真值来源，补齐或更新 \`eventList\` / \`actionList\` / \`varList\` / \`configList\` / \`dataList\`。
2. 保持现有业务行为、交互和视觉表现不变，只做 Axure API 相关必要改动。
3. 同步更新规格说明中的 5.x Axure API 章节（5.1-5.5），确保与代码一致；若文件不存在请创建。
4. 输出结果时给出改动摘要，并明确列出新增/更新了哪些 API。
5. 如当前文件缺失任意列表，完整新增并保证可被静态识别；如已存在，补齐字段描述并确保命名与规范一致。

输出要求：
- 列出 5 类列表各自是“新增 / 更新 / 保持不变”。
- 标注规格说明是否已同步完成。
`;
}

export { FIXED_RULE_PATHS as AXURE_API_FIXED_RULE_PATHS };
