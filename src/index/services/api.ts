/**
 * API 服务层
 */

import { IDEAvailabilityMap, MainIDEPreference } from '../../common/ide';
import type { AgentVersionInfo, CLIAgent, LocalAppAgent, RuntimeAgentAvailability, WebAgent } from '../../common/agent';
import type { AcpProviderKey } from '../../common/acpModelConfig';
import { formatLocalAppOpenFailureMessage } from '../../common/localAppOpenMessage';
import { PromptClientPreference } from '../types';
import type { ExcalidrawPropertyPanelMode, ExcalidrawPropertyPanelPosition } from '../utils/excalidrawUiMode';
import type { AssistantImageGenerationConfig } from '../domains/assistant/assistantAcpContext';

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
        annotationPromptClient?: PromptClientPreference;
        annotationModel?: string | null;
        agentRunConcurrency?: number;
    };
    assistant?: {
        webBaseUrl?: string | null;
        apiBaseUrl?: string | null;
    };
    ai?: {
        imageGeneration?: AssistantImageGenerationConfig | null;
    };
    uiPreferences?: {
        excalidrawPropertyPanelMode?: ExcalidrawPropertyPanelMode;
        excalidrawPropertyPanelPosition?: ExcalidrawPropertyPanelPosition;
        excalidrawUiMode?: 'compact' | 'desktop';
    };
    ideAvailability?: IDEAvailabilityMap;
    agentAvailability?: RuntimeAgentAvailability;
}

export interface AgentVersionsResponse {
    agents: Partial<Record<AcpProviderKey | CLIAgent, AgentVersionInfo>>;
    latestAgents?: Partial<Record<AcpProviderKey | CLIAgent, AgentVersionInfo>>;
}

export interface GetAgentVersionsOptions {
    agent?: AcpProviderKey;
}

export interface MakeClientUpdateBlockedReason {
    code: string;
    message: string;
}

export interface MakeClientUpdateBackupRecord {
    backupRoot: string;
    backupZipPath: string;
    manifestPath: string;
    currentVersion: string;
    targetVersion: string;
    createdAt: string;
    completedAt: string;
    plannedFilesCount: number;
    writtenFilesCount: number;
    restoreAvailable: boolean;
    zipAvailable: boolean;
}

export interface MakeClientUpdateStatus {
    projectId: string;
    projectRoot: string;
    currentVersion: string;
    targetVersion: string;
    releaseNotes?: string;
    metadataSource: 'online' | 'bundled';
    metadataError?: string;
    updateAvailable: boolean;
    canApply: boolean;
    backupPolicy: 'zip-before-overwrite';
    lastBackup: MakeClientUpdateBackupRecord | null;
    template: {
        version: string;
        sources: Array<{
            id: string;
            url: string;
            markerRepository: string;
            templateVersion?: string;
        }>;
    };
    blockedReasons: MakeClientUpdateBlockedReason[];
}

export interface MakeClientUpdatePostUpdateWarning {
    error: string;
    code: string;
    phase?: string;
    details?: Record<string, unknown>;
}

export interface MakeClientUpdateApplyResult {
    success: true;
    projectId: string;
    projectRoot: string;
    currentVersion: string;
    targetVersion: string;
    backupRoot: string;
    backupZipPath: string;
    manifestPath: string;
    backupRecord: MakeClientUpdateBackupRecord;
    plannedFiles: string[];
    writtenFiles: string[];
    templateUrl: string;
    installMethod: 'npm' | 'pnpm' | 'skipped';
    metadataSynced: boolean;
    postUpdateWarning?: MakeClientUpdatePostUpdateWarning;
}

export type GitWorkspacePromptScene =
    | 'create-remote'
    | 'auth-failed'
    | 'branch-management'
    | 'merge-required'
    | 'conflict-required'
    | 'push-rejected';

export interface GitWorkspaceRemoteConfig {
    url?: string;
    defaultBranch?: string;
}

export interface GitWorkspaceChangeItem {
    id: string;
    name: string;
    fileCount: number;
}

