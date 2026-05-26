export type AxhubServerRole = 'runtime' | 'admin';

export interface AxhubServerInfo {
  pid: number;
  port: number;
  host: string;
  origin: string;
  projectRoot: string;
  startedAt: string;
}

export function readServerInfo(projectRoot: string, role: AxhubServerRole): AxhubServerInfo | null;
export function getAdminServerInfoPath(projectRoot: string): string;
export function getRuntimeServerInfoPath(projectRoot: string): string;
export function writeServerInfo(
  projectRoot: string,
  role: AxhubServerRole,
  info: AxhubServerInfo,
): AxhubServerInfo;
export function fetchHealth(origin: string, timeoutMs?: number): Promise<unknown | null>;
export function normalizeHealthServerInfo(data: unknown): AxhubServerInfo | null;
