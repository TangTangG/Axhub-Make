import fs from 'node:fs';
import path from 'node:path';

import { getConfigPath, getGlobalServerConfigPath } from './paths.ts';

export type ServerPromptClientPreference = 'acp:codex' | 'acp:claude' | 'acp:gemini' | 'acp:opencode' | 'manual';
export type ServerAcpExecutionMode = 'prompt' | 'exec';
export type ServerAcpPermissionMode = 'approve-all';

export type ServerIDEPreference =
  | 'cursor'
  | 'trae'
  | 'trae_cn'
  | 'windsurf'
  | 'vscode'
  | 'antigravity'
  | 'qoder'
  | 'none'
  | `web:${string}`
  | `cli:${string}`;

export type ExcalidrawPropertyPanelModePreference = 'collapsed' | 'expanded';
export type ExcalidrawPropertyPanelPositionPreference = 'left' | 'right';
export type ToolOpenKind = 'ide' | 'cli' | 'web' | 'local-app';
export type ToolOpenMode = 'direct-app' | 'app-path' | 'browser-deeplink' | 'deeplink' | 'terminal' | 'managed-web';

export interface ToolOpenStateEntry {
  executablePath?: string;
  commandPath?: string;
  appPathName?: string;
  lastOpenMode?: ToolOpenMode | '';
}

export type ToolOpenState = Record<string, ToolOpenStateEntry>;

export type AiImageGenerationLastTestStatus = 'passed' | 'failed';

export interface AiImageGenerationLastTest {
  status: AiImageGenerationLastTestStatus;
  message: string;
  testedAt: number;
}

export interface AiImageGenerationConfig {
  baseUrl: string;
  apiKey: string | null;
  model: string;
  lastTest?: AiImageGenerationLastTest;
}

export interface MakeServerConfig {
  automation: {
    defaultPromptClient: ServerPromptClientPreference;
    defaultIDE: ServerIDEPreference;
    acp: {
      mode: ServerAcpExecutionMode;
      permission: ServerAcpPermissionMode;
      timeout: number;
    };
  };
  assistant: {
    webBaseUrl: string | null;
    apiBaseUrl: string | null;
  };
  ai: {
    imageGeneration: AiImageGenerationConfig;
  };
  uiPreferences: {
    excalidrawPropertyPanelMode: ExcalidrawPropertyPanelModePreference;
    excalidrawPropertyPanelPosition: ExcalidrawPropertyPanelPositionPreference;
  };
  toolOpenState: ToolOpenState;
}

export interface ServerConfigStoreOptions {
  homeDir?: string;
  configPath?: string;
}

export interface ServerConfigGetOptions {
  activeProjectRoot?: string | null;
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const DEFAULT_SERVER_CONFIG: MakeServerConfig = {
  automation: {
    defaultPromptClient: 'acp:codex',
    defaultIDE: 'none',
    acp: {
      mode: 'prompt',
      permission: 'approve-all',
      timeout: 1800,
    },
  },
  assistant: {
    webBaseUrl: null,
    apiBaseUrl: null,
  },
  ai: {
    imageGeneration: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: null,
      model: 'gpt-image-2',
    },
  },
  uiPreferences: {
    excalidrawPropertyPanelMode: 'collapsed',
    excalidrawPropertyPanelPosition: 'right',
  },
  toolOpenState: {},
};

const PROMPT_CLIENT_VALUES = new Set<ServerPromptClientPreference>([
  'acp:codex',
  'acp:claude',
  'acp:gemini',
  'acp:opencode',
  'manual',
]);

const LEGACY_PROMPT_CLIENT_VALUES: Record<string, ServerPromptClientPreference> = {
  codex: 'acp:codex',
  openai: 'acp:codex',
  'genie:codex': 'acp:codex',
  claude: 'acp:claude',
  claudecode: 'acp:claude',
  'genie:claude': 'acp:claude',
  gemini: 'acp:gemini',
  'genie:gemini': 'acp:gemini',
  opencode: 'acp:opencode',
  'genie:opencode': 'acp:opencode',
};

