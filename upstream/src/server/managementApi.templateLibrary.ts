import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  isPathInside,
  readServerInfo,
  type ProjectMetadata,
  type RegisteredProject,
} from './projectCore/index.ts';

import { readJsonBody, sendJson } from './http.ts';
import { runLocalCommand } from './localCommand.ts';
import type { ManagementApiOptions } from './managementApi.ts';

const TEMPLATE_LIBRARY_REPO = 'lintendo/Make-Template';
const TEMPLATE_LIBRARY_INDEX_PATH = 'templates.json';
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;

interface TemplateLibraryProjectContext {
  project: RegisteredProject;
  metadata: ProjectMetadata;
  metadataStore: {
    getMetadata: () => ProjectMetadata;
    saveMetadata: (metadata: ProjectMetadata) => ProjectMetadata;
  };
}

interface TemplateLibraryHandlers {
  createProjectContextFromBody: (
    req: IncomingMessage,
    res: ServerResponse,
    options: ManagementApiOptions,
    body: unknown,
  ) => TemplateLibraryProjectContext | null;
  getDeclaredResourceWriteDir: (
    context: TemplateLibraryProjectContext,
    type: 'prototypes',
  ) => string | null;
  hasResourceWriteCapability: (
    context: TemplateLibraryProjectContext,
    capability: keyof ProjectMetadata['capabilities']['resourceWrites'],
  ) => boolean;
  sendDisabledCapability: (
    res: ServerResponse,
    status: number,
    payload: {
      code: string;
      error: string;
      projectId?: string;
      projectRoot?: string;
      adapterRequired?: boolean;
      details?: Record<string, unknown>;
    },
  ) => void;
}

export interface TemplateLibraryIndexItem {
  id: string;
  title: string;
  slug: string;
  sourcePath: string;
  coverPath: string;
  description: string;
  author?: string;
  authorUrl?: string;
  previewUrl?: string;
  extraDependencies: string[];
}

interface LoadedTemplateLibrary {
  branch: string;
  templates: TemplateLibraryIndexItem[];
}

function sendTemplateLibraryError(
  res: ServerResponse,
  status: number,
  code: string,
  error: string,
  details?: Record<string, unknown>,
): void {
  sendJson(res, {
    ok: false,
    code,
    error,
    ...(details ? { details } : {}),
  }, { status });
}

function assertRelativeTemplatePath(value: unknown, fieldName: string): string {
  const raw = typeof value === 'string' ? value.trim().replace(/\\/g, '/') : '';
  const parts = raw.split('/').filter(Boolean);
  if (
    !raw
    || raw.startsWith('/')
    || path.isAbsolute(raw)
    || parts.some((part) => part === '..' || part === '.')
  ) {
    throw new Error(`Invalid ${fieldName}: ${String(value || '')}`);
  }
  return parts.join('/');
}

function assertTemplateId(value: unknown, fieldName: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_ID_PATTERN.test(raw)) {
    throw new Error(`Invalid ${fieldName}: ${String(value || '')}`);
  }
  return raw;
}

function assertString(value: unknown, fieldName: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return raw;
}

function assertOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return raw;
}

