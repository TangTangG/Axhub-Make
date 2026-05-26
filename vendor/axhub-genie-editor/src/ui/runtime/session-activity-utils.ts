import type { SessionActivityItem, SessionActivityTarget } from '../../core/editor/contracts';

export function limitVisibleSessionActivities(
  items: readonly SessionActivityItem[],
  limit = 3,
): SessionActivityItem[] {
  if (limit <= 0) return [];
  return items.slice(Math.max(0, items.length - limit));
}

export function appendRecentSessionActivities(
  previous: SessionActivityItem[],
  nextItem: SessionActivityItem,
  limit = 3,
): SessionActivityItem[] {
  return limitVisibleSessionActivities([...previous, nextItem], limit);
}

export function resolveSessionActivityTarget(options: {
  requestId?: string | null;
  sessionId?: string | null;
  provider?: string | null;
  conversationSessionId?: string | null;
  conversationProvider?: string | null;
}): SessionActivityTarget | null {
  const requestId = String(options.requestId ?? '').trim() || null;
  const sessionId = String(options.sessionId ?? options.conversationSessionId ?? '').trim() || null;
  const provider = String(options.provider ?? options.conversationProvider ?? '').trim() || null;
  if (sessionId && provider) {
    return {
      sessionId,
      provider,
      ...(requestId ? { requestId } : {}),
    };
  }
  if (requestId) {
    return { requestId };
  }
  return null;
}
