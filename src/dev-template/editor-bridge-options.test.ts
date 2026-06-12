import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dev template editor bridge launch options', () => {
  it('does not forward host-supplied AI runtime options when enabling the prototype editor over postMessage', () => {
    const source = readFileSync(resolve(__dirname, './index.tsx'), 'utf8');
    const enableStart = source.indexOf("event.data.type === 'AXHUB_PROTOTYPE_EDITOR_ENABLE'");
    const enableEnd = source.indexOf("event.data.type === 'AXHUB_PROTOTYPE_EDITOR_DISABLE'", enableStart);
    const enableSource = source.slice(enableStart, enableEnd);

    expect(enableStart).toBeGreaterThan(-1);
    expect(enableEnd).toBeGreaterThan(enableStart);
    expect(enableSource).toContain('event.data.options');
    expect(enableSource).not.toContain('genieBridge');
    expect(enableSource).not.toContain('integrationWs');
    expect(enableSource).toContain('mobileMode');
    expect(enableSource).toContain('commentPageScope');
    expect(enableSource).toContain('readPrototypeEditorBridgeCommentPageScope');
    expect(enableSource).toContain("editorModeManager?.api.enable('webEditorV2'");
  });
});
