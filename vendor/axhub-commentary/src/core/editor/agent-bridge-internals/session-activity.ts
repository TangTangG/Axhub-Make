import type {
  SessionActivityItem,
  SessionActivityKind,
  SessionActivityTarget,
} from '../contracts';
import {
  createRequestId,
  isMessageRecord,
  normalizeString,
  parseTimestamp,
} from './common';
import type {
  AgentStateSyncPayload,
  PendingAssistantActivity,
} from './types';

export function parseAgentStateSyncPayload(value: unknown): AgentStateSyncPayload | null {
  if (!isMessageRecord(value)) return null;
  const sessionId = typeof value.sessionId === 'string' ? value.sessionId.trim() : '';
  const provider = typeof value.provider === 'string' ? value.provider.trim() : '';
  const phase = typeof value.phase === 'string' ? value.phase.trim() : '';
  if (!sessionId || !provider || !phase) {
    return null;
  }

  return {
    sessionId,
    provider,
    phase,
    isLoading: Boolean(value.isLoading),
    canAbortSession: Boolean(value.canAbortSession),
    hasPendingApproval: Boolean(value.hasPendingApproval),
    updatedAt: parseTimestamp(value.updatedAt, Date.now()),
    subscriptionKey: typeof value.subscriptionKey === 'string' && value.subscriptionKey.trim()
      ? value.subscriptionKey.trim()
      : null,
  };
}

export function normalizeSessionActivityTarget(
  value: SessionActivityTarget | null | undefined,
): Required<SessionActivityTarget> | null {
  if (!isMessageRecord(value)) return null;
  const sessionId = normalizeString(value.sessionId) || null;
  const provider = normalizeString(value.provider) || null;
  const requestId = normalizeString(value.requestId) || null;
  if (!requestId && !(sessionId && provider)) {
    return null;
  }
  return {
    sessionId,
    provider,
    requestId,
  };
}

export function buildSessionActivityTargetKey(target: Required<SessionActivityTarget>): string {
  return [
    `session:${target.provider ?? ''}:${target.sessionId ?? ''}`,
    `request:${target.requestId ?? ''}`,
  ].join('|');
}

export function parseSessionActivityItem(value: unknown): SessionActivityItem | null {
  if (!isMessageRecord(value)) return null;
  const id = normalizeString(value.id) || createRequestId('session_activity');
  const rawKind = normalizeString(value.kind).toLowerCase();
  const toolName = normalizeString(value.toolName ?? value.name);
  const sessionId = normalizeString(value.sessionId) || null;
  const provider = normalizeString(value.provider) || null;
  const requestId = normalizeString(value.requestId) || null;
  let kind: SessionActivityKind = 'text';
  let text = normalizeString(value.text);

  if (rawKind === 'assistant') {
    kind = 'assistant';
  } else if (rawKind === 'tool') {
    kind = 'tool';
    text = text || (toolName ? `调用工具：${toolName}` : '');
  } else {
    kind = 'text';
    text = text || (toolName ? `调用工具：${toolName}` : '');
  }

  if (!text) return null;

  return {
    id,
    timestamp: parseTimestamp(value.timestamp, Date.now()),
    kind,
    text,
    sessionId,
    provider,
    requestId,
  };
}

export function summarizeSessionActivityText(value: unknown): string {
  const normalized = normalizeString(value).replace(/\s+/gu, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= 160) return normalized;
  return `${normalized.slice(0, 157).trimEnd()}...`;
}

export function parseSessionActivityItemFromAgentEvent(options: {
  requestId?: unknown;
  provider?: unknown;
  sessionId?: unknown;
  event?: unknown;
  assistantBuffers: Map<string, PendingAssistantActivity>;
}): SessionActivityItem | null {
  const requestId = normalizeString(options.requestId) || null;
  const defaultProvider = normalizeString(options.provider) || null;
  const defaultSessionId = normalizeString(options.sessionId) || null;
  const event = isMessageRecord(options.event) ? options.event : null;
  if (!event) return null;

  const eventId = normalizeString(event.eventId) || createRequestId('session_activity');
  const eventKind = normalizeString(event.kind).toLowerCase();
  const eventProvider = normalizeString(event.provider) || defaultProvider;
  const eventSessionId = normalizeString(event.sessionId) || defaultSessionId;
  const payload = isMessageRecord(event.payload) ? event.payload : {};
  const messageId =
    normalizeString(payload.messageId)
    || normalizeString((event.extensions as Record<string, unknown> | undefined)?.messageId)
    || null;
  const timestamp = parseTimestamp(event.timestamp, Date.now());

  if (eventKind === 'assistant_text_start') {
    if (requestId && messageId) {
      options.assistantBuffers.set(`${requestId}::${messageId}`, {
        text: '',
        timestamp,
        provider: eventProvider,
        sessionId: eventSessionId,
      });
    }
    return null;
  }

  if (eventKind === 'assistant_text_delta') {
    if (!requestId || !messageId) return null;
    const key = `${requestId}::${messageId}`;
    const existing = options.assistantBuffers.get(key) ?? {
      text: '',
      timestamp,
      provider: eventProvider,
      sessionId: eventSessionId,
    };
    existing.text += String(payload.text ?? '');
    existing.timestamp = timestamp;
    existing.provider = eventProvider;
    existing.sessionId = eventSessionId;
    options.assistantBuffers.set(key, existing);
    return null;
  }

  if (eventKind === 'assistant_text_end') {
    if (!requestId || !messageId) return null;
    const key = `${requestId}::${messageId}`;
    const buffered = options.assistantBuffers.get(key);
    options.assistantBuffers.delete(key);
    const text = summarizeSessionActivityText(buffered?.text ?? '');
    if (!text) return null;
    return {
      id: eventId,
      timestamp,
      kind: 'assistant',
      text,
      sessionId: buffered?.sessionId ?? eventSessionId,
      provider: buffered?.provider ?? eventProvider,
      requestId,
    };
  }

  if (eventKind === 'tool_call_start') {
    const toolName = normalizeString(payload.toolName) || 'unknown';
    return {
      id: eventId,
      timestamp,
      kind: 'tool',
      text: `调用工具：${toolName}`,
      sessionId: eventSessionId,
      provider: eventProvider,
      requestId,
    };
  }

  return null;
}

export function matchesSessionActivityTarget(
  target: Required<SessionActivityTarget>,
  item: SessionActivityItem,
): boolean {
  if (target.requestId && item.requestId === target.requestId) {
    return true;
  }
  if (
    target.sessionId
    && target.provider
    && item.sessionId === target.sessionId
    && item.provider === target.provider
  ) {
    return true;
  }
  return false;
}
