import fs from 'node:fs';
import path from 'node:path';

import {
  getProjectMetadataPath,
  resolveProjectRoot,
} from './paths.ts';

export type ProjectResourceType = 'prototypes' | 'docs' | 'themes' | 'data' | 'templates';
export type ProjectResourceWriteTargetType = ProjectResourceType | 'media';
export type PrototypePreviewMode = 'clientRuntime';

export interface PrototypeResourceArtifacts {
  [key: string]: unknown;
}

export interface PrototypeResourceSpec {
  path: string;
  title?: string;
}

export interface PrototypeResourcePage {
  id: string;
  title: string;
}

export interface PrototypePlaceholderGuide {
  kind: string;
  title: string;
  description: string;
  steps: string[];
  tips: string[];
}

export interface PrototypeResource {
  id: string;
  name: string;
  title: string;
  clientUrl: string;
  previewMode: PrototypePreviewMode;
  description: string;
  updatedAt: string;
  placeholder?: boolean;
  placeholderGuide?: PrototypePlaceholderGuide;
  filePath?: string;
  absoluteFilePath?: string;
  spec?: PrototypeResourceSpec;
  artifacts?: PrototypeResourceArtifacts;
  pages?: PrototypeResourcePage[];
  defaultPageId?: string;
}

export interface DocResource {
  id: string;
  name: string;
  title: string;
  path: string;
  description: string;
  updatedAt: string;
}

export interface GenericProjectResource {
  id: string;
  name?: string;
  title?: string;
  [key: string]: unknown;
}

/**
 * Project metadata describes resources and capabilities owned by .axhub/make/project.json.
 *
 * capabilities.resourceWrites are normalized effective server write switches.
 * Project files do not need to declare them; make-server derives write support
 * from resourceWriteTargets plus implemented routes.
 * resourceWriteTargets are write destinations, such as docs.path = "src/docs".
 *
 * navigation stores prototypes/docs display order.
 * orders stores themes/data/templates display order.
 *
 * server and projectInfo belong to .axhub/make/axhub.config.json. They are
 * project runtime/display config, not project metadata fields.
 */
export interface ProjectMetadata {
  schemaVersion: 1;
  project: {
    id: string;
    name: string;
  };
  resources: {
    prototypes: PrototypeResource[];
    docs: DocResource[];
    themes: GenericProjectResource[];
    data: GenericProjectResource[];
    templates: GenericProjectResource[];
  };
  navigation: {
    prototypes: string[];
    docs: string[];
  };
  orders: {
    themes: string[];
    data: string[];
    templates: string[];
  };
  capabilities: {
    quickEdit: boolean;
    quickEditMode: PrototypePreviewMode;
    figmaExport: boolean;
    axureExport: boolean;
    localExports: LocalExportCapabilities;
    resourceWrites: ResourceWriteCapabilities;
  };
  resourceWriteTargets: ProjectResourceWriteTargets;
}

export interface ProjectResourceWriteTarget {
  type: 'project-relative-path';
  path: string;
}

export type ProjectResourceWriteTargets = Partial<Record<ProjectResourceWriteTargetType, ProjectResourceWriteTarget>>;

export interface ResourceWriteCapabilities {
  prototypeCreate: boolean;
  prototypeUpload: boolean;
  docCreate: boolean;
  docImport: boolean;
  themeCreate: boolean;
  themeImport: boolean;
  dataCreate: boolean;
  dataImport: boolean;
  templateCreate: boolean;
  templateDuplicate: boolean;
}

