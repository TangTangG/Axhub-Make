import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('OpenInDropdown source', () => {
  it('saves IDE preference through the server preferences API', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');

    expect(source).toContain("import { apiService } from '../../services/api';");
    expect(source).toContain('apiService.saveServerPreferences');
    expect(source).not.toContain("const configRes = await fetch('/api/config');");
    expect(source).not.toContain('const currentConfig = await configRes.json();');
  });

  it('renders online Genie agents and nests CLI agents under the local app group', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');
    const onlineOptionsSource = source.slice(
      source.indexOf('const ONLINE_WEB_AGENT_OPTIONS'),
      source.indexOf('export default function OpenInDropdown'),
    );

    expect(source).toContain('在本地应用中打开');
    expect(source).not.toContain("renderAgentGroup('在编辑器中打开'");
    expect(source).not.toContain("renderAgentGroup('在 CLI 中打开'");
    expect(source).toContain('本地 CLI');
    expect(source).toContain('在线打开');
    expect(source).toContain("title: '本地应用'");
    expect(source).toContain("title: '本地 CLI'");
    expect(source).toContain('GeminiCLI');
    expect(source).not.toContain('GeminiCli');
    expect(source).toContain('支持：Claude Code、Codex、OpenCode、Gemini CLI');
    expect(source).toContain('ONLINE_WEB_AGENT_OPTIONS');
    expect(source).toContain('genieProvider?: GenieProvider;');
    expect(onlineOptionsSource).not.toContain("webAgent: 'opencode'");
    expect(onlineOptionsSource).toContain("label: 'OpenCode'");
    expect(onlineOptionsSource).not.toContain("label: 'OpenCode Web UI'");
    expect(onlineOptionsSource).toContain("webAgent: 'genie'");
    expect(source).toContain("availabilitySource: 'cli'");
    expect(source).toContain("availabilityKey: 'claudecode'");
    expect(source).toContain("availabilityKey: 'codex'");
    expect(source).toContain("availabilityKey: 'opencode'");
    expect(source).toContain("availabilityKey: 'gemini'");
    expect(source).toContain("genieProvider: 'opencode'");
    expect(source).not.toContain('未检测到可用的本地应用或编辑器');
    expect(source).not.toContain('未检测到可用的 CLI Agent');
    expect(source).toContain('未检测到可用的 Web Agent');
    expect(source).not.toContain('hasLocalAppMenuItems');
    expect(source).toContain('const renderAgentGroup =');
    expect(source).toContain('const MAX_INLINE_LOCAL_APP_OPEN_OPTIONS = 5;');
    expect(source).toContain('const LOCAL_APP_MORE_THRESHOLD = 5;');
    expect(source).toContain('const localAppOpenOptions = [');
    expect(source).toContain('...LOCAL_APP_AGENT_OPTIONS.map');
    expect(source).toContain('...MAIN_IDE_OPTIONS.map');
    expect(source).toContain('const shouldCollapseLocalAppOpenOptions = localAppOpenOptions.length > LOCAL_APP_MORE_THRESHOLD;');
    expect(source).toContain('const inlineLocalAppOpenOptions = shouldCollapseLocalAppOpenOptions');
    expect(source).toContain('const overflowLocalAppOpenOptions = shouldCollapseLocalAppOpenOptions');
    expect(source).toContain('LOCAL_APP_AGENT_OPTIONS');
    expect(source).not.toContain('getVisibleAgentOptions');
    expect(source).not.toContain('const visibleLocalAppAgentOptions =');
    expect(source).not.toContain('const visibleCLIAgentOptions =');
    expect(source).not.toContain('const detectedIDEOptions =');
    expect(source).not.toContain('LOCAL_APP_AGENT_OPTIONS.map(renderLocalAppOption)');
    expect(source).toContain('apiService.openLocalAppAgent({ agent, projectId, targetPath: openTargetPath });');
    expect(source).toContain("void savePreference({ type: 'local-app', value: agent })");
    expect(source).toContain("if (openMethod.type === 'local-app')");
    expect(source).toContain('<DropdownMenuSub>');
    expect(source).toContain('<DropdownMenuSubTrigger');
    expect(source).toContain('更多');
    expect(source).toContain('MoreHorizontal');
    expect(source).toContain('<MoreHorizontal className="h-3.5 w-3.5" />');
    expect(source).not.toContain('<ChevronRight className="h-3.5 w-3.5" />');
    expect(source).toContain('overflowLocalAppOpenOptions.map(renderLocalAppOpenOption)');
    expect(source).toContain('CLI_AGENT_OPTIONS.map(renderCLIAgentOption)');
    expect(source).toContain('const renderCLIAgentSubmenu =');
    expect(source).toContain('className="w-64 p-1.5"');
    expect(source).toContain('className="z-[3000] w-72 max-w-none whitespace-normal leading-5"');
    expect(source).toContain('renderGroupHelp(help)');
    expect(source).toContain('px-2 pb-1 pt-2 first:pt-1');
    expect(source).toContain('text-[11px] font-medium leading-4 text-muted-foreground');
    expect(source).toContain('className="-mx-1 my-1.5"');
    expect(source).toContain("if (agent === 'genie' && onOpenGenieWebAgent)");
    expect(source).toContain('onOpenGenieWebAgent(openTargetPath, provider)');
    expect(source).toContain("void savePreference({ type: 'web', value: provider || agent })");
    expect(source).toContain("if (agent === 'opencode' && onOpenGenieWebAgent)");
    expect(source).toContain("void savePreference({ type: 'web', value: 'opencode' })");
    expect(source).toContain("onOpenGenieWebAgent(openTargetPath, 'opencode')");
    expect(source).not.toContain('const WEB_AGENT_READY_ATTEMPTS = 20;');
    expect(source).not.toContain('async function waitForWebAgentUrlReady(url: string): Promise<boolean>');
    expect(source).not.toContain('const ready = await waitForWebAgentUrlReady(readinessUrl);');
    expect(source).toContain('activeProjectId?: string | null;');
    expect(source).toContain('targetProjectId?: string | null;');
    expect(source).toContain('targetPath?: string | null;');
    expect(source).toContain('const projectId = targetProjectId?.trim() || activeProjectId?.trim() || undefined;');
    expect(source).toContain('const openTargetPath = targetPath?.trim() || undefined;');
    expect(source).toContain('handleOpenProjectInIDE(ide, openTargetPath)');
    expect(source).toContain('apiService.openCLIAgent({ agent, projectId, targetPath: openTargetPath });');
    expect(source).toContain('projectId,');
    expect(source).toContain('targetPath: openTargetPath');
    expect(source).not.toContain('corsOrigin: window.location.origin');
    expect(source).not.toContain("let panelUrl = result.url?.startsWith('/')");
    expect(source).not.toContain('await Promise.resolve(onOpenWebAgentInPanel(panelUrl));');
    expect(source).not.toContain("toast.warning('OpenCode 正在启动，已在侧边栏打开');");
    expect(source).toContain('void handleOpenWithOnlineWebAgent(option)');
    expect(source).toContain('void handleOpenWithWebAgent(storedWebOpenMethod.agent, storedWebOpenMethod.provider);');
    expect(source).toContain('void handleOpenWithLocalApp(openMethod.value as LocalAppAgent);');
    expect(source).not.toContain('<DropdownMenuLabel>{renderGroupLabel');
    expect(source).not.toContain('<DropdownMenuSeparator />');
    expect(source).not.toContain('visibleIDEOptions.length > 0');
  });

  it('loads cached agent versions when the open menu opens and renders menu extra text', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');
    const agentVersionCacheSource = readFileSync(resolve(__dirname, '../../utils/agentVersionCache.ts'), 'utf8');

    expect(source).toContain('AGENT_VERSION_CACHE_TTL_MS');
    expect(source).toContain('apiService.getAgentVersions');
    expect(source).toContain('agentVersionCacheRef');
    expect(source).toContain('formatAgentVersionMeta');
    expect(source).toContain('handleDropdownOpenChange');
    expect(source).toContain('loadAgentVersions');
    expect(agentVersionCacheSource).toContain('未安装');
    expect(source).toContain('optionMeta');
    expect(source).toContain('ml-auto');
  });

  it('keeps online Genie agents visible even when the local agent is missing', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');
    const visibleOnlineSource = source.slice(
      source.indexOf('const visibleOnlineWebAgentOptions'),
      source.indexOf('const projectId'),
    );
    const propsSource = source.slice(
      source.indexOf('export default function OpenInDropdown({'),
      source.indexOf('}: OpenInDropdownProps)'),
    );

    expect(source).toContain('agentAvailability?: RuntimeAgentAvailability;');
    expect(visibleOnlineSource).toContain('const visibleOnlineWebAgentOptions = ONLINE_WEB_AGENT_OPTIONS;');
    expect(visibleOnlineSource).not.toContain('.filter');
    expect(visibleOnlineSource).not.toContain('agentAvailability');
    expect(visibleOnlineSource).not.toContain("status !== 'missing'");
    expect(propsSource).not.toContain('agentAvailability,');
  });

  it('places OpenCode third in the online Genie list and local apps before existing IDE options', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');
    const agentTypesSource = readFileSync(resolve(__dirname, '../../../server/agentTypes.ts'), 'utf8');
    const onlineOptionsSource = source.slice(
      source.indexOf('const ONLINE_WEB_AGENT_OPTIONS'),
      source.indexOf('export default function OpenInDropdown'),
    );

    const onlineIndex = source.indexOf("renderAgentGroup('在线打开'");
    const localAppGroupIndex = source.indexOf("renderAgentGroup('在本地应用中打开'");
    const localAppOptionIndex = source.indexOf('...LOCAL_APP_AGENT_OPTIONS.map');
    const editorIndex = source.indexOf('...MAIN_IDE_OPTIONS.map');
    const claudeIndex = onlineOptionsSource.indexOf("value: 'claudecode'");
    const codexIndex = onlineOptionsSource.indexOf("value: 'codex'");
    const opencodeIndex = onlineOptionsSource.indexOf("value: 'opencode-webui'");
    const geminiIndex = onlineOptionsSource.indexOf("value: 'gemini'");

    expect(onlineIndex).toBeGreaterThan(-1);
    expect(localAppGroupIndex).toBeGreaterThan(-1);
    expect(localAppOptionIndex).toBeGreaterThan(-1);
    expect(editorIndex).toBeGreaterThan(-1);
    expect(onlineIndex).toBeLessThan(localAppGroupIndex);
    expect(localAppOptionIndex).toBeLessThan(editorIndex);
    expect(claudeIndex).toBeGreaterThan(-1);
    expect(codexIndex).toBeGreaterThan(-1);
    expect(opencodeIndex).toBeGreaterThan(-1);
    expect(geminiIndex).toBeGreaterThan(-1);
    expect(claudeIndex).toBeLessThan(codexIndex);
    expect(codexIndex).toBeLessThan(opencodeIndex);
    expect(opencodeIndex).toBeLessThan(geminiIndex);
    expect(agentTypesSource).toContain("{ value: 'codex', label: 'Codex' }");
    expect(agentTypesSource).toContain("{ value: 'opencode', label: 'OpenCode' }");
  });

  it('uses OpenAI only for the online Codex option and keeps local Codex app branding', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');
    const onlineIconSource = source.slice(
      source.indexOf('const getOnlineWebAgentIcon'),
      source.indexOf('/** Get icon for the current open method'),
    );
    const localAppIconSource = source.slice(
      source.indexOf('const getLocalAppIcon'),
      source.indexOf('const getWebAgentIcon'),
    );

    expect(source).toContain('OpenAI,');
    expect(onlineIconSource).toContain("if (option.genieProvider === 'codex') return <OpenAI size={14} />;");
    expect(onlineIconSource).not.toContain("if (option.genieProvider === 'codex') return <Codex.Color size={14} />;");
    expect(localAppIconSource).toContain("if (agent === 'codex') return <Codex.Color size={14} />;");
  });

  it('keeps local app and CLI menus fixed regardless of local installation state', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');

    expect(source).toContain('...LOCAL_APP_AGENT_OPTIONS.map');
    expect(source).toContain('...MAIN_IDE_OPTIONS.map');
    expect(source).toContain('CLI_AGENT_OPTIONS.map(renderCLIAgentOption)');
    expect(source).not.toContain('getVisibleAgentOptions');
    expect(source).not.toContain('isIDEMissing');
    expect(source).not.toContain('未检测到可用的本地应用或编辑器');
    expect(source).not.toContain('未检测到可用的 CLI Agent');
    expect(source).toContain("type LocalAppOpenOption =");
    expect(source).toContain("kind: 'local-app';");
    expect(source).toContain("kind: 'ide';");
    expect(source).toContain('localAppOpenOptions.length > LOCAL_APP_MORE_THRESHOLD');
    expect(source).toContain('localAppOpenOptions.slice(0, MAX_INLINE_LOCAL_APP_OPEN_OPTIONS)');
    expect(source).toContain('localAppOpenOptions.slice(MAX_INLINE_LOCAL_APP_OPEN_OPTIONS)');
    expect(source).toContain('inlineLocalAppOpenOptions.map(renderLocalAppOpenOption)');
    expect(source).toContain('overflowLocalAppOpenOptions.map(renderLocalAppOpenOption)');
  });

  it('explicitly exposes local app options through the browser-safe common agent boundary', () => {
    const source = readFileSync(resolve(__dirname, '../../../common/agent.ts'), 'utf8');

    expect(source).toContain('LOCAL_APP_AGENT_OPTIONS');
    expect(source).toContain('export type');
  });

  it('keeps the open button text readable in default and active states', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');

    expect(source).toContain("'text-foreground/80 hover:text-foreground'");
    expect(source).toContain("'border border-primary/45 bg-background shadow-none'");
    expect(source).toContain("'text-primary hover:bg-primary/5 hover:text-primary'");
    expect(source).toContain("'border-primary/25 text-primary/70 hover:bg-primary/5 hover:text-primary'");
    expect(source).toContain('data-[active=true]:text-primary data-[active=true]:hover:bg-primary/5 data-[active=true]:hover:text-primary');
    expect(source).toContain('data-active={buttonActive ? \'true\' : undefined}');
    expect(source).not.toContain('text-primary hover:bg-background hover:text-primary');
    expect(source).not.toContain('border border-slate-900 bg-slate-900');
    expect(source).not.toContain('text-white hover:bg-slate-800');
    expect(source).not.toContain('bg-primary/[0.08]');
    expect(source).not.toContain('shadow-[0_0_0_2px');
  });

  it('sizes the open button to fit the active label instead of clipping it', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');

    expect(source).toContain("'inline-flex items-center h-6 shrink-0");
    expect(source).toContain('buttonActive ? \'min-w-[104px] w-auto\' : showExpanded ? \'w-[82px]\' : \'w-[68px]\'');
    expect(source).toContain('whitespace-nowrap');
    expect(source).not.toContain('h-6 w-[82px]');
  });

  it('closes the open Web Agent panel when the active open button is clicked', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');

    expect(source).toContain('onCloseWebAgentPanel,');
    expect(source).toContain('const buttonActive = Boolean(webAgentPanelOpen);');
    expect(source).not.toContain('const buttonActive = isWebMethodActive && Boolean(webAgentPanelOpen);');
    expect(source).toContain('if (buttonActive) {');
    expect(source).toContain('onCloseWebAgentPanel?.();');
    expect(source).toContain('return;');
  });

  it('reopens stored Genie provider preferences through the Genie panel handler', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');

    expect(source).toContain('const resolveStoredWebOpenMethod = (method: OpenMethod)');
    expect(source).toContain("method.value === 'claude' || method.value === 'codex' || method.value === 'gemini' || method.value === 'opencode'");
    expect(source).toContain("return { agent: 'genie' as const, provider: method.value as GenieProvider };");
    expect(source).toContain('const storedWebOpenMethod = resolveStoredWebOpenMethod(openMethod);');
    expect(source).toContain('void handleOpenWithWebAgent(storedWebOpenMethod.agent, storedWebOpenMethod.provider);');
    expect(source).not.toContain('void handleOpenWithWebAgent(openMethod.value as WebAgent);');
  });

  it('keeps the Web Agent active preference while opening a local app from the active state', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');

    expect(source).toContain('const shouldUpdateDefaultOpenMethod = !buttonActive;');
    expect(source).toContain("if (shouldUpdateDefaultOpenMethod) {\n            void savePreference({ type: 'local-app', value: agent }).catch(() => {});\n        }");
    expect(source).toContain("if (shouldUpdateDefaultOpenMethod) {\n            void savePreference({ type: 'ide', value: ide }).catch(() => {});\n        }");
    expect(source).toContain("if (shouldUpdateDefaultOpenMethod) {\n            void savePreference({ type: 'cli', value: agent }).catch(() => {});\n        }");
    expect(source).not.toContain("void savePreference({ type: 'local-app', value: agent }).catch(() => {});\n\n        try {");
  });

  it('shows "打开 AI" in default state and reveals full UI on hover', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');

    expect(source).toContain("'打开 AI'");
    expect(source).toContain('showExpanded');
    expect(source).toContain('setHovered(true)');
    expect(source).toContain('setHovered(false)');
    expect(source).toContain('onRefreshAvailability');
    expect(source).toContain('handleDropdownOpenChange');
  });

  it('supports placeholder card trigger while preserving the shared open menu', () => {
    const source = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');

    expect(source).toContain("variant = 'compact'");
    expect(source).toContain('className,');
    expect(source).toContain("variant === 'placeholder-card'");
    expect(source).toContain('if (buttonActive) {');
    expect(source).toContain('return null;');
    expect(source).toContain("parseOpenMethod(preferredIDE) || { type: 'ide', value: activeOpenIDE }");
    expect(source).toContain('const activeOpenIDE = resolveVisibleIDEPreference(preferredIDE, ideAvailability) || visibleIDEOptions[0].value;');
    expect(source).toContain('<DropdownMenuTrigger asChild>');
    expect(source).toContain('placeholder-guide-card');
    expect(source).toContain('placeholder-guide-card-action');
    expect(source).toContain('placeholder-guide-ai-card');
    expect(source).toContain('cardIcon?: React.ReactNode');
    expect(source).toContain('{cardIcon ? <span className="text-slate-500">{cardIcon}</span> : null}');
    expect(source).toContain('className,');
    expect(source).toContain('placeholder-guide-card-title');
    expect(source).toContain('placeholder-guide-card-description');
    expect(source).not.toContain("buttonActive ? 'AI 已打开' : cardTitle");
    expect(source).toContain('openTargetPath');
    expect(source).toContain('handleOpenProjectInIDE(ide, openTargetPath)');
    expect(source).toContain('onOpenGenieWebAgent(openTargetPath, provider)');
    expect(source).toContain('apiService.openCLIAgent({ agent, projectId, targetPath: openTargetPath })');
    expect(source).not.toContain('apiService.openWebAgent({');
  });

  it('keeps Genie Web Agent provider selection typed through every open menu boundary', () => {
    const dropdownSource = readFileSync(resolve(__dirname, './OpenInDropdown.tsx'), 'utf8');
    const contentPanelSource = readFileSync(resolve(__dirname, './ContentPanel.tsx'), 'utf8');
    const contentAreaSource = readFileSync(resolve(__dirname, '../content/ContentAreaView.tsx'), 'utf8');
    const sidebarBuilderSource = readFileSync(resolve(__dirname, '../../app/hooks/useIndexPageSidebarPropsBuilder.ts'), 'utf8');
    const presentationBuilderSource = readFileSync(resolve(__dirname, '../../app/hooks/useIndexPagePresentationPropsBuilder.ts'), 'utf8');
    const indexPageTypesSource = readFileSync(resolve(__dirname, '../../types/index-page.types.ts'), 'utf8');

    for (const source of [
      dropdownSource,
      contentPanelSource,
      contentAreaSource,
      sidebarBuilderSource,
      presentationBuilderSource,
      indexPageTypesSource,
    ]) {
      expect(source).toContain("import type { GenieProvider } from '@/common/genie/types';");
      expect(source).toMatch(/(?:on|handle)OpenGenieWebAgent\?: \(targetPath\?: string, provider\?: GenieProvider\) => void \| Promise<void>;/);
    }

    expect(dropdownSource).toContain('genieProvider?: GenieProvider;');
    expect(dropdownSource).toContain('const handleOpenWithWebAgent = async (agent: WebAgent, provider?: GenieProvider) => {');
    expect(dropdownSource).toContain('onOpenGenieWebAgent(openTargetPath, provider)');
  });
});
