import fs from 'node:fs';
import path from 'node:path';

export type ReadCommentAsset = {
  data: Buffer;
  filePath: string;
};

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

function assertSafeAssetDirectory(projectRoot: string, assetDir: string, create: boolean): string {
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
  return realAssetDir;
}

function resolveExistingCommentAsset(
  projectRoot: string,
  assetDir: string,
  relativePath: string,
): string | null {
  const segments = normalizeRelativeAssetPath(relativePath);
  if (!segments) return null;

  let realAssetDir: string;
  try {
    realAssetDir = assertSafeAssetDirectory(projectRoot, assetDir, false);
  } catch {
    return null;
  }

  let current = path.resolve(assetDir);
  try {
    for (const [index, segment] of segments.entries()) {
      current = path.join(current, segment);
      const stats = fs.lstatSync(current);
      if (stats.isSymbolicLink()) return null;
      if (index < segments.length - 1 ? !stats.isDirectory() : !stats.isFile()) return null;
    }
    const realFilePath = fs.realpathSync.native(current);
    return isPathInside(realAssetDir, realFilePath) ? realFilePath : null;
  } catch {
    return null;
  }
}

function noFollowFlag(): number {
  return Number((fs.constants as Record<string, number>).O_NOFOLLOW || 0);
}

export function writeCommentAsset(
  projectRoot: string,
  assetDir: string,
  relativePath: string,
  data: Buffer,
): void {
  const segments = normalizeRelativeAssetPath(relativePath);
  if (!segments) throw new Error('Invalid comment asset path');
  assertSafeAssetDirectory(projectRoot, assetDir, true);

  const absoluteAssetDir = path.resolve(assetDir);
  const parentSegments = segments.slice(0, -1);
  let parent = absoluteAssetDir;
  for (const segment of parentSegments) {
    parent = path.join(parent, segment);
    const stats = fs.lstatSync(parent);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error('Comment asset path crosses a symbolic link boundary');
    }
  }

  const filePath = path.join(parent, segments.at(-1) as string);
  if (!isPathInside(absoluteAssetDir, filePath)) throw new Error('Invalid comment asset path');
  if (fs.existsSync(filePath)) {
    const stats = fs.lstatSync(filePath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error('Comment asset path crosses a symbolic link boundary');
    }
  }

  const descriptor = fs.openSync(
    filePath,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | noFollowFlag(),
    0o600,
  );
  try {
    if (!fs.fstatSync(descriptor).isFile()) throw new Error('Invalid comment asset file');
    fs.writeFileSync(descriptor, data);
  } finally {
    fs.closeSync(descriptor);
  }
}

export function readCommentAsset(
  projectRoot: string,
  assetDir: string,
  relativePath: string,
): ReadCommentAsset | null {
  const filePath = resolveExistingCommentAsset(projectRoot, assetDir, relativePath);
  if (!filePath) return null;

  let descriptor: number;
  try {
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | noFollowFlag());
  } catch {
    return null;
  }
  try {
    if (!fs.fstatSync(descriptor).isFile()) return null;
    return { data: fs.readFileSync(descriptor), filePath };
  } finally {
    fs.closeSync(descriptor);
  }
}

export function removeCommentAsset(
  projectRoot: string,
  assetDir: string,
  relativePath: string,
): boolean {
  const filePath = resolveExistingCommentAsset(projectRoot, assetDir, relativePath);
  if (!filePath) return false;
  fs.rmSync(filePath, { force: true });
  return true;
}
