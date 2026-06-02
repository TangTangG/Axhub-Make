import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  getConfigPath,
  getMakeClientMarkerPath,
  getProjectEditHistoryDir,
  getProjectExportsDir,
  getProjectMetadataPath,
  getProjectRegistryPath,
  getProjectSessionsDir,
} from '../projectCore/index.ts';

import { startMakeServer } from '../index';

const tempRoots: string[] = [];

function createTempRoot(prefix = 'axhub-make-projects-api-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeMakeClientMarkerForProject(projectRoot: string, id: string, name: string) {
  writeJson(getMakeClientMarkerPath(projectRoot), {
    schemaVersion: 1,
    kind: 'axhub-make-client',
    repository: 'https://github.com/lintendo/Axhub-Make/tree/main/client',
    project: { id, name },
  });
}

function writeMakeClientPackageForProject(projectRoot: string) {
  writeJson(path.join(projectRoot, 'package.json'), {
    scripts: {
      dev: 'vite',
      'metadata:sync': 'node scripts/sync-project-metadata.mjs',
    },
  });
}

function writeProjectMetadata(projectRoot: string, overrides: Record<string, unknown> = {}) {
  const docPath = path.join(projectRoot, 'docs', 'spec.md');
  fs.mkdirSync(path.dirname(docPath), { recursive: true });
  fs.writeFileSync(docPath, '# Spec\n', 'utf8');
  writeJson(getProjectMetadataPath(projectRoot), {
    schemaVersion: 1,
    project: { id: path.basename(projectRoot), name: path.basename(projectRoot) },
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
      themes: [{ id: 'theme-a', name: 'theme-a' }],
      data: [{ id: 'orders', name: 'orders' }],
      templates: [{ id: 'prd', name: 'prd' }],
    },
    navigation: { prototypes: ['home'], docs: ['spec'] },
    orders: { themes: ['theme-a'], data: ['orders'], templates: ['prd'] },
    capabilities: {
      quickEdit: true,
      quickEditMode: 'clientRuntime',
      figmaExport: true,
      axureExport: false,
      multiDevicePreview: true,
    },
    ...overrides,
  });
  return { docPath };
}

async function startTestServer(projectRoot: string, registryHome = createTempRoot('axhub-make-projects-api-home-')) {
  return startMakeServer({
    projectRoot,
    host: 'localhost',
    port: 0,
    adminRoot: path.join(projectRoot, 'missing-admin'),
    registryPath: getProjectRegistryPath(registryHome),
  });
}

