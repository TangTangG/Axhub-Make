export type AcpProvider = 'claude' | 'cursor' | 'codex' | 'opencode' | 'qoder' | 'codebuddy' | 'reasonix' | 'grok-build';
export type AcpProviderPreference = AcpProvider | null;

export interface AssistantContextElementV1 {
  tag: string;
  selector: string;
  label: string;
}

export interface AssistantCurrentFileV1 {
  path: string;
  displayName: string;
}

export type AssistantCurrentFileValueV1 = string | AssistantCurrentFileV1;

export interface AssistantContextV1 {
  version: '1';
  systemContext: string;
  currentFile: AssistantCurrentFileValueV1;
  selectedElements: AssistantContextElementV1[];
  extensions?: Record<string, unknown>;
}
