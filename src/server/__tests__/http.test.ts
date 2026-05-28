import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  getAdminServerInfoPath,
  getConfigPath,
  getMakeClientMarkerPath,
  getProjectMetadataPath,
  getProjectRegistryPath,
  SIDEBAR_TREE_STORE_RELATIVE_PATH,
} from '../projectCore/index.ts';

import { startMakeServer } from '../index.ts';
import { handleCanvasApi } from '../managementApi.canvas.ts';
import { handleCodeReviewApi } from '../managementApi.codeReview.ts';
import { handleEntriesCompatibilityApi } from '../managementApi.entries.ts';
import { handleLegacyWebSocketApi } from '../managementApi.legacyWebSocket.ts';
import { handleWorkspaceApi } from '../managementApi.workspace.ts';

const tempRoots: string[] = [];

function createProjectRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axhub-make-server-http-'));
  tempRoots.push(root);
  writeMakeClientProjectMarker(root, 'test-client', path.basename(root));
  fs.mkdirSync(path.join(root, 'src/components/ref-button'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/components/ref-button/index.tsx'), 'export default function Button() {}', 'utf8');
  fs.writeFileSync(path.join(root, 'src/components/ref-button/index.html'), '<div id="root"></div>', 'utf8');
  fs.mkdirSync(path.join(root, 'assets/media/icons'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/media/logo.svg'), '<svg />', 'utf8');
  return root;
}

function createRegistryPath() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axhub-make-server-registry-'));
  tempRoots.push(root);
  return getProjectRegistryPath(root);
}

function writePrototype(root: string, name: string, source = 'export default function Page() {}') {
  const dir = path.join(root, 'src/prototypes', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.tsx'), source, 'utf8');
  fs.writeFileSync(path.join(dir, 'index.html'), '<div id="root"></div>', 'utf8');
}

function writeTheme(root: string, name: string) {
  const dir = path.join(root, 'src/themes', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.tsx'), 'export default {};', 'utf8');
}

function writeJson(filePath: string, value: unknown): void {
  if (filePath.endsWith(path.join('.axhub', 'make', 'project.json'))) {
    const raw = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, any>
      : {};
    const project = raw.project && typeof raw.project === 'object' && !Array.isArray(raw.project)
      ? raw.project as Record<string, unknown>
      : {};
    const id = typeof project.id === 'string' ? project.id.trim() : '';
    if (id) {
      const root = path.dirname(path.dirname(path.dirname(filePath)));
      const name = typeof project.name === 'string' ? project.name.trim() : id;
      writeMakeClientProjectMarker(root, id, name);
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeMakeClientProjectMarker(root: string, id: string, name: string): void {
  writeJson(getMakeClientMarkerPath(root), {
    schemaVersion: 1,
    kind: 'axhub-make-client',
    repository: 'https://github.com/lintendo/Axhub-Make/tree/main/client',
    project: { id, name },
  });
  writeJson(path.join(root, 'package.json'), {
    scripts: {
      dev: 'vite',
      'metadata:sync': 'node scripts/sync-project-metadata.mjs',
    },
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('make-server HTTP server', () => {
  it('exposes canvas handling from its domain module', () => {
    expect(handleCanvasApi).toBeTypeOf('function');
  });

  it('exposes code review handling from its domain module', () => {
    expect(handleCodeReviewApi).toBeTypeOf('function');
  });

  it('exposes entries compatibility handling from its domain module', () => {
    expect(handleEntriesCompatibilityApi).toBeTypeOf('function');
  });

  it('exposes legacy websocket handling from its domain module', () => {
    expect(handleLegacyWebSocketApi).toBeTypeOf('function');
  });

  it('exposes workspace handling from its domain module', () => {
    expect(handleWorkspaceApi).toBeTypeOf('function');
  });

  it('serves project registry APIs, active project resources, docs content, and entries compatibility', async () => {
    const projectRoot = createProjectRoot();
    const secondProjectRoot = createProjectRoot();
    const docPath = path.join(projectRoot, 'docs', 'spec.md');
    const secondDocPath = path.join(secondProjectRoot, 'docs', 'spec.md');
    fs.mkdirSync(path.dirname(docPath), { recursive: true });
    fs.mkdirSync(path.dirname(secondDocPath), { recursive: true });
    fs.writeFileSync(docPath, '# First Spec\n', 'utf8');
    fs.writeFileSync(secondDocPath, '# Second Spec\n', 'utf8');
    writeJson(getProjectMetadataPath(projectRoot), {
      schemaVersion: 1,
      project: { id: 'first', name: 'First Project' },
      resources: {
        prototypes: [
          {
            id: 'home',
            name: 'home',
            title: 'Home',
            clientUrl: 'http://localhost:3000/home',
          },
        ],
        docs: [
          {
            id: 'spec',
            name: 'spec',
            title: 'Spec',
            path: docPath,
          },
        ],
        themes: [],
        data: [],
        templates: [],
      },
      navigation: { prototypes: ['home'], docs: ['spec'] },
      orders: { themes: [], data: [], templates: [] },
      capabilities: { quickEdit: true, figmaExport: false, axureExport: false, multiDevicePreview: true },
    });
    writeJson(getProjectMetadataPath(secondProjectRoot), {
      schemaVersion: 1,
      project: { id: 'second', name: 'Second Project' },
      resources: {
        prototypes: [
          {
            id: 'dashboard',
            name: 'dashboard',
            title: 'Dashboard',
            clientUrl: 'http://localhost:3001/dashboard',
          },
        ],
        docs: [
          {
            id: 'spec',
            name: 'spec',
            title: 'Spec',
            path: secondDocPath,
          },
        ],
        themes: [],
        data: [],
        templates: [],
      },
      navigation: { prototypes: ['dashboard'], docs: ['spec'] },
      orders: { themes: [], data: [], templates: [] },
      capabilities: { quickEdit: false, figmaExport: true, axureExport: false, multiDevicePreview: true },
    });

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: getProjectRegistryPath(projectRoot),
    });

    try {
      const initialProjects = await fetch(`${server.origin}/api/projects`).then((response) => response.json());
      expect(initialProjects.activeProjectId).toBe('first');
      expect(initialProjects.projects).toEqual([
        expect.objectContaining({
          id: 'first',
          name: 'First Project',
          root: projectRoot,
        }),
      ]);

      writeMakeClientProjectMarker(secondProjectRoot, 'second', 'Second Project');
      const created = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: secondProjectRoot }),
      }).then((response) => response.json());
      expect(created.project).toMatchObject({ id: 'second', root: secondProjectRoot });

      const patched = await fetch(`${server.origin}/api/projects/second`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Second Renamed' }),
      }).then((response) => response.json());
      expect(patched.project).toMatchObject({ id: 'second', name: 'Second Renamed' });

      const activeUpdate = await fetch(`${server.origin}/api/projects/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'second' }),
      }).then((response) => response.json());
      expect(activeUpdate.activeProject.id).toBe('second');

      const context = await fetch(`${server.origin}/api/admin/context`).then((response) => response.json());
      expect(context.activeProject).toMatchObject({ id: 'second', name: 'Second Renamed' });
      expect(context.projects).toHaveLength(2);
      expect(context.capabilities.quickEdit).toBe(false);

      const resources = await fetch(`${server.origin}/api/projects/second/resources`).then((response) => response.json());
      expect(resources.resources.prototypes).toEqual([
        expect.objectContaining({
          id: 'dashboard',
          clientUrl: 'http://localhost:3001/dashboard',
          previewMode: 'clientRuntime',
        }),
      ]);

      const updatedResources = await fetch(`${server.origin}/api/projects/second/resources`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resources: {
            ...resources.resources,
            prototypes: [
              {
              id: 'settings',
              name: 'settings',
              title: 'Settings',
              clientUrl: 'http://localhost:3001/settings',
              pages: [
                { id: 'dashboard', title: '工作台' },
                { id: 'orders-list', title: '订单列表' },
              ],
              defaultPageId: 'dashboard',
            },
          ],
            components: [{ id: 'legacy-button' }],
          },
        }),
      }).then((response) => response.json());
      expect(updatedResources.resources.prototypes[0]).toMatchObject({ id: 'settings' });
      expect(updatedResources.resources.components).toBeUndefined();

      const entries = await fetch(`${server.origin}/api/entries.json`).then((response) => response.json());
      expect(entries.components).toEqual([]);
	      expect(entries.prototypes).toEqual([
	        expect.objectContaining({
	          name: 'settings',
	          clientUrl: 'http://localhost:3001/settings',
	          previewUrl: 'http://localhost:3001/settings',
	          pages: [
	            { id: 'dashboard', title: '工作台' },
	            { id: 'orders-list', title: '订单列表' },
	          ],
	          defaultPageId: 'dashboard',
	        }),
	      ]);
	      expect(entries.prototypes[0]).not.toHaveProperty('demoUrl');

      const docContent = await fetch(`${server.origin}/api/projects/second/docs/spec/content`).then((response) => response.json());
      expect(docContent).toMatchObject({ content: '# Second Spec\n', path: secondDocPath });

      const saveDoc = await fetch(`${server.origin}/api/projects/second/docs/spec/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# Updated Second Spec\n' }),
      }).then((response) => response.json());
      expect(saveDoc).toMatchObject({ success: true });
      expect(fs.readFileSync(secondDocPath, 'utf8')).toBe('# Updated Second Spec\n');

      const deleted = await fetch(`${server.origin}/api/projects/second`, { method: 'DELETE' }).then((response) => response.json());
      expect(deleted).toMatchObject({ success: true });
      expect(fs.existsSync(getProjectMetadataPath(secondProjectRoot))).toBe(true);

      const runtimeScript = await fetch(`${server.origin}/runtime/quick-edit.js`);
      expect(runtimeScript.status).toBe(200);
      expect(runtimeScript.headers.get('content-type')).toContain('javascript');
      expect(runtimeScript.headers.get('access-control-allow-origin')).toBe('*');
      const runtimeScriptText = await runtimeScript.text();
      expect(runtimeScriptText).toContain('axhub.quickEdit.runtimeReady');
      expect(runtimeScriptText).toContain('axhub.quickEdit.enter');
      expect(runtimeScriptText).toContain('axhub.quickEdit.patch');
      expect(runtimeScriptText).toContain('axhub.quickEdit.save');
      expect(runtimeScriptText).toContain('axhub.quickEdit.exit');
      expect(runtimeScriptText).toContain('axhub.quickEdit.error');
      expect(runtimeScriptText).toContain('protocolVersion');
      expect(runtimeScriptText).toContain('runtimeVersion');
      expect(runtimeScriptText).toContain('capabilities');
      expect(runtimeScriptText).toContain('document.elementFromPoint');
      expect(runtimeScriptText).not.toContain('inline-text');
      expect(runtimeScriptText).not.toContain('contenteditable');
    } finally {
      await server.close();
    }
  });

  it('serves admin assets locally even when runtime info is stale', async () => {
    const projectRoot = createProjectRoot();
    const adminRoot = path.join(projectRoot, 'admin-dist');
    fs.mkdirSync(path.join(adminRoot, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(adminRoot, 'index.html'), '<script src="/assets/index.js"></script>', 'utf8');
    fs.writeFileSync(path.join(adminRoot, 'assets/index.js'), 'console.log("admin asset");', 'utf8');
    writeJson(path.join(projectRoot, '.axhub/make/.dev-server-info.json'), {
      pid: 999999,
      port: 51720,
      host: 'localhost',
      origin: 'http://localhost:51720',
      projectRoot,
      startedAt: '2026-05-01T00:00:00.000Z',
    });

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot,
      registryPath: createRegistryPath(),
    });

    try {
      const asset = await fetch(`${server.origin}/assets/index.js`);
      expect(asset.status).toBe(200);
      expect(asset.headers.get('content-type')).toContain('javascript');
      expect(asset.headers.get('access-control-allow-origin')).toBe('*');
      expect(asset.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
      expect(asset.headers.get('cache-control')).toBe('no-cache');
      await expect(asset.text()).resolves.toBe('console.log("admin asset");');

      const versionedAsset = await fetch(`${server.origin}/assets/index.js?v=stable`);
      expect(versionedAsset.status).toBe(200);
      expect(versionedAsset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    } finally {
      await server.close();
    }
  });

  it('serves the admin app when no active project exists', async () => {
    const projectRoot = createProjectRoot();
    fs.rmSync(getMakeClientMarkerPath(projectRoot), { force: true });
    fs.rmSync(path.join(projectRoot, 'package.json'), { force: true });
    const adminRoot = path.join(projectRoot, 'admin-dist');
    fs.mkdirSync(adminRoot, { recursive: true });
    fs.writeFileSync(path.join(adminRoot, 'index.html'), '<html><body>Admin App</body></html>', 'utf8');

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot,
      registryPath: createRegistryPath(),
    });

    try {
      const projects = await fetch(`${server.origin}/api/projects`).then((response) => response.json());
      expect(projects).toEqual({ activeProjectId: null, projects: [] });

      const home = await fetch(`${server.origin}/`);
      await expect(home.text()).resolves.toContain('Admin App');
      expect(home.status).toBe(200);

      const context = await fetch(`${server.origin}/api/admin/context`);
      expect(context.status).toBe(409);
      await expect(context.json()).resolves.toMatchObject({ code: 'no-active-project' });
    } finally {
      await server.close();
    }
  });

  it('treats legacy websocket send as optional when the runtime route is missing', async () => {
    const projectRoot = createProjectRoot();
    const runtimeServer = http.createServer((_req, res) => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Not found' }));
    });
    await new Promise<void>((resolve) => runtimeServer.listen(0, 'localhost', resolve));
    const runtimeAddress = runtimeServer.address() as AddressInfo;

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: createRegistryPath(),
      runtimeOrigin: `http://localhost:${runtimeAddress.port}`,
    });

    try {
      const response = await fetch(`${server.origin}/api/ws/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'handshake', payload: 'prototype-admin' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        ok: true,
        sent: 0,
        warning: 'legacy websocket endpoint unavailable',
      });
    } finally {
      await server.close();
      await new Promise<void>((resolve) => runtimeServer.close(() => resolve()));
    }
  });

  it('serves legacy docs preview routes from make-server before runtime proxy fallback', async () => {
    const projectRoot = createProjectRoot();
    const adminRoot = path.join(projectRoot, 'admin-dist');
    const docPath = path.join(projectRoot, 'docs', 'spec.md');
    fs.mkdirSync(path.dirname(docPath), { recursive: true });
    fs.mkdirSync(adminRoot, { recursive: true });
    fs.writeFileSync(docPath, '# Project Spec\n\n## Intro\n', 'utf8');
    fs.writeFileSync(
      path.join(adminRoot, 'spec-template.html'),
      [
        '<title>{{TITLE}}</title><script>{{SPEC_URL}}</script>{{DOCS_CONFIG}}{{MULTI_DOC}}',
        '<script type="module">',
        "  import '/@vite/client';",
        "  import '@vitejs/plugin-react/preamble';",
        '</script>',
      ].join('\n'),
      'utf8',
    );
    writeJson(getProjectMetadataPath(projectRoot), {
      schemaVersion: 1,
      project: { id: 'docs-client', name: 'Docs Client' },
      resources: {
        prototypes: [],
        docs: [{ id: 'spec', name: 'spec', title: 'Project Spec', path: docPath }],
        themes: [],
        data: [],
        templates: [],
      },
    });

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot,
      registryPath: createRegistryPath(),
    });

    try {
      const preview = await fetch(`${server.origin}/docs/spec`).then((response) => response.text());
      expect(preview).toContain('<title>Docs: Project Spec</title>');
      expect(preview).toContain('/api/markdown-file?path=');
      expect(preview).toContain('false');
      expect(preview).not.toContain('/@vite/client');
      expect(preview).not.toContain('@vitejs/plugin-react/preamble');

      const legacyPreview = await fetch(`${server.origin}/assets/docs/spec/spec.html`, { redirect: 'manual' });
      expect(legacyPreview.status).toBe(302);
      expect(legacyPreview.headers.get('location')).toBe('/docs/spec');

      const markdown = await fetch(`${server.origin}/docs/spec.md`).then((response) => response.text());
      expect(markdown).toBe('# Project Spec\n\n## Intro\n');
    } finally {
      await server.close();
    }
  });

  it('does not fall back to another port when the requested admin port is already in use', async () => {
    const projectRoot = createProjectRoot();
    const registryPath = createRegistryPath();
    const first = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath,
    });

    try {
      await expect(startMakeServer({
        projectRoot,
        host: 'localhost',
        port: first.port,
        adminRoot: path.join(projectRoot, 'missing-admin'),
        registryPath,
      })).rejects.toMatchObject({ code: 'EADDRINUSE' });
      expect(fs.existsSync(getAdminServerInfoPath(projectRoot))).toBe(true);

      const health = await fetch(`${first.origin}/api/health`).then((response) => response.json());
      expect(health).toMatchObject({
        ok: true,
        role: 'admin',
        projectRoot,
        origin: first.origin,
        server: {
          origin: first.origin,
          port: first.port,
        },
      });

      const firstHealth = await fetch(`${first.origin}/api/health`).then((response) => response.json());
      expect(firstHealth).toMatchObject({
        ok: true,
        role: 'admin',
        projectRoot,
        origin: first.origin,
        devMode: false,
        server: {
          origin: first.origin,
          port: first.port,
        },
      });

      const context = await fetch(`${first.origin}/api/admin/context`).then((response) => response.json());
      expect(context).toMatchObject({
        projectRoot,
        runtime: {
          available: false,
        },
      });

      const configUpdate = await fetch(`${first.origin}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server: { host: 'localhost', allowLAN: false }, projectInfo: { name: 'Demo' } }),
      }).then((response) => response.json());
      expect(configUpdate).toMatchObject({ success: true });
      expect(JSON.parse(fs.readFileSync(path.join(projectRoot, '.axhub/make/axhub.config.json'), 'utf8'))).toMatchObject({
        server: { host: 'localhost', allowLAN: false },
      });

      const entries = await fetch(`${first.origin}/api/entries.json`).then((response) => response.json());
      expect(entries).toEqual({ components: [], prototypes: [] });

      const review = await fetch(`${first.origin}/api/code-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'components/ref-button' }),
      }).then((response) => response.json());
      expect(review).toMatchObject({
        passed: true,
        mode: 'default',
      });

      const axurePreview = await fetch(`${first.origin}/api/axure-api-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'components/ref-button' }),
      }).then((response) => response.json());
      expect(axurePreview).toMatchObject({
        hasAxureHandle: false,
      });

      writeJson(getProjectMetadataPath(projectRoot), {
        schemaVersion: 1,
        project: { id: 'metadata-only', name: 'Metadata Only Project' },
        resources: {
          prototypes: [
            {
              id: 'remote-home',
              name: 'remote-home',
              title: 'Remote Home',
              clientUrl: 'http://localhost:3000/remote-home',
            },
          ],
          docs: [],
          themes: [],
          data: [],
          templates: [],
        },
        navigation: { prototypes: ['remote-home'], docs: [] },
        orders: { themes: [], data: [], templates: [] },
        capabilities: { quickEdit: true, figmaExport: true, axureExport: true, multiDevicePreview: true },
      });
      await fetch(`${first.origin}/api/projects/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'metadata-only' }),
      });
      const metadataOnlyReview = await fetch(`${first.origin}/api/code-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'prototypes/remote-home' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(metadataOnlyReview).toMatchObject({
        status: 424,
        body: {
          code: 'SOURCE_METADATA_REQUIRED',
          sourceRequired: true,
          projectId: expect.any(String),
        },
      });

      const exportMake = await fetch(`${first.origin}/api/export-make?path=${encodeURIComponent('prototypes/home')}`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(exportMake).toMatchObject({
        status: 424,
        body: {
          code: 'ADAPTER_REQUIRED',
          adapterRequired: true,
        },
      });

      const exportHtml = await fetch(`${first.origin}/api/export-html?path=${encodeURIComponent('prototypes/home')}`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(exportHtml).toMatchObject({
        status: 424,
        body: {
          code: 'ADAPTER_REQUIRED',
          adapterRequired: true,
        },
      });

      const media = await fetch(`${first.origin}/api/media`).then((response) => response.json());
      expect(media).toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'icons',
          path: 'icons',
          type: 'folder',
        }),
        expect.objectContaining({
          name: 'logo.svg',
          path: 'logo.svg',
          type: 'image',
        }),
      ]));

      const createFolderResponse = await fetch(`${first.origin}/api/media/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'photos', parentPath: 'icons' }),
      });
      expect(createFolderResponse.status).toBe(200);
      expect(fs.existsSync(path.join(projectRoot, 'assets/media/icons/photos'))).toBe(true);

      const mediaFile = await fetch(`${first.origin}/api/media/file/logo.svg`);
      expect(mediaFile.status).toBe(200);
      expect(mediaFile.headers.get('content-type')).toBe('image/svg+xml');

      const docCheck = await fetch(`${first.origin}/api/docs/check-references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docName: 'overview.md', action: 'delete' }),
      }).then((response) => response.json());
      expect(docCheck).toMatchObject({
        docName: 'overview.md',
        hasReferences: false,
        references: [],
      });

      const canvasCreate = await fetch(`${first.origin}/api/canvas/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Main Canvas' }),
      }).then((response) => response.json());
      expect(canvasCreate).toMatchObject({
        displayName: 'Main Canvas',
      });
      expect(canvasCreate.name).toMatch(/main-canvas-\d+\.excalidraw|main-canvas\.excalidraw/);
    } finally {
      await first.close();
    }
  });

  it('reports devMode in health when started with Vite middleware', async () => {
    const projectRoot = createProjectRoot();
    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: createRegistryPath(),
      devMode: true,
    });

    try {
      const health = await fetch(`${server.origin}/api/health`).then((response) => response.json());
      expect(health).toMatchObject({
        ok: true,
        role: 'admin',
        projectRoot,
        origin: server.origin,
        devMode: true,
      });
    } finally {
      await server.close();
    }
  });

  it('proxies runtime HTML proxy module requests before admin Vite can transform them', async () => {
    const projectRoot = createProjectRoot();
    const runtimeServer = http.createServer((req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.end(`export const seen = ${JSON.stringify(req.url)};`);
    });
    await new Promise<void>((resolve) => runtimeServer.listen(0, 'localhost', resolve));
    const runtimeAddress = runtimeServer.address() as AddressInfo;

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: createRegistryPath(),
      runtimeOrigin: `http://localhost:${runtimeAddress.port}`,
      devMode: true,
    });

    try {
      const response = await fetch(`${server.origin}/@id/__x00__/prototypes/%E6%9C%AA%E5%91%BD%E5%90%8D/index.html?html-proxy&index=0.js`);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('javascript');
      expect(body).toContain('/@id/__x00__/prototypes/%E6%9C%AA%E5%91%BD%E5%90%8D/index.html?html-proxy&index=0.js');
    } finally {
      await server.close();
      await new Promise<void>((resolve) => runtimeServer.close(() => resolve()));
    }
  });

  it('serves project title and sidebar navigation from make project state files', async () => {
    const projectRoot = createProjectRoot();
    writePrototype(projectRoot, 'ref-home');
    writePrototype(projectRoot, 'order-dashboard');
    writeTheme(projectRoot, 'antd-new');
    writeTheme(projectRoot, 'trae-design');
    writeJson(getConfigPath(projectRoot), {
      projectInfo: {
        name: 'Demo Project',
      },
    });
    writeJson(path.join(projectRoot, SIDEBAR_TREE_STORE_RELATIVE_PATH), {
      version: 1,
      updatedAt: '2026-04-30T00:00:00.000Z',
      prototypes: [
        {
          id: 'item:prototypes:order-dashboard',
          kind: 'item',
          title: '订单驾驶舱',
          itemKey: 'prototypes/order-dashboard',
        },
        {
          id: 'folder:demos',
          kind: 'folder',
          title: '演示原型',
          children: [
            {
              id: 'item:prototypes:ref-home',
              kind: 'item',
              title: '首页演示',
              itemKey: 'prototypes/ref-home',
            },
          ],
        },
      ],
      components: [],
      docs: [],
      canvas: [],
      themes: ['trae-design', 'antd-new'],
      data: [],
      templates: [],
    });
    writeJson(getProjectMetadataPath(projectRoot), {
      schemaVersion: 1,
      project: {
        id: 'demo-project',
        name: 'Demo Project',
      },
      resources: {
        prototypes: [
          {
            id: 'order-dashboard',
            name: 'order-dashboard',
            title: '订单驾驶舱',
            clientUrl: 'http://localhost:3000/order-dashboard',
          },
          {
            id: 'ref-home',
            name: 'ref-home',
            title: '首页演示',
            clientUrl: 'http://localhost:3000/ref-home',
          },
        ],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
      navigation: { prototypes: ['order-dashboard', 'ref-home'], docs: [] },
      orders: { themes: [], data: [], templates: [] },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
      },
    });

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: createRegistryPath(),
    });

    try {
      const project = await fetch(`${server.origin}/api/workspace/project`).then((response) => response.json());
      expect(project).toEqual({ title: 'Demo Project' });

      const entries = await fetch(`${server.origin}/api/entries.json`).then((response) => response.json());
      expect(entries.components).toEqual([]);
      expect(entries.prototypes).toEqual(expect.arrayContaining([
	        expect.objectContaining({
	          name: 'order-dashboard',
	          displayName: '订单驾驶舱',
	          clientUrl: 'http://localhost:3000/order-dashboard',
	          previewUrl: 'http://localhost:3000/order-dashboard',
	        }),
	        expect.objectContaining({
	          name: 'ref-home',
	          displayName: '首页演示',
	          clientUrl: 'http://localhost:3000/ref-home',
	          previewUrl: 'http://localhost:3000/ref-home',
	        }),
	      ]));
	      expect(entries.prototypes.every((item: Record<string, unknown>) => !Object.prototype.hasOwnProperty.call(item, 'demoUrl'))).toBe(true);

      const navigation = await fetch(`${server.origin}/api/workspace/navigation?tab=prototypes`).then((response) => response.json());
      expect(navigation).toMatchObject({
        tab: 'prototypes',
        version: 1,
      });
      expect(navigation.tree).toEqual([
        {
          id: 'item:prototypes:order-dashboard',
          kind: 'item',
          title: '订单驾驶舱',
          itemKey: 'prototypes/order-dashboard',
        },
        {
          id: 'folder:demos',
          kind: 'folder',
          title: '演示原型',
          children: [
            {
              id: 'item:prototypes:ref-home',
              kind: 'item',
              title: '首页演示',
              itemKey: 'prototypes/ref-home',
            },
          ],
        },
      ]);

      const order = await fetch(`${server.origin}/api/workspace/resources/order?type=themes`).then((response) => response.json());
      expect(order).toEqual({
        type: 'themes',
        version: 1,
        order: ['trae-design', 'antd-new'],
      });

      writeTheme(projectRoot, 'new-theme');
      const reconciledOrder = await fetch(`${server.origin}/api/workspace/resources/order?type=themes`).then((response) => response.json());
      expect(reconciledOrder).toEqual({
        type: 'themes',
        version: 1,
        order: ['new-theme', 'trae-design', 'antd-new'],
      });
    } finally {
      await server.close();
    }
  });

  it('uses metadata theme order for workspace theme order and flat navigation trees', async () => {
    const projectRoot = createProjectRoot();
    ['kami', 'airbnb', 'apple', 'linear', 'notion'].forEach((themeName) => writeTheme(projectRoot, themeName));
    writeJson(path.join(projectRoot, SIDEBAR_TREE_STORE_RELATIVE_PATH), {
      version: 1,
      updatedAt: '2026-05-15T00:00:00.000Z',
      prototypes: [],
      components: [],
      docs: [],
      canvas: [],
      themesTree: ['kami', 'airbnb', 'apple', 'linear', 'notion'].map((themeName) => ({
        id: `item-themes-${themeName}`,
        kind: 'item',
        title: themeName,
        itemKey: `themes/${themeName}`,
      })),
      themes: ['kami', 'airbnb', 'apple', 'linear', 'notion'],
      data: [],
      templates: [],
    });
    writeJson(getProjectMetadataPath(projectRoot), {
      schemaVersion: 1,
      project: {
        id: 'demo-project',
        name: 'Demo Project',
      },
      resources: {
        prototypes: [],
        docs: [],
        themes: ['apple', 'linear', 'notion', 'airbnb', 'kami'].map((themeName) => ({
          id: themeName,
          name: themeName,
          title: themeName,
          sourcePath: `src/themes/${themeName}`,
        })),
        data: [],
        templates: [],
      },
      navigation: { prototypes: [], docs: [] },
      orders: {
        themes: ['apple', 'linear', 'notion', 'airbnb', 'kami'],
        data: [],
        templates: [],
      },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
      },
    });

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: createRegistryPath(),
    });

    try {
      const order = await fetch(`${server.origin}/api/workspace/resources/order?type=themes`).then((response) => response.json());
      expect(order.order).toEqual(['apple', 'linear', 'notion', 'airbnb', 'kami']);

      const navigation = await fetch(`${server.origin}/api/workspace/navigation?tab=themes`).then((response) => response.json());
      expect(navigation.tree.map((node: { itemKey?: string }) => node.itemKey)).toEqual([
        'themes/apple',
        'themes/linear',
        'themes/notion',
        'themes/airbnb',
        'themes/kami',
      ]);
    } finally {
      await server.close();
    }
  });

  it('normalizes generated repeated theme titles from persisted workspace navigation', async () => {
    const projectRoot = createProjectRoot();
    ['figma', 'orderful', 'custom-theme'].forEach((themeName) => writeTheme(projectRoot, themeName));
    writeJson(path.join(projectRoot, SIDEBAR_TREE_STORE_RELATIVE_PATH), {
      version: 1,
      updatedAt: '2026-05-15T00:00:00.000Z',
      prototypes: [],
      components: [],
      docs: [],
      canvas: [],
      themesTree: [
        {
          id: 'item-themes-figma',
          kind: 'item',
          title: 'Figma 主题 - Figma',
          itemKey: 'themes/figma',
        },
        {
          id: 'item-themes-orderful',
          kind: 'item',
          title: 'Orderful 主题 - Orderful',
          itemKey: 'themes/orderful',
        },
        {
          id: 'item-themes-custom-theme',
          kind: 'item',
          title: '手动主题名',
          itemKey: 'themes/custom-theme',
        },
      ],
      themes: ['figma', 'orderful', 'custom-theme'],
      data: [],
      templates: [],
    });
    writeJson(getProjectMetadataPath(projectRoot), {
      schemaVersion: 1,
      project: {
        id: 'demo-project',
        name: 'Demo Project',
      },
      resources: {
        prototypes: [],
        docs: [],
        themes: [
          { id: 'figma', name: 'figma', title: 'Figma', sourcePath: 'src/themes/figma' },
          { id: 'orderful', name: 'orderful', title: 'Orderful', sourcePath: 'src/themes/orderful' },
          { id: 'custom-theme', name: 'custom-theme', title: 'Custom Theme', sourcePath: 'src/themes/custom-theme' },
        ],
        data: [],
        templates: [],
      },
      navigation: { prototypes: [], docs: [] },
      orders: {
        themes: ['figma', 'orderful', 'custom-theme'],
        data: [],
        templates: [],
      },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
      },
    });

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: createRegistryPath(),
    });

    try {
      const navigation = await fetch(`${server.origin}/api/workspace/navigation?tab=themes`).then((response) => response.json());
      expect(navigation.tree.map((node: { title?: string }) => node.title)).toEqual([
        'Figma',
        'Orderful',
        '手动主题名',
      ]);

      const stored = JSON.parse(fs.readFileSync(path.join(projectRoot, SIDEBAR_TREE_STORE_RELATIVE_PATH), 'utf8'));
      expect(stored.themesTree.map((node: { title?: string }) => node.title)).toEqual([
        'Figma',
        'Orderful',
        '手动主题名',
      ]);
    } finally {
      await server.close();
    }
  });

  it('uses the registry project title when config has no project name', async () => {
    const projectRoot = createProjectRoot();
    writeJson(path.join(projectRoot, 'package.json'), {
      name: 'axhub-demo',
    });
    writeJson(getConfigPath(projectRoot), {
      projectInfo: {
        name: null,
      },
    });

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: createRegistryPath(),
    });

    try {
      const project = await fetch(`${server.origin}/api/workspace/project`).then((response) => response.json());
      expect(project).toEqual({ title: path.basename(projectRoot) });
    } finally {
      await server.close();
    }
  });

  it('uses the registry project title in project resource bundles instead of the configured copy', async () => {
    const projectRoot = createProjectRoot();
    writeJson(getConfigPath(projectRoot), {
      projectInfo: {
        name: '真实项目名称',
      },
    });
    writeJson(getProjectMetadataPath(projectRoot), {
      schemaVersion: 1,
      project: {
        id: 'file-name',
        name: 'file-name',
      },
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
      },
    });

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: createRegistryPath(),
    });

    try {
      const projects = await fetch(`${server.origin}/api/projects`).then((response) => response.json());
      const resources = await fetch(`${server.origin}/api/projects/${projects.activeProjectId}/resources`)
        .then((response) => response.json());

      expect(resources.project.name).toBe('file-name');
    } finally {
      await server.close();
    }
  });

  it('ignores the legacy axhub-make config title for admin display names', async () => {
    const projectRoot = createProjectRoot();
    writeJson(getConfigPath(projectRoot), {
      projectInfo: {
        name: 'axhub-make',
      },
    });

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: createRegistryPath(),
    });

    try {
      const project = await fetch(`${server.origin}/api/workspace/project`).then((response) => response.json());
      expect(project).toEqual({ title: path.basename(projectRoot) });
    } finally {
      await server.close();
    }
  });

  it('writes workspace navigation updates back to sidebar-tree.json', async () => {
    const projectRoot = createProjectRoot();
    writePrototype(projectRoot, 'ref-home');
    writeJson(path.join(projectRoot, SIDEBAR_TREE_STORE_RELATIVE_PATH), {
      version: 1,
      updatedAt: '2026-04-30T00:00:00.000Z',
      prototypes: [],
      components: [],
      docs: [],
      canvas: [],
      themes: [],
      data: [],
      templates: [],
    });

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: createRegistryPath(),
    });

    try {
      const update = await fetch(`${server.origin}/api/workspace/navigation?tab=prototypes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: [
            {
              id: 'item:prototypes:ref-home',
              kind: 'item',
              title: '首页演示',
              itemKey: 'prototypes/ref-home',
            },
          ],
        }),
      }).then((response) => response.json());
      expect(update).toMatchObject({ success: true, tab: 'prototypes' });

      const stored = JSON.parse(fs.readFileSync(path.join(projectRoot, SIDEBAR_TREE_STORE_RELATIVE_PATH), 'utf8'));
      expect(stored.prototypes).toEqual([
        {
          id: 'item:prototypes:ref-home',
          kind: 'item',
          title: '首页演示',
          itemKey: 'prototypes/ref-home',
        },
      ]);
      expect(fs.existsSync(path.join(projectRoot, '.axhub/make/workspace.json'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('accepts project metadata document ids when saving docs workspace navigation', async () => {
    const projectRoot = createProjectRoot();
    const docPath = path.join(projectRoot, 'docs', 'spec.md');
    fs.mkdirSync(path.dirname(docPath), { recursive: true });
    fs.writeFileSync(docPath, '# Project Spec\n', 'utf8');
    writeJson(getProjectMetadataPath(projectRoot), {
      schemaVersion: 1,
      project: { id: 'docs-client', name: 'Docs Client' },
      resources: {
        prototypes: [],
        docs: [{ id: 'spec', name: 'spec', title: 'Project Spec', path: docPath }],
        themes: [],
        data: [],
        templates: [],
      },
      navigation: { prototypes: [], docs: ['spec'] },
      orders: { themes: [], data: [], templates: [] },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
      },
    });
    writeJson(path.join(projectRoot, SIDEBAR_TREE_STORE_RELATIVE_PATH), {
      version: 1,
      updatedAt: '2026-04-30T00:00:00.000Z',
      prototypes: [],
      components: [],
      docs: [],
      canvas: [],
      themes: [],
      data: [],
      templates: [],
    });

    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: createRegistryPath(),
    });

    try {
      const response = await fetch(`${server.origin}/api/workspace/navigation?tab=docs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tree: [
            {
              id: 'folder:docs:product',
              kind: 'folder',
              title: '产品文档',
              children: [
                {
                  id: 'item:docs:spec',
                  kind: 'item',
                  title: 'Project Spec',
                  itemKey: 'docs/spec',
                },
              ],
            },
          ],
        }),
      });
      const update = await response.json();

      expect(response.status).toBe(200);
      expect(update).toMatchObject({ success: true, tab: 'docs' });
      expect(update.tree).toEqual([
        {
          id: 'folder:docs:product',
          kind: 'folder',
          title: '产品文档',
          children: [
            {
              id: 'item:docs:spec',
              kind: 'item',
              title: 'Project Spec',
              itemKey: 'docs/spec',
            },
          ],
        },
      ]);
    } finally {
      await server.close();
    }
  });
});