export interface GitWorkspaceChangeGroup {
    key: 'prototypes' | 'resources' | 'themes' | 'skills' | 'rules' | 'other';
    label: string;
    fileCount: number;
    items: GitWorkspaceChangeItem[];
}

export interface GitWorkspaceStatusResponse {
    available: boolean;
    gitAvailable?: boolean;
    isGitRepo?: boolean;
    hasCommits?: boolean;
    code?: string;
    errorCode?: string;
    message?: string;
    projectId?: string;
    projectRoot?: string;
    currentBranch?: string;
    currentCommit?: {
        hash: string;
        shortHash: string;
        message: string;
        author: string;
        email: string;
        timestamp: number;
        date: string;
    } | null;
    isHistoricalVersion?: boolean;
    hasChanges?: boolean;
    changedFilesCount?: number;
    changeSummary: {
        totalFiles: number;
        groups: GitWorkspaceChangeGroup[];
    };
    remote?: GitWorkspaceRemoteConfig;
    branchOverview?: {
        localBranches: string[];
        remoteBranches: string[];
    };
    remoteComparison?: {
        available: boolean;
        branch?: string;
        targetRef?: string;
        reason?: string;
        incoming: {
            totalFiles: number;
            groups: GitWorkspaceChangeGroup[];
        };
        outgoing: {
            totalFiles: number;
            groups: GitWorkspaceChangeGroup[];
        };
    };
}

export interface GitWorkspaceActionResponse {
    success: boolean;
    projectId?: string;
    currentBranch?: string;
    remote?: GitWorkspaceRemoteConfig;
    prompt?: string;
    promptScene?: GitWorkspacePromptScene;
    message?: string;
    code?: string;
    error?: string;
    branchOverview?: {
        localBranches: string[];
        remoteBranches: string[];
    };
}

interface SetGitWorkspaceRemoteRequest {
    url: string;
    defaultBranch?: string;
}

interface CreateGitWorkspaceRemoteRepositoryRequest {
    url?: string;
    repositoryName?: string;
    visibility?: 'private' | 'public';
}

interface GetGitWorkspacePromptRequest {
    scene: GitWorkspacePromptScene;
    reason?: string;
}

