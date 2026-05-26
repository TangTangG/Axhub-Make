import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { readJsonBody, sendJson } from './http.ts';
import type { ManagementApiOptions } from './managementApi.ts';
import { generateAiImages } from './aiImageGeneration.ts';
import { isPathInside, resolveProjectPath, type ProjectMetadata } from './projectCore/index.ts';

interface AiImageConfigContext {
  project: {
    root: string;
  };
  metadata: ProjectMetadata;
}

interface AiImageApiHandlers {
  getServerConfigStoreForRequest: (options: ManagementApiOptions) => {
    getConfig: (params: { activeProjectRoot: string }) => any;
  };
}

const HISTORY_FILE_NAME = 'ai-image-history.json';
const SPEC_DIR_NAME = '.spec';
const ASSET_DIR_NAME = 'ai-image-assets';
const GENERATION_ASSET_DIR_NAME = 'generation-assets';
const REFERENCE_ASSET_DIR_NAME = 'refs';
const REFERENCE_ASSET_PATH_PREFIX = `${GENERATION_ASSET_DIR_NAME}/${REFERENCE_ASSET_DIR_NAME}`;
const HISTORY_LIMIT = 30;

export type AiImageHistoryResolveResult =
  | {
      ok: true;
      prototypeId: string;
      prototypeDir: string;
      specDir: string;
      historyPath: string;
      assetDir: string;
      referenceAssetDir: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export function normalizeAiImageHistoryTargetPath(rawValue: string | null): { ok: true; id: string } | { ok: false; status: number; error: string } {
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
  return { ok: true, id: prototypeId };
}

function getDeclaredPrototypeWriteDir(projectRoot: string, metadata: ProjectMetadata): string | null {
  const target = metadata.resourceWriteTargets?.prototypes;
  if (!target || target.type !== 'project-relative-path' || !target.path) {
    return null;
  }
  try {
    return resolveProjectPath(projectRoot, target.path);
  } catch {
    return null;
  }
}

export function resolveAiImageHistoryPath(
  projectRoot: string,
  metadata: ProjectMetadata,
  rawTargetPath: string | null,
): AiImageHistoryResolveResult {
  const normalized = normalizeAiImageHistoryTargetPath(rawTargetPath);
  if (normalized.ok === false) {
    return { ok: false, status: normalized.status, error: normalized.error };
  }

  const prototypesDir = getDeclaredPrototypeWriteDir(projectRoot, metadata);
  if (!prototypesDir) {
    return { ok: false, status: 424, error: 'AI image history persistence requires declared prototype write target' };
  }
  const defaultPrototypesDir = path.join(projectRoot, 'src', 'prototypes');
  if (path.resolve(prototypesDir) !== path.resolve(defaultPrototypesDir)) {
    return { ok: false, status: 403, error: 'AI image history persistence is limited to src/prototypes' };
  }

  const prototypeDir = path.resolve(prototypesDir, normalized.id);
  const specDir = path.join(prototypeDir, SPEC_DIR_NAME);
  const historyPath = path.join(specDir, HISTORY_FILE_NAME);
  const assetDir = path.join(specDir, ASSET_DIR_NAME);
  const referenceAssetDir = path.join(specDir, GENERATION_ASSET_DIR_NAME, REFERENCE_ASSET_DIR_NAME);
  if (
    !isPathInside(projectRoot, prototypeDir)
    || !isPathInside(prototypesDir, prototypeDir)
    || !isPathInside(prototypeDir, specDir)
    || !isPathInside(specDir, historyPath)
    || !isPathInside(specDir, assetDir)
    || !isPathInside(specDir, referenceAssetDir)
  ) {
    return { ok: false, status: 403, error: 'Invalid targetPath' };
  }

  return {
    ok: true,
    prototypeId: normalized.id,
    prototypeDir,
    specDir,
    historyPath,
    assetDir,
    referenceAssetDir,
  };
}

function hasPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function normalizeLocalContextPath(value: unknown): string {
  const normalized = typeof value === 'string'
    ? value.trim().replace(/\\/g, '/').replace(/^\/+/u, '')
    : '';
  if (!normalized || normalized.includes('..') || normalized.includes('\0') || normalized.startsWith('/')) {
    return '';
  }
  if (!/^src\/(?:prototypes|themes)\/[^/]+\/(?:DESIGN\.md|index\.tsx?)$/u.test(normalized)) {
    return '';
  }
  return normalized;
}

function normalizeLocalContextRefs(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const refs: Record<string, unknown>[] = [];
  for (const rawRef of value) {
    if (!hasPlainObject(rawRef)) continue;
    const resourceType = rawRef.resourceType === 'prototype' || rawRef.resourceType === 'theme'
      ? rawRef.resourceType
      : null;
    const resourceId = safeText(rawRef.resourceId).trim();
    const paths = normalizeStringArray(rawRef.paths).map(normalizeLocalContextPath).filter(Boolean);
    if (!resourceType || !resourceId || !paths.length) continue;
    const title = safeText(rawRef.title).trim();
    const description = safeText(rawRef.description).trim();
    refs.push({
      resourceType,
      resourceId,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      paths: Array.from(new Set(paths)),
    });
  }
  return refs;
}

function normalizeReferenceAssetRefs(
  input: unknown,
  resolved: Extract<AiImageHistoryResolveResult, { ok: true }>,
): Record<string, unknown>[] {
  const rawRefs = Array.isArray(input) ? input : [];
  const refs: Record<string, unknown>[] = [];
  for (const rawRef of rawRefs) {
    const ref = normalizeReferenceAssetRef(rawRef, resolved);
    if (ref) {
      refs.push(ref);
    }
  }
  return refs;
}

export function persistAiImageReferenceAssets(
  input: unknown,
  resolved: Extract<AiImageHistoryResolveResult, { ok: true }>,
): Record<string, unknown>[] {
  return normalizeReferenceAssetRefs(input, resolved);
}

function normalizeTask(rawTask: unknown, resolved: Extract<AiImageHistoryResolveResult, { ok: true }>): Record<string, unknown> | null {
  if (!rawTask || typeof rawTask !== 'object' || Array.isArray(rawTask)) return null;
  const source = rawTask as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  if (!id) return null;
  const params = source.params && typeof source.params === 'object' && !Array.isArray(source.params)
    ? source.params
    : {};
  const referenceAssetRefs = normalizeReferenceAssetRefs([
    ...(Array.isArray(source.referenceAssetRefs) ? source.referenceAssetRefs : []),
    ...(Array.isArray(source.referenceImages) ? source.referenceImages : []),
  ], resolved);
  return {
    id,
    prompt: typeof source.prompt === 'string' ? source.prompt : '',
    params,
    status: typeof source.status === 'string' ? source.status : 'done',
    stage: typeof source.stage === 'string' ? source.stage : source.status === 'error' ? 'error' : 'done',
    error: typeof source.error === 'string' ? source.error : null,
    createdAt: Number.isFinite(Number(source.createdAt)) ? Number(source.createdAt) : Date.now(),
    finishedAt: Number.isFinite(Number(source.finishedAt)) ? Number(source.finishedAt) : null,
    elapsed: Number.isFinite(Number(source.elapsed)) ? Number(source.elapsed) : null,
    outputImages: Array.isArray(source.outputImages)
      ? source.outputImages.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
    ...(typeof source.conversationId === 'string' && source.conversationId.trim()
      ? { conversationId: source.conversationId.trim() }
      : {}),
    ...(typeof source.roundId === 'string' && source.roundId.trim()
      ? { roundId: source.roundId.trim() }
      : {}),
    ...(typeof source.sourcePrompt === 'string' && source.sourcePrompt.trim()
      ? { sourcePrompt: source.sourcePrompt.trim() }
      : {}),
    ...(normalizeLocalContextRefs(source.localContextRefs).length
      ? { localContextRefs: normalizeLocalContextRefs(source.localContextRefs) }
      : {}),
    ...(source.interrupted === true ? { interrupted: true } : {}),
    ...(referenceAssetRefs.length ? { referenceAssetRefs } : {}),
    ...(source.actualParams && typeof source.actualParams === 'object' && !Array.isArray(source.actualParams)
      ? { actualParams: source.actualParams }
      : {}),
    ...(source.actualParamsByImage && typeof source.actualParamsByImage === 'object' && !Array.isArray(source.actualParamsByImage)
      ? { actualParamsByImage: source.actualParamsByImage }
      : {}),
    ...(source.revisedPromptByImage && typeof source.revisedPromptByImage === 'object' && !Array.isArray(source.revisedPromptByImage)
      ? { revisedPromptByImage: source.revisedPromptByImage }
      : {}),
    ...(Array.isArray(source.rawImageUrls)
      ? { rawImageUrls: source.rawImageUrls.filter((item): item is string => typeof item === 'string') }
      : {}),
  };
}

function normalizePrototypeTask(
  rawTask: unknown,
  resolved: Extract<AiImageHistoryResolveResult, { ok: true }>,
): Record<string, unknown> | null {
  if (!rawTask || typeof rawTask !== 'object' || Array.isArray(rawTask)) return null;
  const source = rawTask as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  if (!id) return null;
  const referenceAssetRefs = normalizeReferenceAssetRefs([
    ...(Array.isArray(source.referenceAssetRefs) ? source.referenceAssetRefs : []),
    ...(Array.isArray(source.referenceImages) ? source.referenceImages : []),
  ], resolved);
  return {
    id,
    prompt: typeof source.prompt === 'string' ? source.prompt : '',
    status: typeof source.status === 'string' ? source.status : 'done',
    stage: typeof source.stage === 'string' ? source.stage : source.status === 'error' ? 'error' : 'done',
    error: typeof source.error === 'string' ? source.error : null,
    createdAt: Number.isFinite(Number(source.createdAt)) ? Number(source.createdAt) : Date.now(),
    finishedAt: Number.isFinite(Number(source.finishedAt)) ? Number(source.finishedAt) : null,
    elapsed: Number.isFinite(Number(source.elapsed)) ? Number(source.elapsed) : null,
    provider: typeof source.provider === 'string' ? source.provider : 'codex',
    ...(typeof source.outputPrototypeName === 'string' ? { outputPrototypeName: source.outputPrototypeName } : {}),
    ...(typeof source.sessionId === 'string' ? { sessionId: source.sessionId } : {}),
    ...(typeof source.acpxSessionName === 'string' ? { acpxSessionName: source.acpxSessionName } : {}),
    ...(typeof source.runId === 'string' ? { runId: source.runId } : {}),
    ...(source.recoverable === true ? { recoverable: true } : {}),
    ...(typeof source.note === 'string' ? { note: source.note } : {}),
    ...(referenceAssetRefs.length ? { referenceAssetRefs } : {}),
  };
}

type GenerationHistoryRecord = Record<string, unknown> & { kind: 'image' | 'prototype' };

function sortGenerationRecords(input: {
  tasks: Record<string, unknown>[];
  prototypeTasks: Record<string, unknown>[];
}): GenerationHistoryRecord[] {
  return [
    ...input.tasks.map((task) => ({ ...task, kind: 'image' as const })),
    ...input.prototypeTasks.map((task) => ({ ...task, kind: 'prototype' as const })),
  ].sort((a, b) => Number(b['createdAt'] || 0) - Number(a['createdAt'] || 0));
}

function limitGenerationHistory(input: {
  tasks: Record<string, unknown>[];
  prototypeTasks: Record<string, unknown>[];
}) {
  const records = sortGenerationRecords(input).slice(0, HISTORY_LIMIT);
  const taskIds = new Set(records.filter((record) => record.kind === 'image').map((record) => String(record.id || '')));
  const prototypeTaskIds = new Set(records.filter((record) => record.kind === 'prototype').map((record) => String(record.id || '')));
  return {
    tasks: input.tasks.filter((task) => taskIds.has(String(task.id))),
    prototypeTasks: input.prototypeTasks.filter((task) => prototypeTaskIds.has(String(task.id))),
  };
}

function parseImageDataUrl(dataUrl: unknown): { mimeType: string; buffer: Buffer; base64: string } | null {
  const raw = String(dataUrl ?? '').trim();
  const match = raw.match(/^data:(image\/[a-z0-9+.-]+);base64,([a-z0-9+/=\s]+)$/iu);
  if (!match) return null;
  const base64 = match[2].replace(/\s+/gu, '');
  return {
    mimeType: match[1].toLowerCase(),
    buffer: Buffer.from(base64, 'base64'),
    base64,
  };
}

function isImageDataUrl(value: unknown): boolean {
  return typeof value === 'string' && /^data:image\/[a-z0-9+.-]+;base64,/iu.test(value.trim());
}

function inferImageExtension(mimeType: string): string {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/gif') return 'gif';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/svg+xml') return 'svg';
  return 'png';
}

