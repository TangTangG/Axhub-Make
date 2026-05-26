import { describe, expect, it } from 'vitest';

import {
  createBundledAnnotationStorage,
  hasBundledAnnotationContent,
  readExportBundle,
  type ExportIndexBundle,
} from './exportBundle';

describe('html-template export bundle helpers', () => {
  it('reads the inline export bundle from the injected global', () => {
    const bundle: ExportIndexBundle = {
      entry: {
        name: 'demo',
        group: 'prototypes',
      },
    };

    expect(readExportBundle({
      __AXHUB_EXPORT_BUNDLE__: bundle,
    })).toEqual(bundle);
    expect(readExportBundle({
      __AXHUB_EXPORT_BUNDLE__: 'invalid',
    })).toBeNull();
  });

  it('detects whether bundled annotation content can be rendered without any api request', () => {
    expect(hasBundledAnnotationContent({
      entry: {
        name: 'demo',
        group: 'prototypes',
      },
      annotation: {
        data: {
          nodes: [{ id: 'node-1' }],
        },
      },
    })).toBe(true);

    expect(hasBundledAnnotationContent({
      entry: {
        name: 'button',
        group: 'components',
      },
      annotation: {
        annotationsMd: '# ignored',
      },
    })).toBe(false);
  });

  it('serves annotation data directly from the bundle-backed storage', async () => {
    const storage = createBundledAnnotationStorage({
      entry: {
        name: 'demo',
        group: 'prototypes',
      },
      annotation: {
        data: {
          nodes: [{ id: 'node-1' }],
        },
        annotationsMd: '# annotations',
        markdownMap: {
          'node-1': 'inline markdown',
        },
        assetMap: {
          'shot.png': 'data:image/png;base64,abc',
        },
      },
    });

    expect(await storage.load()).toEqual({
      nodes: [{ id: 'node-1' }],
    });
    expect(await storage.loadAnnotationsMd()).toBe('# annotations');
    expect(await storage.loadMarkdown('node-1')).toBe('inline markdown');
    expect(storage.getAssetUrl('shot.png')).toBe('data:image/png;base64,abc');
    expect(storage.getEditorUrl?.('node-1')).toBe('');
    expect(storage.getObsidianUrl?.('node-1')).toBe('');
  });
});
