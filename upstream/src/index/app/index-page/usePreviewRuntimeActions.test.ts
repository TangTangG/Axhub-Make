import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('usePreviewRuntimeActions source', () => {
  it('actively asks the preview runtime to resend runtimeReady when starting a handshake', () => {
    const source = readFileSync(resolve(__dirname, './usePreviewRuntimeActions.ts'), 'utf8');

    expect(source).toContain('beginQuickEditRuntimeHandshake: (iframe?: HTMLIFrameElement | null) => void;');
    expect(source).toContain("postToPreview({ type: 'axhub.quickEdit.requestRuntimeReady' }, iframe);");
    expect(source).toContain("setQuickEditRuntimeStatus('pending');");
    expect(source).toContain("setQuickEditRuntimeStatus('missing');");
  });
});
