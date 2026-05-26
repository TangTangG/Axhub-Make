import { describe, expect, it } from 'vitest';
import {
  buildAssistantCanvasCommentsExtension,
  buildAssistantContextUrl,
  buildAssistantCurrentFileSyncContext,
  getAssistantCanvasCommentsSignature,
  mergeAssistantContextForActiveFile,
  getAssistantContextCurrentFilePath,
  resolveAssistantCurrentFile,
  shouldSyncAssistantCurrentFile,
} from './genieContext';

describe('genieContext helpers', () => {
  it('replaces stale URL context with the active current file context', () => {
    const staleContext = encodeURIComponent(JSON.stringify({
      version: '1',
      currentFile: {
        path: 'src/prototypes/old/index.tsx',
        displayName: 'Old',
      },
      selectedElements: [],
    }));
    const result = new URL(buildAssistantContextUrl(
      `https://genie.example.com/session/123?context=${staleContext}&foo=bar`,
      {
        version: '1',
        systemContext: '',
        currentFile: {
          path: 'src/prototypes/new/index.tsx',
          displayName: 'New',
        },
        selectedElements: [],
        extensions: {
          source: 'axhub-runtime',
        },
      },
      'https://admin.example.com',
    ));

    expect(result.searchParams.get('foo')).toBe('bar');
    expect(JSON.parse(result.searchParams.get('context') || '{}')).toEqual({
      version: '1',
      systemContext: '',
      currentFile: {
        path: 'src/prototypes/new/index.tsx',
        displayName: 'New',
      },
      selectedElements: [],
    });
  });

  it('reads the current file path from the context payload', () => {
    expect(getAssistantContextCurrentFilePath({
      currentFile: {
        path: 'src/prototypes/home/index.tsx',
        displayName: 'Home',
      },
    })).toBe('src/prototypes/home/index.tsx');

    expect(getAssistantContextCurrentFilePath({
      currentFile: {
        path: 'src/resources/home-guide.md',
        displayName: 'Home Guide',
      },
    })).toBe('src/resources/home-guide.md');

    expect(getAssistantContextCurrentFilePath({
      currentFile: {
        path: 'src/resources/product-notes.md',
        displayName: 'Product Notes',
      },
    })).toBe('src/resources/product-notes.md');
  });

  it('only requests sync when the current file path actually changes', () => {
    expect(shouldSyncAssistantCurrentFile(
      'src/prototypes/home/index.tsx',
      'src/prototypes/detail/index.tsx',
    )).toBe(true);

    expect(shouldSyncAssistantCurrentFile(
      'src/prototypes/home/index.tsx',
      'src/prototypes/home/index.tsx',
    )).toBe(false);

    expect(shouldSyncAssistantCurrentFile('', 'src/prototypes/home/index.tsx')).toBe(true);
    expect(shouldSyncAssistantCurrentFile('src/prototypes/home/index.tsx', '')).toBe(true);
    expect(shouldSyncAssistantCurrentFile('', '')).toBe(false);
  });

  it('clears selected elements before syncing a new current file context', () => {
    const nextContext = buildAssistantCurrentFileSyncContext({
      version: '1',
      systemContext: '',
      currentFile: {
        path: 'src/prototypes/home/index.tsx',
        displayName: 'Home',
      },
      selectedElements: [
        {
          tag: 'button',
          selector: '#save',
          label: '保存按钮',
        },
      ],
      extensions: {
        source: 'axhub-runtime',
      },
    });

    expect(nextContext.currentFile).toEqual({
      path: 'src/prototypes/home/index.tsx',
      displayName: 'Home',
    });
    expect(nextContext.selectedElements).toEqual([]);
    expect(nextContext.extensions).toEqual({
      source: 'axhub-runtime',
    });
  });

  it('derives preview and canvas current files from explicit prototype paths', () => {
    const item = {
	      name: 'home',
	      displayName: 'Home',
	      jsUrl: '',
	      specUrl: '',
	      filePath: '/workspace/src/prototypes/home/index.tsx',
      absoluteFilePath: '/workspace/src/prototypes/home/index.tsx',
    };

    expect(resolveAssistantCurrentFile({
      selectedItem: item,
      activeTab: 'prototypes',
      viewMode: 'demo',
      contentMode: 'preview',
      currentMarkdownResource: { kind: 'doc', item: null },
    }).path).toBe('src/prototypes/home/index.tsx');

    expect(resolveAssistantCurrentFile({
      selectedItem: item,
      activeTab: 'prototypes',
      viewMode: 'canvas',
      contentMode: 'preview',
      currentMarkdownResource: { kind: 'doc', item: null },
    }).path).toBe('src/prototypes/home/canvas.excalidraw');
  });

  it('keeps placeholder prototype demo context on index.tsx until canvas is explicitly opened', () => {
    const item = {
      name: 'untitled',
      displayName: '未命名',
      jsUrl: '',
      specUrl: '',
      filePath: '/workspace/src/prototypes/untitled/index.tsx',
      placeholder: true,
    };

    expect(resolveAssistantCurrentFile({
      selectedItem: item,
      activeTab: 'prototypes',
      viewMode: 'demo',
      contentMode: 'preview',
      currentMarkdownResource: { kind: 'doc', item: null },
    }).path).toBe('src/prototypes/untitled/index.tsx');

    expect(resolveAssistantCurrentFile({
      selectedItem: item,
      activeTab: 'prototypes',
      viewMode: 'canvas',
      contentMode: 'preview',
      currentMarkdownResource: { kind: 'doc', item: null },
    }).path).toBe('src/prototypes/untitled/canvas.excalidraw');
  });

  it('derives independent docs and templates only from real markdown paths', () => {
    expect(resolveAssistantCurrentFile({
      selectedItem: null,
      activeTab: 'prototypes',
      viewMode: 'demo',
      contentMode: 'doc',
      currentMarkdownResource: {
        kind: 'doc',
        item: {
	          name: 'guide',
	          displayName: 'Guide',
	          jsUrl: '',
	          specUrl: '',
	          filePath: 'content/docs/guide.md',
          absoluteFilePath: '/workspace/content/docs/guide.md',
        },
      },
    }).path).toBe('content/docs/guide.md');

    expect(resolveAssistantCurrentFile({
      selectedItem: null,
      activeTab: 'prototypes',
      viewMode: 'demo',
      contentMode: 'template',
      currentMarkdownResource: {
        kind: 'template',
        item: {
	          name: 'prd-template',
	          displayName: 'PRD Template',
	          jsUrl: '',
	          specUrl: '',
	          absoluteFilePath: '/workspace/content/templates/prd-template.md',
        },
      },
    }).path).toBe('/workspace/content/templates/prd-template.md');

    expect(resolveAssistantCurrentFile({
      selectedItem: null,
      activeTab: 'prototypes',
      viewMode: 'demo',
      contentMode: 'doc',
      currentMarkdownResource: {
        kind: 'doc',
        item: {
	          name: 'metadata-only',
	          displayName: 'Metadata Only',
	          jsUrl: '',
	          specUrl: '',
	        },
      },
    }).path).toBe('');
  });

  it('derives canvas, theme, and data current files from the active resource instead of stale prototype selection', () => {
    const stalePrototype = {
      name: 'home',
      displayName: 'Home',
      jsUrl: '',
      specUrl: '',
      filePath: 'src/prototypes/home/index.tsx',
    };

    expect(resolveAssistantCurrentFile({
      selectedItem: stalePrototype,
      activeTab: 'prototypes',
      viewMode: 'demo',
      contentMode: 'canvas',
      currentMarkdownResource: { kind: 'doc', item: null },
      currentCanvas: {
        name: 'flow',
        displayName: 'Flow',
        filePath: 'canvas/flow.excalidraw',
      },
      currentTheme: null,
      currentDataTable: null,
    }).path).toBe('canvas/flow.excalidraw');

    expect(resolveAssistantCurrentFile({
      selectedItem: stalePrototype,
      activeTab: 'prototypes',
      viewMode: 'demo',
      contentMode: 'theme',
      currentMarkdownResource: { kind: 'doc', item: null },
      currentCanvas: null,
      currentTheme: {
        name: 'brand',
        displayName: 'Brand',
        path: 'src/themes/brand',
      },
      currentDataTable: null,
    }).path).toBe('src/themes/brand/index.tsx');

    expect(resolveAssistantCurrentFile({
      selectedItem: stalePrototype,
      activeTab: 'prototypes',
      viewMode: 'demo',
      contentMode: 'data',
      currentMarkdownResource: { kind: 'doc', item: null },
      currentCanvas: null,
      currentTheme: null,
      currentDataTable: {
        fileName: 'customers.json',
        tableName: 'Customers',
        path: 'src/data/customers.json',
      },
    }).path).toBe('src/data/customers.json');
  });

  it('drops stale external context when the active current file changes', () => {
    const baseContext = {
      version: '1' as const,
      systemContext: '',
      currentFile: {
        path: 'src/prototypes/detail/index.tsx',
        displayName: 'Detail',
      },
      selectedElements: [],
      extensions: {
        source: 'axhub-runtime',
      },
    };
    const externalContext = {
      version: '1' as const,
      systemContext: 'selection',
      currentFile: {
        path: 'src/prototypes/home/index.tsx',
        displayName: 'Home',
      },
      selectedElements: [
        {
          tag: 'button',
          selector: '#save',
          label: '保存按钮',
        },
      ],
    };

    expect(mergeAssistantContextForActiveFile(baseContext, externalContext)).toEqual(baseContext);
  });

  it('does not merge external selection context when the active file has no real path', () => {
    const baseContext = {
      version: '1' as const,
      systemContext: '',
      currentFile: {
        path: '',
        displayName: 'Metadata Only',
      },
      selectedElements: [],
    };
    const externalContext = {
      version: '1' as const,
      systemContext: 'selection',
      currentFile: {
        path: '',
        displayName: 'Previous Metadata Only',
      },
      selectedElements: [
        {
          tag: 'h1',
          selector: '#title',
          label: '标题',
        },
      ],
    };

    expect(mergeAssistantContextForActiveFile(baseContext, externalContext)).toEqual(baseContext);
  });

  it('keeps same-file external selection context', () => {
    const baseContext = {
      version: '1' as const,
      systemContext: '',
      currentFile: {
        path: 'src/prototypes/home/index.tsx',
        displayName: 'Home',
      },
      selectedElements: [],
      extensions: {
        source: 'axhub-runtime',
      },
    };
    const externalContext = {
      version: '1' as const,
      systemContext: 'selection',
      currentFile: {
        path: 'src/prototypes/home/index.tsx',
        displayName: 'Home',
      },
      selectedElements: [
        {
          tag: 'button',
          selector: '#save',
          label: '保存按钮',
        },
      ],
    };

    expect(mergeAssistantContextForActiveFile(baseContext, externalContext)?.selectedElements).toEqual([
      {
        tag: 'button',
        selector: '#save',
        label: '保存按钮',
      },
    ]);
  });

  it('builds stable Genie comments from canvas annotations and filters empty notes', () => {
    const comments = buildAssistantCanvasCommentsExtension([
      {
        elementId: 'el-1',
        type: 'rectangle',
        annotation: '  调整按钮文案  ',
        title: '保存按钮',
        link: 'https://example.com/spec',
        width: 120,
        height: 48,
      },
      {
        elementId: 'el-2',
        type: 'text',
        annotation: '',
        title: '空标注',
      },
    ], 'src/prototypes/home/canvas.excalidraw');

    expect(comments).toEqual([
      {
        id: 'axhub:canvas-annotation:el-1',
        body: '调整按钮文案',
        origin: 'canvas',
        target: {
          filePath: 'src/prototypes/home/canvas.excalidraw',
          elementId: 'el-1',
          elementType: 'rectangle',
          link: 'https://example.com/spec',
        },
        preview: '保存按钮',
        updatedAt: expect.any(String),
      },
    ]);
  });

  it('uses stable comment signatures that ignore timestamp-only changes', () => {
    const baseContext = {
      version: '1' as const,
      systemContext: '',
      currentFile: {
        path: 'src/prototypes/home/canvas.excalidraw',
        displayName: 'Home Canvas',
      },
      selectedElements: [],
      extensions: {
        comments: [
          {
            id: 'axhub:canvas-annotation:el-1',
            body: '调整按钮文案',
            origin: 'canvas',
            target: {
              filePath: 'src/prototypes/home/canvas.excalidraw',
              elementId: 'el-1',
              elementType: 'rectangle',
            },
            preview: '保存按钮',
            updatedAt: '2026-05-13T10:00:00.000Z',
          },
        ],
      },
    };
    const timestampOnlyChange = {
      ...baseContext,
      extensions: {
        comments: [
          {
            ...baseContext.extensions.comments[0],
            updatedAt: '2026-05-13T10:05:00.000Z',
          },
        ],
      },
    };

    expect(getAssistantCanvasCommentsSignature(baseContext)).toBe(
      getAssistantCanvasCommentsSignature(timestampOnlyChange),
    );
  });
});
