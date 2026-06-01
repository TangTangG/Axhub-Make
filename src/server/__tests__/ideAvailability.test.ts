import { describe, expect, it, vi } from 'vitest';

import { createIDEAvailabilityDetector, getMissingIDEOpenError } from '../ideAvailability.ts';

describe('IDE availability detector', () => {
  const checkedAt = '2026-05-18T00:00:00.000Z';

  it('detects macOS IDEs from app bundle paths before using Spotlight', () => {
    const spawnSync = vi.fn();
    const detector = createIDEAvailabilityDetector({
      platform: 'darwin',
      homeDir: '/Users/demo',
      checkedAt: () => checkedAt,
      existsSync: (candidate) => String(candidate) === '/Applications/Cursor.app',
      spawnSync,
    });

    expect(detector.detectIDEAvailability('cursor')).toEqual({
      status: 'installed',
      confidence: 'high',
      checkedAt,
      source: 'mac-app-path',
      path: '/Applications/Cursor.app',
    });
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it('uses Spotlight output on macOS and reports missing when no candidate matches', () => {
    const spawnSync = vi.fn((command: string, args?: readonly string[]) => {
      if (command === 'mdfind' && String(args?.[0] || '').includes('Visual Studio Code')) {
        return { status: 0, stdout: '/Applications/Visual Studio Code.app\n' };
      }
      return { status: 0, stdout: '' };
    });
    const detector = createIDEAvailabilityDetector({
      platform: 'darwin',
      homeDir: '/Users/demo',
      checkedAt: () => checkedAt,
      existsSync: () => false,
      spawnSync,
    });

    expect(detector.detectIDEAvailability('vscode')).toMatchObject({
      status: 'installed',
      source: 'mac-mdfind',
      path: '/Applications/Visual Studio Code.app',
    });
    expect(detector.detectIDEAvailability('cursor')).toMatchObject({
      status: 'missing',
      source: 'mac-app-path+mdfind',
    });
  });

  it('returns unknown when macOS probing throws', () => {
    const detector = createIDEAvailabilityDetector({
      platform: 'darwin',
      checkedAt: () => checkedAt,
      existsSync: () => false,
      spawnSync: () => ({ error: new Error('mdfind denied') }),
    });

    expect(detector.detectIDEAvailability('cursor')).toMatchObject({
      status: 'unknown',
      confidence: 'low',
      source: 'mac-probe-error',
      reason: 'mdfind denied',
    });
  });

  it('detects Windows command wrappers, inferred executable paths, registry paths, and missing IDEs', () => {
    const existingPaths = new Set(['C:\\Tools\\cursor.exe']);
    const spawnSync = vi.fn((command: string, args?: readonly string[]) => {
      if (command === 'where' && args?.[0] === 'cursor') {
        return { status: 0, stdout: 'C:\\Tools\\cursor.cmd\r\n' };
      }
      if (command === 'where' && String(args?.[0] || '').toLowerCase() === 'trae') {
        return { status: 0, stdout: 'C:\\Tools\\trae.exe\r\n' };
      }
      if (command === 'reg' && String(args?.[1] || '').includes('Code.exe')) {
        return { status: 0, stdout: '    (Default)    REG_SZ    C:\\Program Files\\Code\\Code.exe\r\n' };
      }
      return { status: 1, stdout: '' };
    });
    const detector = createIDEAvailabilityDetector({
      platform: 'win32',
      checkedAt: () => checkedAt,
      existsSync: (candidate) => existingPaths.has(String(candidate)),
      spawnSync,
    });

    expect(detector.detectIDEAvailability('cursor')).toMatchObject({
      status: 'installed',
      source: 'windows-executable',
      path: 'C:\\Tools\\cursor.exe',
    });
    expect(detector.detectIDEAvailability('trae')).toMatchObject({
      status: 'installed',
      path: 'C:\\Tools\\trae.exe',
    });
    expect(detector.detectIDEAvailability('vscode')).toMatchObject({
      status: 'installed',
      path: 'C:\\Program Files\\Code\\Code.exe',
    });
    expect(detector.detectIDEAvailability('kiro')).toMatchObject({
      status: 'missing',
      source: 'windows-where+registry+protocol',
    });
  });

  it('detects Windows VS Code style URL protocol registrations as installed IDEs', () => {
    const spawnSync = vi.fn((command: string, args?: readonly string[]) => {
      const key = String(args?.[1] || '');
      if (command === 'reg' && key.includes('Software\\Classes\\trae-cn\\shell\\open\\command')) {
        return { status: 0, stdout: '    (Default)    REG_SZ    "C:\\Users\\demo\\AppData\\Local\\Programs\\Trae CN\\Trae CN.exe" "%1"\r\n' };
      }
      return { status: 1, stdout: '' };
    });
    const detector = createIDEAvailabilityDetector({
      platform: 'win32',
      checkedAt: () => checkedAt,
      existsSync: () => false,
      spawnSync,
    });

    expect(detector.detectIDEAvailability('trae_cn')).toMatchObject({
      status: 'installed',
      source: 'windows-url-protocol',
      path: 'trae-cn://',
    });
  });

  it('returns unknown when Windows probing throws', () => {
    const detector = createIDEAvailabilityDetector({
      platform: 'win32',
      checkedAt: () => checkedAt,
      spawnSync: () => ({ error: new Error('where blocked') }),
    });

    expect(detector.detectIDEAvailability('cursor')).toMatchObject({
      status: 'unknown',
      confidence: 'low',
      source: 'windows-probe-error',
      reason: 'where blocked',
    });
  });

  it('marks unsupported platforms as unknown and can scan all IDEs', () => {
    const detector = createIDEAvailabilityDetector({
      platform: 'linux',
      checkedAt: () => checkedAt,
    });
    const all = detector.detectAllIDEAvailability();

    expect(detector.detectIDEAvailability('cursor')).toMatchObject({
      status: 'unknown',
      source: 'unsupported-platform',
      reason: 'Unsupported platform: linux',
    });
    expect(Object.keys(all)).toEqual([
      'cursor',
      'trae',
      'vscode',
      'trae_cn',
      'windsurf',
      'kiro',
      'qoder',
      'antigravity',
    ]);
  });

  it('builds missing IDE open errors only for confirmed missing entries', () => {
    const missing = {
      cursor: {
        status: 'missing' as const,
        confidence: 'high' as const,
        checkedAt,
      },
    };

    expect(getMissingIDEOpenError('cursor', missing)).toMatchObject({
      statusCode: 404,
      body: {
        code: 'MAIN_IDE_MISSING',
        ide: 'cursor',
        availability: missing.cursor,
      },
    });
    expect(getMissingIDEOpenError('vscode', missing)).toBeNull();
  });
});
