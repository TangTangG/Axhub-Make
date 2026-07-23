import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type ReadCommentAsset = {
  data: Buffer;
  filePath: string;
};

export type CommentAssetWrite = {
  relativePath: string;
  data: Buffer;
};

type SafeAssetDirectory = {
  absoluteAssetDir: string;
  realAssetDir: string;
};

type MutationPayload = {
  writes?: Array<{ segments: string[]; data: string }>;
  removes?: Array<{ index: number; segments: string[] }>;
};

const COMMENT_ASSET_WORKER_SCRIPT = String.raw`
const fs = require('node:fs');
const path = require('node:path');

const [operation, expectedRoot] = process.argv.slice(1);
const noFollow = Number(fs.constants.O_NOFOLLOW || 0);
const nonBlocking = Number(fs.constants.O_NONBLOCK || 0);

function samePath(left, right) {
  return path.relative(left, right) === '';
}

function validSegment(value) {
  return Boolean(
    value
    && value !== '.'
    && value !== '..'
    && !value.includes('\0')
    && !value.includes('/')
    && !value.includes('\\')
    && !path.isAbsolute(value)
  );
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function assertAnchored(expectedPath) {
  const actualPath = fs.realpathSync.native(process.cwd());
  if (!samePath(actualPath, expectedPath)) {
    throw new Error('Comment asset directory identity changed');
  }
  return actualPath;
}

function descend(segments, create) {
  const startingRealPath = fs.realpathSync.native(process.cwd());
  let currentRealPath = startingRealPath;
  let depth = 0;
  try {
    for (const segment of segments) {
      if (!validSegment(segment)) throw new Error('Invalid comment asset path segment');
      let stats;
      try {
        stats = fs.lstatSync(segment);
      } catch (error) {
        if (!create || error.code !== 'ENOENT') throw error;
        fs.mkdirSync(segment);
        stats = fs.lstatSync(segment);
      }
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new Error('Comment asset path crosses a symbolic link boundary');
      }
      const expectedChild = path.join(currentRealPath, segment);
      process.chdir(segment);
      depth += 1;
      currentRealPath = assertAnchored(expectedChild);
    }
    return { currentRealPath, depth };
  } catch (error) {
    returnToRoot(depth, startingRealPath);
    throw error;
  }
}

function returnToRoot(depth, expectedPath) {
  for (let index = 0; index < depth; index += 1) process.chdir('..');
  assertAnchored(expectedPath);
}

function assertExistingDestination(fileName) {
  try {
    const stats = fs.lstatSync(fileName);
    if (stats.isSymbolicLink() || !stats.isFile() || stats.nlink !== 1) {
      throw new Error('Comment asset must be a regular file with one link');
    }
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function writeOne(segments, encodedData, assetRoot) {
  const parentSegments = segments.slice(0, -1);
  const fileName = segments.at(-1);
  if (!validSegment(fileName)) throw new Error('Invalid comment asset file name');
  const { currentRealPath, depth } = descend(parentSegments, false);
  const temporaryName = '.write-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  let descriptor;
  try {
    assertExistingDestination(fileName);
    descriptor = fs.openSync(
      temporaryName,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | noFollow | nonBlocking,
      0o600,
    );
    const openedStats = fs.fstatSync(descriptor);
    if (!openedStats.isFile() || openedStats.nlink !== 1) {
      throw new Error('Invalid comment asset temporary file');
    }
    const temporaryRealPath = fs.realpathSync.native(temporaryName);
    if (!samePath(path.dirname(temporaryRealPath), currentRealPath)) {
      throw new Error('Comment asset temporary file escaped its parent');
    }
    const temporaryStats = fs.statSync(temporaryRealPath);
    if (!sameFile(openedStats, temporaryStats) || temporaryStats.nlink !== 1) {
      throw new Error('Comment asset temporary file identity changed');
    }
    fs.writeFileSync(descriptor, Buffer.from(encodedData, 'base64'));
    fs.fsyncSync(descriptor);
    const writtenStats = fs.fstatSync(descriptor);
    if (!sameFile(openedStats, writtenStats) || writtenStats.nlink !== 1) {
      throw new Error('Comment asset temporary file link count changed');
    }
    fs.closeSync(descriptor);
    descriptor = undefined;
    assertExistingDestination(fileName);
    fs.renameSync(temporaryName, fileName);
  } finally {
    if (typeof descriptor === 'number') fs.closeSync(descriptor);
    try {
      if (fs.existsSync(temporaryName)) fs.unlinkSync(temporaryName);
    } catch {
      // The worker is already failing closed; leave cleanup to project tooling.
    }
    returnToRoot(depth, assetRoot);
  }
}

function removeOne(segments, assetRoot) {
  const parentSegments = segments.slice(0, -1);
  const fileName = segments.at(-1);
  if (!validSegment(fileName)) return false;
  let depth = 0;
  let descriptor;
  try {
    ({ depth } = descend(parentSegments, false));
    if (!assertExistingDestination(fileName)) return false;
    descriptor = fs.openSync(fileName, fs.constants.O_RDONLY | noFollow | nonBlocking);
    const openedStats = fs.fstatSync(descriptor);
    if (!openedStats.isFile() || openedStats.nlink !== 1) return false;
    const realTargetPath = fs.realpathSync.native(fileName);
    const currentRealPath = fs.realpathSync.native(process.cwd());
    if (!samePath(path.dirname(realTargetPath), currentRealPath)) return false;
    const currentStats = fs.statSync(realTargetPath);
    if (!sameFile(openedStats, currentStats) || currentStats.nlink !== 1) return false;
    const quarantineName = '.delete-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    fs.renameSync(fileName, quarantineName);
    const quarantinedStats = fs.lstatSync(quarantineName);
    if (!sameFile(openedStats, quarantinedStats) || quarantinedStats.nlink !== 1) return false;
    fs.unlinkSync(quarantineName);
    return true;
  } catch {
    return false;
  } finally {
    if (typeof descriptor === 'number') fs.closeSync(descriptor);
    returnToRoot(depth, assetRoot);
  }
}

try {
  const rootRealPath = assertAnchored(expectedRoot);
  const payloadText = fs.readFileSync(0, 'utf8');
  const payload = payloadText ? JSON.parse(payloadText) : {};
  if (operation === 'ensure-directory') {
    descend(Array.isArray(payload.segments) ? payload.segments : [], true);
    process.stdout.write('{}');
  } else if (operation === 'mutate') {
    for (const write of Array.isArray(payload.writes) ? payload.writes : []) {
      writeOne(write.segments, write.data, rootRealPath);
    }
    const removed = [];
    for (const removal of Array.isArray(payload.removes) ? payload.removes : []) {
      if (removeOne(removal.segments, rootRealPath)) removed.push(removal.index);
    }
    process.stdout.write(JSON.stringify({ removed }));
  } else {
    throw new Error('Unsupported comment asset worker operation');
  }
} catch (error) {
  process.stderr.write(String(error && error.message ? error.message : error));
  process.exitCode = 1;
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

function normalizeRelativeAssetPath(value: string): string[] | null {
  const normalized = String(value || '').trim().replace(/\\/gu, '/');
  if (!normalized || normalized.includes('\0') || normalized.startsWith('/')) return null;
  const segments = normalized.split('/');
  return segments.some((segment) => !segment || segment === '.' || segment === '..')
    ? null
    : segments;
}

function noFollowFlag(): number {
  return Number((fs.constants as Record<string, number>).O_NOFOLLOW || 0);
}

function nonBlockingFlag(): number {
  return Number((fs.constants as Record<string, number>).O_NONBLOCK || 0);
}

function sameFileIdentity(left: fs.Stats, right: fs.Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function workerError(result: childProcess.SpawnSyncReturns<string>, fallback: string): Error {
  const detail = result.error?.message || String(result.stderr || '').trim();
  return new Error(detail || fallback);
}

function runWorker(
  operation: 'ensure-directory' | 'mutate',
  cwd: string,
  expectedRoot: string,
  payload: unknown,
): childProcess.SpawnSyncReturns<string> {
  return childProcess.spawnSync(
    process.execPath,
    ['--input-type=commonjs', '--eval', COMMENT_ASSET_WORKER_SCRIPT, operation, expectedRoot],
    {
      cwd,
      encoding: 'utf8',
      input: JSON.stringify(payload),
      maxBuffer: 1024 * 1024,
      timeout: 30_000,
      windowsHide: true,
    },
  );
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

  const relativeSegments = path.relative(absoluteProjectRoot, absoluteAssetDir)
    .split(path.sep)
    .filter(Boolean);
  const realProjectRoot = fs.realpathSync.native(absoluteProjectRoot);
  if (create && !fs.existsSync(absoluteAssetDir)) {
    const result = runWorker(
      'ensure-directory',
      absoluteProjectRoot,
      realProjectRoot,
      { segments: relativeSegments },
    );
    if (result.error || result.status !== 0) {
      throw workerError(result, 'Failed to create comment asset directory');
    }
  }

  let current = realProjectRoot;
  for (const segment of relativeSegments) {
    current = path.join(current, segment);
    const stats = fs.lstatSync(current);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error('Comment asset directory crosses a symbolic link boundary');
    }
  }
  if (!fs.existsSync(current)) throw new Error('Comment asset directory does not exist');
  const realAssetDir = fs.realpathSync.native(current);
  if (!isPathInside(realProjectRoot, realAssetDir) || path.relative(current, realAssetDir) !== '') {
    throw new Error('Comment asset directory escapes project root');
  }
  return { absoluteAssetDir: current, realAssetDir };
}

function validateExistingAssetPath(
  directory: SafeAssetDirectory,
  segments: string[],
): string | null {
  let current = directory.realAssetDir;
  try {
    for (const [index, segment] of segments.entries()) {
      current = path.join(current, segment);
      const stats = fs.lstatSync(current);
      if (stats.isSymbolicLink()) return null;
      if (index < segments.length - 1 ? !stats.isDirectory() : !stats.isFile()) return null;
    }
    return current;
  } catch {
    return null;
  }
}

function openVerifiedCommentAsset(
  directory: SafeAssetDirectory,
  segments: string[],
): { descriptor: number; filePath: string } | null {
  const expectedFilePath = validateExistingAssetPath(directory, segments);
  if (!expectedFilePath) return null;
  let descriptor: number;
  try {
    descriptor = fs.openSync(
      expectedFilePath,
      fs.constants.O_RDONLY | noFollowFlag() | nonBlockingFlag(),
    );
  } catch {
    return null;
  }

  let verified = false;
  try {
    const openedStats = fs.fstatSync(descriptor);
    if (!openedStats.isFile() || openedStats.nlink !== 1) return null;
    const realFilePath = fs.realpathSync.native(expectedFilePath);
    if (path.relative(expectedFilePath, realFilePath) !== '') return null;
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

export function writeCommentAssets(
  projectRoot: string,
  assetDir: string,
  writes: CommentAssetWrite[],
): void {
  if (writes.length === 0) return;
  const normalizedWrites = writes.map((write) => {
    const segments = normalizeRelativeAssetPath(write.relativePath);
    if (!segments) throw new Error('Invalid comment asset path');
    return { segments, data: write.data.toString('base64') };
  });
  const directory = assertSafeAssetDirectory(projectRoot, assetDir, true);
  const result = runWorker('mutate', directory.absoluteAssetDir, directory.realAssetDir, {
    writes: normalizedWrites,
  } satisfies MutationPayload);
  if (result.error || result.status !== 0) {
    throw workerError(result, 'Failed to write comment assets');
  }
}

export function writeCommentAsset(
  projectRoot: string,
  assetDir: string,
  relativePath: string,
  data: Buffer,
): void {
  writeCommentAssets(projectRoot, assetDir, [{ relativePath, data }]);
}

export function readCommentAsset(
  projectRoot: string,
  assetDir: string,
  relativePath: string,
): ReadCommentAsset | null {
  const segments = normalizeRelativeAssetPath(relativePath);
  if (!segments) return null;

  let directory: SafeAssetDirectory;
  try {
    directory = assertSafeAssetDirectory(projectRoot, assetDir, false);
  } catch {
    return null;
  }
  const opened = openVerifiedCommentAsset(directory, segments);
  if (!opened) return null;
  try {
    return { data: fs.readFileSync(opened.descriptor), filePath: opened.filePath };
  } finally {
    fs.closeSync(opened.descriptor);
  }
}

export function removeCommentAssets(
  projectRoot: string,
  assetDir: string,
  relativePaths: string[],
): boolean[] {
  if (relativePaths.length === 0) return [];
  const normalized = relativePaths.map((relativePath, index) => ({
    index,
    segments: normalizeRelativeAssetPath(relativePath),
  }));
  const validRemovals = normalized.flatMap((entry) => (
    entry.segments ? [{ index: entry.index, segments: entry.segments }] : []
  ));
  if (validRemovals.length === 0) return relativePaths.map(() => false);

  let directory: SafeAssetDirectory;
  try {
    directory = assertSafeAssetDirectory(projectRoot, assetDir, false);
  } catch {
    return relativePaths.map(() => false);
  }
  const result = runWorker('mutate', directory.absoluteAssetDir, directory.realAssetDir, {
    removes: validRemovals,
  } satisfies MutationPayload);
  if (result.error || result.status !== 0) return relativePaths.map(() => false);
  try {
    const removed = new Set<number>(JSON.parse(String(result.stdout || '{}')).removed || []);
    return relativePaths.map((_, index) => removed.has(index));
  } catch {
    return relativePaths.map(() => false);
  }
}

export function removeCommentAsset(
  projectRoot: string,
  assetDir: string,
  relativePath: string,
): boolean {
  return removeCommentAssets(projectRoot, assetDir, [relativePath])[0] || false;
}
