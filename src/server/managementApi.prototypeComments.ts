import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { isPathInside, resolveProjectPath, type ProjectMetadata } from './projectCore/index.ts';

import { readJsonBody, sendFile, sendJson } from './http.ts';

const COMMENT_FILE_NAME = 'prototype-comments.json';
const SPEC_DIR_NAME = '.spec';
const ASSET_DIR_NAME = 'prototype-comment-assets';

type PrototypeCommentsContext = {
  project: {
    root: string;
  };
  metadata?: ProjectMetadata;
};

type ResolveResult =
  | {
      ok: true;
      prototypeId: string;
      prototypeDir: string;
      specDir: string;
      commentFilePath: string;
      projectRelativeCommentPath: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

function normalizeTargetPath(rawValue: string | null): { ok: true; value: string; id: string } | { ok: false; status: number; error: string } {
  const raw = String(rawValue ?? '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!raw) {
    return { ok: false, status: 400, error: 'Missing targetPath' };
  }
  if (raw.includes('..')) {
    return { ok: false, status: 403, error: 'Invalid targetPath' };
  }
  const segments = raw.split('/').filter(Boolean);
  if (segments.length !== 2 || segments[0] !== 'prototypes') {
    return { ok: false, status: 400, error: 'targetPath must be prototypes/<id>' };
  }
  const prototypeId = segments[1];
  if (!prototypeId || prototypeId.startsWith('.') || prototypeId.includes('\0')) {
    return { ok: false, status: 400, error: 'Invalid prototype id' };
  }
  return { ok: true, value: `prototypes/${prototypeId}`, id: prototypeId };
}

function isResolveError(result: ResolveResult): result is Extract<ResolveResult, { ok: false }> {
  return result.ok === false;
}

function getDeclaredPrototypeWriteDir(projectRoot: string, metadata?: ProjectMetadata): string | null {
  const target = metadata?.resourceWriteTargets?.prototypes;
  if (!target || target.type !== 'project-relative-path' || !target.path) {
    return null;
  }
  try {
    return resolveProjectPath(projectRoot, target.path);
  } catch {
    return null;
  }
}

function resolvePrototypeCommentsPath(
  projectRoot: string,
  rawTargetPath: string | null,
  metadata?: ProjectMetadata,
): ResolveResult {
  const normalized = normalizeTargetPath(rawTargetPath);
  if (normalized.ok === false) {
    return {
      ok: false,
      status: normalized.status,
      error: normalized.error,
    };
  }

  const prototypesDir = getDeclaredPrototypeWriteDir(projectRoot, metadata);
  if (!prototypesDir) {
    return { ok: false, status: 424, error: 'Prototype comment persistence requires declared prototype write target' };
  }
  const defaultPrototypesDir = path.join(projectRoot, 'src', 'prototypes');
  if (path.resolve(prototypesDir) !== path.resolve(defaultPrototypesDir)) {
    return { ok: false, status: 403, error: 'Prototype comment persistence is limited to src/prototypes' };
  }

  const prototypeDir = path.resolve(prototypesDir, normalized.id);
  if (!isPathInside(projectRoot, prototypeDir) || !isPathInside(prototypesDir, prototypeDir)) {
    return { ok: false, status: 403, error: 'Invalid targetPath' };
  }

  const specDir = path.join(prototypeDir, SPEC_DIR_NAME);
  const commentFilePath = path.join(specDir, COMMENT_FILE_NAME);
  if (
    !isPathInside(projectRoot, specDir)
    || !isPathInside(prototypeDir, specDir)
    || !isPathInside(specDir, commentFilePath)
  ) {
    return { ok: false, status: 403, error: 'Invalid comment path' };
  }

  return {
    ok: true,
    prototypeId: normalized.id,
    prototypeDir,
    specDir,
    commentFilePath,
    projectRelativeCommentPath: path.relative(projectRoot, commentFilePath).split(path.sep).join('/'),
  };
}

function inferImageExtension(mimeType: string): string {
  const normalized = String(mimeType || '').trim().toLowerCase();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/gif') return 'gif';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/svg+xml') return 'svg';
  return 'png';
}

