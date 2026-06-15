import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readIndexDialogsSource() {
    return readFileSync(resolve(__dirname, './IndexDialogs.tsx'), 'utf8');
}

describe('IndexDialogs source', () => {
    it('loads the create dialogs through the main React graph', () => {
        const source = readIndexDialogsSource();

        expect(source).toContain("import CreateDialogContainer from '../dialogs/CreateDialogContainer';");
        expect(source).toContain("import CreateThemeDialogContainer from '../dialogs/CreateThemeDialogContainer';");
        expect(source).not.toContain("React.lazy(() => import('../dialogs/CreateDialogContainer'))");
        expect(source).not.toContain("React.lazy(() => import('../dialogs/CreateThemeDialogContainer'))");
    });

    it('forwards direct import target options into the create dialog container', () => {
        const source = readIndexDialogsSource();

        expect(source).toContain('activeProjectId: createDialog.activeProjectId');
        expect(source).toContain('initialUploadType: createDialog.initialUploadType');
        expect(source).toContain('targetPrototypeName: createDialog.targetPrototypeName');
    });
});