interface SaveServerPreferencesRequest {
    automation?: {
        defaultPromptClient?: PromptClientPreference;
        defaultIDE?: MainIDEPreference;
        annotationPromptClient?: PromptClientPreference;
        annotationModel?: string | null;
        agentRunConcurrency?: number;
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

export interface LanAccessStatusResponse {
    passwordSet: boolean;
    sessionTtlMs: number;
    shareTokenTtlMs: number;
}

export interface LanAccessShareUrlResponse {
    success: boolean;
    token: string;
    url: string;
    expiresAt: string;
    ttlMs: number;
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
    commandSource: 'acp-ui' | 'config' | 'env' | 'default';
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
    source: 'config' | 'env' | 'default';
    health: AssistantHealthInfo;
}

interface GetAssistantRuntimeOptions {
    autoStart?: boolean;
    projectId?: string;
}

interface GetConfigOptions {
    projectId?: string | null;
}

export type AssistantBootstrapMode = 'install_global' | 'start_existing' | 'restart_existing';

interface AssistantBootstrapRequest {
    mode: AssistantBootstrapMode;
    projectId?: string;
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
    url?: string;
    openInBrowser?: boolean;
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
    openInBrowser?: boolean;
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

export interface ReviewReportSummary {
    id: string;
    title: string;
    reviewer: string;
    createdAt: string;
    score?: number;
    source?: string;
    path: string;
}

export interface ReviewReportDetail extends ReviewReportSummary {
    markdown: string;
}

export interface ReviewReportListResponse {
    projectId: string;
    prototypeId: string;
    reports: ReviewReportSummary[];
}

export interface ReviewReportDetailResponse {
    projectId: string;
    prototypeId: string;
    report: ReviewReportDetail;
}

export interface ReviewReportExistsResponse {
    projectId: string;
    prototypeId: string;
    reportId: string;
    exists: boolean;
}

export interface ReviewReportDeleteResponse {
    projectId: string;
    prototypeId: string;
    reportId: string;
    deleted: boolean;
}

export interface ReviewReportSubmitPayload {
    projectId?: string;
    prototypeId: string;
    title?: string;
    reviewer?: string;
    score?: number;
    content: string;
    source?: string;
}

export interface ReviewReportUploadResult {
    projectId: string;
    prototypeId: string;
    report: ReviewReportDetail;
}

export interface ReviewReportSubmitResult {
    projectId: string;
    prototypeId: string;
    report: ReviewReportSummary;
}

export interface ReviewLanSubmitConfig {
    projectId: string;
    prototypeId: string;
    lanSubmitEnabled: boolean;
    projectLanAllowed: boolean;
    submitUrl: string;
}

export interface ReviewReportScopeOptions {
    projectId?: string;
    prototypeId: string;
}

export interface ReviewReportDetailOptions extends ReviewReportScopeOptions {
    reportId: string;
}

export interface ReviewReportUploadOptions extends ReviewReportScopeOptions {
    files: File[];
    title?: string;
    reviewer?: string;
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

export type CloudPublishTarget = 'vercel' | 'cloudflare-pages' | 's3' | 'github-pages' | 'axhub';

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
        pathPrefix?: string;
    };
    publishSettings?: {
        includeSource?: boolean;
        visibleTargets?: CloudPublishTarget[];
    };
}

type CloudPublishingConfigured<T extends object> = T & {
    configured: boolean;
    missingFields: string[];
};

type CloudPublishingVercelConfigResponse = Omit<NonNullable<CloudPublishingConfigPayload['vercel']>, 'token'> & {
    tokenConfigured: boolean;
    configured: boolean;
    missingFields: string[];
};

type CloudPublishingCloudflarePagesConfigResponse = Omit<NonNullable<CloudPublishingConfigPayload['cloudflarePages']>, 'apiToken'> & {
    apiTokenConfigured: boolean;
    configured: boolean;
    missingFields: string[];
};

type CloudPublishingS3ConfigResponse = Omit<NonNullable<CloudPublishingConfigPayload['s3']>, 'secretAccessKey'> & {
    accessKeyIdConfigured: boolean;
    secretAccessKeyConfigured: boolean;
    configured: boolean;
    missingFields: string[];
};

export interface CloudPublishingConfigResponse {
    targets: {
        vercel: CloudPublishingVercelConfigResponse;
        cloudflarePages: CloudPublishingCloudflarePagesConfigResponse;
        s3: CloudPublishingS3ConfigResponse;
        githubPages: CloudPublishingConfigured<NonNullable<CloudPublishingConfigPayload['githubPages']>>;
        axhub: CloudPublishingConfigured<Record<string, never>>;
        publishSettings: NonNullable<CloudPublishingConfigPayload['publishSettings']>;
    };
}

export interface CloudPublishRequest {
    target: CloudPublishTarget;
    path: string;
    axhubProjectId?: number;
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
        axhub: CloudPublishLatestItem | null;
    };
}

export interface AxhubUserInfo {
    uid?: number;
    userName?: string;
    name?: string;
    role?: string;
    avatar?: string;
    vipType?: number;
    expirationTime?: string | null;
    isPlus: boolean;
    diskSpace?: number;
    svnUsedSpace?: number;
    htmlUsedSpace?: number;
    freeDiskSpace?: number;
    scopes?: string[];
    serverUrl?: string;
    tokenPrefix?: string;
}

export interface AxhubHtmlProject {
    pid: number;
    name: string;
    path: string;
    software: number;
    shareMode?: number;
    createTime?: string;
    updateTime?: string;
    generateTime?: string;
    generateStatus?: number;
    htmlUsedSpace?: number;
}

export interface AxhubStatusResponse {
    connected: boolean;
    hasPendingSession: boolean;
    provider?: 'online' | 'enterprise';
    onlineBaseUrl: string;
    serverUrl?: string;
    tokenPrefix?: string;
    name?: string;
    role?: string;
    scopes?: string[];
    me?: AxhubUserInfo;
}

export interface AxhubConnectResponse {
    authorizeUrl: string;
    state: string;
}

export interface AxhubEnterpriseConnectRequest {
    serverUrl: string;
    token: string;
}

export interface AxhubEnterpriseConnectResponse extends AxhubStatusResponse {
    provider: 'enterprise';
    serverUrl: string;
    tokenPrefix: string;
    me: AxhubUserInfo;
}

export interface AxhubHtmlProjectsResponse {
    projects: AxhubHtmlProject[];
}

export interface AxhubHtmlProjectResponse {
    project: AxhubHtmlProject;
}

export interface AxhubPublishResponse {
    url: string;
    path: string;
    project: {
        pid: number;
        name: string;
        path: string;
        url: string;
        htmlUsedSpace: number;
        generateTime: string;
    };
}

export interface CreatePlaceholderPrototypeResponse {
    success: boolean;
    projectId?: string;
    name: string;
    displayName?: string;
    path?: string;
    filePath?: string;
    absoluteFilePath?: string;
    canvasFilePath?: string;
    absoluteCanvasFilePath?: string;
    clientUrl?: string;
    placeholder?: boolean;
    placeholderGuide?: unknown;
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
        || result?.target === 'axhub'
    ) {
        error.target = result.target;
    }
    if (Array.isArray(result?.missingFields)) {
        error.missingFields = result.missingFields.filter((field: unknown) => typeof field === 'string');
    }
    return error;
}