function sanitizeImageId(value: string): string {
  return value
    .replace(/[^a-z0-9_-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase() || `image-${Date.now()}`;
}

function normalizeReferenceAssetRef(
  rawRef: unknown,
  resolved: Extract<AiImageHistoryResolveResult, { ok: true }>,
): Record<string, unknown> | null {
  const source: Record<string, unknown> = hasPlainObject(rawRef) ? rawRef : {};
  const parsed = parseImageDataUrl(
    hasPlainObject(rawRef)
      ? source.dataUrl || source.dataURL || source.data
      : rawRef,
  );
  let assetPath = typeof source.assetPath === 'string' ? source.assetPath.trim().replace(/\\/g, '/') : '';
  let mimeType = typeof source.mimeType === 'string' ? source.mimeType : '';
  let hash = typeof source.hash === 'string' ? source.hash.trim() : '';
  let id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : '';

  if (parsed) {
    mimeType = mimeType || parsed.mimeType;
    hash = crypto.createHash('sha256').update(parsed.buffer).digest('hex');
    id = id || `ref-${hash.slice(0, 12)}`;
    const fileName = `${sanitizeImageId(id)}-${hash.slice(0, 12)}.${inferImageExtension(mimeType)}`;
    const assetFilePath = path.join(resolved.referenceAssetDir, fileName);
    if (!isPathInside(resolved.referenceAssetDir, assetFilePath)) {
      throw new Error('Invalid reference image asset path');
    }
    fs.mkdirSync(resolved.referenceAssetDir, { recursive: true });
    fs.writeFileSync(assetFilePath, parsed.buffer);
    assetPath = `${REFERENCE_ASSET_PATH_PREFIX}/${fileName}`;
  }

  if (
    !assetPath
    || assetPath.includes('..')
    || assetPath.startsWith('/')
    || assetPath.includes('\0')
    || !assetPath.startsWith(`${REFERENCE_ASSET_PATH_PREFIX}/`)
  ) {
    return null;
  }
  const assetFilePath = path.resolve(resolved.specDir, assetPath);
  if (!isPathInside(resolved.referenceAssetDir, assetFilePath)) {
    return null;
  }

  id = id || sanitizeImageId(path.basename(assetPath, path.extname(assetPath)));
  return {
    id,
    assetPath,
    hash: hash || undefined,
    mimeType: mimeType || 'image/png',
    width: Number.isFinite(Number(source.width)) ? Number(source.width) : undefined,
    height: Number.isFinite(Number(source.height)) ? Number(source.height) : undefined,
    createdAt: Number.isFinite(Number(source.createdAt)) ? Number(source.createdAt) : Date.now(),
  };
}

function normalizeStoredImage(
  imageId: string,
  rawImage: unknown,
  resolved: Extract<AiImageHistoryResolveResult, { ok: true }>,
): Record<string, unknown> | null {
  if (!rawImage || typeof rawImage !== 'object' || Array.isArray(rawImage)) return null;
  const source = rawImage as Record<string, unknown>;
  const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : imageId;
  const fileBaseName = sanitizeImageId(id);
  const parsed = parseImageDataUrl(source.dataUrl || source.dataURL || source.data);
  let assetPath = typeof source.assetPath === 'string' ? source.assetPath.trim().replace(/\\/g, '/') : '';
  let mimeType = typeof source.mimeType === 'string' ? source.mimeType : '';

  if (parsed) {
    mimeType = mimeType || parsed.mimeType;
    const fileName = `${fileBaseName}.${inferImageExtension(mimeType)}`;
    const assetFilePath = path.join(resolved.assetDir, fileName);
    if (!isPathInside(resolved.assetDir, assetFilePath)) {
      throw new Error('Invalid AI image asset path');
    }
    fs.mkdirSync(resolved.assetDir, { recursive: true });
    fs.writeFileSync(assetFilePath, parsed.buffer);
    assetPath = `${ASSET_DIR_NAME}/${fileName}`;
  }

  if (!assetPath || assetPath.includes('..') || assetPath.startsWith('/') || assetPath.includes('\0')) {
    return null;
  }
  const assetFilePath = path.resolve(resolved.specDir, assetPath);
  if (!isPathInside(resolved.assetDir, assetFilePath)) {
    return null;
  }

  return {
    id,
    assetPath,
    mimeType: mimeType || 'image/png',
    width: Number.isFinite(Number(source.width)) ? Number(source.width) : undefined,
    height: Number.isFinite(Number(source.height)) ? Number(source.height) : undefined,
    createdAt: Number.isFinite(Number(source.createdAt)) ? Number(source.createdAt) : Date.now(),
    source: 'generated',
  };
}

function safeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return isImageDataUrl(value) ? '' : value;
}

function normalizeConversationRound(
  rawRound: unknown,
  resolved: Extract<AiImageHistoryResolveResult, { ok: true }>,
): Record<string, unknown> | null {
  if (!hasPlainObject(rawRound)) return null;
  const id = safeText(rawRound.id).trim();
  if (!id) return null;
  const referenceAssetRefs = normalizeReferenceAssetRefs([
    ...(Array.isArray(rawRound.referenceAssetRefs) ? rawRound.referenceAssetRefs : []),
    ...(Array.isArray(rawRound.referenceImages) ? rawRound.referenceImages : []),
  ], resolved);
  return {
    id,
    ...(safeText(rawRound.prompt) ? { prompt: safeText(rawRound.prompt) } : {}),
    ...(safeText(rawRound.status) ? { status: safeText(rawRound.status) } : {}),
    ...(safeText(rawRound.taskId) ? { taskId: safeText(rawRound.taskId) } : {}),
    ...(normalizeStringArray(rawRound.outputTaskIds).length ? { outputTaskIds: normalizeStringArray(rawRound.outputTaskIds) } : {}),
    ...(normalizeStringArray(rawRound.outputImageIds).length ? { outputImageIds: normalizeStringArray(rawRound.outputImageIds) } : {}),
    ...(referenceAssetRefs.length ? { referenceAssetRefs } : {}),
    ...(safeText(rawRound.sourcePrompt) ? { sourcePrompt: safeText(rawRound.sourcePrompt) } : {}),
    ...(normalizeLocalContextRefs(rawRound.localContextRefs).length ? { localContextRefs: normalizeLocalContextRefs(rawRound.localContextRefs) } : {}),
    ...(Number.isFinite(Number(rawRound.createdAt)) ? { createdAt: Number(rawRound.createdAt) } : {}),
    ...(Number.isFinite(Number(rawRound.updatedAt)) ? { updatedAt: Number(rawRound.updatedAt) } : {}),
    ...(Number.isFinite(Number(rawRound.finishedAt)) ? { finishedAt: Number(rawRound.finishedAt) } : {}),
  };
}

function normalizeConversationMessage(
  rawMessage: unknown,
  resolved: Extract<AiImageHistoryResolveResult, { ok: true }>,
): Record<string, unknown> | null {
  if (!hasPlainObject(rawMessage)) return null;
  const id = safeText(rawMessage.id).trim();
  if (!id) return null;
  const referenceAssetRefs = normalizeReferenceAssetRefs([
    ...(Array.isArray(rawMessage.referenceAssetRefs) ? rawMessage.referenceAssetRefs : []),
    ...(Array.isArray(rawMessage.referenceImages) ? rawMessage.referenceImages : []),
  ], resolved);
  return {
    id,
    role: safeText(rawMessage.role) || 'user',
    content: safeText(rawMessage.content),
    ...(safeText(rawMessage.roundId) ? { roundId: safeText(rawMessage.roundId) } : {}),
    ...(safeText(rawMessage.taskId) ? { taskId: safeText(rawMessage.taskId) } : {}),
    ...(normalizeStringArray(rawMessage.outputTaskIds).length ? { outputTaskIds: normalizeStringArray(rawMessage.outputTaskIds) } : {}),
    ...(normalizeStringArray(rawMessage.outputImageIds).length ? { outputImageIds: normalizeStringArray(rawMessage.outputImageIds) } : {}),
    ...(referenceAssetRefs.length ? { referenceAssetRefs } : {}),
    ...(safeText(rawMessage.sourcePrompt) ? { sourcePrompt: safeText(rawMessage.sourcePrompt) } : {}),
    ...(normalizeLocalContextRefs(rawMessage.localContextRefs).length ? { localContextRefs: normalizeLocalContextRefs(rawMessage.localContextRefs) } : {}),
    ...(Number.isFinite(Number(rawMessage.createdAt)) ? { createdAt: Number(rawMessage.createdAt) } : {}),
    ...(Number.isFinite(Number(rawMessage.updatedAt)) ? { updatedAt: Number(rawMessage.updatedAt) } : {}),
  };
}

function normalizeImageConversation(
  rawConversation: unknown,
  resolved: Extract<AiImageHistoryResolveResult, { ok: true }>,
): Record<string, unknown> | null {
  if (!hasPlainObject(rawConversation)) return null;
  const id = safeText(rawConversation.id).trim();
  if (!id) return null;
  return {
    id,
    ...(safeText(rawConversation.title) ? { title: safeText(rawConversation.title) } : {}),
    ...(safeText(rawConversation.status) ? { status: safeText(rawConversation.status) } : {}),
    rounds: Array.isArray(rawConversation.rounds)
      ? rawConversation.rounds
        .map((round) => normalizeConversationRound(round, resolved))
        .filter((round): round is Record<string, unknown> => Boolean(round))
      : [],
    messages: Array.isArray(rawConversation.messages)
      ? rawConversation.messages
        .map((message) => normalizeConversationMessage(message, resolved))
        .filter((message): message is Record<string, unknown> => Boolean(message))
      : [],
    ...(Number.isFinite(Number(rawConversation.createdAt)) ? { createdAt: Number(rawConversation.createdAt) } : {}),
    ...(Number.isFinite(Number(rawConversation.updatedAt)) ? { updatedAt: Number(rawConversation.updatedAt) } : {}),
  };
}

function normalizePrototypeSessionLastRun(rawLastRun: unknown): Record<string, unknown> | null {
  if (!hasPlainObject(rawLastRun)) return null;
  const runId = safeText(rawLastRun.runId).trim();
  if (!runId) return null;
  return {
    runId,
    ...(safeText(rawLastRun.status) ? { status: safeText(rawLastRun.status) } : {}),
    ...(safeText(rawLastRun.stage) ? { stage: safeText(rawLastRun.stage) } : {}),
    ...(safeText(rawLastRun.prompt) ? { prompt: safeText(rawLastRun.prompt) } : {}),
    ...(safeText(rawLastRun.error) ? { error: safeText(rawLastRun.error) } : {}),
    ...(Number.isFinite(Number(rawLastRun.createdAt)) ? { createdAt: Number(rawLastRun.createdAt) } : {}),
    ...(Number.isFinite(Number(rawLastRun.finishedAt)) ? { finishedAt: Number(rawLastRun.finishedAt) } : {}),
    ...(Number.isFinite(Number(rawLastRun.elapsed)) ? { elapsed: Number(rawLastRun.elapsed) } : {}),
  };
}

function normalizePrototypeSession(rawSession: unknown): Record<string, unknown> | null {
  if (!hasPlainObject(rawSession)) return null;
  const prototypeId = safeText(rawSession.prototypeId).trim();
  const generatorElementId = safeText(rawSession.generatorElementId).trim();
  const acpxSessionName = safeText(rawSession.acpxSessionName).trim();
  if (!prototypeId || !generatorElementId || !acpxSessionName) return null;
  const lastRun = normalizePrototypeSessionLastRun(rawSession.lastRun);
  return {
    prototypeId,
    generatorElementId,
    acpxSessionName,
    ...(lastRun ? { lastRun } : {}),
    ...(Number.isFinite(Number(rawSession.createdAt)) ? { createdAt: Number(rawSession.createdAt) } : {}),
    ...(Number.isFinite(Number(rawSession.updatedAt)) ? { updatedAt: Number(rawSession.updatedAt) } : {}),
  };
}

type NormalizedHistoryDocument = {
  tasks: Record<string, unknown>[];
  prototypeTasks: Record<string, unknown>[];
  images: Record<string, Record<string, unknown>>;
  imageConversations: Record<string, unknown>[];
  prototypeSessions: Record<string, unknown>[];
};

function normalizeHistoryDocument(
  input: unknown,
  resolved: Extract<AiImageHistoryResolveResult, { ok: true }>,
): NormalizedHistoryDocument {
  const record = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const rawTasks = Array.isArray(record.tasks) ? record.tasks : [];
  const rawPrototypeTasks = Array.isArray(record.prototypeTasks) ? record.prototypeTasks : [];
  const limited = limitGenerationHistory({
    tasks: rawTasks.map((task) => normalizeTask(task, resolved)).filter((task): task is Record<string, unknown> => Boolean(task)),
    prototypeTasks: rawPrototypeTasks
      .map((task) => normalizePrototypeTask(task, resolved))
      .filter((task): task is Record<string, unknown> => Boolean(task)),
  });
  const tasks = limited.tasks;
  const prototypeTasks = limited.prototypeTasks;
  const keptImageIds = new Set(tasks.flatMap((task) => Array.isArray(task.outputImages) ? task.outputImages as string[] : []));
  const rawImages = record.images && typeof record.images === 'object' && !Array.isArray(record.images)
    ? record.images as Record<string, unknown>
    : {};
  const images: Record<string, Record<string, unknown>> = {};
  for (const imageId of keptImageIds) {
    const image = normalizeStoredImage(imageId, rawImages[imageId], resolved);
    if (image) {
      images[String(image.id)] = image;
    }
  }
  return {
    tasks,
    prototypeTasks,
    images,
    imageConversations: Array.isArray(record.imageConversations)
      ? record.imageConversations
        .map((conversation) => normalizeImageConversation(conversation, resolved))
        .filter((conversation): conversation is Record<string, unknown> => Boolean(conversation))
      : [],
    prototypeSessions: Array.isArray(record.prototypeSessions)
      ? record.prototypeSessions
        .map(normalizePrototypeSession)
        .filter((session): session is Record<string, unknown> => Boolean(session))
      : [],
  };
}

export function readAiImageHistoryFile(resolved: Extract<AiImageHistoryResolveResult, { ok: true }>) {
  if (!fs.existsSync(resolved.historyPath)) {
    return {
      tasks: [],
      prototypeTasks: [],
      images: {} as Record<string, Record<string, unknown>>,
      imageConversations: [],
      prototypeSessions: [],
    };
  }
  try {
    return normalizeHistoryDocument(JSON.parse(fs.readFileSync(resolved.historyPath, 'utf8')), resolved);
  } catch {
    return {
      tasks: [],
      prototypeTasks: [],
      images: {} as Record<string, Record<string, unknown>>,
      imageConversations: [],
      prototypeSessions: [],
    };
  }
}

function imageToClient(
  image: Record<string, unknown>,
  resolved: Extract<AiImageHistoryResolveResult, { ok: true }>,
): Record<string, unknown> {
  const assetPath = String(image.assetPath || '');
  const assetFilePath = path.resolve(resolved.specDir, assetPath);
  const mimeType = String(image.mimeType || 'image/png');
  const dataUrl = isPathInside(resolved.assetDir, assetFilePath) && fs.existsSync(assetFilePath)
    ? `data:${mimeType};base64,${fs.readFileSync(assetFilePath).toString('base64')}`
    : '';
  return {
    ...image,
    dataUrl,
  };
}

export function aiImageHistoryToClient(
  document: NormalizedHistoryDocument,
  resolved: Extract<AiImageHistoryResolveResult, { ok: true }>,
) {
  const records = sortGenerationRecords({
    tasks: document.tasks,
    prototypeTasks: document.prototypeTasks,
  });
  return {
    schemaVersion: 2,
    kind: 'generation-history',
    targetPath: `prototypes/${resolved.prototypeId}`,
    limit: HISTORY_LIMIT,
    tasks: document.tasks,
    prototypeTasks: document.prototypeTasks,
    imageConversations: document.imageConversations,
    prototypeSessions: document.prototypeSessions,
    records,
    images: Object.fromEntries(Object.entries(document.images).map(([id, image]) => [id, imageToClient(image, resolved)])),
  };
}

function collectReferenceAssetPaths(value: unknown, output: Set<string>): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectReferenceAssetPaths(item, output));
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.assetPath === 'string' && record.assetPath.startsWith(`${REFERENCE_ASSET_PATH_PREFIX}/`)) {
    output.add(record.assetPath);
  }
  Object.values(record).forEach((item) => collectReferenceAssetPaths(item, output));
}

