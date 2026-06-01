import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildProjectPrototypeIframeUrl, buildPrototypePageHashUrl } from './previewActions.helpers';

function readPreviewRootSource() {
  return readFileSync(resolve(__dirname, './useIndexPagePreviewActions.tsx'), 'utf8');
}

function readPreviewActionsSource() {
  return [
    './useIndexPagePreviewActions.tsx',
    './previewActions.helpers.ts',
    './usePreviewRuntimeActions.ts',
    './usePrototypeEditorBridgeActions.ts',
  ].map((fileName) => readFileSync(resolve(__dirname, fileName), 'utf8')).join('\n');
}

function readUiReviewSupportSource() {
  return [
    readFileSync(resolve(__dirname, './useIndexPagePreviewActions.tsx'), 'utf8'),
    readFileSync(resolve(__dirname, '../hooks/useIndexPagePresentationPropsBuilder.ts'), 'utf8'),
    readFileSync(resolve(__dirname, '../../utils/uiReviewPrompt.ts'), 'utf8'),
    readFileSync(resolve(__dirname, '../../utils/markdownPreview.ts'), 'utf8'),
  ].join('\n');
}

function getSourceSegment(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('useIndexPagePreviewActions source', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns minified export config json for copy-config flow', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('return JSON.stringify(configData);');
    expect(source).not.toContain('return JSON.stringify(configData, null, 2);');
  });

  it('focuses the preview iframe before requesting figma copy', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain("import { copyToClipboard, writeFigmaOfficialClipboardPayload }");
    expect(source).toContain('targetIframe.focus();');
    expect(source).toContain('targetIframe.contentWindow?.focus?.();');
    expect(source).toContain("type: 'axhub.quickEdit.export.copyToFigma'");
    expect(source).toContain("clipboardWriteTarget: 'host'");
    expect(source).toContain("event.data.type !== 'axhub.quickEdit.export.copyToFigmaResult'");
    expect(source).toContain('writeFigmaOfficialClipboardPayload(result.payloadText);');
    expect(source).not.toContain("type: 'COPY_TO_FIGMA'");
    expect(source).not.toContain("event.data.type !== 'COPY_TO_FIGMA_RESULT'");
  });

  it('does not mention the old page-switch figma paste workaround after copy succeeds', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain("messageApi.success('复制成功');");
    expect(source).not.toContain('粘贴后若文本不显示，需切换页面再返回');
  });

  it('keeps split preview intact and enables pane-aware quick edit orchestration', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('secondaryPreviewIframeRef');
    expect(source).toContain('const iframeUrlMode =');
    expect(source).toContain('primaryIframeUrl');
    expect(source).toContain('secondaryIframeUrl');
    expect(source).toContain("axhubPane', pane");
    expect(source).toContain("mobileMode: resourceType === 'prototype' ? pane === 'secondary' : false");
    expect(source).toContain('getPrimaryPreviewIframe');
    expect(source).toContain('getSecondaryPreviewIframe');
    expect(source).toContain('getPreviewIframes');
    expect(source).not.toContain("webEditorRequested || editorStatus.mode === 'webEditorV2'");
    expect(source).not.toContain('setPreviewConfig(createDefaultPreviewConfig())');
    expect(source).not.toContain('setPreviewConfig(previewConfigBeforeWebEditorRef.current)');
  });

  it('keeps preview device state and actions in a dedicated hook module', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain("import { usePreviewDeviceActions } from './usePreviewDeviceActions';");
    expect(source).toContain('const previewDeviceActions = usePreviewDeviceActions();');
    expect(source).toContain('previewDeviceActions.previewConfig');
    expect(source).toContain('previewDeviceActions.handleActivateSplitPreview');
    expect(source).not.toContain("from 'lucide-react'");
    expect(source).not.toContain('const [previewConfig, setPreviewConfig] = useState<PreviewConfig>');
  });

  it('uses shared content mode resolution so resource tab browsing does not exit prototype canvas', () => {
    const source = readPreviewRootSource();

    expect(source).toContain("import { resolveIndexContentMode } from './contentMode';");
    expect(source).toContain('const contentMode = resolveIndexContentMode({');
    expect(source).toContain('viewMode,');
  });

  it('keeps preview iframe refs and pane-aware posting in a dedicated hook module', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain("import { usePreviewIframeActions } from './usePreviewIframeActions';");
    expect(source).toContain('const previewIframeActions = usePreviewIframeActions({');
    expect(source).toContain('previewMode: previewConfig.previewMode');
    expect(source).toContain('messageApi');
    expect(source).toContain('const previewIframeRef = previewIframeActions.previewIframeRef;');
    expect(source).toContain('const getPreviewIframes = previewIframeActions.getPreviewIframes;');
    expect(source).toContain('const postToPreview = previewIframeActions.postToPreview;');
    expect(source).not.toContain('const previewIframeRef = useRef<HTMLIFrameElement | null>(null);');
    expect(source).not.toContain('const secondaryPreviewIframeRef = useRef<HTMLIFrameElement | null>(null);');
  });

  it('keeps quick-edit runtime postMessage helpers in a dedicated hook module', () => {
    const source = readPreviewRootSource();

    expect(source).toContain("import { usePreviewRuntimeActions } from './usePreviewRuntimeActions';");
    expect(source).toContain('const previewRuntimeActions = usePreviewRuntimeActions({');
    expect(source).toContain('postToPreview');
    expect(source).toContain('const forwardQuickEditPatch = previewRuntimeActions.forwardQuickEditPatch;');
    expect(source).toContain('const reportQuickEditRuntimeError = previewRuntimeActions.reportQuickEditRuntimeError;');
    expect(source).toContain('const exitQuickEditRuntime = previewRuntimeActions.exitQuickEditRuntime;');
    expect(source).toContain('const saveQuickEditRuntime = previewRuntimeActions.saveQuickEditRuntime;');
    expect(source).not.toContain('const forwardQuickEditPatch = useCallback((patch: unknown, iframe?: HTMLIFrameElement | null) => {');
    expect(source).not.toContain('const reportQuickEditRuntimeError = useCallback((message: string, iframe?: HTMLIFrameElement | null) => {');
  });

  it('keeps prototype editor bridge request lifecycle in a dedicated hook module', () => {
    const rootSource = readPreviewRootSource();
    const combinedSource = readPreviewActionsSource();

    expect(rootSource).toContain("import { usePrototypeEditorBridgeActions } from './usePrototypeEditorBridgeActions';");
    expect(rootSource).toContain('const prototypeEditorBridgeActions = usePrototypeEditorBridgeActions({');
    expect(rootSource).toContain('const getPrototypeEditorApi = prototypeEditorBridgeActions.getPrototypeEditorApi;');
    expect(rootSource).toContain('const enterPrototypeEditor = prototypeEditorBridgeActions.enterPrototypeEditor;');
    expect(rootSource).toContain('const postPrototypeEditorHostToolbarAction = prototypeEditorBridgeActions.postPrototypeEditorHostToolbarAction;');
    expect(rootSource).not.toContain('const prototypeEditorBridgeRequestSeqRef = useRef(0);');
    expect(rootSource).not.toContain('const postPrototypeEditorBridgeMessage = useCallback((');
    expect(rootSource).not.toContain("event.data?.type !== 'AXHUB_PROTOTYPE_EDITOR_STATE'");
    expect(combinedSource).toContain('PROTOTYPE_EDITOR_BRIDGE_TIMEOUT_MS');
    expect(combinedSource).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_ENABLE'");
    expect(combinedSource).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_ENABLE_PANEL_ONLY'");
    expect(combinedSource).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_DISABLE_PANEL_ONLY'");
    expect(combinedSource).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_DISABLE'");
    expect(combinedSource).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_HOST_TOOLBAR_ACTION'");
    expect(combinedSource).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_SAVE_ACTION'");
    expect(combinedSource).toContain('enablePanelOnly');
    expect(combinedSource).toContain('disablePanelOnly');
    expect(combinedSource).toContain("'AXHUB_PROTOTYPE_EDITOR_STATE'");
  });

  it('wires prototype review tabs, markdown state, prompt copy, and dedicated page zoom actions', () => {
    const source = readUiReviewSupportSource();
    const previewRootSource = readPreviewRootSource();

    expect(source).toContain("const [reviewPanelOpen, setReviewPanelOpen] = useState(false);");
    expect(source).toContain("const [activeReviewKind, setActiveReviewKind] = useState<ReviewKind>('design');");
    expect(source).toContain("const [reviewMarkdown, setReviewMarkdown] = useState('');");
    expect(source).toContain("const [reviewUpdatedAt, setReviewUpdatedAt] = useState<string | null>(null);");
    expect(source).toContain("const [reviewLoading, setReviewLoading] = useState(false);");
    expect(source).toContain("const [reviewError, setReviewError] = useState('');");
    expect(source).toContain("const [reviewPageZoomEnabled, setReviewPageZoomEnabled] = useState(false);");
    expect(source).toContain('const reviewDocumentPath = useMemo');
    expect(source).toContain('resolveReviewDocumentPath(selectedItem, activeReviewKind)');
    expect(source).toContain('buildReviewPrompt({');
    expect(source).toContain('kind: activeReviewKind');
    expect(source).toContain('rules/ui-review-guide.md');
    expect(source).toContain('rules/prototype-review-guide.md');
    expect(source).toContain('ui-review.md');
    expect(source).toContain('prototype-review.md');
    expect(source).toContain('/api/markdown-file-meta?path=');
    expect(source).toContain('handleReviewKindChange');
    expect(source).toContain('handleToggleReviewPageZoom');
    expect(source).toContain('handleReviewPanelToggle');
    expect(source).toContain('handleCopyReviewPrompt');
    expect(source).toContain('activeReviewKind,');
    expect(source).toContain('reviewPanelOpen,');
    expect(source).toContain('reviewMarkdown,');
    expect(source).toContain('reviewUpdatedAt,');
    expect(source).toContain('reviewLoading,');
    expect(source).toContain('reviewError,');
    expect(source).toContain('reviewPageZoomEnabled,');
    expect(source).toContain('handleReviewKindChange,');
    expect(source).toContain('handleReviewPanelToggle,');
    expect(source).toContain('handleCopyReviewPrompt,');
    expect(source).toContain('handleToggleReviewPageZoom,');

    const zoomHandlerSource = getSourceSegment(
      previewRootSource,
      'const handleToggleReviewPageZoom = useCallback',
      'const handleOpenWebEditor = useCallback',
    );
    expect(zoomHandlerSource).not.toContain('handleChangePreviewScaleMode');
    expect(source).not.toContain('reviewPageZoomEnabled: preview.previewConfig.scaleMode ===');
  });

  it('keeps quick-edit runtime handshake state and timeout lifecycle in the runtime hook', () => {
    const rootSource = readPreviewRootSource();
    const combinedSource = readPreviewActionsSource();

    expect(rootSource).toContain('selectedItem');
    expect(rootSource).toContain('viewMode');
    expect(rootSource).toContain('const quickEditRuntimeStatus = previewRuntimeActions.quickEditRuntimeStatus;');
    expect(rootSource).toContain('const setQuickEditRuntimeStatus = previewRuntimeActions.setQuickEditRuntimeStatus;');
    expect(rootSource).toContain('const clearQuickEditRuntimeTimeout = previewRuntimeActions.clearQuickEditRuntimeTimeout;');
    expect(rootSource).toContain('const beginQuickEditRuntimeHandshake = previewRuntimeActions.beginQuickEditRuntimeHandshake;');
    expect(rootSource).not.toContain('const quickEditRuntimeTimeoutRef = useRef<number | null>(null);');
    expect(rootSource).not.toContain('const quickEditRuntimeHandshakeSeqRef = useRef(0);');
    expect(rootSource).not.toContain("const [quickEditRuntimeStatus, setQuickEditRuntimeStatus] = useState<QuickEditRuntimeStatus>('idle');");
    expect(combinedSource).toContain('QUICK_EDIT_RUNTIME_MISSING_TIMEOUT_MS');
    expect(combinedSource).toContain("postProjectCommunicationRecord(selectedItem, 'sessions'");
    expect(combinedSource).toContain('getClientUrlOrigin(selectedItem.clientUrl)');
  });

  it('restarts the quick-edit runtime handshake when selecting a hash-routed prototype page', () => {
    const source = readPreviewRootSource();
    const pageHandshakeSource = getSourceSegment(
      source,
      'const getRuntimeDocumentUrlKey = useCallback',
      'useEffect(() => {\n        const handleQuickEditRuntimeMessage',
    );

    expect(pageHandshakeSource).toContain('lastQuickEditRuntimeDocumentUrlKeyRef');
    expect(pageHandshakeSource).toContain('url.hash =');
    expect(pageHandshakeSource).toContain("if (quickEditRuntimeStatus === 'ready' && lastQuickEditRuntimeDocumentUrlKeyRef.current === currentDocumentUrlKey)");
    expect(pageHandshakeSource).toContain('Hash-routed prototype subpages keep the same iframe document.');
    expect(pageHandshakeSource).toContain('beginQuickEditRuntimeHandshake(primaryIframe);');
    expect(pageHandshakeSource).toContain('lastQuickEditRuntimeDocumentUrlKeyRef.current = currentDocumentUrlKey;');
  });

  it('listens for hash-routed prototype page changes from the active preview iframe', () => {
    const source = readPreviewRootSource();

    expect(source).toContain("onPrototypePageChange");
    expect(source).toContain("event.data?.type === 'AXHUB_PROTOTYPE_PAGE_CHANGE'");
    expect(source).toContain('event.source !== targetIframe.contentWindow');
    expect(source).toContain('onPrototypePageChange?.(nextPageId || null);');
  });

  it('accepts runtime prototype route info from the active preview iframe', () => {
    const source = readPreviewRootSource();

    expect(source).toContain("onPrototypeRouteInfo");
    expect(source).toContain("event.data?.type === 'AXHUB_PROTOTYPE_ROUTE_INFO'");
    expect(source).toContain('event.source !== targetIframe.contentWindow');
    expect(source).toContain('defaultPageId');
    expect(source).toContain('activePageId');
    expect(source).toContain('pages');
  });

  it('declares iframe URLs before callbacks that depend on them', () => {
    const source = readPreviewRootSource();

    expect(source.indexOf('const primaryIframeUrl = useMemo')).toBeLessThan(
      source.indexOf('const handlePreviewIframeLoad = useCallback'),
    );
  });

  it('requests screenshot preview whenever export modal opens without a captured screenshot', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain("if (isExportModalOpen && imageConfig.contentType === 'screenshot' && !imageConfig.rawScreenshotUrl) {");
    expect(source).toContain('handleRequestScreenshot();');
    expect(source).not.toContain('if (imageConfig.width === screenshotDefaultSize.width && imageConfig.height === screenshotDefaultSize.height)');
  });

  it('does not reset screenshot styles before the export modal has ever opened', () => {
    const source = readPreviewRootSource();
    const resetEffect = getSourceSegment(
      source,
      'useEffect(() => {\n        if (isExportModalOpen && imageConfig.contentType === \'screenshot\'',
      '    return {',
    );

    expect(resetEffect).toContain('exportModalWasOpenRef');
    expect(resetEffect).toContain('exportModalWasOpenRef.current = true;');
    expect(resetEffect).toContain('if (!exportModalWasOpenRef.current) {');
    expect(resetEffect).toContain('return;');
    expect(resetEffect).toContain("targetIframe.contentWindow.postMessage({ type: 'RESET_SCREENSHOT_STYLES' }, getIframeOrigin(targetIframe));");
  });

  it('routes runtime-component clipboard writes through the shared clipboard helper', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain("from '../../utils/clipboard'");
    expect(source).toContain('await copyToClipboard(`// axvg\\n${JSON.stringify(payload)}`);');
  });

  it('copies editable Axure prototypes from the current preview runtime without reading source or artifact files', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('const payload = await requestAxureJson(options);');
    expect(source).toContain('if (exportAvailability.axureRuntimeDisabledReason)');
    expect(source).not.toContain('resolveServerBackedAxurePayload');
    expect(source).not.toContain('apiService.fetchAxureExportCode');
    expect(source).not.toContain('serverBackedPayload');
  });

  it('opens quick edit without waiting for the Genie runtime probe', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('probeAssistantRuntimeSilently');
    expect(source).not.toContain('await probeAssistantRuntimeSilently?.()');
    expect(source).toContain('startDeferredAssistantRuntimeProbe({');
    expect(source).toContain('enterPrototypeEditor(primaryIframe)');
    expect(source).toContain("messageApi.success('已连接上本地 AI');");
    expect(source).toContain('startAssistantRuntimeForWebEditor');
  });

  it('keeps the preview iframe launch URL stable while quick edit is active', () => {
    const source = readPreviewRootSource();
    const buildPaneIframeUrlSource = getSourceSegment(
      source,
      'const buildPaneIframeUrl = useCallback',
      'const primaryIframeUrl = useMemo',
    );
    const exitWebEditorSource = getSourceSegment(
      source,
      'const handleExitWebEditor = useCallback',
      'exitWebEditorRef.current = handleExitWebEditor;',
    );

    expect(source).toContain('const activePrototypeEditorLaunchOptionsRef = useRef<typeof prototypeEditorLaunchOptions | null>(null);');
    expect(source).toContain("const iframePrototypeEditorLaunchOptions = editorStatus.mode === 'quickEdit'");
    expect(source).toContain('activePrototypeEditorLaunchOptionsRef.current = prototypeEditorLaunchOptions;');
    expect(buildPaneIframeUrlSource).toContain('iframePrototypeEditorLaunchOptions');
    expect(buildPaneIframeUrlSource).not.toContain('prototypeEditorLaunchOptions, selectedPageId');
    expect(exitWebEditorSource).toContain('activePrototypeEditorLaunchOptionsRef.current = null;');
  });

  it('does not keep the removed quick-edit new-page launch flow', () => {
    const source = readPreviewActionsSource();

    expect(source).not.toContain('const quickEditLaunchUrl =');
    expect(source).not.toContain('const nextUrl = new URL(quickEditLaunchUrl, window.location.origin);');
    expect(source).not.toContain("nextUrl.searchParams.set('axhubQuickEditContext', '1');");
    expect(source).not.toContain('handleOpenQuickEditInNewPage');
    expect(source).not.toContain("buildEditorUrl(selectedItem, viewMode, 'webEditorV2'");
  });

  it('uses clientUrl from selected prototype metadata instead of make-server preview endpoints', () => {
    const source = readPreviewActionsSource();
    const buildPaneIframeUrlSource = getSourceSegment(
      readPreviewRootSource(),
      'const buildPaneIframeUrl = useCallback',
      'const primaryIframeUrl = useMemo',
    );

    expect(source).toContain('buildProjectPrototypeIframeUrl');
    expect(source).toContain('selectedItem.clientUrl');
    expect(source).toContain('selectedItem.previewDisabled');
    expect(source).not.toContain('buildPrototypePreviewEndpoint');
    expect(buildPaneIframeUrlSource).not.toContain('`/prototypes/${encodeURIComponent');
    expect(source).not.toContain("const label = activeTab === 'components' ? '组件' : '原型'");
  });

  it('adds Genie launch options to client prototype iframe URLs', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://admin.local:5173',
      },
    });

    const url = new URL(buildProjectPrototypeIframeUrl({
      name: 'home',
      clientUrl: 'http://client.local:4173/prototypes/home?genieIntegrationChannel=stale',
    }, {
      genieBridge: {
        apiBaseUrl: 'http://localhost:32124/api',
        integrationChannel: '/Users/demo/project',
        projectPath: '/Users/demo/project',
        targetClientId: 'frontend-1234',
      },
      integrationWs: {
        enabled: true,
        apiBaseUrl: 'http://localhost:32124/api',
        channel: '/Users/demo/project',
        clientId: 'make-editor-1234',
      },
    } as any));

    expect(url.searchParams.get('genieApiBaseUrl')).toBe('http://localhost:32124/api');
    expect(url.searchParams.get('genieIntegrationChannel')).toBe('/Users/demo/project');
    expect(url.searchParams.get('genieTargetClientId')).toBe('frontend-1234');
    expect(url.searchParams.get('cwd')).toBe('/Users/demo/project');
    expect(url.searchParams.get('editorIntegrationWs')).toBe('1');
    expect(url.searchParams.get('editorApiBaseUrl')).toBe('http://localhost:32124/api');
    expect(url.searchParams.get('editorIntegrationChannel')).toBe('/Users/demo/project');
    expect(url.searchParams.get('editorClientId')).toBe('make-editor-1234');
  });

  it('resolves relative prototype client URLs against the make client runtime origin', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://admin.local:53817',
      },
      __RUNTIME_ORIGIN__: 'http://localhost:51720',
    });

    const url = new URL(buildProjectPrototypeIframeUrl({
      name: 'fitness-home',
      clientUrl: '/prototypes/fitness-home',
    }));

    expect(url.origin).toBe('http://localhost:51720');
    expect(url.pathname).toBe('/prototypes/fitness-home');
  });

  it('builds and clears prototype page hash URLs without disturbing launch query params', () => {
    const url = new URL(buildPrototypePageHashUrl(
      'http://client.local/prototypes/orders?genieToolbar=host#page=old',
      'orders-list',
    ));

    expect(url.searchParams.get('genieToolbar')).toBe('host');
    expect(url.hash).toBe('#page=orders-list');
    expect(buildPrototypePageHashUrl(url.toString(), null)).toBe('http://client.local/prototypes/orders?genieToolbar=host');
  });

  it('uses the selected prototype page id when building demo iframe URLs', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'http://admin.local:5173',
      },
    });

    const url = new URL(buildProjectPrototypeIframeUrl({
      name: 'orders',
      clientUrl: 'http://client.local:4173/prototypes/orders#page=old',
    }, undefined, 'orders-list'));

    expect(url.hash).toBe('#page=orders-list');
  });

  it('exposes a top-toolbar HTML export action using the selected prototype local path', () => {
    const source = readPreviewRootSource();

    expect(source).toContain("import { downloadExportHtmlArchive } from '../../domains/export/export.api';");
    expect(source).toContain('const handleExportHtml = useCallback(async (options: { includeSource?: boolean } = {}) => {');
    expect(source).toContain('if (exportAvailability.htmlExportDisabledReason) {');
    expect(source).toContain('const targetPath = getSelectedSourceBasePath(selectedItem);');
    expect(source).toContain('await downloadExportHtmlArchive(targetPath, { includeSource: options.includeSource === true });');
    expect(source).toContain('HTML 导出完成，已开始下载');
    expect(source).toContain('handleExportHtml,');
  });

  it('builds prototype Canvas iframe URLs from the selected prototype instead of the standalone canvas sidebar', () => {
    const source = readPreviewActionsSource();
    const buildPaneIframeUrlSource = getSourceSegment(
      readPreviewRootSource(),
      'const buildPaneIframeUrl = useCallback',
      'const primaryIframeUrl = useMemo',
    );

    expect(source).toContain('buildPrototypeCanvasIframeUrl');
    expect(buildPaneIframeUrlSource).toContain("viewMode === 'canvas'");
    expect(source).toContain("`/canvas/prototypes/${encodeURIComponent(selectedItem.name)}/canvas.excalidraw`");
    expect(buildPaneIframeUrlSource).toContain("viewMode !== 'demo'");
    expect(buildPaneIframeUrlSource).not.toContain("sidebarTab === 'canvas'");
  });

  it('tracks desired editor mode for iframe refresh resync', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain("const quickEditRuntimeActiveRef = useRef(false);");
    expect(source).toContain('enterPrototypeEditor');
    expect(source).toContain('exitQuickEditRuntime');
    expect(source).toContain("url.searchParams.set('axhubQuickEditContext', '1');");
    expect(source).not.toContain('desiredEditorModeRef');
    expect(source).toContain("editors.enable('webEditorV2', buildPrototypeEditorEnableOptions(context, options.runtime))");
    expect(source).not.toContain('if (!isSinglePaneHostToolbarPreview) {\n                setHostToolbarState(null);\n            }');
  });

  it('keeps Genie frontend target auto-resolved while using the editor client id only for source registration', () => {
    const source = readPreviewRootSource();

    expect(source).toContain("const editorClientId = String(assistantWebEditorClientId || '').trim();");
    expect(source).toContain("targetClientId: '',");
    expect(source).toContain('clientId: editorClientId,');
    expect(source).not.toContain('targetClientId: editorClientId,');
  });

  it('does not let cross-origin preview frame API reads block editor exit cleanup', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('function readPreviewFrameEditorApi');
    expect(source).toContain('catch (error) {');
    expect(source).toContain("error instanceof DOMException && error.name === 'SecurityError'");
    expect(source).toContain('const editors = readPreviewFrameEditorApi<PrototypeEditorApi>(iframe, \'DevTemplateBootstrap\');');
    expect(source).toContain('const api = readPreviewFrameEditorApi<DocumentEditorApi>(iframe, \'SpecTemplateBootstrap\');');
    expect(source).toMatch(/await Promise\.all\(getPreviewIframes\(\)\.map\(async \(iframe\) => \{[\s\S]*await postPrototypeEditorDisable\(iframe\);[\s\S]*const editors = getPrototypeEditorApi\(iframe\);/s);
    expect(source).toMatch(/documentEditorActiveRef\.current = false;[\s\S]*quickEditRuntimeActiveRef\.current = false;[\s\S]*setEditorStatus\(\{ mode: 'none' \}\);[\s\S]*setHostToolbarState\(null\);/s);
  });

  it('drives prototype quick edit through the embedded WebEditor bridge and keeps restored Markdown quick editing separate', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_ENABLE'");
    expect(source).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_ENABLE_PANEL_ONLY'");
    expect(source).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_DISABLE_PANEL_ONLY'");
    expect(source).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_DISABLE'");
    expect(source).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_HOST_TOOLBAR_ACTION'");
    expect(source).toContain("type: 'AXHUB_PROTOTYPE_EDITOR_SAVE_ACTION'");
    expect(source).toContain("'AXHUB_PROTOTYPE_EDITOR_STATE'");
    expect(source).toContain('postPrototypeEditorEnable');
    expect(source).toContain('postPrototypeEditorDisable');
    expect(source).toContain('postPrototypeEditorHostToolbarAction');
    expect(source).toContain('postPrototypeEditorSaveAction');
    expect(source).toContain('runQuickEditSaveAction');
    expect(source).toContain("saveWebEditorTextChanges");
    expect(source).toContain("saveWebEditorStyleChanges");
    expect(source).toContain("clearWebEditorForcedStyles");
    expect(source).toContain("type: 'axhub.quickEdit.exit'");
    expect(source).toContain("type: 'axhub.quickEdit.save'");
    expect(source).toContain("type: 'axhub.quickEdit.patch'");
    expect(source).toContain("type: 'axhub.quickEdit.error'");
    expect(source).toContain('getPrototypeEditorApi');
    expect(source).toContain("editors.enable('webEditorV2', buildPrototypeEditorEnableOptions(context, options.runtime))");
    expect(source).toContain("messageApi.warning('当前客户端页面尚未接入真正的快速编辑器，请确认预览页已加载 DevTemplateBootstrap')");
    expect(source).toContain('projectId: selectedEditablePreviewResource?.projectId');
    expect(source).toContain('resourceId: selectedEditablePreviewResource?.resourceId || selectedEditablePreviewResource?.name');
    expect(source).toContain('resourceType,');
    expect(source).toContain('SPEC_EDIT_ENABLE');
    expect(source).toContain('SPEC_EDIT_SET_MODE');
    expect(source).toContain('SPEC_EDIT_SAVE');
    expect(source).toContain('SPEC_EDIT_EXIT');
    expect(source).toContain('SPEC_EDIT_STATUS_REQUEST');
    expect(source).toContain('SPEC_EDIT_PROMPT_REQUEST');
    expect(source).toContain('docEditState');
    expect(source).toContain('handleEnableDocEdit');
    expect(source).toContain('isMarkdownEditableResource(currentMarkdownItem)');
    expect(source).not.toContain("currentMarkdownItem.name || currentMarkdownItem.filePath || currentMarkdownItem.absoluteFilePath");
    expect(source).toContain('handleSwitchDocQuickEditMode');
    expect(source).not.toContain('handleEnableSpecEdit');
    expect(source).not.toContain('handleSwitchSpecQuickEditMode');
    expect(source).toContain('handleCopyMarkdownPrompt');
    expect(source).toContain('resolveSpecQuickEditSwitchDecision');
    expect(source).not.toContain("url.searchParams.set('genieToolbar', 'host');");
    expect(source).not.toContain("url.searchParams.set('editor', 'webEditorV2');");
    expect(source).not.toContain("editorStatus.mode === 'webEditorV2'");
    expect(source).not.toContain("'specComment'");
    expect(source).not.toContain("editors.enable?.('comment'");
    expect(source).not.toContain("type: 'axhub.quickEdit.enter'");
    expect(source).not.toContain('TEXT_EDIT_');
    expect(source).not.toContain('const isSinglePaneHostToolbarPreview =');
    expect(source).toContain('hostToolbarState');
    expect(source).toContain('runHostToolbarAction');
  });

  it('drives theme quick edit through the same embedded editor bridge without enabling prototype-only devices', () => {
    const rootSource = readPreviewRootSource();
    const combinedSource = readPreviewActionsSource();
    const buildPaneIframeUrlSource = getSourceSegment(
      rootSource,
      'const buildPaneIframeUrl = useCallback',
      'const primaryIframeUrl = useMemo',
    );
    const quickEditAvailableSource = getSourceSegment(
      rootSource,
      'const quickEditAvailable = Boolean',
      'const exportAvailability = useMemo',
    );

    expect(rootSource).toContain('selectedTheme');
    expect(rootSource).toContain('const selectedEditablePreviewResource =');
    expect(rootSource).toContain("contentMode === 'theme'");
    expect(rootSource).toContain('selectedTheme?.clientUrl || selectedTheme?.previewUrl');
    expect(buildPaneIframeUrlSource).toContain("if (contentMode === 'theme')");
    expect(buildPaneIframeUrlSource).toContain("return selectedTheme?.clientUrl || selectedTheme?.previewUrl || '';");
    expect(quickEditAvailableSource).toContain('selectedEditablePreviewResource');
    expect(quickEditAvailableSource).toContain("resourceType === 'theme'");
    expect(combinedSource).toContain("const resourceType: 'prototype' | 'theme' = contentMode === 'theme' ? 'theme' : 'prototype';");
    expect(combinedSource).toContain('resourceId: selectedEditablePreviewResource?.resourceId || selectedEditablePreviewResource?.name');
    expect(combinedSource).toContain('context: buildPrototypeEditorContext(iframe)');
    expect(rootSource).not.toContain('selectedDeviceId = selectedTheme');
  });

  it('tracks Markdown quick edit status and prompt responses from the spec-template iframe', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('createDefaultMarkdownQuickEditState');
    expect(source).not.toContain('type PendingPromptRequest');
    expect(source).not.toContain('specPromptRequestMapRef');
    expect(source).not.toContain('specPromptCacheRef');
    expect(source).toContain("event.data?.type === 'SPEC_EDIT_STATUS'");
    expect(source).toContain("event.data?.type !== 'SPEC_EDIT_PROMPT_RESPONSE'");
    expect(source).toContain('setDocEditState');
    expect(source).not.toContain('setSpecEditState');
    expect(source).not.toContain('setSpecQuickEditMode');
    expect(source).toContain('requestMarkdownEditPrompt');
    expect(source).toContain('saveBeforePrompt');
    expect(source).toContain('navigator.clipboard.writeText(result.prompt)');
  });

  it('shows progress and failure feedback for host toolbar Genie connect actions', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('resolveHostToolbarStateForDisplay');
    expect(source).toContain('isHostToolbarWakePendingState(nextState)');
    expect(source).toContain('return previousState;');
    expect(source).toContain("if (nextState.toolbarMode === 'host' && !nextState.visible) {");
    expect(source).toContain('...createDefaultHostToolbarState(),');
    expect(source).toContain('visible: true,');
    expect(source).toContain('setHostToolbarState((previousState) => resolveHostToolbarStateForDisplay(previousState, nextState, isDarkMode));');
    expect(source).toContain('previousState?: GenieEditorHostToolbarState | null');
    expect(source).toContain("const hideLoading = nextAction.type === 'wake-genie'");
    expect(source).toContain("messageApi.loading('正在连接本地 AI...', 0)");
    expect(source).toContain('waitForHostToolbarActionState');
    expect(source).toContain("nextAction.type === 'wake-genie'");
    expect(source).toContain('!isHostToolbarWakePendingState(state)');
    expect(source).toContain('const runtime = await startAssistantRuntimeForWebEditor?.();');
    expect(source).toContain("runtime.health?.status !== 'ready'");
    expect(source).toContain("nextState.robotState === 'awake' || nextState.robotState === 'working'");
    expect(source).toContain('finish(previousState ?? null);');
    expect(source).toContain('const previousState = editors?.getHostToolbarState?.() ?? hostToolbarStateRef.current;');
    expect(source).toContain("messageApi.success('本地 AI 已连接');");
    expect(source).toContain("messageApi.warning('本地 AI 暂未连接，请确认本地服务已启动');");
    expect(source).toContain('hideLoading?.();');
    expect(source).not.toContain("nextAction.type === 'copy-global-panel-prompt'");
    expect(source).toContain("nextAction.type === 'toggle-dark-mode'");
    expect(source).not.toContain("nextAction.type === 'toggle-page-zoom'");
    expect(source).toContain("nextAction.type === 'full-exit'");
  });

  it('uses the latest host toolbar state ref when connecting local AI from fallback quick edit mode', () => {
    const source = readPreviewRootSource();
    const fallbackActionSource = getSourceSegment(
      source,
      'const runQuickEditHostToolbarAction = useCallback(async (action: GenieEditorHostToolbarAction) => {',
      'const runHostToolbarAction = useCallback(async (action: GenieEditorHostToolbarAction) => {',
    );

    expect(fallbackActionSource).toContain('getHostToolbarState: () => hostToolbarStateRef.current ?? createDefaultHostToolbarState()');
    expect(fallbackActionSource).toContain('listener(hostToolbarStateRef.current ?? createDefaultHostToolbarState());');
    expect(fallbackActionSource).not.toContain('getHostToolbarState: () => hostToolbarState ?? createDefaultHostToolbarState()');
  });

  it('auto-connects local AI before executing from the host toolbar', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('isHostToolbarGenieAwake');
    expect(source).toContain("requestedAction.type === 'send-to-genie'");
    expect(source).toContain("const wakeHandled = await runResolvedHostToolbarAction({ type: 'wake-genie' });");
    expect(source).toContain('if (!wakeHandled || !isHostToolbarGenieAwake(hostToolbarStateRef.current)) {');
    expect(source).toContain('return false;');
    expect(source).toContain('return runResolvedHostToolbarAction(requestedAction);');
  });

  it('copies host toolbar prompt text through Make even when the editor action API exists', () => {
    const source = readPreviewActionsSource();
    const runHostToolbarActionSource = getSourceSegment(
      readPreviewRootSource(),
      'const runHostToolbarAction = useCallback(async (action: GenieEditorHostToolbarAction) => {',
      'const runQuickEditSaveAction = useCallback',
    );

    expect(source).toContain('getCopyPromptText?: () => string;');
    expect(runHostToolbarActionSource).toContain("nextAction.type === 'copy-prompt'");
    expect(runHostToolbarActionSource).toContain('const promptText = editors?.getCopyPromptText?.();');
    expect(runHostToolbarActionSource).toContain('await navigator.clipboard.writeText(promptText);');
    expect(runHostToolbarActionSource).toContain('clipboard: \'host\'');
    expect(runHostToolbarActionSource).not.toContain("nextAction.type === 'copy-prompt' && !editors?.runHostToolbarAction");
  });

  it('clears stale host toolbar prompt state after clear-edits actions', () => {
    const source = readPreviewActionsSource();
    const runHostToolbarActionSource = getSourceSegment(
      readPreviewRootSource(),
      'const runHostToolbarAction = useCallback(async (action: GenieEditorHostToolbarAction) => {',
      'const runQuickEditSaveAction = useCallback',
    );

    expect(source).toContain('resolveHostToolbarStateAfterClearEdits');
    expect(source).toContain('copyPromptDisabled: true');
    expect(runHostToolbarActionSource).toContain("nextAction.type === 'clear-edits'");
    expect(runHostToolbarActionSource).toContain('resolveHostToolbarStateAfterClearEdits(hostToolbarStateRef.current, resolvedState, isDarkMode)');
    expect(runHostToolbarActionSource).toContain('hostToolbarStateRef.current = clearedState;');
    expect(runHostToolbarActionSource).toContain('setHostToolbarState(clearedState);');
  });

  it('tracks quick-edit runtime handshake from the active preview iframe before enabling runtime operations', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain("type QuickEditRuntimeStatus = 'idle' | 'pending' | 'ready' | 'missing' | 'error';");
    expect(source).toContain("isQuickEditRuntimeMessage(event.data)");
    expect(source).toContain("event.data?.type === 'axhub.quickEdit.runtimeReady'");
    expect(source).toContain("event.data?.type === 'axhub.quickEdit.patch'");
    expect(source).toContain("event.data?.type === 'axhub.quickEdit.save'");
    expect(source).toContain("event.data?.type === 'axhub.quickEdit.error'");
    expect(source).toContain('event.source !== previewIframe.contentWindow');
    expect(source).toContain('getClientUrlOrigin(selectedItem.clientUrl)');
    expect(source).toContain("setQuickEditRuntimeStatus('pending');");
    expect(source).toContain("setQuickEditRuntimeStatus('ready');");
    expect(source).toContain("setQuickEditRuntimeStatus('missing');");
    expect(source).toContain('projectCapabilities?.quickEdit !== false');
    expect(source).toContain("quickEditRuntimeStatus !== 'ready'");
    expect(source).toContain("messageApi.warning('当前客户端页面尚未接入 /runtime/quick-edit.js，请通过 script、Vite 插件或 Webpack 插件加载后再使用快速编辑')");
  });

  it('resets the standalone design decision panel when the preview iframe target changes', () => {
    const source = readPreviewRootSource();
    const resetSegment = getSourceSegment(
      source,
      'useEffect(() => {\n        decisionPanelAutoOpenSeqRef.current += 1;',
      'const quickEditAvailable = Boolean(selectedEditablePreviewResource)',
    );

    expect(resetSegment).toContain('setStandalonePanelOpen(false);');
    expect(resetSegment).toContain('decisionPanelAutoOpenSeqRef.current += 1;');
    expect(resetSegment).toContain('resourceType');
    expect(resetSegment).toContain('selectedEditablePreviewResource');
  });

  it('auto-opens the standalone design decision panel when the loaded prototype has decisions', () => {
    const source = readPreviewRootSource();
    const loadSegment = getSourceSegment(
      source,
      'const handlePreviewIframeLoad = useCallback(() => {',
      'useEffect(() => {\n        const handleQuickEditRuntimeMessage = (event: MessageEvent) => {',
    );

    expect(source).toContain('const decisionPanelAutoOpenSeqRef = useRef(0);');
    expect(source).toContain('function hasHostToolbarDecisionData(state: GenieEditorHostToolbarState | null | undefined): boolean');
    expect(loadSegment).toContain('const decisionPanelAutoOpenSeq = decisionPanelAutoOpenSeqRef.current + 1;');
    expect(loadSegment).toContain('decisionPanelAutoOpenSeqRef.current = decisionPanelAutoOpenSeq;');
    expect(loadSegment).toContain('void maybeAutoOpenStandaloneDecisionPanel(primaryIframe, decisionPanelAutoOpenSeq);');
    expect(source).toContain('const maybeAutoOpenStandaloneDecisionPanel = useCallback(async (iframe: HTMLIFrameElement | null, sequence: number) => {');
    expect(source).toContain('if (sequence !== decisionPanelAutoOpenSeqRef.current)');
    expect(source).toContain('hasHostToolbarDecisionData(nextState)');
    expect(source).toContain('decisionDataCount');
    expect(source).toContain('queryPrototypeEditorState(iframe)');
    expect(source).toContain('await enterPrototypeEditorPanelOnly(iframe)');
    expect(source).toContain('setStandalonePanelOpen(opened);');
  });

  it('resets the standalone design decision panel before refreshing the preview iframe', () => {
    const source = readPreviewRootSource();
    const refreshSegment = getSourceSegment(
      source,
      'const handleRefreshElement = useCallback(() => {',
      'const notifyPreviewMessage = useCallback',
    );

    expect(refreshSegment).toContain('exitPrototypeEditorPanelOnly();');
    expect(refreshSegment).toContain('setStandalonePanelOpen(false);');
    expect(refreshSegment).toContain('decisionPanelAutoOpenSeqRef.current += 1;');
    expect(refreshSegment).toContain('setElementIframeKey((previous) => previous + 1);');
  });

  it('declares runtime postMessage action bindings before the handshake effect depends on them', () => {
    const source = readPreviewRootSource();
    const effectIndex = source.indexOf('window.addEventListener(\'message\', handleQuickEditRuntimeMessage);');
    const previewRuntimeActionsIndex = source.indexOf('const previewRuntimeActions = usePreviewRuntimeActions');
    const forwardPatchIndex = source.indexOf('const forwardQuickEditPatch = previewRuntimeActions.forwardQuickEditPatch;');
    const reportErrorIndex = source.indexOf('const reportQuickEditRuntimeError = previewRuntimeActions.reportQuickEditRuntimeError;');

    expect(previewRuntimeActionsIndex).toBeGreaterThan(-1);
    expect(forwardPatchIndex).toBeGreaterThan(-1);
    expect(reportErrorIndex).toBeGreaterThan(-1);
    expect(effectIndex).toBeGreaterThan(-1);
    expect(previewRuntimeActionsIndex).toBeLessThan(effectIndex);
    expect(forwardPatchIndex).toBeLessThan(effectIndex);
    expect(reportErrorIndex).toBeLessThan(effectIndex);
  });

  it('derives export availability from project capabilities runtime state and explicit source context', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('type ExportAvailability');
    expect(source).toContain('const exportAvailability = useMemo<ExportAvailability>');
    expect(source).toContain('projectCapabilities?.figmaExport !== false');
    expect(source).toContain('projectCapabilities?.axureExport !== false');
    expect(source).toContain('projectCapabilities?.localExports?.html === true');
    expect(source).toContain('projectCapabilities?.localExports?.make === true');
    expect(source).toContain("quickEditRuntimeStatus === 'ready'");
    expect(source).toContain('hasExplicitSourceContext(selectedItem)');
    expect(source).toContain('figmaDomDisabledReason');
    expect(source).toContain('axureSourceDisabledReason');
    expect(source).toContain('htmlExportDisabledReason');
    expect(source).toContain('makeExportDisabledReason');
  });

  it('keeps the Make export workflow available from source or Figma artifact context before local .fig assets exist', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('function hasFigmaMakeExportContext(selectedItem: any): boolean');
    expect(source).toContain('const hasMakeExportContext = hasFigmaMakeExportContext(selectedItem);');
    expect(source).toContain('const makeExportContextMissingReason = hasMakeExportContext');
    expect(source).toContain("!figmaEnabled\n                ? '当前项目未启用 Figma 导出能力'");
    expect(source).toContain(': makeExportContextMissingReason;');
    expect(source).not.toContain("!localMakeExportEnabled\n                ? '当前项目未启用 Make 本地导出能力'");
  });

  it('keeps generic Figma and Axure availability independent from client runtime state', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('const canOpenGenericFigmaExport = Boolean(selectedItem) && figmaEnabled;');
    expect(source).toContain('const canOpenGenericAxureExport = Boolean(selectedItem) && axureEnabled;');
    expect(source).toContain('const canUseRuntimeFeatures = viewMode === \'demo\' && Boolean(selectedItem?.clientUrl) && quickEditRuntimeStatus === \'ready\';');
    expect(source).toContain('const canUseSourceFeatures = viewMode === \'demo\' && hasSourceContext && axureEnabled;');
    expect(source).toContain('figmaDomDisabledReason: figmaDisabledReason || runtimeMissingReason');
    expect(source).toContain('axureRuntimeDisabledReason: axureDisabledReason || runtimeMissingReason');
    expect(source).not.toContain(": !hasClientUrl\\n                ? '当前原型缺少 clientUrl'\\n                : !figmaEnabled");
    expect(source).not.toContain(": !hasClientUrl\\n                ? '当前原型缺少 clientUrl'\\n                : !axureEnabled");
  });

  it('uses explicit source metadata for Make export, bundle, and review requests', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain("import { hasExplicitLocalPath } from '../../utils/localPath';");
    expect(source).toContain("import { getExplicitLocalPath, stripIndexFilePath } from '../../utils/localPath';");
    expect(source).toContain('function getSelectedSourcePath(selectedItem: any): string');
    expect(source).toContain('function getSelectedResourceTargetPath(selectedItem: any): string');
    expect(source).toContain('const targetPath = getSelectedResourceTargetPath(selectedItem);');
    expect(source).toContain('const sourcePath = getSelectedSourceBasePath(selectedItem);');
    expect(source).not.toContain('const sourceCodePath = getSelectedSourceBasePath(selectedItem);');
    expect(source).toContain('apiService.fetchExportIndexBundle(getSelectedResourceTargetPath(selectedItem))');
    expect(source).not.toContain('const targetPath = `prototypes/${selectedItem.name}`;');
    expect(source).not.toContain('const path = `${activeTab}/${selectedItem.name}`;');
    expect(source).not.toContain('`/api/source?path=${encodeURIComponent(`${activeTab}/${selectedItem.name}`)}`');
    expect(source).not.toContain('apiService.fetchExportIndexBundle(`${activeTab}/${selectedItem.name}`)');
  });

  it('uses Markdown preview URLs for document and template panes', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain("return selectedDoc?.previewUrl || selectedDoc?.specUrl || '';");
    expect(source).toContain("return selectedTemplate?.previewUrl || selectedTemplate?.specUrl || '';");
  });

  it('routes document editing through the spec-template Genie text comment editor', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain("contentMode === 'doc' || contentMode === 'template'");
    expect(source).not.toContain("contentMode === 'doc' || contentMode === 'template' || viewMode === 'spec'");
    expect(source).toContain('enterDocumentEditor');
    expect(source).toContain("enableDocumentEditor({ toolbarMode: 'host', initialDarkMode: isDarkMode })");
    expect(source).toContain('documentHostToolbarUnsubscribeRef.current = editorApi.subscribeHostToolbarState?.((nextState) => {');
    expect(source).toContain('setHostToolbarState(resolveHostToolbarStateForDisplay(null, editorApi.getHostToolbarState?.() ?? createDefaultHostToolbarState(), isDarkMode));');
    expect(source).toContain('void enterDocumentEditor();');
    expect(source).toContain("setEditorStatus({ mode: 'quickEdit' });");
    expect(source).not.toContain("messageApi.warning('文档模式下无法进行编辑');");
  });

  it('keeps document and prototype quick edit themes synchronized with the host theme', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('isDarkMode = false');
    expect(source).toContain('setIsDarkMode');
    expect(source).toContain('const isDarkModeRef = useRef(isDarkMode);');
    expect(source).toContain('isDarkModeRef.current = isDarkMode;');
    expect(source).toContain('options: buildPrototypeEditorEnableOptions(context, runtimeOverride)');
    expect(source).toContain("editors.enable('webEditorV2', buildPrototypeEditorEnableOptions(context, options.runtime))");
    expect(source).toContain("enableDocumentEditor({ toolbarMode: 'host', initialDarkMode: isDarkMode })");
    expect(source).toContain("requestedAction = action.type === 'toggle-dark-mode'");
    expect(source).toContain("setIsDarkMode?.(nextAction.darkMode)");
    expect(source).toContain("void editorApi?.runHostToolbarAction?.({ type: 'toggle-dark-mode', darkMode: isDarkMode });");
    expect(source).toContain("editors.runHostToolbarAction({ type: 'toggle-dark-mode', darkMode: isDarkMode })");
    expect(source).toContain("postPrototypeEditorHostToolbarAction(iframe, { type: 'toggle-dark-mode', darkMode: isDarkMode })");
    expect(source).not.toContain('setIsDarkMode?.(nextState.darkMode)');
    expect(source).not.toContain('setIsDarkMode?.(nextToolbarState.darkMode)');
    expect(source).not.toContain('setIsDarkMode?.(message.hostToolbarState.darkMode)');
  });

  it('sends runtime export messages with project and resource identity', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('createRuntimeExportMessage');
    expect(source).toContain('requestId');
    expect(source).toContain("resourceType: 'prototypes'");
    expect(source).toContain('projectId: selectedItem.projectId');
    expect(source).toContain('resourceId: selectedItem.resourceId || selectedItem.name');
    expect(source).toContain('clientUrl: selectedItem.clientUrl');
    expect(source).toContain("type: 'axhub.quickEdit.export.captureScreenshot'");
    expect(source).toContain("type: 'axhub.quickEdit.export.axureJson'");
    expect(source).toContain("event.data.type !== 'axhub.quickEdit.export.captureScreenshotResult'");
    expect(source).toContain("event.data.type !== 'axhub.quickEdit.export.axureJsonResult'");
    expect(source).not.toContain("type: 'CAPTURE_SCREENSHOT'");
    expect(source).not.toContain("type: 'EXPORT_AXURE_JSON'");
    expect(source).not.toContain("event.data.type !== 'AXURE_JSON_READY'");
  });

  it('records quick-edit runtime save messages as edit-history records', () => {
    const source = readPreviewActionsSource();

    expect(source).toMatch(/event\.data\?\.type === 'axhub\.quickEdit\.save'[\s\S]*postProjectCommunicationRecord\(selectedItem, 'edit-history', \{\s*operationType: 'quickEdit\.save',\s*status: 'success'/s);
  });

  it('records source-backed Make export outcomes through project communication APIs', () => {
    const source = readPreviewActionsSource();

    expect(source).toMatch(/postProjectCommunicationRecord\(selectedItem, 'exports', \{\s*operationType: 'axure\.copy',\s*status: 'success'/s);
    expect(source).toMatch(/postProjectCommunicationRecord\(selectedItem, 'exports', \{\s*operationType: 'axure\.copy',\s*status: 'failed'/s);
    expect(source).toMatch(/postProjectCommunicationRecord\(selectedItem, 'exports', \{\s*operationType: 'figma\.copy',\s*status: 'success'/s);
    expect(source).toMatch(/postProjectCommunicationRecord\(selectedItem, 'exports', \{\s*operationType: 'figma\.copy',\s*status: 'failed'/s);
    expect(source).toMatch(/postProjectCommunicationRecord\(selectedItem, 'exports', \{\s*operationType: 'make\.export',\s*status: 'success'/s);
    expect(source).toMatch(/metadata: \{\s*fileName,\s*\}/s);
    expect(source).toMatch(/postProjectCommunicationRecord\(selectedItem, 'exports', \{\s*operationType: 'make\.export',\s*status: 'failed'/s);
    expect(source).toContain("errorMessage: String(error?.message || '导出 Make 失败')");
  });

  it('builds Axure runtime cover and copy config from Axure-compatible export code', () => {
    const source = readPreviewActionsSource();
    const coverSegment = getSourceSegment(
      readPreviewRootSource(),
      'const buildRuntimeCoverSvg = useCallback(async () => {',
      '    const handleExport = useCallback',
    );
    const copyConfigSegment = getSourceSegment(
      readPreviewRootSource(),
      'const handleCopyConfig = useCallback(async (exportType: string): Promise<string> => {',
      '    const handleQuickCopyEditablePrototype = useCallback',
    );

    expect(coverSegment).toContain('const axureRuntimeCode = indexBundle.entry.axureCode || indexBundle.entry.code;');
    expect(coverSegment).toContain('indexBundle: embeddedIndexBundle');
    expect(coverSegment).toContain('svgElement.setAttribute(\'AxExtraData\'');
    expect(coverSegment).toContain('svgElement.setAttribute(\'AxData\'');
    expect(coverSegment).not.toContain('fetchDocs');
    expect(coverSegment).not.toContain('code: indexBundle.entry.code');
    expect(coverSegment).not.toContain('axSpec');
    expect(copyConfigSegment).toContain('const axureRuntimeCode = indexBundle.entry.axureCode || indexBundle.entry.code;');
    expect(copyConfigSegment).toContain('code: axureRuntimeCode');
    expect(copyConfigSegment).toContain('codeLink: indexBundle.entry.axureCodePath');
    expect(copyConfigSegment).toContain('indexBundle: embeddedIndexBundle');
    expect(copyConfigSegment).not.toContain('fetchDocs');
    expect(copyConfigSegment).not.toContain('codeAndDocs');
    expect(source).toContain('const payload = await requestAxureJson(options);');
  });

  it('opens the Figma Make guide dialog before attempting export download', () => {
    const source = readPreviewRootSource();
    const exportMakeSegment = getSourceSegment(
      source,
      'const handleExportMake = useCallback',
      '    const ensureAxureExportReviewPassed = useCallback',
    );

    expect(source).toContain('const [isFigmaMakeExportDialogOpen, setIsFigmaMakeExportDialogOpen] = useState(false);');
    expect(source).toContain('isFigmaMakeExportDialogOpen');
    expect(source).toContain('setIsFigmaMakeExportDialogOpen');
    expect(exportMakeSegment).toContain('setIsFigmaMakeExportDialogOpen(true);');
    expect(exportMakeSegment).not.toContain('/api/export-make?path=');
    expect(exportMakeSegment).not.toContain('navigator.clipboard.writeText(result.prompt)');
    expect(exportMakeSegment).not.toContain("messageApi.loading('正在导出 Make...'");
  });

  it('publishes cloud targets through project config and opens target settings when config is missing', () => {
    const source = readPreviewRootSource();

    expect(source).toContain('const [cloudPublishSettingsOpen, setCloudPublishSettingsOpen] = useState(false);');
    expect(source).toContain("const [cloudPublishSettingsInitialTarget, setCloudPublishSettingsInitialTarget] = useState<CloudPublishTarget>('s3');");
    expect(source).toContain('const [latestCloudPublishItems, setLatestCloudPublishItems] = useState');
    expect(source).toContain('apiService.getCloudPublishingLatest()');
    expect(source).toContain("...(latest.targets.githubPages ? { 'github-pages': latest.targets.githubPages } : {})");
    expect(source).toContain("const handleOpenCloudPublishSettings = useCallback((target: CloudPublishTarget = 's3')");
    expect(source).toContain('const handlePublishCloudTarget = useCallback');
    expect(source).toContain('const handleCopyLatestCloudPublishUrl = useCallback');
    expect(source).toContain('const latestCloudPublishUrl = useMemo');
    expect(source).toContain('sort((a, b) => b.deployedAt.localeCompare(a.deployedAt))');
    expect(source).toContain('apiService.getCloudPublishingConfig()');
    expect(source).toContain("'github-pages': 'GitHub Pages'");
    expect(source).toContain('apiService.publishCloudTarget({');
    expect(source).toContain('setCloudPublishSettingsInitialTarget(target);');
    expect(source).toContain('setCloudPublishSettingsOpen(true);');
    expect(source).toContain("error?.code === 'CONFIG_REQUIRED'");
    expect(source).toContain("toast.success(`已发布到 ${targetLabel}`");
    expect(source).toContain('duration: Infinity');
    expect(source).toContain('target="_blank"');
    expect(source).toContain('rel="noreferrer"');
    expect(source).toContain('setLatestCloudPublishItems((current) => ({');
    expect(source).toContain('copyToClipboard(latestUrl)');
  });

  it('does not keep the legacy standalone TEXT_EDIT parent-window protocol', () => {
    const source = readPreviewActionsSource();

    expect(source).not.toContain('TEXT_EDIT_');
    expect(source).not.toContain('textEditState');
    expect(source).not.toContain('textEditAvailable');
  });

  it('keeps user-triggerable Markdown comment/edit parent-window protocols without old prototype comment mode', () => {
    const source = readPreviewActionsSource();

    expect(source).toContain('SPEC_EDIT_');
    expect(source).not.toContain('handleOpenAnnotation');
    expect(source).not.toContain('handleToggleAnnotation');
    expect(source).not.toContain('handleEnableSpecEdit');
    expect(source).not.toContain('handleSwitchSpecQuickEditMode');
    expect(source).toContain('handleSwitchDocQuickEditMode');
    expect(source).toContain("'comment'");
    expect(source).not.toContain("'specComment'");
  });
});
