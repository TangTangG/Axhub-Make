import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readDialogSource() {
    return readFileSync(resolve(__dirname, './CreateThemeDialogView.tsx'), 'utf8');
}

describe('CreateThemeDialogView theme import upload source', () => {
    it('uses Make ZIP as the only upload source in the import upload panel', () => {
        const source = readDialogSource();

        expect(source).toContain("const THEME_IMPORT_UPLOAD_TYPE = 'make_zip'");
        expect(source).toContain("formData.append('uploadType', THEME_IMPORT_UPLOAD_TYPE)");
        expect(source).toContain('上传 Axhub Make 导出的 ZIP 包，系统会直接解压到主题目录。');
        expect(source).not.toContain('本地 Axure ZIP');
        expect(source).not.toContain('importOptions.map');
        expect(source).not.toContain("importSource === 'make_zip' ? 'local_axure'");
        expect(source).not.toContain("setImportSource('local_axure')");
    });

    it('does not cancel the online theme library request when marking it as loading', () => {
        const source = readDialogSource();
        const effectMatch = source.match(/useEffect\(\(\) => \{[\s\S]*?fetch\('\/api\/theme-library'\)[\s\S]*?\}, \[([^\]]+)\]\);/);

        expect(effectMatch).not.toBeNull();
        const dependencies = effectMatch?.[1] || '';
        expect(dependencies).not.toContain('themeLibrary.loading');
        expect(effectMatch?.[0] || '').not.toContain("|| themeLibrary.loading ||");
    });

    it('treats ok false theme library payloads as failed loads', () => {
        const source = readDialogSource();
        const effectMatch = source.match(/fetch\('\/api\/theme-library'\)[\s\S]*?setThemeLibrary\(\{/);

        expect(effectMatch).not.toBeNull();
        expect(effectMatch?.[0] || '').toContain('result?.ok === false');
        expect(effectMatch?.[0] || '').toContain("throw new Error(result?.error || '设计系统库读取失败')");
    });

    it('renders online theme library cards with the same cover and direct-import tooltip pattern as templates', () => {
        const source = readDialogSource();

        expect(source).toContain("import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';");
        expect(source).toContain('coverUrl: string;');
        expect(source).toContain('src={designSystem.coverUrl}');
        expect(source).toContain("className=\"overflow-hidden rounded-md border bg-background\"");
        expect(source).toContain("const disabledReason = designSystem.directImportDisabledReason || (!designSystem.canDirectImport ? '直接导入不可用' : '');");
        expect(source).toContain('const directImportTooltip = disabledReason');
        expect(source).toContain('已有设计系统正在导入，请稍候');
        expect(source).toContain('<TooltipProvider>');
        expect(source).not.toContain("title={disabledReason || undefined}");
        expect(source).not.toContain('需 AI 处理');
    });

    it('hides entry and token file paths in online theme library cards', () => {
        const source = readDialogSource();

        expect(source).not.toContain('入口：{designSystem.entryPath}');
        expect(source).not.toContain('Token：{designSystem.tokenPath}');
    });
});
