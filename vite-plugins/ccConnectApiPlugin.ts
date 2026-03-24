import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, type ChildProcess } from 'node:child_process';
import {
  commandExists,
  runCommandSync,
  getSpawnCommandSpec,
  decodeOutput,
} from '../scripts/utils/command-runtime.mjs';
import { getRequestPathname, readJsonBody } from './utils/httpUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentType = 'claudecode' | 'codex' | 'gemini' | 'cursor' | 'opencode';

interface AgentInfo {
  type: AgentType;
  name: string;
  command: string;
  installed: boolean;
  version: string | null;
}

type WeixinSessionStatus = 'starting' | 'pending' | 'scanned' | 'confirmed' | 'expired' | 'error';

interface WeixinSession {
  id: string;
  status: WeixinSessionStatus;
  qrUrl: string | null;
  qrImageBase64: string | null;
  startedAt: number;
  expiresAt: number;
  message: string | null;
  process: ChildProcess | null;
  agent: AgentType;
  projectName: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CC_CONNECT_COMMAND = 'cc-connect';
const SESSION_TIMEOUT_MS = 480_000; // 8 minutes
const COMMAND_TIMEOUT_MS = 5_000;
const DAEMON_COMMAND_TIMEOUT_MS = 20_000;
const LOG_PREFIX = '[cc-connect-api]';

const AGENT_DEFINITIONS: Array<{ type: AgentType; name: string; command: string }> = [
  { type: 'claudecode', name: 'Claude Code', command: 'claude' },
  { type: 'codex', name: 'Codex', command: 'codex' },
  { type: 'gemini', name: 'Gemini CLI', command: 'gemini' },
  { type: 'cursor', name: 'Cursor Agent', command: 'cursor' },
  { type: 'opencode', name: 'OpenCode', command: 'opencode' },
];

// ---------------------------------------------------------------------------
// In-memory session store
// ---------------------------------------------------------------------------

const sessions = new Map<string, WeixinSession>();

function generateSessionId(): string {
  return `wxs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return;

  if (session.process && !session.process.killed) {
    try {
      session.process.kill('SIGTERM');
    } catch {
      // ignore
    }
  }

  sessions.delete(sessionId);
}

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (session.status === 'confirmed' || session.status === 'error') {
      // Keep finished sessions for 60s so frontend can read final status
      if (now - session.startedAt > SESSION_TIMEOUT_MS + 60_000) {
        cleanupSession(id);
      }
    } else if (now > session.expiresAt) {
      session.status = 'expired';
      session.message = '二维码已过期，请刷新重试';
      if (session.process && !session.process.killed) {
        try {
          session.process.kill('SIGTERM');
        } catch {
          // ignore
        }
      }
    }
  }
}, 10_000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkCcConnectInstalled(): { installed: boolean; version: string | null; isBeta: boolean } {
  if (!commandExists(CC_CONNECT_COMMAND)) {
    return { installed: false, version: null, isBeta: false };
  }

  try {
    const result = runCommandSync({
      command: CC_CONNECT_COMMAND,
      args: ['--version'],
      timeoutMs: COMMAND_TIMEOUT_MS,
    });

    const stdout = (typeof result.stdout === 'string' ? result.stdout : '').trim();
    const version = stdout || null;
    const isBeta = version ? /beta|alpha|rc|pre/i.test(version) : false;

    return { installed: true, version, isBeta };
  } catch {
    return { installed: true, version: null, isBeta: false };
  }
}

function detectAgent(agentDef: { type: AgentType; name: string; command: string }): AgentInfo {
  const installed = commandExists(agentDef.command);
  let version: string | null = null;

  if (installed) {
    try {
      const result = runCommandSync({
        command: agentDef.command,
        args: ['--version'],
        timeoutMs: COMMAND_TIMEOUT_MS,
      });
      const stdout = (typeof result.stdout === 'string' ? result.stdout : '').trim();
      version = stdout || null;
    } catch {
      // ignore
    }
  }

  return {
    type: agentDef.type,
    name: agentDef.name,
    command: agentDef.command,
    installed,
    version,
  };
}

function detectAllAgents(): AgentInfo[] {
  return AGENT_DEFINITIONS.map(detectAgent);
}

// ---------------------------------------------------------------------------
// TOML config management
// ---------------------------------------------------------------------------

function getCcConnectConfigDir(): string {
  return path.join(os.homedir(), '.cc-connect');
}

function getCcConnectConfigPath(): string {
  return path.join(getCcConnectConfigDir(), 'config.toml');
}

function escapeTomlString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function generateConfigToml(params: {
  agentType: AgentType;
  projectName: string;
  workDir: string;
}): string {
  const { agentType, projectName, workDir } = params;

  return `# Auto-generated by Axhub Make — cc-connect WeChat integration
# language = "zh"

[log]
level = "info"

[[projects]]
name = "${escapeTomlString(projectName)}"

[projects.agent]
type = "${escapeTomlString(agentType)}"

[projects.agent.options]
work_dir = "${escapeTomlString(workDir)}"
mode = "default"

[[projects.platforms]]
type = "weixin"

[projects.platforms.options]
token = ""
`;
}

function ensureConfigToml(agentType: AgentType, projectName: string, workDir: string): string {
  const configDir = getCcConnectConfigDir();
  const configPath = getCcConnectConfigPath();

  // Create directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // If config already exists, check if it has a weixin platform for this project
  if (fs.existsSync(configPath)) {
    const existing = fs.readFileSync(configPath, 'utf8');
    // If there's already a weixin section, don't overwrite
    if (existing.includes('type = "weixin"') && existing.includes(`name = "${projectName}"`)) {
      console.info(`${LOG_PREFIX} config.toml already has weixin platform for project "${projectName}"`);
      return configPath;
    }
  }

  // Generate new config
  const content = generateConfigToml({ agentType, projectName, workDir });
  fs.writeFileSync(configPath, content, 'utf8');
  console.info(`${LOG_PREFIX} Generated config.toml at ${configPath}`);

  return configPath;
}

function buildShortErrorMessage(result: { stderr?: string; stdout?: string; error?: Error | null }): string {
  const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
  if (stderr) {
    return stderr.replace(/\s+/g, ' ').slice(0, 240);
  }

  const stdout = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  if (stdout) {
    return stdout.replace(/\s+/g, ' ').slice(0, 240);
  }

  if (result.error?.message) {
    return result.error.message;
  }

  return 'unknown error';
}

function runCcConnectDaemonCommand(args: string[], timeoutMs = DAEMON_COMMAND_TIMEOUT_MS) {
  const env = { ...process.env };
  delete env.CLAUDECODE;

  return runCommandSync({
    command: CC_CONNECT_COMMAND,
    args,
    timeoutMs,
    env,
  });
}

function ensureCcConnectDaemonRunning(configPath: string): { ok: boolean; detail: string } {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    return startCcConnectDetached(configPath);
  }

  return startCcConnectViaDaemon(configPath);
}

/**
 * macOS / Linux: use the native `cc-connect daemon` sub-commands.
 */
function startCcConnectViaDaemon(configPath: string): { ok: boolean; detail: string } {
  const statusResult = runCcConnectDaemonCommand(['daemon', 'status']);
  const isRunning = statusResult.status === 0 && /Status:\s+Running/i.test(statusResult.stdout || '');

  if (isRunning) {
    const restartResult = runCcConnectDaemonCommand(['daemon', 'restart']);
    if (restartResult.status === 0) {
      return { ok: true, detail: 'cc-connect daemon 已重启并加载最新微信配置' };
    }

    return {
      ok: false,
      detail: `微信配置已写入，但 daemon 重启失败: ${buildShortErrorMessage(restartResult)}`,
    };
  }

  const startResult = runCcConnectDaemonCommand(['daemon', 'start']);
  if (startResult.status === 0) {
    return { ok: true, detail: 'cc-connect daemon 已启动并加载最新微信配置' };
  }

  const installResult = runCcConnectDaemonCommand(
    ['daemon', 'install', '--config', configPath],
    60_000,
  );
  if (installResult.status === 0) {
    return { ok: true, detail: 'cc-connect daemon 已安装并启动，微信配置已生效' };
  }

  return {
    ok: false,
    detail: `微信配置已写入，但 daemon 启动失败: ${buildShortErrorMessage(installResult)}`,
  };
}

/**
 * Windows: `cc-connect daemon` is not supported.
 * Try to spawn cc-connect as a detached background process instead.
 * If that also fails, return a user-friendly message with manual instructions.
 */
function startCcConnectDetached(configPath: string): { ok: boolean; detail: string } {
  try {
    const spawnSpec = getSpawnCommandSpec(
      CC_CONNECT_COMMAND,
      ['--config', configPath],
      'win32',
    );

    const env = { ...process.env };
    delete env.CLAUDECODE;

    const child = spawn(spawnSpec.command, spawnSpec.args, {
      detached: true,
      stdio: 'ignore',
      env,
      windowsHide: true,
    });

    child.unref();

    console.info(`${LOG_PREFIX} cc-connect started as detached process (pid=${child.pid}) on Windows`);
    return { ok: true, detail: 'cc-connect 已在后台启动，微信配置已生效' };
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Failed to start cc-connect detached on Windows:`, error?.message);

