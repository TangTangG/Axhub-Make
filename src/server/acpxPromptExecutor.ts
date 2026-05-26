import { spawn, type SpawnOptions } from 'node:child_process';
import path from 'node:path';

type AcpxProvider = 'codex' | 'claude' | 'gemini' | 'opencode';
type AcpxExecutionMode = 'prompt' | 'exec';
type AcpxPermissionMode = 'approve-all';

export interface AcpxPromptExecutionConfig {
  mode?: AcpxExecutionMode;
  permission?: AcpxPermissionMode;
  sessionName?: string;
  timeout?: number;
  ttl?: number;
}

export interface AcpxPromptExecutionRequest {
  scene: string;
  client: unknown;
  prompt: unknown;
  projectRoot: string;
  config?: AcpxPromptExecutionConfig;
}

export interface AcpxPromptExecutionResult {
  success: true;
  scene: string;
  provider: AcpxProvider;
  command: string;
  output: string;
  sessionId?: string;
  sessionName?: string;
}

export class AcpxPromptExecutionError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly provider?: AcpxProvider;
  readonly command?: string;
  readonly exitCode?: number | null;
  readonly stdout?: string;
  readonly stderr?: string;

  constructor(message: string, options: {
    code: string;
    statusCode: number;
    provider?: AcpxProvider;
    command?: string;
    exitCode?: number | null;
    stdout?: string;
    stderr?: string;
  }) {
    super(message);
    this.name = 'AcpxPromptExecutionError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.provider = options.provider;
    this.command = options.command;
    this.exitCode = options.exitCode;
    this.stdout = options.stdout;
    this.stderr = options.stderr;
  }
}

const ACPX_COMMAND = 'npx';
const ACPX_WINDOWS_COMMAND = 'npx.cmd';
const ACPX_PACKAGE = 'acpx@latest';
const DEFAULT_TIMEOUT_SECONDS = 1800;
const POSIX_EXECUTABLE_PATHS = [
  '/usr/local/bin',
  '/opt/homebrew/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
];
const WINDOWS_EXECUTABLE_PATHS = [
  'C:\\Program Files\\nodejs',
];

interface AcpxSpawnEnvOptions {
  platform?: NodeJS.Platform;
  execPath?: string;
  env?: NodeJS.ProcessEnv;
}

interface AcpxSpawnRequestOptions extends AcpxSpawnEnvOptions {
  cwd?: string;
}

function quoteCommandArg(value: string): string {
  return `"${String(value).replace(/["\\$`]/g, '\\$&')}"`;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProvider(value: unknown): AcpxProvider | null {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'codex' || normalized === 'genie:codex') return 'codex';
  if (normalized === 'claude' || normalized === 'claudecode' || normalized === 'genie:claude') return 'claude';
  if (normalized === 'gemini' || normalized === 'genie:gemini') return 'gemini';
  if (normalized === 'opencode' || normalized === 'genie:opencode') return 'opencode';
  return null;
}

function normalizeExecutionMode(value: unknown): AcpxExecutionMode {
  return value === 'exec' ? 'exec' : 'prompt';
}

function normalizeTimeoutMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_TIMEOUT_SECONDS * 1000;
  }
  return Math.max(30, Math.min(7200, Math.round(value))) * 1000;
}

function normalizeSessionName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTtlSeconds(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(7200, Math.round(value)));
}

function buildAcpxArgs(provider: AcpxProvider, prompt: string, config?: AcpxPromptExecutionConfig): string[] {
  const mode = normalizeExecutionMode(config?.mode);
  const sessionName = normalizeSessionName(config?.sessionName);
  const ttl = normalizeTtlSeconds(config?.ttl);
  const args = [ACPX_PACKAGE];
  if ((config?.permission || 'approve-all') === 'approve-all') {
    args.push('--approve-all');
  }
  if (ttl !== null) {
    args.push('--ttl', String(ttl));
  }
  args.push(provider);
  if (mode === 'exec') {
    args.push('exec');
  } else if (sessionName) {
    args.push('-s', sessionName);
  }
  args.push(prompt);
  return args;
}

function buildAcpxEnsureSessionArgs(provider: AcpxProvider, sessionName: string): string[] {
  return [ACPX_PACKAGE, provider, 'sessions', 'ensure', '--name', sessionName];
}

function formatAcpxCommand(args: string[]): string {
  return [ACPX_COMMAND, ...args.map((arg, index) => (index === args.length - 1 ? quoteCommandArg(arg) : arg))].join(' ');
}

