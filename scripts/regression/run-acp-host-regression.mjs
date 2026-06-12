#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_BASE_URL = 'http://127.0.0.1:53817';
const DEFAULT_ACP_BASE_URL = 'http://127.0.0.1:32123';
const DEFAULT_PROJECT_ID = 'make-2-2';
const DEFAULT_CANVAS_PROTOTYPE = 'annotation-demo';
const DEFAULT_PREVIEW_PROTOTYPE = 'untitled-4';
const DEFAULT_MIDSCENE_CLI_PACKAGE = '@midscene/cli@1.8.1';
const DEFAULT_VIEWPORT = { width: 1440, height: 1000 };
const REGRESSION_PROMPT_PROVIDERS = ['codex', 'claude', 'gemini', 'opencode'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sseEvent(event, chunk) {
  return `event: ${event}\ndata: ${JSON.stringify(chunk)}\n\n`;
}

async function writeMockAcpSseEvent(res, event, chunk) {
  res.write(sseEvent(event, chunk));
  await sleep(25);
}

function createMockAcpHostPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Mock ACP Host Regression</title>
  </head>
  <body>
    <main>Mock ACP Host Regression</main>
    <script>
      (() => {
        let context = { items: [], updatedAt: new Date().toISOString() };
        const supportedEvents = [];
        window.addEventListener('message', (event) => {
          const message = event.data || {};
          const requestId = message.requestId;
          const items = Array.isArray(message.payload?.items) ? message.payload.items : [];
          if (message.type === 'acp.host.ready') {
            event.source?.postMessage({
              type: 'acp.ui.ready',
              requestId,
              payload: {
                ok: true,
                version: 1,
                supportedEvents,
                snapshot: null,
              },
            }, event.origin);
            return;
          }
          if (message.type === 'acp.context.replace' || message.type === 'acp.context.add') {
            context = {
              items: message.type === 'acp.context.add' ? context.items.concat(items) : items,
              updatedAt: new Date().toISOString(),
            };
            event.source?.postMessage({
              type: 'acp.context.result',
              requestId,
              payload: { ok: true, context },
            }, event.origin);
            return;
          }
        });
      })();
    </script>
  </body>
</html>`;
}

async function startMockAcpRunServer() {
  const requests = [];
  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const corsHeaders = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }
    if (req.method === 'GET' && requestUrl.pathname === '/') {
      res.writeHead(200, { ...corsHeaders, 'content-type': 'text/html; charset=utf-8' });
      res.end(createMockAcpHostPage());
      return;
    }
    if (req.method === 'GET' && requestUrl.pathname === '/__axhub-mock-acp/requests') {
      res.writeHead(200, { ...corsHeaders, 'content-type': 'application/json' });
      res.end(JSON.stringify({ requests }));
      return;
    }
    if (req.method === 'GET' && req.url === '/api/chat') {
      res.writeHead(405, { ...corsHeaders, 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    if (req.method === 'POST' && req.url === '/api/chat') {
      const rawBody = await readRequestBody(req);
      const body = rawBody ? JSON.parse(rawBody) : {};
      requests.push({
        method: req.method,
        url: req.url,
        body,
      });
      const threadId = String(body.threadId || body.id || 'midscene-comment-ai-smoke');
      res.writeHead(200, {
        ...corsHeaders,
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        'connection': 'keep-alive',
        'x-acp-provider': String(body.provider || 'codex'),
        'x-acp-thread-id': encodeURIComponent(threadId),
        'x-acp-session-id': `session-${threadId}`,
      });
      res.flushHeaders?.();
      await writeMockAcpSseEvent(res, 'text-delta', {
        type: 'text-delta',
        delta: 'Midscene deterministic comment AI smoke completed.',
      });
      await writeMockAcpSseEvent(res, 'finish', { type: 'finish', finishReason: 'stop' });
      res.end('data: [DONE]\n\n');
      return;
    }
    res.writeHead(404, { ...corsHeaders, 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start mock ACP run server');
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Request failed: ${JSON.stringify({ url: String(url), status: response.status, payload })}`);
  }
  return payload;
}

