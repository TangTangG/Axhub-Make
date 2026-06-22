import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('usePrototypeEditorBridgeActions source', () => {
  function readSource() {
    return readFileSync(resolve(__dirname, './usePrototypeEditorBridgeActions.ts'), 'utf8');
  }

  it('enables prototype editors without assistant runtime bridge options', () => {
    const source = readSource();

    expect(source).not.toContain('assistantApiBaseUrl');
    expect(source).not.toContain('assistantProjectPath');
    expect(source).not.toContain('assistantWebEditorClientId');
    expect(source).not.toContain('runtimeOverride');
    expect(source).not.toContain('genieBridge:');
    expect(source).not.toContain('integrationWs:');
    expect(source).not.toContain('initialSelectionModeActive');
    expect(source).toContain("toolbarMode: 'host'");
    expect(source).toContain('mobileMode: context.mobileMode');
    expect(source).toContain('selectedPageId?: string | null;');
    expect(source).toContain('pageId: normalizePrototypeEditorPageId(selectedPageId) || readPrototypeEditorPageIdFromIframe(iframe)');
    expect(source).toContain('const commentPageScope = buildPrototypeEditorCommentPageScope(context);');
    expect(source).toContain('? { ...context, commentPageScope }');
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

  it('exposes a node editing state bridge for cross-origin direct API runs', () => {
    const source = readSource();

    expect(source).toContain('postPrototypeEditorNodeEditingState: (');
    expect(source).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_NODE_EDITING_STATE'");
    expect(source).toContain('elementKey,');
    expect(source).toContain('nextState,');
    expect(source).toContain('taskRef,');
    expect(source).toContain('targetRef: targetRef ?? null,');
    expect(source).toContain('postPrototypeEditorNodeEditingState,');
  });

  it('falls back to the postMessage bridge when same-origin editor APIs are unavailable', () => {
    const source = readSource();

    const enterSource = source.slice(
      source.indexOf('const enterPrototypeEditor = useCallback'),
      source.indexOf('useEffect(() => () =>', source.indexOf('const enterPrototypeEditor = useCallback')),
    );

    expect(enterSource).toContain('let editors = getPrototypeEditorApi(iframe);');
    expect(enterSource).toContain('if (editors?.enable) {');
    expect(enterSource).toContain('const bridgeResult = await postPrototypeEditorEnable(iframe, context);');
    expect(source).toContain('iframe.contentWindow?.postMessage({');
    expect(source).toContain('}, getIframeOrigin(iframe));');
    expect(source).toContain('if (!targetIframe || event.source !== targetIframe.contentWindow) {');
    expect(source).toContain('if (event.origin !== getIframeOrigin(targetIframe)) {');
  });

  it('injects the HTML template bootstrap into raw same-origin HTML docs before falling back to postMessage', () => {
    const source = readSource();
    const enterSource = source.slice(
      source.indexOf('const enterPrototypeEditor = useCallback'),
      source.indexOf('useEffect(() => () =>', source.indexOf('const enterPrototypeEditor = useCallback')),
    );

    expect(source).toContain("const HTML_TEMPLATE_BOOTSTRAP_SRC = '/assets/html-template-bootstrap.js';");
    expect(source).toContain('function isHtmlDocumentPreviewIframe');
    expect(source).toContain("src.includes('/api/docs/')");
    expect(source).toContain("src.includes('/api/markdown-file')");
    expect(source).toContain("script.src = HTML_TEMPLATE_BOOTSTRAP_SRC;");
    expect(source).toContain('doc.head?.appendChild(script) ?? doc.documentElement.appendChild(script);');
    expect(source).toContain("readPreviewFrameEditorApi<PrototypeEditorApi>(iframe, 'HtmlTemplateBootstrap')");
    expect(enterSource).toContain('let editors = getPrototypeEditorApi(iframe);');
    expect(enterSource).toContain('editors = await ensureHtmlDocumentPreviewEditorApi(iframe);');
    expect(enterSource).toMatch(/if \(editors\?\.enable\) \{[\s\S]*editors = await ensureHtmlDocumentPreviewEditorApi\(iframe\);[\s\S]*if \(editors\?\.enable\) \{/);
  });
});