    return {
      ok: false,
      detail:
        '微信配置已写入，但后台服务启动失败。' +
        '请在终端手动运行: cc-connect --config ' +
        configPath.replace(/\\/g, '\\\\'),
    };
  }
}

// ---------------------------------------------------------------------------
// Weixin setup process management
// ---------------------------------------------------------------------------

function startWeixinSetup(params: {
  agentType: AgentType;
  projectName: string;
  workDir: string;
}): WeixinSession {
  const { agentType, projectName, workDir } = params;
  const sessionId = generateSessionId();
  const now = Date.now();

  // Ensure config.toml exists
  const configPath = ensureConfigToml(agentType, projectName, workDir);

  const session: WeixinSession = {
    id: sessionId,
    status: 'starting',
    qrUrl: null,
    qrImageBase64: null,
    startedAt: now,
    expiresAt: now + SESSION_TIMEOUT_MS,
    message: '正在启动微信连接...',
    process: null,
    agent: agentType,
    projectName,
  };

  sessions.set(sessionId, session);

  // Start cc-connect weixin setup
  const qrImagePath = path.join(os.tmpdir(), `cc-connect-qr-${sessionId}.png`);

  try {
    const spawnSpec = getSpawnCommandSpec(
      CC_CONNECT_COMMAND,
      [
        'weixin', 'setup',
        '--project', projectName,
        '--config', configPath,
        '--qr-image', qrImagePath,
        '--timeout', '480',
      ],
      process.platform,
    );

    // We need to unset CLAUDECODE env var to avoid conflicts
    const env = { ...process.env };
    delete env.CLAUDECODE;

    const child = spawn(spawnSpec.command, spawnSpec.args, {
      cwd: workDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: spawnSpec.windowsHide || false,
    });

    session.process = child;

    let stdoutBuffer = '';
    let stderrBuffer = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk: Buffer) => {
        const text = typeof chunk === 'string' ? chunk : decodeOutput(chunk);
        stdoutBuffer += text;
        console.info(`${LOG_PREFIX} [${sessionId}] stdout: ${text.trim()}`);

        // Try to detect QR URL from output
        parseProcessOutput(session, stdoutBuffer, qrImagePath);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk: Buffer) => {
        const text = typeof chunk === 'string' ? chunk : decodeOutput(chunk);
        stderrBuffer += text;
        console.info(`${LOG_PREFIX} [${sessionId}] stderr: ${text.trim()}`);

        // Some output might go to stderr
        parseProcessOutput(session, stderrBuffer, qrImagePath);
      });
    }

    child.once('error', (error) => {
      console.error(`${LOG_PREFIX} [${sessionId}] process error:`, error.message);
      session.status = 'error';
      session.message = `启动失败: ${error.message}`;
    });

    child.once('close', (code, signal) => {
      console.info(`${LOG_PREFIX} [${sessionId}] process exited code=${code} signal=${signal}`);

      if (session.status === 'pending' || session.status === 'scanned' || session.status === 'starting') {
        if (code === 0) {
          const daemonResult = ensureCcConnectDaemonRunning(configPath);
          if (daemonResult.ok) {
            session.status = 'confirmed';
            session.message = daemonResult.detail;
          } else {
            session.status = 'error';
            session.message = daemonResult.detail;
          }
        } else {
          session.status = 'error';
          session.message = `连接失败 (exit code: ${code})${stderrBuffer ? `: ${stderrBuffer.trim().slice(0, 200)}` : ''}`;
        }
      }

      // Clean up QR image
      try {
        if (fs.existsSync(qrImagePath)) {
          fs.unlinkSync(qrImagePath);
        }
      } catch {
        // ignore
      }
    });
  } catch (error: any) {
    session.status = 'error';
    session.message = `启动 cc-connect 失败: ${error?.message || 'unknown error'}`;
  }

  return session;
}

