import fs from 'node:fs';
import path from 'node:path';

import { getEntriesManifestPath, getSidebarTreeStorePath } from './paths.ts';

export type SidebarTreeTab = 'prototypes' | 'components' | 'docs' | 'canvas' | 'themes';
export type ProjectMetadataSidebarTreeTab = 'prototypes' | 'docs';
export type ResourceOrderType = 'themes' | 'data' | 'templates';
export type SidebarTreeNodeKind = 'folder' | 'item';
export type SidebarTreeStoreModel = 'legacy' | 'project-metadata';

export interface SidebarTreeNode {
  id: string;
  kind: SidebarTreeNodeKind;
  title: string;
  itemKey?: string;
  path?: string;
  folderPath?: string;
  children?: SidebarTreeNode[];
}

export interface SidebarTreeStore {
  version: number;
  updatedAt: string;
  prototypes: SidebarTreeNode[];
  components?: SidebarTreeNode[];
  docs: SidebarTreeNode[];
  canvas?: SidebarTreeNode[];
  themesTree?: SidebarTreeNode[];
  themes: string[];
  data: string[];
  templates: string[];
}

interface EntriesWithLegacySidebarTree {
  sidebarTree?: {
    version?: number;
    prototypes?: SidebarTreeNode[];
    components?: SidebarTreeNode[];
    docs?: SidebarTreeNode[];
    canvas?: SidebarTreeNode[];
    themes?: string[];
    data?: string[];
    templates?: string[];
  };
}

interface SidebarTreeStoreOptions {
  version: number;
  legacyEntriesPath: string;
  model: SidebarTreeStoreModel;
  storePath: string;
}

function createDefaultStore(version: number, model: SidebarTreeStoreModel): SidebarTreeStore {
  const store: SidebarTreeStore = {
    version,
    updatedAt: new Date().toISOString(),
    prototypes: [],
    docs: [],
    themesTree: [],
    themes: [],
    data: [],
    templates: [],
  };
  if (model === 'legacy') {
    store.components = [];
    store.canvas = [];
  }
  return store;
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

function cloneTree(nodes: SidebarTreeNode[]): SidebarTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    children: Array.isArray(node.children) ? cloneTree(node.children) : undefined,
  }));
}

function normalizeStore(data: unknown, version: number, model: SidebarTreeStoreModel): SidebarTreeStore | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const parsed = data as Partial<SidebarTreeStore>;
  const updatedAt = typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim()
    ? parsed.updatedAt
    : new Date().toISOString();

  const store: SidebarTreeStore = {
    version,
    updatedAt,
    prototypes: Array.isArray(parsed.prototypes) ? cloneTree(parsed.prototypes) : [],
    docs: Array.isArray(parsed.docs) ? cloneTree(parsed.docs) : [],
    themesTree: Array.isArray(parsed.themesTree) ? cloneTree(parsed.themesTree) : [],
    themes: Array.isArray(parsed.themes) ? parsed.themes.filter((key): key is string => typeof key === 'string') : [],
    data: Array.isArray(parsed.data) ? parsed.data.filter((key): key is string => typeof key === 'string') : [],
    templates: Array.isArray(parsed.templates) ? parsed.templates.filter((key): key is string => typeof key === 'string') : [],
  };
  if (model === 'legacy') {
    store.components = Array.isArray(parsed.components) ? cloneTree(parsed.components) : [];
    store.canvas = Array.isArray(parsed.canvas) ? cloneTree(parsed.canvas) : [];
  }
  return store;
}

