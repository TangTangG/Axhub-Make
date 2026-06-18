export type GenieProvider = 'claude' | 'cursor' | 'codex' | 'gemini' | 'opencode' | 'qoder' | 'codebuddy' | 'reasonix';
export type GenieProviderPreference = GenieProvider | null;

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
