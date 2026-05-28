import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getOpenCodeBridgeHub, isOpenCodeBridgeUpgrade } from './opencodeBridge.ts';
import { getCanvasBridgeHub, isCanvasBridgeUpgrade } from './canvasBridge.ts';

import {
  getConfigPath,
  readServerInfo,
  writeServerInfo,
} from './projectCore/index.ts';

import { buildInjectScript, handleAdminStatic } from './adminStatic.ts';
import type { AdminStaticOptions } from './adminStatic.ts';
import { DEFAULT_MAKE_SERVER_PORT } from './defaults.ts';
import { closeManagedOpenCodeServers, readManagedOpenCodeServerUrl } from './agentOpen.ts';
import { getLocalIP, sendJson } from './http.ts';
import { handleManagementApi } from './managementApi.ts';
import type { CommandExecutor } from './managementApi.cloudPublishing.ts';
import { releaseListeningProcessesOnPort } from './portOccupancy.ts';
import { isRuntimeHtmlProxyRequest, isRuntimeOnlyRoute, proxyToRuntime } from './runtimeProxy.ts';
import type { ViteDevMiddleware } from './viteDevServer.ts';

export interface StartMakeServerOptions {
  projectRoot: string;
  port?: number;
  host?: string;
  runtimeOrigin?: string;
  adminRoot?: string;
  opencodeWebUiRoot?: string;
  registryPath?: string;
  devMode?: boolean;
  cloudPublishingCommandExecutor?: CommandExecutor;
}

export interface RunningMakeServer {
  port: number;
  host: string;
  origin: string;
  close: () => Promise<void>;
}

const serverDir = path.dirname(fileURLToPath(import.meta.url));

export interface ResolveDefaultAdminRootOptions {
  serverDir?: string;
  execPath?: string;
  argvPath?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  exists?: (candidate: string) => boolean;
}

export function resolveDefaultAdminRoot(options: ResolveDefaultAdminRootOptions = {}): string {
  const currentServerDir = options.serverDir || serverDir;
  const cwd = options.cwd || process.cwd();
  const env = options.env || process.env;
  const exists = options.exists || ((candidate: string) => fs.existsSync(candidate));
  const explicitAdminRoot = env.AXHUB_MAKE_ADMIN_ROOT?.trim();

  if (explicitAdminRoot) {
    return path.resolve(cwd, explicitAdminRoot);
  }

  const candidates = [
    path.resolve(path.dirname(options.execPath || process.execPath), 'admin'),
    path.resolve(currentServerDir, '../admin'),
    path.resolve(currentServerDir, '../../dist/admin'),
    path.resolve(path.dirname(options.argvPath || process.argv[1] || ''), '../dist/admin'),
  ];

  return candidates.find((candidate) => exists(candidate)) || candidates[2];
}

function readProjectLANAccessAllowed(projectRoot: string): boolean {
  const configPath = getConfigPath(projectRoot);
  if (!fs.existsSync(configPath)) {
    return true;
  }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return config?.server?.allowLAN !== false;
  } catch {
    return true;
  }
}

export interface ResolveMakeServerListenHostOptions {
  projectRoot: string;
  explicitHost?: string;
}

export function resolveMakeServerListenHost(options: ResolveMakeServerListenHostOptions): string {
  const explicitHost = String(options.explicitHost || '').trim();
  if (explicitHost) {
    return explicitHost;
  }
  return readProjectLANAccessAllowed(path.resolve(options.projectRoot)) ? '0.0.0.0' : 'localhost';
}

function resolvePublicOriginHost(host: string): string {
  return host === '0.0.0.0' || host === '::' ? 'localhost' : host;
}

