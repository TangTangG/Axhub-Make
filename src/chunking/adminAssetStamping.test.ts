import { describe, expect, it } from 'vitest';

import { stampAdminAssetUrlsForContent } from './adminAssetStamping';

describe('stampAdminAssetUrlsForContent', () => {
    it('does not stamp JavaScript module graph imports', () => {
        const source = [
            'import{reactExports as React}from"./chunks/vendor-react.js";',
            'const Dialog = React.lazy(() => import("./chunks/CreateDialogContainer.js"));',
            'import{PromptActionButton}from"../index.js";',
        ].join('\n');

        expect(stampAdminAssetUrlsForContent(source, '12345', '.js')).toBe(source);
    });

    it('stamps HTML asset references', () => {
        const source = [
            '<script type="module" src="/assets/index.js"></script>',
            '<link rel="stylesheet" href="/assets/index.css">',
            '<img src="../images/logo.svg">',
        ].join('\n');

        expect(stampAdminAssetUrlsForContent(source, '12345', '.html')).toContain('/assets/index.js?v=12345');
        expect(stampAdminAssetUrlsForContent(source, '12345', '.html')).toContain('/assets/index.css?v=12345');
        expect(stampAdminAssetUrlsForContent(source, '12345', '.html')).toContain('../images/logo.svg?v=12345');
    });
});
