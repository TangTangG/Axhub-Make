import { describe, expect, it } from 'vitest';

import { buildExportReviewPrompt, createExportReviewFailureResult } from './exportReviewPrompt';

const PROMPT_PATH_PATTERN = /(?:^|[\s`"'：（(【\[])(?:\/?(?:src|skills|rules|temp|docs|database|themes|prototypes|components|assets|media|\.axhub)\/|~\/|[A-Za-z]:[\\/]|(?:[A-Za-z0-9_.-]+[\\/]){2,})/u;

function expectPromptHasNoPaths(prompt: string): void {
    expect(prompt).not.toMatch(PROMPT_PATH_PATTERN);
}

describe('buildExportReviewPrompt', () => {
    it('builds a concise prompt with resource name, rule names, and blocking issues only', () => {
        const prompt = buildExportReviewPrompt({
            file: 'src/prototypes/demo/index.tsx',
            passed: false,
            mode: 'axure-export',
            summary: {
                blockingErrors: 1,
                warnings: 1,
            },
            issues: [
                {
                    type: 'error',
                    rule: 'file-header-mode-axure',
                    message: '缺少 @mode axure',
                    suggestion: '补充 @mode axure',
                    blocking: true,
                    category: 'docs',
                },
                {
                    type: 'warning',
                    rule: 'axure-api-optional',
                    message: '未接入 Axure API',
                    blocking: false,
                    category: 'axure-api',
                },
            ],
        });

        expect(prompt).toContain('demo');
        expect(prompt).toContain('Axure 导出工作流');
        expect(prompt).toContain('Axure API 规范');
        expect(prompt).not.toContain('src/prototypes/demo/index.tsx');
        expect(prompt).not.toContain('/rules/axure-export-workflow.md');
        expect(prompt).not.toContain('/rules/axure-api-guide.md');
        expect(prompt).toContain('阻断问题');
        expect(prompt).toContain('[file-header-mode-axure] 缺少 @mode axure');
        expect(prompt).not.toContain('可选建议');
        expect(prompt).not.toContain('[axure-api-optional] 未接入 Axure API');
        expect(prompt).not.toContain('复杂');
        expectPromptHasNoPaths(prompt);
    });

    it('builds a fallback review result for code review API failures', () => {
        const result = createExportReviewFailureResult({
            activeTab: 'prototypes',
            itemName: 'demo',
            sourceTargetPath: 'workspace/pages/demo/index.tsx',
            message: '代码检查服务不可用',
        });

        expect(result.file).toBe('workspace/pages/demo/index.tsx');
        expect(result.passed).toBe(false);
        expect(result.mode).toBe('axure-export');
        expect(result.summary.blockingErrors).toBe(1);
        expect(result.issues[0]).toMatchObject({
            rule: 'code-review-api',
            message: '代码检查服务不可用',
            blocking: true,
        });
    });

    it('does not invent a src path when code review fails without explicit source metadata', () => {
        const result = createExportReviewFailureResult({
            activeTab: 'prototypes',
            itemName: 'demo',
            message: '代码检查服务不可用',
        });

        expect(result.file).toBe('demo');
        expect(result.file).not.toContain('src/prototypes/demo/index.tsx');
    });
});
