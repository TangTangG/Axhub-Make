import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getProjectMetadataPath } from '../projectCore/index.ts';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  startTestServer,
  writeProjectMetadata,
} from './projects-api.helpers';

const TEMPLATE_REPO = 'lintendo/Make-Template';
const DEFAULT_TEMPLATE_INDEX = {
  schemaVersion: 1,
  templates: [
    {
      id: 'ref-free',
      title: 'Remote Free',
      slug: 'ref-free',
      sourcePath: 'templates/ref-free',
      coverPath: 'covers/ref-free.svg',
      description: 'Dependency-free remote template',
      extraDependencies: [],
    },
    {
      id: 'ref-three',
      title: 'Remote Three',
      slug: 'ref-three',
      sourcePath: 'templates/ref-three',
      coverPath: 'covers/ref-three.svg',
      description: 'Template with a 3D dependency',
      extraDependencies: ['three'],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanupProjectApiTestRoots();
});

function writeTemplateEnabledProject(projectRoot: string, id = 'template-library-client'): void {
  writeProjectMetadata(projectRoot, {
    project: { id, name: id },
    resources: {
      prototypes: [],
      docs: [],
      themes: [],
      data: [],
      templates: [],
    },
    navigation: { prototypes: [], docs: [] },
    orders: { themes: [], data: [], templates: [] },
    capabilities: {
      quickEdit: true,
      quickEditMode: 'clientRuntime',
      figmaExport: true,
      axureExport: true,
      multiDevicePreview: true,
      resourceWrites: {
        prototypeUpload: true,
      },
    },
    resourceWriteTargets: {
      prototypes: { path: 'content/prototypes' },
    },
  });
}

function readMetadata(projectRoot: string): any {
  return JSON.parse(fs.readFileSync(getProjectMetadataPath(projectRoot), 'utf8'));
}

function createTemplateTarball(files: Record<string, string>): string {
  const archiveRoot = createTempRoot('axhub-make-template-tar-root-');
  const repoRoot = path.join(archiveRoot, 'lintendo-Make-Template-main');
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(repoRoot, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }
  const tarPath = path.join(createTempRoot('axhub-make-template-tar-file-'), 'make-template.tar.gz');
  execFileSync('tar', ['-czf', tarPath, '-C', archiveRoot, path.basename(repoRoot)]);
  return tarPath;
}

function mockGitHubResponses(params: {
  index?: unknown;
  branch?: string;
  tarballPath?: string;
  repoStatus?: number;
  rawStatus?: number;
  tarStatus?: number;
} = {}): void {
  const originalFetch = globalThis.fetch;
  const branch = params.branch || 'main';
  const index = params.index ?? DEFAULT_TEMPLATE_INDEX;
  const rawIndexResponse = () => new Response(JSON.stringify(index), {
    status: params.rawStatus || 200,
    headers: { 'Content-Type': 'application/json' },
  });
  const tarResponse = () => new Response(params.tarballPath ? fs.readFileSync(params.tarballPath) : 'missing tarball', {
    status: params.tarStatus || 200,
    headers: { 'Content-Type': 'application/gzip' },
  });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    if (url.startsWith('http://localhost:')) {
      return originalFetch(input, init);
    }
    if (url === `https://api.github.com/repos/${TEMPLATE_REPO}`) {
      return new Response(JSON.stringify({ default_branch: branch }), {
        status: params.repoStatus || 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url === `https://raw.githubusercontent.com/${TEMPLATE_REPO}/${branch}/templates.json`) {
      return rawIndexResponse();
    }
    if (url === `https://raw.githubusercontent.com/${TEMPLATE_REPO}/HEAD/templates.json`) {
      return rawIndexResponse();
    }
    if (url === `https://codeload.github.com/${TEMPLATE_REPO}/tar.gz/${branch}`) {
      return tarResponse();
    }
    if (url === `https://codeload.github.com/${TEMPLATE_REPO}/tar.gz/HEAD`) {
      return tarResponse();
    }
    return new Response(`Unexpected URL: ${url}`, { status: 404 });
  }));
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  return {
    status: response.status,
    body: await response.json(),
  };
}

