import {
  GENIE_BRIDGE_CONFIG_ERROR,
  GENIE_DEFAULT_INTEGRATION_CHANNEL,
  GENIE_DEFAULT_TARGET_CLIENT_ID,
  GENIE_SERVICE_ID,
} from './constants';
import {
  collectUniqueStrings,
  isMessageRecord,
  normalizeBaseUrl,
  normalizeString,
  parseTimestamp,
  readWindowSearchParam,
} from './common';

export type EditorClientDescriptor = {
  channel: string;
  clientId: string;
  sessionId: string | null;
  pageUrl: string | null;
  lastSeenAt: number;
  connectedAt: number;
  capabilities: string[];
};

export function hasGenieServiceIdentity(
  payload: unknown,
  headers?: Pick<Headers, 'get'> | null,
): boolean {
  const serviceId = normalizeString((payload as { service?: { id?: unknown } } | null)?.service?.id);
  const appIdentifier = normalizeString(headers?.get('X-App-Identifier') ?? headers?.get('x-app-identifier'));
  return serviceId === GENIE_SERVICE_ID || appIdentifier === GENIE_SERVICE_ID;
}

export function parseEditorClientDescriptors(value: unknown): EditorClientDescriptor[] {
  const items = Array.isArray((value as { items?: unknown } | null)?.items)
    ? (value as { items: unknown[] }).items
    : [];

  return items
    .map((item) => {
      if (!isMessageRecord(item)) return null;
      const channel = normalizeString(item.channel);
      const clientId = normalizeString(item.clientId);
      if (!channel || !clientId) return null;
      return {
        channel,
        clientId,
        sessionId: normalizeString(item.sessionId) || null,
        pageUrl: normalizeString(item.pageUrl) || null,
        lastSeenAt: parseTimestamp(item.lastSeenAt, 0),
        connectedAt: parseTimestamp(item.connectedAt, 0),
        capabilities: Array.isArray(item.capabilities)
          ? item.capabilities.map((entry) => normalizeString(entry)).filter(Boolean)
          : [],
      } satisfies EditorClientDescriptor;
    })
    .filter((item): item is EditorClientDescriptor => item !== null);
}

export function pickPreferredEditorClient(
  items: readonly EditorClientDescriptor[],
  targetCandidates: readonly string[],
): EditorClientDescriptor | null {
  for (const targetCandidate of targetCandidates) {
    const matched = items.find((item) => item.clientId === targetCandidate);
    if (matched) {
      return matched;
    }
  }

  const sortedItems = items.slice().sort((left, right) => {
    const leftTimestamp = Math.max(left.lastSeenAt, left.connectedAt);
    const rightTimestamp = Math.max(right.lastSeenAt, right.connectedAt);
    return rightTimestamp - leftTimestamp;
  });

  const defaultClient = sortedItems.find((item) => item.clientId === GENIE_DEFAULT_TARGET_CLIENT_ID);
  if (defaultClient) {
    return defaultClient;
  }

  if (sortedItems.length === 1) {
    return sortedItems[0] ?? null;
  }

  return sortedItems[0] ?? null;
}

export function buildDiscoveryChannelCandidates(currentChannel: string): string[] {
  return collectUniqueStrings(
    currentChannel,
    readWindowSearchParam('genieIntegrationChannel', 'integrationChannel'),
    GENIE_DEFAULT_INTEGRATION_CHANNEL,
  );
}

export function buildDiscoveryTargetCandidates(currentTargetClientId: string): string[] {
  return collectUniqueStrings(
    currentTargetClientId,
    readWindowSearchParam('genieTargetClientId', 'integrationClientId'),
    GENIE_DEFAULT_TARGET_CLIENT_ID,
  );
}

export function buildGenieWsUrl(apiBaseUrl: string, apiKey?: string): string {
  const trimmed = normalizeBaseUrl(apiBaseUrl);
  if (!trimmed) {
    throw new Error(GENIE_BRIDGE_CONFIG_ERROR);
  }

  const url = new URL(trimmed);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/agent/ws`;

  const normalizedApiKey = String(apiKey ?? '').trim();
  if (normalizedApiKey) {
    url.searchParams.set('apiKey', normalizedApiKey);
  } else {
    url.searchParams.delete('apiKey');
  }

  return url.toString();
}
