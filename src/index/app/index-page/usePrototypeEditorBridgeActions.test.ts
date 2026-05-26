import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('usePrototypeEditorBridgeActions source', () => {
  function readSource() {
    return readFileSync(resolve(__dirname, './usePrototypeEditorBridgeActions.ts'), 'utf8');
  }

  it('passes assistant runtime launch options when enabling prototype editors', () => {
    const source = readSource();

    expect(source).toContain('assistantApiBaseUrl');
    expect(source).toContain('assistantProjectPath');
    expect(source).toContain('assistantWebEditorClientId');
    expect(source).toContain("const integrationChannel = projectPath || 'axhub';");
    expect(source).toContain('runtimeOverride?.projectPath?.trim()');
    expect(source).toContain('genieBridge:');
    expect(source).toContain("targetClientId: '',");
    expect(source).not.toContain('targetClientId: editorClientId,');
    expect(source).toContain('integrationWs:');
    expect(source).toContain('buildPrototypeEditorEnableOptions(context)');
    expect(source).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_ENABLE'");
    expect(source).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_HOST_TOOLBAR_ACTION'");
  });

  it('exposes a query-state bridge action so preview load can inspect decision data before opening panels', () => {
    const source = readSource();

    expect(source).toContain('queryPrototypeEditorState: (iframe: HTMLIFrameElement) => Promise<PrototypeEditorBridgeStateMessage | null>;');
    expect(source).toContain('const queryPrototypeEditorState = useCallback((iframe: HTMLIFrameElement) => (');
    expect(source).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_QUERY_STATE'");
    expect(source).toContain('queryPrototypeEditorState,');
  });
});
