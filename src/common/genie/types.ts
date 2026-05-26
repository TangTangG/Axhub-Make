export const AXHUB_WEB_EDITOR_GENIE_REQUEST = 'AXHUB_WEB_EDITOR_GENIE_REQUEST' as const;

export type GenieProvider = 'claude' | 'cursor' | 'codex' | 'gemini' | 'opencode';
export type GenieProviderPreference = GenieProvider | null;

export interface GenieExecutePromptRequest {
  scene: string;
  client: GenieProvider;
  prompt: string;
  targetPath?: string;
}

export interface GenieExecutePromptResponse {
  success: boolean;
  sessionId?: string;
  scene?: string;
  provider?: GenieProvider;
  command?: string;
  output?: string;
  projectId?: string;
  projectRoot?: string;
}

export interface GenieContextElementV1 {
  tag: string;
  selector: string;
  label: string;
}

export interface GenieCurrentFileV1 {
  path: string;
  displayName: string;
}

export type GenieCurrentFileValueV1 = string | GenieCurrentFileV1;

export interface GenieContextV1 {
  version: '1';
  systemContext: string;
  currentFile: GenieCurrentFileValueV1;
  selectedElements: GenieContextElementV1[];
  extensions?: Record<string, unknown>;
}

export interface AssistantUpdateContextMessage {
  type: 'update_context';
  mode?: 'replace' | 'append';
  context: GenieContextV1;
}

export interface AssistantUpdatePromptMessage {
  type: 'update_prompt';
  prompt: string;
  autoSend?: boolean;
}

export type WebEditorGenieRequestMode = 'selection_context' | 'save';

export interface WebEditorGenieRequestPayload {
  mode: WebEditorGenieRequestMode;
  provider?: GenieProvider;
  prompt?: string;
  targetPath?: string;
  preferCurrentSession: boolean;
  context?: GenieContextV1;
}

export interface WebEditorGenieRequestMessage {
  type: typeof AXHUB_WEB_EDITOR_GENIE_REQUEST;
  payload: WebEditorGenieRequestPayload;
}
