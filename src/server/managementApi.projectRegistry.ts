import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import {
  createProjectCommunicationStore,
  createProjectMetadataStore,
  getProjectMetadataPath,
  isPathInside,
  readMakeClientMarker,
  type ProjectMetadata,
  type RegisteredProject,
} from './projectCore/index.ts';

import { getRequestUrl, readJsonBody, sendJson } from './http.ts';
import { LocalCommandError } from './localCommand.ts';
import { backfillMakeClientResourcePreviewLinks } from './makeClientRuntimeLinks.ts';
import { getMakeClientDevStatus } from './makeClientProject.ts';
import { handleProjectFolderBrowserApi } from './managementApi.folderBrowser.ts';
import { handleMakeClientProjectApi } from './managementApi.makeClient.ts';
import type { ManagementApiOptions } from './managementApi.ts';
import { PROTOTYPE_PLACEHOLDER_GUIDE } from './prototypePlaceholderGuide.ts';

type ProjectMetadataStore = ReturnType<typeof createProjectMetadataStore>;
type EffectiveProjectCapabilities = ProjectMetadata['capabilities'] & { lanAccessAllowed: boolean };

/**
 * Reconcile metadata resources with actual filesystem state.
 * - Reconciles prototype entries against the declared/default local source root.
 * - Removes doc entries whose referenced files no longer exist on disk.
 * - Discovers new files in the docs/themes directories that aren't in metadata.
 * This makes the filesystem the single source of truth — no manual sync needed.
 */
