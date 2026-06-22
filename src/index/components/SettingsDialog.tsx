import React, { useEffect, useRef, useState } from 'react';
import { ClaudeCode, CodeBuddy, Codex, Cursor, DeepSeek, GeminiCLI, OpenCode, Qoder } from '@lobehub/icons';
import { AlertTriangle, CheckCircle2, CircleHelp, Copy, Loader2, Play, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldLabelWithHint } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { apiService, type AssistantRuntimeResponse, type MakeClientUpdateApplyResult, type MakeClientUpdateStatus } from '../services/api';
import { normalizePromptClientPreference } from '../../common/promptExecution';
import { ACP_PROVIDER_OPTIONS, type AcpProviderKey } from '../../common/acpModelConfig';
import { runAiText, type AiRunClientError } from '../domains/ai-generation/aiRunClient';
import {
    buildMakeClientUpdateFailurePrompt,
    formatMakeClientUpdateError,
} from '../utils/projectSetupErrors';
import type { MainIDEPreference } from '../../common/ide';
import type { PromptClientPreference } from '../types';
import {
    formatAgentVersionMeta,
    formatAgentVersionMetaTitle,
    isAgentVersionCacheFresh,
    type AgentVersionCache,
    type AgentVersionMap,
} from '../utils/agentVersionCache';
import type { ExcalidrawPropertyPanelMode, ExcalidrawPropertyPanelPosition } from '../utils/excalidrawUiMode';
import type { ThemeResourceItem } from '../domains/resources/resource.types';
import { PrototypeThemeSearchSelect } from '../domains/prototype-generation/PrototypeThemeSearchSelect';
import { NO_PROTOTYPE_THEME_VALUE } from '../domains/prototype-generation/prototypeGenerationThemeSelection';

export type SettingsDialogInitialTab = 'project' | 'update' | 'ai';

export interface SettingsDialogAIContext {
    runtime?: AssistantRuntimeResponse | null;
    failureSource?: string;
    failureMessage?: string;
}

interface SettingsDialogProps {
    open: boolean;
    onClose: () => void;
    onSaved?: () => void;
    initialTab?: SettingsDialogInitialTab;
    initialAcpRuntime?: AssistantRuntimeResponse | null;
    initialAcpFailureSource?: string;
    initialAcpFailureMessage?: string;
    excalidrawPropertyPanelMode?: ExcalidrawPropertyPanelMode;
    onExcalidrawPropertyPanelModeChange?: (mode: ExcalidrawPropertyPanelMode) => void;
    excalidrawPropertyPanelPosition?: ExcalidrawPropertyPanelPosition;
    onExcalidrawPropertyPanelPositionChange?: (position: ExcalidrawPropertyPanelPosition) => void;
}

interface ServerConfig {
    host: string;
    port: number;
    allowLAN: boolean;
    lanHost?: string;
    enableCommandAPI?: boolean;
}

interface ProjectInfoConfig {
    name?: string | null;
    description?: string | null;
}

interface Config {
    projectId?: string | null;
    projectPath?: string | null;
    server: ServerConfig;
    availableLANHosts?: string[];
    projectInfo?: ProjectInfoConfig;
    projectDefaults?: {
        defaultTheme?: string | null;
    };
    automation?: {
        defaultPromptClient?: PromptClientPreference;
        defaultIDE?: MainIDEPreference;
        annotationPromptClient?: PromptClientPreference;
        annotationModel?: string | null;
    };
    assistant?: {
        webBaseUrl?: string | null;
        apiBaseUrl?: string | null;
    };
    ai?: {
        imageGeneration?: {
            baseUrl?: string | null;
            apiKey?: string | null;
            model?: string | null;
            lastTest?: AiImageConfigLastTest | null;
        };
    };
}

interface SettingsFormState {
    host: string;
    lanHost: string;
    allowLAN: boolean;
    projectName: string;
    projectDescription: string;
    defaultTheme: string;
    defaultPromptClient: PromptClientPreference;
    annotationPromptClient: PromptClientPreference;
    annotationModel: string;
    aiBaseUrl: string;
    aiApiKey: string;
    aiModel: string;
}

type AgentProviderTestStatus = 'idle' | 'testing' | 'passed' | 'failed';
type AiImageConfigTestStatus = 'idle' | 'testing' | 'passed' | 'failed';
type AiImageConfigLastTestStatus = 'passed' | 'failed';

interface AgentProviderTestState {
    status: AgentProviderTestStatus;
    message?: string;
    testedAt?: number;
}

interface AiImageConfigTestState {
    status: AiImageConfigTestStatus;
    message?: string;
}

interface AiImageConfigLastTest {
    status: AiImageConfigLastTestStatus;
    message: string;
    testedAt: number;
}

const AGENT_PROVIDER_TEST_KEYWORD = 'AXHUB_AGENT_TEST_OK';
const AGENT_PROVIDER_TEST_PROMPT = `请只返回 ${AGENT_PROVIDER_TEST_KEYWORD}，不要返回其他文字。`;
const AGENT_PROVIDER_TEST_TIMEOUT_MS = 60_000;
const AI_IMAGE_CONFIG_TEST_PROMPT = '生成一张用于验证图片生成配置的极简测试图片，内容为白底黑色文字 OK。';
const MAKE_CLIENT_UPDATE_STEPS = [
    '检测版本',
    '下载模板',
    '创建备份',
    '覆盖文件',
    '写入版本',
    '安装依赖/同步元数据',
];

const DEFAULT_FORM_STATE: SettingsFormState = {
    host: 'localhost',
    lanHost: '',
    allowLAN: true,
    projectName: '',
    projectDescription: '',
    defaultTheme: '',
    defaultPromptClient: 'acp:codex',
    annotationPromptClient: null,
    annotationModel: '',
    aiBaseUrl: 'https://api.openai.com/v1',
    aiApiKey: '',
    aiModel: 'gpt-image-2',
};

const LOCAL_AI_AGENT_OPTIONS: Array<{
    value: NonNullable<PromptClientPreference>;
    provider: AcpProviderKey;
    label: string;
    versionKey: AcpProviderKey;
}> = ACP_PROVIDER_OPTIONS.map((option) => ({
    value: option.client,
    provider: option.provider,
    label: option.label,
    versionKey: option.provider,
}));

function getAgentProviderIcon(provider: AcpProviderKey): React.ReactNode {
    if (provider === 'codex') return <Codex.Color size={16} />;
    if (provider === 'gemini') return <GeminiCLI.Color size={16} />;
    if (provider === 'claude') return <ClaudeCode.Color size={16} />;
    if (provider === 'opencode') return <OpenCode size={16} />;
    if (provider === 'cursor') return <Cursor size={16} />;
    if (provider === 'qoder') return <Qoder.Color size={16} />;
    if (provider === 'codebuddy') return <CodeBuddy.Color size={16} />;
    if (provider === 'reasonix') return <DeepSeek.Color size={16} />;
    return null;
}

