import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ItemData, SidebarTreeNode } from '../../types';
import { resolvePrototypeAutoSelectionDecision } from './useIndexPageSelectionSync';

function createPrototype(name: string, displayName = name): ItemData {
  return {
    name,
    displayName,
    jsUrl: `/build/prototypes/${name}.js`,
    specUrl: `/prototypes/${name}/spec`,
  };
}

function createItemNode(name: string): SidebarTreeNode {
  return {
    id: `item:prototypes:${name}`,
    kind: 'item',
    title: name,
    itemKey: `prototypes/${name}`,
  };
}

describe('useIndexPageSelectionSync source', () => {
  it('selects from prototypes only and does not switch assets to components', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPageSelectionSync.tsx'), 'utf8');

    expect(source).not.toContain("activeTab === 'components' ? data.components : data.prototypes");
    expect(source).not.toContain("setActiveTab('components')");
    expect(source).not.toContain("if (activeTab === 'components')");
  });

  it('supports pending return targets after make startup refreshes resources', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPageSelectionSync.tsx'), 'utf8');

    expect(source).toContain('initialResourceDeepLink');
    expect(source).toContain('onInitialResourceDeepLinkHandled');
    expect(source).toContain('resolveIndexDeepLinkSelection');
    expect(source).toContain('resolveResourceDeepLinkSelection');
    expect(source).toContain('resourceDeepLinkConsumedRef');
    expect(source).toContain('onInitialResourceDeepLinkHandled?.();');
    expect(source).toContain('setCollapsed?.(true)');
    expect(source).toContain('pendingReturnTarget');
    expect(source).toContain('setPendingReturnTarget');
    expect(source).toContain('resourceId');
    expect(source).toContain('pageId: string | null;');
    expect(source).toContain('viewMode');
    expect(source).toContain('pendingTargetItem');
    expect(source).toContain('setViewMode(pendingReturnTarget.viewMode)');
    expect(source).toContain('setSelectedPrototypePageId(pendingReturnTarget.pageId || null);');
    expect(source).toContain('setSelectedItem(pendingTargetItem)');
    expect(source).toContain("pendingReturnTarget?.sidebarTab === 'document'");
    expect(source).toContain('const nextDocItem = pendingDocItem ?? fallbackDocItem');
    expect(source).toContain('setSelectedDoc(nextDocItem)');
    expect(source).toContain("initialResourceDeepLink?.resourceType === 'project-doc'");
  });

  it('restores theme deep links from the short URL state', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPageSelectionSync.tsx'), 'utf8');

    expect(source).toContain('themes:');
    expect(source).toContain('setSelectedTheme');
    expect(source).toContain("initialResourceDeepLink?.resourceType === 'theme'");
    expect(source).toContain("resolvedDeepLink?.kind === 'theme'");
    expect(source).toContain('setResourceSection(resolvedDeepLink.resourceSection);');
    expect(source).toContain('setSelectedTheme(resolvedDeepLink.theme);');
  });

  it('restores template deep links from legacy doc template URLs', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPageSelectionSync.tsx'), 'utf8');

    expect(source).toContain('templateAssets:');
    expect(source).toContain('setSelectedTemplate');
    expect(source).toContain("initialResourceDeepLink?.resourceType === 'template'");
    expect(source).toContain("resolvedDeepLink?.kind === 'template'");
    expect(source).toContain('setResourceSection(resolvedDeepLink.resourceSection);');
    expect(source).toContain('setSelectedTemplate(resolvedDeepLink.item);');
    expect(source).toContain("if (resolvedDeepLink?.kind === 'doc') {");
    expect(source).toContain('setSelectedDoc(resolvedDeepLink.item);');
  });

  it('handles a theme deep link only after attempting to resolve the requested theme', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPageSelectionSync.tsx'), 'utf8');
    const themeBlockStart = source.indexOf("if (!resourceDeepLinkConsumedRef.current && initialResourceDeepLink?.resourceType === 'theme')");
    const resolvedThemeCheck = source.indexOf("resolvedDeepLink?.kind === 'theme'", themeBlockStart);
    const handledAfterResolvedTheme = source.indexOf('markInitialResourceDeepLinkHandled();', themeBlockStart);

    expect(themeBlockStart).toBeGreaterThanOrEqual(0);
    expect(resolvedThemeCheck).toBeGreaterThan(themeBlockStart);
    expect(handledAfterResolvedTheme).toBeGreaterThan(resolvedThemeCheck);
  });

  it('handles a prototype deep link only after attempting to resolve the requested prototype', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPageSelectionSync.tsx'), 'utf8');
    const prototypeBlockStart = source.indexOf("if (!resourceDeepLinkConsumedRef.current && initialResourceDeepLink?.resourceType === 'prototype')");
    const resolvedPrototypeCheck = source.indexOf("resolvedDeepLink?.kind === 'prototype'", prototypeBlockStart);
    const handledAfterResolvedPrototype = source.indexOf('markInitialResourceDeepLinkHandled();', prototypeBlockStart);

    expect(prototypeBlockStart).toBeGreaterThanOrEqual(0);
    expect(resolvedPrototypeCheck).toBeGreaterThan(prototypeBlockStart);
    expect(handledAfterResolvedPrototype).toBeGreaterThan(resolvedPrototypeCheck);
  });

  it('marks unresolved initial resource deep links as handled after resource loading', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPageSelectionSync.tsx'), 'utf8');

    expect(source).toContain('markInitialResourceDeepLinkHandled');
    expect(source).toContain('const markInitialResourceDeepLinkHandled = useCallback(() => {');
    expect(source).toContain('resourceDeepLinkConsumedRef.current = true;');
    expect(source).toContain('onInitialResourceDeepLinkHandled?.();');

    const docBlockStart = source.indexOf("initialResourceDeepLink?.resourceType === 'doc'");
    const projectDocCheck = source.indexOf("initialResourceDeepLink?.resourceType === 'project-doc'", docBlockStart);
    const docResolvedCheck = source.indexOf("resolvedDeepLink?.kind === 'doc'", docBlockStart);
    const docMissingHandled = source.indexOf('markInitialResourceDeepLinkHandled();', docResolvedCheck);
    expect(docBlockStart).toBeGreaterThanOrEqual(0);
    expect(projectDocCheck).toBeGreaterThan(docBlockStart);
    expect(docMissingHandled).toBeGreaterThan(docResolvedCheck);

    const themeBlockStart = source.indexOf("if (!resourceDeepLinkConsumedRef.current && initialResourceDeepLink?.resourceType === 'theme')");
    const themeResolvedCheck = source.indexOf("resolvedDeepLink?.kind === 'theme'", themeBlockStart);
    const themeMissingHandled = source.indexOf('markInitialResourceDeepLinkHandled();', themeResolvedCheck);
    expect(themeBlockStart).toBeGreaterThanOrEqual(0);
    expect(themeMissingHandled).toBeGreaterThan(themeResolvedCheck);
  });

  it('opens document deep links in their resolved view mode', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPageSelectionSync.tsx'), 'utf8');
    const docResolvedStart = source.indexOf("if (resolvedDeepLink?.kind === 'doc') {");
    const docResolvedEnd = source.indexOf('return;', docResolvedStart);
    const docResolvedSource = source.slice(docResolvedStart, docResolvedEnd);

    expect(docResolvedStart).toBeGreaterThanOrEqual(0);
    expect(docResolvedSource).toContain('setViewMode(resolvedDeepLink.viewMode);');
    expect(docResolvedSource).toContain('setSelectedDoc(resolvedDeepLink.item);');
  });

  it('does not block direct project-file deep links on sidebar asset loading', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPageSelectionSync.tsx'), 'utf8');

    expect(source).toContain('doesResourceDeepLinkRequireSidebarAssets');
    expect(source).toContain('doesResourceDeepLinkRequireSidebarAssets(initialResourceDeepLink)');
  });

  it('does not keep prototype-canvas resource browsing special sync branches', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPageSelectionSync.tsx'), 'utf8');

    expect(source).not.toContain("import { isBrowsingResourceSidebarInPrototypeCanvas } from '../index-page/contentMode';");
    expect(source).not.toContain('isBrowsingResourceSidebarInPrototypeCanvas({ sidebarTab, viewMode }) && currentCanvasItem');
    expect(source).toContain('lastPrototypeCanvasItemRef');
  });

  it('uses normal prototype auto-selection while resource tabs are browsed in canvas mode', () => {
    const firstPrototype = createPrototype('first-prototype');
    const canvasPrototype = createPrototype('canvas-prototype');
    const sidebarTrees = {
      prototypes: [createItemNode(firstPrototype.name)],
      docs: [],
      canvas: [],
    };

    expect(resolvePrototypeAutoSelectionDecision({
      activeTab: 'prototypes',
      hasExplicitSelection: false,
      items: [firstPrototype, canvasPrototype],
      lastCanvasItem: null,
      selectedItem: canvasPrototype,
      sidebarTab: 'document',
      sidebarTrees,
      viewMode: 'canvas',
    })).toMatchObject({
      kind: 'select',
      item: firstPrototype,
      markExplicitSelection: false,
      resetPageSelection: true,
      nextCanvasItem: canvasPrototype,
    });

    expect(resolvePrototypeAutoSelectionDecision({
      activeTab: 'prototypes',
      hasExplicitSelection: false,
      items: [firstPrototype, canvasPrototype],
      lastCanvasItem: canvasPrototype,
      selectedItem: null,
      sidebarTab: 'assets',
      sidebarTrees,
      viewMode: 'canvas',
    })).toMatchObject({
      kind: 'select',
      item: firstPrototype,
      markExplicitSelection: false,
      resetPageSelection: true,
      nextCanvasItem: canvasPrototype,
    });
  });

  it('keeps normal prototype auto-selection outside prototype canvas resource browsing', () => {
    const firstPrototype = createPrototype('first-prototype');
    const previousCanvasPrototype = createPrototype('previous-canvas-prototype');
    const sidebarTrees = {
      prototypes: [createItemNode(firstPrototype.name)],
      docs: [],
      canvas: [],
    };

    expect(resolvePrototypeAutoSelectionDecision({
      activeTab: 'prototypes',
      hasExplicitSelection: false,
      items: [firstPrototype, previousCanvasPrototype],
      lastCanvasItem: previousCanvasPrototype,
      selectedItem: null,
      sidebarTab: 'prototype',
      sidebarTrees,
      viewMode: 'demo',
    })).toMatchObject({
      kind: 'select',
      item: firstPrototype,
      markExplicitSelection: false,
      resetPageSelection: true,
      nextCanvasItem: previousCanvasPrototype,
    });
  });

  it('does not auto-select an existing prototype while the start draft is active', () => {
    const firstPrototype = createPrototype('first-prototype');
    const sidebarTrees = {
      prototypes: [createItemNode(firstPrototype.name)],
      docs: [],
      canvas: [],
    };

    expect(resolvePrototypeAutoSelectionDecision({
      activeTab: 'prototypes',
      hasExplicitSelection: false,
      items: [firstPrototype],
      lastCanvasItem: null,
      pendingReturnTarget: null,
      selectedItem: null,
      sidebarTab: 'prototype',
      sidebarTrees,
      viewMode: 'demo',
      prototypeStartDraftActive: true,
    } as any)).toMatchObject({
      kind: 'keep',
      markExplicitSelection: false,
      nextCanvasItem: null,
    });
  });

  it('switches an implicit fallback selection to the first sidebar prototype after the tree loads', () => {
    const metadataFirstPrototype = createPrototype('annotation-demo', '标注演示');
    const sidebarFirstPrototype = createPrototype('beginner-guide', '新手指导');
    const sidebarTrees = {
      prototypes: [createItemNode(sidebarFirstPrototype.name), createItemNode(metadataFirstPrototype.name)],
      docs: [],
      canvas: [],
    };

    expect(resolvePrototypeAutoSelectionDecision({
      activeTab: 'prototypes',
      hasExplicitSelection: false,
      items: [metadataFirstPrototype, sidebarFirstPrototype],
      lastCanvasItem: null,
      selectedItem: metadataFirstPrototype,
      sidebarTab: 'prototype',
      sidebarTrees,
      viewMode: 'demo',
    })).toMatchObject({
      kind: 'select',
      item: sidebarFirstPrototype,
      markExplicitSelection: false,
      resetPageSelection: true,
      nextCanvasItem: null,
    });
  });

  it('keeps refreshed selected placeholder prototype metadata instead of auto-selecting the first tree item', () => {
    const firstPrototype = createPrototype('first-prototype');
    const staleSelectedPlaceholder = {
      ...createPrototype('untitled-4', '未命名'),
      placeholder: true,
    };
    const refreshedSelectedPlaceholder = {
      ...staleSelectedPlaceholder,
      placeholderGuide: {
        kind: 'prototype-empty',
        title: '这个原型还没有开始创建',
        description: '告诉 AI 你想做什么：目标用户、使用场景、页面内容和参考风格。',
        steps: [],
        tips: [],
      },
    };
    const sidebarTrees = {
      prototypes: [createItemNode(firstPrototype.name)],
      docs: [],
      canvas: [],
    };

    expect(resolvePrototypeAutoSelectionDecision({
      activeTab: 'prototypes',
      hasExplicitSelection: false,
      items: [firstPrototype, refreshedSelectedPlaceholder],
      lastCanvasItem: null,
      selectedItem: staleSelectedPlaceholder,
      sidebarTab: 'prototype',
      sidebarTrees,
      viewMode: 'demo',
    })).toMatchObject({
      kind: 'select',
      item: refreshedSelectedPlaceholder,
      markExplicitSelection: false,
      resetPageSelection: false,
      nextCanvasItem: null,
    });
  });

  it('keeps a newly created placeholder selected before the resource refresh includes it', () => {
    const firstPrototype = createPrototype('first-prototype');
    const createdPlaceholder = {
      ...createPrototype('untitled-8', '未命名'),
      placeholder: true,
      placeholderGuide: {
        kind: 'prototype-empty',
        title: '这个原型还没有开始创建',
        description: '告诉 AI 你想做什么：目标用户、使用场景、页面内容和参考风格。',
        steps: [],
        tips: [],
      },
    };
    const sidebarTrees = {
      prototypes: [createItemNode(firstPrototype.name)],
      docs: [],
      canvas: [],
    };

    expect(resolvePrototypeAutoSelectionDecision({
      activeTab: 'prototypes',
      hasExplicitSelection: false,
      items: [firstPrototype],
      lastCanvasItem: null,
      pendingReturnTarget: {
        sidebarTab: 'prototype',
        resourceId: createdPlaceholder.name,
        pageId: null,
        viewMode: 'demo',
      },
      selectedItem: createdPlaceholder,
      sidebarTab: 'prototype',
      sidebarTrees,
      viewMode: 'demo',
    })).toMatchObject({
      kind: 'keep',
      markExplicitSelection: false,
      nextCanvasItem: null,
    });
  });

  it('does not keep a missing placeholder without a matching pending target', () => {
    const firstPrototype = createPrototype('first-prototype');
    const stalePlaceholder = {
      ...createPrototype('untitled-9', '未命名'),
      placeholder: true,
    };
    const sidebarTrees = {
      prototypes: [createItemNode(firstPrototype.name)],
      docs: [],
      canvas: [],
    };

    expect(resolvePrototypeAutoSelectionDecision({
      activeTab: 'prototypes',
      hasExplicitSelection: false,
      items: [firstPrototype],
      lastCanvasItem: null,
      selectedItem: stalePlaceholder,
      sidebarTab: 'prototype',
      sidebarTrees,
      viewMode: 'demo',
    })).toMatchObject({
      kind: 'select',
      item: firstPrototype,
      markExplicitSelection: false,
      resetPageSelection: true,
      nextCanvasItem: null,
    });
  });

  it('keeps a selected placeholder guide when refreshed metadata temporarily misses placeholder fields', () => {
    const firstPrototype = createPrototype('first-prototype');
    const selectedPlaceholder = {
      ...createPrototype('untitled-7', '未命名'),
      placeholder: true,
      placeholderGuide: {
        kind: 'prototype-empty',
        title: '这个原型还没有开始创建',
        description: '告诉 AI 你想做什么：目标用户、使用场景、页面内容和参考风格。',
        steps: [],
        tips: [],
      },
    };
    const refreshedWithoutPlaceholder = {
      ...createPrototype('untitled-7', '未命名'),
      clientUrl: '/prototypes/untitled-7',
      previewUrl: '/prototypes/untitled-7',
    };
    const sidebarTrees = {
      prototypes: [createItemNode(firstPrototype.name)],
      docs: [],
      canvas: [],
    };

    expect(resolvePrototypeAutoSelectionDecision({
      activeTab: 'prototypes',
      hasExplicitSelection: false,
      items: [firstPrototype, refreshedWithoutPlaceholder],
      lastCanvasItem: null,
      selectedItem: selectedPlaceholder,
      sidebarTab: 'prototype',
      sidebarTrees,
      viewMode: 'demo',
    })).toMatchObject({
      kind: 'keep',
      markExplicitSelection: false,
      nextCanvasItem: null,
    });
  });

  it('selects waiting prototype metadata after placeholder generation starts', () => {
    const firstPrototype = createPrototype('first-prototype');
    const selectedPlaceholder = {
      ...createPrototype('untitled-7', '未命名'),
      placeholder: true,
      placeholderGuide: {
        kind: 'prototype-empty',
        title: '这个原型还没有开始创建',
        description: '告诉 AI 你想做什么：目标用户、使用场景、页面内容和参考风格。',
        steps: [],
        tips: [],
      },
    };
    const refreshedWaitingPrototype = {
      ...createPrototype('untitled-7', '未命名'),
      clientUrl: '/prototypes/untitled-7',
      previewUrl: '/prototypes/untitled-7',
      placeholder: false,
      generationStatus: 'waiting' as const,
    };
    const sidebarTrees = {
      prototypes: [createItemNode(firstPrototype.name)],
      docs: [],
      canvas: [],
    };

    expect(resolvePrototypeAutoSelectionDecision({
      activeTab: 'prototypes',
      hasExplicitSelection: false,
      items: [firstPrototype, refreshedWaitingPrototype],
      lastCanvasItem: null,
      selectedItem: selectedPlaceholder,
      sidebarTab: 'prototype',
      sidebarTrees,
      viewMode: 'demo',
    })).toMatchObject({
      kind: 'select',
      item: refreshedWaitingPrototype,
      markExplicitSelection: false,
      resetPageSelection: false,
      nextCanvasItem: null,
    });
  });

  it('refreshes an explicit selected prototype object when resource metadata changes', () => {
    const staleSelectedPrototype = {
      ...createPrototype('beginner-guide', '新手指导'),
      clientUrl: '/prototypes/beginner-guide',
      previewUrl: '/prototypes/beginner-guide',
    };
    const refreshedSelectedPrototype = {
      ...staleSelectedPrototype,
      clientUrl: 'http://localhost:51720/prototypes/beginner-guide',
      previewUrl: 'http://localhost:51720/prototypes/beginner-guide',
    };
    const sidebarTrees = {
      prototypes: [createItemNode(staleSelectedPrototype.name)],
      docs: [],
      canvas: [],
    };

    expect(resolvePrototypeAutoSelectionDecision({
      activeTab: 'prototypes',
      hasExplicitSelection: true,
      items: [refreshedSelectedPrototype],
      lastCanvasItem: null,
      selectedItem: staleSelectedPrototype,
      sidebarTab: 'prototype',
      sidebarTrees,
      viewMode: 'demo',
    })).toMatchObject({
      kind: 'select',
      item: refreshedSelectedPrototype,
      markExplicitSelection: true,
      resetPageSelection: false,
      nextCanvasItem: null,
    });
  });

  it('handleTabChange source guards explicit selection for file canvas sidebar tab', () => {
    const source = readFileSync(resolve(__dirname, './useIndexPageSelectionSync.tsx'), 'utf8');

    // The guard must also check sidebarTab !== 'canvas' so switching away
    // from the file-canvas sidebar tab does not reset explicit selection.
    expect(source).toContain("sidebarTab !== 'canvas'");
    expect(source).toContain("viewMode !== 'canvas' && sidebarTab !== 'canvas'");
  });
});
