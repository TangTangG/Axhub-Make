import { describe, expect, it } from 'vitest';
import {
  buildAssistantCanvasCommentsExtension,
  buildAssistantContextWithCanvasElements,
  buildAssistantContextUrl,
  buildAssistantCurrentFileSyncContext,
  getAssistantCanvasCommentsSignature,
  mergeAssistantContextForActiveFile,
  getAssistantContextCurrentFilePath,
  resolveAssistantCurrentFile,
  shouldSyncAssistantCurrentFile,
} from './assistantContext';

describe('assistantContext helpers', () => {
  it('keeps ACP UI assistant URLs free of serialized context and Agent integration params', () => {
    const result = new URL(buildAssistantContextUrl(
      'https://acp.example.com/acp-ui?workspacePath=%2Fworkspace%2Fdemo%2Fproject&prompt=old&integrationWs=1&agentIntegrationChannel=make&agentTargetClientId=make',
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

    expect(result.origin).toBe('https://acp.example.com');
    expect(result.pathname).toBe('/acp-ui');
    expect(result.searchParams.get('workspacePath')).toBe('/workspace/demo/project');
    expect(result.searchParams.get('context')).toBeNull();
    expect(result.searchParams.get('prompt')).toBeNull();
    expect(result.searchParams.get('integrationWs')).toBeNull();
    expect(result.searchParams.get('agentIntegrationChannel')).toBeNull();
    expect(result.searchParams.get('agentTargetClientId')).toBeNull();
    expect(result.searchParams.get('slashCommands')).toBeNull();
  });

  it('strips stale serialized context from legacy assistant URLs', () => {
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
    expect(result.searchParams.get('context')).toBeNull();
    expect(result.searchParams.get('integrationWs')).toBeNull();
    expect(result.searchParams.get('slashCommands')).toBeNull();
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

  it('keeps prototype current files on the source entry even when the old canvas view is selected', () => {
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
    }).path).toBe('src/prototypes/home/index.tsx');
  });

  it('keeps placeholder prototype context on index.tsx until a resource canvas is explicitly opened', () => {
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
    }).path).toBe('src/prototypes/untitled/index.tsx');
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
        filePath: 'src/resources/flows/flow.excalidraw',
      },
      currentTheme: null,
      currentDataTable: null,
    }).path).toBe('src/resources/flows/flow.excalidraw');

    expect(resolveAssistantCurrentFile({
      selectedItem: stalePrototype,
      activeTab: 'prototypes',
      viewMode: 'demo',
      contentMode: 'canvas',
      currentMarkdownResource: { kind: 'doc', item: null },
      currentCanvas: {
        name: 'flow',
        displayName: 'Flow',
        canvasFilePath: 'src/resources/flows/flow.excalidraw',
      } as any,
      currentTheme: null,
      currentDataTable: null,
    }).path).toBe('src/resources/flows/flow.excalidraw');

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
        path: 'src/resources/data/customers.json',
      },
    }).path).toBe('src/resources/data/customers.json');
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

  it('builds stable assistant comments from annotated canvas elements and filters empty notes', () => {
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
    ], 'src/resources/flows/home.excalidraw');

    expect(comments).toEqual([
      {
        id: 'axhub:canvas-annotation:el-1',
        body: '调整按钮文案',
        origin: 'canvas',
        target: {
          filePath: 'src/resources/flows/home.excalidraw',
          elementId: 'el-1',
          elementType: 'rectangle',
          link: 'https://example.com/spec',
        },
        preview: '保存按钮',
        updatedAt: expect.any(String),
      },
    ]);
  });

  it('builds append context for canvas elements even when they have no annotation yet', () => {
    const context = buildAssistantContextWithCanvasElements({
      version: '1',
      systemContext: '',
      currentFile: {
        path: 'src/resources/flows/home.excalidraw',
        displayName: 'Home Canvas',
      },
      selectedElements: [
        {
          tag: 'button',
          selector: '#legacy',
          label: 'Legacy selection',
        },
      ],
      extensions: {
        source: 'axhub-runtime',
      },
    }, [
      {
        elementId: 'rect-1',
        type: 'rectangle',
        title: '主按钮',
        annotation: '',
        link: 'https://example.com/spec',
        width: 120,
        height: 48,
      },
    ], 'src/resources/flows/home.excalidraw');

    expect(context).toEqual({
      version: '1',
      systemContext: '',
      currentFile: {
        path: 'src/resources/flows/home.excalidraw',
        displayName: 'Home Canvas',
      },
      selectedElements: [],
      extensions: {
        source: 'axhub-runtime',
        comments: [
          {
            id: 'axhub:canvas-annotation:rect-1',
            body: '主按钮',
            origin: 'canvas',
            target: {
              filePath: 'src/resources/flows/home.excalidraw',
              elementId: 'rect-1',
              elementType: 'rectangle',
              link: 'https://example.com/spec',
            },
            preview: '主按钮',
            updatedAt: expect.any(String),
          },
        ],
      },
    });
  });

  it('uses stable comment signatures that ignore timestamp-only changes', () => {
    const baseContext = {
      version: '1' as const,
      systemContext: '',
      currentFile: {
        path: 'src/resources/flows/home.excalidraw',
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
              filePath: 'src/resources/flows/home.excalidraw',
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