function reconcileMetadataWithFilesystem(
  metadataStore: ProjectMetadataStore,
  projectRoot: string,
): ProjectMetadata {
  const metadata = metadataStore.getMetadata();
  const resourceWriteTargets = metadata.resourceWriteTargets;
  let changed = false;

  // --- Prototypes reconciliation ---
  const { prototypesDir, shouldReconcile: shouldReconcilePrototypes } = getPrototypeResourceRoot(projectRoot, metadata);
  const scannedPrototypes = shouldReconcilePrototypes ? scanFilesystemPrototypeResources(projectRoot, prototypesDir) : [];
  const scannedPrototypeIds = new Set(scannedPrototypes.map((prototype) => prototype.id));
  const stalePrototypeIds: string[] = [];
  const reconciledPrototypes = metadata.resources.prototypes
    .filter((prototype) => {
      if (!shouldReconcilePrototypes) {
        return true;
      }
      if (scannedPrototypeIds.has(prototype.id) || scannedPrototypeIds.has(prototype.name)) {
        return true;
      }
      stalePrototypeIds.push(prototype.id);
      return false;
    })
    .map((prototype) => {
      if (prototype.placeholder !== true || prototype.placeholderGuide) {
        return prototype;
      }
      changed = true;
      return {
        ...prototype,
        placeholderGuide: PROTOTYPE_PLACEHOLDER_GUIDE,
      };
    });
  if (stalePrototypeIds.length > 0) {
    changed = true;
  }
  const existingPrototypeIds = new Set(reconciledPrototypes.flatMap((prototype) => [prototype.id, prototype.name].filter(Boolean)));
  const discoveredPrototypes = scannedPrototypes.filter((prototype) => {
    if (existingPrototypeIds.has(prototype.id) || existingPrototypeIds.has(prototype.name)) {
      return false;
    }
    existingPrototypeIds.add(prototype.id);
    existingPrototypeIds.add(prototype.name);
    return true;
  });
  if (discoveredPrototypes.length > 0) {
    changed = true;
  }
  const allPrototypes = [...reconciledPrototypes, ...discoveredPrototypes];

  // --- Docs reconciliation ---
  const docsTarget = resourceWriteTargets?.docs;
  const docsDir = docsTarget?.type === 'project-relative-path' && docsTarget.path
    ? path.resolve(projectRoot, docsTarget.path)
    : path.join(projectRoot, 'src/resources');

  // 1. Remove stale docs (file deleted from disk)
  const staleDocIds: string[] = [];
  const reconciledDocs = metadata.resources.docs.filter((doc) => {
    if (isIgnoredResourceRelativePath(getDocRelativePath(projectRoot, docsDir, doc))) {
      staleDocIds.push(doc.id);
      return false;
    }
    if (doc.path && !fs.existsSync(doc.path)) {
      staleDocIds.push(doc.id);
      return false;
    }
    return true;
  });
  if (staleDocIds.length > 0) {
    changed = true;
  }

  // 2. Discover new resource files not in metadata.
  const existingDocPaths = new Set(reconciledDocs.map((doc) => doc.path));
  const discoveredDocs: typeof metadata.resources.docs = [];
  if (fs.existsSync(docsDir)) {
    const walkDocs = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dir, entry.name);
        const rel = path.relative(docsDir, fullPath).split(path.sep).join('/');
        if (rel.startsWith('templates/') || rel === 'templates' || isIgnoredResourceRelativePath(rel)) continue;
        if (entry.isDirectory()) {
          walkDocs(fullPath);
          continue;
        }
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name).toLowerCase();
        if (existingDocPaths.has(fullPath)) continue;
        const id = ext === '.md' ? rel.replace(/\.[^.]+$/u, '') : rel;
        let displayName = ext === '.md' ? rel.replace(/\.[^.]+$/u, '') : rel.replace(/\.[^.]+$/u, '');
        if (ext === '.md') {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
            if (title) displayName = title;
          } catch { /* ignore */ }
        }
        discoveredDocs.push({
          id,
          name: id,
          title: displayName,
          path: fullPath,
          description: '',
          updatedAt: new Date().toISOString(),
        });
      }
    };
    walkDocs(docsDir);
  }
  if (discoveredDocs.length > 0) {
    changed = true;
  }

  // --- Themes reconciliation (only when themes dir exists) ---
  const themesTarget = resourceWriteTargets?.themes;
  const themesDir = themesTarget?.type === 'project-relative-path' && themesTarget.path
    ? path.resolve(projectRoot, themesTarget.path)
    : path.join(projectRoot, 'src/themes');

  let reconciledThemes = metadata.resources.themes;
  const discoveredThemes: typeof metadata.resources.themes = [];
  if (fs.existsSync(themesDir)) {
    // Remove stale themes (directory deleted from disk)
    const existingThemeIds = new Set(metadata.resources.themes.map((t) => t.id));
    reconciledThemes = metadata.resources.themes.filter((theme) => {
      const themeSubDir = path.join(themesDir, theme.id);
      return fs.existsSync(themeSubDir);
    });
    // Discover new themes (directories in src/themes not in metadata)
    for (const entry of fs.readdirSync(themesDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      if (existingThemeIds.has(entry.name)) continue;
      discoveredThemes.push({
        id: entry.name,
        name: entry.name,
        title: entry.name,
      });
    }
    if (reconciledThemes.length !== metadata.resources.themes.length || discoveredThemes.length > 0) {
      changed = true;
    }
  }

  const stalePrototypeIdSet = new Set(stalePrototypeIds);
  const allowedPrototypeIds = new Set(allPrototypes.flatMap((prototype) => [prototype.id, prototype.name].filter(Boolean)));
  const nextNavigationPrototypes: string[] = [];
  const seenNavigationPrototypes = new Set<string>();
  for (const prototypeId of metadata.navigation.prototypes) {
    if (!allowedPrototypeIds.has(prototypeId) || stalePrototypeIdSet.has(prototypeId) || seenNavigationPrototypes.has(prototypeId)) {
      changed = true;
      continue;
    }
    seenNavigationPrototypes.add(prototypeId);
    nextNavigationPrototypes.push(prototypeId);
  }
  for (const prototype of discoveredPrototypes) {
    if (seenNavigationPrototypes.has(prototype.id)) {
      continue;
    }
    seenNavigationPrototypes.add(prototype.id);
    nextNavigationPrototypes.push(prototype.id);
  }

  const staleDocIdSet = new Set(staleDocIds);
  const allDocs = [...reconciledDocs, ...discoveredDocs];
  const allThemes = [...reconciledThemes, ...discoveredThemes];
  const allowedDocIds = new Set(allDocs.flatMap((doc) => [doc.id, doc.name].filter(Boolean)));
  const nextNavigationDocs: string[] = [];
  const seenNavigationDocs = new Set<string>();
  for (const docId of metadata.navigation.docs) {
    if (!allowedDocIds.has(docId) || staleDocIdSet.has(docId) || seenNavigationDocs.has(docId)) {
      changed = true;
      continue;
    }
    seenNavigationDocs.add(docId);
    nextNavigationDocs.push(docId);
  }
  for (const doc of discoveredDocs) {
    if (seenNavigationDocs.has(doc.id)) {
      continue;
    }
    seenNavigationDocs.add(doc.id);
    nextNavigationDocs.push(doc.id);
  }

  if (!changed) {
    return metadata;
  }

  return metadataStore.saveMetadata({
    ...metadata,
    resources: {
      ...metadata.resources,
      prototypes: allPrototypes,
      docs: allDocs,
      themes: allThemes,
    },
    navigation: {
      ...metadata.navigation,
      prototypes: nextNavigationPrototypes,
      docs: nextNavigationDocs,
    },
    orders: {
      ...metadata.orders,
      themes: [
        ...metadata.orders.themes.filter((key) => allThemes.some((t) => t.id === key || t.name === key)),
        ...discoveredThemes.map((t) => t.id),
      ],
    },
  });
}

