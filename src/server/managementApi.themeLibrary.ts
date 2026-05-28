import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isPathInside,
  readServerInfo,
  type ProjectMetadata,
  type RegisteredProject,
} from './projectCore/index.ts';

import { readJsonBody, sendJson } from './http.ts';
import { runLocalCommand } from './localCommand.ts';
import type { ManagementApiOptions } from './managementApi.ts';

const THEME_LIBRARY_REPO = 'lintendo/Make-Template';
const THEME_LIBRARY_INDEX_PATH = 'design-systems.json';
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

interface ThemeLibraryProjectContext {
  project: RegisteredProject;
  metadata: ProjectMetadata;
  metadataStore: {
    getMetadata: () => ProjectMetadata;
    saveMetadata: (metadata: ProjectMetadata) => ProjectMetadata;
  };
}

interface ThemeLibraryHandlers {
  createProjectContextFromBody: (
    req: IncomingMessage,
    res: ServerResponse,
    options: ManagementApiOptions,
    body: unknown,
  ) => ThemeLibraryProjectContext | null;
  getDeclaredResourceWriteDir: (
    context: ThemeLibraryProjectContext,
    type: 'themes',
  ) => string | null;
  hasResourceWriteCapability: (
    context: ThemeLibraryProjectContext,
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

export interface ThemeLibraryIndexItem {
  id: string;
  title: string;
  slug: string;
  sourcePath: string;
  entryPath: string;
  tokenPath: string;
  stylePath: string;
  coverPath: string;
  description: string;
}

interface LoadedThemeLibrary {
  branch: string;
  designSystems: ThemeLibraryIndexItem[];
  localAppPath?: string;
}

function findLocalThemeLibraryAppPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'apps/make-template'),
    path.resolve(process.cwd(), '..', 'make-template'),
    path.resolve(MODULE_DIR, '..', '..', '..', '..', 'make-template'),
  ];

  for (const candidate of candidates) {
    const indexPath = path.join(candidate, 'design-systems.json');
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
      return candidate;
    }
  }

  return null;
}

function loadLocalThemeLibrary(): LoadedThemeLibrary | null {
  const localAppPath = findLocalThemeLibraryAppPath();
  if (!localAppPath) {
    return null;
  }

  const rawIndex = JSON.parse(fs.readFileSync(path.join(localAppPath, 'design-systems.json'), 'utf8'));
  return {
    branch: 'local',
    localAppPath,
    designSystems: validateThemeLibraryIndex(rawIndex),
  };
}

