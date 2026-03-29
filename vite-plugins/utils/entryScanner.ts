import fs from 'fs';
import path from 'path';
import { getDisplayName } from './fileUtils';
import { migrateLegacyEntries, toCompatMaps } from './entriesManifest';
import { parseParentChild, readPagesConfig, type PageConfig } from './subPageUtils';

export type SidebarTreeTab = 'prototypes' | 'components' | 'docs' | 'canvas';
type ScannableGroup = 'components' | 'prototypes' | 'themes';

export interface ScannedEntryItem {
  name: string;
  displayName: string;
  demoUrl: string;
  specUrl: string;
  jsUrl: string;
  filePath: string;
  isReference?: boolean;
  parent?: string;
  isSubPage?: boolean;
}

export interface EntriesFileData extends Record<string, unknown> {
  schemaVersion?: number;
  generatedAt?: string;
  items?: Record<string, {
    group?: string;
    name?: string;
    js?: string;
    html?: string;
  }>;
  js?: Record<string, string>;
  html?: Record<string, string>;
}

export interface EntryScanResult {
  entries: {
    js: Record<string, string>;
    html: Record<string, string>;
  };
  items: Record<SidebarTreeTab, ScannedEntryItem[]>;
}

const MANIFEST_SCANNED_GROUPS: ScannableGroup[] = ['components', 'prototypes', 'themes'];

function encodeUrlPathSegments(value: string): string {
  return value
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function isScannedGroupKey(key: string): boolean {
  return MANIFEST_SCANNED_GROUPS.some((group) => key.startsWith(`${group}/`));
}

function scanGroup(projectRoot: string, group: ScannableGroup): {
  entries: { js: Record<string, string>; html: Record<string, string> };
  items: ScannedEntryItem[];
} {
  const groupDir = path.resolve(projectRoot, 'src', group);
  const entries = { js: {} as Record<string, string>, html: {} as Record<string, string> };
  const items: Array<ScannedEntryItem & {
    sortGroup: string;
    sortRank: number;
    sortName: string;
  }> = [];
  const pageConfigCache = new Map<string, PageConfig | null>();

  if (!fs.existsSync(groupDir)) {
    return { entries, items };
  }

  const names = fs
    .readdirSync(groupDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  for (const name of names) {
    const folderPath = path.join(groupDir, name);
    const jsEntry = path.join(folderPath, 'index.tsx');
    if (!fs.existsSync(jsEntry)) {
      continue;
    }

    const key = `${group}/${name}`;
    entries.js[key] = jsEntry;
    entries.html[key] = path.join(folderPath, 'index.html');

    let displayName = getDisplayName(jsEntry) || name;
    const encodedKey = encodeUrlPathSegments(key);
    let parent: string | undefined;
    let isSubPage: boolean | undefined;
    let sortGroup = name;
    let sortRank = 0;
    let sortName = name;

    if (group === 'prototypes') {
      const relation = parseParentChild(name);
      if (relation) {
        parent = relation.parent;
        isSubPage = true;
        sortGroup = relation.parent;
        sortRank = 1;
        sortName = relation.child;

        const parentDir = path.join(groupDir, relation.parent);
        const cacheKey = parentDir;
        if (!pageConfigCache.has(cacheKey)) {
          pageConfigCache.set(cacheKey, readPagesConfig(parentDir));
        }
        const pageConfig = pageConfigCache.get(cacheKey);
        const configuredPageIndex = pageConfig?.pages?.findIndex((page) => page.name === relation.child) ?? -1;
        const configuredPage = configuredPageIndex >= 0 ? pageConfig?.pages?.[configuredPageIndex] : undefined;
        if (configuredPage?.displayName) {
          displayName = configuredPage.displayName;
        } else {
          displayName = relation.child;
        }
        if (configuredPageIndex >= 0) {
          sortRank = configuredPageIndex + 1;
        } else {
          sortRank = 1000;
        }
      }
    }

    items.push({
      name,
      displayName,
      demoUrl: `/${encodedKey}`,
      specUrl: `/${encodedKey}/spec`,
      jsUrl: `/build/${encodedKey}.js`,
      filePath: jsEntry,
      isReference: name.startsWith('ref-'),
      parent,
      isSubPage,
      sortGroup,
      sortRank,
      sortName,
    });
  }

  items.sort((a, b) => {
    const groupCompare = a.sortGroup.localeCompare(b.sortGroup);
    if (groupCompare !== 0) {
      return groupCompare;
    }

    if (a.sortRank !== b.sortRank) {
      return a.sortRank - b.sortRank;
    }

    const nameCompare = a.sortName.localeCompare(b.sortName);
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return a.name.localeCompare(b.name);
  });

  return {
    entries,
    items: items.map(({ sortGroup, sortRank, sortName, ...item }) => item),
  };
}

export function scanEntries(projectRoot: string): EntryScanResult {
  const result: EntryScanResult = {
    entries: { js: {}, html: {} },
    items: {
      components: [],
      prototypes: [],
      docs: [],
      canvas: [],
    },
  };

  for (const group of MANIFEST_SCANNED_GROUPS) {
    const scanned = scanGroup(projectRoot, group);
    Object.assign(result.entries.js, scanned.entries.js);
    Object.assign(result.entries.html, scanned.entries.html);
    if (group === 'components' || group === 'prototypes') {
      result.items[group] = scanned.items;
    }
  }

  return result;
}

export function allowedItemKeysByTab(
  scannedEntries: Record<string, string>,
  tab: SidebarTreeTab,
): Set<string> {
  return new Set(
    Object.keys(scannedEntries)
      .filter((key) => key.startsWith(`${tab}/`))
      .sort((a, b) => a.localeCompare(b)),
  );
}

export function mergeScannedEntries(existing: EntriesFileData, scanned: EntryScanResult['entries']): EntriesFileData {
  const migrated = migrateLegacyEntries(existing, process.cwd());
  const nextItems = { ...(migrated.items || {}) };

  for (const key of Object.keys(nextItems)) {
    if (isScannedGroupKey(key) && !Object.prototype.hasOwnProperty.call(scanned.js, key)) {
      delete nextItems[key];
    }
  }

  for (const [key, jsPath] of Object.entries(scanned.js || {})) {
    const [group, ...nameParts] = key.split('/');
    const name = nameParts.join('/');
    if (!group || !name) continue;
    nextItems[key] = {
      group,
      name,
      js: jsPath,
      html: scanned.html?.[key] || `src/${group}/${name}/index.html`,
    };
  }

  const sortedItems = Object.keys(nextItems)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, {
      group?: string;
      name?: string;
      js?: string;
      html?: string;
    }>>((acc, key) => {
      acc[key] = nextItems[key];
      return acc;
    }, {});

  const compat = toCompatMaps(sortedItems);
  const nextEntries: EntriesFileData = {
    ...existing,
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    items: sortedItems,
    js: compat.js,
    html: compat.html,
  };

  delete (nextEntries as { sidebarTree?: unknown }).sidebarTree;
  return nextEntries;
}
