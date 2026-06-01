import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync as nodeSpawnSync } from 'node:child_process';

import { MAIN_IDE_VALUES, type MainIDE } from './ideOpen.ts';
import { getIDEFileProtocolSchemes } from './ideProtocol.ts';

export type IDEAvailabilityStatus = 'installed' | 'missing' | 'unknown';
export type IDEAvailabilityConfidence = 'high' | 'low';

export interface IDEAvailabilityInfo {
  status: IDEAvailabilityStatus;
  confidence: IDEAvailabilityConfidence;
  checkedAt: string;
  source?: string;
  path?: string;
  reason?: string;
}

export type IDEAvailabilityMap = Partial<Record<MainIDE, IDEAvailabilityInfo>>;

type SpawnSyncLike = (
  command: string,
  args?: readonly string[],
  options?: Record<string, unknown>,
) => {
  status?: number | null;
  stdout?: unknown;
  stderr?: unknown;
  error?: Error;
};

interface IDEAvailabilityDetectorOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  existsSync?: (path: fs.PathLike) => boolean;
  spawnSync?: SpawnSyncLike;
  checkedAt?: () => string;
}

const MAIN_IDE_APP_NAMES: Record<MainIDE, string> = {
  cursor: 'Cursor',
  trae: 'TRAE',
  vscode: 'Visual Studio Code',
  trae_cn: 'TRAE CN',
  windsurf: 'Windsurf',
  kiro: 'Kiro',
  qoder: 'Qoder',
  antigravity: 'Antigravity',
};

const MAC_APP_NAME_CANDIDATES: Record<MainIDE, string[]> = {
  cursor: ['Cursor'],
  trae: ['Trae', 'TRAE'],
  vscode: ['Visual Studio Code', 'Visual Studio Code - Insiders'],
  trae_cn: ['Trae CN', 'TRAE CN'],
  windsurf: ['Windsurf'],
  kiro: ['Kiro'],
  qoder: ['Qoder'],
  antigravity: ['Antigravity'],
};

const WINDOWS_COMMAND_CANDIDATES: Record<MainIDE, string[]> = {
  cursor: ['cursor'],
  trae: ['trae'],
  vscode: ['code', 'code-insiders'],
  trae_cn: ['trae-cn', 'trae_cn', 'trae'],
  windsurf: ['windsurf'],
  kiro: ['kiro'],
  qoder: ['qoder'],
  antigravity: ['antigravity'],
};

const WINDOWS_EXECUTABLE_NAMES: Record<MainIDE, string[]> = {
  cursor: ['Cursor.exe'],
  trae: ['TRAE.exe', 'Trae.exe'],
  vscode: ['Code.exe', 'Code - Insiders.exe'],
  trae_cn: ['Trae CN.exe', 'TRAE CN.exe', 'TRAE.exe', 'Trae.exe'],
  windsurf: ['Windsurf.exe'],
  kiro: ['Kiro.exe'],
  qoder: ['Qoder.exe'],
  antigravity: ['Antigravity.exe'],
};

function toText(value: unknown): string {
  if (!value) return '';
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  return String(value);
}

function createInfo(
  status: IDEAvailabilityStatus,
  confidence: IDEAvailabilityConfidence,
  checkedAt: string,
  details: Omit<IDEAvailabilityInfo, 'status' | 'confidence' | 'checkedAt'> = {},
): IDEAvailabilityInfo {
  return {
    status,
    confidence,
    checkedAt,
    ...details,
  };
}

function macApplicationPaths(appName: string, homeDir: string): string[] {
  return [
    `/Applications/${appName}.app`,
    `/System/Applications/${appName}.app`,
    path.join(homeDir, 'Applications', `${appName}.app`),
  ];
}

function getMacBundleIdCandidates(ide: MainIDE): string[] {
  const appNames = MAC_APP_NAME_CANDIDATES[ide] || [MAIN_IDE_APP_NAMES[ide]];
  return appNames.map((name) => `kMDItemCFBundleName == "${name}"c`);
}

function parseFirstOutputLine(output: unknown): string {
  return toText(output)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean) || '';
}

function resolveWindowsExecutablePath(
  candidates: string[],
  spawnSync: SpawnSyncLike,
  existsSync: (path: fs.PathLike) => boolean,
): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    const result = spawnSync('where', [trimmed], {
      encoding: 'utf8',
      windowsHide: true,
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) continue;

    const lines = toText(result.stdout)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    const exePath = lines.find((line) => /\.exe$/i.test(line));
    if (exePath) return exePath;

    const commandWrapper = lines.find((line) => /\.(cmd|bat)$/i.test(line));
    if (commandWrapper) {
      const inferredExePath = commandWrapper.replace(/\.(cmd|bat)$/i, '.exe');
      return existsSync(inferredExePath) ? inferredExePath : commandWrapper;
    }

    return lines[0] || null;
  }

  return null;
}

