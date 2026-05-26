export interface EntriesManifestItem {
  group: string;
  name: string;
  js: string;
  html: string;
}

export interface EntriesManifestV2 {
  schemaVersion: 2;
  generatedAt: string;
  items: Record<string, EntriesManifestItem>;
  js: Record<string, string>;
  html: Record<string, string>;
}

export function toCompatMaps(items: Record<string, EntriesManifestItem>): {
  js: Record<string, string>;
  html: Record<string, string>;
};
export function scanProjectEntries(projectRoot: string, groups?: string[]): EntriesManifestV2;
export function migrateLegacyEntries(raw: unknown, projectRoot: string): EntriesManifestV2;
export function writeEntriesManifestAtomic(projectRoot: string, manifest: EntriesManifestV2): EntriesManifestV2;
export function readEntriesManifest(projectRoot: string): EntriesManifestV2;
export function getEntriesPath(projectRoot: string): string;
