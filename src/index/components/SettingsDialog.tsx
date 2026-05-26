import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldLabelWithHint } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiService } from '../services/api';
import { normalizePromptClientPreference } from '../../common/promptExecution';
import type { MainIDEPreference } from '../../common/ide';
import type { PromptClientPreference } from '../types';
import type { CLIAgent } from '../../common/agent';
import {
    AGENT_VERSION_CACHE_TTL_MS,
    formatAgentVersionMeta,
    isAgentVersionCacheFresh,
    type AgentVersionCache,
    type AgentVersionMap,
} from '../utils/agentVersionCache';
import type { ExcalidrawPropertyPanelMode, ExcalidrawPropertyPanelPosition } from '../utils/excalidrawUiMode';

interface SettingsDialogProps {
    open: boolean;
    onClose: () => void;
    onSaved?: () => void;
    excalidrawPropertyPanelMode?: ExcalidrawPropertyPanelMode;
    onExcalidrawPropertyPanelModeChange?: (mode: ExcalidrawPropertyPanelMode) => void;
    excalidrawPropertyPanelPosition?: ExcalidrawPropertyPanelPosition;
    onExcalidrawPropertyPanelPositionChange?: (position: ExcalidrawPropertyPanelPosition) => void;
}

interface ServerConfig {
    host: string;
    port: number;
    allowLAN: boolean;
    enableCommandAPI?: boolean;
}

interface ProjectDefaultsConfig {
    defaultTheme?: string | null;
}

interface ProjectInfoConfig {
    name?: string | null;
    description?: string | null;
}

interface Config {
    server: ServerConfig;
    projectDefaults?: ProjectDefaultsConfig;
    projectInfo?: ProjectInfoConfig;
    automation?: {
        defaultPromptClient?: PromptClientPreference;
        defaultIDE?: MainIDEPreference;
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
            apiMode?: 'images' | 'responses';
            timeout?: number;
            size?: string;
            quality?: 'auto' | 'low' | 'medium' | 'high';
            outputFormat?: 'png' | 'jpeg' | 'webp';
            outputCompression?: number | null;
            moderation?: 'auto' | 'low';
            n?: number;
            codexCli?: boolean;
            responseFormatB64Json?: boolean;
        };
    };
}

interface ThemeOption {
    name: string;
    displayName: string;
}

interface SettingsFormState {
    host: string;
    allowLAN: boolean;
    projectName: string;
    projectDescription: string;
    defaultTheme: string;
    defaultPromptClient: PromptClientPreference;
    aiBaseUrl: string;
    aiApiKey: string;
    aiModel: string;
    aiApiMode: 'images' | 'responses';
    aiTimeout: string;
    aiCodexCli: boolean;
    aiResponseFormatB64Json: boolean;
}

const DEFAULT_FORM_STATE: SettingsFormState = {
    host: 'localhost',
    allowLAN: true,
    projectName: '',
    projectDescription: '',
    defaultTheme: '',
    defaultPromptClient: 'genie:codex',
    aiBaseUrl: 'https://api.openai.com/v1',
    aiApiKey: '',
    aiModel: 'gpt-image-2',
    aiApiMode: 'images',
    aiTimeout: '600',
    aiCodexCli: false,
    aiResponseFormatB64Json: true,
};

const LOCAL_AI_AGENT_OPTIONS: Array<{
    value: NonNullable<PromptClientPreference>;
    label: string;
    versionKey: CLIAgent;
}> = [
    { value: 'genie:claude', label: 'Claude Code', versionKey: 'claudecode' },
    { value: 'genie:codex', label: 'Codex', versionKey: 'codex' },
    { value: 'genie:opencode', label: 'OpenCode', versionKey: 'opencode' },
    { value: 'genie:gemini', label: 'Gemini CLI', versionKey: 'gemini' },
];

function normalizeFormState(config: Config): SettingsFormState {
    return {
        host: config.server.host || 'localhost',
        allowLAN: config.server.allowLAN !== false,
        projectName: config.projectInfo?.name || '',
        projectDescription: config.projectInfo?.description || '',
        defaultTheme: config.projectDefaults?.defaultTheme || '',
        defaultPromptClient: normalizePromptClientPreference(config.automation?.defaultPromptClient) || 'genie:codex',
        aiBaseUrl: config.ai?.imageGeneration?.baseUrl || 'https://api.openai.com/v1',
        aiApiKey: config.ai?.imageGeneration?.apiKey || '',
        aiModel: config.ai?.imageGeneration?.model || 'gpt-image-2',
        aiApiMode: config.ai?.imageGeneration?.apiMode || 'images',
        aiTimeout: String(config.ai?.imageGeneration?.timeout || 600),
        aiCodexCli: config.ai?.imageGeneration?.codexCli === true,
        aiResponseFormatB64Json: config.ai?.imageGeneration?.responseFormatB64Json !== false,
    };
}

