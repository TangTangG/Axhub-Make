import { describe, expect, it } from 'vitest';
import { buildObsidianOpenUrl } from './obsidian';

describe('buildObsidianOpenUrl', () => {
    it('builds obsidian open deeplink with encoded absolute path', () => {
        expect(buildObsidianOpenUrl('/Users/demo/project/src/resources/spec-template.md'))
            .toBe('obsidian://open?path=%2FUsers%2Fdemo%2Fproject%2Fsrc%2Fresources%2Fspec-template.md');
    });

    it('returns empty string when file path is missing', () => {
        expect(buildObsidianOpenUrl('')).toBe('');
    });

    it('returns empty string when file path is not absolute', () => {
        expect(buildObsidianOpenUrl('src/resources/spec-template.md')).toBe('');
    });
});
