import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';

import { resolveProjectPath } from './projectCore/index.ts';

import {
  createAssistantRuntimeResponse,
  normalizeAssistantBootstrapMode,
  resolveAssistantRuntime,
  runAssistantBootstrap,
} from './assistantRuntime.ts';
import { AcpxPromptExecutionError, executeAcpxPrompt } from './acpxPromptExecutor.ts';
import { detectAgentAvailabilityAtStartup } from './agentAvailability.ts';
import type { AgentVersionInfo, CLIAgent } from './agentTypes.ts';
import {
  getMissingCLIAgentOpenError,
  getMissingLocalAppOpenError,
  getMissingWebAgentOpenError,
  normalizeCLIAgent,
  normalizeLocalAppAgent,
  normalizeWebAgent,
  openCLIAgent,
  openLocalAppAgent,
  openWebAgent,
} from './agentOpen.ts';
import { getRequestUrl, readJsonBody, sendJson } from './http.ts';
import { detectIDEAvailabilityAtStartup, getMissingIDEOpenError } from './ideAvailability.ts';
import { normalizeMainIDE, openIDEPath } from './ideOpen.ts';
import { runLocalCommand } from './localCommand.ts';
import {
  aiImageHistoryToClient,
  persistAiImageReferenceAssets,
  persistAiImageHistory,
  readAiImageHistoryFile,
  resolveAiImageHistoryPath,
} from './managementApi.aiImage.ts';
import type { ManagementApiOptions } from './managementApi.ts';

const CANVAS_PROTOTYPE_GENERATION_SCENE = 'canvas-prototype-generation';
const CANVAS_PROTOTYPE_GENERATION_TIMEOUT_SECONDS = 600;
const CANVAS_PROTOTYPE_GENERATION_ACPX_TTL_SECONDS = 30;
const AGENT_VERSION_TIMEOUT_MS = 2_000;
const AGENT_VERSION_COMMANDS: Record<CLIAgent, string> = {
  codex: 'codex',
  gemini: 'gemini',
  claudecode: 'claude',
  opencode: 'opencode',
};

interface AssistantIdeProjectContext {
  project: {
    id: string;
    root: string;
  };
  metadata?: any;
}

interface AssistantIdeHandlers {
  resolveProjectContext: (
    req: IncomingMessage,
    res: ServerResponse,
    options: ManagementApiOptions,
    mode: 'active-fallback',
    body?: unknown,
  ) => AssistantIdeProjectContext | null;
  getServerConfigStoreForRequest: (options: ManagementApiOptions) => {
    getConfig: (params: { activeProjectRoot: string }) => any;
  };
  sendDisabledCapability: (
    res: ServerResponse,
    status: number,
    payload: {
      code: string;
      error: string;
      projectId?: string;
      projectRoot?: string;
      adapterRequired?: boolean;
      runtime?: Record<string, unknown>;
    },
  ) => void;
}

function resolveConfiguredMainIDE(
  projectRoot: string,
  options: ManagementApiOptions,
  handlers: AssistantIdeHandlers,
) {
  const config = handlers.getServerConfigStoreForRequest(options).getConfig({ activeProjectRoot: projectRoot });
  return normalizeMainIDE(config.automation.defaultIDE);
}

function firstVersionLine(...outputs: unknown[]): string {
  return outputs
    .map((output) => String(output || ''))
    .join('\n')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean) || '';
}

function normalizeVersionOutput(...outputs: unknown[]): string {
  const line = firstVersionLine(...outputs);
  const match = line.match(/\bv?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/u);
  return match?.[1] || line;
}

