import { describe, expect, it } from 'vitest';

import {
    generateCreateDocPrompt,
    generateDeleteDocReferencePrompt,
    generateDeleteTemplateReferencePrompt,
    generateRenameDocReferencePrompt,
    generateRenameTemplateReferencePrompt,
} from './docPrompts';

const PROMPT_PATH_PATTERN = /(?:^|[\s`"'：（(【\[])(?:\/?(?:src|skills|rules|temp|docs|database|themes|prototypes|assets|media|\.axhub)\/|~\/|[A-Za-z]:[\\/]|(?:[A-Za-z0-9_.-]+[\\/]){2,})/u;

function expectPromptHasNoPaths(prompt: string): void {
    expect(prompt).not.toMatch(PROMPT_PATH_PATTERN);
}

describe('generateCreateDocPrompt', () => {
    it('does not include fixed role identity in create doc system instruction', () => {
        const prompt = generateCreateDocPrompt([], [], [], [], []);
        expect(prompt).toContain('**任务**：新建一个文档');
        expect(prompt).not.toContain('UI/UX 设计架构师 × 前端工程师（复合型）');
    });

    it('includes selected docs as resource references without forcing local src/resources paths', () => {
        const prompt = generateCreateDocPrompt(
            ['project-overview.md'],
            [{ name: 'project-overview.md', displayName: '项目总览' }],
            [],
            [],
        );

        expect(prompt).toContain('**参考文档**');
        expect(prompt).toContain('`project-overview.md`');
        expectPromptHasNoPaths(prompt);
        expect(prompt).not.toContain('`src/resources/project-overview.md`');
        expect(prompt).toContain('项目总览');
    });

    it('includes selected data assets without forcing local src/database paths', () => {
        const prompt = generateCreateDocPrompt(
            [],
            [],
            ['users.json'],
            [{ name: 'users.json', displayName: '用户数据' }],
        );

        expect(prompt).toContain('**参考数据**');
        expect(prompt).toContain('`users.json`');
        expectPromptHasNoPaths(prompt);
        expect(prompt).not.toContain('`src/database/users.json`');
        expect(prompt).toContain('用户数据');
    });

    it('includes selected templates without forcing local src/resources/templates paths', () => {
        const prompt = generateCreateDocPrompt(
            [],
            [],
            [],
            [],
            ['spec-template.md'],
            [{ name: 'spec-template.md', displayName: '规格文档模板' }],
        );

        expect(prompt).toContain('**参考模板**');
        expect(prompt).toContain('`spec-template.md`');
        expectPromptHasNoPaths(prompt);
        expect(prompt).not.toContain('`src/resources/templates/spec-template.md`');
        expect(prompt).toContain('规格文档模板');
    });

    it('includes selected reference prototypes with a simple guidance line', () => {
        const prompt = generateCreateDocPrompt(
            [],
            [],
            [],
            [],
            [],
            [],
            ['ref-app-home'],
            [{ name: 'ref-app-home', displayName: '首页原型' }],
        );

        expect(prompt).toContain('**参考原型**');
        expect(prompt).toContain('`ref-app-home`');
        expectPromptHasNoPaths(prompt);
        expect(prompt).not.toContain('`src/prototypes/ref-app-home/`');
        expect(prompt).toContain('首页原型');
    });

    it('does not force a target docs directory for new document output', () => {
        const prompt = generateCreateDocPrompt([], [], [], [], []);

        expect(prompt).not.toContain('**目标目录**：`src/resources`');
        expect(prompt).not.toContain('`src/resources/<file>.md`');
        expect(prompt).not.toContain('项目当前文档资源约定的位置');
        expect(prompt).not.toContain('文件路径');
        expectPromptHasNoPaths(prompt);
    });

    it('does not include baked-in process, write, or response-template instructions', () => {
        const prompt = generateCreateDocPrompt([], [], [], [], []);

        expect(prompt).not.toContain('⚠️ **重要提示**');
        expect(prompt).not.toContain('先完成需求对齐');
        expect(prompt).not.toContain('确认前不要');
        expect(prompt).not.toContain('未完成对齐前不要');
        expect(prompt).not.toContain('首次回复模板');
        expect(prompt).not.toContain('收到，准备');
        expect(prompt).not.toContain('**系统交互要求**');
        expect(prompt).not.toContain('**完成后请输出**');
    });
});

describe('generateRenameDocReferencePrompt', () => {
    it('includes document names and reference count without exposing paths', () => {
        const prompt = generateRenameDocReferencePrompt({
            docName: 'project-overview.md',
            currentDisplayName: '项目总览',
            nextBaseName: 'project-summary',
            references: ['rules/self-evolution-guide.md', 'skills/web-page-workflow/doc-generation.md'],
        });

        expect(prompt).toContain('项目总览');
        expect(prompt).toContain('`project-overview.md`');
        expect(prompt).toContain('`project-summary.md`');
        expect(prompt).toContain('已检测到 2 处项目内引用');
        expectPromptHasNoPaths(prompt);
        expect(prompt).not.toContain('`src/resources/project-overview.md`');
        expect(prompt).not.toContain('`src/resources/project-summary.md`');
        expect(prompt).not.toContain('`rules/self-evolution-guide.md`');
        expect(prompt).not.toContain('`skills/web-page-workflow/doc-generation.md`');
        expect(prompt).toContain('再执行文档重命名');
    });
});

describe('generateDeleteDocReferencePrompt', () => {
    it('includes target document name and reference count without exposing paths', () => {
        const prompt = generateDeleteDocReferencePrompt({
            docName: 'page-map.md',
            currentDisplayName: '页面地图',
            references: ['src/resources/project-overview.md'],
        });

        expect(prompt).toContain('页面地图');
        expect(prompt).toContain('`page-map.md`');
        expect(prompt).toContain('已检测到 1 处项目内引用');
        expectPromptHasNoPaths(prompt);
        expect(prompt).not.toContain('`src/resources/page-map.md`');
        expect(prompt).not.toContain('`src/resources/project-overview.md`');
        expect(prompt).toContain('确认所有引用都已清理后，再删除该文档');
    });
});

describe('generateRenameTemplateReferencePrompt', () => {
    it('includes template names and reference count without exposing paths', () => {
        const prompt = generateRenameTemplateReferencePrompt({
            templateName: 'spec-template.md',
            currentDisplayName: '规格模板',
            nextBaseName: 'spec-template-v2',
            references: ['rules/design-guide.md', 'src/resources/project-overview.md'],
        });

        expect(prompt).toContain('规格模板');
        expect(prompt).toContain('`spec-template.md`');
        expect(prompt).toContain('`spec-template-v2.md`');
        expect(prompt).toContain('已检测到 2 处项目内引用');
        expectPromptHasNoPaths(prompt);
        expect(prompt).not.toContain('`src/resources/templates/spec-template.md`');
        expect(prompt).not.toContain('`src/resources/templates/spec-template-v2.md`');
        expect(prompt).not.toContain('`rules/design-guide.md`');
        expect(prompt).not.toContain('`src/resources/project-overview.md`');
        expect(prompt).toContain('再执行模板重命名');
    });
});

describe('generateDeleteTemplateReferencePrompt', () => {
    it('includes target template name and reference count without exposing paths', () => {
        const prompt = generateDeleteTemplateReferencePrompt({
            templateName: 'spec-template.md',
            currentDisplayName: '规格模板',
            references: ['skills/workflow.md'],
        });

        expect(prompt).toContain('规格模板');
        expect(prompt).toContain('`spec-template.md`');
        expect(prompt).toContain('已检测到 1 处项目内引用');
        expectPromptHasNoPaths(prompt);
        expect(prompt).not.toContain('`src/resources/templates/spec-template.md`');
        expect(prompt).not.toContain('`skills/workflow.md`');
        expect(prompt).toContain('确认所有引用都已清理后，再删除该模板');
    });
});