async function registerExistingMakeProject(origin: string, projectRoot: string, expectedStatus = 201) {
  const response = await fetch(`${origin}/api/projects/make/register-existing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ root: projectRoot }),
  });
  expect(response.status).toBe(expectedStatus);
  return response.json();
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('make-server project APIs', () => {
  it('rejects generic project registration because projects must be official Make clients', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const newProjectRoot = createTempRoot();
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startMakeServer({
      projectRoot: defaultRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(defaultRoot, 'missing-admin'),
      registryPath: getProjectRegistryPath(registryHome),
    });

    try {
      const response = await fetch(`${server.origin}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'new-client',
          name: 'New Client',
          root: newProjectRoot,
        }),
      });

      const body = await response.json();

      expect(response.status).toBe(410);
      expect(body).toMatchObject({
        code: 'MAKE_CLIENT_PROJECT_REQUIRED',
      });
      expect(fs.existsSync(getProjectMetadataPath(newProjectRoot))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('rejects generic selected project registration even when metadata exists', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot);
    const selectedRoot = createTempRoot();
    writeProjectMetadata(selectedRoot, {
      project: { id: 'selected-client', name: 'Selected Client' },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startMakeServer({
      projectRoot: defaultRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(defaultRoot, 'missing-admin'),
      registryPath: getProjectRegistryPath(registryHome),
    });

    try {
      const response = await fetch(`${server.origin}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: selectedRoot }),
      });
      const body = await response.json();

      expect(response.status).toBe(410);
      expect(body).toMatchObject({
        code: 'MAKE_CLIENT_PROJECT_REQUIRED',
      });
    } finally {
      await server.close();
    }
  });

  it('does not auto-register a metadata-only startup root', async () => {
    const defaultRoot = createTempRoot();
    writeProjectMetadata(defaultRoot, {
      project: { id: 'metadata-only-default', name: 'Metadata Only Default' },
    });
    const server = await startTestServer(defaultRoot);

    try {
      const listResponse = await fetch(`${server.origin}/api/projects`);
      const list = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expect(list).toEqual({
        activeProjectId: null,
        projects: [],
      });
    } finally {
      await server.close();
    }
  });

  it('does not auto-register a marker-backed startup root', async () => {
    const startupRoot = createTempRoot();
    writeMakeClientMarkerForProject(startupRoot, 'startup-client', 'Startup Client');
    writeProjectMetadata(startupRoot, {
      project: { id: 'startup-client', name: 'Startup Client' },
    });
    const server = await startTestServer(startupRoot);

    try {
      const listResponse = await fetch(`${server.origin}/api/projects`);
      const list = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expect(list).toEqual({
        activeProjectId: null,
        projects: [],
      });
    } finally {
      await server.close();
    }
  });

  it('keeps marker-backed startup root untouched when listing projects', async () => {
    const startupRoot = createTempRoot();
    writeMakeClientMarkerForProject(startupRoot, 'make-project', 'Axhub Make');
    writeProjectMetadata(startupRoot, {
      project: { id: 'make-project', name: 'Axhub Make' },
    });
    const markerBefore = fs.readFileSync(getMakeClientMarkerPath(startupRoot), 'utf8');
    const metadataBefore = fs.readFileSync(getProjectMetadataPath(startupRoot), 'utf8');
    const server = await startTestServer(startupRoot);

    try {
      const list = await fetch(`${server.origin}/api/projects`).then((response) => response.json());

      expect(list).toEqual({
        activeProjectId: null,
        projects: [],
      });
      expect(fs.readFileSync(getMakeClientMarkerPath(startupRoot), 'utf8')).toBe(markerBefore);
      expect(fs.readFileSync(getProjectMetadataPath(startupRoot), 'utf8')).toBe(metadataBefore);
    } finally {
      await server.close();
    }
  });

  it('exposes current project LAN access capability from project config', async () => {
    const defaultRoot = createTempRoot();
    writeMakeClientMarkerForProject(defaultRoot, 'lan-disabled', 'LAN Disabled');
    writeMakeClientPackageForProject(defaultRoot);
    writeProjectMetadata(defaultRoot, {
      project: { id: 'lan-disabled', name: 'LAN Disabled' },
    });
    writeJson(getConfigPath(defaultRoot), {
      server: { allowLAN: false },
    });
    const server = await startTestServer(defaultRoot);

    try {
      await registerExistingMakeProject(server.origin, defaultRoot);
      const response = await fetch(`${server.origin}/api/projects/lan-disabled/resources`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.capabilities.lanAccessAllowed).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('defaults current project LAN access capability to enabled when config omits allowLAN', async () => {
    const defaultRoot = createTempRoot();
    writeMakeClientMarkerForProject(defaultRoot, 'lan-default', 'LAN Default');
    writeMakeClientPackageForProject(defaultRoot);
    writeProjectMetadata(defaultRoot, {
      project: { id: 'lan-default', name: 'LAN Default' },
    });
    const server = await startTestServer(defaultRoot);

    try {
      await registerExistingMakeProject(server.origin, defaultRoot);
      const response = await fetch(`${server.origin}/api/projects/lan-default/resources`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.capabilities.lanAccessAllowed).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('serves project resources by explicit projectId and no longer exposes unused project compatibility endpoints', async () => {
    const projectRoot = createTempRoot();
    writeMakeClientMarkerForProject(projectRoot, 'client-a', 'Client A');
    writeMakeClientPackageForProject(projectRoot);
    writeProjectMetadata(projectRoot, {
      project: { id: 'client-a', name: 'Client A' },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: getProjectRegistryPath(registryHome),
    });

    try {
      await registerExistingMakeProject(server.origin, projectRoot);
      const resources = await fetch(`${server.origin}/api/projects/client-a/resources`).then((response) => response.json());
      expect(resources.project).toEqual({ id: 'client-a', name: 'Client A' });
      expect(resources.navigation).toEqual({ prototypes: ['home'], docs: ['spec'] });
      expect(resources.orders).toEqual({ themes: ['theme-a'], data: ['orders'], templates: ['prd'] });
      expect(resources.capabilities).toMatchObject({ quickEdit: true, axureExport: false });

      for (const url of [
        `${server.origin}/api/projects/client-a/context`,
        `${server.origin}/api/projects/client-a/navigation?tab=prototypes`,
        `${server.origin}/api/projects/client-a/orders?type=themes`,
      ]) {
        const response = await fetch(url);
        expect(response.status).toBe(404);
      }
    } finally {
      await server.close();
    }
  });

  it('reconciles project resources from the filesystem when serving resources', async () => {
    const projectRoot = createTempRoot();
    writeMakeClientMarkerForProject(projectRoot, 'client-a', 'Client A');
    writeMakeClientPackageForProject(projectRoot);
    const prototypesDir = path.join(projectRoot, 'content', 'prototypes');
    const docsDir = path.join(projectRoot, 'content', 'docs');
    const themesDir = path.join(projectRoot, 'content', 'themes');
    const staleDocPath = path.join(docsDir, 'stale.md');
    fs.mkdirSync(path.join(prototypesDir, 'draft'), { recursive: true });
    fs.writeFileSync(path.join(prototypesDir, 'draft', 'index.tsx'), 'export default null;\n', 'utf8');
    fs.mkdirSync(path.join(prototypesDir, 'fresh'), { recursive: true });
    fs.writeFileSync(path.join(prototypesDir, 'fresh', 'index.tsx'), '/**\n * @name Fresh Prototype\n */\nexport default null;\n', 'utf8');
    fs.mkdirSync(path.join(prototypesDir, 'ignored-no-entry'), { recursive: true });
    fs.writeFileSync(path.join(prototypesDir, 'ignored-no-entry', 'style.css'), '.ignored {}\n', 'utf8');
    fs.mkdirSync(path.join(docsDir, 'nested'), { recursive: true });
    fs.mkdirSync(path.join(themesDir, 'fresh-theme'), { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'nested', 'guide.md'), '# Guide Title\n\nUseful notes.\n', 'utf8');
    fs.writeFileSync(path.join(docsDir, 'readme.md'), '# Ignored Readme\n', 'utf8');
    fs.writeFileSync(path.join(docsDir, '.draft.md'), '# Hidden\n', 'utf8');
    writeProjectMetadata(projectRoot, {
      project: { id: 'client-a', name: 'Client A' },
      resources: {
        prototypes: [
          {
            id: 'draft',
            name: 'draft',
            title: 'Draft',
            clientUrl: 'http://localhost:3000/draft',
            placeholder: true,
          },
          {
            id: 'ghost',
            name: 'ghost',
            title: 'Ghost',
            clientUrl: 'http://localhost:3000/ghost',
            filePath: 'content/prototypes/ghost/index.tsx',
          },
        ],
        docs: [
          { id: 'stale', name: 'stale', title: 'Stale', path: staleDocPath },
          { id: 'readme', name: 'readme.md', title: 'Readme', path: path.join(docsDir, 'readme.md') },
        ],
        themes: [
          { id: 'missing-theme', name: 'missing-theme' },
        ],
        data: [],
        templates: [],
      },
      navigation: { prototypes: ['draft', 'ghost'], docs: ['stale', 'readme', 'stale'] },
      orders: { themes: ['missing-theme'], data: [], templates: [] },
      resourceWriteTargets: {
        prototypes: { type: 'project-relative-path', path: 'content/prototypes' },
        docs: { type: 'project-relative-path', path: 'content/docs' },
        themes: { type: 'project-relative-path', path: 'content/themes' },
      },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: getProjectRegistryPath(registryHome),
    });

    try {
      await registerExistingMakeProject(server.origin, projectRoot);
      const response = await fetch(`${server.origin}/api/projects/client-a/resources`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.resources.prototypes[0]).toMatchObject({
        id: 'draft',
        placeholder: true,
        placeholderGuide: expect.objectContaining({
          kind: 'prototype-empty',
        }),
      });
      expect(body.resources.prototypes).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'ghost' }),
        expect.objectContaining({ id: 'ignored-no-entry' }),
      ]));
      expect(body.resources.prototypes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'fresh',
          name: 'fresh',
          title: 'Fresh Prototype',
          clientUrl: '/prototypes/fresh',
          filePath: 'content/prototypes/fresh/index.tsx',
          absoluteFilePath: path.join(prototypesDir, 'fresh', 'index.tsx'),
          previewMode: 'clientRuntime',
        }),
      ]));
      expect(body.navigation.prototypes).toEqual(['draft', 'fresh']);
      expect(body.resources.docs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'nested/guide',
          title: 'Guide Title',
          path: path.join(docsDir, 'nested', 'guide.md'),
        }),
      ]));
      expect(body.resources.docs).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'stale' }),
        expect.objectContaining({ id: 'readme' }),
      ]));
      expect(body.resources.themes).toEqual([
        expect.objectContaining({ id: 'fresh-theme' }),
      ]);
      expect(body.navigation.docs).toEqual(['nested/guide']);
      expect(body.orders.themes).toEqual(['fresh-theme']);

      const stored = JSON.parse(fs.readFileSync(getProjectMetadataPath(projectRoot), 'utf8'));
      expect(stored.resources.prototypes[0].placeholderGuide).toMatchObject({ kind: 'prototype-empty' });
      expect(stored.resources.prototypes).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'ghost' }),
        expect.objectContaining({ id: 'ignored-no-entry' }),
      ]));
      expect(stored.resources.prototypes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: 'fresh',
          title: 'Fresh Prototype',
          filePath: 'content/prototypes/fresh/index.tsx',
        }),
      ]));
      expect(stored.navigation.prototypes).toEqual(['draft', 'fresh']);
      expect(stored.navigation.docs).toEqual(['nested/guide']);
    } finally {
      await server.close();
    }
  });

  it('handles project registry mutations, active project validation, and doc content updates', async () => {
    const projectRoot = createTempRoot();
    writeMakeClientMarkerForProject(projectRoot, 'client-a', 'Client A');
    writeMakeClientPackageForProject(projectRoot);
    writeProjectMetadata(projectRoot, {
      project: { id: 'client-a', name: 'Client A' },
    });
    const otherProjectRoot = createTempRoot();
    writeMakeClientMarkerForProject(otherProjectRoot, 'client-b', 'Client B');
    writeMakeClientPackageForProject(otherProjectRoot);
    writeProjectMetadata(otherProjectRoot, {
      project: { id: 'client-b', name: 'Client B' },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: getProjectRegistryPath(registryHome),
    });

    try {
      await registerExistingMakeProject(server.origin, projectRoot);
      const list = await fetch(`${server.origin}/api/projects`).then((response) => response.json());
      expect(list).toMatchObject({
        activeProjectId: 'client-a',
        projects: [expect.objectContaining({ id: 'client-a', root: projectRoot })],
      });

      const genericRegister = await fetch(`${server.origin}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'missing-root' }),
      });
      expect(genericRegister.status).toBe(410);

      const register = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: otherProjectRoot }),
      });
      expect(register.status).toBe(201);

      const duplicate = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: otherProjectRoot }),
      });
      expect(duplicate.status).toBe(200);

      const missingActive = await fetch(`${server.origin}/api/projects/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(missingActive.status).toBe(400);

      const activeUpdate = await fetch(`${server.origin}/api/projects/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'client-a' }),
      }).then((response) => response.json());
      expect(activeUpdate.activeProject).toMatchObject({ id: 'client-a', root: projectRoot });

      const patch = await fetch(`${server.origin}/api/projects/client-a`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Renamed Client A' }),
      }).then((response) => response.json());
      expect(patch.project).toMatchObject({ id: 'client-a', name: 'Renamed Client A' });

      const missingProject = await fetch(`${server.origin}/api/projects/not-found/resources`);
      expect(missingProject.status).toBe(404);

      const missingDoc = await fetch(`${server.origin}/api/projects/client-a/docs/not-found/content`);
      expect(missingDoc.status).toBe(404);

      const docRead = await fetch(`${server.origin}/api/projects/client-a/docs/spec/content`).then((response) => response.json());
      expect(docRead.content).toBe('# Spec\n');

      const docWrite = await fetch(`${server.origin}/api/projects/client-a/docs/spec/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# Updated Spec\n' }),
      }).then((response) => response.json());
      expect(docWrite).toMatchObject({ success: true });
      expect(fs.readFileSync(path.join(projectRoot, 'docs', 'spec.md'), 'utf8')).toBe('# Updated Spec\n');

      const deleted = await fetch(`${server.origin}/api/projects/client-a`, { method: 'DELETE' }).then((response) => response.json());
      expect(deleted).toEqual({ success: true });
      const deletedProject = await fetch(`${server.origin}/api/projects/client-a/resources`);
      expect(deletedProject.status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it('does not repoint an existing make client registry entry from a marker-backed startup root', async () => {
    const previousRoot = createTempRoot('axhub-make-old-client-');
    writeMakeClientMarkerForProject(previousRoot, 'make-project', 'Old Make Client');
    writeMakeClientPackageForProject(previousRoot);
    writeProjectMetadata(previousRoot, {
      project: { id: 'make-project', name: 'Old Make Client' },
    });
    const currentRoot = createTempRoot('axhub-make-current-client-');
    writeMakeClientMarkerForProject(currentRoot, 'make-project', 'Current Make Client');
    writeMakeClientPackageForProject(currentRoot);
    writeProjectMetadata(currentRoot, {
      project: { id: 'make-project', name: 'Current Make Client' },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const registryPath = getProjectRegistryPath(registryHome);
    const previousServer = await startMakeServer({
      projectRoot: previousRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(previousRoot, 'missing-admin'),
      registryPath,
    });

    try {
      const previousRegister = await fetch(`${previousServer.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: previousRoot }),
      });
      expect(previousRegister.status).toBe(201);

      const previousList = await fetch(`${previousServer.origin}/api/projects`).then((response) => response.json());
      expect(previousList.projects).toEqual([expect.objectContaining({ id: 'make-project', root: previousRoot })]);
    } finally {
      await previousServer.close();
    }

    const server = await startMakeServer({
      projectRoot: currentRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(currentRoot, 'missing-admin'),
      registryPath,
    });

    try {
      const startupList = await fetch(`${server.origin}/api/projects`).then((response) => response.json());
      expect(startupList).toMatchObject({
        activeProjectId: 'make-project',
        projects: [expect.objectContaining({
          id: 'make-project',
          root: previousRoot,
          metadataPath: getProjectMetadataPath(previousRoot),
        })],
      });
    } finally {
      await server.close();
    }
  });

  it('treats legacy official make-project default names as unnamed during explicit registration', async () => {
    const projectRoot = createTempRoot();
    writeMakeClientMarkerForProject(projectRoot, 'make-project', 'Axhub Make');
    writeMakeClientPackageForProject(projectRoot);
    writeProjectMetadata(projectRoot, {
      project: { id: 'make-project', name: 'Axhub Make' },
    });
    const server = await startTestServer(projectRoot);

    try {
      const register = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: projectRoot }),
      });
      expect(register.status).toBe(201);

      const list = await fetch(`${server.origin}/api/projects`).then((response) => response.json());
      expect(list.projects).toEqual([
        expect.objectContaining({
          id: 'make-project',
          name: '',
        }),
      ]);

      const resources = await fetch(`${server.origin}/api/projects/make-project/resources`).then((response) => response.json());
      expect(resources.project).toEqual({
        id: 'make-project',
        name: '',
      });

      const marker = JSON.parse(fs.readFileSync(getMakeClientMarkerPath(projectRoot), 'utf8'));
      expect(marker.project).toEqual({
        id: 'make-project',
        name: '',
      });
      const metadata = JSON.parse(fs.readFileSync(getProjectMetadataPath(projectRoot), 'utf8'));
      expect(metadata.project).toEqual({
        id: 'make-project',
        name: '',
      });
    } finally {
      await server.close();
    }
  });

  it('rejects doc content reads when metadata points outside the project root', async () => {
    const projectRoot = createTempRoot();
    writeMakeClientMarkerForProject(projectRoot, 'client-a', 'Client A');
    writeMakeClientPackageForProject(projectRoot);
    const outsideRoot = createTempRoot('axhub-make-projects-api-outside-');
    const outsideDocPath = path.join(outsideRoot, 'outside.md');
    fs.writeFileSync(outsideDocPath, '# Outside\n', 'utf8');
    writeProjectMetadata(projectRoot, {
      project: { id: 'client-a', name: 'Client A' },
      resources: {
        prototypes: [],
        docs: [
          {
            id: 'outside',
            name: 'outside',
            title: 'Outside',
            path: outsideDocPath,
          },
        ],
        themes: [],
        data: [],
        templates: [],
      },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const registryPath = getProjectRegistryPath(registryHome);
    writeJson(registryPath, {
      schemaVersion: 1,
      activeProjectId: 'client-a',
      projects: [
        {
          id: 'client-a',
          name: 'Client A',
          root: projectRoot,
          metadataPath: getProjectMetadataPath(projectRoot),
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });
    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath,
    });

    try {
      const response = await fetch(`${server.origin}/api/projects/client-a/docs/outside/content`);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toMatchObject({
        code: 'DOC_PATH_OUTSIDE_PROJECT',
      });
    } finally {
      await server.close();
    }
  });

  it('repairs a registered make client project when its metadata file is missing', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'client-a', name: 'Client A' },
    });
    const missingMetadataRoot = createTempRoot();
    writeMakeClientMarkerForProject(missingMetadataRoot, 'stale', 'Stale Project');
    writeMakeClientPackageForProject(missingMetadataRoot);
    writeProjectMetadata(missingMetadataRoot, {
      project: { id: 'stale', name: 'Stale Project' },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: getProjectRegistryPath(registryHome),
    });

    try {
      const registerResponse = await fetch(`${server.origin}/api/projects/make/register-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: missingMetadataRoot }),
      });
      expect(registerResponse.status).toBe(201);
      fs.rmSync(getProjectMetadataPath(missingMetadataRoot), { force: true });

      const response = await fetch(`${server.origin}/api/projects/stale/resources`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.project).toMatchObject({
        id: 'stale',
        name: 'Stale Project',
      });
      expect(fs.existsSync(getProjectMetadataPath(missingMetadataRoot))).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('writes project communication records and lists Axure artifacts by explicit projectId', async () => {
    const projectRoot = createTempRoot();
    const otherProjectRoot = createTempRoot();
    writeMakeClientMarkerForProject(projectRoot, 'client-a', 'Client A');
    writeMakeClientPackageForProject(projectRoot);
    writeProjectMetadata(projectRoot, {
      project: { id: 'client-a', name: 'Client A' },
    });
    writeMakeClientMarkerForProject(otherProjectRoot, 'client-b', 'Client B');
    writeMakeClientPackageForProject(otherProjectRoot);
    writeProjectMetadata(otherProjectRoot, {
      project: { id: 'client-b', name: 'Client B' },
    });
    const registryHome = createTempRoot('axhub-make-projects-api-home-');
    const server = await startMakeServer({
      projectRoot,
      host: 'localhost',
      port: 0,
      adminRoot: path.join(projectRoot, 'missing-admin'),
      registryPath: getProjectRegistryPath(registryHome),
    });

    try {
      await registerExistingMakeProject(server.origin, projectRoot);
      await registerExistingMakeProject(server.origin, otherProjectRoot);

      const sessionResponse = await fetch(`${server.origin}/api/projects/client-a/communication/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: 'home',
          resourceType: 'prototype',
          clientUrlOrigin: 'http://localhost:3000',
          runtimeVersion: '0.1.0',
          status: 'ready',
        }),
      });
      const exportResponse = await fetch(`${server.origin}/api/projects/client-a/communication/exports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: 'home',
          resourceType: 'prototype',
          operationType: 'figma.copy',
          status: 'success',
        }),
      });
      const editResponse = await fetch(`${server.origin}/api/projects/client-a/communication/edit-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: 'home',
          resourceType: 'prototype',
          operationType: 'quickEdit.save',
          status: 'success',
        }),
      });
      const diagnosticResponse = await fetch(`${server.origin}/api/projects/client-a/communication/runtime-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageType: 'axhub.quickEdit.patch',
          status: 'success',
        }),
      });

      expect(sessionResponse.status).toBe(201);
      expect(exportResponse.status).toBe(201);
      expect(editResponse.status).toBe(201);
      expect(diagnosticResponse.status).toBe(201);
      expect(fs.readdirSync(getProjectSessionsDir(projectRoot))).toHaveLength(2);
      expect(fs.readdirSync(getProjectExportsDir(projectRoot))).toHaveLength(1);
      expect(fs.readdirSync(getProjectEditHistoryDir(projectRoot))).toHaveLength(1);
      expect(fs.existsSync(path.join(projectRoot, '.axhub', 'make', 'artifacts', 'figma'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, '.axhub', 'make', 'artifacts', 'quick-edit'))).toBe(false);
      expect(fs.existsSync(getProjectSessionsDir(otherProjectRoot))).toBe(false);
      expect(fs.existsSync(getProjectExportsDir(otherProjectRoot))).toBe(false);
      expect(fs.existsSync(getProjectEditHistoryDir(otherProjectRoot))).toBe(false);

      const artifactsResponse = await fetch(`${server.origin}/api/projects/client-a/artifacts/axure`);
      expect(artifactsResponse.status).toBe(404);
    } finally {
      await server.close();
    }
  });

});