async function detectAgentVersion(agent: CLIAgent): Promise<AgentVersionInfo> {
  const command = AGENT_VERSION_COMMANDS[agent];
  const checkedAt = new Date().toISOString();
  try {
    const result = await runLocalCommand(command, ['--version'], {
      timeoutMs: AGENT_VERSION_TIMEOUT_MS,
      maxBuffer: 32 * 1024,
    });
    const version = normalizeVersionOutput(result.stdout, result.stderr);
    return {
      status: 'installed',
      checkedAt,
      command,
      version: version || command,
    };
  } catch (error: any) {
    return {
      status: error?.code === 'ETIMEDOUT' ? 'unknown' : 'missing',
      checkedAt,
      command,
      reason: error?.message || String(error),
    };
  }
}

async function detectAgentVersions() {
  const entries = await Promise.all(
    (Object.keys(AGENT_VERSION_COMMANDS) as CLIAgent[]).map(async (agent) => [
      agent,
      await detectAgentVersion(agent),
    ] as const),
  );
  return Object.fromEntries(entries) as Record<CLIAgent, AgentVersionInfo>;
}

export function resolvePromptExecutionAcpxConfig(scene: unknown, acpxConfig: any) {
  if (typeof scene !== 'string' || scene.trim() !== CANVAS_PROTOTYPE_GENERATION_SCENE) {
    return acpxConfig;
  }

  const configuredTimeout = typeof acpxConfig?.timeout === 'number' && Number.isFinite(acpxConfig.timeout)
    ? acpxConfig.timeout
    : CANVAS_PROTOTYPE_GENERATION_TIMEOUT_SECONDS;

  const { mode: _ignoredMode, ttl: _ignoredTtl, ...baseAcpxConfig } = acpxConfig || {};

  return {
    ...baseAcpxConfig,
    timeout: Math.min(configuredTimeout, CANVAS_PROTOTYPE_GENERATION_TIMEOUT_SECONDS),
    ttl: CANVAS_PROTOTYPE_GENERATION_ACPX_TTL_SECONDS,
  };
}

function sanitizeAcpxSessionSegment(value: unknown): string {
  const raw = String(value || '').trim();
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function sanitizeAcpxSessionSegmentWithFallback(value: unknown, fallbackPrefix: string): string {
  const raw = String(value || '').trim();
  const sanitized = sanitizeAcpxSessionSegment(raw);
  if (sanitized) return sanitized;
  if (!raw) return '';
  const hash = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 10);
  return `${fallbackPrefix}-${hash}`;
}

function resolvePrototypeIdFromTargetPath(value: unknown): string | null {
  const normalized = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/u, '');
  const match = normalized.match(/^prototypes\/([^/]+)$/u);
  if (!match?.[1] || match[1].startsWith('.') || match[1].includes('..') || match[1].includes('\0')) {
    return null;
  }
  return match[1];
}

export function resolveCanvasPrototypeGenerationSessionName(projectId: unknown, targetPath: unknown): string | null {
  const projectSegment = sanitizeAcpxSessionSegmentWithFallback(projectId, 'project');
  const prototypeSegment = sanitizeAcpxSessionSegmentWithFallback(resolvePrototypeIdFromTargetPath(targetPath), 'prototype');
  if (!projectSegment || !prototypeSegment) return null;
  return `axhub-${projectSegment}-${prototypeSegment}`;
}

function normalizePromptText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePrototypeRunId(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!/^prototype-task-[a-zA-Z0-9_-]+$/u.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizePromptClient(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized === 'genie:codex') return 'codex';
  if (normalized === 'genie:claude') return 'claude';
  if (normalized === 'genie:gemini') return 'gemini';
  if (normalized === 'genie:opencode') return 'opencode';
  return normalized || 'codex';
}

