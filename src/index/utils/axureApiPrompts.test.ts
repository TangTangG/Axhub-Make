import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';

import { AXURE_API_FIXED_RULE_PATHS, buildAxureApiUpdatePrompt } from './axureApiPrompts';

const NON_CLIENT_RELATIVE_PATH_PATTERN = /(?:^|[\s`"'：（(【\[])(?:\/(?:src|skills|rules|temp|docs|database|themes|prototypes|components|assets|media|\.axhub|scripts)\/|~\/|[A-Za-z]:[\\/]|(?:apps|Users|private|var|tmp)[\\/])/u;

function expectPromptHasNoNonClientRelativePaths(prompt: string): void {
    expect(prompt).not.toMatch(NON_CLIENT_RELATIVE_PATH_PATTERN);
}

function expectClientRulePathExists(rulePath: string): void {
    expect(rulePath.startsWith('/')).toBe(false);
    expect(existsSync(new URL(`../../../client/${rulePath}`, import.meta.url))).toBe(true);
}

describe('buildAxureApiUpdatePrompt', () => {
    it('injects fixed skill names, client-relative rule paths, and target resource', () => {
        const prompt = buildAxureApiUpdatePrompt({
            activeTab: 'components',
            itemName: 'ref-button',
        });

        for (const rulePath of AXURE_API_FIXED_RULE_PATHS) {
            expect(prompt).toContain(`\`${rulePath}\``);
            expectClientRulePathExists(rulePath);
        }

        expect(prompt).toContain('Axure 导出工作流');
        expect(prompt).toContain('Axure API 规范');
        expect(prompt).toContain('rules/axure-export-workflow.md');
        expect(prompt).toContain('rules/axure-api-guide.md');
        expect(prompt).toContain('`ref-button`');
        expect(prompt).not.toContain('`src/components/ref-button/index.tsx`');
        expect(prompt).not.toContain('`src/components/ref-button/spec.md`');
        expect(prompt).not.toContain('`/rules/axure-export-workflow.md`');
        expect(prompt).not.toContain('`/rules/axure-api-guide.md`');
        expectPromptHasNoNonClientRelativePaths(prompt);
    });

    it('uses fixed prompt instructions without preview context', () => {
        const prompt = buildAxureApiUpdatePrompt({
            activeTab: 'prototypes',
            itemName: 'home',
        });

        expect(prompt).toContain('严格按固定要求处理，不依赖已有解析结果');
        expect(prompt).toContain('如当前文件缺失任意列表，完整新增并保证可被静态识别');
        expect(prompt).toContain('列出 5 类列表各自是“新增 / 更新 / 保持不变”');
    });

    it('does not include dynamic preview summary or json block', () => {
        const prompt = buildAxureApiUpdatePrompt({
            activeTab: 'components',
            itemName: 'empty-demo',
        });

        expect(prompt).not.toContain('当前解析现状（来自当前组件/原型）');
        expect(prompt).not.toContain('当前 API 结构化输入（JSON）');
        expect(prompt).not.toContain('```json');
    });
});
