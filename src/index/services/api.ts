/**
 * API 服务层
 */

import { IDEAvailabilityMap, MainIDEPreference } from '../../common/ide';
import type { AgentVersionInfo, CLIAgent, LocalAppAgent, RuntimeAgentAvailability, WebAgent } from '../../common/agent';
import { PromptClientPreference } from '../types';
import type { ExcalidrawPropertyPanelMode, ExcalidrawPropertyPanelPosition } from '../utils/excalidrawUiMode';
import type {
    GenieExecutePromptRequest as PromptExecuteRequest,
    GenieExecutePromptResponse as PromptExecuteResponse,
} from '@/common/genie/types';
import { executeGeniePrompt } from '@/common/genie/execute';

interface ConfigResponse {
    projectPath?: string | null;
    projectId?: string | null;
    projectInfo?: {
        name?: string | null;
    };
    projectDefaults?: {
        defaultTheme?: string | null;
    };
    automation?: {
        defaultPromptClient?: PromptClientPreference;
        defaultIDE?: MainIDEPreference;
    };
    assistant?: {
        webBaseUrl?: string | null;
        apiBaseUrl?: string | null;
    };
    uiPreferences?: {
        excalidrawPropertyPanelMode?: ExcalidrawPropertyPanelMode;
        excalidrawPropertyPanelPosition?: ExcalidrawPropertyPanelPosition;
        excalidrawUiMode?: 'compact' | 'desktop';
    };
    ideAvailability?: IDEAvailabilityMap;
    agentAvailability?: RuntimeAgentAvailability;
}

interface ConfigAvailabilityResponse {
    ideAvailability?: IDEAvailabilityMap;
    agentAvailability?: RuntimeAgentAvailability;
}

export interface AgentVersionsResponse {
    agents: Partial<Record<CLIAgent, AgentVersionInfo>>;
}

interface SaveServerPreferencesRequest {
    automation?: {
        defaultPromptClient?: PromptClientPreference;
        defaultIDE?: MainIDEPreference;
    };
    assistant?: {
        webBaseUrl?: string | null;
        apiBaseUrl?: string | null;
    };
    uiPreferences?: {
        excalidrawPropertyPanelMode?: ExcalidrawPropertyPanelMode;
        excalidrawPropertyPanelPosition?: ExcalidrawPropertyPanelPosition;
    };
}

export type AssistantHealthStatus =
    | 'ready'
    | 'missing_cli'
    | 'cli_error'
    | 'runtime_unreachable'
    | 'needs_update';

export interface AssistantHealthInfo {
    status: AssistantHealthStatus;
    message: string;
    checkedAt: string;
    commandSource: 'axhub-genie' | 'cloudcli' | 'config' | 'env' | 'default';
    hints: {
        installGlobal: string;
        start: string;
        status: string;
    };
}

export interface AssistantRuntimeResponse {
    webBaseUrl: string;
    apiBaseUrl: string;
    projectPath: string;
    projectId?: string;
    projectRoot?: string;
    source: 'axhub-genie' | 'config' | 'cloudcli' | 'env' | 'default';
    health: AssistantHealthInfo;
}

interface GetAssistantRuntimeOptions {
    autoStart?: boolean;
    projectId?: string;
}

export type AssistantBootstrapMode = 'install_global' | 'start_existing';

interface AssistantBootstrapRequest {
    mode: AssistantBootstrapMode;
}

interface AssistantBootstrapResponse {
    success: boolean;
    mode: AssistantBootstrapMode;
    message: string;
    runtime: AssistantRuntimeResponse;
}

interface OpenIDERequest {
    ide: MainIDEPreference;
    projectId?: string;
    targetPath?: string;
}

interface OpenIDEResponse {
    success: boolean;
    ide: string;
    targetPath: string;
    command: string;
}

interface OpenCLIAgentRequest {
    agent: CLIAgent;
    projectId?: string;
    targetPath?: string;
}

interface OpenWebAgentRequest {
    agent: WebAgent;
    projectId?: string;
    targetPath?: string;
    corsOrigin?: string;
}

