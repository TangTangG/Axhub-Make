import { describe, expect, it } from 'vitest';

import { AXURE_API_FIXED_RULE_PATHS, buildAxureApiUpdatePrompt } from './axureApiPrompts';

const PROMPT_PATH_PATTERN = /(?:^|[\s`"'：（(【\[])(?:\/?(?:src|skills|rules|temp|docs|database|themes|prototypes|components|assets|media|\.axhub|scripts)\/|~\/|[A-Za-z]:[\\/]|(?:[A-Za-z0-9_.-]+[\\/]){2,})/u;

function expectPromptHasNoPaths(prompt: string): void {
    expect(prompt).not.toMatch(PROMPT_PATH_PATTERN);
    expect(prompt).not.toContain('路径');
}

describe('buildAxureApiUpdatePrompt', () => {
    it('injects fixed skill names and target resource without exposing paths', () => {
        const prompt = buildAxureApiUpdatePrompt({
            activeTab: 'components',
            itemName: 'ref-button',
        });

        for (const rulePath of AXURE_API_FIXED_RULE_PATHS) {
            expect(prompt).not.toContain(`\`${rulePath}\``);
        }

        expect(prompt).toContain('Axure 导出工作流');
        expect(prompt).toContain('Axure API 规范');
        expect(prompt).toContain('`ref-button`');
        expect(prompt).not.toContain('`src/components/ref-button/index.tsx`');
        expect(prompt).not.toContain('`src/components/ref-button/spec.md`');
        expectPromptHasNoPaths(prompt);
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
