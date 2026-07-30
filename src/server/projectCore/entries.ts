import fs from 'node:fs';
import path from 'node:path';

import { getEntriesManifestPath } from './paths.ts';

export type ScannableEntryGroup = 'components' | 'prototypes' | 'themes';

export interface EntriesManifestItem {
  group: ScannableEntryGroup | string;
  name: string;
  js: string;
  html: string;
}

export interface EntriesManifest {
  schemaVersion: 2;
  generatedAt: string;
  items: Record<string, EntriesManifestItem>;
  js: Record<string, string>;
  html: Record<string, string>;
}

export { getEntriesManifestPath };

function scanGroup(projectRoot: string, group: ScannableEntryGroup): EntriesManifestItem[] {
  const groupDir = path.join(projectRoot, 'src', group);
  if (!fs.existsSync(groupDir)) {
    return [];
  }

  return fs
    .readdirSync(groupDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(groupDir, name, 'index.tsx')))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      group,
      name,
      js: path.join(projectRoot, 'src', group, name, 'index.tsx'),
      html: path.join(projectRoot, 'src', group, name, 'index.html'),
    }));
}

export function scanProjectEntries(
  projectRoot: string,
  groups: ScannableEntryGroup[] = ['components', 'prototypes', 'themes'],
): EntriesManifest {
  const root = path.resolve(projectRoot);
  const items: Record<string, EntriesManifestItem> = {};
  const js: Record<string, string> = {};
  const html: Record<string, string> = {};

  for (const group of groups) {
    for (const item of scanGroup(root, group)) {
      const key = `${item.group}/${item.name}`;
      items[key] = item;
      js[key] = item.js;
      html[key] = item.html;
    }
  }

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    items,
    js,
    html,
  };
}

export function writeEntriesManifest(projectRoot: string, manifest: EntriesManifest): void {
  const manifestPath = getEntriesManifestPath(projectRoot);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const tempPath = `${manifestPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(manifest, null, 2), 'utf8');
    fs.renameSync(tempPath, manifestPath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

export function readEntriesManifest(projectRoot: string): EntriesManifest {
  return JSON.parse(fs.readFileSync(getEntriesManifestPath(projectRoot), 'utf8')) as EntriesManifest;
}
