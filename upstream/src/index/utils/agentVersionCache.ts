import type { AgentVersionInfo, CLIAgent } from '../../common/agent';
import type { AcpProviderKey } from '../../common/acpModelConfig';

export const AGENT_VERSION_CACHE_TTL_MS = 10 * 60_000;

export type AgentVersionKey = AcpProviderKey | CLIAgent;
export type AgentVersionMap = Partial<Record<AgentVersionKey, AgentVersionInfo>>;

export interface AgentVersionCache {
    fetchedAt: number;
    versions: AgentVersionMap;
    latestVersions: AgentVersionMap;
}

export function isAgentVersionCacheFresh(cache: AgentVersionCache | null, now = Date.now()): cache is AgentVersionCache {
    return Boolean(cache && now - cache.fetchedAt < AGENT_VERSION_CACHE_TTL_MS);
}

function formatSingleAgentVersionMeta(info?: AgentVersionInfo | null): string {
    if (!info) return '';
    if (info.status === 'missing') return '未安装';
    if (info.status === 'unknown') return '检测失败';
    return formatQuietVersion(info.version) || '已安装';
}

function formatSingleAgentVersionMetaTitle(info?: AgentVersionInfo | null): string {
    if (!info) return '';
    if (info.status === 'missing') return info.reason ? `未安装：${info.reason}` : '未安装';
    if (info.status === 'unknown') return info.reason ? `检测失败：${info.reason}` : '检测失败';
    return info.version || '已安装';
}

function formatQuietVersion(version?: string): string {
    const normalized = String(version || '').trim();
    if (!normalized) return '';
    const buildStampMatch = normalized.match(/^(\d{4}\.\d{2}\.\d{2})-\d{2}-\d{2}-\d{2}-[0-9a-f]{7,}$/iu);
    if (buildStampMatch?.[1]) {
        return buildStampMatch[1];
    }
    return normalized;
}

export function formatAgentVersionMeta(info?: AgentVersionInfo | null, latestInfo?: AgentVersionInfo | null): string {
    const localMeta = formatSingleAgentVersionMeta(info);
    const latestMeta = latestInfo?.status === 'installed' && latestInfo.version
        ? formatQuietVersion(latestInfo.version)
        : '';
    if (!localMeta) return latestMeta ? `未检测（${latestMeta}）` : '';
    return latestMeta ? `${localMeta}（${latestMeta}）` : localMeta;
}

export function formatAgentVersionMetaTitle(info?: AgentVersionInfo | null, latestInfo?: AgentVersionInfo | null): string {
    const localMeta = formatSingleAgentVersionMetaTitle(info);
    const latestMeta = latestInfo?.status === 'installed' && latestInfo.version
        ? latestInfo.version
        : '';
    if (!localMeta) return latestMeta ? `未检测（${latestMeta}）` : '';
    return latestMeta ? `${localMeta}（${latestMeta}）` : localMeta;
}