function isLikelyHtmlFallback(text: string): boolean {
    const trimmed = text.trimStart().slice(0, 512).toLowerCase();
    return trimmed.startsWith('<!doctype html')
        || trimmed.startsWith('<html')
        || trimmed.includes('<script type="module" src="/@vite/client"')
        || trimmed.includes('injectintoglobalhook');
}

function buildProjectScopedUrl(path: string, options?: GetConfigOptions): string {
    const projectId = options?.projectId?.trim();
    if (!projectId) {
        return path;
    }

    const query = new URLSearchParams();
    query.set('projectId', projectId);
    return `${path}?${query.toString()}`;
}

function normalizeMakeApiOrigin(value: unknown): string {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim().replace(/\/+$/u, '');
    if (!trimmed) return '';
    try {
        const url = new URL(trimmed);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : '';
    } catch {
        return '';
    }
}

function buildMakeApiUrl(path: string): string {
    const globals = typeof window === 'undefined'
        ? null
        : window as unknown as { __AXHUB_MAKE_API_ORIGIN__?: unknown };
    const makeApiOrigin = normalizeMakeApiOrigin(globals?.__AXHUB_MAKE_API_ORIGIN__);
    if (!makeApiOrigin) {
        return path;
    }
    return `${makeApiOrigin}${path.startsWith('/') ? path : `/${path}`}`;
}

async function readApiJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error((result as any)?.error || fallbackMessage) as Error & Record<string, unknown>;
        Object.assign(error, result);
        throw error;
    }
    return result as T;
}

