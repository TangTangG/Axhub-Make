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
});