function getDocsResourceRoot(projectRoot: string, metadata: ProjectMetadata): string {
  const target = metadata.resourceWriteTargets?.docs;
  if (target?.type === 'project-relative-path' && target.path) {
    const resolvedTarget = path.resolve(projectRoot, target.path);
    if (isPathInside(projectRoot, resolvedTarget)) {
      return resolvedTarget;
    }
  }
  return path.join(projectRoot, 'src/resources');
}

function getPrototypeResourceRoot(projectRoot: string, metadata: ProjectMetadata): {
  prototypesDir: string;
  shouldReconcile: boolean;
} {
  const target = metadata.resourceWriteTargets?.prototypes;
  if (target?.type === 'project-relative-path' && target.path) {
    const resolvedTarget = path.resolve(projectRoot, target.path);
    if (isPathInside(projectRoot, resolvedTarget)) {
      return {
        prototypesDir: resolvedTarget,
        shouldReconcile: true,
      };
    }
  }

  const defaultDir = path.join(projectRoot, 'src/prototypes');
  return {
    prototypesDir: defaultDir,
    shouldReconcile: fs.existsSync(defaultDir),
  };
}

function normalizeRelativePath(baseDir: string, absolutePath: string): string {
  return path.relative(baseDir, absolutePath).split(path.sep).join('/');
}

function readPrototypeTitle(indexFilePath: string, fallback: string): string {
  try {
    const source = fs.readFileSync(indexFilePath, 'utf8');
    const title = source.match(/@name\s+([^\n]+)/u)?.[1]?.replace(/\*\/\s*$/u, '').trim();
    return title || fallback;
  } catch {
    return fallback;
  }
}

function readFileUpdatedAt(filePath: string): string {
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function createProjectRelativePath(projectRoot: string, absolutePath: string): string {
  return path.relative(projectRoot, absolutePath).split(path.sep).join('/');
}

function scanFilesystemPrototypeResources(
  projectRoot: string,
  prototypesDir: string,
): ProjectMetadata['resources']['prototypes'] {
  if (!fs.existsSync(prototypesDir)) {
    return [];
  }

  const prototypes: ProjectMetadata['resources']['prototypes'] = [];
  for (const entry of fs.readdirSync(prototypesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }
    const indexFilePath = path.join(prototypesDir, entry.name, 'index.tsx');
    if (!fs.existsSync(indexFilePath)) {
      continue;
    }
    prototypes.push({
      id: entry.name,
      name: entry.name,
      title: readPrototypeTitle(indexFilePath, entry.name),
      clientUrl: `/prototypes/${encodeURIComponent(entry.name)}`,
      previewMode: 'clientRuntime',
      description: '',
      updatedAt: readFileUpdatedAt(indexFilePath),
      filePath: createProjectRelativePath(projectRoot, indexFilePath),
      absoluteFilePath: indexFilePath,
    });
  }
  return prototypes.sort((a, b) => a.id.localeCompare(b.id));
}

function readMarkdownTitle(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8').match(/^#\s+(.+)$/m)?.[1]?.trim() || '';
  } catch {
    return '';
  }
}

