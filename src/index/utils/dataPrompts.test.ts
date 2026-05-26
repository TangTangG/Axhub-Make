import { describe, expect, it } from 'vitest';

import {
    generateCreateDataPrompt,
    generateDataImportLinkPrompt,
    generateDataImportUploadPrompt,
} from './dataPrompts';

const PROMPT_PATH_PATTERN = /(?:^|[\s`"'：（(【\[])(?:\/?(?:src|skills|rules|temp|docs|database|themes|prototypes|assets|media|\.axhub)\/|~\/|[A-Za-z]:[\\/]|(?:[A-Za-z0-9_.-]+[\\/]){2,})/u;

function expectPromptHasNoPaths(prompt: string): void {
    expect(prompt).not.toMatch(PROMPT_PATH_PATTERN);
}

describe('data import prompts', () => {
    it('generates create data prompt without forcing paths or baked-in process instructions', () => {
        const prompt = generateCreateDataPrompt({ tableName: '用户表' });

        expect(prompt).toContain('新建一个数据资产');
        expect(prompt).not.toContain('项目当前数据资源约定的位置');
        expect(prompt).not.toContain('`/src/database/README.md`');
        expect(prompt).not.toContain('`src/database/<table-name>.json`');
        expect(prompt).toContain('用户表');
        expect(prompt).not.toContain('⚠️ **重要提示**');
        expect(prompt).not.toContain('先完成需求对齐');
        expect(prompt).not.toContain('确认前不要');
        expect(prompt).not.toContain('首次回复模板');
        expect(prompt).not.toContain('收到，准备');
        expect(prompt).not.toContain('**系统交互要求**');
        expect(prompt).not.toContain('**执行要求**');
        expect(prompt).not.toContain('**完成后请输出**');
        expect(prompt).not.toContain('文件路径');
        expectPromptHasNoPaths(prompt);
    });

    it('generates axure link prompt without forcing a data target path', () => {
        const prompt = generateDataImportLinkPrompt('axure_prototype');

        expect(prompt).toContain('Axure 原型链接');
        expect(prompt).toContain('数据导入规范');
        expect(prompt).toContain('项目当前数据资源约定的位置');
        expect(prompt).not.toContain('`src/database/<table-name>.json`');
        expect(prompt).not.toContain('v0');
        expect(prompt).not.toContain('google_aistudio');
        expect(prompt).not.toContain('figma_make');
        expect(prompt).not.toContain('figma-make-project-converter');
        expectPromptHasNoPaths(prompt);
    });

    it('generates webpage link prompt without forcing a data target path', () => {
        const prompt = generateDataImportLinkPrompt('web_page');

        expect(prompt).toContain('网页链接');
        expect(prompt).toContain('数据导入规范');
        expect(prompt).toContain('项目当前数据资源约定的位置');
        expect(prompt).not.toContain('`src/database/<table-name>.json`');
        expect(prompt).not.toContain('v0');
        expect(prompt).not.toContain('google_aistudio');
        expect(prompt).not.toContain('figma_make');
        expect(prompt).not.toContain('figma-make-project-converter');
        expectPromptHasNoPaths(prompt);
    });

    it('summarizes uploaded local zip context without exposing upload paths', () => {
        const prompt = generateDataImportUploadPrompt('local_axure', {
            filePath: 'temp/local-axure-upload/demo',
        });

        expect(prompt).toContain('本地 Axure ZIP');
        expect(prompt).toContain('上传上下文已由系统提供');
        expect(prompt).toContain('项目当前数据资源约定的位置');
        expect(prompt).not.toContain('`temp/local-axure-upload/demo`');
        expect(prompt).not.toContain('`src/database/<table-name>.json`');
        expect(prompt).not.toContain('figma_make');
        expect(prompt).not.toContain('figma-make-project-converter');
        expectPromptHasNoPaths(prompt);
    });

    it('summarizes screenshot file count without exposing file paths', () => {
        const prompt = generateDataImportUploadPrompt('screenshot', {
            files: [
                'temp/screenshots/batch-1/home.png',
                'temp/screenshots/batch-1/detail.png',
            ],
        });

        expect(prompt).toContain('截图');
        expect(prompt).toContain('已选择 2 个上传文件');
        expect(prompt).not.toContain('`temp/screenshots/batch-1/home.png`');
        expect(prompt).not.toContain('`temp/screenshots/batch-1/detail.png`');
        expect(prompt).toContain('项目当前数据资源约定的位置');
        expect(prompt).not.toContain('`src/database/<table-name>.json`');
        expect(prompt).not.toContain('figma_make');
        expect(prompt).not.toContain('figma-make-project-converter');
        expectPromptHasNoPaths(prompt);
    });
});