const IDE_VALUES = new Set<ServerIDEPreference>([
  'cursor',
  'trae',
  'trae_cn',
  'windsurf',
  'vscode',
  'antigravity',
  'qoder',
  'none',
]);

const TOOL_OPEN_MODES = new Set<ToolOpenMode>([
  'direct-app',
  'app-path',
  'browser-deeplink',
  'deeplink',
  'terminal',
  'managed-web',
]);

const TOOL_OPEN_KEY_PATTERN = /^(?:ide|cli|web|local-app):[a-z][a-z0-9_-]*$/u;

function readJsonFile(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeNullableString(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeBaseUrl(value: unknown, fallback: string): string {
  const trimmed = normalizeOptionalString(value, fallback);
  const input = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(input);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const v1Index = pathSegments.indexOf('v1');
    const normalizedSegments = v1Index >= 0
      ? pathSegments.slice(0, v1Index + 1)
      : pathSegments.length
        ? [...pathSegments, 'v1']
        : ['v1'];
    return `${url.origin}/${normalizedSegments.join('/')}`;
  } catch {
    return fallback;
  }
}

function normalizePositiveInteger(value: unknown, fallback: number, options: { min: number; max: number }): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  if (rounded < options.min || rounded > options.max) {
    return fallback;
  }
  return rounded;
}

function normalizeAiImageGenerationLastTest(
  value: unknown,
  fallback?: AiImageGenerationLastTest,
): AiImageGenerationLastTest | undefined {
  if (value === null) {
    return undefined;
  }
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const status = data.status === 'passed' || data.status === 'failed'
    ? data.status
    : fallback?.status;
  const testedAt = typeof data.testedAt === 'number' && Number.isFinite(data.testedAt) && data.testedAt > 0
    ? Math.round(data.testedAt)
    : fallback?.testedAt;
  if (!status || !testedAt) {
    return fallback;
  }
  const rawMessage = hasOwn(data, 'message')
    ? normalizeTrimmedString(data.message)
    : fallback?.message || '';
  const message = (rawMessage || (status === 'passed' ? '已返回图片结果' : '测试失败')).slice(0, 500);
  return { status, message, testedAt };
}

function normalizeAiImageGenerationConfig(
  input: unknown,
  fallback: AiImageGenerationConfig,
): AiImageGenerationConfig {
  const data = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const lastTest = hasOwn(data, 'lastTest')
    ? normalizeAiImageGenerationLastTest(data.lastTest, fallback.lastTest)
    : fallback.lastTest;

  const config: AiImageGenerationConfig = {
    baseUrl: hasOwn(data, 'baseUrl') ? normalizeBaseUrl(data.baseUrl, fallback.baseUrl) : fallback.baseUrl,
    apiKey: hasOwn(data, 'apiKey') ? normalizeNullableString(data.apiKey) : fallback.apiKey,
    model: hasOwn(data, 'model') ? normalizeOptionalString(data.model, fallback.model) : fallback.model,
  };
  if (lastTest) {
    config.lastTest = lastTest;
  }
  return config;
}

function normalizePromptClient(value: unknown, fallback: ServerPromptClientPreference): ServerPromptClientPreference {
  if (value === null) {
    return 'manual';
  }
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (LEGACY_PROMPT_CLIENT_VALUES[normalized]) {
    return LEGACY_PROMPT_CLIENT_VALUES[normalized];
  }
  if (PROMPT_CLIENT_VALUES.has(normalized as ServerPromptClientPreference)) {
    return normalized as ServerPromptClientPreference;
  }
  return fallback;
}

function normalizeAcpExecutionConfig(
  value: unknown,
  fallback: MakeServerConfig['automation']['acp'],
): MakeServerConfig['automation']['acp'] {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const mode = data.mode === 'exec' || data.mode === 'prompt' ? data.mode : fallback.mode;
  const permission = data.permission === 'approve-all' ? data.permission : fallback.permission;
  return {
    mode,
    permission,
    timeout: hasOwn(data, 'timeout')
      ? normalizePositiveInteger(data.timeout, fallback.timeout, { min: 30, max: 7200 })
      : fallback.timeout,
  };
}