function scanFilesystemDocResources(projectRoot: string, metadata: ProjectMetadata): ProjectMetadata['resources']['docs'] {
  const docsDir = getDocsResourceRoot(projectRoot, metadata);
  if (!fs.existsSync(docsDir)) {
    return [];
  }

  const docs: ProjectMetadata['resources']['docs'] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      const relativeName = normalizeRelativePath(docsDir, fullPath);
      if (relativeName === 'templates' || relativeName.startsWith('templates/') || isIgnoredResourceRelativePath(relativeName)) continue;
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      const id = ext === '.md' ? relativeName.replace(/\.[^.]+$/u, '') : relativeName;
      const title = ext === '.md'
        ? readMarkdownTitle(fullPath) || relativeName.replace(/\.[^.]+$/u, '')
        : relativeName.replace(/\.[^.]+$/u, '');
      let updatedAt = new Date().toISOString();
      try {
        updatedAt = fs.statSync(fullPath).mtime.toISOString();
      } catch {
        // keep fallback timestamp
      }
      docs.push({
        id,
        name: id,
        title,
        path: fullPath,
        description: '',
        updatedAt,
      });
    }
  };
  walk(docsDir);
  return docs.sort((a, b) => a.name.localeCompare(b.name));
}

function mergeFilesystemDocResources(metadata: ProjectMetadata, projectRoot: string): ProjectMetadata['resources']['docs'] {
  const byPath = new Set(metadata.resources.docs.map((doc) => path.resolve(doc.path)));
  const byKey = new Set(metadata.resources.docs.flatMap((doc) => [doc.id, doc.name].filter(Boolean)));
  const extras = scanFilesystemDocResources(projectRoot, metadata)
    .filter((doc) => !byPath.has(path.resolve(doc.path)) && !byKey.has(doc.id) && !byKey.has(doc.name));
  return [...metadata.resources.docs, ...extras];
}

function createProjectResourcesPayload(metadata: ProjectMetadata, projectRoot: string): ProjectMetadata['resources'] {
  return {
    ...metadata.resources,
    docs: mergeFilesystemDocResources(metadata, projectRoot),
  };
}


type ProjectRegistry = {
  getRegistry: () => {
    activeProjectId?: string | null;
    projects: RegisteredProject[];
  };
  getProject: (projectId: string) => RegisteredProject | null;
  getActiveProject: () => RegisteredProject | null;
  listProjects: () => RegisteredProject[];
  addProject: (project: {
    id: string;
    name: string;
    root: string;
    metadataPath: string;
  }) => RegisteredProject;
  updateProject: (projectId: string, updates: Partial<RegisteredProject>) => RegisteredProject;
  removeProject: (projectId: string) => void;
  setActiveProject: (projectId: string) => void;
};

interface ProjectRegistryRequestContext {
  project: RegisteredProject;
  metadata: ProjectMetadata;
  metadataStore: ProjectMetadataStore;
}

interface ProjectRegistryApiHandlers {
  ensureDefaultRegisteredProject: (options: ManagementApiOptions) => unknown;
  getProjectRegistryForRequest: (options: ManagementApiOptions) => ProjectRegistry;
  addOrUpdateRegistryProjectByRoot: (
    registry: ProjectRegistry,
    params: {
      id: string;
      name: string;
      root: string;
      metadataPath: string;
    },
  ) => RegisteredProject;
  toProjectEntry: (project: RegisteredProject) => RegisteredProject;
  toProjectIdentity: (project: RegisteredProject) => { id: string; name: string };
  updateRegisteredProjectTitle: (options: ManagementApiOptions, project: RegisteredProject, title: string) => RegisteredProject;
  selectLocalProjectRootForKind: (kind: string) => Promise<string | null>;
  getExistingMetadataStore: (res: ServerResponse, project: RegisteredProject) => ProjectMetadataStore | null;
  createEffectiveProjectCapabilities: (context: ProjectRegistryRequestContext) => EffectiveProjectCapabilities;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '');
}

function getLocalCommandErrorPayload(error: unknown): Record<string, unknown> {
  if (!(error instanceof LocalCommandError)) {
    return {};
  }
  return {
    command: error.command,
    args: error.args,
    escapedCommand: error.escapedCommand,
    exitCode: error.exitCode,
    stderr: error.stderr,
    stdout: error.stdout,
  };
}