function createPrototypeRunId(): string {
  return `prototype-task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildPrototypeTaskRecord(params: {
  runId: string;
  prompt: string;
  provider: string;
  acpxSessionName: string;
  status: 'running' | 'done' | 'error';
  stage: 'running' | 'done' | 'error';
  error?: string | null;
  createdAt: number;
  finishedAt?: number | null;
  referenceAssetRefs?: Record<string, unknown>[];
}) {
  const finishedAt = params.finishedAt ?? null;
  return {
    id: params.runId,
    runId: params.runId,
    prompt: params.prompt,
    provider: params.provider,
    status: params.status,
    stage: params.stage,
    error: params.error || null,
    createdAt: params.createdAt,
    finishedAt,
    elapsed: finishedAt ? Math.max(0, finishedAt - params.createdAt) : null,
    acpxSessionName: params.acpxSessionName,
    sessionId: params.acpxSessionName,
    recoverable: true,
    ...(params.referenceAssetRefs?.length ? { referenceAssetRefs: params.referenceAssetRefs } : {}),
  };
}

function toProjectRelativeReferenceAssetPath(params: {
  ref: Record<string, unknown>;
  projectRoot: string;
  specDir: string;
}): string {
  const assetPath = typeof params.ref.assetPath === 'string' ? params.ref.assetPath.trim().replace(/\\/g, '/') : '';
  if (!assetPath) return '';
  return path.relative(params.projectRoot, path.resolve(params.specDir, assetPath)).split(path.sep).join('/');
}

function appendPrototypeReferenceAssetPrompt(params: {
  prompt: string;
  referenceAssetRefs: Record<string, unknown>[];
  projectRoot: string;
  specDir: string;
}): string {
  const referencePaths = params.referenceAssetRefs
    .map((ref) => toProjectRelativeReferenceAssetPath({
      ref,
      projectRoot: params.projectRoot,
      specDir: params.specDir,
    }))
    .filter(Boolean);
  if (!referencePaths.length) return params.prompt;

  return [
    params.prompt,
    '',
    '参考图上下文：',
    ...referencePaths.map((assetPath, index) => `- 参考图 ${index + 1}: \`${assetPath}\``),
    '请在生成原型时读取这些图片，作为视觉布局、内容结构和风格参考。',
  ].join('\n');
}

function upsertPrototypeTask(history: Record<string, any>, task: Record<string, unknown>) {
  const tasks = Array.isArray(history.prototypeTasks) ? history.prototypeTasks : [];
  return [
    task,
    ...tasks.filter((item: any) => item?.id !== task.id),
  ];
}

function upsertPrototypeSession(history: Record<string, any>, session: Record<string, unknown>) {
  const sessions = Array.isArray(history.prototypeSessions) ? history.prototypeSessions : [];
  return [
    session,
    ...sessions.filter((item: any) => !(
      item?.prototypeId === session.prototypeId
      && item?.generatorElementId === session.generatorElementId
    )),
  ];
}

