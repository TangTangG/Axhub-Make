import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  readCommentAsset,
  removeCommentAsset,
  removeCommentAssets,
  writeCommentAsset,
} from '../commentAssetFiles';

const temporaryRoots: string[] = [];

function createTemporaryRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

function createAssetFixture(fileName = 'asset.png'): {
  projectRoot: string;
  assetDir: string;
  assetFile: string;
  parkedAssetDir: string;
  outsideDir: string;
  outsideFile: string;
} {
  const projectRoot = createTemporaryRoot('axhub-comment-asset-project-');
  const outsideDir = createTemporaryRoot('axhub-comment-asset-outside-');
  const assetDir = path.join(projectRoot, '.axhub/make/comment-assets/hash');
  const assetFile = path.join(assetDir, fileName);
  const parkedAssetDir = path.join(projectRoot, '.axhub/make/comment-assets/hash-parked');
  const outsideFile = path.join(outsideDir, fileName);
  fs.mkdirSync(assetDir, { recursive: true });
  fs.writeFileSync(assetFile, 'inside', 'utf8');
  fs.writeFileSync(outsideFile, 'outside', 'utf8');
  return {
    projectRoot,
    assetDir,
    assetFile,
    parkedAssetDir,
    outsideDir,
    outsideFile,
  };
}

