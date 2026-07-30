import { spawnSync } from 'node:child_process';

export interface PortProcessLookup {
  platform?: NodeJS.Platform;
  spawnSync?: typeof spawnSync;
}

export interface ReleasePortOptions extends PortProcessLookup {
  killPid?: (pid: number, signal?: NodeJS.Signals) => void;
  currentPid?: number;
  waitMs?: number;
}

function parsePidList(output: string): number[] {
  const seen = new Set<number>();
  for (const line of output.split(/\r?\n/u)) {
    const pid = Number(line.trim());
    if (Number.isInteger(pid) && pid > 0) {
      seen.add(pid);
    }
  }
  return Array.from(seen);
}

export function findListeningPidsOnPort(port: number, options: PortProcessLookup = {}): number[] {
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return [];
  }

  const platform = options.platform || process.platform;
  const run = options.spawnSync || spawnSync;

  if (platform === 'win32') {
    const result = run('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
    ], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 2000,
    });
    return parsePidList(String(result.stdout || ''));
  }

  const result = run('lsof', [
    '-tiTCP',
    `:${port}`,
    '-sTCP:LISTEN',
  ], {
    encoding: 'utf8',
    timeout: 2000,
  });
  return parsePidList(String(result.stdout || ''));
}

function waitForPortRelease(port: number, options: ReleasePortOptions): void {
  const deadline = Date.now() + Math.max(0, options.waitMs ?? 1500);
  while (Date.now() < deadline) {
    if (findListeningPidsOnPort(port, options).length === 0) {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
}

export function releaseListeningProcessesOnPort(port: number, options: ReleasePortOptions = {}): number[] {
  const currentPid = options.currentPid ?? process.pid;
  const pids = findListeningPidsOnPort(port, options).filter((pid) => pid !== currentPid);
  if (pids.length === 0) {
    return [];
  }

  if ((options.platform || process.platform) === 'win32') {
    const run = options.spawnSync || spawnSync;
    for (const pid of pids) {
      run('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 5000,
      });
    }
  } else {
    const killPid = options.killPid || process.kill.bind(process);
    for (const pid of pids) {
      try {
        killPid(pid, 'SIGTERM');
      } catch {
        // Process may have exited between lookup and signal.
      }
    }
    waitForPortRelease(port, options);
    for (const pid of findListeningPidsOnPort(port, options).filter((pid) => pid !== currentPid)) {
      try {
        killPid(pid, 'SIGKILL');
      } catch {
        // Process may have exited after the second lookup.
      }
    }
  }

  return pids;
}
