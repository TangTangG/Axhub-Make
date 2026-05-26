import fs from 'node:fs';
import path from 'node:path';

import {
  getAdminServerInfoPath,
  getRuntimeServerInfoPath,
  resolveProjectRoot,
} from './paths.ts';

export type AxhubServerRole = 'runtime' | 'admin';

export interface AxhubServerInfo {
  pid: number;
  port: number;
  host: string;
  origin: string;
  projectRoot: string;
  startedAt: string;
}

function getServerInfoPath(projectRoot: string, role: AxhubServerRole): string {
  return role === 'runtime'
    ? getRuntimeServerInfoPath(projectRoot)
    : getAdminServerInfoPath(projectRoot);
}

function normalizeServerInfo(data: unknown): AxhubServerInfo | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const value = data as Partial<AxhubServerInfo>;
  if (
    typeof value.pid !== 'number' ||
    typeof value.port !== 'number' ||
    typeof value.host !== 'string' ||
    typeof value.origin !== 'string' ||
    typeof value.projectRoot !== 'string' ||
    typeof value.startedAt !== 'string'
  ) {
    return null;
  }

  return {
    pid: value.pid,
    port: value.port,
    host: value.host,
    origin: value.origin,
    projectRoot: resolveProjectRoot(value.projectRoot),
    startedAt: value.startedAt,
  };
}

export function getServerInfoFilePath(projectRoot: string, role: AxhubServerRole): string {
  return getServerInfoPath(projectRoot, role);
}

export { getAdminServerInfoPath, getRuntimeServerInfoPath } from './paths.ts';

export function readServerInfo(projectRoot: string, role: AxhubServerRole): AxhubServerInfo | null {
  const infoPath = getServerInfoPath(projectRoot, role);
  if (!fs.existsSync(infoPath)) {
    return null;
  }

  try {
    return normalizeServerInfo(JSON.parse(fs.readFileSync(infoPath, 'utf8')));
  } catch {
    return null;
  }
}

export function writeServerInfo(
  projectRoot: string,
  role: AxhubServerRole,
  info: AxhubServerInfo,
): AxhubServerInfo {
  const normalized: AxhubServerInfo = {
    ...info,
    projectRoot: resolveProjectRoot(info.projectRoot),
  };
  const infoPath = getServerInfoPath(projectRoot, role);
  fs.mkdirSync(path.dirname(infoPath), { recursive: true });
  fs.writeFileSync(infoPath, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

export function isHealthyServerInfo(info: AxhubServerInfo | null, expectedProjectRoot: string): boolean {
  if (!info) {
    return false;
  }
  return resolveProjectRoot(info.projectRoot) === resolveProjectRoot(expectedProjectRoot);
}

export async function fetchHealth(origin: string, timeoutMs = 1000): Promise<unknown | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL('/api/health', origin), {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeHealthServerInfo(data: unknown): AxhubServerInfo | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const value = data as { server?: unknown };
  return normalizeServerInfo(value.server ?? data);
}
