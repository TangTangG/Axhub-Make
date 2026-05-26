import fs from 'node:fs';
import path from 'node:path';

const MAKE_STATE_DIR = path.join('.axhub', 'make');
const RUNTIME_SERVER_INFO_RELATIVE_PATH = path.join(MAKE_STATE_DIR, '.dev-server-info.json');
const ADMIN_SERVER_INFO_RELATIVE_PATH = path.join(MAKE_STATE_DIR, '.admin-server-info.json');

function resolveProjectRoot(projectRoot) {
  return path.resolve(projectRoot);
}

function getServerInfoPath(projectRoot, role) {
  return path.join(
    resolveProjectRoot(projectRoot),
    role === 'runtime' ? RUNTIME_SERVER_INFO_RELATIVE_PATH : ADMIN_SERVER_INFO_RELATIVE_PATH,
  );
}

export function getAdminServerInfoPath(projectRoot) {
  return getServerInfoPath(projectRoot, 'admin');
}

export function getRuntimeServerInfoPath(projectRoot) {
  return getServerInfoPath(projectRoot, 'runtime');
}

function normalizeServerInfo(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }
  if (
    typeof data.pid !== 'number'
    || typeof data.port !== 'number'
    || typeof data.host !== 'string'
    || typeof data.origin !== 'string'
    || typeof data.projectRoot !== 'string'
    || typeof data.startedAt !== 'string'
  ) {
    return null;
  }
  return {
    pid: data.pid,
    port: data.port,
    host: data.host,
    origin: data.origin,
    projectRoot: resolveProjectRoot(data.projectRoot),
    startedAt: data.startedAt,
  };
}

export function readServerInfo(projectRoot, role) {
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

export function writeServerInfo(projectRoot, role, info) {
  const normalized = {
    ...info,
    projectRoot: resolveProjectRoot(info.projectRoot),
  };
  const infoPath = getServerInfoPath(projectRoot, role);
  fs.mkdirSync(path.dirname(infoPath), { recursive: true });
  fs.writeFileSync(infoPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

export async function fetchHealth(origin, timeoutMs = 1000) {
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

export function normalizeHealthServerInfo(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }
  return normalizeServerInfo(data.server ?? data);
}