function normalizeFormState(config: Config): SettingsFormState {
    return {
        host: config.server.host || 'localhost',
        lanHost: config.server.lanHost || config.availableLANHosts?.[0] || '',
        allowLAN: config.server.allowLAN !== false,
        projectName: config.projectInfo?.name || '',
        projectDescription: config.projectInfo?.description || '',
        defaultTheme: config.projectDefaults?.defaultTheme || '',
        defaultPromptClient: normalizePromptClientPreference(config.automation?.defaultPromptClient) || 'acp:codex',
        annotationPromptClient: normalizePromptClientPreference(config.automation?.annotationPromptClient),
        annotationModel: config.automation?.annotationModel || '',
        aiBaseUrl: config.ai?.imageGeneration?.baseUrl || 'https://api.openai.com/v1',
        aiApiKey: config.ai?.imageGeneration?.apiKey || '',
        aiModel: config.ai?.imageGeneration?.model || 'gpt-image-2',
    };
}

function summarizeAgentProviderTestOutput(value: unknown): string {
    const text = String(value || '').replace(/\s+/gu, ' ').trim();
    if (!text) return '未返回输出';
    return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}

function getAgentProviderTestLabel(state?: AgentProviderTestState): string {
    if (state?.status === 'passed') return '通过';
    if (state?.status === 'failed') return '失败';
    if (state?.status === 'testing') return '测试中';
    return '';
}

function formatAgentProviderTestTime(testedAt?: number): string {
    if (!testedAt) return '未测试';
    return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(testedAt));
}

function normalizeAiImageConfigLastTest(value: unknown): AiImageConfigLastTest | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const record = value as Record<string, unknown>;
    if (record.status !== 'passed' && record.status !== 'failed') return undefined;
    if (typeof record.testedAt !== 'number' || !Number.isFinite(record.testedAt) || record.testedAt <= 0) {
        return undefined;
    }
    const message = typeof record.message === 'string' && record.message.trim()
        ? record.message.trim()
        : record.status === 'passed' ? '已返回图片结果' : '测试失败';
    return {
        status: record.status,
        message,
        testedAt: Math.round(record.testedAt),
    };
}

function getAiImageConfigLastTestLabel(state?: AiImageConfigLastTest): string {
    if (state?.status === 'passed') return '成功';
    if (state?.status === 'failed') return '失败';
    return '未测试';
}

function formatAiImageConfigLastTestTime(testedAt?: number): string {
    if (!testedAt) return '暂无时间';
    return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(testedAt));
}

function formatMakeClientUpdateGitStatus(status: MakeClientUpdateStatus | null): string {
    if (!status) return '未检测';
    if (!status.git.available) return 'Git 不可用';
    if (!status.git.isRepository) return '未初始化 Git';
    if (!status.git.hasCommits) return '暂无本地 commit';
    if (!status.git.clean) return '工作区有改动';
    return 'Git 已就绪';
}

function formatMakeClientUpdateActionLabel(
    status: MakeClientUpdateStatus | null,
    applying: boolean,
): string {
    if (applying) return '更新中...';
    if (!status) return '开始更新';
    if (!status.updateAvailable) return '已是最新';
    return '开始更新';
}

function getMakeClientUpdatePrimaryBlocker(status: MakeClientUpdateStatus | null): string {
    if (!status) return '请先检测更新状态';
    return status.blockedReasons[0]?.message || '';
}

function formatLocalAcpCheckedAt(checkedAt?: string): string {
    if (!checkedAt) return '未检测';
    const timestamp = Date.parse(checkedAt);
    if (Number.isNaN(timestamp)) return '未知';
    return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(new Date(timestamp));
}

function resolveLocalAcpRepairCommand(runtime: AssistantRuntimeResponse | null): string {
    const installCommand = String(runtime?.health.hints.installGlobal || '').trim();
    const startCommand = String(runtime?.health.hints.start || '').trim();
    if (runtime?.health.status === 'missing_cli') {
        return installCommand || startCommand;
    }
    return startCommand || installCommand;
}

function isLocalAcpCorsFailure(runtime: AssistantRuntimeResponse | null, failureMessage?: string): boolean {
    const message = `${runtime?.health.message || ''} ${failureMessage || ''}`;
    return message.includes('跨域预检失败');
}

function resolveLocalAcpRepairMessage(params: {
    runtime: AssistantRuntimeResponse | null;
    failureMessage?: string;
}): string {
    const runtime = params.runtime;
    if (isLocalAcpCorsFailure(runtime, params.failureMessage)) {
        return '本地 ACP 已响应，但未允许当前 Make 地址跨域访问。点击“重启修复”可自动重启并带上当前 Make 地址；下方命令仅作为手动备用。';
    }
    if (runtime?.health.status === 'missing_cli') {
        return '未检测到可用的 Node/npm/npx 命令。请先安装运行环境，再使用下方命令启动 ACP。';
    }
    return '本地 ACP 未就绪。请使用下方命令启动，或点击“链接”自动处理。';
}

function buildLocalAcpTroubleshootingPrompt(params: {
    runtime: AssistantRuntimeResponse | null;
    failureSource?: string;
    failureMessage?: string;
    currentUrl: string;
}): string {
    const runtime = params.runtime;
    const message = params.failureMessage?.trim()
        || runtime?.health.message
        || '本地 ACP 服务未链接';
    const source = params.failureSource?.trim() || 'Axhub Make AI 设置';
    const startCommand = resolveLocalAcpRepairCommand(runtime) || '(未返回启动命令)';
    const statusCommand = runtime?.health.hints.status || '(未返回检测命令)';
    return [
        '请帮我排查 Axhub Make 本地 ACP 服务连接失败。',
        '',
        `失败来源：${source}`,
        `当前错误：${message}`,
        `ACP 地址：${runtime?.webBaseUrl || '(未检测)'}`,
        `ACP API 地址：${runtime?.apiBaseUrl || '(未检测)'}`,
        `项目路径：${runtime?.projectPath || runtime?.projectRoot || '(未检测)'}`,
        `启动命令：${startCommand}`,
        `检测命令：${statusCommand}`,
        `当前 Make URL：${params.currentUrl}`,
        '',
        '请检查 Node/npm/npx、端口占用、CORS、网络和 /api/chat 可达性。',
        '如果需要执行修复，请先说明将要运行的命令；修复后重新检测 /api/chat。',
    ].join('\n');
}

function isAiRunAcpRuntimeUnavailable(error: unknown): error is AiRunClientError & { runtime?: AssistantRuntimeResponse } {
    const record = error as AiRunClientError | null;
    if (!record || typeof record !== 'object') return false;
    return record.code === 'ACP_RUNTIME_UNAVAILABLE' || record.action === 'open-ai-settings';
}