export interface LocalExportCapabilities {
  html: boolean;
  make: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readJsonFile(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(stringValue).filter(Boolean) : [];
}

const PAGE_ID_RE = /^[a-z0-9-]+$/u;

function normalizePageId(value: unknown): string {
  const id = stringValue(value);
  return PAGE_ID_RE.test(id) ? id : '';
}

function createDefaultMetadata(projectRoot: string): ProjectMetadata {
  const name = path.basename(resolveProjectRoot(projectRoot)) || 'project';
  return {
    schemaVersion: 1,
    project: {
      id: name,
      name,
    },
    resources: {
      prototypes: [],
      docs: [],
      themes: [],
      data: [],
      templates: [],
    },
    navigation: {
      prototypes: [],
      docs: [],
    },
    orders: {
      themes: [],
      data: [],
      templates: [],
    },
    capabilities: {
      quickEdit: true,
      quickEditMode: 'clientRuntime',
      figmaExport: true,
      axureExport: true,
      localExports: createDefaultLocalExportCapabilities(),
      resourceWrites: createDefaultResourceWriteCapabilities(),
    },
    resourceWriteTargets: {},
  };
}

function createDefaultLocalExportCapabilities(): LocalExportCapabilities {
  return {
    html: false,
    make: false,
  };
}

function createDefaultResourceWriteCapabilities(): ResourceWriteCapabilities {
  return {
    prototypeCreate: false,
    prototypeUpload: false,
    docCreate: false,
    docImport: false,
    themeCreate: false,
    themeImport: false,
    dataCreate: false,
    dataImport: false,
    templateCreate: false,
    templateDuplicate: false,
  };
}

function normalizeLocalExportCapabilities(value: unknown): LocalExportCapabilities {
  const defaults = createDefaultLocalExportCapabilities();
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    html: typeof raw.html === 'boolean' ? raw.html : defaults.html,
    make: typeof raw.make === 'boolean' ? raw.make : defaults.make,
  };
}

function normalizeResourceWriteCapabilities(value: unknown): ResourceWriteCapabilities {
  const defaults = createDefaultResourceWriteCapabilities();
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    prototypeCreate: typeof raw.prototypeCreate === 'boolean' ? raw.prototypeCreate : defaults.prototypeCreate,
    prototypeUpload: typeof raw.prototypeUpload === 'boolean' ? raw.prototypeUpload : defaults.prototypeUpload,
    docCreate: typeof raw.docCreate === 'boolean' ? raw.docCreate : defaults.docCreate,
    docImport: typeof raw.docImport === 'boolean' ? raw.docImport : defaults.docImport,
    themeCreate: typeof raw.themeCreate === 'boolean' ? raw.themeCreate : defaults.themeCreate,
    themeImport: typeof raw.themeImport === 'boolean' ? raw.themeImport : defaults.themeImport,
    dataCreate: typeof raw.dataCreate === 'boolean' ? raw.dataCreate : defaults.dataCreate,
    dataImport: typeof raw.dataImport === 'boolean' ? raw.dataImport : defaults.dataImport,
    templateCreate: typeof raw.templateCreate === 'boolean' ? raw.templateCreate : defaults.templateCreate,
    templateDuplicate: typeof raw.templateDuplicate === 'boolean' ? raw.templateDuplicate : defaults.templateDuplicate,
  };
}

function isDefaultResourceWriteCapabilities(value: ResourceWriteCapabilities): boolean {
  const defaults = createDefaultResourceWriteCapabilities();
  return (Object.keys(defaults) as Array<keyof ResourceWriteCapabilities>)
    .every((key) => value[key] === defaults[key]);
}

function serializeMetadataForWrite(metadata: ProjectMetadata): ProjectMetadata | Record<string, unknown> {
  if (!isDefaultResourceWriteCapabilities(metadata.capabilities.resourceWrites)) {
    return metadata;
  }
  const { resourceWrites: _resourceWrites, ...capabilities } = metadata.capabilities;
  return {
    ...metadata,
    capabilities,
  };
}

function normalizeGenericResources(value: unknown): GenericProjectResource[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => {
      const id = stringValue(item.id) || stringValue(item.name);
      if (!id) {
        return null;
      }
      return {
        ...item,
        id,
        ...(stringValue(item.name) ? { name: stringValue(item.name) } : {}),
        ...(stringValue(item.title) ? { title: stringValue(item.title) } : {}),
      };
    })
    .filter((item): item is GenericProjectResource => Boolean(item));
}

function isInsideProjectRoot(projectRoot: string, targetPath: string): boolean {
  const relative = path.relative(projectRoot, targetPath);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function normalizePrototypeSpec(projectRoot: string, resourceId: string, value: unknown): PrototypeResourceSpec | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const specPath = stringValue(raw.path);
  if (!specPath) {
    return undefined;
  }

  const normalizedSpecPath = specPath.replace(/\\/g, path.sep);
  const resolvedSpecPath = path.resolve(path.isAbsolute(normalizedSpecPath)
    ? normalizedSpecPath
    : path.join(projectRoot, normalizedSpecPath));
  if (!isInsideProjectRoot(projectRoot, resolvedSpecPath)) {
    throw new Error(`Prototype spec ${resourceId} is outside project root`);
  }
  if (path.extname(resolvedSpecPath).toLowerCase() !== '.md') {
    throw new Error(`Prototype spec ${resourceId} must use a Markdown path`);
  }

  const title = stringValue(raw.title);
  return {
    path: resolvedSpecPath,
    ...(title ? { title } : {}),
  };
}