describe('make-server project template library APIs', () => {
  it('lists remote templates from mocked GitHub responses', async () => {
    const projectRoot = createTempRoot();
    writeTemplateEnabledProject(projectRoot);
    mockGitHubResponses();
    const server = await startTestServer(projectRoot);

    try {
      const listed = await fetchJson(`${server.origin}/api/template-library`);

      expect(listed.status).toBe(200);
      expect(listed.body).toMatchObject({
        schemaVersion: 1,
        source: {
          repo: TEMPLATE_REPO,
          branch: 'main',
        },
      });
      expect(listed.body.templates).toHaveLength(2);
      expect(listed.body.templates[0]).toMatchObject({
        id: 'ref-free',
        title: 'Remote Free',
        slug: 'ref-free',
        coverUrl: `https://raw.githubusercontent.com/${TEMPLATE_REPO}/main/covers/ref-free.svg`,
        sourceUrl: `https://github.com/${TEMPLATE_REPO}/tree/main/templates/ref-free`,
        canDirectImport: true,
      });
      expect(listed.body.templates[1]).toMatchObject({
        id: 'ref-three',
        canDirectImport: false,
      });
      expect(listed.body.templates[1].directImportDisabledReason).toContain('three');
    } finally {
      await server.close();
    }
  });

  it('returns a structured error for invalid template schema and unsafe paths', async () => {
    const projectRoot = createTempRoot();
    writeTemplateEnabledProject(projectRoot);
    mockGitHubResponses({
      index: {
        schemaVersion: 1,
        templates: [
          {
            id: 'unsafe',
            title: 'Unsafe',
            slug: 'unsafe',
            sourcePath: '../outside',
            coverPath: 'covers/unsafe.svg',
            description: 'Unsafe path',
            extraDependencies: [],
          },
        ],
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const listed = await fetchJson(`${server.origin}/api/template-library`);

      expect(listed.status).toBe(502);
      expect(listed.body).toMatchObject({
        code: 'TEMPLATE_LIBRARY_SCHEMA_INVALID',
      });
      expect(listed.body.error).toContain('sourcePath');
    } finally {
      await server.close();
    }
  });

  it('imports a dependency-free template into the declared prototypes target', async () => {
    const projectRoot = createTempRoot();
    writeTemplateEnabledProject(projectRoot, 'template-import-client');
    const tarballPath = createTemplateTarball({
      'templates/ref-free/index.tsx': [
        '/**',
        ' * @name Remote Free',
        ' */',
        'export default function RemoteFree() { return <div>Remote</div>; }',
        '',
      ].join('\n'),
      'templates/ref-free/style.css': '.remote-free { color: red; }\n',
    });
    mockGitHubResponses({ tarballPath });
    const server = await startTestServer(projectRoot);

    try {
      const imported = await fetchJson(`${server.origin}/api/template-library/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: 'ref-free' }),
      });

      expect(imported).toMatchObject({
        status: 200,
        body: {
          success: true,
          projectId: 'template-import-client',
          templateId: 'ref-free',
          folderName: 'ref-free',
          path: 'prototypes/ref-free',
          filePath: 'content/prototypes/ref-free/index.tsx',
          absoluteFilePath: path.join(projectRoot, 'content/prototypes/ref-free/index.tsx'),
          clientUrl: `${server.origin}/prototypes/ref-free`,
        },
      });
      expect(fs.readFileSync(path.join(projectRoot, 'content/prototypes/ref-free/index.tsx'), 'utf8'))
        .toContain('RemoteFree');
      expect(fs.readFileSync(path.join(projectRoot, 'content/prototypes/ref-free/style.css'), 'utf8'))
        .toBe('.remote-free { color: red; }\n');

      const metadata = readMetadata(projectRoot);
      expect(metadata.resources.prototypes).toEqual([
        expect.objectContaining({
          id: 'ref-free',
          name: 'ref-free',
          title: 'Remote Free',
          description: 'Dependency-free remote template',
          filePath: 'content/prototypes/ref-free/index.tsx',
          absoluteFilePath: path.join(projectRoot, 'content/prototypes/ref-free/index.tsx'),
          clientUrl: `${server.origin}/prototypes/ref-free`,
        }),
      ]);
      expect(metadata.navigation.prototypes).toEqual(['ref-free']);
    } finally {
      await server.close();
    }
  });

  it('rejects direct import when extraDependencies is non-empty', async () => {
    const projectRoot = createTempRoot();
    writeTemplateEnabledProject(projectRoot, 'template-extra-deps-client');
    const tarballPath = createTemplateTarball({
      'templates/ref-three/index.tsx': 'export default function ThreeTemplate() { return null; }\n',
    });
    mockGitHubResponses({ tarballPath });
    const server = await startTestServer(projectRoot);

    try {
      const imported = await fetchJson(`${server.origin}/api/template-library/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: 'ref-three' }),
      });

      expect(imported.status).toBe(409);
      expect(imported.body).toMatchObject({
        code: 'TEMPLATE_LIBRARY_DIRECT_IMPORT_DISABLED',
        templateId: 'ref-three',
      });
      expect(imported.body.error).toContain('three');
      expect(fs.existsSync(path.join(projectRoot, 'content/prototypes/ref-three'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('rejects direct import when the target folder already exists', async () => {
    const projectRoot = createTempRoot();
    writeTemplateEnabledProject(projectRoot, 'template-existing-target-client');
    const existingIndexPath = path.join(projectRoot, 'content/prototypes/ref-free/index.tsx');
    fs.mkdirSync(path.dirname(existingIndexPath), { recursive: true });
    fs.writeFileSync(existingIndexPath, 'existing\n', 'utf8');
    const tarballPath = createTemplateTarball({
      'templates/ref-free/index.tsx': 'export default function RemoteFree() { return null; }\n',
    });
    mockGitHubResponses({ tarballPath });
    const server = await startTestServer(projectRoot);

    try {
      const imported = await fetchJson(`${server.origin}/api/template-library/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: 'ref-free' }),
      });

      expect(imported.status).toBe(409);
      expect(imported.body).toMatchObject({
        code: 'TEMPLATE_LIBRARY_TARGET_EXISTS',
        folderName: 'ref-free',
      });
      expect(fs.readFileSync(existingIndexPath, 'utf8')).toBe('existing\n');
    } finally {
      await server.close();
    }
  });

  it('rejects direct import when prototype write capability or target is missing', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'template-no-target-client', name: 'Template No Target Client' },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
        resourceWrites: {
          prototypeUpload: true,
        },
      },
    });
    mockGitHubResponses();
    const server = await startTestServer(projectRoot);

    try {
      const imported = await fetchJson(`${server.origin}/api/template-library/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: 'ref-free' }),
      });

      expect(imported.status).toBe(424);
      expect(imported.body).toMatchObject({
        code: 'TEMPLATE_LIBRARY_IMPORT_ADAPTER_REQUIRED',
        adapterRequired: true,
        projectId: 'template-no-target-client',
      });
    } finally {
      await server.close();
    }
  });

  it('returns a structured error when remote GitHub reads fail without local fallback', async () => {
    const projectRoot = createTempRoot();
    writeTemplateEnabledProject(projectRoot);
    mockGitHubResponses({ repoStatus: 500, rawStatus: 500 });
    const server = await startTestServer(projectRoot);

    try {
      const listed = await fetchJson(`${server.origin}/api/template-library`);

      expect(listed.status).toBe(502);
      expect(listed.body).toMatchObject({
        code: 'TEMPLATE_LIBRARY_REMOTE_UNAVAILABLE',
      });
      expect(listed.body).not.toHaveProperty('templates');
    } finally {
      await server.close();
    }
  });

  it('falls back to GitHub HEAD when repo metadata is rate limited', async () => {
    const projectRoot = createTempRoot();
    writeTemplateEnabledProject(projectRoot);
    mockGitHubResponses({ repoStatus: 403 });
    const server = await startTestServer(projectRoot);

    try {
      const listed = await fetchJson(`${server.origin}/api/template-library`);

      expect(listed.status).toBe(200);
      expect(listed.body).toMatchObject({
        source: {
          repo: TEMPLATE_REPO,
          branch: 'HEAD',
        },
      });
      expect(listed.body.templates[0]).toMatchObject({
        id: 'ref-free',
        coverUrl: `https://raw.githubusercontent.com/${TEMPLATE_REPO}/HEAD/covers/ref-free.svg`,
        sourceUrl: `https://github.com/${TEMPLATE_REPO}/tree/HEAD/templates/ref-free`,
      });
    } finally {
      await server.close();
    }
  });

  it('normalizes legacy remote templates without extraDependencies to an empty dependency list', async () => {
    const projectRoot = createTempRoot();
    writeTemplateEnabledProject(projectRoot);
    mockGitHubResponses({
      index: {
        schemaVersion: 1,
        templates: [
          {
            id: 'ref-legacy',
            title: 'Legacy Template',
            slug: 'ref-legacy',
            sourcePath: 'templates/ref-legacy',
            coverPath: 'covers/ref-legacy.svg',
            description: 'Legacy template before dependency metadata existed',
          },
        ],
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const listed = await fetchJson(`${server.origin}/api/template-library`);

      expect(listed.status).toBe(200);
      expect(listed.body.templates).toEqual([
        expect.objectContaining({
          id: 'ref-legacy',
          extraDependencies: [],
          canDirectImport: true,
        }),
      ]);
    } finally {
      await server.close();
    }
  });
});