export default function SettingsDialog({ open, onClose, onSaved, initialTab = 'project', initialAcpRuntime = null, initialAcpFailureSource = '', initialAcpFailureMessage = '' }: SettingsDialogProps) {
    const [loading, setLoading] = useState(false);
    const [formState, setFormState] = useState<SettingsFormState>(DEFAULT_FORM_STATE);
    const [activeTab, setActiveTab] = useState<SettingsDialogInitialTab>(initialTab);
    const [agentVersions, setAgentVersions] = useState<AgentVersionMap>({});
    const [latestAgentVersions, setLatestAgentVersions] = useState<AgentVersionMap>({});
    const [agentVersionsLoading, setAgentVersionsLoading] = useState(false);
    const [agentProviderTests, setAgentProviderTests] = useState<Record<string, AgentProviderTestState>>({});
    const [aiImageConfigTest, setAiImageConfigTest] = useState<AiImageConfigTestState>({ status: 'idle' });
    const [aiImageConfigLastTest, setAiImageConfigLastTest] = useState<AiImageConfigLastTest | undefined>(undefined);
    const [availableThemes, setAvailableThemes] = useState<ThemeResourceItem[]>([]);
    const [availableLANHosts, setAvailableLANHosts] = useState<string[]>([]);
    const [activeProjectId, setActiveProjectId] = useState('');
    const [localAcpRuntime, setLocalAcpRuntime] = useState<AssistantRuntimeResponse | null>(null);
    const [localAcpFailureContext, setLocalAcpFailureContext] = useState<{ source: string; message: string } | null>(null);
    const [localAcpChecking, setLocalAcpChecking] = useState(false);
    const [localAcpConnecting, setLocalAcpConnecting] = useState(false);
    const [localAcpRestarting, setLocalAcpRestarting] = useState(false);
    const [makeClientUpdateStatus, setMakeClientUpdateStatus] = useState<MakeClientUpdateStatus | null>(null);
    const [makeClientUpdateResult, setMakeClientUpdateResult] = useState<MakeClientUpdateApplyResult | null>(null);
    const [makeClientUpdateError, setMakeClientUpdateError] = useState<unknown>(null);
    const [makeClientUpdateStatusLoading, setMakeClientUpdateStatusLoading] = useState(false);
    const [makeClientUpdateApplying, setMakeClientUpdateApplying] = useState(false);
    const agentVersionCacheRef = useRef<AgentVersionCache | null>(null);
    const aiTabVersionLoadedRef = useRef(false);
    const initialAcpFailureAppliedRef = useRef(false);
    const localAcpAutoCloseBlockedRef = useRef(false);
    const localAcpConnected = localAcpRuntime?.health.status === 'ready';
    const localAcpNeedsCorsRestart = isLocalAcpCorsFailure(localAcpRuntime, localAcpFailureContext?.message);
    const localAcpActionLabel = localAcpConnected ? '重启' : localAcpNeedsCorsRestart ? '重启修复' : '链接';
    const localAcpActionBusy = localAcpConnecting || localAcpRestarting;

    useEffect(() => {
        if (!open) {
            setActiveTab(initialTab);
            setAgentProviderTests({});
            setAiImageConfigTest({ status: 'idle' });
            setMakeClientUpdateStatus(null);
            setMakeClientUpdateResult(null);
            setMakeClientUpdateError(null);
            setLocalAcpRuntime(null);
            setLocalAcpFailureContext(null);
            setLocalAcpChecking(false);
            setLocalAcpConnecting(false);
            setLocalAcpRestarting(false);
            aiTabVersionLoadedRef.current = false;
            initialAcpFailureAppliedRef.current = false;
            localAcpAutoCloseBlockedRef.current = false;
            setAvailableThemes([]);
            setAvailableLANHosts([]);
            return;
        }

        setActiveTab(initialTab);
        if (initialTab === 'ai' && initialAcpRuntime && initialAcpRuntime.health.status !== 'ready') {
            setLocalAcpRuntime(initialAcpRuntime);
            setLocalAcpFailureContext({
                source: initialAcpFailureSource,
                message: initialAcpFailureMessage || initialAcpRuntime?.health.message || '',
            });
            initialAcpFailureAppliedRef.current = true;
        } else if (initialTab === 'ai' && !initialAcpFailureAppliedRef.current) {
            void handleLocalAcpRuntimeCheck({ silent: true });
        }
        void loadConfig();
        void loadThemeOptions();
    }, [open, initialAcpRuntime, initialAcpFailureMessage, initialAcpFailureSource, initialTab]);

    const updateField = <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) => {
        setFormState((previous) => ({ ...previous, [key]: value }));
    };

    const updateAgentProviderTestState = (client: string, state: AgentProviderTestState) => {
        setAgentProviderTests((previous) => ({ ...previous, [client]: state }));
    };

    const loadConfig = async () => {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error('Failed to load config');
            }
            const config: Config = await response.json();
            setFormState(normalizeFormState(config));
            setAvailableLANHosts(Array.isArray(config.availableLANHosts) ? config.availableLANHosts : []);
            setAiImageConfigLastTest(normalizeAiImageConfigLastTest(config.ai?.imageGeneration?.lastTest));
            const projectId = typeof config.projectId === 'string' ? config.projectId.trim() : '';
            setActiveProjectId(projectId);
            if (initialTab === 'update' && projectId) {
                void loadMakeClientUpdateStatus(projectId);
            }
            return config;
        } catch (error) {
            console.error('Error loading config:', error);
            toast.error('加载配置失败');
            return null;
        }
    };

    const loadThemeOptions = async () => {
        try {
            const response = await fetch('/api/themes');
            if (!response.ok) {
                throw new Error('Failed to load themes');
            }
            const themes = await response.json().catch(() => []);
            setAvailableThemes(Array.isArray(themes) ? themes : []);
        } catch (error) {
            console.error('Error loading themes:', error);
            setAvailableThemes([]);
        }
    };

    const loadAgentVersions = async (force = false) => {
        if (!force && isAgentVersionCacheFresh(agentVersionCacheRef.current)) {
            setAgentVersions(agentVersionCacheRef.current.versions);
            setLatestAgentVersions(agentVersionCacheRef.current.latestVersions);
            return;
        }

        setAgentVersionsLoading(true);
        try {
            const result = await apiService.getAgentVersions();
            const versions = result.agents || {};
            const latestVersions = result.latestAgents || {};
            agentVersionCacheRef.current = {
                fetchedAt: Date.now(),
                versions,
                latestVersions,
            };
            setAgentVersions(versions);
            setLatestAgentVersions(latestVersions);
        } catch (error) {
            console.error('Error loading agent versions:', error);
        } finally {
            setAgentVersionsLoading(false);
        }
    };

    const loadLocalAiAgentVersionsAfterAcpReady = (runtime: AssistantRuntimeResponse | null) => {
        if (runtime?.health.status !== 'ready' || aiTabVersionLoadedRef.current) {
            return;
        }
        aiTabVersionLoadedRef.current = true;
        void loadAgentVersions();
    };

    const preserveSettingsDialogDuringLocalAcpAction = async <T,>(action: () => Promise<T>): Promise<T> => {
        localAcpAutoCloseBlockedRef.current = true;
        try {
            return await action();
        } finally {
            window.setTimeout(() => {
                localAcpAutoCloseBlockedRef.current = false;
            }, 0);
        }
    };

    const handleSettingsDialogOpenChange = (nextOpen: boolean) => {
        if (nextOpen) return;
        if (localAcpAutoCloseBlockedRef.current) {
            return;
        }
        onClose();
    };

    async function handleLocalAcpRuntimeCheck(options: { silent?: boolean } = {}) {
        setLocalAcpChecking(true);
        try {
            const runtime = await apiService.getAssistantRuntime({ autoStart: false, projectId: activeProjectId || undefined });
            setLocalAcpRuntime(runtime);
            setLocalAcpFailureContext(null);
            loadLocalAiAgentVersionsAfterAcpReady(runtime);
            if (!options.silent) {
                if (runtime.health.status === 'ready') {
                    toast.success('本地 ACP 服务已链接');
                } else {
                    toast.warning(runtime.health.message || '本地 ACP 服务未链接');
                }
            }
            return runtime;
        } catch (error: any) {
            console.error('Error checking local ACP runtime:', error);
            if (!options.silent) {
                toast.error(error?.message || '检测本地 ACP 服务失败');
            }
            return null;
        } finally {
            setLocalAcpChecking(false);
        }
    }

    const handleLocalAcpRuntimeConnect = async () => {
        return preserveSettingsDialogDuringLocalAcpAction(async () => {
            setLocalAcpConnecting(true);
            try {
                const runtime = await apiService.getAssistantRuntime({ autoStart: true, projectId: activeProjectId || undefined });
                setLocalAcpRuntime(runtime);
                setLocalAcpFailureContext(null);
                loadLocalAiAgentVersionsAfterAcpReady(runtime);
                if (runtime.health.status === 'ready') {
                    toast.success('本地 ACP 服务已链接');
                } else {
                    toast.warning(runtime.health.message || '本地 ACP 服务未链接');
                }
                return runtime;
            } catch (error: any) {
                console.error('Error connecting local ACP runtime:', error);
                toast.error(error?.message || '链接本地 ACP 服务失败');
                return null;
            } finally {
                setLocalAcpConnecting(false);
            }
        });
    };

    const handleLocalAcpRuntimeRestart = async () => {
        return preserveSettingsDialogDuringLocalAcpAction(async () => {
            setLocalAcpRestarting(true);
            try {
                const result = await apiService.bootstrapAssistant({ mode: 'restart_existing', projectId: activeProjectId || undefined });
                setLocalAcpRuntime(result.runtime);
                setLocalAcpFailureContext(null);
                loadLocalAiAgentVersionsAfterAcpReady(result.runtime);
                if (result.runtime.health.status === 'ready') {
                    toast.success('本地 ACP 服务已重启');
                } else {
                    toast.warning(result.runtime.health.message || '本地 ACP 服务重启后未就绪');
                }
                return result.runtime;
            } catch (error: any) {
                console.error('Error restarting local ACP runtime:', error);
                toast.error(error?.message || '重启本地 ACP 服务失败');
                return null;
            } finally {
                setLocalAcpRestarting(false);
            }
        });
    };

    const loadMakeClientUpdateStatus = async (projectId = activeProjectId) => {
        if (!projectId) {
            setMakeClientUpdateError(new Error('当前没有已注册的 Make Client 项目'));
            return;
        }
        setMakeClientUpdateStatusLoading(true);
        setMakeClientUpdateError(null);
        try {
            const status = await apiService.getMakeClientUpdateStatus(projectId);
            setMakeClientUpdateStatus(status);
        } catch (error: any) {
            setMakeClientUpdateError(error);
            toast.error(formatMakeClientUpdateError(error, '检测项目更新失败'));
        } finally {
            setMakeClientUpdateStatusLoading(false);
        }
    };

    const handleTabValueChange = (value: string) => {
        setActiveTab(value === 'ai' ? 'ai' : value === 'update' ? 'update' : 'project');
        if (value === 'ai') {
            void handleLocalAcpRuntimeCheck({ silent: true });
        }
        if (value === 'update') {
            if (activeProjectId) {
                void loadMakeClientUpdateStatus(activeProjectId);
            } else {
                void loadConfig().then((config) => {
                    const projectId = typeof config?.projectId === 'string' ? config.projectId.trim() : '';
                    if (projectId) {
                        void loadMakeClientUpdateStatus(projectId);
                    }
                });
            }
        }
    };

    const handleApplyMakeClientUpdate = async () => {
        if (!activeProjectId) {
            toast.error('当前没有已注册的 Make Client 项目');
            return;
        }
        setMakeClientUpdateApplying(true);
        setMakeClientUpdateError(null);
        setMakeClientUpdateResult(null);
        try {
            const result = await apiService.applyMakeClientUpdate(activeProjectId);
            setMakeClientUpdateResult(result);
            toast.success('项目更新完成，请重启或刷新客户端');
            void loadMakeClientUpdateStatus(activeProjectId);
        } catch (error: any) {
            setMakeClientUpdateError(error);
            toast.error(formatMakeClientUpdateError(error, '项目更新失败'));
        } finally {
            setMakeClientUpdateApplying(false);
        }
    };

    const handleCopyMakeClientUpdateFailurePrompt = async () => {
        const displayMessage = formatMakeClientUpdateError(makeClientUpdateError, '项目更新失败');
        const prompt = buildMakeClientUpdateFailurePrompt(makeClientUpdateError, {
            displayMessage,
            currentUrl: window.location.href,
        });
        try {
            await navigator.clipboard.writeText(prompt);
            toast.success('已复制给 AI 处理的提示词');
        } catch {
            toast.error('复制失败，请手动选择错误信息');
        }
    };

    const handleCopyLocalAcpRepairCommand = async () => {
        const command = resolveLocalAcpRepairCommand(localAcpRuntime);
        if (!command) {
            toast.error('未获取到可复制的启动命令');
            return;
        }
        try {
            await navigator.clipboard.writeText(command);
            toast.success('启动命令已复制');
        } catch {
            toast.error('复制失败，请手动选择启动命令');
        }
    };

    const handleCopyLocalAcpTroubleshootingPrompt = async () => {
        const prompt = buildLocalAcpTroubleshootingPrompt({
            runtime: localAcpRuntime,
            failureSource: localAcpFailureContext?.source,
            failureMessage: localAcpFailureContext?.message,
            currentUrl: window.location.href,
        });
        try {
            await navigator.clipboard.writeText(prompt);
            toast.success('已复制给 AI 处理的提示词');
        } catch {
            toast.error('复制失败，请手动选择排障提示词');
        }
    };

    function handleAiRunAcpRuntimeUnavailable(error: unknown, source: string): boolean {
        if (!isAiRunAcpRuntimeUnavailable(error)) return false;
        const record = error as AiRunClientError;
        if (record.runtime && typeof record.runtime === 'object') {
            setLocalAcpRuntime(record.runtime as AssistantRuntimeResponse);
        }
        setLocalAcpFailureContext({
            source,
            message: typeof record.message === 'string' ? record.message : '本地 ACP 服务不可用',
        });
        setActiveTab('ai');
        toast.warning('本地 ACP 服务不可用，请查看上方修复信息');
        return true;
    }

    const handleAgentProviderTest = async (option: typeof LOCAL_AI_AGENT_OPTIONS[number]) => {
        updateAgentProviderTestState(option.value, { status: 'testing', message: '测试中' });
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), AGENT_PROVIDER_TEST_TIMEOUT_MS);
        try {
            const result = await runAiText({
                scene: 'agent-provider-test',
                client: option.value,
                prompt: AGENT_PROVIDER_TEST_PROMPT,
                signal: controller.signal,
            });

            const output = String(result?.output || '');
            if (output.includes(AGENT_PROVIDER_TEST_KEYWORD)) {
                updateAgentProviderTestState(option.value, { status: 'passed', message: '通过', testedAt: Date.now() });
                toast.success(`${option.label} 测试通过`);
                return;
            }

            const summary = summarizeAgentProviderTestOutput(output);
            updateAgentProviderTestState(option.value, { status: 'failed', message: summary });
            toast.error(`${option.label} 测试失败：${summary}`);
        } catch (error: any) {
            const message = error?.name === 'AbortError'
                ? '测试超时'
                : summarizeAgentProviderTestOutput(error?.message || error);
            updateAgentProviderTestState(option.value, { status: 'failed', message });
            if (handleAiRunAcpRuntimeUnavailable(error, '本地执行 agent 测试')) return;
            toast.error(`${option.label} 测试失败：${message}`);
        } finally {
            window.clearTimeout(timeoutId);
        }
    };

    const handleImportCodexConfig = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/config/ai-image/codex-local', { cache: 'no-store' });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result?.success) {
                throw new Error(result?.error || '读取本地 Codex 配置失败');
            }
            if (!result.ready || !result.config) {
                const warning = result?.warnings?.[0]?.message || '未找到本地 Codex 图片 API 配置';
                throw new Error(warning);
            }
            const imported = result.config;
            updateField('aiBaseUrl', imported.baseUrl || DEFAULT_FORM_STATE.aiBaseUrl);
            updateField('aiApiKey', imported.apiKey || '');
            updateField('aiModel', imported.model || 'gpt-image-2');
            toast.success('已读取本地 Codex 配置');
        } catch (error: any) {
            console.error('Error importing local Codex config:', error);
            toast.error(error?.message || '读取本地 Codex 配置失败');
        } finally {
            setLoading(false);
        }
    };

    const persistAiImageConfigLastTest = async (lastTest: AiImageConfigLastTest) => {
        setAiImageConfigLastTest(lastTest);
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ai: {
                    imageGeneration: {
                        baseUrl: formState.aiBaseUrl.trim() || 'https://api.openai.com/v1',
                        apiKey: formState.aiApiKey.trim() || null,
                        model: formState.aiModel.trim() || 'gpt-image-2',
                        lastTest,
                    },
                },
            }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error((error as any)?.error || '保存图片测试结果失败');
        }
    };

    const handleAiImageConfigTest = async () => {
        setAiImageConfigTest({ status: 'testing', message: '测试中' });
        try {
            const response = await fetch('/api/config/ai-image/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: AI_IMAGE_CONFIG_TEST_PROMPT,
                    baseUrl: formState.aiBaseUrl.trim(),
                    apiKey: formState.aiApiKey.trim(),
                    model: formState.aiModel.trim() || 'gpt-image-2',
                }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok || body?.success !== true) {
                throw new Error(String(body?.error || body?.message || '图片配置测试失败'));
            }
            const successMessage = typeof body?.message === 'string' && body.message.trim()
                ? body.message.trim()
                : '已返回图片结果';
            const testedAt = Date.now();
            setAiImageConfigTest({ status: 'passed', message: successMessage });
            try {
                await persistAiImageConfigLastTest({ status: 'passed', message: successMessage, testedAt });
            } catch (persistError) {
                console.error('Error saving AI image test result:', persistError);
                toast.error('图片配置测试通过，但保存测试结果失败');
            }
            toast.success('图片配置测试通过');
        } catch (error: any) {
            const message = error?.name === 'AbortError'
                ? '测试超时'
                : summarizeAgentProviderTestOutput(error?.message || error);
            const testedAt = Date.now();
            setAiImageConfigTest({ status: 'failed', message });
            try {
                await persistAiImageConfigLastTest({ status: 'failed', message, testedAt });
            } catch (persistError) {
                console.error('Error saving AI image test result:', persistError);
            }
            toast.error(`图片配置测试失败：${message}`);
        }
    };

    const handleSave = async () => {
        const host = formState.host.trim();
        if (!host) {
            toast.error('主机地址不能为空');
            return;
        }

        try {
            setLoading(true);

            const currentConfigResponse = await fetch('/api/config');
            const currentConfig: Config = currentConfigResponse.ok
                ? await currentConfigResponse.json()
                : { server: { host: 'localhost', port: 51720, allowLAN: true } };

            const config: Config = {
                ...currentConfig,
                server: {
                    host,
                    port: currentConfig.server.port || 51720,
                    allowLAN: formState.allowLAN,
                    lanHost: formState.lanHost.trim(),
                    enableCommandAPI: currentConfig.server.enableCommandAPI || false,
                },
                projectInfo: {
                    name: formState.projectName.trim() || null,
                    description: formState.projectDescription.trim() || null,
                },
                projectDefaults: {
                    ...(currentConfig.projectDefaults || {}),
                    defaultTheme: formState.defaultTheme.trim() || null,
                },
                automation: {
                    ...(currentConfig.automation || {}),
                    defaultPromptClient: formState.defaultPromptClient,
                    annotationPromptClient: formState.annotationPromptClient || null,
                    annotationModel: formState.annotationModel.trim() || null,
                },
                ai: {
                    ...(currentConfig.ai || {}),
                    imageGeneration: {
                        baseUrl: formState.aiBaseUrl.trim() || 'https://api.openai.com/v1',
                        apiKey: formState.aiApiKey.trim() || null,
                        model: formState.aiModel.trim() || 'gpt-image-2',
                        lastTest: aiImageConfigLastTest,
                    },
                },
            };

            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error((error as any)?.error || 'Failed to save config');
            }

            const syncResponse = await fetch('/api/themes/sync-design', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ themeName: formState.defaultTheme.trim() }),
            });
            if (!syncResponse.ok) {
                const error = await syncResponse.json().catch(() => ({}));
                throw new Error((error as any)?.error || '同步默认设计失败');
            }

            const result = await response.json();
            window.__AXHUB_SHARE_HOSTS__ = {
                localHost: host,
                lanHost: formState.lanHost.trim() || availableLANHosts[0] || '',
            };
            toast.success(result.message || '配置已保存');
            onSaved?.();
            onClose();
        } catch (error: any) {
            console.error('Error saving config:', error);
            toast.error(error?.message || '保存配置失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={handleSettingsDialogOpenChange}>
            <SheetContent
                side="left"
                className="flex w-full max-w-[620px] flex-col p-0 text-sm sm:max-w-[620px] [&>[data-sheet-close]]:hidden"
            >
                <Tabs value={activeTab} onValueChange={handleTabValueChange} className="flex h-full flex-col">
                    <SheetHeader className="border-b px-5 py-3.5">
                        <SheetTitle className="sr-only">项目设置 / 项目更新 / AI 设置</SheetTitle>
                        <div className="flex items-center justify-between gap-3">
                            <TabsList className="grid h-8 w-full max-w-[330px] grid-cols-3 rounded-lg border border-border/70 bg-muted/50 p-0.5">
                                <TabsTrigger value="project" className="h-full rounded-md px-2.5 py-0 text-[13px] leading-none data-[state=active]:shadow-none">
                                    项目设置
                                </TabsTrigger>
                                <TabsTrigger value="update" className="h-full rounded-md px-2.5 py-0 text-[13px] leading-none data-[state=active]:shadow-none">
                                    项目更新
                                </TabsTrigger>
                                <TabsTrigger value="ai" className="h-full rounded-md px-2.5 py-0 text-[13px] leading-none data-[state=active]:shadow-none">
                                    AI 设置
                                </TabsTrigger>
                            </TabsList>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-7 w-7 rounded-md"
                                onClick={onClose}
                                aria-label="关闭"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </SheetHeader>

                    <TabsContent value="project" className="m-0 min-h-0 flex-1 overflow-y-auto px-5 py-4.5">
                        <section className="space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold text-foreground">项目信息</h3>
                            <p className="text-xs text-muted-foreground">用于定义项目基础信息与默认资产。</p>
                        </div>

                        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>配置更新后需保存并重启服务，修改内容才会生效。</span>
                        </div>

                        <Field>
                            <FieldLabelWithHint hint="用于 AI 理解项目定位与产出风格">项目名称</FieldLabelWithHint>
                            <Input
                                value={formState.projectName}
                                onChange={(event) => updateField('projectName', event.target.value)}
                                placeholder="请输入项目名称"
                                maxLength={20}
                            />
                        </Field>

                        <Field>
                            <FieldLabelWithHint hint="简要描述项目背景、目标用户与核心场景">项目简介</FieldLabelWithHint>
                            <Textarea
                                value={formState.projectDescription}
                                onChange={(event) => updateField('projectDescription', event.target.value)}
                                placeholder="例如：面向运营人员的活动配置后台，强调高效配置与稳定交付"
                                maxLength={60}
                                rows={3}
                                className="resize-none text-sm"
                            />
                            <FieldDescription>
                                {formState.projectDescription.length}/60
                            </FieldDescription>
                        </Field>

                        <Field>
                            <FieldLabelWithHint hint="从“资产管理-设计”中选择一个作为项目默认设计">默认设计</FieldLabelWithHint>
                            <PrototypeThemeSearchSelect
                                themes={availableThemes}
                                value={formState.defaultTheme || NO_PROTOTYPE_THEME_VALUE}
                                onValueChange={(themeName) => updateField('defaultTheme', themeName === NO_PROTOTYPE_THEME_VALUE ? '' : themeName)}
                            />
                        </Field>

                        </section>

                        <Separator className="my-5" />

                        <section className="space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold text-foreground">服务配置</h3>
                            <p className="text-xs text-muted-foreground">配置服务监听地址与网络访问范围。</p>
                        </div>

                        <Field>
                            <FieldLabelWithHint hint="复制本地访问链接时使用的地址。通常保持 localhost 即可。">本地地址</FieldLabelWithHint>
                            <Input
                                value={formState.host}
                                onChange={(event) => updateField('host', event.target.value)}
                                placeholder="localhost"
                            />
                        </Field>

                        <label className="inline-flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={formState.allowLAN}
                                onCheckedChange={(checked) => updateField('allowLAN', checked === true)}
                                className="data-[state=checked]:text-white"
                            />
                            <span className="font-medium text-foreground">允许局域网访问</span>
                        </label>

                        {formState.allowLAN ? (
                            <Field>
                                <FieldLabelWithHint hint="复制局域网链接和二维码时使用的固定地址，可手动填写或从检测到的地址中选择。">局域网地址</FieldLabelWithHint>
                                <Input
                                    value={formState.lanHost}
                                    onChange={(event) => updateField('lanHost', event.target.value)}
                                    placeholder={availableLANHosts[0] || '192.168.1.10'}
                                />
                                {availableLANHosts.length ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {availableLANHosts.slice(0, 4).map((host) => (
                                            <button
                                                key={host}
                                                type="button"
                                                className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] leading-5 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                                                onClick={() => updateField('lanHost', host)}
                                            >
                                                {host}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </Field>
                        ) : null}
                        </section>
                    </TabsContent>

                    <TabsContent value="update" className="m-0 min-h-0 flex-1 overflow-y-auto px-5 py-4.5">
                        <section className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <h3 className="text-base font-semibold text-foreground">项目更新</h3>
                                    <p className="text-xs text-muted-foreground">更新当前已注册 Make Client 项目的官方模板文件。</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5"
                                    onClick={() => loadMakeClientUpdateStatus()}
                                    disabled={makeClientUpdateStatusLoading || makeClientUpdateApplying}
                                >
                                    {makeClientUpdateStatusLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                    检测更新
                                </Button>
                            </div>

                            <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-3 text-xs">
                                <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                                    <span className="text-muted-foreground">当前客户端版本</span>
                                    <span className="truncate font-medium text-foreground">{makeClientUpdateStatus?.currentVersion || '未检测'}</span>
                                </div>
                                <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                                    <span className="text-muted-foreground">服务端最新版本</span>
                                    <span className="truncate font-medium text-foreground">{makeClientUpdateStatus?.targetVersion || '未检测'}</span>
                                </div>
                                <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                                    <span className="text-muted-foreground">项目路径</span>
                                    <span className="truncate font-medium text-foreground" title={makeClientUpdateStatus?.projectRoot || ''}>{makeClientUpdateStatus?.projectRoot || '未检测'}</span>
                                </div>
                                <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                                    <span className="text-muted-foreground">Git 状态</span>
                                    <span className={makeClientUpdateStatus?.canApply ? 'font-medium text-emerald-600' : 'font-medium text-amber-600'}>
                                        {formatMakeClientUpdateGitStatus(makeClientUpdateStatus)}
                                    </span>
                                </div>
                            </div>

                            {makeClientUpdateStatus?.blockedReasons.length ? (
                                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>{getMakeClientUpdatePrimaryBlocker(makeClientUpdateStatus)}</span>
                                </div>
                            ) : null}

                            <div className="space-y-2">
                                <div className="text-xs font-medium text-foreground">更新过程</div>
                                <div className="grid gap-1.5">
                                    {MAKE_CLIENT_UPDATE_STEPS.map((step) => {
                                        const active = makeClientUpdateApplying;
                                        const completed = Boolean(makeClientUpdateResult);
                                        return (
                                            <div key={step} className="flex h-7 items-center gap-2 rounded-md bg-muted/20 px-2 text-xs text-muted-foreground">
                                                {completed ? (
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                                ) : active ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                                ) : (
                                                    <span className="h-3.5 w-3.5 rounded-full border border-border" />
                                                )}
                                                <span>{step}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {makeClientUpdateResult ? (
                                <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>项目更新完成。建议重启或刷新客户端后继续使用。</span>
                                </div>
                            ) : null}

                            {makeClientUpdateError ? (
                                <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
                                    <div className="flex items-start gap-2 text-destructive">
                                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        <span>{formatMakeClientUpdateError(makeClientUpdateError, '项目更新失败')}</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5"
                                        onClick={handleCopyMakeClientUpdateFailurePrompt}
                                    >
                                        <Copy className="h-3.5 w-3.5" />
                                        复制给 AI 处理
                                    </Button>
                                </div>
                            ) : null}

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <Button
                                    type="button"
                                    variant="brand"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={handleApplyMakeClientUpdate}
                                    aria-label="开始更新"
                                    disabled={
                                        makeClientUpdateApplying
                                        || makeClientUpdateStatusLoading
                                        || !makeClientUpdateStatus?.canApply
                                    }
                                    title={getMakeClientUpdatePrimaryBlocker(makeClientUpdateStatus)}
                                >
                                    {makeClientUpdateApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                    {formatMakeClientUpdateActionLabel(makeClientUpdateStatus, makeClientUpdateApplying)}
                                </Button>
                            </div>
                        </section>
                    </TabsContent>

                    <TabsContent value="ai" className="m-0 min-h-0 flex-1 overflow-y-auto px-5 py-4.5">
                        <section className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <h3 className="text-base font-semibold text-foreground">本地 ACP 服务</h3>
                                    <p className="text-xs text-muted-foreground">用于在网页端直接使用相关 AI Agent。</p>
                                </div>
                                <span
                                    className={localAcpConnected
                                        ? 'inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-emerald-50 px-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                                        : 'inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-muted px-2 text-xs font-medium text-muted-foreground'}
                                >
                                    {localAcpConnected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                    {localAcpConnected ? '已链接' : '未链接'}
                                </span>
                            </div>

                            <div data-local-acp-status-card className="grid gap-2 rounded-md border border-border bg-muted/20 p-3 text-xs">
                                <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                                    <span className="text-muted-foreground">状态</span>
                                    <span className={localAcpConnected ? 'font-medium text-emerald-600' : 'font-medium text-muted-foreground'}>
                                        {localAcpConnected ? '已链接' : '未链接'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                                    <span className="text-muted-foreground">上次检测</span>
                                    <span className="truncate font-medium text-foreground">
                                        {formatLocalAcpCheckedAt(localAcpRuntime?.health.checkedAt)}
                                    </span>
                                </div>
                                <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                                    <span className="text-muted-foreground">地址</span>
                                    <span className="truncate font-medium text-foreground" title={localAcpRuntime?.webBaseUrl || ''}>
                                        {localAcpRuntime?.webBaseUrl || '未检测'}
                                    </span>
                                </div>
                                {localAcpRuntime?.health.message ? (
                                    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                                        <span className="text-muted-foreground">检测结果</span>
                                        <span
                                            className={localAcpConnected ? 'truncate text-emerald-600' : 'truncate text-amber-600'}
                                            title={localAcpRuntime.health.message}
                                        >
                                            {localAcpRuntime.health.message}
                                        </span>
                                    </div>
                                ) : null}
                                {!localAcpConnected && localAcpRuntime ? (
                                    <div data-local-acp-repair className="mt-1 space-y-2 border-t border-border/70 pt-2">
                                        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                                            <span className="text-muted-foreground">修复信息</span>
                                            <div className="min-w-0 space-y-1">
                                                <div className="break-words leading-5 text-foreground">
                                                    {resolveLocalAcpRepairMessage({
                                                        runtime: localAcpRuntime,
                                                        failureMessage: localAcpFailureContext?.message,
                                                    })}
                                                </div>
                                                {localAcpFailureContext?.source ? (
                                                    <div className="text-muted-foreground">
                                                        来源：{localAcpFailureContext.source}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                        {resolveLocalAcpRepairCommand(localAcpRuntime) ? (
                                            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                                                <span className="text-muted-foreground">启动命令</span>
                                                <code className="block min-w-0 whitespace-pre-wrap break-words rounded border border-border bg-background px-2 py-1.5 font-mono text-[12px] leading-5 text-foreground [overflow-wrap:anywhere]">
                                                    {resolveLocalAcpRepairCommand(localAcpRuntime)}
                                                </code>
                                            </div>
                                        ) : null}
                                        <div className="flex flex-wrap items-center gap-3 pl-[96px]">
                                            <button
                                                type="button"
                                                className="text-xs font-medium text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground"
                                                onClick={handleCopyLocalAcpRepairCommand}
                                                disabled={!resolveLocalAcpRepairCommand(localAcpRuntime)}
                                            >
                                                复制启动命令
                                            </button>
                                            <button
                                                type="button"
                                                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                                                onClick={handleCopyLocalAcpTroubleshootingPrompt}
                                            >
                                                复制给 AI 处理
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5"
                                    onClick={localAcpNeedsCorsRestart || localAcpConnected ? handleLocalAcpRuntimeRestart : handleLocalAcpRuntimeConnect}
                                    disabled={localAcpActionBusy}
                                >
                                    {localAcpConnecting || localAcpRestarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                    {localAcpActionLabel}
                                </Button>
                            </div>
                        </section>

                        {localAcpConnected ? (
                            <>
                                <Separator className="my-5" />

                                <section className="space-y-4">
                                    <div className="space-y-1">
                                        <h3 className="text-base font-semibold text-foreground">AI Agent</h3>
                                        <p className="text-xs text-muted-foreground">配置本地可用的 AI Agent。</p>
                                    </div>

                                    <Field>
                                        <RadioGroup
                                            value={formState.defaultPromptClient || 'acp:codex'}
                                            onValueChange={(value) => updateField('defaultPromptClient', normalizePromptClientPreference(value) || 'acp:codex')}
                                            className="gap-0 rounded-md border border-border"
                                        >
                                            <Table>
                                                <TableHeader className="bg-muted/30">
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="h-8 w-[76px] px-2 text-xs">
                                                            <span className="inline-flex items-center gap-1">
                                                                默认
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <button
                                                                                type="button"
                                                                                className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                                                                                aria-label="默认说明"
                                                                            >
                                                                                <CircleHelp className="h-3.5 w-3.5" />
                                                                            </button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent arrow className="max-w-[320px]">
                                                                            用于原型生成和本地 AI 面板的默认 agent
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </span>
                                                        </TableHead>
                                                        <TableHead className="h-8 w-[170px] px-2 text-xs">供应商</TableHead>
                                                        <TableHead className="h-8 w-[180px] px-3 text-xs">
                                                            <span className="inline-flex items-center gap-1.5">
                                                                版本
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon-xs"
                                                                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                                                onClick={() => loadAgentVersions(true)}
                                                                                disabled={agentVersionsLoading}
                                                                                aria-label="刷新版本"
                                                                            >
                                                                                {agentVersionsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent arrow>刷新版本</TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </span>
                                                        </TableHead>
                                                        <TableHead className="h-8 w-[230px] px-3 text-center text-xs">上次测试</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                {LOCAL_AI_AGENT_OPTIONS.map((option) => {
                                                    const meta = formatAgentVersionMeta(agentVersions[option.versionKey], latestAgentVersions[option.versionKey]);
                                                    const metaTitle = formatAgentVersionMetaTitle(agentVersions[option.versionKey], latestAgentVersions[option.versionKey]);
                                                    const testState = agentProviderTests[option.value];
                                                    const testLabel = getAgentProviderTestLabel(testState);
                                                    const isTesting = testState?.status === 'testing';
                                                    const testTime = testState?.status === 'passed' ? formatAgentProviderTestTime(testState.testedAt) : '';
                                                    return (
                                                        <TableRow key={option.value} data-state={formState.defaultPromptClient === option.value ? 'selected' : undefined}>
                                                            <TableCell className="px-2 py-2">
                                                                <RadioGroupItem value={option.value} aria-label={`默认使用 ${option.label}`} />
                                                            </TableCell>
                                                            <TableCell className="w-[170px] max-w-[170px] px-2 py-2">
                                                                <span className="inline-flex min-w-0 items-center gap-2 font-medium text-foreground">
                                                                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
                                                                        {getAgentProviderIcon(option.provider)}
                                                                    </span>
                                                                    <span className="truncate">{option.label}</span>
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="w-[180px] max-w-[180px] px-3 py-2 text-xs text-muted-foreground">
                                                                <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                                                                    {agentVersionsLoading && !meta ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                                                    <span className="block max-w-[144px] truncate font-mono text-[11px] leading-4" title={metaTitle || undefined}>{meta || (agentVersionsLoading ? '检测中' : '未检测')}</span>
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="w-[230px] max-w-[230px] px-3 py-2 text-center text-xs align-middle">
                                                                <div className="inline-flex min-w-0 max-w-full items-center justify-center gap-2">
                                                                    <div className="flex min-w-0 flex-col items-center text-center gap-0.5">
                                                                        {testLabel ? (
                                                                            <span
                                                                                className={testState?.status === 'passed'
                                                                                    ? 'inline-flex max-w-[190px] items-center gap-1 whitespace-normal break-words leading-5 text-emerald-600 [overflow-wrap:anywhere]'
                                                                                    : testState?.status === 'testing'
                                                                                        ? 'inline-flex max-w-[190px] items-center gap-1 whitespace-normal break-words leading-5 text-muted-foreground [overflow-wrap:anywhere]'
                                                                                        : 'block max-w-[190px] whitespace-normal break-words leading-5 text-destructive [overflow-wrap:anywhere]'}
                                                                                title={testState?.message || testLabel}
                                                                            >
                                                                                {isTesting ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : null}
                                                                                {testLabel}{testState?.status === 'failed' && testState.message && testState.message !== testLabel ? `：${testState.message}` : ''}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-muted-foreground">未测试</span>
                                                                        )}
                                                                        {testState?.status === 'passed' && testTime ? (
                                                                            <span className="text-muted-foreground">{testTime}</span>
                                                                        ) : null}
                                                                    </div>
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="icon-xs"
                                                                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                                                                                    onClick={() => handleAgentProviderTest(option)}
                                                                                    disabled={isTesting}
                                                                                    aria-label={`测试 ${option.label}`}
                                                                                >
                                                                                    {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent arrow>测试连接</TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                                </TableBody>
                                            </Table>
                                        </RadioGroup>
                                    </Field>
                                </section>

                                <Separator className="my-5" />

                                <section className="space-y-4">
                                    <div className="space-y-1">
                                        <h3 className="text-base font-semibold text-foreground">批注执行 AI</h3>
                                        <p className="text-xs text-muted-foreground">可以单独为批注场景配置一个执行速度更快的 AI；不选择时使用上面的执行 Agent。</p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <Field>
                                            <FieldLabelWithHint hint="批注执行时优先使用的本地 ACP 供应商；不选择时使用上面的执行 Agent">批注供应商</FieldLabelWithHint>
                                            <Select
                                                value={formState.annotationPromptClient || undefined}
                                                onValueChange={(value) => updateField('annotationPromptClient', normalizePromptClientPreference(value))}
                                            >
                                                <SelectTrigger
                                                    clearable
                                                    hasValue={Boolean(formState.annotationPromptClient)}
                                                    onClear={() => updateField('annotationPromptClient', null)}
                                                >
                                                    <SelectValue placeholder="默认供应商" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {LOCAL_AI_AGENT_OPTIONS.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </Field>

                                        <Field>
                                            <FieldLabelWithHint hint="留空时使用供应商或 ACP UI 的默认模型">批注执行模型</FieldLabelWithHint>
                                            <Input
                                                value={formState.annotationModel}
                                                onChange={(event) => updateField('annotationModel', event.target.value)}
                                                placeholder="例如 gpt-5.5 / sonnet / auto"
                                            />
                                        </Field>
                                    </div>
                                </section>

                                <Separator className="my-5" />

                                <section className="space-y-4">
                                    <div className="space-y-1">
                                        <h3 className="text-base font-semibold text-foreground">图片生成 AI</h3>
                                        <p className="text-xs text-muted-foreground">配置图片生成 AI 的接口信息。</p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <Field>
                                            <FieldLabelWithHint hint="OpenAI 或兼容服务的 /v1 API 地址">Base URL</FieldLabelWithHint>
                                            <Input
                                                value={formState.aiBaseUrl}
                                                onChange={(event) => updateField('aiBaseUrl', event.target.value)}
                                                placeholder="https://api.openai.com/v1"
                                            />
                                        </Field>

                                        <Field>
                                            <FieldLabelWithHint hint="保存在本机服务端配置，不写入项目仓库">API Key</FieldLabelWithHint>
                                            <Input
                                                type="password"
                                                value={formState.aiApiKey}
                                                onChange={(event) => updateField('aiApiKey', event.target.value)}
                                                placeholder="sk-..."
                                            />
                                        </Field>

                                        <Field>
                                            <FieldLabelWithHint hint="图片生成模型 ID">模型</FieldLabelWithHint>
                                            <Input
                                                value={formState.aiModel}
                                                onChange={(event) => updateField('aiModel', event.target.value)}
                                                placeholder="gpt-image-2"
                                            />
                                        </Field>

                                        <Field data-ai-image-last-test className="min-w-0">
                                            <FieldLabelWithHint hint="图片生成配置的最近一次测试状态">上次测试</FieldLabelWithHint>
                                            <div className="flex min-h-9 min-w-0 items-center text-sm">
                                                {aiImageConfigLastTest?.status === 'passed' ? (
                                                    <span className="block max-w-full whitespace-normal break-words leading-5 text-emerald-600 [overflow-wrap:anywhere]">
                                                        {getAiImageConfigLastTestLabel(aiImageConfigLastTest)} · {formatAiImageConfigLastTestTime(aiImageConfigLastTest?.testedAt)}
                                                    </span>
                                                ) : aiImageConfigLastTest?.status === 'failed' ? (
                                                    <span className="block max-w-full whitespace-normal break-words leading-5 text-destructive [overflow-wrap:anywhere]" title={aiImageConfigLastTest.message}>
                                                        {getAiImageConfigLastTestLabel(aiImageConfigLastTest)}{aiImageConfigLastTest.message ? `：${aiImageConfigLastTest.message}` : ''}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">未测试</span>
                                                )}
                                            </div>
                                        </Field>
                                    </div>

                                    <div data-ai-image-config-actions className="flex flex-wrap items-center gap-2 pt-1">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5"
                                            onClick={handleAiImageConfigTest}
                                            disabled={loading || aiImageConfigTest.status === 'testing'}
                                        >
                                            {aiImageConfigTest.status === 'testing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                            {aiImageConfigTest.status === 'testing' ? '测试中...' : '测试图片配置'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5"
                                            onClick={handleImportCodexConfig}
                                            disabled={loading || aiImageConfigTest.status === 'testing'}
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" />
                                            读取本地 Codex 配置
                                        </Button>
                                        {aiImageConfigTest.status === 'passed' ? (
                                            <span className="block max-w-full whitespace-normal break-words text-xs leading-5 text-emerald-600 [overflow-wrap:anywhere] min-w-0 flex-[1_1_220px]">{aiImageConfigTest.message || '测试通过'}</span>
                                        ) : aiImageConfigTest.status === 'failed' ? (
                                            <span className="block max-w-full whitespace-normal break-words text-xs leading-5 text-destructive [overflow-wrap:anywhere] min-w-0 flex-[1_1_220px]" title={aiImageConfigTest.message}>测试失败：{aiImageConfigTest.message}</span>
                                        ) : null}
                                    </div>
                                </section>
                            </>
                        ) : null}
                    </TabsContent>

                    <SheetFooter className="flex flex-row justify-end gap-2 border-t px-5 py-3.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onClose}
                            disabled={loading || aiImageConfigTest.status === 'testing' || makeClientUpdateApplying}
                        >
                            取消
                        </Button>
                        {activeTab === 'update' ? null : (
                            <Button
                                type="button"
                                variant="brand"
                                size="sm"
                                onClick={handleSave}
                                disabled={loading || aiImageConfigTest.status === 'testing'}
                            >
                                {loading ? '保存中...' : '保存'}
                            </Button>
                        )}
                    </SheetFooter>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