interface OpenLocalAppAgentRequest {
    agent: LocalAppAgent;
    projectId?: string;
    targetPath?: string;
}

interface OpenAgentResponse {
    success: boolean;
    agent: string;
    targetPath: string;
    command: string;
    serverUrl?: string;
    url?: string;
}

interface ReviewCodeOptions {
    enforceComponentExportName?: boolean;
    mode?: 'default' | 'axure-export';
}

export interface ReviewIssue {
    type: 'error' | 'warning';
    rule: string;
    message: string;
    suggestion?: string;
    blocking?: boolean;
    category?: 'export-structure' | 'axure-api' | 'docs' | 'tailwind' | 'recommendation';
}

export interface ReviewResult {
    file: string;
    passed: boolean;
    mode: 'default' | 'axure-export';
    summary: {
        blockingErrors: number;
        warnings: number;
    };
    issues: ReviewIssue[];
}

export type AxureApiListKey = 'eventList' | 'actionList' | 'varList' | 'configList' | 'dataList';

export interface AxureApiListPreview {
    sourceKey: string | null;
    raw: string | null;
    items: Array<Record<string, unknown>>;
    parseStatus: 'parsed' | 'raw' | 'missing';
    warnings: string[];
}

export interface AxureApiPreviewResponse {
    file: string;
    passedSourceCheck: boolean;
    hasAxureHandle: boolean;
    lists: Record<AxureApiListKey, AxureApiListPreview>;
}

export interface ExportMakeProbeResponse {
    ok: boolean;
    path: string;
    hasMakeAssets: boolean;
    lastExportedAt: string | null;
    fileName: string;
    hasCanvasFig: boolean;
    hasMetaJson: boolean;
    hasAiChat: boolean;
    hasThumbnail: boolean;
    hasManifest: boolean;
    hasImagesDir: boolean;
    imageCount: number;
    hasDriftRisk: boolean;
    driftReasons: string[];
}

export interface ExportMakePromptResponse {
    ok: boolean;
    path: string;
    hasMakeAssets: boolean;
    fileName: string;
    hasDriftRisk: boolean;
    driftReasons: string[];
    prompt: string;
}

export interface ExportIndexBundle {
    entry: {
        name: string;
        group: string;
        displayName: string;
        code: string;
        axureCode?: string;
        axureCodePath?: string;
    };
    meta: {
        version: number;
        exportedAt: string;
        source?: string;
    };
}

export type CloudPublishTarget = 'vercel' | 'cloudflare-pages' | 's3' | 'github-pages';

export interface CloudPublishingConfigPayload {
    vercel?: {
        token?: string;
        projectName?: string;
        teamId?: string;
    };
    cloudflarePages?: {
        apiToken?: string;
        accountId?: string;
        projectName?: string;
        productionBranch?: string;
    };
    s3?: {
        accessKeyId?: string;
        secretAccessKey?: string;
        region?: string;
        bucket?: string;
        prefix?: string;
        baseUrl?: string;
        endpoint?: string;
    };
    githubPages?: {
        repository?: string;
        branch?: string;
        sourceDirectory?: string;
    };
    publishSettings?: {
        includeSource?: boolean;
    };
}

type CloudPublishingConfigured<T extends object> = T & {
    configured: boolean;
    missingFields: string[];
};

export interface CloudPublishingConfigResponse {
    targets: {
        vercel: CloudPublishingConfigured<NonNullable<CloudPublishingConfigPayload['vercel']>>;
        cloudflarePages: CloudPublishingConfigured<NonNullable<CloudPublishingConfigPayload['cloudflarePages']>>;
        s3: CloudPublishingConfigured<NonNullable<CloudPublishingConfigPayload['s3']>>;
        githubPages: CloudPublishingConfigured<NonNullable<CloudPublishingConfigPayload['githubPages']>>;
        publishSettings: NonNullable<CloudPublishingConfigPayload['publishSettings']>;
    };
}

export interface CloudPublishRequest {
    target: CloudPublishTarget;
    path: string;
}

export interface CloudPublishResponse {
    url: string;
    target: CloudPublishTarget;
    deployedAt: string;
}

