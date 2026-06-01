import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getProjectMetadataPath,
} from '../projectCore/index.ts';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  startTestServer,
  writeJson,
  writeMakeClientProjectMarker,
  writeProjectMetadata,
} from './projects-api.helpers';

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjectApiTestRoots();
});


describe('make-server project resource capability APIs', () => {
  it('derives resource write capabilities from declared server-backed targets', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'capability-client', name: 'Capability Client' },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: true,
        axureExport: true,
        multiDevicePreview: true,
        localExports: {
          html: true,
          make: true,
        },
      },
      resourceWriteTargets: {
        docs: { path: 'content/docs' },
        data: { path: 'content/data' },
        prototypes: { path: 'content/prototypes' },
        themes: { path: 'content/themes' },
        templates: { path: 'content/templates' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const resources = await fetch(`${server.origin}/api/projects/capability-client/resources`)
        .then((response) => response.json());

      expect(resources.capabilities.resourceWrites).toEqual({
        prototypeCreate: false,
        prototypeUpload: true,
        docCreate: true,
        docImport: true,
        themeCreate: true,
        themeImport: true,
        dataCreate: true,
        dataImport: false,
        templateCreate: true,
        templateDuplicate: true,
      });
      expect(resources.capabilities.localExports).toEqual({
        html: true,
        make: false,
      });
    } finally {
      await server.close();
    }
  });

  it('disables create/upload/import routes that need a resource write adapter', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'upload-client', name: 'Upload Client' },
    });
    const server = await startTestServer(projectRoot);

    try {
      const docsUpload = await fetch(`${server.origin}/api/upload-docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            { name: 'Guide.md', content: '# Guide\n' },
          ],
        }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(docsUpload).toMatchObject({ status: 404, body: { error: 'Not found' } });
      expect(fs.existsSync(path.join(projectRoot, 'src/resources/Guide.md'))).toBe(false);

      const importStatus = await fetch(`${server.origin}/api/docs/import/markitdown-status`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(importStatus.status).toBe(404);

      const importForm = new FormData();
      importForm.append('files', new File(['# Imported\n'], 'Imported.md', { type: 'text/markdown' }));
      const imported = await fetch(`${server.origin}/api/docs/import`, {
        method: 'POST',
        body: importForm,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(imported).toMatchObject({ status: 404, body: { error: 'Not found' } });
      expect(fs.existsSync(path.join(projectRoot, 'src/resources/Imported.md'))).toBe(false);

      const mediaForm = new FormData();
      mediaForm.append('path', 'icons');
      mediaForm.append('file', new File(['<svg />'], 'logo.svg', { type: 'image/svg+xml' }));
      const mediaUpload = await fetch(`${server.origin}/api/media/upload`, {
        method: 'POST',
        body: mediaForm,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(mediaUpload).toMatchObject({
        status: 424,
        body: {
          code: 'RESOURCE_WRITE_ADAPTER_REQUIRED',
          adapterRequired: true,
          projectId: 'upload-client',
          details: {
            route: '/api/media/upload',
            reason: 'resource-layout-contract-deferred',
          },
        },
      });
      expect(fs.existsSync(path.join(projectRoot, 'assets/media/icons/logo.svg'))).toBe(false);

      const genericForm = new FormData();
      genericForm.append('uploadType', 'local_axure');
      genericForm.append('file', new File(['zip-ish'], 'sample.zip', { type: 'application/zip' }));
      const genericUpload = await fetch(`${server.origin}/api/upload`, {
        method: 'POST',
        body: genericForm,
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(genericUpload.status).toBe(424);
      expect(genericUpload.body).toMatchObject({
        code: 'UPLOAD_ADAPTER_REQUIRED',
        adapterRequired: true,
        projectId: 'upload-client',
      });

      const manualCreate = await fetch(`${server.origin}/api/docs/manual-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Manual Doc' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(manualCreate).toMatchObject({ status: 404, body: { error: 'Not found' } });
      expect(fs.existsSync(path.join(projectRoot, 'src/resources/Manual-Doc.md'))).toBe(false);

      const templateCreate = await fetch(`${server.origin}/api/docs/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Spec Template' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(templateCreate).toMatchObject({
        status: 424,
        body: {
          code: 'RESOURCE_WRITE_ADAPTER_REQUIRED',
          adapterRequired: true,
          details: { route: '/api/docs/templates' },
        },
      });

      fs.mkdirSync(path.join(projectRoot, 'src/resources/templates'), { recursive: true });
      fs.writeFileSync(path.join(projectRoot, 'src/resources/templates/base.md'), '# Base\n', 'utf8');
      const templateCopy = await fetch(`${server.origin}/api/docs/templates/base.md/copy`, {
        method: 'POST',
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(templateCopy).toMatchObject({
        status: 424,
        body: {
          code: 'RESOURCE_WRITE_ADAPTER_REQUIRED',
          adapterRequired: true,
          details: { route: '/api/docs/templates/:name/copy' },
        },
      });
      expect(fs.existsSync(path.join(projectRoot, 'src/resources/templates/base-copy.md'))).toBe(false);

      const createTable = await fetch(`${server.origin}/api/data/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName: 'Customers' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(createTable).toMatchObject({
        status: 424,
        body: {
          code: 'RESOURCE_WRITE_ADAPTER_REQUIRED',
          adapterRequired: true,
          details: { route: '/api/data/tables' },
        },
      });
      expect(fs.existsSync(path.join(projectRoot, 'src/database/Customers.json'))).toBe(false);

      const itemCheck = await fetch(`${server.origin}/api/items/check-references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'prototypes/home', action: 'delete' }),
      }).then((response) => response.json());
      expect(itemCheck).toMatchObject({ hasReferences: false, references: [] });
    } finally {
      await server.close();
    }
  });

  it('rejects unsafe resource write target metadata before create routes write files', async () => {
    const projectRoot = createTempRoot();
    writeMakeClientProjectMarker(projectRoot, 'unsafe-write-client', 'Unsafe Write Client');
    writeJson(getProjectMetadataPath(projectRoot), {
      schemaVersion: 1,
      project: { id: 'unsafe-write-client', name: 'Unsafe Write Client' },
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
          dataCreate: true,
          themeCreate: true,
          templateCreate: true,
          templateDuplicate: true,
        },
      },
      resourceWriteTargets: {
        data: { path: 'content/data' },
        themes: { path: 'content/themes' },
        templates: { path: '../outside-templates' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const templateCreate = await fetch(`${server.origin}/api/docs/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Escaping Template' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));

      expect(templateCreate).toMatchObject({
        status: 400,
      });
      expect(String(templateCreate.body.error || '')).toMatch(/outside project root/);
      expect(fs.existsSync(path.join(path.dirname(projectRoot), 'outside-templates'))).toBe(false);
    } finally {
      await server.close();
    }
  });
});
