import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './ExcalidrawCanvas.tsx'), 'utf8');
}

describe('ExcalidrawCanvas source', () => {
  it('preserves nested prototype canvas API paths by encoding each segment separately', () => {
    const source = readSource();
    const encoderStart = source.indexOf('function encodeCanvasApiPath(canvasName: string): string {');
    const encoderEnd = source.indexOf('\n}\n\nfunction getCanvasBridgeCanvasName', encoderStart);
    const encoderSource = source.slice(encoderStart, encoderEnd);

    expect(encoderStart).toBeGreaterThan(-1);
    expect(encoderSource).toContain(".split('/')");
    expect(encoderSource).toContain('.filter(Boolean)');
    expect(encoderSource).toContain('.map((segment) => encodeURIComponent(segment))');
    expect(encoderSource).toContain(".join('/')");
    expect(source).toContain('fetch(`/api/canvas/${encodeCanvasApiPath(canvasName)}`)');
    expect(source).toContain('fetch(`/api/canvas/${encodeCanvasApiPath(currentNameRef.current)}`)');
    expect(source).toContain('const url = `/api/canvas/${encodeCanvasApiPath(currentNameRef.current)}`;');
    expect(source).not.toContain('encodeURIComponent(canvasName)');
    expect(source).not.toContain('encodeURIComponent(currentNameRef.current)');
  });

  it('renders the canvas search menu item with a search icon', () => {
    const source = readSource();

    expect(source).toMatch(/import\s+\{[^}]*Search[^}]*\}\s+from 'lucide-react'/s);
    expect(source).toContain('icon={<Search className="axhub-canvas-menu-icon" />}');
    expect(source).toContain('{SEARCH_MENU_LABEL}');
  });

  it('adds a main-menu property panel submenu for position and default shape', () => {
    const source = readSource();

    expect(source).toMatch(/import\s+\{[^}]*SlidersHorizontal[^}]*\}\s+from 'lucide-react'/s);
    expect(source).toContain('<MainMenu.Sub>');
    expect(source).toContain('<MainMenu.Sub.Trigger');
    expect(source).toContain('<MainMenu.Sub.Content className="axhub-canvas-property-panel-submenu">');
    expect(source).toContain('属性栏');
    expect(source).toContain('显示位置');
    expect(source).toContain('默认形态');
    expect(source).toContain("propertyPanelPosition === 'left'");
    expect(source).toContain("propertyPanelPosition === 'right'");
    expect(source).toContain("propertyPanelMode === 'expanded'");
    expect(source).toContain("propertyPanelMode === 'collapsed'");
  });

  it('remounts Excalidraw only after preserving the current scene when desktop UI mode changes', () => {
    const source = readSource();

    expect(source).toContain('const [excalidrawUiModeRevision, setExcalidrawUiModeRevision] = useState(0);');
    expect(source).toContain('setInitialData(createCurrentSceneInitialData(excalidrawAPI));');
    expect(source).toContain('setExcalidrawUiModeRevision((revision) => revision + 1);');
    expect(source).toContain('key={`${canvasName}:${excalidrawUiModeRevision}`}');
  });

  it('does not open compact property popups for the expanded native panel', () => {
    const source = readSource();

    expect(source).toContain("if (mode === 'expanded') {");
    expect(source).toContain('COMPACT_PROPERTY_POPUPS.has(appState?.openPopup) ? null : undefined');
    expect(source).not.toContain("return PROPERTY_PANEL_OPEN_POPUP;\n}");
  });

  it('keeps copied canvas element links minimal and compatible with Excalidraw deep links', () => {
    const source = readSource();

    expect(source).toContain('url.searchParams.set(EXCALIDRAW_ELEMENT_LINK_PARAM, id);');
    expect(source).not.toContain('url.searchParams.set(AXHUB_CANVAS_ELEMENT_PARAM, id);');
    expect(source).not.toContain('url.searchParams.set(AXHUB_CANVAS_NAME_PARAM, currentNameRef.current);');
    expect(source).not.toContain('axhubCanvasElementType');
  });

  it('mounts the AI image tool and wires explicit scene persistence', () => {
    const source = readSource();

    expect(source).toContain("import CanvasAiImageTool from '../../domains/ai-image/CanvasAiImageTool';");
    expect(source).toContain("import AiImageHistoryDialog from '../../domains/ai-image/AiImageHistoryDialog';");
    expect(source).toMatch(/import\s+\{[^}]*History[^}]*\}\s+from 'lucide-react'/s);
    expect(source).toContain('<CanvasAiImageTool');
    expect(source).toContain('preferredPromptClient={preferredPromptClient}');
    expect(source).toContain('onSceneMutated={scheduleExplicitCanvasSave}');
    expect(source).toContain('handleCanvasDrop');
  });

  it('adds original image files to copy events for selected canvas images', () => {
    const source = readSource();

    expect(source).toContain("import { enhanceCanvasImageCopyEvent } from './canvasImageClipboard';");
    expect(source).toContain('const handleCanvasImageCopy = (event: ClipboardEvent) => {');
    expect(source).toContain('enhanceCanvasImageCopyEvent(event, {');
    expect(source).toContain('activeElement: document.activeElement,');
    expect(source).toContain('container: canvasContainerRef.current,');
    expect(source).toContain('elements: excalidrawAPI.getSceneElements(),');
    expect(source).toContain('appState: excalidrawAPI.getAppState(),');
    expect(source).toContain('files: excalidrawAPI.getFiles?.() || {},');
    expect(source).toContain("document.addEventListener('copy', handleCanvasImageCopy, true)");
    expect(source).toContain("document.removeEventListener('copy', handleCanvasImageCopy, true)");
  });

  it('moves the generation record list into the canvas main menu', () => {
    const source = readSource();

    expect(source).toContain('const [aiImageHistoryOpen, setAiImageHistoryOpen] = useState(false);');
    expect(source).toContain('const handleInsertAiImageHistoryTask = useCallback');
    expect(source).toContain('getAiImageTaskCanvasImages(task)');
    expect(source).toContain('resolveCanvasGeneratorPlacement({');
    expect(source).toContain('createAiImageResultElements({');
    expect(source).toContain('setAiImageHistoryOpen(false);');
    expect(source).toContain('scheduleExplicitCanvasSave();');
    expect(source).toContain('onOpenAiImageHistory={() => setAiImageHistoryOpen(true)}');
    expect(source).toContain('onOpenAiImageHistory: () => void;');
    expect(source).toContain('icon={<History className="axhub-canvas-menu-icon" />}');
    expect(source).toContain('生成记录');
    expect(source).not.toContain('图片生成历史');
    expect(source).toContain('<AiImageHistoryDialog');
    expect(source).toContain('open={aiImageHistoryOpen}');
    expect(source).toContain('onOpenChange={setAiImageHistoryOpen}');
    expect(source).toContain('onInsertImages={handleInsertAiImageHistoryTask}');
  });

  it('configures AI image history storage only for prototype canvas paths', () => {
    const source = readSource();

    expect(source).toContain('export function resolveAiImageHistoryTargetPath(...values: Array<string | undefined>): string | undefined');
    expect(source).toContain("replace(/^src\\//u, '')");
    expect(source).toContain('const prototypePathMatch = normalized.match(/^prototypes\\/([^/]+)$/iu);');
    expect(source).toContain('return `prototypes/${prototypePathMatch[1]}`;');
    expect(source).toContain("return `prototypes/${match[1]}`;");
    expect(source).toContain('const targetPath = resolveAiImageHistoryTargetPath(canvasName, canvasFilePath);');
    expect(source).toContain('void getAiImageTaskStore().configure({ targetPath });');
    expect(source).toContain('void getPrototypeGenerationTaskStore().configure({ targetPath });');
    expect(source).toContain('}, [canvasName, canvasFilePath]);');
  });

  it('does not pass prompts into generated AI image canvas nodes', () => {
    const source = readSource();
    const historyInsertStart = source.indexOf('const handleInsertAiImageHistoryTask = useCallback');
    const historyInsertEnd = source.indexOf('// ── Flush:', historyInsertStart);
    const historyInsertSource = source.slice(historyInsertStart, historyInsertEnd);

    expect(historyInsertSource).toContain('createAiImageResultElements({');
    expect(historyInsertSource).toContain('taskId: task.id,');
    expect(historyInsertSource).not.toContain('prompt: task.prompt');
  });

  it('declares explicit canvas saving before the history insertion callback depends on it', () => {
    const source = readSource();
    const explicitSaveIndex = source.indexOf('const scheduleExplicitCanvasSave = useCallback');
    const historyInsertIndex = source.indexOf('const handleInsertAiImageHistoryTask = useCallback');

    expect(explicitSaveIndex).toBeGreaterThan(-1);
    expect(historyInsertIndex).toBeGreaterThan(-1);
    expect(explicitSaveIndex).toBeLessThan(historyInsertIndex);
  });

  it('explicitly persists sidebar add-to-canvas and drag-drop scene mutations', () => {
    const source = readSource();

    const addToCanvasStart = source.indexOf("window.addEventListener('axhub:addToCanvas', handler);");
    const addToCanvasEffect = source.slice(source.lastIndexOf('useEffect(() => {', addToCanvasStart), addToCanvasStart);
    expect(addToCanvasEffect).toContain('createEmbeddableFromDrop(');
    expect(addToCanvasEffect).toContain('scheduleExplicitCanvasSave();');
    expect(source).toContain('}, [excalidrawAPI, scheduleExplicitCanvasSave]);');

    const dropHandlerStart = source.indexOf('const handleCanvasDrop = useCallback');
    const dropHandlerEnd = source.indexOf('if (loading) {', dropHandlerStart);
    const dropHandler = source.slice(dropHandlerStart, dropHandlerEnd);
    expect(dropHandler).toContain('void createImageElementFromDrop(excalidrawAPI, payload, x, y).then(() => {');
    expect(dropHandler).toContain('scheduleExplicitCanvasSave();');
    expect(dropHandler).toContain('createEmbeddableFromDrop(');
    expect(dropHandler).toContain('}, [excalidrawAPI, scheduleExplicitCanvasSave]);');
  });

  it('mounts the prototype generator tool with acpx prompt execution and resource refresh props', () => {
    const source = readSource();

    expect(source).toContain("import CanvasPrototypeGenerationTool from '../../domains/prototype-generation/CanvasPrototypeGenerationTool';");
    expect(source).toContain('assistantApiBaseUrl?: string;');
    expect(source).toContain('assistantProjectPath?: string;');
    expect(source).toContain('preferredPromptClient?: PromptClientPreference;');
    expect(source).toContain('prototypes?: ItemData[];');
    expect(source).toContain('onRefreshPrototypes?: () => Promise<ItemData[]>;');
    expect(source).not.toContain('onStartAssistantRuntimeForCanvas?: () => Promise<{ apiBaseUrl?: string; projectPath?: string } | null | undefined>;');
    expect(source).toContain('<CanvasPrototypeGenerationTool');
    expect(source).toContain('canvasFilePath={canvasFilePath || canvasName}');
    expect(source).not.toContain('assistantApiBaseUrl={assistantApiBaseUrl}');
    expect(source).not.toContain('assistantProjectPath={assistantProjectPath}');
    expect(source).toContain('preferredPromptClient={preferredPromptClient}');
    expect(source).toContain('prototypes={prototypes}');
    expect(source).toContain('onRefreshPrototypes={onRefreshPrototypes}');
    expect(source).not.toContain('onStartAssistantRuntime={onStartAssistantRuntimeForCanvas}');
    expect(source).toContain('onSceneMutated={scheduleExplicitCanvasSave}');
  });

  it('opens prototype preview nodes through the client preview url instead of the admin deep link', () => {
    const source = readSource();
    const resolverStart = source.indexOf('function resolveEmbeddableOpenUrl');
    const resolverEnd = source.indexOf('export function createEmbeddableFromDrop', resolverStart);
    const resolverSource = source.slice(resolverStart, resolverEnd);

    expect(resolverSource).toContain("if (resolveEmbeddableResourceType(element) === 'prototype' && previewUrl) {");
    expect(resolverSource).toContain('return previewUrl;');
    expect(resolverSource).toContain('const storedOpenUrl = resolveString(element?.customData?.openUrl);');
  });

  it('dispatches both top toolbar AI actions from the compact toolbar enhancer', () => {
    const source = readSource();

    expect(source).toContain('onAiImageToolClick: () => {');
    expect(source).toContain("document.dispatchEvent(new CustomEvent('axhub:insertAiImageGenerator'));");
    expect(source).toContain("onPrototypeToolClick: () => document.dispatchEvent(new CustomEvent('axhub:insertPrototypeGenerator'))");
  });

  it('applies bridge reloads as remote scene updates without scheduling autosave bounce-back', () => {
    const source = readSource();

    expect(source).toContain('const REMOTE_RELOAD_CHANGE_IGNORE_MS = 1000;');
    expect(source).toContain('const applyingRemoteCanvasReloadRef = useRef(false);');
    expect(source).toContain('const remoteReloadIgnoreUntilRef = useRef(0);');
    expect(source).toContain('function normalizeCanvasDataForSaveBaseline(data: any): string {');
    expect(source).toContain("source: 'axhub-make'");
    expect(source).toContain('const elements = Array.isArray(data?.elements) ? data.elements.filter((el: any) => !el.isDeleted) : [];');
    expect(source).toContain('elements: canonicalized.elements,');
    expect(source).toContain('const serverContent = normalizeCanvasDataForSaveBaseline(data);');
    expect(source).toContain("import {\n    applyRemoteCanvasFileIdReplacements,\n    buildRemoteCanvasScenePatch,\n    buildRemoteCanvasFilePatch,\n    canonicalizeRemoteCanvasFileAliasesForSave,\n    type RemoteCanvasFileAlias,\n} from './canvasRemoteSceneMerge';");
    expect(source).toContain('const remoteContent = normalizeCanvasDataForSaveBaseline(data);');
    expect(source).toContain('lastSavedContentRef.current = remoteContent;');
    expect(source).toContain('applyingRemoteCanvasReloadRef.current = true;');
    expect(source).toContain('remoteReloadIgnoreUntilRef.current = Date.now() + REMOTE_RELOAD_CHANGE_IGNORE_MS;');
    expect(source).toContain('const remoteCanvasFileAliasesRef = useRef<Record<string, RemoteCanvasFileAlias>>({});');
    expect(source).toContain('const remoteFilePatch = buildRemoteCanvasFilePatch(');
    expect(source).toContain('remoteCanvasFileAliasesRef.current,');
    expect(source).toContain('if (remoteFilePatch.files.length > 0) {');
    expect(source).toContain('excalidrawAPI.addFiles(remoteFilePatch.files);');
    expect(source).toContain('remoteCanvasFileAliasesRef.current = remoteFilePatch.fileAliases;');
    expect(source).toContain('const remoteElements = applyRemoteCanvasFileIdReplacements(');
    expect(source).toContain('remoteFilePatch.fileIdReplacements,');
    expect(source).toContain('const canonicalized = canonicalizeRemoteCanvasFileAliasesForSave(');
    expect(source).toContain('remoteCanvasFileAliasesRef.current,');
    expect(source).toContain('elements: canonicalized.elements.filter((el: any) => !el.isDeleted),');
    expect(source).toContain('files: canonicalized.files,');
    expect(source).toContain('const remoteScenePatch = buildRemoteCanvasScenePatch({');
    expect(source).toContain('currentElements: excalidrawAPI.getSceneElements(),');
    expect(source).toContain('remoteElements,');
    expect(source).toContain('currentAppState: excalidrawAPI.getAppState(),');
    expect(source).toContain('if (remoteScenePatch.hasSceneChanges) {');
    expect(source).toContain('elements: remoteScenePatch.elements,');
    expect(source).toContain('appState: remoteScenePatch.appState,');
    expect(source).toContain('} else {\n                                applyingRemoteCanvasReloadRef.current = false;');
    expect(source).toContain('captureUpdate: CaptureUpdateAction.NEVER');
    expect(source).not.toContain('elements: data.elements || []');
    expect(source).toContain('pendingLocalContentRef.current = null;');
    expect(source).toContain('sendCanvasBridgeStatus(false);');
    expect(source).toContain('if (applyingRemoteCanvasReloadRef.current || Date.now() < remoteReloadIgnoreUntilRef.current) {');
    expect(source).toContain('applyingRemoteCanvasReloadRef.current = false;');
    expect(source).toContain('remoteReloadIgnoreUntilRef.current = 0;');
    expect(source).toContain('const currentContent = normalizeSavedCanvasContent(buildSavePayload(elements, appState));');
    expect(source).toContain('if (currentContent === lastSavedContentRef.current) {');
    expect(source).not.toContain('if (withinRemoteReloadWindow || currentContent === lastSavedContentRef.current) {');
  });

  it('fits active preview embeds into view only when they are clipped', () => {
    const source = readSource();

    expect(source).toContain("import { shouldFitElementIntoCanvasViewport } from './canvas-embeds/activePreviewViewport';");
    expect(source).toContain('AXHUB_EMBED_ACTIVE_PREVIEW_CHANGED_EVENT');
    expect(source).toContain('detail?.active !== true');
    expect(source).toContain('shouldFitElementIntoCanvasViewport({');
    expect(source).toContain('element: targetElement,');
    expect(source).toContain('appState,');
    expect(source).toContain('if (!shouldFitIntoView) return;');
    expect(source).toContain('excalidrawAPI.scrollToContent(detail.elementId, {');
    expect(source).toContain('fitToContent: true,');
    expect(source).toContain('animate: false,');
    expect(source).toContain('maxZoom: 1.4,');
  });

  it('opens embedded resources through the shared IDE API helper', () => {
    const source = readSource();

    expect(source).toContain("import { apiService } from '../../services/index.api';");
    expect(source).toContain('await apiService.openIDE({');
    expect(source).toContain('ide: resolveVisibleIDEPreference(configResult?.automation?.defaultIDE, configResult?.ideAvailability)');
    expect(source).toContain('targetPath: filePath');
    expect(source).not.toContain("fetch('/api/ide/open'");
  });
});
