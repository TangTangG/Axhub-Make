import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readDialogSource() {
    return readFileSync(resolve(__dirname, './CreateDialogView.tsx'), 'utf8');
}

describe('CreateDialogView online template library source', () => {
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
});