function listen(server: http.Server, port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

function resolveRuntimeOrigin(projectRoot: string, explicitRuntimeOrigin?: string): string | undefined {
  if (explicitRuntimeOrigin) {
    return explicitRuntimeOrigin;
  }
  return readServerInfo(projectRoot, 'runtime')?.origin;
}

function decodeOpenCodeDirectoryFromPathname(pathname: string): string {
  const encodedDirectory = pathname.match(/^\/opencode\/([^/?#]+)/u)?.[1] || '';
  if (!encodedDirectory || encodedDirectory === 'assets' || encodedDirectory === 'index.html') {
    return '';
  }

  try {
    return Buffer.from(decodeURIComponent(encodedDirectory), 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

function resolveOpenCodeServerOrigin(pathname = ''): string {
  const requestTargetPath = decodeOpenCodeDirectoryFromPathname(pathname);
  if (!requestTargetPath) {
    return '';
  }

  return readManagedOpenCodeServerUrl(requestTargetPath);
}

function resolveOpenCodeWebUiRoot(adminRoot: string, explicitRoot?: string): string {
  if (explicitRoot) {
    return explicitRoot;
  }
  const adjacentRoot = path.resolve(path.dirname(adminRoot), 'opencode-webui');
  const nestedRoot = path.resolve(adminRoot, 'opencode-webui');
  return fs.existsSync(path.join(adjacentRoot, 'index.html')) ? adjacentRoot : nestedRoot;
}

export async function startMakeServer(options: StartMakeServerOptions): Promise<RunningMakeServer> {
  const projectRoot = path.resolve(options.projectRoot);
  const host = resolveMakeServerListenHost({ projectRoot, explicitHost: options.host });
  const requestedPort = options.port ?? DEFAULT_MAKE_SERVER_PORT;
  const adminRoot = options.adminRoot || resolveDefaultAdminRoot();
  const opencodeWebUiRoot = resolveOpenCodeWebUiRoot(adminRoot, options.opencodeWebUiRoot);
  const devMode = options.devMode === true;
  const lanHost = getLocalIP();
  let runtimeOrigin = resolveRuntimeOrigin(projectRoot, options.runtimeOrigin);
  let origin = '';
  let adminServerInfo: ReturnType<typeof writeServerInfo> | null = null;

  // Vite middleware is only created in dev mode – the import is dynamic so
  // production never loads vite or its dependencies.
  let viteMiddleware: ViteDevMiddleware | null = null;

  // The make-server project root (where vite.config.ts lives).
  const makeServerRoot = path.resolve(serverDir, '../..');

  // HTML path for the main admin UI entry.
  const adminIndexHtml = path.resolve(makeServerRoot, 'src/index/index.html');

  const server = http.createServer((req, res) => {
    (async () => {
      const requestUrl = req.url || '/';
      const pathname = requestUrl.split('?')[0] || '/';

      // ── 1. Management API ──
      if (await handleManagementApi(req, res, {
        projectRoot,
        adminRoot,
        origin,
        runtimeOrigin,
        registryPath: options.registryPath,
        serverInfo: adminServerInfo || undefined,
        devMode,
        cloudPublishingCommandExecutor: options.cloudPublishingCommandExecutor,
      })) {
        return;
      }

      // ── 2. Dev mode: Vite middleware for frontend HMR ──
      if (devMode && viteMiddleware) {
        if (isRuntimeHtmlProxyRequest(requestUrl)) {
          runtimeOrigin = resolveRuntimeOrigin(projectRoot, runtimeOrigin);
          if (!runtimeOrigin) {
            sendJson(res, { error: 'Runtime unavailable', runtime: { available: false } }, { status: 503 });
            return;
          }
          proxyToRuntime(req, res, runtimeOrigin);
          return;
        }

        // OpenCode and canvas routes are special server-side pages that
        // need their own handling even in dev mode.
        const isServerSideRoute = pathname.startsWith('/opencode')
          || pathname.startsWith('/canvas/');

        if (isServerSideRoute) {
          const adminStaticOptions: AdminStaticOptions = {
            adminRoot,
            opencodeWebUiRoot,
            projectRoot,
            host,
            lanHost,
            port: Number(new URL(origin).port),
            opencodeServerOrigin: resolveOpenCodeServerOrigin(pathname),
            runtimeOrigin,
          };
          if (handleAdminStatic(req, res, adminStaticOptions)) {
            return;
          }
        }

        // Serve the main admin index HTML with Vite transforms + server vars.
        if (pathname === '/' || pathname === '/index.html') {
          const injectScript = buildInjectScript({
            adminRoot,
            projectRoot,
            host,
            lanHost,
            port: Number(new URL(origin).port),
            runtimeOrigin,
          });
          const html = await viteMiddleware.transformHtml(
            '/src/index/index.html',
            adminIndexHtml,
            injectScript,
          );
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(html);
          return;
        }

        // Everything else (JS modules, CSS, assets, /@vite/client, etc.)
        // is handled by Vite's connect middleware stack.
        viteMiddleware.handle(req, res, () => {
          // If Vite didn't handle it, try serving from dist/admin (pre-built
          // template assets like dev-template-bootstrap.js, spec-template, etc.)
          const adminStaticFallback: AdminStaticOptions = {
            adminRoot,
            opencodeWebUiRoot,
            projectRoot,
            host,
            lanHost,
            port: Number(new URL(origin).port),
            opencodeServerOrigin: resolveOpenCodeServerOrigin(pathname),
            runtimeOrigin,
          };
          if (handleAdminStatic(req, res, adminStaticFallback)) {
            return;
          }

          // Then try runtime proxy.
          if (isRuntimeOnlyRoute(pathname)) {
            runtimeOrigin = resolveRuntimeOrigin(projectRoot, runtimeOrigin);
            if (!runtimeOrigin) {
              sendJson(res, { error: 'Runtime unavailable', runtime: { available: false } }, { status: 503 });
              return;
            }
            proxyToRuntime(req, res, runtimeOrigin);
            return;
          }
          sendJson(res, { error: 'Not found' }, { status: 404 });
        });
        return;
      }

      // ── 3. Production: static admin files ──
      if (handleAdminStatic(req, res, {
        adminRoot,
        opencodeWebUiRoot,
        projectRoot,
        host,
        lanHost,
        port: Number(new URL(origin).port),
        opencodeServerOrigin: resolveOpenCodeServerOrigin(pathname),
        runtimeOrigin,
      })) {
        return;
      }

      // ── 4. Runtime proxy ──
      if (isRuntimeOnlyRoute(pathname)) {
        runtimeOrigin = resolveRuntimeOrigin(projectRoot, runtimeOrigin);
        if (!runtimeOrigin) {
          sendJson(res, { error: 'Runtime unavailable', runtime: { available: false } }, { status: 503 });
          return;
        }
        proxyToRuntime(req, res, runtimeOrigin);
        return;
      }

      sendJson(res, { error: 'Not found' }, { status: 404 });
    })().catch((error: any) => {
      if (!res.headersSent) {
        sendJson(res, { error: error?.message || 'Internal server error' }, { status: 500 });
      }
    });
  });

  // Attach WebSocket upgrade handlers for OpenCode context bridge and Canvas bridge.
  // In dev mode, non-bridge upgrades are left open for Vite HMR.
  const bridgeHub = getOpenCodeBridgeHub();
  const canvasBridgeHub = getCanvasBridgeHub();
  canvasBridgeHub.configureProjectRoot(projectRoot);
  server.on('upgrade', (req, socket, head) => {
    if (isOpenCodeBridgeUpgrade(req)) {
      bridgeHub.handleUpgrade(req, socket, head);
    } else if (isCanvasBridgeUpgrade(req)) {
      canvasBridgeHub.handleUpgrade(req, socket, head);
    } else if (!devMode) {
      socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
    }
    // In dev mode, unhandled upgrades fall through to Vite's HMR WebSocket.
  });

  if (devMode && requestedPort !== 0) {
    releaseListeningProcessesOnPort(requestedPort);
  }

  const actualPort = await listen(server, requestedPort, host);
  origin = `http://${resolvePublicOriginHost(host)}:${actualPort}`;
  adminServerInfo = writeServerInfo(projectRoot, 'admin', {
    pid: process.pid,
    port: actualPort,
    host,
    origin,
    projectRoot,
    startedAt: new Date().toISOString(),
  });

  // Initialize Vite dev middleware after the HTTP server is listening,
  // so Vite can attach its HMR WebSocket to the same server.
  if (devMode) {
    const { createViteDevMiddleware } = await import('./viteDevServer.ts');
    viteMiddleware = await createViteDevMiddleware(server, makeServerRoot);
    console.log('Vite HMR middleware attached (frontend hot reload enabled)');
  }

  if (lanHost !== 'localhost') {
    console.log(`Axhub Make network URL: http://${lanHost}:${actualPort}`);
  }

  return {
    port: actualPort,
    host,
    origin,
    close: async () => {
      closeManagedOpenCodeServers();
      if (viteMiddleware) {
        await viteMiddleware.close();
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
        server.closeIdleConnections?.();
        server.closeAllConnections?.();
      });
    },
  };
}
