import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getProjectMetadataPath,
} from '../projectCore/index.ts';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  registerProject,
  setActiveProject,
  startTestServer,
  writeJson,
  writeProjectMetadata,
} from './projects-api.helpers';
import { handleFileOperationsApi } from '../managementApi.fileOperations.ts';
import { handleLegacyDocsApi } from '../managementApi.legacyDocs.ts';
import { handleProjectSourceAndZipApi } from '../managementApi.sourceZip.ts';

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjectApiTestRoots();
});

const makePackageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../package.json');

describe('make-server project legacy compatibility APIs', () => {
  it('exposes source and zip compatibility handling from its domain module', () => {
    expect(handleProjectSourceAndZipApi).toBeTypeOf('function');
  });

  it('exposes legacy file operation handling from its domain module', () => {
    expect(handleFileOperationsApi).toBeTypeOf('function');
  });

  it('exposes legacy docs handling from its domain module', () => {
    expect(handleLegacyDocsApi).toBeTypeOf('function');
  });

  it('routes legacy compatibility APIs through the active project context', async () => {
    const firstRoot = createTempRoot();
    const secondRoot = createTempRoot();
    writeProjectMetadata(firstRoot, {
      project: { id: 'first-client', name: 'First Client' },
    });
    writeProjectMetadata(secondRoot, {
      project: { id: 'second-client', name: 'Second Client' },
    });
    fs.mkdirSync(path.join(firstRoot, 'src', 'resources'), { recursive: true });
    fs.mkdirSync(path.join(secondRoot, 'src', 'resources'), { recursive: true });
    fs.mkdirSync(path.join(firstRoot, 'src', 'prototypes', 'first-only'), { recursive: true });
    fs.mkdirSync(path.join(secondRoot, 'src', 'prototypes', 'second-only'), { recursive: true });
    fs.writeFileSync(path.join(firstRoot, 'src', 'resources', 'first.md'), '# First\n', 'utf8');
    fs.writeFileSync(path.join(secondRoot, 'src', 'resources', 'second.md'), '# Second\n', 'utf8');
    fs.writeFileSync(path.join(firstRoot, 'src', 'prototypes', 'first-only', 'index.tsx'), 'export default function FirstOnly() { return null; }\n', 'utf8');
    fs.writeFileSync(path.join(secondRoot, 'src', 'prototypes', 'second-only', 'index.tsx'), 'export default function SecondOnly() { return null; }\n', 'utf8');
    writeJson(path.join(firstRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
      projectInfo: { name: 'First Config' },
    });
    writeJson(path.join(secondRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
      projectInfo: { name: 'Second Config' },
    });

    const server = await startTestServer(firstRoot);

    try {
      await registerProject(server.origin, secondRoot, 'second-client', 'Second Client');
      await setActiveProject(server.origin, 'second-client');

      const config = await fetch(`${server.origin}/api/config`).then((response) => response.json());
      expect(config.projectPath).toBe(secondRoot);
      expect(config.projectInfo.name).toBe('Second Client');

      const docs = await fetch(`${server.origin}/api/docs`).then((response) => response.json());
      expect(docs.map((doc: any) => doc.name)).toEqual(['second.md']);

      const markdown = await fetch(`${server.origin}/api/markdown-file?path=${encodeURIComponent('src/resources/second.md')}`)
        .then((response) => response.text());
      expect(markdown).toBe('# Second\n');

      const markdownMeta = await fetch(`${server.origin}/api/markdown-file-meta?path=${encodeURIComponent('src/resources/second.md')}`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(markdownMeta).toMatchObject({
        status: 200,
        body: {
          exists: true,
          path: path.join(secondRoot, 'src', 'resources', 'second.md'),
          updatedAt: expect.any(String),
        },
      });

      const saveMarkdown = await fetch(`${server.origin}/api/markdown-file?path=${encodeURIComponent('src/resources/second.md')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# Updated Second\n' }),
      });
      expect(saveMarkdown.status).toBe(200);
      expect(fs.readFileSync(path.join(secondRoot, 'src', 'resources', 'second.md'), 'utf8')).toBe('# Updated Second\n');

      const forbidden = await fetch(`${server.origin}/api/markdown-file?path=${encodeURIComponent(path.join(firstRoot, 'src/resources/first.md'))}`);
      expect(forbidden.status).toBe(403);

      const forbiddenMeta = await fetch(`${server.origin}/api/markdown-file-meta?path=${encodeURIComponent(path.join(firstRoot, 'src/resources/first.md'))}`);
      expect(forbiddenMeta.status).toBe(403);

      const navigation = await fetch(`${server.origin}/api/workspace/navigation?tab=prototypes`)
        .then((response) => response.json());
      const itemKeys = JSON.stringify(navigation.tree);
      expect(itemKeys).toContain('prototypes/second-only');
      expect(itemKeys).not.toContain('prototypes/first-only');
    } finally {
      await server.close();
    }
  });

  it('hides resource README and dot-prefixed files from the legacy docs list', async () => {
    const projectRoot = createTempRoot();
    const resourcesDir = path.join(projectRoot, 'src', 'resources');
    fs.mkdirSync(path.join(resourcesDir, '.cache'), { recursive: true });
    fs.writeFileSync(path.join(resourcesDir, 'README.md'), '# Resources\n', 'utf8');
    fs.writeFileSync(path.join(resourcesDir, '.draft.md'), '# Draft\n', 'utf8');
    fs.writeFileSync(path.join(resourcesDir, '.cache', 'secret.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(resourcesDir, 'visible.json'), '{}\n', 'utf8');
    writeProjectMetadata(projectRoot, {
      project: { id: 'legacy-docs-list', name: 'Legacy Docs List' },
      resourceWriteTargets: {
        docs: { type: 'project-relative-path', path: 'src/resources' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const docs = await fetch(`${server.origin}/api/docs`).then((response) => response.json());
      expect(docs.map((doc: any) => doc.name)).toEqual(['visible.json']);
    } finally {
      await server.close();
    }
  });

  it('supports legacy spec-doc protocol for standalone Markdown docs through the active project context', async () => {
    const projectRoot = createTempRoot();
    const docsDir = path.join(projectRoot, 'src', 'resources');
    fs.mkdirSync(path.join(docsDir, 'images'), { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'guide.md'), '# Guide\n![Logo](images/logo.svg)\n', 'utf8');
    fs.writeFileSync(path.join(docsDir, 'images', 'logo.svg'), '<svg />', 'utf8');

    const server = await startTestServer(projectRoot);

    try {
      const saveDoc = await fetch(`${server.origin}/api/spec-doc/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docUrl: '/docs/guide.md',
          content: '# Updated Guide\n',
        }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(saveDoc).toMatchObject({
        status: 200,
        body: {
          success: true,
          path: path.join(projectRoot, 'src', 'resources', 'guide.md'),
        },
      });
      expect(fs.readFileSync(path.join(docsDir, 'guide.md'), 'utf8')).toBe('# Updated Guide\n');

      const formData = new FormData();
      formData.append('docUrl', '/docs/guide.md');
      formData.append('file', new File(['png'], 'hero.png', { type: 'image/png' }));
      const uploadImage = await fetch(`${server.origin}/api/spec-doc/upload-image`, {
        method: 'POST',
        body: formData,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(uploadImage).toMatchObject({
        status: 201,
        body: {
          success: true,
          path: 'src/resources/assets/hero.png',
          url: 'assets/hero.png',
        },
      });
      expect(fs.readFileSync(path.join(docsDir, 'assets', 'hero.png'), 'utf8')).toBe('png');

      const prototypeSpecSave = await fetch(`${server.origin}/api/spec-doc/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docUrl: '/prototypes/home/spec.md',
          content: '# Should Not Be Created\n',
        }),
      });
      expect(prototypeSpecSave.status).toBe(400);
      expect(fs.existsSync(path.join(projectRoot, 'src', 'prototypes', 'home', 'spec.md'))).toBe(false);

      const asset = await fetch(`${server.origin}/api/markdown-file-asset?path=${encodeURIComponent('src/resources/guide.md')}&asset=${encodeURIComponent('images/logo.svg')}`);
      expect(asset.status).toBe(200);
      expect(asset.headers.get('content-type')).toBe('image/svg+xml');
      await expect(asset.text()).resolves.toBe('<svg />');

      const forbiddenAsset = await fetch(`${server.origin}/api/markdown-file-asset?path=${encodeURIComponent('src/resources/guide.md')}&asset=${encodeURIComponent('../secret.svg')}`);
      expect(forbiddenAsset.status).toBe(403);
    } finally {
      await server.close();
    }
  });

  it('rejects legacy delete requests that target the active project root', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'delete-root-client', name: 'Delete Root Client' },
    });
    const server = await startTestServer(projectRoot);

    try {
      const deleted = await fetch(`${server.origin}/api/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '.' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(deleted).toMatchObject({
        status: 403,
        body: {
          code: 'PROJECT_ROOT_OPERATION_FORBIDDEN',
        },
      });
      expect(fs.existsSync(projectRoot)).toBe(true);
      expect(fs.existsSync(getProjectMetadataPath(projectRoot))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('routes legacy source and zip fallbacks through explicit projectId', async () => {
    const firstRoot = createTempRoot();
    const secondRoot = createTempRoot();
    writeProjectMetadata(firstRoot, {
      project: { id: 'first-client', name: 'First Client' },
    });
    writeProjectMetadata(secondRoot, {
      project: { id: 'second-client', name: 'Second Client' },
    });
    const secondPrototypeDir = path.join(secondRoot, 'src', 'prototypes', 'dashboard');
    fs.mkdirSync(secondPrototypeDir, { recursive: true });
    fs.writeFileSync(path.join(secondPrototypeDir, 'index.tsx'), 'export default function Dashboard() { return "second"; }\n', 'utf8');

    const server = await startTestServer(firstRoot);

    try {
      await registerProject(server.origin, secondRoot, 'second-client', 'Second Client');

      const source = await fetch(`${server.origin}/api/source?projectId=second-client&path=${encodeURIComponent('prototypes/dashboard')}`);
      expect(source.status).toBe(200);
      expect(await source.text()).toContain('Dashboard');

      const zipProbe = await fetch(`${server.origin}/api/zip?projectId=second-client&path=${encodeURIComponent('prototypes/dashboard')}&probe=1`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(zipProbe).toMatchObject({
        status: 200,
        body: {
          ok: true,
          fileName: 'dashboard.zip',
          path: 'prototypes/dashboard',
          projectId: 'second-client',
        },
      });
    } finally {
      await server.close();
    }
  });

  it('exports metadata-backed design directories as ZIP archives', async () => {
    const projectRoot = createTempRoot();
    const themeDir = path.join(projectRoot, 'src', 'themes', 'brand-design');
    fs.mkdirSync(themeDir, { recursive: true });
    fs.writeFileSync(path.join(themeDir, 'designToken.json'), '{"name":"Brand Design"}\n', 'utf8');
    fs.writeFileSync(path.join(themeDir, 'style.css'), '.brand { color: red; }\n', 'utf8');
    writeProjectMetadata(projectRoot, {
      project: { id: 'theme-directory-export', name: 'Theme Directory Export' },
      resources: {
        themes: [
          {
            id: 'brand-design',
            name: 'brand-design',
            title: 'Brand Design',
            path: 'src/themes/brand-design',
            sourcePath: 'src/themes/brand-design',
          },
        ],
      },
    });

    const server = await startTestServer(projectRoot);

    try {
      const zipProbe = await fetch(`${server.origin}/api/zip?path=${encodeURIComponent('src/themes/brand-design')}&probe=1`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(zipProbe).toMatchObject({
        status: 200,
        body: {
          ok: true,
          fileName: 'brand-design.zip',
          path: 'src/themes/brand-design',
          projectId: 'theme-directory-export',
        },
      });
    } finally {
      await server.close();
    }
  });

  it('returns stable disabled responses for source APIs and validates prompt execute on metadata-only projects', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'metadata-only', name: 'Metadata Only' },
      resources: {
        prototypes: [
          {
            id: 'preview',
            name: 'preview',
            title: 'Preview',
            clientUrl: 'http://localhost:3000/preview',
          },
        ],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
    });

    const server = await startTestServer(projectRoot);

    try {
      const source = await fetch(`${server.origin}/api/source?path=${encodeURIComponent('prototypes/preview')}`);
      const sourceBody = await source.json();
      expect(source.status).toBe(424);
      expect(sourceBody).toMatchObject({
        code: 'SOURCE_METADATA_REQUIRED',
        projectId: 'metadata-only',
      });

      const exportBundle = await fetch(`${server.origin}/api/export-index-bundle?path=${encodeURIComponent('prototypes/preview')}`);
      const exportBundleBody = await exportBundle.json();
      expect(exportBundle.status).toBe(424);
      expect(exportBundleBody).toMatchObject({
        code: 'SOURCE_METADATA_REQUIRED',
        adapterRequired: true,
      });

      const exportHtml = await fetch(`${server.origin}/api/export-html?path=${encodeURIComponent('prototypes/preview')}`);
      const exportHtmlBody = await exportHtml.json();
      expect(exportHtml.status).toBe(424);
      expect(exportHtmlBody).toMatchObject({
        code: 'ADAPTER_REQUIRED',
        adapterRequired: true,
      });

      const promptExecute = await fetch(`${server.origin}/api/prompt/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(promptExecute).toMatchObject({
        status: 400,
        body: {
          code: 'PROMPT_EXECUTION_CLIENT_UNSUPPORTED',
          projectId: 'metadata-only',
        },
      });
    } finally {
      await server.close();
    }
  });

  it('honors explicit projectId on legacy routes and validates IDE targets against the selected project', async () => {
    const firstRoot = createTempRoot();
    const secondRoot = createTempRoot();
    writeProjectMetadata(firstRoot, {
      project: { id: 'first-client', name: 'First Client' },
    });
    writeProjectMetadata(secondRoot, {
      project: { id: 'second-client', name: 'Second Client' },
    });
    writeJson(path.join(secondRoot, '.axhub', 'make', 'axhub.config.json'), {
      server: { host: 'localhost', allowLAN: true },
      projectInfo: { name: 'Second Config' },
    });

    const server = await startTestServer(firstRoot);

    try {
      await registerProject(server.origin, secondRoot, 'second-client', 'Second Client');

      const config = await fetch(`${server.origin}/api/config?projectId=second-client`).then((response) => response.json());
      expect(config).toMatchObject({
        projectId: 'second-client',
        projectPath: secondRoot,
        projectInfo: { name: 'Second Client' },
      });

      const ide = await fetch(`${server.origin}/api/ide/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'second-client', targetPath: '../outside' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(ide).toMatchObject({
        status: 403,
        body: {
          code: 'PATH_OUTSIDE_PROJECT',
          projectId: 'second-client',
        },
      });

      await setActiveProject(server.origin, 'second-client');
      writeJson(path.join(secondRoot, 'package.json'), {
        version: '0.1.0',
        scripts: { dev: 'vite' },
      });
      const version = await fetch(`${server.origin}/api/version`).then((response) => response.json());
      expect(version.projectId).toBe('second-client');
      expect(version.version).toBe(JSON.parse(fs.readFileSync(makePackageJsonPath, 'utf8')).version);
      expect(version.version).not.toBe('0.1.0');

      fs.mkdirSync(path.join(firstRoot, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(firstRoot, 'dist', 'first.txt'), 'first\n', 'utf8');
      const dist = await fetch(`${server.origin}/api/download-dist`);
      const distBody = await dist.json().catch(() => ({}));
      expect(dist.status).toBe(404);
      expect(distBody.error).toBe('Dist directory not found');

      fs.mkdirSync(path.join(firstRoot, 'src', 'prototypes', 'home'), { recursive: true });
      fs.writeFileSync(path.join(firstRoot, 'src', 'prototypes', 'home', 'index.tsx'), 'first\n', 'utf8');
      const source = await fetch(`${server.origin}/api/source?path=${encodeURIComponent('prototypes/home')}`);
      const sourceBody = await source.json();
      expect(source.status).toBe(424);
      expect(sourceBody.projectId).toBe('second-client');
    } finally {
      await server.close();
    }
  });
});
