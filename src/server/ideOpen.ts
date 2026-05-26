import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';

export const MAIN_IDE_VALUES = ['cursor', 'trae', 'vscode', 'trae_cn', 'windsurf', 'kiro', 'qoder', 'antigravity'] as const;
export type MainIDE = typeof MAIN_IDE_VALUES[number];

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

const MAIN_IDE_WINDOWS_APP_PATH_NAMES: Record<MainIDE, string[]> = {
  cursor: ['Cursor'],
  trae: ['Trae', 'TRAE'],
  vscode: ['Visual Studio Code', 'Visual Studio Code Insiders'],
  trae_cn: ['Trae CN', 'TRAE CN', 'Trae', 'TRAE'],
  windsurf: ['Windsurf'],
  kiro: ['Kiro'],
  qoder: ['Qoder'],
  antigravity: ['Antigravity'],
};

const MAIN_IDE_WINDOWS_COMMAND_CANDIDATES: Record<MainIDE, string[]> = {
  cursor: ['cursor'],
  trae: ['trae'],
  vscode: ['code', 'code-insiders'],
  trae_cn: ['trae-cn', 'trae_cn', 'trae'],
  windsurf: ['windsurf'],
  kiro: ['kiro'],
  qoder: ['qoder'],
  antigravity: ['antigravity'],
};

const MAIN_IDE_WINDOWS_EXECUTABLE_NAMES: Record<MainIDE, string[]> = {
  cursor: ['Cursor.exe'],
  trae: ['TRAE.exe', 'Trae.exe'],
  vscode: ['Code.exe', 'Code - Insiders.exe'],
  trae_cn: ['Trae CN.exe', 'TRAE CN.exe', 'TRAE.exe', 'Trae.exe'],
  windsurf: ['Windsurf.exe'],
  kiro: ['Kiro.exe'],
  qoder: ['Qoder.exe'],
  antigravity: ['Antigravity.exe'],
};

export interface OpenIDEResult {
  success: true;
  ide: MainIDE;
  targetPath: string;
  command: string;
}

export function normalizeMainIDE(value: unknown): MainIDE | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return MAIN_IDE_VALUES.includes(normalized as MainIDE) ? normalized as MainIDE : null;
}

function quoteForShell(value: string): string {
  return `"${String(value).replace(/["\\$`]/g, '\\$&')}"`;
}

function quoteForPowerShellSingle(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  return String(value || '');
}

function resolveWindowsExecutablePath(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    const result = spawnSync('where', [trimmed], {
      encoding: 'utf8',
      windowsHide: true,
    });

    if (result.status !== 0) continue;

    const lines = String(result.stdout || '')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) continue;

    const exePath = lines.find((line) => /\.exe$/i.test(line));
    if (exePath) {
      return exePath;
    }

    const commandWrapper = lines.find((line) => /\.(cmd|bat)$/i.test(line));
    if (commandWrapper) {
      const inferredExePath = commandWrapper.replace(/\.(cmd|bat)$/i, '.exe');
      if (fs.existsSync(inferredExePath)) {
        return inferredExePath;
      }
      return commandWrapper;
    }

    return lines[0] || null;
  }

  return null;
}

function resolveWindowsExecutableFromRegistry(executableNames: string[]): string | null {
  const keyRoots = [
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths',
    'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  ];

  for (const executableName of executableNames) {
    const normalizedName = executableName.trim();
    if (!normalizedName) continue;

    for (const keyRoot of keyRoots) {
      const key = `${keyRoot}\\${normalizedName}`;
      const query = spawnSync('reg', ['query', key, '/ve'], {
        encoding: 'utf8',
        windowsHide: true,
      });

      if (query.status !== 0 || query.error) {
        continue;
      }

      const output = String(query.stdout || '');
      const matchedLine = output
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .find((line) => /REG_\w+/i.test(line));
      if (!matchedLine) {
        continue;
      }

      const valueMatch = matchedLine.match(/REG_\w+\s+(.+)$/i);
      const resolvedPath = valueMatch?.[1]?.trim().replace(/^"|"$/g, '') || '';
      if (resolvedPath && fs.existsSync(resolvedPath)) {
        return resolvedPath;
      }
    }
  }

  return null;
}

function getSpawnCommandSpec(command: string, args: string[], platform = process.platform) {
  if (platform !== 'win32' || /\.(exe|com)$/i.test(command)) {
    return {
      command,
      args,
      windowsHide: platform === 'win32',
    };
  }

  return {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', [quoteForShell(command), ...args.map(quoteForShell)].join(' ')],
    windowsHide: true,
  };
}

function spawnDetached(command: string, args: string[], options: {
  platform?: NodeJS.Platform;
  windowsHide?: boolean;
  commandLabel?: string;
  errorMessage?: (error: Error) => string;
} = {}): Promise<void> {
  const platform = options.platform || process.platform;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: options.windowsHide ?? platform === 'win32',
      shell: false,
    });

    let settled = false;
    const settleResolve = () => {
      if (settled) return;
      settled = true;
      child.unref();
      resolve();
    };
    const settleReject = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(new Error(options.errorMessage?.(error) || error.message || `Failed to spawn ${options.commandLabel || command}`));
    };

    child.once('error', settleReject);
    child.once('spawn', settleResolve);
  });
}