function sendThemeLibraryError(
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

function assertRelativeThemePath(value: unknown, fieldName: string): string {
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

function assertThemeId(value: unknown, fieldName: string): string {
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

function validateThemeLibraryIndex(raw: unknown): ThemeLibraryIndexItem[] {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Theme library index must be an object');
  }
  const record = raw as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    throw new Error('Theme library index schemaVersion must be 1');
  }
  if (!Array.isArray(record.designSystems)) {
    throw new Error('Theme library index designSystems must be an array');
  }
  const ids = new Set<string>();
  const slugs = new Set<string>();
  return record.designSystems.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid design system at index ${index}`);
    }
    const designSystem = item as Record<string, unknown>;
    const id = assertThemeId(designSystem.id, `designSystems[${index}].id`);
    const slug = assertThemeId(designSystem.slug, `designSystems[${index}].slug`);
    const sourcePath = assertRelativeThemePath(designSystem.sourcePath, `designSystems[${index}].sourcePath`);
    const entryPath = assertRelativeThemePath(designSystem.entryPath, `designSystems[${index}].entryPath`);
    const tokenPath = assertRelativeThemePath(designSystem.tokenPath, `designSystems[${index}].tokenPath`);
    const stylePath = assertRelativeThemePath(designSystem.stylePath, `designSystems[${index}].stylePath`);
    const coverPath = assertRelativeThemePath(designSystem.coverPath, `designSystems[${index}].coverPath`);
    if (!sourcePath.startsWith('design-systems/')) {
      throw new Error(`Invalid designSystems[${index}].sourcePath: ${sourcePath}`);
    }
    for (const [fieldName, value] of Object.entries({ entryPath, tokenPath, stylePath, coverPath })) {
      if (!value.startsWith(`${sourcePath}/`)) {
        throw new Error(`Invalid designSystems[${index}].${fieldName}: ${value}`);
      }
    }
    if (ids.has(id)) {
      throw new Error(`Duplicate design system id: ${id}`);
    }
    if (slugs.has(slug)) {
      throw new Error(`Duplicate design system slug: ${slug}`);
    }
    ids.add(id);
    slugs.add(slug);
    return {
      id,
      title: assertString(designSystem.title, `designSystems[${index}].title`),
      slug,
      sourcePath,
      entryPath,
      tokenPath,
      stylePath,
      coverPath,
      description: assertString(designSystem.description, `designSystems[${index}].description`),
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
        'User-Agent': '@axhub/make theme-library',
      },
    });
  } catch (error: any) {
    throw Object.assign(new Error(error?.message || 'Failed to read remote theme library'), {
      code: 'THEME_LIBRARY_REMOTE_UNAVAILABLE',
    });
  }
  if (!response.ok) {
    const text = await readResponseText(response);
    throw Object.assign(new Error(`Remote theme library request failed (${response.status})${text ? `: ${text}` : ''}`), {
      code: 'THEME_LIBRARY_REMOTE_UNAVAILABLE',
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
        'User-Agent': '@axhub/make theme-library',
      },
    });
  } catch (error: any) {
    throw Object.assign(new Error(error?.message || 'Failed to download theme archive'), {
      code: 'THEME_LIBRARY_REMOTE_UNAVAILABLE',
    });
  }
  if (!response.ok) {
    const text = await readResponseText(response);
    throw Object.assign(new Error(`Remote theme archive request failed (${response.status})${text ? `: ${text}` : ''}`), {
      code: 'THEME_LIBRARY_REMOTE_UNAVAILABLE',
    });
  }
  return response.arrayBuffer();
}

async function loadRemoteThemeLibrary(): Promise<LoadedThemeLibrary> {
  const localLibrary = loadLocalThemeLibrary();
  if (localLibrary) {
    return localLibrary;
  }

  let branch = 'HEAD';
  try {
    const repo = await fetchJsonOrThrow<{ default_branch?: unknown }>(`https://api.github.com/repos/${THEME_LIBRARY_REPO}`);
    branch = typeof repo.default_branch === 'string' && repo.default_branch.trim()
      ? repo.default_branch.trim()
      : branch;
  } catch {
    branch = 'HEAD';
  }
  const indexUrl = `https://raw.githubusercontent.com/${THEME_LIBRARY_REPO}/${encodeURIComponent(branch)}/${THEME_LIBRARY_INDEX_PATH}`;
  let rawIndex: unknown;
  try {
    rawIndex = await fetchJsonOrThrow<unknown>(indexUrl);
  } catch (error: any) {
    throw error;
  }
  try {
    return {
      branch,
      designSystems: validateThemeLibraryIndex(rawIndex),
    };
  } catch (error: any) {
    throw Object.assign(new Error(error?.message || 'Theme library schema is invalid'), {
      code: 'THEME_LIBRARY_SCHEMA_INVALID',
    });
  }
}

function createRemoteLibraryPath(...parts: string[]): string {
  return parts
    .map((part) => part.trim().replace(/^\/+|\/+$/gu, ''))
    .filter(Boolean)
    .join('/');
}