function replaceAssetDirectoryWithOutsideSymlink(fixture: ReturnType<typeof createAssetFixture>): void {
  fs.renameSync(fixture.assetDir, fixture.parkedAssetDir);
  fs.symlinkSync(fixture.outsideDir, fixture.assetDir, 'dir');
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('comment asset filesystem boundary', () => {
  it('preserves safe nested asset paths', () => {
    const projectRoot = createTemporaryRoot('axhub-comment-asset-project-');
    const assetDir = path.join(projectRoot, '.axhub/make/comment-assets/hash');
    const nestedDir = path.join(assetDir, 'legacy');
    const nestedFile = path.join(nestedDir, 'nested.png');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(nestedFile, 'inside', 'utf8');

    expect(readCommentAsset(projectRoot, assetDir, 'legacy/nested.png')?.data.toString('utf8'))
      .toBe('inside');
    expect(() => writeCommentAsset(
      projectRoot,
      assetDir,
      'legacy/nested.png',
      Buffer.from('replacement'),
    )).not.toThrow();
    expect(fs.readFileSync(nestedFile, 'utf8')).toBe('replacement');
    expect(removeCommentAsset(projectRoot, assetDir, 'legacy/nested.png')).toBe(true);
    expect(fs.existsSync(nestedFile)).toBe(false);
  });

  it('continues batch removals after an invalid nested path', () => {
    const fixture = createAssetFixture();
    fs.mkdirSync(path.join(fixture.assetDir, 'legacy'), { recursive: true });

    expect(removeCommentAssets(
      fixture.projectRoot,
      fixture.assetDir,
      ['legacy/missing/nested.png', 'asset.png'],
    )).toEqual([false, true]);
    expect(fs.existsSync(fixture.assetFile)).toBe(false);
  });

  it('keeps worker path validation and execution timeout as independent safeguards', () => {
    const fixture = createAssetFixture();
    const originalSpawnSync = childProcess.spawnSync.bind(childProcess);
    let workerSource = '';
    let workerTimeout = 0;
    vi.spyOn(childProcess, 'spawnSync').mockImplementation(((...args: Parameters<typeof childProcess.spawnSync>) => {
      const workerArgs = args[1];
      const workerOptions = args[2];
      if (Array.isArray(workerArgs) && workerArgs[0] === '--eval') {
        workerSource = String(workerArgs[1] || '');
        workerTimeout = Number(workerOptions?.timeout || 0);
      }
      return originalSpawnSync(...args);
    }) as typeof childProcess.spawnSync);

    expect(removeCommentAsset(fixture.projectRoot, fixture.assetDir, 'asset.png')).toBe(true);
    expect(workerTimeout).toBe(30_000);
    const invalidName = 'nested\\asset.png';
    const workerResult = originalSpawnSync(
      process.execPath,
      ['--eval', workerSource, 'mutate', fs.realpathSync.native(fixture.assetDir)],
      {
        cwd: fixture.assetDir,
        encoding: 'utf8',
        input: JSON.stringify({
          writes: [{ segments: [invalidName], data: Buffer.from('blocked').toString('base64') }],
        }),
      },
    );
    expect(workerResult.status).not.toBe(0);
    expect(workerResult.stderr).toContain('Invalid comment asset file name');
    expect(fs.existsSync(path.join(fixture.assetDir, invalidName))).toBe(false);
  });

  it('does not create asset directories outside the project during an ancestor swap', () => {
    const projectRoot = createTemporaryRoot('axhub-comment-asset-project-');
    const outsideDir = createTemporaryRoot('axhub-comment-asset-outside-');
    const makeDir = path.join(projectRoot, '.axhub/make');
    const parkedMakeDir = path.join(projectRoot, '.axhub/make-parked');
    const assetDir = path.join(makeDir, 'comment-assets/hash');
    fs.mkdirSync(makeDir, { recursive: true });

    let swapped = false;
    const swapAncestor = () => {
      if (swapped) return;
      swapped = true;
      fs.renameSync(makeDir, parkedMakeDir);
      fs.symlinkSync(outsideDir, makeDir, 'dir');
    };
    const originalMkdirSync = fs.mkdirSync.bind(fs);
    vi.spyOn(fs, 'mkdirSync').mockImplementation(((targetPath, options) => {
      if (path.resolve(String(targetPath)) === path.resolve(assetDir)) swapAncestor();
      return originalMkdirSync(targetPath, options);
    }) as typeof fs.mkdirSync);
    const originalSpawnSync = childProcess.spawnSync.bind(childProcess);
    vi.spyOn(childProcess, 'spawnSync').mockImplementation(((...args: Parameters<typeof childProcess.spawnSync>) => {
      swapAncestor();
      return originalSpawnSync(...args);
    }) as typeof childProcess.spawnSync);

    expect(() => writeCommentAsset(projectRoot, assetDir, 'asset.png', Buffer.from('inside')))
      .toThrow(/directory|asset/iu);
    expect(fs.existsSync(path.join(outsideDir, 'comment-assets'))).toBe(false);
  });

  it('opens assets in nonblocking mode before validating the file type', () => {
    const fixture = createAssetFixture();
    const originalOpenSync = fs.openSync.bind(fs);
    vi.spyOn(fs, 'openSync').mockImplementation(((filePath, flags, mode) => {
      if (
        path.basename(String(filePath)) === 'asset.png'
        && (Number(flags) & Number(fs.constants.O_NONBLOCK || 0)) === 0
      ) {
        throw new Error('asset open omitted O_NONBLOCK');
      }
      return originalOpenSync(filePath, flags, mode);
    }) as typeof fs.openSync);

    expect(readCommentAsset(fixture.projectRoot, fixture.assetDir, 'asset.png')?.data.toString('utf8'))
      .toBe('inside');
  });

  it('rejects same-directory symbolic links for reads, writes, and removals', () => {
    const fixture = createAssetFixture('target.png');
    const linkedAsset = path.join(fixture.assetDir, 'linked.png');
    try {
      fs.symlinkSync('target.png', linkedAsset, 'file');
    } catch {
      return;
    }

    expect(readCommentAsset(fixture.projectRoot, fixture.assetDir, 'linked.png')).toBeNull();
    expect(() => writeCommentAsset(
      fixture.projectRoot,
      fixture.assetDir,
      'linked.png',
      Buffer.from('replacement'),
    )).toThrow(/link|asset/iu);
    expect(removeCommentAsset(fixture.projectRoot, fixture.assetDir, 'linked.png')).toBe(false);
    expect(fs.readFileSync(fixture.assetFile, 'utf8')).toBe('inside');
  });

  it('rejects hard-linked assets for reads, writes, and removals', () => {
    const projectRoot = createTemporaryRoot('axhub-comment-asset-project-');
    const outsideDir = createTemporaryRoot('axhub-comment-asset-outside-');
    const assetDir = path.join(projectRoot, '.axhub/make/comment-assets/hash');
    const outsideFile = path.join(outsideDir, 'linked.png');
    const linkedAsset = path.join(assetDir, 'linked.png');
    fs.mkdirSync(assetDir, { recursive: true });
    fs.writeFileSync(outsideFile, 'outside', 'utf8');
    try {
      fs.linkSync(outsideFile, linkedAsset);
    } catch {
      return;
    }

    expect(() => writeCommentAsset(projectRoot, assetDir, 'linked.png', Buffer.from('replacement')))
      .toThrow(/link|asset/iu);
    expect(readCommentAsset(projectRoot, assetDir, 'linked.png')).toBeNull();
    expect(removeCommentAsset(projectRoot, assetDir, 'linked.png')).toBe(false);
    expect(fs.readFileSync(outsideFile, 'utf8')).toBe('outside');
    expect(fs.existsSync(linkedAsset)).toBe(true);
  });

  it('does not read outside data when the asset directory changes before open', () => {
    const fixture = createAssetFixture();
    const originalOpenSync = fs.openSync.bind(fs);
    let swapped = false;
    vi.spyOn(fs, 'openSync').mockImplementation(((filePath, flags, mode) => {
      if (!swapped && path.basename(String(filePath)) === 'asset.png') {
        swapped = true;
        replaceAssetDirectoryWithOutsideSymlink(fixture);
      }
      return originalOpenSync(filePath, flags, mode);
    }) as typeof fs.openSync);

    expect(readCommentAsset(fixture.projectRoot, fixture.assetDir, 'asset.png')).toBeNull();
    expect(fs.readFileSync(fixture.outsideFile, 'utf8')).toBe('outside');
  });

  it('does not overwrite outside data when the asset directory changes before mutation', () => {
    const fixture = createAssetFixture();
    const originalSpawnSync = childProcess.spawnSync.bind(childProcess);
    let swapped = false;
    vi.spyOn(childProcess, 'spawnSync').mockImplementation(((...args: Parameters<typeof childProcess.spawnSync>) => {
      if (!swapped) {
        swapped = true;
        replaceAssetDirectoryWithOutsideSymlink(fixture);
      }
      return originalSpawnSync(...args);
    }) as typeof childProcess.spawnSync);

    expect(() => writeCommentAsset(
      fixture.projectRoot,
      fixture.assetDir,
      'asset.png',
      Buffer.from('replacement'),
    )).toThrow(/directory|asset/iu);
    expect(fs.readFileSync(fixture.outsideFile, 'utf8')).toBe('outside');
  });

  it('does not remove outside data when the asset directory changes before mutation', () => {
    const fixture = createAssetFixture();
    const originalSpawnSync = childProcess.spawnSync.bind(childProcess);
    let swapped = false;
    vi.spyOn(childProcess, 'spawnSync').mockImplementation(((...args: Parameters<typeof childProcess.spawnSync>) => {
      if (!swapped) {
        swapped = true;
        replaceAssetDirectoryWithOutsideSymlink(fixture);
      }
      return originalSpawnSync(...args);
    }) as typeof childProcess.spawnSync);

    expect(removeCommentAsset(fixture.projectRoot, fixture.assetDir, 'asset.png')).toBe(false);
    expect(fs.readFileSync(fixture.outsideFile, 'utf8')).toBe('outside');
  });
});
