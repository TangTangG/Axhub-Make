import fs from 'fs';
import path from 'path';

export interface ParentChildInfo {
  parent: string;
  child: string;
}

export interface SubPageConfigItem {
  name: string;
  displayName?: string;
  icon?: string;
}

export interface PageConfig {
  defaultPage?: string;
  pages?: SubPageConfigItem[];
}

export function parseParentChild(name: string): ParentChildInfo | null {
  const normalizedName = String(name || '').trim();
  const separatorIndex = normalizedName.indexOf('--');
  if (separatorIndex <= 0 || separatorIndex >= normalizedName.length - 2) {
    return null;
  }

  const parent = normalizedName.slice(0, separatorIndex).trim();
  const child = normalizedName.slice(separatorIndex + 2).trim();
  if (!parent || !child) {
    return null;
  }

  return { parent, child };
}

export function readPagesConfig(parentDir: string): PageConfig | null {
  const configPath = path.join(parentDir, 'pages.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as PageConfig;
    const pages = Array.isArray(raw?.pages)
      ? raw.pages
        .map((page) => ({
          name: String(page?.name || '').trim(),
          displayName: typeof page?.displayName === 'string' ? page.displayName.trim() || undefined : undefined,
          icon: typeof page?.icon === 'string' ? page.icon.trim() || undefined : undefined,
        }))
        .filter((page) => Boolean(page.name))
      : undefined;

    const defaultPage = typeof raw?.defaultPage === 'string' ? raw.defaultPage.trim() || undefined : undefined;
    return {
      defaultPage,
      pages,
    };
  } catch (error) {
    console.warn(`Failed to read pages config from ${configPath}:`, error);
    return null;
  }
}
