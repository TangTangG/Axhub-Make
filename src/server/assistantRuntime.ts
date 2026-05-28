import { spawn } from 'node:child_process';
import type { IncomingMessage } from 'node:http';

import {
  buildLocalCommandEnv,
  commandExists as localCommandExists,
  runLocalCommand,
} from './localCommand.ts';

const DEFAULT_ASSISTANT_WEB_BASE_URL = 'http://localhost:32123';
const DEFAULT_ASSISTANT_API_BASE_URL = 'http://localhost:32123/api';
const DEFAULT_ASSISTANT_HEALTH_URL = `${DEFAULT_ASSISTANT_WEB_BASE_URL}/health`;
const ASSISTANT_SERVICE_ID = '@axhub/genie';
const ASSISTANT_SERVICE_NAME = 'Axhub Genie';
const ASSISTANT_NPX_COMMAND = 'npx';
const ASSISTANT_NPX_PACKAGE = '@axhub/genie@latest';
const ASSISTANT_STATUS_TIMEOUT_MS = 8_000;
const ASSISTANT_WEB_UI_PROBE_TIMEOUT_MS = 1_500;
const COMMAND_AVAILABILITY_TIMEOUT_MS = 2_000;
const ASSISTANT_START_CHECK_DELAY_MS = 500;

export type AssistantHealthStatus =
  | 'ready'
  | 'missing_cli'
  | 'cli_error'
  | 'runtime_unreachable'
  | 'needs_update';

export type AssistantCommandSource = 'axhub-genie' | 'cloudcli' | 'config' | 'env' | 'default';
type AssistantEndpointSource = 'axhub-genie' | 'config' | 'env' | 'default';

export type AssistantBootstrapMode = 'install_global' | 'start_existing';

interface AssistantConfig {
  webBaseUrl: string | null;
  apiBaseUrl: string | null;
}

interface AssistantProbeResult {
  status: 'ready' | 'missing_cli' | 'cli_error' | 'not_running' | 'needs_update';
  message: string;
  commandSource: Exclude<AssistantCommandSource, 'default'>;
  config: AssistantConfig | null;
}

interface AssistantHealthInfo {
  status: AssistantHealthStatus;
  message: string;
  checkedAt: string;
  commandSource: AssistantCommandSource;
  hints: {
    installGlobal: string;
    start: string;
    status: string;
  };
}

export interface AssistantRuntimeInfo {
  webBaseUrl: string;
  apiBaseUrl: string;
  projectPath: string;
  source: AssistantEndpointSource;
  health: AssistantHealthInfo;
}

export interface AssistantRuntimeResponse extends AssistantRuntimeInfo {
  projectId: string;
  projectRoot: string;
  runtime: {
    available: boolean;
    code?: string;
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().replace(/\/+$/u, '');
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/+$/u, '');
  } catch {
    return null;
  }
}

function formatAssistantCommand(extraArgs: string[] = []): string {
  return [ASSISTANT_NPX_COMMAND, ASSISTANT_NPX_PACKAGE, ...extraArgs].join(' ');
}

export function getAssistantHealthHints() {
  return {
    installGlobal: formatAssistantCommand(),
    start: formatAssistantCommand(),
    status: formatAssistantCommand(['status', '--json']),
  };
}

function createAssistantHealthInfo(params: {
  status: AssistantHealthStatus;
  message: string;
  commandSource: AssistantCommandSource;
}): AssistantHealthInfo {
  return {
    status: params.status,
    message: params.message,
    checkedAt: new Date().toISOString(),
    commandSource: params.commandSource,
    hints: getAssistantHealthHints(),
  };
}

export function normalizeAssistantBootstrapMode(value: unknown): AssistantBootstrapMode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized === 'install_global' || normalized === 'start_existing') {
    return normalized;
  }
  return null;
}

