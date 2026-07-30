import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexSrcRoot = resolve(__dirname, '..');

function readIndexSource(relativePath: string) {
    return readFileSync(resolve(indexSrcRoot, relativePath), 'utf8');
}

describe('Phase 5 quick editing regression boundary', () => {
    it('keeps spec quick edit helpers while avoiding the removed editor-mode hook', () => {
        expect(existsSync(resolve(indexSrcRoot, 'utils/specQuickEdit.ts'))).toBe(true);
        expect(existsSync(resolve(indexSrcRoot, 'domains/preview/hooks/useEditorModes.ts'))).toBe(false);
    });

    it('keeps Markdown comment/edit state defaults in shared index helpers', () => {
        const source = readIndexSource('app/index-page.helpers.ts');

        expect(source).toContain('MarkdownQuickEditMode');
        expect(source).toContain('MarkdownQuickEditState');
        expect(source).toContain('createDefaultMarkdownQuickEditState');
        expect(source).toContain("quickEditMode: 'comment'");
    });
});
