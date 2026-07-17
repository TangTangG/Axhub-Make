export const AXHUB_WEB_EDITOR_AGENT_REQUEST = 'AXHUB_WEB_EDITOR_AGENT_REQUEST' as const;

export type WebEditorAgentProvider = 'claude' | 'cursor' | 'codex' | 'opencode';
export type WebEditorAgentRequestMode = 'selection_context' | 'save';

export interface WebEditorAgentContextElementV1 {
  tag: string;
  selector: string;
  label: string;
}

export interface WebEditorAgentCurrentFileV1 {
  path: string;
  displayName: string;
}

export interface WebEditorAgentContextV1 {
  version: '1';
  systemContext: string;
  currentFile: WebEditorAgentCurrentFileV1;
  selectedElements: WebEditorAgentContextElementV1[];
  extensions?: Record<string, unknown>;
}

export interface WebEditorAgentRequestPayload {
  mode: WebEditorAgentRequestMode;
  provider?: WebEditorAgentProvider;
  prompt?: string;
  targetPath?: string;
  preferCurrentSession: boolean;
  context?: WebEditorAgentContextV1;
}

export interface WebEditorAgentRequestMessage {
  type: typeof AXHUB_WEB_EDITOR_AGENT_REQUEST;
  payload: WebEditorAgentRequestPayload;
}

export function createWebEditorAgentRequestMessage(
  payload: WebEditorAgentRequestPayload,
): WebEditorAgentRequestMessage {
  return {
    type: AXHUB_WEB_EDITOR_AGENT_REQUEST,
    payload,
  };
}

export function isWebEditorAgentRequestMessage(
  value: unknown,
): value is WebEditorAgentRequestMessage {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<WebEditorAgentRequestMessage>;
  if (data.type !== AXHUB_WEB_EDITOR_AGENT_REQUEST) return false;
  if (!data.payload || typeof data.payload !== 'object') return false;
  const payload = data.payload as Partial<WebEditorAgentRequestPayload>;
  return typeof payload.preferCurrentSession === 'boolean' && typeof payload.mode === 'string';
}

export function postWebEditorAgentRequest(
  payload: WebEditorAgentRequestPayload,
  options: { targetOrigin?: string } = {},
): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.parent || window.parent === window) return false;

  window.parent.postMessage(
    createWebEditorAgentRequestMessage(payload),
    options.targetOrigin ?? '*',
  );
  return true;
}
