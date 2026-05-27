import { describe, expect, it } from 'vitest';
import {
  buildDocContentEndpoint,
  normalizeProjectRuntimeStatusPayload,
  normalizeProjectsPayload,
  normalizeProjectResourcesPayload,
} from './projectResources';

describe('project resource frontend adapter', () => {
  it('preserves explicit empty project names so the UI can show its untitled label', () => {
    const projectList = normalizeProjectsPayload({
      activeProjectId: 'make-project',
      projects: [
        {
          id: 'make-project',
          name: '',
          root: '/workspace/client',
        },
      ],
    });

    const bundle = normalizeProjectResourcesPayload({
      project: { id: 'make-project', name: '' },
      resources: {
        prototypes: [],
        docs: [],
        themes: [],
      },
    }, null);

    expect(projectList.projects[0].name).toBe('');
    expect(bundle.projectName).toBe('');
  });

  it('maps project metadata resources into the frontend model without components, data, or templates', () => {
    const bundle = normalizeProjectResourcesPayload({
      project: { id: 'client-project', name: 'Client Project' },
      resources: {
        components: [{ id: 'legacy-button', name: 'legacy-button' }],
        canvas: [{ id: 'legacy-canvas', name: 'legacy-canvas' }],
        prototypes: [
          {
            id: 'home',
            name: 'home-page',
            title: 'Home',
            clientUrl: 'http://localhost:3000/home',
            pages: [
              { id: 'dashboard', title: '工作台' },
              { id: 'orders-list', title: '订单列表' },
            ],
            defaultPageId: 'dashboard',
            filePath: 'src/prototypes/home-page/index.tsx',
            absoluteFilePath: '/workspace/src/prototypes/home-page/index.tsx',
            artifacts: {
              axure: {
                manifestPath: '.axhub/make/artifacts/axure/home-page/manifest.json',
                indexBundlePath: '.axhub/make/artifacts/axure/home-page/index-bundle.json',
              },
            },
          },
        ],
        docs: [
          {
            id: 'product-spec',
            title: 'Product Spec',
            path: '/workspace/docs/product-spec.md',
          },
        ],
        themes: [
          {
            id: 'mira',
            title: 'Mira Theme',
            clientUrl: 'http://localhost:3000/themes/mira',
            sourcePath: 'src/themes/mira',
            absoluteFilePath: '/workspace/src/themes/mira',
          },
        ],
        data: [{ fileName: 'users', tableName: 'Users' }],
        templates: [{ name: 'prd.md', displayName: 'PRD', path: 'content/templates/prd.md', absoluteFilePath: '/workspace/content/templates/prd.md' }],
      },
      orders: {
        themes: ['mira'],
        data: ['users'],
        templates: ['prd.md'],
      },
    }, null);

    expect(bundle.projectId).toBe('client-project');
    expect(bundle.projectName).toBe('Client Project');
    expect(bundle.capabilities.resourceWrites).toEqual({
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
    });
    expect(bundle.data.components).toEqual([]);
	    expect(bundle.data.prototypes).toEqual([
	      expect.objectContaining({
	        name: 'home',
	        displayName: 'Home',
	        clientUrl: 'http://localhost:3000/home',
	        previewUrl: 'http://localhost:3000/home',
	        pages: [
	          { id: 'dashboard', title: '工作台' },
	          { id: 'orders-list', title: '订单列表' },
	        ],
	        defaultPageId: 'dashboard',
	        specUrl: '',
        previewDisabled: false,
        filePath: 'src/prototypes/home-page/index.tsx',
        absoluteFilePath: '/workspace/src/prototypes/home-page/index.tsx',
        artifacts: {
          axure: {
            manifestPath: '.axhub/make/artifacts/axure/home-page/manifest.json',
            indexBundlePath: '.axhub/make/artifacts/axure/home-page/index-bundle.json',
          },
        },
	      }),
	    ]);
    expect(bundle.data.prototypes[0]).not.toHaveProperty('specFilePath');
    expect(bundle.data.prototypes[0]).not.toHaveProperty('specAbsoluteFilePath');
	    expect(bundle.data.prototypes[0]).not.toHaveProperty('demoUrl');
	    expect(bundle.docs).toEqual([
	      expect.objectContaining({
        name: 'product-spec',
        displayName: 'Product Spec',
        specUrl: '/api/markdown-file?path=%2Fworkspace%2Fdocs%2Fproduct-spec.md',
        previewUrl: '/spec-template.html?url=%2Fapi%2Fmarkdown-file%3Fpath%3D%252Fworkspace%252Fdocs%252Fproduct-spec.md',
        absoluteFilePath: '/workspace/docs/product-spec.md',
      }),
    ]);
    expect(bundle.themes).toEqual([
      expect.objectContaining({
	        name: 'mira',
	        displayName: 'Mira Theme',
	        clientUrl: 'http://localhost:3000/themes/mira',
	        previewUrl: 'http://localhost:3000/themes/mira',
	        path: 'src/themes/mira',
        absoluteFilePath: '/workspace/src/themes/mira',
        projectId: 'client-project',
	      }),
	    ]);
	    expect(bundle.themes[0]).not.toHaveProperty('demoUrl');
    expect(bundle.dataTables).toEqual([]);
    expect(bundle.templates).toEqual([]);
    expect(bundle.orders).toEqual({
      themes: ['mira'],
    });
  });

  it('preserves project capabilities for export availability decisions', () => {
    const bundle = normalizeProjectResourcesPayload({
      project: { id: 'client-project', name: 'Client Project' },
      resources: {
        prototypes: [
          {
            id: 'home',
            name: 'home',
            title: 'Home',
            clientUrl: 'http://localhost:3000/home',
          },
        ],
      },
      capabilities: {
        lanAccessAllowed: false,
        quickEdit: true,
        figmaExport: false,
        axureExport: true,
        multiDevicePreview: true,
        resourceWrites: {
          docCreate: true,
          docImport: true,
          templateCreate: true,
        },
        localExports: {
          html: true,
          make: false,
        },
      },
    }, null);

    expect(bundle.capabilities).toEqual({
      lanAccessAllowed: false,
      quickEdit: true,
      figmaExport: false,
      axureExport: true,
      localExports: {
        html: true,
        make: false,
      },
      resourceWrites: {
        prototypeCreate: false,
        prototypeUpload: false,
        docCreate: true,
        docImport: true,
        themeCreate: false,
        themeImport: false,
        dataCreate: false,
        dataImport: false,
        templateCreate: true,
        templateDuplicate: false,
      },
    });
  });

  it('defaults all resource write capabilities to false when metadata omits them', () => {
    const bundle = normalizeProjectResourcesPayload({
      project: { id: 'metadata-only', name: 'Metadata Only' },
      resources: {
        prototypes: [
          {
            id: 'home',
            name: 'home',
            title: 'Home',
            clientUrl: 'http://localhost:3000/home',
          },
        ],
      },
      capabilities: {
        quickEdit: true,
      },
    }, null);

    expect(bundle.capabilities.resourceWrites).toEqual({
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
    });
    expect(bundle.capabilities.localExports).toEqual({
      html: false,
      make: false,
    });
    expect(bundle.capabilities.lanAccessAllowed).toBe(true);
  });

  it('marks prototypes without clientUrl as disabled without inventing a preview endpoint', () => {
    const bundle = normalizeProjectResourcesPayload({
      resources: {
        prototypes: [{ id: 'empty-link', title: 'Empty Link' }],
      },
    }, 'explicit-project');

	    expect(bundle.data.prototypes).toEqual([
	      expect.objectContaining({
	        name: 'empty-link',
	        previewUrl: '',
	        specUrl: '',
	        previewDisabled: true,
	      }),
	    ]);
	    expect(bundle.data.prototypes[0]).not.toHaveProperty('demoUrl');
  });

  it('preserves placeholder guide metadata for empty prototype guidance', () => {
    const bundle = normalizeProjectResourcesPayload({
      resources: {
        prototypes: [
          {
            id: 'untitled',
            title: '未命名',
            clientUrl: 'http://localhost:3000/prototypes/untitled',
            filePath: 'src/prototypes/untitled/index.tsx',
            placeholder: true,
            placeholderGuide: {
              kind: 'prototype-empty',
              title: '这个原型还没有开始创建',
              description: '告诉 AI 你想做什么：目标用户、使用场景、页面内容和参考风格。',
              steps: ['在本地 AI 软件中打开本页面', '打开画布创作原型'],
              tips: ['模型不要用 auto，推荐：Claude Opus 4.7、Gemini 3.1 Pro、GPT-5.5、Kimi K2.6、GLM-5.1。'],
            },
          },
        ],
      },
    }, 'client-project');

    expect(bundle.data.prototypes).toEqual([
      expect.objectContaining({
        name: 'untitled',
        placeholder: true,
        placeholderGuide: {
          kind: 'prototype-empty',
          title: '这个原型还没有开始创建',
          description: '告诉 AI 你想做什么：目标用户、使用场景、页面内容和参考风格。',
          steps: ['在本地 AI 软件中打开本页面', '打开画布创作原型'],
          tips: ['模型不要用 auto，推荐：Claude Opus 4.7、Gemini 3.1 Pro、GPT-5.5、Kimi K2.6、GLM-5.1。'],
        },
      }),
    ]);
  });

  it('adds Admin placeholder guide metadata for placeholder prototypes missing legacy guide data', () => {
    const bundle = normalizeProjectResourcesPayload({
      resources: {
        prototypes: [
          {
            id: 'untitled-4',
            title: '未命名',
            clientUrl: 'http://localhost:3000/prototypes/untitled-4',
            filePath: 'src/prototypes/untitled-4/index.tsx',
            placeholder: true,
          },
        ],
      },
    }, 'client-project');

    expect(bundle.data.prototypes).toEqual([
      expect.objectContaining({
        name: 'untitled-4',
        placeholder: true,
        placeholderGuide: expect.objectContaining({
          kind: 'prototype-empty',
          title: '这个原型还没有开始创建',
          description: '告诉 AI 你想做什么：目标用户、使用场景、页面内容和参考风格。',
        }),
      }),
    ]);
  });

  it('does not expose the spec mode URL unless the prototype declares its own spec path', () => {
    const bundle = normalizeProjectResourcesPayload({
      resources: {
        prototypes: [
          {
            id: 'metadata-only',
            title: 'Metadata Only',
            clientUrl: 'http://localhost:3000/metadata-only',
          },
        ],
      },
    }, 'client-project');

	    expect(bundle.data.prototypes).toEqual([
	      expect.objectContaining({
	        name: 'metadata-only',
	        previewUrl: 'http://localhost:3000/metadata-only',
	        specUrl: '',
	      }),
	    ]);
	    expect(bundle.data.prototypes[0]).not.toHaveProperty('demoUrl');
  });

  it('normalizes theme resources from metadata without requiring designTokenPath', () => {
    const bundle = normalizeProjectResourcesPayload({
      resources: {
        themes: [
          {
            id: 'brand-dark',
            title: 'Brand Dark',
            clientUrl: 'http://localhost:3000/themes/brand-dark',
            sourcePath: 'src/themes/brand-dark',
            designTokenPath: 'src/themes/brand-dark/designToken.json',
          },
          {
            name: 'legacy-theme',
            displayName: 'Legacy Theme',
            previewUrl: 'http://localhost:3000/legacy-theme-preview',
          },
          {
            id: 'theme-without-link',
            title: 'Theme Without Link',
          },
        ],
      },
    }, 'client-project');

    expect(bundle.themes).toEqual([
      expect.objectContaining({
	        name: 'brand-dark',
	        displayName: 'Brand Dark',
	        clientUrl: 'http://localhost:3000/themes/brand-dark',
	        previewUrl: 'http://localhost:3000/themes/brand-dark',
	        path: 'src/themes/brand-dark',
	        projectId: 'client-project',
	      }),
      expect.objectContaining({
        name: 'legacy-theme',
	        displayName: 'Legacy Theme',
	        clientUrl: 'http://localhost:3000/legacy-theme-preview',
	        previewUrl: 'http://localhost:3000/legacy-theme-preview',
	        projectId: 'client-project',
	      }),
	      expect.objectContaining({
	        name: 'theme-without-link',
	        displayName: 'Theme Without Link',
	        clientUrl: '',
	        previewUrl: '',
	        projectId: 'client-project',
	      }),
	    ]);
	    expect(bundle.themes.every((theme) => !Object.prototype.hasOwnProperty.call(theme, 'demoUrl'))).toBe(true);
    expect(bundle.themes[0]).not.toHaveProperty('designTokenPath');
  });

  it('builds encoded doc content endpoints without a prototype preview endpoint helper', () => {
    expect(buildDocContentEndpoint('project/one', 'product spec')).toBe(
      '/api/projects/project%2Fone/docs/product%20spec/content',
    );
  });

  it('uses direct file previews for non-markdown doc resources from project metadata', () => {
    const bundle = normalizeProjectResourcesPayload({
      project: { id: 'client-project', name: 'Client Project' },
      resources: {
        docs: [
          {
            id: 'assets/logo.png',
            title: 'assets/logo',
            path: '/workspace/src/resources/assets/logo.png',
          },
        ],
      },
    }, null);

    expect(bundle.docs).toEqual([
      expect.objectContaining({
        name: 'assets/logo.png',
        displayName: 'assets/logo',
        specUrl: '/api/markdown-file?path=%2Fworkspace%2Fsrc%2Fresources%2Fassets%2Flogo.png',
        previewUrl: '/api/markdown-file?path=%2Fworkspace%2Fsrc%2Fresources%2Fassets%2Flogo.png',
      }),
    ]);
  });

  it('falls back to project doc content endpoints when no Markdown file path is available', () => {
    const bundle = normalizeProjectResourcesPayload({
      project: { id: 'client-project', name: 'Client Project' },
      resources: {
        docs: [
          {
            id: 'remote-spec',
            title: 'Remote Spec',
          },
        ],
      },
    }, null);

    expect(bundle.docs).toEqual([
      expect.objectContaining({
        name: 'remote-spec',
        specUrl: '/api/projects/client-project/docs/remote-spec/content',
        previewUrl: '/spec-template.html?url=%2Fapi%2Fprojects%2Fclient-project%2Fdocs%2Fremote-spec%2Fcontent',
      }),
    ]);
  });

  it('normalizes project registry payloads for the switcher', () => {
    const projects = normalizeProjectsPayload({
      activeProjectId: 'client-a',
      projects: [
        {
          id: 'client-a',
          name: 'Client A',
          root: '/workspace/client-a',
          metadataPath: '/workspace/client-a/.axhub/make/project.json',
          updatedAt: '2026-05-03T00:00:00.000Z',
        },
        {
          id: '',
          name: 'Broken',
          root: '/workspace/broken',
        },
      ],
    });

    expect(projects).toEqual({
      activeProjectId: 'client-a',
      projects: [
        expect.objectContaining({
          id: 'client-a',
          name: 'Client A',
          root: '/workspace/client-a',
          metadataPath: '/workspace/client-a/.axhub/make/project.json',
        }),
      ],
    });
  });

  it('normalizes project runtime status for make startup empty states', () => {
    expect(normalizeProjectRuntimeStatusPayload({
      projectId: 'make-client',
      makeClient: true,
      running: true,
      runtime: {
        origin: 'http://localhost:5175',
      },
    }, 'fallback')).toEqual(expect.objectContaining({
      projectId: 'make-client',
      makeClient: true,
      running: true,
      reason: '',
      runtime: expect.objectContaining({
        origin: 'http://localhost:5175',
      }),
    }));

    expect(normalizeProjectRuntimeStatusPayload({
      projectId: 'make-client',
      makeClient: true,
      running: false,
      reason: 'stale-runtime',
    }, null)).toEqual({
      projectId: 'make-client',
      makeClient: true,
      running: false,
      reason: 'stale-runtime',
      runtime: null,
    });

    expect(normalizeProjectRuntimeStatusPayload({
      projectId: 'plain-client',
      makeClient: false,
    }, null)).toEqual({
      projectId: 'plain-client',
      makeClient: false,
      running: false,
      reason: 'not-make-client',
      runtime: null,
    });
  });
});