export interface CloudPublishLatestItem {
    url: string;
    target: CloudPublishTarget;
    deployedAt: string;
    path?: string;
}

export interface CloudPublishingLatestResponse {
    targets: {
        vercel: CloudPublishLatestItem | null;
        cloudflarePages: CloudPublishLatestItem | null;
        s3: CloudPublishLatestItem | null;
        githubPages: CloudPublishLatestItem | null;
    };
}

export interface CloudPublishingApiError extends Error {
    code?: string;
    target?: CloudPublishTarget;
    missingFields?: string[];
}

function createCloudPublishingApiError(result: any, fallback: string): CloudPublishingApiError {
    const error = new Error(result?.error || fallback) as CloudPublishingApiError;
    if (typeof result?.code === 'string') {
        error.code = result.code;
    }
    if (
        result?.target === 'vercel'
        || result?.target === 'cloudflare-pages'
        || result?.target === 's3'
        || result?.target === 'github-pages'
    ) {
        error.target = result.target;
    }
    if (Array.isArray(result?.missingFields)) {
        error.missingFields = result.missingFields.filter((field: unknown) => typeof field === 'string');
    }
    return error;
}

export const apiService = {
    /**
     * 删除组件或原型
     */
    async deleteItem(path: string) {
        const response = await fetch('/api/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path }),
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '删除失败');
        }

        return response.json();
    },

    /**
     * 获取 WebSocket 客户端列表
     */
    async getWsClients() {
        const res = await fetch('/api/ws/clients');
        if (res.ok) {
            const data = await res.json();
            return data.clients || [];
        }
        return [];
    },

    /**
     * 发送消息到 WebSocket
     */
    async sendWsMessage(message: any) {
        const res = await fetch('/api/ws/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || '发送失败');
        }

        return res.json();
    },

    /**
     * 获取代码内容
     */
    async fetchCode(jsUrl: string) {
        const response = await fetch(jsUrl);
        if (!response.ok) {
            throw new Error(`获取构建代码失败，请让 AI 修复: ${response.statusText}`);
        }
        return response.text();
    },

    /**
     * 获取 hack.css 内容
     */
    async fetchHackCss(activeTab: string, itemName: string) {
        const hackCssUrl = `${window.location.origin}/${activeTab}/${itemName}/hack.css`;
        try {
            const hackResp = await fetch(hackCssUrl);
            if (hackResp.ok) {
                return await hackResp.text();
            }
        } catch (e) {
            console.warn('fetch hack.css failed', e);
        }
        return '';
    },

    async fetchExportIndexBundle(path: string): Promise<ExportIndexBundle> {
        const response = await fetch(`/api/export-index-bundle?path=${encodeURIComponent(path)}`);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result?.error || '加载导出 bundle 失败');
        }
        return result;
    },

    async fetchAxureExportCode(path: string) {
        const response = await fetch(`/api/axure-export-code?path=${encodeURIComponent(path)}`);
        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result?.error || '加载 Axure 导出代码失败');
        }
        return response.text();
    },

    /**
     * 代码检查
     */
    async reviewCode(path: string, options: ReviewCodeOptions = {}): Promise<ReviewResult> {
        const response = await fetch('/api/code-review', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                path,
                enforceComponentExportName: options.enforceComponentExportName === true,
                mode: options.mode === 'axure-export' ? 'axure-export' : 'default',
            }),
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '代码检查失败');
        }

        return response.json();
    },

    async getAxureApiPreview(path: string): Promise<AxureApiPreviewResponse> {
        const response = await fetch('/api/axure-api-preview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path }),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result?.error || '加载 Axure API 预览失败');
        }

        return result;
    },

    async probeExportMake(targetPath: string): Promise<ExportMakeProbeResponse> {
        const response = await fetch(`/api/export-make?path=${encodeURIComponent(targetPath)}&probe=1`);
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result?.error || '加载 .fig 导出状态失败');
        }
        return result;
    },

    async getExportMakePrompt(targetPath: string): Promise<ExportMakePromptResponse> {
        const response = await fetch(`/api/export-make?path=${encodeURIComponent(targetPath)}&prompt=1`);
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result?.error || '加载 .fig 导出 Prompt 失败');
        }
        return result;
    },

    async getCloudPublishingConfig(): Promise<CloudPublishingConfigResponse> {
        const response = await fetch('/api/cloud-publishing/config');
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw createCloudPublishingApiError(result, '加载云服务发布配置失败');
        }
        return result;
    },

    async saveCloudPublishingConfig(payload: CloudPublishingConfigPayload) {
        const response = await fetch('/api/cloud-publishing/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw createCloudPublishingApiError(result, '保存云服务发布配置失败');
        }
        return result;
    },

    async getCloudPublishingLatest(): Promise<CloudPublishingLatestResponse> {
        const response = await fetch('/api/cloud-publishing/latest');
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw createCloudPublishingApiError(result, '加载最近发布地址失败');
        }
        return result;
    },

    async publishCloudTarget(payload: CloudPublishRequest): Promise<CloudPublishResponse> {
        const response = await fetch('/api/cloud-publishing/publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw createCloudPublishingApiError(result, '云服务发布失败');
        }
        return result;
    },

    async executePrompt(payload: PromptExecuteRequest): Promise<PromptExecuteResponse> {
        const mappedPayload: PromptExecuteRequest = {
            scene: payload.scene,
            client: payload.client,
            prompt: payload.prompt,
        };
        return executeGeniePrompt(mappedPayload);
    },

    async getConfig(): Promise<ConfigResponse> {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error('加载配置失败');
        }
        return response.json();
    },

    async getBootstrapConfig(): Promise<ConfigResponse> {
        const response = await fetch('/api/config/bootstrap');
        if (!response.ok) {
            throw new Error('加载配置失败');
        }
        return response.json();
    },

    async getConfigAvailability(): Promise<ConfigAvailabilityResponse> {
        const response = await fetch('/api/config/availability');
        if (!response.ok) {
            throw new Error('加载可用性失败');
        }
        return response.json();
    },

    async getAgentVersions(): Promise<AgentVersionsResponse> {
        const response = await fetch('/api/agent/versions', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('检测本地 AI 版本失败');
        }
        return response.json();
    },

    async saveServerPreferences(payload: SaveServerPreferencesRequest) {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result?.error || '保存偏好失败');
        }
        return result;
    },

    async getAssistantRuntime(options?: GetAssistantRuntimeOptions): Promise<AssistantRuntimeResponse> {
        const query = new URLSearchParams();
        if (options?.autoStart === false) {
            query.set('autoStart', 'false');
        }
        if (options?.projectId?.trim()) {
            query.set('projectId', options.projectId.trim());
        }
        const suffix = query.toString();
        const response = await fetch(`/api/assistant/runtime${suffix ? `?${suffix}` : ''}`);
        if (!response.ok) {
            throw new Error('加载助手运行时配置失败');
        }
        return response.json();
    },

    async bootstrapAssistant(payload: AssistantBootstrapRequest): Promise<AssistantBootstrapResponse> {
        const response = await fetch('/api/assistant/bootstrap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result?.error || '启动 AI 助手失败');
        }

        return result;
    },

    async openIDE(payload: OpenIDERequest): Promise<OpenIDEResponse> {
        let response: Response;
        try {
            response = await fetch('/api/ide/open', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
        } catch (error: any) {
            throw new Error(error?.message || '打开 IDE 失败');
        }

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result?.error || response.statusText || '打开 IDE 失败');
        }

        return result;
    },

    async openCLIAgent(payload: OpenCLIAgentRequest): Promise<OpenAgentResponse> {
        const response = await fetch('/api/agent/cli/open', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result?.error || '打开 CLI Agent 失败');
        }

        return result;
    },

    async openWebAgent(payload: OpenWebAgentRequest): Promise<OpenAgentResponse> {
        const response = await fetch('/api/agent/web/open', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result?.error || '打开 Web Agent 失败');
        }

        return result;
    },

    async openLocalAppAgent(payload: OpenLocalAppAgentRequest): Promise<OpenAgentResponse> {
        const response = await fetch('/api/agent/local-app/open', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result?.error || '打开本地应用失败');
        }

        return result;
    },
};