function getDocPathOutsideProjectResourceId(error: unknown): string | null {
  const match = getErrorMessage(error).match(/^Doc resource (.+) is outside project root$/u);
  return match?.[1] || null;
}

function isIgnoredResourceRelativePath(relativePath: string): boolean {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return true;
  if (normalized.toLowerCase() === 'readme.md') return true;
  return normalized.split('/').some((segment) => segment.startsWith('.'));
}

function getDocRelativePath(projectRoot: string, docsDir: string, doc: ProjectMetadata['resources']['docs'][number]): string {
  const rawPath = String(doc.path || '').trim();
  if (!rawPath) {
    return String(doc.name || doc.id || '');
  }
  const resolvedPath = path.resolve(path.isAbsolute(rawPath) ? rawPath : path.join(projectRoot, rawPath));
  if (isPathInside(docsDir, resolvedPath)) {
    return path.relative(docsDir, resolvedPath).split(path.sep).join('/');
  }
  return String(doc.name || doc.id || '');
}

function sendProjectMetadataError(
  res: ServerResponse,
  error: unknown,
  context: {
    project?: RegisteredProject;
    projectId?: string;
    projectRoot?: string;
    metadataPath?: string;
  } = {},
): void {
  const resourceId = getDocPathOutsideProjectResourceId(error);
  if (resourceId) {
    sendJson(res, {
      error: 'Doc path is outside project root',
      code: 'DOC_PATH_OUTSIDE_PROJECT',
      ...(context.projectId || context.project?.id ? { projectId: context.projectId || context.project?.id } : {}),
      resourceId,
      ...(context.project?.root || context.projectRoot ? { projectRoot: context.project?.root || context.projectRoot } : {}),
      ...(context.project?.metadataPath || context.metadataPath ? { metadataPath: context.project?.metadataPath || context.metadataPath } : {}),
    }, { status: 403 });
    return;
  }

  sendJson(res, {
    error: getErrorMessage(error) || 'Project metadata is invalid',
    code: 'PROJECT_METADATA_INVALID',
    ...(context.projectId || context.project?.id ? { projectId: context.projectId || context.project?.id } : {}),
    ...(context.project?.root || context.projectRoot ? { projectRoot: context.project?.root || context.projectRoot } : {}),
    ...(context.project?.metadataPath || context.metadataPath ? { metadataPath: context.project?.metadataPath || context.metadataPath } : {}),
  }, { status: 400 });
}

