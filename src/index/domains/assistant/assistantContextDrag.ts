import type { AcpContextItem } from './assistantAcpContext';
import type { AssistantResourceContextType } from './assistantContextPayload';

export const ASSISTANT_CONTEXT_DRAG_MIME = 'application/x-axhub-assistant-context';

export interface AssistantContextDragPayload {
    version: 1;
    source: 'sidebar' | 'resource-folder';
    resourceType?: AssistantResourceContextType;
    resourceId?: string;
    items: AcpContextItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isContextItem(value: unknown): value is AcpContextItem {
    if (!isRecord(value)) return false;
    if (value.kind === 'file') {
        return typeof value.path === 'string' && value.path.trim().length > 0;
    }
    if (value.kind === 'annotation') {
        return typeof value.body === 'string' && value.body.trim().length > 0 && isRecord(value.target);
    }
    return false;
}

export function buildAssistantContextDragPayload(
    params: Omit<AssistantContextDragPayload, 'version'>,
): AssistantContextDragPayload {
    return {
        version: 1,
        source: params.source,
        ...(params.resourceType ? { resourceType: params.resourceType } : {}),
        ...(params.resourceId ? { resourceId: params.resourceId } : {}),
        items: params.items.filter(isContextItem),
    };
}

export function parseAssistantContextDragPayload(rawPayload: string): AssistantContextDragPayload | null {
    if (!rawPayload.trim()) return null;
    try {
        const parsed = JSON.parse(rawPayload) as unknown;
        if (!isRecord(parsed) || parsed.version !== 1) return null;
        if (parsed.source !== 'sidebar' && parsed.source !== 'resource-folder') return null;
        if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
        const items = parsed.items.filter(isContextItem);
        if (items.length !== parsed.items.length || items.length === 0) return null;
        return {
            version: 1,
            source: parsed.source,
            ...(typeof parsed.resourceType === 'string' ? { resourceType: parsed.resourceType as AssistantResourceContextType } : {}),
            ...(typeof parsed.resourceId === 'string' ? { resourceId: parsed.resourceId } : {}),
            items,
        };
    } catch {
        return null;
    }
}
