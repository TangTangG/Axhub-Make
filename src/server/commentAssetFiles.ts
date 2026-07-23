import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type ReadCommentAsset = {
  data: Buffer;
  filePath: string;
};

type SafeAssetDirectory = {
  absoluteAssetDir: string;
  realAssetDir: string;
};

const COMMENT_ASSET_MUTATION_SCRIPT = String.raw`
const fs = require('node:fs');
const path = require('node:path');

const [operation, expectedRealAssetDir, fileName] = process.argv.slice(1);
const noFollow = Number(fs.constants.O_NOFOLLOW || 0);

function fail(message, status = 1) {
  process.stderr.write(String(message || 'Comment asset mutation failed'));
  process.exit(status);
}

function isSamePath(left, right) {
  return path.relative(left, right) === '';
}

function isDirectFileName(value) {
  return Boolean(
    value
    && value !== '.'
    && value !== '..'
    && !value.includes('\0')
    && !value.includes('/')
    && !value.includes('\\\\')
    && !path.isAbsolute(value)
  );
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function validateOpenFile(descriptor, realAssetDir, targetPath) {
  const openedStats = fs.fstatSync(descriptor);
  if (!openedStats.isFile() || openedStats.nlink !== 1) {
    fail('Comment asset must be a regular file with one link');
  }
  const realTargetPath = fs.realpathSync.native(targetPath);
  if (!isSamePath(path.dirname(realTargetPath), realAssetDir)) {
    fail('Comment asset escaped the anchored directory');
  }
  const currentStats = fs.statSync(realTargetPath);
  if (!sameFileIdentity(openedStats, currentStats) || currentStats.nlink !== 1) {
    fail('Comment asset identity changed');
  }
}

if (!isDirectFileName(fileName)) fail('Invalid comment asset file name');

const realAssetDir = fs.realpathSync.native(process.cwd());
if (!isSamePath(realAssetDir, expectedRealAssetDir)) {
  fail('Comment asset directory identity changed');
}

if (operation === 'write') {
  let descriptor;
  try {
    descriptor = fs.openSync(
      fileName,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | noFollow,
      0o600,
    );
    validateOpenFile(descriptor, realAssetDir, fileName);
    const data = fs.readFileSync(0);
    fs.ftruncateSync(descriptor, 0);
    fs.writeFileSync(descriptor, data);
    fs.fsyncSync(descriptor);
  } catch (error) {
    fail(error && error.message ? error.message : error);
  } finally {
    if (typeof descriptor === 'number') fs.closeSync(descriptor);
  }
} else if (operation === 'remove') {
  if (!fs.existsSync(fileName)) process.exit(2);
  let descriptor;
  try {
    const entryStats = fs.lstatSync(fileName);
    if (entryStats.isSymbolicLink() || !entryStats.isFile() || entryStats.nlink !== 1) {
      fail('Comment asset must be a regular file with one link');
    }
    descriptor = fs.openSync(fileName, fs.constants.O_RDONLY | noFollow);
    validateOpenFile(descriptor, realAssetDir, fileName);
    const quarantineName = '.delete-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    fs.renameSync(fileName, quarantineName);
    const quarantinedStats = fs.lstatSync(quarantineName);
    const openedStats = fs.fstatSync(descriptor);
    if (!sameFileIdentity(openedStats, quarantinedStats) || quarantinedStats.nlink !== 1) {
      fail('Comment asset identity changed before removal');
    }
    fs.unlinkSync(quarantineName);
  } catch (error) {
    fail(error && error.message ? error.message : error);
  } finally {
    if (typeof descriptor === 'number') fs.closeSync(descriptor);
  }
} else {
  fail('Unsupported comment asset mutation');
}
`;

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (
    relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

function normalizeRelativeAssetName(value: string): string | null {
  const normalized = String(value || '').trim();
  if (
    !normalized
    || normalized === '.'
    || normalized === '..'
    || normalized.includes('\0')
    || normalized.includes('/')
    || normalized.includes('\\')
    || path.isAbsolute(normalized)
  ) {
    return null;
  }
  return normalized;
}

function assertSafeAssetDirectory(
  projectRoot: string,
  assetDir: string,
  create: boolean,
): SafeAssetDirectory {
  const absoluteProjectRoot = path.resolve(projectRoot);
  const absoluteAssetDir = path.resolve(assetDir);
  if (!isPathInside(absoluteProjectRoot, absoluteAssetDir)) {
    throw new Error('Invalid comment asset directory');
  }

  const relative = path.relative(absoluteProjectRoot, absoluteAssetDir);
  let current = absoluteProjectRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) break;
    const stats = fs.lstatSync(current);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error('Comment asset directory crosses a symbolic link boundary');
    }
  }

  if (create) fs.mkdirSync(absoluteAssetDir, { recursive: true });
  if (!fs.existsSync(absoluteAssetDir)) throw new Error('Comment asset directory does not exist');

  const assetStats = fs.lstatSync(absoluteAssetDir);
  if (assetStats.isSymbolicLink() || !assetStats.isDirectory()) {
    throw new Error('Invalid comment asset directory');
  }
  const realProjectRoot = fs.realpathSync.native(absoluteProjectRoot);
  const realAssetDir = fs.realpathSync.native(absoluteAssetDir);
  if (!isPathInside(realProjectRoot, realAssetDir)) {
    throw new Error('Comment asset directory escapes project root');
  }
  return { absoluteAssetDir, realAssetDir };
}

