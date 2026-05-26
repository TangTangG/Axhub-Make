import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const childProcessMock = vi.hoisted(() => ({
  execFile: vi.fn((_file: string, _args: string[], optionsOrCallback?: unknown, maybeCallback?: unknown) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    if (typeof callback === 'function') {
      callback(null, '', '');
    }
  }),
}));

vi.mock('node:child_process', async (importActual) => {
  const actual = await importActual<typeof import('node:child_process')>();
  return {
    ...actual,
    execFile: childProcessMock.execFile,
  };
});

import {
  getProjectMetadataPath,
} from '../projectCore/index.ts';

import {
  cleanupProjectApiTestRoots,
  createTempRoot,
  startTestServer,
  writeProjectMetadata,
} from './projects-api.helpers';
import { handleProjectDocsApi } from '../managementApi.docs.ts';
import { buildSystemOpenCommand } from '../managementApi.workspace.ts';

afterEach(() => {
  childProcessMock.execFile.mockClear();
  cleanupProjectApiTestRoots();
});

function writeMultipartBody(boundary: string, files: Array<{ fieldName: string; fileName: string; content: string }>): string {
  return [
    ...files.flatMap((file) => [
      `--${boundary}`,
      `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.fileName}"`,
      'Content-Type: text/markdown',
      '',
      file.content,
    ]),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

describe('make-server project docs APIs', () => {
  it('exposes docs handling from its domain module', () => {
    expect(handleProjectDocsApi).toBeTypeOf('function');
  });

  it('lists, uploads, copies, renames, and deletes docs inside the declared docs target', async () => {
    const projectRoot = createTempRoot();
    const docsDir = path.join(projectRoot, 'content', 'docs');
    fs.mkdirSync(path.join(docsDir, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'guide.md'), '# Guide\n\nTop-level guide.\n', 'utf8');
    fs.writeFileSync(path.join(docsDir, 'nested', 'guide.md'), '# Guide Title\n\nUseful notes.\n', 'utf8');
    fs.writeFileSync(path.join(docsDir, 'README.md'), '# Ignored\n', 'utf8');
    fs.writeFileSync(path.join(docsDir, '.scratch.md'), '# Hidden\n', 'utf8');
    writeProjectMetadata(projectRoot, {
      project: { id: 'docs-client', name: 'Docs Client' },
      resources: {
        prototypes: [],
        docs: [
          {
            id: 'guide',
            name: 'guide',
            title: 'Guide',
            path: path.join(docsDir, 'guide.md'),
          },
        ],
        themes: [],
        data: [],
        templates: [],
      },
      navigation: { prototypes: [], docs: ['guide'] },
      capabilities: {
        quickEdit: true,
        figmaExport: false,
        axureExport: false,
        multiDevicePreview: true,
        resourceWrites: {
          docCreate: true,
          docImport: true,
          templateCreate: false,
          templateDuplicate: false,
          dataCreate: false,
          themeCreate: false,
        },
      },
      resourceWriteTargets: {
        docs: { path: 'content/docs' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const docs = await fetch(`${server.origin}/api/docs`).then((response) => response.json());
      expect(docs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'nested/guide.md',
          displayName: 'Guide Title',
          description: 'Useful notes.',
          absoluteFilePath: path.join(docsDir, 'nested', 'guide.md'),
        }),
      ]));
      expect(docs).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'README.md' }),
        expect.objectContaining({ name: '.scratch.md' }),
      ]));

      const uploadBoundary = '----axhub-docs-boundary';
      const upload = await fetch(`${server.origin}/api/docs/upload`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${uploadBoundary}` },
        body: writeMultipartBody(uploadBoundary, [
          { fieldName: 'file', fileName: 'Plan Draft.md', content: '# Uploaded Plan\n\nBody\n' },
        ]),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(upload).toMatchObject({
        status: 201,
        body: {
          success: true,
          files: [
            expect.objectContaining({
              id: 'Plan-Draft',
              displayName: 'Uploaded Plan',
              name: 'Plan-Draft.md',
            }),
          ],
        },
      });
      expect(fs.existsSync(path.join(docsDir, 'Plan-Draft.md'))).toBe(true);

      const protectedCheck = await fetch(`${server.origin}/api/docs/check-references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docName: 'project-overview.md', action: 'delete' }),
      }).then((response) => response.json());
      expect(protectedCheck).toMatchObject({
        docName: 'project-overview.md',
        protected: true,
        code: 'PROTECTED_DOC',
      });

      const encodedGuide = encodeURIComponent('guide.md');
      const copied = await fetch(`${server.origin}/api/docs/${encodedGuide}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Guide Copy' }),
      }).then(async (response) => ({ status: response.status, body: await response.json() }));
      expect(copied).toMatchObject({
        status: 201,
        body: {
          success: true,
          projectId: 'docs-client',
          name: 'guide-copy.md',
          id: 'guide-copy',
          displayName: 'Guide Copy',
        },
      });

      const renamed = await fetch(`${server.origin}/api/docs/${encodedGuide}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newBaseName: 'Renamed Guide' }),
      }).then((response) => response.json());
      expect(renamed).toMatchObject({
        success: true,
        name: 'Renamed-Guide.md',
        absoluteFilePath: path.join(docsDir, 'Renamed-Guide.md'),
      });
      expect(fs.existsSync(path.join(docsDir, 'Renamed-Guide.md'))).toBe(true);

      const deleted = await fetch(`${server.origin}/api/docs/Plan-Draft.md`, { method: 'DELETE' })
        .then((response) => response.json());
      expect(deleted).toEqual({ success: true });
      expect(fs.existsSync(path.join(docsDir, 'Plan-Draft.md'))).toBe(false);

      const metadata = JSON.parse(fs.readFileSync(getProjectMetadataPath(projectRoot), 'utf8'));
      expect(metadata.resources.docs).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'Renamed-Guide', name: 'Renamed-Guide' }),
        expect.objectContaining({ id: 'guide-copy', name: 'guide-copy' }),
      ]));
      expect(metadata.resources.docs).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'Plan-Draft' }),
      ]));
    } finally {
      await server.close();
    }
  });

  it('opens docs through the shared filesystem opener without shell command strings', async () => {
    const projectRoot = createTempRoot();
    const docsDir = path.join(projectRoot, 'content', 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'guide.md'), '# Guide\n', 'utf8');
    writeProjectMetadata(projectRoot, {
      project: { id: 'docs-open-client', name: 'Docs Open Client' },
      resources: {
        prototypes: [],
        docs: [],
        themes: [],
        data: [],
        templates: [],
      },
      navigation: { prototypes: [], docs: [] },
      capabilities: {
        quickEdit: true,
        quickEditMode: 'clientRuntime',
        figmaExport: false,
        axureExport: false,
        multiDevicePreview: true,
        resourceWrites: {
          docCreate: true,
          docImport: true,
        },
      },
      resourceWriteTargets: {
        docs: { path: 'content/docs' },
      },
    });
    const server = await startTestServer(projectRoot);

    try {
      const response = await fetch(`${server.origin}/api/docs/open-system`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docName: 'guide.md' }),
      });
      const body = await response.json();
      const docPath = path.join(docsDir, 'guide.md');
      const openCommand = buildSystemOpenCommand(docPath);

      expect(response.status).toBe(200);
      expect(body).toEqual({ success: true, path: docPath });
      expect(childProcessMock.execFile).toHaveBeenCalledWith(
        openCommand.command,
        openCommand.args,
        expect.objectContaining({ timeout: 10000 }),
        expect.any(Function),
      );
    } finally {
      await server.close();
    }
  });
});
