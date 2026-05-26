import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getProjectMetadataPath,
  writeServerInfo,
} from '../projectCore/index.ts';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  registerProject,
  setActiveProject,
  startTestServer,
  writeJson,
  writeProjectMetadata,
  writeTable,
} from './projects-api.helpers';
import { handleProjectDataAndThemeApi } from '../managementApi.dataTheme.ts';

afterEach(() => {
  vi.restoreAllMocks();
  cleanupProjectApiTestRoots();
});

describe('make-server project data and theme APIs', () => {
  it('exposes data and theme handling from its domain module', () => {
    expect(handleProjectDataAndThemeApi).toBeTypeOf('function');
  });

  it('supports project-scoped data table CRUD and CSV import/export through the active project', async () => {
    const firstRoot = createTempRoot();
    const secondRoot = createTempRoot();
    writeProjectMetadata(firstRoot, {
      project: { id: 'first-client', name: 'First Client' },
    });
    writeProjectMetadata(secondRoot, {
      project: { id: 'second-client', name: 'Second Client' },
    });
    writeTable(firstRoot, 'orders', 'First Orders', [{ id: 1, title: 'first' }]);
    writeTable(secondRoot, 'orders', 'Second Orders', [{ id: 1, title: 'second' }]);

    const server = await startTestServer(firstRoot);

    try {
      await registerProject(server.origin, secondRoot, 'second-client', 'Second Client');
      await setActiveProject(server.origin, 'second-client');

      const records = await fetch(`${server.origin}/api/data/orders`).then((response) => response.json());
      expect(records).toEqual([{ id: 1, title: 'second' }]);

      const updated = await fetch(`${server.origin}/api/data/orders/1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'updated second' }),
      }).then((response) => response.json());
      expect(updated).toMatchObject({ id: 1, title: 'updated second' });

      const inserted = await fetch(`${server.origin}/api/data/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'created' }),
      }).then((response) => response.json());
      expect(inserted).toMatchObject({ title: 'created' });

      const imported = await fetch(`${server.origin}/api/data/orders/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: 'id,title\n3,imported\n' }),
      }).then((response) => response.json());
      expect(imported).toMatchObject({ success: true, recordCount: 1 });

      const csv = await fetch(`${server.origin}/api/data/orders/export`);
      expect(csv.status).toBe(200);
      expect(csv.headers.get('content-type')).toContain('text/csv');
      expect(await csv.text()).toContain('imported');

      expect(JSON.parse(fs.readFileSync(path.join(firstRoot, 'src/database/orders.json'), 'utf8')).records)
        .toEqual([{ id: 1, title: 'first' }]);
      expect(JSON.parse(fs.readFileSync(path.join(secondRoot, 'src/database/orders.json'), 'utf8')).records)
        .toEqual([{ id: 3, title: 'imported' }]);

      const rename = await fetch(`${server.origin}/api/data/tables/orders`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'customers', tableName: 'Customers' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(rename).toMatchObject({
        status: 200,
        body: {
          success: true,
          fileName: 'customers',
          tableName: 'Customers',
        },
      });
      expect(fs.existsSync(path.join(secondRoot, 'src/database/orders.json'))).toBe(false);
      expect(JSON.parse(fs.readFileSync(path.join(secondRoot, 'src/database/customers.json'), 'utf8'))).toMatchObject({
        tableName: 'Customers',
      });
    } finally {
      await server.close();
    }
  });

  it('returns structured errors for invalid data table, record, import, and export operations', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'data-error-client', name: 'Data Error Client' },
    });
    writeTable(projectRoot, 'orders', 'Orders', [{ id: 1, title: 'first' }]);
    writeTable(projectRoot, 'customers', 'Customers', []);
    const server = await startTestServer(projectRoot);

    try {
      const list = await fetch(`${server.origin}/api/data/tables`).then((response) => response.json());
      expect(list).toEqual(expect.arrayContaining([
        { fileName: 'orders', tableName: 'Orders' },
        { fileName: 'customers', tableName: 'Customers' },
      ]));

      const missingCreateName = await fetch(`${server.origin}/api/data/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName: '' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(missingCreateName).toMatchObject({
        status: 424,
        body: {
          code: 'RESOURCE_WRITE_ADAPTER_REQUIRED',
          details: {
            route: '/api/data/tables',
          },
        },
      });

      const invalidAdminPath = await fetch(`${server.origin}/api/data/tables/${encodeURIComponent('../escape')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'safe' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(invalidAdminPath).toMatchObject({
        status: 400,
        body: { code: 'VALIDATION_ERROR', error: 'Invalid fileName' },
      });

      const duplicateTable = await fetch(`${server.origin}/api/data/tables/orders`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'customers' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(duplicateTable).toMatchObject({
        status: 400,
        body: { code: 'TABLE_EXISTS' },
      });

      const missingExport = await fetch(`${server.origin}/api/data/missing/export`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(missingExport).toMatchObject({
        status: 404,
        body: { code: 'NOT_FOUND' },
      });

      const missingCsv = await fetch(`${server.origin}/api/data/orders/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: '' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(missingCsv).toMatchObject({
        status: 400,
        body: { code: 'VALIDATION_ERROR' },
      });

      const duplicateRecord = await fetch(`${server.origin}/api/data/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1, title: 'duplicate' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(duplicateRecord).toMatchObject({
        status: 400,
        body: { code: 'DUPLICATE_ID' },
      });

      const missingRecord = await fetch(`${server.origin}/api/data/orders/404`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(missingRecord).toMatchObject({
        status: 404,
        body: { code: 'NOT_FOUND' },
      });

      const record = await fetch(`${server.origin}/api/data/orders/1`)
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(record).toEqual({ status: 200, body: { id: 1, title: 'first' } });

      const deletedRecord = await fetch(`${server.origin}/api/data/orders/1`, { method: 'DELETE' })
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(deletedRecord).toEqual({ status: 200, body: { success: true } });

      const deletedTable = await fetch(`${server.origin}/api/data/tables/customers`, { method: 'DELETE' })
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(deletedTable).toEqual({ status: 200, body: { success: true } });
      expect(fs.existsSync(path.join(projectRoot, 'src/database/customers.json'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('disables theme creation without a resource write adapter while existing theme reads still work', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'theme-client', name: 'Theme Client' },
    });
    const themeDir = path.join(projectRoot, 'src/themes/brand');
    fs.mkdirSync(themeDir, { recursive: true });
    fs.writeFileSync(path.join(themeDir, 'designToken.json'), JSON.stringify({ name: 'Brand Theme' }, null, 2), 'utf8');
    fs.writeFileSync(path.join(themeDir, 'DESIGN.md'), '# Brand\n', 'utf8');
    fs.writeFileSync(path.join(themeDir, 'README.md'), '# Brand Theme\n', 'utf8');
    const server = await startTestServer(projectRoot);

    try {
      const create = await fetch(`${server.origin}/api/themes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'brand', displayName: 'Brand Theme', design: '# Brand\n' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(create).toMatchObject({
        status: 424,
        body: {
          code: 'RESOURCE_WRITE_ADAPTER_REQUIRED',
          adapterRequired: true,
          projectId: 'theme-client',
          details: {
            route: '/api/themes',
            reason: 'resource-layout-contract-deferred',
          },
        },
      });

      const rename = await fetch(`${server.origin}/api/themes/brand`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'brand-new', displayName: 'Brand New' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(rename).toMatchObject({
        status: 200,
        body: {
          success: true,
          name: 'brand-new',
          displayName: 'Brand New',
        },
      });
      expect(fs.existsSync(path.join(projectRoot, 'src/themes/brand'))).toBe(false);
      expect(fs.existsSync(path.join(projectRoot, 'src/themes/brand-new'))).toBe(true);

      const contents = await fetch(`${server.origin}/api/themes/get-contents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeName: 'brand-new' }),
      }).then((response) => response.json());
      expect(contents).toMatchObject({
        themeName: 'brand-new',
        design: '# Brand\n',
      });

      const referenceCheck = await fetch(`${server.origin}/api/themes/check-references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeName: 'brand-new', action: 'delete' }),
      }).then((response) => response.json());
      expect(referenceCheck).toMatchObject({
        hasReferences: false,
        references: [],
      });

      const deleted = await fetch(`${server.origin}/api/themes/brand-new`, { method: 'DELETE' })
        .then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(deleted).toMatchObject({
        status: 200,
        body: { success: true },
      });
      expect(fs.existsSync(path.join(projectRoot, 'src/themes/brand-new'))).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('serves theme preview links from project metadata instead of inferring theme routes', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'theme-link-client', name: 'Theme Link Client' },
      resources: {
        prototypes: [],
        docs: [],
        themes: [
          {
            id: 'antd-new',
            name: 'antd-new',
            title: 'Ant Design Theme',
            clientUrl: 'http://localhost:51720/themes/antd-new',
            sourcePath: 'src/themes/antd-new',
            updatedAt: '2026-05-04T00:00:00.000Z',
          },
        ],
        data: [],
        templates: [],
      },
      orders: { themes: ['antd-new'], data: [], templates: [] },
    });
    const themeDir = path.join(projectRoot, 'src/themes/antd-new');
    fs.mkdirSync(themeDir, { recursive: true });
    fs.writeFileSync(path.join(themeDir, 'README.md'), '# Directory Title Should Not Win\n', 'utf8');
    const server = await startTestServer(projectRoot);

    try {
      const listResponse = await fetch(`${server.origin}/api/themes`);
      const themes = await listResponse.json();
      expect(listResponse.status).toBe(200);
      expect(themes).toEqual([
        expect.objectContaining({
          id: 'antd-new',
          name: 'antd-new',
	          displayName: 'Ant Design Theme',
	          clientUrl: 'http://localhost:51720/themes/antd-new',
	          previewUrl: 'http://localhost:51720/themes/antd-new',
	          sourcePath: 'src/themes/antd-new',
	          path: 'src/themes/antd-new',
	          hasDoc: true,
	        }),
	      ]);
	      expect(themes[0]).not.toHaveProperty('demoUrl');
	      expect(themes[0]).not.toHaveProperty('designTokenPath');

      const detailResponse = await fetch(`${server.origin}/api/themes/antd-new`);
      const theme = await detailResponse.json();
      expect(detailResponse.status).toBe(200);
      expect(theme).toEqual(expect.objectContaining({
        id: 'antd-new',
        name: 'antd-new',
	        displayName: 'Ant Design Theme',
	        clientUrl: 'http://localhost:51720/themes/antd-new',
	        previewUrl: 'http://localhost:51720/themes/antd-new',
	      }));
	      expect(theme).not.toHaveProperty('demoUrl');
    } finally {
      await server.close();
    }
  });

  it('serves make-client theme preview links from the running client runtime on legacy theme APIs without mutating metadata', async () => {
    const projectRoot = createTempRoot();
    writeProjectMetadata(projectRoot, {
      project: { id: 'make-client-theme-api', name: 'Make Client Theme API' },
      resources: {
        prototypes: [],
        docs: [],
        themes: [
          {
            id: 'genesis',
            name: 'genesis',
            title: 'Genesis',
            sourcePath: 'src/themes/genesis',
          },
        ],
        data: [],
        templates: [],
      },
      orders: { themes: ['genesis'], data: [], templates: [] },
    });
    writeJson(path.join(projectRoot, '.axhub', 'make', 'client.json'), {
      schemaVersion: 1,
      kind: 'axhub-make-client',
      project: { id: 'make-client-theme-api', name: 'Make Client Theme API' },
      repository: 'https://github.com/lintendo/Axhub-Make/tree/main/client',
    });
    writeServerInfo(projectRoot, 'runtime', {
      pid: 12345,
      port: 51720,
      host: 'localhost',
      origin: 'http://localhost:51720',
      projectRoot,
      startedAt: '2026-05-12T00:00:00.000Z',
    });
    const themeDir = path.join(projectRoot, 'src/themes/genesis');
    fs.mkdirSync(themeDir, { recursive: true });
    fs.writeFileSync(path.join(themeDir, 'index.tsx'), 'export default function Genesis() { return null; }', 'utf8');
    const server = await startTestServer(projectRoot);

    try {
      const themes = await fetch(`${server.origin}/api/themes`).then((response) => response.json());
      expect(themes[0]).toMatchObject({
        id: 'genesis',
        clientUrl: 'http://localhost:51720/themes/genesis',
        previewUrl: 'http://localhost:51720/themes/genesis',
      });

      const theme = await fetch(`${server.origin}/api/themes/genesis`).then((response) => response.json());
      expect(theme).toMatchObject({
        id: 'genesis',
        clientUrl: 'http://localhost:51720/themes/genesis',
        previewUrl: 'http://localhost:51720/themes/genesis',
      });

      const stored = JSON.parse(fs.readFileSync(getProjectMetadataPath(projectRoot), 'utf8'));
      expect(stored.resources.themes[0]).not.toHaveProperty('clientUrl');
    } finally {
      await server.close();
    }
  });

  it('manages theme contents, sync, rename, and delete through declared theme targets', async () => {
    const projectRoot = createTempRoot();
    const themesDir = path.join(projectRoot, 'content', 'themes');
    const brandDir = path.join(themesDir, 'brand');
    fs.mkdirSync(brandDir, { recursive: true });
    fs.writeFileSync(path.join(brandDir, 'designToken.json'), JSON.stringify({ name: 'Brand Theme', color: 'blue' }, null, 2), 'utf8');
    fs.writeFileSync(path.join(brandDir, 'README.md'), '# Brand Theme\nTheme docs.\n', 'utf8');
    fs.writeFileSync(path.join(brandDir, 'DESIGN.md'), '# Brand Design\n', 'utf8');
    fs.writeFileSync(path.join(brandDir, 'globals.css'), ':root { color: blue; }\n', 'utf8');
    fs.writeFileSync(path.join(brandDir, 'index.tsx'), 'export default null;\n', 'utf8');
    writeProjectMetadata(projectRoot, {
      project: { id: 'theme-target-client', name: 'Theme Target Client' },
      resources: {
        prototypes: [],
        docs: [],
        themes: [
          {
            id: 'brand',
            name: 'brand',
            title: 'Brand Theme',
            path: 'content/themes/brand',
          },
        ],
        data: [],
        templates: [],
      },
      navigation: { prototypes: [], docs: [] },
      orders: { themes: ['brand'], data: [], templates: [] },
      capabilities: {
        quickEdit: true,
        figmaExport: false,
        axureExport: false,
        multiDevicePreview: true,
        resourceWrites: {
          docCreate: false,
          docImport: false,
          templateCreate: false,
          templateDuplicate: false,
          dataCreate: false,
          themeCreate: true,
        },
      },
      resourceWriteTargets: {
        themes: { type: 'project-relative-path', path: 'content/themes' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const list = await fetch(`${server.origin}/api/themes`).then((response) => response.json());
      expect(list).toEqual([
        expect.objectContaining({
          id: 'brand',
          name: 'brand',
          displayName: 'Brand Theme',
          description: 'Brand Theme',
          hasDoc: true,
          hasDesignToken: true,
          hasGlobals: true,
          hasDesignSpec: true,
          hasIndexTsx: true,
          absoluteFilePath: brandDir,
        }),
      ]);

      const contents = await fetch(`${server.origin}/api/themes/get-contents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeName: 'brand' }),
      }).then((response) => response.json());
      expect(contents).toMatchObject({
        themeName: 'brand',
        design: '# Brand Design\n',
        globals: ':root { color: blue; }\n',
        readme: '# Brand Theme\nTheme docs.\n',
      });

      const references = await fetch(`${server.origin}/api/themes/check-references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeName: 'brand', action: 'rename' }),
      }).then((response) => response.json());
      expect(references).toMatchObject({
        themeName: 'brand',
        action: 'rename',
        hasReferences: false,
      });

      const sync = await fetch(`${server.origin}/api/themes/sync-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeName: 'brand' }),
      }).then((response) => response.json());
      expect(sync).toEqual({ success: true });
      expect(fs.readFileSync(path.join(projectRoot, 'DESIGN.md'), 'utf8')).toBe('# Brand Design\n');

      const rename = await fetch(`${server.origin}/api/themes/brand`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Brand Refresh' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(rename).toMatchObject({
        status: 200,
        body: {
          success: true,
          name: 'brand',
          previousName: 'brand',
          displayName: 'Brand Refresh',
        },
      });
      expect(fs.existsSync(path.join(themesDir, 'brand'))).toBe(true);
      expect(fs.existsSync(path.join(themesDir, 'brand-refresh'))).toBe(false);
      expect(JSON.parse(fs.readFileSync(path.join(themesDir, 'brand', 'designToken.json'), 'utf8'))).toMatchObject({
        name: 'Brand Refresh',
        color: 'blue',
      });

      const missingRename = await fetch(`${server.origin}/api/themes/missing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Missing' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(missingRename).toMatchObject({
        status: 404,
        body: { error: 'Theme not found' },
      });

      const removeDesign = await fetch(`${server.origin}/api/themes/sync-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeName: '' }),
      }).then((response) => response.json());
      expect(removeDesign).toEqual({ success: true, removed: true });
      expect(fs.existsSync(path.join(projectRoot, 'DESIGN.md'))).toBe(false);

      const deleted = await fetch(`${server.origin}/api/themes/brand`, { method: 'DELETE' })
        .then((response) => response.json());
      expect(deleted).toEqual({ success: true });
      expect(fs.existsSync(path.join(themesDir, 'brand'))).toBe(false);

      const metadata = JSON.parse(fs.readFileSync(getProjectMetadataPath(projectRoot), 'utf8'));
      expect(metadata.resources.themes).toEqual([]);
      expect(metadata.orders.themes).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it('syncs the selected theme DESIGN.md into the same client directory as AGENTS.md', async () => {
    const projectRoot = createTempRoot();
    const clientRoot = path.join(projectRoot, 'client');
    const themesDir = path.join(clientRoot, 'src', 'themes');
    const brandDir = path.join(themesDir, 'brand');
    fs.mkdirSync(brandDir, { recursive: true });
    fs.writeFileSync(path.join(clientRoot, 'AGENTS.md'), '# Client Agents\n', 'utf8');
    fs.writeFileSync(path.join(brandDir, 'DESIGN.md'), '# Client Brand Design\n', 'utf8');
    writeProjectMetadata(clientRoot, {
      project: { id: 'nested-client', name: 'Nested Client' },
      resources: {
        prototypes: [],
        docs: [],
        themes: [
          {
            id: 'brand',
            name: 'brand',
            path: 'src/themes/brand',
            sourcePath: 'src/themes/brand',
          },
        ],
        data: [],
        templates: [],
      },
      orders: { themes: ['brand'], data: [], templates: [] },
      capabilities: {
        resourceWrites: {
          themeCreate: true,
        },
        resourceTargets: {
          themes: { type: 'project-relative-path', path: 'src/themes' },
        },
      },
    });

    const server = await startTestServer(clientRoot);

    try {
      const sync = await fetch(`${server.origin}/api/themes/sync-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeName: 'brand' }),
      }).then((response) => response.json());

      expect(sync).toEqual({ success: true });
      expect(fs.readFileSync(path.join(clientRoot, 'DESIGN.md'), 'utf8')).toBe('# Client Brand Design\n');
      expect(fs.existsSync(path.join(projectRoot, 'DESIGN.md'))).toBe(false);

      const removeDesign = await fetch(`${server.origin}/api/themes/sync-design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeName: '' }),
      }).then((response) => response.json());

      expect(removeDesign).toEqual({ success: true, removed: true });
      expect(fs.existsSync(path.join(clientRoot, 'DESIGN.md'))).toBe(false);
    } finally {
      await server.close();
    }
  });
});
