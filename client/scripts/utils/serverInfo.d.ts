export type AxhubServerRole = 'runtime' | 'admin';

export interface AxhubServerInfo {
  pid: number;
  port: number;
  host: string;
  origin: string;
  projectRoot: string;
  startedAt: string;
}

export interface ServerInfoPathOptions {
  homeDir?: string;
}

export function readServerInfo(projectRoot: string, role: AxhubServerRole, options?: ServerInfoPathOptions): AxhubServerInfo | null;
export function getAdminServerInfoPath(projectRoot?: string, options?: ServerInfoPathOptions): string;
export function getRuntimeServerInfoPath(projectRoot: string): string;
export function writeServerInfo(
  projectRoot: string,
  role: AxhubServerRole,
  info: AxhubServerInfo,
  options?: ServerInfoPathOptions,
): AxhubServerInfo;
export function fetchHealth(origin: string, timeoutMs?: number): Promise<unknown | null>;
export function normalizeHealthServerInfo(data: unknown): AxhubServerInfo | null;