export default function SettingsDialog({ open, onClose, onSaved }: SettingsDialogProps) {
    const [loading, setLoading] = useState(false);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [themes, setThemes] = useState<ThemeOption[]>([]);
    const [formState, setFormState] = useState<SettingsFormState>(DEFAULT_FORM_STATE);
    const [agentVersions, setAgentVersions] = useState<AgentVersionMap>({});
    const [agentVersionsLoading, setAgentVersionsLoading] = useState(false);
    const agentVersionCacheRef = useRef<AgentVersionCache | null>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        void loadConfig();
        void loadAssets();
    }, [open]);

    const updateField = <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) => {
        setFormState((previous) => ({ ...previous, [key]: value }));
    };

    const loadConfig = async () => {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error('Failed to load config');
            }
            const config: Config = await response.json();
            setFormState(normalizeFormState(config));
        } catch (error) {
            console.error('Error loading config:', error);
            toast.error('加载配置失败');
        }
    };

    const loadAssets = async () => {
        setAssetsLoading(true);
        try {
            const themesRes = await fetch('/api/themes');
            if (themesRes.ok) {
                const themesData = await themesRes.json();
                setThemes(Array.isArray(themesData) ? themesData : []);
            }
        } catch (error) {
            console.error('Error loading assets:', error);
        } finally {
            setAssetsLoading(false);
        }
    };

    const loadAgentVersions = async (force = false) => {
        if (!force && isAgentVersionCacheFresh(agentVersionCacheRef.current)) {
            setAgentVersions(agentVersionCacheRef.current.versions);
            return;
        }

        setAgentVersionsLoading(true);
        try {
            const result = await apiService.getAgentVersions();
            const versions = result.agents || {};
            agentVersionCacheRef.current = {
                fetchedAt: Date.now(),
                versions,
            };
            setAgentVersions(versions);
        } catch (error) {
            console.error('Error loading agent versions:', error);
        } finally {
            setAgentVersionsLoading(false);
        }
    };

    const handleLocalAiSelectOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            void loadAgentVersions();
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
            updateField('aiApiMode', imported.apiMode === 'responses' ? 'responses' : 'images');
            updateField('aiCodexCli', imported.codexCli === true);
            updateField('aiResponseFormatB64Json', imported.responseFormatB64Json !== false);
            toast.success('已读取本地 Codex 配置');
        } catch (error: any) {
            console.error('Error importing local Codex config:', error);
            toast.error(error?.message || '读取本地 Codex 配置失败');
        } finally {
            setLoading(false);
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
                    enableCommandAPI: currentConfig.server.enableCommandAPI || false,
                },
                projectInfo: {
                    name: formState.projectName.trim() || null,
                    description: formState.projectDescription.trim() || null,
                },
                projectDefaults: {
                    defaultTheme: formState.defaultTheme || null,
                },
                automation: {
                    ...(currentConfig.automation || {}),
                    defaultPromptClient: formState.defaultPromptClient,
                },
                ai: {
                    ...(currentConfig.ai || {}),
                    imageGeneration: {
                        ...(currentConfig.ai?.imageGeneration || {}),
                        baseUrl: formState.aiBaseUrl.trim() || 'https://api.openai.com/v1',
                        apiKey: formState.aiApiKey.trim() || null,
                        model: formState.aiModel.trim() || 'gpt-image-2',
                        apiMode: formState.aiApiMode,
                        timeout: Math.max(5, Number(formState.aiTimeout) || 600),
                        codexCli: formState.aiCodexCli,
                        responseFormatB64Json: formState.aiResponseFormatB64Json,
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
                body: JSON.stringify({ themeName: formState.defaultTheme || '' }),
            });
            if (!syncResponse.ok) {
                const syncError = await syncResponse.json().catch(() => ({}));
                throw new Error((syncError as any)?.error || '同步默认设计失败');
            }

            const result = await response.json();
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
        <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <SheetContent
                side="left"
                className="flex w-full max-w-[620px] flex-col p-0 text-sm sm:max-w-[620px] [&>[data-sheet-close]]:hidden"
            >
                <Tabs defaultValue="project" className="flex h-full flex-col">
                    <SheetHeader className="border-b px-5 py-3.5">
                        <SheetTitle className="sr-only">项目设置 / AI 设置</SheetTitle>
                        <div className="flex items-center justify-between gap-3">
                            <TabsList className="grid h-8 w-full max-w-[240px] grid-cols-2 rounded-lg border border-border/70 bg-muted/50 p-0.5">
                                <TabsTrigger value="project" className="h-full rounded-md px-2.5 py-0 text-[13px] leading-none data-[state=active]:shadow-none">
                                    项目设置
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
                            <Select
                                value={formState.defaultTheme}
                                onValueChange={(nextValue) => updateField('defaultTheme', nextValue || '')}
                            >
                                <SelectTrigger
                                    clearable
                                    hasValue={Boolean(formState.defaultTheme)}
                                    onClear={() => updateField('defaultTheme', '')}
                                >
                                    <SelectValue placeholder={assetsLoading ? '加载中...' : '请选择主题'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {themes.length > 0 ? themes.map((theme) => (
                                        <SelectItem key={theme.name} value={theme.name}>
                                            {theme.displayName}
                                        </SelectItem>
                                    )) : (
                                        <SelectItem value="__empty_themes__" disabled>
                                            {assetsLoading ? '加载中...' : '暂无可选主题'}
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </Field>
                        </section>

                        <Separator className="my-5" />

                        <section className="space-y-4">
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold text-foreground">服务配置</h3>
                            <p className="text-xs text-muted-foreground">配置服务监听地址与网络访问范围。</p>
                        </div>

                        <Field>
                            <FieldLabelWithHint hint="服务监听的主机地址。通常保持 localhost 即可。">主机地址</FieldLabelWithHint>
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
                        </section>
                    </TabsContent>

                    <TabsContent value="ai" className="m-0 min-h-0 flex-1 overflow-y-auto px-5 py-4.5">
                        <section className="space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-base font-semibold text-foreground">本地 AI</h3>
                                <p className="text-xs text-muted-foreground">配置 Genie 默认使用的本地执行 agent。</p>
                            </div>

                            <Field>
                                <FieldLabelWithHint hint="用于原型生成、批注执行和本地 AI 面板的默认 agent">执行 agent</FieldLabelWithHint>
                                <Select
                                    value={formState.defaultPromptClient || 'genie:codex'}
                                    onValueChange={(value) => updateField('defaultPromptClient', normalizePromptClientPreference(value) || 'genie:codex')}
                                    onOpenChange={handleLocalAiSelectOpenChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LOCAL_AI_AGENT_OPTIONS.map((option) => {
                                            const meta = formatAgentVersionMeta(agentVersions[option.versionKey]);
                                            return (
                                                <SelectItem key={option.value} value={option.value}>
                                                    <span className="flex w-full min-w-0 items-center gap-3">
                                                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                                                        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                                                            {agentVersionsLoading && !meta ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                                            {meta || (agentVersionsLoading ? '检测中' : '')}
                                                        </span>
                                                    </span>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                                <FieldDescription>
                                    打开下拉时检测版本并缓存 {Math.round(AGENT_VERSION_CACHE_TTL_MS / 1000)} 秒。
                                </FieldDescription>
                            </Field>
                        </section>

                        <Separator className="my-5" />

                        <section className="space-y-4">
                            <div className="space-y-1">
                                <div className="flex items-start justify-between gap-3">
                                    <h3 className="text-base font-semibold text-foreground">AI 图片生成</h3>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 gap-1.5 px-2.5 text-xs"
                                        onClick={handleImportCodexConfig}
                                        disabled={loading}
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        读取本地 Codex 配置
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">配置画布 AI 图片生成使用的 OpenAI-compatible 接口。</p>
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
                                    <FieldLabelWithHint hint="图片模型或 Responses 模型 ID">模型</FieldLabelWithHint>
                                    <Input
                                        value={formState.aiModel}
                                        onChange={(event) => updateField('aiModel', event.target.value)}
                                        placeholder="gpt-image-2"
                                    />
                                </Field>

                                <Field>
                                    <FieldLabelWithHint hint="Images API 或 Responses API 图片工具">接口模式</FieldLabelWithHint>
                                    <Select
                                        value={formState.aiApiMode}
                                        onValueChange={(value) => updateField('aiApiMode', value as SettingsFormState['aiApiMode'])}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="images">Images API</SelectItem>
                                            <SelectItem value="responses">Responses API</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>

                                <Field>
                                    <FieldLabelWithHint hint="单次请求最长等待秒数">超时秒数</FieldLabelWithHint>
                                    <Input
                                        type="number"
                                        min={5}
                                        value={formState.aiTimeout}
                                        onChange={(event) => updateField('aiTimeout', event.target.value)}
                                    />
                                </Field>

                                <label className="inline-flex items-center gap-2 self-end pb-2 text-sm">
                                    <Checkbox
                                        checked={formState.aiResponseFormatB64Json}
                                        onCheckedChange={(checked) => updateField('aiResponseFormatB64Json', checked === true)}
                                        className="data-[state=checked]:text-white"
                                    />
                                    <span className="font-medium text-foreground">优先返回 Base64 图片数据</span>
                                </label>

                                <label className="inline-flex items-start gap-2 self-end pb-2 text-sm md:col-span-2">
                                    <Checkbox
                                        checked={formState.aiCodexCli}
                                        onCheckedChange={(checked) => updateField('aiCodexCli', checked === true)}
                                        className="mt-0.5 data-[state=checked]:text-white"
                                    />
                                    <span className="space-y-0.5">
                                        <span className="block font-medium text-foreground">Codex CLI 兼容</span>
                                        <span className="block text-xs leading-relaxed text-muted-foreground">
                                            开启后应用 Codex CLI 实际支持的参数：不发送质量参数，多图生成会拆成多次单图请求。
                                        </span>
                                    </span>
                                </label>
                            </div>
                        </section>
                    </TabsContent>

                    <SheetFooter className="flex flex-row justify-end gap-2 border-t px-5 py-3.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onClose}
                            disabled={loading}
                        >
                            取消
                        </Button>
                        <Button
                            type="button"
                            variant="brand"
                            size="sm"
                            onClick={handleSave}
                            disabled={loading}
                        >
                            {loading ? '保存中...' : '保存'}
                        </Button>
                    </SheetFooter>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
