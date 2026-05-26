import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { isPathInside, resolveProjectPath, type ProjectMetadata } from './projectCore/index.ts';

import { getCanvasBridgeHub } from './canvasBridge.ts';
import { readJsonBody, sendFile, sendJson } from './http.ts';

const CANVAS_EXT = '.excalidraw';
const DEFAULT_CANVAS_SOURCE = '@axhub/make';
const PROTOTYPE_CANVAS_ASSETS_DIR = 'canvas-assets';
const CANVAS_IMAGE_ASSETS_DIR = 'images';
const PROTOTYPE_SCREENSHOT_FILE = 'screenshot.png';
const MAX_SCREENSHOT_BYTES = 12 * 1024 * 1024;
const MAX_CANVAS_IMAGE_BYTES = 12 * 1024 * 1024;
const SAFE_SCREENSHOT_FILE_PATTERN = /^[a-z0-9][a-z0-9._-]*\.png$/iu;
const CANVAS_IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

interface CanvasApiContext {
  metadata?: ProjectMetadata;
}

interface CanvasAssetStorageOptions {
  assetBaseDir: string;
  imageAssetDir: string;
  imagePathPrefix: string;
}

function toKebabBaseName(input: string, fallbackPrefix: string): string {
  const normalized = String(input || '')
    .trim()
    .replace(/\.[^.]+$/u, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return normalized || `${fallbackPrefix}-${Date.now()}`;
}

function createUniqueFilePath(dir: string, baseName: string, ext: string): string {
  let candidate = path.join(dir, `${baseName}${ext}`);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}-${index}${ext}`);
    index += 1;
  }
  return candidate;
}

export function createDefaultCanvasData() {
  return {
    type: 'excalidraw',
    version: 2,
    source: DEFAULT_CANVAS_SOURCE,
    elements: [],
    appState: {
      viewBackgroundColor: '#ffffff',
    },
    files: {},
  };
}

function parseEncodedSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function resolvePrototypeCanvasPath(projectRoot: string, encodedPrototypeId: string): {
  prototypeId: string;
  prototypeDir: string;
  canvasPath: string;
} | { error: string; status: number } {
  const prototypeId = parseEncodedSegment(encodedPrototypeId);
  if (!prototypeId) {
    return { error: 'Invalid prototype id', status: 400 };
  }
  if (
    prototypeId === '.'
    || prototypeId === '..'
    || prototypeId.includes('/')
    || prototypeId.includes('\\')
  ) {
    return { error: 'Invalid prototype id', status: 403 };
  }

  const prototypesDir = path.resolve(projectRoot, 'src', 'prototypes');
  const prototypeDir = path.resolve(prototypesDir, prototypeId);
  if (!isPathInside(prototypesDir, prototypeDir)) {
    return { error: 'Invalid prototype id', status: 403 };
  }
  if (!fs.existsSync(prototypeDir)) {
    return { error: 'Prototype not found', status: 404 };
  }

  const canvasPath = path.resolve(prototypeDir, `canvas${CANVAS_EXT}`);
  if (!isPathInside(projectRoot, canvasPath) || !isPathInside(prototypeDir, canvasPath)) {
    return { error: 'Invalid canvas path', status: 403 };
  }
  return { prototypeId, prototypeDir, canvasPath };
}

function createPrototypeCanvasResponse(projectRoot: string, prototypeId: string, canvasPath: string, created = false) {
  return {
    success: true,
    created,
    name: `prototypes/${prototypeId}/canvas${CANVAS_EXT}`,
    displayName: `${prototypeId} Canvas`,
    path: path.relative(projectRoot, canvasPath).split(path.sep).join('/'),
    absoluteFilePath: canvasPath,
  };
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

function ensurePrototypeCanvasFile(projectRoot: string, prototypeId: string, canvasPath: string): boolean {
  void projectRoot;
  void prototypeId;
  if (fs.existsSync(canvasPath)) {
    return false;
  }
  fs.writeFileSync(canvasPath, JSON.stringify(createDefaultCanvasData(), null, 2), 'utf8');
  return true;
}

function createPrototypeCanvasAssetStorageOptions(prototypeDir: string): CanvasAssetStorageOptions {
  return {
    assetBaseDir: prototypeDir,
    imageAssetDir: path.resolve(prototypeDir, PROTOTYPE_CANVAS_ASSETS_DIR, CANVAS_IMAGE_ASSETS_DIR),
    imagePathPrefix: `${PROTOTYPE_CANVAS_ASSETS_DIR}/${CANVAS_IMAGE_ASSETS_DIR}`,
  };
}

function createStandaloneCanvasAssetStorageOptions(canvasDir: string, canvasPath: string): CanvasAssetStorageOptions {
  const canvasAssetBase = toSafeCanvasAssetFileBase(path.basename(canvasPath, CANVAS_EXT));
  return {
    assetBaseDir: canvasDir,
    imageAssetDir: path.resolve(canvasDir, PROTOTYPE_CANVAS_ASSETS_DIR, canvasAssetBase, CANVAS_IMAGE_ASSETS_DIR),
    imagePathPrefix: `${PROTOTYPE_CANVAS_ASSETS_DIR}/${canvasAssetBase}/${CANVAS_IMAGE_ASSETS_DIR}`,
  };
}

function decodePngDataUrl(dataUrl: unknown): Buffer | null {
  if (typeof dataUrl !== 'string') {
    return null;
  }
  const match = dataUrl.match(/^data:image\/png;base64,([a-z0-9+/=\s]+)$/iu);
  if (!match) {
    return null;
  }
  const buffer = Buffer.from(match[1].replace(/\s+/gu, ''), 'base64');
  if (buffer.length === 0 || buffer.length > MAX_SCREENSHOT_BYTES) {
    return null;
  }
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buffer.subarray(0, pngSignature.length).equals(pngSignature)) {
    return null;
  }
  return buffer;
}

function hasValidCanvasImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/gif') {
    const header = buffer.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

function decodeCanvasImageDataUrl(dataUrl: unknown): { buffer: Buffer; mimeType: string; ext: string } | null {
  if (typeof dataUrl !== 'string') {
    return null;
  }
  const match = dataUrl.match(/^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/iu);
  if (!match) {
    return null;
  }
  const mimeType = match[1].toLowerCase();
  const ext = CANVAS_IMAGE_MIME_EXTENSIONS[mimeType];
  if (!ext) {
    return null;
  }
  const buffer = Buffer.from(match[2].replace(/\s+/gu, ''), 'base64');
  if (buffer.length === 0 || buffer.length > MAX_CANVAS_IMAGE_BYTES) {
    return null;
  }
  if (!hasValidCanvasImageSignature(buffer, mimeType)) {
    return null;
  }
  return { buffer, mimeType, ext };
}

function isSupportedCanvasImageDataUrl(dataUrl: unknown): boolean {
  if (typeof dataUrl !== 'string') {
    return false;
  }
  const match = dataUrl.match(/^data:([^;,]+);base64,/iu);
  if (!match) {
    return false;
  }
  return Boolean(CANVAS_IMAGE_MIME_EXTENSIONS[match[1].toLowerCase()]);
}

function toSafeCanvasAssetFileBase(value: unknown): string {
  const rawValue = typeof value === 'string' && value.trim() ? value.trim() : 'image';
  const normalized = rawValue
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();
  if (normalized) {
    return normalized;
  }
  return createHash('sha1').update(rawValue).digest('hex').slice(0, 12);
}

function writeBinaryFileIfChanged(filePath: string, nextContent: Buffer): boolean {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const currentContent = fs.readFileSync(filePath);
    if (currentContent.equals(nextContent)) {
      return false;
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, nextContent);
  return true;
}

function normalizeScreenshotDimension(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.round(value);
}

function toSafeScreenshotFileBase(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value
    .trim()
    .replace(/[^a-z0-9]+/giu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();
  return normalized || null;
}

function getRequestedScreenshotFileName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!SAFE_SCREENSHOT_FILE_PATTERN.test(trimmed) || trimmed.includes('/') || trimmed.includes('\\')) {
    return null;
  }
  return trimmed;
}

function getScreenshotFileName(body: any): string {
  const requestedFileName = getRequestedScreenshotFileName(body?.fileName);
  if (requestedFileName) {
    return requestedFileName;
  }

  const safeElementId = toSafeScreenshotFileBase(body?.elementId);
  return safeElementId ? `embed-${safeElementId}.png` : PROTOTYPE_SCREENSHOT_FILE;
}

function hydrateStoredCanvasImageFiles(data: any, options?: Pick<CanvasAssetStorageOptions, 'assetBaseDir'>): any {
  if (!options || !data || typeof data !== 'object' || !data.files || typeof data.files !== 'object') {
    return data;
  }

  for (const file of Object.values(data.files) as any[]) {
    if (!file || typeof file !== 'object' || typeof file.dataURL === 'string') {
      continue;
    }
    const storedPath = typeof file.path === 'string' ? file.path : '';
    const ext = CANVAS_IMAGE_MIME_EXTENSIONS[String(file.mimeType || '').toLowerCase()];
    if (!storedPath || !ext) {
      continue;
    }
    const imagePath = path.resolve(options.assetBaseDir, storedPath);
    if (!isPathInside(options.assetBaseDir, imagePath)) {
      continue;
    }
    try {
      const stats = fs.statSync(imagePath);
      if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_CANVAS_IMAGE_BYTES) {
        continue;
      }
      const content = fs.readFileSync(imagePath);
      if (!hasValidCanvasImageSignature(content, String(file.mimeType).toLowerCase())) {
        continue;
      }
      file.dataURL = `data:${String(file.mimeType).toLowerCase()};base64,${content.toString('base64')}`;
    } catch {
      // Keep the lightweight path-only file record if the local asset is missing.
    }
  }
  return data;
}

function sendCanvasJsonFile(
  res: ServerResponse,
  filePath: string,
  options?: Pick<CanvasAssetStorageOptions, 'assetBaseDir'>,
): boolean {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const content = fs.readFileSync(filePath, 'utf8');
  if (!options) {
    res.end(content);
    return true;
  }
  try {
    const data = hydrateStoredCanvasImageFiles(JSON.parse(content), options);
    res.end(JSON.stringify(data, null, 2));
  } catch {
    res.end(content);
  }
  return true;
}

function stripPersistedElementScreenshotDataUrls(data: any): any {
  if (!Array.isArray(data?.elements)) {
    return data;
  }

  for (const element of data.elements) {
    const customData = element?.customData;
    if (
      customData
      && typeof customData.screenshotUrl === 'string'
      && customData.screenshotUrl.trim()
      && Object.prototype.hasOwnProperty.call(customData, 'screenshotDataUrl')
    ) {
      delete customData.screenshotDataUrl;
    }
  }
  return data;
}

function localizeCanvasImageFiles(data: any, options?: CanvasAssetStorageOptions): any {
  if (!options || !data || typeof data !== 'object' || !data.files || typeof data.files !== 'object') {
    return data;
  }

  for (const [fileKey, file] of Object.entries(data.files) as Array<[string, any]>) {
    if (!file || typeof file !== 'object') {
      continue;
    }
    const decoded = decodeCanvasImageDataUrl(file.dataURL);
    if (!decoded && typeof file.dataURL === 'string') {
      if (!isSupportedCanvasImageDataUrl(file.dataURL)) {
        continue;
      }
      throw new Error(`Unsupported or invalid canvas image data URL for file ${fileKey}`);
    }
    if (!decoded) {
      continue;
    }
    const fileId = typeof file.id === 'string' && file.id.trim() ? file.id.trim() : fileKey;
    const fileName = `${toSafeCanvasAssetFileBase(fileId)}${decoded.ext}`;
    const imagePath = path.resolve(options.imageAssetDir, fileName);
    if (!isPathInside(options.assetBaseDir, imagePath) || !isPathInside(options.imageAssetDir, imagePath)) {
      continue;
    }
    writeBinaryFileIfChanged(imagePath, decoded.buffer);
    const { dataURL: _dataURL, ...rest } = file;
    data.files[fileKey] = {
      ...rest,
      mimeType: decoded.mimeType,
      id: fileId,
      path: `${options.imagePathPrefix}/${fileName}`,
    };
  }
  return data;
}

function normalizeCanvasContent(body: any, assetOptions?: CanvasAssetStorageOptions): string {
  const content = body?.content;
  const data = typeof content === 'string' ? JSON.parse(content) : (content ?? body);
  return JSON.stringify(localizeCanvasImageFiles(stripPersistedElementScreenshotDataUrls(data), assetOptions), null, 2);
}

function hasSameCanvasContent(filePath: string, nextContent: string): boolean {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  const currentContent = fs.readFileSync(filePath, 'utf8');
  if (currentContent === nextContent) {
    return true;
  }

  try {
    return JSON.stringify(JSON.parse(currentContent), null, 2) === nextContent;
  } catch {
    return false;
  }
}

function writeCanvasContentIfChanged(filePath: string, nextContent: string): boolean {
  if (hasSameCanvasContent(filePath, nextContent)) {
    return false;
  }
  fs.writeFileSync(filePath, nextContent, 'utf8');
  return true;
}

function saveCanvasContent(
  filePath: string,
  body: any,
  assetOptions?: CanvasAssetStorageOptions,
): { changed: boolean } {
  const nextContent = normalizeCanvasContent(body, assetOptions);
  const changed = writeCanvasContentIfChanged(filePath, nextContent);
  if (changed) {
    getCanvasBridgeHub().recordCanvasSave(filePath, nextContent, {
      sourceClientId: typeof body?.canvasBridgeClientId === 'string' ? body.canvasBridgeClientId : null,
    });
  }
  return { changed };
}

function writeScreenshotIfChanged(filePath: string, nextContent: Buffer): boolean {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const currentContent = fs.readFileSync(filePath);
    if (currentContent.equals(nextContent)) {
      return false;
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, nextContent);
  return true;
}

function createPrototypeScreenshotResponse(
  projectRoot: string,
  prototypeId: string,
  screenshotPath: string,
  params: {
    changed: boolean;
    latestPath?: string;
    width?: number;
    height?: number;
  },
) {
  const updatedAt = Date.now();
  const fileName = path.basename(screenshotPath);
  return {
    success: true,
    changed: params.changed,
    prototypeId,
    fileName,
    name: `prototypes/${prototypeId}/${fileName}`,
    path: path.relative(projectRoot, screenshotPath).split(path.sep).join('/'),
    latestPath: params.latestPath ? path.relative(projectRoot, params.latestPath).split(path.sep).join('/') : undefined,
    absoluteFilePath: screenshotPath,
    screenshotUrl: `/prototypes/${encodeURIComponent(prototypeId)}/${PROTOTYPE_CANVAS_ASSETS_DIR}/${encodeURIComponent(fileName)}?v=${updatedAt}`,
    apiScreenshotUrl: `/api/canvas/prototypes/${encodeURIComponent(prototypeId)}/${PROTOTYPE_CANVAS_ASSETS_DIR}/${encodeURIComponent(fileName)}?v=${updatedAt}`,
    width: params.width,
    height: params.height,
    updatedAt,
  };
}

function resolvePrototypeScreenshotPath(
  projectRoot: string,
  encodedPrototypeId: string,
  context: CanvasApiContext = {},
): {
  prototypeId: string;
  prototypeDir: string;
  assetsDir: string;
  screenshotPath: string;
} | { error: string; status: number } {
  const prototypeId = parseEncodedSegment(encodedPrototypeId);
  if (!prototypeId) {
    return { error: 'Invalid prototype id', status: 400 };
  }
  if (
    prototypeId === '.'
    || prototypeId === '..'
    || prototypeId.includes('/')
    || prototypeId.includes('\\')
  ) {
    return { error: 'Invalid prototype id', status: 403 };
  }

  const declaredPrototypesDir = getDeclaredPrototypeWriteDir(projectRoot, context.metadata);
  if (!declaredPrototypesDir) {
    return { error: 'Prototype screenshot persistence requires declared prototype write target', status: 424 };
  }

  const prototypeDir = path.resolve(declaredPrototypesDir, prototypeId);
  if (!isPathInside(projectRoot, prototypeDir) || !isPathInside(declaredPrototypesDir, prototypeDir)) {
    return { error: 'Invalid prototype id', status: 403 };
  }
  if (!fs.existsSync(prototypeDir) || !fs.statSync(prototypeDir).isDirectory()) {
    return { error: 'Prototype not found', status: 404 };
  }

  const assetsDir = path.resolve(prototypeDir, PROTOTYPE_CANVAS_ASSETS_DIR);
  const screenshotPath = path.resolve(assetsDir, PROTOTYPE_SCREENSHOT_FILE);
  if (
    !isPathInside(projectRoot, assetsDir)
    || !isPathInside(prototypeDir, assetsDir)
    || !isPathInside(projectRoot, screenshotPath)
    || !isPathInside(assetsDir, screenshotPath)
  ) {
    return { error: 'Invalid screenshot path', status: 403 };
  }
  return { prototypeId, prototypeDir, assetsDir, screenshotPath };
}

function resolvePrototypeScreenshotReadPath(
  prototypeDir: string,
  assetsDir: string,
  action: string,
): string | null {
  const normalizedAction = action.replace(/\\/gu, '/');
  const prefix = `${PROTOTYPE_CANVAS_ASSETS_DIR}/`;
  if (normalizedAction.startsWith(prefix)) {
    const fileName = normalizedAction.slice(prefix.length);
    if (!getRequestedScreenshotFileName(fileName)) {
      return null;
    }
    const requestedPath = path.resolve(assetsDir, fileName);
    return isPathInside(assetsDir, requestedPath) ? requestedPath : null;
  }

  const requestedFileName = getRequestedScreenshotFileName(normalizedAction);
  if (!requestedFileName) {
    return null;
  }

  const legacyPath = path.resolve(prototypeDir, requestedFileName);
  return isPathInside(prototypeDir, legacyPath) ? legacyPath : null;
}

function handlePrototypeScreenshotApi(
  req: IncomingMessage,
  res: ServerResponse,
  projectRoot: string,
  pathname: string,
  context: CanvasApiContext = {},
): boolean {
  const match = pathname.match(/^\/api\/canvas\/prototypes\/(.+?)\/(screenshot|canvas-assets\/[a-z0-9][a-z0-9._-]*\.png|[a-z0-9][a-z0-9._-]*\.png)$/iu);
  if (!match) {
    return false;
  }

  const resolved = resolvePrototypeScreenshotPath(projectRoot, match[1], context);
  if ('error' in resolved) {
    sendJson(res, { error: resolved.error }, { status: resolved.status });
    return true;
  }

  const action = match[2];
  if (action.endsWith('.png')) {
    if (req.method !== 'GET') {
      sendJson(res, { error: 'Method not allowed' }, { status: 405 });
      return true;
    }
    const requestedPath = resolvePrototypeScreenshotReadPath(resolved.prototypeDir, resolved.assetsDir, action);
    if (!requestedPath) {
      sendJson(res, { error: 'Invalid screenshot path' }, { status: 403 });
      return true;
    }
    if (!sendFile(res, requestedPath)) {
      sendJson(res, { error: 'Screenshot not found' }, { status: 404 });
    }
    return true;
  }

  if (req.method !== 'POST') {
    sendJson(res, { error: 'Method not allowed' }, { status: 405 });
    return true;
  }

  readJsonBody(req).then((body) => {
    const png = decodePngDataUrl(body?.dataUrl);
    if (!png) {
      sendJson(res, { error: 'Expected PNG data URL' }, { status: 400 });
      return;
    }
    const screenshotFileName = getScreenshotFileName(body);
    const screenshotPath = path.resolve(resolved.assetsDir, screenshotFileName);
    if (!isPathInside(resolved.assetsDir, screenshotPath) || !isPathInside(projectRoot, screenshotPath)) {
      sendJson(res, { error: 'Invalid screenshot path' }, { status: 403 });
      return;
    }
    const changed = writeScreenshotIfChanged(screenshotPath, png);
    const latestChanged = screenshotPath === resolved.screenshotPath
      ? changed
      : writeScreenshotIfChanged(resolved.screenshotPath, png);
    sendJson(
      res,
      createPrototypeScreenshotResponse(projectRoot, resolved.prototypeId, screenshotPath, {
        changed: changed || latestChanged,
        latestPath: screenshotPath === resolved.screenshotPath ? undefined : resolved.screenshotPath,
        width: normalizeScreenshotDimension(body?.width),
        height: normalizeScreenshotDimension(body?.height),
      }),
      { status: changed || latestChanged ? 201 : 200 },
    );
  }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
  return true;
}

function handlePrototypeCanvasApi(
  req: IncomingMessage,
  res: ServerResponse,
  projectRoot: string,
  pathname: string,
): boolean {
  const match = pathname.match(/^\/api\/canvas\/prototypes\/(.+?)\/(ensure|canvas\.excalidraw)$/u);
  if (!match) {
    return false;
  }

  const resolved = resolvePrototypeCanvasPath(projectRoot, match[1]);
  if ('error' in resolved) {
    sendJson(res, { error: resolved.error }, { status: resolved.status });
    return true;
  }

  const assetOptions = createPrototypeCanvasAssetStorageOptions(resolved.prototypeDir);
  const action = match[2];
  if (action === 'ensure') {
    if (req.method !== 'POST') {
      sendJson(res, { error: 'Method not allowed' }, { status: 405 });
      return true;
    }
    const created = ensurePrototypeCanvasFile(projectRoot, resolved.prototypeId, resolved.canvasPath);
    sendJson(
      res,
      createPrototypeCanvasResponse(projectRoot, resolved.prototypeId, resolved.canvasPath, created),
      { status: created ? 201 : 200 },
    );
    return true;
  }

  if (req.method === 'GET') {
    ensurePrototypeCanvasFile(projectRoot, resolved.prototypeId, resolved.canvasPath);
    sendCanvasJsonFile(res, resolved.canvasPath, assetOptions);
    return true;
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    readJsonBody(req).then((body) => {
      if (
        req.method === 'POST'
        && typeof body?.content !== 'string'
        && typeof body?.content !== 'object'
      ) {
        sendJson(res, { error: 'Expected canvas content' }, { status: 400 });
        return;
      }
      const { changed } = saveCanvasContent(resolved.canvasPath, body, assetOptions);
      sendJson(res, {
        ...createPrototypeCanvasResponse(projectRoot, resolved.prototypeId, resolved.canvasPath),
        changed,
      });
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  sendJson(res, { error: 'Method not allowed' }, { status: 405 });
  return true;
}

function countCanvasAnnotations(filePath: string): { elementCount: number; annotatedCount: number } {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return { elementCount: 0, annotatedCount: 0 };
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const elements = Array.isArray(data?.elements) ? data.elements.filter((el: any) => !el.isDeleted) : [];
    const annotated = elements.filter((el: any) => el.customData?.annotation?.trim());
    return { elementCount: elements.length, annotatedCount: annotated.length };
  } catch {
    return { elementCount: 0, annotatedCount: 0 };
  }
}

function resolveCanvasFilePath(projectRoot: string, canvasName: string): string | null {
  // Try prototype canvas path first: "prototypes/<id>/canvas"
  const protoMatch = canvasName.match(/^prototypes\/(.+?)\/canvas(?:\.excalidraw)?$/u);
  if (protoMatch) {
    const canvasPath = path.resolve(projectRoot, 'src', 'prototypes', protoMatch[1], `canvas${CANVAS_EXT}`);
    return isPathInside(projectRoot, canvasPath) ? canvasPath : null;
  }
  // Try standalone canvas path: "src/canvas/<name>.excalidraw"
  const canvasDir = path.join(projectRoot, 'src/canvas');
  const fileName = canvasName.endsWith(CANVAS_EXT) ? canvasName : `${canvasName}${CANVAS_EXT}`;
  const canvasPath = path.resolve(canvasDir, fileName);
  return isPathInside(canvasDir, canvasPath) ? canvasPath : null;
}

function handleCanvasBridgeApi(
  req: IncomingMessage,
  res: ServerResponse,
  projectRoot: string,
  pathname: string,
): boolean {
  if (!pathname.startsWith('/api/canvas/bridge/')) {
    return false;
  }

  const action = pathname.slice('/api/canvas/bridge/'.length);
  const hub = getCanvasBridgeHub();

  // GET /api/canvas/bridge/status — list connected canvases
  if (action === 'status' && req.method === 'GET') {
    const connected = hub.getConnectedCanvases();
    const canvases = connected.map((c) => {
      const filePath = resolveCanvasFilePath(projectRoot, c.canvas);
      const counts = filePath ? countCanvasAnnotations(filePath) : { elementCount: 0, annotatedCount: 0 };
      return {
        canvas: c.canvas,
        filePath: filePath ? path.relative(projectRoot, filePath).split(path.sep).join('/') : null,
        absoluteFilePath: filePath,
        ...counts,
      };
    });
    sendJson(res, { canvases });
    return true;
  }

  // POST /api/canvas/bridge/refresh — tell browser to reload
  if (action === 'refresh' && req.method === 'POST') {
    readJsonBody(req).then((body) => {
      const canvas = typeof body?.canvas === 'string' ? body.canvas : undefined;
      const ok = hub.requestRefresh(canvas);
      if (!ok) {
        sendJson(res, { error: 'No canvas browser connected' }, { status: 503 });
        return;
      }
      sendJson(res, { ok: true });
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  // POST /api/canvas/bridge/screenshot — get PNG from browser
  if (action === 'screenshot' && req.method === 'POST') {
    readJsonBody(req).then(async (body) => {
      const canvas = typeof body?.canvas === 'string' ? body.canvas : undefined;
      try {
        const dataUrl = await hub.requestScreenshot(canvas);
        // Return the raw base64 data without the data URL prefix to save tokens
        const base64Match = dataUrl.match(/^data:image\/png;base64,(.+)$/i);
        if (base64Match) {
          const buffer = Buffer.from(base64Match[1], 'base64');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Cache-Control', 'no-store');
          res.end(buffer);
        } else {
          sendJson(res, { dataUrl });
        }
      } catch (error: any) {
        sendJson(res, { error: error?.message || 'Screenshot failed' }, { status: 503 });
      }
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  return false;
}

export function handleCanvasApi(
  req: IncomingMessage,
  res: ServerResponse,
  projectRoot: string,
  pathname: string,
  context: CanvasApiContext = {},
): boolean {
  if (!pathname.startsWith('/api/canvas')) {
    return false;
  }
  if (handleCanvasBridgeApi(req, res, projectRoot, pathname)) {
    return true;
  }
  if (handlePrototypeScreenshotApi(req, res, projectRoot, pathname, context)) {
    return true;
  }
  if (handlePrototypeCanvasApi(req, res, projectRoot, pathname)) {
    return true;
  }
  const canvasDir = path.join(projectRoot, 'src/canvas');
  if (pathname === '/api/canvas' || pathname === '/api/canvas/') {
    if (req.method === 'GET') {
      const items = fs.existsSync(canvasDir)
        ? fs.readdirSync(canvasDir).filter((file) => file.endsWith(CANVAS_EXT)).map((name) => ({
            name,
            displayName: name.replace(new RegExp(`${CANVAS_EXT}$`, 'u'), ''),
            absoluteFilePath: path.join(canvasDir, name),
          }))
        : [];
      sendJson(res, items);
      return true;
    }
  }
  if (pathname === '/api/canvas/create' && req.method === 'POST') {
    readJsonBody(req).then((body) => {
      fs.mkdirSync(canvasDir, { recursive: true });
      const displayName = String(body?.displayName || '').trim() || 'Untitled Canvas';
      const baseName = toKebabBaseName(displayName, 'canvas');
      const canvasPath = createUniqueFilePath(canvasDir, baseName, CANVAS_EXT);
      const name = path.basename(canvasPath);
      fs.writeFileSync(canvasPath, JSON.stringify(createDefaultCanvasData(), null, 2), 'utf8');
      sendJson(res, {
        success: true,
        name,
        displayName,
        absoluteFilePath: canvasPath,
      }, { status: 201 });
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  const canvasMatch = pathname.match(/^\/api\/canvas\/(.+?)(\/copy)?$/u);
  if (canvasMatch) {
    const canvasName = decodeURIComponent(canvasMatch[1]);
    if (!canvasName.endsWith(CANVAS_EXT)) {
      sendJson(res, { error: 'Canvas not found' }, { status: 404 });
      return true;
    }
    const sourcePath = path.resolve(canvasDir, canvasName);
    if (!isPathInside(canvasDir, sourcePath)) {
      sendJson(res, { error: 'Invalid canvas name' }, { status: 403 });
      return true;
    }
    const assetOptions = createStandaloneCanvasAssetStorageOptions(canvasDir, sourcePath);
    if (req.method === 'GET' && !canvasMatch[2]) {
      if (!sendCanvasJsonFile(res, sourcePath, assetOptions)) {
        sendJson(res, { error: 'Canvas not found' }, { status: 404 });
      }
      return true;
    }
    if (req.method === 'POST' && canvasMatch[2] === '/copy') {
      if (!fs.existsSync(sourcePath)) {
        sendJson(res, { error: 'Canvas not found' }, { status: 404 });
        return true;
      }
      const ext = CANVAS_EXT;
      const baseName = path.basename(sourcePath, ext);
      const nextPath = createUniqueFilePath(canvasDir, `${baseName}-copy`, ext);
      fs.copyFileSync(sourcePath, nextPath);
      sendJson(res, {
        success: true,
        name: path.basename(nextPath),
        displayName: path.basename(nextPath, ext),
        absoluteFilePath: nextPath,
      }, { status: 201 });
      return true;
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      readJsonBody(req).then((body) => {
        if (typeof body?.content === 'string' || typeof body?.content === 'object') {
          const { changed } = saveCanvasContent(sourcePath, body, assetOptions);
          sendJson(res, {
            success: true,
            changed,
            name: path.basename(sourcePath),
            displayName: path.basename(sourcePath, CANVAS_EXT),
            absoluteFilePath: sourcePath,
          });
          return;
        }
        if (req.method === 'POST') {
          sendJson(res, { error: 'Expected canvas content' }, { status: 400 });
          return;
        }
        const nextBaseName = toKebabBaseName(String(body?.newBaseName || ''), path.basename(sourcePath, CANVAS_EXT));
        const nextPath = createUniqueFilePath(canvasDir, nextBaseName, CANVAS_EXT);
        fs.renameSync(sourcePath, nextPath);
        sendJson(res, {
          success: true,
          name: path.basename(nextPath),
          displayName: path.basename(nextPath, CANVAS_EXT),
          absoluteFilePath: nextPath,
        });
      }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
      return true;
    }
    if (req.method === 'DELETE') {
      fs.rmSync(sourcePath, { force: true });
      sendJson(res, { success: true });
      return true;
    }
  }
  return false;
}