function resolveWindowsExecutableFromRegistry(
  executableNames: string[],
  spawnSync: SpawnSyncLike,
): string | null {
  const keyRoots = [
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths',
    'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  ];

  for (const executableName of executableNames) {
    const normalizedName = executableName.trim();
    if (!normalizedName) continue;

    for (const keyRoot of keyRoots) {
      const query = spawnSync('reg', ['query', `${keyRoot}\\${normalizedName}`, '/ve'], {
        encoding: 'utf8',
        windowsHide: true,
      });

      if (query.error) {
        throw query.error;
      }
      if (query.status !== 0) continue;

      const matchedLine = toText(query.stdout)
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .find((line) => /REG_\w+/i.test(line));
      if (!matchedLine) continue;

      const valueMatch = matchedLine.match(/REG_\w+\s+(.+)$/i);
      const resolvedPath = valueMatch?.[1]?.trim().replace(/^"|"$/g, '');
      if (resolvedPath) return resolvedPath;
    }
  }

  return null;
}

function resolveWindowsProtocolRegistration(
  schemes: string[],
  spawnSync: SpawnSyncLike,
): string | null {
  const keyRoots = [
    'HKCU\\Software\\Classes',
    'HKLM\\Software\\Classes',
    'HKLM\\Software\\WOW6432Node\\Classes',
  ];

  for (const scheme of schemes) {
    const normalizedScheme = scheme.trim();
    if (!normalizedScheme) continue;

    for (const keyRoot of keyRoots) {
      const query = spawnSync('reg', ['query', `${keyRoot}\\${normalizedScheme}\\shell\\open\\command`, '/ve'], {
        encoding: 'utf8',
        windowsHide: true,
      });

      if (query.error) {
        throw query.error;
      }
      if (query.status === 0) {
        return `${normalizedScheme}://`;
      }
    }
  }

  return null;
}

export function createIDEAvailabilityDetector(options: IDEAvailabilityDetectorOptions = {}) {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  const existsSync = options.existsSync ?? fs.existsSync;
  const spawnSync = options.spawnSync ?? nodeSpawnSync;
  const getCheckedAt = options.checkedAt ?? (() => new Date().toISOString());

  const detectMacIDEAvailability = (ide: MainIDE): IDEAvailabilityInfo => {
    const checkedAt = getCheckedAt();
    try {
      const appNames = MAC_APP_NAME_CANDIDATES[ide] || [MAIN_IDE_APP_NAMES[ide]];
      for (const appName of appNames) {
        const matchedPath = macApplicationPaths(appName, homeDir).find((candidate) => existsSync(candidate));
        if (matchedPath) {
          return createInfo('installed', 'high', checkedAt, {
            source: 'mac-app-path',
            path: matchedPath,
          });
        }
      }

      for (const query of getMacBundleIdCandidates(ide)) {
        const result = spawnSync('mdfind', [query], {
          encoding: 'utf8',
          timeout: 1500,
          maxBuffer: 1024 * 256,
        });
        if (result.error) {
          throw result.error;
        }
        if (result.status === 0) {
          const matchedPath = parseFirstOutputLine(result.stdout);
          if (matchedPath) {
            return createInfo('installed', 'high', checkedAt, {
              source: 'mac-mdfind',
              path: matchedPath,
            });
          }
        }
      }

      return createInfo('missing', 'high', checkedAt, {
        source: 'mac-app-path+mdfind',
      });
    } catch (error: any) {
      return createInfo('unknown', 'low', checkedAt, {
        source: 'mac-probe-error',
        reason: error?.message || String(error),
      });
    }
  };

  const detectWindowsIDEAvailability = (ide: MainIDE): IDEAvailabilityInfo => {
    const checkedAt = getCheckedAt();
    try {
      const executablePath =
        resolveWindowsExecutablePath(WINDOWS_COMMAND_CANDIDATES[ide] || [], spawnSync, existsSync)
        || resolveWindowsExecutablePath(WINDOWS_EXECUTABLE_NAMES[ide] || [], spawnSync, existsSync)
        || resolveWindowsExecutableFromRegistry(WINDOWS_EXECUTABLE_NAMES[ide] || [], spawnSync);

      if (executablePath) {
        return createInfo('installed', 'high', checkedAt, {
          source: 'windows-executable',
          path: executablePath,
        });
      }

      const protocolRegistration = resolveWindowsProtocolRegistration(getIDEFileProtocolSchemes(ide), spawnSync);
      if (protocolRegistration) {
        return createInfo('installed', 'high', checkedAt, {
          source: 'windows-url-protocol',
          path: protocolRegistration,
        });
      }

      return createInfo('missing', 'high', checkedAt, {
        source: 'windows-where+registry+protocol',
      });
    } catch (error: any) {
      return createInfo('unknown', 'low', checkedAt, {
        source: 'windows-probe-error',
        reason: error?.message || String(error),
      });
    }
  };

  const detectIDEAvailability = (ide: MainIDE): IDEAvailabilityInfo => {
    if (platform === 'darwin') {
      return detectMacIDEAvailability(ide);
    }
    if (platform === 'win32') {
      return detectWindowsIDEAvailability(ide);
    }

    return createInfo('unknown', 'low', getCheckedAt(), {
      source: 'unsupported-platform',
      reason: `Unsupported platform: ${platform}`,
    });
  };

  const detectAllIDEAvailability = (): IDEAvailabilityMap => {
    return Object.fromEntries(
      MAIN_IDE_VALUES.map((ide) => [ide, detectIDEAvailability(ide)]),
    ) as IDEAvailabilityMap;
  };

  return {
    detectIDEAvailability,
    detectAllIDEAvailability,
  };
}

export function detectIDEAvailabilityAtStartup(): IDEAvailabilityMap {
  return createIDEAvailabilityDetector().detectAllIDEAvailability();
}

export function getMissingIDEOpenError(ide: MainIDE, availability: IDEAvailabilityMap) {
  const info = availability[ide];
  if (info?.status !== 'missing') {
    return null;
  }

  return {
    statusCode: 404,
    body: {
      error: `未检测到 ${MAIN_IDE_APP_NAMES[ide]}，请先安装后再试`,
      code: 'MAIN_IDE_MISSING',
      ide,
      availability: info,
    },
  };
}