export function handleProjectRegistryApi(
  req: IncomingMessage,
  res: ServerResponse,
  options: ManagementApiOptions,
  pathname: string,
  handlers: ProjectRegistryApiHandlers,
): boolean {
  if (!pathname.startsWith('/api/projects')) {
    return false;
  }

  const registry = handlers.getProjectRegistryForRequest(options);
  if (handleProjectFolderBrowserApi(req, res, pathname, getRequestUrl(req))) {
    return true;
  }

  try {
    handlers.ensureDefaultRegisteredProject(options);
  } catch (error) {
    if (!readMakeClientMarker(options.projectRoot)) {
      sendProjectMetadataError(res, error, { projectRoot: options.projectRoot });
      return true;
    }
  }

  if (handleMakeClientProjectApi(req, res, options, pathname, registry, {
    addOrUpdateMakeClientRegistryProject: (params) => handlers.addOrUpdateRegistryProjectByRoot(registry, {
      ...params,
      metadataPath: params.metadataPath || getProjectMetadataPath(params.root),
    }),
    toProjectEntry: handlers.toProjectEntry,
  })) {
    return true;
  }

  if (pathname === '/api/projects/select-root' && req.method === 'POST') {
    const kind = String(getRequestUrl(req).searchParams.get('kind') || '').trim();
    handlers.selectLocalProjectRootForKind(kind || 'existing')
      .then((root) => sendJson(res, root ? { root } : { root: null, cancelled: true }))
      .catch((error) => sendJson(res, {
        error: error.message,
        code: 'LOCAL_PROJECT_PICKER_UNAVAILABLE',
        ...getLocalCommandErrorPayload(error),
      }, { status: 501 }));
    return true;
  }

  try {
    handlers.ensureDefaultRegisteredProject(options);
  } catch (error) {
    sendProjectMetadataError(res, error, { projectRoot: options.projectRoot });
    return true;
  }

  if (pathname === '/api/projects' && req.method === 'GET') {
    const data = registry.getRegistry();
    Promise.all(data.projects.map(async (project) => ({
      ...handlers.toProjectEntry(project),
      runtimeStatus: await getMakeClientDevStatus(project.id, project.root),
    })))
      .then((projects) => sendJson(res, {
        activeProjectId: data.activeProjectId,
        projects,
      }))
      .catch((error) => sendJson(res, { error: error.message }, { status: 500 }));
    return true;
  }

  if (pathname === '/api/projects' && req.method === 'POST') {
    sendJson(res, {
      error: 'Generic project registration is no longer supported. Register an official Make client project instead.',
      code: 'MAKE_CLIENT_PROJECT_REQUIRED',
      route: '/api/projects/make/register-existing',
    }, { status: 410 });
    return true;
  }

  if (pathname === '/api/projects/active') {
    if (req.method === 'GET') {
      const activeProject = registry.getActiveProject();
      sendJson(res, activeProject ? { ...activeProject } : {});
      return true;
    }
    if (req.method === 'PUT') {
      readJsonBody(req).then((body) => {
        const projectId = String(body?.projectId || body?.id || '').trim();
        if (!projectId) {
          sendJson(res, { error: 'Missing projectId' }, { status: 400 });
          return;
        }
        registry.setActiveProject(projectId);
        sendJson(res, { activeProject: registry.getActiveProject() });
      }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
      return true;
    }
  }

  const match = pathname.match(/^\/api\/projects\/([^/]+)(?:\/(.*))?$/u);
  if (!match) {
    return false;
  }
  const projectId = decodeURIComponent(match[1]);
  const rest = match[2] || '';
  const project = registry.getProject(projectId);
  if (!project) {
    sendJson(res, {
      error: `Project not found: ${projectId}`,
      code: 'project-not-found',
      projectId,
    }, { status: 404 });
    return true;
  }

  if (handleMakeClientProjectApi(req, res, options, pathname, registry, {
    addOrUpdateMakeClientRegistryProject: (params) => handlers.addOrUpdateRegistryProjectByRoot(registry, {
      ...params,
      metadataPath: params.metadataPath || getProjectMetadataPath(params.root),
    }),
    toProjectEntry: handlers.toProjectEntry,
  }, { projectId, rest, project })) {
    return true;
  }

  if (!rest && req.method === 'PATCH') {
    readJsonBody(req).then((body) => {
      let updated = registry.updateProject(projectId, {
        ...(typeof body?.root === 'string' ? { root: body.root } : {}),
        ...(typeof body?.metadataPath === 'string' ? { metadataPath: body.metadataPath } : {}),
      });
      if (typeof body?.name === 'string') {
        updated = handlers.updateRegisteredProjectTitle(options, updated, body.name);
      }
      sendJson(res, { project: handlers.toProjectEntry(updated) });
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  if (!rest && req.method === 'DELETE') {
    registry.removeProject(projectId);
    sendJson(res, { success: true });
    return true;
  }

  if (rest.startsWith('communication/')) {
    const metadataStore = handlers.getExistingMetadataStore(res, project);
    if (!metadataStore) {
      return true;
    }
    metadataStore.getMetadata();
    const communicationStore = createProjectCommunicationStore(project.root);
    const communicationTarget = rest.slice('communication/'.length);
    if (req.method !== 'POST') {
      return false;
    }
    readJsonBody(req).then((body) => {
      const baseInput = {
        projectId,
        resourceId: typeof body?.resourceId === 'string' ? body.resourceId : undefined,
        resourceType: typeof body?.resourceType === 'string' ? body.resourceType : undefined,
        status: typeof body?.status === 'string' ? body.status : 'pending',
        errorMessage: typeof body?.errorMessage === 'string' ? body.errorMessage : typeof body?.error === 'string' ? body.error : '',
        timestamp: typeof body?.timestamp === 'string' ? body.timestamp : undefined,
      };
      let result;
      if (communicationTarget === 'sessions') {
        result = communicationStore.appendSessionRecord({
          ...baseInput,
          clientUrlOrigin: typeof body?.clientUrlOrigin === 'string' ? body.clientUrlOrigin : undefined,
          runtimeVersion: typeof body?.runtimeVersion === 'string' ? body.runtimeVersion : undefined,
          messageType: typeof body?.messageType === 'string' ? body.messageType : undefined,
          diagnosticOnly: body?.diagnosticOnly === true,
        });
      } else if (communicationTarget === 'exports') {
        result = communicationStore.appendExportRecord({
          ...baseInput,
          operationType: typeof body?.operationType === 'string' ? body.operationType : 'export',
          metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
        });
      } else if (communicationTarget === 'edit-history') {
        result = communicationStore.appendEditHistoryRecord({
          ...baseInput,
          operationType: typeof body?.operationType === 'string' ? body.operationType : 'quickEdit',
          metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
        });
      } else if (communicationTarget === 'runtime-message') {
        result = communicationStore.appendRuntimeMessageRecord({
          ...baseInput,
          messageType: typeof body?.messageType === 'string' ? body.messageType : 'axhub.quickEdit.unknown',
        });
      } else {
        sendJson(res, { error: 'Unknown communication record target' }, { status: 404 });
        return;
      }
      sendJson(res, {
        success: true,
        kind: result.kind,
        record: result.record,
        filePath: result.filePath,
      }, { status: 201 });
    }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
    return true;
  }

  if (rest === 'resources') {
    const metadataStore = handlers.getExistingMetadataStore(res, project);
    if (!metadataStore) {
      return true;
    }
    if (req.method === 'GET') {
      const metadata = backfillMakeClientResourcePreviewLinks(
        reconcileMetadataWithFilesystem(metadataStore, project.root),
        project.root,
        options.runtimeOrigin,
      );
      sendJson(res, {
        project: handlers.toProjectIdentity(project),
        resources: createProjectResourcesPayload(metadata, project.root),
        navigation: metadata.navigation,
        orders: metadata.orders,
        capabilities: handlers.createEffectiveProjectCapabilities({ project, metadata, metadataStore }),
      });
      return true;
    }
    if (req.method === 'PUT') {
      readJsonBody(req).then((body) => {
        const current = metadataStore.getMetadata();
        const updated = metadataStore.saveMetadata({
          ...current,
          resources: body?.resources ?? current.resources,
          navigation: body?.navigation ?? current.navigation,
          orders: body?.orders ?? current.orders,
          capabilities: body?.capabilities ?? current.capabilities,
        });
        sendJson(res, {
          project: handlers.toProjectIdentity(project),
          resources: updated.resources,
          navigation: updated.navigation,
          orders: updated.orders,
          capabilities: handlers.createEffectiveProjectCapabilities({ project, metadata: updated, metadataStore }),
        });
      }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
      return true;
    }
  }

  const docMatch = rest.match(/^docs\/([^/]+)\/content$/u);
  if (docMatch) {
    const metadataStore = handlers.getExistingMetadataStore(res, project);
    if (!metadataStore) {
      return true;
    }
    const resourceId = decodeURIComponent(docMatch[1]);
    const metadata = metadataStore.getMetadata();
    const doc = metadata.resources.docs.find((item) => item.id === resourceId || item.name === resourceId);
    if (!doc) {
      sendJson(res, { error: 'Doc not found' }, { status: 404 });
      return true;
    }
    if (!isPathInside(project.root, doc.path)) {
      sendJson(res, {
        error: 'Doc path is outside project root',
        code: 'DOC_PATH_OUTSIDE_PROJECT',
        projectId,
        resourceId: doc.id,
        path: doc.path,
        projectRoot: project.root,
      }, { status: 403 });
      return true;
    }
    if (req.method === 'GET') {
      if (!fs.existsSync(doc.path)) {
        sendJson(res, {
          error: 'Doc file not found',
          code: 'DOC_FILE_MISSING',
          projectId,
          resourceId: doc.id,
          path: doc.path,
        }, { status: 404 });
        return true;
      }
      sendJson(res, { content: fs.readFileSync(doc.path, 'utf8'), path: doc.path });
      return true;
    }
    if (req.method === 'PUT') {
      readJsonBody(req).then((body) => {
        fs.writeFileSync(doc.path, String(body?.content ?? ''), 'utf8');
        sendJson(res, { success: true, path: doc.path });
      }).catch((error) => sendJson(res, { error: error.message }, { status: 400 }));
      return true;
    }
  }

  return false;
}