function isLocalhostName(hostname: string): boolean {
  const normalized = String(hostname || '').trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

function getRequestHostname(req: IncomingMessage): string {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  return String(forwardedHost || req.headers.host || '').split(':')[0].trim();
}

export function rewriteAssistantLocalhostUrl(rawUrl: string, req: IncomingMessage): string {
  const requestHost = getRequestHostname(req);
  if (!requestHost || isLocalhostName(requestHost)) {
    return rawUrl;
  }
  try {
    const parsed = new URL(rawUrl);
    if (isLocalhostName(parsed.hostname)) {
      parsed.hostname = requestHost;
      return parsed.toString().replace(/\/+$/u, '');
    }
  } catch {
    // Keep original.
  }
  return rawUrl;
}

function decodeOutput(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
  return value == null ? '' : String(value);
}

async function runCommand(command: string, args: string[], timeoutMs: number) {
  try {
    const result = await runLocalCommand(command, args, {
      timeoutMs,
      maxBuffer: 1024 * 1024,
    });
    return {
      status: 0,
      error: null,
      stdout: decodeOutput(result.stdout).trim(),
      stderr: decodeOutput(result.stderr).trim(),
    };
  } catch (error: any) {
    const exitCode = typeof error?.exitCode === 'number' ? error.exitCode : null;
    return {
      status: exitCode,
      error: exitCode == null ? error : null,
      stdout: decodeOutput(error?.stdout).trim(),
      stderr: decodeOutput(error?.stderr).trim(),
    };
  }
}

function containsNeedsUpdateHint(text: string): boolean {
  const normalized = text.trim();
  return Boolean(normalized && /(need\s*update|needs\s*update|outdated|upgrade|please\s*update|版本过旧|需要更新|请更新)/i.test(normalized));
}

function containsNotRunningHint(text: string): boolean {
  const normalized = text.trim();
  return Boolean(normalized && /(not\s*running|service\s*not\s*running|not\s*started|未启动|尚未启动|未运行|服务未运行)/i.test(normalized));
}

function containsMissingCommandHint(text: string): boolean {
  const normalized = text.trim();
  return Boolean(normalized && /(not\s+recognized\s+as\s+an?\s+internal|command\s+not\s+found|no\s+such\s+file|未找到|不是内部或外部命令)/i.test(normalized));
}

function extractAssistantConfigFromStatusPayload(parsed: any): AssistantConfig | null {
  const endpoint = parsed?.endpoint ?? parsed?.assistant?.endpoint ?? parsed?.runtime?.endpoint ?? {};
  const webBaseUrl = normalizeBaseUrl(
    endpoint?.frontendUrl
    ?? endpoint?.webBaseUrl
    ?? endpoint?.webUrl
    ?? parsed?.frontendUrl
    ?? parsed?.webBaseUrl
    ?? parsed?.webUrl,
  );
  const apiBaseUrl = normalizeBaseUrl(
    endpoint?.apiBaseUrl
    ?? endpoint?.apiUrl
    ?? parsed?.apiBaseUrl
    ?? parsed?.apiUrl,
  );

  if (!webBaseUrl && !apiBaseUrl) {
    return null;
  }

  return { webBaseUrl, apiBaseUrl };
}

async function readAssistantStatusFromCli(): Promise<AssistantProbeResult> {
  if (!(await localCommandExists(ASSISTANT_NPX_COMMAND, { timeoutMs: COMMAND_AVAILABILITY_TIMEOUT_MS }))) {
    return {
      status: 'missing_cli',
      message: `未检测到 ${ASSISTANT_NPX_COMMAND} 命令`,
      commandSource: 'axhub-genie',
      config: null,
    };
  }

  const result = await runCommand(
    ASSISTANT_NPX_COMMAND,
    [ASSISTANT_NPX_PACKAGE, 'status', '--json'],
    ASSISTANT_STATUS_TIMEOUT_MS,
  );
  const mergedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');

  if (result.error) {
    const error = result.error as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      return {
        status: 'missing_cli',
        message: `未检测到 ${ASSISTANT_NPX_COMMAND} 命令`,
        commandSource: 'axhub-genie',
        config: null,
      };
    }
    if (error.code === 'ETIMEDOUT' || /timed?\s*out/i.test(error.message || '')) {
      return {
        status: 'not_running',
        message: `${formatAssistantCommand(['status', '--json'])} 执行超时（>${ASSISTANT_STATUS_TIMEOUT_MS}ms），请确认服务已启动后重试`,
        commandSource: 'axhub-genie',
        config: null,
      };
    }
    return {
      status: 'cli_error',
      message: `${formatAssistantCommand(['status', '--json'])} 执行失败: ${error.message || 'unknown error'}`,
      commandSource: 'axhub-genie',
      config: null,
    };
  }

  if (containsMissingCommandHint(mergedOutput)) {
    return {
      status: 'missing_cli',
      message: `未检测到 ${ASSISTANT_NPX_COMMAND} 命令`,
      commandSource: 'axhub-genie',
      config: null,
    };
  }

  if (result.status !== 0) {
    const status = containsNeedsUpdateHint(mergedOutput) ? 'needs_update' : 'cli_error';
    return {
      status,
      message: mergedOutput || `${formatAssistantCommand(['status', '--json'])} 返回非 0 状态`,
      commandSource: 'axhub-genie',
      config: null,
    };
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(result.stdout || result.stderr || '{}');
  } catch {
    return {
      status: containsNotRunningHint(mergedOutput) ? 'not_running' : 'cli_error',
      message: mergedOutput || 'Axhub Genie status 输出不是有效 JSON',
      commandSource: 'axhub-genie',
      config: null,
    };
  }

  const config = extractAssistantConfigFromStatusPayload(parsed);
  if (parsed?.running === false || parsed?.status === 'stopped' || parsed?.status === 'not_running') {
    return {
      status: 'not_running',
      message: 'Axhub Genie 尚未启动',
      commandSource: 'axhub-genie',
      config,
    };
  }
  if (!config) {
    return {
      status: 'cli_error',
      message: 'Axhub Genie status 未返回服务地址',
      commandSource: 'axhub-genie',
      config: null,
    };
  }
  return {
    status: 'ready',
    message: 'Axhub Genie 已就绪',
    commandSource: 'axhub-genie',
    config,
  };
}