function assertOptionalHttpUrl(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    throw new Error(`Invalid ${fieldName}`);
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid ${fieldName}: ${String(value || '')}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Invalid ${fieldName}: ${raw}`);
  }
  return raw;
}

function validateTemplateIndex(raw: unknown): TemplateLibraryIndexItem[] {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Template index must be an object');
  }
  const record = raw as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    throw new Error('Template index schemaVersion must be 1');
  }
  if (!Array.isArray(record.templates)) {
    throw new Error('Template index templates must be an array');
  }
  const ids = new Set<string>();
  const slugs = new Set<string>();
  return record.templates.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid template at index ${index}`);
    }
    const template = item as Record<string, unknown>;
    const id = assertTemplateId(template.id, `templates[${index}].id`);
    const slug = assertTemplateId(template.slug, `templates[${index}].slug`);
    const sourcePath = assertRelativeTemplatePath(template.sourcePath, `templates[${index}].sourcePath`);
    const coverPath = assertRelativeTemplatePath(template.coverPath, `templates[${index}].coverPath`);
    if (!sourcePath.startsWith('templates/')) {
      throw new Error(`Invalid templates[${index}].sourcePath: ${sourcePath}`);
    }
    if (!coverPath.startsWith('covers/')) {
      throw new Error(`Invalid templates[${index}].coverPath: ${coverPath}`);
    }
    if (ids.has(id)) {
      throw new Error(`Duplicate template id: ${id}`);
    }
    if (slugs.has(slug)) {
      throw new Error(`Duplicate template slug: ${slug}`);
    }
    ids.add(id);
    slugs.add(slug);
    const extraDependencies = template.extraDependencies === undefined ? [] : template.extraDependencies;
    if (!Array.isArray(extraDependencies) || extraDependencies.some((dependency) => typeof dependency !== 'string' || !dependency.trim())) {
      throw new Error(`Invalid templates[${index}].extraDependencies`);
    }
    const author = assertOptionalString(template.author, `templates[${index}].author`);
    const authorUrl = assertOptionalHttpUrl(template.authorUrl, `templates[${index}].authorUrl`);
    const previewUrl = assertOptionalHttpUrl(template.previewUrl, `templates[${index}].previewUrl`);
    return {
      id,
      title: assertString(template.title, `templates[${index}].title`),
      slug,
      sourcePath,
      coverPath,
      description: assertString(template.description, `templates[${index}].description`),
      ...(author ? { author } : {}),
      ...(authorUrl ? { authorUrl } : {}),
      ...(previewUrl ? { previewUrl } : {}),
      extraDependencies: extraDependencies.map((dependency) => dependency.trim()),
    };
  });
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function fetchJsonOrThrow<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': '@axhub/make template-library',
      },
    });
  } catch (error: any) {
    throw Object.assign(new Error(error?.message || 'Failed to read remote template library'), {
      code: 'TEMPLATE_LIBRARY_REMOTE_UNAVAILABLE',
    });
  }
  if (!response.ok) {
    const text = await readResponseText(response);
    throw Object.assign(new Error(`Remote template library request failed (${response.status})${text ? `: ${text}` : ''}`), {
      code: 'TEMPLATE_LIBRARY_REMOTE_UNAVAILABLE',
    });
  }
  return response.json() as Promise<T>;
}

async function fetchArrayBufferOrThrow(url: string): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/gzip',
        'User-Agent': '@axhub/make template-library',
      },
    });
  } catch (error: any) {
    throw Object.assign(new Error(error?.message || 'Failed to download template archive'), {
      code: 'TEMPLATE_LIBRARY_REMOTE_UNAVAILABLE',
    });
  }
  if (!response.ok) {
    const text = await readResponseText(response);
    throw Object.assign(new Error(`Remote template archive request failed (${response.status})${text ? `: ${text}` : ''}`), {
      code: 'TEMPLATE_LIBRARY_REMOTE_UNAVAILABLE',
    });
  }
  return response.arrayBuffer();
}

async function loadRemoteTemplateLibrary(): Promise<LoadedTemplateLibrary> {
  let branch = 'HEAD';
  try {
    const repo = await fetchJsonOrThrow<{ default_branch?: unknown }>(`https://api.github.com/repos/${TEMPLATE_LIBRARY_REPO}`);
    branch = typeof repo.default_branch === 'string' && repo.default_branch.trim()
      ? repo.default_branch.trim()
      : branch;
  } catch {
    branch = 'HEAD';
  }
  const indexUrl = `https://raw.githubusercontent.com/${TEMPLATE_LIBRARY_REPO}/${encodeURIComponent(branch)}/${TEMPLATE_LIBRARY_INDEX_PATH}`;
  const rawIndex = await fetchJsonOrThrow<unknown>(indexUrl);
  try {
    return {
      branch,
      templates: validateTemplateIndex(rawIndex),
    };
  } catch (error: any) {
    throw Object.assign(new Error(error?.message || 'Template index schema is invalid'), {
      code: 'TEMPLATE_LIBRARY_SCHEMA_INVALID',
    });
  }
}

function getDirectImportDisabledReason(template: TemplateLibraryIndexItem): string | undefined {
  if (template.extraDependencies.length > 0) {
    return `需要额外依赖：${template.extraDependencies.join(', ')}`;
  }
  return undefined;
}

function createRemoteLibraryPath(...parts: string[]): string {
  return parts
    .map((part) => part.trim().replace(/^\/+|\/+$/gu, ''))
    .filter(Boolean)
    .join('/');
}