function normalizeRegressionPromptProvider(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  const provider = normalized.startsWith('acp:') ? normalized.slice('acp:'.length) : normalized;
  if (!provider) return '';
  if (!REGRESSION_PROMPT_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported AXHUB_MAKE_E2E_PROMPT_PROVIDER: ${String(value)}. Expected one of: ${REGRESSION_PROMPT_PROVIDERS.join(', ')}`);
  }
  return provider;
}

function resolveRegressionPromptProvider(env) {
  return normalizeRegressionPromptProvider(env.AXHUB_MAKE_E2E_PROMPT_PROVIDER || env.AXHUB_MAKE_E2E_PROVIDER);
}

function createProjectConfigUrl(baseUrl, projectId) {
  const configUrl = new URL('/api/config', baseUrl);
  configUrl.searchParams.set('projectId', projectId);
  return configUrl;
}

async function verifyMockAcpRegressionConfig({ baseUrl, projectId, mockWebBaseUrl, mockApiBaseUrl }) {
  const configUrl = createProjectConfigUrl(baseUrl, projectId);
  const readback = await fetchJson(configUrl);
  if (readback?.assistant?.webBaseUrl !== mockWebBaseUrl || readback?.assistant?.apiBaseUrl !== mockApiBaseUrl) {
    throw new Error(`Mock ACP config was not applied to the regression project: ${JSON.stringify({
      projectId,
      expected: {
        webBaseUrl: mockWebBaseUrl,
        apiBaseUrl: mockApiBaseUrl,
      },
      actual: readback?.assistant || null,
    })}`);
  }
  return readback;
}

async function configureMockAcpForRegression({ baseUrl, projectId, mockWebBaseUrl, mockApiBaseUrl, promptProvider }) {
  const configUrl = createProjectConfigUrl(baseUrl, projectId);
  const previousConfig = await fetchJson(configUrl);
  if (!previousConfig?.automation || !previousConfig?.assistant) {
    throw new Error(`Failed to read config before ACP host regression: ${JSON.stringify(previousConfig)}`);
  }
  const defaultPromptClient = promptProvider
    ? `acp:${promptProvider}`
    : previousConfig.automation.defaultPromptClient || 'acp:codex';
  await fetchJson(configUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assistant: {
        webBaseUrl: mockWebBaseUrl,
        apiBaseUrl: mockApiBaseUrl,
      },
      automation: {
        defaultPromptClient,
        defaultIDE: previousConfig.automation.defaultIDE || 'none',
        acp: {
          ...(previousConfig.automation.acp || {}),
          timeout: 30,
        },
      },
    }),
  });
  return async () => {
    await fetchJson(configUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assistant: previousConfig.assistant,
        automation: previousConfig.automation,
      }),
    });
  };
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const withoutExport = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
  const equalsIndex = withoutExport.indexOf('=');
  if (equalsIndex === -1) return null;
  const key = withoutExport.slice(0, equalsIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  let value = withoutExport.slice(equalsIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

async function readEnvFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8').catch(() => '');
  const result = {};
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (parsed) result[parsed[0]] = parsed[1];
  }
  return result;
}

async function buildBaseEnv() {
  const midsceneEnv = await readEnvFile(path.join(rootDir, '.env.midscene'));
  return {
    ...midsceneEnv,
    ...process.env,
  };
}

function boolFromEnv(value, defaultValue = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return defaultValue;
  return ['1', 'true', 'yes', 'y'].includes(normalized);
}

async function pathExists(filePath) {
  return fs.access(filePath).then(
    () => true,
    () => false,
  );
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const output = [];
    const child = spawn(command, args, {
      cwd: options.cwd || rootDir,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      ...(options.detached ? { detached: true } : {}),
    });
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      output.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      output.push(chunk);
    });
    child.on('close', (code, signal) => {
      resolve({ code, signal, output: Buffer.concat(output).toString('utf8') });
    });
  });
}

async function ensureMidsceneCli(env) {
  if (env.MIDSCENE_CLI_COMMAND) return env.MIDSCENE_CLI_COMMAND;

  const runtimeDir = path.join(rootDir, 'tmp-midscene', 'cli-runtime');
  const packageJsonPath = path.join(runtimeDir, 'package.json');
  const midsceneBin = path.join(runtimeDir, 'node_modules', '.bin', 'midscene');
  if (await pathExists(midsceneBin)) return midsceneBin;

  await fs.mkdir(runtimeDir, { recursive: true });
  if (!(await pathExists(packageJsonPath))) {
    await fs.writeFile(packageJsonPath, `${JSON.stringify({ private: true, type: 'module' }, null, 2)}\n`);
  }

  console.error('[midscene] preparing local CLI runtime in tmp-midscene/cli-runtime');
  const result = await runCommand('npm', ['install', '--ignore-scripts', DEFAULT_MIDSCENE_CLI_PACKAGE], {
    cwd: runtimeDir,
    env,
  });
  if (result.code !== 0 || !(await pathExists(midsceneBin))) {
    throw new Error(`Failed to prepare Midscene CLI runtime.\n${result.output}`);
  }
  return midsceneBin;
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHttpOk(url, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) return true;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || 'no response'}`);
}

