interface BundledAnnotationStorage {
  load: () => Promise<any>;
  save: (nextData: unknown) => Promise<boolean>;
  loadAnnotationsMd: () => Promise<string | null>;
  saveAnnotationsMd: (content: string) => Promise<boolean>;
  loadMarkdown: (nodeId: string) => Promise<string | null>;
  saveMarkdown: (nodeId: string, content: string) => Promise<boolean>;
  deleteMarkdown: (nodeId: string) => Promise<boolean>;
  uploadAsset: () => Promise<null>;
  deleteAsset: (filename: string) => Promise<boolean>;
  getAssetUrl: (filename: string) => string;
  getEditorUrl?: (nodeId?: string) => string;
  getObsidianUrl?: (nodeId?: string) => string;
}

export interface ExportIndexBundle {
  entry?: {
    name?: string;
    group?: string;
  };
  annotation?: {
    data?: unknown;
    annotationsMd?: string;
    markdownMap?: Record<string, string>;
    assetMap?: Record<string, string>;
  };
}

export function readExportBundle(
  targetWindow: { __AXHUB_EXPORT_BUNDLE__?: unknown } | undefined = typeof window !== 'undefined' ? (window as Window & {
    __AXHUB_EXPORT_BUNDLE__?: unknown;
  }) : undefined,
): ExportIndexBundle | null {
  const bundle = targetWindow?.__AXHUB_EXPORT_BUNDLE__;
  if (!bundle || typeof bundle !== 'object') {
    return null;
  }

  return bundle as ExportIndexBundle;
}

export function createBundledAnnotationStorage(bundle: ExportIndexBundle): BundledAnnotationStorage {
  const annotation = bundle.annotation || {};
  const markdownMap = { ...(annotation.markdownMap || {}) };
  const assetMap = { ...(annotation.assetMap || {}) };
  let data = annotation.data ?? null;
  let annotationsMd = typeof annotation.annotationsMd === 'string' ? annotation.annotationsMd : null;

  return {
    async load() {
      return data as any;
    },
    async save(nextData) {
      data = nextData;
      return true;
    },
    async loadAnnotationsMd() {
      return annotationsMd;
    },
    async saveAnnotationsMd(content: string) {
      annotationsMd = content;
      return true;
    },
    async loadMarkdown(nodeId: string) {
      return typeof markdownMap[nodeId] === 'string' ? markdownMap[nodeId] : null;
    },
    async saveMarkdown(nodeId: string, content: string) {
      markdownMap[nodeId] = content;
      return true;
    },
    async deleteMarkdown(nodeId: string) {
      delete markdownMap[nodeId];
      return true;
    },
    async uploadAsset() {
      return null;
    },
    async deleteAsset(filename: string) {
      delete assetMap[filename];
      return true;
    },
    getAssetUrl(filename: string) {
      return assetMap[filename] || '';
    },
    getEditorUrl() {
      return '';
    },
    getObsidianUrl() {
      return '';
    },
  };
}

export function hasBundledAnnotationContent(bundle: ExportIndexBundle | null): bundle is ExportIndexBundle {
  if (bundle?.entry?.group !== 'prototypes' || !bundle.entry.name) {
    return false;
  }

  const nodes = (bundle.annotation?.data as { nodes?: unknown[] } | null | undefined)?.nodes;
  if (Array.isArray(nodes) && nodes.length > 0) {
    return true;
  }

  return Boolean(
    bundle.annotation?.annotationsMd
    || Object.keys(bundle.annotation?.markdownMap || {}).length > 0,
  );
}