function toPublicDesignSystem(designSystem: ThemeLibraryIndexItem, branch: string) {
  const branchPath = branch === 'local' ? 'HEAD' : encodeURIComponent(branch);
  return {
    ...designSystem,
    coverUrl: `https://raw.githubusercontent.com/${THEME_LIBRARY_REPO}/${branchPath}/${createRemoteLibraryPath(designSystem.coverPath)}`,
    sourceUrl: `https://github.com/${THEME_LIBRARY_REPO}/tree/${branchPath}/${createRemoteLibraryPath(designSystem.sourcePath)}`,
    canDirectImport: true,
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

function resolveThemeClientUrl(
  options: ManagementApiOptions,
  context: ThemeLibraryProjectContext,
  themeId: string,
): string {
  const projectRuntimeOrigin = readServerInfo(context.project.root, 'runtime')?.origin;
  const base = (projectRuntimeOrigin || options.runtimeOrigin || options.origin || '').replace(/\/+$/u, '');
  return `${base}/themes/${encodeURIComponent(themeId)}`;
}

function updateThemeMetadataAfterImport(
  context: ThemeLibraryProjectContext,
  params: {
    designSystem: ThemeLibraryIndexItem;
    themeDir: string;
    entryPath: string;
    clientUrl: string;
  },
): string {
  const current = context.metadataStore.getMetadata();
  const themePath = createProjectRelativePath(context.project.root, params.themeDir);
  const filePath = createProjectRelativePath(context.project.root, params.entryPath);
  context.metadata = context.metadataStore.saveMetadata({
    ...current,
    resources: {
      ...current.resources,
      themes: [
        {
          id: params.designSystem.slug,
          name: params.designSystem.slug,
          title: params.designSystem.title,
          path: themePath,
          sourcePath: themePath,
          filePath,
          absoluteFilePath: params.entryPath,
          clientUrl: params.clientUrl,
          previewUrl: params.clientUrl,
          description: params.designSystem.description,
          updatedAt: new Date().toISOString(),
        },
        ...current.resources.themes.filter((theme) => theme.id !== params.designSystem.slug && theme.name !== params.designSystem.slug),
      ],
    },
    orders: {
      ...current.orders,
      themes: prependUnique(current.orders.themes, params.designSystem.slug),
    },
  });
  return filePath;
}

function findExtractedRepoRoot(extractDir: string): string {
  const entries = fs.readdirSync(extractDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
  if (entries.length !== 1) {
    throw new Error('Theme archive root is invalid');
  }
  return path.join(extractDir, entries[0].name);
}

function requireThemeImportTarget(
  res: ServerResponse,
  context: ThemeLibraryProjectContext,
  handlers: ThemeLibraryHandlers,
): string | null {
  const targetBaseDir = handlers.getDeclaredResourceWriteDir(context, 'themes');
  if (!handlers.hasResourceWriteCapability(context, 'themeImport') || !targetBaseDir) {
    handlers.sendDisabledCapability(res, 424, {
      error: 'Theme library import requires project-side theme write capability in make-server',
      code: 'THEME_LIBRARY_IMPORT_ADAPTER_REQUIRED',
      projectId: context.project.id,
      projectRoot: context.project.root,
      adapterRequired: true,
      details: {
        route: '/api/theme-library/import',
        reason: 'missing-theme-import-capability-or-target',
      },
    });
    return null;
  }
  return targetBaseDir;
}

async function handleListThemeLibrary(res: ServerResponse): Promise<void> {
  try {
    const library = await loadRemoteThemeLibrary();
    sendJson(res, {
      schemaVersion: 1,
      source: {
        repo: THEME_LIBRARY_REPO,
        branch: library.branch,
      },
      designSystems: library.designSystems.map((designSystem) => toPublicDesignSystem(designSystem, library.branch)),
    });
  } catch (error: any) {
    const code = error?.code === 'THEME_LIBRARY_SCHEMA_INVALID'
      ? 'THEME_LIBRARY_SCHEMA_INVALID'
      : 'THEME_LIBRARY_REMOTE_UNAVAILABLE';
    sendThemeLibraryError(res, 502, code, error?.message || 'Failed to load remote theme library');
  }
}

async function handleImportThemeLibrary(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  handlers: ThemeLibraryHandlers,
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
  const targetBaseDir = requireThemeImportTarget(res, context, handlers);
  if (!targetBaseDir) {
    return;
  }
  const designSystemId = typeof body?.designSystemId === 'string' ? body.designSystemId.trim() : '';
  if (!designSystemId) {
    sendJson(res, { error: 'Missing designSystemId', code: 'THEME_LIBRARY_DESIGN_SYSTEM_ID_REQUIRED' }, { status: 400 });
    return;
  }

  const tempRoot = path.join(context.project.root, 'temp', 'theme-library');
  const tempDir = path.join(tempRoot, `${Date.now()}-${randomUUID()}`);
  let targetDir = '';
  try {
    const library = await loadRemoteThemeLibrary();
    const designSystem = library.designSystems.find((item) => item.id === designSystemId);
    if (!designSystem) {
      sendJson(res, {
        error: `Design system not found: ${designSystemId}`,
        code: 'THEME_LIBRARY_DESIGN_SYSTEM_NOT_FOUND',
        designSystemId,
      }, { status: 404 });
      return;
    }

    targetDir = path.join(targetBaseDir, designSystem.slug);
    if (!isPathInside(targetBaseDir, targetDir) || targetDir === path.resolve(targetBaseDir)) {
      throw new Error('Theme target path is unsafe');
    }
    if (fs.existsSync(targetDir)) {
      sendJson(res, {
        error: `Theme folder already exists: ${designSystem.slug}`,
        code: 'THEME_LIBRARY_TARGET_EXISTS',
        designSystemId: designSystem.id,
        folderName: designSystem.slug,
      }, { status: 409 });
      return;
    }

    let sourceDir: string;
    let sourceBaseDir: string;
    if (library.localAppPath) {
      sourceBaseDir = library.localAppPath;
      sourceDir = path.resolve(sourceBaseDir, designSystem.sourcePath);
    } else {
      fs.mkdirSync(tempDir, { recursive: true });
      const tarballUrl = `https://codeload.github.com/${THEME_LIBRARY_REPO}/tar.gz/${encodeURIComponent(library.branch)}`;
      const archiveBuffer = Buffer.from(await fetchArrayBufferOrThrow(tarballUrl));
      const tarballPath = path.join(tempDir, 'source.tar.gz');
      fs.writeFileSync(tarballPath, archiveBuffer);
      const extractDir = path.join(tempDir, 'extract');
      await extractTarball(tarballPath, extractDir);

      const repoRoot = findExtractedRepoRoot(extractDir);
      sourceBaseDir = path.resolve(repoRoot);
      sourceDir = path.resolve(sourceBaseDir, designSystem.sourcePath);
    }
    if (!isPathInside(sourceBaseDir, sourceDir) || !fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
      throw new Error(`Design system source is missing: ${designSystem.sourcePath}`);
    }
    const relativeEntryPath = path.relative(designSystem.sourcePath, designSystem.entryPath).split(path.sep).join('/');
    const sourceEntryPath = path.resolve(sourceDir, relativeEntryPath);
    if (!isPathInside(sourceDir, sourceEntryPath) || !fs.existsSync(sourceEntryPath)) {
      throw new Error('Design system source must contain entryPath');
    }

    fs.mkdirSync(targetBaseDir, { recursive: true });
    copyDirectoryRecursive(sourceDir, targetDir);
    const entryPath = path.join(targetDir, relativeEntryPath);
    const clientUrl = resolveThemeClientUrl(options, context, designSystem.slug);
    const filePath = updateThemeMetadataAfterImport(context, {
      designSystem,
      themeDir: targetDir,
      entryPath,
      clientUrl,
    });
    sendJson(res, {
      success: true,
      projectId: context.project.id,
      designSystemId: designSystem.id,
      folderName: designSystem.slug,
      path: `themes/${designSystem.slug}`,
      filePath,
      absoluteFilePath: entryPath,
      clientUrl,
    });
  } catch (error: any) {
    if (targetDir && fs.existsSync(targetDir) && isPathInside(targetBaseDir, targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    const code = error?.code === 'THEME_LIBRARY_SCHEMA_INVALID'
      ? 'THEME_LIBRARY_SCHEMA_INVALID'
      : error?.code === 'THEME_LIBRARY_REMOTE_UNAVAILABLE'
        ? 'THEME_LIBRARY_REMOTE_UNAVAILABLE'
        : 'THEME_LIBRARY_IMPORT_FAILED';
    const status = code === 'THEME_LIBRARY_IMPORT_FAILED' ? 400 : 502;
    sendThemeLibraryError(res, status, code, error?.message || 'Theme library import failed');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function handleThemeLibraryApi(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  pathname: string,
  handlers: ThemeLibraryHandlers,
): boolean {
  if (pathname === '/api/theme-library') {
    if (req.method !== 'GET') {
      sendJson(res, { error: 'Method not allowed' }, { status: 405 });
      return true;
    }
    void handleListThemeLibrary(res);
    return true;
  }

  if (pathname === '/api/theme-library/import') {
    if (req.method !== 'POST') {
      sendJson(res, { error: 'Method not allowed' }, { status: 405 });
      return true;
    }
    void handleImportThemeLibrary(req, res, options, handlers);
    return true;
  }

  return false;
}