function readPrototypeList(resources) {
  if (Array.isArray(resources?.resources?.prototypes)) return resources.resources.prototypes;
  if (Array.isArray(resources?.data?.prototypes)) return resources.data.prototypes;
  return [];
}

async function ensureActiveProject({ baseUrl, projectId, canvasPrototype, previewPrototype, timeoutMs = 30_000 }) {
  const activeUrl = new URL('/api/projects/active', baseUrl);
  const activeResponse = await fetch(activeUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });
  const activeBody = await activeResponse.json().catch(() => null);
  if (!activeResponse.ok || activeBody?.activeProject?.id !== projectId) {
    throw new Error(`Failed to switch active project for ACP host regression: ${JSON.stringify({ status: activeResponse.status, body: activeBody })}`);
  }

  const deadline = Date.now() + timeoutMs;
  let lastState = null;
  while (Date.now() < deadline) {
    const projectsResponse = await fetch(new URL('/api/projects', baseUrl));
    const projects = await projectsResponse.json().catch(() => null);
    const resourcesResponse = await fetch(new URL(`/api/projects/${encodeURIComponent(projectId)}/resources`, baseUrl));
    const resources = await resourcesResponse.json().catch(() => null);
    const prototypes = readPrototypeList(resources);
    lastState = {
      activeProjectId: projects?.activeProjectId || '',
      prototypeCount: prototypes.length,
      hasCanvasPrototype: prototypes.some((item) => item?.name === canvasPrototype),
      hasPreviewPrototype: prototypes.some((item) => item?.name === previewPrototype),
    };
    if (lastState.activeProjectId === projectId && lastState.hasCanvasPrototype && lastState.hasPreviewPrototype) {
      return lastState;
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for active regression project resources: ${JSON.stringify(lastState)}`);
}

function getPortFromBaseUrl(baseUrl, fallbackPort) {
  try {
    const url = new URL(baseUrl);
    return Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  } catch {
    return fallbackPort;
  }
}

function shouldManageMakeServer(env) {
  const explicit = String(env.AXHUB_MAKE_E2E_MANAGE_SERVER || '').trim().toLowerCase();
  if (['false', '0', 'no'].includes(explicit)) return false;
  return true;
}

async function resolveMakeBaseUrl(env) {
  const explicitBaseUrl = env.AXHUB_MAKE_E2E_BASE_URL || env.AXHUB_MAKE_BASE_URL;
  if (explicitBaseUrl) return explicitBaseUrl;
  if (!shouldManageMakeServer(env)) return DEFAULT_BASE_URL;
  const port = await getFreePort();
  return `http://127.0.0.1:${port}`;
}

async function startManagedMakeServer({ baseUrl, env, logFile }) {
  if (!shouldManageMakeServer(env)) {
    await waitForHttpOk(baseUrl);
    return { baseUrl, cleanup: async () => {} };
  }

  const port = getPortFromBaseUrl(baseUrl, 53817);
  const child = spawn('pnpm', ['server:dev', '--', '--port', String(port), '--no-open'], {
    cwd: rootDir,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logChunks = [];
  child.stdout.on('data', (chunk) => {
    process.stderr.write(chunk);
    logChunks.push(chunk);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    logChunks.push(chunk);
  });

  try {
    await waitForHttpOk(baseUrl);
  } catch (error) {
    await fs.writeFile(logFile, Buffer.concat(logChunks).toString('utf8')).catch(() => {});
    throw error;
  }

  return {
    baseUrl,
    cleanup: async () => {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        try {
          child.kill('SIGTERM');
        } catch {}
      }
      await fs.writeFile(logFile, Buffer.concat(logChunks).toString('utf8')).catch(() => {});
      await sleep(1000);
    },
  };
}

async function findSystemChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.MIDSCENE_MCP_CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

async function getFreePort() {
  const net = await import('node:net');
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => resolve(port));
    });
  });
}

