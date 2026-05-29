import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

import {
  DEFAULT_MAKE_CLIENT_REPOSITORY,
  fetchHealth,
  getRuntimeServerInfoPath,
  isProcessAlive,
  isLiveLocalServerInfo,
  normalizeHealthServerInfo,
  readMakeClientMarker,
  readServerInfo,
  resolveComparableProjectRoot,
  validateMakeClientProject,
  writeMakeClientMarker,
  writeServerInfo,
  type AxhubServerInfo,
  type MakeClientMarker,
} from './projectCore/index.ts';

import { buildLocalCommandEnv, runLocalCommand } from './localCommand.ts';

export type MakeClientPhase =
  | 'template'
  | 'install'
  | 'metadata'
  | 'dev'
  | 'ready';

export interface MakeClientCommandRunner {
  runCommand?: typeof runLocalCommand;
  spawn: typeof spawn;
}

export interface MakeClientOrchestrationOptions {
  adminServerInfo?: AxhubServerInfo;
  commandRunner?: MakeClientCommandRunner;
  devTimeoutMs?: number;
  healthTimeoutMs?: number;
  pollIntervalMs?: number;
}

export interface MakeClientDevResult {
  success: true;
  reused: boolean;
  phase: MakeClientPhase;
  runtime: AxhubServerInfo;
}

export interface MakeClientDevStatus {
  projectId: string;
  makeClient: boolean;
  running: boolean;
  runtime?: AxhubServerInfo;
  reason?: 'not-make-client' | 'not-running' | 'stale-runtime';
}

export interface MakeClientStopResult {
  success: true;
  projectId: string;
  stopped: boolean;
  runtime?: AxhubServerInfo;
  status: MakeClientDevStatus;
}

export const MAKE_CLIENT_ERROR_STATUS: Record<string, number> = {
  NOT_MAKE_CLIENT_PROJECT: 400,
  MAKE_PROJECT_ID_CONFLICT: 409,
  MAKE_CLIENT_SOURCE_UNAVAILABLE: 502,
  MAKE_CLIENT_TEMPLATE_UNAVAILABLE: 500,
  MAKE_CLIENT_INSTALL_FAILED: 500,
  MAKE_CLIENT_METADATA_SYNC_FAILED: 500,
  MAKE_CLIENT_DEV_TIMEOUT: 504,
  PNPM_NOT_FOUND: 500,
  INVALID_MAKE_PROJECT_FOLDER_NAME: 400,
  MAKE_PROJECT_TARGET_NOT_EMPTY: 409,
};

export class MakeClientProjectError extends Error {
  code: string;
  status: number;
  phase?: MakeClientPhase;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, options: { status?: number; phase?: MakeClientPhase; details?: Record<string, unknown> } = {}) {
    super(message);
    this.code = code;
    this.status = options.status ?? MAKE_CLIENT_ERROR_STATUS[code] ?? 500;
    this.phase = options.phase;
    this.details = options.details;
  }
}

function defaultCommandRunner(): MakeClientCommandRunner {
  return { runCommand: runLocalCommand, spawn };
}

export const MAKE_CLIENT_TEMPLATE_PATH = 'client';
export const MAKE_CLIENT_TEMPLATE_ZIP_NAME = 'axhub-make-client-template.zip';
export const DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION = '0.1.1';
export const MAKE_CLIENT_TEMPLATE_URL_ENV = 'AXHUB_MAKE_CLIENT_TEMPLATE_URL';
export const PRIMARY_MAKE_CLIENT_TEMPLATE_RELEASE_REPOSITORY = 'lintendo/Axhub-Make';
export const GITEE_MAKE_CLIENT_TEMPLATE_RELEASE_BASE_URL = 'https://gitee.com/axhub/Axhub-Make/releases/download';
const MAKE_CLIENT_TEMPLATE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SKIP_AUTO_START_SERVER_ENV = 'AXHUB_MAKE_SKIP_AUTO_START_SERVER';
const MAKE_CLIENT_RUNTIME_HEARTBEAT_MAX_AGE_MS = 15_000;
const DEFAULT_MAKE_CLIENT_TEMPLATE_TIMEOUT_MS = 3 * 60_000;
const DEFAULT_MAKE_CLIENT_INSTALL_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_MAKE_CLIENT_DEV_TIMEOUT_MS = 60_000;
const DEFAULT_MAKE_CLIENT_DEV_POLL_INTERVAL_MS = 250;
const DEFAULT_MAKE_CLIENT_DEV_PORT = 51720;
const MAKE_CLIENT_RUNTIME_DISCOVERY_PORT_SPAN = 20;
const MAKE_CLIENT_RUNTIME_DISCOVERY_HEALTH_TIMEOUT_MS = 250;

