import type { AgentVersionInfo, CLIAgent } from '../../common/agent';

export const AGENT_VERSION_CACHE_TTL_MS = 60_000;

export type AgentVersionMap = Partial<Record<CLIAgent, AgentVersionInfo>>;

export interface AgentVersionCache {
    fetchedAt: number;
    versions: AgentVersionMap;
}

export function isAgentVersionCacheFresh(cache: AgentVersionCache | null, now = Date.now()): cache is AgentVersionCache {
    return Boolean(cache && now - cache.fetchedAt < AGENT_VERSION_CACHE_TTL_MS);
}

export function formatAgentVersionMeta(info?: AgentVersionInfo | null): string {
    if (!info) return '';
    if (info.status === 'missing') return '未安装';
    if (info.status === 'unknown') return '检测失败';
    return info.version || '已安装';
}