function tryOpenWindowsIDEByAppPathNames(appPathNames: string[], targetPath: string): Promise<void> {
  const candidates = appPathNames.map((name) => name.trim()).filter(Boolean);
  const commandArgs = (candidate: string) => [
    '-NoProfile',
    '-NonInteractive',
    '-WindowStyle',
    'Hidden',
    '-Command',
    'Start-Process -FilePath $args[0] -ArgumentList $args[1] -ErrorAction Stop',
    candidate,
    targetPath,
  ];

  return new Promise((resolve, reject) => {
    let lastError: Error | null = null;
    const tryNext = (index: number) => {
      if (index >= candidates.length) {
        reject(lastError || new Error('No compatible Windows app path name found'));
        return;
      }

      spawnDetached('powershell', commandArgs(candidates[index]), {
        platform: 'win32',
        windowsHide: true,
        commandLabel: `powershell Start-Process ${candidates[index]}`,
      }).then(resolve).catch((error: Error) => {
          lastError = error;
          tryNext(index + 1);
        });
    };

    tryNext(0);
  });
}

function openWindowsIDE(ide: MainIDE, targetPath: string): Promise<OpenIDEResult> {
  const ideAppName = MAIN_IDE_APP_NAMES[ide];
  const executableCandidates = [
    ...(MAIN_IDE_WINDOWS_COMMAND_CANDIDATES[ide] || []),
    ideAppName,
  ];
  const executableNameCandidates = MAIN_IDE_WINDOWS_EXECUTABLE_NAMES[ide] || [];
  const appPathNames = MAIN_IDE_WINDOWS_APP_PATH_NAMES[ide] || [ideAppName];

  const executablePath =
    resolveWindowsExecutablePath(executableCandidates)
    || resolveWindowsExecutablePath(executableNameCandidates)
    || resolveWindowsExecutableFromRegistry(executableNameCandidates);

  if (!executablePath) {
    const command = `powershell -NoProfile -Command Start-Process -FilePath ${quoteForPowerShellSingle(appPathNames[0] || ideAppName)} -ArgumentList ${quoteForPowerShellSingle(targetPath)} -ErrorAction Stop`;
    return tryOpenWindowsIDEByAppPathNames(appPathNames, targetPath).then(() => ({
      success: true,
      ide,
      targetPath,
      command,
    }));
  }

  const spawnSpec = getSpawnCommandSpec(executablePath, [targetPath], process.platform);
  return spawnDetached(spawnSpec.command, spawnSpec.args, {
    platform: process.platform,
    windowsHide: spawnSpec.windowsHide,
    commandLabel: executablePath,
  }).then(() => ({
    success: true,
    ide,
    targetPath,
    command: `${quoteForShell(executablePath)} ${quoteForShell(targetPath)}`,
  }));
}

function openUnixIDE(ide: MainIDE, targetPath: string): Promise<OpenIDEResult> {
  const ideAppName = MAIN_IDE_APP_NAMES[ide];
  const command = `open -a ${quoteForShell(ideAppName)} ${quoteForShell(targetPath)}`;

  return spawnDetached('open', ['-a', ideAppName, targetPath], {
    platform: process.platform,
    windowsHide: false,
    commandLabel: command,
    errorMessage: (error) => `打开 ${ideAppName} 失败: ${toText(error.message).trim() || 'unknown error'}`,
  }).then(() => ({
    success: true,
    ide,
    targetPath,
    command,
  }));
}

export function openIDEPath({ ide, targetPath }: { ide: MainIDE; targetPath: string }): Promise<OpenIDEResult> {
  if (process.platform === 'win32') {
    return openWindowsIDE(ide, targetPath);
  }

  return openUnixIDE(ide, targetPath);
}
