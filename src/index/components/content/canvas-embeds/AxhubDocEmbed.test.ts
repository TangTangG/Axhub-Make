import { describe, expect, it } from 'vitest';

import { normalizeFetchedMarkdownContent } from './AxhubDocEmbed';

describe('AxhubDocEmbed markdown content normalization', () => {
    it('unwraps project document content API JSON responses before rendering markdown', () => {
        const rawResponse = JSON.stringify({
            content: '# 健身 App 需求文档\n\n## 0. 文档信息',
            path: '/workspace/docs/fitness-app.md',
        });

        expect(normalizeFetchedMarkdownContent(rawResponse)).toBe('# 健身 App 需求文档\n\n## 0. 文档信息');
    });

    it('keeps ordinary markdown response text unchanged', () => {
        const markdown = '# Ordinary Markdown\n\n- item';

        expect(normalizeFetchedMarkdownContent(markdown)).toBe(markdown);
    });

    it('keeps JSON-looking documents unchanged when they are not content wrappers', () => {
        const jsonDocument = '{"title":"API Example","body":"still documentation"}';

        expect(normalizeFetchedMarkdownContent(jsonDocument)).toBe(jsonDocument);
    });
});
