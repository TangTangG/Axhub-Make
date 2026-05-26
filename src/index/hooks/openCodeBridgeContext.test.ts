import { describe, expect, it } from 'vitest';

import {
  CONTEXT_COMMENT_CURRENT_FILE,
  CONTEXT_ID_CURRENT_FILE,
  resolveOpenCodeCanvasAnnotationContext,
  resolveOpenCodeCurrentFileContext,
  resolveOpenCodeCurrentFilePath,
} from './openCodeBridgeContext';

describe('OpenCode bridge current file context resolution', () => {
  const prototype = {
	    name: 'Login',
	    displayName: 'Login',
	    jsUrl: '',
	    specUrl: '',
	    filePath: 'src/pages/Login/index.tsx',
  };

  it('resolves prototype demo and canvas files from the selected page', () => {
    expect(resolveOpenCodeCurrentFilePath({
      selectedItem: prototype,
      selectedDoc: null,
      selectedCanvas: null,
      sidebarTab: 'prototype',
      viewMode: 'demo',
    })).toBe('src/pages/Login/index.tsx');

    expect(resolveOpenCodeCurrentFilePath({
      selectedItem: prototype,
      selectedDoc: null,
      selectedCanvas: null,
      sidebarTab: 'prototype',
      viewMode: 'canvas',
    })).toBe('src/pages/Login/canvas.excalidraw');
  });

  it('resolves document and canvas tab files while clearing assets tab context', () => {
    expect(resolveOpenCodeCurrentFilePath({
      selectedItem: prototype,
      selectedDoc: {
	        name: 'prd',
	        displayName: 'PRD',
	        jsUrl: '',
	        specUrl: '',
	        filePath: 'docs/prd.md',
      },
      selectedCanvas: null,
      sidebarTab: 'document',
      viewMode: 'demo',
    })).toBe('docs/prd.md');

    expect(resolveOpenCodeCurrentFilePath({
      selectedItem: prototype,
      selectedDoc: null,
      selectedCanvas: {
        name: 'Flow',
        displayName: 'Flow',
        filePath: 'canvas/flow.excalidraw',
      } as any,
      sidebarTab: 'canvas',
      viewMode: 'demo',
    })).toBe('canvas/flow.excalidraw');

    expect(resolveOpenCodeCurrentFilePath({
      selectedItem: prototype,
      selectedDoc: null,
      selectedCanvas: null,
      sidebarTab: 'assets',
      viewMode: 'demo',
    })).toBe('');
  });

  it('resolves the selected design theme as a stable current file', () => {
    expect(resolveOpenCodeCurrentFilePath({
      selectedItem: prototype,
      selectedDoc: null,
      selectedCanvas: null,
      selectedTheme: {
        name: 'june',
        displayName: 'June 数据分析主题',
        path: 'src/themes/june',
      },
      resourceSection: 'themes',
      sidebarTab: 'assets',
      viewMode: 'demo',
    })).toBe('src/themes/june/index.tsx');

    expect(resolveOpenCodeCurrentFileContext({
      selectedItem: prototype,
      selectedDoc: null,
      selectedCanvas: null,
      selectedTheme: {
        name: 'june',
        displayName: 'June 数据分析主题',
        absoluteFilePath: '/workspace/src/themes/june/index.tsx',
      },
      resourceSection: 'themes',
      sidebarTab: 'assets',
      viewMode: 'demo',
    })).toEqual({
      id: CONTEXT_ID_CURRENT_FILE,
      type: 'file',
      path: 'src/themes/june/index.tsx',
      comment: CONTEXT_COMMENT_CURRENT_FILE,
      preview: 'June 数据分析主题',
    });
  });

  it('builds the deduped current-file context item with a stable id', () => {
    expect(resolveOpenCodeCurrentFileContext({
      selectedItem: prototype,
      selectedDoc: null,
      selectedCanvas: null,
      sidebarTab: 'prototype',
      viewMode: 'demo',
    })).toEqual({
      id: CONTEXT_ID_CURRENT_FILE,
      type: 'file',
      path: 'src/pages/Login/index.tsx',
      comment: CONTEXT_COMMENT_CURRENT_FILE,
      preview: 'Login',
    });
  });

  it('builds stable comment records for canvas annotations', () => {
    expect(resolveOpenCodeCanvasAnnotationContext({
      elementId: 'el-1',
      type: 'rectangle',
      annotation: '  调整按钮文案  ',
      title: '保存按钮',
    }, 'src/pages/Login/canvas.excalidraw')).toEqual({
      id: 'axhub:canvas-annotation:el-1',
      type: 'file',
      path: 'src/pages/Login/canvas.excalidraw',
      comment: '标注: 调整按钮文案',
      commentID: 'axhub:canvas-annotation:el-1',
      commentOrigin: 'file',
      preview: '保存按钮',
    });

    expect(resolveOpenCodeCanvasAnnotationContext({
      elementId: 'el-2',
      type: 'text',
      annotation: '',
      title: '空标注',
    }, 'src/pages/Login/canvas.excalidraw')).toBeNull();
  });
});