function parseProcessOutput(session: WeixinSession, output: string, qrImagePath: string) {
  // Look for QR URL pattern in output
  // cc-connect prints the QR code URL in various formats
  const urlMatch = output.match(/https?:\/\/[^\s"'<>]+/);
  if (urlMatch && !session.qrUrl) {
    session.qrUrl = urlMatch[0];
    session.status = 'pending';
    session.message = '请使用微信扫描二维码';
    console.info(`${LOG_PREFIX} [${session.id}] QR URL detected: ${session.qrUrl}`);
  }

  // Check if QR image file has been created
  if (!session.qrImageBase64 && fs.existsSync(qrImagePath)) {
    try {
      const imageBuffer = fs.readFileSync(qrImagePath);
      session.qrImageBase64 = imageBuffer.toString('base64');
      session.status = 'pending';
      session.message = '请使用微信扫描二维码';
      console.info(`${LOG_PREFIX} [${session.id}] QR image loaded from ${qrImagePath}`);
    } catch {
      // ignore, will retry
    }
  }

  // Detect scan confirmation hints
  if (/已扫码|scanned|confirmed|confirm/i.test(output) && session.status === 'pending') {
    session.status = 'scanned';
    session.message = '已扫码，请在手机上确认';
  }

  // Detect success
  if (/token.*written|setup.*complete|绑定成功|登录成功/i.test(output)) {
    session.message = '微信连接成功，正在应用新配置...';
  }
}

// ---------------------------------------------------------------------------
// JSON response helpers
// ---------------------------------------------------------------------------

function sendJson(res: any, data: any, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function sendError(res: any, message: string, statusCode = 500) {
  sendJson(res, { error: message }, statusCode);
}

// ---------------------------------------------------------------------------
// Parse query string
// ---------------------------------------------------------------------------

function getQueryParams(req: any): URLSearchParams {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    return url.searchParams;
  } catch {
    return new URLSearchParams();
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function ccConnectApiPlugin(): Plugin {
  return {
    name: 'cc-connect-api-plugin',
    configureServer(server: any) {
      const projectRoot = process.cwd();

      server.middlewares.use(async (req: any, res: any, next: any) => {
        const pathname = getRequestPathname(req);

        // Only handle /api/cc-connect/* routes
        if (!pathname.startsWith('/api/cc-connect/')) {
          return next();
        }

        try {
          // -----------------------------------------------------------------
          // GET /api/cc-connect/status
          // Check if cc-connect is installed and its version
          // -----------------------------------------------------------------
          if (req.method === 'GET' && pathname === '/api/cc-connect/status') {
            const status = checkCcConnectInstalled();
            return sendJson(res, status);
          }

          // -----------------------------------------------------------------
          // GET /api/cc-connect/agents
          // Detect installed AI agents
          // -----------------------------------------------------------------
          if (req.method === 'GET' && pathname === '/api/cc-connect/agents') {
            const agents = detectAllAgents();
            return sendJson(res, { agents });
          }

          // -----------------------------------------------------------------
          // POST /api/cc-connect/weixin/setup
          // Start WeChat QR login flow
          // -----------------------------------------------------------------
          if (req.method === 'POST' && pathname === '/api/cc-connect/weixin/setup') {
            const body = await readJsonBody(req);
            const agentType = body?.agent as AgentType;

            if (!agentType || !AGENT_DEFINITIONS.some((d) => d.type === agentType)) {
              return sendError(res, '请选择有效的 AI 供应商', 400);
            }

            const projectName = body?.projectName || 'axhub-make';
            const workDir = body?.workDir || projectRoot;

            // Check if cc-connect is installed
            const ccStatus = checkCcConnectInstalled();
            if (!ccStatus.installed) {
              return sendError(res, 'cc-connect 未安装，请先执行 npm install -g cc-connect@beta', 400);
            }

            const session = startWeixinSetup({
              agentType,
              projectName,
              workDir,
            });

            return sendJson(res, {
              sessionId: session.id,
              status: session.status,
              message: session.message,
            });
          }

          // -----------------------------------------------------------------
          // GET /api/cc-connect/weixin/status?sessionId=xxx
          // Poll current session status
          // -----------------------------------------------------------------
          if (req.method === 'GET' && pathname === '/api/cc-connect/weixin/status') {
            const params = getQueryParams(req);
            const sessionId = params.get('sessionId');

            if (!sessionId) {
              return sendError(res, '缺少 sessionId 参数', 400);
            }

            const session = sessions.get(sessionId);
            if (!session) {
              return sendError(res, '会话不存在或已过期', 404);
            }

            return sendJson(res, {
              sessionId: session.id,
              status: session.status,
              qrUrl: session.qrUrl,
              qrImageBase64: session.qrImageBase64,
              expiresAt: session.expiresAt,
              message: session.message,
              agent: session.agent,
              projectName: session.projectName,
            });
          }

          // -----------------------------------------------------------------
          // POST /api/cc-connect/weixin/refresh?sessionId=xxx
          // Kill old session and start a new one
          // -----------------------------------------------------------------
          if (req.method === 'POST' && pathname === '/api/cc-connect/weixin/refresh') {
            const params = getQueryParams(req);
            const sessionId = params.get('sessionId');

            if (!sessionId) {
              return sendError(res, '缺少 sessionId 参数', 400);
            }

            const oldSession = sessions.get(sessionId);
            if (!oldSession) {
              return sendError(res, '会话不存在', 404);
            }

            const agentType = oldSession.agent;
            const projectName = oldSession.projectName;

            // Cleanup old session
            cleanupSession(sessionId);

            // Start new session
            const newSession = startWeixinSetup({
              agentType,
              projectName,
              workDir: projectRoot,
            });

            return sendJson(res, {
              sessionId: newSession.id,
              status: newSession.status,
              message: newSession.message,
            });
          }

          // -----------------------------------------------------------------
          // POST /api/cc-connect/install
          // Install cc-connect@beta
          // -----------------------------------------------------------------
          if (req.method === 'POST' && pathname === '/api/cc-connect/install') {
            // Check if already installed
            const existing = checkCcConnectInstalled();
            if (existing.installed && existing.isBeta) {
              return sendJson(res, {
                success: true,
                version: existing.version,
                message: 'cc-connect@beta 已安装',
              });
            }

            try {
              const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
              const result = runCommandSync({
                command: npmCommand,
                args: ['install', '-g', 'cc-connect@beta'],
                timeoutMs: 120_000, // 2 minute timeout for install
              });

              if (result.status !== 0) {
                const stderr = (typeof result.stderr === 'string' ? result.stderr : '').trim();
                return sendJson(res, {
                  success: false,
                  error: `安装失败: ${stderr.slice(0, 300) || 'unknown error'}`,
                }, 500);
              }

              const afterInstall = checkCcConnectInstalled();
              return sendJson(res, {
                success: true,
                version: afterInstall.version,
                message: 'cc-connect@beta 安装成功',
              });
            } catch (error: any) {
              return sendJson(res, {
                success: false,
                error: `安装失败: ${error?.message || 'unknown error'}`,
              }, 500);
            }
          }

          // -----------------------------------------------------------------
          // DELETE /api/cc-connect/weixin/session?sessionId=xxx
          // Cleanup a session (when user closes dialog)
          // -----------------------------------------------------------------
          if (req.method === 'DELETE' && pathname === '/api/cc-connect/weixin/session') {
            const params = getQueryParams(req);
            const sessionId = params.get('sessionId');

            if (sessionId) {
              cleanupSession(sessionId);
            }

            return sendJson(res, { success: true });
          }

          // Unknown /api/cc-connect/ endpoint
          return sendError(res, 'Not Found', 404);

        } catch (error: any) {
          console.error(`${LOG_PREFIX} Unhandled error:`, error);
          return sendError(res, error?.message || 'Internal Server Error');
        }
      });
    },
  };
}
