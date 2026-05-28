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

export function writeDevServerInfoPlugin(): Plugin {
  return {
    name: 'write-dev-server-info',
    configureServer(server: any) {
      const startedAt = new Date().toISOString();
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