function quoteWindowsCmdArg(value: string): string {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

export function resolveAcpxSpawnCommand(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? ACPX_WINDOWS_COMMAND : ACPX_COMMAND;
}

function appendUniquePathSegment(segments: string[], nextSegment: string, platform: NodeJS.Platform): void {
  if (!nextSegment) return;
  const exists = segments.some((segment) => (
    platform === 'win32'
      ? segment.toLowerCase() === nextSegment.toLowerCase()
      : segment === nextSegment
  ));
  if (!exists) {
    segments.push(nextSegment);
  }
}

export function buildAcpxSpawnEnv(options: AcpxSpawnEnvOptions = {}): NodeJS.ProcessEnv {
  const platform = options.platform || process.platform;
  const execPath = options.execPath || process.execPath;
  const env = { ...(options.env || process.env) };
  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  const pathDelimiter = platform === 'win32' ? ';' : ':';
  const pathKey = platform === 'win32' ? 'Path' : 'PATH';
  const existingPath = env[pathKey] || env.PATH || env.Path || '';
  const segments = existingPath.split(pathDelimiter).filter(Boolean);
  const defaultPaths = platform === 'win32' ? WINDOWS_EXECUTABLE_PATHS : POSIX_EXECUTABLE_PATHS;
  appendUniquePathSegment(segments, pathApi.dirname(execPath), platform);
  if (platform === 'win32' && env.APPDATA) {
    appendUniquePathSegment(segments, path.win32.join(env.APPDATA, 'npm'), platform);
  }
  for (const executablePath of defaultPaths) {
    appendUniquePathSegment(segments, executablePath, platform);
  }
  if (platform === 'win32') {
    const pathExt = env.PATHEXT || '.COM;.EXE;.BAT;.CMD';
    const pathExtSegments = pathExt.split(';').filter(Boolean);
    if (!pathExtSegments.some((item) => item.toLowerCase() === '.cmd')) {
      pathExtSegments.push('.CMD');
    }
    env.PATHEXT = pathExtSegments.join(';');
    delete env.PATH;
  }
  env[pathKey] = segments.join(pathDelimiter);
  return env;
}

export function buildAcpxSpawnRequest(
  args: string[],
  platform: NodeJS.Platform = process.platform,
  options: AcpxSpawnRequestOptions = {},
): { command: string; args: string[]; options: SpawnOptions } {
  const env = buildAcpxSpawnEnv({
    platform,
    execPath: options.execPath,
    env: options.env,
  });
  const spawnOptions: SpawnOptions = {
    cwd: options.cwd,
    env,
    shell: false,
    windowsHide: platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  };
  if (platform !== 'win32') {
    return {
      command: resolveAcpxSpawnCommand(platform),
      args,
      options: spawnOptions,
    };
  }
  const command = env.ComSpec || env.COMSPEC || process.env.ComSpec || process.env.COMSPEC || 'cmd.exe';
  return {
    command,
    args: [
      '/d',
      '/s',
      '/c',
      [resolveAcpxSpawnCommand(platform), ...args].map(quoteWindowsCmdArg).join(' '),
    ],
    options: spawnOptions,
  };
}

interface RunAcpxSpawnOptions {
  projectRoot: string;
  timeoutMs: number;
  provider: AcpxProvider;
  command: string;
  failureCode?: string;
  timeoutCode?: string;
}

function runAcpxSpawn(args: string[], options: RunAcpxSpawnOptions): Promise<{ stdout: string; stderr: string }> {
  const {
    projectRoot,
    timeoutMs,
    provider,
    command,
    failureCode = 'PROMPT_EXECUTION_FAILED',
    timeoutCode = 'PROMPT_EXECUTION_TIMEOUT',
  } = options;

  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    const spawnRequest = buildAcpxSpawnRequest(args, process.platform, {
      cwd: projectRoot,
    });
    const child = spawn(spawnRequest.command, spawnRequest.args, spawnRequest.options);

    const finish = (error?: AcpxPromptExecutionError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (error) {
        reject(error);
        return;
      }
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    };

    const timeoutId = setTimeout(() => {
      finish(new AcpxPromptExecutionError(`acpx 执行超时（>${Math.round(timeoutMs / 1000)}s）`, {
        code: timeoutCode,
        statusCode: 504,
        provider,
        command,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      }));
      child.kill();
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    });
    child.once('error', (error: any) => {
      finish(new AcpxPromptExecutionError(error?.message || 'acpx 执行失败', {
        code: error?.code === 'ENOENT' ? 'PROMPT_EXECUTION_ACPX_MISSING' : failureCode,
        statusCode: error?.code === 'ENOENT' ? 503 : 500,
        provider,
        command,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      }));
    });
    child.once('close', (code) => {
      if (code && code !== 0) {
        const message = stderr.trim() || stdout.trim() || `acpx exited with code ${code}`;
        finish(new AcpxPromptExecutionError(message, {
          code: failureCode,
          statusCode: 500,
          provider,
          command,
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        }));
        return;
      }
      finish();
    });
  });
}

export async function executeAcpxPrompt(request: AcpxPromptExecutionRequest): Promise<AcpxPromptExecutionResult> {
  const scene = normalizeString(request.scene);
  const prompt = normalizeString(request.prompt);
  const provider = normalizeProvider(request.client);

  if (!prompt) {
    throw new AcpxPromptExecutionError('Prompt 不能为空', {
      code: 'PROMPT_EXECUTION_PROMPT_EMPTY',
      statusCode: 400,
    });
  }

  if (!provider) {
    throw new AcpxPromptExecutionError('Unsupported prompt execution client', {
      code: 'PROMPT_EXECUTION_CLIENT_UNSUPPORTED',
      statusCode: 400,
    });
  }

  const args = buildAcpxArgs(provider, prompt, request.config);
  const command = formatAcpxCommand(args);
  const timeoutMs = normalizeTimeoutMs(request.config?.timeout);
  const sessionName = normalizeSessionName(request.config?.sessionName);
  const mode = normalizeExecutionMode(request.config?.mode);

  if (sessionName && mode === 'prompt') {
    const ensureArgs = buildAcpxEnsureSessionArgs(provider, sessionName);
    await runAcpxSpawn(ensureArgs, {
      projectRoot: request.projectRoot,
      timeoutMs,
      provider,
      command: formatAcpxCommand(ensureArgs),
      failureCode: 'PROMPT_EXECUTION_SESSION_ENSURE_FAILED',
      timeoutCode: 'PROMPT_EXECUTION_SESSION_ENSURE_TIMEOUT',
    });
  }

  const result = await runAcpxSpawn(args, {
    projectRoot: request.projectRoot,
    timeoutMs,
    provider,
    command,
  });

  return {
    success: true,
    scene,
    provider,
    command,
    output: result.stdout,
    ...(sessionName ? { sessionId: sessionName, sessionName } : {}),
  };
}