function normalizeToolOpenStateEntry(value: unknown, fallback: ToolOpenStateEntry = {}): ToolOpenStateEntry {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const executablePath = hasOwn(data, 'executablePath')
    ? normalizeTrimmedString(data.executablePath)
    : fallback.executablePath || '';
  const commandPath = hasOwn(data, 'commandPath')
    ? normalizeTrimmedString(data.commandPath)
    : fallback.commandPath || '';
  const appPathName = hasOwn(data, 'appPathName')
    ? normalizeTrimmedString(data.appPathName)
    : fallback.appPathName || '';
  const rawOpenMode = hasOwn(data, 'lastOpenMode')
    ? normalizeTrimmedString(data.lastOpenMode)
    : fallback.lastOpenMode || '';
  const lastOpenMode = TOOL_OPEN_MODES.has(rawOpenMode as ToolOpenMode)
    ? rawOpenMode as ToolOpenMode
    : '';
  const entry: ToolOpenStateEntry = {};
  if (executablePath) entry.executablePath = executablePath;
  if (commandPath) entry.commandPath = commandPath;
  if (appPathName) entry.appPathName = appPathName;
  if (lastOpenMode) entry.lastOpenMode = lastOpenMode;
  return entry;
}

function normalizeToolOpenState(value: unknown, fallback: ToolOpenState = {}): ToolOpenState {
  const current = Object.fromEntries(
    Object.entries(fallback)
      .filter(([key]) => TOOL_OPEN_KEY_PATTERN.test(key))
      .map(([key, entry]) => [key, normalizeToolOpenStateEntry(entry)]),
  );
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const next: ToolOpenState = { ...current };
  for (const [rawKey, rawEntry] of Object.entries(data)) {
    const key = rawKey.trim();
    if (!TOOL_OPEN_KEY_PATTERN.test(key)) {
      continue;
    }
    if (rawEntry === null) {
      delete next[key];
      continue;
    }
    const entry = normalizeToolOpenStateEntry(rawEntry, next[key]);
    if (Object.keys(entry).length > 0) {
      next[key] = entry;
    } else {
      delete next[key];
    }
  }
  return next;
}

function normalizeIDE(value: unknown, fallback: ServerIDEPreference): ServerIDEPreference {
  if (value === null) {
    return 'none';
  }
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (IDE_VALUES.has(normalized as ServerIDEPreference)) {
    return normalized as ServerIDEPreference;
  }
  // Accept web:* and cli:* compound open-method strings (e.g. 'web:opencode', 'cli:codex')
  if (/^(?:web|cli):[a-z][a-z0-9_-]*$/i.test(normalized)) {
    return normalized as ServerIDEPreference;
  }
  return fallback;
}

function normalizeExcalidrawPropertyPanelMode(
  value: unknown,
  fallback: ExcalidrawPropertyPanelModePreference,
): ExcalidrawPropertyPanelModePreference {
  if (value === 'collapsed' || value === 'compact') {
    return 'collapsed';
  }
  if (value === 'expanded' || value === 'desktop') {
    return 'expanded';
  }
  return fallback;
}

function normalizeExcalidrawPropertyPanelPosition(
  value: unknown,
  fallback: ExcalidrawPropertyPanelPositionPreference,
): ExcalidrawPropertyPanelPositionPreference {
  if (value === 'left' || value === 'right') {
    return value;
  }
  return fallback;
}

