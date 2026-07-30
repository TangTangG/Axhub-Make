import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';

import { AXURE_EXPORT_REVIEW_RULE_PATHS, buildExportReviewPrompt, createExportReviewFailureResult } from './exportReviewPrompt';

const NON_CLIENT_RELATIVE_PATH_PATTERN = /(?:^|[\s`"'：（(【\[])(?:\/(?:src|skills|rules|temp|docs|database|themes|prototypes|components|assets|media|\.axhub)\/|~\/|[A-Za-z]:[\\/]|(?:apps|Users|private|var|tmp)[\\/])/u;

function expectPromptHasNoNonClientRelativePaths(prompt: string): void {
    expect(prompt).not.toMatch(NON_CLIENT_RELATIVE_PATH_PATTERN);
}

function expectClientRulePathExists(rulePath: string): void {
    expect(rulePath.startsWith('/')).toBe(false);
    expect(existsSync(new URL(`../../../client/${rulePath}`, import.meta.url))).toBe(true);
}

describe('buildExportReviewPrompt', () => {
    it('builds a concise prompt with client-relative rule paths and blocking issues only', () => {
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
        expect(prompt).toContain('rules/axure-export-workflow.md');
        expect(prompt).toContain('rules/axure-api-guide.md');
        for (const rulePath of AXURE_EXPORT_REVIEW_RULE_PATHS) {
            expect(prompt).toContain(rulePath);
            expectClientRulePathExists(rulePath);
        }
        expect(prompt).not.toContain('src/prototypes/demo/index.tsx');
        expect(prompt).not.toContain('/rules/axure-export-workflow.md');
        expect(prompt).not.toContain('/rules/axure-api-guide.md');
        expect(prompt).toContain('阻断问题');
        expect(prompt).toContain('[file-header-mode-axure] 缺少 @mode axure');
        expect(prompt).not.toContain('可选建议');
        expect(prompt).not.toContain('[axure-api-optional] 未接入 Axure API');
        expect(prompt).not.toContain('复杂');
        expectPromptHasNoNonClientRelativePaths(prompt);
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
