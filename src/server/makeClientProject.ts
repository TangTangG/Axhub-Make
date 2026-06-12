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
  isMakeStateWritePermissionError,
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
import type { DiagnosticLog } from './diagnosticLog.ts';
import {
  DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION,
  makeClientTemplateMirrorDownloadUrl,
  makeClientTemplatePrimaryDownloadUrl,
} from '../common/makeClientTemplate.ts';

export type MakeClientPhase =
  | 'template'
  | 'git-check'
  | 'download-template'
  | 'backup'
  | 'overwrite'
  | 'install'
  | 'metadata'
  | 'version'
  | 'dev'
  | 'ready';

export interface MakeClientCommandRunner {
  runCommand?: typeof runLocalCommand;
  spawn: typeof spawn;
}

export interface MakeClientProgressStep {
  id: string;
  label: string;
  durationMs: number;
  status: 'done' | 'failed';
}

export interface MakeClientProgressSnapshot {
  status: 'running' | 'success' | 'failed';
  totalMs: number;
  steps: MakeClientProgressStep[];
}

export interface MakeClientProgressLogger {
  run<T>(id: string, label: string, action: () => Promise<T>): Promise<T>;
  runSync<T>(id: string, label: string, action: () => T): T;
  finish(status: 'success' | 'failed', error?: unknown): void;
  snapshot(): MakeClientProgressSnapshot;
}

export interface MakeClientOrchestrationOptions {
  adminServerInfo?: AxhubServerInfo;
  commandRunner?: MakeClientCommandRunner;
  serverInfoHomeDir?: string;
  devTimeoutMs?: number;
  healthTimeoutMs?: number;
  pollIntervalMs?: number;
  progressLogger?: MakeClientProgressLogger;
  diagnosticLog?: DiagnosticLog;
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

export interface MakeClientUpdateBlockedReason {
  code:
    | 'GIT_UNAVAILABLE'
    | 'GIT_REPOSITORY_REQUIRED'
    | 'GIT_COMMIT_REQUIRED'
    | 'GIT_WORKTREE_DIRTY'
    | 'NO_UPDATE_AVAILABLE'
    | 'TEMPLATE_SOURCE_UNAVAILABLE';
  message: string;
}

export interface MakeClientUpdateGitStatus {
  available: boolean;
  isRepository: boolean;
  hasCommits: boolean;
  clean: boolean;
  head?: string;
  dirtyFiles: string[];
  error?: string;
}

export interface MakeClientUpdateStatus {
  projectId: string;
  projectRoot: string;
  currentVersion: string;
  targetVersion: string;
  updateAvailable: boolean;
  canApply: boolean;
  git: MakeClientUpdateGitStatus;
  template: {
    version: string;
    sources: MakeClientTemplateSource[];
  };
  blockedReasons: MakeClientUpdateBlockedReason[];
}

export interface MakeClientUpdateApplyResult {
  success: true;
  projectId: string;
  projectRoot: string;
  currentVersion: string;
  targetVersion: string;
  preUpdateHead: string;
  backupRoot: string;
  plannedFiles: string[];
  writtenFiles: string[];
  templateUrl: string;
  installMethod: 'npm' | 'skipped';
  metadataSynced: boolean;
}

export const MAKE_CLIENT_ERROR_STATUS: Record<string, number> = {
  NOT_MAKE_CLIENT_PROJECT: 400,
  MAKE_PROJECT_ID_CONFLICT: 409,
  MAKE_CLIENT_SOURCE_UNAVAILABLE: 502,
  MAKE_CLIENT_TEMPLATE_UNAVAILABLE: 500,
  MAKE_CLIENT_INSTALL_FAILED: 500,
  MAKE_CLIENT_METADATA_SYNC_FAILED: 500,
  MAKE_CLIENT_UPDATE_GIT_UNAVAILABLE: 409,
  MAKE_CLIENT_UPDATE_NOT_GIT_REPOSITORY: 409,
  MAKE_CLIENT_UPDATE_NO_COMMITS: 409,
  MAKE_CLIENT_UPDATE_GIT_DIRTY: 409,
  MAKE_CLIENT_UPDATE_NOT_AVAILABLE: 409,
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
export const MAKE_CLIENT_TEMPLATE_URL_ENV = 'AXHUB_MAKE_CLIENT_TEMPLATE_URL';
const MAKE_CLIENT_PROGRESS_LOG_ENV = 'AXHUB_MAKE_PROGRESS_LOG';
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
  'entries.json',
]);
const TEMPLATE_COPY_IGNORED_AXHUB_MAKE_NAMES = new Set([
  'edit-history',
  'exports',
  'sessions',
]);
const TEMPLATE_COPY_ALLOWED_AXHUB_MAKE_FILES = new Set([
  '.axhub/make/client.json',
  '.axhub/make/axhub.config.json',
  '.axhub/make/README.md',
  '.axhub/make/sidebar-tree.json',
]);

