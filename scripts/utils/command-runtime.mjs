import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function getEnvValue(env, key) {
  if (!env) return undefined;
  const direct = env[key];
  if (typeof direct === 'string' && direct.length > 0) return direct;
  const matchedKey = Object.keys(env).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  if (!matchedKey) return undefined;
  const value = env[matchedKey];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getWindowsPathExtList(env) {
  const pathExt = getEnvValue(env, 'PATHEXT') || '.COM;.EXE;.BAT;.CMD';
  return pathExt
    .split(';')
    .map((ext) => ext.trim())
    .filter(Boolean)
    .map((ext) => (ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`));
}

function quoteForCmdExec(value) {
  if (!value) return '""';
  if (!/[\s"&^|<>]/.test(value)) return value;
  const escaped = String(value)
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\+)$/g, '$1$1');
  return `"${escaped}"`;
}

function buildWindowsCommandLine(command, args) {
  return [command, ...args].map((part) => quoteForCmdExec(String(part))).join(' ');
}

function resolveWindowsCommand(command, env) {
  if (!command || typeof command !== 'string') return command;
  const trimmed = command.trim();
  if (!trimmed) return trimmed;

  const hasPathSeparator = /[\\/]/.test(trimmed);
  const ext = path.extname(trimmed);
  const pathExts = ext ? [''] : getWindowsPathExtList(env);
  const candidateDirs = hasPathSeparator
    ? ['']
    : (getEnvValue(env, 'PATH') || '').split(';').map((entry) => entry.trim()).filter(Boolean);
  const baseCandidates = hasPathSeparator ? [trimmed] : candidateDirs.map((dir) => path.join(dir, trimmed));

  for (const baseCandidate of baseCandidates) {
    for (const suffix of pathExts) {
      const fullPath = suffix ? `${baseCandidate}${suffix}` : baseCandidate;
      if (fs.existsSync(fullPath)) return fullPath;
    }
  }

  return trimmed;
}

function shouldUseWindowsCmdWrapper(platform, command) {
  if (platform !== 'win32') return false;
  return /\.(cmd|bat)$/i.test(command) || !/\.(exe|com)$/i.test(command);
}

function getSpawnSpec(command, args, platform = process.platform, env = process.env) {
  const resolvedCommand = platform === 'win32' ? resolveWindowsCommand(command, env) : command;
  if (!shouldUseWindowsCmdWrapper(platform, resolvedCommand)) {
    return {
      command: resolvedCommand,
      args,
      windowsHide: platform === 'win32',
    };
  }
  return {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', buildWindowsCommandLine(resolvedCommand, args)],
    windowsHide: true,
  };
}

export function runCommandSync(options) {
  const {
    command,
    args = [],
    cwd,
    env,
    timeoutMs,
    maxBuffer,
  } = options;

  const mergedEnv = env ? { ...process.env, ...env } : process.env;
  const spawnSpec = getSpawnSpec(command, args, process.platform, mergedEnv);
  const result = spawnSync(spawnSpec.command, spawnSpec.args, {
    cwd,
    env: mergedEnv,
    timeout: timeoutMs,
    maxBuffer,
    windowsHide: spawnSpec.windowsHide,
    encoding: 'utf8',
  });

  return {
    command,
    args,
    spawnCommand: spawnSpec.command,
    spawnArgs: spawnSpec.args,
    status: typeof result.status === 'number' ? result.status : null,
    signal: result.signal || null,
    error: result.error || null,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}
