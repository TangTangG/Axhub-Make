import { ItemData, ViewMode } from '../types';

export interface EditorIntegrationLaunchOptions {
    enabled?: boolean;
    apiBaseUrl?: string;
    channel?: string;
    clientId?: string;
    sessionId?: string;
    pageUrl?: string;
}

export interface GenieBridgeLaunchOptions {
    apiBaseUrl?: string;
    projectPath?: string;
    integrationChannel?: string;
    targetClientId?: string;
    provider?: string;
}

export interface BuildEditorUrlOptions {
    width?: number;
    mobileMode?: boolean;
    hostToolbar?: boolean;
    integrationWs?: EditorIntegrationLaunchOptions;
    genieBridge?: GenieBridgeLaunchOptions;
}

const STALE_GENIE_BRIDGE_QUERY_PARAMS = [
    'genieApiBaseUrl',
    'apiBaseUrl',
    'genieIntegrationChannel',
    'integrationChannel',
    'genieTargetClientId',
    'integrationClientId',
    'cwd',
    'workdir',
    'provider',
    'tool',
    'targetPath',
    'context',
    'editorIntegrationWs',
    'editorApiBaseUrl',
    'editorIntegrationChannel',
    'editorClientId',
    'editorSessionId',
    'editorPageUrl',
    'editorMobileMode',
    'mobileMode',
    'genieToolbar',
    'inspecta',
] as const;

function clearStaleGenieBridgeQueryParams(url: URL) {
    for (const key of STALE_GENIE_BRIDGE_QUERY_PARAMS) {
        url.searchParams.delete(key);
    }
}

function normalizeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function setOptionalSearchParam(url: URL, key: string, value: unknown) {
    const normalized = normalizeString(value);
    if (normalized) {
        url.searchParams.set(key, normalized);
    } else {
        url.searchParams.delete(key);
    }
}

export function appendEditorLaunchOptionsToUrl(
    inputUrl: URL,
    options?: BuildEditorUrlOptions,
): URL {
    const url = inputUrl;
    clearStaleGenieBridgeQueryParams(url);

    const genieBridge = options?.genieBridge;
    if (genieBridge) {
        setOptionalSearchParam(url, 'genieApiBaseUrl', genieBridge.apiBaseUrl);
        setOptionalSearchParam(url, 'genieIntegrationChannel', genieBridge.integrationChannel);
        setOptionalSearchParam(url, 'genieTargetClientId', genieBridge.targetClientId);
        setOptionalSearchParam(url, 'cwd', genieBridge.projectPath);
        setOptionalSearchParam(url, 'provider', genieBridge.provider);
    }

    const integrationWs = options?.integrationWs;
    if (integrationWs) {
        if (typeof integrationWs.enabled === 'boolean') {
            url.searchParams.set('editorIntegrationWs', integrationWs.enabled ? '1' : '0');
        } else if (
            normalizeString(integrationWs.apiBaseUrl)
            || normalizeString(integrationWs.channel)
            || normalizeString(integrationWs.clientId)
        ) {
            url.searchParams.set('editorIntegrationWs', '1');
        }
        setOptionalSearchParam(url, 'editorApiBaseUrl', integrationWs.apiBaseUrl);
        setOptionalSearchParam(url, 'editorIntegrationChannel', integrationWs.channel);
        setOptionalSearchParam(url, 'editorClientId', integrationWs.clientId);
        setOptionalSearchParam(url, 'editorSessionId', integrationWs.sessionId);
        setOptionalSearchParam(url, 'editorPageUrl', integrationWs.pageUrl);
    }

    if (typeof options?.mobileMode === 'boolean') {
        url.searchParams.set('editorMobileMode', options.mobileMode ? 'true' : 'false');
    }

    if (options?.hostToolbar) {
        url.searchParams.set('genieToolbar', 'host');
    }

    return url;
}

function isLocalOnlyHostname(value: unknown): boolean {
    const hostname = normalizeString(value).toLowerCase();
    return hostname === 'localhost'
        || hostname === '0.0.0.0'
        || hostname === '::1'
        || hostname === '[::1]'
        || /^127(?:\.\d{1,3}){3}$/u.test(hostname);
}

function getLANHostname(): string {
    const injectedHost = normalizeString((window as any).__LOCAL_IP__);
    if (injectedHost && !isLocalOnlyHostname(injectedHost)) {
        return injectedHost;
    }
    const currentHost = normalizeString(window.location?.hostname);
    if (currentHost && !isLocalOnlyHostname(currentHost)) {
        return currentHost;
    }
    return injectedHost || currentHost || 'localhost';
}

function rewriteLocalOnlyUrlToLAN(url: URL): URL {
    if (!isLocalOnlyHostname(url.hostname)) {
        return url;
    }
    const lanHostname = getLANHostname();
    if (!lanHostname || isLocalOnlyHostname(lanHostname)) {
        return url;
    }
    const nextUrl = new URL(url.toString());
    nextUrl.hostname = lanHostname;
    return nextUrl;
}

export function buildItemUrl(
    selectedItem: ItemData | null,
    viewMode: ViewMode,
): URL | null {
    if (!selectedItem) return null;
    const baseUrl = viewMode === 'canvas'
        ? `/canvas/prototypes/${encodeURIComponent(selectedItem.name)}/canvas.excalidraw`
        : viewMode === 'demo'
            ? (selectedItem.clientUrl || selectedItem.previewUrl)
            : selectedItem.specUrl;
    if (!baseUrl) return null;
    return new URL(baseUrl, window.location.origin);
}

export function buildLANItemUrl(
    selectedItem: ItemData | null,
    viewMode: ViewMode,
): string {
    const url = buildItemUrl(selectedItem, viewMode);
    if (!url) return '';
    return rewriteLocalOnlyUrlToLAN(url).toString();
}

/**
 * URL 相关工具函数
 */

/**
 * 获取局域网 URL
 */
export function getLocalUrl(
    selectedItem: ItemData | null,
    viewMode: ViewMode,
): string {
    return buildLANItemUrl(selectedItem, viewMode);
}

export function buildEditorUrl(
    selectedItem: ItemData | null,
    viewMode: ViewMode,
    options?: BuildEditorUrlOptions
): string {
    const url = buildItemUrl(selectedItem, viewMode);
    if (!url) return '';
    const displayName = String(selectedItem?.displayName || '').trim();

    if (displayName) {
        url.searchParams.set('axhubDisplayName', displayName);
    } else {
        url.searchParams.delete('axhubDisplayName');
    }

    appendEditorLaunchOptionsToUrl(url, options);
    url.searchParams.delete('editor');
    url.searchParams.delete('specEdit');
    if (options?.width && Number.isFinite(options.width)) {
        url.searchParams.set('width', String(Math.round(options.width)));
    } else {
        url.searchParams.delete('width');
    }
    return url.toString();
}

/**
 * 获取组件源路径
 */
export function getItemSourcePath(item: ItemData, activeTab: string): string {
    void activeTab;
    const anyItem = item as ItemData & { filePath?: string; absoluteFilePath?: string };
    const explicitPath = String(anyItem.filePath || anyItem.absoluteFilePath || '').trim();
    if (explicitPath) {
        const srcIndex = explicitPath.indexOf('src/');
        if (srcIndex >= 0) {
            let rel = explicitPath.substring(srcIndex);
            rel = rel.replace(/\/index\.(t|j)sx?$/i, '');
            return rel;
        }
        return explicitPath.replace(/\/index\.(t|j)sx?$/i, '');
    }
    return '';
}