function normalizePrototypePlaceholderGuide(value: unknown): PrototypePlaceholderGuide | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const kind = stringValue(raw.kind);
  const title = stringValue(raw.title);
  const description = stringValue(raw.description);
  if (!kind || !title || !description) {
    return undefined;
  }
  return {
    kind,
    title,
    description,
    steps: stringList(raw.steps),
    tips: stringList(raw.tips),
  };
}

function normalizePrototypeRoutePages(value: unknown): PrototypeResourcePage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => {
      const id = normalizePageId(item.id);
      const title = stringValue(item.title);
      return id && title ? { id, title } : null;
    })
    .filter((item): item is PrototypeResourcePage => Boolean(item));
}

function normalizePrototypeResources(value: unknown, projectRoot: string): PrototypeResource[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => {
      const id = stringValue(item.id) || stringValue(item.name);
      const name = stringValue(item.name) || id;
      const title = stringValue(item.title) || name;
      const clientUrl = stringValue(item.clientUrl);
      if (!id || !name || !title || !clientUrl) {
        return null;
      }
      const filePath = stringValue(item.filePath);
      const absoluteFilePath = stringValue(item.absoluteFilePath);
      const artifacts = item.artifacts && typeof item.artifacts === 'object' && !Array.isArray(item.artifacts)
        ? item.artifacts as PrototypeResourceArtifacts
        : null;
      const spec = normalizePrototypeSpec(projectRoot, id, item.spec);
      const placeholderGuide = normalizePrototypePlaceholderGuide(item.placeholderGuide);
      const pages = normalizePrototypeRoutePages(item.pages);
      const requestedDefaultPageId = normalizePageId(item.defaultPageId);
      const defaultPageId = pages.some((page) => page.id === requestedDefaultPageId)
        ? requestedDefaultPageId
        : pages[0]?.id || '';
      return {
        id,
        name,
        title,
        clientUrl,
        previewMode: 'clientRuntime' as const,
        description: stringValue(item.description),
        updatedAt: stringValue(item.updatedAt) || nowIso(),
        ...(item.placeholder === true ? { placeholder: true } : {}),
        ...(placeholderGuide ? { placeholderGuide } : {}),
        ...(filePath ? { filePath } : {}),
        ...(absoluteFilePath ? { absoluteFilePath } : {}),
        ...(spec ? { spec } : {}),
        ...(artifacts ? { artifacts } : {}),
        ...(pages.length > 0 ? { pages, defaultPageId } : {}),
      };
    })
    .filter((item): item is PrototypeResource => Boolean(item));
}

function normalizeDocResources(value: unknown, projectRoot: string): DocResource[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => {
      const id = stringValue(item.id) || stringValue(item.name);
      const name = stringValue(item.name) || id;
      const title = stringValue(item.title) || name;
      const docPath = stringValue(item.path);
      if (!id || !name || !title || !docPath) {
        return null;
      }
      const normalizedDocPath = docPath.replace(/\\/g, path.sep);
      if (/^[a-z][a-z0-9+.-]*:/iu.test(normalizedDocPath)) {
        return null;
      }
      const resolvedDocPath = path.resolve(path.isAbsolute(normalizedDocPath)
        ? normalizedDocPath
        : path.join(projectRoot, normalizedDocPath));
      if (!isInsideProjectRoot(projectRoot, resolvedDocPath)) {
        throw new Error(`Doc resource ${id} is outside project root`);
      }
      return {
        id,
        name,
        title,
        path: resolvedDocPath,
        description: stringValue(item.description),
        updatedAt: stringValue(item.updatedAt) || nowIso(),
      };
    })
    .filter((item): item is DocResource => Boolean(item));
}