function getSpawnCommandSpec(command: string, args: string[], platform = process.platform) {
  if (platform !== 'win32' || /\.(exe|com)$/i.test(command)) {
    return { command, args, windowsHide: platform === 'win32' };
  }
  return {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', [command, ...args].join(' ')],
    windowsHide: true,
  };
}

function runExecutableCommandInBackground(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const spawnSpec = getSpawnCommandSpec(command, args, process.platform);
    const child = spawn(spawnSpec.command, spawnSpec.args, {
      cwd,
      detached: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: spawnSpec.windowsHide,
      shell: false,
      env: buildLocalCommandEnv(),
    });

    if (typeof (child as any)?.once !== 'function') {
      child.unref?.();
      resolve();
      return;
    }

    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      child.unref?.();
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    child.once('error', (error) => finish(error as Error));
    child.once('spawn', () => setTimeout(() => finish(), 150));
    setTimeout(() => finish(), 500);
  });
}

function resolveRuntimeEndpoints(params: {
  statusConfig?: AssistantConfig | null;
  configAssistant?: AssistantConfig | null;
  envAssistant?: AssistantConfig | null;
}) {
  const webBaseUrl = params.statusConfig?.webBaseUrl
    || params.envAssistant?.webBaseUrl
    || params.configAssistant?.webBaseUrl
    || DEFAULT_ASSISTANT_WEB_BASE_URL;
  const apiBaseUrl = params.statusConfig?.apiBaseUrl
    || params.envAssistant?.apiBaseUrl
    || params.configAssistant?.apiBaseUrl
    || DEFAULT_ASSISTANT_API_BASE_URL;
  const source = params.statusConfig
    ? 'axhub-genie'
    : params.envAssistant?.webBaseUrl || params.envAssistant?.apiBaseUrl
      ? 'env'
      : params.configAssistant?.webBaseUrl || params.configAssistant?.apiBaseUrl
        ? 'config'
        : 'default';
  return { webBaseUrl, apiBaseUrl, source } as const;
}

function getAssistantHealthUrl(webBaseUrl: string): string {
  return `${webBaseUrl.replace(/\/+$/u, '')}/health`;
}

function isSameAssistantOrigin(sourceUrl: string, targetUrl: string): boolean {
  try {
    return new URL(sourceUrl).origin === new URL(targetUrl).origin;
  } catch {
    return false;
  }
}

function getCommandSourceForEndpointSource(source: AssistantEndpointSource): AssistantCommandSource {
  return source === 'axhub-genie' ? 'axhub-genie' : source;
}

