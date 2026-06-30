export const AXHUB_WEB_EDITOR_GENIE_REQUEST = 'AXHUB_WEB_EDITOR_GENIE_REQUEST' as const;

export type WebEditorGenieProvider = 'claude' | 'cursor' | 'codex' | 'gemini' | 'opencode';
export type WebEditorGenieRequestMode = 'selection_context' | 'save';

export interface WebEditorGenieContextElementV1 {
  tag: string;
  selector: string;
  label: string;
}

export interface WebEditorGenieCurrentFileV1 {
  path: string;
  displayName: string;
}

export interface WebEditorGenieContextV1 {
  version: '1';
  systemContext: string;
  currentFile: WebEditorGenieCurrentFileV1;
  selectedElements: WebEditorGenieContextElementV1[];
  extensions?: Record<string, unknown>;
}

export interface WebEditorGenieRequestPayload {
  mode: WebEditorGenieRequestMode;
  provider?: WebEditorGenieProvider;
  prompt?: string;
  targetPath?: string;
  preferCurrentSession: boolean;
  context?: WebEditorGenieContextV1;
}

export interface WebEditorGenieRequestMessage {
  type: typeof AXHUB_WEB_EDITOR_GENIE_REQUEST;
  payload: WebEditorGenieRequestPayload;
}

export function createWebEditorGenieRequestMessage(
  payload: WebEditorGenieRequestPayload,
): WebEditorGenieRequestMessage {
  return {
    type: AXHUB_WEB_EDITOR_GENIE_REQUEST,
    payload,
  };
}

export function isWebEditorGenieRequestMessage(
  value: unknown,
): value is WebEditorGenieRequestMessage {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<WebEditorGenieRequestMessage>;
  if (data.type !== AXHUB_WEB_EDITOR_GENIE_REQUEST) return false;
  if (!data.payload || typeof data.payload !== 'object') return false;
  const payload = data.payload as Partial<WebEditorGenieRequestPayload>;
  return typeof payload.preferCurrentSession === 'boolean' && typeof payload.mode === 'string';
}

export function postWebEditorGenieRequest(
  payload: WebEditorGenieRequestPayload,
  options: { targetOrigin?: string } = {},
): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.parent || window.parent === window) return false;

  window.parent.postMessage(
    createWebEditorGenieRequestMessage(payload),
    options.targetOrigin ?? '*',
  );
  return true;
}