export const apiService = {
    async createPlaceholderPrototype(options?: GetConfigOptions): Promise<CreatePlaceholderPrototypeResponse> {
        const response = await fetch(buildProjectScopedUrl('/api/prototypes/create-placeholder', options), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result?.error || '创建原型失败');
        }
        return result;
    },

    async startPlaceholderPrototypeGeneration(prototypeName: string) {
        const encodedPrototypeName = encodeURIComponent(prototypeName);
        const response = await fetch(`/api/prototypes/${encodedPrototypeName}/start-generation`, {
            method: 'POST',
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result?.error || '进入原型等待生成态失败');
        }
        return result;
    },

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
                const contentType = hackResp.headers.get('content-type') || '';
                const text = await hackResp.text();
                if (!text.trim()) {
                    return '';
                }
                if (/text\/html|application\/xhtml\+xml/i.test(contentType) || isLikelyHtmlFallback(text)) {
                    return '';
                }
                return text;
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

    async listReviewReports(options: ReviewReportScopeOptions): Promise<ReviewReportListResponse> {
        const query = new URLSearchParams();
        if (options.projectId?.trim()) {
            query.set('projectId', options.projectId.trim());
        }
        query.set('prototypeId', options.prototypeId);
        const response = await fetch(buildMakeApiUrl(`/api/review-reports?${query.toString()}`), { cache: 'no-store' });
        return readApiJsonResponse<ReviewReportListResponse>(response, '加载评审报告失败');
    },

    async getReviewReport(options: ReviewReportDetailOptions): Promise<ReviewReportDetailResponse> {
        const query = new URLSearchParams();
        if (options.projectId?.trim()) {
            query.set('projectId', options.projectId.trim());
        }
        query.set('prototypeId', options.prototypeId);
        const response = await fetch(buildMakeApiUrl(`/api/review-reports/${encodeURIComponent(options.reportId)}?${query.toString()}`), { cache: 'no-store' });
        return readApiJsonResponse<ReviewReportDetailResponse>(response, '加载评审报告详情失败');
    },

    async checkReviewReportExists(options: ReviewReportDetailOptions): Promise<ReviewReportExistsResponse> {
        const query = new URLSearchParams();
        if (options.projectId?.trim()) {
            query.set('projectId', options.projectId.trim());
        }
        query.set('prototypeId', options.prototypeId);
        query.set('reportId', options.reportId);
        const response = await fetch(buildMakeApiUrl(`/api/review-reports/exists?${query.toString()}`), { cache: 'no-store' });
        return readApiJsonResponse<ReviewReportExistsResponse>(response, '验证评审报告失败');
    },

    async deleteReviewReport(options: ReviewReportDetailOptions): Promise<ReviewReportDeleteResponse> {
        const response = await fetch(buildMakeApiUrl(`/api/review-reports/${encodeURIComponent(options.reportId)}`), {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: options.projectId,
                prototypeId: options.prototypeId,
            }),
        });
        return readApiJsonResponse<ReviewReportDeleteResponse>(response, '删除评审报告失败');
    },

    async uploadReviewReport(options: ReviewReportUploadOptions): Promise<ReviewReportUploadResult> {
        const formData = new FormData();
        if (options.projectId?.trim()) {
            formData.set('projectId', options.projectId.trim());
        }
        formData.set('prototypeId', options.prototypeId);
        if (options.title?.trim()) {
            formData.set('title', options.title.trim());
        }
        if (options.reviewer?.trim()) {
            formData.set('reviewer', options.reviewer.trim());
        }
        for (const file of options.files) {
            formData.append('file', file);
        }
        const response = await fetch(buildMakeApiUrl('/api/review-reports/upload'), {
            method: 'POST',
            body: formData,
        });
        return readApiJsonResponse<ReviewReportUploadResult>(response, '上传评审报告失败');
    },

    async submitReviewReport(payload: ReviewReportSubmitPayload): Promise<ReviewReportSubmitResult> {
        const response = await fetch(buildMakeApiUrl('/api/review-reports/submit'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return readApiJsonResponse<ReviewReportSubmitResult>(response, '提交评审报告失败');
    },

    async getReviewLanSubmitConfig(projectId?: string, prototypeId?: string): Promise<ReviewLanSubmitConfig> {
        const query = new URLSearchParams();
        if (projectId?.trim()) {
            query.set('projectId', projectId.trim());
        }
        if (prototypeId?.trim()) {
            query.set('prototypeId', prototypeId.trim());
        }
        const response = await fetch(buildMakeApiUrl(`/api/review-reports/lan-submit-config${query.toString() ? `?${query.toString()}` : ''}`), { cache: 'no-store' });
        return readApiJsonResponse<ReviewLanSubmitConfig>(response, '加载局域网提交配置失败');
    },

    async updateReviewLanSubmitConfig(payload: { projectId?: string; prototypeId: string; lanSubmitEnabled: boolean }): Promise<ReviewLanSubmitConfig> {
        const response = await fetch(buildMakeApiUrl('/api/review-reports/lan-submit-config'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return readApiJsonResponse<ReviewLanSubmitConfig>(response, '更新局域网提交配置失败');
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

    async saveCloudPublishingConfig(payload: CloudPublishingConfigPayload): Promise<CloudPublishingConfigResponse> {
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

    async getCloudPublishingLatest(path?: string): Promise<CloudPublishingLatestResponse> {
        const latestQuery = path && path.trim();
        const response = await fetch(`/api/cloud-publishing/latest${latestQuery ? `?path=${encodeURIComponent(latestQuery)}` : ''}`);
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

    async getAxhubStatus(): Promise<AxhubStatusResponse> {
        const response = await fetch('/api/axhub/status');
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result?.error || '读取 Axhub 授权状态失败');
        }
        return result;
    },

    async connectAxhub(): Promise<AxhubConnectResponse> {
        const response = await fetch('/api/axhub/connect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result?.error || '创建 Axhub 授权链接失败');
        }
        return result;
    },

    async connectAxhubEnterprise(payload: AxhubEnterpriseConnectRequest): Promise<AxhubEnterpriseConnectResponse> {
        const response = await fetch('/api/axhub/connect-enterprise', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result?.error || '连接企业版失败');
        }
        return result;
    },

    async disconnectAxhub(): Promise<{ success: boolean }> {
        const response = await fetch('/api/axhub/disconnect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result?.error || '断开 Axhub 授权失败');
        }
        return result;
    },

    async getAxhubHtmlProjects(keyword?: string): Promise<AxhubHtmlProjectsResponse> {
        const query = keyword?.trim() ? `?keyword=${encodeURIComponent(keyword.trim())}` : '';
        const response = await fetch(`/api/axhub/html-projects${query}`);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result?.error || '加载 Axhub HTML 项目失败');
        }
        return result;
    },

    async createAxhubHtmlProject(name: string): Promise<AxhubHtmlProjectResponse> {
        const response = await fetch('/api/axhub/html-projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result?.error || '创建 Axhub HTML 项目失败');
        }
        return result;
    },

    async publishAxhubHtmlProject(payload: { pid: number; path: string; projectId?: string | null }): Promise<AxhubPublishResponse> {
        const response = await fetch('/api/axhub/publish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result?.error || '发布到 Axhub 失败');
        }
        return result;
    },

    async getConfig(options?: GetConfigOptions): Promise<ConfigResponse> {
        const response = await fetch(buildProjectScopedUrl('/api/config', options));
        if (!response.ok) {
            throw new Error('加载配置失败');
        }
        return response.json();
    },

    async getLanAccessStatus(): Promise<LanAccessStatusResponse> {
        const response = await fetch('/api/access/status', { cache: 'no-store' });
        return readApiJsonResponse<LanAccessStatusResponse>(response, '加载局域网访问状态失败');
    },

    async setLanAccessPassword(password: string): Promise<LanAccessStatusResponse & { success: boolean }> {
        const response = await fetch('/api/access/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        return readApiJsonResponse<LanAccessStatusResponse & { success: boolean }>(response, '设置局域网访问密码失败');
    },

    async clearLanAccessPassword(): Promise<LanAccessStatusResponse & { success: boolean }> {
        const response = await fetch('/api/access/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: null }),
        });
        return readApiJsonResponse<LanAccessStatusResponse & { success: boolean }>(response, '清除局域网访问密码失败');
    },

    async createLanAccessShareUrl(targetUrl: string): Promise<LanAccessShareUrlResponse> {
        const response = await fetch('/api/access/share-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUrl }),
        });
        return readApiJsonResponse<LanAccessShareUrlResponse>(response, '生成局域网短期链接失败');
    },

    async getBootstrapConfig(options?: GetConfigOptions): Promise<ConfigResponse> {
        const response = await fetch(buildProjectScopedUrl('/api/config/bootstrap', options));
        if (!response.ok) {
            throw new Error('加载配置失败');
        }
        return response.json();
    },

    async getAgentVersions(options?: GetAgentVersionsOptions): Promise<AgentVersionsResponse> {
        const query = options?.agent ? `?agent=${encodeURIComponent(options.agent)}` : '';
        const response = await fetch(`/api/agent/versions${query}`, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('检测本地 AI 版本失败');
        }
        return response.json();
    },

    async getMakeClientUpdateStatus(projectId: string): Promise<MakeClientUpdateStatus> {
        const encodedProjectId = encodeURIComponent(projectId);
        const response = await fetch(`/api/projects/${encodedProjectId}/make-client/update/status`, { cache: 'no-store' });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result?.error || '检测项目更新失败');
        }
        return result;
    },

    async applyMakeClientUpdate(projectId: string): Promise<MakeClientUpdateApplyResult> {
        const encodedProjectId = encodeURIComponent(projectId);
        const response = await fetch(`/api/projects/${encodedProjectId}/make-client/update/apply`, {
            method: 'POST',
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(result?.error || '项目更新失败') as Error & Record<string, unknown>;
            Object.assign(error, result);
            throw error;
        }
        return result;
    },

    async getGitWorkspaceStatus(options: { gitVersion?: string; path?: string } = {}): Promise<GitWorkspaceStatusResponse> {
        const query = new URLSearchParams();
        if (options.gitVersion) query.set('gitVersion', options.gitVersion);
        if (options.path) query.set('path', options.path);
        const url = query.toString() ? `/api/git/workspace/status?${query.toString()}` : '/api/git/workspace/status';
        const response = await fetch(url, { cache: 'no-store' });
        return readApiJsonResponse<GitWorkspaceStatusResponse>(response, '加载版本状态失败');
    },

    async initGitWorkspace(): Promise<GitWorkspaceActionResponse> {
        const response = await fetch('/api/git/workspace/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        return readApiJsonResponse<GitWorkspaceActionResponse>(response, '初始化本地仓库失败');
    },

    async commitGitWorkspace(message: string, options: { path?: string } = {}): Promise<GitWorkspaceActionResponse> {
        const response = await fetch('/api/git/workspace/commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, ...(options.path ? { path: options.path } : {}) }),
        });
        return readApiJsonResponse<GitWorkspaceActionResponse>(response, '提交版本失败');
    },

    async switchGitWorkspaceBranch(branch: string): Promise<GitWorkspaceActionResponse> {
        const response = await fetch('/api/git/workspace/branch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ branch }),
        });
        return readApiJsonResponse<GitWorkspaceActionResponse>(response, '切换分支失败');
    },

    async setGitWorkspaceRemote(payload: SetGitWorkspaceRemoteRequest): Promise<GitWorkspaceActionResponse> {
        const response = await fetch('/api/git/workspace/remote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return readApiJsonResponse<GitWorkspaceActionResponse>(response, '连接在线仓库失败');
    },

    async fetchGitWorkspace(): Promise<GitWorkspaceActionResponse> {
        const response = await fetch('/api/git/workspace/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        return readApiJsonResponse<GitWorkspaceActionResponse>(response, '刷新在线仓库状态失败');
    },

    async syncDownGitWorkspace(): Promise<GitWorkspaceActionResponse> {
        const response = await fetch('/api/git/workspace/sync-down', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        return readApiJsonResponse<GitWorkspaceActionResponse>(response, '同步下来失败');
    },

    async pushGitWorkspace(): Promise<GitWorkspaceActionResponse> {
        const response = await fetch('/api/git/workspace/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        return readApiJsonResponse<GitWorkspaceActionResponse>(response, '同步到在线失败');
    },

    async createGitWorkspaceRemoteRepository(payload: CreateGitWorkspaceRemoteRepositoryRequest): Promise<GitWorkspaceActionResponse> {
        const response = await fetch('/api/git/workspace/create-remote-repository', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return readApiJsonResponse<GitWorkspaceActionResponse>(response, '创建在线仓库失败');
    },

    async getGitWorkspacePrompt(payload: GetGitWorkspacePromptRequest): Promise<GitWorkspaceActionResponse> {
        const response = await fetch('/api/git/workspace/prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return readApiJsonResponse<GitWorkspaceActionResponse>(response, '生成 AI 提示词失败');
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
        if (options?.autoStart !== undefined) {
            query.set('autoStart', options.autoStart ? 'true' : 'false');
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
            throw new Error(result?.error || formatLocalAppOpenFailureMessage());
        }

        return result;
    },
};
