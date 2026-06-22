import { describe, expect, it } from 'vitest';

import {
    buildSpecTemplatePreviewUrl,
    resolveMarkdownPreviewIframeUrl,
} from './markdownPreview';

describe('markdown preview url helpers', () => {
    it('wraps metadata-only markdown templates in the rendered preview shell', () => {
        expect(resolveMarkdownPreviewIframeUrl({
            name: 'write-prd.md',
            specUrl: '/api/docs/templates/write-prd.md',
        }, 'template')).toBe('/spec-template.html?url=%2Fapi%2Fdocs%2Ftemplates%2Fwrite-prd.md');
    });

    it('derives rendered preview URLs when selected markdown items skipped normalization', () => {
        expect(resolveMarkdownPreviewIframeUrl({
            name: 'write-prd.md',
        }, 'template')).toBe('/spec-template.html?url=%2Fapi%2Fdocs%2Ftemplates%2Fwrite-prd.md');

        expect(resolveMarkdownPreviewIframeUrl({
            name: 'guide.md',
        }, 'doc')).toBe('/spec-template.html?url=%2Fapi%2Fdocs%2Fguide.md');
    });

    it('does not wrap markdown URLs twice and leaves non-markdown previews direct', () => {
        const renderedUrl = buildSpecTemplatePreviewUrl('/api/docs/templates/write-prd.md');

        expect(resolveMarkdownPreviewIframeUrl({
            name: 'write-prd.md',
            previewUrl: renderedUrl,
        }, 'template')).toBe(renderedUrl);

        expect(resolveMarkdownPreviewIframeUrl({
            name: 'assets/logo.png',
            previewUrl: '/api/docs/assets%2Flogo.png',
        }, 'doc')).toBe('/api/docs/assets%2Flogo.png');
    });

    it('wraps project content endpoints and local markdown paths in the rendered preview shell', () => {
        expect(resolveMarkdownPreviewIframeUrl({
            name: 'prd',
            specUrl: '/api/projects/client-project/docs/prd/content',
        }, 'doc')).toBe('/spec-template.html?url=%2Fapi%2Fprojects%2Fclient-project%2Fdocs%2Fprd%2Fcontent');

        expect(resolveMarkdownPreviewIframeUrl({
            name: 'local-prd',
            absoluteFilePath: '/workspace/client/src/resources/local-prd.md',
        }, 'doc')).toBe('/spec-template.html?url=%2Fapi%2Fmarkdown-file%3Fpath%3D%252Fworkspace%252Fclient%252Fsrc%252Fresources%252Flocal-prd.md');
    });

    it('keeps HTML resources on direct iframe URLs so the HTML bootstrap can expose page annotation', () => {
        expect(resolveMarkdownPreviewIframeUrl({
            name: 'visual-prd.html',
            specUrl: '/api/markdown-file?path=%2Fworkspace%2Fclient%2Fsrc%2Fresources%2Fvisual-prd.html',
        }, 'doc')).toBe('/api/markdown-file?path=%2Fworkspace%2Fclient%2Fsrc%2Fresources%2Fvisual-prd.html');

        expect(resolveMarkdownPreviewIframeUrl({
            name: 'visual-prd.html',
            absoluteFilePath: '/workspace/client/src/resources/visual-prd.html',
        }, 'doc')).toBe('/api/markdown-file?path=%2Fworkspace%2Fclient%2Fsrc%2Fresources%2Fvisual-prd.html');

        expect(resolveMarkdownPreviewIframeUrl({
            name: 'landing.html',
        }, 'template')).toBe('/api/docs/templates/landing.html');
    });
});
