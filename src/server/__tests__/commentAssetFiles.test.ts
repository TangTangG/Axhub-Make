import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  readCommentAsset,
  removeCommentAsset,
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
