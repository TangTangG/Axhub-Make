import { describe, expect, it, vi } from 'vitest';

import type { ItemData } from '../../types';
import type { ThemeResourceItem } from '../../domains/resources/resource.types';
import { useIndexPageSidebarPropsBuilder } from './useIndexPageSidebarPropsBuilder';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useMemo: (factory: () => unknown) => factory(),
  };
});

function createItem(name: string): ItemData {
  return {
    name,
    displayName: name,
    jsUrl: '',
    specUrl: '',
  };
}

function createTheme(name: string): ThemeResourceItem {
  return {
    name,
    displayName: name,
    clientUrl: `/themes/${name}`,
    previewUrl: `/themes/${name}`,
  };
}

function createBuilderParams(overrides: Partial<Parameters<typeof useIndexPageSidebarPropsBuilder>[0]> = {}) {
  const selectedPrototype = createItem('prototype-a');
  const selectedDoc = createItem('doc-a');
  const selectedTheme = createTheme('theme-a');
  const setViewMode = vi.fn();
  const setSidebarTab = vi.fn();
  const setResourceSection = vi.fn();

  const params: Parameters<typeof useIndexPageSidebarPropsBuilder>[0] = {
    state: {
      collapsed: false,
      loading: false,
      sidebarTab: 'prototype',
      viewMode: 'canvas',
      data: { prototypes: [selectedPrototype], components: [] },
      docsItems: [selectedDoc],
      canvasItems: [],
      themes: [selectedTheme],
      searchText: '',
      selectedItem: selectedPrototype,
      selectedDoc,
      selectedCanvas: null,
      selectedTheme,
      resourceSection: 'themes',
      projectTitle: 'Project',
      activeProjectId: 'project-a',
      projects: [],
      resourceWriteCapabilities: {
        prototypeCreate: false,
        prototypeUpload: false,
        docCreate: false,
        docImport: false,
        themeCreate: false,
        themeImport: false,
        dataCreate: false,
        dataImport: false,
        templateCreate: false,
        templateDuplicate: false,
      },
      localExportCapabilities: {
        html: false,
        make: false,
      },
      isDarkMode: false,
      sidebarTrees: { prototypes: [], docs: [], canvas: [], themes: [] },
      webAgentPanelOpen: false,
      defaultThemeName: null,
    },
    deps: {
      preferredPromptClient: null,
      preferredIDE: 'cursor',
      setPreferredIDE: vi.fn(),
      setIsDarkMode: vi.fn(),
      setSettingsDialogOpen: vi.fn(),
      setActiveTab: vi.fn(),
      setSidebarTab,
      setViewMode,
      setResourceSection,
      setSearchText: vi.fn(),
      switchProject: vi.fn(),
      stopProjectDevServer: vi.fn(),
      addProjectFromLocalPath: vi.fn(),
      createBlankMakeProject: vi.fn(async () => ({})),
      loadProjects: vi.fn(),
      setCreateDialogVisible: vi.fn(),
      setInitialCreateDialogTab: vi.fn(),
      handleTabChange: vi.fn(),
      handleMenuClick: vi.fn(),
      handleOpenProjectInIDE: vi.fn(),
      handleOpenSelectedDocInIDE: vi.fn(async () => undefined),
      handleCopyItemPath: vi.fn(async () => undefined),
      previewHandleSelectDoc: vi.fn(),
      resources: {
        handleRenameThemeResource: vi.fn(),
        handleDeleteThemeResource: vi.fn(),
        setSelectedTheme: vi.fn(),
        handleDownloadItemSource: vi.fn(),
        handleDownloadThemeZip: vi.fn(),
        handleRenameItem: vi.fn(),
        handleDuplicateItem: vi.fn(),
        handleDeleteItem: vi.fn(),
        handleRenameDocItem: vi.fn(),
        handleDuplicateDocItem: vi.fn(),
        handleDeleteDocItem: vi.fn(),
        handleCopyDocPath: vi.fn(),
        handleDocVersionManagement: vi.fn(),
        handleCreatePrototypeFromDoc: vi.fn(),
        handleImportThemeResource: vi.fn(),
        handleCreatePlaceholderPrototype: vi.fn(),
        handleCreateResource: vi.fn(),
        handleCreateDocFile: vi.fn(),
        handleUploadedResourceFiles: vi.fn(),
        handleCreateCanvasFile: vi.fn(),
        handleSelectCanvas: vi.fn(),
        handleRenameCanvasItem: vi.fn(),
        handleDuplicateCanvasItem: vi.fn(),
        handleDeleteCanvasItem: vi.fn(),
        handleCopyCanvasPath: vi.fn(),
        handleCreateFolder: vi.fn(),
        handleGenerateThemeFromPrototype: vi.fn(),
        handleProjectTitleChange: vi.fn(),
        handleSidebarTreeChange: vi.fn(),
        handleSidebarTreePersist: vi.fn(),
        handleVersionManagement: vi.fn(),
        handleSetDefaultTheme: vi.fn(),
      },
    },
  };

  return {
    ...params,
    ...overrides,
    state: { ...params.state, ...overrides.state },
    deps: { ...params.deps, ...overrides.deps },
  };
}