function readLegacySidebarTree(legacyEntriesPath: string, version: number, model: SidebarTreeStoreModel): SidebarTreeStore | null {
  const data = readJsonFile(legacyEntriesPath);
  if (!data || typeof data !== 'object') {
    return null;
  }

  const legacy = (data as EntriesWithLegacySidebarTree).sidebarTree;
  if (!legacy || typeof legacy !== 'object') {
    return null;
  }

  const store: SidebarTreeStore = {
    version,
    updatedAt: new Date().toISOString(),
    prototypes: Array.isArray(legacy.prototypes) ? cloneTree(legacy.prototypes) : [],
    docs: Array.isArray(legacy.docs) ? cloneTree(legacy.docs) : [],
    themes: Array.isArray(legacy.themes) ? legacy.themes.filter((key): key is string => typeof key === 'string') : [],
    data: Array.isArray(legacy.data) ? legacy.data.filter((key): key is string => typeof key === 'string') : [],
    templates: Array.isArray(legacy.templates) ? legacy.templates.filter((key): key is string => typeof key === 'string') : [],
  };
  if (model === 'legacy') {
    store.components = Array.isArray(legacy.components) ? cloneTree(legacy.components) : [];
    store.canvas = Array.isArray(legacy.canvas) ? cloneTree(legacy.canvas) : [];
  }
  return store;
}

function writeStoreAtomic(storePath: string, store: SidebarTreeStore): void {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tempPath, storePath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

function resolveOptions(projectRoot: string, options?: Partial<SidebarTreeStoreOptions>): SidebarTreeStoreOptions {
  return {
    version: options?.version ?? 1,
    legacyEntriesPath: options?.legacyEntriesPath ?? getEntriesManifestPath(projectRoot),
    model: options?.model ?? 'legacy',
    storePath: options?.storePath ?? getSidebarTreeStorePath(projectRoot),
  };
}

function assertTreeTabAllowed(model: SidebarTreeStoreModel, tab: SidebarTreeTab): asserts tab is SidebarTreeTab {
  if (model === 'project-metadata' && (tab === 'components' || tab === 'canvas')) {
    throw new Error(`${tab} is not part of the project metadata sidebar model`);
  }
}

export function createSidebarTreeStore(projectRoot: string, options?: Partial<SidebarTreeStoreOptions>) {
  const resolved = resolveOptions(projectRoot, options);

  const ensureStore = (): SidebarTreeStore => {
    const loaded = normalizeStore(readJsonFile(resolved.storePath), resolved.version, resolved.model);
    if (loaded) {
      return loaded;
    }

    const migrated = readLegacySidebarTree(resolved.legacyEntriesPath, resolved.version, resolved.model);
    const nextStore = migrated || createDefaultStore(resolved.version, resolved.model);
    writeStoreAtomic(resolved.storePath, nextStore);
    return nextStore;
  };

  const saveStore = (store: SidebarTreeStore) => {
    const nextStore: SidebarTreeStore = {
      version: resolved.version,
      updatedAt: new Date().toISOString(),
      prototypes: cloneTree(store.prototypes),
      docs: cloneTree(store.docs),
      themesTree: cloneTree(store.themesTree || []),
      themes: Array.isArray(store.themes) ? [...store.themes] : [],
      data: Array.isArray(store.data) ? [...store.data] : [],
      templates: Array.isArray(store.templates) ? [...store.templates] : [],
    };
    if (resolved.model === 'legacy') {
      nextStore.components = cloneTree(store.components || []);
      nextStore.canvas = cloneTree(store.canvas || []);
    }
    writeStoreAtomic(resolved.storePath, nextStore);
    return nextStore;
  };

  return {
    getStorePath() {
      return resolved.storePath;
    },
    getStore() {
      return ensureStore();
    },
    getTree(tab: SidebarTreeTab) {
      assertTreeTabAllowed(resolved.model, tab);
      const store = ensureStore();
      const storeKey = tab === 'themes' ? 'themesTree' : tab;
      return cloneTree((store as any)[storeKey] || []);
    },
    setTree(tab: SidebarTreeTab, tree: SidebarTreeNode[]) {
      assertTreeTabAllowed(resolved.model, tab);
      const store = ensureStore();
      const storeKey = tab === 'themes' ? 'themesTree' : tab;
      return saveStore({
        ...store,
        [storeKey]: cloneTree(tree),
      });
    },
    getResourceOrder(type: ResourceOrderType) {
      const store = ensureStore();
      return Array.isArray(store[type]) ? [...store[type]] : [];
    },
    setResourceOrder(type: ResourceOrderType, order: string[]) {
      const store = ensureStore();
      return saveStore({
        ...store,
        [type]: Array.isArray(order) ? [...order] : [],
      });
    },
  };
}
