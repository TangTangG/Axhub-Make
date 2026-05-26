import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { AiImageGenerationConfig } from './server-config.ts';

export interface CodexLocalConfigPathsOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  env?: Record<string, string | undefined>;
}

export interface CodexLocalImageGenerationConfigOptions extends CodexLocalConfigPathsOptions {
  configPaths?: string[];
  authPaths?: string[];
}

export interface CodexLocalImageGenerationConfigResult {
  ready: boolean;
  config: AiImageGenerationConfig;
  discovery: {
    configFiles: string[];
    authFile: string | null;
    scannedConfigPaths: string[];
    scannedAuthPaths: string[];
  };
  warnings: Array<{ path?: string; message: string }>;
}

const CODEX_IMAGE_MODEL = 'gpt-image-2';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

const DEFAULT_IMAGE_CONFIG: AiImageGenerationConfig = {
  baseUrl: DEFAULT_OPENAI_BASE_URL,
  apiKey: null,
  model: CODEX_IMAGE_MODEL,
  apiMode: 'images',
  timeout: 600,
  size: 'auto',
  quality: 'auto',
  outputFormat: 'png',
  outputCompression: null,
  moderation: 'auto',
  n: 1,
  codexCli: true,
  responseFormatB64Json: true,
};

function dedupePaths(paths: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of paths) {
    if (typeof item !== 'string' || !item.trim()) continue;
    const key = item.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

function splitPathList(value: string | undefined, delimiter = path.delimiter): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.split(delimiter).map((item) => item.trim()).filter(Boolean);
}

function getUnixConfigDirs(env: Record<string, string | undefined>): string[] {
  const configuredDirs = splitPathList(env.XDG_CONFIG_DIRS, ':');
  return dedupePaths([...(configuredDirs.length ? configuredDirs : ['/etc/xdg']), '/etc']);
}

function getWindowsConfigDirs(env: Record<string, string | undefined>, homeDir: string): string[] {
  return dedupePaths([
    env.APPDATA ? path.win32.join(env.APPDATA, 'Codex') : null,
    env.LOCALAPPDATA ? path.win32.join(env.LOCALAPPDATA, 'Codex') : null,
    env.PROGRAMDATA ? path.win32.join(env.PROGRAMDATA, 'Codex') : 'C:\\ProgramData\\Codex',
    path.win32.join(homeDir, 'AppData', 'Roaming', 'Codex'),
    path.win32.join(homeDir, 'AppData', 'Local', 'Codex'),
  ]);
}

export function createCodexLocalConfigPaths(options: CodexLocalConfigPathsOptions = {}) {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  const env = options.env ?? process.env;
  const useWin32 = platform === 'win32';
  const pathApi = useWin32 ? path.win32 : path.posix;
  const codexHome = pathApi.join(homeDir, '.codex');
  const configuredCodexHome = typeof env.CODEX_HOME === 'string' && env.CODEX_HOME.trim()
    ? env.CODEX_HOME.trim()
    : null;
  const configDirs: string[] = [];

  if (useWin32) {
    configDirs.push(...getWindowsConfigDirs(env, homeDir));
  } else {
    configDirs.push(env.XDG_CONFIG_HOME
      ? pathApi.join(env.XDG_CONFIG_HOME, 'codex')
      : pathApi.join(homeDir, '.config', 'codex'));
    configDirs.push(...getUnixConfigDirs(env).map((dir) => pathApi.join(dir, 'codex')));
    if (platform === 'darwin') {
      configDirs.push('/Library/Application Support/Codex');
    }
  }

  const roots = dedupePaths([configuredCodexHome, codexHome, ...configDirs]);
  return {
    authPaths: roots.map((root) => pathApi.join(root, 'auth.json')),
    configPaths: roots.map((root) => pathApi.join(root, 'config.toml')),
  };
}

function readExistingTextFiles(paths: string[]): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  for (const filePath of paths) {
    try {
      files.push({ path: filePath, content: fs.readFileSync(filePath, 'utf8') });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
    }
  }
  return files;
}

