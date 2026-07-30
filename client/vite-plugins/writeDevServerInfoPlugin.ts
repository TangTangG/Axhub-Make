import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

import { writeServerInfo } from '../scripts/utils/serverInfo.mjs';
import { getLocalIP } from './utils/httpUtils';
import {
  MAKE_CONFIG_RELATIVE_PATH,
} from './utils/makeConstants';
import { syncMakeProjectMetadata } from '../scripts/sync-project-metadata.mjs';

type DevServerInfo = {
  pid: number;
  port: number;
  host: string;
  origin: string;
  projectRoot: string;
  startedAt: string;
  localIP: string;
  timestamp: string;
};

const SERVER_INFO_HEARTBEAT_INTERVAL_MS = 5_000;
const VITE_CLIENT_MARKERS = [
  'const importMetaUrl = new URL(import.meta.url);',
  'const directSocketHost = ',
  '"vite-hmr"',
];

function resolveDevServerInfo(server: any, startedAt: string): DevServerInfo {
  const localIP = getLocalIP();
  const actualPort = server.httpServer?.address()?.port || server.config.server?.port || 5173;

  const configPath = path.resolve(process.cwd(), MAKE_CONFIG_RELATIVE_PATH);
  let displayHost = 'localhost';
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      displayHost = config.server?.host || 'localhost';
    } catch {
      // Ignore config parse errors and keep default.
    }
  }

  const timestamp = new Date().toISOString();
  return {
    pid: process.pid,
    port: actualPort,
    host: displayHost,
    origin: `http://${displayHost}:${actualPort}`,
    projectRoot: path.resolve(process.cwd()),
    startedAt,
    localIP,
    timestamp,
  };
}

function sendHealth(res: any, payload: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function writeCurrentDevServerInfo(server: any, startedAt: string): DevServerInfo {
  const devServerInfo = resolveDevServerInfo(server, startedAt);
  writeServerInfo(process.cwd(), 'runtime', devServerInfo);
  return devServerInfo;
}

function getActualListeningPort(server: any): number | null {
  const address = server?.httpServer?.address?.();
  return address && typeof address === 'object' && typeof address.port === 'number'
    ? address.port
    : null;
}

function replaceInjectedHostPort(code: string, constName: string, port: number): string {
  return code.replace(
    new RegExp(`(const ${constName} = ")([^"]+)(";)$`, 'mu'),
    (_match, prefix: string, value: string, suffix: string) => {
      const nextValue = value.replace(/:\d+(\/[^"]*)?$/u, (_portMatch, tail = '') => `:${port}${tail}`);
      return `${prefix}${nextValue}${suffix}`;
    },
  );
}

function hasExplicitHmrPort(server: any): boolean {
  const hmr = server?.config?.server?.hmr;
  return Boolean(hmr && typeof hmr === 'object' && Number.isInteger(Number(hmr.port)));
}

function alignInjectedViteClientHmrPort(code: string, server: any): string {
  const actualPort = getActualListeningPort(server);
  if (!actualPort) {
    return code;
  }

  const withServerHost = replaceInjectedHostPort(code, 'serverHost', actualPort);
  return hasExplicitHmrPort(server)
    ? withServerHost
    : replaceInjectedHostPort(withServerHost, 'directSocketHost', actualPort);
}

function isViteClientRequest(requestUrl: string): boolean {
  try {
    return new URL(requestUrl || '/', 'http://localhost').pathname === '/@vite/client';
  } catch {
    return (requestUrl || '').split('?')[0] === '/@vite/client';
  }
}

function applyServerHeaders(res: any, headers: Record<string, string> | undefined): void {
  if (!headers) {
    return;
  }
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

async function sendAlignedViteClient(req: any, res: any, next: (error?: unknown) => void, server: any): Promise<void> {
  if (req.method !== 'GET' || !isViteClientRequest(req.url || '/')) {
    next();
    return;
  }

  try {
    const result = await server.transformRequest('/@vite/client');
    if (!result) {
      next();
      return;
    }

    const code = VITE_CLIENT_MARKERS.every((marker) => result.code.includes(marker))
      ? alignInjectedViteClientHmrPort(result.code, server)
      : result.code;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    if (result.etag) {
      res.setHeader('Etag', result.etag);
    }
    applyServerHeaders(res, server.config.server?.headers);
    res.end(code);
  } catch (error) {
    next(error);
  }
}

export function writeDevServerInfoPlugin(): Plugin {
  return {
    name: 'write-dev-server-info',
    configureServer(server: any) {
      const startedAt = new Date().toISOString();
      server.middlewares.use((req: any, res: any, next: (error?: unknown) => void) => {
        void sendAlignedViteClient(req, res, next, server);
      });

      server.middlewares.use('/api/health', (req: any, res: any, next: () => void) => {
        if (req.method !== 'GET') {
          next();
          return;
        }
        const devServerInfo = resolveDevServerInfo(server, startedAt);
        sendHealth(res, {
          ok: true,
          role: 'runtime',
          projectRoot: devServerInfo.projectRoot,
          server: devServerInfo,
        });
      });

      server.httpServer?.once('listening', () => {
        try {
          const devServerInfo = writeCurrentDevServerInfo(server, startedAt);

          syncMakeProjectMetadata(process.cwd());
          const heartbeat = setInterval(() => {
            try {
              writeCurrentDevServerInfo(server, startedAt);
            } catch (error) {
              console.error('Failed to refresh dev server info:', error);
            }
          }, SERVER_INFO_HEARTBEAT_INTERVAL_MS);
          heartbeat.unref?.();
          server.httpServer?.once('close', () => {
            clearInterval(heartbeat);
          });

          console.log(`\n✅ Dev server info written to .axhub/make/.dev-server-info.json`);
          console.log(`✅ Axhub Make Project metadata synced`);
          console.log(`   Local:   ${devServerInfo.origin}`);
          console.log(`   Network: http://${devServerInfo.localIP}:${devServerInfo.port}\n`);
        } catch (error) {
          console.error('Failed to write dev server info:', error);
        }
      });
    },
  };
}
