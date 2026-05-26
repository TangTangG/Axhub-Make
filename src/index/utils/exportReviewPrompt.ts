import type { ReviewResult } from '../services/api';

function getResourceName(filePath: string): string {
    const segments = String(filePath || '').split(/[\\/]+/).filter(Boolean);
    const fileName = segments.at(-1) || '';
    if (fileName === 'index.tsx' && segments.length >= 2) {
        return segments.at(-2) || '当前资源';
    }
    return fileName.replace(/\.[^.]+$/u, '') || '当前资源';
}

function formatIssueList(title: string, issues: ReviewResult['issues']): string {
    if (issues.length === 0) {
        return '';
    }

    const lines = issues.map((issue, index) => {
        const suggestion = issue.suggestion ? `\n   建议：${issue.suggestion}` : '';
        return `${index + 1}. [${issue.rule}] ${issue.message}${suggestion}`;
    });

    return `${title}\n${lines.join('\n')}\n\n`;
}

export function buildExportReviewPrompt(reviewResult: ReviewResult): string {
    const blockingIssues = reviewResult.issues.filter((issue) => issue.blocking && issue.type === 'error');

    let prompt = '请修复这个 Axure 导出阻断问题，保持现有业务行为、交互和视觉不变。\n\n';
    prompt += `资源：${getResourceName(reviewResult.file)}\n`;
    prompt += '规则：\n';
    prompt += '- Axure 导出工作流\n';
    prompt += '- Axure API 规范\n\n';
    prompt += formatIssueList('阻断问题：', blockingIssues);
    prompt += '要求：\n';
    prompt += '- 不要为了过检查强行新增非必需 Axure API\n';
    prompt += '- 输出简短改动摘要\n';

    return prompt.trim();
}

export function createExportReviewFailureResult(params: {
    activeTab: 'components' | 'prototypes';
    itemName: string;
    sourceTargetPath?: string;
    message: string;
}): ReviewResult {
    const file = String(params.sourceTargetPath || '').trim()
        || String(params.itemName || '').trim()
        || '当前资源';

    return {
        file,
        passed: false,
        mode: 'axure-export',
        summary: {
            blockingErrors: 1,
            warnings: 0,
        },
        issues: [
            {
                type: 'error',
                rule: 'code-review-api',
                message: params.message || '代码检查接口调用失败',
                suggestion: '请根据下方 Prompt 让 AI 协助排查并修复，再重新导出。',
                blocking: true,
                category: 'export-structure',
            },
        ],
    };
}