function parseTomlScalar(rawValue: string): unknown {
  const value = rawValue.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function setNestedValue(target: Record<string, any>, dottedPath: string[], key: string, value: unknown): void {
  let cursor = target;
  for (const segment of dottedPath) {
    if (!cursor[segment] || typeof cursor[segment] !== 'object' || Array.isArray(cursor[segment])) {
      cursor[segment] = {};
    }
    cursor = cursor[segment];
  }
  cursor[key] = value;
}

function parseCodexToml(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  let section: string[] = [];
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.replace(/\s+#.*$/u, '').trim();
    if (!line) continue;
    const sectionMatch = /^\[([^\]]+)\]$/u.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1].split('.').map((item) => item.trim()).filter(Boolean);
      continue;
    }
    const assignmentMatch = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/u.exec(line);
    if (!assignmentMatch) continue;
    setNestedValue(result, section, assignmentMatch[1], parseTomlScalar(assignmentMatch[2]));
  }
  return result;
}

function mergePlainObjects(base: Record<string, any>, override: Record<string, any>): Record<string, any> {
  const next = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      next[key] &&
      typeof next[key] === 'object' &&
      !Array.isArray(next[key])
    ) {
      next[key] = mergePlainObjects(next[key], value as Record<string, any>);
    } else {
      next[key] = value;
    }
  }
  return next;
}

function parseConfigFiles(files: Array<{ path: string; content: string }>) {
  const warnings: Array<{ path: string; message: string }> = [];
  let config: Record<string, any> = {};
  for (const file of files) {
    try {
      config = mergePlainObjects(config, parseCodexToml(file.content));
    } catch (error) {
      warnings.push({
        path: file.path,
        message: `Failed to parse Codex config: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
  return { config, warnings };
}

function normalizeBaseUrl(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return (trimmed || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/u, '');
}

function getActiveProvider(config: Record<string, any>) {
  const providerId = typeof config.model_provider === 'string' ? config.model_provider.trim() : '';
  const providers = config.model_providers && typeof config.model_providers === 'object'
    ? config.model_providers
    : {};
  const provider = providerId ? providers[providerId] : null;
  return provider && typeof provider === 'object' ? provider : null;
}

function readApiKeyFromAuth(auth: unknown): string {
  if (!auth || typeof auth !== 'object') return '';
  const record = auth as Record<string, unknown>;
  for (const key of ['OPENAI_API_KEY', 'openaiApiKey', 'api_key']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function readFirstAuth(authPaths: string[]) {
  const files = readExistingTextFiles(authPaths);
  for (const file of files) {
    try {
      const apiKey = readApiKeyFromAuth(JSON.parse(file.content));
      if (apiKey) {
        return { apiKey, authFile: file.path };
      }
    } catch {
      // Ignore malformed auth candidates and continue scanning.
    }
  }
  return { apiKey: '', authFile: files[0]?.path ?? null };
}

export function resolveCodexLocalImageGenerationConfig(
  options: CodexLocalImageGenerationConfigOptions = {},
): CodexLocalImageGenerationConfigResult {
  const paths = options.configPaths && options.authPaths
    ? { configPaths: options.configPaths, authPaths: options.authPaths }
    : createCodexLocalConfigPaths(options);
  const configFiles = readExistingTextFiles(paths.configPaths);
  const { config, warnings } = parseConfigFiles(configFiles);
  const provider = getActiveProvider(config);
  const { apiKey, authFile } = readFirstAuth(paths.authPaths);
  const ready = Boolean(apiKey);

  return {
    ready,
    config: {
      ...DEFAULT_IMAGE_CONFIG,
      baseUrl: normalizeBaseUrl(provider?.base_url ?? config.base_url),
      apiKey: apiKey || null,
    },
    discovery: {
      configFiles: configFiles.map((file) => file.path),
      authFile,
      scannedConfigPaths: paths.configPaths,
      scannedAuthPaths: paths.authPaths,
    },
    warnings: ready
      ? warnings
      : [...warnings, { message: 'No OpenAI API key found in Codex auth files.' }],
  };
}
