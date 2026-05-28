import { describe, expect, it, vi } from 'vitest';

import {
  findListeningPidsOnPort,
  releaseListeningProcessesOnPort,
} from '../portOccupancy.ts';

describe('make-server port occupancy helpers', () => {
  it('reads listening PIDs with lsof on macOS and Linux', () => {
    const spawnSync = vi.fn(() => ({
      stdout: '123\n456\n123\n',
      stderr: '',
      status: 0,
    })) as any;

    expect(findListeningPidsOnPort(53817, {
      platform: 'darwin',
      spawnSync,
    })).toEqual([123, 456]);
    expect(spawnSync).toHaveBeenCalledWith('lsof', [
      '-tiTCP',
      ':53817',
      '-sTCP:LISTEN',
    ], expect.objectContaining({ encoding: 'utf8' }));
  });

  it('reads listening PIDs with PowerShell on Windows', () => {
    const spawnSync = vi.fn(() => ({
      stdout: '321\r\n654\r\n',
      stderr: '',
      status: 0,
    })) as any;

    expect(findListeningPidsOnPort(51720, {
      platform: 'win32',
      spawnSync,
    })).toEqual([321, 654]);
    expect(spawnSync).toHaveBeenCalledWith('powershell.exe', expect.arrayContaining([
      '-NoProfile',
      '-Command',
      expect.stringContaining('Get-NetTCPConnection -LocalPort 51720'),
    ]), expect.objectContaining({ windowsHide: true }));
  });

  it('terminates other listening processes while ignoring the current process', () => {
    const spawnSync = vi.fn(() => ({
      stdout: '111\n222\n',
      stderr: '',
      status: 0,
    })) as any;
    const killPid = vi.fn();

    expect(releaseListeningProcessesOnPort(53817, {
      platform: 'linux',
      spawnSync,
      killPid,
      currentPid: 111,
      waitMs: 0,
    })).toEqual([222]);
    expect(killPid).toHaveBeenCalledWith(222, 'SIGTERM');
  });

  it('does not try to release ephemeral or invalid ports', () => {
    const spawnSync = vi.fn();

    expect(findListeningPidsOnPort(0, { spawnSync })).toEqual([]);
    expect(releaseListeningProcessesOnPort(0, { spawnSync })).toEqual([]);
    expect(spawnSync).not.toHaveBeenCalled();
  });
});