function noFollowFlag(): number {
  return Number((fs.constants as Record<string, number>).O_NOFOLLOW || 0);
}

function sameFileIdentity(left: fs.Stats, right: fs.Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function openVerifiedCommentAsset(
  directory: SafeAssetDirectory,
  fileName: string,
): { descriptor: number; filePath: string } | null {
  const filePath = path.join(directory.absoluteAssetDir, fileName);
  let descriptor: number;
  try {
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | noFollowFlag());
  } catch {
    return null;
  }

  let verified = false;
  try {
    const openedStats = fs.fstatSync(descriptor);
    if (!openedStats.isFile() || openedStats.nlink !== 1) return null;
    const realFilePath = fs.realpathSync.native(filePath);
    if (!isPathInside(directory.realAssetDir, realFilePath)) return null;
    const currentStats = fs.statSync(realFilePath);
    if (!sameFileIdentity(openedStats, currentStats) || currentStats.nlink !== 1) return null;
    verified = true;
    return { descriptor, filePath: realFilePath };
  } catch {
    return null;
  } finally {
    if (!verified) fs.closeSync(descriptor);
  }
}

function runCommentAssetMutation(
  operation: 'write' | 'remove',
  directory: SafeAssetDirectory,
  fileName: string,
  data?: Buffer,
): childProcess.SpawnSyncReturns<string> {
  return childProcess.spawnSync(
    process.execPath,
    ['--eval', COMMENT_ASSET_MUTATION_SCRIPT, operation, directory.realAssetDir, fileName],
    {
      cwd: directory.absoluteAssetDir,
      encoding: 'utf8',
      input: data,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    },
  );
}

export function writeCommentAsset(
  projectRoot: string,
  assetDir: string,
  relativePath: string,
  data: Buffer,
): void {
  const fileName = normalizeRelativeAssetName(relativePath);
  if (!fileName) throw new Error('Invalid comment asset path');
  const directory = assertSafeAssetDirectory(projectRoot, assetDir, true);
  const result = runCommentAssetMutation('write', directory, fileName, data);
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || String(result.stderr || '').trim();
    throw new Error(detail || 'Failed to write comment asset');
  }
}

export function readCommentAsset(
  projectRoot: string,
  assetDir: string,
  relativePath: string,
): ReadCommentAsset | null {
  const fileName = normalizeRelativeAssetName(relativePath);
  if (!fileName) return null;

  let directory: SafeAssetDirectory;
  try {
    directory = assertSafeAssetDirectory(projectRoot, assetDir, false);
  } catch {
    return null;
  }
  const opened = openVerifiedCommentAsset(directory, fileName);
  if (!opened) return null;
  try {
    return { data: fs.readFileSync(opened.descriptor), filePath: opened.filePath };
  } finally {
    fs.closeSync(opened.descriptor);
  }
}

export function removeCommentAsset(
  projectRoot: string,
  assetDir: string,
  relativePath: string,
): boolean {
  const fileName = normalizeRelativeAssetName(relativePath);
  if (!fileName) return false;

  let directory: SafeAssetDirectory;
  try {
    directory = assertSafeAssetDirectory(projectRoot, assetDir, false);
  } catch {
    return false;
  }
  const result = runCommentAssetMutation('remove', directory, fileName);
  return !result.error && result.status === 0;
}
