import { describe, expect, it } from 'vitest';

import { getMarkdownResourceFilePath, normalizeMarkdownResourceName } from './markdownResourcePath';

describe('normalizeMarkdownResourceName', () => {
    it('normalizes docs names from project-relative and public paths', () => {
        expect(normalizeMarkdownResourceName('doc', 'project-overview.md')).toBe('project-overview.md');
        expect(normalizeMarkdownResourceName('doc', 'src/resources/project-overview.md')).toBe('project-overview.md');
        expect(normalizeMarkdownResourceName('doc', '/docs/project-overview.md')).toBe('project-overview.md');
    });

    it('normalizes template names from template roots', () => {
        expect(normalizeMarkdownResourceName('template', 'spec-template.md')).toBe('spec-template.md');
        expect(normalizeMarkdownResourceName('template', 'templates/spec-template.md')).toBe('spec-template.md');
        expect(normalizeMarkdownResourceName('template', 'src/resources/templates/spec-template.md')).toBe('spec-template.md');
        expect(normalizeMarkdownResourceName('template', '/docs/templates/spec-template.md')).toBe('spec-template.md');
    });
});

describe('getMarkdownResourceFilePath', () => {
    it('returns stable docs file paths without duplicating prefixes', () => {
        expect(getMarkdownResourceFilePath('doc', 'project-overview.md')).toBe('src/resources/project-overview.md');
        expect(getMarkdownResourceFilePath('doc', 'src/resources/project-overview.md')).toBe('src/resources/project-overview.md');
        expect(getMarkdownResourceFilePath('doc', '/docs/project-overview.md')).toBe('src/resources/project-overview.md');
    });

    it('returns stable template file paths without duplicating prefixes', () => {
        expect(getMarkdownResourceFilePath('template', 'spec-template.md')).toBe('src/resources/templates/spec-template.md');
        expect(getMarkdownResourceFilePath('template', 'templates/spec-template.md')).toBe('src/resources/templates/spec-template.md');
        expect(getMarkdownResourceFilePath('template', 'src/resources/templates/spec-template.md')).toBe('src/resources/templates/spec-template.md');
        expect(getMarkdownResourceFilePath('template', '/docs/templates/spec-template.md')).toBe('src/resources/templates/spec-template.md');
    });
});