export interface MakeClientTemplateSource {
  id: 'env' | 'github' | 'gitee';
  url: string;
  markerRepository: string;
  templateVersion?: string;
}

type MakeClientTemplateCacheStatus = 'hit' | 'miss' | 'version-mismatch';

interface MakeClientTemplateCacheManifest {
  schemaVersion: 1;
  url: string;
  cachedAt: string;
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
  return [
    {
      id: 'github',
      url: makeClientTemplatePrimaryDownloadUrl(version),
      markerRepository: DEFAULT_MAKE_CLIENT_REPOSITORY,
      templateVersion: version,
    },
    {
      id: 'gitee',
      url: makeClientTemplateMirrorDownloadUrl(version),
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

function makeClientTemplateCacheManifestPath(cachePath: string): string {
  return `${cachePath}.json`;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readTemplateCacheManifest(cachePath: string): MakeClientTemplateCacheManifest | null {
  const manifestPath = makeClientTemplateCacheManifestPath(cachePath);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    const record = raw as Record<string, unknown>;
    if (record.schemaVersion !== 1) {
      return null;
    }
    const url = stringValue(record.url);
    const cachedAt = stringValue(record.cachedAt);
    if (!url || !cachedAt) {
      return null;
    }
    const templateVersion = stringValue(record.templateVersion);
    return {
      schemaVersion: 1,
      url,
      cachedAt,
      ...(templateVersion ? { templateVersion } : {}),
    };
  } catch {
    return null;
  }
}

function writeTemplateCacheManifest(cachePath: string, params: { url: string; templateVersion?: string }): void {
  const manifest: MakeClientTemplateCacheManifest = {
    schemaVersion: 1,
    url: params.url,
    cachedAt: new Date().toISOString(),
    ...(params.templateVersion ? { templateVersion: params.templateVersion } : {}),
  };
  fs.writeFileSync(makeClientTemplateCacheManifestPath(cachePath), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function getTemplateCacheStatus(
  cachePath: string,
  params: { url: string; templateVersion?: string },
): MakeClientTemplateCacheStatus {
  if (!fs.existsSync(cachePath)) {
    return 'miss';
  }
  if (!params.templateVersion) {
    return 'hit';
  }
  const manifest = readTemplateCacheManifest(cachePath);
  return manifest?.url === params.url && manifest.templateVersion === params.templateVersion
    ? 'hit'
    : 'version-mismatch';
}

async function readTemplateZipWithCache(
  source: MakeClientTemplateSource,
): Promise<{ zipBuffer: Uint8Array; cache: { status: MakeClientTemplateCacheStatus; path: string } }> {
  const { url, templateVersion } = source;
  const cachePath = makeClientTemplateCachePath(url);
  const status = getTemplateCacheStatus(cachePath, { url, templateVersion });
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
    writeTemplateCacheManifest(cachePath, { url, templateVersion });
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

function shouldLogMakeClientProgress(): boolean {
  return process.env.NODE_ENV !== 'test' || process.env[MAKE_CLIENT_PROGRESS_LOG_ENV] === '1';
}

function formatMakeClientProgressValue(value: string): string {
  return JSON.stringify(value);
}

function formatMakeClientProgressError(error: unknown): string {
  const message = commandErrorMessage(error).replace(/\s+/gu, ' ').trim();
  return formatMakeClientProgressValue(message.length > 160 ? `${message.slice(0, 160)}...` : message);
}

function createMakeClientProgressLogger(scope: 'create' | 'dev', params: {
  projectRoot: string;
  projectId?: string;
}): MakeClientProgressLogger {
  const enabled = shouldLogMakeClientProgress();
  const startedAt = Date.now();
  const steps: MakeClientProgressStep[] = [];
  let finished = false;
  let status: MakeClientProgressSnapshot['status'] = 'running';
  let totalMs: number | null = null;
  const prefix = `[make-client:${scope}]`;
  const context = [
    params.projectId ? `project=${formatMakeClientProgressValue(params.projectId)}` : '',
    `root=${formatMakeClientProgressValue(params.projectRoot)}`,
  ].filter(Boolean).join(' ');

  const log = (message: string) => {
    if (enabled) {
      console.info(`${prefix} ${message}${context ? ` ${context}` : ''}`);
    }
  };

  const recordStep = <T>(id: string, label: string, action: () => T): T => {
    const stepStartedAt = Date.now();
    log(`step=start id=${id} label=${label}`);
    try {
      const result = action();
      const durationMs = Date.now() - stepStartedAt;
      steps.push({ id, label, durationMs, status: 'done' });
      log(`step=done id=${id} label=${label} durationMs=${durationMs}`);
      return result;
    } catch (error) {
      const durationMs = Date.now() - stepStartedAt;
      steps.push({ id, label, durationMs, status: 'failed' });
      log(`step=failed id=${id} label=${label} durationMs=${durationMs} error=${formatMakeClientProgressError(error)}`);
      throw error;
    }
  };

  log('start');

  return {
    async run<T>(id: string, label: string, action: () => Promise<T>): Promise<T> {
      const stepStartedAt = Date.now();
      log(`step=start id=${id} label=${label}`);
      try {
        const result = await action();
        const durationMs = Date.now() - stepStartedAt;
        steps.push({ id, label, durationMs, status: 'done' });
        log(`step=done id=${id} label=${label} durationMs=${durationMs}`);
        return result;
      } catch (error) {
        const durationMs = Date.now() - stepStartedAt;
        steps.push({ id, label, durationMs, status: 'failed' });
        log(`step=failed id=${id} label=${label} durationMs=${durationMs} error=${formatMakeClientProgressError(error)}`);
        throw error;
      }
    },
    runSync: recordStep,
    snapshot() {
      return {
        status,
        totalMs: totalMs ?? Date.now() - startedAt,
        steps: steps.map((step) => ({ ...step })),
      };
    },
    finish(nextStatus: 'success' | 'failed', error?: unknown) {
      if (finished) {
        return;
      }
      finished = true;
      totalMs = Date.now() - startedAt;
      status = nextStatus;
      const summary = steps
        .map((step) => `${step.id}=${step.durationMs}${step.status === 'failed' ? ':failed' : ''}`)
        .join(' ');
      const errorText = nextStatus === 'failed' && error ? ` error=${formatMakeClientProgressError(error)}` : '';
      log(`summary status=${nextStatus} totalMs=${totalMs}${summary ? ` ${summary}` : ''}${errorText}`);
    },
  };
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

function writeDiagnosticLogLines(log: DiagnosticLog | undefined, prefix: string, chunk: unknown): void {
  if (!log) {
    return;
  }
  const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
  const normalized = text.replace(/\r\n?/gu, '\n');
  const lines = normalized.split('\n');
  const effectiveLines = lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
  for (const line of effectiveLines) {
    log.write(`${prefix} ${line}`);
  }
}

function attachMakeClientDevDiagnostics(
  child: ReturnType<typeof spawn>,
  options: {
    command: string;
    args: string[];
    projectRoot: string;
    diagnosticLog?: DiagnosticLog;
  },
): void {
  const log = options.diagnosticLog;
  if (!log) {
    return;
  }
  const context = `root=${JSON.stringify(options.projectRoot)} command=${JSON.stringify([options.command, ...options.args].join(' '))}`;
  log.write(`[make-client:dev] spawned ${context}`);
  child.stdout?.on('data', (chunk) => {
    writeDiagnosticLogLines(log, `[make-client:dev:stdout] ${context}`, chunk);
  });
  child.stderr?.on('data', (chunk) => {
    writeDiagnosticLogLines(log, `[make-client:dev:stderr] ${context}`, chunk);
  });
  child.once?.('error', (error) => {
    log.write(`[make-client:dev:error] ${context} error=${commandErrorMessage(error)}`);
  });
  child.once?.('exit', (code, signal) => {
    log.write(`[make-client:dev:exit] ${context} code=${code ?? 'null'} signal=${signal ?? 'null'}`);
  });
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
  const failures: Array<{ url: string; cache: { status: MakeClientTemplateCacheStatus; path: string } | null; error: string }> = [];
  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'axhub-make-client-template-'));

  try {
    for (const source of makeClientTemplateSources()) {
      const checkoutRoot = path.join(tempParent, failures.length === 0 ? 'primary' : `fallback-${failures.length}`);
      let cache: { status: MakeClientTemplateCacheStatus; path: string } | null = null;
      try {
        const cached = await readTemplateZipWithCache(source);
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

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join('/');
}

function isInsideRoot(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function readJsonRecord(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function readMakeClientPackageVersion(projectRoot: string): string {
  const pkg = readJsonRecord(path.join(projectRoot, 'package.json'));
  return stringValue(pkg.version);
}

function readMakeClientCurrentTemplateVersion(projectRoot: string, marker?: MakeClientMarker | null): string {
  return stringValue(marker?.templateVersion) || readMakeClientPackageVersion(projectRoot);
}

function parseVersionParts(value: string): { parts: number[]; prerelease: string } | null {
  const match = value.trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([^+]+))?(?:\+.*)?$/u);
  if (!match) {
    return null;
  }
  return {
    parts: [match[1], match[2] || '0', match[3] || '0'].map((part) => Number(part)),
    prerelease: match[4] || '',
  };
}

function compareTemplateVersions(currentVersion: string, targetVersion: string): number {
  const current = parseVersionParts(currentVersion);
  const target = parseVersionParts(targetVersion);
  if (current && target) {
    for (let index = 0; index < Math.max(current.parts.length, target.parts.length); index += 1) {
      const diff = (current.parts[index] || 0) - (target.parts[index] || 0);
      if (diff !== 0) {
        return diff;
      }
    }
    if (current.prerelease && !target.prerelease) {
      return -1;
    }
    if (!current.prerelease && target.prerelease) {
      return 1;
    }
    if (current.prerelease || target.prerelease) {
      return current.prerelease.localeCompare(target.prerelease);
    }
    return 0;
  }
  return currentVersion.localeCompare(targetVersion);
}

function isTemplateUpdateAvailable(currentVersion: string, targetVersion: string): boolean {
  if (!currentVersion) {
    return true;
  }
  return compareTemplateVersions(currentVersion, targetVersion) < 0;
}

async function runGit(
  runner: MakeClientCommandRunner,
  projectRoot: string,
  args: string[],
): Promise<string> {
  const runCommand = runner.runCommand || runLocalCommand;
  const result = await runCommand('git', args, {
    cwd: projectRoot,
    maxBuffer: 1024 * 1024 * 10,
  });
  return String(result.stdout || '').trim();
}

async function getMakeClientUpdateGitStatus(
  runner: MakeClientCommandRunner,
  projectRoot: string,
): Promise<MakeClientUpdateGitStatus> {
  try {
    await runGit(runner, projectRoot, ['--version']);
  } catch (error: any) {
    return {
      available: false,
      isRepository: false,
      hasCommits: false,
      clean: false,
      dirtyFiles: [],
      error: commandErrorMessage(error),
    };
  }

  try {
    const insideWorkTree = await runGit(runner, projectRoot, ['rev-parse', '--is-inside-work-tree']);
    if (insideWorkTree !== 'true') {
      return {
        available: true,
        isRepository: false,
        hasCommits: false,
        clean: false,
        dirtyFiles: [],
      };
    }
  } catch {
    return {
      available: true,
      isRepository: false,
      hasCommits: false,
      clean: false,
      dirtyFiles: [],
    };
  }

  let head = '';
  try {
    head = await runGit(runner, projectRoot, ['rev-parse', '--verify', 'HEAD']);
  } catch {
    return {
      available: true,
      isRepository: true,
      hasCommits: false,
      clean: false,
      dirtyFiles: [],
    };
  }

  const status = await runGit(runner, projectRoot, ['status', '--porcelain']);
  const dirtyFiles = status.split('\n').map((line) => line.trim()).filter(Boolean);
  return {
    available: true,
    isRepository: true,
    hasCommits: true,
    clean: dirtyFiles.length === 0,
    head,
    dirtyFiles,
  };
}

function buildMakeClientUpdateBlockedReasons(params: {
  updateAvailable: boolean;
  git: MakeClientUpdateGitStatus;
  templateSources: MakeClientTemplateSource[];
}): MakeClientUpdateBlockedReason[] {
  const reasons: MakeClientUpdateBlockedReason[] = [];
  if (!params.updateAvailable) {
    reasons.push({ code: 'NO_UPDATE_AVAILABLE', message: '当前客户端模板已是最新版本' });
  }
  if (params.templateSources.length === 0) {
    reasons.push({ code: 'TEMPLATE_SOURCE_UNAVAILABLE', message: '没有可用的 Make 客户端模板源' });
  }
  if (!params.git.available) {
    reasons.push({ code: 'GIT_UNAVAILABLE', message: '已完成版本检测；更新前需要先安装或修复 Git' });
  } else if (!params.git.isRepository) {
    reasons.push({ code: 'GIT_REPOSITORY_REQUIRED', message: '更新前需要先初始化 Git 仓库' });
  } else if (!params.git.hasCommits) {
    reasons.push({ code: 'GIT_COMMIT_REQUIRED', message: '更新前需要至少有一个本地 Git commit' });
  } else if (!params.git.clean) {
    reasons.push({ code: 'GIT_WORKTREE_DIRTY', message: '更新前需要提交或暂存当前未保存的文件改动' });
  }
  return reasons;
}

export async function getMakeClientUpdateStatus(
  projectId: string,
  projectRoot: string,
  options: { commandRunner?: MakeClientCommandRunner } = {},
): Promise<MakeClientUpdateStatus> {
  const root = path.resolve(projectRoot);
  const marker = validateExistingMakeClientProject(root);
  const currentVersion = readMakeClientCurrentTemplateVersion(root, marker);
  const targetVersion = DEFAULT_MAKE_CLIENT_TEMPLATE_VERSION;
  const templateSources = makeClientTemplateSources({ version: targetVersion });
  const updateAvailable = isTemplateUpdateAvailable(currentVersion, targetVersion);
  const runner = options.commandRunner || defaultCommandRunner();
  const git = await getMakeClientUpdateGitStatus(runner, root);
  const blockedReasons = buildMakeClientUpdateBlockedReasons({
    updateAvailable,
    git,
    templateSources,
  });
  return {
    projectId,
    projectRoot: root,
    currentVersion,
    targetVersion,
    updateAvailable,
    canApply: blockedReasons.length === 0,
    git,
    template: {
      version: targetVersion,
      sources: templateSources,
    },
    blockedReasons,
  };
}

function makeClientUpdateGitError(reason: MakeClientUpdateBlockedReason): MakeClientProjectError {
  if (reason.code === 'GIT_UNAVAILABLE') {
    return new MakeClientProjectError('MAKE_CLIENT_UPDATE_GIT_UNAVAILABLE', reason.message, { status: 409, phase: 'git-check' });
  }
  if (reason.code === 'GIT_REPOSITORY_REQUIRED') {
    return new MakeClientProjectError('MAKE_CLIENT_UPDATE_NOT_GIT_REPOSITORY', reason.message, { status: 409, phase: 'git-check' });
  }
  if (reason.code === 'GIT_COMMIT_REQUIRED') {
    return new MakeClientProjectError('MAKE_CLIENT_UPDATE_NO_COMMITS', reason.message, { status: 409, phase: 'git-check' });
  }
  if (reason.code === 'GIT_WORKTREE_DIRTY') {
    return new MakeClientProjectError('MAKE_CLIENT_UPDATE_GIT_DIRTY', reason.message, { status: 409, phase: 'git-check' });
  }
  return new MakeClientProjectError('MAKE_CLIENT_UPDATE_NOT_AVAILABLE', reason.message, { status: 409, phase: 'git-check' });
}

function assertMakeClientUpdateCanApply(status: MakeClientUpdateStatus): void {
  const blockingReason = status.blockedReasons[0];
  if (blockingReason) {
    throw makeClientUpdateGitError(blockingReason);
  }
}

async function extractMakeClientUpdateTemplate(
  targetVersion: string,
): Promise<{
  tempParent: string;
  templateRoot: string;
  source: MakeClientTemplateSource;
}> {
  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'axhub-make-client-update-template-'));
  const failures: Array<{ url: string; cache: { status: MakeClientTemplateCacheStatus; path: string } | null; error: string }> = [];

  for (const source of makeClientTemplateSources({ version: targetVersion })) {
    const checkoutRoot = path.join(tempParent, failures.length === 0 ? 'primary' : `fallback-${failures.length}`);
    let cache: { status: MakeClientTemplateCacheStatus; path: string } | null = null;
    try {
      const cached = await readTemplateZipWithCache(source);
      cache = cached.cache;
      extractTemplateZip(cached.zipBuffer, checkoutRoot);
      return {
        tempParent,
        templateRoot: checkoutRoot,
        source,
      };
    } catch (error) {
      failures.push({
        url: source.url,
        cache,
        error: templateErrorMessage(error),
      });
      fs.rmSync(checkoutRoot, { recursive: true, force: true });
    }
  }

  fs.rmSync(tempParent, { recursive: true, force: true });
  throw new MakeClientProjectError(
    'MAKE_CLIENT_TEMPLATE_UNAVAILABLE',
    'Failed to download Make client template from all remote sources',
    {
      status: 500,
      phase: 'download-template',
      details: { sources: failures },
    },
  );
}

function shouldSkipMakeClientUpdateEntry(relativePath: string, entryName: string): boolean {
  const normalized = relativePath.split(path.sep).join('/');
  if (
    entryName === '.git'
    || entryName === 'node_modules'
    || entryName === 'dist'
    || entryName === '.local'
    || entryName === '.vite'
    || entryName === '.cache'
    || entryName === 'tmp'
    || entryName === 'temp'
  ) {
    return true;
  }
  if (normalized === '.axhub/make/client.json') {
    return true;
  }
  if (normalized === '.axhub/make/sidebar-tree.json') {
    return true;
  }
  if (
    normalized.startsWith('.axhub/make/sessions/')
    || normalized.startsWith('.axhub/make/exports/')
    || normalized.startsWith('.axhub/make/edit-history/')
    || normalized.startsWith('.axhub/make/backups/')
  ) {
    return true;
  }
  if (normalized === 'src/resources' || normalized.startsWith('src/resources/')) {
    return true;
  }
  if (entryName.endsWith('.tsbuildinfo')) {
    return true;
  }
  return false;
}

function collectMakeClientUpdateTemplateFiles(templateRoot: string): string[] {
  const files: string[] = [];
  const walk = (sourceDir: string, relativeDir = '') => {
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
      const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
      if (shouldSkipMakeClientUpdateEntry(relativePath, entry.name)) {
        continue;
      }
      const sourcePath = path.join(sourceDir, entry.name);
      if (entry.isDirectory()) {
        walk(sourcePath, relativePath);
        continue;
      }
      if (entry.isFile()) {
        files.push(normalizeRelativePath(relativePath));
      }
    }
  };
  walk(templateRoot);
  files.push('.axhub/make/client.json');
  return Array.from(new Set(files)).sort();
}

function createMakeClientUpdateBackupRoot(projectRoot: string): string {
  const stamp = new Date().toISOString()
    .replace(/[-:]/gu, '')
    .replace(/\..*$/u, '')
    .replace('T', '-');
  return path.join(projectRoot, '.axhub', 'make', 'backups', `client-update-${stamp}-${process.pid}`);
}

function backupExistingMakeClientUpdateFiles(projectRoot: string, backupRoot: string, plannedFiles: string[]): void {
  const originalRoot = path.join(backupRoot, 'original');
  fs.mkdirSync(originalRoot, { recursive: true });
  for (const relativePath of plannedFiles) {
    const sourcePath = path.resolve(projectRoot, ...relativePath.split('/'));
    if (!isInsideRoot(projectRoot, sourcePath) || !fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      continue;
    }
    const backupPath = path.resolve(originalRoot, ...relativePath.split('/'));
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(sourcePath, backupPath);
  }
}

function writeMakeClientUpdateManifest(
  backupRoot: string,
  manifest: Record<string, unknown>,
): void {
  fs.mkdirSync(backupRoot, { recursive: true });
  fs.writeFileSync(path.join(backupRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function writeMakeClientUpdateTemplateFiles(params: {
  projectRoot: string;
  templateRoot: string;
  plannedFiles: string[];
  marker: MakeClientMarker;
  source: MakeClientTemplateSource;
  targetVersion: string;
}): string[] {
  const writtenFiles: string[] = [];
  for (const relativePath of params.plannedFiles) {
    if (relativePath === '.axhub/make/client.json') {
      writeMakeClientMarker(params.projectRoot, {
        schemaVersion: 1,
        kind: 'axhub-make-client',
        repository: params.source.markerRepository,
        templateUrl: params.source.url,
        templateVersion: params.source.templateVersion || params.targetVersion,
        project: {
          id: params.marker.project.id,
          name: params.marker.project.name,
        },
      });
      writtenFiles.push(relativePath);
      continue;
    }

    const sourcePath = path.resolve(params.templateRoot, ...relativePath.split('/'));
    const targetPath = path.resolve(params.projectRoot, ...relativePath.split('/'));
    if (!isInsideRoot(params.templateRoot, sourcePath) || !isInsideRoot(params.projectRoot, targetPath)) {
      throw new MakeClientProjectError(
        'MAKE_CLIENT_TEMPLATE_UNAVAILABLE',
        `Unsafe Make client update path: ${relativePath}`,
        { status: 500, phase: 'overwrite' },
      );
    }
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      continue;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    writtenFiles.push(relativePath);
  }
  return writtenFiles;
}

async function installMakeClientDependenciesWithNpm(
  runner: MakeClientCommandRunner,
  projectRoot: string,
): Promise<'npm'> {
  await runMakeClientCommand(runner, npmCommand(), ['install', '--include=dev'], projectRoot, 'install', {
    timeoutMs: DEFAULT_MAKE_CLIENT_INSTALL_TIMEOUT_MS,
  });
  return 'npm';
}

async function syncMakeClientMetadataWithNpm(
  runner: MakeClientCommandRunner,
  projectRoot: string,
): Promise<void> {
  await runMakeClientCommand(runner, npmCommand(), ['run', 'metadata:sync'], projectRoot, 'metadata');
}

function attachMakeClientUpdateContext(
  error: unknown,
  context: Partial<Omit<MakeClientUpdateApplyResult, 'success' | 'metadataSynced' | 'installMethod'>> & {
    installMethod?: 'npm' | 'skipped';
    metadataSynced?: boolean;
  },
): never {
  if (error instanceof MakeClientProjectError) {
    Object.assign(error, { updateContext: context });
    throw error;
  }
  const wrapped = new MakeClientProjectError(
    'MAKE_CLIENT_TEMPLATE_UNAVAILABLE',
    error instanceof Error ? error.message : 'Make client update failed',
    { status: 500, phase: 'overwrite' },
  );
  Object.assign(wrapped, { updateContext: context });
  throw wrapped;
}

export async function applyMakeClientUpdate(
  projectId: string,
  projectRoot: string,
  options: { commandRunner?: MakeClientCommandRunner } = {},
): Promise<MakeClientUpdateApplyResult> {
  const root = path.resolve(projectRoot);
  const runner = options.commandRunner || defaultCommandRunner();
  const marker = validateExistingMakeClientProject(root);
  const status = await getMakeClientUpdateStatus(projectId, root, { commandRunner: runner });
  assertMakeClientUpdateCanApply(status);

  const preUpdateHead = status.git.head || await runGit(runner, root, ['rev-parse', 'HEAD']);
  let extractedTemplate: Awaited<ReturnType<typeof extractMakeClientUpdateTemplate>> | null = null;
  let backupRoot = '';
  let plannedFiles: string[] = [];
  let writtenFiles: string[] = [];
  let templateUrl = '';
  let installMethod: 'npm' | 'skipped' = 'skipped';
  const updateContext = () => ({
    projectId,
    projectRoot: root,
    currentVersion: status.currentVersion,
    targetVersion: status.targetVersion,
    preUpdateHead,
    backupRoot,
    plannedFiles,
    writtenFiles,
    templateUrl,
    installMethod,
    metadataSynced: false,
  });

  try {
    extractedTemplate = await extractMakeClientUpdateTemplate(status.targetVersion);
    templateUrl = extractedTemplate.source.url;
    plannedFiles = collectMakeClientUpdateTemplateFiles(extractedTemplate.templateRoot);
    const packageRelativePath = 'package.json';
    const templatePackagePath = path.join(extractedTemplate.templateRoot, packageRelativePath);
    const projectPackagePath = path.join(root, packageRelativePath);
    const packageChanged = fs.existsSync(templatePackagePath)
      && fs.readFileSync(templatePackagePath, 'utf8') !== (fs.existsSync(projectPackagePath) ? fs.readFileSync(projectPackagePath, 'utf8') : '');

    backupRoot = createMakeClientUpdateBackupRoot(root);
    backupExistingMakeClientUpdateFiles(root, backupRoot, plannedFiles);
    writeMakeClientUpdateManifest(backupRoot, {
      projectId,
      projectRoot: root,
      currentVersion: status.currentVersion,
      targetVersion: status.targetVersion,
      preUpdateHead,
      plannedFiles,
      templateUrl,
      createdAt: new Date().toISOString(),
    });

    writtenFiles = writeMakeClientUpdateTemplateFiles({
      projectRoot: root,
      templateRoot: extractedTemplate.templateRoot,
      plannedFiles,
      marker,
      source: extractedTemplate.source,
      targetVersion: status.targetVersion,
    });

    if (packageChanged || !hasInstalledMakeClientDependencies(root)) {
      installMethod = await installMakeClientDependenciesWithNpm(runner, root);
    }
    await syncMakeClientMetadataWithNpm(runner, root);

    writeMakeClientUpdateManifest(backupRoot, {
      projectId,
      projectRoot: root,
      currentVersion: status.currentVersion,
      targetVersion: status.targetVersion,
      preUpdateHead,
      plannedFiles,
      writtenFiles,
      templateUrl,
      installMethod,
      metadataSynced: true,
      completedAt: new Date().toISOString(),
    });

    return {
      success: true,
      projectId,
      projectRoot: root,
      currentVersion: status.currentVersion,
      targetVersion: status.targetVersion,
      preUpdateHead,
      backupRoot,
      plannedFiles,
      writtenFiles,
      templateUrl,
      installMethod,
      metadataSynced: true,
    };
  } catch (error) {
    attachMakeClientUpdateContext(error, updateContext());
  } finally {
    if (extractedTemplate) {
      fs.rmSync(extractedTemplate.tempParent, { recursive: true, force: true });
    }
  }
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

function isWrongRuntimeHealth(health: unknown, projectRoot: string): boolean {
  if (!health || typeof health !== 'object') {
    return false;
  }
  const role = (health as { role?: unknown }).role;
  if (typeof role === 'string' && role !== 'runtime') {
    return true;
  }
  const runtime = normalizeHealthServerInfo(health);
  if (!runtime) {
    return false;
  }
  return resolveComparableProjectRoot(runtime.projectRoot) !== resolveComparableProjectRoot(projectRoot);
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

function ensureAdminServerInfo(
  projectRoot: string,
  adminServerInfo?: AxhubServerInfo,
  options: { homeDir?: string } = {},
): void {
  if (!adminServerInfo) {
    return;
  }
  writeServerInfo(projectRoot, 'admin', {
    ...adminServerInfo,
    projectRoot,
  }, options);
}

function tryEnsureAdminServerInfo(
  projectRoot: string,
  adminServerInfo?: AxhubServerInfo,
  options: { homeDir?: string } = {},
): void {
  try {
    ensureAdminServerInfo(projectRoot, adminServerInfo, options);
  } catch (error: any) {
    if (!isMakeStateWritePermissionError(error)) {
      throw error;
    }
  }
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

  const health = await fetchHealth(runtime.origin, MAKE_CLIENT_RUNTIME_DISCOVERY_HEALTH_TIMEOUT_MS);
  if (isWrongRuntimeHealth(health, root)) {
    clearRuntimeServerInfo(root);
    return {
      success: true,
      projectId,
      stopped: false,
      runtime,
      status: {
        projectId,
        makeClient: true,
        running: false,
        reason: 'stale-runtime',
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
  const progressLogger = options.progressLogger || createMakeClientProgressLogger('dev', { projectRoot: root });
  const shouldFinishProgress = !options.progressLogger;
  try {
    validateExistingMakeClientProject(root);
    tryEnsureAdminServerInfo(root, options.adminServerInfo, { homeDir: options.serverInfoHomeDir });

    const existingRuntime = readServerInfo(root, 'runtime');
    if (isLiveMakeClientRuntime(existingRuntime, root)) {
      progressLogger.runSync('reuse-runtime', '复用已启动客户端', () => undefined);
      const result = {
        success: true as const,
        reused: true,
        phase: 'ready' as const,
        runtime: existingRuntime,
      };
      if (shouldFinishProgress) progressLogger.finish('success');
      return result;
    }

    const discoveredRuntime = await discoverMakeClientRuntime(root, options);
    if (discoveredRuntime) {
      progressLogger.runSync('reuse-runtime', '复用已发现客户端', () => undefined);
      const result = {
        success: true as const,
        reused: true,
        phase: 'ready' as const,
        runtime: discoveredRuntime,
      };
      if (shouldFinishProgress) progressLogger.finish('success');
      return result;
    }

    const runner = options.commandRunner || defaultCommandRunner();
    const installMethod = await progressLogger.run('install', '安装依赖', () => ensureMakeClientDependencies(runner, root));
    const devCommand = await progressLogger.run('resolve-dev', '解析启动命令', () => resolveMakeClientDevCommandForProject(runner, installMethod, root));
    const runtime = await progressLogger.run('dev', '启动客户端', async () => {
      let child: ReturnType<typeof spawn>;
      try {
        child = runner.spawn(devCommand.command, devCommand.args, {
          cwd: root,
          detached: true,
          env: {
            ...buildLocalCommandEnv(),
            [SKIP_AUTO_START_SERVER_ENV]: '1',
          },
          stdio: options.diagnosticLog ? ['ignore', 'pipe', 'pipe'] : 'ignore',
        });
        attachMakeClientDevDiagnostics(child, {
          command: devCommand.command,
          args: devCommand.args,
          projectRoot: root,
          diagnosticLog: options.diagnosticLog,
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
      const nextRuntime = await Promise.race([
        waitForRuntimeInfo(root, options.devTimeoutMs ?? DEFAULT_MAKE_CLIENT_DEV_TIMEOUT_MS, options.pollIntervalMs ?? DEFAULT_MAKE_CLIENT_DEV_POLL_INTERVAL_MS, {
          healthTimeoutMs: options.healthTimeoutMs,
          ignoredRuntime: existingRuntime,
        }),
        spawnError,
      ]);
      if (!nextRuntime) {
        throw new MakeClientProjectError(
          'MAKE_CLIENT_DEV_TIMEOUT',
          'Make client dev server did not become ready in time',
          { status: 504, phase: 'dev' },
        );
      }
      return nextRuntime;
    });
    const result = {
      success: true as const,
      reused: false,
      phase: 'ready' as const,
      runtime,
    };
    if (shouldFinishProgress) progressLogger.finish('success');
    return result;
  } catch (error) {
    if (shouldFinishProgress) progressLogger.finish('failed', error);
    throw error;
  }
}

export async function createBlankMakeClientProject(
  params: {
    parentRoot: string;
    folderName: string;
    projectName?: string;
  },
  options: MakeClientOrchestrationOptions = {},
): Promise<{ projectRoot: string; marker: MakeClientMarker; dev: MakeClientDevResult; progress: MakeClientProgressSnapshot }> {
  const parentRoot = path.resolve(params.parentRoot);
  if (!fs.existsSync(parentRoot) || !fs.statSync(parentRoot).isDirectory()) {
    throw new MakeClientProjectError('INVALID_MAKE_PROJECT_FOLDER_NAME', 'Parent folder does not exist', { status: 400 });
  }
  const folderName = assertSafeMakeClientFolderName(params.folderName);
  const projectRoot = path.join(parentRoot, folderName);
  if (fs.existsSync(projectRoot)) {
    throw new MakeClientProjectError('MAKE_PROJECT_TARGET_NOT_EMPTY', 'Target folder already exists', { status: 409 });
  }

  const runner = options.commandRunner || defaultCommandRunner();
  const progressLogger = options.progressLogger || createMakeClientProgressLogger('create', {
    projectRoot,
    projectId: folderName,
  });
  const shouldFinishProgress = !options.progressLogger;
  try {
    const templateSource = await progressLogger.run('download-template', '下载模板', () => fetchMakeClientTemplateFromRemote(runner, projectRoot));
    const marker = progressLogger.runSync('write-project', '写入项目', () => {
      const existingMarker = readMakeClientMarker(projectRoot);
      const nextMarker = writeMakeClientMarker(projectRoot, {
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
      return nextMarker;
    });
    const dev = await ensureMakeClientDevServer(projectRoot, {
      ...options,
      commandRunner: runner,
      progressLogger,
    });
    if (shouldFinishProgress) progressLogger.finish('success');
    return { projectRoot, marker, dev, progress: progressLogger.snapshot() };
  } catch (error) {
    if (shouldFinishProgress) progressLogger.finish('failed', error);
    if (error && typeof error === 'object') {
      Object.assign(error, { progress: progressLogger.snapshot() });
    }
    throw error;
  }
}

export function makeClientErrorPayload(error: unknown, extra: Record<string, unknown> = {}) {
  if (error instanceof MakeClientProjectError) {
    const progress = (error as MakeClientProjectError & { progress?: unknown }).progress;
    return {
      error: error.message,
      code: error.code,
      ...(error.phase ? { phase: error.phase } : {}),
      ...(error.details ? { details: error.details } : {}),
      ...(progress ? { progress } : {}),
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