async function verifyAssistantHealthEndpoint(webBaseUrl: string): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(getAssistantHealthUrl(webBaseUrl), { method: 'GET' });
    if (!response.ok) {
      return { ok: false, message: `/health 探测失败: status ${response.status}` };
    }

    const appIdentifier = response.headers.get('X-App-Identifier') || response.headers.get('x-app-identifier') || '';
    const payload = await response.json().catch(() => null);
    const serviceId = payload?.service?.id || '';
    const serviceName = payload?.service?.name || '';
    const idMatched = serviceId === ASSISTANT_SERVICE_ID || appIdentifier === ASSISTANT_SERVICE_ID;
    const nameMatched = typeof serviceName === 'string' && serviceName.toLowerCase().includes(ASSISTANT_SERVICE_NAME.toLowerCase());

    if (!idMatched && !nameMatched) {
      return { ok: false, message: '健康检查服务身份不匹配（非 Axhub Genie）' };
    }
    if (payload?.status !== 'ok') {
      return { ok: false, message: `健康检查状态异常: ${String(payload?.status || 'unknown')}` };
    }

    const webProbe = await verifyAssistantWebUiEndpoint(webBaseUrl);
    if (!webProbe.ok) {
      return webProbe;
    }

    return { ok: true, message: 'Axhub Genie 健康检查通过' };
  } catch (error: any) {
    return { ok: false, message: `健康检查请求失败: ${error?.message || 'unknown error'}` };
  }
}

async function verifyAssistantWebUiEndpoint(webBaseUrl: string): Promise<{ ok: boolean; message: string }> {
  const normalizedWebBaseUrl = webBaseUrl.replace(/\/+$/u, '');
  try {
    const response = await fetch(`${normalizedWebBaseUrl}/`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(ASSISTANT_WEB_UI_PROBE_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location') || '';
      const resolvedLocation = location ? new URL(location, normalizedWebBaseUrl).toString() : '';
      if (!resolvedLocation) {
        return { ok: false, message: 'Web UI 探测失败: 首页重定向缺少 Location' };
      }
      if (!isSameAssistantOrigin(normalizedWebBaseUrl, resolvedLocation)) {
        return { ok: false, message: `Web UI 探测失败: 首页重定向到不同端口 ${resolvedLocation}` };
      }
      return { ok: true, message: 'Axhub Genie Web UI 可访问' };
    }
    if (!response.ok) {
      return { ok: false, message: `Web UI 探测失败: status ${response.status}` };
    }
    return { ok: true, message: 'Axhub Genie Web UI 可访问' };
  } catch (error: any) {
    return { ok: false, message: `Web UI 探测失败: ${error?.message || 'unknown error'}` };
  }
}

async function verifyAssistantRuntimeEndpoint(webBaseUrl: string): Promise<{ ok: boolean; message: string }> {
  const healthProbe = await verifyAssistantHealthEndpoint(webBaseUrl);
  if (!healthProbe.ok) {
    return healthProbe;
  }
  return { ok: true, message: healthProbe.message };
}

function normalizeAssistantConfig(value: unknown): AssistantConfig {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    webBaseUrl: normalizeBaseUrl(raw.webBaseUrl),
    apiBaseUrl: normalizeBaseUrl(raw.apiBaseUrl),
  };
}

