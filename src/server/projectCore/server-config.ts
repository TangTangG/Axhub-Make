import fs from 'node:fs';
import path from 'node:path';

import { getConfigPath, getGlobalServerConfigPath } from './paths.ts';

export type ServerPromptClientPreference = 'genie:codex' | 'genie:claude' | 'genie:gemini' | 'manual';
export type ServerAcpxExecutionMode = 'prompt' | 'exec';
export type ServerAcpxPermissionMode = 'approve-all';

export type ServerIDEPreference =
  | 'cursor'
  | 'trae'
  | 'trae_cn'
  | 'windsurf'
  | 'vscode'
  | 'antigravity'
  | 'kiro'
  | 'qoder'
  | 'none'
  | `web:${string}`
  | `cli:${string}`;

export type ExcalidrawPropertyPanelModePreference = 'collapsed' | 'expanded';
export type ExcalidrawPropertyPanelPositionPreference = 'left' | 'right';
export type AiImageGenerationApiMode = 'images' | 'responses';
export type AiImageGenerationQuality = 'auto' | 'low' | 'medium' | 'high';
export type AiImageGenerationOutputFormat = 'png' | 'jpeg' | 'webp';
export type AiImageGenerationModeration = 'auto' | 'low';

export interface AiImageGenerationConfig {
  baseUrl: string;
  apiKey: string | null;
  model: string;
  apiMode: AiImageGenerationApiMode;
  timeout: number;
  size: string;
  quality: AiImageGenerationQuality;
  outputFormat: AiImageGenerationOutputFormat;
  outputCompression: number | null;
  moderation: AiImageGenerationModeration;
  n: number;
  codexCli: boolean;
  responseFormatB64Json: boolean;
}

export interface MakeServerConfig {
  automation: {
    defaultPromptClient: ServerPromptClientPreference;
    defaultIDE: ServerIDEPreference;
    acpx: {
      mode: ServerAcpxExecutionMode;
      permission: ServerAcpxPermissionMode;
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
    defaultPromptClient: 'genie:codex',
    defaultIDE: 'none',
    acpx: {
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
      apiMode: 'images',
      timeout: 600,
      size: 'auto',
      quality: 'auto',
      outputFormat: 'png',
      outputCompression: null,
      moderation: 'auto',
      n: 1,
      codexCli: false,
      responseFormatB64Json: true,
    },
  },
  uiPreferences: {
    excalidrawPropertyPanelMode: 'collapsed',
    excalidrawPropertyPanelPosition: 'right',
  },
};

const PROMPT_CLIENT_VALUES = new Set<ServerPromptClientPreference>([
  'genie:codex',
  'genie:claude',
  'genie:gemini',
  'manual',
]);

const IDE_VALUES = new Set<ServerIDEPreference>([
  'cursor',
  'trae',
  'trae_cn',
  'windsurf',
  'vscode',
  'antigravity',
  'kiro',
  'qoder',
  'none',
]);

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

function normalizeOutputCompression(value: unknown, fallback: number | null): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.round(value);
  return rounded >= 0 && rounded <= 100 ? rounded : fallback;
}

function normalizeAiImageGenerationConfig(
  input: unknown,
  fallback: AiImageGenerationConfig,
): AiImageGenerationConfig {
  const data = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const apiMode = data.apiMode === 'images' || data.apiMode === 'responses'
    ? data.apiMode
    : fallback.apiMode;
  const quality = data.quality === 'auto' || data.quality === 'low' || data.quality === 'medium' || data.quality === 'high'
    ? data.quality
    : fallback.quality;
  const outputFormat = data.outputFormat === 'png' || data.outputFormat === 'jpeg' || data.outputFormat === 'webp'
    ? data.outputFormat
    : fallback.outputFormat;
  const moderation = data.moderation === 'auto' || data.moderation === 'low'
    ? data.moderation
    : fallback.moderation;

  return {
    baseUrl: hasOwn(data, 'baseUrl') ? normalizeBaseUrl(data.baseUrl, fallback.baseUrl) : fallback.baseUrl,
    apiKey: hasOwn(data, 'apiKey') ? normalizeNullableString(data.apiKey) : fallback.apiKey,
    model: hasOwn(data, 'model') ? normalizeOptionalString(data.model, fallback.model) : fallback.model,
    apiMode,
    timeout: hasOwn(data, 'timeout') ? normalizePositiveInteger(data.timeout, fallback.timeout, { min: 5, max: 3600 }) : fallback.timeout,
    size: hasOwn(data, 'size') ? normalizeOptionalString(data.size, fallback.size) : fallback.size,
    quality,
    outputFormat,
    outputCompression: hasOwn(data, 'outputCompression')
      ? normalizeOutputCompression(data.outputCompression, fallback.outputCompression)
      : fallback.outputCompression,
    moderation,
    n: hasOwn(data, 'n') ? normalizePositiveInteger(data.n, fallback.n, { min: 1, max: 10 }) : fallback.n,
    codexCli: hasOwn(data, 'codexCli') ? Boolean(data.codexCli) : fallback.codexCli,
    responseFormatB64Json: hasOwn(data, 'responseFormatB64Json')
      ? Boolean(data.responseFormatB64Json)
      : fallback.responseFormatB64Json,
  };
}

function normalizePromptClient(value: unknown, fallback: ServerPromptClientPreference): ServerPromptClientPreference {
  if (value === null) {
    return 'manual';
  }
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'codex') return 'genie:codex';
  if (normalized === 'claude') return 'genie:claude';
  if (normalized === 'gemini') return 'genie:gemini';
  if (PROMPT_CLIENT_VALUES.has(normalized as ServerPromptClientPreference)) {
    return normalized as ServerPromptClientPreference;
  }
  return fallback;
}

function normalizeAcpxConfig(
  value: unknown,
  fallback: MakeServerConfig['automation']['acpx'],
): MakeServerConfig['automation']['acpx'] {
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
      acpx: hasOwn(automation, 'acpx')
        ? normalizeAcpxConfig(automation.acpx, fallback.automation.acpx)
        : fallback.automation.acpx,
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
  };
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