function normalizeProjectRelativeWriteTargetPath(projectRoot: string, resourceType: string, value: unknown): string {
  const rawPath = stringValue(value);
  if (!rawPath) {
    return '';
  }
  if (path.isAbsolute(rawPath)) {
    throw new Error(`Resource write target ${resourceType} must use a project-relative path`);
  }
  const normalized = path.posix.normalize(rawPath.replace(/\\/g, '/'));
  const trimmed = normalized.replace(/^\.\/+/u, '').replace(/\/+$/u, '');
  if (!trimmed || trimmed === '.') {
    return '';
  }
  const resolved = path.resolve(projectRoot, trimmed);
  const relative = path.relative(projectRoot, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Resource write target ${resourceType} is outside project root`);
  }
  return trimmed;
}

function normalizeResourceWriteTargets(value: unknown, projectRoot: string): ProjectResourceWriteTargets {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const result: ProjectResourceWriteTargets = {};
  const keys: ProjectResourceWriteTargetType[] = ['docs', 'templates', 'themes', 'data', 'media', 'prototypes'];

  for (const key of keys) {
    const target = raw[key];
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      continue;
    }
    const targetRecord = target as Record<string, unknown>;
    const targetType = stringValue(targetRecord.type) || 'project-relative-path';
    if (targetType !== 'project-relative-path') {
      throw new Error(`Resource write target ${key} has unsupported type: ${targetType}`);
    }
    const targetPath = normalizeProjectRelativeWriteTargetPath(projectRoot, key, targetRecord.path);
    if (!targetPath) {
      continue;
    }
    result[key] = {
      type: 'project-relative-path',
      path: targetPath,
    };
  }

  return result;
}

function normalizeMetadata(data: unknown, projectRoot: string): ProjectMetadata {
  const defaults = createDefaultMetadata(projectRoot);
  if (!data || typeof data !== 'object') {
    return defaults;
  }
  const parsed = data as any;
  const resources = parsed.resources && typeof parsed.resources === 'object' ? parsed.resources : {};
  const navigation = parsed.navigation && typeof parsed.navigation === 'object' ? parsed.navigation : {};
  const orders = parsed.orders && typeof parsed.orders === 'object' ? parsed.orders : {};
  const capabilities = parsed.capabilities && typeof parsed.capabilities === 'object' ? parsed.capabilities : {};
  const project = parsed.project && typeof parsed.project === 'object' ? parsed.project : {};
  const docs = normalizeDocResources(resources.docs, projectRoot);
  return {
    schemaVersion: 1,
    project: {
      id: stringValue(project.id) || defaults.project.id,
      name: typeof project.name === 'string' ? project.name.trim() : stringValue(project.id) || defaults.project.name,
    },
    resources: {
      prototypes: normalizePrototypeResources(resources.prototypes, projectRoot),
      docs,
      themes: normalizeGenericResources(resources.themes),
      data: normalizeGenericResources(resources.data),
      templates: normalizeGenericResources(resources.templates),
    },
    navigation: {
      prototypes: stringList(navigation.prototypes),
      docs: stringList(navigation.docs),
    },
    orders: {
      themes: stringList(orders.themes),
      data: stringList(orders.data),
      templates: stringList(orders.templates),
    },
    capabilities: {
      quickEdit: typeof capabilities.quickEdit === 'boolean' ? capabilities.quickEdit : defaults.capabilities.quickEdit,
      quickEditMode: 'clientRuntime',
      figmaExport: typeof capabilities.figmaExport === 'boolean' ? capabilities.figmaExport : defaults.capabilities.figmaExport,
      axureExport: typeof capabilities.axureExport === 'boolean' ? capabilities.axureExport : defaults.capabilities.axureExport,
      localExports: normalizeLocalExportCapabilities(capabilities.localExports),
      resourceWrites: normalizeResourceWriteCapabilities(capabilities.resourceWrites),
    },
    resourceWriteTargets: normalizeResourceWriteTargets(parsed.resourceWriteTargets, projectRoot),
  };
}

export function createProjectMetadataStore(projectRoot: string, options?: { metadataPath?: string }) {
  const resolvedProjectRoot = resolveProjectRoot(projectRoot);
  const metadataPath = options?.metadataPath ? path.resolve(options.metadataPath) : getProjectMetadataPath(resolvedProjectRoot);

  const getMetadata = () => normalizeMetadata(readJsonFile(metadataPath), resolvedProjectRoot);

  return {
    getMetadataPath() {
      return metadataPath;
    },
    getMetadata,
    saveMetadata(metadata: unknown) {
      const normalized = normalizeMetadata(metadata, resolvedProjectRoot);
      writeJsonAtomic(metadataPath, serializeMetadataForWrite(normalized));
      return normalized;
    },
  };
}
