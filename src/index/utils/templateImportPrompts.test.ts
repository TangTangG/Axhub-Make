import { describe, expect, it } from 'vitest';

import { generateTemplateImportPrompt, type TemplateLibraryPromptItem } from './templateImportPrompts';

const TEMPLATE: TemplateLibraryPromptItem = {
    id: 'ref-antd',
    title: 'Antd 电商后台',
    slug: 'ref-antd',
    sourcePath: 'templates/ref-antd',
    sourceUrl: 'https://github.com/lintendo/Make-Template/tree/main/apps/make-template/templates/ref-antd',
    coverPath: 'covers/ref-antd.svg',
    description: 'Ant Design 风格的电商后台数据看板模板',
    extraDependencies: [],
};

describe('generateTemplateImportPrompt', () => {
    it('keeps the template import prompt concise and path-complete', () => {
        const prompt = generateTemplateImportPrompt({
            template: TEMPLATE,
            repo: 'lintendo/Make-Template',
        });

        expect(prompt).toContain('https://github.com/lintendo/Make-Template/tree/main/apps/make-template/templates/ref-antd');
        expect(prompt).toContain('src/prototypes/ref-antd');
        expect(prompt).toContain('项目 metadata 声明的 prototypes 目录');
        expect(prompt).toContain('index.tsx');
        expect(prompt).toContain('构建或运行验证');
        expect(prompt).not.toContain('metadata/navigation');
        expect(prompt).not.toContain('同步或补充');
        expect(prompt).not.toContain('标题：');
        expect(prompt).not.toContain('描述：');
        expect(prompt).not.toContain('pnpm');
    });

    it('requires dependency installation work when extraDependencies is non-empty', () => {
        const prompt = generateTemplateImportPrompt({
            template: {
                ...TEMPLATE,
                id: 'ref-three',
                slug: 'ref-three',
                sourcePath: 'templates/ref-three',
                extraDependencies: ['three', '@react-three/fiber'],
            },
            repo: 'lintendo/Make-Template',
        });

        expect(prompt).toContain('额外依赖');
        expect(prompt).toContain('three');
        expect(prompt).toContain('@react-three/fiber');
        expect(prompt).toContain('npm');
        expect(prompt).not.toContain('pnpm');
        expect(prompt).toContain('安装缺失依赖');
        expect(prompt).toContain('验证项目构建/运行');
    });
});