function sanitizeAssetBaseName(value: unknown, fallback: string): string {
  const normalized = String(value ?? '').trim().replace(/\.[a-z0-9+.-]+$/iu, '');
  const safe = normalized
    .replace(/[^a-z0-9_-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase();
  return safe || fallback;
}

function parseImageDataUrl(dataUrl: unknown): { mimeType: string; buffer: Buffer } | null {
  const raw = String(dataUrl ?? '').trim();
  const match = raw.match(/^data:(image\/[a-z0-9+.-]+);base64,([a-z0-9+/=\s]+)$/iu);
  if (!match) return null;
  return {
    mimeType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2].replace(/\s+/gu, ''), 'base64'),
  };
}

function normalizeCommentDocument(input: unknown, resolved: Extract<ResolveResult, { ok: true }>): Record<string, unknown> {
  const raw = input && typeof input === 'object' && 'document' in input
    ? (input as { document?: unknown }).document
    : input;
  const record = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {};
  const resource = record.resource && typeof record.resource === 'object' && !Array.isArray(record.resource)
    ? { ...(record.resource as Record<string, unknown>) }
    : {};

  return {
    ...record,
    schemaVersion: 1,
    kind: 'prototype-comments',
    resource: {
      ...resource,
      id: resolved.prototypeId,
      targetPath: `prototypes/${resolved.prototypeId}`,
      filePath: resolved.projectRelativeCommentPath,
    },
    comments: Array.isArray(record.comments) ? record.comments : [],
    tasks: record.tasks && typeof record.tasks === 'object' && !Array.isArray(record.tasks)
      ? record.tasks
      : {},
    images: Array.isArray(record.images) ? record.images : [],
  };
}

function persistImageAssets(
  document: Record<string, unknown>,
  resolved: Extract<ResolveResult, { ok: true }>,
): Record<string, unknown> {
  const rawImages = Array.isArray(document.images) ? document.images : [];
  const assetDir = path.join(resolved.specDir, ASSET_DIR_NAME);
  const images = rawImages.map((rawImage, index) => {
    const image = rawImage && typeof rawImage === 'object' && !Array.isArray(rawImage)
      ? { ...(rawImage as Record<string, unknown>) }
      : {};
    const parsed = parseImageDataUrl(image.data);
    if (parsed) {
      const id = sanitizeAssetBaseName(image.id, `image-${index + 1}`);
      const extension = inferImageExtension(String(image.mimeType || parsed.mimeType));
      const fileName = `${id}.${extension}`;
      const assetPath = path.join(assetDir, fileName);
      if (!isPathInside(assetDir, assetPath)) {
        throw new Error('Invalid comment asset path');
      }
      fs.mkdirSync(assetDir, { recursive: true });
      fs.writeFileSync(assetPath, parsed.buffer);
      image.assetPath = `${ASSET_DIR_NAME}/${fileName}`;
      image.mimeType = image.mimeType || parsed.mimeType;
      image.size = Number(image.size ?? parsed.buffer.length);
    }
    delete image.data;
    return image;
  });
  return {
    ...document,
    images,
  };
}

function normalizeAssetPath(rawValue: string | null): string | null {
  const normalized = String(rawValue ?? '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0')) return null;
  const segments = normalized.split('/').filter(Boolean);
  if (
    segments.length < 2
    || segments[0] !== ASSET_DIR_NAME
    || segments.some((segment) => segment === '..')
    || segments.some((segment) => segment.startsWith('.'))
  ) {
    return null;
  }
  return segments.join('/');
}