const TEMPLATE_COPY_IGNORED_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  '.vite',
  '.local',
  '.opencode',
  '.trae',
  'coverage',
  'tests',
  '.cache',
  'tmp',
  'temp',
]);
const TEMPLATE_COPY_IGNORED_FILES = new Set([
  '.DS_Store',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.admin-server-info.json',
  '.dev-server-info.json',
  'axhub.config.json',
  'entries.json',
]);
const TEMPLATE_COPY_IGNORED_AXHUB_MAKE_NAMES = new Set([
  'edit-history',
  'exports',
  'sessions',
]);
const TEMPLATE_COPY_ALLOWED_AXHUB_MAKE_FILES = new Set([
  '.axhub/make/client.json',
  '.axhub/make/README.md',
  '.axhub/make/sidebar-tree.json',
]);

export interface MakeClientTemplateSource {
  id: 'env' | 'github' | 'gitee';
  url: string;
  markerRepository: string;
  templateVersion?: string;
}

export function makeClientTemplateSources(options: { env?: NodeJS.ProcessEnv; version?: string } = {}): MakeClientTemplateSource[] {
  const env = options.env || process.env;
  const overrideUrl = typeof env[MAKE_CLIENT_TEMPLATE_URL_ENV] === 'string'
    ? env[MAKE_CLIENT_TEMPLATE_URL_ENV]?.trim()
    : '';
  if (overrideUrl) {
    return [{
      id: 'env',
      url: overrideUrl,
      markerRepository: overrideUrl,
    }];
  }
  const version = options.version || DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION;
  const tagName = `make-client-template-v${version}`;
  return [
    {
      id: 'github',
      url: `https://github.com/${PRIMARY_MAKE_CLIENT_TEMPLATE_RELEASE_REPOSITORY}/releases/download/${tagName}/${MAKE_CLIENT_TEMPLATE_ZIP_NAME}`,
      markerRepository: DEFAULT_MAKE_CLIENT_REPOSITORY,
      templateVersion: version,
    },
    {
      id: 'gitee',
      url: `${GITEE_MAKE_CLIENT_TEMPLATE_RELEASE_BASE_URL}/${tagName}/${MAKE_CLIENT_TEMPLATE_ZIP_NAME}`,
      markerRepository: 'https://gitee.com/axhub/Axhub-Make/tree/main/client',
      templateVersion: version,
    },
  ];
}

export function slugifyMakeClientFolderName(input: string): string {
    return String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/[._-]{2,}/gu, '-')
    .replace(/[._-]+$/gu, '')
    .replace(/^[._-]+/gu, '')
    .slice(0, 80);
}

const WINDOWS_RESERVED_FOLDER_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;

