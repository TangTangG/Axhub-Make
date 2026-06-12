import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource() {
  return readFileSync(resolve(__dirname, './SettingsDialog.tsx'), 'utf8');
}

describe('SettingsDialog source', () => {
  it('can open directly on the AI settings tab', () => {
    const source = readSource();

    expect(source).toContain("export type SettingsDialogInitialTab = 'project' | 'update' | 'ai';");
    expect(source).toContain('initialTab?: SettingsDialogInitialTab;');
    expect(source).toContain('initialAcpRuntime?: AssistantRuntimeResponse | null;');
    expect(source).toContain('initialAcpFailureSource?: string;');
    expect(source).toContain('initialAcpFailureMessage?: string;');
    expect(source).toContain('export interface SettingsDialogAIContext');
    expect(source).toContain("export default function SettingsDialog({ open, onClose, onSaved, initialTab = 'project', initialAcpRuntime = null, initialAcpFailureSource = '', initialAcpFailureMessage = '' }: SettingsDialogProps)");
    expect(source).toContain("const [activeTab, setActiveTab] = useState<SettingsDialogInitialTab>(initialTab);");
    expect(source).toContain('setActiveTab(initialTab);');
  });

  it('uses the tab switcher as the drawer title control', () => {
    const source = readSource();

    expect(source).toContain("from '@/components/ui/tabs'");
    expect(source).toContain('<Tabs value={activeTab} onValueChange={handleTabValueChange} className="flex h-full flex-col"');
    expect(source).toContain('<SheetTitle className="sr-only">项目设置 / 项目更新 / AI 设置</SheetTitle>');
    expect(source).toContain('<SheetHeader className="border-b px-5 py-3.5">');
    expect(source).toContain('<div className="flex items-center justify-between gap-3">');
    expect(source).toContain('grid-cols-3');
    expect(source).toContain('<TabsTrigger value="project"');
    expect(source).toContain('项目设置');
    expect(source).toContain('<TabsTrigger value="update"');
    expect(source).toContain('项目更新');
    expect(source).toContain('<TabsTrigger value="ai"');
    expect(source).toContain('AI 设置');
    expect(source).not.toContain('<SheetTitle className="m-0 text-[14px] font-medium leading-none">项目设置</SheetTitle>');
    expect(source).not.toContain('<div className="border-b px-5 py-3">');
  });

  it('does not expose automation execution preferences in project settings', () => {
    const source = readSource();

    expect(source).not.toContain('自动化执行');
    expect(source).not.toContain('默认 Genie 供应商');
    expect(source).not.toContain('默认 IDE');
  });

  it('loads Make client update status from the update tab and applies updates through project APIs', () => {
    const source = readSource();
    const projectIndex = source.indexOf('<TabsTrigger value="project"');
    const updateIndex = source.indexOf('<TabsTrigger value="update"');
    const aiIndex = source.indexOf('<TabsTrigger value="ai"');
    const updateTabSource = source.slice(
      source.indexOf('<TabsContent value="update"'),
      source.indexOf('<TabsContent value="ai"'),
    );

    expect(projectIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(projectIndex);
    expect(aiIndex).toBeGreaterThan(updateIndex);
    expect(source).toContain('MakeClientUpdateStatus');
    expect(source).toContain('MakeClientUpdateApplyResult');
    expect(source).toContain('makeClientUpdateStatus');
    expect(source).toContain('loadMakeClientUpdateStatus');
    expect(source).toContain('handleApplyMakeClientUpdate');
    expect(source).toContain('apiService.getMakeClientUpdateStatus');
    expect(source).toContain('apiService.applyMakeClientUpdate');
    expect(source).toContain("if (value === 'update')");
    expect(updateTabSource).toContain('当前客户端版本');
    expect(updateTabSource).toContain('服务端最新版本');
    expect(updateTabSource).toContain('项目路径');
    expect(updateTabSource).toContain('Git 状态');
    expect(updateTabSource).toContain('检测更新');
    expect(updateTabSource).toContain('开始更新');
    expect(updateTabSource).toContain('MAKE_CLIENT_UPDATE_STEPS.map');
    expect(source).toContain('检测版本');
    expect(source).toContain('下载模板');
    expect(source).toContain('创建备份');
    expect(source).toContain('覆盖文件');
    expect(source).toContain('写入版本');
    expect(source).toContain('安装依赖/同步元数据');
    expect(updateTabSource).toContain('复制给 AI 处理');
    expect(source).toContain('buildMakeClientUpdateFailurePrompt');
    expect(source).toContain('formatMakeClientUpdateError');
    expect(updateTabSource).not.toContain('回退');
  });

  it('renders local AI execution agent preferences as a provider table above image settings', () => {
    const source = readSource();
    const acpServiceIndex = source.indexOf('本地 ACP 服务');
    const localAiIndex = source.indexOf('AI Agent');
    const imageGenerationIndex = source.indexOf('图片生成 AI');
    const localAiSource = source.slice(localAiIndex, imageGenerationIndex);

    expect(acpServiceIndex).toBeGreaterThan(-1);
    expect(localAiIndex).toBeGreaterThan(-1);
    expect(imageGenerationIndex).toBeGreaterThan(-1);
    expect(acpServiceIndex).toBeLessThan(localAiIndex);
    expect(localAiIndex).toBeLessThan(imageGenerationIndex);
    expect(source).toContain('用于在网页端直接使用相关 AI Agent。');
    expect(source).toContain('执行 agent');
    expect(source).toContain('LOCAL_AI_AGENT_OPTIONS');
    expect(source).toContain("from '@/components/ui/table'");
    expect(source).toContain("from '@/components/ui/radio-group'");
    expect(source).toContain("from '@/components/ui/tooltip'");
    expect(localAiSource).toContain('<Table');
    expect(localAiSource).toContain('<TableHead');
    expect(localAiSource).toContain('执行');
    expect(localAiSource).not.toContain('默认执行');
    expect(localAiSource).toContain('供应商');
    expect(localAiSource).toContain('版本');
    expect(localAiSource).not.toContain('脚本版本');
    expect(localAiSource).toContain('上次测试');
    expect(localAiSource).toContain('测试');
    expect(localAiSource).toContain('aria-label="刷新版本"');
    expect(localAiSource).toContain('<RefreshCw');
    expect(localAiSource).toContain('<RadioGroup');
    expect(localAiSource).toContain('<RadioGroupItem');
    expect(localAiSource).not.toContain('<Select');
    expect(localAiSource).not.toContain('<FieldLabelWithHint hint="用于原型生成、批注执行和本地 AI 面板的默认 agent">执行 agent</FieldLabelWithHint>');
    expect(source).toContain("defaultPromptClient: formState.defaultPromptClient");
    expect(source).toContain("normalizePromptClientPreference(config.automation?.defaultPromptClient)");
    expect(source).toContain('配置本地可用的 AI Agent。');
    expect(source).toContain("defaultPromptClient: 'acp:codex'");
    expect(source).toContain("value: 'acp:claude'");
    expect(source).toContain("value: 'acp:codex'");
    expect(source).toContain("value: 'acp:gemini'");
    expect(source).toContain("value: 'acp:opencode'");
    expect(source).toContain("label: 'Claude Code'");
    expect(source).toContain("label: 'Codex'");
    expect(source).toContain("label: 'Gemini CLI'");
    expect(source).toContain("label: 'OpenCode'");
    expect(source).not.toContain("value: 'genie:codex'");
    expect(source).not.toContain('配置 Genie 默认使用的本地执行 agent。');
  });

  it('gates AI settings behind the local ACP service status', () => {
    const source = readSource();
    const aiTabSource = source.slice(
      source.indexOf('<TabsContent value="ai"'),
      source.indexOf('<SheetFooter'),
    );

    expect(source).toContain('AssistantRuntimeResponse');
    expect(source).toContain('localAcpRuntime');
    expect(source).toContain('const localAcpConnected = localAcpRuntime?.health.status === \'ready\';');
    expect(source).toContain('const localAcpNeedsCorsRestart = isLocalAcpCorsFailure(localAcpRuntime, localAcpFailureContext?.message);');
    expect(source).toContain("const localAcpActionLabel = localAcpConnected ? '重启' : localAcpNeedsCorsRestart ? '重启修复' : '链接';");
    expect(source).toContain('formatLocalAcpCheckedAt');
    expect(source).toContain('handleLocalAcpRuntimeCheck');
    expect(source).toContain('handleLocalAcpRuntimeConnect');
    expect(source).toContain('handleLocalAcpRuntimeRestart');
    expect(source).toContain('apiService.getAssistantRuntime({ autoStart: false');
    expect(source).toContain('apiService.getAssistantRuntime({ autoStart: true');
    expect(source).toContain("apiService.bootstrapAssistant({ mode: 'restart_existing', projectId: activeProjectId || undefined })");
    expect(aiTabSource).toContain('本地 ACP 服务');
    expect(aiTabSource).toContain('已链接');
    expect(aiTabSource).toContain('未链接');
    expect(aiTabSource).toContain('上次检测');
    expect(aiTabSource).toContain('onClick={localAcpNeedsCorsRestart || localAcpConnected ? handleLocalAcpRuntimeRestart : handleLocalAcpRuntimeConnect}');
    expect(aiTabSource).toContain('{localAcpActionLabel}');
    expect(aiTabSource).not.toContain('onClick={() => handleLocalAcpRuntimeCheck()}');
    expect(aiTabSource).not.toContain('{localAcpChecking ? <Loader2');
    expect(aiTabSource).toContain('{localAcpConnected ? (');
    expect(aiTabSource).toContain('AI Agent');
    expect(aiTabSource).toContain('图片生成 AI');
    expect(aiTabSource).not.toContain('本地 ACP 服务未链接');
  });

  it('keeps the settings dialog open while local ACP link and restart actions resolve', () => {
    const source = readSource();
    const connectSource = source.slice(
      source.indexOf('const handleLocalAcpRuntimeConnect = async () => {'),
      source.indexOf('const handleLocalAcpRuntimeRestart = async () => {'),
    );
    const restartSource = source.slice(
      source.indexOf('const handleLocalAcpRuntimeRestart = async () => {'),
      source.indexOf('const loadMakeClientUpdateStatus = async'),
    );

    expect(source).toContain('const localAcpAutoCloseBlockedRef = useRef(false);');
    expect(source).toContain('const preserveSettingsDialogDuringLocalAcpAction = async <T,>(action: () => Promise<T>): Promise<T> => {');
    expect(source).toContain('localAcpAutoCloseBlockedRef.current = true;');
    expect(source).toContain('window.setTimeout(() => {');
    expect(source).toContain('localAcpAutoCloseBlockedRef.current = false;');
    expect(source).toContain('const handleSettingsDialogOpenChange = (nextOpen: boolean) => {');
    expect(source).toContain('if (localAcpAutoCloseBlockedRef.current) {');
    expect(source).toContain('<Sheet open={open} onOpenChange={handleSettingsDialogOpenChange}>');
    expect(connectSource).toContain('return preserveSettingsDialogDuringLocalAcpAction(async () => {');
    expect(restartSource).toContain('return preserveSettingsDialogDuringLocalAcpAction(async () => {');
    expect(connectSource).not.toContain('onClose();');
    expect(restartSource).not.toContain('onClose();');
  });

  it('accepts external ACP failure context and keeps it visible until the user manually checks again', () => {
    const source = readSource();

    expect(source).toContain('const initialAcpFailureAppliedRef = useRef(false);');
    expect(source).toContain('setLocalAcpRuntime(initialAcpRuntime);');
    expect(source).toContain('setLocalAcpFailureContext({');
    expect(source).toContain('source: initialAcpFailureSource');
    expect(source).toContain('message: initialAcpFailureMessage');
    expect(source).toContain("if (initialTab === 'ai' && initialAcpRuntime && initialAcpRuntime.health.status !== 'ready')");
    expect(source).toContain('initialAcpFailureAppliedRef.current = true;');
    expect(source).toContain("if (initialTab === 'ai' && !initialAcpFailureAppliedRef.current)");
    expect(source).not.toContain("if (initialTab === 'ai') {\n            void handleLocalAcpRuntimeCheck({ silent: true });\n        }");
  });

  it('shows ACP repair actions with copyable commands and an AI troubleshooting prompt when not linked', () => {
    const source = readSource();
    const aiTabSource = source.slice(
      source.indexOf('<TabsContent value="ai"'),
      source.indexOf('<SheetFooter'),
    );

    expect(source).toContain('function resolveLocalAcpRepairCommand(runtime: AssistantRuntimeResponse | null): string');
    expect(source).toContain('function resolveLocalAcpRepairMessage(params: {');
    expect(source).toContain("return '本地 ACP 已响应，但未允许当前 Make 地址跨域访问。点击“重启修复”可自动重启并带上当前 Make 地址；下方命令仅作为手动备用。';");
    expect(source).toContain("return '本地 ACP 未就绪。请使用下方命令启动，或点击“链接”自动处理。';");
    expect(source).toContain("runtime?.health.status === 'missing_cli'");
    expect(source).toContain('runtime?.health.hints.installGlobal');
    expect(source).toContain('runtime?.health.hints.start');
    expect(source).toContain('function buildLocalAcpTroubleshootingPrompt');
    expect(source).toContain('当前错误：');
    expect(source).toContain('ACP 地址：');
    expect(source).toContain('项目路径：');
    expect(source).toContain('启动命令：');
    expect(source).toContain('检测命令：');
    expect(source).toContain('当前 Make URL：');
    expect(source).toContain('请检查 Node/npm/npx、端口占用、CORS、网络和 /api/chat 可达性。');
    expect(source).toContain('handleCopyLocalAcpRepairCommand');
    expect(source).toContain('handleCopyLocalAcpTroubleshootingPrompt');
    expect(aiTabSource).toContain('复制启动命令');
    expect(aiTabSource).toContain('复制给 AI 处理');
    expect(aiTabSource).toContain('data-local-acp-status-card');
    expect(aiTabSource).toContain('data-local-acp-repair');
    expect(aiTabSource).toContain('resolveLocalAcpRepairMessage({');
    expect(aiTabSource).toContain('whitespace-pre-wrap break-words');
    expect(aiTabSource).toContain('[overflow-wrap:anywhere]');
    expect(aiTabSource).not.toContain('localAcpFailureContext?.message || localAcpRuntime.health.message || \'请检测或链接本地 ACP 服务后重试。\'');
    const repairActionsSource = aiTabSource.slice(
      aiTabSource.indexOf('<div className="flex flex-wrap items-center gap-3 pl-[96px]">'),
      aiTabSource.indexOf('</div>\n                                    </div>\n                                ) : null}'),
    );
    expect(repairActionsSource).toContain('<button');
    expect(repairActionsSource).toContain('text-primary');
    expect(repairActionsSource).not.toContain('<Button');
    expect(repairActionsSource).not.toContain('<Copy');
    expect(aiTabSource).not.toContain('border-amber');
    expect(aiTabSource).not.toContain('bg-amber');
    expect(aiTabSource).not.toContain('variant={localAcpConnected ? \'outline\' : \'brand\'}');
    expect(aiTabSource).not.toContain('请先通过 CLI 启动 AI 助手。');
  });

  it('saves the selected local AI provider only through defaultPromptClient form state', () => {
    const source = readSource();

    expect(source).toContain("value={formState.defaultPromptClient || 'acp:codex'}");
    expect(source).toContain("onValueChange={(value) => updateField('defaultPromptClient', normalizePromptClientPreference(value) || 'acp:codex')}");
    expect(source).toContain("defaultPromptClient: formState.defaultPromptClient");
  });

  it('checks agent versions when the AI tab is activated and reuses a larger cache with latest versions', () => {
    const source = readSource();
    const agentVersionCacheSource = readFileSync(resolve(__dirname, '../utils/agentVersionCache.ts'), 'utf8');

    expect(source).toContain('handleTabValueChange');
    expect(source).toContain("if (value === 'ai')");
    expect(source).toContain('loadAgentVersions(true)');
    expect(source).toContain('刷新版本');
    expect(source).toContain('apiService.getAgentVersions');
    expect(source).toContain('agentVersionCacheRef');
    expect(source).toContain('formatAgentVersionMeta');
    expect(source).toContain('latestAgentVersions');
    expect(source).toContain('latestVersions');
    expect(source).toContain('formatAgentVersionMeta(agentVersions[option.versionKey], latestAgentVersions[option.versionKey])');
    expect(source).not.toContain('AI 设置首次打开时检测版本并缓存');
    expect(source).not.toContain('刷新版本会强制重新检测');
    expect(source).not.toContain('handleLocalAiSelectOpenChange');
    expect(agentVersionCacheSource).toContain('AGENT_VERSION_CACHE_TTL_MS');
    expect(agentVersionCacheSource).toContain('10 * 60_000');
    expect(agentVersionCacheSource).toContain('latestVersions');
    expect(agentVersionCacheSource).toContain('（${latestMeta}）');
    expect(agentVersionCacheSource).toContain('未安装');
  });

  it('tests local AI providers through prompt execution without adding a backend endpoint', () => {
    const source = readSource();

    expect(source).toContain('AGENT_PROVIDER_TEST_KEYWORD');
    expect(source).toContain('AXHUB_AGENT_TEST_OK');
    expect(source).toContain('handleAgentProviderTest');
    expect(source).toContain("from '../domains/ai-generation/aiRunClient'");
    expect(source).toContain('runAiText({');
    expect(source).toContain("scene: 'agent-provider-test'");
    expect(source).toContain("scene: 'agent-provider-test'");
    expect(source).toContain('client: option.value');
    expect(source).toContain('prompt: AGENT_PROVIDER_TEST_PROMPT');
    expect(source).toContain('output.includes(AGENT_PROVIDER_TEST_KEYWORD)');
    expect(source).toContain("updateAgentProviderTestState(option.value, { status: 'passed', message: '通过', testedAt: Date.now() });");
    expect(source).toContain("updateAgentProviderTestState(option.value, { status: 'failed', message: summary });");
    expect(source).toContain("updateAgentProviderTestState(option.value, { status: 'failed', message });");
    expect(source).toContain("handleAiRunAcpRuntimeUnavailable(error, '本地执行 agent 测试')");
    expect(source).not.toContain("status: 'failed', message: summary, testedAt: Date.now()");
    expect(source).not.toContain("status: 'failed', message, testedAt: Date.now()");
    expect(source).toContain('formatAgentProviderTestTime');
    expect(source).toContain("status: 'passed'");
    expect(source).toContain("status: 'failed'");
    expect(source).not.toContain('/api/agent/test');
    expect(source).not.toContain('/api/prompt/execute');
  });

  it('keeps local AI provider test feedback in the last-test column', () => {
    const source = readSource();
    const tableBodySource = source.slice(
      source.indexOf('{LOCAL_AI_AGENT_OPTIONS.map'),
      source.indexOf('</TableBody>'),
    );

    expect(source).toContain('setAgentProviderTests((previous) => ({ ...previous, [client]: state }));');
    expect(tableBodySource).toContain("const testTime = testState?.status === 'passed' ? formatAgentProviderTestTime(testState.testedAt) : '';");
    expect(tableBodySource).toContain("{isTesting ? '测试中' : '测试'}");
    expect(tableBodySource).toContain("testState?.status === 'failed' && testState.message");
    expect(tableBodySource).toContain("testState?.status === 'passed' && testTime");
    expect(tableBodySource).toContain('max-w-[180px] whitespace-normal break-words leading-5');
    expect(tableBodySource).toContain('[overflow-wrap:anywhere]');
    expect(tableBodySource).not.toContain('max-w-[180px] truncate text-destructive');
    expect(tableBodySource).not.toContain('flex flex-col items-end gap-1');
  });

  it('shows recognizable icons for local AI providers', () => {
    const source = readSource();

    expect(source).toContain("from '@lobehub/icons'");
    expect(source).toContain("if (agent === 'codex') return <Codex.Color size={16} />;");
    expect(source).toContain("if (agent === 'gemini') return <GeminiCLI.Color size={16} />;");
    expect(source).toContain("if (agent === 'claudecode') return <ClaudeCode.Color size={16} />;");
    expect(source).toContain("if (agent === 'opencode') return <OpenCode size={16} />;");
    expect(source).toContain('getAgentProviderIcon(option.versionKey)');
  });

  it('tests AI image generation settings directly against the configured image API using the current form values', () => {
    const source = readSource();

    expect(source).toContain('AiImageConfigTestState');
    expect(source).toContain('AiImageConfigLastTest');
    expect(source).toContain('handleAiImageConfigTest');
    expect(source).toContain("fetch('/api/config/ai-image/test'");
    expect(source).toContain('body: JSON.stringify({');
    expect(source).toContain('prompt: AI_IMAGE_CONFIG_TEST_PROMPT');
    expect(source).toContain('baseUrl: formState.aiBaseUrl.trim()');
    expect(source).toContain('apiKey: formState.aiApiKey.trim()');
    expect(source).toContain("model: formState.aiModel.trim() || 'gpt-image-2'");
    expect(source).toContain("const successMessage = typeof body?.message === 'string' && body.message.trim()");
    expect(source).toContain("persistAiImageConfigLastTest({ status: 'passed', message: successMessage, testedAt })");
    expect(source).toContain("persistAiImageConfigLastTest({ status: 'failed', message, testedAt })");
    expect(source).toContain("toast.success('图片配置测试通过')");
    expect(source).toContain("toast.error(`图片配置测试失败：${message}`)");
    expect(source).toContain('测试图片配置');
    expect(source).not.toContain('runAiStream({');
    expect(source).not.toContain('AI_IMAGE_CONFIG_TEST_TIMEOUT_MS');
    expect(source).not.toContain('/api/ai-image/test');
  });

  it('maps structured AI run ACP failures back into the local ACP repair block', () => {
    const source = readSource();

    expect(source).toContain('function isAiRunAcpRuntimeUnavailable(error: unknown): error is');
    expect(source).toContain("record.code === 'ACP_RUNTIME_UNAVAILABLE' || record.action === 'open-ai-settings'");
    expect(source).toContain("function handleAiRunAcpRuntimeUnavailable(error: unknown, source: string): boolean");
    expect(source).toContain('setLocalAcpRuntime(record.runtime as AssistantRuntimeResponse);');
    expect(source).toContain('setLocalAcpFailureContext({');
    expect(source).toContain('source,');
    expect(source).toContain('message: typeof record.message === \'string\' ? record.message : \'本地 ACP 服务不可用\',');
    expect(source).toContain('toast.warning(\'本地 ACP 服务不可用，请查看上方修复信息\');');
  });

  it('saves AI image generation config through /api/config', () => {
    const source = readSource();

    expect(source).toContain("fetch('/api/config'");
    expect(source).toContain('ai: {');
    expect(source).toContain('imageGeneration: {');
    expect(source).toContain('baseUrl: formState.aiBaseUrl.trim()');
    expect(source).toContain('apiKey: formState.aiApiKey.trim() || null');
    expect(source).toContain("model: formState.aiModel.trim() || 'gpt-image-2'");
    expect(source).toContain('lastTest: aiImageConfigLastTest');
    expect(source).not.toContain('codexCli: formState.aiCodexCli');
    expect(source).not.toContain('responseFormatB64Json: formState.aiResponseFormatB64Json');
    expect(source).not.toContain('apiMode: formState.aiApiMode');
    expect(source).not.toContain('timeout: Math.max');
  });

  it('uses draft wording for AI image settings visible copy', () => {
    const source = readSource();

    expect(source).toContain('配置图片生成 AI 的接口信息。');
    expect(source).not.toContain('配置草稿 AI 图片生成使用的 OpenAI-compatible 接口。');
  });

  it('can import AI image generation settings from local Codex config', () => {
    const source = readSource();
    const imageSectionSource = source.slice(
      source.indexOf('图片生成 AI'),
      source.indexOf('<SheetFooter'),
    );
    const footerSource = source.slice(source.indexOf('<SheetFooter'));

    expect(source).toContain('handleImportCodexConfig');
    expect(source).toContain("fetch('/api/config/ai-image/codex-local'");
    expect(source).toContain("toast.success('已读取本地 Codex 配置')");
    expect(source).toContain('读取本地 Codex 配置');
    expect(imageSectionSource).toContain('data-ai-image-config-actions');
    expect(imageSectionSource).toContain('handleAiImageConfigTest');
    expect(imageSectionSource).toContain('handleImportCodexConfig');
    expect(footerSource).not.toContain('handleAiImageConfigTest');
    expect(footerSource).not.toContain('handleImportCodexConfig');
    expect(source).toContain("updateField('aiBaseUrl', imported.baseUrl || DEFAULT_FORM_STATE.aiBaseUrl)");
    expect(source).toContain("updateField('aiApiKey', imported.apiKey || '')");
    expect(source).toContain("updateField('aiModel', imported.model || 'gpt-image-2')");
    expect(source).not.toContain("updateField('aiApiMode'");
    expect(source).not.toContain("updateField('aiCodexCli'");
    expect(source).not.toContain("updateField('aiResponseFormatB64Json'");
  });

  it('shows the persisted last AI image test result as aligned field text', () => {
    const source = readSource();
    const imageSectionSource = source.slice(
      source.indexOf('图片生成 AI'),
      source.indexOf('<SheetFooter'),
    );

    expect(source).toContain('setAiImageConfigLastTest(normalizeAiImageConfigLastTest(config.ai?.imageGeneration?.lastTest));');
    expect(source).toContain('formatAiImageConfigLastTestTime');
    expect(source).toContain('getAiImageConfigLastTestLabel');
    expect(imageSectionSource).toContain('data-ai-image-last-test');
    expect(imageSectionSource).toContain('<Field data-ai-image-last-test className="min-w-0">');
    expect(imageSectionSource).toContain('<FieldLabelWithHint hint="图片生成配置的最近一次测试状态">上次测试</FieldLabelWithHint>');
    expect(imageSectionSource).toContain('className="flex min-h-9 min-w-0 items-center text-sm"');
    expect(imageSectionSource).toContain('className="block max-w-full whitespace-normal break-words leading-5 text-emerald-600 [overflow-wrap:anywhere]"');
    expect(imageSectionSource).toContain('className="block max-w-full whitespace-normal break-words leading-5 text-destructive [overflow-wrap:anywhere]"');
    expect(imageSectionSource).toContain("getAiImageConfigLastTestLabel(aiImageConfigLastTest)");
    expect(imageSectionSource).toContain("formatAiImageConfigLastTestTime(aiImageConfigLastTest?.testedAt)");
    expect(imageSectionSource).toContain("aiImageConfigLastTest?.status === 'passed'");
    expect(imageSectionSource).toContain("aiImageConfigLastTest?.status === 'failed'");
    expect(imageSectionSource).toContain('未测试');
    expect(imageSectionSource).not.toContain("aiImageConfigLastTest?.message || '暂无结果'");
    expect(imageSectionSource).not.toContain('justify-between');
    expect(imageSectionSource).not.toContain('border-input');
    expect(imageSectionSource).not.toContain('shadow-xs');
  });

  it('wraps inline AI image test feedback inside the settings drawer width', () => {
    const source = readSource();
    const imageSectionSource = source.slice(
      source.indexOf('图片生成 AI'),
      source.indexOf('<SheetFooter'),
    );

    expect(imageSectionSource).toContain('data-ai-image-config-actions');
    expect(imageSectionSource).toContain('block max-w-full whitespace-normal break-words text-xs leading-5 text-emerald-600 [overflow-wrap:anywhere]');
    expect(imageSectionSource).toContain('block max-w-full whitespace-normal break-words text-xs leading-5 text-destructive [overflow-wrap:anywhere]');
    expect(imageSectionSource).not.toContain('max-w-[220px] truncate text-xs text-destructive');
  });

  it('does not expose removed AI image transport toggles in AI settings', () => {
    const source = readSource();

    expect(source).not.toContain('Codex CLI 兼容');
    expect(source).not.toContain('checked={formState.aiCodexCli}');
    expect(source).not.toContain('接口模式');
    expect(source).not.toContain('优先返回 Base64 图片数据');
    expect(source).not.toContain('超时秒数');
  });

  it('does not expose advanced AI image generation defaults in AI settings', () => {
    const source = readSource();

    expect(source).not.toContain('默认尺寸');
    expect(source).not.toContain('默认质量');
    expect(source).not.toContain('默认格式');
    expect(source).not.toContain('默认数量');
    expect(source).not.toContain('formState.aiDefaultSize');
    expect(source).not.toContain('formState.aiDefaultQuality');
    expect(source).not.toContain('formState.aiDefaultOutputFormat');
    expect(source).not.toContain('formState.aiDefaultCount');
  });

  it('restores the project default design setting in project settings', () => {
    const source = readSource();

    expect(source).toContain('defaultTheme: string;');
    expect(source).toContain("defaultTheme: config.projectDefaults?.defaultTheme || ''");
    expect(source).toContain('const [availableThemes, setAvailableThemes] = useState<ThemeResourceItem[]>([]);');
    expect(source).toContain("const response = await fetch('/api/themes');");
    expect(source).toContain('setAvailableThemes(Array.isArray(themes) ? themes : []);');
    expect(source).toContain('projectDefaults: {');
    expect(source).toContain('defaultTheme: formState.defaultTheme.trim() || null,');
    expect(source).toContain("fetch('/api/themes/sync-design', {");
    expect(source).toContain("body: JSON.stringify({ themeName: formState.defaultTheme.trim() })");
    expect(source).toContain('默认设计');
    expect(source).toContain('从“资产管理-设计”中选择一个作为项目默认设计');
    expect(source).toContain('<PrototypeThemeSearchSelect');
    expect(source).toContain("value={formState.defaultTheme || NO_PROTOTYPE_THEME_VALUE}");
    expect(source).toContain("updateField('defaultTheme', themeName === NO_PROTOTYPE_THEME_VALUE ? '' : themeName)");
    expect(source).not.toContain('默认主题');
  });
});