export function handleAssistantPromptIde(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  pathname: string,
  handlers: AssistantIdeHandlers,
): boolean {
  if (
    !pathname.startsWith('/api/assistant/')
    && pathname !== '/api/prompt/execute'
    && pathname !== '/api/prototype-generation/session-run'
    && pathname !== '/api/ide/open'
    && pathname !== '/api/agent/versions'
    && pathname !== '/api/agent/cli/open'
    && pathname !== '/api/agent/local-app/open'
    && pathname !== '/api/agent/web/open'
  ) {
    return false;
  }

  if (pathname === '/api/assistant/runtime' && req.method === 'GET') {
    const context = handlers.resolveProjectContext(req, res, options, 'active-fallback');
    if (!context) return true;
    const url = getRequestUrl(req);
    const config = handlers.getServerConfigStoreForRequest(options).getConfig({ activeProjectRoot: context.project.root });
    resolveAssistantRuntime({
      projectPath: context.project.root,
      assistantConfig: config.assistant,
      autoStart: url.searchParams.get('autoStart') !== 'false',
    }).then((runtime) => {
      sendJson(res, createAssistantRuntimeResponse({
        runtime,
        projectId: context.project.id,
        projectRoot: context.project.root,
        req,
      }));
    }).catch((error: any) => {
      sendJson(res, {
        error: error?.message || 'Failed to resolve assistant runtime',
        code: 'ASSISTANT_RUNTIME_RESOLVE_FAILED',
        projectId: context.project.id,
        projectRoot: context.project.root,
      }, { status: 500 });
    });
    return true;
  }

  if (pathname === '/api/agent/versions') {
    if (req.method !== 'GET') {
      sendJson(res, { error: 'Method not allowed' }, { status: 405 });
      return true;
    }
    detectAgentVersions()
      .then((agents) => sendJson(res, { agents }))
      .catch((error: any) => sendJson(res, {
        error: error?.message || 'Failed to detect agent versions',
      }, { status: 500 }));
    return true;
  }

  if (pathname === '/api/ide/open' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const context = handlers.resolveProjectContext(req, res, options, 'active-fallback', body);
      if (!context) return;

      const rawTargetPath = String(body?.path || body?.targetPath || '').trim();
      const targetPath = rawTargetPath || context.project.root;
      let absoluteTargetPath = '';
      try {
        absoluteTargetPath = resolveProjectPath(context.project.root, targetPath);
      } catch (error: any) {
        sendJson(res, {
          error: error.message,
          code: 'PATH_OUTSIDE_PROJECT',
          projectId: context.project.id,
        }, { status: 403 });
        return;
      }

      const rawExplicitIDE = typeof body?.ide === 'string' ? body.ide.trim() : '';
      const explicitIDE = normalizeMainIDE(rawExplicitIDE);
      if (rawExplicitIDE && !explicitIDE) {
        sendJson(res, {
          error: `Unsupported main IDE: ${rawExplicitIDE}`,
          code: 'MAIN_IDE_UNSUPPORTED',
          projectId: context.project.id,
          supported: ['cursor', 'trae', 'vscode', 'trae_cn', 'windsurf', 'kiro', 'qoder', 'antigravity'],
        }, { status: 400 });
        return;
      }

      const ide = explicitIDE || resolveConfiguredMainIDE(context.project.root, options, handlers);
      if (!ide) {
        sendJson(res, {
          error: 'Main IDE is not configured',
          code: 'MAIN_IDE_NOT_CONFIGURED',
          projectId: context.project.id,
        }, { status: 400 });
        return;
      }

      const ideAvailability = detectIDEAvailabilityAtStartup();
      const missingIDEOpenError = getMissingIDEOpenError(ide, ideAvailability);
      if (missingIDEOpenError) {
        sendJson(res, {
          ...missingIDEOpenError.body,
          projectId: context.project.id,
        }, { status: missingIDEOpenError.statusCode });
        return;
      }

      try {
        const result = await openIDEPath({ ide, targetPath: absoluteTargetPath });
        sendJson(res, {
          ...result,
          projectId: context.project.id,
        });
      } catch (error: any) {
        sendJson(res, {
          error: error?.message || 'Failed to open IDE',
          code: 'IDE_OPEN_FAILED',
          projectId: context.project.id,
          ide,
          targetPath: absoluteTargetPath,
        }, { status: 500 });
      }
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  if (pathname === '/api/agent/cli/open' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const context = handlers.resolveProjectContext(req, res, options, 'active-fallback', body);
      if (!context) return;

      const rawTargetPath = String(body?.path || body?.targetPath || '').trim();
      const targetPath = rawTargetPath || context.project.root;
      let absoluteTargetPath = '';
      try {
        absoluteTargetPath = resolveProjectPath(context.project.root, targetPath);
      } catch (error: any) {
        sendJson(res, {
          error: error.message,
          code: 'PATH_OUTSIDE_PROJECT',
          projectId: context.project.id,
        }, { status: 403 });
        return;
      }

      const rawAgent = typeof body?.agent === 'string' ? body.agent.trim() : '';
      const agent = normalizeCLIAgent(rawAgent);
      if (!agent) {
        sendJson(res, {
          error: `Unsupported CLI agent: ${rawAgent || '(empty)'}`,
          code: 'CLI_AGENT_UNSUPPORTED',
          projectId: context.project.id,
          supported: ['codex', 'gemini', 'claudecode', 'opencode'],
        }, { status: 400 });
        return;
      }

      const availability = detectAgentAvailabilityAtStartup();
      if (availability.cli[agent]?.status === 'missing') {
        const missingAgentOpenError = getMissingCLIAgentOpenError(agent);
        sendJson(res, {
          ...missingAgentOpenError.body,
          projectId: context.project.id,
          availability: availability.cli[agent],
        }, { status: missingAgentOpenError.statusCode });
        return;
      }

      try {
        const result = await openCLIAgent({
          agent,
          targetPath: absoluteTargetPath,
          availability: availability.cli[agent],
        });
        sendJson(res, {
          ...result,
          projectId: context.project.id,
        });
      } catch (error: any) {
        sendJson(res, {
          error: error?.message || 'Failed to open CLI agent',
          code: 'CLI_AGENT_OPEN_FAILED',
          projectId: context.project.id,
          agent,
          targetPath: absoluteTargetPath,
        }, { status: 500 });
      }
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  if (pathname === '/api/agent/local-app/open' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const context = handlers.resolveProjectContext(req, res, options, 'active-fallback', body);
      if (!context) return;

      const rawTargetPath = String(body?.path || body?.targetPath || '').trim();
      const targetPath = rawTargetPath || context.project.root;
      let absoluteTargetPath = '';
      try {
        absoluteTargetPath = resolveProjectPath(context.project.root, targetPath);
      } catch (error: any) {
        sendJson(res, {
          error: error.message,
          code: 'PATH_OUTSIDE_PROJECT',
          projectId: context.project.id,
        }, { status: 403 });
        return;
      }

      const rawAgent = typeof body?.agent === 'string' ? body.agent.trim() : '';
      const agent = normalizeLocalAppAgent(rawAgent);
      if (!agent) {
        sendJson(res, {
          error: `Unsupported local app agent: ${rawAgent || '(empty)'}`,
          code: 'LOCAL_APP_AGENT_UNSUPPORTED',
          projectId: context.project.id,
          supported: ['codex', 'opencode'],
        }, { status: 400 });
        return;
      }

      const availability = detectAgentAvailabilityAtStartup();
      if (availability.localApp[agent]?.status === 'missing') {
        const missingAgentOpenError = getMissingLocalAppOpenError(agent);
        sendJson(res, {
          ...missingAgentOpenError.body,
          projectId: context.project.id,
          availability: availability.localApp[agent],
        }, { status: missingAgentOpenError.statusCode });
        return;
      }

      try {
        const result = await openLocalAppAgent({
          agent,
          targetPath: absoluteTargetPath,
          availability: availability.localApp[agent],
        });
        sendJson(res, {
          ...result,
          projectId: context.project.id,
        });
      } catch (error: any) {
        sendJson(res, {
          error: error?.message || 'Failed to open local app agent',
          code: 'LOCAL_APP_AGENT_OPEN_FAILED',
          projectId: context.project.id,
          agent,
          targetPath: absoluteTargetPath,
        }, { status: 500 });
      }
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  if (pathname === '/api/agent/web/open' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const context = handlers.resolveProjectContext(req, res, options, 'active-fallback', body);
      if (!context) return;

      const rawTargetPath = String(body?.path || body?.targetPath || '').trim();
      const targetPath = rawTargetPath || context.project.root;
      let absoluteTargetPath = '';
      try {
        absoluteTargetPath = resolveProjectPath(context.project.root, targetPath);
      } catch (error: any) {
        sendJson(res, {
          error: error.message,
          code: 'PATH_OUTSIDE_PROJECT',
          projectId: context.project.id,
        }, { status: 403 });
        return;
      }

      const rawAgent = typeof body?.agent === 'string' ? body.agent.trim() : '';
      const agent = normalizeWebAgent(rawAgent);
      if (!agent) {
        sendJson(res, {
          error: `Unsupported web agent: ${rawAgent || '(empty)'}`,
          code: 'WEB_AGENT_UNSUPPORTED',
          projectId: context.project.id,
          supported: ['opencode', 'genie'],
        }, { status: 400 });
        return;
      }

      const availability = detectAgentAvailabilityAtStartup();
      if (availability.web[agent]?.status === 'missing') {
        const missingAgentOpenError = getMissingWebAgentOpenError(agent);
        sendJson(res, {
          ...missingAgentOpenError.body,
          projectId: context.project.id,
          availability: availability.web[agent],
        }, { status: missingAgentOpenError.statusCode });
        return;
      }

      try {
        const result = await openWebAgent({
          agent,
          targetPath: absoluteTargetPath,
          availability: availability.web[agent],
          corsOrigin: typeof body?.corsOrigin === 'string' ? body.corsOrigin.trim() : '',
        });
        sendJson(res, {
          ...result,
          projectId: context.project.id,
        });
      } catch (error: any) {
        sendJson(res, {
          error: error?.message || 'Failed to open web agent',
          code: 'WEB_AGENT_OPEN_FAILED',
          projectId: context.project.id,
          agent,
          targetPath: absoluteTargetPath,
        }, { status: 500 });
      }
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  if (pathname === '/api/assistant/bootstrap' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const context = handlers.resolveProjectContext(req, res, options, 'active-fallback', body);
      if (!context) return;
      const mode = normalizeAssistantBootstrapMode(body?.mode);
      if (!mode) {
        sendJson(res, {
          error: 'Unsupported assistant bootstrap mode',
          code: 'ASSISTANT_BOOTSTRAP_MODE_INVALID',
          projectId: context.project.id,
          supportedModes: ['install_global', 'start_existing'],
        }, { status: 400 });
        return;
      }
      const config = handlers.getServerConfigStoreForRequest(options).getConfig({ activeProjectRoot: context.project.root });
      try {
        const runtime = await runAssistantBootstrap({
          mode,
          projectPath: context.project.root,
          assistantConfig: config.assistant,
        });
        sendJson(res, {
          success: true,
          mode,
          message: 'Axhub Genie 启动命令已触发',
          runtime: createAssistantRuntimeResponse({
            runtime,
            projectId: context.project.id,
            projectRoot: context.project.root,
            req,
          }),
        });
      } catch (error: any) {
        sendJson(res, {
          error: error?.message || 'Failed to bootstrap assistant runtime',
          code: 'ASSISTANT_BOOTSTRAP_FAILED',
          projectId: context.project.id,
          projectRoot: context.project.root,
        }, { status: 500 });
      }
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  if (pathname === '/api/prototype-generation/session-run' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const context = handlers.resolveProjectContext(req, res, options, 'active-fallback', body);
      if (!context) return;
      const targetPath = typeof body?.targetPath === 'string' ? body.targetPath.trim() : '';
      const prototypeId = resolvePrototypeIdFromTargetPath(targetPath);
      if (!prototypeId || !context.metadata) {
        sendJson(res, {
          error: 'targetPath must be prototypes/<id>',
          code: 'PROTOTYPE_GENERATION_TARGET_INVALID',
          projectId: context.project.id,
        }, { status: 400 });
        return;
      }
      const generatorElementId = normalizePromptText(body?.generatorElementId);
      if (!generatorElementId) {
        sendJson(res, {
          error: 'generatorElementId is required',
          code: 'PROTOTYPE_GENERATION_GENERATOR_REQUIRED',
          projectId: context.project.id,
        }, { status: 400 });
        return;
      }
      const prompt = normalizePromptText(body?.prompt);
      if (!prompt) {
        sendJson(res, {
          error: 'Prompt 不能为空',
          code: 'PROTOTYPE_GENERATION_PROMPT_EMPTY',
          projectId: context.project.id,
        }, { status: 400 });
        return;
      }

      const resolvedHistory = resolveAiImageHistoryPath(context.project.root, context.metadata, targetPath);
      if (resolvedHistory.ok === false) {
        sendJson(res, { error: resolvedHistory.error, code: 'PROTOTYPE_GENERATION_HISTORY_UNAVAILABLE' }, { status: resolvedHistory.status });
        return;
      }

      const runId = normalizePrototypeRunId(body?.taskId) || createPrototypeRunId();
      const createdAt = Date.now();
      const provider = normalizePromptClient(body?.preferredPromptClient || body?.client);
      const acpxSessionName = resolveCanvasPrototypeGenerationSessionName(context.project.id, targetPath);
      if (!acpxSessionName) {
        sendJson(res, {
          error: 'Failed to resolve prototype generation session',
          code: 'PROTOTYPE_GENERATION_SESSION_INVALID',
          projectId: context.project.id,
        }, { status: 400 });
        return;
      }
      const config = handlers.getServerConfigStoreForRequest(options).getConfig({ activeProjectRoot: context.project.root });
      const baseHistory = readAiImageHistoryFile(resolvedHistory);
      const referenceAssetRefs = persistAiImageReferenceAssets(
        Array.isArray(body?.referenceImages) ? body.referenceImages : [],
        resolvedHistory,
      );
      const promptForRun = appendPrototypeReferenceAssetPrompt({
        prompt,
        referenceAssetRefs,
        projectRoot: context.project.root,
        specDir: resolvedHistory.specDir,
      });
      const runningTask = buildPrototypeTaskRecord({
        runId,
        prompt: promptForRun,
        provider,
        acpxSessionName,
        status: 'running',
        stage: 'running',
        createdAt,
        referenceAssetRefs,
      });
      persistAiImageHistory({
        ...baseHistory,
        prototypeTasks: upsertPrototypeTask(baseHistory, runningTask),
        prototypeSessions: upsertPrototypeSession(baseHistory, {
          prototypeId,
          generatorElementId,
          acpxSessionName,
          lastRun: {
            runId,
            status: 'running',
            stage: 'running',
            prompt: promptForRun,
            createdAt,
          },
        }),
      }, resolvedHistory);

      try {
        const acpxConfig = resolvePromptExecutionAcpxConfig(CANVAS_PROTOTYPE_GENERATION_SCENE, config?.automation?.acpx);
        const result = await executeAcpxPrompt({
          scene: CANVAS_PROTOTYPE_GENERATION_SCENE,
          client: provider,
          prompt: promptForRun,
          projectRoot: context.project.root,
          config: {
            ...(acpxConfig || {}),
            sessionName: acpxSessionName,
          },
        });
        const finishedAt = Date.now();
        const latestHistory = readAiImageHistoryFile(resolvedHistory);
        const doneTask = buildPrototypeTaskRecord({
          runId,
          prompt: promptForRun,
          provider,
          acpxSessionName,
          status: 'done',
          stage: 'done',
          createdAt,
          finishedAt,
          referenceAssetRefs,
        });
        const document = persistAiImageHistory({
          ...latestHistory,
          prototypeTasks: upsertPrototypeTask(latestHistory, doneTask),
          prototypeSessions: upsertPrototypeSession(latestHistory, {
            prototypeId,
            generatorElementId,
            acpxSessionName,
            lastRun: {
              runId,
              status: 'done',
              stage: 'done',
              prompt: promptForRun,
              createdAt,
              finishedAt,
              elapsed: Math.max(0, finishedAt - createdAt),
            },
          }),
        }, resolvedHistory);
        sendJson(res, {
          ...result,
          sessionId: result.sessionId || acpxSessionName,
          acpxSessionName,
          runId,
          targetPath: `prototypes/${prototypeId}`,
          generatorElementId,
          task: doneTask,
          history: aiImageHistoryToClient(document, resolvedHistory),
          projectId: context.project.id,
          projectRoot: context.project.root,
        });
      } catch (error: any) {
        const finishedAt = Date.now();
        const latestHistory = readAiImageHistoryFile(resolvedHistory);
        const errorTask = buildPrototypeTaskRecord({
          runId,
          prompt: promptForRun,
          provider,
          acpxSessionName,
          status: 'error',
          stage: 'error',
          error: error?.message || 'AI 生成执行失败',
          createdAt,
          finishedAt,
          referenceAssetRefs,
        });
        persistAiImageHistory({
          ...latestHistory,
          prototypeTasks: upsertPrototypeTask(latestHistory, errorTask),
          prototypeSessions: upsertPrototypeSession(latestHistory, {
            prototypeId,
            generatorElementId,
            acpxSessionName,
            lastRun: {
              runId,
              status: 'error',
              stage: 'error',
              prompt: promptForRun,
              error: errorTask.error,
              createdAt,
              finishedAt,
              elapsed: Math.max(0, finishedAt - createdAt),
            },
          }),
        }, resolvedHistory);
        if (error instanceof AcpxPromptExecutionError) {
          sendJson(res, {
            error: error.message,
            code: error.code,
            projectId: context.project.id,
            projectRoot: context.project.root,
            provider: error.provider,
            command: error.command,
            exitCode: error.exitCode,
            stdout: error.stdout,
            stderr: error.stderr,
            sessionId: acpxSessionName,
            acpxSessionName,
            runId,
            targetPath: `prototypes/${prototypeId}`,
            generatorElementId,
            task: errorTask,
          }, { status: error.statusCode });
          return;
        }
        sendJson(res, {
          error: error?.message || 'Prototype generation failed',
          code: 'PROTOTYPE_GENERATION_SESSION_RUN_FAILED',
          projectId: context.project.id,
          projectRoot: context.project.root,
          sessionId: acpxSessionName,
          acpxSessionName,
          runId,
          targetPath: `prototypes/${prototypeId}`,
          generatorElementId,
          task: errorTask,
        }, { status: 500 });
      }
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  if (pathname === '/api/prompt/execute' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const context = handlers.resolveProjectContext(req, res, options, 'active-fallback', body);
      if (!context) return;
      const config = handlers.getServerConfigStoreForRequest(options).getConfig({ activeProjectRoot: context.project.root });
      try {
        const acpxConfig = resolvePromptExecutionAcpxConfig(body?.scene, config?.automation?.acpx);
        const sessionName = String(body?.scene || '').trim() === CANVAS_PROTOTYPE_GENERATION_SCENE
          ? resolveCanvasPrototypeGenerationSessionName(context.project.id, body?.targetPath)
          : null;
        const result = await executeAcpxPrompt({
          scene: body?.scene,
          client: body?.client,
          prompt: body?.prompt,
          projectRoot: context.project.root,
          config: {
            ...(acpxConfig || {}),
            ...(sessionName ? { sessionName } : {}),
          },
        });
        sendJson(res, {
          ...result,
          ...(sessionName ? { sessionId: result.sessionId || sessionName, sessionName } : {}),
          projectId: context.project.id,
          projectRoot: context.project.root,
        });
      } catch (error: any) {
        if (error instanceof AcpxPromptExecutionError) {
          sendJson(res, {
            error: error.message,
            code: error.code,
            projectId: context.project.id,
            projectRoot: context.project.root,
            provider: error.provider,
            command: error.command,
            exitCode: error.exitCode,
            stdout: error.stdout,
            stderr: error.stderr,
          }, { status: error.statusCode });
          return;
        }
        sendJson(res, {
          error: error?.message || 'Prompt execution failed',
          code: 'PROMPT_EXECUTION_FAILED',
          projectId: context.project.id,
          projectRoot: context.project.root,
        }, { status: 500 });
      }
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  return false;
}