function formatLocalDateStamp(now = new Date()): string {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function normalizeSuggestedFolderBase(projectName: string, now = new Date()): string {
  const baseName = slugifyMakeClientFolderName(projectName);
  const safeBaseName = baseName && !WINDOWS_RESERVED_FOLDER_NAMES.test(baseName)
    ? baseName
    : `make-project-${formatLocalDateStamp(now)}`;
  return safeBaseName.slice(0, 64);
}

export function suggestMakeClientFolderName(params: {
  parentRoot?: string;
  projectName?: string;
  now?: Date;
}): string {
  const baseName = normalizeSuggestedFolderBase(String(params.projectName || ''), params.now);
  const parentRoot = String(params.parentRoot || '').trim();
  if (!parentRoot) {
    return baseName;
  }
  const resolvedParentRoot = path.resolve(parentRoot);
  if (!fs.existsSync(resolvedParentRoot) || !fs.statSync(resolvedParentRoot).isDirectory()) {
    throw new MakeClientProjectError('INVALID_MAKE_PROJECT_FOLDER_NAME', 'Parent folder does not exist', { status: 400 });
  }
  if (!fs.existsSync(path.join(resolvedParentRoot, baseName))) {
    return baseName;
  }
  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${baseName}-${index}`;
    if (!fs.existsSync(path.join(resolvedParentRoot, candidate))) {
      return candidate;
    }
  }
  throw new MakeClientProjectError('MAKE_PROJECT_TARGET_NOT_EMPTY', 'No available Make project folder name', { status: 409 });
}

export function assertSafeMakeClientFolderName(input: string): string {
  const raw = String(input || '').trim();
  if (
    !raw
    || raw === '.'
    || raw === '..'
    || raw.includes('/')
    || raw.includes('\\')
    || path.isAbsolute(raw)
    || /^[a-z]:/iu.test(raw)
    || /[<>:"|?*\u0000-\u001f]/u.test(raw)
    || /[ .]$/u.test(String(input || ''))
    || WINDOWS_RESERVED_FOLDER_NAMES.test(raw)
  ) {
    throw new MakeClientProjectError(
      'INVALID_MAKE_PROJECT_FOLDER_NAME',
      'Invalid Make project folder name',
      { status: 400 },
    );
  }
  return raw.slice(0, 80);
}

async function runMakeClientCommand(
  runner: MakeClientCommandRunner,
  command: string,
  args: string[],
  cwd: string,
  phase: MakeClientPhase,
  options: { timeoutMs?: number } = {},
): Promise<void> {
  const runCommand = runner.runCommand || runLocalCommand;
  try {
    await runCommand(command, args, {
      cwd,
      maxBuffer: 1024 * 1024 * 20,
      ...(typeof options.timeoutMs === 'number' ? { timeoutMs: options.timeoutMs } : {}),
    });
  } catch (error: any) {
    const output = String(error?.stderr || error?.stdout || error?.message || '').trim();
    const errorCode = String(error?.code || '');
    const code = command === 'pnpm' && /ENOENT|not found|command not found/iu.test(output || errorCode)
      ? 'PNPM_NOT_FOUND'
      : phase === 'template'
        ? 'MAKE_CLIENT_TEMPLATE_UNAVAILABLE'
        : phase === 'install'
          ? 'MAKE_CLIENT_INSTALL_FAILED'
          : 'MAKE_CLIENT_METADATA_SYNC_FAILED';
    throw new MakeClientProjectError(code, output || error?.message || 'Make client command failed', { phase });
  }
}

function shouldSkipTemplateCopyEntry(entryName: string, relativePath = entryName): boolean {
  if (TEMPLATE_COPY_IGNORED_NAMES.has(entryName) || TEMPLATE_COPY_IGNORED_FILES.has(entryName)) {
    return true;
  }
  const normalizedRelativePath = relativePath.split(path.sep).join('/');
  if (
    normalizedRelativePath.startsWith('.axhub/make/')
    && !TEMPLATE_COPY_ALLOWED_AXHUB_MAKE_FILES.has(normalizedRelativePath)
  ) {
    return true;
  }
  if (
    normalizedRelativePath.startsWith('.axhub/make/')
    && TEMPLATE_COPY_IGNORED_AXHUB_MAKE_NAMES.has(entryName)
  ) {
    return true;
  }
  if (entryName.endsWith('.tsbuildinfo')) {
    return true;
  }
  if (/^\.env\./u.test(entryName)) {
    return true;
  }
  return false;
}

function copyMakeClientTemplateDirectory(sourceRoot: string, targetRoot: string): void {
  if (!fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    throw new MakeClientProjectError(
      'MAKE_CLIENT_TEMPLATE_UNAVAILABLE',
      'Make client template is missing',
      { status: 500, phase: 'template', details: { templateRoot: sourceRoot } },
    );
  }

  const copyRecursive = (sourceDir: string, targetDir: string, relativeDir = '') => {
    fs.mkdirSync(targetDir, { recursive: true });
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
      const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
      if (shouldSkipTemplateCopyEntry(entry.name, relativePath)) {
        continue;
      }
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      if (entry.isDirectory()) {
        copyRecursive(sourcePath, targetPath, relativePath);
        continue;
      }
      if (entry.isFile()) {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  };

  try {
    copyRecursive(sourceRoot, targetRoot);
  } catch (error: any) {
    if (error instanceof MakeClientProjectError) {
      throw error;
    }
    throw new MakeClientProjectError(
      'MAKE_CLIENT_TEMPLATE_UNAVAILABLE',
      error?.message || 'Failed to copy embedded Make client template',
      { status: 500, phase: 'template', details: { templateRoot: sourceRoot, targetRoot } },
    );
  }
}

function templateErrorMessage(error: unknown): string {
  const looseError = error as { stderr?: unknown; stdout?: unknown; message?: unknown } | null;
  return String(looseError?.stderr || looseError?.stdout || looseError?.message || 'Remote template download failed').trim();
}

function assertSafeZipEntryName(entryName: string): string {
  const raw = String(entryName || '');
  const parts = raw.split('/').filter(Boolean);
  if (
    !raw
    || raw.includes('\\')
    || path.isAbsolute(raw)
    || raw.startsWith('/')
    || /^[a-z]:/iu.test(raw)
    || parts.some((part) => part === '..')
  ) {
    throw new Error(`unsafe template zip path: ${entryName}`);
  }
  return raw;
}

function commonZipRoot(entries: string[]): string {
  const firstParts = entries[0]?.split('/').filter(Boolean) || [];
  if (firstParts.length === 0) {
    return '';
  }
  const candidate = firstParts[0];
  return entries.every((entry) => entry === candidate || entry.startsWith(`${candidate}/`)) ? candidate : '';
}

function extractTemplateZip(zipBuffer: Uint8Array, destinationRoot: string): void {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBuffer);
  } catch (error: any) {
    throw new Error(error?.message || 'Failed to unzip Make client template');
  }
  const safeEntries = Object.keys(entries).map(assertSafeZipEntryName).filter((entry) => !entry.endsWith('/'));
  if (safeEntries.length === 0) {
    throw new Error('Make client template zip is empty');
  }
  const rootPrefix = commonZipRoot(safeEntries);
  fs.mkdirSync(destinationRoot, { recursive: true });
  for (const safeEntry of safeEntries) {
    const relativePath = rootPrefix
      ? safeEntry === rootPrefix
        ? ''
        : safeEntry.slice(rootPrefix.length + 1)
      : safeEntry;
    if (!relativePath) {
      continue;
    }
    const targetPath = path.resolve(destinationRoot, ...relativePath.split('/'));
    if (!targetPath.startsWith(`${path.resolve(destinationRoot)}${path.sep}`)) {
      throw new Error(`unsafe template zip path: ${safeEntry}`);
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, entries[safeEntry]);
  }
}

async function downloadTemplateZip(url: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_MAKE_CLIENT_TEMPLATE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}${body ? `: ${body.slice(0, 240)}` : ''}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error('Make client template zip is empty');
    }
    return new Uint8Array(arrayBuffer);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`Template zip download timed out after ${DEFAULT_MAKE_CLIENT_TEMPLATE_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function makeClientTemplateCacheRoot(): string {
  return path.join(os.tmpdir(), 'axhub-make', 'make-client-template-cache');
}

function makeClientTemplateCachePath(url: string): string {
  const key = crypto.createHash('sha256').update(url).digest('hex');
  return path.join(makeClientTemplateCacheRoot(), `${key}.zip`);
}

function getTemplateCacheStatus(cachePath: string): 'hit' | 'miss' | 'expired' {
  if (!fs.existsSync(cachePath)) {
    return 'miss';
  }
  const ageMs = Date.now() - fs.statSync(cachePath).mtimeMs;
  return ageMs >= 0 && ageMs < MAKE_CLIENT_TEMPLATE_CACHE_TTL_MS ? 'hit' : 'expired';
}

async function readTemplateZipWithCache(url: string): Promise<{ zipBuffer: Uint8Array; cache: { status: 'hit' | 'miss' | 'expired'; path: string } }> {
  const cachePath = makeClientTemplateCachePath(url);
  const status = getTemplateCacheStatus(cachePath);
  if (status === 'hit') {
    return {
      zipBuffer: new Uint8Array(fs.readFileSync(cachePath)),
      cache: { status, path: cachePath },
    };
  }

  const zipBuffer = await downloadTemplateZip(url);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  const tempPath = `${cachePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, zipBuffer);
    fs.renameSync(tempPath, cachePath);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
  return {
    zipBuffer,
    cache: { status, path: cachePath },
  };
}

function commandErrorMessage(error: unknown): string {
  const looseError = error as { stderr?: unknown; stdout?: unknown; message?: unknown } | null;
  return String(looseError?.stderr || looseError?.stdout || looseError?.message || 'Command failed').trim();
}

function makeClientDevSpawnError(error: unknown, command: string, args: string[]): MakeClientProjectError {
  return new MakeClientProjectError(
    'MAKE_CLIENT_DEV_FAILED',
    commandErrorMessage(error),
    {
      status: 500,
      phase: 'dev',
      details: {
        command,
        args,
        error: commandErrorMessage(error),
      },
    },
  );
}

function npmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function viteBinPath(projectRoot: string): string {
  const binName = process.platform === 'win32' ? 'vite.cmd' : 'vite';
  return path.join(projectRoot, 'node_modules', '.bin', binName);
}

function viteNodeEntrypoint(projectRoot: string): string {
  const viteRoot = path.join(projectRoot, 'node_modules', 'vite');
  const packagePath = path.join(viteRoot, 'package.json');
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const bin = pkg?.bin;
    const viteBin = typeof bin === 'string'
      ? bin
      : typeof bin?.vite === 'string'
        ? bin.vite
        : 'bin/vite.js';
    return path.join(viteRoot, viteBin);
  } catch {
    return path.join(viteRoot, 'bin', 'vite.js');
  }
}

function hasInstalledMakeClientDependencies(projectRoot: string): boolean {
  return fs.existsSync(viteBinPath(projectRoot))
    || fs.existsSync(path.join(projectRoot, 'node_modules', 'vite'));
}

async function ensureMakeClientDependencies(
  runner: MakeClientCommandRunner,
  projectRoot: string,
): Promise<'skipped' | 'pnpm' | 'npm'> {
  if (hasInstalledMakeClientDependencies(projectRoot)) {
    return 'skipped';
  }

  try {
    await runMakeClientCommand(runner, npmCommand(), ['install', '--include=dev'], projectRoot, 'install', {
      timeoutMs: DEFAULT_MAKE_CLIENT_INSTALL_TIMEOUT_MS,
    });
    return 'npm';
  } catch (npmError) {
    try {
      await runMakeClientCommand(runner, 'pnpm', ['install', '--prod=false'], projectRoot, 'install', {
        timeoutMs: DEFAULT_MAKE_CLIENT_INSTALL_TIMEOUT_MS,
      });
      return 'pnpm';
    } catch (pnpmError) {
      throw new MakeClientProjectError(
        'MAKE_CLIENT_INSTALL_FAILED',
        [
          `${npmCommand()} install failed: ${commandErrorMessage(npmError)}`,
          `pnpm install failed: ${commandErrorMessage(pnpmError)}`,
        ].join('\n'),
        {
          status: 500,
          phase: 'install',
          details: {
            npm: commandErrorMessage(npmError),
            pnpm: commandErrorMessage(pnpmError),
          },
        },
      );
    }
  }
}

function resolveMakeClientDevCommand(installMethod: 'skipped' | 'pnpm' | 'npm', projectRoot: string): { command: string; args: string[] } {
  const viteEntrypoint = viteNodeEntrypoint(projectRoot);
  if (fs.existsSync(viteEntrypoint)) {
    return { command: process.execPath, args: [viteEntrypoint] };
  }
  throw new MakeClientProjectError(
    'MAKE_CLIENT_INSTALL_FAILED',
    'Make client vite dependency is missing after install',
    { status: 500, phase: 'install', details: { viteEntrypoint, installMethod } },
  );
}

async function resolveMakeClientDevCommandForProject(
  runner: MakeClientCommandRunner,
  installMethod: 'skipped' | 'pnpm' | 'npm',
  projectRoot: string,
): Promise<{ command: string; args: string[] }> {
  void runner;
  return resolveMakeClientDevCommand(installMethod, projectRoot);
}

async function fetchMakeClientTemplateFromRemote(
  runner: MakeClientCommandRunner,
  targetRoot: string,
): Promise<{ markerRepository: string; templateUrl: string; templateVersion?: string }> {
  void runner;
  const failures: Array<{ url: string; cache: { status: 'hit' | 'miss' | 'expired'; path: string } | null; error: string }> = [];
  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'axhub-make-client-template-'));

  try {
    for (const source of makeClientTemplateSources()) {
      const checkoutRoot = path.join(tempParent, failures.length === 0 ? 'primary' : `fallback-${failures.length}`);
      let cache: { status: 'hit' | 'miss' | 'expired'; path: string } | null = null;
      try {
        const cached = await readTemplateZipWithCache(source.url);
        cache = cached.cache;
        const zipBuffer = cached.zipBuffer;
        extractTemplateZip(zipBuffer, checkoutRoot);
        copyMakeClientTemplateDirectory(checkoutRoot, targetRoot);
        return {
          markerRepository: source.markerRepository,
          templateUrl: source.url,
          ...(source.templateVersion ? { templateVersion: source.templateVersion } : {}),
        };
      } catch (error) {
        failures.push({
          url: source.url,
          cache,
          error: templateErrorMessage(error),
        });
        fs.rmSync(checkoutRoot, { recursive: true, force: true });
        fs.rmSync(targetRoot, { recursive: true, force: true });
      }
    }
  } finally {
    fs.rmSync(tempParent, { recursive: true, force: true });
  }

  throw new MakeClientProjectError(
    'MAKE_CLIENT_TEMPLATE_UNAVAILABLE',
    'Failed to download Make client template from all remote sources',
    {
      status: 500,
      phase: 'template',
      details: { sources: failures },
    },
  );
}

function isSameProjectRuntime(info: AxhubServerInfo | null, projectRoot: string): info is AxhubServerInfo {
  return isLiveLocalServerInfo(info, projectRoot);
}

function clearRuntimeServerInfo(projectRoot: string): void {
  fs.rmSync(getRuntimeServerInfoPath(projectRoot), { force: true });
}

function isLiveMakeClientRuntime(info: AxhubServerInfo | null, projectRoot: string): info is AxhubServerInfo {
  return isLiveLocalServerInfo(info, projectRoot, { maxAgeMs: MAKE_CLIENT_RUNTIME_HEARTBEAT_MAX_AGE_MS });
}

function isSameProjectHealthRuntime(info: AxhubServerInfo | null, projectRoot: string): info is AxhubServerInfo {
  return Boolean(info && resolveComparableProjectRoot(info.projectRoot) === resolveComparableProjectRoot(projectRoot));
}

async function discoverMakeClientRuntime(projectRoot: string, options: { healthTimeoutMs?: number } = {}): Promise<AxhubServerInfo | null> {
  for (let port = DEFAULT_MAKE_CLIENT_DEV_PORT; port <= DEFAULT_MAKE_CLIENT_DEV_PORT + MAKE_CLIENT_RUNTIME_DISCOVERY_PORT_SPAN; port += 1) {
    const origin = `http://localhost:${port}`;
    const health = await fetchHealth(origin, options.healthTimeoutMs ?? MAKE_CLIENT_RUNTIME_DISCOVERY_HEALTH_TIMEOUT_MS);
    const runtime = normalizeHealthServerInfo(health);
    if (!isSameProjectHealthRuntime(runtime, projectRoot)) {
      continue;
    }
    return writeServerInfo(projectRoot, 'runtime', {
      ...runtime,
      origin: runtime.origin || origin,
      projectRoot,
      timestamp: new Date().toISOString(),
    });
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRuntimeInfo(
  projectRoot: string,
  timeoutMs: number,
  pollIntervalMs: number,
  options: { ignoredRuntime?: AxhubServerInfo | null; healthTimeoutMs?: number } = {},
): Promise<AxhubServerInfo | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const runtime = readServerInfo(projectRoot, 'runtime');
    const isIgnoredRuntime = Boolean(options.ignoredRuntime && runtime
      && runtime.pid === options.ignoredRuntime.pid
      && runtime.port === options.ignoredRuntime.port
      && runtime.origin === options.ignoredRuntime.origin
      && runtime.startedAt === options.ignoredRuntime.startedAt);
    if (isSameProjectRuntime(runtime, projectRoot) && !isIgnoredRuntime) {
      return runtime;
    }
    await sleep(pollIntervalMs);
  }
  return null;
}

function ensureAdminServerInfo(projectRoot: string, adminServerInfo?: AxhubServerInfo): void {
  if (!adminServerInfo) {
    return;
  }
  writeServerInfo(projectRoot, 'admin', {
    ...adminServerInfo,
    projectRoot,
  });
}

function ensureMakeClientScripts(projectRoot: string): void {
  const packagePath = path.join(projectRoot, 'package.json');
  let pkg: any = null;
  try {
    pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch {
    throw new MakeClientProjectError(
      'NOT_MAKE_CLIENT_PROJECT',
      'Make client package.json is missing or invalid',
      { status: 400 },
    );
  }
  if (!pkg?.scripts?.dev || !pkg?.scripts?.['metadata:sync']) {
    throw new MakeClientProjectError(
      'NOT_MAKE_CLIENT_PROJECT',
      'Make client project must define dev and metadata:sync scripts',
      { status: 400 },
    );
  }
}

export function validateExistingMakeClientProject(projectRoot: string): MakeClientMarker {
  try {
    const marker = validateMakeClientProject(projectRoot);
    ensureMakeClientScripts(projectRoot);
    return marker;
  } catch (error: any) {
    if (error instanceof MakeClientProjectError) {
      throw error;
    }
    if (String(error?.message || '').includes('Invalid make client project id')) {
      throw new MakeClientProjectError('NOT_MAKE_CLIENT_PROJECT', error.message, { status: 400 });
    }
    throw new MakeClientProjectError('NOT_MAKE_CLIENT_PROJECT', error?.message || 'Not a Make client project', { status: 400 });
  }
}

export async function getMakeClientDevStatus(
  projectId: string,
  projectRoot: string,
  options: { healthTimeoutMs?: number } = {},
): Promise<MakeClientDevStatus> {
  const root = path.resolve(projectRoot);
  const marker = readMakeClientMarker(root);
  if (!marker) {
    return {
      projectId,
      makeClient: false,
      running: false,
      reason: 'not-make-client',
    };
  }

  const runtime = readServerInfo(root, 'runtime');
  if (!runtime) {
    const discoveredRuntime = await discoverMakeClientRuntime(root, options);
    if (discoveredRuntime) {
      return {
        projectId,
        makeClient: true,
        running: true,
        runtime: discoveredRuntime,
      };
    }
    return {
      projectId,
      makeClient: true,
      running: false,
      reason: 'not-running',
    };
  }
  if (isLiveMakeClientRuntime(runtime, root)) {
    return {
      projectId,
      makeClient: true,
      running: true,
      runtime,
    };
  }

  const discoveredRuntime = await discoverMakeClientRuntime(root, options);
  if (discoveredRuntime) {
    return {
      projectId,
      makeClient: true,
      running: true,
      runtime: discoveredRuntime,
    };
  }

  clearRuntimeServerInfo(root);
  return {
    projectId,
    makeClient: true,
    running: false,
    reason: 'stale-runtime',
  };
}

export async function stopMakeClientDevServer(
  projectId: string,
  projectRoot: string,
): Promise<MakeClientStopResult> {
  const root = path.resolve(projectRoot);
  const marker = readMakeClientMarker(root);
  if (!marker) {
    return {
      success: true,
      projectId,
      stopped: false,
      status: {
        projectId,
        makeClient: false,
        running: false,
        reason: 'not-make-client',
      },
    };
  }

  const runtime = readServerInfo(root, 'runtime');
  if (!runtime || !isSameProjectRuntime(runtime, root) || !isProcessAlive(runtime.pid)) {
    clearRuntimeServerInfo(root);
    return {
      success: true,
      projectId,
      stopped: false,
      status: {
        projectId,
        makeClient: true,
        running: false,
        reason: 'not-running',
      },
    };
  }

  try {
    process.kill(runtime.pid, 'SIGTERM');
  } catch (error: any) {
    if (String(error?.code || '') !== 'ESRCH') {
      throw error;
    }
  }
  clearRuntimeServerInfo(root);
  return {
    success: true,
    projectId,
    stopped: true,
    runtime,
    status: {
      projectId,
      makeClient: true,
      running: false,
      reason: 'not-running',
    },
  };
}

export async function ensureMakeClientDevServer(
  projectRoot: string,
  options: MakeClientOrchestrationOptions = {},
): Promise<MakeClientDevResult> {
  const root = path.resolve(projectRoot);
  validateExistingMakeClientProject(root);
  ensureAdminServerInfo(root, options.adminServerInfo);

  const existingRuntime = readServerInfo(root, 'runtime');
  if (isLiveMakeClientRuntime(existingRuntime, root)) {
    return {
      success: true,
      reused: true,
      phase: 'ready',
      runtime: existingRuntime,
    };
  }

  const discoveredRuntime = await discoverMakeClientRuntime(root, options);
  if (discoveredRuntime) {
    return {
      success: true,
      reused: true,
      phase: 'ready',
      runtime: discoveredRuntime,
    };
  }

  const runner = options.commandRunner || defaultCommandRunner();
  const installMethod = await ensureMakeClientDependencies(runner, root);
  const devCommand = await resolveMakeClientDevCommandForProject(runner, installMethod, root);

  let child: ReturnType<typeof spawn>;
  try {
    child = runner.spawn(devCommand.command, devCommand.args, {
      cwd: root,
      detached: true,
      env: {
        ...buildLocalCommandEnv(),
        [SKIP_AUTO_START_SERVER_ENV]: '1',
      },
      stdio: 'ignore',
    });
  } catch (error) {
    throw makeClientDevSpawnError(error, devCommand.command, devCommand.args);
  }
  const spawnError = new Promise<never>((_resolve, reject) => {
    child.once?.('error', (error) => {
      reject(makeClientDevSpawnError(error, devCommand.command, devCommand.args));
    });
  });
  child.unref?.();
  const runtime = await Promise.race([
    waitForRuntimeInfo(root, options.devTimeoutMs ?? DEFAULT_MAKE_CLIENT_DEV_TIMEOUT_MS, options.pollIntervalMs ?? DEFAULT_MAKE_CLIENT_DEV_POLL_INTERVAL_MS, {
      healthTimeoutMs: options.healthTimeoutMs,
      ignoredRuntime: existingRuntime,
    }),
    spawnError,
  ]);
  if (!runtime) {
    throw new MakeClientProjectError(
      'MAKE_CLIENT_DEV_TIMEOUT',
      'Make client dev server did not become ready in time',
      { status: 504, phase: 'dev' },
    );
  }
  return {
    success: true,
    reused: false,
    phase: 'ready',
    runtime,
  };
}

export async function createBlankMakeClientProject(
  params: {
    parentRoot: string;
    folderName: string;
    projectName?: string;
  },
  options: MakeClientOrchestrationOptions = {},
): Promise<{ projectRoot: string; marker: MakeClientMarker; dev: MakeClientDevResult }> {
  const parentRoot = path.resolve(params.parentRoot);
  if (!fs.existsSync(parentRoot) || !fs.statSync(parentRoot).isDirectory()) {
    throw new MakeClientProjectError('INVALID_MAKE_PROJECT_FOLDER_NAME', 'Parent folder does not exist', { status: 400 });
  }
  const folderName = assertSafeMakeClientFolderName(params.folderName);
  const projectRoot = path.join(parentRoot, folderName);
  if (fs.existsSync(projectRoot) && fs.readdirSync(projectRoot).length > 0) {
    throw new MakeClientProjectError('MAKE_PROJECT_TARGET_NOT_EMPTY', 'Target folder is not empty', { status: 409 });
  }

  const runner = options.commandRunner || defaultCommandRunner();
  const templateSource = await fetchMakeClientTemplateFromRemote(runner, projectRoot);
  const existingMarker = readMakeClientMarker(projectRoot);
  const marker = writeMakeClientMarker(projectRoot, {
    schemaVersion: 1,
    kind: 'axhub-make-client',
    repository: templateSource.markerRepository,
    templateUrl: templateSource.templateUrl,
    ...(templateSource.templateVersion ? { templateVersion: templateSource.templateVersion } : {}),
    project: {
      id: folderName,
      name: typeof params.projectName === 'string'
        ? params.projectName.trim()
        : typeof existingMarker?.project.name === 'string'
          ? existingMarker.project.name.trim()
          : '',
    },
  });
  ensureMakeClientScripts(projectRoot);
  const dev = await ensureMakeClientDevServer(projectRoot, {
    ...options,
    commandRunner: runner,
  });
  return { projectRoot, marker, dev };
}

export function makeClientErrorPayload(error: unknown, extra: Record<string, unknown> = {}) {
  if (error instanceof MakeClientProjectError) {
    return {
      error: error.message,
      code: error.code,
      ...(error.phase ? { phase: error.phase } : {}),
      ...(error.details ? { details: error.details } : {}),
      ...extra,
    };
  }
  const looseError = error as { message?: string; code?: string; phase?: MakeClientPhase; details?: Record<string, unknown> } | null;
  if (looseError?.code) {
    return {
      error: looseError.message || 'Make client operation failed',
      code: looseError.code,
      ...(looseError.phase ? { phase: looseError.phase } : {}),
      ...(looseError.details ? { details: looseError.details } : {}),
      ...extra,
    };
  }
  return {
    error: error instanceof Error ? error.message : 'Make client operation failed',
    code: 'MAKE_CLIENT_OPERATION_FAILED',
    ...extra,
  };
}