function hasOwn(value: Record<string, any>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeConfig(input: unknown, fallback: MakeServerConfig = DEFAULT_SERVER_CONFIG): MakeServerConfig {
  const data = input && typeof input === 'object' ? input as Record<string, any> : {};
  const automation = data.automation && typeof data.automation === 'object' ? data.automation : {};
  const assistant = data.assistant && typeof data.assistant === 'object' ? data.assistant : {};
  const ai = data.ai && typeof data.ai === 'object' ? data.ai as Record<string, unknown> : {};
  const uiPreferences = data.uiPreferences && typeof data.uiPreferences === 'object' ? data.uiPreferences : {};

  return {
    automation: {
      defaultPromptClient: hasOwn(automation, 'defaultPromptClient')
        ? normalizePromptClient(automation.defaultPromptClient, fallback.automation.defaultPromptClient)
        : fallback.automation.defaultPromptClient,
      defaultIDE: hasOwn(automation, 'defaultIDE')
        ? normalizeIDE(automation.defaultIDE, fallback.automation.defaultIDE)
        : fallback.automation.defaultIDE,
      acp: hasOwn(automation, 'acp') || hasOwn(automation, 'acpx')
        ? normalizeAcpExecutionConfig(
          hasOwn(automation, 'acp') ? automation.acp : automation.acpx,
          fallback.automation.acp,
        )
        : fallback.automation.acp,
    },
    assistant: {
      webBaseUrl: hasOwn(assistant, 'webBaseUrl')
        ? normalizeNullableString(assistant.webBaseUrl)
        : fallback.assistant.webBaseUrl,
      apiBaseUrl: hasOwn(assistant, 'apiBaseUrl')
        ? normalizeNullableString(assistant.apiBaseUrl)
        : fallback.assistant.apiBaseUrl,
    },
    ai: {
      imageGeneration: hasOwn(ai, 'imageGeneration')
        ? normalizeAiImageGenerationConfig(ai.imageGeneration, fallback.ai.imageGeneration)
        : fallback.ai.imageGeneration,
    },
    uiPreferences: {
      excalidrawPropertyPanelMode: hasOwn(uiPreferences, 'excalidrawPropertyPanelMode')
        ? normalizeExcalidrawPropertyPanelMode(
          uiPreferences.excalidrawPropertyPanelMode,
          fallback.uiPreferences.excalidrawPropertyPanelMode,
        )
        : hasOwn(uiPreferences, 'excalidrawUiMode')
          ? normalizeExcalidrawPropertyPanelMode(
            uiPreferences.excalidrawUiMode,
            fallback.uiPreferences.excalidrawPropertyPanelMode,
          )
          : fallback.uiPreferences.excalidrawPropertyPanelMode,
      excalidrawPropertyPanelPosition: hasOwn(uiPreferences, 'excalidrawPropertyPanelPosition')
        ? normalizeExcalidrawPropertyPanelPosition(
          uiPreferences.excalidrawPropertyPanelPosition,
          fallback.uiPreferences.excalidrawPropertyPanelPosition,
        )
        : fallback.uiPreferences.excalidrawPropertyPanelPosition,
    },
    toolOpenState: hasOwn(data, 'toolOpenState')
      ? normalizeToolOpenState(data.toolOpenState, fallback.toolOpenState)
      : fallback.toolOpenState,
  };
}

export function buildToolOpenStateKey(kind: ToolOpenKind, value: string): string {
  return `${kind}:${String(value || '').trim().toLowerCase()}`;
}

function getLegacyProjectConfig(projectRoot?: string | null): MakeServerConfig {
  if (!projectRoot) {
    return DEFAULT_SERVER_CONFIG;
  }
  return normalizeConfig(readJsonFile(getConfigPath(projectRoot)));
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

export function createServerConfigStore(options: ServerConfigStoreOptions = {}) {
  const configPath = options.configPath ? path.resolve(options.configPath) : getGlobalServerConfigPath(options.homeDir);

  return {
    getConfigPath() {
      return configPath;
    },
    getConfig(getOptions: ServerConfigGetOptions = {}): MakeServerConfig {
      if (fs.existsSync(configPath)) {
        return normalizeConfig(readJsonFile(configPath));
      }
      return getLegacyProjectConfig(getOptions.activeProjectRoot);
    },
    saveConfig(input: DeepPartial<MakeServerConfig>): MakeServerConfig {
      const current = fs.existsSync(configPath)
        ? normalizeConfig(readJsonFile(configPath))
        : DEFAULT_SERVER_CONFIG;
      const saved = normalizeConfig(input, current);
      writeJsonAtomic(configPath, saved);
      return saved;
    },
  };
}
