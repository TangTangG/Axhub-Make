import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('useAssistantPanelController source', () => {
  it('uses base current file context to drive file-switch synchronization', () => {
    const source = readFileSync(resolve(__dirname, './useAssistantPanelController.tsx'), 'utf8');

    expect(source).toContain('const assistantBaseContextV1 = useMemo<AssistantContextV1>');
    expect(source).toContain('currentCanvas?: CanvasItem | null;');
    expect(source).toContain('currentTheme?: ThemeResourceItem | null;');
    expect(source).toContain('currentDataTable?: DataTableResourceItem | null;');
    expect(source).toContain('currentCanvas,');
    expect(source).toContain('currentTheme,');
    expect(source).toContain('currentDataTable,');
    expect(source).toContain('mergeAssistantContextForActiveFile(assistantBaseContextV1, assistantExternalContext)');
    expect(source).toContain('getAssistantContextCurrentFilePath(assistantBaseContextV1)');
    expect(source).toContain('const nextContext = buildAssistantCurrentFileSyncContext(assistantBaseContextV1);');
    expect(source).toContain('syncAssistantContextToTargets(nextContext, \'replace\', {');

    const baseContextSource = source.slice(
      source.indexOf('const assistantBaseContextV1 = useMemo<AssistantContextV1>'),
      source.indexOf('const assistantContextV1 = useMemo<AssistantContextV1>'),
    );
    expect(baseContextSource).toContain('currentCanvas,');
    expect(baseContextSource).toContain('currentTheme,');
    expect(baseContextSource).toContain('currentDataTable,');
    expect(baseContextSource).toContain('currentCanvas,');
    expect(baseContextSource).toContain('currentDataTable,');
    expect(baseContextSource).toContain('currentTheme,');
  });

  it('replaces stale URL context and resends the latest base context when Genie becomes available', () => {
    const source = readFileSync(resolve(__dirname, './useAssistantPanelController.tsx'), 'utf8');

    expect(source).toContain('buildAssistantContextUrl');
    expect(source).not.toContain("parsedUrl.searchParams.get('context')");
    expect(source).toContain('onAvailabilityChange: (available) =>');
    expect(source).toContain('const latestContext = latestAssistantSyncContextRef.current;');
    expect(source).toContain("updateContext(latestContext, 'replace')");
  });

  it('uses the runtime project path channel and lets Genie auto-target the frontend page', () => {
    const source = readFileSync(resolve(__dirname, './useAssistantPanelController.tsx'), 'utf8');

    expect(source).toContain('const resolvedIntegrationChannel = String(');
    expect(source).toContain('integrationChannel: resolvedIntegrationChannel');
    expect(source).toContain('assistantBridgeIntegrationChannelRef.current === resolvedIntegrationChannel');
    expect(source).toContain('assistantBridgeIntegrationChannelRef.current = resolvedIntegrationChannel;');
    expect(source).not.toContain('targetClientId: GENIE_REQUIRED_INTEGRATION_CLIENT_ID');
  });

  it('passes the opened Genie page URL to the integration bridge for frontend auto-targeting', () => {
    const source = readFileSync(resolve(__dirname, './useAssistantPanelController.tsx'), 'utf8');

    expect(source).toContain('const assistantTargetPageUrlRef = useRef(\'\');');
    expect(source).toContain('targetPageUrl: () => assistantTargetPageUrlRef.current || assistantIframeSrc');
    expect(source).toContain('assistantTargetPageUrlRef.current = nextUrl;');
  });

  it('opens Genie with the freshly resolved runtime cwd before React state catches up', () => {
    const source = readFileSync(resolve(__dirname, './useAssistantPanelController.tsx'), 'utf8');

    expect(source).toContain('activeProjectId: string | null;');
    expect(source).toContain('const projectId = activeProjectId?.trim() || undefined;');
    expect(source).toContain('projectId,');
    expect(source).toContain('const buildAssistantIframeUrlForRuntime = useCallback((');
    expect(source).toContain('providerOverride?: GenieProvider | null,');
    expect(source).toContain('const provider = providerOverride || genieProvider;');
    expect(source).toContain('const runtimeForUrl = runtimeOverride || assistantRuntime;');
    expect(source).toContain('providerOverride?: GenieProvider | null,');
    expect(source).toContain('const sourceUrl = targetUrl || buildAssistantIframeUrlForRuntime(runtimeForUrl, providerOverride);');
    expect(source).toContain('const handleOpenGenieWebAgent = useCallback((targetPath?: string, provider?: GenieProvider) => {');
    expect(source).toContain('void ensureAssistantReadyThenOpen(\'button\', undefined, targetPath, \'iframe\', provider);');
    expect(source).not.toContain('buildAssistantIframeUrlForRuntime(assistantRuntime, provider)');
    expect(source).toContain('openAssistantInNewWindowWithUrl(targetUrl, targetPath, resolvedRuntime, providerOverride);');
    expect(source).toContain('openAssistantWithUrl(targetUrl, targetPath, resolvedRuntime, providerOverride);');
  });

  it('keys assistant runtime probing by active project id so cached cwd cannot cross projects', () => {
    const source = readFileSync(resolve(__dirname, './useAssistantRuntime.ts'), 'utf8');

    expect(source).toContain('projectId?: string | null;');
    expect(source).toContain('function resolveAssistantRuntimeProjectKey(projectId?: string | null): string');
    expect(source).toContain("return projectId?.trim() || '__active__';");
    expect(source).toContain('const projectKey = resolveAssistantRuntimeProjectKey(projectId);');
    expect(source).toContain('stores: Record<string, AssistantRuntimeProjectStore>;');
    expect(source).toContain('requestAssistantRuntime(projectId, {');
    expect(source).toContain('apiService.getAssistantRuntime({');
    expect(source).toContain('projectId: projectId?.trim() || undefined,');
  });

  it('updates mounted assistant context without changing iframe src when the admin current file changes', () => {
    const source = readFileSync(resolve(__dirname, './useAssistantPanelController.tsx'), 'utf8');
    const fileSyncEffect = source.slice(
      source.indexOf('const nextCurrentFilePath = getAssistantContextCurrentFilePath(assistantBaseContextV1);'),
      source.indexOf('const resolveAssistantUrl = useCallback(('),
    );

    expect(source).toContain('const nextContext = buildAssistantCurrentFileSyncContext(assistantBaseContextV1);');
    expect(fileSyncEffect).toContain("syncAssistantContextToTargets(nextContext, 'replace', {");
    expect(fileSyncEffect).toContain('forceBridge: true,');
    expect(fileSyncEffect).not.toContain('syncAssistantIframeUrlContext(nextContext)');
    expect(fileSyncEffect).not.toContain('setAssistantIframeOverrideUrl');
    expect(fileSyncEffect).not.toContain('buildAssistantUrlWithContext');
  });

  it('resends the latest context with retry when an already opened Genie iframe finishes loading', () => {
    const source = readFileSync(resolve(__dirname, './useAssistantPanelController.tsx'), 'utf8');

    expect(source).toContain('const assistantIframeLoadSyncSignatureRef = useRef(\'\');');
    expect(source).toContain('const assistantBridgeContextSyncSignatureRef = useRef(\'\');');
    expect(source).toContain('const syncAssistantContextToTargets = useCallback((');
    expect(source).toContain('latestAssistantSyncContextRef.current = context;');
    expect(source).toContain("assistantBridgeRef.current?.updateContext(context, mode)");
    expect(source).toContain('const contextSignature = JSON.stringify(assistantContextV1);');
    expect(source).toContain('assistantIframeLoadSyncSignatureRef.current = contextSignature;');
    expect(source).toContain("syncAssistantContextToTargets(assistantContextV1, 'replace', {");
    expect(source).toContain('assistantIframeLoadSyncSignatureRef.current = \'\';');
    expect(source).toContain('if (!assistantSupportsBridge || !assistantVisible || !assistantIframeLoaded) {');
  });

  it('pushes web-editor element clicks as merged replace context through the bridge', () => {
    const source = readFileSync(resolve(__dirname, './useAssistantPanelController.tsx'), 'utf8');
    const requestHandlerSource = source.slice(
      source.indexOf('const handleWebEditorGenieRequest = useCallback(async (payload: WebEditorGenieRequestPayload) => {'),
      source.indexOf('const syncAssistantCanvasComments = useCallback('),
    );

    expect(requestHandlerSource).toContain('latestAssistantSyncContextRef.current = nextContext;');
    expect(requestHandlerSource).toContain('const activeBase = normalizeGenieContextV1(assistantContextV1, {');
    expect(requestHandlerSource).not.toContain('normalizeGenieContextV1(assistantExternalContext ?? assistantContextV1');
    expect(requestHandlerSource).toContain('const openContext = nextContext ?? context;');
    expect(requestHandlerSource).not.toContain('const openContext = isSelectionAppend ? context : nextContext;');
    expect(requestHandlerSource).toContain('const contextToSync = nextContext;');
    expect(requestHandlerSource).toContain('if (contextToSync) {');
    expect(requestHandlerSource).toContain("syncAssistantContextToTargets(contextToSync, 'replace', {");
    expect(requestHandlerSource).not.toContain('!(isSelectionAppend && openedWithContextUrl)');
    expect(requestHandlerSource).not.toContain("const syncMode = isSelectionAppend ? 'append' : 'replace';");
  });

  it('exposes a comment sync callback and sends comment-only context changes with replace mode', () => {
    const source = readFileSync(resolve(__dirname, './useAssistantPanelController.tsx'), 'utf8');

    expect(source).toContain('syncAssistantCanvasComments');
    expect(source).toContain('buildAssistantContextWithCanvasComments');
    expect(source).toContain("syncAssistantContextToTargets(nextContext, 'replace', {");
    expect(source).toContain('setAssistantExternalContext(nextContext);');
    expect(source).toContain('assistantContextCommentsSignatureRef');
  });

  it('can open a non-Genie web agent URL directly in the sidebar iframe', () => {
    const source = readFileSync(resolve(__dirname, './useAssistantPanelController.tsx'), 'utf8');

    expect(source).toContain('const openRawUrlInAssistantPanel = useCallback((url: string) => {');
    expect(source).toContain('stopAssistantIntegrationBridge();');
    expect(source).toContain('setAssistantIframeOverrideUrl(nextUrl);');
    expect(source).toContain('handleOpenGenieWebAgent');
    expect(source).toContain('openRawUrlInAssistantPanel');
  });

  it('uses plain AI wording instead of raw npx probe errors in the not-ready modal', () => {
    const source = readFileSync(resolve(__dirname, './useAssistantPanelController.tsx'), 'utf8');
    const notReadyModalSource = source.slice(
      source.indexOf('const showAssistantNotReadyModal = useCallback(('),
      source.indexOf('const waitForAssistantRuntimeReady = useCallback('),
    );

    expect(source).toContain("messageApi.loading('正在打开 AI...', 0)");
    expect(source).toContain("const DEFAULT_ASSISTANT_INSTALL_CMD = 'npx @axhub/genie@latest';");
    expect(source).toContain("start: 'npx @axhub/genie@latest',");
    expect(source).toContain("status: 'npx @axhub/genie@latest status --json',");
    expect(source).not.toContain('正在启动并检测 Axhub Genie');
    expect(notReadyModalSource).toContain('请先通过 CLI 启动 AI 助手。');
    expect(notReadyModalSource).toContain('在终端执行这条启动命令，完成后再回来打开 AI。');
    expect(notReadyModalSource).toContain("title: 'AI 助手未就绪'");
    expect(notReadyModalSource).not.toContain('打开 Genie');
    expect(notReadyModalSource).not.toContain('Axhub Genie 未就绪');
    expect(notReadyModalSource).toContain("messageApi.success('启动命令已复制')");
    expect(notReadyModalSource).not.toContain('{runtime.health.message}');
    expect(notReadyModalSource).not.toContain("messageApi.success('npx 命令已复制')");
  });
});