export async function resolveAssistantRuntime(params: {
  projectPath: string;
  assistantConfig?: unknown;
  autoStart?: boolean;
}): Promise<AssistantRuntimeInfo> {
  const configAssistant = normalizeAssistantConfig(params.assistantConfig);
  const envAssistant: AssistantConfig = {
    webBaseUrl: normalizeBaseUrl(process.env.AXHUB_ASSISTANT_WEB_BASE_URL),
    apiBaseUrl: normalizeBaseUrl(process.env.AXHUB_ASSISTANT_API_BASE_URL),
  };
  const initialEndpoints = resolveRuntimeEndpoints({ configAssistant, envAssistant });
  const healthProbe = await verifyAssistantHealthEndpoint(initialEndpoints.webBaseUrl);
  if (healthProbe.ok) {
    return {
      webBaseUrl: initialEndpoints.webBaseUrl,
      apiBaseUrl: initialEndpoints.apiBaseUrl,
      projectPath: params.projectPath,
      source: initialEndpoints.source,
      health: createAssistantHealthInfo({
        status: 'ready',
        message: healthProbe.message,
        commandSource: getCommandSourceForEndpointSource(initialEndpoints.source),
      }),
    };
  }

  const shouldAutoStart = params.autoStart !== false;
  let status = await readAssistantStatusFromCli();

  if (status.status === 'not_running' && shouldAutoStart) {
    try {
      await runExecutableCommandInBackground(ASSISTANT_NPX_COMMAND, [ASSISTANT_NPX_PACKAGE], params.projectPath);
      await sleep(ASSISTANT_START_CHECK_DELAY_MS);
      status = await readAssistantStatusFromCli();
    } catch (error: any) {
      status = {
        status: 'cli_error',
        message: `自动启动 AI 助手失败: ${error?.message || 'unknown error'}`,
        commandSource: 'axhub-genie',
        config: null,
      };
    }
  }

  const endpoints = resolveRuntimeEndpoints({
    statusConfig: status.status === 'ready' ? status.config : null,
    configAssistant,
    envAssistant,
  });
  let endpointProbe: { ok: boolean; message: string } | null = null;
  if (status.status === 'ready') {
    endpointProbe = await verifyAssistantRuntimeEndpoint(endpoints.webBaseUrl);
  }
  const healthStatus: AssistantHealthStatus = status.status === 'ready' && endpointProbe?.ok === false
    ? 'runtime_unreachable'
    : status.status === 'ready'
    ? 'ready'
    : status.status === 'missing_cli'
      ? 'missing_cli'
      : status.status === 'needs_update'
        ? 'needs_update'
        : status.status === 'cli_error'
          ? 'cli_error'
          : 'runtime_unreachable';
  const message = status.status === 'ready' && endpointProbe?.ok === false
    ? `已通过 ${formatAssistantCommand(['status', '--json'])} 获取服务地址，但服务不可访问：${endpointProbe.message}`
    : status.status === 'ready'
    ? `已通过 ${formatAssistantCommand(['status', '--json'])} 获取服务地址（默认 /health 探测失败：${healthProbe.message}）`
    : status.status === 'not_running'
      ? shouldAutoStart
        ? `Axhub Genie 自动启动失败，请手动执行 ${formatAssistantCommand()} 后重试`
        : `Axhub Genie 未启动，请执行 ${formatAssistantCommand()}`
      : status.message;

  return {
    webBaseUrl: endpoints.webBaseUrl,
    apiBaseUrl: endpoints.apiBaseUrl,
    projectPath: params.projectPath,
    source: endpoints.source,
    health: createAssistantHealthInfo({
      status: healthStatus,
      message,
      commandSource: healthStatus === 'ready' && endpoints.source === 'default' ? 'default' : 'axhub-genie',
    }),
  };
}

export async function runAssistantBootstrap(params: {
  mode: AssistantBootstrapMode;
  projectPath: string;
  assistantConfig?: unknown;
}): Promise<AssistantRuntimeInfo> {
  if (!(await localCommandExists(ASSISTANT_NPX_COMMAND, { timeoutMs: COMMAND_AVAILABILITY_TIMEOUT_MS }))) {
    throw new Error('未检测到 npx 命令，请先安装 Node.js/npm 后重试');
  }
  await runExecutableCommandInBackground(ASSISTANT_NPX_COMMAND, [ASSISTANT_NPX_PACKAGE], params.projectPath);
  await sleep(ASSISTANT_START_CHECK_DELAY_MS);
  return resolveAssistantRuntime({
    projectPath: params.projectPath,
    assistantConfig: params.assistantConfig,
    autoStart: false,
  });
}

export function createAssistantRuntimeResponse(params: {
  runtime: AssistantRuntimeInfo;
  projectId: string;
  projectRoot: string;
  req: IncomingMessage;
}): AssistantRuntimeResponse {
  const webBaseUrl = rewriteAssistantLocalhostUrl(params.runtime.webBaseUrl, params.req);
  const apiBaseUrl = rewriteAssistantLocalhostUrl(params.runtime.apiBaseUrl, params.req);
  return {
    ...params.runtime,
    webBaseUrl,
    apiBaseUrl,
    projectId: params.projectId,
    projectRoot: params.projectRoot,
    runtime: {
      available: params.runtime.health.status === 'ready',
      ...(params.runtime.health.status === 'ready' ? {} : { code: 'assistant-runtime-unavailable' }),
    },
  };
}
