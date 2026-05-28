import { describe, expect, it, vi } from 'vitest';

import {
  findListeningPidsOnPort,
  releaseListeningProcessesOnPort,
} from './utils/portOccupancy';

describe('client port occupancy helpers', () => {
  it('reads listening PIDs with lsof on macOS and Linux', () => {
    const spawnSync = vi.fn(() => ({
      stdout: '123\n456\n123\n',
      stderr: '',
      status: 0,
    })) as any;

    expect(findListeningPidsOnPort(51720, {
      platform: 'darwin',
      spawnSync,
    })).toEqual([123, 456]);
    expect(spawnSync).toHaveBeenCalledWith('lsof', [
      '-tiTCP',
      ':51720',
      '-sTCP:LISTEN',
    ], expect.objectContaining({ encoding: 'utf8' }));
  });

  it('terminates other listening processes while ignoring the current process', () => {
    const spawnSync = vi.fn(() => ({
      stdout: '111\n222\n',
      stderr: '',
      status: 0,
    })) as any;
    const killPid = vi.fn();

    expect(releaseListeningProcessesOnPort(51720, {
      platform: 'linux',
      spawnSync,
      killPid,
      currentPid: 111,
      waitMs: 0,
    })).toEqual([222]);
    expect(killPid).toHaveBeenCalledWith(222, 'SIGTERM');
  });
});
