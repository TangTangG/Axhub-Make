import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dev template editor bridge launch options', () => {
  it('forwards host-supplied runtime options when enabling the prototype editor over postMessage', () => {
    const source = readFileSync(resolve(__dirname, './index.tsx'), 'utf8');
    const enableStart = source.indexOf("event.data.type === 'AXHUB_PROTOTYPE_EDITOR_ENABLE'");
    const enableEnd = source.indexOf("event.data.type === 'AXHUB_PROTOTYPE_EDITOR_DISABLE'", enableStart);
    const enableSource = source.slice(enableStart, enableEnd);

    expect(enableStart).toBeGreaterThan(-1);
    expect(enableEnd).toBeGreaterThan(enableStart);
    expect(enableSource).toContain('event.data.options');
    expect(enableSource).toContain('genieBridge');
    expect(enableSource).toContain('integrationWs');
    expect(enableSource).toContain("editorModeManager?.api.enable('webEditorV2'");
  });
});