function hydrateImageData(document: unknown, resolved: Extract<ResolveResult, { ok: true }>, url: URL): unknown {
  if (url.searchParams.get('hydrateImages') !== '1') {
    return document;
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return document;
  }
  const record = { ...(document as Record<string, unknown>) };
  const images = Array.isArray(record.images) ? record.images : [];
  record.images = images.map((rawImage) => {
    const image = rawImage && typeof rawImage === 'object' && !Array.isArray(rawImage)
      ? { ...(rawImage as Record<string, unknown>) }
      : {};
    const assetPath = normalizeAssetPath(typeof image.assetPath === 'string' ? image.assetPath : null);
    if (!assetPath) return image;
    const fullPath = path.resolve(resolved.specDir, assetPath);
    if (
      !isPathInside(path.join(resolved.specDir, ASSET_DIR_NAME), fullPath)
      || !fs.existsSync(fullPath)
      || !fs.statSync(fullPath).isFile()
    ) {
      return image;
    }
    const mimeType = String(image.mimeType || '').trim() || mimeTypeFromFileName(fullPath);
    image.data = `data:${mimeType};base64,${fs.readFileSync(fullPath).toString('base64')}`;
    return image;
  });
  return record;
}

function mimeTypeFromFileName(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/png';
}

function handleAssetRequest(
  req: IncomingMessage,
  res: ServerResponse,
  context: PrototypeCommentsContext,
  url: URL,
): boolean {
  if (url.pathname !== '/api/prototype-comments/asset') return false;
  if (req.method !== 'GET') {
    sendJson(res, { error: 'Method not allowed' }, { status: 405 });
    return true;
  }

  const resolved = resolvePrototypeCommentsPath(context.project.root, url.searchParams.get('targetPath'), context.metadata);
  if (isResolveError(resolved)) {
    sendJson(res, { error: resolved.error }, { status: resolved.status });
    return true;
  }
  const normalizedAsset = normalizeAssetPath(url.searchParams.get('asset'));
  if (!normalizedAsset) {
    const rawAsset = String(url.searchParams.get('asset') ?? '');
    sendJson(res, { error: 'Invalid asset path' }, { status: rawAsset.includes('..') ? 403 : 400 });
    return true;
  }
  const assetPath = path.resolve(resolved.specDir, normalizedAsset);
  if (!isPathInside(path.join(resolved.specDir, ASSET_DIR_NAME), assetPath)) {
    sendJson(res, { error: 'Invalid asset path' }, { status: 403 });
    return true;
  }
  if (!sendFile(res, assetPath, { cacheControl: 'no-store' })) {
    sendJson(res, { error: 'Asset not found' }, { status: 404 });
  }
  return true;
}

export function handlePrototypeCommentsApi(
  req: IncomingMessage,
  res: ServerResponse,
  context: PrototypeCommentsContext,
  url: URL,
): boolean {
  if (handleAssetRequest(req, res, context, url)) return true;
  if (url.pathname !== '/api/prototype-comments') return false;

  const resolved = resolvePrototypeCommentsPath(context.project.root, url.searchParams.get('targetPath'), context.metadata);
  if (isResolveError(resolved)) {
    sendJson(res, { error: resolved.error }, { status: resolved.status });
    return true;
  }

  if (req.method === 'GET') {
    if (!fs.existsSync(resolved.commentFilePath)) {
      sendJson(res, {
        exists: false,
        document: null,
        path: resolved.projectRelativeCommentPath,
      });
      return true;
    }
    try {
      const document = JSON.parse(fs.readFileSync(resolved.commentFilePath, 'utf8'));
      sendJson(res, {
        exists: true,
        document: hydrateImageData(document, resolved, url),
        path: resolved.projectRelativeCommentPath,
      });
    } catch (error) {
      sendJson(res, { error: error instanceof Error ? error.message : 'Invalid comment file' }, { status: 400 });
    }
    return true;
  }

  if (req.method === 'PUT') {
    readJsonBody(req)
      .then((body) => {
        const normalized = normalizeCommentDocument(body, resolved);
        const document = persistImageAssets(normalized, resolved);
        fs.mkdirSync(resolved.specDir, { recursive: true });
        fs.writeFileSync(resolved.commentFilePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
        sendJson(res, {
          ok: true,
          exists: true,
          document,
          path: resolved.projectRelativeCommentPath,
        });
      })
      .catch((error) => sendJson(res, { error: error?.message || 'Failed to write comments' }, { status: 400 }));
    return true;
  }

  sendJson(res, { error: 'Method not allowed' }, { status: 405 });
  return true;
}