function toPublicTemplate(template: TemplateLibraryIndexItem, branch: string) {
  const disabledReason = getDirectImportDisabledReason(template);
  const branchPath = encodeURIComponent(branch);
  return {
    ...template,
    coverUrl: `https://raw.githubusercontent.com/${TEMPLATE_LIBRARY_REPO}/${branchPath}/${createRemoteLibraryPath(template.coverPath)}`,
    sourceUrl: `https://github.com/${TEMPLATE_LIBRARY_REPO}/tree/${branchPath}/${createRemoteLibraryPath(template.sourcePath)}`,
    canDirectImport: !disabledReason,
    ...(disabledReason ? { directImportDisabledReason: disabledReason } : {}),
  };
}

async function execFilePromise(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return runLocalCommand(command, args, { cwd, maxBuffer: 1024 * 1024 * 10 });
}

async function extractTarball(tarballPath: string, targetDir: string): Promise<void> {
  fs.mkdirSync(targetDir, { recursive: true });
  await execFilePromise('tar', ['-xzf', tarballPath, '-C', targetDir], path.dirname(tarballPath));
}

function copyDirectoryRecursive(sourceDir: string, targetDir: string): void {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function createProjectRelativePath(projectRoot: string, absolutePath: string): string {
  return path.relative(projectRoot, absolutePath).split(path.sep).join('/');
}

function prependUnique(values: string[], value: string): string[] {
  return [value, ...values.filter((item) => item !== value)];
}

function resolvePrototypeClientUrl(
  options: ManagementApiOptions,
  context: TemplateLibraryProjectContext,
  prototypeId: string,
): string {
  const projectRuntimeOrigin = readServerInfo(context.project.root, 'runtime')?.origin;
  const base = (projectRuntimeOrigin || options.runtimeOrigin || options.origin || '').replace(/\/+$/u, '');
  return `${base}/prototypes/${encodeURIComponent(prototypeId)}`;
}

function updatePrototypeMetadataAfterImport(
  context: TemplateLibraryProjectContext,
  params: {
    template: TemplateLibraryIndexItem;
    prototypeId: string;
    indexPath: string;
    clientUrl: string;
  },
): string {
  const current = context.metadataStore.getMetadata();
  const filePath = createProjectRelativePath(context.project.root, params.indexPath);
  const existing = current.resources.prototypes.find((prototype) => (
    prototype.id === params.prototypeId || prototype.name === params.prototypeId
  ));
  const nextPrototype = {
    ...(existing || {}),
    id: existing?.id || params.prototypeId,
    name: existing?.name || params.prototypeId,
    title: params.template.title,
    clientUrl: params.clientUrl,
    previewMode: 'clientRuntime' as const,
    description: params.template.description,
    updatedAt: new Date().toISOString(),
    placeholder: false,
    filePath,
    absoluteFilePath: params.indexPath,
  };
  const {
    placeholderGuide: _placeholderGuide,
    ...prototypeWithoutPlaceholderGuide
  } = nextPrototype;
  context.metadata = context.metadataStore.saveMetadata({
    ...current,
    resources: {
      ...current.resources,
      prototypes: [
        prototypeWithoutPlaceholderGuide,
        ...current.resources.prototypes.filter((prototype) => prototype.id !== params.prototypeId && prototype.name !== params.prototypeId),
      ],
    },
    navigation: {
      ...current.navigation,
      prototypes: prependUnique(current.navigation.prototypes, params.prototypeId),
    },
  });
  return filePath;
}

function resolveTargetPrototypeName(
  res: ServerResponse,
  context: TemplateLibraryProjectContext,
  targetBaseDir: string,
  rawTargetPrototypeName: unknown,
): string | null | undefined {
  if (rawTargetPrototypeName === undefined || rawTargetPrototypeName === null || rawTargetPrototypeName === '') {
    return undefined;
  }
  const targetPrototypeName = typeof rawTargetPrototypeName === 'string' ? rawTargetPrototypeName.trim() : '';
  if (
    !targetPrototypeName
    || targetPrototypeName.includes('/')
    || targetPrototypeName.includes('\\')
    || targetPrototypeName.includes('\0')
  ) {
    sendTemplateLibraryError(res, 400, 'TEMPLATE_LIBRARY_TARGET_PROTOTYPE_INVALID', 'Invalid targetPrototypeName');
    return null;
  }
  const existing = context.metadata.resources.prototypes.find((prototype) => (
    prototype.id === targetPrototypeName || prototype.name === targetPrototypeName
  ));
  if (!existing) {
    sendTemplateLibraryError(res, 400, 'TEMPLATE_LIBRARY_TARGET_PROTOTYPE_NOT_FOUND', `Prototype not found: ${targetPrototypeName}`);
    return null;
  }
  const targetDir = path.resolve(targetBaseDir, targetPrototypeName);
  if (targetDir === path.resolve(targetBaseDir) || !isPathInside(targetBaseDir, targetDir)) {
    sendTemplateLibraryError(res, 400, 'TEMPLATE_LIBRARY_TARGET_PROTOTYPE_INVALID', 'Invalid targetPrototypeName');
    return null;
  }
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    sendTemplateLibraryError(res, 400, 'TEMPLATE_LIBRARY_TARGET_PROTOTYPE_NOT_FOUND', `Prototype folder not found: ${targetPrototypeName}`);
    return null;
  }
  return targetPrototypeName;
}