function cleanupUnusedAssets(
  document: NormalizedHistoryDocument,
  resolved: Extract<AiImageHistoryResolveResult, { ok: true }>,
) {
  if (fs.existsSync(resolved.assetDir)) {
    const keep = new Set(Object.values(document.images).map((image) => String(image.assetPath || '')));
    for (const entry of fs.readdirSync(resolved.assetDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const relative = `${ASSET_DIR_NAME}/${entry.name}`;
      if (keep.has(relative)) continue;
      fs.rmSync(path.join(resolved.assetDir, entry.name), { force: true });
    }
  }

  if (!fs.existsSync(resolved.referenceAssetDir)) return;
  const keepReferenceAssets = new Set<string>();
  collectReferenceAssetPaths(document.tasks, keepReferenceAssets);
  collectReferenceAssetPaths(document.prototypeTasks, keepReferenceAssets);
  collectReferenceAssetPaths(document.imageConversations, keepReferenceAssets);
  for (const entry of fs.readdirSync(resolved.referenceAssetDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const relative = `${REFERENCE_ASSET_PATH_PREFIX}/${entry.name}`;
    if (keepReferenceAssets.has(relative)) continue;
    fs.rmSync(path.join(resolved.referenceAssetDir, entry.name), { force: true });
  }
}

export function persistAiImageHistory(
  input: unknown,
  resolved: Extract<AiImageHistoryResolveResult, { ok: true }>,
) {
  const document = normalizeHistoryDocument(input, resolved);
  fs.mkdirSync(resolved.specDir, { recursive: true });
  cleanupUnusedAssets(document, resolved);
  fs.writeFileSync(resolved.historyPath, `${JSON.stringify({
    schemaVersion: 2,
    kind: 'generation-history',
    targetPath: `prototypes/${resolved.prototypeId}`,
    limit: HISTORY_LIMIT,
    tasks: document.tasks,
    prototypeTasks: document.prototypeTasks,
    imageConversations: document.imageConversations,
    prototypeSessions: document.prototypeSessions,
    records: sortGenerationRecords({
      tasks: document.tasks,
      prototypeTasks: document.prototypeTasks,
    }),
    images: document.images,
  }, null, 2)}\n`, 'utf8');
  return document;
}

function handleAiImageHistoryApi(
  req: IncomingMessage,
  res: ServerResponse,
  context: AiImageConfigContext,
  pathname: string,
): boolean {
  if (pathname !== '/api/ai-image/history') {
    return false;
  }
  const url = new URL(req.url || pathname, 'http://localhost');
  const resolved = resolveAiImageHistoryPath(context.project.root, context.metadata, url.searchParams.get('targetPath'));
  if (resolved.ok === false) {
    sendJson(res, { error: resolved.error }, { status: resolved.status });
    return true;
  }

  if (req.method === 'GET') {
    sendJson(res, aiImageHistoryToClient(readAiImageHistoryFile(resolved), resolved));
    return true;
  }

  if (req.method === 'PUT') {
    readJsonBody(req)
      .then((body) => {
        const patch = body && typeof body === 'object' && !Array.isArray(body)
          ? body as Record<string, unknown>
          : {};
        const existing = readAiImageHistoryFile(resolved);
        const document = persistAiImageHistory({
          ...existing,
          ...patch,
          tasks: Object.prototype.hasOwnProperty.call(patch, 'tasks') ? patch.tasks : existing.tasks,
          prototypeTasks: Object.prototype.hasOwnProperty.call(patch, 'prototypeTasks') ? patch.prototypeTasks : existing.prototypeTasks,
          images: Object.prototype.hasOwnProperty.call(patch, 'images') ? patch.images : existing.images,
          imageConversations: Object.prototype.hasOwnProperty.call(patch, 'imageConversations')
            ? patch.imageConversations
            : existing.imageConversations,
          prototypeSessions: Object.prototype.hasOwnProperty.call(patch, 'prototypeSessions')
            ? patch.prototypeSessions
            : existing.prototypeSessions,
        }, resolved);
        sendJson(res, aiImageHistoryToClient(document, resolved));
      })
      .catch((error) => sendJson(res, { error: error?.message || 'Failed to write AI image history' }, { status: 400 }));
    return true;
  }

  sendJson(res, { error: 'Method not allowed' }, { status: 405 });
  return true;
}

export function handleAiImageApi(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  pathname: string,
  context: AiImageConfigContext,
  handlers: AiImageApiHandlers,
): boolean {
  if (handleAiImageHistoryApi(req, res, context, pathname)) {
    return true;
  }

  if (pathname !== '/api/ai-image/generate') {
    return false;
  }
  if (req.method !== 'POST') {
    sendJson(res, { error: 'Method not allowed' }, { status: 405 });
    return true;
  }

  readJsonBody(req).then(async (body) => {
    const request = body && typeof body === 'object' ? body as Record<string, any> : {};
    const serverConfig = handlers
      .getServerConfigStoreForRequest(options)
      .getConfig({ activeProjectRoot: context.project.root });
    try {
      const result = await generateAiImages({
        config: serverConfig.ai.imageGeneration,
        prompt: typeof request.prompt === 'string' ? request.prompt : '',
        params: request.params && typeof request.params === 'object' ? request.params : {},
        referenceImages: Array.isArray(request.referenceImages) ? request.referenceImages : [],
      });
      sendJson(res, result);
    } catch (error: any) {
      const status = /API Key|提示词/u.test(error?.message || '') ? 400 : 502;
      sendJson(res, {
        error: error?.message || '图片生成失败',
        ...(Array.isArray(error?.rawImageUrls) ? { rawImageUrls: error.rawImageUrls } : {}),
        ...(typeof error?.rawResponsePayload === 'string' ? { rawResponsePayload: error.rawResponsePayload } : {}),
      }, { status });
    }
  }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));

  return true;
}
