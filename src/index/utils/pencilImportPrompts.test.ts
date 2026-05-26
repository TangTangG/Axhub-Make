import { describe, expect, it } from 'vitest';

import { generatePencilImportPrompt } from './pencilImportPrompts';

const PROMPT_PATH_PATTERN = /(?:^|[\s`"'：（(【\[])(?:\/?(?:src|skills|rules|temp|docs|database|themes|prototypes|components|assets|media|\.axhub|scripts)\/|~\/|[A-Za-z]:[\\/]|(?:[A-Za-z0-9_.-]+[\\/]){2,})/u;

function expectPromptHasNoPaths(prompt: string): void {
    expect(prompt).not.toMatch(PROMPT_PATH_PATTERN);
}

describe('generatePencilImportPrompt', () => {
    it('includes required no-upload + MCP gating + user decisions + output + acceptance checks', () => {
        const prompt = generatePencilImportPrompt({
            targetType: 'prototypes',
            docs: [
                '/skills/pencil-import-workflow/SKILL.md',
                '/skills/pencil-sync-after-prototype-workflow/SKILL.md',
                '/skills/mcp-installer/SKILL.md',
            ],
        });

        expect(prompt).toContain('无需上传文件');
        expect(prompt).toContain('Pencil MCP');
        expect(prompt).toContain('Pencil 导入工作流');
        expect(prompt).toContain('Pencil 同步工作流');
        expect(prompt).toContain('MCP 配置检查说明');
        expect(prompt).toContain('`mcp__pencil__get_editor_state`');
        expect(prompt).toContain('`mcp__pencil__batch_get`');

        // Must require user decisions without recommendation.
        expect(prompt).toContain('需要用户决定');
        expect(prompt).toContain('导入范围');
        expect(prompt).toContain('输出结构');
        expect(prompt).toContain('A. 单原型多屏');
        expect(prompt).toContain('B. 多原型批量');
        expect(prompt).toContain('不要推荐');
        expect(prompt).not.toContain('Recommended');

        // Output descriptions and acceptance checks should not expose concrete paths.
        expect(prompt).toContain('生成 1 个原型资源');
        expect(prompt).toContain('每个 Frame 生成 1 个原型资源');
        expect(prompt).toContain('来源说明');
        expect(prompt).not.toContain('规格说明');
        expect(prompt).toContain('运行入口');
        expect(prompt).toContain('项目就绪检查');
        expect(prompt).not.toContain('`src/prototypes/<name>/`');
        expect(prompt).not.toContain('`src/prototypes/<name>/spec.md`');
        expect(prompt).not.toContain('`src/prototypes/<name>/index.tsx`');
        expect(prompt).not.toContain('`node scripts/check-app-ready.mjs /prototypes/<name>`');
        expectPromptHasNoPaths(prompt);
    });
});
