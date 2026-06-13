import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readDialogSource() {
    return readFileSync(resolve(__dirname, './CreateDialogView.tsx'), 'utf8');
}

function readTemplateLibraryCardSource() {
    return readFileSync(resolve(__dirname, './TemplateLibraryCard.tsx'), 'utf8');
}

describe('CreateDialogView online template library source', () => {
    it('includes optional preview and author metadata in online template library item type', () => {
        const source = readDialogSource();
        const typeMatch = source.match(/interface TemplateLibraryItem[\s\S]*?\n}/);

        expect(typeMatch).not.toBeNull();
        expect(typeMatch?.[0] || '').toContain('previewUrl?: string;');
        expect(typeMatch?.[0] || '').toContain('author?: string;');
        expect(typeMatch?.[0] || '').toContain('authorUrl?: string;');
    });

    it('treats ok false template library payloads as failed loads', () => {
        const source = readDialogSource();
        const effectMatch = source.match(new RegExp("fetch\\('/api/template-library'\\)[\\s\\S]*?setTemplateLibrary\\(\\{"));

        expect(effectMatch).not.toBeNull();
        expect(effectMatch?.[0] || '').toContain('result?.ok === false');
        expect(effectMatch?.[0] || '').toContain("throw new Error(result?.error || '模板库读取失败')");
    });

    it('does not cancel the online template library request when marking it as loading', () => {
        const source = readDialogSource();
        const effectMatch = source.match(new RegExp("useEffect\\(\\(\\) => \\{[\\s\\S]*?fetch\\('/api/template-library'\\)[\\s\\S]*?\\}, \\[([^\\]]+)\\]\\);"));

        expect(effectMatch).not.toBeNull();
        const dependencies = effectMatch?.[1] || '';
        expect(dependencies).not.toContain('templateLibrary.loading');
        expect(effectMatch?.[0] || '').not.toContain("|| templateLibrary.loading ||");
    });

    it('opens template previews from the whole card and warns when previewUrl is missing', () => {
        const source = readDialogSource();
        const cardSource = readTemplateLibraryCardSource();

        expect(source).toContain('onPreview={handleTemplatePreviewCardClick}');
        expect(cardSource).toContain('onClick={() => onPreview?.(template)}');
        expect(cardSource).toContain("template.previewUrl ? '点击打开在线预览' : '该模板暂不支持在线预览'");
        expect(source).toContain("toast.warning('该模板暂不支持在线预览')");
        expect(cardSource).not.toContain('<Globe className="h-3.5 w-3.5" />');
        expect(cardSource).not.toContain('href={template.previewUrl}');
    });

    it('renders author metadata in the old path position and keeps actions low emphasis', () => {
        const source = readDialogSource();
        const cardSource = readTemplateLibraryCardSource();

        expect(cardSource).toContain("const authorLabel = String(template.author || '').trim();");
        expect(cardSource).toContain('authorLabel ? (');
        expect(cardSource).toContain('href={template.authorUrl}');
        expect(cardSource).toContain('作者：{authorLabel}');
        expect(cardSource).toContain('{template.sourcePath}');
        expect(cardSource).toContain('line-clamp-2 break-words text-[12px] leading-5 text-muted-foreground [overflow-wrap:anywhere]');
        expect(cardSource).toContain('variant="ghost"');
        expect(cardSource).toContain('onClick={(event) => event.stopPropagation()}');
        expect(cardSource).toContain('onKeyDown={(event) => event.stopPropagation()}');
        expect(source).toContain('const directDisabled = Boolean(disabledReason) || !template.canDirectImport || Boolean(templateImportingId);');
        expect(source).not.toContain('directDisabled = Boolean(template.previewUrl)');
    });
});