describe('useIndexPageSidebarPropsBuilder', () => {
  it('keeps canvas visible when only switching resource tabs but opens the document when a document is selected', () => {
    const setViewMode = vi.fn();
    const previewHandleSelectDoc = vi.fn();
    const props = useIndexPageSidebarPropsBuilder(createBuilderParams({
      state: { sidebarTab: 'document' },
      deps: { setViewMode, previewHandleSelectDoc },
    }));

    props.actions.onSidebarTabChange('document');
    expect(setViewMode).not.toHaveBeenCalled();

    props.actions.onSelectDoc(createItem('doc-b'));

    expect(previewHandleSelectDoc).toHaveBeenCalledWith(expect.objectContaining({ name: 'doc-b' }));
    expect(setViewMode).toHaveBeenCalledWith('demo');
  });

  it('opens a selected theme even when prototype canvas mode was active', () => {
    const setViewMode = vi.fn();
    const setSelectedTheme = vi.fn();
    const props = useIndexPageSidebarPropsBuilder(createBuilderParams({
      state: { sidebarTab: 'assets', resourceSection: 'themes' },
      deps: {
        setViewMode,
        resources: {
          ...createBuilderParams().deps.resources,
          setSelectedTheme,
        },
      },
    }));

    props.actions.onSelectTheme(createTheme('theme-b'));

    expect(setSelectedTheme).toHaveBeenCalledWith(expect.objectContaining({ name: 'theme-b' }));
    expect(setViewMode).toHaveBeenCalledWith('demo');
  });

  it('routes prototype page child clicks through parent selection and page id state', async () => {
    const handleMenuClick = vi.fn();
    const setSelectedPrototypePageId = vi.fn();
    const props = useIndexPageSidebarPropsBuilder(createBuilderParams({
      deps: {
        handleMenuClick,
        setSelectedPrototypePageId,
      } as any,
    }));

    await props.actions.onPrototypePageSelect(createItem('prototype-a'), 'orders-list');

    expect(handleMenuClick).toHaveBeenCalledWith({ key: 'prototype-a', pageId: 'orders-list' });
    expect(setSelectedPrototypePageId).toHaveBeenCalledWith('orders-list');
  });

  it('passes default design state and action into the sidebar', () => {
    const handleSetDefaultTheme = vi.fn();
    const props = useIndexPageSidebarPropsBuilder(createBuilderParams({
      state: { defaultThemeName: 'theme-a' },
      deps: {
        resources: {
          ...createBuilderParams().deps.resources,
          handleSetDefaultTheme,
        },
      },
    }));

    expect(props.state.defaultThemeName).toBe('theme-a');

    props.actions.onSetDefaultTheme?.('theme-b');

    expect(handleSetDefaultTheme).toHaveBeenCalledWith('theme-b');
  });

  it('passes project setup required state into the sidebar', () => {
    const props = useIndexPageSidebarPropsBuilder(createBuilderParams({
      state: { projectSetupRequired: true },
    }));

    expect(props.state.projectSetupRequired).toBe(true);
  });
});
