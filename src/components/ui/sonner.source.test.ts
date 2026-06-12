import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
    return readFileSync(resolve(__dirname, './sonner.tsx'), 'utf8');
}

describe('Sonner toaster source', () => {
    it('keeps all toast variants on an opaque themed surface', () => {
        const source = readSource();

        expect(source).toContain('const baseToastStyle');
        expect(source).toContain("'--normal-bg': 'hsl(var(--popover))'");
        expect(source).toContain("backgroundColor: 'hsl(var(--popover))'");
        expect(source).toContain('toastOptions');
        expect(source).toContain('...baseToastStyle');
        expect(source).toContain('toastOptions={mergedToastOptions}');
        expect(source).not.toContain("'--normal-bg': 'transparent'");
        expect(source).not.toContain('"--normal-bg": "transparent"');
    });
});