async function waitForCdpEndpoint(port, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  const url = `http://127.0.0.1:${port}/json/version`;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for Chrome CDP endpoint on ${url}: ${lastError?.message || 'no response'}`);
}

async function launchChromeForCdp({ env, runId, initialUrl }) {
  if (env.MIDSCENE_CDP_ENDPOINT) {
    return { cdpEndpoint: env.MIDSCENE_CDP_ENDPOINT, cleanup: async () => {} };
  }
  if (!boolFromEnv(env.AXHUB_MAKE_E2E_AUTO_CDP, false)) {
    return { cdpEndpoint: '', cleanup: async () => {} };
  }

  const chromePath = await findSystemChrome();
  if (!chromePath) return { cdpEndpoint: '', cleanup: async () => {} };

  const port = await getFreePort();
  const userDataDir = path.join(os.tmpdir(), `axhub-make-midscene-chrome-${runId}-${port}`);
  await fs.mkdir(userDataDir, { recursive: true });

  const child = spawn(
    chromePath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${DEFAULT_VIEWPORT.width},${DEFAULT_VIEWPORT.height}`,
      '--no-first-run',
      '--no-default-browser-check',
      initialUrl || 'about:blank',
    ],
    {
      detached: true,
      stdio: 'ignore',
    },
  );
  child.unref();

  const cdpEndpoint = await waitForCdpEndpoint(port);
  return {
    cdpEndpoint,
    cleanup: async () => {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        try {
          child.kill('SIGTERM');
        } catch {}
      }
      await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

async function listFiles(dir, predicate) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath, predicate)));
    } else if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function createReportUrl(baseUrl, filePath) {
  const relativePath = path.relative(rootDir, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  const urlPath = relativePath.split(path.sep).map(encodeURIComponent).join('/');
  return new URL(`/${urlPath}`, baseUrl).toString();
}

function resolveRunId(env) {
  return env.AXHUB_MAKE_E2E_RUN_ID || new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function redactConfig(config) {
  const redacted = { ...config };
  for (const key of Object.keys(redacted)) {
    if (/API_KEY|TOKEN|SECRET|PASSWORD/i.test(key)) {
      redacted[key] = redacted[key] ? '<redacted>' : '';
    }
  }
  return redacted;
}

async function main() {
  const argv = new Set(process.argv.slice(2));
  const baseEnv = await buildBaseEnv();
  const runId = resolveRunId(baseEnv);
  const baseUrl = await resolveMakeBaseUrl(baseEnv);
  const acpBaseUrl = baseEnv.AXHUB_ACP_UI_BASE_URL || baseEnv.AXHUB_ASSISTANT_WEB_BASE_URL || DEFAULT_ACP_BASE_URL;
  const projectId = baseEnv.AXHUB_MAKE_E2E_PROJECT_ID || DEFAULT_PROJECT_ID;
  const canvasPrototype = baseEnv.AXHUB_MAKE_E2E_CANVAS_PROTOTYPE || DEFAULT_CANVAS_PROTOTYPE;
  const previewPrototype = baseEnv.AXHUB_MAKE_E2E_PREVIEW_PROTOTYPE || DEFAULT_PREVIEW_PROTOTYPE;
  const promptProvider = resolveRegressionPromptProvider(baseEnv);
  const requireAcpReady = boolFromEnv(baseEnv.AXHUB_MAKE_E2E_REQUIRE_ACP_READY, false);
  const artifactsRoot = path.resolve(
    baseEnv.AXHUB_MAKE_E2E_ARTIFACTS_DIR || path.join(rootDir, 'automation-reports', 'midscene', `acp-host-${runId}`),
  );
  const outputPath = path.join(artifactsRoot, 'midscene-output.json');
  const logPath = path.join(artifactsRoot, 'midscene-log.json');
  const summaryPath = path.join(artifactsRoot, 'midscene-summary.json');
  const cliOutputPath = path.join(artifactsRoot, 'midscene-cli-output.log');
  const serverLogPath = path.join(artifactsRoot, 'make-server.log');
  const runDir = path.join(artifactsRoot, 'midscene_run');
  const yamlPath = path.join(rootDir, 'midscene', 'acp-host-regression.yaml');

  const acpReady = await isReachable(acpBaseUrl);
  if (requireAcpReady && !acpReady) {
    throw new Error(`AXHUB_MAKE_E2E_REQUIRE_ACP_READY is true, but ACP UI is not reachable: ${acpBaseUrl}`);
  }

  const config = {
    baseUrl,
    acpBaseUrl,
    acpReady,
    projectId,
    canvasPrototype,
    previewPrototype,
    promptProvider: promptProvider || null,
    defaultPromptClient: promptProvider ? `acp:${promptProvider}` : null,
    runId,
    yamlPath,
    artifactsRoot,
    outputPath,
    logPath,
    summaryPath,
    runDir,
    MIDSCENE_MODEL_BASE_URL: baseEnv.MIDSCENE_MODEL_BASE_URL || '',
    MIDSCENE_MODEL_API_KEY: baseEnv.MIDSCENE_MODEL_API_KEY || '',
    MIDSCENE_MODEL_NAME: baseEnv.MIDSCENE_MODEL_NAME || '',
    MIDSCENE_MODEL_FAMILY: baseEnv.MIDSCENE_MODEL_FAMILY || '',
  };

  if (argv.has('--print-config')) {
    console.log(JSON.stringify(redactConfig(config), null, 2));
    return;
  }

  await fs.mkdir(artifactsRoot, { recursive: true });
  const cliCommand = await ensureMidsceneCli(baseEnv);
  let managedMakeServer = null;
  let chrome = null;
  let mockAcpRunServer = null;
  let restoreRegressionConfig = null;
  let result;
  let runEnv = {
    ...baseEnv,
    AXHUB_MAKE_E2E_BASE_URL: baseUrl,
    AXHUB_ACP_UI_BASE_URL: acpBaseUrl,
    AXHUB_ACP_UI_READY: acpReady ? 'true' : 'false',
    AXHUB_MAKE_E2E_PROJECT_ID: projectId,
    AXHUB_MAKE_E2E_CANVAS_PROTOTYPE: canvasPrototype,
    AXHUB_MAKE_E2E_PREVIEW_PROTOTYPE: previewPrototype,
    AXHUB_MAKE_E2E_PROMPT_PROVIDER: promptProvider,
    AXHUB_MAKE_E2E_RUN_ID: runId,
    AXHUB_MAKE_E2E_OUTPUT: outputPath,
    AXHUB_MAKE_E2E_LOG: logPath,
    MIDSCENE_RUN_DIR: runDir,
  };

  try {
    mockAcpRunServer = await startMockAcpRunServer();
    runEnv = {
      ...runEnv,
      AXHUB_ACP_UI_READY: 'true',
      AXHUB_MAKE_E2E_MOCK_ACP_WEB_BASE_URL: mockAcpRunServer.origin,
      AXHUB_MAKE_E2E_MOCK_ACP_API_BASE_URL: `${mockAcpRunServer.origin}/api`,
    };
    managedMakeServer = await startManagedMakeServer({
      baseUrl,
      env: runEnv,
      logFile: serverLogPath,
    });
    await ensureActiveProject({
      baseUrl: managedMakeServer.baseUrl,
      projectId,
      canvasPrototype,
      previewPrototype,
    });
    restoreRegressionConfig = await configureMockAcpForRegression({
      baseUrl: managedMakeServer.baseUrl,
      projectId,
      mockWebBaseUrl: mockAcpRunServer.origin,
      mockApiBaseUrl: `${mockAcpRunServer.origin}/api`,
      promptProvider,
    });
    await verifyMockAcpRegressionConfig({
      baseUrl: managedMakeServer.baseUrl,
      projectId,
      mockWebBaseUrl: mockAcpRunServer.origin,
      mockApiBaseUrl: `${mockAcpRunServer.origin}/api`,
    });
    await sleep(Number(runEnv.AXHUB_MAKE_E2E_CONFIG_SETTLE_MS || 10000));
    const bootstrapUrl = new URL(managedMakeServer.baseUrl);
    bootstrapUrl.searchParams.set('projectId', projectId);
    bootstrapUrl.searchParams.set('p', canvasPrototype);
    bootstrapUrl.searchParams.set('v', 'canvas');
    const bootstrapUrlString = bootstrapUrl.toString();

    chrome = await launchChromeForCdp({
      env: runEnv,
      runId,
      initialUrl: bootstrapUrlString,
    });
    runEnv = {
      ...runEnv,
      AXHUB_MAKE_E2E_BASE_URL: bootstrapUrlString,
      MIDSCENE_CDP_ENDPOINT: chrome.cdpEndpoint || runEnv.MIDSCENE_CDP_ENDPOINT || '',
    };
    if (!runEnv.MIDSCENE_CDP_ENDPOINT && !runEnv.PUPPETEER_EXECUTABLE_PATH) {
      const chromeExecutablePath = await findSystemChrome();
      if (chromeExecutablePath) {
        runEnv.PUPPETEER_EXECUTABLE_PATH = chromeExecutablePath;
        runEnv.CHROME_PATH = runEnv.CHROME_PATH || chromeExecutablePath;
      }
    }

    console.error('[midscene:acp-host] start');
    result = await runCommand(cliCommand, ['--files', yamlPath, '--summary', summaryPath], { env: runEnv });
    await fs.writeFile(cliOutputPath, result.output || '');
  } finally {
    await restoreRegressionConfig?.();
    await chrome?.cleanup();
    await managedMakeServer?.cleanup();
    await mockAcpRunServer?.close();
  }

  const reportFiles = await listFiles(runDir, (file) => file.endsWith('.html'));
  const jsonFiles = await listFiles(artifactsRoot, (file) => file.endsWith('.json'));
  const reportPath = path.join(artifactsRoot, 'acp-host-regression-report.json');
  const report = {
    tool: 'midscene',
    suite: 'acp-host-regression',
    status: result?.code === 0 ? 'passed' : 'failed',
    exitCode: result?.code ?? null,
    signal: result?.signal ?? null,
    baseUrl: managedMakeServer?.baseUrl ?? baseUrl,
    acpBaseUrl,
    acpReady,
    projectId,
    canvasPrototype,
    previewPrototype,
    promptProvider: promptProvider || null,
    defaultPromptClient: promptProvider ? `acp:${promptProvider}` : null,
    runId,
    yamlPath,
    artifactsRoot,
    outputPath,
    logPath,
    cliOutputPath,
    summaryPath,
    serverLogPath,
    runDir,
    mockAcpRunRequestCount: mockAcpRunServer?.requests.length ?? 0,
    mockAcpRunProviders: Array.from(new Set((mockAcpRunServer?.requests || []).map((request) => request.body?.provider).filter(Boolean))),
    cdpEndpoint: runEnv.MIDSCENE_CDP_ENDPOINT || null,
    reportFiles,
    reportUrls: reportFiles.map((file) => createReportUrl(managedMakeServer?.baseUrl ?? baseUrl, file)).filter(Boolean),
    jsonFiles,
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify({
    reportPath,
    artifactsRoot,
    status: report.status,
    acpReady,
    reportUrls: report.reportUrls,
  }, null, 2));

  if (result?.code !== 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