function findExtractedRepoRoot(extractDir: string): string {
  const entries = fs.readdirSync(extractDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
  if (entries.length !== 1) {
    throw new Error('Template archive root is invalid');
  }
  return path.join(extractDir, entries[0].name);
}

function requirePrototypeImportTarget(
  res: ServerResponse,
  context: TemplateLibraryProjectContext,
  handlers: TemplateLibraryHandlers,
): string | null {
  const targetBaseDir = handlers.getDeclaredResourceWriteDir(context, 'prototypes');
  if (!handlers.hasResourceWriteCapability(context, 'prototypeUpload') || !targetBaseDir) {
    handlers.sendDisabledCapability(res, 424, {
      error: 'Template import requires project-side prototype write capability in make-server',
      code: 'TEMPLATE_LIBRARY_IMPORT_ADAPTER_REQUIRED',
      projectId: context.project.id,
      projectRoot: context.project.root,
      adapterRequired: true,
      details: {
        route: '/api/template-library/import',
        reason: 'missing-prototype-upload-capability-or-target',
      },
    });
    return null;
  }
  return targetBaseDir;
}

async function handleListTemplateLibrary(res: ServerResponse): Promise<void> {
  try {
    const library = await loadRemoteTemplateLibrary();
    sendJson(res, {
      schemaVersion: 1,
      source: {
        repo: TEMPLATE_LIBRARY_REPO,
        branch: library.branch,
      },
      templates: library.templates.map((template) => toPublicTemplate(template, library.branch)),
    });
  } catch (error: any) {
    const code = error?.code === 'TEMPLATE_LIBRARY_SCHEMA_INVALID'
      ? 'TEMPLATE_LIBRARY_SCHEMA_INVALID'
      : 'TEMPLATE_LIBRARY_REMOTE_UNAVAILABLE';
    sendTemplateLibraryError(res, 502, code, error?.message || 'Failed to load remote template library');
  }
}

async function handleImportTemplateLibrary(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  handlers: TemplateLibraryHandlers,
): Promise<void> {
  let body: any;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, { error: 'Invalid JSON body', code: 'INVALID_JSON_BODY' }, { status: 400 });
    return;
  }
  const context = handlers.createProjectContextFromBody(req, res, options, body);
  if (!context) {
    return;
  }
  const targetBaseDir = requirePrototypeImportTarget(res, context, handlers);
  if (!targetBaseDir) {
    return;
  }
  const templateId = typeof body?.templateId === 'string' ? body.templateId.trim() : '';
  if (!templateId) {
    sendJson(res, { error: 'Missing templateId', code: 'TEMPLATE_LIBRARY_TEMPLATE_ID_REQUIRED' }, { status: 400 });
    return;
  }

  const tempRoot = path.join(context.project.root, 'temp', 'template-library');
  const tempDir = path.join(tempRoot, `${Date.now()}-${randomUUID()}`);
  let targetDir = '';
  let cleanupTargetOnError = false;
  try {
    const targetPrototypeName = resolveTargetPrototypeName(res, context, targetBaseDir, body?.targetPrototypeName);
    if (targetPrototypeName === null) {
      return;
    }
    const library = await loadRemoteTemplateLibrary();
    const template = library.templates.find((item) => item.id === templateId);
    if (!template) {
      sendJson(res, {
        error: `Template not found: ${templateId}`,
        code: 'TEMPLATE_LIBRARY_TEMPLATE_NOT_FOUND',
        templateId,
      }, { status: 404 });
      return;
    }

    const disabledReason = getDirectImportDisabledReason(template);
    if (disabledReason) {
      sendJson(res, {
        error: disabledReason,
        code: 'TEMPLATE_LIBRARY_DIRECT_IMPORT_DISABLED',
        templateId: template.id,
        extraDependencies: template.extraDependencies,
      }, { status: 409 });
      return;
    }

    const folderName = targetPrototypeName || template.slug;
    targetDir = path.join(targetBaseDir, folderName);
    if (!isPathInside(targetBaseDir, targetDir) || targetDir === path.resolve(targetBaseDir)) {
      throw new Error('Template target path is unsafe');
    }
    if (!targetPrototypeName && fs.existsSync(targetDir)) {
      sendJson(res, {
        error: `Prototype folder already exists: ${template.slug}`,
        code: 'TEMPLATE_LIBRARY_TARGET_EXISTS',
        templateId: template.id,
        folderName: template.slug,
      }, { status: 409 });
      return;
    }

    fs.mkdirSync(tempDir, { recursive: true });
    const tarballUrl = `https://codeload.github.com/${TEMPLATE_LIBRARY_REPO}/tar.gz/${encodeURIComponent(library.branch)}`;
    const archiveBuffer = Buffer.from(await fetchArrayBufferOrThrow(tarballUrl));
    const tarballPath = path.join(tempDir, 'source.tar.gz');
    fs.writeFileSync(tarballPath, archiveBuffer);
    const extractDir = path.join(tempDir, 'extract');
    await extractTarball(tarballPath, extractDir);

    const repoRoot = findExtractedRepoRoot(extractDir);
    const sourceDir = path.resolve(repoRoot, template.sourcePath);
    const sourceBaseDir = path.resolve(repoRoot);
    if (!isPathInside(sourceBaseDir, sourceDir) || !fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
      throw new Error(`Template source is missing: ${template.sourcePath}`);
    }
    if (!fs.existsSync(path.join(sourceDir, 'index.tsx'))) {
      throw new Error('Template source must contain index.tsx');
    }

    fs.mkdirSync(targetBaseDir, { recursive: true });
    cleanupTargetOnError = true;
    if (targetPrototypeName) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    copyDirectoryRecursive(sourceDir, targetDir);
    const indexPath = path.join(targetDir, 'index.tsx');
    const clientUrl = resolvePrototypeClientUrl(options, context, folderName);
    const filePath = updatePrototypeMetadataAfterImport(context, {
      template,
      prototypeId: folderName,
      indexPath,
      clientUrl,
    });
    cleanupTargetOnError = false;
    sendJson(res, {
      success: true,
      projectId: context.project.id,
      templateId: template.id,
      folderName,
      path: `prototypes/${folderName}`,
      filePath,
      absoluteFilePath: indexPath,
      clientUrl,
    });
  } catch (error: any) {
    if (cleanupTargetOnError && targetDir && fs.existsSync(targetDir) && isPathInside(targetBaseDir, targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    const code = error?.code === 'TEMPLATE_LIBRARY_SCHEMA_INVALID'
      ? 'TEMPLATE_LIBRARY_SCHEMA_INVALID'
      : error?.code === 'TEMPLATE_LIBRARY_REMOTE_UNAVAILABLE'
        ? 'TEMPLATE_LIBRARY_REMOTE_UNAVAILABLE'
        : 'TEMPLATE_LIBRARY_IMPORT_FAILED';
    const status = code === 'TEMPLATE_LIBRARY_IMPORT_FAILED' ? 400 : 502;
    sendTemplateLibraryError(res, status, code, error?.message || 'Template import failed');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function handleTemplateLibraryApi(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  pathname: string,
  handlers: TemplateLibraryHandlers,
): boolean {
  if (pathname === '/api/template-library') {
    if (req.method !== 'GET') {
      sendJson(res, { error: 'Method not allowed' }, { status: 405 });
      return true;
    }
    void handleListTemplateLibrary(res);
    return true;
  }

  if (pathname === '/api/template-library/import') {
    if (req.method !== 'POST') {
      sendJson(res, { error: 'Method not allowed' }, { status: 405 });
      return true;
    }
    void handleImportTemplateLibrary(req, res, options, handlers);
    return true;
  }

  return false;
}
