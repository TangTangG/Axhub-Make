import { describe, expect, it } from 'vitest';
import {
    buildMarkdownCommentPrompt,
    formatLocatorPath,
    resolveMarkdownQuickEditMeta,
    shouldIgnoreInitialMarkdownEditorChange,
} from './quickEdit';

describe('spec-template quickEdit helpers', () => {
    it('does not treat prototype spec or PRD files as first-class editable documents', () => {
        expect(resolveMarkdownQuickEditMeta('/prototypes/home-page/spec.md')).toMatchObject({
            resourceKind: 'unknown',
            docPath: '',
            prototypePath: '',
        });
        expect(resolveMarkdownQuickEditMeta('/prototypes/home-page/prd.md')).toMatchObject({
            resourceKind: 'unknown',
            docPath: '',
            prototypePath: '',
        });
    });

    it('resolves project markdown-file urls to document paths', () => {
        expect(resolveMarkdownQuickEditMeta('/api/markdown-file?path=%2Fworkspace%2Fsrc%2Fresources%2Fintro.md')).toMatchObject({
            resourceKind: 'doc',
            docType: 'doc',
            docPath: '/workspace/src/resources/intro.md',
            prototypePath: '',
        });
    });

    it('builds an actionable prompt from Markdown comments', () => {
        const result = buildMarkdownCommentPrompt({
            docLabel: '首页说明',
            docUrl: '/docs/home-page.md',
            modifiedElements: [{
                label: '标题',
                note: '补充登录态说明',
                imageCount: 1,
                changeKinds: ['text'],
                locator: { selectors: ['h1', '.hero-title'] },
            }],
        });

        expect(result.targetPath).toBe('src/resources/home-page.md');
        expect(result.prompt).toContain('文档路径: src/resources/home-page.md');
        expect(result.prompt).not.toContain('对应原型入口');
        expect(result.prompt).toContain('批注目标: 标题');
        expect(result.prompt).toContain('预览定位: h1 | .hero-title');
        expect(formatLocatorPath({ path: [0, 2, 1] })).toBe('0>2>1');
    });

    it('ignores the editor initialization markdown echo before user edits', () => {
        expect(shouldIgnoreInitialMarkdownEditorChange({
            savedContent: '# 标题\n正文',
            currentContent: '# 标题\n正文',
            nextContent: '# 标题\n\n正文\n',
            userChanged: false,
        })).toBe(true);
        expect(shouldIgnoreInitialMarkdownEditorChange({
            savedContent: '# 标题\n正文',
            currentContent: '# 标题\n正文',
            nextContent: '# 标题\n\n正文\n',
            userChanged: true,
        })).toBe(false);
        expect(shouldIgnoreInitialMarkdownEditorChange({
            savedContent: '# 标题\n正文',
            currentContent: '# 标题\n已修改',
            nextContent: '# 标题\n\n正文\n',
            userChanged: false,
        })).toBe(false);
        expect(shouldIgnoreInitialMarkdownEditorChange({
            savedContent: '# 标题\n正文',
            currentContent: '# 标题\n正文',
            nextContent: '# 标题\n正文',
            userChanged: false,
        })).toBe(false);
    });
});
