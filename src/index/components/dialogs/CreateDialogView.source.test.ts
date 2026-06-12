import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readDialogSource() {
    return readFileSync(resolve(__dirname, './CreateDialogView.tsx'), 'utf8');
}

describe('CreateDialogView online template library source', () => {
    it('includes optional previewUrl in online template library item type', () => {
        const source = readDialogSource();
        const typeMatch = source.match(/interface TemplateLibraryItem[\s\S]*?\n}/);

        expect(typeMatch).not.toBeNull();
        expect(typeMatch?.[0] || '').toContain('previewUrl?: string;');
    });

    it('treats ok false template library payloads as failed loads', () => {
        const source = readDialogSource();
        const effectMatch = source.match(/fetch\('\/api\/template-library'\)[\s\S]*?setTemplateLibrary\(\{/);

        expect(effectMatch).not.toBeNull();
        expect(effectMatch?.[0] || '').toContain('result?.ok === false');
        expect(effectMatch?.[0] || '').toContain("throw new Error(result?.error || '模板库读取失败')");
    });

    it('does not cancel the online template library request when marking it as loading', () => {
        const source = readDialogSource();
        const effectMatch = source.match(/useEffect\(\(\) => \{[\s\S]*?fetch\('\/api\/template-library'\)[\s\S]*?\}, \[([^\]]+)\]\);/);

        expect(effectMatch).not.toBeNull();
        const dependencies = effectMatch?.[1] || '';
        expect(dependencies).not.toContain('templateLibrary.loading');
        expect(effectMatch?.[0] || '').not.toContain("|| templateLibrary.loading ||");
    });

    it('renders an online preview entry only when the template includes previewUrl', () => {
        const source = readDialogSource();
        const templateCardMatch = source.match(/templateLibrary\.templates\.map\(\(template\) => \{[\s\S]*?handleDirectTemplateImport\(template\)[\s\S]*?<\/TooltipProvider>/);

        expect(templateCardMatch).not.toBeNull();
        const templateCardSource = templateCardMatch?.[0] || '';
        expect(templateCardSource).toContain('template.previewUrl ? (');
        expect(templateCardSource).toContain('在线预览');
        expect(templateCardSource).toContain('href={template.previewUrl}');
    });

    it('opens online previews in a new window without changing direct import disabled logic', () => {
        const source = readDialogSource();
        const templateCardMatch = source.match(/templateLibrary\.templates\.map\(\(template\) => \{[\s\S]*?handleDirectTemplateImport\(template\)[\s\S]*?<\/TooltipProvider>/);

        expect(templateCardMatch).not.toBeNull();
        const templateCardSource = templateCardMatch?.[0] || '';
        expect(templateCardSource).toContain('target="_blank"');
        expect(templateCardSource).toContain('rel="noreferrer"');
        expect(templateCardSource).toContain('const directDisabled = Boolean(disabledReason) || !template.canDirectImport || Boolean(templateImportingId);');
        expect(templateCardSource).not.toContain('directDisabled = Boolean(template.previewUrl)');
    });
});
